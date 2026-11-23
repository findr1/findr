resource "azurerm_public_ip" "lb" {
  name                = "${var.name_prefix}-lb-pip"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

# Outbound-only public IP for the monitoring VM (never receives website traffic)
resource "azurerm_public_ip" "outbound" {
  name                = "${var.name_prefix}-lb-outbound-pip"
  location            = var.location
  resource_group_name = var.resource_group_name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_lb" "main" {
  name                = "${var.name_prefix}-lb"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "Standard"
  tags                = var.tags

  frontend_ip_configuration {
    name                 = "public"
    public_ip_address_id = azurerm_public_ip.lb.id
  }

  # Second public IP, only for the monitoring VM's outbound traffic.
  # Azure allows only one outbound rule per frontend IP.
  frontend_ip_configuration {
    name                 = "outbound"
    public_ip_address_id = azurerm_public_ip.outbound.id
  }
}

resource "azurerm_lb_backend_address_pool" "app" {
  name            = "app"
  loadbalancer_id = azurerm_lb.main.id
}

# Put the app VM behind the Load Balancer
resource "azurerm_network_interface_backend_address_pool_association" "app" {
  network_interface_id    = var.app_nic_id
  ip_configuration_name   = var.app_ip_configuration_name
  backend_address_pool_id = azurerm_lb_backend_address_pool.app.id
}

# Only send users to the app when it answers
resource "azurerm_lb_probe" "http" {
  name                = "http-health"
  loadbalancer_id     = azurerm_lb.main.id
  protocol            = "Http"
  port                = var.app_port
  request_path        = var.health_probe_path
  interval_in_seconds = 15
}

# Port 80 on the public IP goes to the app
resource "azurerm_lb_rule" "http" {
  name                           = "http"
  loadbalancer_id                = azurerm_lb.main.id
  protocol                       = "Tcp"
  frontend_port                  = 80
  backend_port                   = var.app_port
  frontend_ip_configuration_name = "public"
  backend_address_pool_ids       = [azurerm_lb_backend_address_pool.app.id]
  probe_id                       = azurerm_lb_probe.http.id
  # Outbound traffic uses the outbound rule below instead
  disable_outbound_snat = true
}

# Lets the private VM reach the internet (apt, Docker images, ACR, Cosmos DB)
resource "azurerm_lb_outbound_rule" "internet" {
  name                    = "outbound"
  loadbalancer_id         = azurerm_lb.main.id
  protocol                = "All"
  backend_address_pool_id = azurerm_lb_backend_address_pool.app.id

  frontend_ip_configuration {
    name = "public"
  }
}

# The monitoring VM has no public IP either. It only uses the Load Balancer to
# reach the internet (Docker images, alerts). It gets no website traffic.
resource "azurerm_lb_backend_address_pool" "outbound_only" {
  name            = "outbound-only"
  loadbalancer_id = azurerm_lb.main.id
}

resource "azurerm_network_interface_backend_address_pool_association" "monitoring" {
  network_interface_id    = var.monitoring_nic_id
  ip_configuration_name   = var.monitoring_ip_configuration_name
  backend_address_pool_id = azurerm_lb_backend_address_pool.outbound_only.id
}

resource "azurerm_lb_outbound_rule" "outbound_only" {
  name                    = "outbound-only"
  loadbalancer_id         = azurerm_lb.main.id
  protocol                = "All"
  backend_address_pool_id = azurerm_lb_backend_address_pool.outbound_only.id

  frontend_ip_configuration {
    name = "outbound"
  }
}
