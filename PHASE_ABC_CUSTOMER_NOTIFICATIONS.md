# Phase A–C: Customer WhatsApp/SMS notifications

## Included
- Customer channel preference: `auto`, `whatsapp`, `sms` (default `auto`).
- Customer consent: `unknown`, `opted_in`, `opted_out`; outbound delivery is skipped unless `opted_in`.
- Preferred language `en` / `bn`.
- Independent automatic notification switches for invoice creation, sales return and Money Receipt.
- MongoDB notification queue/history with event-key idempotency, retries, stale-job recovery and sequential worker.
- WAHA WhatsApp registration check and sender adapter.
- SMS adapter placeholder; disabled by default.
- Customer ledger screen: channel/consent controls, account-summary queue action and notification history.
- Salesman permission for manual account-summary notifications.
- API/UI/performance tests in existing `tests/` structure.

## Important accounting behaviour
The account summary follows the existing ledger grand-due logic. Historical `customer_credit` returns are folded into due adjustments; no separate customer-credit card or credit balance is shown. New returns no longer offer a customer-credit settlement: choose due adjustment or cash refund. Cash refunds are shown separately and are not subtracted from grand due.

## Configure WAHA
1. Add a strong random `WAHA_API_KEY` to `.env`.
2. Start the WhatsApp container:
   ```powershell
   docker compose --profile notifications up -d waha
   ```
3. Open `http://localhost:3002/dashboard` on the host and link the WhatsApp device using Linked Devices.
4. Set in `.env`:
   ```env
   NOTIFICATIONS_WORKER_ENABLED=true
   WAHA_URL=http://waha:3000
   WAHA_API_KEY=your-strong-key
   WAHA_SESSION=default
   NOTIFICATION_MIN_DELAY_MS=6000
   NOTIFICATION_MAX_DELAY_MS=12000
   SMS_ENABLED=false
   ```
5. Restart backend:
   ```powershell
   docker compose up -d --build backend
   ```

The WAHA API is bound to host loopback only; do not expose its dashboard/API publicly. The backend reaches it over the internal Compose network. If the backend is run directly on Windows instead of Docker, set `WAHA_URL=http://localhost:3002`.

## Customer workflow
1. Open Customers → customer ledger.
2. Select the preferred channel (`auto`, `whatsapp`, or `sms`).
3. Record customer consent as `opted_in` only after the customer explicitly agrees. `opted_out` suppresses sending.
4. Use Queue account summary to generate the statement from the backend ledger. No client-supplied message or recipient is accepted.

## Channel decision rules
- `auto`: check WAHA registration; persist WhatsApp/SMS preference. If WAHA check is unavailable, retry later rather than guessing.
- `whatsapp`: send via WAHA. On send failure, re-check registration; switch to SMS only if WAHA confirms the number is no longer registered. Other failures retry.
- `sms`: use the SMS adapter. It records `skipped_sms_disabled` while disabled.
- WhatsApp `sendText` acceptance is stored as `accepted`, not `delivered`. Delivery receipts/webhooks are not implemented in Phase A–C.

## Queue and reliability notes
The queue is stored in MongoDB and is idempotent by source event. The worker claims jobs atomically and retries transient failures with exponential backoff. A single worker loop runs in each backend process and waits a random 6–12 seconds between processed messages. Run only one backend worker instance for this phase; for multi-instance production, move to a dedicated worker/queue coordination service. A crash in the small interval between saving a business record and inserting its notification can still miss an automatic notification; a transactional outbox/reconciliation phase is recommended before production.

## Tests
- API contract/unit tests:
  ```powershell
  cd tests/api
  npm run test:notifications
  ```
- UI test (requires Playwright browser, owner credentials and a test customer):
  set `POS_OWNER_EMAIL`, `POS_OWNER_PASSWORD`, `POS_TEST_CUSTOMER_ID` in `tests/ui/.env`, then:
  ```powershell
  cd tests/ui
  npm test -- tests/customer-notifications.spec.js
  ```
- Performance queue enqueue smoke test: see `tests/performance/NOTIFICATION_QUEUE_TEST.md`.

## Safety and compliance
WAHA web-session automation is not the official WhatsApp Business Platform. Use only with explicit customer opt-in, protect the API key, and review WhatsApp/Meta and Bangladesh operator requirements before production. A 6–12 second delay is only a conservative pacing setting, not a guarantee against restrictions. SMS is disabled until a compliant gateway is configured.
