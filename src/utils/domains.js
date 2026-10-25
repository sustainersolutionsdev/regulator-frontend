/**
 * domains.js - matching rules for the Domain field (DomainSelect, Oct 24
 * meeting item 2). Kept apart from the component so they can be tested alone.
 */
import { DOMAIN_OPTIONS } from '../constants/domains';

export const OTHER = 'Other';

export function isListedDomain(value) {
  return DOMAIN_OPTIONS.some((d) => d.toLowerCase() === String(value ?? '').trim().toLowerCase());
}

/** Domains matching the typed text: whole-name prefix first, then word prefix. */
export function matchDomains(query) {
  const q = query.trim().toLowerCase();
  if (!q) return DOMAIN_OPTIONS;
  const starts = [];
  const wordStarts = [];
  for (const d of DOMAIN_OPTIONS) {
    const lower = d.toLowerCase();
    if (lower.startsWith(q)) starts.push(d);
    else if (lower.split(/[\s/&-]+/).some((w) => w && w.startsWith(q))) wordStarts.push(d);
  }
  return [...starts, ...wordStarts];
}
