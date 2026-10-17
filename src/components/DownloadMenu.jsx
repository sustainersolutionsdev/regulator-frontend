import { useEffect, useRef, useState } from 'react';

/**
 * DownloadMenu - "Download" button with PDF / Excel choices (T021, FR-2.4).
 *
 * Available to every role. The parent does the work: onDownload(format)
 * returns a promise that resolves once the file has been handed to the
 * browser, and rejects if it couldn't be made.
 *
 * Accessibility (NFR-6): a menu button (aria-haspopup / aria-expanded);
 * opening it focuses the first choice; Up/Down move between choices, Escape
 * closes and returns focus to the button, Tab closes. While a file is being
 * made the button says so; the result is announced in a polite live region,
 * and a failure is shown as an alert next to the button.
 */
const FORMATS = [
  { value: 'pdf', label: 'PDF', hint: 'For reading and printing' },
  { value: 'xlsx', label: 'Excel', hint: 'Every field, for sorting and filtering' },
];

export default function DownloadMenu({ disabled = false, onDownload, summary }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!open) return undefined;
    itemRefs.current[0]?.focus();
    const onPointer = (e) => {
      if (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  };

  const onMenuKey = (e) => {
    const items = itemRefs.current.filter(Boolean);
    const at = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const choose = async (format) => {
    const label = FORMATS.find((f) => f.value === format).label;
    close();
    setBusy(format);
    setError('');
    setStatus(`Preparing the ${label} file...`);
    try {
      await onDownload(format);
      setStatus(`${label} file downloaded${summary ? `: ${summary}` : ''}.`);
    } catch {
      setStatus('');
      setError(`The ${label} file couldn't be made. Please try again.`);
    } finally {
      setBusy(null);
    }
  };

  const busyLabel = busy ? `Preparing ${FORMATS.find((f) => f.value === busy).label}...` : 'Download';

  return (
    <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || Boolean(busy)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'dashboard-download-menu' : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-default dark:border-border-dark text-xs font-medium text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal dark:hover:border-teal-300 dark:hover:text-teal-300 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
        </svg>
        {busyLabel}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false" className={open ? 'rotate-180' : ''}>
          <path d="M2 3.5 5 6.5 8 3.5" />
        </svg>
      </button>

      {open && (
        <ul
          ref={menuRef}
          id="dashboard-download-menu"
          role="menu"
          aria-label="Download the Dashboard as"
          onKeyDown={onMenuKey}
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-30 w-64 max-w-[calc(100vw-2rem)] py-1 rounded-md border border-border-default dark:border-border-dark bg-surface-card dark:bg-surface-card-dark shadow-lg"
        >
          {FORMATS.map((f, i) => (
            <li key={f.value} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => choose(f.value)}
                className="w-full text-left px-3 py-2 hover:bg-surface-muted dark:hover:bg-surface-muted-dark focus:bg-surface-muted dark:focus:bg-surface-muted-dark focus:outline-none"
              >
                <span className="block text-xs font-semibold text-text-primary dark:text-white">{f.label}</span>
                <span className="block text-[11px] text-text-secondary dark:text-slate-300">{f.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {error && (
        <span role="alert" className="text-xs text-status-action-text dark:text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
