/**
 * apiClient.js — shared fetch wrapper for regulator-backend.
 * Normalizes error handling so every API module (businessUnitsApi.js,
 * usersApi.js, and whatever comes next) doesn't reimplement the same
 * try/catch.
 */

const BASE_URL = 'http://localhost:8000';

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
  const headers = { Authorization: `Bearer ${idToken}` };
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