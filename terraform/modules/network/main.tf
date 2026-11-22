resource "azurerm_virtual_network" "main" {
  name                = "${var.name_prefix}-vnet"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = var.vnet_address_space
  tags                = var.tags
}

# Public subnet: only the bastion lives here
resource "azurerm_subnet" "public" {
  #checkov:skip=CKV2_AZURE_31:False positive. The bastion NSG is attached to this subnet in modules/security with azurerm_subnet_network_security_group_association. Checkov cannot follow the link across modules.
  name                 = "${var.name_prefix}-public-subnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.public_subnet_cidr]
}

# Private subnet: app VM (and later the monitoring VM). No public IPs here
resource "azurerm_subnet" "private" {
  #checkov:skip=CKV2_AZURE_31:False positive. The private NSG is attached to this subnet in modules/security with azurerm_subnet_network_security_group_association. Checkov cannot follow the link across modules.
  name                 = "${var.name_prefix}-private-subnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.private_subnet_cidr]

  # Lets Cosmos DB accept traffic from this subnet only (VNet rule on the database)
  service_endpoints = ["Microsoft.AzureCosmosDB"]

  # No hidden default internet access. The VMs go out through the Load Balancer outbound rule
  default_outbound_access_enabled = false
}
