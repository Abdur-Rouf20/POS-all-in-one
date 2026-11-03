import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { api } from '../services/api.js';

const categories = ['Shop rent', 'Electricity', 'Internet', 'Utilities', 'Snacks', 'Transport', 'Maintenance', 'Packaging', 'Other'];
const today = new Date().toISOString().slice(0, 10);
const blank = { category: 'Shop rent', description: '', amount: '', paymentMethod: 'cash', cashAmount: '', banglaQrAmount: '', expenseDate: today };

export default function Expenses({ settings }) {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('pos-user') || 'null'); }
    catch { return null; }
  }, []);
  const isOwner = user?.role === 'owner';
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, cashTotal: 0, banglaQrTotal: 0, count: 0, byCategory: {} });
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const currency = settings?.currency || '৳';
  const fmt = value => `${currency} ${Number(value || 0).toFixed(2)}`;

  async function load() {
    setLoading(true);
    try {
      const result = await api.expenses({ category: categoryFilter, from, to });
      setRows(result.rows || []);
      setSummary(result.summary || { total: 0, cashTotal: 0, banglaQrTotal: 0, count: 0, byCategory: {} });
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [categoryFilter, from, to]);

  const amount = Number(form.amount || 0);
  const cash = form.paymentMethod === 'cash' ? amount : form.paymentMethod === 'mixed' ? Number(form.cashAmount || 0) : 0;
  const qr = form.paymentMethod === 'bangla_qr' ? amount : form.paymentMethod === 'mixed' ? Number(form.banglaQrAmount || 0) : 0;
  const matches = amount > 0 && Math.round((cash + qr) * 100) === Math.round(amount * 100) &&
    (form.paymentMethod !== 'mixed' || (cash > 0 && qr > 0));

  function startCreate() {
    setEditingId(''); setForm(blank); setShowForm(true); setError(''); setMessage('');
  }
  function startEdit(row) {
    setEditingId(row._id);
    setForm({
      category: row.category, description: row.description || '', amount: String(row.amount),
      paymentMethod: row.paymentMethod, cashAmount: String(row.cashAmount || ''),
      banglaQrAmount: String(row.banglaQrAmount || ''), expenseDate: new Date(row.expenseDate).toISOString().slice(0, 10)
    });
    setShowForm(true); setError(''); setMessage('');
  }
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (!matches) { setError('Cash plus Bangla QR must equal the expense amount. For mixed payment, both amounts must be greater than zero.'); return; }
    setSaving(true);
    try {
      const body = { ...form, amount, cashAmount: cash, banglaQrAmount: qr };
      if (editingId) await api.updateExpense(editingId, body);
      else await api.createExpense(body);
      setMessage(editingId ? 'Expense updated successfully.' : 'Expense recorded successfully.');
      setShowForm(false); setEditingId(''); setForm(blank);
      await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }
  async function remove(row) {
    if (!window.confirm(`Delete ${row.expenseNo}? This cannot be undone.`)) return;
    setError(''); setMessage('');
    try { await api.deleteExpense(row._id); setMessage(`${row.expenseNo} deleted.`); await load(); }
    catch (e) { setError(e.message); }
  }

  if (!isOwner) return <section className="panel"><div className="panel-head"><div><h2>Access restricted</h2><p className="muted">Only the Owner can access expense management.</p></div></div></section>;

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">SHOP OPERATING COSTS</div><h1>Expense Tracker</h1><p className="muted">Record and review branch expenses by category, date and payment method.</p></div>
      <div className="heading-actions"><button className="button secondary" onClick={() => window.print()}>Print report</button><button className="button primary" onClick={startCreate}><Plus size={16}/>New expense</button></div>
    </div>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    <div className="stats-grid">
      <div className="stat-card"><span className="stat-label">Total expenses</span><div className="stat-value">{fmt(summary.total)}</div><span className="stat-caption">{summary.count} records in current filter</span></div>
      <div className="stat-card"><span className="stat-label">Cash expenses</span><div className="stat-value">{fmt(summary.cashTotal)}</div><span className="stat-caption">Paid in cash</span></div>
      <div className="stat-card"><span className="stat-label">Bangla QR expenses</span><div className="stat-value">{fmt(summary.banglaQrTotal)}</div><span className="stat-caption">Paid by Bangla QR</span></div>
      <div className="stat-card"><span className="stat-label">Expense records</span><div className="stat-value">{summary.count}</div><span className="stat-caption">Selected branch and date range</span></div>
    </div>
    {showForm && <section className="panel form-panel">
      <div className="panel-title"><div><h2>{editingId ? 'Edit expense' : 'Record new expense'}</h2><p className="muted">Expense records belong to the currently selected branch.</p></div><button type="button" className="button secondary compact" onClick={() => setShowForm(false)}><X size={15}/>Close</button></div>
      <form onSubmit={submit} className="form-grid three">
        <div className="field"><label>Category *</label><select required value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
        <div className="field"><label>Expense amount *</label><input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm(v => ({ ...v, amount: e.target.value }))}/></div>
        <div className="field"><label>Expense date *</label><input type="date" required value={form.expenseDate} onChange={e => setForm(v => ({ ...v, expenseDate: e.target.value }))}/></div>
        <div className="field"><label>Payment method *</label><select value={form.paymentMethod} onChange={e => setForm(v => ({ ...v, paymentMethod: e.target.value, cashAmount: '', banglaQrAmount: '' }))}><option value="cash">Cash</option><option value="bangla_qr">Bangla QR</option><option value="mixed">Mixed payment</option></select></div>
        {form.paymentMethod === 'mixed' && <>
          <div className="field"><label>Cash amount *</label><input type="number" min="0" step="0.01" value={form.cashAmount} onChange={e => setForm(v => ({ ...v, cashAmount: e.target.value }))}/></div>
          <div className="field"><label>Bangla QR amount *</label><input type="number" min="0" step="0.01" value={form.banglaQrAmount} onChange={e => setForm(v => ({ ...v, banglaQrAmount: e.target.value }))}/></div>
        </>}
        <div className="field"><label>Description / note</label><input maxLength="500" value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} placeholder="Optional details"/></div>
        <div className="form-actions"><button className="button primary" disabled={saving || !matches}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Record expense'}</button></div>
        {!matches && <p className="field-help">Payment split must match the expense amount.</p>}
      </form>
    </section>}
    <section className="panel">
      <div className="toolbar"><div><strong>Expense history</strong></div><span className="count-pill">{rows.length} records</span></div>
      <div className="toolbar" style={{ paddingTop: 0, flexWrap: 'wrap' }}>
        <div className="field"><label>Category</label><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></div>
        <div className="field"><label>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)}/></div>
        <div className="field"><label>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)}/></div>
        <button className="button secondary compact" onClick={() => { setCategoryFilter(''); setFrom(''); setTo(''); }}>Clear filters</button>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Expense no.</th><th>Date</th><th>Category</th><th>Description</th><th>Payment</th><th className="right">Cash</th><th className="right">Bangla QR</th><th className="right">Total</th><th>Recorded by</th><th>Actions</th></tr></thead><tbody>
        {rows.map(row => <tr key={row._id}><td><strong>{row.expenseNo}</strong></td><td>{new Date(row.expenseDate).toLocaleDateString()}</td><td>{row.category}</td><td>{row.description || '—'}</td><td>{row.paymentMethod === 'mixed' ? 'Mixed' : row.paymentMethod === 'bangla_qr' ? 'Bangla QR' : 'Cash'}</td><td className="right">{fmt(row.cashAmount)}</td><td className="right">{fmt(row.banglaQrAmount)}</td><td className="right amount">{fmt(row.amount)}</td><td>{row.createdBy?.name || '—'}</td><td><div className="heading-actions"><button className="button secondary compact" onClick={() => startEdit(row)} title="Edit"><Pencil size={14}/></button><button className="button secondary compact" onClick={() => remove(row)} title="Delete"><Trash2 size={14}/></button></div></td></tr>)}
        {!loading && !rows.length && <tr><td colSpan="10" className="empty-cell"><Receipt size={24}/><p>No expenses found for this filter.</p></td></tr>}
        {loading && <tr><td colSpan="10" className="empty-cell">Loading expenses…</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
