variable "location" {
  description = "Azure region where everything is created, e.g. southafricanorth"
  type        = string
}

variable "project_name" {
  description = "Short name used at the start of every resource name"
  type        = string
  default     = "findr"
}

variable "environment" {
  description = "Environment name, e.g. dev or prod"
  type        = string
  default     = "dev"
}

variable "vnet_address_space" {
  description = "Address range of the private network (VNet)"
  type        = list(string)
  default     = ["10.0.0.0/16"]
}

variable "subnet_cidr" {
  description = "Address range of the subnet inside the VNet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "my_ip_cidr" {
  description = "Your public IP with /32 at the end. Only this IP can use SSH"
  type        = string

  validation {
    condition     = can(cidrhost(var.my_ip_cidr, 0))
    error_message = "my_ip_cidr must look like 41.186.10.20/32."
  }
}

variable "app_port" {
  description = "Port open to everyone so users can reach Findr"
  type        = number
  default     = 80
}

variable "vm_size" {
  description = "Size of the virtual machine"
  type        = string
  default     = "Standard_B2ats_v2"
}

variable "admin_username" {
  description = "Linux user created on the VM, used for SSH"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key_path" {
  description = "Path to the group's SSH public key"
  type        = string
  default     = "~/.ssh/findr.pub"
}

variable "image_publisher" {
  description = "Publisher of the VM image"
  type        = string
  default     = "Canonical"
}

variable "image_offer" {
  description = "VM image offer (Ubuntu 24.04 LTS)"
  type        = string
  default     = "ubuntu-24_04-lts"
}

variable "image_sku" {
  description = "VM image SKU"
  type        = string
  default     = "server"
}