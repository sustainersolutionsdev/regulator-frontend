/**
 * regulationsApi.js — Regulation create / list / edit / remove + documents
 * + per-Business-Unit status.
 *
 * Field set corrected against Srinivas's actual "Input form to Add
 * Regulation" doc — the frozen Requirements Document's FR-0.7 had
 * drifted from this source and is superseded for this field list.
 */
import { apiRequest, ApiError, BASE_URL, authHeader } from './apiClient';

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

// Multipart calls bypass apiRequest() deliberately: apiRequest always
// JSON-stringifies the body and sets Content-Type: application/json, which
// would corrupt a file upload. Errors still come back as ApiError.
async function multipartRequest(path, idToken, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: await authHeader(idToken) },
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
 * uploadRegulationDocument — step 1 of the Add Regulation two-step
 * add-with-document flow (Admin/SME).
 */
export function uploadRegulationDocument(idToken, file) {
  const formData = new FormData();
  formData.append('file', file);
  return multipartRequest('/regulations/upload-document', idToken, formData);
}

/**
 * fetchRegulations — T011. Every non-hidden regulation in the caller's
 * tenant, sorted by due date. Screens apply the Roadmap/Dashboard toggle.
 * T020: each document carries `key` and `hidden`; `buStatuses` holds the
 * per-Business-Unit status.
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

/**
 * updateBuStatus — T020 (DL-8). One Business Unit's status and/or
 * explanation: `changes` = { status?: "compliant"|"pending"|"action_needed"|null,
 * note?: string, document_keys?: string[] }. Users: own units only (403 otherwise).
 * T065: document_keys are documents just uploaded for this unit, saved with
 * the status and note as one activity entry.
 */
export function updateBuStatus(idToken, regulationId, buCode, changes) {
  return apiRequest(
    `/regulations/${encodeURIComponent(regulationId)}/bu-status/${encodeURIComponent(buCode)}`,
    { method: 'PATCH', idToken, body: changes }
  );
}

/**
 * addRegulationDocument — T020. Upload a document for one unit of a
 * regulation. buCode null (Admin/SME, from the edit panel): a document for
 * the whole regulation (Srinivas, Oct 24 US, item 6).
 */
export function addRegulationDocument(idToken, regulationId, buCode, file) {
  const formData = new FormData();
  if (buCode) formData.append('bu_code', buCode);
  formData.append('file', file);
  return multipartRequest(`/regulations/${encodeURIComponent(regulationId)}/documents`, idToken, formData);
}

/** hideRegulationDocument — T020. Admin/SME only; soft (kept, never erased). */
export function hideRegulationDocument(idToken, regulationId, key) {
  return apiRequest(`/regulations/${encodeURIComponent(regulationId)}/documents/hide`, {
    method: 'POST',
    idToken,
    body: { key },
  });
}

/**
 * downloadRegulationDocument — T020. Fetches the file with the caller's token
 * (a plain link can't send it) and hands it to the browser as a download.
 */
export async function downloadRegulationDocument(idToken, regulationId, doc) {
  const res = await fetch(
    `${BASE_URL}/regulations/${encodeURIComponent(regulationId)}/documents/${encodeURIComponent(doc.key)}`,
    { headers: { Authorization: await authHeader(idToken) } }
  );
  if (!res.ok) {
    const resBody = await res.json().catch(() => ({}));
    const detail = resBody.detail || '';
    throw new ApiError(detail || `Download failed: ${res.status}`, res.status, detail);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.fileName || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * fetchUnitActivity — T065 (Srinivas, Oct 29). Who changed what on a
 * regulation's Business Units, newest first: status changes, notes and the
 * documents saved with them, each with the person's name and email. Every
 * role can read every unit's history. buCode narrows it to one unit.
 */
export function fetchUnitActivity(idToken, regulationId, buCode = null) {
  return apiRequest(`/regulations/${encodeURIComponent(regulationId)}/activity`, {
    idToken,
    params: buCode ? { bu_code: buCode } : undefined,
  });
}

/** removeActivityNote — T065. Your own note only; kept on the server, hidden from screens. */
export function removeActivityNote(idToken, regulationId, entryId) {
  return apiRequest(
    `/regulations/${encodeURIComponent(regulationId)}/activity/${encodeURIComponent(entryId)}`,
    { method: 'DELETE', idToken }
  );
}
