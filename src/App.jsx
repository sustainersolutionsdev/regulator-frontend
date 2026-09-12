import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layout/AppLayout';
import BusinessUnitSetup from './pages/BusinessUnitSetup';
import PeopleDirectory from './pages/PeopleDirectory';

function SignInScreen() {
  const { login } = useAuth();
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.target);
    try {
      await login(form.get('email'), form.get('password'));
    } catch (err) {
      setError('Sign-in failed. Check the email and password.');
    }
  };

  // Placeholder only — the real Login/SSO screen (Screen 0) is explicitly
  // flagged in the UI/UX doc as unconfirmed scope, pending business
  // owner decision on MSAL/Entra vs. this Firebase-based approach.
  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center">
      <form onSubmit={handleLogin} className="bg-surface-card border border-border-default rounded-lg p-6 w-80 space-y-3">
        <h1 className="text-h3 text-brand-navy mb-2">Sign in</h1>
        <input name="email" type="email" placeholder="Email" required
          className="w-full border border-border-default rounded-md px-3 py-2 text-body" />
        <input name="password" type="password" placeholder="Password" required
          className="w-full border border-border-default rounded-md px-3 py-2 text-body" />
        <button type="submit" className="w-full bg-brand-teal text-white rounded-md py-2 text-body font-medium">
          Sign in
        </button>
        {error && <p className="text-status-action-text text-label">{error}</p>}
      </form>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <p className="p-6 text-body">Loading...</p>;
  if (!user) return <SignInScreen />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
       <Route path="/" element={<Navigate to="/settings" replace />} />
        <Route path="/settings" element={<BusinessUnitSetup />} />
        <Route path="/directory" element={<PeopleDirectory />} />
      </Route>

    </Routes>
  );
}