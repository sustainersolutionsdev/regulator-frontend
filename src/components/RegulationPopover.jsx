/**
 * RegulationPopover - the Roadmap's regulation pop-up (Oct 24 meeting,
 * item 3; Niranjan's Oct 18 point 3).
 *
 * Opens from the regulation itself (its name or its marker), not the month.
 * Shows all of the regulation's details and its documents to download
 * (RegulationDetails), and Edit for Admin/SME. Following DL-6 (Srinivas,
 * Oct 13), Users change nothing from the Roadmap, so they get no Edit here.
 *
 * Two ways in:
 *  - hover: a preview that stays open while the pointer is on the regulation
 *    or the pop-up, so its buttons can be reached;
 *  - click, tap or Enter: the pop-up stays open ("pinned") and keyboard focus
 *    moves into it. Escape, Close, or a click elsewhere closes it, and focus
 *    returns to the regulation.
 *
 * Position: fixed to the viewport next to whatever opened it, so it is never
 * clipped by the timeline's sideways scroll. It flips above when there's more
 * room there, and scrolls inside itself when it is taller than the space.
 * It is rendered inside the regulation's row, so Tab moves on to the next row.
 */
import { useEffect, useReducer, useRef } from 'react';
import RegulationDetails from './RegulationDetails';

const WIDTH = 384;
const GAP = 6;
const MARGIN = 8;

function placement(anchor) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const r = anchor.getBoundingClientRect();
  const width = Math.min(WIDTH, vw - 2 * MARGIN);
  const below = vh - r.bottom - GAP - MARGIN;
  const above = r.top - GAP - MARGIN;
  const left = Math.min(Math.max(r.left, MARGIN), vw - width - MARGIN);
  if (below >= 280 || below >= above) {
    return { top: r.bottom + GAP, left, width, maxHeight: Math.max(below, 160) };
  }
  return { bottom: vh - r.top + GAP, left, width, maxHeight: Math.max(above, 160) };
}

export default function RegulationPopover({
  reg,
  anchor,
  pinned,
  buLabelByCode,
  onClose,
  onEdit,
  onPointerEnter,
  onPointerLeave,
}) {
  const ref = useRef(null);
  const [, reposition] = useReducer((n) => n + 1, 0);
  const headingId = `reg-pop-title-${reg.id}`;

  // Follow the regulation when the page or the timeline scrolls or resizes.
  useEffect(() => {
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, []);

  // Pinned: move focus in; close on a click anywhere else, or on Escape even
  // if focus has wandered out of the pop-up.
  useEffect(() => {
    if (!pinned) return undefined;
    ref.current?.focus();
    const onPointer = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose({ restoreFocus: false });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose({ restoreFocus: true });
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned, anchor, onClose]);

  if (!anchor || !anchor.isConnected) return null;
  const style = placement(anchor);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={headingId}
      tabIndex={-1}
      style={{ position: 'fixed', ...style }}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose({ restoreFocus: true });
        }
      }}
      onBlur={(e) => {
        // Pinned and keyboard focus has left both the pop-up and the regulation.
        if (pinned && e.relatedTarget && !ref.current?.contains(e.relatedTarget) && !anchor.contains(e.relatedTarget)) {
          onClose({ restoreFocus: false });
        }
      }}
      className="z-50 overflow-y-auto rounded-md border px-4 py-3 shadow-xl bg-surface-card dark:bg-surface-card-dark border-border-strong dark:border-border-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
    >
      <RegulationDetails reg={reg} buLabelByCode={buLabelByCode} headingId={headingId} />

      <div className="mt-3 flex items-center gap-3">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded-md bg-brand-teal text-white font-medium hover:bg-brand-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-card-dark"
          >
            Edit regulation
          </button>
        )}
        <button
          type="button"
          onClick={() => onClose({ restoreFocus: true })}
          className="text-xs px-2 py-1.5 text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-md"
        >
          Close
        </button>
      </div>
    </div>
  );
}
