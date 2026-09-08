const text = value => value === null || value === undefined ? '' : String(value).trim().replace(/\s+/g, ' ');
const list = value => Array.isArray(value) ? value : [];
function hash(value) { let output = 2166136261; for (const character of String(value)) { output ^= character.charCodeAt(0); output = Math.imul(output, 16777619); } return (output >>> 0).toString(36); }
const reg = value => ({ x: Number(value?.x) || 0, y: Number(value?.y) || 0, width: Number(value?.width) || 0, height: Number(value?.height) || 0 });
export const normalizeEquipmentTag = value => text(value).toUpperCase().replace(/\s+/g, '-');

export function extractScheduleCandidates({ documentId, drawingSetId, sheet } = {}) {
  if (!documentId || !drawingSetId || !sheet?.sheetId || !list(sheet.sheetTypes).some(type => /Schedule|Inventory/.test(type))) return [];
  const items = list(sheet.textItems).map(item => ({ text: text(item.text), region: reg(item.region) })).filter(item => item.text);
  const headings = items.filter(item => /\b(?:SCHEDULE|INVENTORY(?: LIST)?)\b/i.test(item.text) && item.text.length < 140);
  return headings.map((heading, scheduleIndex) => {
    const body = items.filter(item => item.region.y > heading.region.y && item.region.y - heading.region.y < .48);
    const xBuckets = [...new Set(body.map(item => Math.round(item.region.x * 100) / 100))].sort((a, b) => a - b).slice(0, 24);
    const columns = xBuckets.map((x, index) => ({ columnId: `column-${index + 1}`, title: '', x }));
    const rowsByY = new Map();
    for (const item of body) { const y = Math.round(item.region.y * 500) / 500; if (!rowsByY.has(y)) rowsByY.set(y, []); rowsByY.get(y).push(item); }
    const rows = [...rowsByY].sort((a, b) => a[0] - b[0]).slice(0, 300).map(([y, rowItems], rowIndex) => ({ rowId: `row-${rowIndex + 1}`, cells: rowItems.sort((a, b) => a.region.x - b.region.x).map((item, cellIndex) => { const column = columns.reduce((best, candidate) => Math.abs(candidate.x - item.region.x) < Math.abs(best.x - item.region.x) ? candidate : best, columns[0] || { columnId: `column-${cellIndex + 1}` }); return { rowId: `row-${rowIndex + 1}`, columnId: column.columnId, rawText: item.text, normalizedText: text(item.text).toUpperCase(), sourceRegion: item.region }; }), sourceY: y }));
    const tagPattern = /^(?:[A-Z]{1,6})[- ]?\d{1,4}[A-Z]?(?:-\d{1,3})?$/;
    const tagCounts = new Map();
    for (const row of rows) for (const cell of row.cells) if (tagPattern.test(cell.normalizedText)) tagCounts.set(cell.columnId, (tagCounts.get(cell.columnId) || 0) + 1);
    const tagColumn = [...tagCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    return { scheduleId: `schedule-${hash(`${drawingSetId}:${sheet.sheetId}:${heading.text}:${scheduleIndex}`)}`, documentId, drawingSetId, sheetId: sheet.sheetId, pageNumber: sheet.pageNumber, title: heading.text, sourceRegion: heading.region, columns, rows, tagColumn, warnings: tagColumn ? [] : ['Schedule tag column could not be verified.'], diagnostics: { itemCount: body.length }, verification: { status: 'Unreviewed', correctedValue: '', verifiedAt: '' } };
  });
}

export function findScheduleRowsByTag(schedules = [], tag = '') {
  const target = normalizeEquipmentTag(tag);
  if (!target) return { status: 'missing-tag', matches: [] };
  const matches = [];
  for (const schedule of list(schedules)) for (const row of list(schedule.rows)) {
    const cells = list(row.cells).filter(cell => normalizeEquipmentTag(cell.normalizedText) === target);
    if (cells.length) matches.push({ scheduleId: schedule.scheduleId, rowId: row.rowId, sheetId: schedule.sheetId, pageNumber: schedule.pageNumber, cells: structuredClone(row.cells) });
  }
  return { status: matches.length > 1 ? 'ambiguous' : matches.length === 1 ? 'exact' : 'unavailable', matches };
}
