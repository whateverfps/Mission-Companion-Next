import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChiefLocationPresentation, classifyEngineeringNavigationIntent, navigateExactDrawingCommand, normalizeRegisteredSheetNumber, resolveEngineeringLocation } from '../src/engineering-locator.js';

const registeredMechanicalAnalysis = projectId => ({
  documentId: `doc-${projectId}`, drawingSetId: `set-${projectId}`, projectId,
  sheets: [{ drawingId: `drawing-${projectId}-61m101`, sheetId: `sheet-${projectId}`, pageNumber: 23, sheetNumber: '61M-101', sheetTitle: 'Mechanical Plan — First Level — Overall', discipline: 'Mechanical' }],
  observations: [
    { observationId: `index-${projectId}`, sheetId: `sheet-${projectId}`, kind: 'positioned-pdf-text', value: '61M-101' },
    { observationId: `building-${projectId}`, sheetId: `sheet-${projectId}`, kind: 'room-number-text', value: '80' }
  ]
});

test('classifies and normalizes exact drawing navigation commands before location heuristics', () => {
  for (const query of ['Open sheet 61M-101', 'Open Mechanical Sheet 61M101', 'Take me to 61 M-101', 'Show drawing 61M-101']) {
    const intent = classifyEngineeringNavigationIntent(query);
    assert.equal(intent.kind, 'exact-drawing-navigation');
    assert.equal(intent.value, '61M101');
  }
  assert.equal(normalizeRegisteredSheetNumber('sheet 61 M-101'), '61M101');
  assert.equal(classifyEngineeringNavigationIntent('What work is shown on 61M-101?').kind, 'knowledge-question');
});

test('exact registered sheet command resolves one drawingId without observation candidates', () => {
  const analysis = registeredMechanicalAnalysis('bedford');
  const result = resolveEngineeringLocation('Open Mechanical Sheet 61M-101', { analyses: [analysis], projectId: 'general', returnTarget: 'chief-answer' });
  assert.equal(result.status, 'resolved');
  assert.equal(result.kind, 'sheet');
  assert.equal(result.target?.drawingId, 'drawing-bedford-61m101');
  assert.equal(result.target?.kind, 'drawing');
  assert.equal(result.target?.projectId, 'bedford');
  assert.equal(result.target?.sheetId, 'sheet-bedford');
  assert.equal(result.target?.returnTarget, 'chief-answer');
  assert.deepEqual(result.candidates.map(item => item.drawingId), ['drawing-bedford-61m101']);
  assert.equal(result.candidates.some(item => item.label === '80'), false);
});

test('successful exact sheet commands navigate once and terminate before AI', async () => {
  const analyses = [registeredMechanicalAnalysis('general'), {
    documentId: 'doc-general-telecom', drawingSetId: 'set-general', projectId: 'general', observations: [],
    sheets: [{ drawingId: 'drawing-general-61t402', sheetId: 'sheet-telecom', pageNumber: 61, sheetNumber: '61T-402', sheetTitle: 'Telecommunication Room 137 — Inventory List', discipline: 'Telecommunications' }]
  }];
  const opened = [];
  let askCalls = 0;
  for (const query of ['Open Mechanical Sheet 61M-101', 'Open Sheet 61T-402']) {
    const navigation = await navigateExactDrawingCommand(query, { analyses, projectId: 'general' }, target => opened.push(target));
    if (!navigation.handled) askCalls += 1;
    assert.equal(navigation.handled, true);
  }
  assert.equal(askCalls, 0);
  assert.deepEqual(opened.map(target => target.drawingId), ['drawing-general-61m101', 'drawing-general-61t402']);
});

test('failed exact sheet resolution remains available to the ordinary question path', async () => {
  let opened = false;
  const navigation = await navigateExactDrawingCommand('Open Sheet 61T-402', { analyses: [], projectId: 'general' }, () => { opened = true; });
  assert.equal(navigation.attempted, true);
  assert.equal(navigation.handled, false);
  assert.equal(opened, false);
});

test('exact sheet ambiguity is deduplicated by drawingId and remains project-distinguishable', () => {
  const bedford = registeredMechanicalAnalysis('bedford');
  const duplicateObservationCopy = structuredClone(bedford);
  const other = registeredMechanicalAnalysis('other');
  const deduplicated = resolveEngineeringLocation('Open sheet 61M-101', { analyses: [bedford, duplicateObservationCopy], projectId: 'general' });
  assert.equal(deduplicated.status, 'resolved');
  const ambiguous = resolveEngineeringLocation('Open sheet 61M-101', { analyses: [bedford, other], projectId: 'general' });
  assert.equal(ambiguous.status, 'ambiguous');
  assert.deepEqual(ambiguous.candidates.map(item => item.projectId).sort(), ['bedford', 'other']);
});

test('explicit discipline constrains room candidates instead of broadening them', () => {
  const mechanical = registeredMechanicalAnalysis('bedford');
  mechanical.observations.push({ observationId: 'room-mech', sheetId: 'sheet-bedford', kind: 'room-number-text', value: '127B' });
  const electrical = structuredClone(mechanical);
  electrical.sheets[0] = { ...electrical.sheets[0], drawingId: 'drawing-electrical', sheetId: 'sheet-electrical', discipline: 'Electrical' };
  electrical.observations = [{ observationId: 'room-elec', sheetId: 'sheet-electrical', kind: 'room-number-text', value: '127B' }];
  const result = resolveEngineeringLocation('Show Room 127B on the mechanical plan', { analyses: [mechanical, electrical] });
  assert.equal(result.target?.drawingId, 'drawing-bedford-61m101');
});

test('resolves an exact room query into a drawing target with observation metadata', () => {
  const result = resolveEngineeringLocation('Show room 101', {
    analyses: [{
      documentId: 'doc-1',
      drawingSetId: 'set-1',
      projectId: 'project-1',
      sheets: [{ sheetId: 'sheet-1', pageNumber: 2, sheetNumber: 'A101' }],
      observations: [{ observationId: 'obs-room-101', sheetId: 'sheet-1', kind: 'room-number-text', value: '101', region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } }]
    }],
    documents: [{ id: 'doc-1', title: 'Floor Plan' }],
    returnTarget: 'work-package'
  });

  assert.equal(result.status, 'resolved');
  assert.equal(result.kind, 'room');
  assert.equal(result.target?.documentId, 'doc-1');
  assert.equal(result.target?.sheetId, 'sheet-1');
  assert.equal(result.target?.observationId, 'obs-room-101');
  assert.equal(result.target?.returnTarget, 'work-package');
  assert.deepEqual(result.target?.region, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
});

test('an explicit sheet command takes precedence over equipment observation text', () => {
  const result = resolveEngineeringLocation('Open sheet A102 and show AHU-01', {
    analyses: [{
      documentId: 'doc-2',
      drawingSetId: 'set-2',
      projectId: 'project-2',
      sheets: [{ sheetId: 'sheet-2', pageNumber: 4, sheetNumber: 'A102', sheetTitle: 'Mechanical Plan' }],
      observations: [{ observationId: 'obs-eq-1', sheetId: 'sheet-2', kind: 'equipment-tag-text', value: 'AHU-01', region: { x: 0.6, y: 0.2, width: 0.1, height: 0.1 } }]
    }],
    documents: [{ id: 'doc-2', title: 'Mechanical' }]
  });

  assert.equal(result.status, 'resolved');
  assert.equal(result.kind, 'sheet');
  assert.equal(result.target?.sheetId, 'sheet-2');
  assert.equal(result.target?.observationId, '');
  assert.equal(result.label, 'A102');
});

test('resolves a named room by matching room-name observations', () => {
  const result = resolveEngineeringLocation('Show the pharmacy', {
    analyses: [{
      documentId: 'doc-3',
      drawingSetId: 'set-3',
      projectId: 'project-3',
      sheets: [{ sheetId: 'sheet-3', pageNumber: 5, sheetNumber: 'A103' }],
      observations: [{ observationId: 'obs-room-name', sheetId: 'sheet-3', kind: 'room-name-text', value: 'Pharmacy', region: { x: 0.2, y: 0.3, width: 0.2, height: 0.2 } }]
    }]
  });

  assert.equal(result.status, 'resolved');
  assert.equal(result.kind, 'named-room');
  assert.equal(result.label, 'Pharmacy');
});

test('resolves specification sections by section number and preserves source metadata', () => {
  const result = resolveEngineeringLocation('Open section 23 09 00', {
    sections: [{
      id: 'sec-230900',
      documentId: 'doc-spec',
      number: '23 09 00',
      title: 'Instrumentation and Control',
      metadata: { provenance: 'spec-index' }
    }],
    documents: [{ id: 'doc-spec', title: 'CSI Specifications' }]
  });

  assert.equal(result.status, 'resolved');
  assert.equal(result.kind, 'spec-section');
  assert.equal(result.target?.documentId, 'doc-spec');
  assert.equal(result.target?.sectionId, 'sec-230900');
  assert.equal(result.target?.destination, 'knowledge');
});

test('returns an ambiguous result when multiple exact matches exist', () => {
  const result = resolveEngineeringLocation('Show room 101', {
    analyses: [{
      documentId: 'doc-4',
      drawingSetId: 'set-4',
      projectId: 'project-4',
      sheets: [{ sheetId: 'sheet-4', pageNumber: 6, sheetNumber: 'A104' }, { sheetId: 'sheet-5', pageNumber: 7, sheetNumber: 'A105' }],
      observations: [
        { observationId: 'obs-room-101-a', sheetId: 'sheet-4', kind: 'room-number-text', value: '101', region: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 } },
        { observationId: 'obs-room-101-b', sheetId: 'sheet-5', kind: 'room-number-text', value: '101', region: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 } }
      ]
    }]
  });

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.kind, 'room');
  assert.equal(result.candidates.length, 2);
});

test('builds a Chief location presentation for an exact room match', () => {
  const presentation = buildChiefLocationPresentation({ id: 'message-7', role: 'assistant', content: 'Show me room 127B' }, {
    analyses: [{
      documentId: 'doc-7',
      drawingSetId: 'set-7',
      projectId: 'project-7',
      sheets: [{ sheetId: 'sheet-7', sheetNumber: 'E401', sheetTitle: 'Mechanical Plan', pageNumber: 4, discipline: 'Mechanical', primarySheetType: 'Plan' }],
      observations: [{ observationId: 'obs-127b', sheetId: 'sheet-7', kind: 'room-number-text', value: '127B', region: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 } }]
    }],
    documents: [{ id: 'doc-7', title: 'Mechanical Plans' }],
    sections: []
  });

  assert.ok(presentation);
  assert.equal(presentation.status, 'resolved');
  assert.equal(presentation.mode, 'drawing');
  assert.equal(presentation.actionLabel, 'Open in Drawings');
  assert.match(presentation.summary, /127B/);
});

test('builds a Chief location presentation for specification matches', () => {
  const presentation = buildChiefLocationPresentation({ id: 'message-8', role: 'assistant', content: 'Show specification 11 23 33' }, {
    analyses: [],
    documents: [{ id: 'doc-spec', title: 'Specifications' }],
    sections: [{ id: 'sec-112333', documentId: 'doc-spec', number: '11 23 33', title: 'Facility Fueling' }]
  });

  assert.ok(presentation);
  assert.equal(presentation.status, 'resolved');
  assert.equal(presentation.mode, 'specification');
  assert.equal(presentation.actionLabel, 'Open Specification');
});

test('builds an ambiguous Chief location presentation without guessing', () => {
  const presentation = buildChiefLocationPresentation({ id: 'message-9', role: 'assistant', content: 'Show room 101' }, {
    analyses: [{
      documentId: 'doc-8',
      drawingSetId: 'set-8',
      projectId: 'project-8',
      sheets: [{ sheetId: 'sheet-8', sheetNumber: 'A101' }, { sheetId: 'sheet-9', sheetNumber: 'A102' }],
      observations: [
        { observationId: 'obs-a', sheetId: 'sheet-8', kind: 'room-number-text', value: '101' },
        { observationId: 'obs-b', sheetId: 'sheet-9', kind: 'room-number-text', value: '101' }
      ]
    }],
    documents: [{ id: 'doc-8', title: 'Plans' }],
    sections: []
  });

  assert.equal(presentation.status, 'ambiguous');
  assert.equal(presentation.candidates.length, 2);
  assert.equal(presentation.actionLabel, 'Choose a matching location');
});

test('returns no match when nothing can be resolved from the query', () => {
  const result = resolveEngineeringLocation('Find the hidden thing', {
    analyses: [],
    sections: []
  });

  assert.equal(result.status, 'none');
  assert.equal(result.kind, 'none');
});
