/**
 * DuplicateCheckDialog - T034 (FR-5.1, M5): "This may already be in
 * Regulator", shown when the SME saves a regulation that looks like one the
 * company already has (approved design, Nov 17).
 *
 * Lists each likely duplicate (name, due date, Business Units, one line on
 * why it looks the same) and offers three choices:
 *   - Open the existing one: opens it on the Dashboard in a new tab, so the
 *     form keeps what was typed;
 *   - Go back and edit: closes the box;
 *   - Save as a new regulation: only after ticking "This is a different
 *     regulation". The choice is stored with the regulation, with who made it.
 * When the regulation applies to another Business Unit, it suggests adding
 * that unit to the existing regulation instead.
 *
 * Native <dialog> (showModal): focus stays inside, Esc = Go back and edit,
 * and focus returns to the Save button on close.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { formatDueDate, parseDueDate } from '../utils/roadmapDates';

function dueText(iso) {
  const d = parseDueDate(iso);
  return d ? formatDueDate(d) : '';
}

const buttonBase =
  'rounded-md px-4 py-2 text-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal';

export default function DuplicateCheckDialog({ result, unitNames, onSaveAnyway, onClose, saving }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const checkId = useId();
  const [different, setDifferent] = useState(false);

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

  const matches = result?.likelyDuplicates || [];
  const unitList = (ids) => (ids || []).map((id) => unitNames[id] || id).join(', ');
  const save = () => {
    if (!different || saving) return;
    onSaveAnyway(matches.map((m) => m.id));
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-full max-w-xl max-h-[90vh] p-0 overflow-hidden rounded-lg bg-surface-card dark:bg-surface-card-dark text-text-primary dark:text-white border border-border-default dark:border-border-dark shadow-2xl backdrop:bg-brand-navy/50"
    >
      <div className="flex flex-col max-h-[90vh]">
        <header className="px-5 py-4 border-b border-border-default dark:border-border-dark">
          <h2 id={titleId} className="text-h3 text-brand-navy dark:text-white">This may already be in Regulator</h2>
          <p className="mt-1 text-body text-text-secondary dark:text-slate-300">
            {matches.length === 1 ? 'A regulation your company already has' : 'Regulations your company already has'} looks
            like the one you are adding. Check before saving, so the same regulation isn&rsquo;t tracked twice.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {result?.note && (
            <p className="text-xs text-text-secondary dark:text-slate-300 border-l-2 border-border-default dark:border-border-dark pl-2">
              {result.note}
            </p>
          )}

          <ul className="space-y-3">
            {matches.map((m) => (
              <li key={m.id} className="rounded-md border border-border-default dark:border-border-dark px-3 py-2.5 space-y-1">
                <p className="text-body font-semibold">{m.abbreviatedTitle || m.title}</p>
                {m.abbreviatedTitle && m.title && m.title !== m.abbreviatedTitle && (
                  <p className="text-xs text-text-secondary dark:text-slate-300">{m.title}</p>
                )}
                <p className="text-xs text-text-secondary dark:text-slate-300">
                  {m.dueDate && <>Due {dueText(m.dueDate)}</>}
                  {m.dueDate && m.businessUnitIds?.length > 0 && <> &middot; </>}
                  {m.businessUnitIds?.length > 0 && <>{unitList(m.businessUnitIds)}</>}
                </p>
                {m.reason && <p className="text-body">{m.reason}</p>}
                <a
                  href={`/dashboard?reg=${encodeURIComponent(m.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-semibold text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                >
                  Open the existing one<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>

          {result?.otherBusinessUnit && (
            <p className="text-body text-text-primary dark:text-slate-100 bg-surface-muted dark:bg-surface-muted-dark rounded-md px-3 py-2">
              If this applies to another Business Unit, add that unit to the existing regulation instead of creating a
              new one. One regulation can cover several units, each with its own status.
            </p>
          )}

          <label htmlFor={checkId} className="flex items-start gap-2 text-body">
            <input
              id={checkId}
              type="checkbox"
              checked={different}
              onChange={(e) => setDifferent(e.target.checked)}
              className="mt-1 rounded border-border-default dark:border-border-dark focus:ring-2 focus:ring-brand-teal"
            />
            <span>This is a different regulation. Save it as a new one.</span>
          </label>
        </div>

        <footer className="flex flex-wrap items-center gap-3 px-5 py-4 border-t border-border-default dark:border-border-dark">
          <button
            type="button"
            onClick={save}
            aria-disabled={!different || saving}
            className={`${buttonBase} bg-brand-teal text-white aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`}
          >
            {saving ? 'Saving…' : 'Save as a new regulation'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${buttonBase} border border-border-default dark:border-border-dark text-text-primary dark:text-white`}
          >
            Go back and edit
          </button>
          {!different && (
            <span className="text-xs text-text-secondary dark:text-slate-300">Tick the box above to save it as new.</span>
          )}
        </footer>
      </div>
    </dialog>
  );
}
