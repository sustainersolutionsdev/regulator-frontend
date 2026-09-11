/**
 * usersApi.js — User creation/listing calls for FR-0.4/FR-0.9, built on
 * the shared apiClient (same pattern as businessUnitsApi.js).
 */
import { apiRequest, ApiError } from './apiClient';

export const UserApiError = ApiError;

export function fetchUsers(idToken) {
  return apiRequest('/users', { idToken });
}

export function createUser(idToken, { email, displayName, role, businessUnitIds }) {
  return apiRequest('/users', {
    method: 'POST',
    idToken,
    body: {
      email,
      display_name: displayName,
      role,
      business_unit_ids: businessUnitIds,
    },
  });
}