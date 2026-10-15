import { useEffect, useId, useRef, useState } from 'react';
import { EMPTY_FILTERS, countActiveFilters, NOT_SET } from '../utils/regulationFilters';
import StatusSwatch from './StatusSwatch';

/**
 * RegulationFilterBar - shared filter controls for regulation lists.
 * T012 (Roadmap, FR-1.2); built to be reused unchanged by the Dashboard
 * (T019, FR-2.2). T018 added the Status filter.
 *
 * Props:
 *   filters      current filter object (see utils/regulationFilters.js)
 *   onChange     called with (nextFilters, { replace }) - replace is true for
 *                keystrokes in the search box, so typing doesn't flood history
 *   options      { status, domain, bu, country, region } -> [{ value, label, count }]
 *   resultLabel  text for the live result count, e.g. "12 of 40 shown"
 */

const pillBase =
  'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal';
const pillIdle =
  'bg-surface-card dark:bg-surface-card-dark border-border-default dark:border-border-dark text-text-secondary dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal dark:hover:border-teal-300 dark:hover:text-teal-300';
const pillActive = 'bg-brand-teal/10 dark:bg-brand-teal/25 border-brand-teal text-brand-teal dark:text-teal-200';

const inputBase =
  'text-body bg-surface-page dark:bg-surface-muted-dark border border-border-default dark:border-border-dark rounded-md px-3 py-1.5 text-text-primary dark:text-white placeholder:text-text-tertiary dark:placeholder:text-slate-400 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-brand-teal';

function FilterMenu({ label, selectedCount, children, onClear }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onBlur={(e) => {
        // Close when focus moves outside this menu (e.g. Tab past the last option).
        // relatedTarget is null for mouse clicks inside the menu (e.g. on a
        // label), which the outside-click listener already handles.
        if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`${pillBase} ${selectedCount ? pillActive : pillIdle}`}
      >
        {label}
        {selectedCount > 0 && (
          <span className="rounded-full bg-brand-teal text-white px-1.5 text-[10px] leading-4">
            {selectedCount}
            <span className="sr-only"> selected</span>
          </span>
        )}
        <span aria-hidden="true" className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full mt-1.5 z-40 w-64 max-w-[85vw] rounded-md border border-border-strong dark:border-border-dark bg-surface-card dark:bg-surface-card-dark shadow-lg p-3"
        >
          {children}
          {onClear && selectedCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="mt-2 text-xs text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded"
            >
              Clear {label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxList({ legend, options, selected, onToggle, withStatusSwatch = false }) {
  if (!options.length) {
    return <p className="text-xs text-text-tertiary dark:text-slate-400">No values in use yet.</p>;
  }
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <ul className="max-h-60 overflow-y-auto space-y-1 pr-1">
        {options.map((opt) => (
          <li key={opt.value}>
            <label className="flex items-center gap-2 text-body text-text-primary dark:text-slate-200 cursor-pointer rounded px-1 py-0.5 hover:bg-surface-muted dark:hover:bg-surface-muted-dark">
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => onToggle(opt.value)}
                className="accent-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal"
              />
              {withStatusSwatch && (
                <StatusSwatch status={opt.value === NOT_SET ? null : opt.value} size="sm" decorative />
              )}
              <span className={`flex-1 truncate ${opt.value === NOT_SET ? 'italic' : ''}`}>{opt.label}</span>
              <span className="text-xs text-text-tertiary dark:text-slate-400">{opt.count}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

const MULTI_FILTERS = [
  { key: 'status', label: 'Status' },
  { key: 'domain', label: 'Domain' },
  { key: 'bu', label: 'Business Unit' },
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region' },
];

export default function RegulationFilterBar({ filters, onChange, options, resultLabel }) {
  const searchId = useId();
  const fromId = useId();
  const toId = useId();
  const set = (patch) => onChange({ ...filters, ...patch });
  const toggle = (key, value) => {
    const current = filters[key];
    set({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  };

  const activeCount = countActiveFilters(filters);
  const dateCount = filters.dueFrom || filters.dueTo ? 1 : 0;
  const docsCount = filters.docs ? 1 : 0;

  return (
    <section
      aria-label="Filters"
      className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label uppercase text-text-tertiary dark:text-slate-300 mr-1">Filters</span>

        <label htmlFor={searchId} className="sr-only">
          Search title, abbreviated title, notes or status explanation
        </label>
        <input
          id={searchId}
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value }, { replace: true })}
          placeholder="Search title or notes..."
          className={`${inputBase} w-56`}
        />

        {MULTI_FILTERS.map(({ key, label }) => (
          <FilterMenu
            key={key}
            label={label}
            selectedCount={filters[key].length}
            onClear={() => set({ [key]: [] })}
          >
            <CheckboxList
              legend={label}
              options={options[key] || []}
              selected={filters[key]}
              onToggle={(value) => toggle(key, value)}
              withStatusSwatch={key === 'status'}
            />
          </FilterMenu>
        ))}

        <FilterMenu
          label="Due date"
          selectedCount={dateCount}
          onClear={() => set({ dueFrom: '', dueTo: '' })}
        >
          <div className="space-y-2">
            <div>
              <label htmlFor={fromId} className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
                From
              </label>
              <input
                id={fromId}
                type="date"
                value={filters.dueFrom}
                max={filters.dueTo || undefined}
                onChange={(e) => set({ dueFrom: e.target.value })}
                className={`${inputBase} w-full`}
              />
            </div>
            <div>
              <label htmlFor={toId} className="block text-label uppercase text-text-tertiary dark:text-slate-300 mb-1">
                To
              </label>
              <input
                id={toId}
                type="date"
                value={filters.dueTo}
                min={filters.dueFrom || undefined}
                onChange={(e) => set({ dueTo: e.target.value })}
                className={`${inputBase} w-full`}
              />
            </div>
          </div>
        </FilterMenu>

        <FilterMenu label="Documents" selectedCount={docsCount} onClear={() => set({ docs: '' })}>
          <fieldset>
            <legend className="sr-only">Supporting documents</legend>
            {[
              { value: '', label: 'Any' },
              { value: 'with', label: 'Has documents' },
              { value: 'without', label: 'No documents' },
            ].map((opt) => (
              <label
                key={opt.value || 'any'}
                className="flex items-center gap-2 text-body text-text-primary dark:text-slate-200 cursor-pointer rounded px-1 py-0.5 hover:bg-surface-muted dark:hover:bg-surface-muted-dark"
              >
                <input
                  type="radio"
                  name="docs-filter"
                  checked={filters.docs === opt.value}
                  onChange={() => set({ docs: opt.value })}
                  className="accent-brand-teal"
                />
                {opt.label}
              </label>
            ))}
          </fieldset>
        </FilterMenu>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="text-xs px-2 py-1.5 text-brand-teal dark:text-teal-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-md"
          >
            Clear all
          </button>
        )}

        <div
          className="text-label text-text-tertiary dark:text-slate-300 ml-auto whitespace-nowrap"
          aria-live="polite"
          aria-atomic="true"
        >
          {resultLabel}
        </div>
      </div>
    </section>
  );
}
