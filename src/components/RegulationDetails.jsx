/**
 * RegulationDetails - everything the SME entered for one regulation, plus its
 * documents to download (Oct 24 meeting, item 3; Niranjan's Roadmap pop-up).
 *
 * Shared by the Roadmap pop-up and the monthly calendar's details, so both
 * show the same fields in the same order. Fields follow Srinivas's Add
 * Regulation form, plus record ID and dates (FR-0.8).
 *
 * No compliance status here (DL-8): the Roadmap and calendar are timeframe
 * views, and status lives on the Dashboard. "Open on the Dashboard" goes
 * straight to this regulation there (the T025 ?reg= link).
 *
 * Documents: every role can download (FR-2.4); removed (hidden) files are
 * never listed. Adding or removing documents stays on the Dashboard.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { downloadRegulationDocument, RegulationApiError } from '../api/regulationsApi';
import { formatTimestamp, visibleDocuments } from '../utils/dashboardTable';
import { formatDueDate, parseDueDate } from '../utils/roadmapDates';
import CountryFlag from './CountryFlag';
import ErrorBanner from './ErrorBanner';

function Field({ label, children }) {
  return (
    <>
      <dt className="text-text-tertiary dark:text-slate-400">{label}</dt>
      <dd className="text-text-primary dark:text-slate-200 min-w-0 break-words">{children}</dd>
    </>
  );
}

export default function RegulationDetails({ reg, buLabelByCode, headingId }) {
  const { idToken } = useAuth();
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);

  const abbreviation = (reg.abbreviatedTitle || '').trim();
  const due = reg.due || parseDueDate(reg.dueDate);
  const buLabels = (reg.businessUnitIds || []).map((code) => {
    const label = buLabelByCode[code];
    return label ? `${label} (${code})` : code;
  });
  const docs = visibleDocuments(reg);

  const download = async (doc) => {
    if (busyKey) return; // aria-disabled, not disabled: focus must stay on the button
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
    <div className="text-left">
      <h3 id={headingId} className="text-body font-semibold text-text-primary dark:text-white leading-snug pr-6">
        {reg.title}
      </h3>
      {abbreviation && abbreviation !== reg.title && (
        <p className="text-xs text-text-secondary dark:text-slate-300 mt-0.5">{abbreviation}</p>
      )}
      <p className="font-mono text-[11px] text-text-tertiary dark:text-slate-400 mt-1">
        <span className="sr-only">Record ID </span>
        {reg.id}
      </p>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <Field label="Due">{due ? formatDueDate(due) : 'Not set'}</Field>
        <Field label="Domain">{reg.domain || 'Not specified'}</Field>
        <Field label="Country">
          {reg.country ? (
            <span className="inline-flex items-center gap-1.5">
              <CountryFlag country={reg.country} />
              {reg.country}
            </span>
          ) : (
            'Not specified'
          )}
        </Field>
        <Field label="Region">{reg.region || 'Not specified'}</Field>
        <Field label="Business Units">{buLabels.join(', ') || 'None'}</Field>
        <Field label="Added">{formatTimestamp(reg.createdAt) || 'Unknown'}</Field>
        <Field label="Last updated">{formatTimestamp(reg.lastUpdated) || 'Unknown'}</Field>
      </dl>

      <div className="mt-2.5 pt-2 border-t border-border-default dark:border-border-dark">
        <p className="text-label uppercase text-text-tertiary dark:text-slate-300">Notes</p>
        <p className="mt-0.5 text-xs text-text-primary dark:text-slate-200 whitespace-pre-line break-words">
          {(reg.notes || '').trim() || 'None'}
        </p>
      </div>

      <div className="mt-2.5 pt-2 border-t border-border-default dark:border-border-dark">
        <p className="text-label uppercase text-text-tertiary dark:text-slate-300">
          Documents{docs.length > 0 ? ` (${docs.length})` : ''}
        </p>
        {docs.length === 0 ? (
          <p className="mt-0.5 text-xs text-text-secondary dark:text-slate-300">None attached.</p>
        ) : (
          <ul className="mt-1 space-y-1" aria-label="Documents">
            {docs.map((doc) => (
              <li key={doc.key} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-xs text-text-primary dark:text-slate-200" title={doc.fileName}>
                  {doc.fileName}
                  {doc.buCode && (
                    <span className="text-text-tertiary dark:text-slate-400"> · {buLabelByCode[doc.buCode] || doc.buCode}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => download(doc)}
                  aria-disabled={busyKey === doc.key}
                  aria-label={`Download ${doc.fileName}`}
                  className="flex-none text-xs px-2 py-0.5 rounded border border-border-default dark:border-border-dark text-brand-teal dark:text-teal-300 hover:border-brand-teal dark:hover:border-teal-300 aria-disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                >
                  {busyKey === doc.key ? 'Downloading…' : 'Download'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1.5">
          <ErrorBanner message={error} />
        </div>
      </div>

      <p className="mt-2.5 pt-2 border-t border-border-default dark:border-border-dark text-xs text-text-secondary dark:text-slate-300">
        Status by Business Unit is on the Dashboard.{' '}
        <Link
          to={`/dashboard?reg=${encodeURIComponent(reg.id)}`}
          className="text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
        >
          Open on the Dashboard
        </Link>
      </p>
    </div>
  );
}
