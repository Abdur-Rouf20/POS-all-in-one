import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { api } from '../services/api.js';

const blankItem = () => ({ product: '', name: '', sku: '', quantity: 1, unitPrice: 0 });
const initialForm = settings => ({
  customerName: '', customerPhone: '', customerAddress: '', items: [blankItem()],
  discount: 0, taxRate: settings?.taxRate || 0, notes: '', invoiceDate: new Date().toISOString().slice(0, 10),
  paidAmount: '', paymentType: 'cash', cashAmount: '', banglaQrAmount: ''
});

export default function InvoiceForm({ t, settings }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(() => initialForm(settings));
  const [error, setError] = useState('');
  const [customerMessage, setCustomerMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.inventory().then(rows => setProducts(rows.filter(row => row.productId).map(row => ({ ...row.productId, branchQuantity: row.quantity })))).catch(e => setError(e.message));
    if (id) api.invoice(id).then(invoice => setForm({
      ...initialForm(settings), ...invoice,
      invoiceDate: new Date(invoice.invoiceDate).toISOString().slice(0, 10),
      items: invoice.items.map(item => ({ ...item, product: item.product || '' })),
      paidAmount: String(invoice.paidAmount || 0),
      paymentType: invoice.paymentType || 'cash',
      cashAmount: String(invoice.cashAmount || 0), banglaQrAmount: String(invoice.banglaQrAmount || 0)
    })).catch(e => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!id && settings?.taxRate !== undefined) setForm(current => ({ ...current, taxRate: current.taxRate || settings.taxRate }));
  }, [settings?.taxRate, id]);

  const subtotal = useMemo(() => form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0), [form.items]);
  const discount = Math.max(0, Number(form.discount) || 0);
  const taxAmount = Math.max(0, subtotal - discount) * Math.max(0, Number(form.taxRate) || 0) / 100;
  const total = Math.max(0, subtotal - discount + taxAmount);
  const paidAmount = form.paidAmount === '' ? total : Math.max(0, Number(form.paidAmount) || 0);
  const cashAmount = form.paymentType === 'cash' ? paidAmount : form.paymentType === 'mixed' ? Number(form.cashAmount || 0) : 0;
  const banglaQrAmount = form.paymentType === 'bangla_qr' ? paidAmount : form.paymentType === 'mixed' ? Number(form.banglaQrAmount || 0) : 0;
  const paymentMatches = Math.round((cashAmount + banglaQrAmount) * 100) === Math.round(paidAmount * 100);
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toFixed(2)}`;

  function updateItem(index, key, value) {
    setForm(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  }
  function chooseProduct(index, productId) {
    const product = products.find(item => item._id === productId);
    setForm(current => ({ ...current, items: current.items.map((item, i) => i === index ? (product ? { ...item, product: product._id, name: product.name, sku: product.sku || '', unitPrice: product.price } : blankItem()) : item) }));
  }
  async function lookupCustomer() {
    const phone = form.customerPhone.trim();
    if (!phone) return;
    try {
      const result = await api.findCustomer(phone);
      if (result.found) {
        setForm(current => ({ ...current, customerName: result.customer.name, customerPhone: result.customer.phone, customerAddress: result.customer.address || '' }));
        setCustomerMessage(`Existing customer found: ${result.customer.customerNo}`);
      } else setCustomerMessage('New customer. A customer profile will be created when this invoice is saved.');
    } catch (e) { setCustomerMessage(e.message); }
  }
  async function save(event) {
    event.preventDefault(); setError('');
    if (!form.items.length || form.items.some(item => !item.name || Number(item.quantity) <= 0)) { setError(t.noItems); return; }
    if (!form.customerName.trim() || !form.customerPhone.trim()) { setError('Customer name and phone number are required.'); return; }
    if (paidAmount > total) { setError('Initial payment cannot exceed invoice total.'); return; }
    if (!paymentMatches) { setError('Cash plus Bangla QR must equal the initial payment amount.'); return; }
    setBusy(true);
    try {
      const body = {
        ...form,
        items: form.items.map(item => ({ ...item, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
        discount: Number(form.discount) || 0, taxRate: Number(form.taxRate) || 0,
        paidAmount, cashAmount, banglaQrAmount
      };
      const saved = id ? await api.updateInvoice(id, body) : await api.createInvoice(body);
      navigate(`/invoices/${saved._id}`);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><button className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={16}/>{t.back}</button><h1>{id ? t.editInvoice : t.createInvoice}</h1><p className="muted">Customer details, items and initial payment.</p></div></div>
    {error && <div className="alert error">{error}</div>}
    <form onSubmit={save} className="invoice-layout">
      <div className="form-main">
        <section className="panel form-panel">
          <div className="panel-title"><span className="section-number">01</span><div><h2>{t.customer}</h2><p className="muted">Customer is identified by phone number.</p></div></div>
          <div className="form-grid three">
            <div className="field"><label>Customer phone *</label><input value={form.customerPhone || ''} onChange={e => setForm(current => ({ ...current, customerPhone: e.target.value }))} onBlur={lookupCustomer} placeholder="01XXXXXXXXX" required /></div>
            <div className="field"><label>Customer name *</label><input value={form.customerName || ''} onChange={e => setForm(current => ({ ...current, customerName: e.target.value }))} required /></div>
            <div className="field"><label>{t.invoiceDate}</label><input type="date" value={form.invoiceDate} onChange={e => setForm(current => ({ ...current, invoiceDate: e.target.value }))}/></div>
            <div className="field span-all"><label>{t.customerAddress}</label><input value={form.customerAddress || ''} onChange={e => setForm(current => ({ ...current, customerAddress: e.target.value }))}/></div>
          </div>
          {customerMessage && <p className="field-help">{customerMessage}</p>}
        </section>
        <section className="panel form-panel">
          <div className="panel-title"><span className="section-number">02</span><div><h2>{t.items}</h2><p className="muted">Choose products available in this branch.</p></div><button type="button" className="button secondary compact push-right" onClick={() => setForm(current => ({ ...current, items: [...current.items, blankItem()] }))}><Plus size={15}/>{t.addItem}</button></div>
          <div className="invoice-items">{form.items.map((item, index) => <div className="invoice-item" key={index}>
            <div className="item-index">{String(index + 1).padStart(2, '0')}</div>
            <div className="field item-product"><label>{t.product}</label><select value={item.product || ''} onChange={e => chooseProduct(index, e.target.value)}><option value="">{t.chooseProduct}</option>{products.map(product => <option key={product._id} value={product._id}>{product.name}{product.sku ? ` · ${product.sku}` : ''} · Stock: {product.branchQuantity}</option>)}</select></div>
            <div className="field item-qty"><label>{t.quantity}</label><input type="number" min="0.01" step="0.01" required value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)}/></div>
            <div className="field item-price"><label>{t.price}</label><input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={e => updateItem(index, 'unitPrice', e.target.value)}/></div>
            <div className="item-total"><small>{t.total}</small><strong>{money(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</strong></div>
            <button type="button" className="icon-button danger remove-item" disabled={form.items.length === 1} onClick={() => setForm(current => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}><Trash2 size={16}/></button>
          </div>)}</div>
        </section>
        <section className="panel form-panel">
          <div className="panel-title"><span className="section-number">03</span><div><h2>Initial payment</h2><p className="muted">No further payments will be collected against this invoice after creation.</p></div></div>
          <div className="form-grid three">
            <div className="field"><label>Amount paid now</label><input type="number" min="0" max={total} step="0.01" value={form.paidAmount} onChange={e => setForm(current => ({ ...current, paidAmount: e.target.value }))} placeholder={money(total)}/></div>
            <div className="field"><label>Payment method</label><select value={form.paymentType} onChange={e => setForm(current => ({ ...current, paymentType: e.target.value, cashAmount: '', banglaQrAmount: '' }))}><option value="cash">Cash</option><option value="bangla_qr">Bangla QR</option><option value="mixed">Mixed payment</option></select></div>
            <div className="field"><label>Remaining due</label><input readOnly value={money(Math.max(0, total - paidAmount))}/></div>
          </div>
          {form.paymentType === 'mixed' && <div className="mixed-payment-box"><h3>Mixed payment</h3><p className="muted">Example: Customer pays using both methods.</p><div className="form-grid"><div className="field"><label>Cash</label><input type="number" min="0" step="0.01" value={form.cashAmount} onChange={e => setForm(current => ({ ...current, cashAmount: e.target.value }))}/></div><div className="field"><label>Bangla QR</label><input type="number" min="0" step="0.01" value={form.banglaQrAmount} onChange={e => setForm(current => ({ ...current, banglaQrAmount: e.target.value }))}/></div></div><div className="mixed-total"><strong>Total collected</strong><strong>{money(cashAmount + banglaQrAmount)}</strong></div><span className={`payment-match ${paymentMatches ? 'valid' : 'invalid'}`}>{paymentMatches ? 'Payment amounts match' : `Difference: ${money(paidAmount - cashAmount - banglaQrAmount)}`}</span></div>}
          {form.paymentType !== 'mixed' && <div className="alert success">{form.paymentType === 'cash' ? 'Cash' : 'Bangla QR'}: {money(paidAmount)}</div>}
          <div className="field"><label>{t.notes}</label><textarea rows="2" value={form.notes || ''} onChange={e => setForm(current => ({ ...current, notes: e.target.value }))}/></div>
        </section>
      </div>
      <aside className="panel totals-panel"><div className="totals-heading"><span className="totals-icon"><Save size={18}/></span><div><h2>{t.invoiceDetails}</h2><p className="muted">Live calculation</p></div></div><div className="totals-row"><span>{t.subtotal}</span><strong>{money(subtotal)}</strong></div><div className="totals-row"><span>{t.discount}</span><strong>− {money(discount)}</strong></div><div className="totals-row"><span>{t.tax} ({Number(form.taxRate) || 0}%)</span><strong>{money(taxAmount)}</strong></div><div className="totals-grand"><span>{t.total}</span><strong>{money(total)}</strong></div><p className="muted totals-note">Tax is calculated on subtotal after discount.</p><button className="button primary full" disabled={busy || !paymentMatches}><Save size={17}/>{busy ? t.loading : id ? t.updateInvoice : t.save}</button><button type="button" className="button secondary full" onClick={() => navigate(-1)}>{t.cancel}</button></aside>
    </form>
  </>;
}
