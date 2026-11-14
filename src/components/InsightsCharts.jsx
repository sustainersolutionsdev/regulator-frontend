/**
 * InsightsCharts - the charts on the Insights page (T030; FR-4.3; DL-18
 * point 3): pies for domain and region (few slices), horizontal bars,
 * largest first, for country and Business Unit (many items).
 *
 * Hand-drawn SVG: no chart library, nothing extra to download.
 * Accessibility (WCAG AA / 508): colour is never the only cue - every pie
 * has a legend with names, counts and percentages beside it, and every bar
 * carries its label and number as text. Each chart's SVG is marked as an
 * image with a text description; the legend and bar list are real lists a
 * screen reader can walk through.
 *
 * Pie colours are a categorical set that avoids red, amber and green, which
 * mean compliance status everywhere else in the product.
 *
 * T077 adds two status charts: due dates by quarter (one stacked bar per
 * quarter, segments in the Compliance Overview order with 2px gaps) and a
 * Business Unit x status grid (a table: exact numbers, read row by row).
 * Status colours are always paired with the status icon and name in a
 * legend, and every number is also written as text, so colour is never the
 * only cue (checked with the palette validator: CVD and normal-vision
 * separation pass; the amber and grey fills sit below 3:1, so the counts
 * are always printed beside them).
 *
 * T076 adds an optional AI note under each chart (`note` prop): two short
 * sentences written from the chart's numbers only, marked "AI".
 */
import StatusSwatch from './StatusSwatch';
import { NOT_SET, STATUS_ORDER, percent, topWithOther } from '../utils/insights';

const STATUS_FILL = { compliant: '#15803D', pending: '#F59E0B', action_needed: '#B91C1C', [NOT_SET]: '#94A3B8' };
const STATUS_NAME = { compliant: 'Compliant', pending: 'Pending', action_needed: 'Action needed', [NOT_SET]: 'Not set' };

const PIE_COLOURS = ['#0D7377', '#2563EB', '#7C3AED', '#C026D3', '#0369A1'];
const OTHER_COLOUR = '#94A3B8';

function arcPath(cx, cy, r, start, end) {
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function describe(title, rows, total) {
  if (!total) return `${title}: no regulations.`;
  return `${title}: ${rows.map((r) => `${r.label} ${r.count} (${percent(r.count, total)}%)`).join(', ')}.`;
}

/**
 * note: undefined (AI notes off), { loading: true }, { error: text } or
 * { text }. Shown under the chart with an "AI" tag.
 */
function ChartNote({ note }) {
  if (!note) return null;
  if (note.loading) {
    return <p className="text-xs text-text-secondary dark:text-slate-400 italic">Writing the AI note...</p>;
  }
  if (!note.text) return null;
  return (
    <p className="flex gap-2 items-start text-body text-text-primary dark:text-slate-200 border-t border-border-default dark:border-border-dark pt-2.5">
      <span className="flex-none mt-0.5 px-1.5 rounded border border-brand-teal text-[10px] font-semibold leading-4 text-brand-teal dark:text-teal-300 dark:border-teal-300">
        AI
      </span>
      <span>{note.text}</span>
    </p>
  );
}

function Card({ title, children, empty, note, wide }) {
  return (
    <section
      className={`bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg px-5 py-4 space-y-3 ${
        wide ? 'md:col-span-2' : ''
      }`}
    >
      <h3 className="text-label uppercase text-text-tertiary dark:text-slate-300">{title}</h3>
      {empty ? <p className="text-body text-text-secondary dark:text-slate-400">No regulations in this view.</p> : children}
      {!empty && <ChartNote note={note} />}
    </section>
  );
}

export function PieChart({ title, rows, total, note }) {
  const slices = topWithOther(rows);
  const size = 140;
  const c = size / 2;
  const r = c - 2;
  let angle = -Math.PI / 2;
  const colour = (s, i) => (s.other ? OTHER_COLOUR : PIE_COLOURS[i % PIE_COLOURS.length]);

  return (
    <Card title={title} empty={!total} note={note}>
      <div className="flex flex-wrap items-center gap-5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={describe(title, slices, total)} className="flex-none">
          {slices.length === 1 ? (
            <circle cx={c} cy={c} r={r} fill={colour(slices[0], 0)} />
          ) : (
            slices.map((s, i) => {
              const start = angle;
              angle += (s.count / total) * Math.PI * 2;
              return (
                <path
                  key={s.label}
                  d={arcPath(c, c, r, start, angle)}
                  fill={colour(s, i)}
                  className="stroke-white dark:stroke-slate-800"
                  strokeWidth="1.5"
                />
              );
            })
          )}
        </svg>
        <ul className="flex-1 min-w-[10rem] space-y-1.5">
          {slices.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2 text-body text-text-primary dark:text-slate-200">
              <span aria-hidden="true" className="flex-none w-3 h-3 rounded-sm" style={{ backgroundColor: colour(s, i) }} />
              <span className="flex-1 truncate" title={s.label}>{s.label}</span>
              <span className="tabular-nums text-text-secondary dark:text-slate-300">
                {s.count} <span className="text-xs">({percent(s.count, total)}%)</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export function BarChart({ title, rows, total, max = 12, unitNote, note }) {
  const shown = rows.slice(0, max);
  const top = shown.length ? shown[0].count : 0;
  return (
    <Card title={title} empty={!rows.length} note={note}>
      <ul className="space-y-2" aria-label={describe(title, shown, total)}>
        {shown.map((row) => (
          <li key={row.label} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-3 text-body text-text-primary dark:text-slate-200">
              <span className="truncate" title={row.label}>{row.label}</span>
              <span className="tabular-nums text-text-secondary dark:text-slate-300">{row.count}</span>
            </div>
            <div aria-hidden="true" className="h-2 rounded-full bg-surface-muted dark:bg-surface-muted-dark">
              <div className="h-2 rounded-full bg-brand-teal dark:bg-teal-400" style={{ width: `${top ? Math.max((row.count / top) * 100, 2) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {rows.length > max && (
        <p className="text-xs text-text-secondary dark:text-slate-400">
          Showing the {max} largest of {rows.length}. Narrow the filters to see the rest.
        </p>
      )}
      {unitNote && <p className="text-xs text-text-secondary dark:text-slate-400">{unitNote}</p>}
    </Card>
  );
}

function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Status colours">
      {STATUS_ORDER.map((key) => (
        <li key={key} className="flex items-center gap-1.5 text-xs text-text-secondary dark:text-slate-300">
          <span aria-hidden="true" className="w-3 h-3 rounded-sm" style={{ backgroundColor: STATUS_FILL[key] }} />
          <StatusSwatch status={key === NOT_SET ? null : key} size="sm" decorative />
          {STATUS_NAME[key]}
        </li>
      ))}
    </ul>
  );
}

function countsText(counts) {
  return STATUS_ORDER.filter((k) => counts[k]).map((k) => `${counts[k]} ${STATUS_NAME[k]}`).join(', ');
}

/** T077: Business Unit statuses by due-date quarter, one stacked bar per quarter. */
export function QuarterStatusChart({ title, rows, note }) {
  const top = rows.reduce((m, r) => Math.max(m, r.total), 0);
  return (
    <Card title={title} empty={!rows.length} note={note} wide>
      <StatusLegend />
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3">
            <span className="text-body text-text-primary dark:text-slate-200 tabular-nums">{row.label}</span>
            <div className="flex h-4 gap-[2px]" style={{ width: `${top ? Math.max((row.total / top) * 100, 3) : 0}%` }} aria-hidden="true">
              {STATUS_ORDER.filter((k) => row.counts[k]).map((k, i, shown) => (
                <span
                  key={k}
                  title={`${row.label}: ${row.counts[k]} ${STATUS_NAME[k]}`}
                  className={`h-4 ${i === 0 ? 'rounded-l' : ''} ${i === shown.length - 1 ? 'rounded-r' : ''}`}
                  style={{ flexGrow: row.counts[k], flexBasis: 0, backgroundColor: STATUS_FILL[k] }}
                />
              ))}
            </div>
            <span className="text-xs tabular-nums text-text-secondary dark:text-slate-300 whitespace-nowrap">
              <span className="font-semibold text-text-primary dark:text-white">{row.total}</span>
              <span className="sr-only">: {countsText(row.counts)}</span>
              <span aria-hidden="true" className="hidden sm:inline"> &middot; {countsText(row.counts)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-secondary dark:text-slate-400">Business Unit statuses, by the regulation&rsquo;s due date.</p>
    </Card>
  );
}

/** T077: Business Unit x status grid. A table: exact numbers, read row by row. */
export function UnitStatusGrid({ title, rows, note }) {
  const totals = Object.fromEntries(STATUS_ORDER.map((k) => [k, rows.reduce((sum, r) => sum + r.counts[k], 0)]));
  const all = rows.reduce((sum, r) => sum + r.total, 0);
  const cell = 'px-3 py-1.5 text-right tabular-nums';
  return (
    <Card title={title} empty={!rows.length} note={note} wide>
      <div className="overflow-x-auto">
        <table className="w-full text-body">
          <caption className="sr-only">{title}: Business Unit statuses per Business Unit and status</caption>
          <thead>
            <tr className="border-b border-border-default dark:border-border-dark">
              <th scope="col" className="px-3 py-1.5 text-left text-label uppercase text-text-secondary dark:text-slate-300">Business Unit</th>
              {STATUS_ORDER.map((k) => (
                <th key={k} scope="col" className="px-3 py-1.5 text-right text-label uppercase text-text-secondary dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <StatusSwatch status={k === NOT_SET ? null : k} size="sm" decorative />
                    {STATUS_NAME[k]}
                  </span>
                </th>
              ))}
              <th scope="col" className="px-3 py-1.5 text-right text-label uppercase text-text-secondary dark:text-slate-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border-default/60 dark:border-border-dark/60">
                <th scope="row" className="px-3 py-1.5 text-left font-normal text-text-primary dark:text-slate-200">{row.label}</th>
                {STATUS_ORDER.map((k) => (
                  <td
                    key={k}
                    className={`${cell} ${
                      row.counts[k]
                        ? k === 'action_needed'
                          ? 'font-semibold text-red-700 dark:text-red-300'
                          : 'text-text-primary dark:text-slate-200'
                        : 'text-text-tertiary dark:text-slate-500'
                    }`}
                  >
                    {row.counts[k] || <span aria-label="none">&ndash;</span>}
                  </td>
                ))}
                <td className={`${cell} font-semibold text-text-primary dark:text-white`}>{row.total}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr>
                <th scope="row" className="px-3 py-1.5 text-left font-semibold text-text-primary dark:text-white">All</th>
                {STATUS_ORDER.map((k) => (
                  <td key={k} className={`${cell} font-semibold text-text-primary dark:text-white`}>{totals[k]}</td>
                ))}
                <td className={`${cell} font-semibold text-text-primary dark:text-white`}>{all}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Card>
  );
}
