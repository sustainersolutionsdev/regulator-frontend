/**
 * authErrors.js — T051. Turns Firebase Auth error codes into messages a
 * person can act on.
 *
 * A wrong email and a wrong password get the same message on purpose: saying
 * which one was wrong would tell anyone typing addresses which accounts exist.
 * Firebase's own "invalid-credential" code already merges the two.
 */

const WRONG_CREDENTIALS = 'The email or password is not correct.';

const MESSAGES = {
  'auth/invalid-credential': WRONG_CREDENTIALS,
  'auth/invalid-login-credentials': WRONG_CREDENTIALS,
  'auth/wrong-password': WRONG_CREDENTIALS,
  'auth/user-not-found': WRONG_CREDENTIALS,
  'auth/invalid-email': 'Enter a valid email address, like name@company.com.',
  'auth/missing-password': 'Enter your password.',
  'auth/missing-email': 'Enter your work email.',
  'auth/user-disabled': 'This account has been turned off. Contact your company’s Regulator Admin.',
  'auth/too-many-requests':
    'Too many attempts. Wait a few minutes and try again, or reset your password.',
  'auth/network-request-failed':
    'Can’t reach the sign-in service. Check your connection and try again.',
};

export function signInErrorMessage(err) {
  return MESSAGES[err?.code] || 'Sign-in didn’t work. Please try again.';
}

/**
 * Password reset: only problems the person can fix are shown. Anything
 * else is treated as sent, so the screen never reveals whether an account
 * exists for an address.
 */
export function resetErrorMessage(err) {
  const code = err?.code;
  if (code === 'auth/invalid-email' || code === 'auth/missing-email') return MESSAGES[code];
  if (code === 'auth/too-many-requests' || code === 'auth/network-request-failed') return MESSAGES[code];
  return null;
}
