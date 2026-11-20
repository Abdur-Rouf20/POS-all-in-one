import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tags, ReceiptText, Settings as SettingsIcon,
  Languages, Store, Boxes, GitBranch, Users, ContactRound, Wallet,
  RotateCcw, WalletCards, FileSpreadsheet, Menu, X
} from 'lucide-react';

export default function Layout({ lang, setLang, t, user }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(() => window.matchMedia('(min-width: 901px)').matches);

  useEffect(() => {
    const handleResize = () => setMenuOpen(window.matchMedia('(min-width: 901px)').matches);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth <= 900) setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (menuOpen && window.innerWidth <= 900) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleEscape = event => { if (event.key === 'Escape') setMenuOpen(false); };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = previousOverflow;
        document.removeEventListener('keydown', handleEscape);
      };
    }
    return undefined;
  }, [menuOpen]);

  const navItems = [
    { to: '/', label: t.dashboard, icon: LayoutDashboard, end: true },
    { to: '/reports', label: t.navReports, icon: FileSpreadsheet },
    { to: '/products', label: t.products, icon: Package },
    { to: '/inventory', label: t.navInventory, icon: Boxes },
    ...(user?.role === 'owner' ? [
      { to: '/categories', label: t.navCategories, icon: Tags },
      { to: '/branches', label: t.navBranches, icon: GitBranch },
      { to: '/expenses', label: t.navExpenses, icon: WalletCards },
      { to: '/users', label: t.navUsers, icon: Users }
    ] : []),
    { to: '/money-receipts', label: t.navMoneyReceipts, icon: Wallet },
    { to: '/returns', label: t.navSalesReturns, icon: RotateCcw },
    { to: '/customers', label: t.navCustomers, icon: ContactRound },
    { to: '/invoices', label: t.navInvoices, icon: ReceiptText },
    { to: '/settings', label: t.navSettings, icon: SettingsIcon }
  ];

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : 'menu-closed'}`}>
      {menuOpen && window.innerWidth <= 900 && (
        <button className="sidebar-backdrop" type="button" aria-label={t.closeMenu} onClick={() => setMenuOpen(false)} />
      )}

      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`} aria-hidden={!menuOpen}>
        <div className="sidebar-scroll">
          <div className="brand">
            <span className="brand-icon"><Store size={22} /></span>
            <div>
              <strong>Simple POS</strong>
              <small>{t.appSubtitle}</small>
            </div>
            <button className="sidebar-close" type="button" aria-label={t.closeMenu} title={t.closeMenu} onClick={() => setMenuOpen(false)}>
              <X size={19}/>
            </button>
          </div>

          <div className="nav-label">{t.menu}</div>
          <nav aria-label={t.menu}>
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => {
                if (window.innerWidth <= 900) setMenuOpen(false);
              }}>
                <Icon size={18}/>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <span>{t.workspace}</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-start">
            <button className="menu-toggle" type="button" aria-label={t.openMenu} title={t.openMenu} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>
              <Menu size={21}/>
            </button>
            <div className="mobile-brand"><Store size={20}/>Simple POS</div>
          </div>

          <div className="topbar-right">
            <span className="online-pill"><span/>{t.ready}</span>
            <button className="language-button" onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}>
              <Languages size={16}/>{lang === 'en' ? 'বাংলা' : 'English'}
            </button>
          </div>
        </header>

        <div className="page-wrap"><Outlet/></div>
      </main>
    </div>
  );
}
