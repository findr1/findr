# Terraform

This folder builds everything Findr runs on, in Microsoft Azure. One command builds everything. One command deletes everything.

## What it builds

```
                 Internet
                    |
        +-----------+------------------+
        | port 80                      | SSH (22), only from allowed IPs
        v                              v
  Load Balancer (public IP)       Bastion VM (public IP)
        |                              |
        |  public subnet 10.0.1.0/24   |
  ------+------------------------------+------------------
        |  private subnet 10.0.2.0/24  | SSH only from the bastion
        v                              v
                  App VM (no public IP)
                    |              |
                    | pull images  | MongoDB API
                    v              v
          Container registry    Cosmos DB (only from the private subnet)
```

- **A private network** with two subnets
  - **Public subnet:** only the bastion
  - **Private subnet:** the app VM. Nothing here has a public IP
- **A bastion VM**, the only server you can SSH to. You reach the app VM through it
- **The app VM**, where Ansible installs Docker and runs Findr
- **A monitoring VM** (private subnet, no public IP) for Prometheus, Grafana and Alertmanager. Only it can read the app VM's metrics. Grafana opens through the bastion
- **A Load Balancer**, the one public address for Findr. It sends port 80 to the app VM when its health check (`/api/health`) answers, and lets the private VM reach the internet
- **Firewalls (NSGs)**
  - Bastion: SSH only from the IPs in `allowed_ssh_cidrs`
  - App: website traffic through the Load Balancer, SSH only from the bastion subnet
  - Metrics: only the monitoring VM can reach the app VM on 9100 (node_exporter) and 9464 (app /metrics)
  - Grafana (3000): only from the bastion subnet
  - Everything else is blocked
- **A private container registry (ACR)**. The app VM pulls with its own Azure identity. The CD pipeline pushes. No admin password
- **Roles for the CD pipeline:** push to the registry, read the resource group, edit the bastion firewall during a deploy

The servers start empty. Ansible installs Docker and Findr on them (see [ansible/](../ansible/)). The database (Cosmos DB) only accepts the private subnet, through its service endpoint.

## Files

```
terraform/
|-- providers.tf               # Uses Azure, keeps the state in Azure Storage
|-- variables.tf               # All the settings
|-- main.tf                    # Puts the parts together
|-- outputs.tf                 # What Terraform shows when it finishes
|-- terraform.tfvars.example   # Example settings
|-- bootstrap/
|   `-- create-state-storage.ps1   # Creates the shared state storage, once
`-- modules/
    |-- network/               # VNet, public and private subnets
    |-- security/              # Firewalls for both subnets
    |-- compute/               # One VM (used for the bastion and the app)
    |-- loadbalancer/          # Public Load Balancer, health probe, outbound rule
    `-- registry/              # Private container registry and its roles
```

## What you need

- [Terraform](https://developer.hashicorp.com/terraform/install)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- Access to our Azure subscription. To run `apply` you need **Owner**, or **Contributor** plus **Role Based Access Control Administrator**, because Terraform gives roles to the VM and the CD pipeline
- Access to the shared state (see below)
- An SSH key. Make one if you don't have it:
```bash
  ssh-keygen -t ed25519 -f ~/.ssh/findr -C "findr"
```
  Never share or commit the private key (the file without `.pub`).



## Shared state

Terraform remembers what it built in a **state** file. We keep it in Azure Storage, not on a laptop, so everyone (and the CD pipeline) works on the same infrastructure.

- **Where:** storage account `findrtfstateafff2a46`, container `tfstate`, file `findr-dev.tfstate` (set in `providers.tf`)
- **No keys:** the storage account has access keys turned off. You get in with your own `az login` and the **Storage Blob Data Contributor** role
- **Locking:** while someone runs `plan` or `apply`, Terraform locks the state ("Acquiring state lock"). Anyone else gets `state blob is already locked` and must wait. Two people can't change the infrastructure at the same time
- **Undo:** old versions of the state are kept for 7 days

### Set it up (once for the whole team, already done)

From the `terraform/` folder, after `az login`:

```powershell
powershell -ExecutionPolicy Bypass -File .\bootstrap\create-state-storage.ps1
```

### Give a teammate access

The subscription owner runs this (PowerShell):

```powershell
$scope = az storage account show --name findrtfstateafff2a46 --resource-group findr-tfstate-rg --query id -o tsv

# A teammate (use their email)
$id = az ad user list --filter "mail eq 'TEAMMATE@alustudent.com'" --query "[0].id" -o tsv
az role assignment create --assignee-object-id $id --assignee-principal-type User --role "Storage Blob Data Contributor" --scope $scope

# The CD pipeline (its service principal object ID)
az role assignment create --assignee-object-id 3973b07a-5d4c-4a25-bd96-113e8f3a4df0 --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $scope
```

## How to use it

Run these inside the `terraform/` folder.

1. Log in to Azure (a browser opens)
```bash
   az login
```

2. Choose the subscription
```bash
   export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)      # Git Bash
   $env:ARM_SUBSCRIPTION_ID = (az account show --query id -o tsv)       # PowerShell
```

3. Make your settings file
```bash
   cp terraform.tfvars.example terraform.tfvars
```
   In `terraform.tfvars`, put your IP in `allowed_ssh_cidrs` with `/32` at the end, for example `["41.186.10.20/32"]`. Find your IP at https://ifconfig.me. Several people can be listed.

4. Build everything
```bash
   terraform init      # downloads what Terraform needs and connects to the shared state
   terraform plan      # shows what will be built, builds nothing
   terraform apply     # builds it, type yes
```

5. See the details
```bash
   terraform output
```

6. Delete everything when you finish
```bash
   terraform destroy   # type yes
```
   The VMs and the Load Balancer cost credit every hour, even when nobody uses them. `terraform apply` builds everything again whenever you need it. The state storage is not deleted by `destroy`, so the team keeps its shared state.

## Log in to the servers

All SSH goes through the bastion.

```bash
terraform output -raw ssh_bastion_command   # log in to the bastion
terraform output -raw ssh_app_command       # log in to the app VM, through the bastion
terraform output -raw grafana_tunnel_command  # run it, keep it open, then open http://localhost:3000
```

## Settings

Put these in `terraform.tfvars`. You must set the first two. The rest have defaults.

| Setting | What it is | Default |
|---------|------------|---------|
| `location` | Azure region | none (we use `southafricanorth`) |
| `allowed_ssh_cidrs` | IPs allowed to SSH to the bastion | none |
| `project_name` | Start of every name | `findr` |
| `environment` | `dev` or `prod` | `dev` |
| `vnet_address_space` | Addresses for the network | `10.0.0.0/16` |
| `public_subnet_cidr` | Addresses for the public subnet (bastion) | `10.0.1.0/24` |
| `private_subnet_cidr` | Addresses for the private subnet (app) | `10.0.2.0/24` |
| `app_port` | Port the app listens on, on the app VM | `80` |
| `health_probe_path` | Page the Load Balancer checks | `/api/health` |
| `bastion_vm_size` | Bastion size | `Standard_B2ats_v2` |
| `app_vm_size` | App VM size | `Standard_B2ats_v2` |
| `monitoring_vm_size` | Monitoring VM size | `Standard_B2ats_v2` |
| `admin_username` | Login name on the servers | `azureuser` |
| `ssh_public_key_path` | Your public SSH key | `~/.ssh/findr.pub` |
| `image_publisher`, `image_offer`, `image_sku` | Server image | Ubuntu 24.04 LTS |
| `cd_principal_id` | Object ID of the GitHub Actions service principal. Leave it out to skip the CD roles | none |

## What it shows when done

| Output | What it is |
|--------|------------|
| `app_url` | Open Findr here |
| `lb_public_ip` | Public IP of the Load Balancer |
| `bastion_public_ip` | Public IP of the bastion |
| `app_private_ip` | Private IP of the app VM |
| `monitoring_private_ip` | Private IP of the monitoring VM |
| `grafana_tunnel_command` | Opens Grafana through the bastion |
| `acr_login_server`, `acr_name` | The private container registry |
| `ssh_bastion_command`, `ssh_app_command` | Copy them to log in |
| `private_subnet_id` | For the Cosmos DB network rule |
| `bastion_nsg_name` | The firewall CD opens for the runner during a deploy |
| `resource_group_id`, `vnet_id`, `public_subnet_id`, `bastion_vm_id`, `app_vm_id` | IDs of what was built |

## Rules

- **Never commit `terraform.tfstate` or `terraform.tfvars`.** Git already ignores them. The state lives in Azure Storage
- **If your IP changes** (new Wi-Fi), you can't log in to the bastion. Update `allowed_ssh_cidrs` and run `terraform apply` again
- **Don't add firewall rules by hand,** except the CD pipeline's temporary runner rule (priorities 110-199 on the bastion firewall). Terraform keeps the rules it knows about and leaves the CD rule alone
- **No passwords or keys are in the code.** Every pull request also scans this folder with Checkov. Accepted findings have a `#checkov:skip` comment with the reason
