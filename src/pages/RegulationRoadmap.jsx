import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchRegulations, RegulationApiError } from '../api/regulationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import ErrorBanner from '../components/ErrorBanner';
import RegulationFilterBar from '../components/RegulationFilterBar';
import RoadmapViewSwitch from '../components/RoadmapViewSwitch';
import {
  applyFilters,
  businessUnitOptions,
  countActiveFilters,
  distinctOptions,
  filtersFromSearchParams,
  writeFiltersToSearchParams,
} from '../utils/regulationFilters';
import {
  formatDueDate,
  formatMonthYear,
  partitionByWindow,
  positionInWindow,
} from '../utils/roadmapDates';

/**
 * RegulationRoadmap - Screen 5 (T011 FR-1.1, T012 FR-1.2).
 *
 * X-axis = years, Y-axis = each regulation's Abbreviated Name (full title on
 * hover, focus or tap). Defaults to a 4-year window starting this year; the
 * viewer can switch to 2/6/10 years and move the window earlier or later.
 *
 * Shows only regulations saved with "Add to Roadmap and Dashboard" = Yes.
 * Viewing is tenant-wide for every role (FR-1.4); the backend scopes the
 * list to the caller's own tenant.
 *
 * Deliberately NOT built here:
 *  - Status colours. Status does not exist on the record until the
 *    Dashboard Status field ships (T018, M2). Markers are brand teal until
 *    then; nothing is coloured red/amber/green without a real status.
 *  - Bars with a start and end. Srinivas's Add Regulation form has a single
 *    Due Date, so each regulation is a point on the timeline at that date.
 *  - Editing from the Roadmap (T014).
 *
 * The monthly calendar (T013, FR-1.3) is a separate screen at
 * /roadmap/calendar, reached through RoadmapViewSwitch.
 *
 * Filters (T012) use the shared RegulationFilterBar + utils/regulationFilters
 * (reused by the Dashboard, T019) and live in the URL query string.
 */

const WINDOW_OPTIONS = [2, 4, 6, 10];
const DEFAULT_WINDOW_YEARS = 4; // FR-1.1

function displayName(reg) {
  return (reg.abbreviatedTitle || '').trim() || reg.title;
}

function markerAlign(position) {
  if (position > 75) return 'right';
  if (position < 25) return 'left';
  return 'center';
}

const TOOLTIP_ALIGN = {
  left: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  right: 'right-0',
};

function RoadmapTooltip({ id, reg, buLabelByCode, align, below }) {
  const buLabels = (reg.businessUnitIds || []).map((code) => buLabelByCode[code] || code);
  const place = [reg.region, reg.country].filter(Boolean).join(', ');

  return (
    <div
      id={id}
      role="tooltip"
      className={[
        below ? 'absolute top-full mt-2' : 'absolute bottom-full mb-2',
        'z-20 w-72 max-w-[80vw] rounded-md border px-3 py-2 text-left shadow-lg',
        'bg-surface-card dark:bg-surface-card-dark border-border-strong dark:border-border-dark',
        TOOLTIP_ALIGN[align],
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
      </dl>
    </div>
  );
}

function RoadmapRow({ reg, rowIndex, years, todayPosition, isActive, onActivate, onDeactivate, onToggle, buLabelByCode }) {
  const name = displayName(reg);
  const hasAbbreviation = name !== reg.title;
  const align = markerAlign(reg.position);
  const tooltipId = `roadmap-tip-${reg.id}`;
  const dateLabelSide = reg.position > 85 ? 'right-full mr-1' : 'left-full ml-1';

  return (
    <li className="flex items-stretch border-t border-border-default dark:border-border-dark">
      <div className="w-36 sm:w-56 flex-none px-3 py-2.5 border-r border-border-default dark:border-border-dark">
        <p className="text-body font-semibold text-text-primary dark:text-white truncate" title={reg.title}>
          {name}
        </p>
        {hasAbbreviation && (
          <p className="text-xs text-text-secondary dark:text-slate-400 truncate" title={reg.title}>
            {reg.title}
          </p>
        )}
      </div>

      <div className="relative flex-1 min-h-[3.25rem]">
        {Array.from({ length: years }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-border-default dark:bg-border-dark"
            style={{ left: `${(i * 100) / years}%` }}
          />
        ))}

        {todayPosition !== null && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-px border-l border-dashed border-brand-teal/60 dark:border-teal-300/60"
            style={{ left: `${todayPosition}%` }}
          />
        )}

        <div
          className={`absolute top-1/2 -translate-y-1/2 ${isActive ? 'z-30' : ''}`}
          style={{ left: `${reg.position}%` }}
        >
          <div className="relative -translate-x-1/2">
            <button
              type="button"
              aria-label={`${reg.title}, due ${formatDueDate(reg.due)}`}
              aria-describedby={isActive ? tooltipId : undefined}
              aria-expanded={isActive}
              onMouseEnter={onActivate}
              onMouseLeave={onDeactivate}
              onFocus={onActivate}
              onBlur={onDeactivate}
              onClick={onToggle}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onDeactivate();
              }}
              className="relative flex items-center justify-center w-6 h-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-card-dark"
            >
              <span
                aria-hidden="true"
                className="w-3.5 h-3.5 rounded-full bg-brand-teal dark:bg-teal-400 ring-2 ring-surface-card dark:ring-surface-card-dark"
              />
              <span
                aria-hidden="true"
                className={`absolute top-1/2 -translate-y-1/2 ${dateLabelSide} whitespace-nowrap text-[11px] text-text-secondary dark:text-slate-400`}
              >
                {formatMonthYear(reg.due)}
              </span>
            </button>
            {isActive && (
              <RoadmapTooltip
                id={tooltipId}
                reg={reg}
                buLabelByCode={buLabelByCode}
                align={align}
                below={rowIndex === 0}
              />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function RegulationRoadmap() {
  const { idToken } = useAuth();
  const thisYear = new Date().getFullYear();

  const [regulations, setRegulations] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [years, setYears] = useState(DEFAULT_WINDOW_YEARS);
  const [startYear, setStartYear] = useState(thisYear);
  const [hoverId, setHoverId] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const setFilters = useCallback(
    (next, { replace = false } = {}) =>
      setSearchParams((prev) => writeFiltersToSearchParams(next, prev), { replace }),
    [setSearchParams]
  );

  // State is only set inside the promise callbacks (never synchronously in
  // the effect body), which is what react-hooks/set-state-in-effect requires.
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
        setLoadError(err instanceof RegulationApiError ? err.message : 'Failed to load the Roadmap.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  const buLabelByCode = useMemo(
    () => Object.fromEntries(businessUnits.map((bu) => [bu.code, bu.label])),
    [businessUnits]
  );

  const onRoadmap = useMemo(
    () => regulations.filter((r) => r.addToRoadmapDashboard === true && !r.hidden),
    [regulations]
  );

  // Options come from everything on the Roadmap (not the filtered subset),
  // so picking one Domain never hides the other Domain choices.
  const filterOptions = useMemo(
    () => ({
      domain: distinctOptions(onRoadmap, 'domain'),
      bu: businessUnitOptions(onRoadmap, businessUnits),
      country: distinctOptions(onRoadmap, 'country'),
      region: distinctOptions(onRoadmap, 'region'),
    }),
    [onRoadmap, businessUnits]
  );

  const filtered = useMemo(() => applyFilters(onRoadmap, filters), [onRoadmap, filters]);
  const filtersActive = countActiveFilters(filters) > 0;

  const { visible, earlier, later, undated } = useMemo(
    () => partitionByWindow(filtered, startYear, years),
    [filtered, startYear, years]
  );

  const todayPosition = positionInWindow(new Date(), startYear, years);
  const endYear = startYear + years - 1;
  const yearColumns = Array.from({ length: years }, (_, i) => startYear + i);
  const activeId = pinnedId ?? hoverId;

  const outsideParts = [];
  if (earlier > 0) outsideParts.push(`${earlier} due before ${startYear}`);
  if (later > 0) outsideParts.push(`${later} due after ${endYear}`);
  if (undated > 0) outsideParts.push(`${undated} without a valid due date`);

  return (
    <div className="space-y-4 max-w-6xl">
      <RoadmapViewSwitch />

      <section
        aria-label="Roadmap view controls"
        className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3"
      >
        <div className="flex items-center gap-3">
          <span id="view-window-label" className="text-label uppercase text-text-tertiary dark:text-slate-300">
            View window
          </span>
          <div className="flex items-center gap-1.5" role="group" aria-labelledby="view-window-label">
            {WINDOW_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={years === n}
                onClick={() => setYears(n)}
                className={[
                  'text-xs px-3 py-1.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal',
                  years === n
                    ? 'bg-brand-teal text-white border-brand-teal'
                    : 'bg-surface-card dark:bg-surface-card-dark border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal',
                ].join(' ')}
              >
                {n} yrs
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStartYear((y) => y - 1)}
            aria-label="Show one year earlier"
            className="text-xs px-2.5 py-1.5 rounded-md border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            &larr; Earlier
          </button>
          <span className="text-body font-medium text-text-primary dark:text-white px-2 whitespace-nowrap">
            {startYear}&ndash;{endYear}
          </span>
          <button
            type="button"
            onClick={() => setStartYear((y) => y + 1)}
            aria-label="Show one year later"
            className="text-xs px-2.5 py-1.5 rounded-md border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            Later &rarr;
          </button>
          {startYear !== thisYear && (
            <button
              type="button"
              onClick={() => setStartYear(thisYear)}
              className="text-xs px-2.5 py-1.5 text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-md"
            >
              Back to {thisYear}
            </button>
          )}
        </div>

      </section>

      {!loading && !loadError && onRoadmap.length > 0 && (
        <RegulationFilterBar
          filters={filters}
          onChange={setFilters}
          options={filterOptions}
          resultLabel={
            filtersActive
              ? `${filtered.length} of ${onRoadmap.length} match · ${visible.length} in ${startYear}–${endYear}`
              : `${visible.length} of ${onRoadmap.length} on Roadmap in ${startYear}–${endYear}`
          }
        />
      )}

      <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg">
        <h2 className="sr-only">Regulation timeline, {startYear} to {endYear}</h2>

        {loading && <p className="p-5 text-body text-text-secondary dark:text-slate-400">Loading...</p>}
        {loadError && (
          <div className="p-5">
            <ErrorBanner message={loadError} />
          </div>
        )}

        {!loading && !loadError && onRoadmap.length === 0 && (
          <p className="p-10 text-center text-body text-text-tertiary dark:text-slate-400">
            No regulations are on the Roadmap yet. A regulation appears here when it is saved with
            &ldquo;Add to Roadmap and Dashboard&rdquo; set to Yes.
          </p>
        )}

        {!loading && !loadError && onRoadmap.length > 0 && (
          <div className="overflow-x-auto lg:overflow-visible">
            <div className="min-w-[640px]">
              <div className="flex items-stretch" aria-hidden="true">
                <div className="w-36 sm:w-56 flex-none px-3 py-3 border-r border-border-default dark:border-border-dark text-label uppercase text-text-tertiary dark:text-slate-300">
                  Regulation
                </div>
                <div className="relative flex-1 flex">
                  {yearColumns.map((yr) => (
                    <div
                      key={yr}
                      className="flex-1 py-3 text-center text-body font-semibold text-text-primary dark:text-white border-l border-border-default dark:border-border-dark first:border-l-0"
                    >
                      {yr}
                    </div>
                  ))}
                </div>
              </div>

              {visible.length === 0 ? (
                <p className="px-5 py-8 text-center text-body text-text-tertiary dark:text-slate-400 border-t border-border-default dark:border-border-dark">
                  {filtersActive && filtered.length === 0
                    ? 'No Roadmap regulations match these filters.'
                    : `No ${filtersActive ? 'matching ' : ''}Roadmap regulations are due between ${startYear} and ${endYear}.`}
                </p>
              ) : (
                <ul role="list" aria-label={`Regulations due ${startYear} to ${endYear}, by due date`}>
                  {visible.map((reg, index) => (
                    <RoadmapRow
                      key={reg.id}
                      reg={reg}
                      rowIndex={index}
                      years={years}
                      todayPosition={todayPosition}
                      buLabelByCode={buLabelByCode}
                      isActive={activeId === reg.id}
                      onActivate={() => setHoverId(reg.id)}
                      onDeactivate={() => {
                        setHoverId((id) => (id === reg.id ? null : id));
                        setPinnedId((id) => (id === reg.id ? null : id));
                      }}
                      onToggle={() => setPinnedId((id) => (id === reg.id ? null : reg.id))}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {!loading && !loadError && onRoadmap.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 border-t border-border-default dark:border-border-dark text-xs text-text-secondary dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-brand-teal dark:bg-teal-400" />
              Due date
            </span>
            {todayPosition !== null && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-3 border-l border-dashed border-brand-teal dark:border-teal-300" />
                Today
              </span>
            )}
            <span>Hover, focus or tap a marker for the full regulation name.</span>
            {outsideParts.length > 0 && (
              <span className="sm:ml-auto">Not in this window: {outsideParts.join(' · ')}</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
