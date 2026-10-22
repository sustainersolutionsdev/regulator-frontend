/**
 * apiClient.js — shared fetch wrapper for regulator-backend.
 * Normalizes error handling so every API module (businessUnitsApi.js,
 * usersApi.js, and whatever comes next) doesn't reimplement the same
 * try/catch.
 */

import { auth } from '../lib/firebase';

const BASE_URL = 'http://localhost:8000';
export { BASE_URL };

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

  const res = await fetch(`${BASE_URL}${path}${query}`, options);

  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}));
    const detail = resBody.detail || '';
    throw new ApiError(detail || `Request failed: ${res.status}`, res.status, detail);
  }

  return res.json();
}