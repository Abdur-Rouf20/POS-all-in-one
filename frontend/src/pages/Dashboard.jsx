import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, AlertTriangle, Banknote, BarChart3, Boxes, Download,
  Package, Printer, ReceiptText, RotateCcw, TrendingUp, Wallet
} from 'lucide-react';
import { api } from '../services/api.js';
import StatCard from '../components/StatCard.jsx';

function csvValue(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportDashboard(data, from, to, owner, t) {
  if (!data) return;
  const rows = [
    [t.metric, t.value], [t.from, from], [t.to, to],
    [t.netSales, data.netRevenue], [t.invoiceCount, data.invoiceCount],
    [t.productCount, data.products], [t.lowStock, data.lowStock],
    [t.customerDue, data.totalDue], [t.returnsMetric, data.returns],
    [t.cashCollected, data.cashCollected], [t.banglaQrCollected, data.qrCollected]
  ];
  if (owner) rows.push(
    [t.grossProfit, data.grossProfit], [t.expenses, data.expenses],
    [t.netProfit, data.netProfit], [t.stockCostValue, data.stockCostValue],
    [t.stockRetailValue, data.stockRetailValue], [t.stockQuantity, data.stockQty]
  );
  rows.push([], [t.topProductPerformance, t.quantity, t.sales]);
  for (const product of data.productPerformance || []) {
    rows.push([product.name, product.quantity, product.sales]);
  }
  if (owner && data.branchComparison?.length) {
    rows.push([], [t.branch, t.sales, t.returnsMetric, t.expenses, t.netSales]);
    for (const branch of data.branchComparison) {
      rows.push([branch.name, branch.sales, branch.returns, branch.expenses, branch.netRevenue]);
    }
  }
  const csv = rows.map(row => row.map(csvValue).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pos-dashboard-${from}-to-${to}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);
const month = () => {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
};
const year = () => `${new Date().getFullYear()}-01-01`;
const categoryKeys = {
  'Shop rent': 'shopRent', Electricity: 'electricity', Internet: 'internet',
  Utilities: 'utilities', Snacks: 'snacks', Transport: 'transport',
  Maintenance: 'maintenance', Packaging: 'packaging', Other: 'other'
};

export default function Dashboard({ t, settings, lang }) {
  const user = JSON.parse(localStorage.getItem('pos-user') || 'null');
  const owner = user?.role === 'owner';
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState(month());
  const [to, setTo] = useState(today());
  const [all, setAll] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const stat = (label, value, caption, icon, tone) => (
    <StatCard key={label} label={label} value={value} caption={caption} icon={icon} tone={tone}/>
  );
  const max = Math.max(1, ...(data?.productPerformance || []).map(row => row.sales));

  useEffect(() => {
    if (preset === 'today') {
      setFrom(today());
      setTo(today());
    } else if (preset === 'yesterday') {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      const value = date.toISOString().slice(0, 10);
      setFrom(value);
      setTo(value);
    } else if (preset === 'month') {
      setFrom(month());
      setTo(today());
    } else if (preset === 'year') {
      setFrom(year());
      setTo(today());
    }
  }, [preset]);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.dashboard({ from, to, allBranches: owner && all })
      .then(setData)
      .catch(requestError => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [from, to, all]);

  return <>
    <div className="page-heading no-print">
      <div>
        <div className="eyebrow">{t.dashboardAnalytics}</div>
        <h1>{t.welcome}</h1>
        <p className="muted">{settings?.businessName || 'My POS Store'} · {from} {t.to} {to}</p>
      </div>
      <div className="dashboard-actions">
        <button className="button secondary" onClick={() => exportDashboard(data, from, to, owner, t)} disabled={!data}><Download size={16}/> {t.exportCsv}</button>
        <button className="button secondary" onClick={() => window.print()} disabled={!data}><Printer size={16}/> {t.print}</button>
        <Link className="button primary" to="/invoices/new">＋ {t.newInvoice}</Link>
      </div>
    </div>
    <div className="panel no-print dashboard-filter-panel" style={{ marginBottom: 18 }}>
      <div className="panel-head">
        <div><h2>{t.reportFilters}</h2><p className="muted">{t.dateRangeBranch}</p></div>
        {loading && <span className="muted">{t.updating}</span>}
      </div>
      <div className="dashboard-filter-grid">
        <div className="field">
          <label htmlFor="dashboard-period">{t.period}</label>
          <select id="dashboard-period" value={preset} onChange={event => setPreset(event.target.value)}>
            <option value="today">{t.today}</option><option value="yesterday">{t.yesterday}</option>
            <option value="month">{t.thisMonth}</option><option value="year">{t.thisYear}</option>
            <option value="custom">{t.custom}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="dashboard-from">{t.from}</label>
          <input id="dashboard-from" type="date" value={from} onChange={event => { setPreset('custom'); setFrom(event.target.value); }}/>
        </div>
        <div className="field">
          <label htmlFor="dashboard-to">{t.to}</label>
          <input id="dashboard-to" type="date" value={to} onChange={event => { setPreset('custom'); setTo(event.target.value); }}/>
        </div>
        {owner && <label className="dashboard-all-branches"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)}/> {t.allBranchesOption}</label>}
      </div>
    </div>
    {error && <div className="alert error">{error}</div>}
    <div className="dashboard-print-header">
      <h1>{settings?.businessName || 'My POS Store'} — {t.dashboardReport}</h1>
      <p>{from} {t.to} {to}</p>
    </div>
    <div className="stats-grid">
      {stat(t.netSales, money(data?.netRevenue), t.invoiceTotalsLessReturns, Banknote, 'green')}
      {stat(t.invoiceCount, data?.invoiceCount ?? '—', t.inSelectedPeriod, ReceiptText, 'violet')}
      {stat(t.productCount, data?.products ?? '—', t.activeCatalog, Package, 'blue')}
      {stat(t.lowStock, data?.lowStock ?? '—', t.lowStockUnits, AlertTriangle, 'orange')}
      {stat(t.customerDue, money(data?.totalDue), t.dueInPeriod, Wallet, 'orange')}
      {stat(t.returnsMetric, money(data?.returns), t.refundValue, RotateCcw, 'violet')}
    </div>
    {owner && <>
      <div className="stats-grid" style={{ marginTop: 14 }}>
        {stat(t.grossProfit, money(data?.grossProfit), t.afterCostOfGoods, TrendingUp, 'green')}
        {stat(t.expenses, money(data?.expenses), t.recordedShopExpenses, Wallet, 'orange')}
        {stat(t.netProfit, money(data?.netProfit), t.lessExpenses, BarChart3, 'blue')}
        {stat(t.stockCostValue, money(data?.stockCostValue), t.confirmedPurchaseCosts, Boxes, 'violet')}
        {stat(t.stockRetailValue, money(data?.stockRetailValue), t.currentSellingValue, Package, 'blue')}
        {stat(t.stockQuantity, data?.stockQty ?? 0, t.currentUnits, Boxes, 'green')}
      </div>
      {data?.costCoverage?.unknownCostQuantity > 0 && (
        <div className="alert" style={{ marginTop: 12 }}>
          {t.partialProfit.replace('{count}', data.costCoverage.unknownCostQuantity)}
        </div>
      )}
      <div className="dashboard-quick-grid" style={{ marginTop: 18 }}>
        <div className="panel dashboard-content-panel">
          <div className="dashboard-card-heading"><h2>{t.paymentCollection}</h2><p className="muted">{t.initialPaymentsReceipts}</p></div>
          <div className="dashboard-metric-list">
            <div className="dashboard-metric-line"><span>{t.cash}</span><b>{money(data?.cashCollected)}</b></div>
            <div className="dashboard-metric-line"><span>{t.banglaQr}</span><b>{money(data?.qrCollected)}</b></div>
          </div>
        </div>
        <div className="panel dashboard-content-panel">
          <div className="dashboard-card-heading"><h2>{t.expenseCategories}</h2></div>
          {Object.entries(data?.expenseByCategory || {}).length
            ? <div className="dashboard-metric-list">{Object.entries(data.expenseByCategory).map(([name, value]) => (
              <div className="dashboard-metric-line" key={name}><span>{t[categoryKeys[name]] || name}</span><b>{money(value)}</b></div>
            ))}</div>
            : <p className="muted">{t.noExpensesPeriod}</p>}
          <Link className="text-link dashboard-manage-link" to="/expenses">{t.manageExpenses} <ArrowUpRight size={15}/></Link>
        </div>
      </div>
      {data?.branchComparison?.length > 0 && (
        <div className="panel dashboard-content-panel dashboard-branch-panel" style={{ marginTop: 18 }}>
          <div className="dashboard-card-heading"><h2>{t.branchComparison}</h2></div>
          <div className="dashboard-branch-list">
            {data.branchComparison.map(branch => (
              <div key={branch.branchId} className="branch-performance">
                <div className="dashboard-metric-line"><span>{branch.name}</span><b>{money(branch.netRevenue)}</b></div>
                <div className="performance-track"><div style={{ width: `${Math.max(0, branch.netRevenue) / Math.max(1, ...data.branchComparison.map(item => item.netRevenue)) * 100}%` }}/></div>
                <small className="muted">{t.branchSummary
                  .replace('{sales}', money(branch.sales))
                  .replace('{returns}', money(branch.returns))
                  .replace('{expenses}', money(branch.expenses))}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </>}
    <div className="panel dashboard-content-panel dashboard-performance-panel" style={{ marginTop: 18 }}>
      <div className="dashboard-card-heading"><h2>{t.topProductPerformance}</h2></div>
      {data?.productPerformance?.length
        ? <div className="dashboard-performance-grid">{data.productPerformance.map(product => (
          <div key={product.name} className="dashboard-performance-card">
            <div className="dashboard-metric-line"><span>{product.name} · {product.quantity} {t.units}</span><b>{money(product.sales)}</b></div>
            <div className="performance-track"><div style={{ width: `${Math.max(0, product.sales) / max * 100}%` }}/></div>
            {owner && <small className="muted">{t.grossProfitEstimate.replace('{amount}', money(product.profit))}</small>}
          </div>
        ))}</div>
        : <p className="muted">{t.noSalesPeriod}</p>}
    </div>
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panel-head">
        <div><h2>{t.recentInvoices}</h2><p className="muted">{t.latestTransactions}</p></div>
        <Link className="text-link" to="/invoices">{t.viewAll} <ArrowUpRight size={15}/></Link>
      </div>
      <div className="table-wrap">
        <table><thead><tr><th>{t.invoice}</th><th>{t.customer}</th><th>{t.date}</th><th>{t.status}</th><th className="right">{t.total}</th></tr></thead>
          <tbody>
            {data?.latestInvoices?.length
              ? data.latestInvoices.map(invoice => (
                <tr key={invoice._id}>
                  <td><Link className="invoice-link" to={`/invoices/${invoice._id}`}>{invoice.invoiceNo}</Link></td>
                  <td>{invoice.customerName || t.walkInCustomer}</td>
                  <td>{invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString(locale) : '—'}</td>
                  <td>{t[invoice.paymentStatus || invoice.status] || t.unpaid}</td>
                  <td className="right amount">{money(invoice.total)}</td>
                </tr>
              ))
              : <tr><td colSpan="5" className="empty-cell">{t.noInvoicesYet}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </>;
}
