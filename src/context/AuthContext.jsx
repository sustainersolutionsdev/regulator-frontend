import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { apiRequest } from '../api/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [claims, setClaims] = useState(null); // { role, tenant_id, businessUnitIds }
  const [loading, setLoading] = useState(true);
  // T066 (Niranjan, Oct 27): the person's name, shown with their role.
  const [profile, setProfile] = useState(null); // { displayName, email }

  useEffect(() => {
    if (!idToken) return undefined;
    let cancelled = false;
    apiRequest('/me', { idToken })
      .then((me) => {
        if (!cancelled) setProfile({ displayName: me.displayName || '', email: me.email || '' });
      })
      .catch(() => {
        // The name is a nicety; the email from sign-in stands in.
      });
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult();
        setUser(firebaseUser);
        setIdToken(tokenResult.token);
        setClaims({
          role: tokenResult.claims.role,
          tenantId: tokenResult.claims.tenant_id,
          businessUnitIds: tokenResult.claims.businessUnitIds || [],
        });
      } else {
        setUser(null);
        setIdToken(null);
        setClaims(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);
  // T051: "Forgot password?" on the Login screen. Firebase sends its own
  // reset email; the same kind of link new users already get from Add Users.
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  // Note (T051): the ID token held here is the one from sign-in. API calls
  // no longer rely on it staying fresh - apiClient.authHeader() asks Firebase
  // for a current token on every request.

  return (
    <AuthContext.Provider value={{ user, idToken, claims, profile, loading, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// A context module exports its Provider and its hook together by design.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}