/**
 * preferencesApi.js — T020 (DL-8). The Dashboard opens as each person last
 * left it, on any computer: the view's query string is saved per user on the
 * server (GET/PUT /me/dashboard-view).
 */
import { apiRequest } from './apiClient';

export async function fetchDashboardView(idToken) {
  const res = await apiRequest('/me/dashboard-view', { idToken });
  return res.view || '';
}

export function saveDashboardView(idToken, view) {
  return apiRequest('/me/dashboard-view', { method: 'PUT', idToken, body: { view } });
}
