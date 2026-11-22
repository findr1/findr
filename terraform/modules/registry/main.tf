resource "azurerm_container_registry" "main" {
  #checkov:skip=CKV_AZURE_139:Basic SKU can't use private endpoints or network rules (Premium only). Every pull and push still needs an Azure login with a role on the registry, and the admin user is off.
  #checkov:skip=CKV_AZURE_163:Registry vulnerability scanning needs Microsoft Defender for Containers, which costs extra. CI scans every image with Trivy before it can be merged.
  #checkov:skip=CKV_AZURE_164:Signed images (content trust) need the Premium SKU.
  #checkov:skip=CKV_AZURE_165:Geo-replication needs the Premium SKU. One region is enough for this project.
  #checkov:skip=CKV_AZURE_166:Image quarantine needs the Premium SKU. Trivy in CI blocks images with known problems instead.
  #checkov:skip=CKV_AZURE_167:Retention of untagged images needs the Premium SKU.
  #checkov:skip=CKV_AZURE_233:Zone redundancy needs the Premium SKU.
  #checkov:skip=CKV_AZURE_237:Dedicated data endpoints need the Premium SKU.
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Basic"

  # No shared admin password. Access only with Azure roles
  admin_enabled = false

  tags = var.tags
}

# The app VM pulls images with its own Azure identity, no password
resource "azurerm_role_assignment" "pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = var.pull_principal_id
  principal_type       = "ServicePrincipal"
}

# The CD pipeline pushes new images
resource "azurerm_role_assignment" "push" {
  count                = var.push_principal_id == null ? 0 : 1
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPush"
  principal_id         = var.push_principal_id
  principal_type       = "ServicePrincipal"
}
