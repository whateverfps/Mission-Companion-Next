const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
import { isDrawingDocument } from './document-routing.js';

export const normalizeDrawingPageSheetNumber = value => text(value).toUpperCase().replace(/[^A-Z0-9]+/g, '');

function pageNumber(record) {
  const value = Number(record?.pdfPageNumber || record?.pageNumber || record?.pdfPage);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function usableSheetNumber(value) {
  const candidate = text(value);
  return candidate && !/^FX\d+$/i.test(candidate) ? candidate : '';
}

function first(...values) { return values.map(text).find(Boolean) || ''; }

export function buildDrawingPageModel({ documentId = '', documentType = '', drawingSetId = '', projectId = '', pageCount = 0, catalogRecords = [], registryRecords = [], partialSheets = [], storedPageMetadata = [] } = {}) {
  if (documentType && !isDrawingDocument({ documentType })) return [];
  const count = Math.max(0, Math.trunc(Number(pageCount) || 0));
  const byPage = records => new Map(list(records).filter(item => pageNumber(item)).map(item => [pageNumber(item), item]));
  const catalog = byPage(catalogRecords);
  const registry = byPage(registryRecords);
  const partial = byPage(partialSheets);
  const stored = byPage(storedPageMetadata);
  return Array.from({ length: count }, (_, index) => {
    const pdfPageNumber = index + 1;
    const catalogRecord = catalog.get(pdfPageNumber) || {};
    const authoritative = registry.get(pdfPageNumber) || {};
    const analyzed = partial.get(pdfPageNumber) || {};
    const retained = stored.get(pdfPageNumber) || {};
    const sheetNumber = usableSheetNumber(first(catalogRecord.sheetNumber, authoritative.sheetNumber, analyzed.sheetNumber, retained.sheetNumber));
    const normalizedSheetNumber = normalizeDrawingPageSheetNumber(sheetNumber);
    const sheetTitle = first(catalogRecord.sheetTitle, authoritative.sheetTitle, analyzed.sheetTitle, retained.sheetTitle);
    const discipline = first(catalogRecord.discipline, authoritative.discipline, analyzed.discipline, retained.discipline) || 'Unknown';
    const drawingType = first(catalogRecord.drawingType, authoritative.primarySheetType, authoritative.drawingType, list(authoritative.sheetTypes)[0], analyzed.primarySheetType, analyzed.drawingType, list(analyzed.sheetTypes)[0], retained.primarySheetType, retained.drawingType, list(retained.sheetTypes)[0]) || 'Unknown';
    const building = first(catalogRecord.building, authoritative.buildingNumber, authoritative.building, analyzed.building, retained.building);
    const catalogState = text(catalogRecord.identityState);
    const authoritativeIdentity = ['authoritative', 'manual'].includes(catalogState);
    const partialIdentity = Boolean(sheetNumber || sheetTitle || discipline !== 'Unknown' || drawingType !== 'Unknown');
    const identityStatus = authoritativeIdentity ? catalogState : catalogState === 'parser' || partialIdentity ? 'parser' : 'fallback';
    const canonicalPageId = first(catalogRecord.pageId) || (text(documentId) ? `${text(documentId)}:page:${pdfPageNumber}` : '');
    return {
      documentId: text(documentId), drawingSetId: text(drawingSetId), projectId: text(projectId), pdfPageNumber, pdfPageIndex: index,
      pageId: canonicalPageId,
      drawingId: first(catalogRecord.drawingId, authoritative.drawingId, analyzed.drawingId, retained.drawingId),
      sheetId: first(catalogRecord.sheetId, authoritative.sheetId, analyzed.sheetId, retained.sheetId),
      sheetNumber, normalizedSheetNumber, sheetTitle, discipline, drawingType, building, identityStatus,
      searchableText: [sheetNumber, sheetTitle, discipline, drawingType, building && `Building ${building}`, `Page ${pdfPageNumber}`, ...list(analyzed.textItems).map(item => text(item?.text)), ...list(retained.tags)].filter(Boolean).join(' '),
      catalogRecord: Object.keys(catalogRecord).length ? catalogRecord : null,
      authoritativeRecord: authoritativeIdentity ? catalogRecord : null,
      partialRecord: Object.keys(analyzed).length ? analyzed : null,
      storedRecord: Object.keys(retained).length ? retained : null
    };
  });
}

export function drawingPageModelFacets(pages = []) {
  return {
    disciplines: [...new Set(list(pages).map(item => item.discipline || 'Unknown'))].sort(),
    drawingTypes: [...new Set(list(pages).map(item => item.drawingType || 'Unknown'))].sort()
  };
}
