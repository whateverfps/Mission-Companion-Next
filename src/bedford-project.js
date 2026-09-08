import { BEDFORD_NTP_SOURCE_DOCUMENT } from './workspace-milestones.js';

export const BEDFORD_PROJECT_ID = 'bedford';
export const BEDFORD_PROJECT_NAME = 'Bedford Veterans Affairs Hospital';
export const BEDFORD_DRAWING_DOCUMENT_ID = 'bedford-b61-drawings';
export const BEDFORD_DRAWING_DOCUMENT_ID_B62 = 'bedford-b62-drawings';
export const BEDFORD_DRAWING_DOCUMENT_ID_MCR = 'bedford-mcr-drawings';
export const BEDFORD_SPEC_DOCUMENT_ID = 'bedford-specifications';

export const BEDFORD_DRAWING_SETS = Object.freeze([
  Object.freeze({
    buildingId: '61',
    buildingName: 'Building 61',
    documentId: BEDFORD_DRAWING_DOCUMENT_ID,
    drawingSetId: 'bedford-b61',
    sourceFileName: '518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
    catalogPath: 'project-data/bedford/drawing-catalogs/building-61.json',
    relationshipsPath: 'project-data/bedford/relationships/building-61-spec-links.json'
  }),
  Object.freeze({
    buildingId: '62',
    buildingName: 'Building 62',
    documentId: BEDFORD_DRAWING_DOCUMENT_ID_B62,
    drawingSetId: 'bedford-b62',
    sourceFileName: '518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf',
    catalogPath: 'project-data/bedford/drawing-catalogs/building-62.json',
    relationshipsPath: 'project-data/bedford/relationships/building-62-spec-links.json'
  }),
  Object.freeze({
    buildingId: 'MCR',
    buildingName: 'New Main Computer Room Building',
    documentId: BEDFORD_DRAWING_DOCUMENT_ID_MCR,
    drawingSetId: 'bedford-mcr',
    sourceFileName: '518-22-700.Bedford.EHRM.IFC.MCR.20260316.pdf',
    catalogPath: 'project-data/bedford/drawing-catalogs/building-MCR.json',
    relationshipsPath: 'project-data/bedford/relationships/building-MCR-spec-links.json'
  })
]);

export function getBedfordDrawingSetByBuildingId(buildingId = '') {
  const needle = String(buildingId || '').trim();
  return BEDFORD_DRAWING_SETS.find(set => set.buildingId === needle) || null;
}

export function getBedfordDrawingSetByDocumentId(documentId = '') {
  const needle = String(documentId || '').trim();
  return BEDFORD_DRAWING_SETS.find(set => set.documentId === needle) || null;
}

function normalizeBedfordBuildingId(value = '') {
  const needle = String(value || '').trim().toUpperCase();
  const match = needle.match(/^B(\d{2})$/);
  return match ? match[1] : needle;
}

export function getBedfordDrawingSetForReference(reference = {}) {
  const documentId = String(reference?.documentId || reference?.drawingDocumentId || reference?.sourceDocumentId || '').trim();
  if (documentId) return getBedfordDrawingSetByDocumentId(documentId);
  const pageId = String(reference?.pageId || reference?.drawingPageId || reference?.sourcePageId || '').trim();
  const pageBuilding = normalizeBedfordBuildingId(
    pageId.match(/drawing-page:bedford-([a-z0-9-]+)-drawings:/i)?.[1]
    || pageId.match(/\.Bedford\.EHRM\.IFC\.([A-Z0-9-]+)\./i)?.[1]
    || pageId.match(/\b([A-Z]+|\d{2})\b/i)?.[1]
    || ''
  );
  const sheetNumber = String(reference?.sheetNumber || reference?.sheetId || '').trim().toUpperCase();
  const sheetBuilding = normalizeBedfordBuildingId(sheetNumber.match(/^([A-Z]+|\d{2})/)?.[1] || '');
  return getBedfordDrawingSetByBuildingId(pageBuilding || sheetBuilding) || null;
}

const dates = Object.freeze({ importedAt: '2026-01-06T14:00:00.000Z', indexedAt: '2026-01-06T14:05:00.000Z', lastModified: '2026-01-05T17:00:00.000Z' });

const fixture = {
  manifest: { version: 'bedford-1', project: {
    id: BEDFORD_PROJECT_ID, name: BEDFORD_PROJECT_NAME, canonicalName: 'Bedford Veterans Affairs Hospital',
    projectType: 'Healthcare facility renovation', description: 'Bedford VA Hospital renovation project including Buildings 61, 62, the New Main Computer Room building, and associated specifications.',
    isBuiltIn: true, demonstrationLabel: 'Built-in Product Data', dataLabel: 'Shipped with Mission Companion', fixtureVersion: 1,
    buildingId: '61', buildingName: 'Building 61', createdAt: '2026-01-05T13:00:00.000Z', updatedAt: '2026-01-05T17:00:00.000Z'
  } },
  libraries: [
    { id: 'bedford-lib-main', projectId: BEDFORD_PROJECT_ID, name: 'Bedford Main Library', description: 'Primary knowledge library for Bedford project', enabled: true, createdAt: dates.importedAt }
  ],
  documents: [
    {
      id: BEDFORD_DRAWING_DOCUMENT_ID,
      projectId: BEDFORD_PROJECT_ID,
      libraryId: 'bedford-lib-main',
      name: '518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
      originalFilename: '518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
      extension: 'pdf',
      mimeType: 'application/pdf',
      category: 'Drawings',
      type: 'drawing',
      tags: ['Drawings', 'drawing'],
      status: 'verified',
      sectionCount: 0,
      parser: 'built-in bundle',
      hierarchyVersion: 'mc-hierarchy-v2',
      ...dates,
      builtIn: true,
      staticPath: 'project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
      role: 'drawing',
      documentType: 'drawing'
    },
    {
      id: BEDFORD_DRAWING_DOCUMENT_ID_B62,
      projectId: BEDFORD_PROJECT_ID,
      libraryId: 'bedford-lib-main',
      name: '518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf',
      originalFilename: '518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf',
      extension: 'pdf',
      mimeType: 'application/pdf',
      category: 'Drawings',
      type: 'drawing',
      tags: ['Drawings', 'drawing'],
      status: 'verified',
      sectionCount: 0,
      parser: 'built-in bundle',
      hierarchyVersion: 'mc-hierarchy-v2',
      ...dates,
      builtIn: true,
      staticPath: 'project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf',
      role: 'drawing',
      documentType: 'drawing'
    },
    {
      id: BEDFORD_DRAWING_DOCUMENT_ID_MCR,
      projectId: BEDFORD_PROJECT_ID,
      libraryId: 'bedford-lib-main',
      name: '518-22-700.Bedford.EHRM.IFC.MCR.20260316.pdf',
      originalFilename: '518-22-700.Bedford.EHRM.IFC.MCR.20260316.pdf',
      extension: 'pdf',
      mimeType: 'application/pdf',
      category: 'Drawings',
      type: 'drawing',
      tags: ['Drawings', 'drawing'],
      status: 'verified',
      sectionCount: 0,
      parser: 'built-in bundle',
      hierarchyVersion: 'mc-hierarchy-v2',
      ...dates,
      builtIn: true,
      staticPath: 'project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.MCR.20260316.pdf',
      role: 'drawing',
      documentType: 'drawing'
    },
    {
      id: BEDFORD_SPEC_DOCUMENT_ID,
      projectId: BEDFORD_PROJECT_ID,
      libraryId: 'bedford-lib-main',
      name: '518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf',
      originalFilename: '518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf',
      extension: 'pdf',
      mimeType: 'application/pdf',
      category: 'Specifications',
      type: 'specification',
      tags: ['Specifications', 'specification'],
      status: 'verified',
      sectionCount: 0,
      parser: 'built-in bundle',
      hierarchyVersion: 'mc-hierarchy-v2',
      ...dates,
      builtIn: true,
      staticPath: 'project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf',
      role: 'specification',
      documentType: 'specification'
    }
    ,
    {
      ...BEDFORD_NTP_SOURCE_DOCUMENT,
      projectId: BEDFORD_PROJECT_ID,
      libraryId: 'bedford-lib-main',
      category: 'Contractual',
      tags: ['Bedford', 'Notice to Proceed', 'Contract', 'Milestone'],
      status: 'verified',
      parser: 'built-in bundle',
      hierarchyVersion: 'mc-hierarchy-v2',
      builtIn: true,
      role: 'report',
      documentType: 'report'
    }
  ],
  sections: [],
  inspectionRecords: [],
  evaluations: []
};

function deepFreeze(value) {
  Object.freeze(value);
  Object.values(value).forEach(item => item && typeof item === 'object' && !Object.isFrozen(item) && deepFreeze(item));
  return value;
}

export const BEDFORD_PROJECT = deepFreeze(fixture);

export function validateBedfordProject(value = BEDFORD_PROJECT) {
  const errors = [];
  const project = value?.manifest?.project;
  const docs = Array.isArray(value?.documents) ? value.documents : [];
  const documentIds = new Set(docs.map(doc => String(doc?.id || '').trim()));
  
  if (!project) errors.push('Missing project manifest');
  if (project?.id !== BEDFORD_PROJECT_ID) errors.push('Project ID mismatch');
  if (!documentIds.has(BEDFORD_DRAWING_DOCUMENT_ID)) errors.push('Missing Building 61 drawing document');
  if (!documentIds.has(BEDFORD_DRAWING_DOCUMENT_ID_B62)) errors.push('Missing Building 62 drawing document');
  if (!documentIds.has(BEDFORD_DRAWING_DOCUMENT_ID_MCR)) errors.push('Missing MCR drawing document');
  if (!documentIds.has(BEDFORD_SPEC_DOCUMENT_ID)) errors.push('Missing Bedford specification document');
  if (!documentIds.has(BEDFORD_NTP_SOURCE_DOCUMENT.id)) errors.push('Missing Bedford Notice to Proceed document');
  
  return { valid: errors.length === 0, errors };
}
