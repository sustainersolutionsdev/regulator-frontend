import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateRegulation, removeRegulation, RegulationApiError } from '../api/regulationsApi';
import { DOMAIN_OPTIONS } from '../constants/domains';
import ErrorBanner from './ErrorBanner';

/**
 * RegulationEditPanel - edit or remove one regulation (T014, FR-1.4).
 *
 * Opened from the Roadmap timeline and the monthly calendar. Admin and SME
 * only (Srinivas, Oct 13 2026); callers render the trigger for those roles
 * only, and the backend refuses everyone else with 403 regardless.
 *
 * No compliance status here (DL-8, Srinivas Oct 16 2026): status is per
 * Business Unit and is set on the Dashboard (StatusUpdatePanel), by Admin/SME
 * for any unit and by Users for their own. T018's single-status section was
 * removed in T020.
 *
 * Remove is a soft delete: the regulation disappears from every screen but
 * is never erased, and the change is audited (NFR-8, NFR-2).
 *
 * Supporting documents are listed but not edited here; document changes
 * come with the Dashboard (T020).
 *
 * Built on the native <dialog> element: showModal() gives focus trapping,
 * Esc-to-close and an inert background without extra code.
 *
 * Props:
 *   regulation     the record to edit (as returned by GET /regulations)
 *   businessUnits  [{ code, label }] for the tenant
 *   onClose()      called when the panel closes without a change
 *   onSaved()      called after a successful save or removal
 */

const fieldLabel = 'block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1';
const fieldInput =
  'w-full text-body bg-surface-page dark:bg-surface-muted-dark border border-border-default dark:border-border-dark rounded-md px-3 py-2 text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-teal';

function initialForm(reg) {
  return {
    title: reg.title || '',
    abbreviatedTitle: reg.abbreviatedTitle || '',
    dueDate: (reg.dueDate || '').slice(0, 10),
    domain: reg.domain || '',
    country: reg.country || '',
    region: reg.region || '',
    businessUnitIds: [...(reg.businessUnitIds || [])],
    notes: reg.notes || '',
    addToRoadmapDashboard: reg.addToRoadmapDashboard === true,
  };
}

// Maps form state to the API's snake_case fields, sending only what changed.
function changedFields(original, form) {
  const map = {
    title: 'title',
    abbreviatedTitle: 'abbreviated_title',
    dueDate: 'due_date',
    domain: 'domain',
    country: 'country',
    region: 'region',
    notes: 'notes',
    addToRoadmapDashboard: 'add_to_roadmap_dashboard',
  };
  const out = {};
  for (const [key, apiKey] of Object.entries(map)) {
    const next = typeof form[key] === 'string' ? form[key].trim() : form[key];
    if (next !== original[key]) out[apiKey] = next;
  }
  const a = [...original.businessUnitIds].sort().join('|');
  const b = [...form.businessUnitIds].sort().join('|');
  if (a !== b) out.business_unit_ids = form.businessUnitIds;
  return out;
}

export default function RegulationEditPanel({ regulation, businessUnits, onClose, onSaved }) {
  const { idToken } = useAuth();
  const dialogRef = useRef(null);
  const titleId = useId();
  const confirmId = useId();
  const domainListId = useId();
  const ids = {
    title: useId(),
    abbr: useId(),
    due: useId(),
    domain: useId(),
    country: useId(),
    region: useId(),
    notes: useId(),
  };

  const [original] = useState(() => initialForm(regulation));
  const [form, setForm] = useState(() => initialForm(regulation));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Open as a modal on mount; on unmount, close it and hand focus back to
  // whatever opened the panel (or to <main> if that element is gone, e.g.
  // the regulation was just removed) so keyboard users aren't dropped.
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      const target = opener && opener.isConnected ? opener : document.getElementById('main-content');
      target?.focus();
    };
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleBu = (code) =>
    set({
      businessUnitIds: form.businessUnitIds.includes(code)
        ? form.businessUnitIds.filter((c) => c !== code)
        : [...form.businessUnitIds, code],
    });

  const changes = changedFields(original, form);
  const hasChanges = Object.keys(changes).length > 0;

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.businessUnitIds.length === 0) {
      setError('Tag at least one Business Unit.');
      return;
    }
    if (!hasChanges) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateRegulation(idToken, regulation.id, changes);
      onSaved();
    } catch (err) {
      setError(err instanceof RegulationApiError ? formatDetail(err) : 'Failed to save changes.');
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setSaving(true);
    try {
      await removeRegulation(idToken, regulation.id);
      onSaved();
    } catch (err) {
      setError(err instanceof RegulationApiError ? formatDetail(err) : 'Failed to remove the regulation.');
      setSaving(false);
      setConfirmingRemove(false);
    }
  };

  const docs = (regulation.documents || []).filter((d) => !d.hidden);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
      className="m-0 ml-auto h-full max-h-none w-full max-w-lg p-0 bg-surface-card dark:bg-surface-card-dark text-text-primary dark:text-white border-l border-border-default dark:border-border-dark shadow-2xl backdrop:bg-brand-navy/50"
    >
      <form onSubmit={handleSave} className="flex flex-col h-full">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-default dark:border-border-dark">
          <div className="min-w-0">
            <h2 id={titleId} className="text-h3 text-brand-navy dark:text-white">
              Edit regulation
            </h2>
            <p className="text-xs text-text-secondary dark:text-slate-400 truncate" title={regulation.title}>
              {regulation.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-text-secondary dark:text-slate-300 hover:text-brand-teal dark:hover:text-teal-300 text-lg leading-none px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            &times;
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label htmlFor={ids.title} className={fieldLabel}>Title *</label>
            <input
              id={ids.title}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              required
              className={fieldInput}
            />
          </div>

          <div>
            <label htmlFor={ids.abbr} className={fieldLabel}>Abbreviated title</label>
            <input
              id={ids.abbr}
              value={form.abbreviatedTitle}
              onChange={(e) => set({ abbreviatedTitle: e.target.value })}
              className={fieldInput}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={ids.due} className={fieldLabel}>Due date *</label>
              <input
                id={ids.due}
                type="date"
                value={form.dueDate}
                onChange={(e) => set({ dueDate: e.target.value })}
                required
                className={`${fieldInput} dark:[color-scheme:dark]`}
              />
            </div>
            <div>
              <label htmlFor={ids.domain} className={fieldLabel}>Domain *</label>
              <input
                id={ids.domain}
                list={domainListId}
                value={form.domain}
                onChange={(e) => set({ domain: e.target.value })}
                required
                className={fieldInput}
              />
              <datalist id={domainListId}>
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={ids.country} className={fieldLabel}>Country</label>
              <input
                id={ids.country}
                value={form.country}
                onChange={(e) => set({ country: e.target.value })}
                className={fieldInput}
              />
            </div>
            <div>
              <label htmlFor={ids.region} className={fieldLabel}>Region</label>
              <input
                id={ids.region}
                value={form.region}
                onChange={(e) => set({ region: e.target.value })}
                className={fieldInput}
              />
            </div>
          </div>

          <fieldset>
            <legend className={fieldLabel}>Business Units *</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {businessUnits.map((bu) => (
                <label key={bu.code} className="flex items-center gap-2 text-body text-text-primary dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.businessUnitIds.includes(bu.code)}
                    onChange={() => toggleBu(bu.code)}
                    className="accent-brand-teal"
                  />
                  {bu.label} <span className="text-xs text-text-tertiary dark:text-slate-400">({bu.code})</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={ids.notes} className={fieldLabel}>Notes</label>
            <textarea
              id={ids.notes}
              rows={4}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              className={fieldInput}
            />
          </div>

          <fieldset>
            <legend className={fieldLabel}>Add to Roadmap and Dashboard</legend>
            <div className="flex gap-4">
              {[true, false].map((v) => (
                <label key={String(v)} className="flex items-center gap-2 text-body text-text-primary dark:text-slate-200">
                  <input
                    type="radio"
                    name="edit-add-to-roadmap"
                    checked={form.addToRoadmapDashboard === v}
                    onChange={() => set({ addToRoadmapDashboard: v })}
                    className="accent-brand-teal"
                  />
                  {v ? 'Yes' : 'No'}
                </label>
              ))}
            </div>
            {!form.addToRoadmapDashboard && original.addToRoadmapDashboard && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Saving with &ldquo;No&rdquo; takes this regulation off the Roadmap, calendar and Dashboard.
              </p>
            )}
          </fieldset>

          <div>
            <p className={fieldLabel}>Supporting documents</p>
            {docs.length === 0 ? (
              <p className="text-body text-text-tertiary dark:text-slate-400">None attached.</p>
            ) : (
              <ul className="text-body text-text-primary dark:text-slate-200 list-disc pl-5">
                {docs.map((d) => (
                  <li key={d.key || d.gcsUri}>{d.fileName}</li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-text-tertiary dark:text-slate-400">
              Documents are added and replaced from the Dashboard.
            </p>
          </div>

          <ErrorBanner message={error} />
        </div>

        <footer className="px-5 py-4 border-t border-border-default dark:border-border-dark space-y-3">
          {confirmingRemove ? (
            <div role="group" aria-labelledby={confirmId} className="rounded-md border border-status-action-border bg-status-action-bg px-3 py-2.5 space-y-2">
              <p id={confirmId} className="text-body text-red-700">
                Remove this regulation? It disappears from the Roadmap, calendar and Dashboard. The record and its
                history are kept and it can be restored.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={saving}
                  autoFocus
                  className="bg-status-action-text text-white rounded-md px-3 py-1.5 text-body font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
                >
                  {saving ? 'Removing...' : 'Confirm remove'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  disabled={saving}
                  className="rounded-md px-3 py-1.5 text-body border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-brand-teal text-white rounded-md px-4 py-2 text-body font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-md px-4 py-2 text-body border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                disabled={saving}
                className="ml-auto text-body text-red-700 dark:text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded px-1"
              >
                Remove regulation
              </button>
            </div>
          )}
        </footer>
      </form>
    </dialog>
  );
}

// FastAPI returns validation problems as a list; show them as one sentence.
function formatDetail(err) {
  return Array.isArray(err.detail) ? err.detail.join('; ') : err.message;
}
