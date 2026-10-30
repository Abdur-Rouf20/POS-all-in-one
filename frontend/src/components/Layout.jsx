
import { NavLink, Outlet } from 'react-router-dom';

import {
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings as SettingsIcon,
  Languages,
  Store,
  Boxes,
  GitBranch,
  Users
} from 'lucide-react';

export default function Layout({ lang, setLang, t, user }) {
  return (
    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">
          <span className="brand-icon">
            <Store size={22} />
          </span>

          <div>
            <strong>Simple POS</strong>
            <small>{t.appSubtitle}</small>
          </div>
        </div>

        <div className="nav-label">MENU</div>

        <nav>

          <NavLink to="/" end>
            <LayoutDashboard size={18} />
            {t.dashboard}
          </NavLink>

          <NavLink to="/products">
            <Package size={18} />
            {t.products}
          </NavLink>

          <NavLink to="/inventory">
            <Boxes size={18} />
            Inventory
          </NavLink>

          {user?.role === 'owner' && (
            <>
              <NavLink to="/branches">
                <GitBranch size={18} />
                Branch Management
              </NavLink>

              <NavLink to="/users">
                <Users size={18} />
                User Management
              </NavLink>
            </>
          )}

          <NavLink to="/invoices">
            <ReceiptText size={18} />
            {t.invoices}
          </NavLink>

          <NavLink to="/settings">
            <SettingsIcon size={18} />
            {t.settings}
          </NavLink>

        </nav>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <span>Local POS workspace</span>
        </div>

      </aside>

      <main className="main">

        <header className="topbar">

          <div className="mobile-brand">
            <Store size={20} />
            Simple POS
          </div>

          <div className="topbar-right">

            <span className="online-pill">
              <span />
              Ready
            </span>

            <button
              className="language-button"
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            >
              <Languages size={16} />
              {lang === 'en' ? 'বাংলা' : 'English'}
            </button>

          </div>

        </header>

        <div className="page-wrap">
          <Outlet />
        </div>

      </main>

    </div>
  );
}
