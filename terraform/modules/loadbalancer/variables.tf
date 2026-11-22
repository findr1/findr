variable "name_prefix" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "app_nic_id" { type = string }
variable "app_ip_configuration_name" { type = string }
variable "app_port" { type = number }
variable "health_probe_path" { type = string }
variable "tags" { type = map(string) }
