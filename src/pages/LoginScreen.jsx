import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ErrorBanner from '../components/ErrorBanner';
import { resetErrorMessage, signInErrorMessage } from '../utils/authErrors';

/**
 * LoginScreen — Screen 0 (T051), per wireframe 01_login.png.
 *
 * Differences from the wireframe, all following decisions already made:
 *  - Email and password through Firebase Authentication (decided at M0 close,
 *    T010; TAD). The wireframe's "Sign in with Microsoft Entra ID" button was
 *    drawn before that decision, so the button reads "Sign in".
 *  - The company workspace still comes from the account itself (token claims),
 *    as the wireframe's footnote says. No tenant picker.
 *  - The wireframe's coloured CFR lines are left out: red/amber/green mean a
 *    compliance status everywhere else in the product, and these would mean
 *    nothing.
 *  - Added "Forgot password?" (inferred, not on the wireframe): accounts are
 *    created with a reset link (T007), and without this a person who loses it
 *    has no way back in except asking an Admin.
 *
 * Shown at whatever URL was opened, so a link from an alert email
 * (/dashboard?reg=..., /account/email-alerts) opens its page right after
 * sign-in (T025). App.jsx swaps to the routes once Firebase reports the user.
 *
 * Accessibility: real labels, autocomplete hints for password managers,
 * errors announced (ErrorBanner role="alert"), the button stays focusable
 * while busy (aria-disabled, as in T027 F2), focus moves to the heading when
 * switching between sign-in and reset, inputs have 3:1 borders (WCAG 1.4.11).
 */

const labelCls = 'block text-body font-semibold text-text-secondary dark:text-slate-300 mb-1.5';
const inputCls =
  'w-full rounded-md border border-slate-500 dark:border-slate-400 bg-surface-card dark:bg-brand-navy px-3 py-2.5 text-body text-text-primary dark:text-white placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal dark:focus-visible:ring-teal-300 focus-visible:ring-offset-1';
const primaryBtn =
  'w-full rounded-md bg-brand-navy dark:bg-teal-300 text-white dark:text-brand-navy py-3 text-body font-semibold hover:bg-slate-800 dark:hover:bg-teal-200 aria-disabled:opacity-70 aria-disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal dark:focus-visible:ring-teal-300 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-card-dark';
const linkBtn =
  'text-body font-medium text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal dark:focus-visible:ring-teal-300 rounded';

function BrandPanel() {
  return (
    <div className="max-w-md">
      <p className="text-5xl sm:text-6xl font-bold tracking-tight text-white">Regulator</p>
      <p className="mt-2 text-lg text-slate-400">by Sustainer</p>
      <p className="mt-8 text-xl leading-relaxed text-slate-300">
        Regulatory intelligence for enterprise sustainability teams.
      </p>
    </div>
  );
}

function SignInForm({ email, setEmail, onForgot, headingRef }) {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const emailId = useId();
  const passwordId = useId();

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!email.trim()) return setError('Enter your work email.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    try {
      await login(email.trim(), password);
      // Success: App.jsx replaces this screen with the page that was opened.
    } catch (err) {
      setError(signInErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="text-center">
        <h1 ref={headingRef} tabIndex={-1} className="text-h2 text-text-primary dark:text-white focus:outline-none">
          Sign in
        </h1>
        <p className="mt-1 text-body text-text-secondary dark:text-slate-300">Access your company’s workspace</p>
      </div>

      <div>
        <label htmlFor={emailId} className={labelCls}>Work email</label>
        <input
          id={emailId}
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={passwordId} className={labelCls}>Password</label>
          <button type="button" onClick={onForgot} className={`${linkBtn} text-xs mb-1.5`}>
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id={passwordId}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputCls} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-1 my-1 px-2.5 rounded text-xs font-semibold text-text-secondary dark:text-slate-300 hover:text-brand-teal dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal dark:focus-visible:ring-teal-300"
          >
            {showPassword ? 'Hide' : 'Show'}
            <span className="sr-only"> password</span>
          </button>
        </div>
      </div>

      <ErrorBanner message={error} />

      <button type="submit" aria-disabled={busy} className={primaryBtn}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-xs text-text-tertiary dark:text-slate-400">
        Your company’s workspace opens automatically from your account.
      </p>
    </form>
  );
}

function ResetForm({ email, setEmail, onBack, headingRef }) {
  const { resetPassword } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(null);
  const emailId = useId();

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const address = email.trim();
    if (!address) return setError('Enter your work email.');
    setBusy(true);
    try {
      await resetPassword(address);
      setSentTo(address);
    } catch (err) {
      const message = resetErrorMessage(err);
      if (message) setError(message);
      else setSentTo(address); // never reveal whether the account exists
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="text-center">
        <h1 ref={headingRef} tabIndex={-1} className="text-h2 text-text-primary dark:text-white focus:outline-none">
          Reset your password
        </h1>
        <p className="mt-1 text-body text-text-secondary dark:text-slate-300">
          We’ll email you a link to choose a new password.
        </p>
      </div>

      <div>
        <label htmlFor={emailId} className={labelCls}>Work email</label>
        <input
          id={emailId}
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSentTo(null);
          }}
          className={inputCls}
        />
      </div>

      <ErrorBanner message={error} />
      <p
        role="status"
        className="text-body rounded-md px-3 py-2 bg-status-compliant-bg text-green-700 dark:bg-green-900/30 dark:text-green-300 empty:hidden"
      >
        {sentTo
          ? `If ${sentTo} has a Regulator account, a reset link is on its way. Check your inbox and spam folder.`
          : ''}
      </p>

      <button type="submit" aria-disabled={busy} className={primaryBtn}>
        {busy ? 'Sending…' : sentTo ? 'Send again' : 'Send reset link'}
      </button>

      <p className="text-center">
        <button type="button" onClick={onBack} className={linkBtn}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}

export default function LoginScreen() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const headingRef = useRef(null);
  const switched = useRef(false);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Sign in · Regulator';
    return () => {
      document.title = previous;
    };
  }, []);

  // Move focus to the new heading when switching forms (not on first load,
  // so the browser's own focus behaviour and password managers are undisturbed).
  useEffect(() => {
    if (switched.current) headingRef.current?.focus();
  }, [mode]);

  const go = (next) => {
    switched.current = true;
    setMode(next);
  };

  return (
    <main className="min-h-screen bg-brand-navy flex flex-col lg:flex-row">
      <section className="flex-1 flex items-end lg:items-center px-6 sm:px-12 lg:px-20 pt-12 pb-8 lg:py-12">
        <BrandPanel />
      </section>
      <section className="flex-1 flex items-start lg:items-center justify-center px-4 sm:px-12 pb-12 lg:py-12">
        <div className="w-full max-w-md rounded-xl bg-surface-card dark:bg-surface-card-dark border border-transparent dark:border-border-dark shadow-2xl px-6 sm:px-10 py-10">
          {mode === 'signin' ? (
            <SignInForm email={email} setEmail={setEmail} onForgot={() => go('reset')} headingRef={headingRef} />
          ) : (
            <ResetForm email={email} setEmail={setEmail} onBack={() => go('signin')} headingRef={headingRef} />
          )}
        </div>
      </section>
    </main>
  );
}

/**
 * AccountNotReady — T051. A login that exists but has no company or role
 * attached (e.g. a half-created account) used to open the app with an empty
 * tenant and fail on every screen. It now gets a clear message and a way out.
 */
export function AccountNotReady({ email, onSignOut }) {
  return (
    <main className="min-h-screen bg-brand-navy flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-surface-card dark:bg-surface-card-dark px-6 sm:px-10 py-10 text-center space-y-4">
        <h1 className="text-h2 text-text-primary dark:text-white">Your account isn’t set up yet</h1>
        <p className="text-body text-text-secondary dark:text-slate-300">
          {email ? `${email} is signed in, but it` : 'This account'} hasn’t been added to a company workspace.
          Ask your company’s Regulator Admin to add you, then sign in again.
        </p>
        <button type="button" onClick={onSignOut} className={primaryBtn}>
          Sign out
        </button>
      </div>
    </main>
  );
}
