/**
 * calendarMonth.js - month-grid helpers for the Monthly Calendar (T013, FR-1.3).
 *
 * The grid maths (leading blanks from the 1st's weekday, days-in-month) is
 * the one piece adapted from the prior MVP's CalendarProposed.jsx (OPEN-2:
 * rebuild, reusing only this logic). Everything else is new.
 */
import { parseDueDate } from './roadmapDates';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function dateKey(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Weeks for a month: arrays of 7 cells, each a day number or null (blank). */
export function buildMonthWeeks(year, monthIndex) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * Regulations due in the given month, grouped by "YYYY-MM-DD", each day's
 * list sorted by display name. Regulations without a valid due date are skipped.
 */
export function groupByDueDateInMonth(regulations, year, monthIndex) {
  const prefix = `${year}-${pad2(monthIndex + 1)}-`;
  const map = {};
  for (const reg of regulations) {
    const due = parseDueDate(reg.dueDate);
    if (!due) continue;
    const key = reg.dueDate.trim().slice(0, 10);
    if (!key.startsWith(prefix)) continue;
    (map[key] ||= []).push({ ...reg, due });
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }
  return map;
}

export function displayName(reg) {
  return (reg.abbreviatedTitle || '').trim() || reg.title;
}

/**
 * Reads ?month=YYYY-MM. FR-1.3 scopes this screen to the current year, so
 * any other year (or a malformed value) falls back to this month.
 */
export function monthFromParam(value, today = new Date()) {
  const thisYear = today.getFullYear();
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (year === thisYear && monthIndex >= 0 && monthIndex <= 11) return { year, monthIndex };
  }
  return { year: thisYear, monthIndex: today.getMonth() };
}

export function monthParam(year, monthIndex) {
  return `${year}-${pad2(monthIndex + 1)}`;
}
