output "public_ip" {
  description = "Public IP of the server"
  value       = module.compute.public_ip
}

output "ssh_command" {
  description = "Copy and run this to connect to the server"
  value       = "ssh -i ${trimsuffix(var.ssh_public_key_path, ".pub")} ${var.admin_username}@${module.compute.public_ip}"
}

output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "resource_group_id" {
  value = azurerm_resource_group.main.id
}

output "vnet_id" {
  value = module.network.vnet_id
}

output "subnet_id" {
  value = module.network.subnet_id
}

output "nsg_id" {
  value = module.security.nsg_id
}

output "vm_id" {
  value = module.compute.vm_id
}
