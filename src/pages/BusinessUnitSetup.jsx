import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchBusinessUnits, createBusinessUnit, BusinessUnitApiError } from '../api/businessUnitsApi';
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


export default function BusinessUnitSetup() {
  const { idToken, claims } = useAuth();
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [buCode, setBuCode] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const canConfigure = claims?.role === 'admin' || claims?.role === 'sme';

  const loadBusinessUnits = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchBusinessUnits(idToken);
      setBusinessUnits(data);
    } catch (err) {
      setLoadError(err instanceof BusinessUnitApiError ? err.message : 'Failed to load Business Units.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (idToken) loadBusinessUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      await createBusinessUnit(idToken, buCode.trim(), label.trim());
      setBuCode('');
      setLabel('');
      await loadBusinessUnits();
    } catch (err) {
      setSubmitError(err instanceof BusinessUnitApiError ? err.message : 'Failed to create Business Unit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="bg-surface-card border border-border-default rounded-lg p-5">
        <h2 className="text-h3 text-brand-navy mb-3">Role Model</h2>
        <div className="space-y-3">
          {ROLE_MODEL.map((r) => (
            <div key={r.role} className="flex gap-4 text-body">
              <span className="w-16 flex-shrink-0 font-semibold text-brand-navy">{r.role}</span>
              <div>
                <div className="text-text-secondary">{r.scope}</div>
                <div className="text-text-tertiary text-label mt-0.5">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-card border border-border-default rounded-lg p-5">
        <h2 className="text-h3 text-brand-navy mb-3">Business Units</h2>

        {loading && <p className="text-body text-text-secondary">Loading...</p>}
        <ErrorBanner message={loadError} />

        {!loading && !loadError && (
          <table role="grid" className="w-full text-body mb-5">
            <thead>
              <tr className="border-b border-border-default text-label uppercase text-text-tertiary">
                <th scope="col" className="text-left py-2">Code</th>
                <th scope="col" className="text-left py-2">Label</th>
              </tr>
            </thead>
            <tbody>
              {businessUnits.length === 0 ? (
                <tr><td colSpan={2} className="py-3 text-text-tertiary">No Business Units yet.</td></tr>
              ) : (
                businessUnits.map((bu) => (
                  <tr key={bu.id} className="border-b border-border-default">
                    <td className="py-2 cfr text-brand-teal">{bu.code}</td>
                    <td className="py-2 text-text-primary">{bu.label}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {canConfigure ? (
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
            <div>
              <label htmlFor="bu_code" className="block text-label uppercase text-text-tertiary mb-1">Code</label>
              <input
                id="bu_code"
                value={buCode}
                onChange={(e) => setBuCode(e.target.value)}
                required
                placeholder="BU3"
                className="border border-border-default rounded-md px-3 py-2 text-body w-32"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="bu_label" className="block text-label uppercase text-text-tertiary mb-1">Label</label>
              <input
                id="bu_label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                placeholder="Data Centers"
                className="border border-border-default rounded-md px-3 py-2 text-body w-full"
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
          <p className="text-body text-text-tertiary">
            Only Admin or SME accounts can add Business Units.
          </p>
        )}

        <div className="mt-3"><ErrorBanner message={submitError} /></div>
      </section>

         </div>
  );
}