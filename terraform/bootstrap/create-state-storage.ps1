# Creates the Azure Storage account that keeps the shared Terraform state.
# Run it ONCE for the whole team, from the terraform/ folder, after "az login":
#   powershell -ExecutionPolicy Bypass -File .\bootstrap\create-state-storage.ps1
# It is safe to run again: everything that already exists is left as it is.

param(
  [string]$Location      = "southafricanorth",
  [string]$ResourceGroup = "findr-tfstate-rg",
  [string]$Container     = "tfstate"
)

function Invoke-Az {
  az @args
  if ($LASTEXITCODE -ne 0) { throw "This command failed: az $args" }
}

$subscriptionId = (Invoke-Az account show --query id -o tsv).Trim()
# Storage names must be unique in all of Azure: add the start of the subscription ID
$account = "findrtfstate" + $subscriptionId.Replace("-", "").Substring(0, 8)

Write-Host "1/5 Resource group $ResourceGroup"
Invoke-Az group create --name $ResourceGroup --location $Location --tags project=findr purpose=terraform-state --output none

Write-Host "2/5 Storage account $account (private, HTTPS only, no access keys)"
Invoke-Az storage account create --name $account --resource-group $ResourceGroup --location $Location --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --https-only true --allow-blob-public-access false --allow-shared-key-access false --output none

Write-Host "3/5 Keep old versions of the state for 7 days (undo a bad apply)"
Invoke-Az storage account blob-service-properties update --account-name $account --resource-group $ResourceGroup --enable-versioning true --enable-delete-retention true --delete-retention-days 7 --output none

Write-Host "4/5 Give you access to the state"
$scope = (Invoke-Az storage account show --name $account --resource-group $ResourceGroup --query id -o tsv).Trim()
$me = (Invoke-Az ad signed-in-user show --query id -o tsv).Trim()
Invoke-Az role assignment create --assignee-object-id $me --assignee-principal-type User --role "Storage Blob Data Contributor" --scope $scope --output none

Write-Host "5/5 Container $Container (waiting for the new access to work, up to 3 minutes)"
for ($i = 1; $i -le 9; $i++) {
  az storage container create --name $Container --account-name $account --auth-mode login --output none 2>$null
  if ($LASTEXITCODE -eq 0) { break }
  if ($i -eq 9) { throw "Could not create the container. Wait a few minutes and run the script again." }
  Start-Sleep -Seconds 20
}

Write-Host ""
Write-Host "Done. Storage account: $account"
Write-Host "It must match storage_account_name in providers.tf."
Write-Host "Give teammates access with the commands in terraform/README.md (Shared state)."
