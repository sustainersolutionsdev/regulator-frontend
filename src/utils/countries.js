/**
 * countries.js - turns the free-text Country field into flag codes
 * (Oct 24 meeting, item 9).
 *
 * Country is free text on the Add Regulation form, so people write "USA",
 * "United States", "U.S.", "France" or "EU". Names come from the browser's
 * own country list (Intl.DisplayNames, English) plus common short forms.
 * A value that can't be matched simply shows no flag; the country name is
 * always shown as text anyway.
 *
 * Several countries in one field ("USA, Canada", "France / Germany") give
 * one flag each, up to MAX_FLAGS.
 */

export const MAX_FLAGS = 3;

const ALIASES = {
  usa: 'us',
  us: 'us',
  'united states': 'us',
  'united states of america': 'us',
  america: 'us',
  uk: 'gb',
  'united kingdom': 'gb',
  'great britain': 'gb',
  britain: 'gb',
  england: 'gb-eng',
  scotland: 'gb-sct',
  wales: 'gb-wls',
  eu: 'eu',
  'european union': 'eu',
  europe: 'eu',
  'south korea': 'kr',
  korea: 'kr',
  'republic of korea': 'kr',
  'north korea': 'kp',
  russia: 'ru',
  'czech republic': 'cz',
  czechia: 'cz',
  vietnam: 'vn',
  'viet nam': 'vn',
  taiwan: 'tw',
  uae: 'ae',
  'united arab emirates': 'ae',
  holland: 'nl',
  'the netherlands': 'nl',
  turkey: 'tr',
  turkiye: 'tr',
  'hong kong': 'hk',
  macau: 'mo',
  'ivory coast': 'ci',
  burma: 'mm',
  un: 'un',
  'united nations': 'un',
};

export function normalizeCountry(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Retired codes the browser still names (e.g. FX "France", DD "Germany",
// SU "Russia"). Skipped, so each name maps to the current code and its flag.
const RETIRED = new Set(['AN', 'BU', 'CS', 'DD', 'DY', 'FX', 'HV', 'NH', 'RH', 'SU', 'TP', 'UK', 'VD', 'YD', 'YU', 'ZR']);

let nameIndex = null;

/** name (normalised) -> lowercase ISO code, built once from the browser's list. */
function names() {
  if (nameIndex) return nameIndex;
  nameIndex = new Map();
  let display = null;
  try {
    display = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
  } catch {
    // Very old browser: aliases still work.
  }
  const A = 'A'.charCodeAt(0);
  for (let i = 0; i < 26; i += 1) {
    for (let j = 0; j < 26; j += 1) {
      const code = String.fromCharCode(A + i, A + j);
      let name;
      try {
        name = display?.of(code);
      } catch {
        name = undefined;
      }
      if (!name || name === code || RETIRED.has(code)) continue;
      const lower = code.toLowerCase();
      // "Myanmar (Burma)" is also found as "Myanmar"; "Congo - Kinshasa" as written.
      for (const variant of [name, name.replace(/\s*\(.*\)\s*/, ' ')]) {
        const key = normalizeCountry(variant);
        if (key && !nameIndex.has(key)) nameIndex.set(key, lower);
      }
    }
  }
  return nameIndex;
}

/** One country name or code -> lowercase flag code, or null. */
export function countryCode(value) {
  const key = normalizeCountry(value);
  if (!key) return null;
  if (ALIASES[key]) return ALIASES[key];
  const byName = names().get(key);
  if (byName) return byName;
  if (/^[a-z]{2}$/.test(key) && [...names().values()].includes(key)) return key;
  return null;
}

/** The Country field -> up to MAX_FLAGS distinct flag codes, in the order written. */
export function countryCodes(value) {
  const parts = String(value ?? '')
    .split(/\s*(?:,|\/|;|&|\band\b|\+)\s*/i)
    .filter(Boolean);
  const codes = [];
  for (const part of parts) {
    const code = countryCode(part);
    if (code && !codes.includes(code)) codes.push(code);
    if (codes.length === MAX_FLAGS) break;
  }
  if (codes.length === 0) {
    const whole = countryCode(value);
    if (whole) codes.push(whole);
  }
  return codes;
}
