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
 */
import { percent, topWithOther } from '../utils/insights';

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

function Card({ title, children, empty }) {
  return (
    <section className="bg-surface-card dark:bg-surface-card-dark border border-border-default dark:border-border-dark rounded-lg px-5 py-4 space-y-3">
      <h3 className="text-label uppercase text-text-tertiary dark:text-slate-300">{title}</h3>
      {empty ? <p className="text-body text-text-secondary dark:text-slate-400">No regulations in this view.</p> : children}
    </section>
  );
}

export function PieChart({ title, rows, total }) {
  const slices = topWithOther(rows);
  const size = 140;
  const c = size / 2;
  const r = c - 2;
  let angle = -Math.PI / 2;
  const colour = (s, i) => (s.other ? OTHER_COLOUR : PIE_COLOURS[i % PIE_COLOURS.length]);

  return (
    <Card title={title} empty={!total}>
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

export function BarChart({ title, rows, total, max = 12, unitNote }) {
  const shown = rows.slice(0, max);
  const top = shown.length ? shown[0].count : 0;
  return (
    <Card title={title} empty={!rows.length}>
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
