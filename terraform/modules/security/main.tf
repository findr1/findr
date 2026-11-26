# Rules are separate resources (not inside the NSG), so the CD pipeline can add
# and remove its own temporary SSH rule without Terraform deleting it.

# ---------- Bastion (public subnet) ----------

resource "azurerm_network_security_group" "bastion" {
  name                = "${var.name_prefix}-bastion-nsg"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}


# SSH only from our own IPs
resource "azurerm_network_security_rule" "bastion_ssh" {
  name                        = "allow-ssh-from-allowed-ips"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22"
  source_address_prefixes     = var.allowed_ssh_cidrs
  destination_address_prefix  = var.public_subnet_cidr
  resource_group_name         = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.bastion.name
}

# Priorities 110-199 are free for the CD pipeline's temporary runner rule

resource "azurerm_network_security_rule" "bastion_deny_all" {
  name                        = "deny-all-inbound"
  priority                    = 4000
  direction                   = "Inbound"
  access                      = "Deny"
  protocol                    = "*"
  source_port_range           = "*"
  destination_port_range      = "*"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.bastion.name
}

resource "azurerm_subnet_network_security_group_association" "public" {
  subnet_id                 = var.public_subnet_id
  network_security_group_id = azurerm_network_security_group.bastion.id
}

# ---------- App and monitoring (private subnet) ----------

resource "azurerm_network_security_group" "private" {
  name                = "${var.name_prefix}-private-nsg"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

# Website traffic. The private VMs have no public IP, so the only way in from the
# internet is through the Load Balancer. A Standard Load Balancer keeps the user's
# IP, so the source here has to be "Internet", not the Load Balancer's address.
resource "azurerm_network_security_rule" "private_http" {
  #checkov:skip=CKV_AZURE_160:Users must reach the website. The private VMs have no public IP, so this traffic can only arrive through the Load Balancer, which only forwards port 80 to the app VM.
  name                        = "allow-http-through-load-balancer"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = tostring(var.app_port)
  source_address_prefix       = "Internet"
  destination_address_prefix  = var.private_subnet_cidr
  resource_group_name         = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.private.name
}

# Load Balancer health checks
resource "azurerm_network_security_rule" "private_lb_probe" {
  name                        = "allow-load-balancer-health-probe"
  priority                    = 110
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = tostring(var.app_port)
  source_address_prefix       = "AzureLoadBalancer"
  destination_address_prefix  = var.private_subnet_cidr
  resource_group_name         = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.private.name
}

# SSH only from the bastion subnet
resource "azurerm_network_security_rule" "private_ssh_from_bastion" {
  name                        = "allow-ssh-from-bastion"
  priority                    = 120
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22"
  source_address_prefix       = var.public_subnet_cidr
  destination_address_prefix  = var.private_subnet_cidr
  resource_group_name         = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.private.name
}

resource "azurerm_network_security_rule" "private_deny_all" {
  name                        = "deny-all-inbound"
  priority                    = 4000
  direction                   = "Inbound"
  access                      = "Deny"
  protocol                    = "*"
  source_port_range           = "*"
  destination_port_range      = "*"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = var.resource_group_name
  network_security_group_name = azurerm_network_security_group.private.name
}

resource "azurerm_subnet_network_security_group_association" "private" {
  subnet_id                 = var.private_subnet_id
  network_security_group_id = azurerm_network_security_group.private.id
}
