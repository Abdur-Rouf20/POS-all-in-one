# POS UI Automation — Phase 9

Playwright UI regression foundation for the existing POS application.

## Prerequisites

- Node.js 20 or newer
- Docker Desktop running
- Existing POS Docker Compose stack available at `http://localhost:3000`
- API available at `http://localhost:5000`
- An existing Owner account; optional existing Salesman account

## First-time setup (PowerShell)

From the repository root:

```powershell
cd tests/ui
Copy-Item .env.example .env
notepad .env
npm install
npx playwright install chromium
```

Set `POS_OWNER_EMAIL` and `POS_OWNER_PASSWORD` in `tests/ui/.env`. Do not commit this file. Optional Salesman credentials enable the Salesman access test.

## Run the application

In a separate PowerShell window, from the repository root:

```powershell
docker compose up -d --build
docker compose ps
```

Wait until the frontend and API are ready. Confirm `http://localhost:3000` opens and `http://localhost:5000/api/health` returns `{"status":"ok","service":"pos-api"}`.

## Run tests

From `tests/ui`:

```powershell
npm test
```

Useful commands:

```powershell
npm run test:smoke
npm run test:headed
npm run test:ui
npm run report
```

## Current Phase 9 coverage

- Frontend reachability
- Backend health endpoint
- Valid Owner login
- Invalid login error handling
- Owner logout
- Owner navigation visibility
- Owner navigation to core read-only pages
- Optional Salesman assigned-branch and owner-only navigation checks

These are initial smoke/regression tests, not complete business-workflow coverage. They do not create, edit, delete, receive stock, issue invoices, or change financial records.

## Reports and evidence

- HTML report: `tests/ui/playwright-report/index.html`
- JUnit XML: `tests/ui/test-results/junit.xml`
- Screenshots, traces and videos for failed tests: `tests/ui/test-results/artifacts/`

Open the HTML report with `npm run report`.

## Important safety notes

- Tests use the same application and database as the normal POS environment, as agreed for this project.
- The current Phase 9 suite is intentionally read-only except for authentication/session activity.
- Never put credentials in test source code or commit `.env`.
- Later phases will add tagged test data and cleanup rules before introducing create/update/delete workflows.
