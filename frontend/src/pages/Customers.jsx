import { useEffect, useState } from 'react';
import { Search, Users, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

export default function Customers({ settings, t, lang }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.customers(query)
      .then(data => { if (active) setRows(data); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t.customerAccounts}</div>
          <h1>{t.navCustomers}</h1>
          <p className="muted">{t.searchBy}.</p>
        </div>
        <span className="count-pill">{t.customersFound.replace('{count}', String(rows.length))}</span>
      </div>
      {error && <div className="alert error">{error}</div>}
      <section className="panel">
        <div className="toolbar">
          <div className="searchbox">
            <Search size={17} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchBy} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t.customerId}</th><th>{t.nameLabel}</th><th>{t.phone}</th><th>{t.addressLabel}</th><th>{t.categoryStatus}</th><th /></tr></thead>
            <tbody>
              {rows.map(customer => (
                <tr key={customer._id}>
                  <td className="invoice-link">{customer.customerNo}</td>
                  <td>{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.address || '—'}</td>
                  <td><span className={`status ${customer.active ? 'paid' : 'unpaid'}`}>{customer.active ? t.active : t.inactive}</span></td>
                  <td><Link className="icon-button" to={`/customers/${customer._id}`} title={t.customerLedger} aria-label={t.customerLedger}><ArrowUpRight size={16} /></Link></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan="6" className="empty-cell"><Users size={24} /><p>{t.noCustomersFound}</p></td></tr>}
              {loading && <tr><td colSpan="6" className="empty-cell">{t.loadingCustomers}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
