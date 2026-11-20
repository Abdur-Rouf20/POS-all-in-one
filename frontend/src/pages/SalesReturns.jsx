import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Search, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';

const emptyForm = { settlementType: 'customer_credit', refundMethod: 'cash', cashRefundAmount: '', banglaQrRefundAmount: '', note: '' };

export default function SalesReturns({ settings, t, lang }) {
  const [invoices, setInvoices] = useState([]);
  const [returns, setReturns] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [priorReturns, setPriorReturns] = useState([]);
  const [lines, setLines] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  async function load() {
    setLoading(true);
    try {
      const [invoiceRows, returnRows] = await Promise.all([api.invoices(), api.salesReturns()]);
      setInvoices(invoiceRows);
      setReturns(returnRows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let active = true;
    if (!selectedInvoiceId) { setInvoice(null); setPriorReturns([]); setLines({}); return () => { active = false; }; }
    Promise.all([api.invoice(selectedInvoiceId), api.salesReturns(selectedInvoiceId)])
      .then(([invoiceData, returnRows]) => {
        if (!active) return;
        setInvoice(invoiceData);
        setPriorReturns(returnRows);
        const returned = {};
        for (const row of returnRows) for (const item of row.items || []) {
          returned[item.invoiceItemIndex] = (returned[item.invoiceItemIndex] || 0) + Number(item.quantity || 0);
        }
        const next = {};
        (invoiceData.items || []).forEach((item, index) => {
          const remaining = Math.max(0, Number(item.quantity) - Number(returned[index] || 0));
          next[index] = { quantity: '', refundUnitPrice: '', remaining };
        });
        setLines(next);
      })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [selectedInvoiceId]);

  const visibleInvoices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices.slice(0, 80);
    return invoices.filter(row => `${row.invoiceNo} ${row.customerName} ${row.customerPhone}`.toLowerCase().includes(q)).slice(0, 80);
  }, [invoices, query]);

  const selectedLines = Object.entries(lines).filter(([, line]) => Number(line.quantity) > 0);
  const totalRefund = selectedLines.reduce((sum, [index, line]) => sum + Number(line.quantity) * Number(line.refundUnitPrice || 0), 0);
  const cash = form.settlementType !== 'cash_refund' ? 0 : form.refundMethod === 'cash' ? totalRefund : form.refundMethod === 'bangla_qr' ? 0 : Number(form.cashRefundAmount || 0);
  const qr = form.settlementType !== 'cash_refund' ? 0 : form.refundMethod === 'bangla_qr' ? totalRefund : form.refundMethod === 'cash' ? 0 : Number(form.banglaQrRefundAmount || 0);
  const paymentMatches = form.settlementType !== 'cash_refund' || (totalRefund > 0 && Math.round((cash + qr) * 100) === Math.round(totalRefund * 100));

  function updateLine(index, field, value) {
    setLines(current => ({ ...current, [index]: { ...current[index], [field]: value } }));
  }

  async function submit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (!invoice) { setError(t.selectOriginalInvoice); return; }
    if (!selectedLines.length) { setError(t.returnOneItem); return; }
    for (const [index, line] of selectedLines) {
      if (!line.refundUnitPrice || !Number.isFinite(Number(line.refundUnitPrice)) || Number(line.refundUnitPrice) <= 0) {
        setError(t.manualRefundRequired.replace('{name}', invoice.items[Number(index)].name)); return;
      }
      if (Number(line.quantity) > Number(line.remaining)) { setError(t.returnQuantityExceeded.replace('{name}', invoice.items[Number(index)].name)); return; }
    }
    if (!paymentMatches) { setError(t.returnPaymentMismatch); return; }
    setSaving(true);
    try {
      const result = await api.createSalesReturn({
        invoiceId: invoice._id,
        items: selectedLines.map(([index, line]) => ({ invoiceItemIndex: Number(index), quantity: Number(line.quantity), refundUnitPrice: Number(line.refundUnitPrice) })),
        settlementType: form.settlementType,
        refundMethod: form.settlementType === 'cash_refund' ? form.refundMethod : '',
        cashRefundAmount: cash,
        banglaQrRefundAmount: qr,
        note: form.note
      });
      setMessage(t.returnCreated.replace('{number}', result.returnNo));
      setForm(emptyForm);
      const [invoiceData, returnRows, allReturns] = await Promise.all([api.invoice(invoice._id), api.salesReturns(invoice._id), api.salesReturns()]);
      setInvoice(invoiceData); setPriorReturns(returnRows); setReturns(allReturns);
      const returned = {};
      for (const row of returnRows) for (const item of row.items || []) returned[item.invoiceItemIndex] = (returned[item.invoiceItemIndex] || 0) + Number(item.quantity || 0);
      const next = {};
      invoiceData.items.forEach((item, index) => { next[index] = { quantity: '', refundUnitPrice: '', remaining: Math.max(0, Number(item.quantity) - Number(returned[index] || 0)) }; });
      setLines(next);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{t.afterSales}</div><h1>{t.salesReturns}</h1><p className="muted">{t.salesReturnsHint}</p></div>
      <button className="button secondary" onClick={load}><RefreshCw size={16}/>{t.refresh}</button>
    </div>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}

    <section className="panel form-panel">
      <h2>{t.confirmSalesReturn}</h2>
      <form className="form-stack" onSubmit={submit}>
        <div className="field">
          <label>{t.findOriginalInvoice}</label>
          <div className="searchbox"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchInvoiceCustomerPhone} /></div>
          <select value={selectedInvoiceId} onChange={e => { setSelectedInvoiceId(e.target.value); setError(''); setMessage(''); }} required>
            <option value="">{t.selectInvoice}</option>
            {visibleInvoices.map(row => <option key={row._id} value={row._id}>{row.invoiceNo} · {row.customerName || t.customerLabel} · {new Date(row.invoiceDate).toLocaleDateString(locale)}</option>)}
          </select>
        </div>

        {invoice && <>
          <div className="alert success"><strong>{invoice.invoiceNo}</strong> · {invoice.customerName} · {invoice.customerPhone} · {t.originalTotal} {money(invoice.total)} · {t.alreadyReturned.replace('{count}', String(priorReturns.length))}</div>
          <div className="table-wrap"><table><thead><tr><th>{t.product}</th><th className="right">{t.sold}</th><th className="right">{t.previouslyReturned}</th><th className="right">{t.remaining}</th><th>{t.returnQuantity}</th><th>{t.manualRefundUnit}</th></tr></thead><tbody>
            {invoice.items.map((item, index) => {
              const line = lines[index] || { quantity: '', refundUnitPrice: '', remaining: item.quantity };
              const returned = Number(item.quantity) - Number(line.remaining || 0);
              return <tr key={`${item.product}-${index}`}><td><strong>{item.name}</strong><small className="cell-sub">{item.sku}</small></td><td className="right">{item.quantity}</td><td className="right">{returned}</td><td className="right">{line.remaining}</td><td><input className="table-input" type="number" min="0" max={line.remaining} step="0.01" value={line.quantity} disabled={line.remaining <= 0} onChange={e => updateLine(index, 'quantity', e.target.value)} placeholder="0"/></td><td><input className="table-input" type="number" min="0.01" step="0.01" value={line.refundUnitPrice} disabled={line.remaining <= 0} onChange={e => updateLine(index, 'refundUnitPrice', e.target.value)} placeholder={t.enterPrice}/></td></tr>;
            })}
          </tbody></table></div>
          <div className="form-grid">
            <div className="field"><label>{t.returnSettlement}</label><select value={form.settlementType} onChange={e => setForm(current => ({ ...current, settlementType: e.target.value, refundMethod: 'cash', cashRefundAmount: '', banglaQrRefundAmount: '' }))}><option value="customer_credit">{t.customerCredit}</option><option value="due_adjustment">{t.adjustGrandDue}</option><option value="cash_refund">{t.cashRefundOption}</option></select></div>
            <div className="field"><label>{t.returnTotal}</label><input value={money(totalRefund)} readOnly/></div>
          </div>
          {form.settlementType === 'cash_refund' && <>
            <div className="field"><label>{t.refundMethod}</label><select value={form.refundMethod} onChange={e => setForm(current => ({ ...current, refundMethod: e.target.value, cashRefundAmount: '', banglaQrRefundAmount: '' }))}><option value="cash">{t.cash}</option><option value="bangla_qr">{t.banglaQr}</option><option value="mixed">{t.mixedRefund}</option></select></div>
            {form.refundMethod === 'mixed' && <div className="form-grid"><div className="field"><label>{t.cashAmount}</label><input type="number" min="0" step="0.01" value={form.cashRefundAmount} onChange={e => setForm(current => ({ ...current, cashRefundAmount: e.target.value }))}/></div><div className="field"><label>{t.qrAmount}</label><input type="number" min="0" step="0.01" value={form.banglaQrRefundAmount} onChange={e => setForm(current => ({ ...current, banglaQrRefundAmount: e.target.value }))}/></div></div>}
            <div className={`payment-match ${paymentMatches ? 'valid' : 'invalid'}`}>{paymentMatches ? t.returnMatches : t.refundDifference.replace('{amount}', money(totalRefund - cash - qr))}</div>
          </>}
          {form.settlementType === 'customer_credit' && <div className="alert success">{t.customerCreditHint}</div>}
          {form.settlementType === 'due_adjustment' && <div className="alert success">{t.dueAdjustmentHint}</div>}
          <div className="field"><label>{t.returnNote}</label><textarea rows="2" value={form.note} onChange={e => setForm(current => ({ ...current, note: e.target.value }))} placeholder={t.returnNotePlaceholder}/></div>
          <div className="form-actions"><button className="button primary" disabled={saving || totalRefund <= 0 || !selectedLines.length || !paymentMatches}>{saving ? t.processingReturn : t.confirmSalesReturn}</button></div>
        </>}
      </form>
    </section>

    <section className="panel">
      <div className="toolbar"><div><strong>{t.returnHistory}</strong></div><span className="count-pill">{t.returnCount.replace('{count}', String(returns.length))}</span></div>
      <div className="table-wrap"><table><thead><tr><th>{t.returnNumber}</th><th>{t.originalInvoice}</th><th>{t.customer}</th><th>{t.date}</th><th>{t.settlement}</th><th className="right">{t.refundTotal}</th></tr></thead><tbody>
        {returns.map(row => <tr key={row._id}><td><strong>{row.returnNo}</strong></td><td><Link className="invoice-link" to={`/invoices/${row.invoiceId}`}>{row.invoiceNo}</Link></td><td>{row.customerSnapshot?.name}<small className="cell-sub">{row.customerSnapshot?.phone}</small></td><td>{new Date(row.createdAt).toLocaleString(locale)}</td><td>{row.settlementType === 'customer_credit' ? t.customerCredit : row.settlementType === 'due_adjustment' ? t.dueAdjustmentShort : `${t.cashRefund} · ${row.refundMethod === 'bangla_qr' ? t.banglaQr : row.refundMethod === 'mixed' ? t.mixedPayment : t.cash}`}</td><td className="right amount">{money(row.totalRefund)}</td></tr>)}
        {!loading && returns.length === 0 && <tr><td colSpan="6" className="empty-cell"><RotateCcw size={24}/><p>{t.noReturns}</p></td></tr>}
        {loading && <tr><td colSpan="6" className="empty-cell">{t.loadingReturnHistory}</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
