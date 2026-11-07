terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

# Login comes from "az login" on your own laptop.
# The subscription comes from the ARM_SUBSCRIPTION_ID environment variable.
# No keys or IDs are written in the code.
provider "azurerm" {
  features {}
}
