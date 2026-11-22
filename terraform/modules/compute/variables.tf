variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "subnet_id" { type = string }
variable "vm_size" { type = string }
variable "admin_username" { type = string }
variable "ssh_public_key" { type = string }
variable "image_publisher" { type = string }
variable "image_offer" { type = string }
variable "image_sku" { type = string }
variable "tags" { type = map(string) }

variable "public_ip_enabled" {
  description = "Give this VM a public IP. Only the bastion should"
  type        = bool
  default     = false
}
