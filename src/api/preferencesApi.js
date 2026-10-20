/**
 * preferencesApi.js — the signed-in person's own settings, stored per user on
 * the server.
 *
 * T020 (DL-8): the Dashboard opens as each person last left it, on any
 * computer (GET/PUT /me/dashboard-view).
 * T025 (DL-9): each person can turn email alerts off, and back on
 * (GET/PUT /me/email-alerts). On unless they turned it off.
 */
import { apiRequest } from './apiClient';

export async function fetchDashboardView(idToken) {
  const res = await apiRequest('/me/dashboard-view', { idToken });
  return res.view || '';
}

export function saveDashboardView(idToken, view) {
  return apiRequest('/me/dashboard-view', { method: 'PUT', idToken, body: { view } });
}

export async function fetchEmailAlerts(idToken) {
  const res = await apiRequest('/me/email-alerts', { idToken });
  return res.enabled !== false;
}

export async function saveEmailAlerts(idToken, enabled) {
  const res = await apiRequest('/me/email-alerts', { method: 'PUT', idToken, body: { enabled } });
  return res.enabled !== false;
}
