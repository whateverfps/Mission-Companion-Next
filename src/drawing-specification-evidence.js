import { collectPageObjectEvidence } from './drawing-object-enrichment.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

function region(value) {
  return value && typeof value === 'object' && Number.isFinite(Number(value.x)) && Number.isFinite(Number(value.y)) && Number.isFinite(Number(value.width)) && Number.isFinite(Number(value.height))
    ? { x: Number(value.x), y: Number(value.y), width: Number(value.width), height: Number(value.height) }
    : null;
}

function pushEvidence(records, candidate) {
  const value = text(candidate?.text || candidate?.value || candidate?.label || candidate?.title || candidate?.name);
  if (!value) return;
  records.push({
    text: value,
    source: text(candidate?.source || 'drawing-evidence'),
    region: region(candidate?.region),
    observationId: text(candidate?.observationId),
    detailNumber: text(candidate?.detailNumber),
    sheetNumber: text(candidate?.sheetNumber),
    pageNumber: Number(candidate?.pageNumber) || null,
    contextText: text(candidate?.contextText || candidate?.note || candidate?.description),
    sourceObjectId: text(candidate?.sourceObjectId),
    sourceRoomId: text(candidate?.sourceRoomId)
  });
}

function objectEvidence(object = {}) {
  const evidence = [];
  for (const item of [
    { text: object.label, source: 'drawing-object-label', region: object.region },
    { text: object.tag, source: 'drawing-object-tag', region: object.region },
    { text: object.type, source: 'drawing-object-type', region: object.region },
    { text: object.subtype, source: 'drawing-object-subtype', region: object.region },
    { text: object.trade, source: 'drawing-object-trade', region: object.region },
    { text: object.system, source: 'drawing-object-system', region: object.region },
    { text: object.roomId, source: 'drawing-object-room', region: object.region },
    { text: object.evidenceText, source: 'drawing-object-evidence', region: object.region }
  ]) pushEvidence(evidence, item);
  for (const alias of list(object.aliases)) pushEvidence(evidence, { text: alias, source: 'drawing-object-alias', region: object.region });
  if (object.relatedScheduleReference) pushEvidence(evidence, { text: object.relatedScheduleReference, source: 'drawing-object-schedule-reference', region: object.region });
  for (const reference of list(object.relatedKeynoteReferences)) pushEvidence(evidence, { text: reference, source: 'drawing-object-keynote-reference', region: object.region });
  for (const reference of list(object.relatedDetailReferences)) pushEvidence(evidence, { text: reference, source: 'drawing-object-detail-reference', region: object.region });
  return evidence;
}

export function collectPageSpecificationEvidence({
  sheet = {},
  observations = [],
  schedules = [],
  legends = [],
  occurrences = [],
  keyedNotes = [],
  activeDrawingObjects = [],
  references = []
} = {}) {
  const evidence = [
    { text: sheet.sheetTitle, source: 'authoritative-sheet-title' },
    { text: sheet.sheetNumber, source: 'authoritative-sheet-number' },
    { text: sheet.discipline, source: 'authoritative-discipline' },
    { text: sheet.primarySheetType || sheet.drawingType, source: 'authoritative-drawing-type' }
  ];
  evidence.push(...collectPageObjectEvidence({ observations, schedules, legends, occurrences, keyedNotes }));
  for (const object of list(activeDrawingObjects)) evidence.push(...objectEvidence(object));
  for (const reference of list(references)) {
    if (!reference) continue;
    pushEvidence(evidence, {
      text: reference.source || `${text(reference.detailNumber)}/${text(reference.sheetNumber)}`,
      source: 'drawing-reference',
      region: reference.region,
      observationId: reference.observationId,
      detailNumber: reference.detailNumber,
      sheetNumber: reference.sheetNumber,
      pageNumber: reference.pageNumber,
      contextText: reference.source
    });
  }
  return [...new Map(evidence.filter(item => text(item.text)).map(item => [`${text(item.source)}:${text(item.text)}:${JSON.stringify(item.region || null)}:${text(item.observationId)}`, item])).values()];
}