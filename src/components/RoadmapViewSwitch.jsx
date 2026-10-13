import { NavLink } from 'react-router-dom';

/**
 * RoadmapViewSwitch - moves between the two Roadmap screens: the timeline
 * (T011) and the monthly calendar (T013). FR-1.3 requires these to be
 * separate screens, not one combined view; this is only the link between them.
 */
const linkBase =
  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal';

function linkClass({ isActive }) {
  return `${linkBase} ${
    isActive
      ? 'bg-brand-teal text-white'
      : 'text-text-secondary dark:text-slate-300 hover:text-brand-teal dark:hover:text-teal-300'
  }`;
}

export default function RoadmapViewSwitch() {
  return (
    <nav
      aria-label="Roadmap views"
      className="inline-flex items-center gap-1 p-1 rounded-lg border border-border-default dark:border-border-dark bg-surface-card dark:bg-surface-card-dark"
    >
      <NavLink to="/roadmap" end className={linkClass}>
        Timeline
      </NavLink>
      <NavLink to="/roadmap/calendar" className={linkClass}>
        Monthly calendar
      </NavLink>
    </nav>
  );
}
