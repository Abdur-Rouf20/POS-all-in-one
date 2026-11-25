# POS Client Deployment Kit — Ubuntu 24.04 / Windows Server Hyper-V

This kit targets the repository's current `compose.yaml` architecture: React frontend (Nginx), Express API, MongoDB, optional WAHA, Prometheus and Grafana. It is designed to be copied into the repository root. It does **not** modify application source code.

## Support model

- Ubuntu Server 24.04 LTS: supported deployment host for the Linux Docker Compose stack.
- Windows Server: supported as a Hyper-V host running an Ubuntu Server 24.04 VM. The application containers remain Linux containers inside Ubuntu. This is **not** a native Windows Server deployment.
- Cloud VPS or shop server: both work if the host has a supported Ubuntu installation, reliable power/network, firewall controls and off-server backups.
- Initial access uses `http://SERVER_IP:8080`; a domain and HTTPS reverse proxy are a separate later configuration.

## Important compatibility facts from the repository

- Root `compose.yaml` defines `frontend`, `backend`, `mongo`, `waha`, `prometheus`, and `grafana` services.
- Frontend is Nginx on container port 80 and proxies `/api/` to `backend:5000`.
- The base Compose file publishes backend `5000` and MongoDB `27017`; the production overlay removes those public host ports.
- Production overlay publishes only frontend port 8080 by default, and binds Prometheus/Grafana/WAHA only to loopback as in the base file.
- MongoDB authentication in the overlay is initialized only when the MongoDB data volume is first created. Do not apply it blindly to an existing unauthenticated production volume.
- The app's `connectDB()` connects to the URI; the initial owner is seeded only when no owner exists. Keep existing credentials safe.
- MongoDB is a standalone container in the current compose file. This kit does not enable replica-set transactions. The repository README documents that multi-document business operations are not transaction-protected; do not treat this MVP as certified for high-value production accounting.

## 1. Put the kit into the repository

Extract this ZIP into the repository root so the paths look like:

```text
POS-all-in-one/
  compose.yaml
  frontend/
  backend/
  monitoring/
  tests/
  deployment/
  README_DEPLOYMENT.md
```

Do not extract it into a nested `deployment/deployment` folder. The scripts expect `compose.yaml` in the parent repository root.

## 2. Ubuntu Server 24.04 — one-time host preparation

Log in to Ubuntu with an administrator account. Run:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git openssl ufw
```

Install Docker Engine and the Compose plugin using Docker's official Ubuntu repository instructions: https://docs.docker.com/engine/install/ubuntu/ . Do not use Docker Desktop on a server. After installation:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

The production overlay uses the Compose `!reset` tag; Compose **2.24.4 or newer** is required. The deploy script checks this before running.

Clone the repository (or copy the tested project folder) and enter its root:

```bash
git clone https://github.com/Abdur-Rouf20/POS-all-in-one.git
cd POS-all-in-one
```

If deploying a tested release/branch, check out that exact branch or commit before proceeding. Do not assume `main` is the same as your development branch.

## 3. Configure secrets and server address

From the repository root:

```bash
cp deployment/.env.production.example .env
nano .env
```

Set at minimum:

- `CLIENT_ORIGIN=http://YOUR_SERVER_IP:8080`
- `JWT_SECRET`: a long random secret (generate with `openssl rand -hex 32`)
- `OWNER_EMAIL` and `OWNER_PASSWORD`: first owner account credentials
- `MONGO_ROOT_USERNAME` and `MONGO_ROOT_PASSWORD`: unique database administrator credentials
- `GRAFANA_ADMIN_PASSWORD` and `WAHA_DASHBOARD_PASSWORD`: strong unique passwords
- `WAHA_API_KEY`: long random API key

Replace every `REPLACE_WITH...` and `YOUR_SERVER_IP` value. Do not use the example credentials. Keep `.env` private; never commit it, send it in screenshots, or put it in a client handover document. Store secrets in a password manager.

The app's first owner is created only when no owner account exists. Existing user accounts are not reset by changing `OWNER_PASSWORD` in `.env`.

## 4. Deploy

Ensure the production overlay is in `deployment/compose.production.yaml`. From the repository root:

```bash
chmod +x deployment/ubuntu/*.sh
deployment/ubuntu/deploy.sh
```

What it does:

1. Checks Docker and Compose availability/version.
2. Checks that root `.env` exists and has no example placeholders.
3. Validates the merged Compose configuration.
4. Builds frontend/backend images and starts the stack.
5. Waits for `http://127.0.0.1:8080/api/health` and prints container status.

Open `http://YOUR_SERVER_IP:8080` from a device on the same network. The API health check is `http://YOUR_SERVER_IP:8080/api/health`.

If this is a cloud server, configure the provider firewall/security group to allow inbound TCP 8080 only from intended client IP ranges until HTTPS/domain access is configured. On Ubuntu UFW, allow SSH before enabling the firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8080/tcp
sudo ufw enable
sudo ufw status
```

Do not open ports 27017, 5000, 3001, 3002 or 9090 to the public internet. Grafana/Prometheus/WAHA are loopback-bound by the base compose file; access them through an SSH tunnel when needed, for example:

```bash
ssh -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 -L 3002:127.0.0.1:3002 USER@SERVER_IP
```

Then browse `http://127.0.0.1:3001` (Grafana), `http://127.0.0.1:9090` (Prometheus), or `http://127.0.0.1:3002` (WAHA dashboard). Do not expose these management interfaces publicly without a separately reviewed secure access layer.

## 5. Daily operations

Run from repository root:

```bash
deployment/ubuntu/verify.sh       # show containers and check app health
deployment/ubuntu/logs.sh         # follow logs from all services
deployment/ubuntu/stop.sh         # stop containers; named volumes remain
deployment/ubuntu/start.sh        # start existing containers and verify
```

Never use `docker compose down -v` on a client server unless you intentionally want to delete persistent volumes and have a verified backup.

## 6. MongoDB backup and restore

Create a compressed logical backup:

```bash
deployment/ubuntu/backup.sh
```

It writes a timestamped archive under `backups/` and restricts its file permissions. Copy backups to a separate encrypted/off-server destination. A backup stored only on the same server is not disaster recovery.

Restore (destructive to the current `pos_mvp` database):

```bash
deployment/ubuntu/restore.sh backups/mongo-YYYYMMDDTHHMMSSZ.archive.gz
```

The script requires typing `RESTORE`. Stop POS usage before restoring. After restore, run `deployment/ubuntu/verify.sh` and manually validate a known customer, product, invoice, stock balance and money receipt before returning to service. Test backup restoration on a staging copy before relying on it.

## 7. Existing MongoDB data warning

The production overlay initializes MongoDB root authentication only when `mongo_data` is an empty volume. If you already have data in the current unauthenticated `mongo_data` volume, **do not simply start with this overlay**: the database will not retroactively create the root user, and the backend URI will fail authentication.

For an existing installation, schedule downtime, take and verify a backup, then perform a planned MongoDB authentication migration or migrate the data into a new authenticated volume. That migration is not automated by this kit because it depends on the live database state and must not risk customer data.

## 8. Optional WAHA notifications

WAHA is an optional service in the existing Compose file, enabled with the `notifications` profile. The production overlay does not automatically enable it or enable the POS notification worker. First deploy and verify the POS without notifications. Then review the WAHA version, session setup, API key, customer consent, local legal requirements and WhatsApp terms. WAHA uses WhatsApp Web automation; it is not the official WhatsApp Business Platform. A successful API acceptance is not proof that a message was delivered. Keep `NOTIFICATIONS_WORKER_ENABLED=false` until the queue, opt-in state, fallback behavior and delivery monitoring are tested with a test customer.

To start the optional WAHA profile after deliberate configuration:

```bash
docker compose -f compose.yaml -f deployment/compose.production.yaml --profile notifications up -d waha
```

The base compose binds its dashboard to `127.0.0.1:3002`, so use the SSH tunnel above. Do not enable automatic customer messages without explicit opt-in and a tested operational process.

## 9. Prometheus and Grafana

The current repository includes Prometheus scrape configuration for `backend:5000/metrics` and Grafana provisioning/dashboard mounts in `compose.yaml`. The services start with the default Compose stack. Access them over SSH tunnel, not public firewall rules. Confirm the Grafana datasource/dashboard provisioned correctly after startup; the deployment script does not assert dashboard correctness.

## 10. Run QA checks (from repository root)

Only run tests against a staging/test deployment with dummy data, or obtain explicit approval before testing a live client environment. Performance/stress/spike tests can disrupt a shop's service.

Backend unit tests:

```bash
cd backend
npm ci
npm test
cd ..
```

API/Newman tests (the private Postman environment file is not included and must be supplied securely):

```bash
cd tests/api
npm ci
npm test
cd ../..
```

UI/Playwright tests (the local `.env` and browser installation may be needed; inspect `playwright.config.*` before running):

```bash
cd tests/ui
npm ci
npx playwright install --with-deps chromium
npm test
cd ../..
```

JMeter (replace `TEST_PLAN.jmx` with the exact checked-in plan filename and use a dedicated test environment):

```bash
jmeter -n -t "tests/performance/test-plans/TEST_PLAN.jmx" -l "tests/performance/reports/results/client-run.jtl" -e -o "tests/performance/reports/html/client-run"
```

Unified report (aggregates existing outputs; it does not execute tests):

```bash
cd tests/reporting
npm ci
npm run report
cd ../..
```

Missing inputs are reported as missing by the report generator. A generated report is not evidence that all test suites passed. Review the report's completeness and each suite's exit code.

## 11. Windows Server deployment host (Hyper-V)

This is the supported Windows Server path: Windows Server runs Hyper-V; the VM runs Ubuntu Server 24.04; Docker Engine and the POS Compose stack run inside Ubuntu.

Run PowerShell as Administrator and inspect prerequisites:

```powershell
.\deployment\windows-server\check-prerequisites.ps1
Get-VMSwitch
```

If Hyper-V is not enabled, enable the feature using the appropriate Windows Server edition/installation method, then reboot. Confirm a virtual switch exists and has the correct physical network access. For a shop LAN server that must have a stable address, plan a suitable external virtual switch and DHCP reservation/static IP with the network administrator.

Download the official Ubuntu Server 24.04 LTS ISO. Create and start a VM (adjust paths, switch, RAM and disk for your host):

```powershell
.\deployment\windows-server\create-ubuntu-vm.ps1 -UbuntuIsoPath "D:\ISO\ubuntu-24.04-live-server-amd64.iso" -SwitchName "External-LAN" -VMPath "D:\Hyper-V\POS-Ubuntu"
```

Complete the Ubuntu installer manually in Hyper-V Manager. Install OpenSSH Server during setup if remote administration is needed. After Ubuntu boots, follow sections 2–10 from inside the VM. The script creates the VM and attaches the ISO; it does not perform an unattended Ubuntu installation or deploy the application by itself.

## 12. Before handing this to a client

- Confirm the exact Git commit deployed and record it in the handover.
- Confirm the client owns and controls the server, credentials, DNS and backups.
- Use a fixed LAN IP or reserved cloud address; document port 8080 until HTTPS is configured.
- Configure HTTPS/domain, firewall, restricted SSH, OS updates, disk monitoring, backup retention and off-site copies.
- Test restore, power-loss recovery, and restart after reboot.
- Test the POS business flows with dummy data and obtain client sign-off before importing real data.
- Document MongoDB existing-data migration separately if upgrading an existing installation.
- Review privacy/consent and WhatsApp/SMS compliance before enabling notifications.

## Validation status

The deployment files were authored against the repository's checked-in `compose.yaml`, Dockerfiles, Nginx config, backend startup/health/metrics code, `.env.example`, and test package scripts. The scripts include runtime configuration and health checks. This package has **not** been executed on your actual Ubuntu or Windows Server hardware, and it is not a production certification. Complete a fresh-VM staging deployment and restore drill before client use.
