/**
 * Compliance status - T018 (FR-2.1, FR-2.5).
 *
 * Three SME-set values (never inferred or AI-generated), plus "Not set" for
 * a regulation nobody has given a status yet. Stored on the record as
 * `status` = "compliant" | "pending" | "action_needed" | null.
 *
 * Colours are the locked brand status colours (UI/UX doc 3.1). The non-colour
 * cue (UI/UX doc 3.3) is the glyph: check / dot / exclamation, and an empty
 * dashed ring for "Not set" - so status is never carried by colour alone.
 *
 * Swatch contrast (WCAG 1.4.11, 3:1 for graphics), measured against the
 * actual tokens: navy glyph on the brand fills 4.7-8.3:1; in light mode a
 * darker ring keeps every swatch at or above 4.4:1 against white and the
 * muted surfaces.
 */
export const STATUS_VALUES = ['action_needed', 'pending', 'compliant'];

export const STATUS_META = {
  compliant: {
    label: 'Compliant',
    glyph: 'check',
    swatch: 'bg-status-compliant ring-1 ring-green-700 dark:ring-0',
  },
  pending: {
    label: 'Pending',
    glyph: 'dot',
    swatch: 'bg-status-pending ring-1 ring-amber-700 dark:ring-0',
  },
  action_needed: {
    label: 'Action needed',
    glyph: 'alert',
    swatch: 'bg-status-action ring-1 ring-red-700 dark:ring-0',
  },
};

export const NOT_SET_META = {
  label: 'Not set',
  glyph: null,
  swatch: 'border-2 border-dashed border-slate-500 dark:border-slate-400',
};

/** Lower number = more urgent. Used for sorting; "Not set" sorts last. */
export const STATUS_SEVERITY = { action_needed: 0, pending: 1, compliant: 2 };

export function isKnownStatus(value) {
  return Object.prototype.hasOwnProperty.call(STATUS_META, value);
}

export function statusMeta(value) {
  return isKnownStatus(value) ? STATUS_META[value] : NOT_SET_META;
}

export function statusLabel(value) {
  return statusMeta(value).label;
}
