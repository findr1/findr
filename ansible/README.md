# Ansible

This folder sets up the servers Terraform creates and deploys Findr to them. The main playbook is **`deploy.yml`**. The CD pipeline runs it on every merge to `main`, and you can run it by hand too. It installs Docker and Docker Compose, locks the server down, logs in to our private registry (ACR), pulls the image for one commit and starts it with `docker compose up -d`. You can run it as many times as you like: a second run changes nothing.

The app VM has no public IP, so Ansible always connects through the bastion.

## What's in this folder

| Path | What it is |
|------|------------|
| `deploy.yml` | **Deploys Findr to the app VM.** The playbook CD runs |
| `monitoring.yml` | Installs node_exporter on the app VM, and Prometheus, Grafana, Alertmanager and blackbox_exporter on the monitoring VM |
| `inventory.ini` | The two private VMs: `app_server` and `monitoring`. Used by default |
| `group_vars/app_server/vars.yml` | How to reach the app VM through the bastion, and the deploy settings. Everything comes from environment variables, so no IP or secret is in the code |
| `group_vars/monitoring/vars.yml` | The same for the monitoring VM |
| `ansible.cfg` | Default inventory, and how SSH checks the server's identity |
| `requirements.yml` | Ansible collections the roles need |
| `roles/` | The steps. See [What deploy.yml does](#what-deployyml-does) |
| `playbook.yml`, `inventory/`, `group_vars/web/`, `roles/findr` | The Formative 3 setup, kept for history. See [Formative 3: single VM](#formative-3-single-vm-no-longer-used) |

## Prerequisites

Ansible doesn't run on Windows. Windows users run everything below in **WSL** (Ubuntu inside Windows).

1. **The infrastructure**, built with Terraform (see [`terraform/README.md`](../terraform/README.md)).
2. **Ansible** and the **Azure CLI**, installed in Ubuntu or WSL:

   ```bash
   sudo apt update && sudo apt install -y pipx git
   pipx install --include-deps ansible
   pipx ensurepath   # then open a new terminal
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   az login
   ```

3. **The team's SSH private key** (`findr-team`), the pair of the public key Terraform put on the VMs. Put it in `~/.ssh/` and make it readable only by you, or SSH refuses to use it:

   ```bash
   cp /mnt/c/Users/<you>/Downloads/findr ~/.ssh/findr
   chmod 600 ~/.ssh/findr
   ```

4. **Your IP in `allowed_ssh_cidrs`** in `terraform.tfvars`, applied, so the bastion lets you in.

5. **The repository inside WSL.** Clone it into your WSL home folder. Don't run it from `/mnt/c/...`: Windows folders are open to every user, so Ansible ignores `ansible.cfg` there.

   ```bash
   cd ~ && git clone https://github.com/findr1/findr.git
   cd findr/ansible
   ansible-galaxy collection install -r requirements.yml
   ```

## Deploy by hand

CD does all of this on its own (see [`.github/workflows/cd.yml`](../.github/workflows/cd.yml)). Do it by hand only to test or to fix a server.

### 1. Set the environment variables

| Variable | What it is | Where to get it |
|----------|------------|-----------------|
| `BASTION_IP` | The bastion's public IP | `terraform output -raw bastion_public_ip` |
| `APP_PRIVATE_IP` | The app VM's private IP | `terraform output -raw app_private_ip` |
| `APP_URL` | The site's address, used for CORS | `terraform output -raw app_url` |
| `ACR_LOGIN_SERVER` | The registry's address | `terraform output -raw acr_login_server` |
| `ACR_TOKEN` | A short-lived registry token. Secret | `az acr login -n <acr_name> --expose-token --query accessToken -o tsv` |
| `IMAGE_TAG` | Which image to deploy: a commit SHA that CD pushed | GitHub Actions, or `az acr repository show-tags -n <acr_name> --repository findr` |
| `MONGODB_URI` | The Cosmos DB connection string. Secret | `terraform output -raw mongodb_uri` |
| `ADMIN_TOKEN` | The password for the admin routes. Secret | The team's `ADMIN_TOKEN` GitHub secret |
| `SSH_KEY_FILE` | Optional. Path to the private key | Defaults to `~/.ssh/findr` |

The playbook stops straight away with a clear message if `ACR_LOGIN_SERVER`, `ACR_TOKEN` or `MONGODB_URI` is missing.

### 2. Check Ansible can reach the app VM

```bash
ansible app_server -m ping
```

`findr-app | SUCCESS` with `"ping": "pong"` means the bastion jump, the user and the key all work.

### 3. Run the playbook

```bash
ansible-playbook deploy.yml
```

It finishes by waiting until `/api/ready` answers on the VM, so a run only succeeds if Findr is really up and talking to the database. Then open `APP_URL` in a browser.

### Check it's safe to run again

Run the same command a second time. The recap at the end should show **`changed=0`** and **`failed=0`**. That shows the playbook is idempotent: it only changes something when the server is different from what the playbook describes.

## What deploy.yml does

It runs on the `app_server` group as root (`become: true`), in this order:

1. **Checks the settings.** Stops early if a required environment variable is missing.
2. **Installs git and curl.**
3. **`swap`** ([`roles/swap`](roles/swap/tasks/main.yml)): adds a 2 GB swap file, so the small VM doesn't run out of memory. Only created if it isn't there yet.
4. **`docker`** ([`roles/docker`](roles/docker/tasks/main.yml)): adds Docker's official apt repository and installs Docker Engine, the **Docker Compose** plugin and `python3-docker`, which Ansible needs to manage containers. Starts Docker and turns it on at boot.
5. **`hardening`** ([`roles/hardening`](roles/hardening/tasks/main.yml)):
   - **Firewall (UFW):** blocks all incoming traffic except SSH (22, rate-limited), HTTP (80) and HTTPS (443).
   - **SSH:** no root login and no password login, so only keys work. The new settings are checked with `sshd -t` before SSH restarts, so a mistake can't lock us out.
   - **fail2ban:** bans an IP for 1 hour after 5 failed logins in 10 minutes.
   - This sits behind the Azure firewalls from Terraform, so the server is protected even if one layer is set up wrong.
6. **`app_deploy`** ([`roles/app_deploy`](roles/app_deploy/tasks/main.yml)), the step that gets Findr serving traffic:
   - Writes the settings to `/opt/findr/.env`, readable only by root. Secrets are hidden from the output (`no_log`).
   - Writes `/opt/findr/docker-compose.yml` from a [template](roles/app_deploy/templates/docker-compose.yml.j2): the image for this commit, port 80 for the Load Balancer, port 9464 for metrics, a health check, restart after a crash or reboot, and log rotation.
   - Logs in to ACR with the short-lived token. No registry password is stored on the server.
   - Pulls the image and starts it with `docker compose up -d`.
   - Waits until `/api/ready` returns `200`.

## Monitoring

`monitoring.yml` installs node_exporter on the app VM (port 9100, open only to the monitoring VM). It then copies [`monitoring/`](../monitoring) to the monitoring VM and starts Prometheus, Grafana, Alertmanager and blackbox_exporter with `docker compose up -d`. It needs `BASTION_IP`, `APP_PRIVATE_IP` and `MONITORING_PRIVATE_IP` (`terraform output -raw monitoring_private_ip`).

```bash
ansible-playbook monitoring.yml
```

Grafana has no public address. Open it through the bastion, keep this running, then browse to http://localhost:3000:

```bash
ssh -i ~/.ssh/findr -N -L 3000:$MONITORING_PRIVATE_IP:3000 azureuser@$BASTION_IP
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Connection timed out` to the bastion | The bastion only allows SSH from `allowed_ssh_cidrs`. If your IP changed, update it in `terraform.tfvars` and apply again |
| `UNREACHABLE` / `Permission denied (publickey)` | Check `BASTION_IP` and `APP_PRIVATE_IP`, check the key is `findr-team`, and run `chmod 600` on it |
| `Host key verification failed` / `REMOTE HOST IDENTIFICATION HAS CHANGED` | The VM was created again and has a new key. Run `ssh-keygen -R <IP>` and try again |
| `Set ACR_LOGIN_SERVER, ACR_TOKEN and MONGODB_URI first` | One of them is empty. ACR tokens last about 3 hours, so get a new one |
| `[WARNING]: Ansible is being run in a world writable directory` | You're in `/mnt/c/...`. Clone the repo into your WSL home folder, or run `export ANSIBLE_CONFIG=$PWD/ansible.cfg` |
| `couldn't resolve module/action 'community.docker...'` | Run `ansible-galaxy collection install -r requirements.yml` |
| The `/api/ready` wait times out | SSH to the app VM and run `docker compose -f /opt/findr/docker-compose.yml logs`. Check `IMAGE_TAG` exists in ACR and `MONGODB_URI` is right |

## Formative 3: single VM (no longer used)

In Formative 3, Findr ran on one VM with a public IP, with MongoDB in a container next to the app and the image in GitHub Container Registry. That setup is kept for history, and nothing in CD uses it:

- `playbook.yml` ran `swap`, `docker`, `hardening` and `findr` on the `web` group.
- `inventory/hosts.ini` (static IP) and `inventory/azure_rm.yml` (dynamic inventory: Azure VMs tagged `project=findr`) found the server.
- `group_vars/web/vault.yml` held the MongoDB password and the GHCR login, encrypted with Ansible Vault.
- `roles/findr` started MongoDB 7 and the app on a private Docker network.

The Summative replaced it: the app VM moved to a private subnet behind a bastion and a Load Balancer, MongoDB moved to Cosmos DB, the image moved to ACR, and secrets moved from the vault to GitHub secrets passed in by CD.

We ran that playbook on the F3 Azure VM. Findr opened at the server's public IP on port 80:

![Findr running at the server's public IP after the Formative 3 playbook ran](../docs/images/ansible-app-on-server.png)
