# Phase 9 — Playwright UI Automation Setup

This patch adds a standalone Playwright suite under `tests/ui`. It does not modify the React application, Express application, MongoDB schema, Docker Compose services, or production dependencies.

## Apply

Copy the `tests` folder into the repository root (the folder containing `compose.yaml`). Merge if prompted. No existing application files need replacement.

## Setup

Follow `tests/ui/README.md`. In short, use Node.js 20+, create `tests/ui/.env` from `.env.example`, install npm packages, install Chromium, and run the existing Docker Compose application.

## Run

```powershell
cd tests/ui
npm test
```

## Known scope

This is the Phase 9 automation foundation and smoke coverage. It is not yet the full functional suite. Postman/Newman, JMeter, unified reporting, GitHub Actions, and deployment automation are later phases.
