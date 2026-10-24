/**
 * apiClient.js — shared fetch wrapper for regulator-backend.
 * Normalizes error handling so every API module (businessUnitsApi.js,
 * usersApi.js, and whatever comes next) doesn't reimplement the same
 * try/catch.
 */

import { auth } from '../lib/firebase';

// OPEN-11: the API address comes from VITE_API_BASE_URL at build time
// (the deployed site points at the regulator-api Cloud Run URL); local
// development keeps working with no setting.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
export { BASE_URL };

/**
 * Cold start (Oct 23). regulator-dev keeps no API server running while
 * nobody uses it, so idle costs nothing; the first call after ~15 quiet
 * minutes waits 10–20 s while a server starts.
 *
 * wakeApi(): called once when the web app opens (main.jsx). The Login screen
 * talks to Firebase, not the API, so while someone types their password the
 * API is already starting. /health needs no token and returns no data.
 *
 * timedFetch(): any API call still waiting after SLOW_AFTER_MS tells the
 * ServerWakeNotice to say why, so a slow start never looks like a broken
 * page. Uploads and downloads don't use it: a big file is slow for honest
 * reasons.
 */
let woken = false;
export function wakeApi() {
  if (woken) return;
  woken = true;
  fetch(`${BASE_URL}/health`, { cache: 'no-store' }).catch(() => {
    // Offline or blocked: the real calls will report it.
  });
}

const SLOW_AFTER_MS = 4000;
let slowCalls = 0;
const slowListeners = new Set();

function notifySlow() {
  slowListeners.forEach((fn) => fn(slowCalls > 0));
}

export function onSlowServer(fn) {
  slowListeners.add(fn);
  return () => slowListeners.delete(fn);
}

export async function timedFetch(url, options) {
  let slow = false;
  const timer = setTimeout(() => {
    slow = true;
    slowCalls += 1;
    notifySlow();
  }, SLOW_AFTER_MS);
  try {
    return await fetch(url, options);
  } finally {
    clearTimeout(timer);
    if (slow) {
      slowCalls -= 1;
      notifySlow();
    }
  }
}

/**
 * authHeader — T051 token-refresh fix (found Oct 11, T010).
 *
 * Screens pass the ID token they got at sign-in, which Firebase expires
 * after about an hour; every call then failed with 401 "Invalid or expired
 * token." The token is now taken from the signed-in user at the moment of
 * each request. getIdToken() returns the cached token and quietly gets a new
 * one when it is about to expire, so sessions keep working for as long as the
 * person stays signed in.
 *
 * Chosen over switching AuthContext to onIdTokenChanged: that would put a
 * new token into React state every hour and re-run every screen's data load
 * (their effects depend on idToken), resetting open panels mid-edit.
 * The passed token is only a fallback for the moment before Firebase has
 * restored the session.
 */
export async function authHeader(fallbackToken) {
  const current = auth.currentUser;
  const token = current ? await current.getIdToken() : fallbackToken;
  return `Bearer ${token}`;
}

export class ApiError extends Error {
  constructor(message, status, detail = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export async function apiRequest(path, { method = 'GET', idToken, params, body } = {}) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const headers = { Authorization: await authHeader(idToken) };
  const options = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await timedFetch(`${BASE_URL}${path}${query}`, options);

  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}));
    const detail = resBody.detail || '';
    throw new ApiError(detail || `Request failed: ${res.status}`, res.status, detail);
  }

  return res.json();
}