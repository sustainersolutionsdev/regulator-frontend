/**
 * dashboardTable.js - pure helpers for the Compliance Dashboard table
 * (T017, FR-2.1).
 *
 * Kept out of the page so the sorting rules can be checked on their own.
 * T018 added the Status sort (urgency order; "Not set" always last).
 * Sort lives in the URL (?sort=due&dir=asc), next to the filter params the
 * Dashboard filters (T019) will add through utils/regulationFilters, which
 * leaves non-filter params such as these untouched.
 */
import { parseDueDate } from './roadmapDates';
import { STATUS_SEVERITY, isKnownStatus } from '../constants/status';

export const SORT_KEYS = ['name', 'due', 'status', 'domain', 'updated'];
export const DEFAULT_SORT = Object.freeze({ key: 'due', dir: 'asc' });

export function displayName(reg) {
  return (reg.abbreviatedTitle || '').trim() || reg.title || '';
}

export function sortFromSearchParams(params) {
  const key = params.get('sort');
  const dir = params.get('dir');
  return {
    key: SORT_KEYS.includes(key) ? key : DEFAULT_SORT.key,
    dir: dir === 'desc' ? 'desc' : 'asc',
  };
}

/** Writes sort into a copy of `params`; the default sort leaves the URL clean. */
export function writeSortToSearchParams(sort, params) {
  const next = new URLSearchParams(params);
  if (sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir) {
    next.delete('sort');
    next.delete('dir');
  } else {
    next.set('sort', sort.key);
    next.set('dir', sort.dir);
  }
  return next;
}

/** Next sort after a header click: same column flips, a new column starts ascending. */
export function nextSort(current, key) {
  if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: key === 'updated' ? 'desc' : 'asc' };
}

/**
 * createdAt / lastUpdated arrive as ISO date-time strings (Firestore
 * timestamps encoded by FastAPI). Returns null for anything unusable.
 */
export function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestamp(value) {
  const date = parseTimestamp(value);
  return date ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
}

function text(value) {
  return String(value ?? '').trim();
}

function compareText(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

// Each returns a comparable value, or '' when the record has none.
const SORT_VALUE = {
  name: (reg) => displayName(reg),
  // T018: ascending = most urgent first (Action needed, Pending, Compliant).
  status: (reg) => (isKnownStatus(reg.status) ? String(STATUS_SEVERITY[reg.status]) : ''),
  domain: (reg) => text(reg.domain),
  // Valid "YYYY-MM-DD" strings sort correctly as plain strings.
  due: (reg) => (parseDueDate(reg.dueDate) ? text(reg.dueDate) : ''),
  updated: (reg) => {
    const date = parseTimestamp(reg.lastUpdated || reg.createdAt);
    return date ? date.toISOString() : '';
  },
};

/**
 * Returns a sorted copy. Records with no value for the sort column always go
 * last, whichever direction is chosen; ties fall back to name, then id, so the
 * order is stable between reloads.
 */
export function sortRegulations(regulations, sort) {
  const valueOf = SORT_VALUE[sort.key] || SORT_VALUE[DEFAULT_SORT.key];
  const sign = sort.dir === 'desc' ? -1 : 1;
  const textual = sort.key === 'name' || sort.key === 'domain';

  return [...regulations].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (!va && vb) return 1;
    if (va && !vb) return -1;
    let primary = 0;
    if (va && vb) {
      if (textual) primary = compareText(va, vb);
      else primary = va < vb ? -1 : va > vb ? 1 : 0;
    }
    return (
      primary * sign ||
      compareText(displayName(a), displayName(b)) ||
      String(a.id).localeCompare(String(b.id))
    );
  });
}
