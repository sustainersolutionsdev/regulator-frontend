/**
 * FilePicker - a proper file-selection box (Srinivas, Oct 24 US, item 5:
 * "What is the purpose of 'No file chosen'?"). Replaces the browser's bare
 * "Choose files / No file chosen" button with a box that says what to do and
 * what is allowed, and accepts files dragged onto it.
 *
 * The real <input type="file"> stays in the page, visually hidden but
 * focusable, so keyboard and screen-reader users get the native file dialog
 * (Enter or Space); the box shows its focus ring.
 */
import { useId, useState } from 'react';
import { ALLOWED_DOCUMENT_EXTENSIONS, DOCUMENT_RULES_TEXT } from '../constants/documents';

export default function FilePicker({ id, onFiles, busy = false, multiple = true, describedBy }) {
  const hintId = useId();
  const [dragging, setDragging] = useState(false);

  const take = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length && !busy) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
    >
      <input
        id={id}
        type="file"
        multiple={multiple}
        accept={ALLOWED_DOCUMENT_EXTENSIONS.join(',')}
        aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
        aria-disabled={busy || undefined}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = ''; // the same file can be chosen again after removing it
        }}
        onClick={(e) => {
          if (busy) e.preventDefault();
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={[
          'flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-brand-teal peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-surface-card-dark',
          dragging
            ? 'border-brand-teal bg-teal-50 dark:border-teal-300 dark:bg-slate-800'
            : 'border-border-strong dark:border-slate-600 hover:border-brand-teal dark:hover:border-teal-300 bg-white dark:bg-surface-muted-dark',
          busy ? 'opacity-60 cursor-wait' : '',
        ].join(' ')}
      >
        <span className="text-body font-medium text-text-primary dark:text-white">
          {busy ? 'Uploading…' : (
            <>
              <span className="text-brand-teal dark:text-teal-300 underline underline-offset-2">Choose files</span>
              {' '}or drag them here
            </>
          )}
        </span>
        <span id={hintId} className="text-xs text-text-secondary dark:text-slate-300">
          {DOCUMENT_RULES_TEXT}
        </span>
      </label>
    </div>
  );
}
