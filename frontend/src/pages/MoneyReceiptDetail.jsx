import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../services/api.js';

export default function MoneyReceiptDetail({ settings }) {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toFixed(2)}`;
  useEffect(() => { api.moneyReceipt(id).then(setReceipt).catch(e => setError(e.message)); }, [id]);
  if (error) return <div className="alert error">{error}</div>;
  if (!receipt) return <div className="loading">Loading receipt...</div>;
  const customer = receipt.customerSnapshot || {};
  return <>
    <div className="page-heading no-print"><div><Link className="back-link" to="/money-receipts"><ArrowLeft size={16}/> Back to receipts</Link><h1>Money Receipt</h1><p className="muted">{receipt.receiptNo}</p></div><button className="button primary" onClick={() => window.print()}><Printer size={16}/> Print receipt</button></div>
    <article className="print-invoice money-receipt-print">
      <header className="receipt-heading"><h1>{settings?.businessName || 'My POS Store'}</h1><p>{settings?.address}</p><p>{settings?.phone}</p><h2>MONEY RECEIPT</h2><strong>{receipt.receiptNo}</strong></header>
      <div className="print-rule"/>
      <div className="receipt-customer"><div><small>RECEIVED FROM</small><h3>{customer.name}</h3><p>{customer.phone}</p><p>{customer.customerNo}</p><p>{customer.address}</p></div><div><small>DATE & TIME</small><strong>{new Date(receipt.createdAt).toLocaleString()}</strong><small>BRANCH</small><strong>{receipt.branchId?.name || 'Branch'}</strong></div></div>
      <div className="receipt-amount-row"><span>Amount received</span><strong>{money(receipt.amount)}</strong></div>
      <div className="receipt-methods"><div><span>Cash</span><strong>{money(receipt.cashAmount)}</strong></div><div><span>Bangla QR</span><strong>{money(receipt.banglaQrAmount)}</strong></div><div><span>Payment type</span><strong>{receipt.paymentType === 'mixed' ? 'Mixed payment' : receipt.paymentType === 'bangla_qr' ? 'Bangla QR' : 'Cash'}</strong></div></div>
      {receipt.note && <p className="receipt-note"><strong>Note:</strong> {receipt.note}</p>}
      <div className="receipt-signatures"><div><strong>{receipt.receivedBy?.name || 'Salesman'}</strong><span>Received by</span><span className="signature-line"/><small>Salesman signature</small></div><div><span className="signature-line"/><small>Customer signature (optional)</small></div></div>
      <footer className="receipt-footer">{settings?.invoiceFooter || 'Thank you for your payment.'}</footer>
    </article>
  </>;
}
