/**
 * AiSummaryDialog - the AI summary of one regulation (T029; FR-4.1, FR-4.2,
 * FR-4.7; DL-18 point 5, DL-19). Opened from the "AI" button beside a
 * regulation on the Roadmap and the Dashboard; both show the same stored
 * summary, so the wording never differs between the screens.
 *
 * As approved in the example summaries doc (Nov 10):
 *  - the 3-line short version first, with More for the full summary:
 *    Regulation, Documents and notes, Status across Business Units (colour
 *    and status name, with the unit's contacts), Actions needed;
 *  - an "AI-generated" tag and the time it was generated;
 *  - Close and Copy (Copy takes the full summary plus the disclaimer);
 *  - Generate Slides (second drop): the summary as a .pptx, built in the browser;
 *  - the disclaimer in fine print at the bottom.
 * Generate Slides comes in the second drop (by Nov 30).
 *
 * Status colours and names, and the contacts, come from the server's data,
 * never from the AI's wording. AI problems (paused, daily limit, no answer)
 * show the server's message as it is.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchRegulationSummary } from '../api/aiApi';
import { ApiError } from '../api/apiClient';
import ErrorBanner from './ErrorBanner';
import StatusSwatch from './StatusSwatch';
import { generatedText, summaryToText } from '../utils/summaryText';

const sectionLabel = 'text-label uppercase text-text-tertiary dark:text-slate-300';
const linkButton =
  'text-xs font-semibold text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded';

function Contacts({ contacts }) {
  if (!contacts || contacts.length === 0) return null;
  return (
    <p className="text-xs text-text-secondary dark:text-slate-300">
      Contact:{' '}
      {contacts.map((c, i) => (
        <span key={`${c.email}-${i}`}>
          {i > 0 && ', '}
          {c.email ? (
            <a
              href={`mailto:${c.email}`}
              className="text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
            >
              {c.name}
            </a>
          ) : (
            c.name
          )}
        </span>
      ))}
    </p>
  );
}

export default function AiSummaryDialog({ regulation, onClose }) {
  const { idToken } = useAuth();
  const dialogRef = useRef(null);
  const titleId = useId();
  const fullId = useId();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [copyNote, setCopyNote] = useState('');
  const [slidesBusy, setSlidesBusy] = useState(false);

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
    fetchRegulationSummary(idToken, regulation.id)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'The summary could not be loaded. Please try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, regulation.id]);

  const copy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summaryToText(summary, regulation));
      setCopyNote('Copied the full summary, with the disclaimer.');
    } catch {
      setCopyNote('Copy didn’t work here. Open More, select the text and copy it instead.');
    }
  };

  // Generate Slides (second drop): built in the browser from this summary, no AI call.
  // pptxgenjs is loaded only on the first click.
  const slides = async () => {
    if (!(summary) || slidesBusy) return;
    setSlidesBusy(true);
    setCopyNote('');
    try {
      const { buildRegulationDeck, downloadDeck } = await import('../utils/summarySlides');
      await downloadDeck(buildRegulationDeck(summary, regulation));
      setCopyNote('Slides downloaded (.pptx). They open in PowerPoint and Google Slides.');
    } catch {
      setCopyNote('The slides could not be made. Please try again.');
    } finally {
      setSlidesBusy(false);
    }
  };

  const when = summary ? generatedText(summary.generatedAt) : '';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-busy={!summary && !error}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-full max-w-xl max-h-[90vh] p-0 overflow-hidden rounded-lg bg-surface-card dark:bg-surface-card-dark text-text-primary dark:text-white border border-border-default dark:border-border-dark shadow-2xl backdrop:bg-brand-navy/50"
    >
      <div className="flex flex-col max-h-[90vh]">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-default dark:border-border-dark">
          <div className="min-w-0">
            <p className="text-xs text-text-secondary dark:text-slate-300 truncate" title={regulation.title}>
              {regulation.title}
            </p>
            <h2 id={titleId} className="flex flex-wrap items-center gap-2 text-h3 text-brand-navy dark:text-white">
              AI summary
              <span className="text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-brand-teal text-brand-teal dark:border-teal-300 dark:text-teal-300">
                AI-generated
              </span>
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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!summary && !error && (
            <p role="status" className="text-body text-text-secondary dark:text-slate-300">
              Writing the summary&hellip; The first time can take up to 30 seconds. After that it opens straight away.
            </p>
          )}
          <ErrorBanner message={error} />

          {summary && (
            <>
              <p className="text-body text-text-primary dark:text-slate-100">{summary.short}</p>

              {!expanded ? (
                <button type="button" onClick={() => setExpanded(true)} aria-expanded="false" aria-controls={fullId} className={linkButton}>
                  More
                </button>
              ) : (
                <div id={fullId} className="space-y-4">
                  <section className="space-y-1">
                    <h3 className={sectionLabel}>Regulation</h3>
                    <p className="text-body">{summary.regulation}</p>
                  </section>

                  <section className="space-y-1">
                    <h3 className={sectionLabel}>Documents and notes</h3>
                    <p className="text-body">{summary.documentsAndNotes}</p>
                  </section>

                  <section className="space-y-2">
                    <h3 className={sectionLabel}>Status across Business Units</h3>
                    <ul className="space-y-2">
                      {summary.units.map((u) => (
                        <li key={u.code} className="flex gap-2">
                          <StatusSwatch status={u.status} size="sm" decorative className="mt-1" />
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-body">
                              <span className="font-semibold">{u.name}</span>
                              <span className="text-text-secondary dark:text-slate-300"> &mdash; {u.statusLabel}</span>
                              {u.summary && <>. {u.summary}</>}
                            </p>
                            <Contacts contacts={u.contacts} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="space-y-1">
                    <h3 className={sectionLabel}>Actions needed</h3>
                    {summary.actionsNeeded.length === 0 ? (
                      <p className="text-body text-text-secondary dark:text-slate-300">No actions have been entered.</p>
                    ) : (
                      <ul className="list-disc pl-5 space-y-1">
                        {summary.actionsNeeded.map((a, i) => (
                          <li key={i} className="text-body">
                            {a.unit && <span className="font-semibold">{a.unit}: </span>}
                            {a.action}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <button type="button" onClick={() => setExpanded(false)} aria-expanded="true" aria-controls={fullId} className={linkButton}>
                    Less
                  </button>
                </div>
              )}

              {when && <p className="text-xs text-text-secondary dark:text-slate-300">Generated {when}.</p>}
            </>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-border-default dark:border-border-dark space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              aria-disabled={!summary}
              className="bg-brand-teal text-white rounded-md px-4 py-2 text-body font-medium aria-disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-card-dark"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={slides}
              aria-disabled={!(summary) || slidesBusy}
              className="rounded-md px-4 py-2 text-body font-medium border border-brand-teal text-brand-teal dark:text-teal-300 dark:border-teal-300 aria-disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              {slidesBusy ? 'Generating…' : 'Generate Slides'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-body border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            >
              Close
            </button>
            <p role="status" className="text-xs text-text-secondary dark:text-slate-300 empty:hidden">
              {copyNote}
            </p>
          </div>
          <p className="text-[11px] leading-snug text-text-secondary dark:text-slate-400">
            {summary?.disclaimer ||
              'Generated by AI from information entered in Regulator. Review before using it. Material is for general information only and does not constitute professional or legal advice.'}
          </p>
        </footer>
      </div>
    </dialog>
  );
}
