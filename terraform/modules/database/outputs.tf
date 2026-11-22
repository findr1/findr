output "id" { value = azurerm_cosmosdb_account.main.id }
output "name" { value = azurerm_cosmosdb_account.main.name }

# Ready to use as MONGODB_URI. Azure's string has no database name, so the
# database is added after the host, otherwise the app would use "test".
output "connection_string" {
  value = replace(
    azurerm_cosmosdb_account.main.primary_mongodb_connection_string,
    "/?",
    "/${azurerm_cosmosdb_mongo_database.main.name}?"
  )
  sensitive = true
}
