import { normalizeRegion } from './pdf-source.js';
import { buildDrawingPageModel } from './drawing-page-model.js';
import { isDrawingDocument } from './document-routing.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const safe = value => [...text(value)].map(character => /^[a-zA-Z0-9_-]$/.test(character) ? character : `_${character.codePointAt(0).toString(16)}_`).join('') || 'unavailable';

export function drawingAnchorId(kind, identifier) {
  return `mc-drawing-${safe(kind).toLowerCase()}-${safe(identifier)}`;
}

export function createDrawingTarget({ projectId, documentId, drawingSetId, pageId, drawingId, sheetId, pageNumber, sheetNumber, observationId, planObjectId, region, origin = 'drawings', matchingSheetIds = [], returnTarget = '' } = {}) {
  if (!text(documentId)) return null;
  const page = Number.isInteger(Number(pageNumber)) && Number(pageNumber) > 0 ? Number(pageNumber) : null;
  const normalizedMatchingSheetIds = Array.isArray(matchingSheetIds) ? matchingSheetIds.map(item => text(item)).filter(Boolean) : [];
  return {
    projectId: text(projectId), documentId: text(documentId), drawingSetId: text(drawingSetId), pageId: text(pageId), drawingId: text(drawingId),
    sheetId: text(sheetId), pageNumber: page, sheetNumber: text(sheetNumber),
    observationId: text(observationId), planObjectId: text(planObjectId), region: region ? normalizeRegion(region) : null, origin: text(origin),
    matchingSheetIds: normalizedMatchingSheetIds, returnTarget: text(returnTarget)
  };
}

export function resolveDrawingPageNavigation(target = {}, pages = [], currentPageNumber = null) {
  const pageId = text(target.pageId);
  const normalizedSheetNumber = text(target.normalizedSheetNumber || target.sheetNumber).toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const drawingId = text(target.drawingId);
  const requestedPage = Number(target.pdfPageNumber || target.pageNumber);
  const page = pageId
    ? pages.find(item => text(item.pageId) === pageId)
    : drawingId
      ? pages.find(item => text(item.drawingId) === drawingId)
    : normalizedSheetNumber
      ? pages.find(item => text(item.normalizedSheetNumber || item.sheetNumber).toUpperCase().replace(/[^A-Z0-9]+/g, '') === normalizedSheetNumber)
      : Number.isInteger(requestedPage) && requestedPage > 0
        ? pages.find(item => Number(item.pdfPageNumber || item.pageNumber) === requestedPage)
        : null;
  return page
    ? { resolved: true, pageNumber: Number(page.pdfPageNumber || page.pageNumber), page, reason: pageId ? 'page-id' : drawingId ? 'drawing-id' : normalizedSheetNumber ? 'sheet-number' : 'pdf-page' }
    : { resolved: false, pageNumber: Number(currentPageNumber) || null, page: null, reason: 'unresolved' };
}

export function assertDrawingPageConsistency({ selectedPage, renderedPage, targetPage, toolbarPage, activePage } = {}) {
  const values = [selectedPage, renderedPage, targetPage, toolbarPage, activePage].map(Number).filter(Number.isFinite);
  if (values.length && values.some(value => value !== values[0])) throw new Error(`Drawing page state disagreement: ${values.join(' / ')}`);
  return true;
}

export function createPdfPageViewerAnalysis({ documentId, documentType = '', projectId, pageCount, selectedPage = 1, pageWidth = 1, pageHeight = 1, rotation = 0, metadataAnalysis = null, catalogRecords = [] } = {}) {
  const count = Math.max(0, Math.trunc(Number(pageCount) || 0));
  const activePage = Math.max(1, Math.min(count || 1, Math.trunc(Number(selectedPage) || 1)));
  const drawingSetId = text(metadataAnalysis?.drawingSetId) || `pdf-viewer-${safe(documentId)}`;
  const pages = buildDrawingPageModel({ documentId, documentType, projectId, drawingSetId, pageCount: count, catalogRecords, registryRecords: metadataAnalysis?.drawingRegistry, partialSheets: metadataAnalysis?.sheets, storedPageMetadata: metadataAnalysis?.pageMetadata });
  const sheets = pages.map(page => {
    const partial = page.partialRecord || {};
    const registered = page.authoritativeRecord || {};
    const sheetTypes = [...new Set([page.drawingType, ...(registered.sheetTypes || []), ...(partial.sheetTypes || [])].map(text).filter(Boolean))];
    return {
      ...partial, ...registered, viewerFallback: true, metadataAvailable: page.identityStatus !== 'fallback',
      pageId: page.pageId, sheetId: page.sheetId || `${drawingSetId}-page-${page.pdfPageNumber}`, drawingId: page.drawingId, documentId: text(documentId), projectId: text(projectId), drawingSetId,
      sheetNumber: page.sheetNumber, normalizedSheetNumber: page.normalizedSheetNumber, sheetTitle: page.sheetTitle, normalizedTitle: page.sheetTitle.toLowerCase(), discipline: page.discipline,
      primarySheetType: page.drawingType, sheetTypes: sheetTypes.length ? sheetTypes : ['Unknown'], building: page.building, pageNumber: page.pdfPageNumber, pdfPage: page.pdfPageNumber,
      pageWidth: page.pdfPageNumber === activePage ? Number(pageWidth) || Number(partial.pageWidth) || 1 : Number(partial.pageWidth) || 1,
      pageHeight: page.pdfPageNumber === activePage ? Number(pageHeight) || Number(partial.pageHeight) || 1 : Number(partial.pageHeight) || 1,
      rotation: page.pdfPageNumber === activePage ? Number(rotation) || Number(partial.rotation) || 0 : Number(partial.rotation) || 0,
      identityStatus: page.identityStatus === 'authoritative' ? 'Authoritative' : page.identityStatus === 'manual' ? 'Manual' : page.identityStatus === 'parser' ? 'Parser' : 'Unavailable',
      confidence: Number(registered.confidence ?? partial.confidence) || 0, warnings: [...(partial.warnings || []), ...(registered.warnings || [])],
      textItems: [...(partial.textItems || []), { text: page.searchableText, region: null }]
    };
  });
  return {
    viewerFallback: true, metadataAvailable: sheets.some(sheet => sheet.metadataAvailable), documentId: text(documentId), projectId: text(projectId), drawingSetId, sheets,
    drawingRegistry: [...(metadataAnalysis?.drawingRegistry || [])], observations: [...(metadataAnalysis?.observations || [])], legends: [...(metadataAnalysis?.legends || [])],
    schedules: [...(metadataAnalysis?.schedules || [])], keyedNoteOccurrences: [...(metadataAnalysis?.keyedNoteOccurrences || [])], candidateOccurrences: [...(metadataAnalysis?.candidateOccurrences || [])],
    warnings: [...(metadataAnalysis?.warnings || [])]
  };
}

export function resolveDrawingTarget(target, { documents = [], analyses = [] } = {}) {
  if (!target?.documentId) return { status: 'none', document: null, analysis: null, sheet: null, observation: null, planObject: null, region: null, kind: 'none' };
  const document = documents.find(item => text(item?.id) === target.documentId) || null;
  if (!document) return { status: 'missing-document', document: null, analysis: null, sheet: null, observation: null, planObject: null, region: null, kind: 'missing-document' };
  if (!isDrawingDocument(document)) return { status: 'invalid-document-role', document, analysis: null, sheet: null, observation: null, planObject: null, region: null, kind: 'invalid-document-role' };
  const analysis = analyses.find(item => text(item?.documentId) === target.documentId && (!target.drawingSetId || text(item.drawingSetId) === target.drawingSetId)) || null;
  if (!analysis) return { status: 'missing-analysis', document, analysis: null, sheet: null, observation: null, planObject: null, region: null, kind: 'missing-analysis' };
  const sheet = target.drawingId
    ? analysis.sheets.find(item => text(item.drawingId) === target.drawingId) || null
    : target.sheetId
      ? analysis.sheets.find(item => text(item.sheetId) === target.sheetId) || null
    : target.pageNumber
      ? analysis.sheets.find(item => Number(item.pageNumber) === target.pageNumber) || null
      : null;
  if ((target.drawingId || target.sheetId || target.pageNumber) && !sheet) return { status: 'missing-page', document, analysis, sheet: null, observation: null, planObject: null, region: null, kind: 'missing-page' };
  const observation = target.observationId
    ? analysis.observations.find(item => text(item.observationId) === target.observationId && (!sheet || item.sheetId === sheet.sheetId)) || null
    : null;
  if (target.observationId && !observation) return { status: 'missing-observation', document, analysis, sheet, observation: null, planObject: null, region: null, kind: 'missing-observation' };
  const planObject = target.planObjectId
    ? analysis.candidateOccurrences?.find(item => text(item.occurrenceId) === target.planObjectId && (!sheet || item.sheetId === sheet.sheetId)) || null
    : null;
  if (target.planObjectId && !planObject) return { status: 'missing-plan-object', document, analysis, sheet, observation, planObject: null, region: null, kind: 'missing-plan-object' };
  const resolvedRegion = planObject?.region || observation?.region || target.region || null;
  const kind = planObject ? 'plan-object' : observation ? 'observation' : resolvedRegion ? 'region' : sheet ? 'sheet' : 'document';
  return { status: kind === 'sheet' ? 'sheet' : kind === 'document' ? 'document' : 'region', document, analysis, sheet, observation, planObject, region: resolvedRegion, kind };
}

export function drawingScrollOptions(reducedMotion = false) {
  return { behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' };
}

export function drawingReturnTarget(target, destination) {
  if (!target?.documentId || !['mission-control', 'professional-workspace', 'source'].includes(destination)) return null;
  return { ...target, destination };
}

export function drawingReturnAction(returnTarget = '') {
  const value = text(returnTarget || '').toLowerCase();
  if (['chief-answer', 'chiefanswer', 'chief', 'answer'].includes(value)) return { kind: 'chief-answer', label: 'Return to Chief Answer' };
  if (['work-package', 'workpackage', 'work package', 'package'].includes(value)) return { kind: 'work-package', label: 'Return to Work Package' };
  if (['room-package', 'room', 'room-package'].includes(value)) return { kind: 'room-package', label: 'Return to Room Package' };
  if (['equipment-package', 'equipment', 'equipment-package'].includes(value)) return { kind: 'equipment-package', label: 'Return to Equipment Package' };
  return { kind: value || 'mission-control', label: value ? `Return to ${returnTarget}` : 'Return to Mission Control' };
}

export function drawingFocusTarget(target = {}) {
  if (target.observation || target.planObject || target.region) return 'mc-drawing-selected-evidence';
  if (target.sheet) return 'mc-drawing-sheet-title';
  return 'mc-drawing-header';
}

export function drawingAnnouncementText({ sheet = {}, observation = {}, planObject = null, region = null } = {}) {
  const resolvedSheet = sheet || {};
  const sheetLabel = [resolvedSheet.sheetNumber, resolvedSheet.sheetTitle].filter(Boolean).join(' — ') || 'No drawing selected';
  const evidenceLabel = observation?.value || (planObject ? 'Selected plan object' : region ? 'Selected region' : '');
  return evidenceLabel ? `${sheetLabel}. ${evidenceLabel}` : sheetLabel;
}

export function reconcileDrawingMatchingSheetIds({ target = null, analysis = null, previousMatchingSheetIds = [] } = {}) {
  const ordered = [...new Set((Array.isArray(target?.matchingSheetIds) ? target.matchingSheetIds : []).map(text).filter(Boolean))];
  const validIds = ordered.filter(id => (analysis?.sheets || []).some(sheet => text(sheet.sheetId) === id));
  const currentSheetId = text(target?.sheetId);
  const preserved = validIds.length ? validIds : (Array.isArray(previousMatchingSheetIds) ? previousMatchingSheetIds.filter(id => (analysis?.sheets || []).some(sheet => text(sheet.sheetId) === id)) : []);
  const nextIds = preserved.length ? preserved : [];
  if (currentSheetId && (analysis?.sheets || []).some(sheet => text(sheet.sheetId) === currentSheetId) && !nextIds.includes(currentSheetId)) {
    nextIds.push(currentSheetId);
  }
  return {
    matchingSheetIds: nextIds,
    activeSheetId: nextIds.includes(currentSheetId) ? currentSheetId : (nextIds[0] || ''),
    activeIndex: nextIds.indexOf(currentSheetId)
  };
}

export function drawingMatchingSetTarget(sheetIds = [], currentSheetId = '', offset = 0, analysis = null) {
  const ordered = [...new Set((Array.isArray(sheetIds) ? sheetIds : []).map(text).filter(Boolean))];
  const current = ordered.indexOf(text(currentSheetId));
  const nextId = ordered[current + Number(offset)];
  const sheet = analysis?.sheets?.find(item => text(item.sheetId) === nextId);
  return sheet ? createDrawingTarget({ projectId: analysis.projectId, documentId: analysis.documentId, drawingSetId: analysis.drawingSetId, drawingId: sheet.drawingId, sheetId: sheet.sheetId, pageNumber: sheet.pageNumber, sheetNumber: sheet.sheetNumber }) : null;
}

export function reconcileDrawingSelection(sheetIds = [], currentSheetId = '') {
  const ordered = [...new Set((Array.isArray(sheetIds) ? sheetIds : []).map(text).filter(Boolean))];
  if (!ordered.length) return { sheetId: '', index: -1, preserved: false };
  const index = ordered.indexOf(text(currentSheetId));
  return index >= 0 ? { sheetId: ordered[index], index, preserved: true } : { sheetId: ordered[0], index: 0, preserved: false };
}

export function drawingResultKeyTarget(key, { sheetIds = [], activeIndex = -1 } = {}) {
  const count = Array.isArray(sheetIds) ? sheetIds.length : 0;
  if (!count) return { index: -1, activate: false, clear: key === 'Escape' };
  if (key === 'ArrowDown') return { index: Math.min(count - 1, activeIndex < 0 ? 0 : activeIndex + 1), activate: false, clear: false };
  if (key === 'ArrowUp') return { index: Math.max(0, activeIndex < 0 ? count - 1 : activeIndex - 1), activate: false, clear: false };
  if (key === 'Home') return { index: 0, activate: false, clear: false };
  if (key === 'End') return { index: count - 1, activate: false, clear: false };
  if (key === 'PageDown') return { index: Math.min(count - 1, Math.max(0, activeIndex) + 8), activate: false, clear: false };
  if (key === 'PageUp') return { index: Math.max(0, (activeIndex < 0 ? count - 1 : activeIndex) - 8), activate: false, clear: false };
  if (key === 'Enter') return { index: activeIndex < 0 ? 0 : activeIndex, activate: true, clear: false };
  return { index: activeIndex, activate: false, clear: key === 'Escape' };
}

export function calculateDrawingFit({ containerWidth, containerHeight, pageWidth, pageHeight, rotation = 0, padding = 24, toolbarHeight = 0, mode = 'fit-page' } = {}) {
  const width = Number(containerWidth) - Number(padding) * 2;
  const height = Number(containerHeight) - Number(padding) * 2 - Number(toolbarHeight);
  if (!(width > 0 && height > 0 && Number(pageWidth) > 0 && Number(pageHeight) > 0)) return { ready: false, mode, scale: null };
  const rotated = Math.abs(Number(rotation)) % 180 === 90;
  const sourceWidth = rotated ? Number(pageHeight) : Number(pageWidth);
  const sourceHeight = rotated ? Number(pageWidth) : Number(pageHeight);
  const widthScale = width / sourceWidth;
  const heightScale = height / sourceHeight;
  return { ready: true, mode, scale: Math.max(.1, Math.min(6, mode === 'fit-width' ? widthScale : Math.min(widthScale, heightScale))), widthScale, heightScale };
}

export function defaultDrawingViewport(overlays = {}) {
  return { mode: 'fit-page', zoom: null, rotation: 0, scrollLeft: 0, scrollTop: 0, selectedObservationId: '', highlightedRegion: null, overlays: { rooms: true, confirmed: true, candidates: false, equipment: true, keyedNotes: true, callouts: true, scheduleLinks: true, warnings: true, ...overlays } };
}

export function drawingViewportKey(drawingSetId, sheetId) { return `${text(drawingSetId)}:${text(sheetId)}`; }

export function saveDrawingViewport(viewports = {}, drawingSetId, sheetId, viewport = {}) {
  const key = drawingViewportKey(drawingSetId, sheetId);
  if (!text(drawingSetId) || !text(sheetId)) return { ...viewports };
  return { ...viewports, [key]: { ...defaultDrawingViewport(), ...structuredClone(viewport), overlays: { ...defaultDrawingViewport().overlays, ...(viewport.overlays || {}) } } };
}

export function restoreDrawingViewport(viewports = {}, drawingSetId, sheetId) {
  return structuredClone(viewports[drawingViewportKey(drawingSetId, sheetId)] || defaultDrawingViewport());
}

export function drawingWheelZoom({
  deltaY = 0,
  ctrlKey = false,
  metaKey = false,
  zoom = 1,
  scrollLeft = 0,
  scrollTop = 0,
  pointerX = 0,
  pointerY = 0,
  minZoom = .25,
  maxZoom = 8,
  sensitivity = .002
} = {}) {
  const recognized = Boolean(ctrlKey || metaKey);
  const currentZoom = Math.max(Number(minZoom), Math.min(Number(maxZoom), Number(zoom) || 1));
  if (!recognized) return { recognized: false, preventDefault: false, zoom: currentZoom, scrollLeft: Number(scrollLeft) || 0, scrollTop: Number(scrollTop) || 0 };
  const nextZoom = Math.max(Number(minZoom), Math.min(Number(maxZoom), currentZoom * Math.exp(-(Number(deltaY) || 0) * Number(sensitivity))));
  const x = Number(pointerX) || 0;
  const y = Number(pointerY) || 0;
  const drawingX = ((Number(scrollLeft) || 0) + x) / currentZoom;
  const drawingY = ((Number(scrollTop) || 0) + y) / currentZoom;
  return {
    recognized: true,
    preventDefault: true,
    zoom: nextZoom,
    scrollLeft: Math.max(0, drawingX * nextZoom - x),
    scrollTop: Math.max(0, drawingY * nextZoom - y)
  };
}

export function drawingWorkspaceLayout(layout = {}, action = '') {
  const current = { finderHidden: Boolean(layout.finderHidden), evidenceHidden: Boolean(layout.evidenceHidden), expanded: Boolean(layout.expanded) };
  if (action === 'expand') return { finderHidden: true, evidenceHidden: true, expanded: true };
  if (action === 'restore') return { finderHidden: false, evidenceHidden: false, expanded: false };
  if (action === 'toggle-finder') return { ...current, finderHidden: !current.finderHidden, expanded: false };
  if (action === 'toggle-evidence') return { ...current, evidenceHidden: !current.evidenceHidden, expanded: false };
  return current;
}

export function createDrawingRenderIdentity({ documentId, drawingSetId, pageNumber, scale, rotation = 0, sourceAvailable = true, generation = 0 } = {}) {
  const numericScale = Number(scale);
  return {
    documentId: text(documentId),
    drawingSetId: text(drawingSetId),
    pageNumber: Number.isInteger(Number(pageNumber)) && Number(pageNumber) > 0 ? Number(pageNumber) : null,
    scale: Number.isFinite(numericScale) ? Math.round(numericScale * 10000) / 10000 : null,
    rotation: ((Number(rotation) || 0) % 360 + 360) % 360,
    sourceAvailable: Boolean(sourceAvailable),
    generation: Number(generation) || 0
  };
}

export function sameDrawingRenderIdentity(left, right) {
  if (!left || !right) return false;
  return ['documentId', 'drawingSetId', 'pageNumber', 'scale', 'rotation', 'sourceAvailable', 'generation']
    .every(key => left[key] === right[key]);
}

export function drawingCanvasIsActive(canvas, identity) {
  if (!canvas?.isConnected || !identity?.documentId || !identity.pageNumber || !identity.sourceAvailable) return false;
  return canvas.dataset.drawingDocument === identity.documentId &&
    canvas.dataset.drawingSet === identity.drawingSetId &&
    Number(canvas.dataset.drawingPage) === identity.pageNumber;
}

export function drawingRenderDecision({ previousIdentity, nextIdentity, canvas, fittedScaleChanged = false } = {}) {
  if (!drawingCanvasIsActive(canvas, previousIdentity)) return { repaint: true, reason: 'canvas-unavailable' };
  if (fittedScaleChanged) return { repaint: true, reason: 'fitted-scale-changed' };
  if (!sameDrawingRenderIdentity(previousIdentity, nextIdentity)) return { repaint: true, reason: 'render-input-changed' };
  return { repaint: false, reason: 'unchanged-render-inputs' };
}

export function drawingRenderRequestIsCurrent({ requestId, activeRequestId, requestedPage, activePage, canvasConnected = true } = {}) {
  return Boolean(canvasConnected) && Number(requestId) === Number(activeRequestId) && Number(requestedPage) === Number(activePage);
}
