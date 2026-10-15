import { STATUS_VALUES, statusMeta } from '../constants/status';

/**
 * StatusSwatch - the compliance status mark (T018, FR-2.1 / FR-2.5).
 *
 * Colour only, no visible text (Srinivas's preference), with a non-colour
 * glyph (check / dot / exclamation; dashed ring for "Not set") and a
 * screen-reader label, as reconciled in FR-2.5 and DL-3. One component for
 * the Dashboard, Roadmap markers, calendar chips and the edit panel, so the
 * mark is identical everywhere.
 *
 * Props:
 *   status       "compliant" | "pending" | "action_needed" | null/undefined
 *   size         "sm" (14px) | "md" (20px)
 *   decorative   true when the surrounding element already names the status
 *                (e.g. a button's aria-label) - drops the sr-only text
 */

const SIZES = {
  sm: { box: 'w-3.5 h-3.5', icon: 10 },
  md: { box: 'w-5 h-5', icon: 12 },
};

function Glyph({ kind, px }) {
  if (!kind) return null;
  const common = {
    width: px,
    height: px,
    viewBox: '0 0 12 12',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    focusable: 'false',
  };
  if (kind === 'check') {
    return (
      <svg {...common}>
        <path d="M2.5 6.2 5 8.6 9.5 3.6" />
      </svg>
    );
  }
  if (kind === 'dot') {
    return (
      <svg {...common} stroke="none" fill="currentColor">
        <circle cx="6" cy="6" r="2.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 2.6v4" />
      <path d="M6 9.3v.01" strokeWidth="2.4" />
    </svg>
  );
}

export default function StatusSwatch({ status, size = 'md', decorative = false, className = '' }) {
  const meta = statusMeta(status);
  const s = SIZES[size] || SIZES.md;

  return (
    <span className={`inline-flex items-center ${className}`} title={decorative ? undefined : meta.label}>
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center flex-none rounded-full text-brand-navy ${s.box} ${meta.swatch}`}
      >
        <Glyph kind={meta.glyph} px={s.icon} />
      </span>
      {!decorative && <span className="sr-only">Status: {meta.label}</span>}
    </span>
  );
}

/** Key to the four marks, shown under every view that uses them. */
export function StatusLegend({ className = '' }) {
  return (
    <ul aria-label="Status key" className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      {[...STATUS_VALUES, null].map((value) => (
        <li key={value ?? 'not-set'} className="flex items-center gap-1.5">
          <StatusSwatch status={value} size="sm" decorative />
          {statusMeta(value).label}
        </li>
      ))}
    </ul>
  );
}
