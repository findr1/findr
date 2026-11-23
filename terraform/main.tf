data "azurerm_client_config" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # Registry names must be unique in all of Azure and use only letters and numbers
  # Cosmos DB names must also be unique in all of Azure
  cosmos_name = lower("${local.name_prefix}-cosmos-${substr(replace(data.azurerm_client_config.current.subscription_id, "-", ""), 0, 6)}")

  acr_name = lower("${var.project_name}${var.environment}${substr(replace(data.azurerm_client_config.current.subscription_id, "-", ""), 0, 6)}")

  tags = {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  }
}

resource "azurerm_resource_group" "main" {
  name     = "${local.name_prefix}-rg"
  location = var.location
  tags     = local.tags
}

# VNet with a public subnet (bastion) and a private subnet (app)
module "network" {
  source              = "./modules/network"
  name_prefix         = local.name_prefix
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  vnet_address_space  = var.vnet_address_space
  public_subnet_cidr  = var.public_subnet_cidr
  private_subnet_cidr = var.private_subnet_cidr
  tags                = local.tags
}

# Firewall rules for the public and private subnets
module "security" {
  source              = "./modules/security"
  name_prefix         = local.name_prefix
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  public_subnet_id    = module.network.public_subnet_id
  private_subnet_id   = module.network.private_subnet_id
  public_subnet_cidr  = var.public_subnet_cidr
  private_subnet_cidr = var.private_subnet_cidr
  allowed_ssh_cidrs   = var.allowed_ssh_cidrs
  app_port            = var.app_port
  tags                = local.tags
}

# The only server you can SSH to from the internet
module "bastion" {
  source              = "./modules/compute"
  name                = "${local.name_prefix}-bastion"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = module.network.public_subnet_id
  public_ip_enabled   = true
  vm_size             = var.bastion_vm_size
  admin_username      = var.admin_username
  ssh_public_key      = file(pathexpand(var.ssh_public_key_path))
  image_publisher     = var.image_publisher
  image_offer         = var.image_offer
  image_sku           = var.image_sku
  tags                = merge(local.tags, { role = "bastion" })

  depends_on = [module.security]
}

# The server that runs Findr. No public IP: users come through the Load Balancer,
# SSH comes through the bastion
module "app" {
  source              = "./modules/compute"
  name                = "${local.name_prefix}-app"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = module.network.private_subnet_id
  public_ip_enabled   = false
  vm_size             = var.app_vm_size
  admin_username      = var.admin_username
  ssh_public_key      = file(pathexpand(var.ssh_public_key_path))
  image_publisher     = var.image_publisher
  image_offer         = var.image_offer
  image_sku           = var.image_sku
  tags                = merge(local.tags, { role = "app" })

  depends_on = [module.security]
}

# Monitoring server: Prometheus, Grafana and Alertmanager. No public IP,
# Grafana opens through the bastion
module "monitoring" {
  source              = "./modules/compute"
  name                = "${local.name_prefix}-monitoring"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = module.network.private_subnet_id
  public_ip_enabled   = false
  vm_size             = var.monitoring_vm_size
  admin_username      = var.admin_username
  ssh_public_key      = file(pathexpand(var.ssh_public_key_path))
  image_publisher     = var.image_publisher
  image_offer         = var.image_offer
  image_sku           = var.image_sku
  tags                = merge(local.tags, { role = "monitoring" })

  depends_on = [module.security]
}

# One public address for Findr. Also gives the private VM a way out to the internet
module "loadbalancer" {
  source                           = "./modules/loadbalancer"
  name_prefix                      = local.name_prefix
  location                         = azurerm_resource_group.main.location
  resource_group_name              = azurerm_resource_group.main.name
  app_nic_id                       = module.app.nic_id
  app_ip_configuration_name        = module.app.ip_configuration_name
  app_port                         = var.app_port
  health_probe_path                = var.health_probe_path
  monitoring_nic_id                = module.monitoring.nic_id
  monitoring_ip_configuration_name = module.monitoring.ip_configuration_name
  tags                             = local.tags
}

# Private container registry. The app VM can pull, CD can push
module "registry" {
  source              = "./modules/registry"
  name                = local.acr_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  pull_principal_id   = module.app.principal_id
  push_principal_id   = var.cd_principal_id
  tags                = local.tags
}

# Only the monitoring VM may read the app VM's metrics:
# node_exporter (9100) and the app's private /metrics port (9464)
resource "azurerm_network_security_rule" "metrics_from_monitoring" {
  name                        = "allow-metrics-from-monitoring"
  priority                    = 130
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_ranges     = ["9100", "9464"]
  source_address_prefix       = module.monitoring.private_ip
  destination_address_prefix  = module.app.private_ip
  resource_group_name         = azurerm_resource_group.main.name
  network_security_group_name = module.security.private_nsg_name
}

# Grafana only from the bastion subnet (open it with an SSH tunnel through the bastion)
resource "azurerm_network_security_rule" "grafana_from_bastion" {
  name                        = "allow-grafana-from-bastion"
  priority                    = 140
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "3000"
  source_address_prefix       = var.public_subnet_cidr
  destination_address_prefix  = module.monitoring.private_ip
  resource_group_name         = azurerm_resource_group.main.name
  network_security_group_name = module.security.private_nsg_name
}

# What the CD pipeline may do (only if cd_principal_id is set)
resource "azurerm_role_assignment" "cd_reader" {
  count                = var.cd_principal_id == null ? 0 : 1
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Reader"
  principal_id         = var.cd_principal_id
  principal_type       = "ServicePrincipal"
}

# Lets CD add and remove its own SSH rule on the bastion firewall during a deploy
resource "azurerm_role_assignment" "cd_bastion_firewall" {
  count                = var.cd_principal_id == null ? 0 : 1
  scope                = module.security.bastion_nsg_id
  role_definition_name = "Network Contributor"
  principal_id         = var.cd_principal_id
  principal_type       = "ServicePrincipal"
}

# Managed MongoDB (Cosmos DB). Only the private subnet can reach it
module "database" {
  source              = "./modules/database"
  name                = local.cosmos_name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allowed_subnet_id   = module.network.private_subnet_id
  free_tier_enabled   = var.cosmos_free_tier
  tags                = local.tags
}
