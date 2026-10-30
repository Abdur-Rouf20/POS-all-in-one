
import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';

import Layout from './components/Layout.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceForm from './pages/InvoiceForm.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Inventory from './pages/Inventory.jsx';
import Branches from './pages/Branches.jsx';
import Users from './pages/Users.jsx';

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
    return <Login onLogin={setUser} />;
  }

  return (
    <>
      <div className="branch-strip">

        <span>
          Signed in as <b>{user.name}</b> ({user.role})
        </span>

        {user.role === 'owner' && (
          <label>
            Branch

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
          <span>Assigned branch</span>
        )}

        <button onClick={logout}>
          Sign out
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
            element={<Dashboard t={t} settings={settings} />}
          />

          <Route
            path="products"
            element={<Products t={t} settings={settings} />}
          />

          <Route
            path="inventory"
            element={<Inventory />}
          />

          <Route
            path="invoices"
            element={<Invoices t={t} settings={settings} />}
          />

          <Route
            path="invoices/new"
            element={<InvoiceForm t={t} settings={settings} />}
          />

          <Route
            path="invoices/:id"
            element={<InvoiceDetail t={t} settings={settings} />}
          />

          <Route
            path="invoices/:id/edit"
            element={<InvoiceForm t={t} settings={settings} />}
          />

          <Route
            path="settings"
            element={<Settings t={t} onSaved={setSettings} />}
          />

          {user.role === 'owner' && (
            <>
              <Route
                path="branches"
                element={<Branches />}
              />

              <Route
                path="users"
                element={<Users />}
              />
            </>
          )}

          <Route
            path="*"
            element={
              <div className="panel">
                <h2>Page not found</h2>
                <a href="/">Go to dashboard</a>
              </div>
            }
          />

        </Route>

      </Routes>
    </>
  );
}
