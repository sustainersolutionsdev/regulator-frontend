/**
 * regulationsApi.js — Regulation create / list / edit / remove + document upload.
 *
 * Field set corrected against Srinivas's actual "Input form to Add
 * Regulation" doc — the frozen Requirements Document's FR-0.7 had
 * drifted from this source and is superseded for this field list.
 */
import { apiRequest, ApiError, BASE_URL } from './apiClient';

export const RegulationApiError = ApiError;

export function createRegulation(idToken, {
  title,
  abbreviatedTitle,
  dueDate,
  domain,
  country,
  region,
  businessUnitIds,
  notes,
  documents,
  addToRoadmapDashboard,
}) {
  return apiRequest('/regulations', {
    method: 'POST',
    idToken,
    body: {
      title,
      abbreviated_title: abbreviatedTitle,
      due_date: dueDate,
      domain,
      country,
      region,
      business_unit_ids: businessUnitIds,
      notes,
      documents,
      add_to_roadmap_dashboard: addToRoadmapDashboard,
    },
  });
}

/**
 * uploadRegulationDocument — step 1 of the two-step add-with-document
 * flow. Bypasses apiRequest() deliberately: apiRequest always JSON-
 * stringifies the body and sets Content-Type: application/json, which
 * would corrupt a multipart file upload. This function builds its own
 * fetch call but reuses ApiError so callers handle both the same way.
 */
export async function uploadRegulationDocument(idToken, file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/regulations/upload-document`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  });

  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}));
    const detail = resBody.detail || '';
    throw new ApiError(detail || `Upload failed: ${res.status}`, res.status, detail);
  }

  return res.json();
}

/**
 * fetchRegulations — T011. Every non-hidden regulation in the caller's
 * tenant, sorted by due date. Screens apply the Roadmap/Dashboard toggle.
 */
export function fetchRegulations(idToken) {
  return apiRequest('/regulations', { idToken });
}

/**
 * updateRegulation — T014. `changes` uses the API's snake_case field names
 * and holds only the fields being changed. Admin/SME only.
 */
export function updateRegulation(idToken, regulationId, changes) {
  return apiRequest(`/regulations/${encodeURIComponent(regulationId)}`, {
    method: 'PATCH',
    idToken,
    body: changes,
  });
}

/**
 * removeRegulation — T014. Soft delete: hidden everywhere, never erased.
 * Admin/SME only.
 */
export function removeRegulation(idToken, regulationId) {
  return apiRequest(`/regulations/${encodeURIComponent(regulationId)}`, {
    method: 'DELETE',
    idToken,
  });
}
