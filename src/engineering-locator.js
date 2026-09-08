import { createDrawingTarget } from './drawing-navigation.js';
import { createActionTarget, normalizeActionTargetPayload } from './source-navigation.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const normalize = value => text(value).toLowerCase();
const list = value => Array.isArray(value) ? value : [];

export const normalizeRegisteredSheetNumber = value => text(value).toUpperCase().replace(/^\s*(?:SHEET|DRAWING)\s+/i, '').replace(/[^A-Z0-9]+/g, '');

const DISCIPLINE_TERMS = Object.freeze([
  ['Mechanical', /\b(?:mechanical|hvac)\b/i], ['Electrical', /\belectrical\b/i],
  ['Telecommunications', /\b(?:telecommunications?|telecom)\b/i], ['Fire Protection', /\bfire protection\b/i],
  ['Plumbing', /\bplumbing\b/i], ['Architectural', /\barchitectural\b/i]
]);

export function classifyEngineeringNavigationIntent(query = '') {
  const raw = text(query);
  const command = /^(?:open|take\s+me\s+to|go\s+to|navigate\s+to|show(?:\s+me)?|display)\b/i.test(raw);
  if (!command) return { kind: 'knowledge-question', exact: false, value: '', discipline: '' };
  const specification = raw.match(/\b(?:specification|spec|section)\s+([0-9]{2}\s*[0-9]{2}\s*[0-9]{2})\b/i);
  if (specification) return { kind: 'exact-specification-navigation', exact: true, value: normalizeSectionNumber(specification[1]), discipline: '' };
  const sheet = raw.match(/\b(?:sheet|drawing|plan)\s+((?:\d{1,4}\s*)?[A-Z]{1,3}\s*-?\s*\d{3,4}[A-Z]?)\b/i)
    || raw.match(/\b((?:\d{1,4}\s*)?[A-Z]{1,3}\s*-\s*\d{3,4}[A-Z]?)\b/i);
  if (!sheet) return { kind: 'knowledge-question', exact: false, value: '', discipline: '' };
  return { kind: 'exact-drawing-navigation', exact: true, value: normalizeRegisteredSheetNumber(sheet[1]), discipline: DISCIPLINE_TERMS.find(([, pattern]) => pattern.test(raw))?.[0] || '' };
}

function normalizeSectionNumber(value) {
  return text(value).replace(/[^0-9A-Za-z]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function inferRoomCandidates(analyses = []) {
  const candidates = [];
  for (const analysis of list(analyses)) {
    for (const observation of list(analysis.observations)) {
      if (observation.kind === 'room-number-text' || observation.kind === 'room-name-text') {
        candidates.push({
          analysis,
          observation,
          kind: observation.kind === 'room-number-text' ? 'room' : 'named-room',
          label: text(observation.value)
        });
      }
    }
  }
  return candidates;
}

function inferEquipmentCandidates(analyses = []) {
  const candidates = [];
  for (const analysis of list(analyses)) {
    for (const observation of list(analysis.observations)) {
      if (observation.kind === 'equipment-tag-text') {
        candidates.push({
          analysis,
          observation,
          kind: 'equipment',
          label: text(observation.value)
        });
      }
    }
  }
  return candidates;
}

function inferSheetCandidates(analyses = []) {
  const candidates = [];
  for (const analysis of list(analyses)) {
    for (const sheet of list(analysis.sheets)) {
      candidates.push({ analysis, sheet, kind: 'sheet', label: text(sheet.sheetNumber) || text(sheet.sheetTitle) || `Sheet ${text(sheet.pageNumber)}` });
    }
  }
  return candidates;
}

function inferSpecCandidates(sections = []) {
  return list(sections).map(section => ({
    section,
    kind: 'spec-section',
    label: text(section.number) || text(section.title) || text(section.id)
  }));
}

export function buildChiefLocationPresentation(question = '', options = {}) {
  const normalizedQuestion = typeof question === 'string' ? question : question?.content || '';
  const resolvedOptions = typeof question === 'string' ? options : (options || {});
  const { analyses = [], documents = [], sections = [], returnTarget = '', projectId = '' } = resolvedOptions;
  const result = resolveEngineeringLocation(normalizedQuestion, { analyses, documents, sections, returnTarget, projectId });
  if (result.status === 'resolved') {
    const summary = result.kind === 'spec-section'
      ? `Resolved ${result.label} as a specification section.`
      : `Located ${result.label} in the project drawings.`;
    return {
      status: 'resolved',
      mode: result.kind === 'spec-section' ? 'specification' : 'drawing',
      title: 'Location resolved',
      summary,
      detail: result.kind === 'spec-section'
        ? 'Open the exact specification section in the project library.'
        : 'Open the exact drawing target and review the matched location.',
      actionLabel: result.kind === 'spec-section' ? 'Open Specification' : 'Open in Drawings',
      actionTarget: result.target,
      candidates: result.candidates,
      target: result.target
    };
  }
  if (result.status === 'ambiguous') {
    return {
      status: 'ambiguous',
      mode: 'ambiguous',
      title: 'Multiple locations match',
      summary: `Multiple possible locations match ${result.label || 'your request'}.`,
      detail: 'Choose the exact match you want to open from the options below.',
      actionLabel: 'Choose a matching location',
      actionTarget: null,
      candidates: result.candidates,
      target: null
    };
  }
  return {
    status: 'none',
    mode: 'none',
    title: 'No location matched',
    summary: 'No exact location could be resolved from that question.',
    detail: 'Try a room number, room name, equipment tag, sheet, or specification section.',
    actionLabel: 'Try a room, sheet, or section',
    actionTarget: null,
    candidates: [],
    target: null
  };
}

export async function navigateExactDrawingCommand(query = '', options = {}, openDrawing = async () => {}) {
  const navigationIntent = classifyEngineeringNavigationIntent(query);
  if (navigationIntent.kind !== 'exact-drawing-navigation') return { attempted: false, handled: false, navigationIntent, presentation: null };
  const presentation = buildChiefLocationPresentation(query, options);
  if (presentation.status !== 'resolved' || presentation.target?.kind !== 'drawing') {
    return { attempted: true, handled: false, navigationIntent, presentation };
  }
  await openDrawing(presentation.target);
  return { attempted: true, handled: true, navigationIntent, presentation };
}

export function resolveEngineeringLocation(query = '', {
  analyses = [],
  documents = [],
  sections = [],
  returnTarget = '',
  projectId = ''
} = {}) {
  const rawQuery = text(query);
  const normalizedQuery = normalize(rawQuery);

  if (!rawQuery) return { status: 'none', kind: 'none', target: null, label: '', candidates: [] };

  const navigationIntent = classifyEngineeringNavigationIntent(rawQuery);
  if (navigationIntent.kind === 'exact-drawing-navigation') {
    let exactMatches = inferSheetCandidates(analyses).filter(candidate => normalizeRegisteredSheetNumber(candidate.sheet?.sheetNumber) === navigationIntent.value);
    if (projectId && projectId !== 'general') exactMatches = exactMatches.filter(candidate => text(candidate.analysis?.projectId) === text(projectId));
    if (navigationIntent.discipline) exactMatches = exactMatches.filter(candidate => text(candidate.sheet?.discipline) === navigationIntent.discipline);
    exactMatches = [...new Map(exactMatches.map(candidate => [text(candidate.sheet?.drawingId) || `${candidate.analysis?.documentId}:${candidate.sheet?.pageNumber}`, candidate])).values()];
    if (exactMatches.length) return buildDrawingResolution({ query: rawQuery, resolved: exactMatches[0], candidates: exactMatches, kind: 'sheet', label: exactMatches[0].label, returnTarget, documents, analyses, navigationIntent });
    return { status: 'none', kind: 'sheet', target: null, label: navigationIntent.value, candidates: [], navigationIntent };
  }

  if (navigationIntent.kind === 'exact-specification-navigation') {
    const exactMatches = inferSpecCandidates(sections).filter(candidate => normalizeSectionNumber(candidate.section?.number || candidate.section?.title || '') === navigationIntent.value);
    if (exactMatches.length) return { ...buildSpecResolution({ resolved: exactMatches[0], candidates: exactMatches, returnTarget }), navigationIntent };
    return { status: 'none', kind: 'spec-section', target: null, label: navigationIntent.value, candidates: [], navigationIntent };
  }

  const roomQuery = rawQuery.match(/\broom\s+([a-z0-9-]+)\b/i);
  const explicitDiscipline = DISCIPLINE_TERMS.find(([, pattern]) => pattern.test(rawQuery))?.[0] || '';
  const namedRoomQuery = rawQuery.match(/\b(?:show|open|find|go to|where is)\s+(?:the\s+)?([a-z][a-z0-9\s&/-]{1,40})\b/i);
  const equipmentQuery = rawQuery.match(/(?:show|display|locate|find|identify|where is)\s+(?:the\s+)?([a-z0-9._/-]+)\b/i)?.[1];
  const sheetQuery = rawQuery.match(/\bsheet\s+([a-z0-9.-]+)\b/i);
  const specQuery = rawQuery.match(/\b(?:section|specification|spec)\s+([0-9a-z]+(?:\s+[0-9a-z]+){0,3})\b/i);

  const roomCandidates = inferRoomCandidates(analyses).filter(candidate => {
    const token = roomQuery ? normalize(roomQuery[1]) : '';
    const sheet = list(candidate.analysis?.sheets).find(item => item.sheetId === candidate.observation?.sheetId);
    return (!roomQuery || normalize(candidate.label) === token || normalize(candidate.label).includes(token)) && (!explicitDiscipline || sheet?.discipline === explicitDiscipline);
  });

  if (roomQuery && roomCandidates.length) {
    const exactMatches = roomCandidates.filter(candidate => normalize(candidate.label) === normalize(roomQuery[1]));
    const resolved = exactMatches.length ? exactMatches[0] : roomCandidates[0];
    const candidates = exactMatches.length ? exactMatches : roomCandidates;
    return buildDrawingResolution({
      query: rawQuery,
      resolved,
      candidates,
      kind: resolved.kind,
      label: resolved.label,
      returnTarget,
      documents,
      analyses
    });
  }

  if (namedRoomQuery) {
    const roomName = namedRoomQuery[1].trim();
    const exactMatches = inferRoomCandidates(analyses).filter(candidate => candidate.kind === 'named-room' && normalize(candidate.label) === normalize(roomName));
    if (exactMatches.length) {
      return buildDrawingResolution({
        query: rawQuery,
        resolved: exactMatches[0],
        candidates: exactMatches,
        kind: 'named-room',
        label: exactMatches[0].label,
        returnTarget,
        documents,
        analyses
      });
    }
  }

  if (equipmentQuery) {
    const token = normalize(equipmentQuery);
    const exactMatches = inferEquipmentCandidates(analyses).filter(candidate => normalize(candidate.label) === token);
    if (exactMatches.length) {
      const resolved = exactMatches[0];
      return buildDrawingResolution({
        query: rawQuery,
        resolved,
        candidates: exactMatches,
        kind: 'equipment',
        label: resolved.label,
        returnTarget,
        documents,
        analyses
      });
    }
  }

  if (sheetQuery) {
    const exactMatches = inferSheetCandidates(analyses).filter(candidate => normalize(candidate.label) === normalize(sheetQuery[1]));
    if (exactMatches.length) {
      const resolved = exactMatches[0];
      return buildDrawingResolution({
        query: rawQuery,
        resolved,
        candidates: exactMatches,
        kind: 'sheet',
        label: resolved.label,
        returnTarget,
        documents,
        analyses
      });
    }
  }

  if (specQuery) {
    const token = normalizeSectionNumber(specQuery[1]);
    const exactMatches = inferSpecCandidates(sections).filter(candidate => normalizeSectionNumber(candidate.section?.number || candidate.section?.title || '') === token);
    if (exactMatches.length) {
      const resolved = exactMatches[0];
      return buildSpecResolution({ resolved, candidates: exactMatches, returnTarget });
    }
  }

  if (normalizedQuery.includes('room') && !roomQuery) {
    return { status: 'none', kind: 'none', target: null, label: '', candidates: [] };
  }

  if (roomCandidates.length) {
    return { status: 'ambiguous', kind: 'room', target: null, label: roomQuery ? roomQuery[1] : '', candidates: roomCandidates.map(item => ({ label: item.label, kind: item.kind })) };
  }

  if (inferEquipmentCandidates(analyses).length) {
    return { status: 'ambiguous', kind: 'equipment', target: null, label: '', candidates: inferEquipmentCandidates(analyses).map(item => ({ label: item.label, kind: item.kind })) };
  }

  return { status: 'none', kind: 'none', target: null, label: '', candidates: [] };
}

function buildDrawingResolution({ resolved, candidates, kind, label, returnTarget, documents, navigationIntent = null }) {
  const analysis = resolved.analysis;
  const observation = resolved.observation;
  const sheet = resolved.sheet || (analysis?.sheets || []).find(item => text(item.sheetId) === text(observation?.sheetId)) || null;
  const document = documents.find(item => text(item.id) === text(analysis?.documentId)) || null;
  const target = { kind: 'drawing', ...createDrawingTarget({
    projectId: analysis?.projectId,
    documentId: analysis?.documentId,
    drawingSetId: analysis?.drawingSetId,
    drawingId: sheet?.drawingId || '',
    sheetId: observation?.sheetId || sheet?.sheetId || '',
    pageNumber: sheet?.pageNumber || null,
    sheetNumber: sheet?.sheetNumber || '',
    observationId: observation?.observationId || '',
    region: observation?.region || null,
    origin: 'engineering-locator',
    returnTarget: text(returnTarget)
  }) };

  return {
    status: candidates.length > 1 ? 'ambiguous' : 'resolved',
    kind,
    label,
    target,
    document,
    sheet,
    observation,
    navigationIntent,
    candidates: candidates.map(item => ({ label: candidates.length > 1 ? `${item.label} — ${item.analysis?.projectId || 'project unavailable'}` : item.label, kind: item.kind, projectId: item.analysis?.projectId || '', drawingId: item.sheet?.drawingId || '', sheetNumber: item.sheet?.sheetNumber || '', sheetTitle: item.sheet?.sheetTitle || '', discipline: item.sheet?.discipline || '' }))
  };
}

function buildSpecResolution({ resolved, candidates, returnTarget }) {
  const section = resolved.section;
  const sourceTarget = createActionTarget({
    projectId: section?.projectId || '',
    libraryId: '',
    documentId: section?.documentId || '',
    sectionId: section?.id || '',
    destination: 'knowledge',
    origin: 'engineering-locator',
    returnTarget: text(returnTarget)
  });

  return {
    status: candidates.length > 1 ? 'ambiguous' : 'resolved',
    kind: 'spec-section',
    label: text(section?.number || section?.title || section?.id),
    target: sourceTarget,
    section,
    candidates: candidates.map(item => ({ label: item.label, kind: item.kind }))
  };
}
