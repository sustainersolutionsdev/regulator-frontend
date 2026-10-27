/**
 * usersApi.js — User creation/listing calls for FR-0.4/FR-0.9, built on
 * the shared apiClient (same pattern as businessUnitsApi.js).
 */
import { apiRequest, ApiError } from './apiClient';

export const UserApiError = ApiError;

export function fetchUsers(idToken) {
  return apiRequest('/users', { idToken });
}

export function createUser(idToken, { email, displayName, title, role, businessUnitIds, notes }) {
  return apiRequest('/users', {
    method: 'POST',
    idToken,
    body: {
      email,
      display_name: displayName,
      title,
      role,
      business_unit_ids: businessUnitIds,
      notes,
    },
  });
}

/**
 * resendInvitation — T061 (approved Oct 26): Admin/SME send a fresh
 * invitation email ("Set my password", valid 1 hour) to someone in their company.
 */
export function resendInvitation(idToken, uid) {
  return apiRequest(`/users/${encodeURIComponent(uid)}/resend-invitation`, { method: 'POST', idToken });
}
