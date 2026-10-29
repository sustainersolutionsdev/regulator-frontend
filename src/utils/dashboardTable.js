/**
 * dashboardTable.js - pure helpers for the Compliance Dashboard table
 * (T017, FR-2.1).
 *
 * Kept out of the page so the sorting rules can be checked on their own.
 * T018 added the Status sort (urgency order; "Not set" always last).
 * T020 (DL-8): status is per Business Unit, and the Dashboard has two views,
 *   - "regulation": one row per regulation;
 *   - "bu": one row per regulation per Business Unit (unitRows), each row
 *     carrying `rowBu`.
 * Status sort: a unit row sorts on its own status; a regulation row on its
 * most urgent unit (never shown as a colour - only used for ordering).
 * Sort lives in the URL (?sort=due&dir=asc), next to the filter params the
 * Dashboard filters (T019) will add through utils/regulationFilters, which
 * leaves non-filter params such as these untouched.
 */
import { parseDueDate } from './roadmapDates';
import { STATUS_SEVERITY, isKnownStatus } from '../constants/status';

export const VIEWS = ['regulation', 'bu'];
export const DEFAULT_VIEW = 'regulation';

export function viewFromSearchParams(params) {
  const v = params.get('view');
  return VIEWS.includes(v) ? v : DEFAULT_VIEW;
}

/** Writes the view into a copy of `params`; the default view leaves the URL clean. */
export function writeViewToSearchParams(view, params) {
  const next = new URLSearchParams(params);
  if (view === DEFAULT_VIEW) next.delete('view');
  else next.set('view', view);
  return next;
}

/** One row per regulation per Business Unit, for the By Business Unit view. */
export function unitRows(regulations) {
  const rows = [];
  for (const reg of regulations) {
    for (const bu of reg.businessUnitIds || []) {
      rows.push({ ...reg, rowBu: bu, rowKey: `${reg.id}:${bu}` });
    }
  }
  return rows;
}

/** The status entry for one unit ({} when none has been set). */
export function unitEntry(reg, bu) {
  return ((reg.buStatuses || {})[bu]) || {};
}

/** Supporting documents that apply to one unit: its own, plus regulation-wide ones (no buCode). */
export function visibleDocuments(reg, bu = null) {
  return (reg.documents || []).filter((d) => !d.hidden && (!bu || !d.buCode || d.buCode === bu));
}

// Oct 26 feedback (T062): every column sorts.
export const SORT_KEYS = ['name', 'unit', 'due', 'status', 'explanation', 'domain', 'country', 'region', 'notes', 'docs', 'added', 'updated'];
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

/** T065: date and time for the activity history, e.g. "Oct 27, 2026, 4:12 PM". */
export function formatDateTime(value) {
  const date = parseTimestamp(value);
  return date
    ? date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
}

/**
 * T064/T065: uid -> { name, email } from GET /users, for "who changed it".
 * Someone no longer in the directory shows as "Former user".
 */
export function peopleById(users) {
  return Object.fromEntries(
    (users || []).map((u) => [u.id, { name: (u.displayName || '').trim() || u.email || 'Unknown', email: u.email || '' }])
  );
}

export function personFor(people, uid) {
  return (uid && people[uid]) || { name: uid ? 'Former user' : 'Unknown', email: '' };
}

/** Initials for the small avatar circles: "Priya Shah" -> "PS". */
export function initialsOf(name) {
  return (
    String(name || '')
      .replace(/@.*/, '')
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  );
}

/** T065: a unit's own documents (not the regulation-wide ones), newest first. */
export function unitDocuments(reg, bu) {
  return (reg.documents || [])
    .filter((d) => !d.hidden && d.buCode === bu)
    .sort((a, b) => (parseTimestamp(b.uploadedAt)?.getTime() || 0) - (parseTimestamp(a.uploadedAt)?.getTime() || 0));
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
  unit: (reg) => text(reg.rowBu),
  // Ascending = most urgent first (Action needed, Pending, Compliant).
  status: (reg) => {
    const units = reg.rowBu ? [reg.rowBu] : reg.businessUnitIds || [];
    const ranks = units
      .map((bu) => unitEntry(reg, bu).status)
      .filter(isKnownStatus)
      .map((st) => STATUS_SEVERITY[st]);
    return ranks.length ? String(Math.min(...ranks)) : '';
  },
  domain: (reg) => text(reg.domain),
  country: (reg) => text(reg.country),
  region: (reg) => text(reg.region),
  notes: (reg) => text(reg.notes),
  explanation: (reg) => text(reg.rowBu ? unitEntry(reg, reg.rowBu).note : ''),
  // Count of visible documents, zero-padded so text order is number order (0 docs is a value, not blank).
  docs: (reg) => String(visibleDocuments(reg, reg.rowBu || null).length).padStart(5, '0'),
  added: (reg) => {
    const date = parseTimestamp(reg.createdAt);
    return date ? date.toISOString() : '';
  },
  // Valid "YYYY-MM-DD" strings sort correctly as plain strings.
  due: (reg) => (parseDueDate(reg.dueDate) ? text(reg.dueDate) : ''),
  updated: (reg) => {
    const stamp = reg.rowBu ? unitEntry(reg, reg.rowBu).updatedAt : null;
    const date = parseTimestamp(stamp || reg.lastUpdated || reg.createdAt);
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
  const textual = ['name', 'domain', 'unit', 'country', 'region', 'notes', 'explanation'].includes(sort.key);

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
      String(a.rowKey || a.id).localeCompare(String(b.rowKey || b.id))
    );
  });
}
