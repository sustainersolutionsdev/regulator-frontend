/**
 * roadmapDates.js - pure date helpers for the Regulation Roadmap (T011, FR-1.1).
 *
 * Kept out of the page component so the maths can be checked on its own
 * and reused by the monthly calendar (T013).
 *
 * Due dates arrive from the API as "YYYY-MM-DD" strings (the Add Regulation
 * form's <input type="date">). They are parsed as LOCAL calendar dates on
 * purpose: new Date("2027-03-01") would be read as UTC midnight and can
 * shift to Feb 28 in US time zones.
 */

export function parseDueDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // Rejects impossible dates such as 2027-02-31, which Date would roll over.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Horizontal position of `date` as a percentage (0 to <100) across a window
 * that starts on Jan 1 of `startYear` and spans `years` whole years.
 * Returns null when the date falls outside the window.
 */
export function positionInWindow(date, startYear, years) {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(startYear + years, 0, 1).getTime();
  const t = date.getTime();
  if (t < start || t >= end) return null;
  return ((t - start) / (end - start)) * 100;
}

export function formatDueDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

/**
 * Splits roadmap regulations into what is visible in the window and what
 * falls before it, after it, or has no usable due date, so the screen can
 * say how many are not shown instead of silently dropping them.
 */
export function partitionByWindow(regulations, startYear, years) {
  const visible = [];
  let earlier = 0;
  let later = 0;
  let undated = 0;

  for (const reg of regulations) {
    const due = parseDueDate(reg.dueDate);
    if (!due) {
      undated += 1;
      continue;
    }
    const position = positionInWindow(due, startYear, years);
    if (position === null) {
      if (due.getFullYear() < startYear) earlier += 1;
      else later += 1;
      continue;
    }
    visible.push({ ...reg, due, position });
  }

  visible.sort((a, b) => a.due - b.due || (a.title || '').localeCompare(b.title || ''));
  return { visible, earlier, later, undated };
}
