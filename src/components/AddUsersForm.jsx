import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { createUser, UserApiError } from '../api/usersApi';
import ErrorBanner from './ErrorBanner';

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'sme', label: 'SME' },
  { value: 'admin', label: 'Admin' },
];

export default function AddUsersForm({ onUserAdded }) {
  const { idToken, claims } = useAuth();

  const [businessUnits, setBusinessUnits] = useState([]);
  const [buLoadError, setBuLoadError] = useState(null);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('user');
  const [selectedBuIds, setSelectedBuIds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const canConfigure = claims?.role === 'admin' || claims?.role === 'sme';
  const isAllBuRole = role === 'admin' || role === 'sme';

  useEffect(() => {
    if (!idToken) return;
    fetchBusinessUnits(idToken)
      .then(setBusinessUnits)
      .catch(() => setBuLoadError('Failed to load Business Units for assignment.'));
  }, [idToken]);

  // FR-0.4: switching to Admin/SME auto-scopes to all BUs (matches the
  // backend's own override in create_user()) — clear any manual
  // selection so the UI never implies a narrower scope than what's
  // actually granted.
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'admin' || newRole === 'sme') {
      setSelectedBuIds([]);
    }
  };

  const toggleBu = (buId) => {
    setSelectedBuIds((prev) =>
      prev.includes(buId) ? prev.filter((id) => id !== buId) : [...prev, buId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (role === 'user' && selectedBuIds.length === 0) {
      setSubmitError('Select at least one Business Unit for a User role.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createUser(idToken, {
        email: email.trim(),
        displayName: displayName.trim(),
        role,
        businessUnitIds: selectedBuIds,
      });
      setSuccessMessage(`${email.trim()} created. Send them the reset link to set a password.`);
      setEmail('');
      setDisplayName('');
      setRole('user');
      setSelectedBuIds([]);
      onUserAdded?.(result);
    } catch (err) {
      setSubmitError(err instanceof UserApiError ? err.message : 'Failed to create user.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canConfigure) {
    return (
      <p className="text-body text-text-tertiary">
        Only Admin or SME accounts can add users.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label htmlFor="user_email" className="block text-label uppercase text-text-tertiary mb-1">
          Email
        </label>
        <input
          id="user_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="name@company.com"
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full"
        />
      </div>

      <div>
        <label htmlFor="user_display_name" className="block text-label uppercase text-text-tertiary mb-1">
          Name
        </label>
        <input
          id="user_display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          placeholder="Jane Doe"
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full"
        />
      </div>

      <div>
        <label htmlFor="user_role" className="block text-label uppercase text-text-tertiary mb-1">
          Role
        </label>
        <select
          id="user_role"
          value={role}
          onChange={(e) => handleRoleChange(e.target.value)}
          className="border border-border-default dark:border-border-dark dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <span className="block text-label uppercase text-text-tertiary mb-1">Business Unit Assignment</span>
        {isAllBuRole ? (
          <p className="text-body text-text-secondary dark:text-slate-400">
            All Business Units, tenant-wide (fixed for Admin/SME).
          </p>
        ) : (
          <>
            <ErrorBanner message={buLoadError} />
            {businessUnits.length === 0 && !buLoadError && (
              <p className="text-body text-text-tertiary">Loading Business Units...</p>
            )}
            <div className="space-y-1.5">
              {businessUnits.map((bu) => (
                <label key={bu.id} className="flex items-center gap-2 text-body text-text-primary dark:text-white">
                  <input
                    type="checkbox"
                    checked={selectedBuIds.includes(bu.id)}
                    onChange={() => toggleBu(bu.id)}
                    className="rounded border-border-default dark:border-border-dark"
                  />
                  <span className="cfr text-brand-teal">{bu.code}</span>
                  <span className="text-text-secondary dark:text-slate-400">{bu.label}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-brand-teal text-white rounded-md px-4 py-2 text-body font-medium disabled:opacity-50"
      >
        {submitting ? 'Creating...' : 'Add User'}
      </button>

      <ErrorBanner message={submitError} />
      {successMessage && (
        <div role="status" className="bg-status-compliant-bg border-status-compliant-border text-status-compliant-text border rounded-md px-3 py-2 text-body">
          {successMessage}
        </div>
      )}
    </form>
  );
}