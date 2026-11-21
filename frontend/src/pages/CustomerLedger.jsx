import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react';
import { api } from '../services/api.js';

export default function CustomerLedger({ settings, t, lang }) {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    api.customerLedger(id).then(setData).catch(err => setError(err.message));
  }, [id]);

  if (error) return <div className="alert error">{error}</div>;
  if (!data) return <div className="loading">{t.loadingLedger}</div>;

  const { customer, summary, transactions } = data;
  return (
    <>
      <div className="page-heading no-print">
        <div>
          <Link className="back-link" to="/customers"><ArrowLeft size={16} /> {t.backToCustomers}</Link>
          <h1>{customer.name}</h1>
          <p className="muted">{customer.customerNo} · {customer.phone}</p>
        </div>
        <button className="button primary" onClick={() => window.print()}><Printer size={16} /> {t.printLedger}</button>
      </div>
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">{t.invoiceTotal}</span><div className="stat-value">{money(summary.invoiceTotal)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.invoiceOutstanding}</span><div className="stat-value">{money(summary.invoiceOutstanding)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.moneyReceipts}</span><div className="stat-value">{money(summary.moneyReceipts)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.dueAdjustments}</span><div className="stat-value">{money(summary.dueAdjustments)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.customerCredit}</span><div className="stat-value">{money(summary.customerCredits)}</div></div>
        <div className="stat-card"><span className="stat-label">{t.grandDue}</span><div className="stat-value">{money(summary.grandDue)}</div></div>
      </div>
      <section className="panel">
        <div className="panel-head"><div><h2>{t.customerHistory}</h2><p className="muted">{t.transactionsSeparate}</p></div></div>
        <div className="table-wrap">
          <table><thead><tr><th>{t.transactionType}</th><th>{t.document}</th><th>{t.dateTime}</th><th className="right">{t.total}</th><th className="right">{t.invoiceDueSettlement}</th></tr></thead>
            <tbody>{transactions.map(row => <tr key={`${row.type}-${row.id}`}>
              <td><span className={`status ${row.type === 'invoice' ? 'paid' : row.type === 'sales_return' ? 'partial' : 'unpaid'}`}>{row.type === 'invoice' ? t.invoiceType : row.type === 'money_receipt' ? t.moneyReceiptType : t.salesReturnType}</span></td>
              <td>{row.type === 'invoice' ? <Link className="invoice-link" to={`/invoices/${row.id}`}>{row.number}</Link> : row.number}</td>
              <td>{new Date(row.date).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</td>
              <td className="right amount">{money(row.amount)}</td>
              <td className="right">{row.type === 'invoice' ? money(row.due) : row.type === 'sales_return' ? (row.settlementType === 'due_adjustment' ? t.dueAdjusted : row.settlementType === 'customer_credit' ? t.creditIssued : t.refunded) : '—'}</td>
            </tr>)}
            {!transactions.length && <tr><td colSpan="5" className="empty-cell"><ReceiptText size={24}/><p>{t.noTransactions}</p></td></tr>}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
