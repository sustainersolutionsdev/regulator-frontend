import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { ADMIN_SME_PATHS, isAdminOrSme } from '../constants/access';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
const APP_COMMIT = import.meta.env.VITE_APP_COMMIT || '';

const NAV_ITEMS = [
  { path: '/roadmap', label: 'Roadmap', title: 'Regulation Roadmap' },
  { path: '/dashboard', label: 'Dashboard', title: 'Compliance Dashboard' },
  { path: '/ai-insights', label: 'AI Insights' },
  { path: '/add-regulation', label: 'Add Regulation' },
  { path: '/directory', label: 'Users / Directory' },
  { path: '/settings', label: 'Settings', title: 'Tenant & Business Unit Setup' },
];

// T066 (Niranjan, Oct 27): the menu shows only the pages the role can use.
function navFor(role) {
  return NAV_ITEMS.filter((item) => isAdminOrSme(role) || !ADMIN_SME_PATHS.includes(item.path));
}

// T025 (DL-9): each person's own email alert setting. Not a main nav item:
// it is a personal setting, so it sits with Sign out at the foot of the sidebar.
const EMAIL_ALERTS_PATH = '/account/email-alerts';

const ROLE_NAMES = { admin: 'Admin', sme: 'SME', user: 'User' };

/**
 * T066 (Niranjan, Oct 27): who is signed in, shown top right and bottom left:
 * the person's name, and their role with the Business Units it covers.
 */
function useIdentity() {
  const { claims, profile, user, idToken } = useAuth();
  const [unitNames, setUnitNames] = useState({});
  const isUser = claims?.role === 'user';

  useEffect(() => {
    if (!idToken || !isUser) return undefined;
    let cancelled = false;
    fetchBusinessUnits(idToken)
      .then((list) => {
        if (!cancelled) setUnitNames(Object.fromEntries(list.map((bu) => [bu.code, bu.label])));
      })
      .catch(() => {
        // Codes stand in for names.
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, isUser]);

  const name = profile?.displayName || profile?.email || user?.email || '';
  const role = ROLE_NAMES[claims?.role] || claims?.role || '';
  const units = (claims?.businessUnitIds || []).map((code) => unitNames[code] || code);
  const scope = isUser ? units.join(', ') || 'no Business Units' : 'all Business Units';
  const initials =
    name
      .replace(/@.*/, '')
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?';
  return { name, role, roleLine: role ? `${role} · ${scope}` : '', initials };
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return [isDark, setIsDark];
}

function Sidebar() {
  const { claims, logout } = useAuth();
  const me = useIdentity();

  return (
    <aside
      aria-label="Primary navigation"
      className="w-56 flex-shrink-0 flex flex-col bg-brand-navy border-r border-border-dark"
    >
      <div className="h-16 flex flex-col justify-center px-4 border-b border-border-dark">
        <div className="text-base font-bold text-white leading-none tracking-tight">Regulator</div>
        <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">by Sustainer</div>
      </div>

      <div className="px-4 py-3 border-b border-border-dark">
        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Tenant</div>
        <div className="text-sm text-white truncate mt-0.5">{claims?.tenantId ?? 'Loading...'}</div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" aria-label="Main">
        {navFor(claims?.role).map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 px-3 py-2 text-body transition-colors border-l-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1 focus-visible:ring-offset-brand-navy',
                isActive
                  ? 'border-l-brand-teal bg-white/5 text-white font-medium'
                  : 'border-l-transparent text-slate-400 hover:bg-white/5 hover:text-white',
              ].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-border-dark">
        <p className="text-sm font-medium text-white truncate" title={me.name}>{me.name}</p>
        <p className="text-xs text-slate-300 truncate" title={me.roleLine}>{me.roleLine}</p>
        <NavLink
          to={EMAIL_ALERTS_PATH}
          className={({ isActive }) =>
            [
              'block text-xs mt-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded',
              isActive ? 'text-white font-medium' : 'text-slate-400',
            ].join(' ')
          }
        >
          Email alerts
        </NavLink>
        <button
          type="button"
          onClick={logout}
          className="text-xs text-slate-400 hover:text-white mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
        >
          Sign out
        </button>
        {/* T058: which release is running, to quote in bug reports. T066: the
            build code is not for end users; it stays in the tooltip. */}
        <p className="mt-2 text-[11px] text-slate-400 font-mono" title={APP_COMMIT ? `Build ${APP_COMMIT}` : undefined}>
          v{APP_VERSION}
        </p>
      </div>
    </aside>
  );
}

function pageTitle(pathname) {
  if (pathname.startsWith('/roadmap/calendar')) return 'Monthly Calendar';
  if (pathname.startsWith(EMAIL_ALERTS_PATH)) return 'Email Alerts';
  const current = NAV_ITEMS.find((item) => pathname.startsWith(item.path));
  return current?.title ?? current?.label ?? '';
}

function TopBar() {
  const me = useIdentity();
  const location = useLocation();
  const [isDark, setIsDark] = useDarkMode();
  const title = pageTitle(location.pathname);

  return (
    <header
      role="banner"
      className="h-12 flex-shrink-0 flex items-center justify-between px-6 bg-surface-card dark:bg-surface-card-dark border-b border-border-default dark:border-border-dark"
    >
      <h1 className="text-h3 text-brand-navy dark:text-white">{title}</h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="text-text-secondary dark:text-slate-400 hover:text-brand-teal text-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded px-2 py-1"
        >
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
        <div className="flex items-center gap-2 pl-1 pr-3 py-0.5 rounded-full border border-border-default dark:border-border-dark">
          <span
            aria-hidden="true"
            className="w-7 h-7 rounded-full bg-brand-navy dark:bg-slate-600 text-white text-[11px] font-semibold flex items-center justify-center"
          >
            {me.initials}
          </span>
          <span className="flex flex-col leading-tight max-w-[16rem]">
            <span className="text-xs font-semibold text-text-primary dark:text-white truncate">{me.name}</span>
            <span className="text-[11px] text-text-secondary dark:text-slate-300 truncate">{me.roleLine}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

export default function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-page dark:bg-surface-page-dark">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6 focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}