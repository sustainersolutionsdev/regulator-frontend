/**
 * regulationFilters.js - shared filter logic for regulation lists.
 *
 * T012 (FR-1.2: Roadmap filterable by any Add Regulation field). Built
 * screen-agnostic so the Dashboard filters (T019, FR-2.2 - same rule) reuse
 * it unchanged.
 *
 * Filterable fields come from Srinivas's 10-field Add Regulation form:
 *   title / abbreviated title / notes  -> one text search
 *   domain, country, region            -> multi-select of values in use
 *   business units                     -> multi-select
 *   due date                           -> from / to range
 *   documents                          -> with / without
 * plus Status: compliant / pending / action needed / not set. Status is per
 * Business Unit (DL-8, T020), so it is matched per unit:
 *   - a "unit row" (Dashboard, By Business Unit view: has `rowBu`) matches on
 *     its own unit's status;
 *   - a regulation row matches if ANY of its units has a selected status -
 *     only the units in the Business Unit filter, when that filter is set.
 * Business Unit filter on a unit row matches the row's own unit. The text
 * search also covers the status explanations.
 * The Roadmap shows no status (DL-8) and passes no status filter.
 * "Add to Roadmap and Dashboard" is not a filter: it decides whether a
 * regulation is on these screens at all.
 *
 * Filters live in the URL (?domain=Batteries&bu=BU1...) so a filtered view
 * survives a reload, works with Back, and can be shared as a link.
 */
import { STATUS_VALUES, isKnownStatus, statusLabel } from '../constants/status';

export const NOT_SET = '__none__'; // option for a blank Country / Region / Status

export const EMPTY_FILTERS = Object.freeze({
  q: '',
  status: [],
  domain: [],
  bu: [],
  country: [],
  region: [],
  dueFrom: '',
  dueTo: '',
  docs: '', // '' = any, 'with', 'without'
});

const MULTI_KEYS = ['status', 'domain', 'bu', 'country', 'region'];
const SINGLE_KEYS = ['q', 'dueFrom', 'dueTo', 'docs'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function filtersFromSearchParams(params) {
  const filters = { ...EMPTY_FILTERS };
  for (const key of MULTI_KEYS) filters[key] = params.getAll(key).filter(Boolean);
  for (const key of SINGLE_KEYS) filters[key] = params.get(key) || '';
  if (!DATE_RE.test(filters.dueFrom)) filters.dueFrom = '';
  if (!DATE_RE.test(filters.dueTo)) filters.dueTo = '';
  if (!['with', 'without'].includes(filters.docs)) filters.docs = '';
  return filters;
}

/**
 * Writes filters into `params` (a URLSearchParams), leaving any non-filter
 * params (e.g. the Dashboard's ?sort=) untouched.
 */
export function writeFiltersToSearchParams(filters, params) {
  const next = new URLSearchParams(params);
  for (const key of [...MULTI_KEYS, ...SINGLE_KEYS]) next.delete(key);
  for (const key of MULTI_KEYS) for (const v of filters[key] || []) next.append(key, v);
  for (const key of SINGLE_KEYS) if (filters[key]) next.set(key, filters[key]);
  return next;
}

export function countActiveFilters(filters) {
  let n = 0;
  if (filters.q.trim()) n += 1;
  for (const key of MULTI_KEYS) if (filters[key].length) n += 1;
  if (filters.dueFrom || filters.dueTo) n += 1;
  if (filters.docs) n += 1;
  return n;
}

function norm(value) {
  return String(value ?? '').trim();
}

function matchesMulti(selected, value) {
  if (!selected.length) return true;
  const v = norm(value);
  return selected.includes(v === '' ? NOT_SET : v);
}

/** One unit's status key; anything that isn't a real status is "Not set". */
export function unitStatusKey(reg, bu) {
  const v = norm(((reg.buStatuses || {})[bu] || {}).status);
  return isKnownStatus(v) ? v : NOT_SET;
}

/** The units whose status counts for this row under the current BU filter. */
function unitsInScope(reg, buFilter) {
  if (reg.rowBu) return [reg.rowBu];
  const units = reg.businessUnitIds || [];
  return buFilter.length ? units.filter((bu) => buFilter.includes(bu)) : units;
}

function unitNotes(reg) {
  const statuses = reg.buStatuses || {};
  const units = reg.rowBu ? [reg.rowBu] : Object.keys(statuses);
  return units.map((bu) => (statuses[bu] || {}).note);
}

export function applyFilters(regulations, filters) {
  const q = filters.q.trim().toLowerCase();

  return regulations.filter((reg) => {
    if (q) {
      const haystack = [reg.title, reg.abbreviatedTitle, reg.notes, ...unitNotes(reg)]
        .map(norm)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.status.length) {
      const keys = unitsInScope(reg, filters.bu).map((bu) => unitStatusKey(reg, bu));
      if (!keys.some((k) => filters.status.includes(k))) return false;
    }
    if (!matchesMulti(filters.domain, reg.domain)) return false;
    if (!matchesMulti(filters.country, reg.country)) return false;
    if (!matchesMulti(filters.region, reg.region)) return false;
    if (filters.bu.length) {
      const regBus = reg.rowBu ? [reg.rowBu] : reg.businessUnitIds || [];
      if (!filters.bu.some((code) => regBus.includes(code))) return false;
    }
    // Due dates are "YYYY-MM-DD", so string comparison is date order.
    const due = norm(reg.dueDate);
    if (filters.dueFrom && (!due || due < filters.dueFrom)) return false;
    if (filters.dueTo && (!due || due > filters.dueTo)) return false;
    const hasDocs = (reg.documents || []).some((d) => !d.hidden);
    if (filters.docs === 'with' && !hasDocs) return false;
    if (filters.docs === 'without' && hasDocs) return false;
    return true;
  });
}

/**
 * Options for one multi-select, built from the values actually in use so no
 * option ever leads to an empty result. Values compare exactly as stored
 * (Domain is free text with suggestions, so "Batteries" and "batteries" are
 * shown as two options rather than silently merged).
 */
export function distinctOptions(regulations, field) {
  const counts = new Map();
  let blank = 0;
  for (const reg of regulations) {
    const v = norm(reg[field]);
    if (!v) blank += 1;
    else counts.set(v, (counts.get(v) || 0) + 1);
  }
  const options = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, label: value, count }));
  if (blank) options.push({ value: NOT_SET, label: 'Not specified', count: blank });
  return options;
}

/**
 * Status options in urgency order (Action needed first), "Not set" last.
 * Counted per unit (a regulation shared by two units counts once for each
 * unit's status), so the numbers read as "how many unit statuses".
 */
export function statusOptions(regulations) {
  const counts = new Map();
  for (const reg of regulations) {
    for (const bu of unitsInScope(reg, [])) {
      const key = unitStatusKey(reg, bu);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...STATUS_VALUES, NOT_SET]
    .filter((key) => counts.has(key))
    .map((key) => ({
      value: key,
      label: key === NOT_SET ? 'Not set' : statusLabel(key),
      count: counts.get(key),
    }));
}

export function businessUnitOptions(regulations, businessUnits) {
  const counts = new Map();
  for (const reg of regulations) {
    for (const code of reg.rowBu ? [reg.rowBu] : reg.businessUnitIds || []) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }
  const labelByCode = Object.fromEntries(businessUnits.map((bu) => [bu.code, bu.label]));
  return [...counts.entries()]
    .map(([code, count]) => ({
      value: code,
      label: labelByCode[code] ? `${labelByCode[code]} (${code})` : code,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
