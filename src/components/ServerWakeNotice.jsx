/**
 * ServerWakeNotice — Oct 23, cold start.
 *
 * regulator-dev keeps no API server running while idle (zero cost), so the
 * first screen after a quiet spell can wait 10–20 s while one starts. When
 * any API call has been waiting over 4 s (apiClient.timedFetch), this says
 * so, so the wait reads as "starting", not "broken". It disappears by itself
 * once the calls finish.
 *
 * role="status" + aria-live="polite": screen readers announce it without
 * interrupting (WCAG 4.1.3). Fixed to the bottom so it never shifts layout.
 */
import { useEffect, useState } from 'react';
import { onSlowServer } from '../api/apiClient';

export default function ServerWakeNotice() {
  const [slow, setSlow] = useState(false);

  useEffect(() => onSlowServer(setSlow), []);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {slow && (
        <p className="max-w-md rounded-md border border-slate-300 bg-white px-4 py-3 text-body text-slate-800 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
          <span className="font-semibold">Starting the server…</span>{' '}
          After a quiet period this takes up to 20 seconds. The page will load by itself.
        </p>
      )}
    </div>
  );
}
