variable "name" {
  description = "Cosmos DB account name. Must be unique in all of Azure, lowercase letters, numbers and dashes"
  type        = string
}

variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }

variable "allowed_subnet_id" {
  description = "The only subnet allowed to connect (the private subnet)"
  type        = string
}

variable "database_name" {
  description = "Name of the MongoDB database the app uses"
  type        = string
  default     = "findr"
}

variable "free_tier_enabled" {
  description = "Use the Cosmos DB free tier. Only one account per subscription can have it"
  type        = bool
  default     = true
}
