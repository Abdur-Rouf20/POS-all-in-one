
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

// Resolve the project root from this script's location.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

const reportsDir = path.join(root, 'tests/reporting/reports');
const latestDir = path.join(reportsDir, 'latest');
const historyDir = path.join(reportsDir, 'history');

const createHistory = process.argv.includes('--archive');

const sources = [
  {
    key: 'ui',
    name: 'Playwright UI Tests',
    type: 'junit',
    file: 'tests/ui/test-results/junit.xml',
    archiveName: 'playwright-junit.xml'
  },
  {
    key: 'api',
    name: 'Newman API Tests',
    type: 'junit',
    file: 'tests/api/reports/newman-junit.xml',
    archiveName: 'newman-junit.xml'
  },
  {
    key: 'load',
    name: 'JMeter Load Test',
    type: 'jtl',
    file: 'tests/performance/reports/results/load-test.jtl',
    archiveName: 'load-test.jtl'
  },
  {
    key: 'stress',
    name: 'JMeter Stress Test',
    type: 'jtl',
    file: 'tests/performance/reports/results/stress-test.jtl',
    archiveName: 'stress-test.jtl'
  },
  {
    key: 'spike',
    name: 'JMeter Spike Test',
    type: 'jtl',
    file: 'tests/performance/reports/results/spike-test.jtl',
    archiveName: 'spike-test.jtl'
  }
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true
});

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function collectTestCases(node, output = []) {
  if (Array.isArray(node)) {
    for (const item of node) collectTestCases(item, output);
    return output;
  }

  if (!node || typeof node !== 'object') return output;

  for (const [key, value] of Object.entries(node)) {
    if (key === 'testcase') {
      output.push(...asArray(value));
    } else if (value && typeof value === 'object') {
      collectTestCases(value, output);
    }
  }

  return output;
}

function parseJUnit(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const parsed = xmlParser.parse(xml);
  const testCases = collectTestCases(parsed);

  let failed = 0;
  let errors = 0;
  let skipped = 0;

  for (const testCase of testCases) {
    failed += asArray(testCase.failure).length;
    errors += asArray(testCase.error).length;
    skipped += asArray(testCase.skipped).length;
  }

  const total = testCases.length;
  const failedTotal = failed + errors;

  return {
    total,
    passed: Math.max(0, total - failedTotal - skipped),
    failed: failedTotal,
    skipped,
    status:
      total === 0
        ? 'NO TEST CASES'
        : failedTotal > 0
          ? 'FAIL'
          : 'PASS'
  };
}

// CSV parser that supports quoted values and commas inside fields.
function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  row.push(field);
  if (row.some(value => value !== '')) rows.push(row);

  if (rows.length < 2) return [];

  const headers = rows[0].map(value => value.trim());

  return rows.slice(1).map(values => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = values[index] ?? '';
    });

    return item;
  });
}

function percentile(sortedValues, percentage) {
  if (!sortedValues.length) return null;

  const index = Math.max(
    0,
    Math.ceil(percentage * sortedValues.length) - 1
  );

  return sortedValues[index];
}

function parseJtl(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '');

  const allRows = parseCsv(content);

  // Transaction Controller parent rows have URL=null.
  // Exclude them to avoid counting the same transaction twice.
  const rows = allRows.filter(row => {
    const url = String(row.URL || '').trim().toLowerCase();

    return (
      url !== '' &&
      url !== 'null' &&
      url !== 'undefined'
    );
  });

  const elapsedValues = rows
    .map(row => Number(row.elapsed))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const timestamps = rows
    .map(row => Number(row.timeStamp))
    .filter(Number.isFinite);

  const total = rows.length;

  const failed = rows.filter(
    row => String(row.success).toLowerCase() !== 'true'
  ).length;

  const spanMs = timestamps.length
    ? Math.max(0, Math.max(...timestamps) - Math.min(...timestamps)
      + Math.max(0, ...elapsedValues))
    : 0;

  return {
    total,
    passed: total - failed,
    failed,
    errorRate: total
      ? Number((failed / total * 100).toFixed(2))
      : 0,
    averageMs: elapsedValues.length
      ? Number((
          elapsedValues.reduce((sum, value) => sum + value, 0) /
          elapsedValues.length
        ).toFixed(2))
      : null,
    medianMs: percentile(elapsedValues, 0.50),
    p90Ms: percentile(elapsedValues, 0.90),
    p95Ms: percentile(elapsedValues, 0.95),
    p99Ms: percentile(elapsedValues, 0.99),
    minMs: elapsedValues.length ? elapsedValues[0] : null,
    maxMs: elapsedValues.length
      ? elapsedValues[elapsedValues.length - 1]
      : null,
    throughputPerSecond: spanMs > 0
      ? Number((total / (spanMs / 1000)).toFixed(2))
      : null,
    status: total === 0
      ? 'NO SAMPLES'
      : failed > 0
        ? 'FAIL'
        : 'PASS'
  };
}

function makeTimestamp(date) {
  const pad = value => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + '_' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function getMetricRows(source) {
  const metrics = source.metrics;

  if (!source.available || !metrics) {
    return [
      ['Result', source.status],
      ['Details', source.error || 'Source file not available']
    ];
  }

  if (source.type === 'junit') {
    return [
      ['Total tests', metrics.total],
      ['Passed', metrics.passed],
      ['Failed', metrics.failed],
      ['Skipped', metrics.skipped]
    ];
  }

  return [
    ['HTTP samples', metrics.total],
    ['Passed', metrics.passed],
    ['Failed', metrics.failed],
    ['Error rate', `${metrics.errorRate}%`],
    ['Average response time', metrics.averageMs === null ? 'N/A' : `${metrics.averageMs} ms`],
    ['Median', metrics.medianMs === null ? 'N/A' : `${metrics.medianMs} ms`],
    ['P90', metrics.p90Ms === null ? 'N/A' : `${metrics.p90Ms} ms`],
    ['P95', metrics.p95Ms === null ? 'N/A' : `${metrics.p95Ms} ms`],
    ['P99', metrics.p99Ms === null ? 'N/A' : `${metrics.p99Ms} ms`],
    ['Minimum', metrics.minMs === null ? 'N/A' : `${metrics.minMs} ms`],
    ['Maximum', metrics.maxMs === null ? 'N/A' : `${metrics.maxMs} ms`],
    ['Throughput', metrics.throughputPerSecond === null ? 'N/A' : `${metrics.throughputPerSecond} samples/sec`]
  ];
}

function renderHtml(report) {
  const cards = report.sources.map(source => {
    const statusClass =
      source.status === 'PASS' ? 'pass' :
      source.status === 'FAIL' ? 'fail' :
      'missing';

    const rows = getMetricRows(source)
      .map(([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(value)}</td>
        </tr>
      `)
      .join('');

    return `
      <section class="card">
        <div class="card-header">
          <h2>${escapeHtml(source.name)}</h2>
          <span class="status ${statusClass}">
            ${escapeHtml(source.status)}
          </span>
        </div>

        <p class="path">${escapeHtml(source.file)}</p>

        <table>
          ${rows}
        </table>
      </section>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>POS Unified QA Report</title>

  <style>
    body {
      margin: 0;
      padding: 28px;
      font-family: Arial, sans-serif;
      color: #202938;
      background: #f4f6f9;
    }

    header, main, footer {
      max-width: 1100px;
      margin-left: auto;
      margin-right: auto;
    }

    h1 { margin-bottom: 8px; }

    .meta, footer {
      color: #657184;
      font-size: 13px;
      line-height: 1.7;
    }

    main {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 16px;
      margin-top: 22px;
    }

    .card {
      padding: 18px;
      background: white;
      border: 1px solid #dfe4eb;
      border-radius: 10px;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    h2 { font-size: 18px; }

    .status {
      padding: 5px 9px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: bold;
    }

    .pass { background: #e2f5e9; color: #176b36; }
    .fail { background: #fde7e7; color: #a32222; }
    .missing { background: #fff1d6; color: #875600; }

    .path {
      color: #758092;
      font-size: 11px;
      overflow-wrap: anywhere;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th, td {
      padding: 8px 4px;
      text-align: left;
      border-top: 1px solid #edf0f4;
    }

    th {
      width: 48%;
      font-weight: normal;
      color: #657184;
    }

    td { font-weight: 600; }

    footer { margin-top: 24px; }

    @media (max-width: 600px) {
      body { padding: 14px; }
    }
  </style>
</head>

<body>
  <header>
    <h1>POS Unified QA Report</h1>

    <div class="meta">
      Generated: ${escapeHtml(report.generatedAt)}<br>
      Snapshot ID: ${escapeHtml(report.snapshotId)}<br>
      This report represents the latest source results available at generation time.
    </div>
  </header>

  <main>${cards}</main>

  <footer>
    Generated by POS Phase 12 Unified QA Reporting.
  </footer>
</body>
</html>`;
}

function readSource(source) {
  const absolutePath = path.join(root, source.file);

  if (!fs.existsSync(absolutePath)) {
    return {
      ...source,
      absolutePath,
      available: false,
      metrics: null,
      status: 'MISSING',
      error: null,
      sizeBytes: null,
      lastModified: null
    };
  }

  const stat = fs.statSync(absolutePath);

  try {
    const metrics = source.type === 'junit'
      ? parseJUnit(absolutePath)
      : parseJtl(absolutePath);

    return {
      ...source,
      absolutePath,
      available: true,
      metrics,
      status: metrics.status,
      error: null,
      sizeBytes: stat.size,
      lastModified: stat.mtime.toISOString()
    };
  } catch (error) {
    return {
      ...source,
      absolutePath,
      available: true,
      metrics: null,
      status: 'PARSE ERROR',
      error: error.message,
      sizeBytes: stat.size,
      lastModified: stat.mtime.toISOString()
    };
  }
}

function createHistorySnapshot(report, sourceResults, htmlPath, jsonPath) {
  fs.mkdirSync(historyDir, { recursive: true });

  const baseName = report.snapshotId;
  let folderName = baseName;
  let counter = 1;

  // Avoid overwriting an existing history snapshot.
  while (fs.existsSync(path.join(historyDir, folderName))) {
    folderName = `${baseName}-${String(counter).padStart(3, '0')}`;
    counter++;
  }

  const snapshotDir = path.join(historyDir, folderName);
  const sourceResultsDir = path.join(snapshotDir, 'source-results');

  fs.mkdirSync(sourceResultsDir, { recursive: true });

  fs.copyFileSync(
    htmlPath,
    path.join(snapshotDir, 'unified-qa-report.html')
  );

  fs.copyFileSync(
    jsonPath,
    path.join(snapshotDir, 'unified-qa-report.json')
  );

  const archivedFiles = sourceResults.map(source => {
    if (!source.available || source.status === 'PARSE ERROR') {
      return {
        source: source.file,
        archivedAs: null,
        status: source.status
      };
    }

    const destination = path.join(
      sourceResultsDir,
      source.archiveName
    );

    fs.copyFileSync(source.absolutePath, destination);

    return {
      source: source.file,
      archivedAs: `source-results/${source.archiveName}`,
      status: source.status,
      sizeBytes: source.sizeBytes,
      lastModified: source.lastModified
    };
  });

  const manifest = {
    snapshotId: folderName,
    generatedAt: report.generatedAt,
    files: archivedFiles
  };

  fs.writeFileSync(
    path.join(snapshotDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  return snapshotDir;
}

function main() {
  fs.mkdirSync(latestDir, { recursive: true });

  const now = new Date();
  const snapshotId = makeTimestamp(now);

  const sourceResults = sources.map(readSource);

  const report = {
    title: 'POS Unified QA Report',
    generatedAt: now.toISOString(),
    snapshotId,
    sources: sourceResults.map(({
      absolutePath,
      ...source
    }) => source)
  };

  const htmlPath = path.join(
    latestDir,
    'unified-qa-report.html'
  );

  const jsonPath = path.join(
    latestDir,
    'unified-qa-report.json'
  );

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(report, null, 2),
    'utf8'
  );

  fs.writeFileSync(
    htmlPath,
    renderHtml(report),
    'utf8'
  );

  console.log('\nUnified QA report generated.');
  console.log(`HTML: ${path.relative(root, htmlPath)}`);
  console.log(`JSON: ${path.relative(root, jsonPath)}`);

  const missing = sourceResults.filter(
    source => !source.available
  );

  const parseErrors = sourceResults.filter(
    source => source.status === 'PARSE ERROR'
  );

  if (missing.length) {
    console.warn('\nMissing source files:');
    missing.forEach(source => console.warn(`- ${source.file}`));
  }

  if (parseErrors.length) {
    console.warn('\nSource parsing errors:');
    parseErrors.forEach(source => {
      console.warn(`- ${source.file}: ${source.error}`);
    });
  }

  if (createHistory) {
    const snapshotDir = createHistorySnapshot(
      report,
      sourceResults,
      htmlPath,
      jsonPath
    );

    const copiedCount = sourceResults.filter(
      source => source.available && source.status !== 'PARSE ERROR'
    ).length;

    console.log('\nHistory snapshot created.');
    console.log(`Location: ${path.relative(root, snapshotDir)}`);
    console.log(`Source files archived: ${copiedCount}/${sources.length}`);
  } else {
    console.log('\nHistory was not changed.');
  }
}

main();
