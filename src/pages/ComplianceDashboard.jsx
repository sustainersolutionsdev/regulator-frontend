import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchRegulations, RegulationApiError } from '../api/regulationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import ErrorBanner from '../components/ErrorBanner';
import StatusSwatch, { StatusLegend } from '../components/StatusSwatch';
import { formatDueDate, parseDueDate } from '../utils/roadmapDates';
import {
  displayName,
  formatTimestamp,
  nextSort,
  sortFromSearchParams,
  sortRegulations,
  writeSortToSearchParams,
} from '../utils/dashboardTable';

/**
 * ComplianceDashboard - Screen 7 (T017, FR-2.1).
 *
 * A table with one row per regulation and a column for every field on
 * Srinivas's Add Regulation form: Abbreviated Name and Title, Due Date,
 * Domain, Country, Region, Business Units, Notes and Documents, plus the
 * server-generated record ID, date added and last update (FR-0.8).
 * "Add to Roadmap and Dashboard" is not a column: it decides whether a
 * regulation is on this screen at all, same rule as the Roadmap.
 *
 * Viewing is tenant-wide for every role; the backend scopes GET /regulations
 * to the caller's own tenant (NFR-1).
 *
 * Status (T018, FR-2.1 / FR-2.5): a colour swatch with no visible text
 * (Srinivas's preference) plus a non-colour glyph and a screen-reader label
 * (DL-3). Status and its optional Explanation are set by Admin/SME - never
 * inferred or generated. A regulation nobody has rated shows "Not set".
 *
 * Deliberately NOT built here (later M2 tasks, same screen):
 *  - Filters (T019, FR-2.2) - will reuse RegulationFilterBar unchanged.
 *  - Row editing, document upload and the Business Unit-scoped User edit
 *    rule (T020, FR-2.3).
 *  - PDF / Excel download (T021, FR-2.4).
 *
 * Sort order lives in the URL (?sort=&dir=), so a sorted view survives a
 * reload and can be shared.
 */

const SORTABLE = {
  name: 'Regulation',
  due: 'Due date',
  status: 'Status',
  domain: 'Domain',
  updated: 'Last updated',
};

const CELL = 'px-3 py-3 align-top text-body text-text-primary dark:text-slate-200';
const STICKY =
  'sticky left-0 z-10 bg-surface-card dark:bg-surface-card-dark border-r border-border-default dark:border-border-dark';

function Blank({ label = 'Not specified' }) {
  return (
    <>
      <span aria-hidden="true" className="text-text-tertiary dark:text-slate-400">
        &mdash;
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

function SortHeader({ sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const arrow = active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕';

  return (
    <th scope="col" aria-sort={ariaSort} className={`px-3 py-2.5 text-left whitespace-nowrap ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 text-label uppercase text-text-secondary dark:text-slate-300 hover:text-brand-teal dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
      >
        {SORTABLE[sortKey]}
        <span aria-hidden="true" className={active ? 'text-brand-teal dark:text-teal-300' : 'opacity-60'}>
          {arrow}
        </span>
      </button>
    </th>
  );
}

function PlainHeader({ children, className = '' }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-left whitespace-nowrap text-label uppercase text-text-secondary dark:text-slate-300 ${className}`}
    >
      {children}
    </th>
  );
}

function DashboardRow({ reg, buLabelByCode }) {
  const name = displayName(reg);
  const hasAbbreviation = name !== reg.title;
  const due = parseDueDate(reg.dueDate);
  const buCodes = reg.businessUnitIds || [];
  const docs = reg.documents || [];
  const docNames = docs.map((d) => d.fileName).filter(Boolean);
  const notes = (reg.notes || '').trim();
  const statusNote = (reg.statusNote || '').trim();
  const added = formatTimestamp(reg.createdAt);
  const updated = formatTimestamp(reg.lastUpdated);

  return (
    <tr className="border-t border-border-default dark:border-border-dark">
      <th scope="row" className={`${CELL} ${STICKY} text-left font-normal min-w-[12rem] max-w-[18rem]`}>
        <span className="block font-semibold text-text-primary dark:text-white" title={reg.title}>
          {name}
        </span>
        {hasAbbreviation && (
          <span className="block text-xs text-text-secondary dark:text-slate-400 mt-0.5">{reg.title}</span>
        )}
        <span className="block font-mono text-[11px] text-text-tertiary dark:text-slate-400 mt-1">
          <span className="sr-only">Record ID </span>
          {reg.id}
        </span>
      </th>

      <td className={`${CELL} whitespace-nowrap`}>
        {due ? formatDueDate(due) : <Blank label="No valid due date" />}
      </td>

      <td className={CELL}>{(reg.domain || '').trim() || <Blank />}</td>
      <td className={CELL}>{(reg.country || '').trim() || <Blank />}</td>
      <td className={CELL}>{(reg.region || '').trim() || <Blank />}</td>

      <td className={CELL}>
        {buCodes.length === 0 ? (
          <Blank />
        ) : (
          <ul className="space-y-0.5">
            {buCodes.map((code) => (
              <li key={code} className="whitespace-nowrap">
                {buLabelByCode[code] || code}
                {buLabelByCode[code] && (
                  <span className="text-xs text-text-tertiary dark:text-slate-400"> ({code})</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </td>

      <td className={`${CELL} text-center`}>
        <StatusSwatch status={reg.status} />
      </td>

      <td className={`${CELL} min-w-[12rem] max-w-[18rem]`}>
        {statusNote ? (
          <span className="line-clamp-3 whitespace-pre-line" title={statusNote}>
            {statusNote}
          </span>
        ) : (
          <Blank label="No explanation" />
        )}
      </td>

      <td className={`${CELL} min-w-[14rem] max-w-[22rem]`}>
        {notes ? (
          <span className="line-clamp-3 whitespace-pre-line" title={notes}>
            {notes}
          </span>
        ) : (
          <Blank label="No notes" />
        )}
      </td>

      <td className={`${CELL} text-center`}>
        <span title={docNames.join('\n') || undefined}>{docs.length}</span>
        {docNames.length > 0 && <span className="sr-only">: {docNames.join(', ')}</span>}
      </td>

      <td className={`${CELL} whitespace-nowrap`}>{added || <Blank label="Unknown" />}</td>
      <td className={`${CELL} whitespace-nowrap`}>{updated || <Blank label="Unknown" />}</td>
    </tr>
  );
}

export default function ComplianceDashboard() {
  const { idToken } = useAuth();

  const [regulations, setRegulations] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const sort = useMemo(() => sortFromSearchParams(searchParams), [searchParams]);
  const onSort = useCallback(
    (key) =>
      setSearchParams((prev) => writeSortToSearchParams(nextSort(sortFromSearchParams(prev), key), prev), {
        replace: true,
      }),
    [setSearchParams]
  );

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
        setLoadError(err instanceof RegulationApiError ? err.message : 'Failed to load the Dashboard.');
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

  const onDashboard = useMemo(
    () => regulations.filter((r) => r.addToRoadmapDashboard === true && !r.hidden),
    [regulations]
  );

  const rows = useMemo(() => sortRegulations(onDashboard, sort), [onDashboard, sort]);
  const sortDescription = `${SORTABLE[sort.key]}, ${sort.dir === 'asc' ? 'ascending' : 'descending'}`;

  return (
    <div className="space-y-4">
      <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 border-b border-border-default dark:border-border-dark">
          <h2 id="dashboard-table-heading" className="text-body font-semibold text-text-primary dark:text-white">
            Regulations
          </h2>
          {!loading && !loadError && (
            <p className="text-xs text-text-secondary dark:text-slate-400">
              {onDashboard.length} on the Dashboard &middot; sorted by {sortDescription.toLowerCase()}
            </p>
          )}
        </div>

        {loading && <p className="p-5 text-body text-text-secondary dark:text-slate-400">Loading...</p>}
        {loadError && (
          <div className="p-5">
            <ErrorBanner message={loadError} />
          </div>
        )}

        {!loading && !loadError && onDashboard.length === 0 && (
          <p className="p-10 text-center text-body text-text-tertiary dark:text-slate-400">
            No regulations are on the Dashboard yet. A regulation appears here when it is saved with
            &ldquo;Add to Roadmap and Dashboard&rdquo; set to Yes.
          </p>
        )}

        {!loading && !loadError && onDashboard.length > 0 && (
          <div
            className="overflow-x-auto"
            role="region"
            aria-labelledby="dashboard-table-heading"
            tabIndex={0}
          >
            <table className="w-full min-w-[1300px] border-collapse">
              <caption className="sr-only">
                Compliance Dashboard: {onDashboard.length} regulations, sorted by {sortDescription}. Column
                headers with buttons can be used to change the sort.
              </caption>
              <thead className="bg-surface-muted dark:bg-surface-muted-dark">
                <tr>
                  <SortHeader
                    sortKey="name"
                    sort={sort}
                    onSort={onSort}
                    className="sticky left-0 z-20 bg-surface-muted dark:bg-surface-muted-dark border-r border-border-default dark:border-border-dark"
                  />
                  <SortHeader sortKey="due" sort={sort} onSort={onSort} />
                  <SortHeader sortKey="domain" sort={sort} onSort={onSort} />
                  <PlainHeader>Country</PlainHeader>
                  <PlainHeader>Region</PlainHeader>
                  <PlainHeader>Business units</PlainHeader>
                  <SortHeader sortKey="status" sort={sort} onSort={onSort} />
                  <PlainHeader>Explanation</PlainHeader>
                  <PlainHeader>Notes</PlainHeader>
                  <PlainHeader className="text-center">Docs</PlainHeader>
                  <PlainHeader>Added</PlainHeader>
                  <SortHeader sortKey="updated" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((reg) => (
                  <DashboardRow key={reg.id} reg={reg} buLabelByCode={buLabelByCode} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !loadError && onDashboard.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 border-t border-border-default dark:border-border-dark text-xs text-text-secondary dark:text-slate-400">
            <StatusLegend />
            <span className="sm:ml-auto">Status is set by Admin or SME, never generated by AI.</span>
          </div>
        )}
      </section>
    </div>
  );
}
