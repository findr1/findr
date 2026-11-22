output "vm_id" { value = azurerm_linux_virtual_machine.main.id }
output "nic_id" { value = azurerm_network_interface.main.id }
output "ip_configuration_name" { value = azurerm_network_interface.main.ip_configuration[0].name }
output "private_ip" { value = azurerm_network_interface.main.private_ip_address }
output "public_ip" { value = var.public_ip_enabled ? azurerm_public_ip.main[0].ip_address : null }
output "principal_id" { value = azurerm_linux_virtual_machine.main.identity[0].principal_id }
