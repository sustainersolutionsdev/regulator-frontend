/**
 * businessUnitsApi.js — Business Unit CRUD API layer
 * Wraps GET/POST /business-units from regulator-backend (T006 Day 1).
 *
 * Dev default: backend runs locally on :8000. This becomes an env var
 * (VITE_API_BASE_URL) once a real deployed backend URL exists — kept
 * as a literal constant for now since there's only ever been one
 * environment to point at so far.
 */

const BASE_URL = 'http://localhost:8000';

export class BusinessUnitApiError extends Error {
  constructor(message, status, detail = '') {
    super(message);
    this.name = 'BusinessUnitApiError';
    this.status = status;
    this.detail = detail;
  }
}

export async function fetchBusinessUnits(idToken) {
  const res = await fetch(`${BASE_URL}/business-units`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new BusinessUnitApiError(`Failed to load Business Units: ${res.status}`, res.status, detail);
  }

  return res.json();
}

export async function createBusinessUnit(idToken, buCode, label) {
  const params = new URLSearchParams({ bu_code: buCode, label });

  const res = await fetch(`${BASE_URL}/business-units?${params.toString()}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new BusinessUnitApiError(
      body.detail || `Failed to create Business Unit: ${res.status}`,
      res.status,
      body.detail || ''
    );
  }

  return res.json();
}