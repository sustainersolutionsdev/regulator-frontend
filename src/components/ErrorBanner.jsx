/**
 * ErrorBanner — shared error display pattern.
 * Built once here (T006 Day 4) so Dashboard/Roadmap edit-scope errors
 * (T014/T020) reuse this instead of each screen inventing its own
 * error markup, as BusinessUnitSetup did ad hoc in Days 2–3.
 *
 * T015 (WCAG AA): text colours darkened. The status-*-text tokens on their
 * matching -bg tints measured 4.41:1 (error) and 3.07:1 (warning), under
 * the 4.5:1 AA minimum; red-700 / amber-800 give 5.91:1 and 6.84:1.
 */
export default function ErrorBanner({ message, variant = 'error' }) {
  if (!message) return null;

  const styles = variant === 'error'
    ? 'bg-status-action-bg border-status-action-border text-red-700'
    : 'bg-status-pending-bg border-status-pending-border text-amber-800';

  return (
    <div
      role="alert"
      className={`border rounded-md px-3 py-2 text-body ${styles}`}
    >
      {message}
    </div>
  );
}
