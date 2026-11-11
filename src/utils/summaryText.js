/**
 * summaryText.js - the AI summary as plain text, for Copy (T029).
 *
 * Always the full summary (not just the 3-line version), and always ending
 * with the disclaimer, so the AI label travels with the text wherever it is
 * pasted (DL-19 point 6).
 */
function contactText(contacts) {
  if (!contacts || contacts.length === 0) return '';
  return ` Contact: ${contacts.map((c) => (c.email ? `${c.name} (${c.email})` : c.name)).join(', ')}.`;
}

export function generatedText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function summaryToText(summary, regulation) {
  const lines = [];
  lines.push(`AI summary: ${regulation?.title || ''}`.trim());
  const when = generatedText(summary.generatedAt);
  if (when) lines.push(`Generated ${when}`);
  lines.push('', summary.short, '', 'Regulation', summary.regulation, '', 'Documents and notes', summary.documentsAndNotes);
  lines.push('', 'Status across Business Units');
  for (const u of summary.units || []) {
    lines.push(`- ${u.name}: ${u.statusLabel}.${u.summary ? ` ${u.summary}` : ''}${contactText(u.contacts)}`);
  }
  lines.push('', 'Actions needed');
  if (!summary.actionsNeeded || summary.actionsNeeded.length === 0) {
    lines.push('No actions have been entered.');
  } else {
    for (const a of summary.actionsNeeded) lines.push(`- ${a.unit ? `${a.unit}: ` : ''}${a.action}`);
  }
  lines.push('', summary.disclaimer);
  return lines.join('\n');
}
