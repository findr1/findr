output "bastion_nsg_id" { value = azurerm_network_security_group.bastion.id }
output "bastion_nsg_name" { value = azurerm_network_security_group.bastion.name }
output "private_nsg_id" { value = azurerm_network_security_group.private.id }
output "private_nsg_name" { value = azurerm_network_security_group.private.name }
