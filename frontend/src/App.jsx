
import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';

import Layout from './components/Layout.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Categories from './pages/Categories.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceForm from './pages/InvoiceForm.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Inventory from './pages/Inventory.jsx';
import Branches from './pages/Branches.jsx';
import Users from './pages/Users.jsx';
import Customers from './pages/Customers.jsx';
import CustomerLedger from './pages/CustomerLedger.jsx';
import MoneyReceipts from './pages/MoneyReceipts.jsx';
import MoneyReceiptDetail from './pages/MoneyReceiptDetail.jsx';
import SalesReturns from './pages/SalesReturns.jsx';
import Expenses from './pages/Expenses.jsx';
import Reports from './pages/Reports.jsx';

import { translations } from './i18n.js';
import { api } from './services/api.js';

export default function App() {
  const [lang, setLang] = useState(
    () => localStorage.getItem('pos-language') || 'en'
  );

  const [settings, setSettings] = useState(null);

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos-user') || 'null');
    } catch {
      return null;
    }
  });

  const [branches, setBranches] = useState([]);

  const [branch, setBranch] = useState(
    localStorage.getItem('pos-branch') || ''
  );

  const [error, setError] = useState('');

  const t = translations[lang] || translations.en;

  useEffect(() => {
    localStorage.setItem('pos-language', lang);
  }, [lang]);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      api.branches(),
      api.settings()
    ])
      .then(([bs, s]) => {
        setBranches(bs);
        setSettings(s);

        if (!branch && bs.length) {
          setBranch(bs[0]._id);
          localStorage.setItem('pos-branch', bs[0]._id);
        }
      })
      .catch(e => setError(e.message));

  }, [user]);

  function logout() {
    localStorage.removeItem('pos-token');
    localStorage.removeItem('pos-user');
    localStorage.removeItem('pos-branch');

    setUser(null);
    setBranches([]);
    setBranch('');
  }

  function changeBranch(id) {
    setBranch(id);
    localStorage.setItem('pos-branch', id);
    window.location.reload();
  }

  if (!user) {
    return <Login onLogin={setUser} t={t} />;
  }

  return (
    <>
      <div className="branch-strip">

        <span>
          {t.signedInAs} <b>{user.name}</b> ({user.role === 'owner' ? t.roleOwner : t.roleSalesman})
        </span>

        {user.role === 'owner' && (
          <label>
            {t.branch}

            <select
              value={branch}
              onChange={e => changeBranch(e.target.value)}
            >
              {branches.map(b => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {user.role === 'salesman' && (
          <span>{t.assignedBranch}</span>
        )}

        <button onClick={logout}>
          {t.signOut}
        </button>

      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <Routes>

        <Route
          element={
            <Layout
              lang={lang}
              setLang={setLang}
              t={t}
              user={user}
            />
          }
        >

          <Route
            index
            element={<Dashboard t={t} settings={settings} lang={lang} />}
          />

          <Route
            path="reports"
            element={<Reports settings={settings} user={user} t={t} lang={lang} />}
          />

          <Route
            path="products"
            element={<Products t={t} settings={settings} user={user} />}
          />

          <Route
            path="inventory"
            element={<Inventory t={t} settings={settings} lang={lang} />}
          />

          <Route path="customers" element={<Customers settings={settings} t={t} lang={lang} />} />
          <Route path="customers/:id" element={<CustomerLedger settings={settings} t={t} lang={lang} />} />
          <Route path="money-receipts" element={<MoneyReceipts settings={settings} t={t} lang={lang} />} />
          <Route path="money-receipts/:id" element={<MoneyReceiptDetail settings={settings} t={t} lang={lang} />} />
          <Route path="returns" element={<SalesReturns settings={settings} t={t} lang={lang} />} />
          {user.role === 'owner' && <Route path="expenses" element={<Expenses settings={settings} t={t} lang={lang} />} />}

          <Route
            path="invoices"
            element={<Invoices t={t} settings={settings} lang={lang} />}
          />

          <Route
            path="invoices/new"
            element={<InvoiceForm t={t} settings={settings} lang={lang} />}
          />

          <Route
            path="invoices/:id"
            element={<InvoiceDetail t={t} settings={settings} lang={lang} />}
          />

          <Route
            path="invoices/:id/edit"
            element={<InvoiceForm t={t} settings={settings} lang={lang} />}
          />

          <Route
            path="settings"
            element={<Settings t={t} onSaved={setSettings} />}
          />

          {user.role === 'owner' && (
            <>
              <Route
                path="categories"
                element={<Categories t={t} />}
              />

              <Route
                path="branches"
                element={<Branches t={t} />}
              />

              <Route
                path="users"
                element={<Users t={t} />}
              />
            </>
          )}

          <Route
            path="*"
            element={
              <div className="panel">
                <h2>{t.pageNotFound}</h2>
                <a href="/">{t.goToDashboard}</a>
              </div>
            }
          />

        </Route>

      </Routes>
    </>
  );
}
