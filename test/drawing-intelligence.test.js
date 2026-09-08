import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyObservationVerification, buildDrawingAnalysis, classifyDiscipline, classifySheetTypes, drawingWarningPresentation,
  drawingIdFor, drawingSetIdFor, extractSheetNumberCandidates, extractTextObservations, groupDrawingObservations, isDrawingIndexSheet, observationEligibility, observationKindLabel, parseExactDrawingReference, primarySheetType, reanalyzeDrawingAnalysis, reconcileDrawingIndex, resolveBuilding, sheetIdFor, upgradeDrawingAnalysis, validSheetNumberCandidate
} from '../src/drawing-intelligence.js';
import { createDrawingTarget, drawingAnchorId, drawingReturnTarget, drawingScrollOptions, resolveDrawingTarget } from '../src/drawing-navigation.js';
import { createSourceTarget, resolveSourceTarget } from '../src/source-navigation.js';

const item = (text, x, y, width = .15) => ({ text, region: { x, y, width, height: .02 } });
const pages = [
  { pageNumber: 1, width: 1000, height: 700, rotation: 0, textItems: [item('DRAWING INDEX', .1, .1), item('M-101 MECHANICAL FLOOR PLAN', .1, .2, .4), item('T-101 TELECOMMUNICATIONS PLAN', .1, .23, .4), item('G-001', .8, .9), item('COVER SHEET AND DRAWING INDEX', .6, .86, .35)] },
  { pageNumber: 2, width: 1000, height: 700, rotation: 0, textItems: [item('M-101', .82, .9), item('MECHANICAL FLOOR PLAN', .62, .86, .3), item('ISSUE DATE: 07/31/2026', .62, .82, .2), item('REV: 2', .82, .82), item('ROOM 137 TELECOM', .3, .4), item('VAV-12', .35, .42), item('3/T-501', .4, .45)] }
];

test('stable identities use exact document and page identifiers', () => {
  assert.equal(drawingSetIdFor('d1'), drawingSetIdFor('d1'));
  assert.equal(sheetIdFor('d1', 1), sheetIdFor('d1', 1));
  assert.notEqual(sheetIdFor('d1', 1), sheetIdFor('d1', 2));
  assert.equal(drawingIdFor('d1', 1), drawingIdFor('d1', 1));
  assert.notEqual(drawingIdFor('d1', 1), drawingIdFor('d1', 2));
});

test('classifies disciplines and exact visible sheet types', () => {
  assert.equal(classifyDiscipline('M-101', '').discipline, 'Mechanical');
  assert.equal(classifyDiscipline('', 'Telecommunications Plan').discipline, 'Telecommunications');
  assert.deepEqual(classifySheetTypes('MECHANICAL DETAILS AND SCHEDULES'), ['Detail', 'Schedule']);
  assert.deepEqual(classifySheetTypes('TELECOMMUNICATIONS RACK ELEVATIONS A'), ['Rack Elevation', 'Elevation']);
  assert.equal(primarySheetType(['Rack Elevation', 'Elevation']), 'Rack Elevation');
  assert.deepEqual(classifySheetTypes('Unclassified content'), ['Unknown']);
  assert.equal(primarySheetType(classifySheetTypes('ELECTRICAL ONE-LINE DIAGRAM')), 'One Line');
  assert.equal(classifyDiscipline('FA-101', 'FIRE ALARM PLAN').discipline, 'Fire Alarm');
});

test('classification gates construction observations before extraction', () => {
  for (const type of ['Cover', 'Drawing Index', 'General Notes', 'Symbols and Abbreviations', 'Notes', 'Reference', 'Photo Reference', 'Cut Sheet']) {
    const eligibility = observationEligibility(type);
    assert.equal(eligibility.rooms, false, type);
    assert.equal(eligibility.equipment, false, type);
  }
  assert.equal(observationEligibility('Plan').rooms, true);
  assert.equal(observationEligibility('Unknown', 'Reference').rooms, false);
  assert.equal(resolveBuilding([item('BUILDING 61', .6, .8)]).building, '61');
  const evidenceOnly = extractTextObservations({ documentId: 'd', sheetId: 's', pageNumber: 1, textItems: [item('ROOM 137', .2, .2), item('VAV-12', .3, .3), item('3/M-501', .4, .4)], eligibility: observationEligibility('Cover') });
  assert.deepEqual(evidenceOnly.map(entry => entry.kind), ['callout-text']);
});

test('version 4 maps a complete ordered inventory only with exact anchors', () => {
  const entries = Array.from({ length: 70 }, (_, index) => ({ number: `61G-${String(index).padStart(3, '0')}`, title: index === 0 ? 'COVER SHEET' : index === 1 ? 'DRAWING INDEX' : `GENERAL DETAIL ${index}` }));
  const titleBlock = entry => [item('Drawing Title', .5, .82), item(entry.title, .5, .85, .2), item('Building Number', .72, .82), item('61', .72, .85), item('Drawing Number', .82, .88), item(entry.number, .82, .92)];
  const indexItems = [item('DRAWING INDEX', .08, .03), item('GENERAL', .08, .045), ...entries.flatMap((entry, index) => [item(entry.number, .08, .06 + index * .009, .08), item(entry.title, .22, .06 + index * .009, .25), item('Yes', .75, .06 + index * .009, .04)])];
  const sourcePages = entries.map((entry, index) => ({ pageNumber: index + 1, width: 1000, height: 700, rotation: 0, textItems: index === 1 ? [...indexItems, ...titleBlock(entry)] : index === 0 || index === 69 ? titleBlock(entry) : [] }));
  const analysis = buildDrawingAnalysis({ documentId: 'ordered-set', projectId: 'p1', pages: sourcePages, analyzedAt: 'now' });
  assert.equal(analysis.indexEntries.length, 70);
  assert.equal(analysis.sheets[0].sheetNumber, '61G-000');
  assert.equal(analysis.sheets[1].sheetNumber, '61G-001');
  assert.equal(analysis.sheets[69].sheetNumber, '61G-069');
  assert.ok(analysis.sheets.every(sheet => ['labeled-title-block-field', 'drawing-index-page-order', 'index-title-block-reconciliation'].includes(sheet.sheetNumberResolutionMethod)));
});

test('analysis version 7 persists authoritative title-block and drawing-index registry identities', () => {
  const titleBlock = (number, title, extra = []) => [item('VETERANS CLINIC RENOVATION', .62, .79, .3), ...(number ? [item(number, .82, .91)] : []), item(title, .62, .86, .32), ...extra];
  const indexItems = [item('DRAWING INDEX', .1, .08), item('SHEET NUMBER', .1, .11), item('SHEET NAME', .28, .11), item('GENERAL', .1, .13), item('61G-000', .1, .15), item('COVER SHEET', .28, .15), item('61G-001', .1, .19), item('DRAWING INDEX', .28, .19), item('MECHANICAL', .1, .21), item('61M-101', .1, .23), item('MECHANICAL PLAN - FIRST LEVEL - OVERALL', .28, .23, .45), item('YES', .8, .23), item('TELECOMMUNICATIONS', .1, .25), item('61T-402', .1, .27), item('TELECOMMUNICATION ROOM 137 - INVENTORY LIST', .28, .27, .45), item('ELECTRICAL', .1, .29), item('61E-401', .1, .31), item('ELECTRICAL DETAILS', .28, .31, .35)];
  const actual = [
    { pageNumber: 1, width: 1000, height: 700, rotation: 0, textItems: [...titleBlock('', 'COVER SHEET'), item('FIRE PROTECTION REQUIREMENTS SHALL BE COORDINATED.', .2, .3, .5)] },
    { pageNumber: 2, width: 1000, height: 700, rotation: 0, textItems: [...indexItems, ...titleBlock('61G-001', 'DRAWING INDEX')] },
    { pageNumber: 3, width: 1000, height: 700, rotation: 0, textItems: titleBlock('61M-101', 'MECHANICAL PLAN - FIRST LEVEL - OVERALL') },
    { pageNumber: 4, width: 1000, height: 700, rotation: 0, textItems: titleBlock('61T-402', 'TELECOMMUNICATION ROOM 137 - INVENTORY LIST') }
  ];
  const analysis = buildDrawingAnalysis({ documentId: 'building61', projectId: 'p1', pages: actual, analyzedAt: '2026-01-01' });
  assert.equal(analysis.analysisVersion, 7);
  assert.deepEqual(analysis.sheets.map(sheet => sheet.sheetNumber), ['61G-000', '61G-001', '61M-101', '61T-402']);
  assert.equal(analysis.sheets[0].sheetTitle, 'COVER SHEET');
  assert.equal(analysis.sheets[0].discipline, 'General');
  assert.equal(analysis.sheets[0].primarySheetType, 'Cover');
  assert.equal(analysis.observations.some(observation => observation.sheetId === analysis.sheets[0].sheetId && /room|equipment/.test(observation.kind)), false);
  assert.equal(analysis.sheets[1].primarySheetType, 'Drawing Index');
  assert.equal(analysis.sheets[2].discipline, 'Mechanical');
  assert.equal(analysis.sheets[3].discipline, 'Telecommunications');
  assert.equal(analysis.sheets[0].sheetNumberResolutionMethod, 'index-anchored-order');
  assert.equal(analysis.sheets[0].drawingId, drawingIdFor('building61', 1));
  assert.equal(analysis.sheets[0].projectId, 'p1');
  assert.equal(analysis.sheets[0].pdfPage, 1);
  assert.equal(analysis.sheets[2].normalizedTitle, 'mechanical plan - first level - overall');
  assert.equal(analysis.sheets[2].floor, 'FIRST');
  assert.equal(analysis.sheets[0].identityMethod, 'index-anchored-order');
  assert.equal(analysis.sheets[0].titleMethod, 'drawing-index');
  assert.equal(analysis.indexEntries.find(entry => entry.sheetNumber === '61M-101').sheetTitle, 'MECHANICAL PLAN - FIRST LEVEL - OVERALL');
  assert.equal(analysis.indexEntries.find(entry => entry.sheetNumber === '61T-402').sheetTitle, 'TELECOMMUNICATION ROOM 137 - INVENTORY LIST');
  assert.equal(analysis.indexEntries.find(entry => entry.sheetNumber === '61M-101').includedStatus, 'YES');
  assert.equal(analysis.sheets[2].identityStatus, 'Authoritative');
  assert.equal(analysis.drawingRegistry.find(entry => entry.normalizedSheetNumber === '61M101').drawingId, analysis.sheets[2].drawingId);
  assert.equal(analysis.registryHealth.indexDetected, true);
  assert.equal(analysis.registryHealth.indexRowsParsed, 5);
  assert.equal(analysis.registryHealth.missingIndexedSheets, 1);
  assert.ok(analysis.status === 'Completed with warnings');
  assert.equal(isDrawingIndexSheet(analysis.sheets[1]), true);
  assert.ok(analysis.sheets.every(sheet => sheet.sheetTitle !== 'FIRE PROTECTION REQUIREMENTS SHALL BE COORDINATED.'));
});

test('drawing-index detection rejects random body tables and title-block identity rejects page numbers', () => {
  const random = { sheetNumber: 'M-101', sheetTitle: 'MECHANICAL PLAN', titleBlockSheetNumber: 'M-101', titleBlockSheetTitle: 'MECHANICAL PLAN', textItems: [item('DRAWING INDEX REFERENCE NOTE', .1, .1), item('ROOM 137', .2, .3)] };
  assert.equal(isDrawingIndexSheet(random), false);
  const analysis = buildDrawingAnalysis({ documentId: 'identity-filter', projectId: 'bedford', analyzedAt: 'now', pages: [{ pageNumber: 1, width: 1000, height: 700, rotation: 0, textItems: [item('ROOM 137', .2, .3), item('NOTE 10', .3, .4), item('PAGE 04', .82, .9)] }] });
  assert.equal(analysis.sheets[0].sheetNumber, '');
  assert.equal(analysis.sheets[0].drawingId, drawingIdFor('identity-filter', 1));
  assert.equal(analysis.sheets[0].projectId, 'bedford');
  assert.equal(analysis.sheets[0].identityStatus, 'Ambiguous');
});

test('narrative titles are rejected and conflicts remain reviewable', () => {
  const analysis = buildDrawingAnalysis({ documentId: 'd2', projectId: 'p1', analyzedAt: 't', pages: [{ pageNumber: 1, width: 100, height: 100, rotation: 0, textItems: [item('M-101', .8, .9), item('CONTRACTOR SHALL PROVIDE ALL WORK IN ACCORDANCE WITH REQUIREMENTS.', .6, .86, .35)] }] });
  assert.equal(analysis.sheets[0].sheetTitle, '');
  assert.ok(analysis.sheets[0].rejectedSheetTitleCandidates.some(candidate => candidate.reason === 'narrative-sentence'));
  const warnings = reconcileDrawingIndex([{ sheetNumber: 'M-101', sheetTitle: 'MECHANICAL PLAN' }], [{ sheetId: 's', sheetNumber: 'M-101', sheetTitle: 'MECHANICAL NOTES' }]);
  assert.ok(warnings.some(warning => warning.type === 'title-mismatch'));
});

test('version upgrades preserve resolvable verification overlays and report unmapped overlays', () => {
  const legacy = buildDrawingAnalysis({ documentId: 'd1', projectId: 'p1', pages, analyzedAt: '2026-01-01' });
  legacy.analysisVersion = 2;
  legacy.observations[0].verification = { status: 'Confirmed', correctedValue: '', verifiedAt: '2026-01-02' };
  legacy.observations.push({ observationId: 'removed', pageNumber: 99, kind: 'room-number-text', originalValue: '999', verification: { status: 'Rejected', correctedValue: '', verifiedAt: '2026-01-02' } });
  const upgraded = upgradeDrawingAnalysis(legacy);
  assert.equal(upgraded.analysisVersion, 7);
  assert.equal(upgraded.observations.find(item => item.observationId === legacy.observations[0].observationId).verification.status, 'Confirmed');
  assert.equal(upgraded.unmappedVerificationOverlays[0].observationId, 'removed');
  assert.equal(reanalyzeDrawingAnalysis(upgraded).analysisVersion, 7);
});

test('observation and warning presentation is field-readable and grouped', () => {
  assert.equal(observationKindLabel('room-number-text'), 'Room number');
  const grouped = groupDrawingObservations([
    { observationId: 'a', kind: 'room-number-text', value: '137', verification: { status: 'Unreviewed' } },
    { observationId: 'b', kind: 'room-number-text', value: '137', verification: { status: 'Confirmed' } },
    { observationId: 'c', kind: 'equipment-tag-text', value: 'VAV-12', verification: { status: 'Unreviewed' } }
  ]);
  assert.equal(grouped.rooms[0].count, 2);
  assert.equal(grouped.equipment.length, 1);
  const warnings = drawingWarningPresentation([{ type: 'title-mismatch' }, { type: 'order-mismatch' }]);
  assert.match(warnings.userFacing[0].message, /disagree/i);
  assert.equal(warnings.technical.length, 1);
});

test('sheet identity accepts generalized drawing numbers and rejects metadata candidates', () => {
  for (const value of ['61G-001', '61M-101', '61M-701', '61E-401', '61T-402', 'M-101', 'A101', 'FP101']) assert.equal(validSheetNumberCandidate(value), true, value);
  for (const [value, context] of [['R23', 'R23'], ['08-6231', 'VA FORM 08-6231'], ['61M-101', 'PROJECT NUMBER 61M-101'], ['20260731', 'REVISION DATE 20260731'], ['123456', 'REGISTRATION 123456'], ['100', 'PAGE 100'], ['22', 'PHASE 22']]) assert.equal(validSheetNumberCandidate(value, context), false, `${value} ${context}`);
  const candidates = extractSheetNumberCandidates([item('VA FORM 08-6231', .7, .8), item('R23', .8, .82), item('61M-101', .82, .9)] , { titleBlockOnly: true });
  assert.deepEqual(candidates.map(candidate => candidate.value), ['61M-101']);
});

test('builds title-block sheets, index entries, room tags, equipment tags, and callouts', () => {
  const analysis = buildDrawingAnalysis({ documentId: 'd1', projectId: 'p1', pages, analyzedAt: '2026-01-01' });
  assert.equal(analysis.sheets.length, 2);
  assert.equal(analysis.sheets[1].sheetNumber, 'M-101');
  assert.equal(analysis.sheets[1].discipline, 'Mechanical');
  assert.equal(analysis.sheets[1].issueDate, '07/31/2026');
  assert.equal(analysis.sheets[1].revision, '2');
  assert.ok(analysis.indexEntries.some(entry => entry.sheetNumber === 'M-101'));
  assert.ok(analysis.observations.some(observation => observation.kind === 'room-number-text' && observation.value === '137'));
  assert.ok(analysis.observations.some(observation => observation.kind === 'room-name-text' && observation.value === 'TELECOM'));
  assert.ok(analysis.observations.some(observation => observation.kind === 'equipment-tag-text' && observation.value === 'VAV-12'));
  assert.deepEqual(parseExactDrawingReference('3/T-501'), { detailNumber: '3', sheetNumber: 'T-501', source: '3/T-501' });
  assert.ok(analysis.references.some(reference => reference.sheetNumber === 'T-501'));
  assert.ok(analysis.limitations[0].includes('do not establish room boundaries'));
});

test('reports duplicate numbers, title mismatches, and missing index sheets', () => {
  const warnings = reconcileDrawingIndex(
    [{ sheetNumber: 'M-101', sheetTitle: 'MECHANICAL PLAN' }, { sheetNumber: 'E-101', sheetTitle: 'ELECTRICAL PLAN' }],
    [{ sheetId: 's1', sheetNumber: 'M-101', sheetTitle: 'MECHANICAL LEVEL PLAN' }, { sheetId: 's2', sheetNumber: 'M-101', sheetTitle: 'MECHANICAL LEVEL PLAN' }]
  );
  assert.ok(warnings.some(item => item.type === 'duplicate-sheet-number'));
  assert.ok(warnings.some(item => item.type === 'expected-sheet-missing' && item.sheetNumber === 'E-101'));
});

test('machine observations remain immutable when verification overlays change', () => {
  const [machine] = extractTextObservations({ documentId: 'd1', sheetId: 's1', pageNumber: 1, textItems: [item('ROOM 137', .2, .2)] });
  const corrected = applyObservationVerification(machine, { status: 'Corrected', correctedValue: '137A', verifiedAt: '2026-01-02' });
  assert.equal(machine.value, '137');
  assert.equal(machine.verification.status, 'Unreviewed');
  assert.equal(corrected.originalValue, '137');
  assert.equal(corrected.verification.correctedValue, '137A');
  assert.throws(() => applyObservationVerification(machine, { status: 'Corrected' }), /corrected value/);
});

test('drawing navigation resolves exact documents, sheets, pages, observations, and regions only', () => {
  const analysis = buildDrawingAnalysis({ documentId: 'd1', projectId: 'p1', pages, analyzedAt: '2026-01-01' });
  const observation = analysis.observations[0];
  const target = createDrawingTarget({ projectId: 'p1', documentId: 'd1', drawingSetId: analysis.drawingSetId, sheetId: observation.sheetId, pageNumber: observation.pageNumber, observationId: observation.observationId, region: observation.region });
  const documents = [{ id: 'd1', documentType: 'drawing-set' }];
  assert.equal(resolveDrawingTarget(target, { documents, analyses: [analysis] }).status, 'region');
  assert.equal(resolveDrawingTarget({ ...target, observationId: 'missing' }, { documents, analyses: [analysis] }).status, 'missing-observation');
  assert.equal(resolveDrawingTarget({ ...target, sheetId: 'missing', observationId: '' }, { documents, analyses: [analysis] }).status, 'missing-page');
  assert.equal(resolveDrawingTarget({ ...target, documentId: 'missing' }, { documents, analyses: [analysis] }).status, 'missing-document');
  assert.match(drawingAnchorId('sheet', 'unsafe/id'), /^mc-drawing-sheet-/);
  assert.equal(drawingScrollOptions(true).behavior, 'auto');
  assert.equal(drawingReturnTarget(target, 'source').destination, 'source');
});

test('application exposes bounded Mission Control viewing and Professional inspection without graphical claims', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(app, /data-control-view="plans">Drawings<\/button>/);
  const tools = app.slice(app.indexOf('id="professionalWorkspaceTools"'), app.indexOf('<h3>Administration<\/h3>'));
  assert.match(tools, /<h3>Drawing \/ Engineering<\/h3>/);
  assert.doesNotMatch(tools, /data-view="drawings"/);
  assert.match(app, /<section id="drawings" class="view">[\s\S]*id="drawingInspector" class="mc-drawing-workspace"/);
  assert.doesNotMatch(app, /if \(name === 'drawings'\) void renderDrawingWorkspace\('professional'\)/);
  assert.match(app, /Original drawing unavailable — reattach PDF to view sheet/);
  assert.match(app, /Graphical association has not been verified/);
  assert.match(app, /updateDrawingSearchResults/);
  assert.doesNotMatch(app, /drawingFilter = event\.target\.value;\s*void renderDrawingWorkspace/);
  assert.match(app, /Construction Work Package/);
  assert.match(app, /render one selected full-resolution page|renderPdfPage\(activeDrawingPdf/);
  assert.match(css, /\.mc-drawing-workspace/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('source navigation resolves exact drawing pages and observations without approximate fallback', () => {
  const analysis = buildDrawingAnalysis({ documentId: 'd1', projectId: 'p1', pages, analyzedAt: '2026-01-01' });
  const observation = analysis.observations.find(item => item.kind === 'room-number-text');
  const target = createSourceTarget({ projectId: 'p1', documentId: 'd1', pageNumber: observation.pageNumber, sheetId: observation.sheetId, observationId: observation.observationId, region: observation.region, destination: 'sources' });
  const records = { documents: [{ id: 'd1', projectId: 'p1' }], projects: [{ id: 'p1' }], analyses: [analysis], sourceFiles: [{ documentId: 'd1' }] };
  assert.equal(resolveSourceTarget(target, records).status, 'drawing-region');
  assert.equal(resolveSourceTarget({ ...target, observationId: 'missing' }, records).status, 'missing-observation');
  assert.equal(resolveSourceTarget(target, { ...records, sourceFiles: [] }).status, 'missing-source');
  assert.equal(resolveSourceTarget({ ...target, pageNumber: 99, sheetId: '', observationId: '' }, records).status, 'missing-page');
});
