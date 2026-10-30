import { useEffect, useState } from 'react';
import { Search, Users, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';

export default function Customers({ settings }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toFixed(2)}`;

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
          <div className="eyebrow">CUSTOMER ACCOUNTS</div>
          <h1>Customers</h1>
          <p className="muted">Find customers by name, phone number or Customer ID.</p>
        </div>
        <span className="count-pill">{rows.length} customers</span>
      </div>
      {error && <div className="alert error">{error}</div>}
      <section className="panel">
        <div className="toolbar">
          <div className="searchbox">
            <Search size={17} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, phone or customer ID" />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer ID</th><th>Name</th><th>Phone</th><th>Address</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map(customer => (
                <tr key={customer._id}>
                  <td className="invoice-link">{customer.customerNo}</td>
                  <td>{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.address || '—'}</td>
                  <td><span className={`status ${customer.active ? 'paid' : 'unpaid'}`}>{customer.active ? 'Active' : 'Inactive'}</span></td>
                  <td><Link className="icon-button" to={`/customers/${customer._id}`} title="Customer ledger"><ArrowUpRight size={16} /></Link></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan="6" className="empty-cell"><Users size={24} /><p>No customers found.</p></td></tr>}
              {loading && <tr><td colSpan="6" className="empty-cell">Loading customers...</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
