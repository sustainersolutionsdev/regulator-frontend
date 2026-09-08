/**
 * businessUnitsApi.js — Business Unit CRUD calls, built on the shared
 * apiClient (T006 Day 4 refactor — was duplicated fetch logic before).
 */
import { apiRequest, ApiError } from './apiClient';

export const BusinessUnitApiError = ApiError; // re-exported for existing imports

export function fetchBusinessUnits(idToken) {
  return apiRequest('/business-units', { idToken });
}

export function createBusinessUnit(idToken, buCode, label) {
  return apiRequest('/business-units', {
    method: 'POST',
    idToken,
    params: { bu_code: buCode, label },
  });
}