/**
 * UnitStatusSummary - T064 (Srinivas, Oct 28 item 1; approved Oct 29).
 *
 * The Dashboard's regulation pop-up shows the same details as the Roadmap,
 * then this: every Business Unit's status, its latest note, who made the
 * last change and when (with their email, so others can contact them), and
 * the unit's documents to download. This is also Niranjan's "Summary".
 *
 * Everyone sees every unit (viewing is company-wide, FR-0.2). Units the
 * person may update (Admin/SME: all; User: their own) get an Update button,
 * which opens the unit's pop-up (UnitStatusDialog).
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { downloadRegulationDocument, RegulationApiError } from '../api/regulationsApi';
import { statusLabel } from '../constants/status';
import { formatDateTime, formatTimestamp, personFor, unitDocuments, unitEntry } from '../utils/dashboardTable';
import ErrorBanner from './ErrorBanner';
import StatusSwatch from './StatusSwatch';

export default function UnitStatusSummary({ reg, buLabelByCode, people, canEdit, onOpenUnit }) {
  const { idToken } = useAuth();
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);
  const units = reg.businessUnitIds || [];

  const download = async (doc) => {
    if (busyKey) return;
    setError(null);
    setBusyKey(doc.key);
    try {
      await downloadRegulationDocument(idToken, reg.id, doc);
    } catch (err) {
      setError(err instanceof RegulationApiError && err.message ? err.message : 'Failed to download the document.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section aria-label="Status by Business Unit" className="mt-2.5 pt-2 border-t border-border-default dark:border-border-dark">
      <p className="text-label uppercase text-text-tertiary dark:text-slate-300">Status by Business Unit</p>
      {units.length === 0 && <p className="mt-0.5 text-xs text-text-secondary dark:text-slate-300">No Business Units.</p>}
      <ul className="mt-1.5 space-y-2">
        {units.map((bu) => {
          const entry = unitEntry(reg, bu);
          const name = buLabelByCode[bu] || bu;
          const note = (entry.note || '').trim();
          const who = entry.updatedBy ? personFor(people, entry.updatedBy) : null;
          const docs = unitDocuments(reg, bu);
          return (
            <li key={bu} className="rounded-md border border-border-default dark:border-border-dark px-2.5 py-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 min-w-0 text-xs font-semibold text-text-primary dark:text-white">
                  <StatusSwatch status={entry.status} size="sm" decorative />
                  <span className="truncate">{name}</span>
                  <span className="font-normal text-text-secondary dark:text-slate-300">· {statusLabel(entry.status)}</span>
                </p>
                {canEdit(bu) && (
                  <button
                    type="button"
                    onClick={() => onOpenUnit(bu)}
                    aria-label={`Update ${name}`}
                    className="flex-none text-xs px-2 py-0.5 rounded border border-brand-teal text-brand-teal dark:border-teal-300 dark:text-teal-300 hover:bg-brand-teal hover:text-white dark:hover:bg-teal-300 dark:hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                  >
                    Update
                  </button>
                )}
              </div>
              <p className="text-xs text-text-primary dark:text-slate-200 whitespace-pre-line break-words">
                {note || (entry.status ? 'No note.' : 'No status or notes yet.')}
              </p>
              {who && (
                <p className="text-[11px] text-text-secondary dark:text-slate-300">
                  Last change by <span className="font-semibold text-text-primary dark:text-white">{who.name}</span>
                  {entry.updatedAt && <> · {formatDateTime(entry.updatedAt)}</>}
                  {who.email && (
                    <>
                      {' · '}
                      <a
                        href={`mailto:${who.email}`}
                        className="text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                      >
                        {who.email}
                      </a>
                    </>
                  )}
                </p>
              )}
              {docs.length > 0 && (
                <ul aria-label={`${name} documents`} className="space-y-0.5">
                  {docs.map((doc) => (
                    <li key={doc.key} className="flex items-center gap-2 text-[11px] text-text-secondary dark:text-slate-300">
                      <span className="flex-1 min-w-0 truncate" title={doc.fileName}>
                        <span className="font-semibold text-text-primary dark:text-white">{doc.fileName}</span>
                        {' · '}
                        {personFor(people, doc.uploadedBy).name}, {formatTimestamp(doc.uploadedAt) || 'date unknown'}
                      </span>
                      <button
                        type="button"
                        onClick={() => download(doc)}
                        aria-disabled={busyKey === doc.key}
                        aria-label={`Download ${doc.fileName}`}
                        className="flex-none text-[11px] px-1.5 py-0.5 rounded border border-border-default dark:border-border-dark text-brand-teal dark:text-teal-300 hover:border-brand-teal dark:hover:border-teal-300 aria-disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                      >
                        {busyKey === doc.key ? 'Downloading…' : 'Download'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-1.5">
        <ErrorBanner message={error} />
      </div>
    </section>
  );
}
