import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus, ReceiptText, Search } from 'lucide-react';
import { api } from '../services/api.js';

export default function Invoices({ t, settings, lang }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    api.invoices(query).then(setRows).catch(requestError => setError(requestError.message));
  }, [query]);

  return <>
    <div className="page-heading">
      <div>
        <div className="eyebrow">{t.transactions}</div>
        <h1>{t.invoiceHistory}</h1>
        <p className="muted">{t.invoicesSavedHint}</p>
      </div>
      <Link className="button primary" to="/invoices/new"><Plus size={17}/>{t.newInvoice}</Link>
    </div>
    {error && <div className="alert error">{error}</div>}
    <div className="panel">
      <div className="toolbar">
        <div className="searchbox"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t.searchInvoices}/></div>
        <span className="count-pill">{t.invoiceCountLabel.replace('{count}', String(rows.length))}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t.invoiceNo}</th><th>{t.customer}</th><th>{t.date}</th><th>{t.items}</th><th>{t.status}</th><th className="right">{t.total}</th><th/></tr></thead>
          <tbody>
            {rows.map(invoice => (
              <tr key={invoice._id}>
                <td><Link className="invoice-link" to={`/invoices/${invoice._id}`}>{invoice.invoiceNo}</Link></td>
                <td>{invoice.customerName || t.walkInCustomer}<small className="cell-sub">{invoice.customerPhone}</small></td>
                <td>{new Date(invoice.invoiceDate).toLocaleDateString(locale)}</td>
                <td>{invoice.items?.length || 0}</td>
                <td><span className={`status ${invoice.status}`}>{t[invoice.paymentStatus || invoice.status] || t.unpaid}</span></td>
                <td className="right amount">{money(invoice.total)}</td>
                <td><Link className="icon-button" to={`/invoices/${invoice._id}`} title={t.invoiceDetails} aria-label={t.invoiceDetails}><ArrowUpRight size={16}/></Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="7" className="empty-cell"><ReceiptText size={24}/><p>{t.noInvoices}</p></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </>;
}
