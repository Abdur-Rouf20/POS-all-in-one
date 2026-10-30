import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Printer, ReceiptText } from 'lucide-react';
import { api } from '../services/api.js';

const blank = { customerId: '', amount: '', paymentType: 'cash', cashAmount: '', banglaQrAmount: '', note: '' };

export default function MoneyReceipts({ settings }) {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toFixed(2)}`;

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
    api.customers(query).then(data => { if (live) setCustomers(data.slice(0, 8)); }).catch(() => {});
    return () => { live = false; };
  }, [query]);

  const amount = Number(form.amount || 0);
  const cash = form.paymentType === 'cash' ? amount : form.paymentType === 'mixed' ? Number(form.cashAmount || 0) : 0;
  const qr = form.paymentType === 'bangla_qr' ? amount : form.paymentType === 'mixed' ? Number(form.banglaQrAmount || 0) : 0;
  const matches = amount > 0 && Math.round((cash + qr) * 100) === Math.round(amount * 100);

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (!form.customerId) { setError('Select a customer first.'); return; }
    if (!matches) { setError('Cash plus Bangla QR must equal the receipt amount.'); return; }
    setSaving(true);
    try {
      const receipt = await api.createMoneyReceipt({ customerId: form.customerId, amount, cashAmount: cash, banglaQrAmount: qr, note: form.note });
      setMessage(`Money receipt ${receipt.receiptNo} created successfully.`);
      setForm(blank); setQuery(''); setShowForm(false); await load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">CUSTOMER COLLECTIONS</div><h1>Money Receipts</h1><p className="muted">Record customer payments independently of invoices.</p></div>
      <button className="button primary" onClick={() => setShowForm(value => !value)}><Plus size={16}/>{showForm ? 'Close form' : 'New money receipt'}</button>
    </div>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    {showForm && <section className="panel form-panel">
      <h2>Create Money Receipt</h2>
      <form onSubmit={submit} className="form-stack">
        <div className="field"><label>Find customer by phone, name or Customer ID</label><input value={query} onChange={e => { setQuery(e.target.value); setForm(current => ({ ...current, customerId: '' })); }} placeholder="Search customer" /></div>
        {customers.length > 0 && <div className="customer-suggestions">{customers.map(customer => <button type="button" className={`customer-suggestion ${form.customerId === customer._id ? 'selected' : ''}`} key={customer._id} onClick={() => { setForm(current => ({ ...current, customerId: customer._id })); setQuery(`${customer.name} · ${customer.phone}`); setCustomers([]); }}><strong>{customer.name}</strong><span>{customer.phone} · {customer.customerNo}</span></button>)}</div>}
        {form.customerId && <div className="alert success">Customer selected. This receipt will be linked only to this customer, not to an invoice.</div>}
        <div className="form-grid">
          <div className="field"><label>Receipt amount</label><input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm(current => ({ ...current, amount: e.target.value }))}/></div>
          <div className="field"><label>Payment method</label><select value={form.paymentType} onChange={e => setForm(current => ({ ...current, paymentType: e.target.value, cashAmount: '', banglaQrAmount: '' }))}><option value="cash">Cash</option><option value="bangla_qr">Bangla QR</option><option value="mixed">Mixed payment</option></select></div>
        </div>
        {form.paymentType === 'mixed' && <div className="mixed-payment-box">
          <h3>Mixed payment</h3><p className="muted">Example: Customer pays using both methods.</p>
          <div className="form-grid"><div className="field"><label>Cash</label><input type="number" min="0" step="0.01" value={form.cashAmount} onChange={e => setForm(current => ({ ...current, cashAmount: e.target.value }))} placeholder="0.00"/></div><div className="field"><label>Bangla QR</label><input type="number" min="0" step="0.01" value={form.banglaQrAmount} onChange={e => setForm(current => ({ ...current, banglaQrAmount: e.target.value }))} placeholder="0.00"/></div></div>
          <div className="mixed-total"><strong>Total collected</strong><strong>{money(cash + qr)}</strong></div>
          <span className={`payment-match ${matches ? 'valid' : 'invalid'}`}>{matches ? 'Payment amounts match' : `Difference: ${money(amount - cash - qr)}`}</span>
        </div>}
        {form.paymentType !== 'mixed' && <div className="alert success">{form.paymentType === 'cash' ? 'Cash' : 'Bangla QR'} collection: {money(amount)}</div>}
        <div className="field"><label>Note (optional)</label><textarea rows="2" value={form.note} onChange={e => setForm(current => ({ ...current, note: e.target.value }))}/></div>
        <div className="form-actions"><button className="button primary" disabled={saving || !form.customerId || !matches}>{saving ? 'Saving...' : 'Create money receipt'}</button></div>
      </form>
    </section>}
    <section className="panel">
      <div className="toolbar"><div><strong>Receipt history</strong></div><span className="count-pill">{rows.length} receipts</span></div>
      <div className="table-wrap"><table><thead><tr><th>Receipt no.</th><th>Customer</th><th>Date</th><th>Payment method</th><th className="right">Cash</th><th className="right">Bangla QR</th><th className="right">Total</th></tr></thead><tbody>
        {rows.map(row => <tr key={row._id}><td><Link className="invoice-link" to={`/money-receipts/${row._id}`}>{row.receiptNo}</Link></td><td>{row.customerSnapshot?.name}<small className="cell-sub">{row.customerSnapshot?.phone}</small></td><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.paymentType === 'mixed' ? 'Mixed' : row.paymentType === 'bangla_qr' ? 'Bangla QR' : 'Cash'}</td><td className="right">{money(row.cashAmount)}</td><td className="right">{money(row.banglaQrAmount)}</td><td className="right amount">{money(row.amount)}</td></tr>)}
        {!loading && rows.length === 0 && <tr><td colSpan="7" className="empty-cell"><ReceiptText size={24}/><p>No money receipts yet.</p></td></tr>}
        {loading && <tr><td colSpan="7" className="empty-cell">Loading receipts...</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
