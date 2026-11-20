import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const monthStart = () => `${today().slice(0, 7)}-01`;
const columns = {
  sales: [['date', 'date'], ['invoiceNo', 'invoiceNo'], ['branch', 'branch'], ['customer', 'customer'], ['itemCount', 'items'], ['quantity', 'quantity'], ['total', 'total'], ['paid', 'paid'], ['due', 'due'], ['paymentStatus', 'status']],
  returns: [['date', 'date'], ['returnNo', 'return'], ['invoiceNo', 'invoiceNo'], ['branch', 'branch'], ['customer', 'customer'], ['quantity', 'quantity'], ['refund', 'refund'], ['settlement', 'settlement'], ['refundMethod', 'refundMethod'], ['processedBy', 'processedBy']],
  receipts: [['date', 'date'], ['receiptNo', 'receipt'], ['branch', 'branch'], ['customer', 'customer'], ['phone', 'phone'], ['amount', 'amount'], ['cash', 'cash'], ['banglaQr', 'banglaQr'], ['paymentType', 'method'], ['receivedBy', 'receivedBy']],
  expenses: [['date', 'date'], ['expenseNo', 'expense'], ['branch', 'branch'], ['category', 'category'], ['description', 'description'], ['amount', 'amount'], ['cash', 'cash'], ['banglaQr', 'banglaQr'], ['paymentMethod', 'method'], ['createdBy', 'createdByLabel']],
  inventory: [['branch', 'branch'], ['product', 'product'], ['sku', 'sku'], ['quantity', 'stockQty'], ['batchCount', 'batches']]
};
const costColumns = {
  knownCost: 'knownCost', knownGrossProfit: 'knownGrossProfit', costCoverage: 'costCoverage',
  confirmedCostValue: 'confirmedCostValue', retailValue: 'retailValue',
  knownCostQuantity: 'knownCostQuantity', unknownCostQuantity: 'unknownCostQuantity'
};
const summaryLabels = {
  invoiceCount: 'invoiceCount', quantity: 'quantity', sales: 'salesAmount', paid: 'paid',
  due: 'due', knownCost: 'knownCost', knownGrossProfit: 'knownGrossProfit',
  returnCount: 'returns', refund: 'refund', receiptCount: 'receiptRecords',
  amount: 'amount', cash: 'cash', banglaQr: 'banglaQr', expenseCount: 'expenseRecords',
  productCount: 'productCount', stockQuantity: 'stockQuantity',
  confirmedCostValue: 'confirmedCostValue', retailValue: 'retailValue',
  unknownCostQuantity: 'unknownCostQuantity'
};
const categoryKeys = {
  'Shop rent': 'shopRent', Electricity: 'electricity', Internet: 'internet',
  Utilities: 'utilities', Snacks: 'snacks', Transport: 'transport',
  Maintenance: 'maintenance', Packaging: 'packaging', Other: 'other'
};
const moneyKeys = new Set(['sales', 'paid', 'due', 'refund', 'amount', 'cash', 'banglaQr', 'knownCost', 'knownGrossProfit', 'confirmedCostValue', 'retailValue']);
const reportTypeKeys = { sales: 'salesReport', returns: 'returnsReport', receipts: 'receiptsReport', expenses: 'expenseReport', inventory: 'inventoryReport' };

function csvCell(value) {
  const raw = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows, selectedColumns) {
  const content = [
    selectedColumns.map(([, label]) => csvCell(label)).join(','),
    ...rows.map(row => selectedColumns.map(([key]) => csvCell(row[key])).join(','))
  ].join('\r\n');
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function translateReportValue(key, value, t) {
  if (value == null || value === '—') return '—';
  if (key === 'category') return t[categoryKeys[value]] || value;
  if (key === 'paymentStatus') return t[value] || value;
  if (key === 'settlement') {
    return value === 'customer_credit' ? t.customerCredit : value === 'due_adjustment' ? t.dueAdjustmentShort : t.cashRefund;
  }
  if (['refundMethod', 'paymentType', 'paymentMethod'].includes(key)) {
    return value === 'bangla_qr' ? t.banglaQr : value === 'mixed' ? t.mixedPayment : value === 'cash' ? t.cash : value;
  }
  return value;
}

export default function Reports({ settings, user, t, lang }) {
  const owner = user?.role === 'owner';
  const [type, setType] = useState('sales');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [allBranches, setAllBranches] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const visibleColumns = useMemo(() => {
    const base = (columns[type] || []).map(([key, labelKey]) => [key, t[labelKey]]);
    if (type === 'sales' && owner) {
      return [...base, ...['knownCost', 'knownGrossProfit', 'costCoverage'].map(key => [key, t[costColumns[key]]])];
    }
    if (type === 'inventory' && owner) {
      return [...base, ...['confirmedCostValue', 'retailValue', 'knownCostQuantity', 'unknownCostQuantity'].map(key => [key, t[costColumns[key]]])];
    }
    return base;
  }, [type, owner, t]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setReport(await api.report(type, { from, to, allBranches: owner && allBranches }));
    } catch (requestError) {
      setError(requestError.message || t.noReportAvailable);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [type, from, to, allBranches]);

  function exportReport() {
    if (!report) return;
    const rows = report.rows.map(row => ({
      ...row,
      date: row.date ? new Date(row.date).toLocaleString(locale) : ''
    }));
    downloadCsv(`pos-${type}-report-${from}-to-${to}.csv`, rows, visibleColumns);
  }

  const totalEntries = report?.rows?.length || 0;
  const summaryEntries = report?.totals
    ? Object.entries(report.totals).filter(([key, value]) => typeof value === 'number' && summaryLabels[key])
    : [];
  const reportTitle = t[reportTypeKeys[type]];
  const reportNote = report?.totals?.note?.startsWith('Known gross profit')
    ? t.grossProfitReportNote
    : t.inventoryReportNote;

  return <div className="reports-page">
    <div className="page-heading no-print">
      <div><div className="eyebrow">{t.businessReporting}</div><h1>{t.reports}</h1><p className="muted">{t.reportsHint}</p></div>
      <div className="report-actions">
        <button className="button secondary" onClick={exportReport} disabled={!report || loading}><Download size={16}/> {t.exportCsv}</button>
        <button className="button primary" onClick={() => window.print()} disabled={!report}><Printer size={16}/> {t.printReport}</button>
      </div>
    </div>
    <div className="panel no-print reports-filter-panel" style={{ marginBottom: 18 }}>
      <div className="panel-head"><div><h2>{t.reportFilters}</h2><p className="muted">{t.chooseReport}</p></div>{loading && <span className="muted">{t.reportLoading}</span>}</div>
      <div className="reports-filter-grid">
        <div className="field">
          <label htmlFor="report-type">{t.reportType}</label>
          <select id="report-type" value={type} onChange={event => setType(event.target.value)}>
            <option value="sales">{t.salesReport}</option><option value="returns">{t.returnsReport}</option>
            <option value="receipts">{t.receiptsReport}</option>{owner && <option value="expenses">{t.expenseReport}</option>}
            <option value="inventory">{t.inventoryReport}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="report-from">{t.from}</label>
          <input id="report-from" type="date" value={from} onChange={event => setFrom(event.target.value)}/>
        </div>
        <div className="field">
          <label htmlFor="report-to">{t.to}</label>
          <input id="report-to" type="date" value={to} onChange={event => setTo(event.target.value)}/>
        </div>
        {owner && <label className="report-all-branches"><input type="checkbox" checked={allBranches} onChange={event => setAllBranches(event.target.checked)}/> {t.allBranchesOption}</label>}
        <button className="button secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> {t.refresh}</button>
      </div>
    </div>
    {error && <div className="alert error no-print">{error}</div>}
    <div className="report-print-header">
      <h1>{settings?.businessName || 'POS Business'} — {reportTitle}</h1>
      <p>{from} {t.to} {to} · {report?.branchScope === 'all' ? t.allBranchesOption : t.selectedAssignedBranch}</p>
      <p>{t.generated}: {report?.generatedAt ? new Date(report.generatedAt).toLocaleString(locale) : '—'}</p>
    </div>
    <div className="stats-grid report-summary">
      {summaryEntries.map(([key, value]) => <div className="stat-card" key={key}>
        <span className="stat-label">{t[summaryLabels[key]]}</span>
        <strong>{moneyKeys.has(key) ? money(value) : Number(value).toLocaleString(locale)}</strong>
      </div>)}
    </div>
    {report?.totals?.note && <p className="alert">{reportNote}</p>}
    {type === 'expenses' && report?.totals?.byCategory && (
      <div className="panel report-categories-panel">
        <h2>{t.expenseCategories}</h2>
        <div className="report-category-list">
          {Object.entries(report.totals.byCategory).map(([name, value]) => <div className="metric-line" key={name}><span>{t[categoryKeys[name]] || name}</span><b>{money(value)}</b></div>)}
        </div>
      </div>
    )}
    <div className="panel report-table-panel">
      <div className="panel-head"><div><h2>{reportTitle} {t.records}</h2><p className="muted">{t.recordCount.replace('{count}', String(totalEntries))}</p></div></div>
      <div className="table-wrap"><table>
        <thead><tr>{visibleColumns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
        <tbody>
          {report?.rows?.length ? report.rows.map((row, index) => <tr key={row._id || row.invoiceNo || row.returnNo || row.receiptNo || row.expenseNo || index}>
            {visibleColumns.map(([key]) => <td key={key}>
              {key === 'date' && row[key]
                ? new Date(row[key]).toLocaleString(locale)
                : moneyKeys.has(key)
                  ? money(row[key])
                  : translateReportValue(key, row[key], t) ?? '—'}
            </td>)}
          </tr>) : <tr><td colSpan={visibleColumns.length} className="empty-cell">{loading ? t.reportLoading : t.noRecordsPeriod}</td></tr>}
        </tbody>
      </table></div>
    </div>
    <p className="muted report-footnote">{t.reportFootnote}</p>
  </div>;
}
