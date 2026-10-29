/**
 * UnitStatusDialog - one Business Unit's pop-up on the Dashboard (T065;
 * Srinivas, Oct 28 items 1-2, mockup approved Oct 29).
 *
 * Opened from the unit in the Status column (or Update in the regulation
 * pop-up), only for units the person may update: Admin/SME any unit, a User
 * their own (FR-0.2). It has:
 *  - Status, a note and "Attach a document", saved together as ONE activity
 *    entry with the person's name and the time. The document is uploaded
 *    first, then linked to the entry (document_keys).
 *  - The unit's documents (plus those for the whole regulation), each with
 *    who added it and when, to download. Admin/SME can remove one (soft).
 *  - Activity, newest first: who changed the status (from -> to), their notes
 *    and documents, with an email link. Notes can't be edited; you can
 *    remove your own note (kept on the server). Status changes and documents
 *    stay on record.
 *
 * The server enforces every rule again; refusals show in the ErrorBanner.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  RegulationApiError,
  addRegulationDocument,
  downloadRegulationDocument,
  fetchUnitActivity,
  hideRegulationDocument,
  removeActivityNote,
  updateBuStatus,
} from '../api/regulationsApi';
import { STATUS_META, STATUS_VALUES, statusLabel } from '../constants/status';
import { formatDateTime, formatTimestamp, initialsOf, personFor, unitEntry, visibleDocuments } from '../utils/dashboardTable';
import ErrorBanner from './ErrorBanner';
import StatusSwatch from './StatusSwatch';

const NOTE_MAX = 1000; // matches the backend limit
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';

const sectionLabel = 'text-label uppercase text-text-tertiary dark:text-slate-300';
const smallButton =
  'text-xs px-2 py-1 rounded-md border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal dark:hover:border-teal-300 dark:hover:text-teal-300 aria-disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal';

function errorText(err, fallback) {
  if (!(err instanceof RegulationApiError)) return fallback;
  return Array.isArray(err.detail) ? err.detail.join('; ') : err.message;
}

function sizeText(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusChange({ entry }) {
  if (!entry.statusChanged && !(entry.legacy && entry.status)) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-text-primary dark:text-slate-200">
      <span className="text-text-secondary dark:text-slate-300">Status:</span>
      {entry.previousStatus !== undefined && entry.previousStatus !== null && !entry.legacy && (
        <>
          <StatusSwatch status={entry.previousStatus} size="sm" decorative />
          <span>{statusLabel(entry.previousStatus)}</span>
          <span aria-hidden="true">→</span>
          <span className="sr-only">to</span>
        </>
      )}
      <StatusSwatch status={entry.status} size="sm" decorative />
      <span className="font-semibold">{statusLabel(entry.status)}</span>
    </p>
  );
}

export default function UnitStatusDialog({ regulation, bu, label, people, onClose, onChanged }) {
  const { idToken, claims } = useAuth();
  const isAdminOrSme = claims?.role === 'admin' || claims?.role === 'sme';
  const dialogRef = useRef(null);
  const fileRef = useRef(null);
  const titleId = useId();
  const noteId = useId();
  const noteHintId = useId();
  const fileId = useId();

  const current = unitEntry(regulation, bu);
  const knownStatus = Object.prototype.hasOwnProperty.call(STATUS_META, current.status) ? current.status : '';
  const [savedStatus, setSavedStatus] = useState(knownStatus);
  const [status, setStatus] = useState(knownStatus);
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const [activity, setActivity] = useState(null); // null = loading
  const [activityError, setActivityError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [confirmHide, setConfirmHide] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [listError, setListError] = useState(null);

  const docs = visibleDocuments(regulation, bu);

  // Same open/close/focus-return behaviour as the other panels (T015 F6).
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

  useEffect(() => {
    let cancelled = false;
    fetchUnitActivity(idToken, regulation.id, bu)
      .then((list) => {
        if (cancelled) return;
        setActivity(list);
        setActivityError(null);
      })
      .catch((err) => {
        if (!cancelled) setActivityError(errorText(err, 'Failed to load the activity.'));
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, regulation.id, bu, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((k) => k + 1);
    onChanged();
  }, [onChanged]);

  const pickFile = (e) => {
    const chosen = e.target.files?.[0] || null;
    setFile(chosen);
  };
  const clearFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    if (saving) return;
    setError(null);
    setNotice('');
    const text = note.trim();
    if (text.length > NOTE_MAX) {
      setError(`The note must be ${NOTE_MAX.toLocaleString()} characters or fewer.`);
      return;
    }
    const statusChanged = status !== savedStatus;
    if (!statusChanged && !text && !file) {
      setError('Choose a new status, write a note or attach a document, then save.');
      return;
    }
    setSaving(true);
    try {
      const changes = {};
      if (statusChanged) changes.status = status || null;
      if (text) changes.note = text;
      if (file) {
        const uploaded = await addRegulationDocument(idToken, regulation.id, bu, file);
        changes.document_keys = [uploaded.key];
      }
      await updateBuStatus(idToken, regulation.id, bu, changes);
      const parts = [];
      if (statusChanged) parts.push(`status ${statusLabel(status || null)}`);
      if (text) parts.push('note');
      if (file) parts.push(`"${file.name}"`);
      setNotice(`Saved for ${label}: ${parts.join(', ')}.`);
      setSavedStatus(status);
      setNote('');
      clearFile();
      refresh();
    } catch (err) {
      setError(errorText(err, 'Failed to save.'));
    } finally {
      setSaving(false);
    }
  };

  const download = async (doc) => {
    if (busyKey) return;
    setListError(null);
    setBusyKey(doc.key);
    try {
      await downloadRegulationDocument(idToken, regulation.id, doc);
    } catch (err) {
      setListError(errorText(err, 'Failed to download the document.'));
    } finally {
      setBusyKey(null);
    }
  };

  const hide = async (doc) => {
    setListError(null);
    setBusyKey(doc.key);
    try {
      await hideRegulationDocument(idToken, regulation.id, doc.key);
      setConfirmHide(null);
      setNotice(`Removed "${doc.fileName}" from the Dashboard. The file is kept.`);
      refresh();
    } catch (err) {
      setListError(errorText(err, 'Failed to remove the document.'));
    } finally {
      setBusyKey(null);
    }
  };

  const removeNote = async (entry) => {
    setListError(null);
    setBusyKey(entry.id);
    try {
      await removeActivityNote(idToken, regulation.id, entry.id);
      setConfirmRemove(null);
      setNotice('Your note was removed.');
      refresh();
    } catch (err) {
      setListError(errorText(err, 'Failed to remove the note.'));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-full max-w-xl max-h-[90vh] p-0 rounded-lg bg-surface-card dark:bg-surface-card-dark text-text-primary dark:text-white border border-border-default dark:border-border-dark shadow-2xl backdrop:bg-brand-navy/50"
    >
      <div className="flex flex-col max-h-[90vh]">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-default dark:border-border-dark">
          <div className="min-w-0">
            <p className="text-xs text-text-secondary dark:text-slate-300 truncate" title={regulation.title}>
              {regulation.title}
            </p>
            <h2 id={titleId} className="text-h3 text-brand-navy dark:text-white">
              {label} <span className="text-xs font-normal text-text-secondary dark:text-slate-300">({bu})</span>
            </h2>
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

        <div className="flex-1 overflow-y-auto">
          <p
            role="status"
            className="mx-5 mt-4 text-body rounded-md px-3 py-2 bg-status-compliant-bg text-green-800 dark:bg-green-900/30 dark:text-green-300 empty:hidden"
          >
            {notice}
          </p>

          <div className="px-5 py-4 space-y-3 border-b border-border-default dark:border-border-dark">
            <fieldset>
              <legend className={`${sectionLabel} mb-1.5`}>Status</legend>
              <div className="flex flex-wrap gap-2">
                {[...STATUS_VALUES, ''].map((value) => {
                  const checked = status === value;
                  return (
                    <label
                      key={value || 'not-set'}
                      className={[
                        'flex items-center gap-2 min-h-[40px] px-3 rounded-md border-2 text-body cursor-pointer focus-within:ring-2 focus-within:ring-brand-teal',
                        checked
                          ? 'border-brand-teal bg-surface-muted dark:bg-surface-muted-dark dark:border-teal-300 font-semibold'
                          : 'border-border-default dark:border-border-dark',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name={`status-${titleId}`}
                        checked={checked}
                        onChange={() => setStatus(value)}
                        className="sr-only"
                      />
                      <StatusSwatch status={value || null} size="sm" decorative />
                      {value ? STATUS_META[value].label : 'Not set'}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor={noteId} className={`${sectionLabel} block mb-1`}>
                Add a note (why this status, what&rsquo;s next)
              </label>
              <textarea
                id={noteId}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                aria-describedby={noteHintId}
                className="w-full text-body bg-surface-page dark:bg-surface-muted-dark border border-border-default dark:border-border-dark rounded-md px-3 py-2 text-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
              <p id={noteHintId} className="mt-1 text-xs text-text-secondary dark:text-slate-300">
                Status, note and document are saved together with your name and the time. Everyone in your company
                can see them. Notes can&rsquo;t be edited later. {note.trim().length}/{NOTE_MAX.toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {file ? (
                <span className="inline-flex items-center gap-2 text-xs rounded-md border border-border-default dark:border-border-dark bg-surface-muted dark:bg-surface-muted-dark pl-3 pr-1 py-1">
                  <span className="truncate max-w-[16rem]" title={file.name}>
                    {file.name} ({sizeText(file.size)})
                  </span>
                  <button
                    type="button"
                    onClick={clearFile}
                    aria-label={`Remove ${file.name} from this update`}
                    className="px-2 py-1 rounded text-text-secondary dark:text-slate-300 hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                  >
                    &times;
                  </button>
                </span>
              ) : (
                <>
                  <label
                    htmlFor={fileId}
                    className="cursor-pointer text-xs px-3 py-1.5 rounded-md border border-dashed border-slate-500 dark:border-slate-400 text-text-primary dark:text-slate-200 hover:border-brand-teal hover:text-brand-teal focus-within:ring-2 focus-within:ring-brand-teal"
                  >
                    Attach a document
                  </label>
                  <input id={fileId} ref={fileRef} type="file" accept={ACCEPT} onChange={pickFile} className="sr-only" />
                  <span className="text-xs text-text-secondary dark:text-slate-300">PDF, Word, Excel, PowerPoint or text, up to 25 MB.</span>
                </>
              )}
              <button
                type="button"
                onClick={save}
                aria-disabled={saving}
                className="ml-auto bg-brand-teal text-white rounded-md px-4 py-2 text-body font-medium aria-disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-card-dark"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            <ErrorBanner message={error} />
          </div>

          <section aria-label="Documents" className="px-5 py-4 space-y-2 border-b border-border-default dark:border-border-dark">
            <h3 className={sectionLabel}>Documents ({docs.length})</h3>
            {docs.length === 0 ? (
              <p className="text-xs text-text-secondary dark:text-slate-300">None yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {docs.map((doc) => (
                  <li key={doc.key} className="rounded-md border border-border-default dark:border-border-dark px-3 py-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold truncate" title={doc.fileName}>{doc.fileName}</span>
                        <span className="block text-[11px] text-text-secondary dark:text-slate-300">
                          {doc.buCode ? '' : 'For the whole regulation · '}
                          added by {personFor(people, doc.uploadedBy).name} · {formatTimestamp(doc.uploadedAt) || 'date unknown'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => download(doc)}
                        aria-disabled={busyKey === doc.key}
                        aria-label={`Download ${doc.fileName}`}
                        className={smallButton}
                      >
                        {busyKey === doc.key ? 'Downloading…' : 'Download'}
                      </button>
                      {isAdminOrSme && confirmHide !== doc.key && (
                        <button
                          type="button"
                          onClick={() => setConfirmHide(doc.key)}
                          aria-label={`Remove ${doc.fileName}`}
                          className="text-xs px-1 text-red-700 dark:text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {isAdminOrSme && confirmHide === doc.key && (
                      <div role="group" aria-label={`Confirm removing ${doc.fileName}`} className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-red-700 dark:text-red-300 flex-1">Remove it from the Dashboard? The file is kept and can be restored.</span>
                        <button type="button" onClick={() => hide(doc)} className={smallButton}>Confirm remove</button>
                        <button type="button" onClick={() => setConfirmHide(null)} className={smallButton}>Cancel</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Activity" className="px-5 py-4 space-y-2">
            <h3 className={sectionLabel}>Activity (newest first)</h3>
            <ErrorBanner message={listError || activityError} />
            {activity === null && !activityError && <p className="text-xs text-text-secondary dark:text-slate-300">Loading…</p>}
            {activity && activity.length === 0 && (
              <p className="text-xs text-text-secondary dark:text-slate-300">No activity yet. Set the first status above.</p>
            )}
            {activity && activity.length > 0 && (
              <ol className="space-y-3">
                {activity.map((entry) => {
                  const who = entry.actorName ? { name: entry.actorName, email: entry.actorEmail } : personFor(people, entry.actorUid);
                  return (
                    <li key={entry.id} className="flex gap-2.5">
                      <span
                        aria-hidden="true"
                        className="flex-none w-8 h-8 rounded-full bg-surface-muted dark:bg-surface-muted-dark text-[11px] font-semibold text-text-primary dark:text-white flex items-center justify-center"
                      >
                        {initialsOf(who.name)}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs text-text-secondary dark:text-slate-300">
                          <span className="font-semibold text-text-primary dark:text-white">{who.name}</span>
                          {entry.at && <> · {formatDateTime(entry.at)}</>}
                          {who.email && (
                            <>
                              {' · '}
                              <a
                                href={`mailto:${who.email}`}
                                aria-label={`Email ${who.name}`}
                                className="text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                              >
                                Email
                              </a>
                            </>
                          )}
                        </p>
                        <StatusChange entry={entry} />
                        {entry.note && (
                          <p className="text-body text-text-primary dark:text-slate-200 whitespace-pre-line break-words">{entry.note}</p>
                        )}
                        {(entry.documents || []).map((doc) => (
                          <p key={doc.key} className="flex flex-wrap items-center gap-2 text-xs text-text-primary dark:text-slate-200">
                            <span>
                              Added <span className="font-semibold">{doc.fileName}</span>
                              {doc.sizeBytes ? ` (${sizeText(doc.sizeBytes)})` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => download(doc)}
                              aria-disabled={busyKey === doc.key}
                              aria-label={`Download ${doc.fileName}`}
                              className={smallButton}
                            >
                              Download
                            </button>
                          </p>
                        ))}
                        {entry.canRemove && confirmRemove !== entry.id && (
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(entry.id)}
                            aria-label="Remove your note"
                            className="text-xs text-text-secondary dark:text-slate-300 hover:text-red-700 dark:hover:text-red-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                          >
                            Remove
                          </button>
                        )}
                        {entry.canRemove && confirmRemove === entry.id && (
                          <div role="group" aria-label="Confirm removing your note" className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-red-700 dark:text-red-300">Remove your note? It is kept on record but no longer shown.</span>
                            <button type="button" onClick={() => removeNote(entry)} aria-disabled={busyKey === entry.id} className={smallButton}>
                              Confirm remove
                            </button>
                            <button type="button" onClick={() => setConfirmRemove(null)} className={smallButton}>Cancel</button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
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
