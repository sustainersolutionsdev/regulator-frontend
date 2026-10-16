import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchRegulations, RegulationApiError } from '../api/regulationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { fetchDashboardView, saveDashboardView } from '../api/preferencesApi';
import ErrorBanner from '../components/ErrorBanner';
import RegulationFilterBar from '../components/RegulationFilterBar';
import StatusSwatch, { StatusLegend } from '../components/StatusSwatch';
import StatusUpdatePanel from '../components/StatusUpdatePanel';
import { statusLabel } from '../constants/status';
import { formatDueDate, parseDueDate } from '../utils/roadmapDates';
import {
  EMPTY_FILTERS,
  applyFilters,
  businessUnitOptions,
  countActiveFilters,
  distinctOptions,
  filtersFromSearchParams,
  statusOptions,
  writeFiltersToSearchParams,
} from '../utils/regulationFilters';
import {
  displayName,
  formatTimestamp,
  nextSort,
  sortFromSearchParams,
  sortRegulations,
  unitEntry,
  unitRows,
  viewFromSearchParams,
  visibleDocuments,
  writeSortToSearchParams,
  writeViewToSearchParams,
} from '../utils/dashboardTable';

/**
 * ComplianceDashboard - Screen 7 (T017 table, T018 status, T019 filters,
 * T020 per-Business-Unit status and editing).
 *
 * One column for every field on Srinivas's Add Regulation form, plus the
 * record ID, date added and last update (FR-0.8). Shows only regulations
 * saved with "Add to Roadmap and Dashboard" = Yes. Viewing is tenant-wide
 * for every role; the backend scopes everything to the caller's tenant.
 *
 * Status is per Business Unit (DL-8, Srinivas Oct 16 2026). Two views,
 * switchable and kept in the URL (?view=bu):
 *   - By regulation: one row per regulation; the Status column shows each
 *     of its units' colours side by side. No combined colour exists.
 *   - By Business Unit: one row per regulation per unit, with that unit's
 *     own status and explanation.
 * Status is a colour swatch with a glyph and a screen-reader label, never
 * visible text (FR-2.5, DL-3). It is set by people, never by AI.
 *
 * Filters and sort (T019) share the URL. In By regulation, the Status filter
 * matches a regulation if any of its units (only the filtered units, when a
 * Business Unit filter is set) has that status.
 *
 * Opens as the person last left it (DL-8): with no query string, the saved
 * view is fetched and applied; every later change is saved to the server
 * (debounced), so it follows them to any computer.
 *
 * Update / View opens StatusUpdatePanel: Admin/SME edit every unit; Users
 * edit their own units' status, explanation and documents only, and see
 * other units read-only with an on-screen message (FR-2.3).
 *
 * Not built here: PDF / Excel download (T021, FR-2.4).
 */

const SORTABLE = {
  name: 'Regulation',
  unit: 'Business unit',
  due: 'Due date',
  status: 'Status',
  domain: 'Domain',
  updated: 'Last updated',
};

const SAVE_DELAY_MS = 800;

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
        <span className="sr-only">Sort by </span>
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

function ViewSwitch({ view, onChange }) {
  const options = [
    { value: 'regulation', label: 'By regulation' },
    { value: 'bu', label: 'By Business Unit' },
  ];
  return (
    <div
      role="group"
      aria-label="Dashboard view"
      className="inline-flex items-center gap-1 p-1 rounded-lg border border-border-default dark:border-border-dark bg-surface-card dark:bg-surface-card-dark"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={view === opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal',
            view === opt.value
              ? 'bg-brand-teal text-white'
              : 'text-text-secondary dark:text-slate-300 hover:text-brand-teal dark:hover:text-teal-300',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RegulationCell({ reg, action }) {
  const name = displayName(reg);
  return (
    <th scope="row" className={`${CELL} ${STICKY} text-left font-normal min-w-[12rem] max-w-[18rem]`}>
      <span className="block font-semibold text-text-primary dark:text-white" title={reg.title}>
        {name}
      </span>
      {name !== reg.title && (
        <span className="block text-xs text-text-secondary dark:text-slate-400 mt-0.5">{reg.title}</span>
      )}
      <span className="block font-mono text-[11px] text-text-tertiary dark:text-slate-400 mt-1">
        <span className="sr-only">Record ID </span>
        {reg.id}
      </span>
      {/* In the pinned column so it stays reachable when the table scrolls sideways. */}
      <span className="block mt-2">{action}</span>
    </th>
  );
}

function TextCell({ value, label = 'Not specified', wide = false }) {
  const text = (value || '').trim();
  return (
    <td className={`${CELL} ${wide ? 'min-w-[14rem] max-w-[22rem]' : ''}`}>
      {text ? (
        <span className={wide ? 'line-clamp-3 whitespace-pre-line' : ''} title={wide ? text : undefined}>
          {text}
        </span>
      ) : (
        <Blank label={label} />
      )}
    </td>
  );
}

function DocsCell({ docs }) {
  const names = docs.map((d) => d.fileName).filter(Boolean);
  return (
    <td className={`${CELL} text-center`}>
      <span title={names.join('\n') || undefined}>{docs.length}</span>
      {names.length > 0 && <span className="sr-only">: {names.join(', ')}</span>}
    </td>
  );
}

function UpdateButton({ label, canEdit, onOpen }) {
  return (
    <button
        type="button"
        onClick={onOpen}
        aria-label={`${canEdit ? 'Update' : 'View'} status: ${label}`}
        className="text-xs px-2 py-1 rounded border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal dark:hover:border-teal-300 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        {canEdit ? 'Update' : 'View'}
    </button>
  );
}

/** By regulation: each unit's colour side by side, labelled by unit code. */
function UnitStatusList({ reg, buLabelByCode }) {
  const units = reg.businessUnitIds || [];
  if (!units.length) return <Blank />;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {units.map((bu) => {
        const entry = unitEntry(reg, bu);
        const name = buLabelByCode[bu] || bu;
        const note = (entry.note || '').trim();
        return (
          <li
            key={bu}
            className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-text-secondary dark:text-slate-300"
            title={`${name}: ${statusLabel(entry.status)}${note ? ` — ${note}` : ''}`}
          >
            <StatusSwatch status={entry.status} size="sm" decorative />
            <span aria-hidden="true">{bu}</span>
            <span className="sr-only">
              {name}: {statusLabel(entry.status)}
              {note ? `. ${note}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ComplianceDashboard() {
  const { idToken, claims } = useAuth();
  const isAdminOrSme = claims?.role === 'admin' || claims?.role === 'sme';
  const myUnits = claims?.businessUnitIds || [];

  const [regulations, setRegulations] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(null); // { id, focusBu }

  const [searchParams, setSearchParams] = useSearchParams();
  const view = viewFromSearchParams(searchParams);
  const sort = useMemo(() => sortFromSearchParams(searchParams), [searchParams]);
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  // Every writer keeps the others' params, so view, filters and sort coexist.
  const setFilters = useCallback(
    (next, { replace = false } = {}) =>
      setSearchParams((prev) => writeFiltersToSearchParams(next, prev), { replace }),
    [setSearchParams]
  );
  const onSort = useCallback(
    (key) =>
      setSearchParams((prev) => writeSortToSearchParams(nextSort(sortFromSearchParams(prev), key), prev), {
        replace: true,
      }),
    [setSearchParams]
  );
  const setView = useCallback(
    (next) =>
      setSearchParams((prev) => {
        let params = writeViewToSearchParams(next, prev);
        // The Business unit sort only exists in the By Business Unit view.
        if (next !== 'bu' && sortFromSearchParams(params).key === 'unit') params = writeSortToSearchParams({ key: 'due', dir: 'asc' }, params);
        return params;
      }),
    [setSearchParams]
  );

  // --- Saved view (DL-8): restore once when opened with no query string. ---
  const [restored, setRestored] = useState(() => window.location.search.length > 1);
  const lastSaved = useRef(null);

  useEffect(() => {
    if (!idToken || restored) return undefined;
    let cancelled = false;
    fetchDashboardView(idToken)
      .then((saved) => {
        if (cancelled) return;
        lastSaved.current = saved;
        if (saved) setSearchParams(new URLSearchParams(saved), { replace: true });
      })
      .catch(() => {
        // A missing saved view is not an error worth showing: open the default.
      })
      .finally(() => {
        if (!cancelled) setRestored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [idToken, restored, setSearchParams]);

  useEffect(() => {
    if (!idToken || !restored) return undefined;
    const current = searchParams.toString();
    if (current === lastSaved.current) return undefined;
    const timer = setTimeout(() => {
      saveDashboardView(idToken, current)
        .then(() => {
          lastSaved.current = current;
        })
        .catch(() => {
          // Saving the view is a convenience; never interrupt the person for it.
        });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [idToken, restored, searchParams]);

  // --- Data ---------------------------------------------------------------
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
  }, [idToken, reloadKey]);

  const buLabelByCode = useMemo(
    () => Object.fromEntries(businessUnits.map((bu) => [bu.code, bu.label])),
    [businessUnits]
  );

  const onDashboard = useMemo(
    () => regulations.filter((r) => r.addToRoadmapDashboard === true && !r.hidden),
    [regulations]
  );
  const allRows = useMemo(() => (view === 'bu' ? unitRows(onDashboard) : onDashboard), [view, onDashboard]);

  const filterOptions = useMemo(
    () => ({
      status: statusOptions(allRows),
      domain: distinctOptions(onDashboard, 'domain'),
      bu: businessUnitOptions(allRows, businessUnits),
      country: distinctOptions(onDashboard, 'country'),
      region: distinctOptions(onDashboard, 'region'),
    }),
    [allRows, onDashboard, businessUnits]
  );

  const filtered = useMemo(() => applyFilters(allRows, filters), [allRows, filters]);
  const filtersActive = countActiveFilters(filters) > 0;
  const rows = useMemo(() => sortRegulations(filtered, sort), [filtered, sort]);

  const noun = view === 'bu' ? 'Business Unit rows' : 'regulations';
  const countLabel = filtersActive ? `${filtered.length} of ${allRows.length} ${noun} match` : `${allRows.length} ${noun}`;
  const sortDescription = `${SORTABLE[sort.key]}, ${sort.dir === 'asc' ? 'ascending' : 'descending'}`;

  const canEditAny = (reg) => isAdminOrSme || (reg.businessUnitIds || []).some((bu) => myUnits.includes(bu));
  const editingReg = editing ? onDashboard.find((r) => r.id === editing.id) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewSwitch view={view} onChange={setView} />
        <p className="text-xs text-text-secondary dark:text-slate-400">
          Status is set for each Business Unit by its own people.
        </p>
      </div>

      {!loading && !loadError && onDashboard.length > 0 && (
        <RegulationFilterBar
          filters={filters}
          onChange={setFilters}
          options={filterOptions}
          resultLabel={countLabel}
        />
      )}

      <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 border-b border-border-default dark:border-border-dark">
          <h2 id="dashboard-table-heading" className="text-body font-semibold text-text-primary dark:text-white">
            {view === 'bu' ? 'Regulations by Business Unit' : 'Regulations'}
          </h2>
          {!loading && !loadError && (
            <p className="text-xs text-text-secondary dark:text-slate-400">
              {countLabel} &middot; sorted by {sortDescription.toLowerCase()}
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

        {!loading && !loadError && onDashboard.length > 0 && filtered.length === 0 && (
          <div className="p-10 text-center space-y-2">
            <p className="text-body text-text-tertiary dark:text-slate-400">No regulations match these filters.</p>
            <button
              type="button"
              onClick={() => setFilters({ ...EMPTY_FILTERS })}
              className="text-body text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
            >
              Clear all filters
            </button>
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="overflow-x-auto" role="region" aria-labelledby="dashboard-table-heading" tabIndex={0}>
            <table className="w-full min-w-[1200px] border-collapse">
              <caption className="sr-only">
                Compliance Dashboard, {view === 'bu' ? 'one row per Business Unit of each regulation' : 'one row per regulation'}:{' '}
                {countLabel}, sorted by {sortDescription}. Column headers with buttons change the sort.
              </caption>
              <thead className="bg-surface-muted dark:bg-surface-muted-dark">
                {view === 'bu' ? (
                  <tr>
                    <SortHeader sortKey="name" sort={sort} onSort={onSort} className={`sticky left-0 z-20 bg-surface-muted dark:bg-surface-muted-dark border-r border-border-default dark:border-border-dark`} />
                    <SortHeader sortKey="unit" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="status" sort={sort} onSort={onSort} />
                    <PlainHeader>Explanation</PlainHeader>
                    <SortHeader sortKey="due" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="domain" sort={sort} onSort={onSort} />
                    <PlainHeader>Country</PlainHeader>
                    <PlainHeader>Region</PlainHeader>
                    <PlainHeader>Notes</PlainHeader>
                    <PlainHeader className="text-center">Docs</PlainHeader>
                    <SortHeader sortKey="updated" sort={sort} onSort={onSort} />
                  </tr>
                ) : (
                  <tr>
                    <SortHeader sortKey="name" sort={sort} onSort={onSort} className={`sticky left-0 z-20 bg-surface-muted dark:bg-surface-muted-dark border-r border-border-default dark:border-border-dark`} />
                    <SortHeader sortKey="due" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="domain" sort={sort} onSort={onSort} />
                    <PlainHeader>Country</PlainHeader>
                    <PlainHeader>Region</PlainHeader>
                    <SortHeader sortKey="status" sort={sort} onSort={onSort} />
                    <PlainHeader>Notes</PlainHeader>
                    <PlainHeader className="text-center">Docs</PlainHeader>
                    <PlainHeader>Added</PlainHeader>
                    <SortHeader sortKey="updated" sort={sort} onSort={onSort} />
                  </tr>
                )}
              </thead>
              <tbody>
                {rows.map((reg) => {
                  const due = parseDueDate(reg.dueDate);
                  const dueCell = (
                    <td className={`${CELL} whitespace-nowrap`}>
                      {due ? formatDueDate(due) : <Blank label="No valid due date" />}
                    </td>
                  );

                  if (view === 'bu') {
                    const entry = unitEntry(reg, reg.rowBu);
                    const unitName = buLabelByCode[reg.rowBu] || reg.rowBu;
                    const canEdit = isAdminOrSme || myUnits.includes(reg.rowBu);
                    const updated = formatTimestamp(entry.updatedAt) || formatTimestamp(reg.lastUpdated);
                    return (
                      <tr key={reg.rowKey} className="border-t border-border-default dark:border-border-dark">
                        <RegulationCell
                          reg={reg}
                          action={
                            <UpdateButton
                              label={`${reg.title}, ${unitName}`}
                              canEdit={canEdit}
                              onOpen={() => setEditing({ id: reg.id, focusBu: reg.rowBu })}
                            />
                          }
                        />
                        <td className={`${CELL} whitespace-nowrap`}>
                          {unitName}
                          {buLabelByCode[reg.rowBu] && (
                            <span className="text-xs text-text-tertiary dark:text-slate-400"> ({reg.rowBu})</span>
                          )}
                        </td>
                        <td className={`${CELL} text-center`}>
                          <StatusSwatch status={entry.status} />
                        </td>
                        <TextCell value={entry.note} label="No explanation" wide />
                        {dueCell}
                        <TextCell value={reg.domain} />
                        <TextCell value={reg.country} />
                        <TextCell value={reg.region} />
                        <TextCell value={reg.notes} label="No notes" wide />
                        <DocsCell docs={visibleDocuments(reg, reg.rowBu)} />
                        <td className={`${CELL} whitespace-nowrap`}>{updated || <Blank label="Unknown" />}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={reg.id} className="border-t border-border-default dark:border-border-dark">
                      <RegulationCell
                        reg={reg}
                        action={
                          <UpdateButton
                            label={reg.title}
                            canEdit={canEditAny(reg)}
                            onOpen={() => setEditing({ id: reg.id, focusBu: null })}
                          />
                        }
                      />
                      {dueCell}
                      <TextCell value={reg.domain} />
                      <TextCell value={reg.country} />
                      <TextCell value={reg.region} />
                      <td className={`${CELL} min-w-[10rem]`}>
                        <UnitStatusList reg={reg} buLabelByCode={buLabelByCode} />
                      </td>
                      <TextCell value={reg.notes} label="No notes" wide />
                      <DocsCell docs={visibleDocuments(reg)} />
                      <td className={`${CELL} whitespace-nowrap`}>{formatTimestamp(reg.createdAt) || <Blank label="Unknown" />}</td>
                      <td className={`${CELL} whitespace-nowrap`}>{formatTimestamp(reg.lastUpdated) || <Blank label="Unknown" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !loadError && onDashboard.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 border-t border-border-default dark:border-border-dark text-xs text-text-secondary dark:text-slate-400">
            <StatusLegend />
            <span className="sm:ml-auto">Status is set by people, never generated by AI.</span>
          </div>
        )}
      </section>

      {editingReg && (
        <StatusUpdatePanel
          regulation={editingReg}
          businessUnits={businessUnits}
          focusBu={editing.focusBu}
          onClose={() => setEditing(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
