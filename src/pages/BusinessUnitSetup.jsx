import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchBusinessUnits, createBusinessUnit, renameBusinessUnit, BusinessUnitApiError } from '../api/businessUnitsApi';
import ErrorBanner from '../components/ErrorBanner';

// Static per Requirements Doc Section on roles (resolved Aug 26/30, 2026).
// Not sourced from an API — this model is fixed, not tenant-configurable.
const ROLE_MODEL = [
  {
    role: 'Admin',
    scope: 'All Business Units, tenant-wide',
    detail: 'Functionally identical to SME. Can configure Business Units, manage users, and edit dashboard content across every Business Unit in the tenant.',
  },
  {
    role: 'SME',
    scope: 'All Business Units, tenant-wide',
    detail: 'Functionally identical to Admin — the two labels exist for org clarity only, not access control.',
  },
  {
    role: 'User',
    scope: 'Assigned Business Unit(s) only',
    detail: 'Can view everything tenant-wide, but can only edit dashboard status, notes, and documents within their assigned Business Unit(s). Attempting to edit outside that scope returns a clear on-screen error, not a silent block.',
  },
];

/**
 * One Business Unit row. Admin/SME can rename the unit (Srinivas, Oct 24 US,
 * item 7): the name changes everywhere, the code stays, so regulations,
 * statuses and people assigned to it are unaffected. Deactivating a unit
 * waits for Srinivas's decision (OPEN-18).
 */
function BusinessUnitRow({ bu, canConfigure, idToken, onRenamed }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bu.label);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputId = `bu-rename-${bu.code}`;

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await renameBusinessUnit(idToken, bu.code, name.trim());
      setEditing(false);
      onRenamed();
    } catch (err) {
      setError(err instanceof BusinessUnitApiError ? err.message : 'Failed to rename the Business Unit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-border-default dark:border-border-dark align-top">
      <td className="py-2 cfr text-brand-teal dark:text-teal-300">{bu.code}</td>
      <td className="py-2 text-text-primary dark:text-white">
        {editing ? (
          <form onSubmit={save} className="space-y-1.5">
            <label htmlFor={inputId} className="sr-only">New name for {bu.code}</label>
            <input
              id={inputId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditing(false);
                  setName(bu.label);
                  setError(null);
                }
              }}
              className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-1.5 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                aria-disabled={saving || undefined}
                className="bg-brand-teal text-white rounded-md px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
              >
                {saving ? 'Saving…' : 'Save name'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(bu.label);
                  setError(null);
                }}
                className="text-xs px-2 py-1 text-text-secondary dark:text-slate-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
              >
                Cancel
              </button>
            </div>
            <ErrorBanner message={error} />
          </form>
        ) : (
          bu.label
        )}
      </td>
      {canConfigure && (
        <td className="py-2 text-right">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Rename ${bu.label} (${bu.code})`}
              className="text-xs px-2 py-0.5 rounded border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal dark:hover:border-teal-300 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              Rename
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

export default function BusinessUnitSetup() {
  const { idToken, claims } = useAuth();
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Bumping this re-runs the load effect (e.g. after creating a Business Unit).
  const [reloadKey, setReloadKey] = useState(0);

  const [buCode, setBuCode] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const canConfigure = claims?.role === 'admin' || claims?.role === 'sme';

  // State is only set inside the promise callbacks, never synchronously in
  // the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!idToken) return undefined;
    let cancelled = false;
    fetchBusinessUnits(idToken)
      .then((data) => {
        if (cancelled) return;
        setBusinessUnits(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof BusinessUnitApiError ? err.message : 'Failed to load Business Units.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, reloadKey]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createBusinessUnit(idToken, buCode.trim(), label.trim());
      setBuCode('');
      setLabel('');
      setReloadKey((k) => k + 1);
    } catch (err) {
      setSubmitError(err instanceof BusinessUnitApiError ? err.message : 'Failed to create Business Unit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg p-5">
        <h2 className="text-h3 text-brand-navy dark:text-white mb-3">Role Model</h2>
        <div className="space-y-3">
          {ROLE_MODEL.map((r) => (
            <div key={r.role} className="flex gap-4 text-body">
              <span className="w-16 flex-shrink-0 font-semibold text-brand-navy dark:text-white">{r.role}</span>
              <div>
                <div className="text-text-secondary dark:text-slate-400">{r.scope}</div>
                <div className="text-text-tertiary dark:text-slate-300 text-label mt-0.5">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg p-5">
        <h2 className="text-h3 text-brand-navy dark:text-white mb-3">Business Units</h2>

        {loading && <p className="text-body text-text-secondary dark:text-slate-400">Loading...</p>}
        <ErrorBanner message={loadError} />

        {!loading && !loadError && (
          <table role="grid" className="w-full text-body mb-5">
            <thead>
              <tr className="border-b border-border-default dark:border-border-dark text-label uppercase text-text-tertiary dark:text-slate-300">
                <th scope="col" className="text-left py-2">Code</th>
                <th scope="col" className="text-left py-2">Label</th>
                {canConfigure && <th scope="col" className="text-right py-2"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {businessUnits.length === 0 ? (
                <tr><td colSpan={canConfigure ? 3 : 2} className="py-3 text-text-tertiary dark:text-slate-300">No Business Units yet.</td></tr>
              ) : (
                businessUnits.map((bu) => (
                  <BusinessUnitRow
                    key={bu.id}
                    bu={bu}
                    canConfigure={canConfigure}
                    idToken={idToken}
                    onRenamed={() => setReloadKey((k) => k + 1)}
                  />
                ))
              )}
            </tbody>
          </table>
        )}

        {canConfigure ? (
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
            <div>
              <label htmlFor="bu_code" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">Code</label>
              <input
                id="bu_code"
                value={buCode}
                onChange={(e) => setBuCode(e.target.value)}
                required
                placeholder="BU3"
                className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-32"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="bu_label" className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">Label</label>
              <input
                id="bu_label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                placeholder="Data Centers"
                className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-teal text-white rounded-md px-4 py-2 text-body font-medium disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Add Business Unit'}
            </button>
          </form>
        ) : (
          <p className="text-body text-text-tertiary dark:text-slate-300">
            Only Admin or SME accounts can add Business Units.
          </p>
        )}

        <div className="mt-3"><ErrorBanner message={submitError} /></div>
      </section>
    </div>
  );
}
