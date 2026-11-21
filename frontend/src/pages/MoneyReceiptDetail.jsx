import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../services/api.js';

export default function MoneyReceiptDetail({ settings, t, lang }) {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  useEffect(() => { api.moneyReceipt(id).then(setReceipt).catch(e => setError(e.message)); }, [id]);
  if (error) return <div className="alert error">{error}</div>;
  if (!receipt) return <div className="loading">{t.loadingReceipts}</div>;
  const customer = receipt.customerSnapshot || {};
  return <>
    <div className="page-heading no-print"><div><Link className="back-link" to="/money-receipts"><ArrowLeft size={16}/> {t.backToReceipts}</Link><h1>{t.moneyReceiptTitle}</h1><p className="muted">{receipt.receiptNo}</p></div><button className="button primary" onClick={() => window.print()}><Printer size={16}/> {t.printReceipt}</button></div>
    <article className="print-invoice money-receipt-print">
      <header className="receipt-heading"><h1>{settings?.businessName || 'My POS Store'}</h1><p>{settings?.address}</p><p>{settings?.phone}</p><h2>{t.moneyReceiptTitle}</h2><strong>{receipt.receiptNo}</strong></header>
      <div className="print-rule"/>
      <div className="receipt-customer"><div><small>{t.receivedFrom}</small><h3>{customer.name}</h3><p>{customer.phone}</p><p>{customer.customerNo}</p><p>{customer.address}</p></div><div><small>{t.dateTime}</small><strong>{new Date(receipt.createdAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</strong><small>{t.branchLabel}</small><strong>{receipt.branchId?.name || t.branch}</strong></div></div>
      <div className="receipt-amount-row"><span>{t.amountReceived}</span><strong>{money(receipt.amount)}</strong></div>
      <div className="receipt-methods"><div><span>{t.cash}</span><strong>{money(receipt.cashAmount)}</strong></div><div><span>{t.banglaQr}</span><strong>{money(receipt.banglaQrAmount)}</strong></div><div><span>{t.paymentType}</span><strong>{receipt.paymentType === 'mixed' ? t.mixedPayment : receipt.paymentType === 'bangla_qr' ? t.banglaQr : t.cash}</strong></div></div>
      {receipt.note && <p className="receipt-note"><strong>{t.notes}:</strong> {receipt.note}</p>}
      <div className="receipt-signatures"><div><strong>{receipt.receivedBy?.name || t.salesman}</strong><span>{t.receivedBy}</span><span className="signature-line"/><small>{t.salesmanSignature}</small></div><div><span className="signature-line"/><small>{t.customerSignatureOptional}</small></div></div>
      <footer className="receipt-footer">{settings?.invoiceFooter || t.paymentThanks}</footer>
    </article>
  </>;
}
