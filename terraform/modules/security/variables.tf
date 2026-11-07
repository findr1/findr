variable "name_prefix" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "subnet_id" { type = string }
variable "my_ip_cidr" { type = string }
variable "app_port" { type = number }
variable "tags" { type = map(string) }
