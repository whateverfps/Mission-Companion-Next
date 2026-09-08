import { BUILDING_61_DRAWING_CATALOG, BUILDING_62_DRAWING_CATALOG } from './building-61-drawing-catalog.js';
import { BUILDING_MCR_DRAWING_CATALOG } from './building-MCR-drawing-catalog.js';

const catalogs = [BUILDING_61_DRAWING_CATALOG, BUILDING_62_DRAWING_CATALOG, BUILDING_MCR_DRAWING_CATALOG];
const text = value => String(value ?? '').trim();

export function buildDrawingsModel({ catalogs: sourceCatalogs = catalogs } = {}) {
  const records = sourceCatalogs.flatMap(catalog => Array.isArray(catalog) ? catalog : []).map(sheet => ({ ...sheet, sheetNumber: text(sheet.sheetNumber), title: text(sheet.sheetTitle || sheet.title), sourcePage: sheet.pageNumber || sheet.pdfPageNumber || null }));
  return { records, disciplines: [...new Set(records.map(item => item.discipline).filter(Boolean))].sort() };
}

export async function loadDrawingSpecificationRelationships({ basePath = 'project-data/bedford/relationships' } = {}) {
  const files = ['building-61-spec-links.json', 'building-62-spec-links.json', 'building-MCR-spec-links.json'];
  const results = await Promise.all(files.map(async file => { try { const response = await fetch(`${basePath}/${file}`); return response.ok ? response.json() : {}; } catch { return {}; } }));
  return results.flatMap(value => Object.entries(value || {}).flatMap(([sheetNumber, item]) => (Array.isArray(item?.links) ? item.links : []).map(link => ({ ...link, sheetNumber }))));
}

export function relationshipsForDrawing(relationships = [], sheetNumber = '') { return relationships.filter(item => text(item.sheetNumber).toUpperCase() === text(sheetNumber).toUpperCase()); }
