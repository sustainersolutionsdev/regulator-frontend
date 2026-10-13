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
 * "Add to Roadmap and Dashboard" is not a filter: it decides whether a
 * regulation is on these screens at all. Status joins with T018.
 *
 * Filters live in the URL (?domain=Batteries&bu=BU1...) so a filtered view
 * survives a reload, works with Back, and can be shared as a link.
 */

export const NOT_SET = '__none__'; // option for a blank Country / Region

export const EMPTY_FILTERS = Object.freeze({
  q: '',
  domain: [],
  bu: [],
  country: [],
  region: [],
  dueFrom: '',
  dueTo: '',
  docs: '', // '' = any, 'with', 'without'
});

const MULTI_KEYS = ['domain', 'bu', 'country', 'region'];
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
 * params (e.g. a future ?view=) untouched.
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

export function applyFilters(regulations, filters) {
  const q = filters.q.trim().toLowerCase();

  return regulations.filter((reg) => {
    if (q) {
      const haystack = [reg.title, reg.abbreviatedTitle, reg.notes].map(norm).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (!matchesMulti(filters.domain, reg.domain)) return false;
    if (!matchesMulti(filters.country, reg.country)) return false;
    if (!matchesMulti(filters.region, reg.region)) return false;
    if (filters.bu.length) {
      const regBus = reg.businessUnitIds || [];
      if (!filters.bu.some((code) => regBus.includes(code))) return false;
    }
    // Due dates are "YYYY-MM-DD", so string comparison is date order.
    const due = norm(reg.dueDate);
    if (filters.dueFrom && (!due || due < filters.dueFrom)) return false;
    if (filters.dueTo && (!due || due > filters.dueTo)) return false;
    const hasDocs = (reg.documents || []).length > 0;
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

export function businessUnitOptions(regulations, businessUnits) {
  const counts = new Map();
  for (const reg of regulations) {
    for (const code of reg.businessUnitIds || []) counts.set(code, (counts.get(code) || 0) + 1);
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
