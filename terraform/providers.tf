terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Shared state in Azure Storage, so the whole team (and CD) works on the same
  # infrastructure. Create the storage once with bootstrap/create-state-storage.ps1.
  # Backend settings can't use variables, so the names are written here.
  # They are names, not secrets: access needs an Azure login with the
  # "Storage Blob Data Contributor" role. No storage keys are used.
  # Locking is automatic: Terraform takes a lease on the state blob while it runs.
  backend "azurerm" {
    resource_group_name  = "findr-tfstate-rg"
    storage_account_name = "findrtfstateafff2a46"
    container_name       = "tfstate"
    key                  = "findr-dev.tfstate"
    use_azuread_auth     = true
  }
}

# Login comes from "az login" on your own laptop (or OIDC in GitHub Actions).
# The subscription comes from the ARM_SUBSCRIPTION_ID environment variable.
provider "azurerm" {
  features {}
}
