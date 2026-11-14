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

/**
 * fetchInsightSummary - T031. The AI summary of one Compliance Overview row
 * on Insights (group: "compliant" | "pending" | "action_needed" | "not_set",
 * or "all" for the whole view, FR-4.6), for the page's filters. The server
 * applies the filters itself. Same timing as above: the first open can take
 * up to ~30 s; the same view reopens at once until something in it changes.
 */
export function fetchInsightSummary(idToken, group, filters) {
  const { q, domain, bu, country, region, dueFrom, dueTo, docs } = filters;
  return apiRequest('/insights/summary', {
    method: 'POST',
    idToken,
    body: { group, filters: { q, domain, bu, country, region, dueFrom, dueTo, docs } },
  });
}

/**
 * fetchChartNotes - T076. A 2-line AI note for each Insights chart, for the
 * page's filters; one AI call covers every chart, written from the chart
 * numbers only. The server applies the filters itself. The same view comes
 * back at once (saved) until a number in it changes.
 * Returns { aiGenerated, notes: { domain, region, country, bu, quarter, grid }, generatedAt, ... }.
 */
export function fetchChartNotes(idToken, filters) {
  const { q, domain, bu, country, region, dueFrom, dueTo, docs } = filters;
  return apiRequest('/insights/chart-notes', {
    method: 'POST',
    idToken,
    body: { filters: { q, domain, bu, country, region, dueFrom, dueTo, docs } },
  });
}
