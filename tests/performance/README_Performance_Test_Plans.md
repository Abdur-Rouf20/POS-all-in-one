# POS JMeter Performance Test Plans

These plans reuse the existing recorded POS workflow but are **read-only performance scenarios**.
They deliberately exclude POST/PUT operations that create or modify categories, products, stock,
expenses, invoices, returns, settings, and money receipts. This prevents concurrent tests from
creating duplicate business records or changing inventory and customer balances.

## Files

- `POS_Load_Test_Cleaned.jmx` — 10 concurrent users, 30-second ramp-up, 5-minute duration.
- `POS_Stress_Test.jmx` — sequential stages of 10, 25, 50, and 75 users; each stage runs for 2 minutes.
- `POS_Spike_Test.jmx` — 5-user baseline for 2 minutes, 50-user spike with 5-second ramp-up for 1 minute,
  then 5-user recovery for 2 minutes.

The plans use the same read-only endpoint set: login, branches, settings, dashboard summary, categories,
products, inventory batches, inventory, customer lookup, customers, money receipts, invoices, returns,
expenses, and reports. Each request has an HTTP 200 response-code assertion. Login extracts `$.token`
into `access_token` and the authenticated requests use `Bearer ${access_token}`.

## One-time local configuration

1. Copy `tests\performance\data\POS_JMeter.local.properties.example` to
   `tests\performance\data\POS_JMeter.local.properties`.
2. Set `owner_email`, `owner_password`, and `branch_id` to a valid test account and one of its branches, and `lookup_phone` to a test customer phone number used by your test database.
3. Add this line to the repository `.gitignore`:
   `tests/performance/data/POS_JMeter.local.properties`
4. Never commit the real properties file, access tokens, or real credentials.

The customer lookup phone is parameterized; no recorded customer phone number is embedded in these plans.\n\nThe plans expect the API at `http://localhost:5000`. Start the POS backend and database before running.
Use a dedicated test environment and test account, not production.

## Run from the repository root (PowerShell)

```powershell
$jmeter = "C:\Program Files\apache-jmeter-5.6.3\bin\jmeter.bat"
$props = ".\tests\performance\data\POS_JMeter.local.properties"

# Load
$plan = ".\tests\performance\test-plans\POS_Load_Test_Cleaned.jmx"
$jtl = ".\tests\performance\reports\results\load-test.jtl"
if (Test-Path $jtl) { throw "Output already exists; choose a new JTL filename." }
& $jmeter -n -q $props -t $plan -l $jtl
if ($LASTEXITCODE -ne 0) { throw "JMeter load test failed." }

# Stress (run after reviewing load results)
$plan = ".\tests\performance\test-plans\POS_Stress_Test.jmx"
$jtl = ".\tests\performance\reports\results\stress-test.jtl"
if (Test-Path $jtl) { throw "Output already exists; choose a new JTL filename." }
& $jmeter -n -q $props -t $plan -l $jtl
if ($LASTEXITCODE -ne 0) { throw "JMeter stress test failed." }

# Spike (run after reviewing stress results)
$plan = ".\tests\performance\test-plans\POS_Spike_Test.jmx"
$jtl = ".\tests\performance\reports\results\spike-test.jtl"
if (Test-Path $jtl) { throw "Output already exists; choose a new JTL filename." }
& $jmeter -n -q $props -t $plan -l $jtl
if ($LASTEXITCODE -ne 0) { throw "JMeter spike test failed." }
```

Run **one plan at a time**. Do not run load, stress, and spike simultaneously.
The first run should be the load test. Review error rate, throughput, average/median response time,
90th/95th/99th percentile latency, and server/DB resource use before increasing the load.
Stop a test if the API becomes unstable, the error rate rises sharply, or the host/DB is saturated.
These user counts are starting test profiles, not a capacity claim or an SLA.

## Important limitations / validation before interpreting results

- The original recording had hardcoded credentials and bearer tokens. These have been removed from
  the generated plans. If the original token/password was real, revoke/rotate it.
- A valid `branch_id` must be supplied in the local properties file. The plans send it as `X-Branch-Id`.
- The original recording contained repeated navigation requests and record-specific paths. The generated
  plans retain one copy of each unique, non-ID GET endpoint; ID-specific invoice/customer ledger paths
  were excluded because their recorded IDs may not exist in another database.
- The recorded full workflow's write operations are not part of these load/stress/spike plans. Keep the
  original JMX as a local reference, sanitize it before sharing, and use a separate controlled functional
  test for writes with unique test data and cleanup.
- The plans assert HTTP 200 for login and each retained GET. If your API intentionally returns another
  status for any endpoint, update that endpoint's assertion to match its documented contract.
- No CSV Data Set Config is included because these scenarios only read data and each virtual user logs in
  independently. A Cookie Manager is not included because the recorded workflow uses bearer-token auth.
