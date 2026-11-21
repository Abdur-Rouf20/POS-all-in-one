# POS Customer Notifications — Phase A, B and C Patch

**Target:** the `main` branch ZIP uploaded for this conversation.

## Apply

1. Stop the POS containers:
   ```powershell
   docker compose down
   ```
2. Make a backup of your project directory (especially `.env` and MongoDB data).
3. Extract this ZIP directly into the root of your local `POS-all-in-one` project folder.
4. When Windows asks whether to replace existing files, choose **Replace**.
5. Do **not** replace your real `.env` file. This patch only includes `.env.example`.
6. Open your existing `.env` and add the notification variables from `.env.example`. Keep the worker disabled initially:
   ```env
   NOTIFICATIONS_WORKER_ENABLED=false
   NOTIFICATION_MIN_DELAY_MS=6000
   NOTIFICATION_MAX_DELAY_MS=12000
   NOTIFICATION_MAX_ATTEMPTS=5
   WAHA_URL=http://waha:3000
   WAHA_API_KEY=replace-with-a-long-random-secret
   WAHA_SESSION=default
   WAHA_TIMEOUT_MS=12000
   WAHA_DASHBOARD_USERNAME=admin
   WAHA_DASHBOARD_PASSWORD=replace-with-a-strong-password
   SMS_ENABLED=false
   SMS_GATEWAY_URL=
   SMS_GATEWAY_TOKEN=
   ```
7. Start the POS normally:
   ```powershell
   docker compose up -d --build
   ```

WAHA is an optional Compose profile. Do not enable the notification worker until you have configured a strong API key, linked your WhatsApp session, and confirmed customer opt-in. Instructions are in `PHASE_ABC_CUSTOMER_NOTIFICATIONS.md`.

## Included behaviour

- Automatic queue events after successful invoice creation, sales return and Money Receipt, with independent settings switches.
- Customer preference and consent fields; default `auto` and `unknown`.
- `auto` checks WhatsApp registration through WAHA, saves the result, and retries if the WAHA check is temporarily unavailable.
- Explicit WhatsApp preference stays WhatsApp unless a fresh registration check confirms the number is no longer registered; only then is SMS fallback attempted.
- SMS provider is a disabled placeholder (`SMS_ENABLED=false`).
- MongoDB message queue, idempotency key, retry/backoff, rate-limited sequential worker and customer notification history.
- Manual customer account statement is generated on the backend from the customer ledger; client cannot submit arbitrary message text or destination number.
- English/Bengali templates and language preference.
- Customer checkout preference/consent controls and customer-ledger notification settings/history.
- Customer-credit settlement option removed from new returns. Legacy customer-credit return entries are folded into due adjustments; no separate customer-credit balance is shown.
- API, UI and performance test files are placed in `tests/api`, `tests/ui`, and `tests/performance`.

## Test commands

API notification unit/contract tests:
```powershell
cd tests/api
npm run test:notifications
```

UI test (configure `POS_OWNER_EMAIL`, `POS_OWNER_PASSWORD`, and `POS_TEST_CUSTOMER_ID` in `tests/ui/.env`):
```powershell
cd tests/ui
npm test -- tests/customer-notifications.spec.js
```

Performance enqueue smoke test:
- Read `tests/performance/NOTIFICATION_QUEUE_TEST.md`.
- Keep the delivery worker disabled during load testing to avoid sending real customer messages.

## Validation performed while building this patch

- Node.js syntax checks passed for all included backend JavaScript files.
- TypeScript transpilation/parsing passed for the modified JSX pages.
- API notification unit tests: **7 passed**.
- Compose YAML parsed successfully.
- Not tested against your live MongoDB, Docker runtime, actual WAHA account or WhatsApp delivery. The UI Playwright test and JMeter plan are supplied but have not been executed against your environment.

## Important operational limitations

- This queue uses MongoDB and atomic job claiming. Run a single backend worker instance for this phase. A dedicated multi-instance queue/worker architecture is a later hardening step.
- A process crash in the small interval after saving a business record but before inserting its notification can still miss an automatic notification. Add a transactional outbox/reconciliation mechanism before production.
- WAHA `sendText` acceptance is recorded as `accepted`, not `delivered`. Delivery receipts/webhooks are not implemented in this phase.
- WAHA web-session automation is not the official WhatsApp Business Platform. Customer opt-in, platform policy, operator rules and business suitability must be checked before production use.
