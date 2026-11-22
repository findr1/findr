variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }

variable "pull_principal_id" {
  description = "Identity allowed to pull images (the app VM)"
  type        = string
}

variable "push_principal_id" {
  description = "Identity allowed to push images (the CD pipeline). null to skip"
  type        = string
  default     = null
}
