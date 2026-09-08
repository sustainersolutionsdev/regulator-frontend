/**
 * apiClient.js — shared fetch wrapper for regulator-backend.
 * Normalizes error handling so every API module (businessUnitsApi.js,
 * and whatever comes next) doesn't reimplement the same try/catch.
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

export async function apiRequest(path, { method = 'GET', idToken, params } = {}) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await fetch(`${BASE_URL}${path}${query}`, {
    method,
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail || '';
    throw new ApiError(detail || `Request failed: ${res.status}`, res.status, detail);
  }

  return res.json();
}