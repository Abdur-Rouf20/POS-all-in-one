import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Printer, ReceiptText } from 'lucide-react';
import { api } from '../services/api.js';

const blank = { customerId: '', amount: '', paymentType: 'cash', cashAmount: '', banglaQrAmount: '', note: '' };

export default function MoneyReceipts({ settings, t, lang }) {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  async function load() {
    setLoading(true);
    try { setRows(await api.moneyReceipts()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    let live = true;
    if (!query.trim()) { setCustomers([]); return () => { live = false; }; }
    api.customers(query).then(data => { if (live) setCustomers(data.slice(0, 8)); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [query]);

  const amount = Number(form.amount || 0);
  const cash = form.paymentType === 'cash' ? amount : form.paymentType === 'mixed' ? Number(form.cashAmount || 0) : 0;
  const qr = form.paymentType === 'bangla_qr' ? amount : form.paymentType === 'mixed' ? Number(form.banglaQrAmount || 0) : 0;
  const matches = amount > 0 && Math.round((cash + qr) * 100) === Math.round(amount * 100);

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (!form.customerId) { setError(t.selectCustomerFirst); return; }
    if (!matches) { setError(t.receiptSplitMismatch); return; }
    setSaving(true);
    try {
      const receipt = await api.createMoneyReceipt({ customerId: form.customerId, amount, cashAmount: cash, banglaQrAmount: qr, note: form.note });
      setMessage(t.receiptCreated.replace('{number}', receipt.receiptNo));
      setForm(blank); setQuery(''); setShowForm(false); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{t.customerCollections}</div><h1>{t.navMoneyReceipts}</h1><p className="muted">{t.recordCustomerPayments}</p></div>
      <button className="button primary" onClick={() => setShowForm(value => !value)}><Plus size={16}/>{showForm ? t.closeForm : t.newMoneyReceipt}</button>
    </div>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    {showForm && <section className="panel form-panel">
      <h2>{t.createMoneyReceipt}</h2>
      <form onSubmit={submit} className="form-stack">
        <div className="field"><label>{t.findCustomer}</label><input value={query} onChange={e => { setQuery(e.target.value); setForm(current => ({ ...current, customerId: '' })); }} placeholder={t.searchCustomer} /></div>
        {customers.length > 0 && <div className="customer-suggestions">{customers.map(customer => <button type="button" className={`customer-suggestion ${form.customerId === customer._id ? 'selected' : ''}`} key={customer._id} onClick={() => { setForm(current => ({ ...current, customerId: customer._id })); setQuery(`${customer.name} · ${customer.phone}`); setCustomers([]); }}><strong>{customer.name}</strong><span>{customer.phone} · {customer.customerNo}</span></button>)}</div>}
        {form.customerId && <div className="alert success">{t.customerSelected}</div>}
        <div className="form-grid">
          <div className="field"><label>{t.receiptAmount}</label><input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm(current => ({ ...current, amount: e.target.value }))}/></div>
          <div className="field"><label>{t.paymentMethod}</label><select value={form.paymentType} onChange={e => setForm(current => ({ ...current, paymentType: e.target.value, cashAmount: '', banglaQrAmount: '' }))}><option value="cash">{t.cash}</option><option value="bangla_qr">{t.banglaQr}</option><option value="mixed">{t.mixedPayment}</option></select></div>
        </div>
        {form.paymentType === 'mixed' && <div className="mixed-payment-box">
          <h3>{t.mixedPayment}</h3><p className="muted">{t.exampleMixedPayment}</p>
          <div className="form-grid"><div className="field"><label>{t.cash}</label><input type="number" min="0" step="0.01" value={form.cashAmount} onChange={e => setForm(current => ({ ...current, cashAmount: e.target.value }))} placeholder="0.00"/></div><div className="field"><label>{t.banglaQr}</label><input type="number" min="0" step="0.01" value={form.banglaQrAmount} onChange={e => setForm(current => ({ ...current, banglaQrAmount: e.target.value }))} placeholder="0.00"/></div></div>
          <div className="mixed-total"><strong>{t.totalCollectedLabel}</strong><strong>{money(cash + qr)}</strong></div>
          <span className={`payment-match ${matches ? 'valid' : 'invalid'}`}>{matches ? t.paymentAmountsMatch : `${t.difference}: ${money(amount - cash - qr)}`}</span>
        </div>}
        {form.paymentType !== 'mixed' && <div className="alert success">{form.paymentType === 'cash' ? t.cash : t.banglaQr} · {money(amount)}</div>}
        <div className="field"><label>{t.noteOptional}</label><textarea rows="2" value={form.note} onChange={e => setForm(current => ({ ...current, note: e.target.value }))}/></div>
        <div className="form-actions"><button className="button primary" disabled={saving || !form.customerId || !matches}>{saving ? t.saving : t.createMoneyReceipt}</button></div>
      </form>
    </section>}
    <section className="panel">
      <div className="toolbar"><div><strong>{t.receiptHistory}</strong></div><span className="count-pill">{t.receiptCount.replace('{count}', String(rows.length))}</span></div>
      <div className="table-wrap"><table><thead><tr><th>{t.receiptNumber}</th><th>{t.customer}</th><th>{t.date}</th><th>{t.paymentMethodLabel}</th><th className="right">{t.cash}</th><th className="right">{t.banglaQr}</th><th className="right">{t.total}</th></tr></thead><tbody>
        {rows.map(row => <tr key={row._id}><td><Link className="invoice-link" to={`/money-receipts/${row._id}`}>{row.receiptNo}</Link></td><td>{row.customerSnapshot?.name}<small className="cell-sub">{row.customerSnapshot?.phone}</small></td><td>{new Date(row.createdAt).toLocaleString(locale)}</td><td>{row.paymentType === 'mixed' ? t.mixedPayment : row.paymentType === 'bangla_qr' ? t.banglaQr : t.cash}</td><td className="right">{money(row.cashAmount)}</td><td className="right">{money(row.banglaQrAmount)}</td><td className="right amount">{money(row.amount)}</td></tr>)}
        {!loading && rows.length === 0 && <tr><td colSpan="7" className="empty-cell"><ReceiptText size={24}/><p>{t.noReceipts}</p></td></tr>}
        {loading && <tr><td colSpan="7" className="empty-cell">{t.loadingReceipts}</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
