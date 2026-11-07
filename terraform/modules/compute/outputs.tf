output "public_ip" { value = azurerm_public_ip.main.ip_address }
output "public_ip_id" { value = azurerm_public_ip.main.id }
output "nic_id" { value = azurerm_network_interface.main.id }
output "vm_id" { value = azurerm_linux_virtual_machine.main.id }
