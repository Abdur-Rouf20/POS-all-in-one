# Unified QA Reporting

Combines existing Playwright UI, Newman API, and JMeter load/stress/spike results.

## Inputs

- `tests/ui/test-results/junit.xml`
- `tests/api/reports/newman-junit.xml`
- `tests/performance/reports/results/load-test.jtl`
- `tests/performance/reports/results/stress-test.jtl`
- `tests/performance/reports/results/spike-test.jtl`

The generator does not rerun tests. It reads the existing result files.

## Setup (Windows PowerShell)

From the repository root:

```powershell
cd .\tests\reporting
npm install
npm run report
```

## Output

- `tests/reporting/reports/unified-qa-report.html`
- `tests/reporting/reports/unified-qa-report.json`

Open the HTML report in a browser.

## Metric notes

- JUnit XML is used for Playwright and Newman test counts.
- JMeter CSV JTL files are parsed as CSV, including quoted fields.
- JMeter transaction-controller parent samples with no URL are excluded; only HTTP sampler rows are counted.
- Percentiles use nearest-rank calculation.
- Throughput is calculated as HTTP sampler count divided by the observed timestamp span (including the longest sample duration).
- Missing inputs are marked `MISSING`; the report can still be generated, but do not treat an incomplete report as a complete QA run.
- Performance results are specific to the test environment and configured workload. They do not establish production capacity by themselves.

## Security

Do not put credentials, tokens, private Postman environments, or local `.env` files in this reporting folder or commit them to Git.
