/**
 * exportExcel.js - Dashboard download as an Excel workbook (T021, FR-2.4).
 *
 * Built in the browser from the export model (utils/dashboardExport.js), so
 * it holds exactly the rows on screen. Two sheets:
 *   1. "Dashboard" - every Add Regulation field plus record ID, status,
 *      explanations, documents and dates. Real Excel dates, so they sort and
 *      filter. Status cells carry the word and the status colour.
 *        By regulation:     one row per regulation, one Status column per
 *                           Business Unit, and the units' explanations.
 *        By Business Unit:  one row per regulation per unit.
 *   2. "About this export" - when, who, view, filters, sort, counts.
 *
 * write-excel-file (one small dependency) is loaded only when someone
 * downloads, so the Dashboard itself stays as light as before.
 */
import { AI_NOTE, countsLabel, formatGeneratedAt, rowCountLabel } from './dashboardExport';

// Status fills are the brand status colours; navy text on each is >= 4.9:1.
const STATUS_FILL = { compliant: '#22C55E', pending: '#F59E0B', action_needed: '#EF4444' };
const NAVY = '#0F172A';
const MUTED = '#64748B';
const DATE_FORMAT = 'mmm d, yyyy';

const HEADER = { fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: NAVY, alignVertical: 'center', wrap: true };

function header(value) {
  return { value, ...HEADER };
}

function textCell(value, wrap = false) {
  return { value: value || null, type: String, alignVertical: 'top', wrap };
}

function dateCell(value) {
  return value ? { value, type: Date, format: DATE_FORMAT, alignVertical: 'top' } : { value: null, type: String };
}

function statusCell(cell) {
  if (!cell.status) return { value: 'Not set', type: String, textColor: MUTED, alignVertical: 'top' };
  return {
    value: cell.label,
    type: String,
    backgroundColor: STATUS_FILL[cell.status],
    textColor: NAVY,
    fontWeight: 'bold',
    alignVertical: 'top',
  };
}

function lines(values) {
  return values.filter(Boolean).join('\n');
}

function regulationSheet(model) {
  const unitCols = model.unitColumns;
  const head = [
    header('Record ID'),
    header('Regulation'),
    header('Abbreviated title'),
    header('Due date'),
    header('Domain'),
    header('Business Units'),
    ...unitCols.map((u) => header(`Status: ${u.name}`)),
    header('Status explanations'),
    header('Country'),
    header('Region'),
    header('Notes'),
    header('Documents'),
    header('Added'),
    header('Last updated'),
  ];
  const body = model.rows.map((row) => {
    const byCode = Object.fromEntries(row.unitStatuses.map((u) => [u.code, u.cell]));
    const explanations = row.unitStatuses
      .filter((u) => u.cell.note)
      .map((u) => `${u.unit}: ${u.cell.note}`);
    return [
      textCell(row.id),
      textCell(row.title, true),
      textCell(row.abbreviatedTitle),
      dateCell(row.dueDate),
      textCell(row.domain),
      textCell(lines(row.units), true),
      // Blank (not "Not set") where the regulation isn't tagged to that unit.
      ...unitCols.map((u) => (byCode[u.code] ? statusCell(byCode[u.code]) : textCell(''))),
      textCell(lines(explanations), true),
      textCell(row.country),
      textCell(row.region),
      textCell(row.notes, true),
      textCell(lines(row.documents), true),
      dateCell(row.added),
      dateCell(row.lastUpdated),
    ];
  });
  const columns = [
    { width: 24 },
    { width: 40 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 24 },
    ...unitCols.map(() => ({ width: 18 })),
    { width: 50 },
    { width: 12 },
    { width: 14 },
    { width: 50 },
    { width: 30 },
    { width: 14 },
    { width: 14 },
  ];
  return { data: [head, ...body], columns };
}

function businessUnitSheet(model) {
  const head = [
    header('Record ID'),
    header('Regulation'),
    header('Abbreviated title'),
    header('Business Unit'),
    header('Status'),
    header('Explanation'),
    header('Status updated'),
    header('Due date'),
    header('Domain'),
    header('Country'),
    header('Region'),
    header('Notes'),
    header('Documents'),
    header('Added'),
    header('Last updated'),
  ];
  const body = model.rows.map((row) => [
    textCell(row.id),
    textCell(row.title, true),
    textCell(row.abbreviatedTitle),
    textCell(row.unit),
    statusCell(row.status),
    textCell(row.status.note, true),
    dateCell(row.statusUpdated),
    dateCell(row.dueDate),
    textCell(row.domain),
    textCell(row.country),
    textCell(row.region),
    textCell(row.notes, true),
    textCell(lines(row.documents), true),
    dateCell(row.added),
    dateCell(row.lastUpdated),
  ]);
  const columns = [
    { width: 24 },
    { width: 40 },
    { width: 18 },
    { width: 22 },
    { width: 16 },
    { width: 50 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 12 },
    { width: 14 },
    { width: 50 },
    { width: 30 },
    { width: 14 },
    { width: 14 },
  ];
  return { data: [head, ...body], columns };
}

function aboutSheet(model) {
  const label = (value) => ({ value, type: String, fontWeight: 'bold', alignVertical: 'top' });
  const value = (v) => ({ value: v, type: String, wrap: true, alignVertical: 'top' });
  const data = [
    [{ value: `Regulator — ${model.title}`, type: String, fontWeight: 'bold', fontSize: 14 }, null],
    [null, null],
    [label('Generated'), value(formatGeneratedAt(model.generatedAt))],
    [label('Generated by'), value(model.generatedBy || 'Unknown')],
    [label('View'), value(model.viewLabel)],
    [label('Filters'), value(model.filterLines.length ? model.filterLines.join('\n') : 'None')],
    [label('Sorted by'), value(model.sortLabel)],
    [label('Rows'), value(rowCountLabel(model))],
    [label('Business Unit statuses'), value(countsLabel(model.counts))],
    [null, null],
    [{ value: AI_NOTE, type: String, fontStyle: 'italic', textColor: MUTED }, null],
  ];
  return { data, columns: [{ width: 24 }, { width: 70 }] };
}

/** Returns the workbook as a Blob. */
export async function buildDashboardExcel(model) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const main = model.view === 'bu' ? businessUnitSheet(model) : regulationSheet(model);
  const about = aboutSheet(model);
  return writeExcelFile([
    { ...main, sheet: 'Dashboard', stickyRowsCount: 1, stickyColumnsCount: 2 },
    { ...about, sheet: 'About this export' },
  ]).toBlob();
}
