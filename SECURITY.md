# Security

This page lists the security scans that run on Findr, what each one found, and what we did about it. Every finding is either **fixed** or **accepted** with a written reason.

## The scans

Every scan runs on every pull request into `main`. A failing scan blocks the merge, because each one is a required check in the "Protect main" ruleset.

| Scan | Tool | What it checks | Fails the PR on | Workflow | Owner |
|------|------|----------------|-----------------|----------|-------|
| Dependency scan | `npm audit` | Known problems in the npm packages of the backend and frontend | High or critical | [`ci.yml`](.github/workflows/ci.yml) | Bonae |
| Image scan | Trivy | Known problems in the Docker image: Alpine packages and every npm package inside it | High or critical, when a fixed version exists | [`ci.yml`](.github/workflows/ci.yml) | Shina |
| Terraform scan | Checkov | Risky settings in our Azure infrastructure code | Any failed check | [`terraform-scan.yml`](.github/workflows/terraform-scan.yml) | Gloire |

### Why these thresholds

- **High and critical fail the build.** These are the problems that can realistically be exploited. Low and moderate findings are still written up below, but they don't block work.
- **Trivy ignores problems with no fix yet.** If no fixed version exists, there's nothing we can upgrade to. The full report still lists them, and they fail the build as soon as a fix is released.
- **Checkov fails on any finding.** Our infrastructure is small, so every check can be passed or explained. A skipped check needs a reason written next to it in the code.

## Findings

Scanned on 2026-11-09.

### Dependency scan (npm audit)

Result: **0 high or critical. The packages that run in production have no known problems.**

| Where | Package | Severity | Problem | Status |
|-------|---------|----------|---------|--------|
| backend, frontend | `minimatch` (used by `eslint`) | Moderate | Denial of service from a crafted pattern | Accepted, see A1 |
| backend | `deepmerge` (used by `jest`) | Low | Prototype pollution | Accepted, see A1 |
| frontend | `deepmerge` (used by the `shadcn` CLI) | Low | Prototype pollution | Accepted, see A1 |

`npm audit` counts every package that depends on a flagged one, so it reports 10 problems in the backend and 9 in the frontend. They all come from the three advisories above.

### Image scan (Trivy)

Result: **10 high found. All 10 fixed. 1 moderate accepted.**

| Package | Problem IDs | Severity | Where it came from | Status |
|---------|-------------|----------|--------------------|--------|
| `brace-expansion` | CVE-2026-102276, CVE-2026-102278, CVE-2026-13149, CVE-2026-14257, CVE-2026-69152 | High | npm, bundled with the `node:22` base image | **Fixed**, see F1 |
| `ip-address` | CVE-2026-69192 | High | same | **Fixed**, see F1 |
| `pacote` (two copies inside npm) | CVE-2026-9496 | High | same | **Fixed**, see F1 |
| `picomatch` | CVE-2026-33671 | High | same | **Fixed**, see F1 |
| `sigstore` | CVE-2026-48815 | High | same | **Fixed**, see F1 |
| `zlib` | CVE-2026-4738 | Moderate | Alpine 3.24 base image | Accepted, see A2 |

Our own app packages (Express, the MongoDB driver and the rest) had **no** findings.

### Terraform scan (Checkov)

Result: **12 passed, 0 failed, 3 skipped with a reason.**

| Check | What it wants | Status |
|-------|---------------|--------|
| CKV_AZURE_160 | No port open to the whole internet | Accepted, see A3 |
| CKV_AZURE_119 | No public IP on the VM | Accepted, see A4 |
| CKV2_AZURE_31 | The subnet has a network security group | False positive, see A5 |

## Fixes

**F1. npm removed from the Docker image.** The app starts with `node src/index.js` and never needs npm at runtime. The [`Dockerfile`](Dockerfile) now deletes npm, npx and corepack from the final image. That removed all 10 high findings and made the image smaller. We checked the container still starts and answers `/api/health`.

## Accepted risks

**A1. npm audit findings in dev tools.** Every flagged package belongs to a developer tool: ESLint, Jest or the shadcn CLI. These tools only run on our laptops and in CI.
- The Docker image installs backend packages with `npm ci --omit=dev`, and the website is built into static files. None of these tools reaches the server.
- The moderate one is a denial of service from a crafted pattern, and we only feed these tools our own code.
- The only fix npm offers is a major version change that breaks our setup, for example `jest@25`.
- We'll take the update when the tools release a fixed version.
- `shadcn` is a command-line tool that is never bundled into the website. We moved it from `dependencies` to `devDependencies` (#91), so the package list now shows that too.

**A2. zlib (moderate) in the Alpine base image.** The fix is in `zlib 1.4-r0`, which isn't in our pinned `node:22.23-alpine3.24` image yet. We pin the base image so every build is the same, so we don't patch single packages by hand. We'll pick up the fix when we bump the base image. It's below our high threshold, so it doesn't block merges.

**A3. Port 80 open to the internet (CKV_AZURE_160).** Findr is a website, so people must be able to reach it. Only port 80 is public. SSH (22) only accepts our own IP address, and every other port is denied.

**A4. Public IP on the VM (CKV_AZURE_119).** Users need the public IP to reach the app, and Ansible needs it to connect over SSH. A load balancer or bastion host would cost more than our student credit allows. The firewall rules in A3 limit what the IP exposes.

**A5. Subnet without a security group (CKV2_AZURE_31).** This is a false positive. The security group is attached to the subnet in `terraform/modules/security`, and Checkov can't follow that link across modules.

## Other protections

- **No secrets in git.** `.gitignore` blocks `.env` files, Terraform state and `.tfvars`, private keys (`*.pem`, `*.key`, `id_*`) and the Ansible Vault password file (`.vault_pass`). The database password and GHCR token are encrypted with Ansible Vault.
- **CI uses short-lived credentials.** The pipeline pushes images with the `GITHUB_TOKEN` that GitHub creates for each run. The workflows only ask for the permissions they need.
- **The Trivy action is pinned to a commit.** In March 2026, attackers took over version tags of `aquasecurity/trivy-action` to steal CI secrets ([advisory](https://github.com/aquasecurity/trivy/security/advisories/GHSA-69fq-xp46-6x23)). We use v0.35.0, the one release that wasn't affected, pinned to its commit so the code can't change under us.
- **The container doesn't run as root.** The app runs as the `node` user, and only scanned images are pushed to GHCR.
- **The server is hardened** by the Ansible `hardening` role:
  - the UFW firewall allows only SSH, HTTP and HTTPS
  - root login and password login over SSH are turned off
  - fail2ban bans an IP for an hour after 5 failed logins in 10 minutes
  - MongoDB is not reachable from the internet

## When a scan fails

1. Open the failed job from the PR's **Checks** tab. For Trivy, download the `trivy-report` artifact.
2. **Fix it if you can**: upgrade the package, update the base image, or change the Terraform setting.
3. **If it can't be fixed or is safe**, accept it with a reason:
   - **Trivy:** add the problem ID to `.trivyignore`.
   - **Checkov:** add `#checkov:skip=<ID>:<reason>` to the resource.
   - **npm audit:** explain it in the PR.
4. Add the finding to this page in the same PR, either as a fix or an accepted risk.

## Reporting a security problem

Please don't open a public issue. Message one of the team (Gloire, Bonae, Norette or Shina) directly, and we'll reply within a few days.
