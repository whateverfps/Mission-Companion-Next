import { createDrawingTarget } from './drawing-navigation.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const normalized = value => text(value).toLowerCase().replace(/[^a-z0-9-]+/g, ' ').replace(/\s+/g, ' ').trim();
const unique = values => [...new Set(values.filter(Boolean))];

const DISCIPLINES = Object.freeze([
  ['Fire Protection', /\b(?:fire protection|sprinkler)\b/i],
  ['Telecommunications', /\b(?:telecommunications?|telecom|structured cabling)\b/i],
  ['Mechanical', /\b(?:mechanical|hvac)\b/i],
  ['Electrical', /\b(?:electrical|power|lighting)\b/i],
  ['Plumbing', /\bplumbing\b/i], ['Architectural', /\barchitectural\b/i],
  ['Security', /\bsecurity\b/i], ['Interiors', /\binteriors?\b/i], ['General', /\bgeneral\b/i]
]);

const CONSTRUCTION_INTENT_RULES = Object.freeze([
  {
    intent: 'risk',
    matches: /\b(?:why|delay|delayed|risk|concern|blocked|issue|problem)\b/i,
    sourcePriority: ['rfis', 'deficiencies', 'schedule', 'pmis', 'meeting-records']
  },
  {
    intent: 'location',
    matches: /\b(?:where|which rooms?|what rooms?|location|located|room(s)? receive|rooms receive|building|floor|level)\b/i,
    sourcePriority: ['drawings', 'legends', 'schedules', 'room-observations', 'specifications']
  },
  {
    intent: 'scope-of-work',
    matches: /\b(?:scope|work|affects|related work|what work|what is included|involved)\b/i,
    sourcePriority: ['drawings', 'specifications', 'schedules', 'rfis', 'submittals']
  },
  {
    intent: 'means-and-methods',
    matches: /\b(?:how|install|installed|installation|method|methods|detail|details|procedure|procedures)\b/i,
    sourcePriority: ['specifications', 'submittals', 'details', 'drawings']
  },
  {
    intent: 'schedule',
    matches: /\b(?:when|schedule|milestone|rough-in|start|finish|deadline|time)\b/i,
    sourcePriority: ['schedule', 'current-work', 'pmis', 'contractor-updates', 'drawings']
  },
  {
    intent: 'sequence',
    matches: /\b(?:sequence|before|after|order|phasing|prior to|followed by)\b/i,
    sourcePriority: ['schedule', 'sequence-details', 'specifications', 'rfis']
  },
  {
    intent: 'inspection',
    matches: /\b(?:inspection|inspections|inspect|test|testing|witness)\b/i,
    sourcePriority: ['inspection-records', 'specifications', 'rfis', 'drawings']
  },
  {
    intent: 'commissioning',
    matches: /\b(?:commission|commissioning|start-up|startup)\b/i,
    sourcePriority: ['commissioning-records', 'schedule', 'specifications', 'inspections']
  },
  {
    intent: 'equipment',
    matches: /\b(?:equipment|tag|device|unit|fan|pump|panel|rack|ahu|vav|fcu|rtu)\b/i,
    sourcePriority: ['drawings', 'schedules', 'specifications', 'submittals']
  },
  {
    intent: 'room',
    matches: /\b(?:room|room number|room 137|room )\b/i,
    sourcePriority: ['drawings', 'room-observations', 'schedules', 'specifications']
  },
  {
    intent: 'building',
    matches: /\b(?:building|bldg|tower|wing)\b/i,
    sourcePriority: ['drawings', 'legends', 'schedules', 'specifications']
  },
  {
    intent: 'drawing',
    matches: /\b(?:drawing|sheet|plan|elevation|detail|riser|section)\b/i,
    sourcePriority: ['drawings', 'legends', 'schedules']
  },
  {
    intent: 'specification',
    matches: /\b(?:spec|specification|section)\b/i,
    sourcePriority: ['specifications', 'submittals', 'drawings']
  },
  {
    intent: 'rfi',
    matches: /\b(?:rfi|request for information)\b/i,
    sourcePriority: ['rfis', 'schedule', 'drawings', 'deficiencies']
  },
  {
    intent: 'submittal',
    matches: /\b(?:submittal|submittals|shop drawing|approved submittal)\b/i,
    sourcePriority: ['submittals', 'specifications', 'rfis', 'drawings']
  },
  {
    intent: 'deficiency',
    matches: /\b(?:deficiency|punch list|snag|issue|problem)\b/i,
    sourcePriority: ['deficiencies', 'rfis', 'inspections', 'schedule']
  },
  {
    intent: 'existing-condition',
    matches: /\b(?:existing|as-built|existing condition|site condition|field condition)\b/i,
    sourcePriority: ['drawings', 'rfis', 'inspections', 'specifications']
  },
  {
    intent: 'coordination',
    matches: /\b(?:coordination|clash|interface|trade|between trades|interdisciplinary)\b/i,
    sourcePriority: ['rfis', 'drawings', 'submittals', 'schedule']
  }
]);

export function normalizePlanQuery(query = '') { return normalized(query); }

export function classifyConstructionIntent(rawQuery = '') {
  const raw = text(rawQuery).toLowerCase();
  const match = CONSTRUCTION_INTENT_RULES.find(rule => rule.matches.test(raw)) || CONSTRUCTION_INTENT_RULES[0];
  return {
    intent: match.intent,
    sourcePriority: [...match.sourcePriority],
    rationale: `Deterministic routing for ${match.intent.replace(/-/g, ' ')} queries.`
  };
}

export function buildConstructionRoutingProfile(query = '', { documentIds = [], drawingContext = null } = {}) {
  const intent = classifyConstructionIntent(query);
  const normalizedDocumentIds = unique(list(documentIds).map(text).concat(drawingContext?.documentId ? [text(drawingContext.documentId)] : []));
  const answerLayout = intent.intent === 'location' ? 'location'
    : intent.intent === 'means-and-methods' ? 'method'
      : intent.intent === 'schedule' ? 'schedule'
        : intent.intent === 'inspection' ? 'inspection'
          : intent.intent === 'risk' ? 'risk'
            : intent.intent === 'specification' ? 'specification'
              : 'summary';
  return {
    primaryIntent: intent.intent,
    sourcePriority: [...intent.sourcePriority],
    documentIds: normalizedDocumentIds,
    answerLayout,
    rationale: intent.rationale
  };
}

function capture(query, rule) { return text((query.match(rule) || [])[1]); }

export function planQueryConstraints(query = '') {
  const raw = text(query);
  const discipline = DISCIPLINES.find(([, rule]) => rule.test(raw))?.[0] || '';
  const room = capture(raw, /\b(?:room|rm\.?|telecom room)\s*#?([a-z0-9-]{2,12})\b/i).toUpperCase();
  const building = capture(raw, /\b(?:building|bldg\.?|bldg)\s*#?([a-z0-9-]{1,12})\b/i).toUpperCase();
  const floor = capture(raw, /\b((?:basement|ground|first|second|third|fourth|fifth|\d+(?:st|nd|rd|th))\s*(?:floor|level)|basement)\b/i);
  const requestedSheet = capture(raw, /\b((?:\d{1,4})?[a-z]{1,3}[-.]?\d{3,4}[a-z]?)\b/i).toUpperCase();
  const requestedTag = capture(raw, /\b((?:ahu|rtu|vav|fcu|cu|ef|sf|hp|panel|xfmr|ups|rack|pp|facp|faap|tgb|tmgb|ts|cuh|uh)[- ]?\d{1,4}[a-z]?)\b/i).toUpperCase();
  const requestedSpecification = capture(raw, /\b(?:section|spec(?:ification)?)\s*((?:\d{2}\s?){2}\d{2}|\d{6})\b/i);
  const requestedRfi = capture(raw, /\b(RFI[- ]?\d+)\b/i).toUpperCase();
  const requestedSubmittal = capture(raw, /\b(SUB(?:MITTAL)?[- ]?\d+)\b/i).toUpperCase();
  const requestedInspection = capture(raw, /\b(INS[- ]?\d+)\b/i).toUpperCase();
  const typeIntent = /\brack\s+elevation/i.test(raw) ? 'open rack elevation'
    : /\bschedule/i.test(raw) ? 'open schedule'
      : /\bdetail/i.test(raw) ? 'open detail'
        : /\briser/i.test(raw) ? 'open riser'
          : requestedSheet ? 'open sheet'
            : room ? 'find room'
              : requestedTag ? 'find equipment'
                : /\binspect|inspection/i.test(raw) ? 'prepare inspection'
                  : floor ? 'show floor plans'
                    : discipline ? 'show discipline plans'
                      : building ? 'show building plans' : 'summarize supported work';
  return { normalizedQuery: normalized(raw), queryType: typeIntent, building, floor, room, discipline, requestedSheet, requestedTag, requestedSpecification, requestedRfi, requestedSubmittal, requestedInspection };
}

export function createChiefConstructionContext({ conversationId = '', projectId = '', planResult = {}, drawingTarget = null, workPackageReferences = {}, updatedFrom = 'plan-query', limitations = [] } = {}) {
  const target = drawingTarget || planResult.viewerTarget || {};
  return {
    conversationId: text(conversationId), projectId: text(projectId || planResult.projectId),
    building: text(planResult.building), floor: text(planResult.floor), room: text(planResult.room),
    discipline: text(planResult.discipline), trade: text(planResult.discipline),
    drawingDocumentId: text(target.documentId), drawingSetId: text(target.drawingSetId), sheetId: text(target.sheetId),
    pageNumber: Number(target.pageNumber) || null, observationId: text(target.observationId), planObjectId: text(target.planObjectId),
    workPackageReferences: {
      matchingSheetIds: unique(list(workPackageReferences.matchingSheetIds || planResult.matchingSheetIds).map(text)),
      matchingObservationIds: unique(list(workPackageReferences.matchingObservationIds || planResult.matchingObservationIds).map(text))
    },
    updatedFrom: text(updatedFrom), limitations: unique(list(limitations || planResult.limitations).map(text))
  };
}

export function validateChiefConstructionContext(context, { conversationId = '', projectId = '', analyses = [] } = {}) {
  if (!context || (conversationId && context.conversationId !== conversationId) || (projectId && context.projectId !== projectId)) return null;
  const projectAnalyses = list(analyses).filter(item => !projectId || item.projectId === projectId);
  const analysis = projectAnalyses.find(item => item.documentId === context.drawingDocumentId && (!context.drawingSetId || item.drawingSetId === context.drawingSetId)) || null;
  if (!analysis) return { ...context, drawingDocumentId: '', drawingSetId: '', sheetId: '', pageNumber: null, observationId: '', planObjectId: '', workPackageReferences: { matchingSheetIds: [], matchingObservationIds: [] }, limitations: unique([...list(context.limitations), 'The prior drawing source is no longer available.']) };
  const sheet = list(analysis.sheets).find(item => item.sheetId === context.sheetId) || null;
  if (!sheet) return { ...context, drawingDocumentId: analysis.documentId, drawingSetId: analysis.drawingSetId, sheetId: '', pageNumber: null, observationId: '', planObjectId: '', workPackageReferences: { matchingSheetIds: list(context.workPackageReferences?.matchingSheetIds).filter(id => analysis.sheets.some(item => item.sheetId === id)), matchingObservationIds: [] }, limitations: unique([...list(context.limitations), 'The prior sheet selection is no longer available.']) };
  const observation = list(analysis.observations).find(item => item.observationId === context.observationId && item.sheetId === sheet.sheetId) || null;
  return { ...context, drawingDocumentId: analysis.documentId, drawingSetId: analysis.drawingSetId, sheetId: sheet.sheetId, pageNumber: sheet.pageNumber, observationId: observation?.observationId || '', planObjectId: '', workPackageReferences: { matchingSheetIds: list(context.workPackageReferences?.matchingSheetIds).filter(id => analysis.sheets.some(item => item.sheetId === id)), matchingObservationIds: list(context.workPackageReferences?.matchingObservationIds).filter(id => analysis.observations.some(item => item.observationId === id)) }, limitations: observation || !context.observationId ? list(context.limitations) : unique([...list(context.limitations), 'The prior drawing observation is no longer available.']) };
}

function isDeterministicFollowUp(query = '', context = null) {
  const normalizedQuery = text(query).toLowerCase().replace(/[^a-z0-9-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalizedQuery || !context) return false;
  if (/^(?:show me|show me where|show it|open that|open it|where exactly|what schedule|what specification|what inspection|what drawing|what plan|what room|what sheet|what inspections are required|what inspections are next|what inspections apply)\??$/i.test(normalizedQuery)) return true;
  if (/^(?:show me|show it|open that|open it|where exactly|what schedule|what specification|what inspection|what drawing|what plan|what room|what sheet|what inspections are required|what inspections are next|what inspections apply)\b/i.test(normalizedQuery)) return true;
  if (/^(?:what|show|where|open)\b/i.test(normalizedQuery) && normalizedQuery.split(' ').length <= 6) return true;
  return false;
}

export function inheritPlanQueryContext(query = '', context = null) {
  const explicit = planQueryConstraints(query);
  if (!context) return explicit;
  const followUp = isDeterministicFollowUp(query, context);
  if (!followUp) return explicit;
  const sheetFamilyRequest = ['open schedule', 'open detail', 'open riser', 'open rack elevation'].includes(explicit.queryType);
  return {
    ...explicit,
    building: explicit.building || text(context.building),
    room: explicit.room || (sheetFamilyRequest ? '' : text(context.room)),
    discipline: explicit.discipline || text(context.discipline || context.trade),
    floor: explicit.floor || (sheetFamilyRequest ? '' : text(context.floor)),
    inheritedContext: true
  };
}

function searchableSheet(sheet, observations) {
  return normalized([
    sheet.sheetNumber, sheet.sheetTitle, sheet.building ? `Building ${sheet.building}` : '', sheet.discipline, ...list(sheet.sheetTypes),
    ...list(sheet.textItems).map(item => item.text), ...observations.map(item => item.value)
  ].join(' '));
}

function typeRank(sheet, constraints) {
  const types = new Set(list(sheet.sheetTypes));
  if (constraints.requestedSheet && sheet.sheetNumber === constraints.requestedSheet) return 0;
  if (constraints.queryType === 'open schedule' && types.has('Schedule')) return 0;
  if (constraints.queryType === 'open detail' && types.has('Detail')) return 0;
  if (constraints.queryType === 'open riser' && types.has('Riser')) return 0;
  if (constraints.queryType === 'open rack elevation' && /rack/i.test(sheet.sheetTitle) && types.has('Elevation')) return 0;
  if (types.has('Enlarged Plan')) return 2;
  if (types.has('Plan')) return /\b(first|second|third|level|floor|basement|overall)\b/i.test(sheet.sheetTitle) ? 3 : 4;
  if (types.has('Schedule')) return 5;
  if (types.has('Detail')) return 6;
  if (types.has('Diagram')) return 7;
  if (types.has('Riser')) return 8;
  if (types.has('Cut Sheet')) return 9;
  if (types.has('Reference')) return 10;
  return 11;
}

function matchesConstraints(sheet, observations, constraints, freeQuery = '') {
  const haystack = searchableSheet(sheet, observations);
  const exactObservation = value => observations.some(item => normalized(item.value) === normalized(value));
  if (constraints.requestedSheet && normalized(sheet.sheetNumber) !== normalized(constraints.requestedSheet)) return false;
  if (constraints.discipline && sheet.discipline !== constraints.discipline) return false;
  if (constraints.room && !exactObservation(constraints.room) && !haystack.includes(normalized(`room ${constraints.room}`))) return false;
  if (constraints.requestedTag && !exactObservation(constraints.requestedTag)) return false;
  if (constraints.building && !haystack.includes(normalized(`building ${constraints.building}`)) && !haystack.includes(normalized(`bldg ${constraints.building}`))) return false;
  if (constraints.floor && !haystack.includes(normalized(constraints.floor))) return false;
  if (constraints.queryType === 'open schedule' && !list(sheet.sheetTypes).includes('Schedule') && !/schedule/i.test(sheet.sheetTitle)) return false;
  if (constraints.queryType === 'open detail' && !list(sheet.sheetTypes).includes('Detail')) return false;
  if (constraints.queryType === 'open riser' && !list(sheet.sheetTypes).includes('Riser')) return false;
  if (constraints.queryType === 'open rack elevation' && !/rack/i.test(haystack)) return false;
  if (freeQuery && !haystack.includes(normalized(freeQuery))) return false;
  return true;
}

function searchMatch(sheet, observations, needle) {
  if (!needle) return { rank: 9, reason: '', observation: null };
  const sheetNumber = normalized(sheet.sheetNumber);
  if (sheetNumber === needle) return { rank: 0, reason: 'Matched exact sheet number', observation: null };
  if (sheetNumber.startsWith(needle) || sheetNumber.includes(needle)) return { rank: 1, reason: 'Matched partial sheet number', observation: null };
  if (normalized(sheet.sheetTitle).includes(needle)) return { rank: 2, reason: 'Matched sheet title', observation: null };
  if (normalized(sheet.discipline).includes(needle)) return { rank: 3, reason: 'Matched discipline', observation: null };
  if (list(sheet.sheetTypes).some(type => normalized(type).includes(needle))) return { rank: 4, reason: 'Matched sheet type', observation: null };
  const observation = observations.find(item => normalized(item.value) === needle || normalized(item.value).includes(needle));
  if (observation) return {
    rank: observation.kind === 'room-number-text' || observation.kind === 'room-name-text' ? 5 : observation.kind === 'equipment-tag-text' ? 6 : observation.kind === 'callout-text' ? 7 : 8,
    reason: observation.kind === 'room-number-text' || observation.kind === 'room-name-text' ? `Matched Room ${observation.value}` : observation.kind === 'equipment-tag-text' ? `Matched Equipment Tag ${observation.value}` : observation.kind === 'callout-text' ? `Matched Callout ${observation.value}` : 'Matched drawing observation',
    observation
  };
  const textItem = list(sheet.textItems).find(item => normalized(item.text).includes(needle));
  return textItem ? { rank: 8, reason: /schedule/i.test(textItem.text) ? 'Matched Schedule' : /detail/i.test(textItem.text) ? 'Matched Detail' : /riser/i.test(textItem.text) ? 'Matched Riser' : /rack/i.test(textItem.text) ? 'Matched Rack' : /note/i.test(textItem.text) ? 'Matched Notes' : 'Matched Drawing Text', observation: null } : null;
}

export function searchDrawingSheets({ query = '', discipline = 'all', sheetType = 'all', analysis, sheets, observations } = {}) {
  const sourceSheets = list(sheets || analysis?.sheets);
  const sourceObservations = list(observations || analysis?.observations);
  const needle = normalized(query);
  const results = sourceSheets.flatMap(sheet => {
    if (discipline !== 'all' && sheet.discipline !== discipline) return [];
    if (sheetType !== 'all' && !list(sheet.sheetTypes).includes(sheetType)) return [];
    const sheetObservations = sourceObservations.filter(item => item.sheetId === sheet.sheetId);
    const match = searchMatch(sheet, sheetObservations, needle);
    if (!match) return [];
    return [{ sheetId: sheet.sheetId, documentId: sheet.documentId, pageNumber: sheet.pageNumber, observationId: match.observation?.observationId || '', region: match.observation?.region || null, rank: match.rank, matchedReason: match.reason, primarySheetType: sheet.primarySheetType || list(sheet.sheetTypes)[0] || 'Unknown', sheet }];
  });
  return results.sort((a, b) => a.rank - b.rank || a.sheet.pageNumber - b.sheet.pageNumber || a.sheetId.localeCompare(b.sheetId));
}

export function drawingSearchSummary(query, count) {
  const cleaned = text(query);
  return cleaned ? `${count} result${count === 1 ? '' : 's'} for “${cleaned}”` : `${count} sheet${count === 1 ? '' : 's'} in this drawing set`;
}

export function buildPlanQuery({ query = '', projectId = '', analyses = [], context = null } = {}) {
  const constraints = inheritPlanQueryContext(query, context);
  const constructionIntent = classifyConstructionIntent(query);
  const candidates = [];
  for (const analysis of list(analyses).filter(item => !projectId || item.projectId === projectId)) {
    for (const sheet of list(analysis.sheets)) {
      const observations = list(analysis.observations).filter(item => item.sheetId === sheet.sheetId);
      if (!matchesConstraints(sheet, observations, constraints)) continue;
      const exactObservation = observations.find(item => (constraints.room && normalized(item.value) === normalized(constraints.room)) || (constraints.requestedTag && normalized(item.value) === normalized(constraints.requestedTag))) || null;
      candidates.push({ analysis, sheet, observations, exactObservation, rank: typeRank(sheet, constraints) });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank || a.sheet.pageNumber - b.sheet.pageNumber || a.sheet.sheetId.localeCompare(b.sheet.sheetId));
  const first = candidates[0] || null;
  const ambiguous = Boolean(first && constraints.inheritedContext && candidates.length > 1 && candidates[1].rank === first.rank && ['open schedule', 'open detail', 'open riser'].includes(constraints.queryType));
  const viewerTarget = first ? createDrawingTarget({ projectId: first.analysis.projectId, documentId: first.analysis.documentId, drawingSetId: first.analysis.drawingSetId, drawingId: first.sheet.drawingId, sheetId: first.sheet.sheetId, pageNumber: first.sheet.pageNumber, sheetNumber: first.sheet.sheetNumber, observationId: first.exactObservation?.observationId, region: first.exactObservation?.region, origin: 'plan-query' }) : null;
  const actions = candidates.map(({ analysis, sheet, exactObservation }) => ({
    action: exactObservation ? 'show-location' : 'open-sheet',
    label: exactObservation ? `Show ${exactObservation.value} on ${sheet.sheetNumber || `page ${sheet.pageNumber}`}` : `Open Sheet ${sheet.sheetNumber || `Page ${sheet.pageNumber}`}`,
    target: createDrawingTarget({ projectId: analysis.projectId, documentId: analysis.documentId, drawingSetId: analysis.drawingSetId, drawingId: sheet.drawingId, sheetId: sheet.sheetId, pageNumber: sheet.pageNumber, sheetNumber: sheet.sheetNumber, observationId: exactObservation?.observationId, region: exactObservation?.region, origin: 'plan-query' })
  }));
  const supportedWorkItems = candidates.map(({ sheet, exactObservation }) => ({ sheetId: sheet.sheetId, basis: exactObservation ? 'Plan text' : sheet.sheetTypes.includes('Schedule') ? 'Schedule entry' : 'Drawing index', observationId: exactObservation?.observationId || '', statement: exactObservation ? `${sheet.discipline} sheet containing exact ${exactObservation.kind.replace(/-text$/, '')} ${exactObservation.value}.` : `${sheet.discipline} ${sheet.sheetTypes.join(' / ').toLowerCase()} sheet ${sheet.sheetNumber || `page ${sheet.pageNumber}`}.` }));
  const routingProfile = buildConstructionRoutingProfile(query, {
    documentIds: unique(candidates.map(item => item.analysis.documentId)),
    drawingContext: viewerTarget ? { documentId: viewerTarget.documentId, sheetId: viewerTarget.sheetId, pageNumber: viewerTarget.pageNumber } : null
  });
  return {
    ...constraints, projectId: text(projectId), matchingSheetIds: candidates.map(item => item.sheet.sheetId),
    matchingObservationIds: unique(candidates.map(item => item.exactObservation?.observationId)), exactReferences: [],
    supportedWorkItems, limitations: [
      'Graphical association has not been verified.',
      'This result does not establish room boundaries, symbol meaning, routing, quantities, clashes, or code compliance.'
    ], viewerTarget: ambiguous ? null : viewerTarget, actions,
    ambiguous, choices: ambiguous ? actions.filter((_, index) => candidates[index]?.rank === first.rank) : [],
    constructionIntent,
    sourcePriority: constructionIntent.sourcePriority,
    routingProfile,
    documentIds: routingProfile.documentIds,
    answerLayout: routingProfile.answerLayout
  };
}

export function planQuerySectionScope(planResult, sections = [], analyses = []) {
  if (!planResult?.viewerTarget) return { documentIds: [], pageNumbers: [], sheetIds: [], sectionIds: [] };
  const pageBySheet = new Map(list(analyses).flatMap(analysis => list(analysis.sheets).map(sheet => [sheet.sheetId, sheet.pageNumber])));
  const pages = unique(list(planResult.matchingSheetIds).map(sheetId => pageBySheet.get(sheetId)).filter(Boolean));
  const matchingSections = list(sections).filter(section => section.documentId === planResult.viewerTarget.documentId && (!pages.length || pages.some(page => Number(section.pageStart || section.metadata?.pageRange?.start || 0) <= page && Number(section.pageEnd || section.metadata?.pageRange?.end || section.pageStart || 0) >= page)));
  return { documentIds: [planResult.viewerTarget.documentId], pageNumbers: pages, sheetIds: list(planResult.matchingSheetIds), sectionIds: matchingSections.map(section => section.id) };
}

export function buildPlanQueryScope(planResult = {}, sections = [], analyses = []) {
  const baseScope = planQuerySectionScope(planResult, sections, analyses);
  const routingDocumentIds = unique(list(planResult?.routingProfile?.documentIds).map(text));
  const documentIds = unique([...routingDocumentIds, ...baseScope.documentIds]);
  return {
    ...baseScope,
    documentIds,
    pageNumbers: baseScope.pageNumbers,
    sheetIds: baseScope.sheetIds,
    sectionIds: baseScope.sectionIds
  };
}
