import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchRegulations, RegulationApiError } from '../api/regulationsApi';
import { fetchBusinessUnits } from '../api/businessUnitsApi';
import { fetchUsers } from '../api/usersApi';
import { fetchDashboardView, saveDashboardView } from '../api/preferencesApi';
import DownloadMenu from '../components/DownloadMenu';
import ErrorBanner from '../components/ErrorBanner';
import CountryFlag from '../components/CountryFlag';
import RegulationFilterBar from '../components/RegulationFilterBar';
import StatusSwatch, { StatusLegend } from '../components/StatusSwatch';
import RegulationPopover from '../components/RegulationPopover';
import UnitStatusDialog from '../components/UnitStatusDialog';
import UnitStatusSummary from '../components/UnitStatusSummary';
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
  peopleById,
  sortFromSearchParams,
  sortRegulations,
  unitEntry,
  unitRows,
  viewFromSearchParams,
  visibleDocuments,
  writeSortToSearchParams,
  writeViewToSearchParams,
} from '../utils/dashboardTable';
import { buildExportModel, exportFileName } from '../utils/dashboardExport';
import { buildDashboardExcel } from '../utils/exportExcel';
import { buildDashboardPdf } from '../utils/exportPdf';
import { saveBlob } from '../utils/saveBlob';

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
 * T064/T065 (Srinivas, Oct 28; mockup approved Oct 29) replace the Update /
 * View panel:
 *  - Hovering or clicking a regulation's name opens the same pop-up as the
 *    Roadmap, plus every unit's status, latest note, who changed it last
 *    (with email) and its documents (UnitStatusSummary).
 *  - In the Status column, the units the person may update (Admin/SME: all;
 *    User: their own) are buttons that open the unit's pop-up
 *    (UnitStatusDialog): status, note and document saved together, with the
 *    unit's activity history. Other units are shown, not clickable (FR-2.3).
 *
 * Download (T021, FR-2.4): every role can download what is on screen -
 * same view, filters and sort - as a PDF or an Excel file. Built in the
 * browser from the rows already loaded (utils/dashboardExport.js); nothing
 * extra is fetched.
 *
 * Link from an alert email (T025): "View in Regulator" opens
 * /dashboard?reg=<id>. The id is read once when the page opens, that
 * regulation's panel opens as soon as the data arrives, and `reg` is removed
 * from the URL straight away, so it never becomes part of the saved view. If
 * the regulation is no longer on the Dashboard, a message says so.
 */

const SORTABLE = {
  name: 'Regulation',
  unit: 'Business unit',
  due: 'Due date',
  status: 'Status',
  explanation: 'Explanation',
  domain: 'Domain',
  country: 'Country',
  region: 'Region',
  notes: 'Notes',
  docs: 'Docs',
  added: 'Added',
  updated: 'Last updated',
};

const SAVE_DELAY_MS = 800;

// Oct 26 feedback (T062): compact rows - one line per cell, full text on hover
// (title) and in the Update / View panel.
const CELL = 'px-3 py-2 align-top text-body text-text-primary dark:text-slate-200';
const STICKY =
  'sticky left-0 z-10 bg-surface-card dark:bg-surface-card-dark border-r border-border-default dark:border-border-dark';

/** The query string without the one-off ?reg= link (T025). */
function withoutReg(search) {
  const params = new URLSearchParams(search);
  params.delete('reg');
  return params.toString();
}

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

/**
 * T064: the regulation's name opens its pop-up - a preview on hover, pinned on
 * click or Enter, as on the Roadmap. T066: no record ID.
 */
function RegulationCell({ reg, isOpen, onHover, onLeave, onToggle, onClose }) {
  const name = displayName(reg);
  return (
    <th scope="row" className={`${CELL} ${STICKY} text-left font-normal min-w-[12rem] max-w-[18rem]`}>
      <button
        type="button"
        data-reg-trigger={reg.id}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${reg.title}: details and every unit's status`}
        onMouseEnter={(e) => onHover(reg.id, e.currentTarget)}
        onMouseLeave={onLeave}
        onClick={(e) => onToggle(reg.id, e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isOpen) onClose({ restoreFocus: false });
        }}
        className="block max-w-full text-left font-semibold text-text-primary dark:text-white truncate rounded underline decoration-dotted decoration-slate-400 underline-offset-4 hover:text-brand-teal dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
      >
        {name}
      </button>
    </th>
  );
}

function CountryCell({ country }) {
  const text = (country || '').trim();
  return (
    <td className={CELL}>
      {text ? (
        <span className="inline-flex items-center gap-1.5">
          <CountryFlag country={text} />
          {text}
        </span>
      ) : (
        <Blank label="Not specified" />
      )}
    </td>
  );
}

function TextCell({ value, label = 'Not specified', wide = false }) {
  const text = (value || '').trim();
  return (
    <td className={`${CELL} ${wide ? 'min-w-[14rem] max-w-[22rem]' : 'whitespace-nowrap'}`}>
      {text ? (
        <span className={wide ? 'line-clamp-1' : ''} title={wide ? text : undefined}>
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

/**
 * T065: one unit's status in the Status column. A unit the person may update
 * is a button (underlined, with a pencil) that opens its pop-up; any other
 * unit is shown, not clickable.
 */
function UnitChip({ reg, bu, buLabelByCode, canEdit, onOpen }) {
  const entry = unitEntry(reg, bu);
  const name = buLabelByCode[bu] || bu;
  const base = 'inline-flex items-center gap-1 whitespace-nowrap text-xs rounded-full px-2 py-0.5';
  if (canEdit) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${name}: ${statusLabel(entry.status)}. Update ${name}`}
        className={`${base} border border-brand-teal dark:border-teal-300 text-brand-teal dark:text-teal-300 underline underline-offset-2 hover:bg-brand-teal hover:text-white dark:hover:bg-teal-300 dark:hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal`}
      >
        <StatusSwatch status={entry.status} size="sm" decorative />
        {name}
        <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    );
  }
  return (
    <span className={`${base} border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300`}>
      <StatusSwatch status={entry.status} size="sm" decorative />
      <span aria-hidden="true">{name}</span>
      <span className="sr-only">
        {name}: {statusLabel(entry.status)}
      </span>
    </span>
  );
}

/** By regulation: every unit's status side by side. */
function UnitStatusList({ reg, buLabelByCode, canEdit, onOpenUnit }) {
  const units = reg.businessUnitIds || [];
  if (!units.length) return <Blank />;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {units.map((bu) => (
        <li key={bu}>
          <UnitChip reg={reg} bu={bu} buLabelByCode={buLabelByCode} canEdit={canEdit(bu)} onOpen={() => onOpenUnit(reg.id, bu)} />
        </li>
      ))}
    </ul>
  );
}

export default function ComplianceDashboard() {
  const { idToken, claims, user } = useAuth();
  const isAdminOrSme = claims?.role === 'admin' || claims?.role === 'sme';
  const myUnits = useMemo(() => claims?.businessUnitIds || [], [claims]);

  const [regulations, setRegulations] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [people, setPeople] = useState({}); // uid -> { name, email } (T064/T065)
  // T064: the open regulation pop-up { id, anchor, pinned }; T065: the open unit pop-up { id, bu }.
  const [open, setOpen] = useState(null);
  const closeTimer = useRef(null);
  const [unitDialog, setUnitDialog] = useState(null);
  // T025: the regulation an alert email linked to (?reg=), read once on open.
  const [linkedRegId, setLinkedRegId] = useState(() => new URLSearchParams(window.location.search).get('reg'));

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

  // T025: take the one-off ?reg= out of the URL as soon as the page opens.
  useEffect(() => {
    if (!searchParams.has('reg')) return;
    setSearchParams((prev) => new URLSearchParams(withoutReg(prev.toString())), { replace: true });
  }, [searchParams, setSearchParams]);

  // --- Saved view (DL-8): restore once when opened with no query string. ---
  // A link with only ?reg= counts as "no query string" (T025).
  const [restored, setRestored] = useState(() => withoutReg(window.location.search).length > 0);
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
    const current = withoutReg(searchParams.toString());
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
    Promise.all([
      fetchRegulations(idToken),
      fetchBusinessUnits(idToken),
      // Names for "who changed it"; the Dashboard still works without them.
      fetchUsers(idToken).catch(() => []),
    ])
      .then(([regList, buList, userList]) => {
        if (cancelled) return;
        setRegulations(regList);
        setBusinessUnits(buList);
        setPeople(peopleById(userList));
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

  const onDownload = useCallback(
    async (format) => {
      const model = buildExportModel({
        rows,
        view,
        businessUnits,
        filters,
        filterOptions,
        sortLabel: sortDescription,
        generatedBy: user?.email || '',
        totalCount: allRows.length,
      });
      const blob = format === 'pdf' ? await buildDashboardPdf(model) : await buildDashboardExcel(model);
      saveBlob(blob, exportFileName(format, model.generatedAt));
    },
    [rows, view, businessUnits, filters, filterOptions, sortDescription, user, allRows.length]
  );

  const canEditUnit = useCallback((bu) => isAdminOrSme || myUnits.includes(bu), [isAdminOrSme, myUnits]);

  // --- T064: regulation pop-up (same behaviour as the Roadmap) --------------
  const cancelClose = () => clearTimeout(closeTimer.current);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const hoverOpen = (id, anchor) => {
    cancelClose();
    setOpen((o) => (o?.pinned ? o : { id, anchor, pinned: false }));
  };
  const hoverLeave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen((o) => (o && !o.pinned ? null : o)), 200);
  };
  const toggleOpen = (id, anchor) => {
    cancelClose();
    setOpen((o) => (o?.pinned && o.id === id ? null : { id, anchor, pinned: true }));
  };
  const closePopover = useCallback(
    ({ restoreFocus } = {}) => {
      clearTimeout(closeTimer.current);
      if (restoreFocus) open?.anchor?.focus();
      setOpen(null);
    },
    [open]
  );
  const openUnit = (id, bu) => {
    clearTimeout(closeTimer.current);
    setOpen(null);
    setUnitDialog({ id, bu });
  };

  // T025: an alert email's link opens that regulation's pop-up once the data
  // is in. Its name in the table anchors it; if filters hide the row, the
  // table heading does.
  const linkedReg = linkedRegId && !loading ? onDashboard.find((r) => r.id === linkedRegId) : null;
  const linkedMissing = Boolean(linkedRegId) && !loading && !loadError && !linkedReg;
  useEffect(() => {
    if (!linkedReg) return undefined;
    const frame = requestAnimationFrame(() => {
      const anchor =
        document.querySelector(`[data-reg-trigger="${CSS.escape(linkedReg.id)}"]`) ||
        document.getElementById('dashboard-table-heading');
      anchor?.scrollIntoView?.({ block: 'center' });
      setOpen({ id: linkedReg.id, anchor, pinned: true });
      setLinkedRegId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [linkedReg]);

  const openReg = open ? onDashboard.find((r) => r.id === open.id) : null;
  const dialogReg = unitDialog ? onDashboard.find((r) => r.id === unitDialog.id) : null;
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ViewSwitch view={view} onChange={setView} />
          {/* Oct 26 feedback, item 7: what the two views are for. */}
          <p className="text-xs text-text-secondary dark:text-slate-300 max-w-xl">
            {view === 'bu'
              ? 'By Business Unit: one row per regulation for each unit, with that unit’s status, explanation and documents. Filter by Business Unit to see everything one unit has to do.'
              : 'By regulation: one row per regulation, with every Business Unit’s status side by side.'}
          </p>
        </div>
        <p className="text-xs text-text-secondary dark:text-slate-400">
          Status is set for each Business Unit by its own people.
        </p>
      </div>

      {linkedMissing && (
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <ErrorBanner
              variant="warning"
              message="The regulation in that link isn't on the Dashboard. It may have been removed, or taken off the Roadmap and Dashboard."
            />
          </div>
          <button
            type="button"
            onClick={() => setLinkedRegId(null)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal dark:hover:border-teal-300 dark:hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            Dismiss
          </button>
        </div>
      )}

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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-xs text-text-secondary dark:text-slate-400">
                {countLabel} &middot; sorted by {sortDescription.toLowerCase()} &middot; click a column heading to sort
              </p>
              <DownloadMenu disabled={filtered.length === 0} onDownload={onDownload} summary={countLabel} />
            </div>
          )}
        </div>

        {/* Oct 26 feedback, item 6: how people update the Dashboard. */}
        {!loading && !loadError && filtered.length > 0 && (
          <p className="px-5 py-2 text-xs text-text-secondary dark:text-slate-300 border-b border-border-default dark:border-border-dark">
            Hover over or click a regulation&rsquo;s name for its details and every Business Unit&rsquo;s status. To
            update a unit, click it in the Status column: your units are underlined and marked with a pencil. Hover
            over shortened text to read all of it. The table scrolls sideways for more columns.
          </p>
        )}

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
          <div
            // relative: the sr-only text in cells is absolutely positioned; without a
            // positioned ancestor it escapes this scroll box and widens the whole
            // page at narrow widths and high zoom (WCAG 1.4.10, found in T022).
            // Oct 26 feedback, item 4: the table scrolls inside its own area, so the
            // sideways scrollbar is always on screen and the headings stay in view.
            className="relative overflow-auto max-h-[70vh] rounded-b-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal"
            role="region"
            aria-labelledby="dashboard-table-heading"
            tabIndex={0}
          >
            <table className="w-full min-w-[1200px] border-collapse">
              <caption className="sr-only">
                Compliance Dashboard, {view === 'bu' ? 'one row per Business Unit of each regulation' : 'one row per regulation'}:{' '}
                {countLabel}, sorted by {sortDescription}. Column headers with buttons change the sort.
              </caption>
              <thead className="sticky top-0 z-30 bg-surface-muted dark:bg-surface-muted-dark shadow-[0_1px_0_0_var(--color-border-default)]">
                {view === 'bu' ? (
                  <tr>
                    <SortHeader sortKey="name" sort={sort} onSort={onSort} className={`sticky left-0 z-20 bg-surface-muted dark:bg-surface-muted-dark border-r border-border-default dark:border-border-dark`} />
                    <SortHeader sortKey="unit" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="status" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="explanation" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="due" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="domain" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="country" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="region" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="notes" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="docs" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="updated" sort={sort} onSort={onSort} />
                  </tr>
                ) : (
                  <tr>
                    <SortHeader sortKey="name" sort={sort} onSort={onSort} className={`sticky left-0 z-20 bg-surface-muted dark:bg-surface-muted-dark border-r border-border-default dark:border-border-dark`} />
                    <SortHeader sortKey="due" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="domain" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="country" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="region" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="status" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="notes" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="docs" sort={sort} onSort={onSort} />
                    <SortHeader sortKey="added" sort={sort} onSort={onSort} />
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
                    const updated = formatTimestamp(entry.updatedAt) || formatTimestamp(reg.lastUpdated);
                    return (
                      <tr key={reg.rowKey} className="border-t border-border-default dark:border-border-dark">
                        <RegulationCell reg={reg} isOpen={open?.id === reg.id} onHover={hoverOpen} onLeave={hoverLeave} onToggle={toggleOpen} onClose={closePopover} />
                        <td className={`${CELL} whitespace-nowrap`}>
                          {unitName}
                          {buLabelByCode[reg.rowBu] && (
                            <span className="text-xs text-text-tertiary dark:text-slate-400"> ({reg.rowBu})</span>
                          )}
                        </td>
                        <td className={CELL}>
                          <UnitChip
                            reg={reg}
                            bu={reg.rowBu}
                            buLabelByCode={buLabelByCode}
                            canEdit={canEditUnit(reg.rowBu)}
                            onOpen={() => openUnit(reg.id, reg.rowBu)}
                          />
                        </td>
                        <TextCell value={entry.note} label="No explanation" wide />
                        {dueCell}
                        <TextCell value={reg.domain} />
                        <CountryCell country={reg.country} />
                        <TextCell value={reg.region} />
                        <TextCell value={reg.notes} label="No notes" wide />
                        <DocsCell docs={visibleDocuments(reg, reg.rowBu)} />
                        <td className={`${CELL} whitespace-nowrap`}>{updated || <Blank label="Unknown" />}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={reg.id} className="border-t border-border-default dark:border-border-dark">
                      <RegulationCell reg={reg} isOpen={open?.id === reg.id} onHover={hoverOpen} onLeave={hoverLeave} onToggle={toggleOpen} onClose={closePopover} />
                      {dueCell}
                      <TextCell value={reg.domain} />
                      <CountryCell country={reg.country} />
                      <TextCell value={reg.region} />
                      <td className={`${CELL} min-w-[12rem]`}>
                        <UnitStatusList reg={reg} buLabelByCode={buLabelByCode} canEdit={canEditUnit} onOpenUnit={openUnit} />
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
            {/* What the columns mean: Srinivas and Niranjan asked about these three
                after the Oct 18 demo (Feedback_to_Mahesh.docx, Oct 22). */}
            <dl className="basis-full grid gap-x-2 gap-y-1 sm:grid-cols-[auto_1fr] pt-2 mt-1 border-t border-border-default dark:border-border-dark">
              <dt className="font-semibold text-text-primary dark:text-slate-200">Notes</dt>
              <dd>The SME&rsquo;s notes about the regulation, entered on Add Regulation. Only Admin or SME can change them.</dd>
              <dt className="font-semibold text-text-primary dark:text-slate-200">Explanation</dt>
              <dd>Why a Business Unit has its status, written by that unit&rsquo;s users or Admin/SME. Each unit has its own.</dd>
              <dt className="font-semibold text-text-primary dark:text-slate-200">Docs</dt>
              <dd>Supporting files for the regulation, stored privately for your company. Download them from the regulation&rsquo;s pop-up; add one from your unit&rsquo;s pop-up in the Status column.</dd>
            </dl>
          </div>
        )}
      </section>

      {/* T064: rendered at the page level so the table's sticky cells never cover it. */}
      {openReg &&
        createPortal(
          <RegulationPopover
            reg={openReg}
            anchor={open.anchor}
            pinned={open.pinned}
            buLabelByCode={buLabelByCode}
            onClose={closePopover}
            onPointerEnter={cancelClose}
            onPointerLeave={hoverLeave}
            width={420}
            showDashboardLink={false}
          >
            <UnitStatusSummary
              reg={openReg}
              buLabelByCode={buLabelByCode}
              people={people}
              canEdit={canEditUnit}
              onOpenUnit={(bu) => openUnit(openReg.id, bu)}
            />
          </RegulationPopover>,
          document.body
        )}

      {dialogReg && (
        <UnitStatusDialog
          regulation={dialogReg}
          bu={unitDialog.bu}
          label={buLabelByCode[unitDialog.bu] || unitDialog.bu}
          people={people}
          onClose={() => setUnitDialog(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
