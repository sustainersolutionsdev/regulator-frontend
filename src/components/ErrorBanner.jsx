/**
 * ErrorBanner — shared error display pattern.
 * Built once here (T006 Day 4) so Dashboard/Roadmap edit-scope errors
 * (T014/T020) reuse this instead of each screen inventing its own
 * error markup, as BusinessUnitSetup did ad hoc in Days 2–3.
 */
export default function ErrorBanner({ message, variant = 'error' }) {
  if (!message) return null;

  const styles = variant === 'error'
    ? 'bg-status-action-bg border-status-action-border text-status-action-text'
    : 'bg-status-pending-bg border-status-pending-border text-status-pending-text';

  return (
    <div
      role="alert"
      className={`border rounded-md px-3 py-2 text-body ${styles}`}
    >
      {message}
    </div>
  );
}