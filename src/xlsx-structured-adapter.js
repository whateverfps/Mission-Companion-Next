const text = value => String(value ?? '').trim();
const compact = value => text(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const knownHeaders = ['submittalnumber', 'submittalno', 'specsection', 'specificationsection', 'activityid', 'activityname', 'plannedfinish', 'plannedstart', 'rfInumber', 'rfino', 'sheetnumber', 'drawingnumber'];

function headerScore(row = []) { return row.reduce((score, value) => score + (knownHeaders.includes(compact(value)) || /submittal|activity|spec(ification)?|status|finish|start|drawing|rfi/i.test(text(value)) ? 1 : 0), 0); }

export function detectHeaderRow(rows = [], { maxScanRows = 20 } = {}) {
  let best = { index: -1, score: 0 };
  rows.slice(0, maxScanRows).forEach((row, index) => { const score = headerScore(row); if (score > best.score) best = { index, score }; });
  return best.score ? best : { index: -1, score: 0 };
}

export function extractWorkbookTables(workbook = {}, { maxHeaderScanRows = 20 } = {}) {
  const sheets = workbook.SheetNames || Object.keys(workbook.Sheets || {});
  return sheets.map(sheetName => {
    const sheet = workbook.Sheets?.[sheetName];
    const rows = sheet?.rows || (globalThis.XLSX?.utils?.sheet_to_json ? globalThis.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false }) : []);
    const header = detectHeaderRow(rows, { maxScanRows: maxHeaderScanRows });
    if (header.index < 0) return { sheetName, rows: [], headerRow: null, sourceSheet: sheetName, status: 'not-structured' };
    const headers = rows[header.index].map(value => text(value));
    const records = rows.slice(header.index + 1).filter(row => row.some(value => text(value))).map((row, index) => ({ ...Object.fromEntries(headers.map((key, column) => [key || `Column ${column + 1}`, text(row[column])])), _source: { sheetName, rowNumber: header.index + index + 2 } }));
    return { sheetName, headerRow: header.index + 1, headers, records, sourceSheet: sheetName, status: records.length ? 'structured' : 'empty' };
  });
}

export async function parseXlsxWorkbook(file, { loader = null } = {}) {
  const XLSX = loader || globalThis.XLSX;
  if (!XLSX?.read) throw new Error('Spreadsheet table extraction is unavailable.');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  return { fileName: file.name, tables: extractWorkbookTables(workbook) };
}
