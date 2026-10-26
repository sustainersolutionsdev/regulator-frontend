/**
 * options.js - matching rules for list fields with "Other" (OptionCombobox:
 * Domain, Oct 24 meeting item 2; Region, Oct 26 testing feedback). Kept apart
 * from the component so they can be tested alone.
 */

export const OTHER = 'Other';

export function isListed(choices, value) {
  const v = String(value ?? '').trim().toLowerCase();
  return Boolean(v) && choices.some((c) => c.toLowerCase() === v);
}

/** Options matching the typed text: whole-name prefix first, then word prefix. */
export function matchOptions(choices, query) {
  const q = query.trim().toLowerCase();
  if (!q) return choices;
  const starts = [];
  const wordStarts = [];
  for (const c of choices) {
    const lower = c.toLowerCase();
    if (lower.startsWith(q)) starts.push(c);
    else if (lower.split(/[\s/&-]+/).some((w) => w && w.startsWith(q))) wordStarts.push(c);
  }
  return [...starts, ...wordStarts];
}
