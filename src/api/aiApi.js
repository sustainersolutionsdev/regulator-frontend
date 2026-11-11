/**
 * aiApi.js - AI features (M4, Insights).
 *
 * fetchRegulationSummary - T029. The AI summary of one regulation. The first
 * open (or the first after anything about it changes) asks Gemini and can
 * take up to ~30 s; after that the stored summary comes back at once, with
 * the same wording on the Roadmap and the Dashboard.
 * Errors arrive as ApiError with a message to show as it is (AI paused,
 * today's limit reached, no answer).
 *
 * fetchAiStatus - T028. Whether AI is on, and the company's calls today.
 */
import { apiRequest } from './apiClient';

export function fetchRegulationSummary(idToken, regulationId) {
  return apiRequest(`/regulations/${encodeURIComponent(regulationId)}/summary`, { idToken });
}

export function fetchAiStatus(idToken) {
  return apiRequest('/ai/status', { idToken });
}
