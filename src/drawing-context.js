const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const pageKey = page => `${text(page?.documentId)}:${Number(page?.pdfPageNumber || page?.pageNumber) || 0}`;

const COLLECTIONS = Object.freeze({
  specifications: 'specifications', inspections: 'inspectionItems', rooms: 'rooms', equipment: 'equipment', photos: 'photos',
  documents: 'documents', risks: 'risks', questions: 'questions', relatedDrawings: 'relatedDrawings', issues: 'issues', history: 'history'
});

function baseContext(page = {}) {
  return {
    page: {
      documentId: text(page.documentId), drawingSetId: text(page.drawingSetId), projectId: text(page.projectId), drawingId: text(page.drawingId),
      sheetId: text(page.sheetId), sheetNumber: text(page.sheetNumber), sheetTitle: text(page.sheetTitle), discipline: text(page.discipline) || 'Unknown',
      drawingType: text(page.drawingType || page.primarySheetType || page.sheetTypes?.[0]) || 'Unknown', building: text(page.building),
      pdfPageNumber: Number(page.pdfPageNumber || page.pageNumber) || null, identityStatus: text(page.identityStatus) || 'fallback'
    },
    summary: [], specifications: [], relatedDrawings: [], inspectionItems: [], equipment: [], rooms: [], photos: [], documents: [], risks: [], questions: [], issues: [], history: [],
    providerErrors: []
  };
}

function mergeContext(current, addition = {}) {
  const next = { ...current, page: current.page, providerErrors: [...current.providerErrors] };
  for (const key of ['summary', ...Object.values(COLLECTIONS)]) next[key] = [...list(current[key]), ...list(addition[key])];
  return next;
}

export function createDrawingContextService({ providers = [] } = {}) {
  const links = new Map();
  const contextProviders = [...providers].filter(provider => typeof provider === 'function');
  const add = (page, collection, record) => {
    const key = pageKey(page);
    if (!text(page?.documentId) || !Number(page?.pdfPageNumber || page?.pageNumber) || !record) return false;
    const current = links.get(key) || baseContext(page);
    links.set(key, { ...current, [collection]: [...list(current[collection]), structuredClone(record)] });
    return true;
  };
  return {
    getContext(page = {}) {
      let context = mergeContext(baseContext(page), links.get(pageKey(page)) || {});
      for (const provider of contextProviders) {
        try { context = structuredClone(mergeContext(context, provider(structuredClone(context.page)) || {})); }
        catch (error) { context.providerErrors.push(error?.message || 'Context provider unavailable'); }
      }
      return structuredClone(context);
    },
    registerProvider(provider) { if (typeof provider !== 'function') return false; contextProviders.push(provider); return true; },
    linkSpecification: (page, record) => add(page, COLLECTIONS.specifications, record),
    linkInspection: (page, record) => add(page, COLLECTIONS.inspections, record),
    linkRoom: (page, record) => add(page, COLLECTIONS.rooms, record),
    linkEquipment: (page, record) => add(page, COLLECTIONS.equipment, record),
    linkPhoto: (page, record) => add(page, COLLECTIONS.photos, record),
    linkDocument: (page, record) => add(page, COLLECTIONS.documents, record),
    linkRisk: (page, record) => add(page, COLLECTIONS.risks, record),
    linkQuestion: (page, record) => add(page, COLLECTIONS.questions, record),
    linkRelatedDrawing: (page, record) => add(page, COLLECTIONS.relatedDrawings, record),
    linkIssue: (page, record) => add(page, COLLECTIONS.issues, record),
    linkHistory: (page, record) => add(page, COLLECTIONS.history, record)
  };
}
