# Notification queue performance smoke test

This is an API enqueue smoke/load test, not a test of WhatsApp throughput or Meta limits.

1. Set `NOTIFICATIONS_WORKER_ENABLED=false` while measuring queue insertion only.
2. Obtain an owner JWT and use an opted-in dummy customer.
3. Run JMeter with `HOST`, `PORT`, `TOKEN`, and `CUSTOMER_ID` properties:

```powershell
jmeter -n -t "tests/performance/test-plans/notification-queue-smoke.jmx" `
  -JHOST=localhost -JPORT=5000 -JTOKEN="YOUR_OWNER_JWT" `
  -JCUSTOMER_ID="YOUR_CUSTOMER_OBJECT_ID" `
  -l "tests/performance/reports/results/notification-queue-smoke.jtl"
```

Use dummy customers and do not enable the delivery worker for load tests. The queue worker applies a configurable 6–12 second global inter-message delay in a single backend process. Do not use performance tests to send bulk WhatsApp messages.
