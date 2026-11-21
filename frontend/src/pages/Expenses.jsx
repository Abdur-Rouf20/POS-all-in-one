import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { api } from '../services/api.js';

const categories = ['Shop rent', 'Electricity', 'Internet', 'Utilities', 'Snacks', 'Transport', 'Maintenance', 'Packaging', 'Other'];
const categoryKeys = {
  'Shop rent': 'shopRent', Electricity: 'electricity', Internet: 'internet',
  Utilities: 'utilities', Snacks: 'snacks', Transport: 'transport',
  Maintenance: 'maintenance', Packaging: 'packaging', Other: 'other'
};
const today = new Date().toISOString().slice(0, 10);
const blank = { category: 'Shop rent', description: '', amount: '', paymentMethod: 'cash', cashAmount: '', banglaQrAmount: '', expenseDate: today };

export default function Expenses({ settings, t, lang }) {
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
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const fmt = value => `${currency} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const categoryName = name => t[categoryKeys[name]] || name;

  async function load() {
    setLoading(true);
    try {
      const result = await api.expenses({ category: categoryFilter, from, to });
      setRows(result.rows || []);
      setSummary(result.summary || { total: 0, cashTotal: 0, banglaQrTotal: 0, count: 0, byCategory: {} });
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [categoryFilter, from, to]);

  const amount = Number(form.amount || 0);
  const cash = form.paymentMethod === 'cash' ? amount : form.paymentMethod === 'mixed' ? Number(form.cashAmount || 0) : 0;
  const qr = form.paymentMethod === 'bangla_qr' ? amount : form.paymentMethod === 'mixed' ? Number(form.banglaQrAmount || 0) : 0;
  const matches = amount > 0 && Math.round((cash + qr) * 100) === Math.round(amount * 100) &&
    (form.paymentMethod !== 'mixed' || (cash > 0 && qr > 0));

  function startCreate() {
    setEditingId('');
    setForm(blank);
    setShowForm(true);
    setError('');
    setMessage('');
  }
  function startEdit(row) {
    setEditingId(row._id);
    setForm({
      category: row.category, description: row.description || '', amount: String(row.amount),
      paymentMethod: row.paymentMethod, cashAmount: String(row.cashAmount || ''),
      banglaQrAmount: String(row.banglaQrAmount || ''),
      expenseDate: new Date(row.expenseDate).toISOString().slice(0, 10)
    });
    setShowForm(true);
    setError('');
    setMessage('');
  }
  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!matches) {
      setError(t.expensePaymentMismatch);
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, amount, cashAmount: cash, banglaQrAmount: qr };
      if (editingId) await api.updateExpense(editingId, body);
      else await api.createExpense(body);
      setMessage(editingId ? t.expenseUpdated : t.expenseRecorded);
      setShowForm(false);
      setEditingId('');
      setForm(blank);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  async function remove(row) {
    if (!window.confirm(t.deleteConfirm.replace('{number}', row.expenseNo))) return;
    setError('');
    setMessage('');
    try {
      await api.deleteExpense(row._id);
      setMessage(t.expenseDeleted.replace('{number}', row.expenseNo));
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (!isOwner) return <section className="panel"><div className="panel-head"><div><h2>{t.accessRestricted}</h2><p className="muted">{t.onlyOwnerExpenses}</p></div></div></section>;

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{t.shopOperatingCosts}</div><h1>{t.expenseTracker}</h1><p className="muted">{t.expenseHint}</p></div>
      <div className="heading-actions"><button className="button secondary" onClick={() => window.print()}>{t.printReport}</button><button className="button primary" onClick={startCreate}><Plus size={16}/>{t.newExpense}</button></div>
    </div>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    <div className="stats-grid">
      <div className="stat-card"><span className="stat-label">{t.totalExpenses}</span><div className="stat-value">{fmt(summary.total)}</div><span className="stat-caption">{summary.count} {t.recordsInFilter}</span></div>
      <div className="stat-card"><span className="stat-label">{t.cashExpenses}</span><div className="stat-value">{fmt(summary.cashTotal)}</div><span className="stat-caption">{t.paidInCash}</span></div>
      <div className="stat-card"><span className="stat-label">{t.qrExpenses}</span><div className="stat-value">{fmt(summary.banglaQrTotal)}</div><span className="stat-caption">{t.paidByQr}</span></div>
      <div className="stat-card"><span className="stat-label">{t.expenseRecords}</span><div className="stat-value">{summary.count}</div><span className="stat-caption">{t.selectedBranchDates}</span></div>
    </div>
    {showForm && <section className="panel form-panel">
      <div className="panel-title"><div><h2>{editingId ? t.editExpense : t.recordNewExpense}</h2><p className="muted">{t.expenseBranchHint}</p></div><button type="button" className="button secondary compact" onClick={() => setShowForm(false)}><X size={15}/>{t.close}</button></div>
      <form onSubmit={submit} className="form-grid three">
        <div className="field"><label>{t.expenseCategory} *</label><select required value={form.category} onChange={event => setForm(value => ({ ...value, category: event.target.value }))}>{categories.map(item => <option key={item} value={item}>{categoryName(item)}</option>)}</select></div>
        <div className="field"><label>{t.expenseAmount} *</label><input type="number" min="0.01" step="0.01" required value={form.amount} onChange={event => setForm(value => ({ ...value, amount: event.target.value }))}/></div>
        <div className="field"><label>{t.expenseDate} *</label><input type="date" required value={form.expenseDate} onChange={event => setForm(value => ({ ...value, expenseDate: event.target.value }))}/></div>
        <div className="field"><label>{t.paymentMethod} *</label><select value={form.paymentMethod} onChange={event => setForm(value => ({ ...value, paymentMethod: event.target.value, cashAmount: '', banglaQrAmount: '' }))}><option value="cash">{t.cash}</option><option value="bangla_qr">{t.banglaQr}</option><option value="mixed">{t.mixedPayment}</option></select></div>
        {form.paymentMethod === 'mixed' && <>
          <div className="field"><label>{t.cashAmount} *</label><input type="number" min="0" step="0.01" value={form.cashAmount} onChange={event => setForm(value => ({ ...value, cashAmount: event.target.value }))}/></div>
          <div className="field"><label>{t.qrAmount} *</label><input type="number" min="0" step="0.01" value={form.banglaQrAmount} onChange={event => setForm(value => ({ ...value, banglaQrAmount: event.target.value }))}/></div>
        </>}
        <div className="field"><label>{t.descriptionNote}</label><input maxLength="500" value={form.description} onChange={event => setForm(value => ({ ...value, description: event.target.value }))} placeholder={t.optionalDetails}/></div>
        <div className="form-actions"><button className="button primary" disabled={saving || !matches}>{saving ? t.saving : editingId ? t.saveChanges : t.recordExpense}</button></div>
        {!matches && <p className="field-help">{t.paymentSplitExpenseHint}</p>}
      </form>
    </section>}
    <section className="panel">
      <div className="toolbar"><div><strong>{t.expenseHistory}</strong></div><span className="count-pill">{rows.length} {t.records}</span></div>
      <div className="toolbar expense-filters">
        <div className="field"><label>{t.expenseCategory}</label><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">{t.allCategories}</option>{categories.map(item => <option key={item} value={item}>{categoryName(item)}</option>)}</select></div>
        <div className="field"><label>{t.from}</label><input type="date" value={from} onChange={event => setFrom(event.target.value)}/></div>
        <div className="field"><label>{t.to}</label><input type="date" value={to} onChange={event => setTo(event.target.value)}/></div>
        <button className="button secondary compact" onClick={() => { setCategoryFilter(''); setFrom(''); setTo(''); }}>{t.clearFilters}</button>
      </div>
      <div className="table-wrap"><table><thead><tr><th>{t.expenseNumber}</th><th>{t.date}</th><th>{t.expenseCategory}</th><th>{t.description}</th><th>{t.payment}</th><th className="right">{t.cash}</th><th className="right">{t.banglaQr}</th><th className="right">{t.total}</th><th>{t.recordedBy}</th><th>{t.actions}</th></tr></thead><tbody>
        {rows.map(row => <tr key={row._id}><td><strong>{row.expenseNo}</strong></td><td>{new Date(row.expenseDate).toLocaleDateString(locale)}</td><td>{categoryName(row.category)}</td><td>{row.description || '—'}</td><td>{row.paymentMethod === 'mixed' ? t.mixedPayment : row.paymentMethod === 'bangla_qr' ? t.banglaQr : t.cash}</td><td className="right">{fmt(row.cashAmount)}</td><td className="right">{fmt(row.banglaQrAmount)}</td><td className="right amount">{fmt(row.amount)}</td><td>{row.createdBy?.name || '—'}</td><td><div className="heading-actions"><button className="button secondary compact" onClick={() => startEdit(row)} title={t.edit} aria-label={t.edit}><Pencil size={14}/></button><button className="button secondary compact" onClick={() => remove(row)} title={t.delete} aria-label={t.delete}><Trash2 size={14}/></button></div></td></tr>)}
        {!loading && !rows.length && <tr><td colSpan="10" className="empty-cell"><Receipt size={24}/><p>{t.noExpensesFilter}</p></td></tr>}
        {loading && <tr><td colSpan="10" className="empty-cell">{t.loadingExpenses}</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
