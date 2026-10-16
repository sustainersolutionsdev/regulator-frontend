import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchRegulations, RegulationApiError } from '../api/regulationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import ErrorBanner from '../components/ErrorBanner';
import RoadmapViewSwitch from '../components/RoadmapViewSwitch';
import RegulationEditPanel from '../components/RegulationEditPanel';
import { formatDueDate } from '../utils/roadmapDates';
import {
  DAY_NAMES,
  DAY_NAMES_FULL,
  MONTH_NAMES,
  buildMonthWeeks,
  dateKey,
  displayName,
  groupByDueDateInMonth,
  monthFromParam,
  monthParam,
} from '../utils/calendarMonth';

/**
 * MonthlyCalendar - Screen 6 (T013, FR-1.3).
 *
 * Regulation due dates falling in the CURRENT year, month by month. A
 * separate screen from the Roadmap timeline, as FR-1.3 requires; the two are
 * linked by RoadmapViewSwitch. Viewable tenant-wide by every role (FR-1.4).
 *
 * OPEN-2 (reuse vs rebuild the prior MVP calendar): rebuilt. Only the
 * month-grid maths was carried over (utils/calendarMonth.js). The old
 * component read mock JSON, coloured by agency/status (neither is a field on
 * Srinivas's form), bundled the Roadmap as a tab (FR-1.3 forbids that) and
 * depended on prop-types, which this repo doesn't install.
 *
 * Same data rule as the Roadmap: only regulations saved with "Add to Roadmap
 * and Dashboard" = Yes. No compliance status here (DL-8, Srinivas Oct 16
 * 2026): the calendar is a timeframe view; status lives on the Dashboard.
 * T018's status chips were removed in T020; chips are teal.
 *
 * The month lives in the URL (?month=2026-10), so Back and reload keep it.
 *
 * Editing (T014): Admin and SME see an Edit button in a chip's details,
 * which opens RegulationEditPanel. Users get no edit controls (Srinivas,
 * Oct 13 2026).
 */

const MAX_CHIPS_PER_DAY = 3;

function DetailPopover({ id, reg, buLabelByCode, alignRight, onClose, anchorRef, onEdit }) {
  const ref = useRef(null);

  useEffect(() => {
    const onPointer = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [onClose, anchorRef]);

  const buLabels = (reg.businessUnitIds || []).map((code) => buLabelByCode[code] || code);
  const place = [reg.region, reg.country].filter(Boolean).join(', ');
  const docs = (reg.documents || []).filter((d) => !d.hidden).length;

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-label={`Details: ${reg.title}`}
      className={[
        'absolute top-full mt-1 z-40 w-72 max-w-[80vw] rounded-md border px-3 py-2.5 text-left shadow-lg',
        'bg-surface-card dark:bg-surface-card-dark border-border-strong dark:border-border-dark',
        alignRight ? 'right-0' : 'left-0',
      ].join(' ')}
    >
      <p className="text-body font-semibold text-text-primary dark:text-white leading-snug">{reg.title}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
        <dt className="text-text-tertiary dark:text-slate-400">Due</dt>
        <dd className="text-text-primary dark:text-slate-200">{formatDueDate(reg.due)}</dd>
        <dt className="text-text-tertiary dark:text-slate-400">Domain</dt>
        <dd className="text-text-primary dark:text-slate-200">{reg.domain || '-'}</dd>
        {place && (
          <>
            <dt className="text-text-tertiary dark:text-slate-400">Region</dt>
            <dd className="text-text-primary dark:text-slate-200">{place}</dd>
          </>
        )}
        <dt className="text-text-tertiary dark:text-slate-400">Business Units</dt>
        <dd className="text-text-primary dark:text-slate-200">{buLabels.join(', ') || '-'}</dd>
        <dt className="text-text-tertiary dark:text-slate-400">Documents</dt>
        <dd className="text-text-primary dark:text-slate-200">{docs || 'None'}</dd>
      </dl>
      {reg.notes && (
        <p className="mt-2 pt-2 border-t border-border-default dark:border-border-dark text-xs text-text-secondary dark:text-slate-300 line-clamp-3">
          {reg.notes}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs px-2 py-1 rounded bg-brand-teal text-white hover:bg-brand-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function RegulationChip({ reg, popoverKey, openKey, setOpenKey, buLabelByCode, alignRight, onEdit }) {
  const anchorRef = useRef(null);
  const isOpen = openKey === popoverKey;
  const popoverId = `cal-pop-${popoverKey.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && isOpen) {
          e.stopPropagation();
          setOpenKey(null);
          anchorRef.current?.focus();
        }
      }}
    >
      <button
        ref={anchorRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        aria-label={`${reg.title}, due ${formatDueDate(reg.due)}`}
        title={reg.title}
        onClick={() => setOpenKey(isOpen ? null : popoverKey)}
        className="w-full text-left truncate rounded px-2 py-1 text-xs font-medium bg-brand-teal text-white hover:bg-brand-teal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1 dark:focus-visible:ring-offset-surface-card-dark"
      >
        {displayName(reg)}
      </button>
      {isOpen && (
        <DetailPopover
          id={popoverId}
          reg={reg}
          buLabelByCode={buLabelByCode}
          alignRight={alignRight}
          anchorRef={anchorRef}
          onClose={() => setOpenKey(null)}
          onEdit={
            onEdit
              ? () => {
                  // Focus the chip first: the edit panel returns focus to
                  // whatever was focused when it opened, and the popover
                  // holding this Edit button is about to close.
                  anchorRef.current?.focus();
                  setOpenKey(null);
                  onEdit(reg);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

export default function MonthlyCalendar() {
  const { idToken, claims } = useAuth();
  const canEdit = claims?.role === 'admin' || claims?.role === 'sme';
  const today = new Date();

  const [regulations, setRegulations] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const [editing, setEditing] = useState(null);
  // Bumping this re-runs the load effect after an edit or removal.
  const [reloadKey, setReloadKey] = useState(0);

  const [searchParams, setSearchParams] = useSearchParams();
  const { year, monthIndex } = monthFromParam(searchParams.get('month'), today);

  // State is only set inside the promise callbacks (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!idToken) return undefined;
    let cancelled = false;
    Promise.all([fetchRegulations(idToken), fetchBusinessUnits(idToken)])
      .then(([regList, buList]) => {
        if (cancelled) return;
        setRegulations(regList);
        setBusinessUnits(buList);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof RegulationApiError ? err.message : 'Failed to load the calendar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, reloadKey]);

  const buLabelByCode = useMemo(
    () => Object.fromEntries(businessUnits.map((bu) => [bu.code, bu.label])),
    [businessUnits]
  );

  const onRoadmap = useMemo(
    () => regulations.filter((r) => r.addToRoadmapDashboard === true && !r.hidden),
    [regulations]
  );

  // Cheap at beta scale (hundreds of records), so not memoized.
  const byDay = groupByDueDateInMonth(onRoadmap, year, monthIndex);
  const yearCount = onRoadmap.filter((r) => (r.dueDate || '').startsWith(`${year}-`)).length;

  const weeks = buildMonthWeeks(year, monthIndex);
  const monthLabel = `${MONTH_NAMES[monthIndex]} ${year}`;
  const monthCount = Object.values(byDay).reduce((n, list) => n + list.length, 0);
  const daysWithItems = Object.keys(byDay).sort();
  const isThisMonth = monthIndex === today.getMonth() && year === today.getFullYear();
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const goToMonth = (m) => {
    setOpenKey(null);
    setExpandedDay(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (m === today.getMonth()) next.delete('month');
      else next.set('month', monthParam(year, m));
      return next;
    });
  };

  const navButton =
    // aria-disabled (not disabled) keeps the button focusable at the year's
    // edge, so keyboard focus isn't dropped to the page when Next reaches December.
    'text-xs px-2.5 py-1.5 rounded-md border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal dark:hover:border-teal-300 dark:hover:text-teal-300 aria-disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:hover:border-border-default aria-disabled:hover:text-text-secondary dark:aria-disabled:hover:border-border-dark dark:aria-disabled:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal';

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RoadmapViewSwitch />
        <p className="text-xs text-text-secondary dark:text-slate-400">
          Compliance dates in {year} for regulations on the Roadmap.
        </p>
      </div>

      <section
        aria-label="Month navigation"
        className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg px-5 py-3 flex flex-wrap items-center gap-3"
      >
        <button
          type="button"
          className={navButton}
          onClick={() => monthIndex > 0 && goToMonth(monthIndex - 1)}
          aria-disabled={monthIndex === 0}
          aria-label="Previous month"
        >
          &larr; Prev
        </button>
        <h2 className="text-h3 text-brand-navy dark:text-white min-w-[10rem] text-center">{monthLabel}</h2>
        <button
          type="button"
          className={navButton}
          onClick={() => monthIndex < 11 && goToMonth(monthIndex + 1)}
          aria-disabled={monthIndex === 11}
          aria-label="Next month"
        >
          Next &rarr;
        </button>
        {!isThisMonth && (
          <button
            type="button"
            onClick={() => goToMonth(today.getMonth())}
            className="text-xs px-2.5 py-1.5 text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-md"
          >
            This month
          </button>
        )}
        <div
          className="text-label text-text-tertiary dark:text-slate-300 ml-auto whitespace-nowrap"
          aria-live="polite"
          aria-atomic="true"
        >
          {loading ? '' : `${monthCount} due in ${MONTH_NAMES[monthIndex]} · ${yearCount} in ${year}`}
        </div>
      </section>

      <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg">
        {loading && <p className="p-5 text-body text-text-secondary dark:text-slate-400">Loading...</p>}
        {loadError && (
          <div className="p-5">
            <ErrorBanner message={loadError} />
          </div>
        )}

        {!loading && !loadError && (
          <>
            {/* Month grid: tablet and desktop */}
            <table className="hidden sm:table w-full table-fixed border-collapse">
              <caption className="sr-only">
                {monthLabel}: {monthCount} regulation{monthCount === 1 ? '' : 's'} due
              </caption>
              <thead>
                <tr>
                  {DAY_NAMES.map((d, i) => (
                    <th
                      key={d}
                      scope="col"
                      abbr={DAY_NAMES_FULL[i]}
                      className="py-2.5 text-body font-semibold text-text-primary dark:text-white border-b border-border-default dark:border-border-dark"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, w) => (
                  <tr key={w}>
                    {week.map((day, col) => {
                      if (day === null) {
                        return (
                          <td
                            key={`blank-${w}-${col}`}
                            className="h-28 border border-border-default dark:border-border-dark bg-surface-muted/40 dark:bg-surface-muted-dark/20"
                          />
                        );
                      }
                      const key = dateKey(year, monthIndex, day);
                      const items = byDay[key] || [];
                      const isToday = key === todayKey;
                      const expanded = expandedDay === key;
                      const shown = expanded ? items : items.slice(0, MAX_CHIPS_PER_DAY);
                      const hidden = items.length - shown.length;

                      return (
                        <td
                          key={key}
                          className="h-28 align-top p-1.5 border border-border-default dark:border-border-dark"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              aria-current={isToday ? 'date' : undefined}
                              className={[
                                'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold',
                                isToday ? 'bg-brand-teal text-white' : 'text-text-secondary dark:text-slate-300',
                              ].join(' ')}
                            >
                              {day}
                              {isToday && <span className="sr-only"> (today)</span>}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {shown.map((reg) => (
                              <RegulationChip
                                key={reg.id}
                                reg={reg}
                                popoverKey={`${key}:${reg.id}`}
                                openKey={openKey}
                                setOpenKey={setOpenKey}
                                buLabelByCode={buLabelByCode}
                                alignRight={col >= 5}
                                onEdit={canEdit ? setEditing : undefined}
                              />
                            ))}
                            {(hidden > 0 || expanded) && items.length > MAX_CHIPS_PER_DAY && (
                              <button
                                type="button"
                                aria-expanded={expanded}
                                onClick={() => setExpandedDay(expanded ? null : key)}
                                className="text-[11px] px-1 text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
                              >
                                {expanded ? 'Show fewer' : `+${hidden} more`}
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Agenda list: phones (NFR-9 - viewing screens responsive on mobile) */}
            <div className="sm:hidden">
              {daysWithItems.length === 0 ? null : (
                <ul role="list" aria-label={`Regulations due in ${monthLabel}`}>
                  {daysWithItems.map((key) => {
                    const first = byDay[key][0].due;
                    return (
                      <li key={key} className="flex gap-3 px-4 py-3 border-b border-border-default dark:border-border-dark last:border-b-0">
                        <div className="w-12 flex-none text-center">
                          <div className="text-label uppercase text-text-tertiary dark:text-slate-400">
                            {DAY_NAMES[first.getDay()]}
                          </div>
                          <div className="text-h3 text-text-primary dark:text-white">{first.getDate()}</div>
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          {byDay[key].map((reg) => (
                            <RegulationChip
                              key={reg.id}
                              reg={reg}
                              popoverKey={`m-${key}:${reg.id}`}
                              openKey={openKey}
                              setOpenKey={setOpenKey}
                              buLabelByCode={buLabelByCode}
                              alignRight={false}
                              onEdit={canEdit ? setEditing : undefined}
                            />
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {monthCount === 0 && (
              <p className="px-5 py-6 text-center text-body text-text-tertiary dark:text-slate-400 border-t border-border-default dark:border-border-dark sm:border-t-0">
                No Roadmap regulations are due in {monthLabel}.
              </p>
            )}

          </>
        )}
      </section>

      {editing && (
        <RegulationEditPanel
          regulation={editing}
          businessUnits={businessUnits}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
