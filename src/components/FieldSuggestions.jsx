/**
 * FieldSuggestions - T035 (FR-5.2, M5): classification help at the top of
 * Add Regulation (approved design, Nov 17).
 *
 * The SME pastes the regulation's text (optional) and clicks "Suggest
 * fields". Each suggestion (Domain, Country, Region, Business Units) shows
 * with its reason and Use / Ignore. Nothing is filled in until Use (or Use
 * all) is clicked, and every field stays editable afterwards. A field the AI
 * isn't confident about shows "Not sure". The pasted text is only sent for
 * the suggestion; it is not saved with the regulation.
 *
 * OPEN-9: when the AI can't help, a plain message says so and the form works
 * exactly as before.
 *
 * Props:
 *   onUse(field, suggestion)  field: 'domain' | 'country' | 'region' | 'businessUnits'
 */
import { useId, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { suggestFields } from '../api/aiApi';
import { ApiError } from '../api/apiClient';
import ErrorBanner from './ErrorBanner';

const FIELDS = [
  ['domain', 'Domain'],
  ['country', 'Country'],
  ['region', 'Region'],
  ['businessUnits', 'Business Units'],
];
const linkButton =
  'text-xs font-semibold text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded';
const inputClass =
  'border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent';

function shown(field, s) {
  if (field === 'businessUnits') return s.value.map((b) => b.name).join(', ');
  return s.value === 'Other' && s.otherName ? `Other: ${s.otherName}` : s.value;
}

function hasValue(s) {
  return s && (Array.isArray(s.value) ? s.value.length > 0 : Boolean(s.value));
}

export default function FieldSuggestions({ onUse }) {
  const { idToken } = useAuth();
  const textId = useId();
  const hintId = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // the API answer
  const [error, setError] = useState(null);
  const [done, setDone] = useState({}); // field -> 'used' | 'ignored'

  const ask = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setDone({});
    try {
      setResult(await suggestFields(idToken, text));
    } catch (err) {
      setError(err instanceof ApiError && typeof err.detail === 'string' && err.detail ? err.detail
        : 'Suggestions aren’t available right now. Fill in the fields as usual.');
    } finally {
      setBusy(false);
    }
  };

  const apply = (field) => {
    onUse(field, result.suggestions[field]);
    setDone((d) => ({ ...d, [field]: 'used' }));
  };
  const ignore = (field) => setDone((d) => ({ ...d, [field]: 'ignored' }));
  const s = result?.aiAvailable ? result.suggestions : null;
  const open = s ? FIELDS.filter(([f]) => hasValue(s[f]) && !done[f]) : [];
  const applyAll = () => open.forEach(([f]) => apply(f));

  return (
    <section
      aria-labelledby={`${textId}-h`}
      className="rounded-lg border border-border-default dark:border-border-dark bg-surface-muted/40 dark:bg-surface-muted-dark/40 px-4 py-3 space-y-3"
    >
      <h2 id={`${textId}-h`} className="text-body font-semibold text-text-primary dark:text-white">
        Suggest fields from the regulation text <span className="font-normal text-text-secondary dark:text-slate-300">(optional)</span>
      </h2>
      <div>
        <label htmlFor={textId} className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
          Paste the regulation text
        </label>
        <textarea
          id={textId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          aria-describedby={hintId}
          placeholder="Paste a paragraph or more of the regulation, e.g. its scope and requirements"
          className={inputClass}
        />
        <p id={hintId} className="mt-1 text-xs text-text-secondary dark:text-slate-300">
          AI suggests the Domain, Country, Region and Business Units. Nothing is filled in until you click Use. The text
          isn&rsquo;t saved.
        </p>
      </div>
      <button
        type="button"
        onClick={ask}
        aria-disabled={busy || !text.trim()}
        className="rounded-md px-3 py-1.5 text-body font-medium border border-brand-teal text-brand-teal dark:text-teal-300 dark:border-teal-300 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        {busy ? 'Reading the text…' : 'Suggest fields'}
      </button>

      <ErrorBanner message={error} />
      <p role="status" className={result && !result.aiAvailable ? 'text-body text-text-secondary dark:text-slate-300' : 'sr-only'}>
        {busy ? 'Reading the text.' : result && !result.aiAvailable ? result.message : s ? 'Suggestions are ready below.' : ''}
      </p>
      <div className="space-y-2">
        {s && (
          <>
            <p className="flex items-center gap-2 text-xs text-text-secondary dark:text-slate-300">
              <span className="px-1.5 rounded border border-brand-teal text-[10px] font-semibold leading-4 text-brand-teal dark:text-teal-300 dark:border-teal-300">
                AI
              </span>
              Suggestions from the text you pasted. Check each before using it.
              {result.textCut && ' Only the first part of a very long text was read.'}
            </p>
            <ul className="divide-y divide-border-default dark:divide-border-dark">
              {FIELDS.map(([field, label]) => {
                const item = s[field];
                return (
                  <li key={field} className="py-2 flex flex-wrap items-start gap-x-3 gap-y-1">
                    <span className="w-28 flex-none text-label uppercase text-text-tertiary dark:text-slate-300 pt-0.5">{label}</span>
                    <div className="flex-1 min-w-[12rem] space-y-0.5">
                      {hasValue(item) ? (
                        <>
                          <p className="text-body font-medium text-text-primary dark:text-white">{shown(field, item)}</p>
                          {field === 'businessUnits' ? (
                            item.value.map((b) => (
                              <p key={b.code} className="text-xs text-text-secondary dark:text-slate-300">
                                {b.name}: {b.reason}
                              </p>
                            ))
                          ) : (
                            item.reason && <p className="text-xs text-text-secondary dark:text-slate-300">{item.reason}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-body text-text-secondary dark:text-slate-300">
                          {item?.notSure ? 'Not sure' : `No suggestion for ${label}`}
                        </p>
                      )}
                    </div>
                    {hasValue(item) && (
                      <div className="flex items-center gap-3 pt-0.5">
                        {done[field] === 'used' && <span className="text-xs text-text-secondary dark:text-slate-300">Used</span>}
                        {done[field] === 'ignored' && <span className="text-xs text-text-secondary dark:text-slate-300">Ignored</span>}
                        {!done[field] && (
                          <>
                            <button type="button" onClick={() => apply(field)} className={linkButton}>
                              Use<span className="sr-only"> the suggested {label}</span>
                            </button>
                            <button type="button" onClick={() => ignore(field)} className={linkButton}>
                              Ignore<span className="sr-only"> the suggested {label}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {open.length > 1 && (
              <button type="button" onClick={applyAll} className={linkButton}>
                Use all suggestions
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
