/**
 * OptionCombobox - a list field with type-ahead and "Other" (Oct 24 meeting,
 * item 2), shared by Domain (DomainSelect) and Region (RegionSelect, Oct 26
 * testing feedback).
 *
 * - Typing narrows the list: options that start with what was typed come
 *   first ("B" -> Basel..., Batteries), then options with a later word that
 *   starts with it ("Re" also finds "Product Longevity / Repair").
 * - "Other" is always offered. Choosing it shows "Name the <noun>"; what is
 *   typed there is what gets saved, so filters and screens show the real
 *   value, not the word "Other".
 * - Only a listed option or a named Other can be saved: free text in the
 *   search box is not a value. A value saved before the list existed opens
 *   as Other with that name filled in.
 *
 * Accessibility: WAI-ARIA 1.2 combobox with a listbox popup
 * (aria-activedescendant; Up/Down, Enter, Escape, Home/End), the list also
 * opens from the toggle button; the result count is announced.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { OTHER, isListed, matchOptions } from '../utils/options';

export default function OptionCombobox({
  id,
  value,
  onChange,
  choices,
  noun,
  nounPlural,
  otherPlaceholder,
  required = false,
  className = '',
}) {
  const listId = useId();
  const otherId = useId();
  const hintId = useId();
  const inputRef = useRef(null);
  const otherRef = useRef(null);
  const focusOther = useRef(false);

  const listed = isListed(choices, value);
  const [otherPicked, setOtherPicked] = useState(Boolean(value) && !listed);
  const [query, setQuery] = useState(null); // null = not typing; show the chosen value
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const isOther = otherPicked || (Boolean(value) && !listed);
  const chosenLabel = isOther ? OTHER : value || '';
  const matches = useMemo(() => matchOptions(choices, query ?? ''), [choices, query]);
  const options = [...matches, OTHER];
  const activeIndex = Math.min(active, options.length - 1);

  const choose = (option) => {
    setQuery(null);
    setOpen(false);
    setActive(0);
    if (option === OTHER) {
      setOtherPicked(true);
      if (listed) onChange('');
      focusOther.current = true; // next: name it (focused once it is drawn)
    } else {
      setOtherPicked(false);
      onChange(choices.find((d) => d.toLowerCase() === option.toLowerCase()) || option);
    }
  };

  const closeList = () => {
    // Leaving the box: an exact name counts as choosing it; anything else
    // typed is dropped and the previous choice stays.
    if (query !== null) {
      const exact = options.find((o) => o.toLowerCase() === query.trim().toLowerCase());
      if (exact) {
        choose(exact);
        return;
      }
    }
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (open) setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault(); // never submit the form from the list
        choose(options[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (open || query !== null) {
        e.preventDefault();
        e.stopPropagation(); // don't close a surrounding panel
        setQuery(null);
        setOpen(false);
      }
    }
  };

  useEffect(() => {
    if (isOther && focusOther.current) {
      focusOther.current = false;
      otherRef.current?.focus();
    }
  });

  const optionId = (i) => `${listId}-opt-${i}`;
  const inputClass =
    'border border-border-default dark:border-border-dark bg-white dark:bg-surface-muted-dark dark:text-white rounded-md px-3 py-2 text-body w-full focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent';

  return (
    <div className={className}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? optionId(activeIndex) : undefined}
          aria-describedby={hintId}
          aria-required={required || undefined}
          autoComplete="off"
          value={query ?? chosenLabel}
          placeholder="Type to search, or pick from the list"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={(e) => e.target.select()}
          onClick={() => setOpen(true)}
          onBlur={closeList}
          onKeyDown={onKeyDown}
          className={`${inputClass} pr-9`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? `Close ${noun} list` : `Show all ${nounPlural}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery(null);
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 px-2.5 text-text-secondary dark:text-slate-300 hover:text-brand-teal dark:hover:text-teal-300"
        >
          <span aria-hidden="true">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={nounPlural.charAt(0).toUpperCase() + nounPlural.slice(1)}
            className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border-strong dark:border-border-dark bg-surface-card dark:bg-surface-card-dark shadow-lg py-1"
          >
            {options.map((option, i) => {
              const isActive = i === activeIndex;
              const isChosen = option === chosenLabel;
              return (
                <li
                  key={option}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isChosen}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(option)}
                  onMouseMove={() => setActive(i)}
                  className={[
                    'px-3 py-1.5 text-body cursor-pointer flex items-center justify-between gap-2',
                    option === OTHER ? 'border-t border-border-default dark:border-border-dark mt-1 pt-2' : '',
                    isActive
                      ? 'bg-brand-teal text-white'
                      : 'text-text-primary dark:text-slate-200',
                  ].join(' ')}
                >
                  <span>{option === OTHER ? 'Other (not in the list)' : option}</span>
                  {isChosen && <span aria-hidden="true">✓</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p id={hintId} className="sr-only" aria-live="polite">
        {open
          ? `${matches.length} ${matches.length === 1 ? `${noun} matches` : `${nounPlural} match`}, plus Other.`
          : ''}
      </p>

      {isOther && (
        <div className="mt-2">
          <label htmlFor={otherId} className="block text-xs text-text-secondary dark:text-slate-300 mb-1">
            Name the {noun}{required ? ' *' : ''}
          </label>
          <input
            ref={otherRef}
            id={otherId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={80}
            aria-required={required || undefined}
            placeholder={otherPlaceholder}
            className={inputClass}
          />
        </div>
      )}
    </div>
  );
}
