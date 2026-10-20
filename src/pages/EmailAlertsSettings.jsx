import { useEffect, useId, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchEmailAlerts, saveEmailAlerts } from '../api/preferencesApi';
import ErrorBanner from '../components/ErrorBanner';

/**
 * EmailAlertsSettings — "Email alerts" at /account/email-alerts (T025, DL-9).
 *
 * Srinivas, Oct 19 2026: "Can we give the option to turn it off if the users
 * do not want to receive emails?" Each person turns alerts off, and back on,
 * for themselves only. On by default. Every alert email links here
 * ("Turn off email alerts"), and the sidebar links here too.
 *
 * T026: turning alerts ON also lifts a block left by the inbox's own
 * "Unsubscribe" link (Brevo adds it to every email); the server does this.
 *
 * The switch saves as soon as it is changed; the result is announced to
 * screen readers. A switch (role="switch", aria-checked) rather than a
 * checkbox, because the change takes effect immediately.
 */
export default function EmailAlertsSettings() {
  const { idToken, user } = useAuth();
  const [enabled, setEnabled] = useState(null); // null = loading
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const labelId = useId();
  const hintId = useId();

  // State is only set inside the promise callbacks (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!idToken) return undefined;
    let cancelled = false;
    fetchEmailAlerts(idToken)
      .then((value) => {
        if (!cancelled) setEnabled(value);
      })
      .catch(() => {
        if (!cancelled) setError('Your email alert setting could not be loaded. Reload the page to try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  const toggle = async () => {
    if (saving) return; // see aria-disabled below
    const next = !enabled;
    setSaving(true);
    setError(null);
    setNotice('');
    try {
      const saved = await saveEmailAlerts(idToken, next);
      setEnabled(saved);
      setNotice(
        saved
          ? 'Saved. You will get an email when a regulation is added or its main details change.'
          : 'Saved. You will no longer get alert emails. You can turn them back on here at any time.'
      );
    } catch {
      setError('The setting could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-body font-semibold text-text-primary dark:text-white">Email alerts</h2>
          <p className="text-body text-text-secondary dark:text-slate-300">
            Regulator emails everyone in your company when a regulation is added to the Roadmap and Dashboard,
            or when its main details change. Alerts are sent by email only.
          </p>
          <p className="text-xs text-text-secondary dark:text-slate-400">
            Used &ldquo;Unsubscribe&rdquo; in your inbox? Turning alerts on here starts them again.
          </p>
        </div>

        {enabled === null && !error && <p className="text-body text-text-secondary dark:text-slate-400">Loading...</p>}

        {enabled !== null && (
          <div className="flex items-start justify-between gap-4 rounded-md border border-border-default dark:border-border-dark px-4 py-3">
            <div>
              <p id={labelId} className="text-body font-medium text-text-primary dark:text-white">
                Email me about new and updated regulations
              </p>
              <p id={hintId} className="text-xs text-text-secondary dark:text-slate-400 mt-0.5">
                {user?.email ? `Alerts go to ${user.email}. ` : ''}This setting is yours only; it doesn&rsquo;t change
                anyone else&rsquo;s.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-labelledby={labelId}
              aria-describedby={hintId}
              onClick={toggle}
              // T027 (WCAG 2.4.3): aria-disabled, not disabled - a disabled button
              // loses keyboard focus to the page while the setting saves.
              aria-disabled={saving}
              // T027 (WCAG 1.4.11): every state's track/border and knob is at least 3:1
              // against its background - light off 4.76:1, light on 5.62:1,
              // dark off 5.71:1, dark on 9.89:1 (teal-300; brand teal is 2.6:1 on
              // the dark card). The state is also written out below the switch.
              className={[
                'relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border-2 transition-colors aria-disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal dark:focus-visible:ring-teal-300 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-card-dark',
                enabled
                  ? 'bg-brand-teal border-brand-teal dark:bg-teal-300 dark:border-teal-300'
                  : 'bg-white border-slate-500 dark:bg-surface-card-dark dark:border-slate-400',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'inline-block h-5 w-5 rounded-full shadow transition-transform',
                  enabled
                    ? 'translate-x-5 bg-white dark:bg-brand-navy'
                    : 'translate-x-0.5 bg-slate-500 dark:bg-slate-400',
                ].join(' ')}
              />
            </button>
          </div>
        )}

        {enabled !== null && (
          <p className="text-body text-text-primary dark:text-slate-200">
            Email alerts are <strong>{enabled ? 'on' : 'off'}</strong>.
          </p>
        )}

        <p role="status" className="text-body rounded-md px-3 py-2 bg-status-compliant-bg text-green-700 dark:bg-green-900/30 dark:text-green-300 empty:hidden">
          {notice}
        </p>
        <ErrorBanner message={error} />
      </section>
    </div>
  );
}
