# POS Project – Resume Context

**Prepared:** 17 November 2026  
**Repository:** `Abdur-Rouf20/POS-all-in-one`  
**Local Windows path:** `D:\New folder\POS-all-in-one`  
**Primary shell:** Windows PowerShell  
**Current priority:** Get the POS application release-ready quickly by fixing important bugs and adding one crucial feature. Then prepare three demonstration videos.

---

## 1. Working preferences and rules

- Give practical, direct, step-by-step instructions for Windows PowerShell.
- When introducing an unfamiliar command, briefly explain what it does.
- Prefer exact file paths and complete-file replacements when code changes are needed.
- Avoid unnecessary screenshots and long explanations.
- Discuss important changes before applying them; do not silently alter business rules.
- Preserve existing POS functionality and test assertions. Do not weaken tests merely to make CI pass.
- Do not ask for or expose `.env`, passwords, JWT secrets, private Postman environments, or other credentials.
- Work locally, commit to a task-specific branch, push to GitHub, and use a PR into `develop` so CI runs.
- Do not push ordinary work to `feature/phase-13-github-actions`. That branch was for completing Phase 13; it has been merged.

## 2. Project and Git context

- Project: MERN POS application, frontend + Express backend + MongoDB.
- GitHub repository: `Abdur-Rouf20/POS-all-in-one`.
- Main branches: `main`, `develop`.
- Phase 13 (`feature/phase-13-github-actions`) was successfully merged into `develop`; CI is running successfully.
- CI currently runs for pushes to `develop` and the old Phase 13 branch, plus PRs targeting `develop` and manual dispatch. Therefore, a push to a newly created `fix/...` or `feature/...` branch does **not** run CI by itself; creating/updating a PR targeting `develop` triggers CI.
- Use a separate branch for each meaningful fix or feature where practical.
- The exact current local Git branch and working-tree state were **not confirmed** at the end of this session. Check them before switching branches.

### Safe Git check before starting new work

Run from the repository root:

```powershell
git branch --show-current
git status --short
git log -1 --oneline
```

These show the current branch, uncommitted changes, and latest commit. Do not discard or overwrite any uncommitted Phase 15 monitoring work.

### Recommended branch strategy for the next work

First preserve any Phase 15 work on its own branch. If there are uncommitted monitoring changes, commit them to the monitoring branch before switching, or safely stash them. Do not accidentally mix unfinished monitoring changes with POS business fixes.

Then create a bug-fix branch from the latest `develop`:

```powershell
git switch develop
git pull origin develop
git switch -c fix/pos-release-readiness
git push -u origin fix/pos-release-readiness
```

Only run these after checking/preserving the current working tree. The branch name is a suggested name and can be adjusted if it already exists.

After the important bugs are fixed, tested, and merged, create a **separate feature branch** from updated `develop` for the crucial new feature. Do not combine unrelated bug fixes and the new feature in one large PR unless their implementation is inseparable.

## 3. Completed project phases

- Phases 1–8: MERN POS app implementation.
- Phase 9: Playwright UI automation.
- Phase 10: Postman API testing + Newman.
- Phase 11: JMeter performance testing.
- Phase 12: Unified QA reporting.
- Phase 13: GitHub Actions CI pipeline. Successfully merged into `develop` and CI passes.

The existing testing setup includes:

- Playwright UI tests: `tests/ui/`
- Postman collection and Newman: `tests/api/`
- JMeter plans and results: `tests/performance/`
- Unified reports: `tests/reporting/`
- CI workflow: `.github/workflows/ci.yml`

GitHub Actions artifacts (`pos-qa-reports`) are the user's preferred place to retrieve generated CI reports/evidence. The user does not want to manually commit generated reports or maintain report history in GitHub for each CI run.

## 4. Phase 14 – Production deployment deferred

The user cannot currently purchase a Linux VPS. Phase 14 is deferred, not cancelled.

Future plan: build a physical Linux server at home, connect the shop/router clients through a VPN, and later host the POS application there. Return to production deployment when that hardware/network setup is ready.

## 5. Phase 15 – Monitoring and infrastructure: current working state

The user paused Phase 15 after getting the POS Grafana dashboard working. Resume this phase later from the cAdvisor/container-monitoring step. Do not redo already completed work.

### Docker environment

- Docker Engine: `29.9.2`
- Docker Compose: `v5.6.1`
- Engine OS: Linux (Docker Desktop on Windows)
- Docker API: `1.56`

### Existing containers confirmed running

| Service | Container | Image | Host port |
|---|---|---|---|
| Frontend | `pos-frontend` | locally built POS frontend | `3000` |
| Backend | `pos-backend` | locally built POS backend | `5000` |
| MongoDB | `pos-mongo` | `mongo:7` | `27017` |
| Prometheus | `pos-prometheus` | `prom/prometheus:v3.5.0` | `127.0.0.1:9090` |
| Grafana | `pos-grafana` | `grafana/grafana:13.3.1` | `127.0.0.1:3001` |

The above were confirmed by `docker compose ps` at the end of the session. cAdvisor has **not** been added yet.

### Application metrics instrumentation

- Installed `prom-client` in `backend` (`npm install prom-client`).
- `backend/src/server.js` was updated to expose `GET /metrics`.
- Existing `GET /api/health` remains and returns `{ status: 'ok', service: 'pos-api' }`.
- Metrics include default Node.js/process metrics and:
  - `pos_http_requests_total`
  - `pos_http_request_duration_seconds`
  - `pos_http_requests_in_progress`
- Verified `http://localhost:5000/metrics` returns Prometheus text-format metrics.
- One implementation caution for later hardening: current route-label fallback can use `req.path` for unmatched/dynamic routes, potentially producing high-cardinality labels. Review and normalize route labels before treating this instrumentation as production-ready.
- `/metrics` is currently reachable on the backend's published host port. Restrict access appropriately before any public deployment.

### Prometheus

Created `monitoring/prometheus/prometheus.yml` with the backend target. Current config was then extended in the proposed cAdvisor step but that step has **not** been performed. The known working configuration before cAdvisor was:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "pos-backend"
    metrics_path: /metrics
    static_configs:
      - targets: ["backend:5000"]
```

Prometheus target `http://backend:5000/metrics` was confirmed `up`.

### Grafana

- Grafana health check succeeded at `http://localhost:3001/api/health` and returned database `ok`, version `13.3.1`.
- Admin username is `admin`. Password is stored in the local `.env` as `GRAFANA_ADMIN_PASSWORD`; do not request or disclose it.
- Grafana service is bound to `127.0.0.1:3001`.
- Prometheus data source is provisioned at `monitoring/grafana/provisioning/datasources/prometheus.yml`, UID `prometheus`, URL `http://prometheus:9090`.
- Dashboard provider is provisioned at `monitoring/grafana/provisioning/dashboards/pos-dashboard.yml`.
- Dashboard JSON is stored at `monitoring/grafana/dashboards/pos-overview.json`.
- Dashboard title: **POS Application Monitoring**.
- Six panels have been verified visually:
  1. HTTP Request Rate by Route
  2. API Response Time – P95
  3. HTTP 5xx Error Rate
  4. Average API Response Time
  5. Requests Currently Processing
  6. Backend Process Memory
- Screenshot confirmed that the dashboard receives real API metrics.
- The 5xx panel excludes 4xx responses; it is not a total error-rate panel.

### Current Compose stack

The current `compose.yaml` includes frontend, backend, mongo, prometheus, and grafana. It also includes named volumes `mongo_data`, `prometheus_data`, and `grafana_data`. Preserve these volumes; do not use `docker compose down -v` because that would delete persistent volumes, including MongoDB data.

### Paused next step: cAdvisor

Not yet done. The proposed next work was:

1. Add a `cadvisor` service to `compose.yaml` using `ghcr.io/google/cadvisor:v0.61.0`, localhost-only port `127.0.0.1:8080:8080`, and Linux Docker/system mounts.
2. Add Prometheus scrape target `cadvisor:8080` under job `pos-containers`.
3. Recreate only cAdvisor and Prometheus.
4. Verify cAdvisor exports container CPU/memory metrics and Prometheus target is `up`.
5. Add container CPU, memory, and network panels to Grafana.

Important: Docker Desktop's Linux VM can have different visibility/mount behavior from native Linux. Verify actual metrics rather than assuming the cAdvisor container being up proves the metrics work. The proposed `/var/run` mount grants significant Docker runtime access; review security and do not expose cAdvisor publicly.

## 6. New immediate priority – POS release readiness

The user wants to move away from Phase 15 temporarily and focus on:

1. Fix important POS bugs.
2. Add one crucial new POS feature.
3. Get the application ready to go live as quickly as practical.

The exact bug list and feature requirements have **not been provided yet**. Do not invent them or start editing code before the user identifies the first bug and describes the desired feature.

Recommended working order:

- Create a task-specific bug-fix branch from updated `develop` after preserving Phase 15 work.
- Fix and verify critical bugs, ideally one at a time, with regression tests.
- Merge the bug-fix PR into `develop` after CI passes.
- Create a separate feature branch from updated `develop` for the crucial feature.
- Implement, test, document, and merge the feature after CI passes.
- Keep a concise changelog and capture clean demo evidence as work progresses.

For each bug, collect: exact page/operation, user role and branch context, steps to reproduce, expected result, actual result, frequency, and screenshots/logs only when necessary. For the new feature, first capture the business problem, user roles, workflow, validation/business rules, data changes, permissions, and acceptance criteria.

## 7. Demonstration video plan – three videos

The user said they want three videos, in this sequence: bug fixes, feature addition, testing infrastructure, then DevOps infrastructure. Interpret this as three videos, with the first video combining the completed bug fixes and feature addition, followed by separate testing and DevOps videos:

### Video 1 – POS product improvements

- Demonstrate the important bugs before/after where practical.
- Explain the fixes and business impact.
- Demonstrate the new feature's real workflow and role/permission behavior.
- Show relevant regression tests passing.
- Record only after the fixes/feature are stable and merged or at least on a final review-ready branch.

### Video 2 – QA and automated testing infrastructure

- Playwright UI testing.
- Postman/Newman API automation.
- JMeter performance testing.
- Unified QA report/dashboard.
- GitHub Actions CI run and downloadable artifacts.

### Video 3 – DevOps and monitoring infrastructure

- Docker Compose services and container setup.
- Prometheus scraping backend metrics.
- Grafana POS Application Monitoring dashboard.
- cAdvisor/container metrics only after completed and verified.
- Clearly distinguish local Docker/monitoring from production deployment, which is deferred until the home physical server and VPN are ready.

## 8. How to resume next time

Start by reading this file. Then ask the user to run the Git safety check in Section 2 and share its output, unless they have already provided current Git state. Preserve unfinished Phase 15 changes and move into the bug-fix branch. Ask for the first high-priority bug's reproduction steps and expected/actual behavior. Do not restart Prometheus/Grafana setup or continue cAdvisor unless the user explicitly returns to Phase 15.

**User's explicit direction:** prioritize bug fixes and the essential feature now; return to cAdvisor/Phase 15 later; then produce the three videos in the specified order.
