import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react';
import { api } from '../services/api.js';

export default function CustomerLedger({ settings }) {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toFixed(2)}`;

  useEffect(() => {
    api.customerLedger(id).then(setData).catch(err => setError(err.message));
  }, [id]);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="loading">Loading customer ledger...</div>;

  const { customer, summary, transactions } = data;
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <Link className="back-link" to="/customers"><ArrowLeft size={16} /> Back to customers</Link>
          <h1>{customer.name}</h1>
          <p className="muted">{customer.customerNo} · {customer.phone}</p>
        </div>
        <button className="button primary" onClick={() => window.print()}><Printer size={16} /> Print ledger</button>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">Invoice total</span><div className="stat-value">{money(summary.invoiceTotal)}</div></div>
        <div className="stat-card"><span className="stat-label">Invoice outstanding</span><div className="stat-value">{money(summary.invoiceOutstanding)}</div></div>
        <div className="stat-card"><span className="stat-label">Money receipts</span><div className="stat-value">{money(summary.moneyReceipts)}</div></div>
        <div className="stat-card"><span className="stat-label">Grand due</span><div className="stat-value">{money(summary.grandDue)}</div></div>
      </div>
      <section className="panel">
        <div className="panel-head"><div><h2>Customer transaction history</h2><p className="muted">Invoices and money receipts are separate documents.</p></div></div>
        <div className="table-wrap">
          <table><thead><tr><th>Type</th><th>Document</th><th>Date & time</th><th className="right">Amount</th><th className="right">Invoice due</th></tr></thead>
            <tbody>{transactions.map(row => <tr key={`${row.type}-${row.id}`}>
              <td><span className={`status ${row.type === 'invoice' ? 'paid' : 'unpaid'}`}>{row.type === 'invoice' ? 'Invoice' : 'Money Receipt'}</span></td>
              <td>{row.type === 'invoice' ? <Link className="invoice-link" to={`/invoices/${row.id}`}>{row.number}</Link> : row.number}</td>
              <td>{new Date(row.date).toLocaleString()}</td>
              <td className="right amount">{money(row.amount)}</td>
              <td className="right">{row.type === 'invoice' ? money(row.due) : '—'}</td>
            </tr>)}
            {!transactions.length && <tr><td colSpan="5" className="empty-cell"><ReceiptText size={24}/><p>No transactions found.</p></td></tr>}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
