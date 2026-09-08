const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const clean = value => text(value).replace(/\s+/g, ' ');

export const BEDFORD_VA_PROFILE_ID = 'bedford-va-triple-c';
export const BEDFORD_VA_PROFILE_VERSION = 3;
export const BEDFORD_TITLE_BLOCK_REGION = Object.freeze({ x: .48, y: .55, width: .52, height: .45 });
export const normalizeBedfordSheetNumber = value => clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '');
export const normalizeBedfordTitle = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const DISCIPLINES = Object.freeze({ GENERAL: 'General', HAZARDOUS: 'Hazardous Materials', ARCHITECTURAL: 'Architectural', INTERIORS: 'Interiors', 'FIRE PROTECTION': 'Fire Protection', PLUMBING: 'Plumbing', MECHANICAL: 'Mechanical', ELECTRICAL: 'Electrical', TELECOMMUNICATION: 'Telecommunications', TELECOMMUNICATIONS: 'Telecommunications', REFERENCE: 'Reference' });
const FIELD_NAMES = Object.freeze({ 'PROJECT NUMBER': 'projectNumber', 'BUILDING NUMBER': 'buildingNumber', 'DRAWING NUMBER': 'drawingNumber', 'DRAWING TITLE': 'drawingTitle', 'ISSUE DATE': 'issueDate' });
const SHEET = /^(?:\d{1,4})?[A-Z]{1,3}[-.]?\d{3,4}[A-Z]?$/i;

function normalizedItems(items = []) {
  return list(items).map((item, order) => ({ text: clean(item?.text), region: item?.region || {}, order: Number(item?.order ?? order) })).filter(item => item.text);
}

function inRegion(item, region = BEDFORD_TITLE_BLOCK_REGION) {
  return Number(item?.region?.x) >= region.x && Number(item?.region?.y) >= region.y && Number(item?.region?.x) <= region.x + region.width && Number(item?.region?.y) <= region.y + region.height;
}

function formatBedfordSheetNumber(value) {
  const normalized = normalizeBedfordSheetNumber(value);
  const match = normalized.match(/^(\d{1,4})([A-Z]{1,3})(\d{3,4}[A-Z]?)$/);
  return match ? `${match[1]}${match[2]}-${match[3]}` : clean(value).toUpperCase();
}

function rowBands(items, tolerance = .012) {
  const bands = [];
  for (const item of items.slice().sort((a, b) => Number(a.region.y) - Number(b.region.y) || Number(a.region.x) - Number(b.region.x))) {
    const band = bands.find(candidate => Math.abs(candidate.y - Number(item.region.y)) <= tolerance);
    if (band) { band.items.push(item); band.y = Math.min(band.y, Number(item.region.y)); }
    else bands.push({ y: Number(item.region.y), items: [item] });
  }
  return bands;
}

export function parseBedfordTitleBlock(items = []) {
  const source = normalizedItems(items).filter(item => inRegion(item));
  const fields = {};
  const evidence = [];
  for (const label of source) {
    const name = FIELD_NAMES[label.text.replace(/:$/, '').toUpperCase()];
    if (!name) continue;
    if (name === 'drawingNumber') {
      const nearby = source.filter(item => item !== label && !FIELD_NAMES[item.text.replace(/:$/, '').toUpperCase()])
        .filter(item => item.region.y >= label.region.y - .004 && item.region.y <= label.region.y + .065 && item.region.x >= label.region.x - .08 && item.region.x <= label.region.x + .18);
      const reconstructed = rowBands(nearby, .012).map(band => ({ parts: band.items.slice().sort((a, b) => a.region.x - b.region.x), value: normalizeBedfordSheetNumber(band.items.slice().sort((a, b) => a.region.x - b.region.x).map(item => item.text).join('')) })).find(item => SHEET.test(item.value));
      if (reconstructed) {
        const value = formatBedfordSheetNumber(reconstructed.value);
        evidence.push({ field: name, labelRegion: label.region, valueRegion: reconstructed.parts[0].region, value, valid: true, fragments: reconstructed.parts.map(item => item.text) });
        if (!fields[name]) fields[name] = value;
        continue;
      }
    }
    const candidate = source.filter(item => item !== label && !FIELD_NAMES[item.text.replace(/:$/, '').toUpperCase()])
      .filter(item => item.region.y >= label.region.y - .004 && item.region.y <= label.region.y + .065)
      .sort((a, b) => Math.abs(a.region.x - label.region.x) - Math.abs(b.region.x - label.region.x) || a.region.y - b.region.y)[0];
    if (!candidate) continue;
    const value = clean(candidate.text);
    const valid = name === 'drawingNumber' ? SHEET.test(value) : name === 'buildingNumber' ? /^\d{1,5}[A-Z]?$/.test(value) : Boolean(value);
    evidence.push({ field: name, labelRegion: label.region, valueRegion: candidate.region, value, valid });
    if (valid && !fields[name]) fields[name] = value;
  }
  return { ...fields, detected: Boolean(fields.drawingNumber || fields.projectNumber || fields.buildingNumber), sourceRegion: BEDFORD_TITLE_BLOCK_REGION, evidence };
}

export function detectBedfordVaProfile(pages = []) {
  const values = list(pages).flatMap(page => normalizedItems(page.textItems).map(item => item.text));
  const joined = values.join(' | ');
  const titleBlocks = list(pages).map(page => parseBedfordTitleBlock(page.textItems));
  const evidence = {
    projectNumber: /\b518-22-700\b/i.test(joined) || titleBlocks.some(block => block.projectNumber === '518-22-700'),
    bedford: /\bBEDFORD\b/i.test(joined),
    vaForm: /\bVA\s*FORM\s*08-6231\b/i.test(joined),
    tripleC: /\bTRIPLE\s*C\b/i.test(joined),
    indexLayout: /\bDRAWING INDEX\b/i.test(joined) && /\bSHEET (?:NUMBER|NO)\b/i.test(joined) && /\bSHEET (?:NAME|TITLE)\b/i.test(joined),
    labeledTitleBlock: titleBlocks.some(block => block.drawingNumber && block.buildingNumber)
  };
  const score = (evidence.projectNumber ? 3 : 0) + (evidence.bedford ? 2 : 0) + (evidence.vaForm ? 2 : 0) + (evidence.tripleC ? 2 : 0) + (evidence.indexLayout ? 1 : 0) + (evidence.labeledTitleBlock ? 1 : 0);
  return { selected: score >= 3, profileId: score >= 3 ? BEDFORD_VA_PROFILE_ID : '', score, evidence };
}

export function findBedfordDrawingIndexPage(pages = []) {
  return list(pages).find(page => {
    const block = parseBedfordTitleBlock(page.textItems);
    const joined = normalizedItems(page.textItems).map(item => item.text).join(' | ');
    return normalizeBedfordTitle(block.drawingTitle) === 'drawing index' && /G[-.]?001$/i.test(block.drawingNumber || '') && /\bSHEET (?:NUMBER|NO)\b/i.test(joined) && /\bSHEET (?:NAME|TITLE)\b/i.test(joined);
  }) || null;
}

export function parseBedfordDrawingIndex(page = null) {
  if (!page) return [];
  const items = normalizedItems(page.textItems).sort((a, b) => a.region.y - b.region.y || a.region.x - b.region.x);
  const tableItems = items.filter(item => Number(item.region.y) < BEDFORD_TITLE_BLOCK_REGION.y);
  const numberHeaders = tableItems.filter(item => /^SHEET\s+(?:NUMBER|NO)$/i.test(item.text)).sort((a, b) => a.region.x - b.region.x);
  const titleHeaders = tableItems.filter(item => /^SHEET\s+(?:NAME|TITLE)$/i.test(item.text)).sort((a, b) => a.region.x - b.region.x);
  if (!numberHeaders.length || !titleHeaders.length) return [];
  const columns = numberHeaders.map((header, index) => {
    const right = numberHeaders[index + 1]?.region.x ?? 1;
    const titleHeader = titleHeaders.find(item => item.region.x > header.region.x && item.region.x < right);
    return titleHeader ? { numberX: Number(header.region.x), titleX: Number(titleHeader.region.x), right: Number(right), headerY: Math.max(Number(header.region.y), Number(titleHeader.region.y)) } : null;
  }).filter(Boolean);
  const indexBlock = parseBedfordTitleBlock(page.textItems);
  const expectedBuilding = normalizeBedfordSheetNumber(indexBlock.buildingNumber || indexBlock.drawingNumber).match(/^(\d+)/)?.[1] || '';
  const candidates = [];
  for (const [columnIndex, column] of columns.entries()) {
    const numberZone = tableItems.filter(item => item.region.x >= column.numberX - .025 && item.region.x < column.titleX - .004 && item.region.y > column.headerY + .003)
      .filter(item => !DISCIPLINES[item.text.toUpperCase()] && !/^SHEET\s+(?:NUMBER|NO)$/i.test(item.text));
    for (const band of rowBands(numberZone, .006)) {
      const fragments = band.items.slice().sort((a, b) => a.region.x - b.region.x);
      const normalizedSheetNumber = normalizeBedfordSheetNumber(fragments.map(item => item.text).join(''));
      if (!SHEET.test(normalizedSheetNumber) || (expectedBuilding && !normalizedSheetNumber.startsWith(expectedBuilding))) continue;
      candidates.push({ columnIndex, column, y: band.y, fragments, normalizedSheetNumber, sheetNumber: formatBedfordSheetNumber(normalizedSheetNumber), order: Math.min(...fragments.map(item => item.order)) });
    }
  }
  const rows = candidates.map(candidate => {
    const next = candidates.filter(item => item.columnIndex === candidate.columnIndex && item.y > candidate.y + .001).sort((a, b) => a.y - b.y)[0];
    const bottom = Math.min(candidate.y + .028, next ? next.y - .001 : candidate.y + .028);
    const titleItems = tableItems.filter(item => item.region.x >= candidate.column.titleX - .01 && item.region.x < candidate.column.right - .01 && item.region.y >= candidate.y - .002 && item.region.y <= bottom)
      .filter(item => !/^(?:YES|NO|N\/A|INCLUDED|ISSUED)$/i.test(item.text) && !/^SHEET\s+(?:NAME|TITLE|NUMBER|NO)$/i.test(item.text))
      .sort((a, b) => a.region.y - b.region.y || a.region.x - b.region.x);
    const status = tableItems.find(item => item.region.x >= candidate.column.titleX && item.region.x < candidate.column.right && item.region.y >= candidate.y - .002 && item.region.y <= bottom && /^(?:YES|NO|N\/A|INCLUDED|ISSUED)$/i.test(item.text));
    const heading = tableItems.filter(item => DISCIPLINES[item.text.toUpperCase()] && item.region.x >= candidate.column.numberX - .04 && item.region.x < candidate.column.right && item.region.y <= candidate.y).sort((a, b) => b.region.y - a.region.y)[0];
    const sheetTitle = clean(titleItems.map(item => item.text).join(' ')) || 'Title unavailable';
    const left = Math.min(...candidate.fragments.map(item => Number(item.region.x)));
    const right = Math.max(...candidate.fragments.map(item => Number(item.region.x) + Number(item.region.width || 0)), ...titleItems.map(item => Number(item.region.x) + Number(item.region.width || 0)));
    return { buildingNumber: expectedBuilding || candidate.normalizedSheetNumber.match(/^(\d+)/)?.[1] || '', discipline: DISCIPLINES[heading?.text.toUpperCase()] || 'Unknown', sheetNumber: candidate.sheetNumber, normalizedSheetNumber: candidate.normalizedSheetNumber, sheetTitle, normalizedTitle: normalizeBedfordTitle(sheetTitle), includedStatus: status?.text || '', sourcePage: page.pageNumber, sourceRegion: { x: left, y: candidate.y, width: right - left, height: Math.max(...candidate.fragments.map(item => Number(item.region.height || 0)), ...titleItems.map(item => Number(item.region.height || 0)), .001) }, extractionMethod: 'bedford-va-index-profile', sourceOrder: candidate.order };
  }).sort((a, b) => a.sourceOrder - b.sourceOrder || a.sourceRegion.y - b.sourceRegion.y || a.sourceRegion.x - b.sourceRegion.x);
  return rows.filter((row, index, source) => source.findIndex(other => other.normalizedSheetNumber === row.normalizedSheetNumber) === index).map((row, index) => ({ ...row, expectedOrder: index, inventoryOrder: index }));
}
