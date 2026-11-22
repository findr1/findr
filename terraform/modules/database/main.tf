# Managed MongoDB database (Azure Cosmos DB for MongoDB).
# Azure runs it and backs it up, so the data survives app VM rebuilds.
resource "azurerm_cosmosdb_account" "main" {
  #checkov:skip=CKV_AZURE_101:Public network access must stay on for the VNet service endpoint rule to work. is_virtual_network_filter_enabled refuses every address except the private subnet. A private endpoint would cost extra every month.
  #checkov:skip=CKV_AZURE_100:Data is already encrypted at rest with Microsoft-managed keys. Customer-managed keys need a Key Vault and extra cost, with no real gain for a student project.
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  offer_type          = "Standard"
  kind                = "MongoDB"

  # Free tier: the first 1000 RU/s and 25 GB are free. Only one free account
  # is allowed per subscription.
  free_tier_enabled = var.free_tier_enabled

  mongo_server_version = "4.2"

  capabilities {
    name = "EnableMongo"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }

  # The app's key can read and write data, but can't change the database settings
  access_key_metadata_writes_enabled = false

  # Only the private subnet may connect (VNet service endpoint).
  # Every other address is refused, including the internet and our laptops.
  is_virtual_network_filter_enabled = true

  virtual_network_rule {
    id = var.allowed_subnet_id
  }

  # Backups every 4 hours, kept for 8 hours (the free default)
  backup {
    type                = "Periodic"
    interval_in_minutes = 240
    retention_in_hours  = 8
    storage_redundancy  = "Local"
  }

  tags = var.tags
}

resource "azurerm_cosmosdb_mongo_database" "main" {
  name                = var.database_name
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name

  # Shared by all collections. 400 RU/s fits inside the free 1000 RU/s.
  throughput = 400
}

# The two collections the app uses, created here so their indexes exist
# before any data is added (Cosmos only allows unique indexes on empty collections)
resource "azurerm_cosmosdb_mongo_collection" "items" {
  name                = "items"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_mongo_database.main.name

  index {
    keys   = ["_id"]
    unique = true
  }

  # Our own short item number (/items/3). Also used to sort newest first
  index {
    keys   = ["id"]
    unique = true
  }
}

resource "azurerm_cosmosdb_mongo_collection" "counters" {
  name                = "counters"
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_mongo_database.main.name

  index {
    keys   = ["_id"]
    unique = true
  }
}
