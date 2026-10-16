import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  RegulationApiError,
  addRegulationDocument,
  downloadRegulationDocument,
  hideRegulationDocument,
  updateBuStatus,
} from '../api/regulationsApi';
import { STATUS_META, STATUS_VALUES, statusLabel } from '../constants/status';
import { formatTimestamp, unitEntry, visibleDocuments } from '../utils/dashboardTable';
import ErrorBanner from './ErrorBanner';
import StatusSwatch from './StatusSwatch';

/**
 * StatusUpdatePanel - update compliance status from the Dashboard
 * (T020, FR-2.3 as changed by DL-8, Srinivas Oct 16 2026).
 *
 * One section per Business Unit on the regulation:
 *  - a unit the person may edit (Admin/SME: all; User: their own) gets the
 *    status choice, the explanation box and "Add a document";
 *  - any other unit is shown read-only, with a clear on-screen message
 *    explaining why it can't be changed (FR-0.2, FR-2.3).
 * Users never see or edit the SME's main Notes here (DL-8: explanation only).
 *
 * Below the units: the regulation's supporting documents - everyone can
 * download; Admin/SME can hide one (soft, never erased).
 *
 * The server enforces every rule again (403 / 400); any refusal is shown
 * through the shared ErrorBanner.
 *
 * Props:
 *   regulation     the latest record from GET /regulations (re-passed after
 *                  each save, so sections re-mount with fresh values)
 *   businessUnits  [{ code, label }] for the tenant
 *   focusBu        unit to list first (the row's unit in the By BU view)
 *   onClose()      closes the panel
 *   onChanged()    called after any save, upload or hide, to reload data
 */

const NOTE_MAX = 1000; // matches the backend limit

const fieldLabel = 'block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1';
const fieldInput =
  'w-full text-body bg-surface-page dark:bg-surface-muted-dark border border-border-default dark:border-border-dark rounded-md px-3 py-2 text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-teal';
const secondaryButton =
  'text-xs px-2.5 py-1.5 rounded-md border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal dark:hover:border-teal-300 dark:hover:text-teal-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal';

function errorText(err, fallback) {
  if (!(err instanceof RegulationApiError)) return fallback;
  return Array.isArray(err.detail) ? err.detail.join('; ') : err.message;
}

function UnitSection({ regulation, bu, label, canEdit, onDone }) {
  const { idToken } = useAuth();
  const entry = unitEntry(regulation, bu);
  const initialStatus = Object.prototype.hasOwnProperty.call(STATUS_META, entry.status) ? entry.status : '';
  const initialNote = entry.note || '';

  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const headingId = useId();
  const noteId = useId();
  const noteHintId = useId();
  const fileId = useId();

  const dirty = status !== initialStatus || note.trim() !== initialNote;
  const updated = formatTimestamp(entry.updatedAt);

  const save = async () => {
    setError(null);
    if (note.trim().length > NOTE_MAX) {
      setError(`The explanation must be ${NOTE_MAX.toLocaleString()} characters or fewer.`);
      return;
    }
    const changes = {};
    if (status !== initialStatus) changes.status = status || null;
    if (note.trim() !== initialNote) changes.note = note.trim();
    setSaving(true);
    try {
      await updateBuStatus(idToken, regulation.id, bu, changes);
      onDone(`Saved ${label}: ${changes.status !== undefined ? statusLabel(changes.status) : 'explanation updated'}.`);
    } catch (err) {
      setError(errorText(err, 'Failed to save the status.'));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await addRegulationDocument(idToken, regulation.id, bu, file);
      onDone(`Added "${file.name}" for ${label}.`);
    } catch (err) {
      setError(errorText(err, 'Failed to add the document.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-md border border-border-default dark:border-border-dark px-4 py-3 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="text-body font-semibold text-text-primary dark:text-white">
          {label} <span className="text-xs font-normal text-text-tertiary dark:text-slate-400">({bu})</span>
        </h3>
        {updated && (
          <span className="text-xs text-text-secondary dark:text-slate-400">Last updated {updated}</span>
        )}
      </div>

      {!canEdit ? (
        <>
          <p className="flex items-center gap-2 text-body text-text-primary dark:text-slate-200">
            <StatusSwatch status={entry.status} size="sm" decorative />
            {statusLabel(entry.status)}
          </p>
          <p className="text-body text-text-secondary dark:text-slate-300 whitespace-pre-line">
            {initialNote || 'No explanation given.'}
          </p>
          <p className="text-xs rounded-md bg-surface-muted dark:bg-surface-muted-dark px-3 py-2 text-text-secondary dark:text-slate-300">
            You are not assigned to {label}, so you can view its status but not change it.
          </p>
        </>
      ) : (
        <>
          <fieldset>
            <legend className={fieldLabel}>Status</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {[...STATUS_VALUES.slice().reverse(), ''].map((value) => (
                <label key={value || 'not-set'} className="flex items-center gap-2 text-body text-text-primary dark:text-slate-200">
                  <input
                    type="radio"
                    name={`status-${headingId}`}
                    checked={status === value}
                    onChange={() => setStatus(value)}
                    className="accent-brand-teal"
                  />
                  <StatusSwatch status={value || null} size="sm" decorative />
                  {value ? STATUS_META[value].label : 'Not set'}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={noteId} className={fieldLabel}>Explanation (optional)</label>
            <textarea
              id={noteId}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={noteHintId}
              className={fieldInput}
            />
            <p id={noteHintId} className="mt-1 text-xs text-text-tertiary dark:text-slate-400">
              Why {label} has this status. Written by you, never generated. {note.trim().length}/
              {NOTE_MAX.toLocaleString()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="bg-brand-teal text-white rounded-md px-3 py-1.5 text-body font-medium disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2"
            >
              {saving ? 'Saving...' : `Save ${label}`}
            </button>
            <label htmlFor={fileId} className={`${secondaryButton} cursor-pointer`}>
              {uploading ? 'Uploading...' : 'Add a document'}
            </label>
            <input
              id={fileId}
              ref={fileRef}
              type="file"
              onChange={upload}
              disabled={uploading}
              className="sr-only"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            />
            <span className="text-xs text-text-tertiary dark:text-slate-400">PDF, Word, Excel, PowerPoint or text, up to 25 MB</span>
          </div>
        </>
      )}

      <ErrorBanner message={error} />
    </section>
  );
}

function DocumentsList({ regulation, buLabelByCode, canHide, onDone }) {
  const { idToken } = useAuth();
  const [busyKey, setBusyKey] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);
  const [error, setError] = useState(null);
  const docs = visibleDocuments(regulation);

  const download = async (doc) => {
    setError(null);
    setBusyKey(doc.key);
    try {
      await downloadRegulationDocument(idToken, regulation.id, doc);
    } catch (err) {
      setError(errorText(err, 'Failed to download the document.'));
    } finally {
      setBusyKey(null);
    }
  };

  const hide = async (doc) => {
    setError(null);
    setBusyKey(doc.key);
    try {
      await hideRegulationDocument(idToken, regulation.id, doc.key);
      setConfirmKey(null);
      onDone(`Removed "${doc.fileName}" from the Dashboard.`);
    } catch (err) {
      setError(errorText(err, 'Failed to remove the document.'));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section aria-label="Supporting documents" className="space-y-2">
      <h3 className={fieldLabel}>Supporting documents</h3>
      {docs.length === 0 ? (
        <p className="text-body text-text-tertiary dark:text-slate-400">None attached.</p>
      ) : (
        <ul className="divide-y divide-border-default dark:divide-border-dark rounded-md border border-border-default dark:border-border-dark">
          {docs.map((doc) => (
            <li key={doc.key} className="px-3 py-2 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-body text-text-primary dark:text-slate-200" title={doc.fileName}>
                  {doc.fileName}
                </span>
                <span className="text-xs text-text-tertiary dark:text-slate-400">
                  {doc.buCode ? buLabelByCode[doc.buCode] || doc.buCode : 'All units'}
                </span>
                <button
                  type="button"
                  onClick={() => download(doc)}
                  disabled={busyKey === doc.key}
                  aria-label={`Download ${doc.fileName}`}
                  className={secondaryButton}
                >
                  Download
                </button>
                {canHide && confirmKey !== doc.key && (
                  <button
                    type="button"
                    onClick={() => setConfirmKey(doc.key)}
                    aria-label={`Remove ${doc.fileName}`}
                    className="text-xs px-1 text-red-700 dark:text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                  >
                    Remove
                  </button>
                )}
              </div>
              {canHide && confirmKey === doc.key && (
                <div role="group" aria-label={`Confirm removing ${doc.fileName}`} className="flex flex-wrap items-center gap-2 rounded-md border border-status-action-border bg-status-action-bg px-2.5 py-2">
                  <span className="text-xs text-red-700 flex-1">
                    Remove this document from the Dashboard? The file is kept and can be restored.
                  </span>
                  <button
                    type="button"
                    onClick={() => hide(doc)}
                    disabled={busyKey === doc.key}
                    autoFocus
                    className="text-xs bg-status-action-text text-white rounded-md px-2.5 py-1 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1"
                  >
                    Confirm remove
                  </button>
                  <button type="button" onClick={() => setConfirmKey(null)} className="text-xs px-2 py-1 rounded-md border border-border-default text-text-secondary bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorBanner message={error} />
    </section>
  );
}

export default function StatusUpdatePanel({ regulation, businessUnits, focusBu, onClose, onChanged }) {
  const { claims } = useAuth();
  const dialogRef = useRef(null);
  const titleId = useId();
  // Confirmation lives here, not in a unit section: a section re-mounts with
  // fresh values after its save, which would wipe its own message.
  const [notice, setNotice] = useState('');
  const done = (message) => {
    setNotice(message);
    onChanged();
  };
  const isAdminOrSme = claims?.role === 'admin' || claims?.role === 'sme';
  const myUnits = claims?.businessUnitIds || [];
  const buLabelByCode = Object.fromEntries(businessUnits.map((bu) => [bu.code, bu.label]));
  const canEdit = (bu) => isAdminOrSme || myUnits.includes(bu);

  // Same open/close/focus-return behaviour as RegulationEditPanel (T015 F6).
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

  const units = [...(regulation.businessUnitIds || [])].sort((a, b) => {
    const rank = (bu) => (bu === focusBu ? 0 : canEdit(bu) ? 1 : 2);
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 ml-auto h-full max-h-none w-full max-w-lg p-0 bg-surface-card dark:bg-surface-card-dark text-text-primary dark:text-white border-l border-border-default dark:border-border-dark shadow-2xl backdrop:bg-brand-navy/50"
    >
      <div className="flex flex-col h-full">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-default dark:border-border-dark">
          <div className="min-w-0">
            <h2 id={titleId} className="text-h3 text-brand-navy dark:text-white">Update status</h2>
            <p className="text-xs text-text-secondary dark:text-slate-400 truncate" title={regulation.title}>
              {regulation.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-secondary dark:text-slate-300 hover:text-brand-teal dark:hover:text-teal-300 text-lg leading-none px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            &times;
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p role="status" className="text-body rounded-md px-3 py-2 bg-status-compliant-bg text-green-700 dark:bg-green-900/30 dark:text-green-300 empty:hidden">
            {notice}
          </p>
          {units.map((bu) => (
            <UnitSection
              // Re-mount with fresh values after every save of this unit.
              key={`${bu}:${String(unitEntry(regulation, bu).updatedAt || '')}`}
              regulation={regulation}
              bu={bu}
              label={buLabelByCode[bu] || bu}
              canEdit={canEdit(bu)}
              onDone={done}
            />
          ))}
          <DocumentsList
            regulation={regulation}
            buLabelByCode={buLabelByCode}
            canHide={isAdminOrSme}
            onDone={done}
          />
        </div>

        <footer className="px-5 py-3 border-t border-border-default dark:border-border-dark">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-body border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            Close
          </button>
        </footer>
      </div>
    </dialog>
  );
}
