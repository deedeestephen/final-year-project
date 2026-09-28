import {
  FileOutput,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  UserRoundCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../auth/session-context';
import { Brand, NationalStripe } from './ui';
import { NOT_OFFICIAL } from './messages';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only an exact match marks it current (the dashboard at "/"). */
  end?: boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'People',
    items: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/roles', label: 'Roles & permissions', icon: ShieldCheck },
      {
        to: '/patient-accounts',
        label: 'Patient accounts',
        icon: UserRoundCheck,
      },
    ],
  },
  {
    title: 'Records & data',
    items: [
      { to: '/fhir-export', label: 'FHIR export', icon: FileOutput },
      { to: '/audit-log', label: 'Audit log', icon: ScrollText },
    ],
  },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

/** Dark sidebar on wide screens; a Menu button opens it on narrow screens. */
export function Layout() {
  const { session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const user = session.status === 'signedIn' ? session.user : null;
  const current = (item: NavItem) =>
    item.end
      ? location.pathname === item.to
      : location.pathname === item.to ||
        location.pathname.startsWith(`${item.to}/`);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="menu-button"
            aria-expanded={open}
            aria-controls="sidebar"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}
            <span className="menu-text">Menu</span>
          </button>
          <Brand subtitle="Administration" />
          {user && (
            <span className="who">
              <span className="avatar" aria-hidden="true">
                {initials(user.displayName)}
              </span>
              <span className="who-text">
                <strong>{user.displayName}</strong>
                <span>{user.email}</span>
              </span>
            </span>
          )}
          <button className="signout" onClick={() => void signOut()}>
            <LogOut size={18} aria-hidden="true" />
            Sign out
          </button>
        </div>
        <NationalStripe />
      </header>
      <nav
        id="sidebar"
        className={`sidebar${open ? ' open' : ''}`}
        aria-label="Main"
      >
        {SECTIONS.map((section) => (
          <div className="nav-section" key={section.title}>
            <span className="nav-label" aria-hidden="true">
              {section.title}
            </span>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={current(item) ? 'active' : ''}
                  aria-current={current(item) ? 'page' : undefined}
                >
                  <Icon size={20} aria-hidden="true" className="nav-icon" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
        <div className="nav-footer">
          <span className="env-chip">Synthetic data only</span>
          <p className="footer-note">{NOT_OFFICIAL}</p>
        </div>
      </nav>
      <main id="main" className="content">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
