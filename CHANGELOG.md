# Changelog

How Findr (Amani Market Systems) grew from a planned web app to a secured, automatically
deployed system on Azure. Numbers in brackets are pull requests.

## Summative: Git-to-production on Azure (22–23 Nov 2026)

### Infrastructure (Terraform)
- Terraform state stored in Azure Storage with locking, so the team and CD share one copy (#135)
- Network split into public and private subnets, bastion host, app VM moved to the private
  subnet with no public IP, Standard Load Balancer with health probe and outbound rule (#137)
- Private container registry (ACR, admin user off) (#138)
- Managed database: Cosmos DB for MongoDB, reachable only from the private subnet (#139)
- Monitoring VM in the private subnet, with firewall rules for metrics and Grafana (#145)

### Application
- `/api/ready` readiness check that returns 200 only when the database answers (#131)
- Prometheus metrics on a private port (9464), not reachable from the public URL (#134)
- Report listings feature (#140)

### Configuration management (Ansible)
- `deploy.yml` reaches the private app VM by jumping through the bastion, installs Docker,
  Docker Compose, git and curl, logs in to ACR, pulls the image for the commit and runs
  `docker compose up -d`. Secrets come from environment variables. Safe to run twice (#142)
- Monitoring role: node_exporter on the app VM; Prometheus, Grafana, Alertmanager and
  blackbox_exporter on the monitoring VM; architecture diagram (#143)

### CI/CD
- `cd.yml` runs only on merges to main and first re-runs every CI check and the Terraform scan (#133)
- Full deploy: build, tag with the commit SHA, push to ACR, log in to Azure with OIDC,
  run Ansible through the bastion (#144)
- Fixes found while testing the pipeline end to end: read the registry name and address
  together (#146), wait for the bastion to answer SSH before Ansible (#147), strip Windows
  line endings from the SSH key (#148)

### Monitoring
- Prometheus, Grafana dashboard (saved in the repo) and alert rules (#136)
- Alerts sent to the team's Discord channel (#141)

### Documentation
- Screenshot of Findr running after the playbook (#132)

## Formative 3: Infrastructure as Code and DevSecOps (7–10 Nov 2026)

### Infrastructure (Terraform)
- Azure network, security rules, VM and outputs (#68)
- Terraform README with setup, apply and destroy steps (#77)

### Configuration management (Ansible)
- First Ansible configuration, inventory, playbook and requirements (#78)
- Deploy Findr and MongoDB with Docker (#87)
- Azure dynamic inventory (#88)
- Server hardening: firewall, key-only SSH, fail2ban (#86)
- Swap file, dynamic inventory and safer SSH settings (#101)

### Security scanning
- Trivy scans the Docker image on every PR (#89)
- npm audit scans packages on every PR (#93)
- Fixed a finding: moved the shadcn CLI to devDependencies (#91)
- `SECURITY.md` with scan findings and accepted risks (#90, #100)
- Terraform scan and security checks made required on main (#92, #102)

## Formative 2: Containerization and CI (29–30 Oct 2026)

### Application
- Items saved in MongoDB, with an in-memory store for tests (#47)

### Containers
- Backend Dockerfile and `.dockerignore` (#48)
- docker-compose with the backend and MongoDB (#49)
- Root multi-stage Dockerfile that serves the website and API (#50)

### CI
- ESLint for the backend (#51)
- CI workflow: lint, test and Docker build on every branch and PR (#52)
- Docker image pushed from CI (#66)
- CI section in the README and updated branch protection doc (#53, #67)

## Formative 1: Project planning and baseline app (22–23 Oct 2026)

### Project setup
- MIT license, README and hardened `.gitignore` (#1)
- First Node.js CI workflow
- CODEOWNERS for frontend, backend and docs (#4, #34)
- Branch protection rules documented (#37)
- README with setup instructions (#30)

### Frontend
- React and Vite app (#2), items list with search and filter (#3)
- Styling, Tailwind, shadcn components and site header (#5, #6, #10)
- Report item page with React Router (#7)
- Items list and report form connected to the API (#33, #35)
- Item detail page with claim flow (#36)

### Backend
- Express API with tests; claim and mark-as-returned endpoints (#9)
- Report item and get item endpoints (#31)
- Search and filter endpoint (#32)
