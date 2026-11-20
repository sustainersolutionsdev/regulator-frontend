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

/**
 * checkDuplicates - T034 (FR-5.1). Called when the SME clicks Save on Add
 * Regulation, before the regulation is created. Admin/SME only. Returns
 * { likelyDuplicates, related, needsConfirmation, otherBusinessUnit,
 *   aiChecked, aiUnavailable, note }. The AI is asked only when a similar
 * regulation exists, so most saves cost nothing.
 */
export function checkDuplicates(idToken, entry) {
  return apiRequest('/regulations/check-duplicates', {
    method: 'POST',
    idToken,
    body: {
      title: entry.title,
      abbreviated_title: entry.abbreviatedTitle,
      due_date: entry.dueDate,
      domain: entry.domain,
      country: entry.country,
      region: entry.region,
      notes: entry.notes,
      business_unit_ids: entry.businessUnitIds,
    },
  });
}

/**
 * suggestFields - T035 (FR-5.2). The pasted regulation text -> suggestions
 * for Domain, Country, Region and Business Units, each { value, reason,
 * confidence } or { value: null, notSure }. Nothing is saved; the text is
 * not stored. 400 when the text is too short; aiAvailable false (with a
 * message) when the AI can't help.
 */
export function suggestFields(idToken, text) {
  return apiRequest('/regulations/suggest-fields', { method: 'POST', idToken, body: { text } });
}
