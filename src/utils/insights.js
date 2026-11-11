/**
 * insights.js - the numbers on the Insights page (T030; FR-4.3, FR-4.4;
 * DL-18). Pure functions, so they can be checked without a browser.
 *
 * Counting rules (decision 3A, Nov 9; DL-18 point 4):
 *  - "Total regulations" counts each regulation once.
 *  - The status counts count each regulation once PER BUSINESS UNIT, because
 *    one regulation can be red for one unit and green for another (DL-8:
 *    no combined colour). A regulation shared by 3 units adds 1 to the total
 *    and 3 to the status counts. "Not set" is counted too.
 *  - With a Business Unit filter, only the selected units count.
 *  - The time range filters by due date (DL-18 point 2).
 * Blank Domain / Country / Region is shown as "Not specified".
 */
import { STATUS_VALUES } from '../constants/status';
import { NOT_SET, applyFilters, unitStatusKey } from './regulationFilters';

export const STATUS_ORDER = ['compliant', 'pending', 'action_needed', NOT_SET]; // approved table order (examples doc)

/** Units of a regulation that count under the Business Unit filter. */
export function unitsInScope(reg, buFilter) {
  const units = reg.businessUnitIds || [];
  return buFilter && buFilter.length ? units.filter((bu) => buFilter.includes(bu)) : units;
}

function tally(items) {
  const counts = new Map();
  for (const key of items) counts.set(key, (counts.get(key) || 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function field(reg, name) {
  const v = String(reg[name] ?? '').trim();
  return v || 'Not specified';
}

/**
 * regulations: what the API returns; only those on the Roadmap and Dashboard
 * and not removed are counted. filters: as in utils/regulationFilters
 * (status and search are ignored here).
 */
export function buildInsights(regulations, businessUnits, filters) {
  const labelByCode = Object.fromEntries((businessUnits || []).map((bu) => [bu.code, bu.label]));
  const live = regulations.filter((r) => r.addToRoadmapDashboard === true && !r.hidden);
  const scoped = applyFilters(live, { ...filters, status: [], q: '' });

  const statusCounts = Object.fromEntries(STATUS_ORDER.map((k) => [k, 0]));
  const unitCodes = [];
  for (const reg of scoped) {
    for (const bu of unitsInScope(reg, filters.bu)) {
      statusCounts[unitStatusKey(reg, bu)] += 1;
      unitCodes.push(bu);
    }
  }
  const unitStatuses = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const byDomain = tally(scoped.map((r) => field(r, 'domain')));
  const byRegion = tally(scoped.map((r) => field(r, 'region')));
  const byCountry = tally(scoped.map((r) => field(r, 'country')));
  const byUnit = tally(unitCodes.map((code) => labelByCode[code] || code));

  return {
    regulations: scoped,
    total: scoped.length,
    unitStatuses,
    statusCounts,
    domains: byDomain.filter((d) => d.label !== 'Not specified').length,
    countries: byCountry.filter((d) => d.label !== 'Not specified').length,
    units: byUnit.length,
    byDomain,
    byRegion,
    byCountry,
    byUnit,
  };
}

/** At most `max` slices: the largest, then "Other" for the rest (pies stay readable). */
export function topWithOther(rows, max = 6) {
  if (rows.length <= max) return rows;
  const head = rows.slice(0, max - 1);
  const rest = rows.slice(max - 1).reduce((sum, r) => sum + r.count, 0);
  return [...head, { label: `Other (${rows.length - (max - 1)})`, count: rest, other: true }];
}

/** Default time range: the current calendar year, by due date. */
export function currentYearRange(now = new Date()) {
  const y = now.getFullYear();
  return { dueFrom: `${y}-01-01`, dueTo: `${y}-12-31` };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthYear(iso) {
  const [y, m] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** "Jan 2026 – Dec 2026", "from Mar 2026", "to Dec 2027", or "all due dates". */
export function rangeLabel(filters) {
  const { dueFrom, dueTo } = filters;
  if (dueFrom && dueTo) return `${monthYear(dueFrom)} – ${monthYear(dueTo)}`;
  if (dueFrom) return `from ${monthYear(dueFrom)}`;
  if (dueTo) return `to ${monthYear(dueTo)}`;
  return 'all due dates';
}

export function percent(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

export { STATUS_VALUES, NOT_SET };
