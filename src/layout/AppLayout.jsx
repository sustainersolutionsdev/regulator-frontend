import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const NAV_ITEMS = [
  { path: '/roadmap', label: 'Roadmap' },
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/ai-insights', label: 'AI Insights' },
  { path: '/add-regulation', label: 'Add Regulation' },
  { path: '/directory', label: 'Users / Directory' },
  { path: '/settings', label: 'Settings', title: 'Tenant & Business Unit Setup' },
];

function roleChipLabel(role) {
  if (role === 'user') return 'User · edit own BU only';
  if (role === 'admin') return 'Admin';
  if (role === 'sme') return 'SME';
  return role ?? 'Unknown';
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
        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Tenant</div>
        <div className="text-sm text-white truncate mt-0.5">{claims?.tenantId ?? 'Loading...'}</div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" aria-label="Main">
        {NAV_ITEMS.map(({ path, label }) => (
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
        <div className="text-xs text-slate-400 truncate">{claims?.role ? roleChipLabel(claims.role) : ''}</div>
        <button
          type="button"
          onClick={logout}
          className="text-xs text-slate-500 hover:text-white mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function TopBar() {
  const { claims } = useAuth();
  const location = useLocation();
  const [isDark, setIsDark] = useDarkMode();
  const current = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const title = current?.title ?? current?.label ?? '';

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
        <span className="text-label uppercase tracking-wide text-text-secondary dark:text-slate-400 bg-surface-muted dark:bg-surface-muted-dark px-2.5 py-1 rounded-full">
          {roleChipLabel(claims?.role)}
        </span>
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