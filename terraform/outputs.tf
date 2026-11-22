output "app_url" {
  description = "Open Findr here"
  value       = module.loadbalancer.url
}

output "lb_public_ip" {
  description = "Public IP of the Load Balancer"
  value       = module.loadbalancer.public_ip
}

output "bastion_public_ip" {
  description = "Public IP of the bastion, the only SSH entry point"
  value       = module.bastion.public_ip
}

output "app_private_ip" {
  description = "Private IP of the app VM (reach it through the bastion)"
  value       = module.app.private_ip
}

output "acr_login_server" {
  description = "Address of the private container registry"
  value       = module.registry.login_server
}

output "acr_name" {
  value = module.registry.name
}

output "ssh_bastion_command" {
  description = "Copy and run this to log in to the bastion"
  value       = "ssh -i ${trimsuffix(var.ssh_public_key_path, ".pub")} ${var.admin_username}@${module.bastion.public_ip}"
}

output "ssh_app_command" {
  description = "Copy and run this to log in to the app VM through the bastion"
  value       = "ssh -i ${trimsuffix(var.ssh_public_key_path, ".pub")} -o ProxyCommand=\"ssh -i ${trimsuffix(var.ssh_public_key_path, ".pub")} -W %h:%p ${var.admin_username}@${module.bastion.public_ip}\" ${var.admin_username}@${module.app.private_ip}"
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

output "public_subnet_id" {
  value = module.network.public_subnet_id
}

output "private_subnet_id" {
  description = "Use this in the Cosmos DB network rule so only the private subnet can reach the database"
  value       = module.network.private_subnet_id
}

output "bastion_nsg_name" {
  description = "Firewall CD edits to let the GitHub runner in during a deploy"
  value       = module.security.bastion_nsg_name
}

output "bastion_vm_id" {
  value = module.bastion.vm_id
}

output "app_vm_id" {
  value = module.app.vm_id
}

output "cosmos_account_name" {
  description = "Name of the Cosmos DB account"
  value       = module.database.name
}

# Secret. Show it with: terraform output -raw mongodb_uri
# Save it as the GitHub secret MONGODB_URI. Never put it in git.
output "mongodb_uri" {
  description = "Connection string for the app (MONGODB_URI). Secret"
  value       = module.database.connection_string
  sensitive   = true
}
