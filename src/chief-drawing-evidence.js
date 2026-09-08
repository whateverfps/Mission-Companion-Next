function text(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeRegion(region) {
  return region && typeof region === 'object' ? {
    x: Number(region.x) || 0,
    y: Number(region.y) || 0,
    width: Number(region.width) || 0,
    height: Number(region.height) || 0
  } : null;
}

export function buildChiefDrawingEvidence(message = {}, { documents = [], analyses = [] } = {}) {
  const drawingContext = message?.drawingContext || null;
  if (!message || message.role !== 'assistant' || !drawingContext?.documentId) return null;

  const document = documents.find(item => text(item?.id) === text(drawingContext.documentId)) || null;
  const analysis = analyses.find(item => text(item?.documentId) === text(drawingContext.documentId) && (!drawingContext?.drawingSetId || text(item?.drawingSetId) === text(drawingContext.drawingSetId))) || null;
  if (!analysis) return null;

  let sheet = null;
  let ambiguousTarget = false;

  if (drawingContext.sheetId) {
    sheet = analysis.sheets?.find(item => text(item?.sheetId) === text(drawingContext.sheetId)) || null;
  } else if (drawingContext.observationId) {
    const observation = analysis.observations?.find(item => text(item?.observationId) === text(drawingContext.observationId)) || null;
    sheet = observation?.sheetId ? analysis.sheets?.find(item => text(item?.sheetId) === text(observation.sheetId)) || null : null;
  } else if (drawingContext.pageNumber != null) {
    const matches = analysis.sheets?.filter(item => Number(item?.pageNumber) === Number(drawingContext.pageNumber)) || [];
    if (matches.length !== 1) {
      ambiguousTarget = matches.length > 1;
    } else {
      sheet = matches[0] || null;
    }
  }

  if (!sheet || ambiguousTarget) return null;

  const observation = drawingContext.observationId
    ? analysis.observations?.find(item => text(item?.observationId) === text(drawingContext.observationId) && (!sheet || text(item?.sheetId) === text(sheet.sheetId))) || null
    : null;
  if (drawingContext.observationId && !observation) return null;

  const displayReason = observation ? 'Exact drawing evidence selected from the active plan context.' : 'Exact drawing evidence selected from the active plan context.';
  return {
    kind: 'drawing-evidence',
    documentId: text(drawingContext.documentId),
    drawingSetId: text(analysis.drawingSetId || drawingContext.drawingSetId),
    sheetId: text(sheet.sheetId),
    sheetNumber: text(sheet.sheetNumber),
    sheetTitle: text(sheet.sheetTitle),
    pageNumber: Number(sheet.pageNumber) || Number(drawingContext.pageNumber) || null,
    discipline: text(sheet.discipline),
    sheetType: text(sheet.primarySheetType || sheet.sheetTypes?.[0]),
    observationId: text(observation?.observationId || drawingContext.observationId || ''),
    reason: displayReason,
    confidence: Number(sheet.confidence) || null,
    region: normalizeRegion(observation?.region || drawingContext.region || null),
    title: text(document?.title || document?.name || document?.id),
    documentTitle: text(document?.title || document?.name || document?.id)
  };
}
