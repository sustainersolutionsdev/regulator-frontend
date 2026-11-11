/**
 * AiSummaryButton - the "AI" button beside a regulation's name on the
 * Roadmap and the Dashboard (T029; AI Summaries doc, Nov 6: an icon near the
 * regulation). Opens AiSummaryDialog. Visible text "AI" with a spark mark,
 * so it is recognisable without hovering; the accessible name says what it
 * does and for which regulation.
 */
export default function AiSummaryButton({ reg, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(reg)}
      aria-label={`AI summary of ${reg.title}`}
      title="AI summary"
      className="flex-none inline-flex items-center gap-0.5 text-[11px] font-semibold leading-none px-1.5 py-1 rounded border border-border-default dark:border-border-dark text-brand-teal dark:text-teal-300 hover:border-brand-teal hover:bg-brand-teal hover:text-white dark:hover:border-teal-300 dark:hover:bg-teal-300 dark:hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
    >
      <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" focusable="false">
        <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      </svg>
      AI
    </button>
  );
}
