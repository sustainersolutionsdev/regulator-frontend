import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUsers, UserApiError } from '../api/usersApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import ErrorBanner from '../components/ErrorBanner';
import AddUsersForm from '../components/AddUsersForm';

const ROLE_CONFIG = {
  admin: { label: 'Admin', bg: 'bg-brand-teal/10 dark:bg-brand-teal/20', text: 'text-brand-teal dark:text-teal-300', border: 'border-brand-teal/30', dot: 'bg-brand-teal' },
  sme:   { label: 'SME',   bg: 'bg-violet-50 dark:bg-violet-900/20',     text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-700', dot: 'bg-violet-500' },
  user:  { label: 'User',  bg: 'bg-surface-muted dark:bg-slate-800',     text: 'text-text-secondary dark:text-slate-300', border: 'border-border-default dark:border-border-dark', dot: 'bg-slate-400' },
};

const ROLE_FILTERS = ['All Roles', 'admin', 'sme', 'user'];
const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'name-desc', label: 'Name Z-A' },
  { value: 'role', label: 'Role' },
];

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.user;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border text-xs px-2 py-0.5 font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

function initialsFor(name, email) {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function UserCard({ user, buLabelByCode }) {
  const buLabels = (user.businessUnitIds || []).map((code) => buLabelByCode[code] || code);

  return (
    <article className="flex flex-col bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-brand-navy dark:bg-slate-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0" aria-hidden="true">
          {initialsFor(user.displayName, user.email)}
        </div>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-semibold text-text-primary dark:text-white truncate leading-tight">
            {user.displayName || user.email}
                    </div>
          <a href={`mailto:${user.email}`} className="text-xs text-text-tertiary hover:text-brand-teal truncate block mt-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-teal rounded-sm">
            {user.email}
          </a>
        </div>
      </div>

      <div className="mb-3">
        <RoleBadge role={user.role} />
      </div>

      <div className="flex flex-wrap gap-1 mt-auto pt-2 border-t border-border-default dark:border-border-dark">
        {buLabels.length === 0 ? (
          <span className="text-[11px] text-text-tertiary">No Business Unit assigned</span>
        ) : (
          buLabels.map((label, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted dark:bg-slate-800 text-text-tertiary border border-border-default dark:border-border-dark">
              {label}
            </span>
          ))
        )}
      </div>
    </article>
  );
}

export default function PeopleDirectory() {
  const { idToken, claims } = useAuth();

  const [users, setUsers] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [sort, setSort] = useState('name-asc');

  const canConfigure = claims?.role === 'admin' || claims?.role === 'sme';

  const loadDirectory = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [userList, buList] = await Promise.all([
        fetchUsers(idToken),
        fetchBusinessUnits(idToken),
      ]);
      setUsers(userList);
      setBusinessUnits(buList);
    } catch (err) {
      setLoadError(err instanceof UserApiError ? err.message : 'Failed to load the directory.');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const buLabelByCode = useMemo(
    () => Object.fromEntries(businessUnits.map((bu) => [bu.code, bu.label])),
    [businessUnits]
  );

  const filtered = useMemo(() => {
    let list = users.filter((u) => !u.hidden);

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (u) => (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
      );
    }

    if (roleFilter !== 'All Roles') {
      list = list.filter((u) => u.role === roleFilter);
    }

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return (a.displayName || a.email).localeCompare(b.displayName || b.email);
        case 'name-desc':
          return (b.displayName || b.email).localeCompare(a.displayName || a.email);
        case 'role':
          return a.role.localeCompare(b.role);
        default:
          return 0;
      }
    });
  }, [users, query, roleFilter, sort]);

  return (
    <div className="space-y-6 max-w-5xl">
      {canConfigure && (
        <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg p-5">
          <h2 className="text-h3 text-brand-navy dark:text-white mb-3">Add User</h2>
          <AddUsersForm onUserAdded={loadDirectory} />
        </section>
      )}

      <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg p-5">
        <h2 className="text-h3 text-brand-navy dark:text-white mb-4">People &amp; Directory</h2>

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <input
            type="search"
            aria-label="Search users by name or email"
            placeholder="Search name or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[220px] max-w-xs px-3 py-2 text-body bg-surface-page dark:bg-surface-muted-dark border border-border-default dark:border-border-dark rounded-md text-text-primary dark:text-white placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />

          <div className="flex items-center gap-1.5" role="group" aria-label="Filter by role">
            {ROLE_FILTERS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={roleFilter === r}
                onClick={() => setRoleFilter(r)}
                className={[
                  'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal',
                  roleFilter === r
                    ? 'bg-brand-teal text-white border-brand-teal'
                    : 'bg-surface-card dark:bg-surface-card-dark border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal',
                ].join(' ')}
              >
                {r === 'All Roles' ? r : ROLE_CONFIG[r].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <label htmlFor="dir-sort" className="text-label text-text-tertiary whitespace-nowrap">Sort by</label>
            <select
              id="dir-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-xs bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-md px-2 py-1.5 text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="text-label text-text-tertiary whitespace-nowrap" aria-live="polite" aria-atomic="true">
            {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
          </div>
        </div>

        {loading && <p className="text-body text-text-secondary dark:text-slate-400">Loading...</p>}
        <ErrorBanner message={loadError} />

        {!loading && !loadError && (
          filtered.length === 0 ? (
            <p className="text-body text-text-tertiary text-center py-10">
              {query ? `No results for "${query}".` : 'No users match the selected filters.'}
            </p>
          ) : (
            <ul role="list" aria-label="User directory" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((u) => (
                <li key={u.id} className="contents">
                  <UserCard user={u} buLabelByCode={buLabelByCode} />
                </li>
              ))}
            </ul>
          )
        )}
      </section>
    </div>
  );
}