import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { Download, Printer, RefreshCw } from 'lucide-react';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const monthStart = () => `${today().slice(0,7)}-01`;
const columns = {
  sales: [
    ['date','Date'],['invoiceNo','Invoice'],['branch','Branch'],['customer','Customer'],
    ['itemCount','Items'],['quantity','Qty'],['total','Total'],['paid','Paid'],['due','Due'],['paymentStatus','Status']
  ],
  returns: [
    ['date','Date'],['returnNo','Return'],['invoiceNo','Invoice'],['branch','Branch'],['customer','Customer'],
    ['quantity','Qty'],['refund','Refund'],['settlement','Settlement'],['refundMethod','Refund method'],['processedBy','Processed by']
  ],
  receipts: [
    ['date','Date'],['receiptNo','Receipt'],['branch','Branch'],['customer','Customer'],['phone','Phone'],
    ['amount','Amount'],['cash','Cash'],['banglaQr','Bangla QR'],['paymentType','Method'],['receivedBy','Received by']
  ],
  expenses: [
    ['date','Date'],['expenseNo','Expense'],['branch','Branch'],['category','Category'],['description','Description'],
    ['amount','Amount'],['cash','Cash'],['banglaQr','Bangla QR'],['paymentMethod','Method'],['createdBy','Created by']
  ],
  inventory: [
    ['branch','Branch'],['product','Product'],['sku','SKU'],['quantity','Stock qty'],['batchCount','Batches']
  ]
};

function csvCell(value) {
  const raw = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}
function downloadCsv(filename, rows, keys) {
  const content = [keys.map(([,label]) => csvCell(label)).join(','), ...rows.map(row => keys.map(([key]) => csvCell(row[key])).join(','))].join('\r\n');
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

export default function Reports({ settings, user }) {
  const owner = user?.role === 'owner';
  const [type, setType] = useState('sales');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [allBranches, setAllBranches] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const money = n => `${settings?.currency || '৳'} ${Number(n || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const visibleColumns = useMemo(() => {
    const base = columns[type] || [];
    if (type === 'sales' && owner) return [...base, ['knownCost','Known cost'],['knownGrossProfit','Known gross profit'],['costCoverage','Cost coverage']];
    if (type === 'inventory' && owner) return [...base, ['confirmedCostValue','Confirmed cost value'],['retailValue','Retail value'],['knownCostQuantity','Known-cost qty'],['unknownCostQuantity','Unknown-cost qty']];
    return base;
  }, [type, owner]);

  async function load() {
    setLoading(true); setError('');
    try {
      const result = await api.report(type, { from, to, allBranches: owner && allBranches });
      setReport(result);
    } catch (e) {
      setError(e.message || 'Could not load report.');
      setReport(null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [type, from, to, allBranches]);

  function exportReport() {
    if (!report) return;
    const safeRows = report.rows.map(row => ({
      ...row,
      date: row.date ? new Date(row.date).toLocaleString() : ''
    }));
    downloadCsv(`pos-${type}-report-${from}-to-${to}.csv`, safeRows, visibleColumns);
  }
  const totalEntries = report?.rows?.length || 0;
  const summaryEntries = report?.totals ? Object.entries(report.totals).filter(([key,value]) => typeof value === 'number') : [];

  return <div className="reports-page">
    <div className="page-heading no-print">
      <div><div className="eyebrow">BUSINESS REPORTING</div><h1>Reports</h1><p className="muted">Filter, export and print operational and financial records.</p></div>
      <div className="report-actions">
        <button className="button secondary" onClick={exportReport} disabled={!report || loading}><Download size={16}/> Export CSV</button>
        <button className="button primary" onClick={() => window.print()} disabled={!report}><Printer size={16}/> Print report</button>
      </div>
    </div>
    <div className="panel no-print" style={{marginBottom:18}}>
      <div className="panel-head"><div><h2>Report filters</h2><p className="muted">Choose report type, period and branch scope.</p></div>{loading&&<span className="muted">Loading…</span>}</div>
      <div className="report-filter-grid">
        <label>Report type<select value={type} onChange={e=>setType(e.target.value)}>
          <option value="sales">Sales</option><option value="returns">Sales returns</option><option value="receipts">Money receipts</option>
          {owner&&<option value="expenses">Expenses</option>}<option value="inventory">Inventory</option>
        </select></label>
        <label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
        {owner&&<label className="report-all-branches"><input type="checkbox" checked={allBranches} onChange={e=>setAllBranches(e.target.checked)}/> All branches</label>}
        <button className="button secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
      </div>
    </div>
    {error&&<div className="alert error no-print">{error}</div>}
    <div className="report-print-header">
      <h1>{settings?.businessName || 'POS Business'} — {type[0].toUpperCase()+type.slice(1)} Report</h1>
      <p>{from} to {to} · {report?.branchScope === 'all' ? 'All branches' : 'Selected / assigned branch'}</p>
      <p>Generated: {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'}</p>
    </div>
    <div className="stats-grid report-summary">
      {summaryEntries.map(([key,value])=><div className="stat-card" key={key}><span className="stat-label">{key.replace(/([A-Z])/g,' $1')}</span><strong>{['sales','paid','due','refund','amount','cash','banglaQr','knownCost','knownGrossProfit','confirmedCostValue','retailValue'].includes(key)?money(value):Number(value).toLocaleString()}</strong></div>)}
    </div>
    {report?.totals?.note&&<p className="alert">{report.totals.note}</p>}
    {type==='expenses'&&report?.totals?.byCategory&&<div className="panel report-categories"><h2>Expense categories</h2>{Object.entries(report.totals.byCategory).map(([name,value])=><div className="metric-line" key={name}><span>{name}</span><b>{money(value)}</b></div>)}</div>}
    <div className="panel report-table-panel">
      <div className="panel-head"><div><h2>{type[0].toUpperCase()+type.slice(1)} records</h2><p className="muted">{totalEntries} record(s)</p></div></div>
      <div className="table-wrap"><table><thead><tr>{visibleColumns.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead>
      <tbody>{report?.rows?.length ? report.rows.map((row,index)=><tr key={row._id||row.invoiceNo||row.returnNo||row.receiptNo||row.expenseNo||`${index}`}>
        {visibleColumns.map(([key])=><td key={key}>{key==='date'&&row[key]?new Date(row[key]).toLocaleString():['total','paid','due','refund','amount','cash','banglaQr','knownCost','knownGrossProfit','confirmedCostValue','retailValue'].includes(key)?money(row[key]):row[key]??'—'}</td>)}
      </tr>):<tr><td colSpan={visibleColumns.length} className="empty-cell">{loading?'Loading report…':'No records found for this period.'}</td></tr>}</tbody></table></div>
    </div>
    <p className="muted report-footnote">Reports reflect records currently stored in the POS database. Inventory is a current snapshot; its date filters do not change stock quantities.</p>
  </div>;
}
