const text = value => String(value ?? '').trim();

export const DOCUMENT_ROLES = Object.freeze(['drawing-set', 'specifications', 'addendum', 'amendment', 'RFI', 'submittal', 'inspection', 'report', 'photo-collection', 'other']);
const aliases = new Map([
  ['drawings', 'drawing-set'], ['drawing', 'drawing-set'], ['drawing-set', 'drawing-set'],
  ['specification', 'specifications'], ['specifications', 'specifications'], ['specs', 'specifications'],
  ['addenda', 'addendum'], ['addendum', 'addendum'], ['amendment', 'amendment'], ['rfi', 'RFI'], ['submittal', 'submittal'],
  ['inspection', 'inspection'], ['inspections', 'inspection'], ['report', 'report'], ['reports', 'report'], ['photos', 'photo-collection'], ['photo-collection', 'photo-collection'], ['other', 'other']
]);

const normalizedExplicitRole = value => aliases.get(text(value).toLowerCase()) || '';

export function classifyDocumentRole(document = {}) {
  const explicit = normalizedExplicitRole(document.documentType);
  if (explicit) return { documentType: explicit, method: 'persisted-explicit' };
  const category = normalizedExplicitRole(document.importDestination || document.category);
  if (category) return { documentType: category, method: 'import-category' };
  const identity = `${document.title || ''} ${document.name || ''} ${document.sourceIdentity || ''}`.toLowerCase();
  if (/specifications?|project manual|division\s+00|\.spec(?:ifications)?\./i.test(identity)) return { documentType: 'specifications', method: 'authoritative-profile' };
  if (/(?:^|[.\s_-])ifc(?:[.\s_-])b(?:ldg)?\d+|drawing\s+(?:set|package)|(?:^|[.\s_-])plans?(?:[.\s_-]|$)/i.test(identity)) return { documentType: 'drawing-set', method: 'authoritative-profile' };
  if (/\baddendum\b/i.test(identity)) return { documentType: 'addendum', method: 'safe-content' };
  if (/\bamendment\b/i.test(identity)) return { documentType: 'amendment', method: 'safe-content' };
  if (/\brfi\b/i.test(identity)) return { documentType: 'RFI', method: 'safe-content' };
  if (/\bsubmittal\b/i.test(identity)) return { documentType: 'submittal', method: 'safe-content' };
  if (/\binspection\b/i.test(identity)) return { documentType: 'inspection', method: 'safe-content' };
  if (/\breport\b/i.test(identity)) return { documentType: 'report', method: 'safe-content' };
  return { documentType: 'other', method: 'safe-default' };
}

export function documentRoute(document = {}) {
  const classification = classifyDocumentRole(document); const role = classification.documentType;
  const drawing = role === 'drawing-set'; const specifications = role === 'specifications';
  return {
    ...classification,
    permittedWorkspaces: drawing ? ['drawings', 'drawing-inspector'] : specifications ? ['knowledge', 'specification-index', 'source-evidence'] : ['knowledge'],
    permittedViewers: drawing ? ['drawing-viewer'] : specifications ? ['source-evidence-viewer'] : [],
    indexingService: drawing ? 'drawing-analysis' : specifications ? 'specification-index' : 'knowledge-index'
  };
}

export const isDrawingDocument = document => classifyDocumentRole(document).documentType === 'drawing-set';
export const isSpecificationDocument = document => classifyDocumentRole(document).documentType === 'specifications';
export const canOpenInDrawingWorkspace = document => documentRoute(document).permittedWorkspaces.includes('drawings');

export function persistDocumentClassification(document = {}, explicitType = '') {
  const role = normalizedExplicitRole(explicitType) || classifyDocumentRole(document).documentType;
  return { ...document, documentType: role, documentClassificationMethod: normalizedExplicitRole(explicitType) ? 'manual' : classifyDocumentRole(document).method };
}

export function documentIndexCounts(document = {}, sections = []) {
  const owned = sections.filter(item => item.documentId === document.id);
  const trueSections = owned.filter(item => item.hierarchyType === 'spec-section' && text(item.sectionNumber).replace(/\D/g, '').length === 6);
  return { sourcePageCount: Number(document.pageCount) || 0, retrievalChunkCount: Number(document.retrievalChunkCount) || owned.length, specificationSectionCount: Number(document.specificationSectionCount) || trueSections.length };
}
