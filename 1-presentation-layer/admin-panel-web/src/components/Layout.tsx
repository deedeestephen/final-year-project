import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../auth/session-context';
import { Brand, NationalStripe } from './ui';
import { NOT_OFFICIAL } from './messages';

const NAV = [
  { to: '/users', label: 'Users' },
  { to: '/roles', label: 'Roles & permissions' },
  { to: '/patient-accounts', label: 'Patient accounts' },
];

/** Sidebar on wide screens; a Menu button opens it on narrow screens. */
export function Layout() {
  const { session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const user = session.status === 'signedIn' ? session.user : null;

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
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
          <Brand subtitle="Administration" />
          {user && (
            <span className="who">
              <strong>{user.displayName}</strong>
              <span>{user.email}</span>
            </span>
          )}
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
        <NationalStripe />
      </header>
      <nav
        id="sidebar"
        className={`sidebar${open ? ' open' : ''}`}
        aria-label="Main"
      >
        <span className="nav-label" aria-hidden="true">
          Manage
        </span>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              isActive || location.pathname.startsWith(`${item.to}/`)
                ? 'active'
                : ''
            }
          >
            {item.label}
          </NavLink>
        ))}
        <p className="muted footer-note">{NOT_OFFICIAL}</p>
      </nav>
      <main id="main" className="content">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
