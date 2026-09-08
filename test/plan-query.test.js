import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConstructionRoutingProfile, buildPlanQuery, buildPlanQueryScope, classifyConstructionIntent, createChiefConstructionContext, drawingSearchSummary, inheritPlanQueryContext, normalizePlanQuery, planQueryConstraints, planQuerySectionScope, searchDrawingSheets, validateChiefConstructionContext } from '../src/plan-query.js';
import { drawingResultKeyTarget, reconcileDrawingSelection } from '../src/drawing-navigation.js';
import { buildConstructionWorkPackage } from '../src/work-package.js';

const observation = (id, sheetId, kind, value) => ({ observationId: id, sheetId, kind, value, region: { x: .2, y: .2, width: .1, height: .02 } });
const sheets = [
  { sheetId: 'detail', documentId: 'd1', pageNumber: 4, sheetNumber: '61M-501', sheetTitle: 'MECHANICAL DETAILS BUILDING 61', discipline: 'Mechanical', sheetTypes: ['Detail'], textItems: [] },
  { sheetId: 'schedule', documentId: 'd1', pageNumber: 3, sheetNumber: '61M-701', sheetTitle: 'MECHANICAL SCHEDULES BUILDING 61', discipline: 'Mechanical', sheetTypes: ['Schedule'], textItems: [] },
  { sheetId: 'plan2', documentId: 'd1', pageNumber: 2, sheetNumber: '61M-102', sheetTitle: 'SECOND LEVEL MECHANICAL PLAN BUILDING 61', discipline: 'Mechanical', sheetTypes: ['Plan'], textItems: [] },
  { sheetId: 'plan1', documentId: 'd1', pageNumber: 1, sheetNumber: '61M-101', sheetTitle: 'FIRST FLOOR MECHANICAL PLAN BUILDING 61', discipline: 'Mechanical', sheetTypes: ['Plan'], textItems: [] },
  { sheetId: 'rack', documentId: 'd1', pageNumber: 5, sheetNumber: '61T-604', sheetTitle: 'TELECOM RACK ELEVATIONS BUILDING 61', discipline: 'Telecommunications', sheetTypes: ['Elevation'], textItems: [] }
];
const observations = [observation('room137', 'plan1', 'room-number-text', '137'), observation('vav12', 'plan1', 'equipment-tag-text', 'VAV-12'), observation('rack137', 'rack', 'room-number-text', '137')];
const analysis = { drawingSetId: 'set1', documentId: 'd1', projectId: 'p1', sheets, observations };

test('normalizes plan text and extracts exact supported constraints', () => {
  assert.equal(normalizePlanQuery('  HVAC   in Building 61 '), 'hvac in building 61');
  assert.deepEqual({ ...planQueryConstraints('Show HVAC in Room 137, Building 61'), normalizedQuery: undefined }, { queryType: 'find room', building: '61', floor: '', room: '137', discipline: 'Mechanical', requestedSheet: '', requestedTag: '', requestedSpecification: '', requestedRfi: '', requestedSubmittal: '', requestedInspection: '', normalizedQuery: undefined });
});

test('building and discipline query orders plans before schedules and details', () => {
  const result = buildPlanQuery({ query: 'Show mechanical work in Building 61', projectId: 'p1', analyses: [analysis] });
  assert.deepEqual(result.matchingSheetIds, ['plan1', 'plan2', 'schedule', 'detail']);
  assert.equal(result.viewerTarget.sheetId, 'plan1');
  assert.ok(result.actions.every(action => action.target.sheetId));
});

test('exact sheet, floor, room, equipment, schedule, detail, and rack queries remain exact', () => {
  assert.deepEqual(buildPlanQuery({ query: 'Open 61M-701', projectId: 'p1', analyses: [analysis] }).matchingSheetIds, ['schedule']);
  assert.deepEqual(buildPlanQuery({ query: 'Show the first floor mechanical plan', projectId: 'p1', analyses: [analysis] }).matchingSheetIds, ['plan1']);
  const room = buildPlanQuery({ query: 'What mechanical work affects Room 137?', projectId: 'p1', analyses: [analysis] });
  assert.deepEqual(room.matchingSheetIds, ['plan1']);
  assert.equal(room.viewerTarget.observationId, 'room137');
  assert.deepEqual(buildPlanQuery({ query: 'Find VAV-12', projectId: 'p1', analyses: [analysis] }).matchingSheetIds, ['plan1']);
  assert.deepEqual(buildPlanQuery({ query: 'Open mechanical schedule', projectId: 'p1', analyses: [analysis] }).matchingSheetIds, ['schedule']);
  assert.deepEqual(buildPlanQuery({ query: 'Open mechanical detail', projectId: 'p1', analyses: [analysis] }).matchingSheetIds, ['detail']);
  assert.deepEqual(buildPlanQuery({ query: 'Open the rack elevation', projectId: 'p1', analyses: [analysis] }).matchingSheetIds, ['rack']);
});

test('search ranks exact and partial sheets and combines discipline with rooms and tags', () => {
  const exact = searchDrawingSheets({ query: '61M-101', discipline: 'all', analysis })[0];
  assert.equal(exact.sheetId, 'plan1');
  assert.equal(exact.matchedReason, 'Matched exact sheet number');
  assert.deepEqual(searchDrawingSheets({ query: '61M', discipline: 'Mechanical', analysis }).map(item => item.sheetId), ['plan1', 'plan2', 'schedule', 'detail']);
  assert.match(searchDrawingSheets({ query: '137', discipline: 'Mechanical', analysis })[0].matchedReason, /Room 137/);
  assert.match(searchDrawingSheets({ query: 'VAV-12', discipline: 'all', analysis })[0].matchedReason, /Equipment Tag/);
  assert.deepEqual(searchDrawingSheets({ query: '', discipline: 'Mechanical', sheetType: 'Schedule', analysis }).map(item => item.sheetId), ['schedule']);
  assert.deepEqual(searchDrawingSheets({ query: 'missing', discipline: 'all', analysis }), []);
});

test('search summaries and keyboard selection are deterministic and field-readable', () => {
  assert.equal(drawingSearchSummary('', 70), '70 sheets in this drawing set');
  assert.equal(drawingSearchSummary('mechanical', 8), '8 results for “mechanical”');
  assert.deepEqual(reconcileDrawingSelection(['a', 'b'], 'b'), { sheetId: 'b', index: 1, preserved: true });
  assert.deepEqual(reconcileDrawingSelection(['a', 'b'], 'missing'), { sheetId: 'a', index: 0, preserved: false });
  assert.deepEqual(drawingResultKeyTarget('ArrowDown', { sheetIds: ['a', 'b'], activeIndex: 0 }), { index: 1, activate: false, clear: false });
  assert.equal(drawingResultKeyTarget('Enter', { sheetIds: ['a'], activeIndex: 0 }).activate, true);
  assert.equal(drawingResultKeyTarget('Escape', { sheetIds: ['a'], activeIndex: 0 }).clear, true);
  assert.equal(drawingResultKeyTarget('Home', { sheetIds: ['a', 'b'], activeIndex: 1 }).index, 0);
  assert.equal(drawingResultKeyTarget('End', { sheetIds: ['a', 'b'], activeIndex: 0 }).index, 1);
  assert.equal(drawingResultKeyTarget('PageDown', { sheetIds: Array.from({ length: 12 }, (_, index) => String(index)), activeIndex: 0 }).index, 8);
});

test('section scope uses exact document pages without changing retrieval order or scoring', () => {
  const result = buildPlanQuery({ query: 'Open 61M-101', projectId: 'p1', analyses: [analysis] });
  const scope = planQuerySectionScope(result, [{ id: 's1', documentId: 'd1', pageStart: 1, pageEnd: 1 }, { id: 's2', documentId: 'd1', pageStart: 2, pageEnd: 2 }], [analysis]);
  assert.deepEqual(scope.documentIds, ['d1']);
  assert.deepEqual(scope.pageNumbers, [1]);
  assert.deepEqual(scope.sectionIds, ['s1']);
});

test('plan-query scope combines routing-profile documents with exact page scope before retrieval', () => {
  const result = {
    viewerTarget: { documentId: 'd1', sheetId: 'plan1', pageNumber: 1 },
    matchingSheetIds: ['plan1'],
    routingProfile: { documentIds: ['spec-1'] }
  };
  const scope = buildPlanQueryScope(result, [{ id: 's1', documentId: 'd1', pageStart: 1, pageEnd: 1 }], [analysis]);
  assert.deepEqual(scope.documentIds, ['spec-1', 'd1']);
  assert.deepEqual(scope.pageNumbers, [1]);
  assert.deepEqual(scope.sectionIds, ['s1']);
});

test('construction router classifies intent with deterministic source priorities', () => {
  assert.equal(classifyConstructionIntent('What rooms receive HVAC work?').intent, 'location');
  assert.deepEqual(classifyConstructionIntent('What rooms receive HVAC work?').sourcePriority.slice(0, 3), ['drawings', 'legends', 'schedules']);
  assert.equal(classifyConstructionIntent('How is duct insulation installed?').intent, 'means-and-methods');
  assert.deepEqual(classifyConstructionIntent('How is duct insulation installed?').sourcePriority.slice(0, 3), ['specifications', 'submittals', 'details']);
  assert.equal(classifyConstructionIntent('When is telecom rough-in?').intent, 'schedule');
  assert.equal(classifyConstructionIntent('Why is Room 137 delayed?').intent, 'risk');
});

test('construction routing profiles split location and method scopes before retrieval', () => {
  const locationProfile = buildConstructionRoutingProfile('Where is the HVAC work in Building 61?', { drawingContext: { documentId: 'drawing-1', sheetId: 'sheet-1', pageNumber: 3 } });
  assert.equal(locationProfile.primaryIntent, 'location');
  assert.deepEqual(locationProfile.sourcePriority.slice(0, 3), ['drawings', 'legends', 'schedules']);
  assert.ok(locationProfile.documentIds.includes('drawing-1'));
  assert.equal(locationProfile.answerLayout, 'location');

  const methodProfile = buildConstructionRoutingProfile('How should the ductwork be insulated?', { documentIds: ['spec-1'] });
  assert.equal(methodProfile.primaryIntent, 'means-and-methods');
  assert.deepEqual(methodProfile.sourcePriority.slice(0, 3), ['specifications', 'submittals', 'details']);
  assert.ok(methodProfile.documentIds.includes('spec-1'));
  assert.equal(methodProfile.answerLayout, 'method');
});

test('follow-up questions inherit deterministic construction context and work packages hide empty sections', () => {
  const inherited = inheritPlanQueryContext('Show me.', { building: 'B1', floor: 'Second Floor', room: '137', discipline: 'Mechanical' });
  assert.equal(inherited.building, 'B1');
  assert.equal(inherited.room, '137');
  assert.equal(inherited.floor, 'Second Floor');

  const workPackage = buildConstructionWorkPackage({
    planResult: {
      projectId: 'p1',
      building: 'B1',
      floor: 'Second Floor',
      room: '137',
      discipline: 'Mechanical',
      matchingSheetIds: ['plan1'],
      matchingObservationIds: ['room137'],
      supportedWorkItems: [{ sheetId: 'plan1', statement: 'Mechanical work in Room 137.', basis: 'Drawing index' }],
      actions: [],
      limitations: ['No quantities are available.']
    },
    documents: [],
    sections: [],
    inspections: [],
    relationships: [],
    revisions: [],
    evidence: [],
    workflow: null
  });

  assert.equal(workPackage.presentation.evidenceConfidence, 'High');
  assert.equal(workPackage.presentation.sections.some(section => section.key === 'summary'), true);
  assert.equal(workPackage.presentation.sections.some(section => section.key === 'specifications' && !section.items.length), false);
});

test('plan results state graphical limitations and never claim quantity, ownership, or boundaries', () => {
  const result = buildPlanQuery({ query: 'How many diffusers are in Room 137?', projectId: 'p1', analyses: [analysis] });
  assert.ok(result.limitations.some(item => /quantities/.test(item)));
  assert.doesNotMatch(JSON.stringify(result.supportedWorkItems), /\b\d+ diffusers?\b/i);
  assert.doesNotMatch(JSON.stringify(result.supportedWorkItems), /room boundar|installed in/i);
});

test('validated Chief context supports exact short follow-ups', () => {
  const first = buildPlanQuery({ query: 'Show mechanical work in Building 61', projectId: 'p1', analyses: [analysis] });
  const context = createChiefConstructionContext({ conversationId: 'c1', projectId: 'p1', planResult: { ...first, room: '137' }, drawingTarget: { ...first.viewerTarget, observationId: 'room137' } });
  const valid = validateChiefConstructionContext(context, { conversationId: 'c1', projectId: 'p1', analyses: [analysis] });
  assert.equal(valid.building, '61');
  assert.equal(valid.room, '137');
  assert.equal(buildPlanQuery({ query: 'Show me where', projectId: 'p1', analyses: [analysis], context: valid }).viewerTarget.observationId, 'room137');
  assert.deepEqual(buildPlanQuery({ query: 'Open the schedule', projectId: 'p1', analyses: [analysis], context: valid }).matchingSheetIds, ['schedule']);
  assert.equal(inheritPlanQueryContext('What inspections are required?', valid).room, '137');
});

test('Chief context never leaks across projects and reduces stale targets', () => {
  const context = createChiefConstructionContext({ conversationId: 'c1', projectId: 'p1', planResult: { building: '61', discipline: 'Mechanical', matchingSheetIds: ['plan1'] }, drawingTarget: { documentId: 'd1', drawingSetId: 'set1', sheetId: 'plan1', pageNumber: 1, observationId: 'room137' } });
  assert.equal(validateChiefConstructionContext(context, { conversationId: 'c1', projectId: 'p2', analyses: [analysis] }), null);
  const staleObservation = validateChiefConstructionContext({ ...context, observationId: 'missing' }, { conversationId: 'c1', projectId: 'p1', analyses: [analysis] });
  assert.equal(staleObservation.sheetId, 'plan1');
  assert.equal(staleObservation.observationId, '');
  const staleSheet = validateChiefConstructionContext({ ...context, sheetId: 'missing' }, { conversationId: 'c1', projectId: 'p1', analyses: [analysis] });
  assert.equal(staleSheet.building, '61');
  assert.equal(staleSheet.sheetId, '');
});
