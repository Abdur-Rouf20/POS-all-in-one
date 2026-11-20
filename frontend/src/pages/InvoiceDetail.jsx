import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { api } from '../services/api.js';

export default function InvoiceDetail({ t, settings, lang }) {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [revisions, setRevisions] = useState([]);
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('pos-user') || 'null'); } catch { return null; } })();
  const isOwner = currentUser?.role === 'owner';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = value => new Date(value).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US');

  useEffect(() => { api.invoice(id).then(setInvoice).catch(error => setError(error.message)); if (isOwner) api.invoiceRevisions(id).then(setRevisions).catch(() => setRevisions([])); }, [id, isOwner]);
  if (error) return <div className="alert error">{error}</div>;
  if (!invoice) return <div className="loading">{t.loading}</div>;

  const isPaid = Number(invoice.dueAmount || 0) <= 0 && Number(invoice.paidAmount || 0) >= Number(invoice.total || 0);
  return <>
    <div className="page-heading no-print"><div><Link className="back-link" to="/invoices"><ArrowLeft size={16}/>{t.back}</Link><h1>{t.invoiceDetails}</h1><p className="muted">{invoice.invoiceNo}</p></div><div className="heading-actions">{isOwner && <Link className="button secondary" to={`/invoices/${id}/edit`}><Pencil size={16}/>{t.edit}</Link>}<button className="button primary" onClick={() => window.print()}><Printer size={17}/>{t.print}</button></div></div>
    <article className={`print-invoice ${isPaid ? 'invoice-is-paid' : ''}`}>
      {isPaid && <div className="paid-watermark">{t.paidWatermark}</div>}
      <div className="print-top"><div><div className="print-brand-mark">{(settings?.businessName || 'POS').slice(0, 2).toUpperCase()}</div><h1>{settings?.businessName || 'My POS Store'}</h1><p>{settings?.address}</p><p>{settings?.phone}</p></div><div className="invoice-title"><span>{t.invoiceTitle}</span><strong>{invoice.invoiceNo}</strong><small>{date(invoice.invoiceDate)}</small><span className={`status ${isPaid ? 'paid' : 'unpaid'}`}>{isPaid ? t.paid : t.dueStatus}</span></div></div>
      <div className="print-rule"/>
      <div className="bill-to"><div><small>{t.billTo}</small><h3>{invoice.customerName}</h3><p>{invoice.customerPhone}</p><p>{invoice.customerAddress}</p>{invoice.customerId && <small>{t.customerId}: {invoice.customerId}</small>}</div><div className="invoice-meta"><small>{t.date}</small><strong>{date(invoice.invoiceDate)}</strong><small>{t.createdBy}</small><strong>{invoice.createdBy?.name || '—'}</strong></div></div>
      <table className="print-table"><thead><tr><th>#</th><th>{t.product}</th><th>{t.quantity}</th><th className="right">{t.price}</th><th className="right">{t.total}</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={index}><td>{String(index + 1).padStart(2, '0')}</td><td>{item.name}{item.sku && <small className="cell-sub">{item.sku}</small>}</td><td>{item.quantity}</td><td className="right">{money(item.unitPrice)}</td><td className="right">{money(item.lineTotal)}</td></tr>)}</tbody></table>
      <div className="print-bottom"><div className="print-notes">{invoice.notes && <><small>{t.notes}</small><p>{invoice.notes}</p></>}<p className="thank-you">{settings?.invoiceFooter || t.paymentThanks}</p></div><div className="print-totals"><div><span>{t.subtotal}</span><strong>{money(invoice.subtotal)}</strong></div><div><span>{t.discount}</span><strong>− {money(invoice.discount)}</strong></div><div><span>{t.tax} ({invoice.taxRate}%)</span><strong>{money(invoice.taxAmount)}</strong></div><div className="print-grand"><span>{t.total}</span><strong>{money(invoice.total)}</strong></div><div><span>{t.paidAtCreation}</span><strong>{money(invoice.paidAmount)}</strong></div><div><span>{t.remainingDueLabel}</span><strong>{money(invoice.dueAmount)}</strong></div></div></div>
      <div className="payment-breakdown"><strong>{t.paymentMethod}:</strong> {invoice.paymentType === 'mixed' ? t.mixedPayment : invoice.paymentType === 'bangla_qr' ? t.banglaQr : invoice.paymentType === 'cash' ? t.cash : t.unpaid}<span>{t.cash}: {money(invoice.cashAmount)}</span><span>{t.banglaQr}: {money(invoice.banglaQrAmount)}</span></div>
      <div className="print-footer">{t.generatedInvoiceFooter}</div>
    </article>
    {isOwner && <section className="panel form-panel no-print"><h2>{t.revisions}</h2>{revisions.length === 0 ? <p className="muted">{t.noRevisions}</p> : <div className="table-wrap"><table><thead><tr><th>{t.revision}</th><th>{t.reason}</th><th>{t.editedBy}</th><th>{t.date}</th><th>{t.previousTotal}</th><th>{t.updatedTotal}</th></tr></thead><tbody>{revisions.map(revision => <tr key={revision._id}><td>#{revision.revisionNo}</td><td>{revision.reason}</td><td>{revision.changedBy?.name || '—'}</td><td>{new Date(revision.changedAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td><td>{money(revision.before?.total)}</td><td>{money(revision.after?.total)}<details><summary>{t.viewBeforeAfter}</summary><div><strong>{t.before}</strong><pre>{JSON.stringify(revision.before, null, 2)}</pre><strong>{t.after}</strong><pre>{JSON.stringify(revision.after, null, 2)}</pre></div></details></td></tr>)}</tbody></table></div>}</section>}
    <section className="panel form-panel no-print"><h2>{t.paymentStatusTitle}</h2><p>{t.initialPaidAmount}: <strong>{money(invoice.paidAmount)}</strong> · {t.remainingInvoiceDue}: <strong>{money(invoice.dueAmount)}</strong></p><p className="muted">{t.invoicePaymentLockedHint}</p>{invoice.customerId && <Link className="button secondary" to={`/customers/${invoice.customerId}`}>{t.viewCustomerAccount}</Link>}</section>
  </>;
}
