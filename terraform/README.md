# Terraform

This folder builds the server Findr runs on, in Microsoft Azure. One command builds everything. One command deletes everything.

## What it builds

- **A private network** for our server
- **A firewall:** SSH only from your IP, the website (port 80) open to everyone, everything else blocked
- **A public IP**, the address people use to open Findr
- **An Ubuntu server.** You log in with an SSH key, not a password

The server starts empty. Ansible installs Docker and Findr on it (see [ansible/](../ansible/)).

## Files

```
terraform/
├── providers.tf               # Uses Azure
├── variables.tf               # All the settings
├── main.tf                    # Puts the parts together
├── outputs.tf                 # What Terraform shows when it finishes
├── terraform.tfvars.example   # Example settings
└── modules/
    ├── network/               # The private network
    ├── security/              # The firewall
    └── compute/               # The server and its IP
```

## What you need

- [Terraform](https://developer.hashicorp.com/terraform/install)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- Access to our Azure subscription
- An SSH key. Make one if you don't have it:
```bash
  ssh-keygen -t ed25519 -f ~/.ssh/findr -C "findr"
```
  Never share or commit the private key (the file without `.pub`).

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
   In `terraform.tfvars`, set `my_ip_cidr` to your IP with `/32` at the end, for example `41.186.10.20/32`. Find your IP at https://ifconfig.me.

4. Build the server
```bash
   terraform init      # downloads what Terraform needs
   terraform plan      # shows what will be built, builds nothing
   terraform apply     # builds it, type yes
```

5. See the server details
```bash
   terraform output
```

6. Delete everything when you finish
```bash
   terraform destroy   # type yes
```
   Always do this after testing. The server costs credit every hour, even when nobody uses it. `terraform apply` builds it again whenever you need it.

## Settings

Put these in `terraform.tfvars`. You must set the first two. The rest have defaults.

| Setting | What it is | Default |
|---------|------------|---------|
| `location` | Azure region | none (we use `southafricanorth`) |
| `my_ip_cidr` | Your IP. Only this IP can log in | none |
| `project_name` | Start of every name | `findr` |
| `environment` | `dev` or `prod` | `dev` |
| `vnet_address_space` | Addresses for the network | `10.0.0.0/16` |
| `subnet_cidr` | Addresses for the subnet | `10.0.1.0/24` |
| `app_port` | Website port | `80` |
| `vm_size` | Server size | `Standard_B2ats_v2` |
| `admin_username` | Login name on the server | `azureuser` |
| `ssh_public_key_path` | Your public SSH key | `~/.ssh/findr.pub` |

## What it shows when done

| Output | What it is |
|--------|------------|
| `public_ip` | The server address |
| `ssh_command` | Copy it to log in to the server |
| `resource_group_id`, `vnet_id`, `subnet_id`, `nsg_id`, `vm_id` | IDs of what was built |

## Rules

- **Only one person runs `apply`.** Terraform remembers what it built in a file on that person's laptop. If two people run it, we pay for two servers.
- **Never commit `terraform.tfstate` or `terraform.tfvars`.** Git already ignores them.
- **If your IP changes** (new Wi-Fi), you can't log in. Update `my_ip_cidr` and run `terraform apply` again.
- **No passwords or keys are in the code.** Every pull request also scans this folder for security problems with Checkov.
