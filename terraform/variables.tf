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

variable "public_subnet_cidr" {
  description = "Address range of the public subnet (bastion)"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_subnet_cidr" {
  description = "Address range of the private subnet (app VM, monitoring VM, database access)"
  type        = string
  default     = "10.0.2.0/24"
}

variable "allowed_ssh_cidrs" {
  description = "IPs allowed to SSH to the bastion, each with /32 at the end, e.g. [\"41.186.10.20/32\"]"
  type        = list(string)

  validation {
    condition     = length(var.allowed_ssh_cidrs) > 0 && alltrue([for c in var.allowed_ssh_cidrs : can(cidrhost(c, 0))])
    error_message = "allowed_ssh_cidrs must be a list like [\"41.186.10.20/32\"]."
  }
}

variable "app_port" {
  description = "Port the app listens on, on the app VM. The Load Balancer forwards port 80 to it"
  type        = number
  default     = 80
}

variable "health_probe_path" {
  description = "Path the Load Balancer calls to check the app is up"
  type        = string
  default     = "/api/health"
}

variable "bastion_vm_size" {
  description = "Size of the bastion VM"
  type        = string
  default     = "Standard_B2ats_v2"
}

variable "app_vm_size" {
  description = "Size of the app VM"
  type        = string
  default     = "Standard_B2ats_v2"
}

variable "admin_username" {
  description = "Linux user created on every VM, used for SSH"
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

variable "cd_principal_id" {
  description = "Object ID of the GitHub Actions service principal (OIDC). Gets push to ACR, read on the resource group and edit on the bastion firewall. Leave empty to skip"
  type        = string
  default     = null
}

variable "cosmos_free_tier" {
  description = "Use the Cosmos DB free tier (1000 RU/s and 25 GB free). Only one account per subscription can have it"
  type        = bool
  default     = true
}

variable "monitoring_vm_size" {
  description = "Size of the monitoring VM"
  type        = string
  default     = "Standard_B2ats_v2"
}
