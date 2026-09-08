import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConstructionWorkPackage, currentWorkActivationTarget, inspectionPrefillFromWorkPackage, workPackageConfidence, workPackageModePresentation, workPackageReason } from '../src/work-package.js';

const target = { projectId: 'p1', documentId: 'drawing', drawingSetId: 'set', drawingId: 'drawing-sheet1', sheetId: 'sheet1', pageNumber: 2, observationId: 'room137', region: { x: .1, y: .2, width: .1, height: .02 } };
const planResult = {
  projectId: 'p1', building: '61', floor: 'first floor', room: '137', discipline: 'Mechanical',
  matchingSheetIds: ['sheet1'], matchingObservationIds: ['room137'],
  supportedWorkItems: [{ sheetId: 'sheet1', observationId: 'room137', basis: 'Plan text', statement: 'Mechanical sheet containing exact room-number 137.' }],
  actions: [{ action: 'show-location', label: 'Show 137 on 61M-101', target }], viewerTarget: target,
  limitations: ['Graphical association has not been verified.']
};
const documents = [
  { id: 'drawing', title: '61M-101', category: 'Drawings' },
  { id: 'spec', title: '23 05 00', category: 'Specifications' },
  { id: 'rfi', title: 'RFI-002', type: 'rfi', status: 'Open' },
  { id: 'sub', title: 'SUB-003', type: 'submittal', status: 'Submitted' },
  { id: 'def', title: 'DEF-002', type: 'deficiency', status: 'Open' }
];
const inspection = { inspectionId: 'ins', inspectionNumber: 'INS-003', title: 'Room 137 follow-up', projectId: 'p1', room: '137', status: 'Follow-Up Required', result: 'Deficient', sourceDocumentIds: ['drawing'], relatedSpecificationIds: ['spec'], relatedRfiIds: ['rfi'], relatedSubmittalIds: ['sub'], relatedDeficiencyIds: ['def'] };

test('composes exact drawings and linked operational sources with controlled reasons', () => {
  const result = buildConstructionWorkPackage({ planResult, documents, inspections: [inspection], evidence: [{ documentId: 'drawing', sectionId: 'section1' }], revisions: [{ revisionId: 'rev', documentIds: ['drawing'] }] });
  assert.deepEqual(result.drawings.map(item => item.id), ['sheet1']);
  assert.deepEqual(result.specifications.map(item => item.id), ['spec']);
  assert.deepEqual(result.rfis.map(item => item.id), ['rfi']);
  assert.deepEqual(result.submittals.map(item => item.id), ['sub']);
  assert.deepEqual(result.inspections.map(item => item.id), ['ins']);
  assert.deepEqual(result.deficiencies.map(item => item.id), ['def']);
  assert.equal(result.evidence[0].reasonCode, 'active-session-evidence');
  assert.equal(result.revisions[0].reasonCode, 'explicit-revision-pair');
  assert.ok(result.risks.some(item => item.kind === 'open-rfi'));
  assert.ok(result.risks.some(item => item.kind === 'pending-submittal'));
});

test('reason codes and confidence labels describe evidence quality only', () => {
  assert.match(workPackageReason('drawing-room-observation'), /exact room text observation/i);
  assert.equal(workPackageConfidence({ exactIdentifier: true }), 'High');
  assert.equal(workPackageConfidence({}), 'Supported');
  assert.equal(workPackageConfidence({ contextual: true }), 'Contextual');
  assert.equal(workPackageConfidence({ available: false }), 'Unavailable');
});

test('inspection preparation and prefill retain exact references without conclusions', () => {
  const result = buildConstructionWorkPackage({ planResult, documents, inspections: [inspection], evidence: [{ documentId: 'drawing', sectionId: 'section1' }], workflow: { workflowType: 'Inspection Preparation' } });
  assert.equal(result.inspectionPreparation.nextInspection.id, 'ins');
  const prefill = inspectionPrefillFromWorkPackage(result);
  assert.equal(prefill.projectId, 'p1');
  assert.equal(prefill.room, '137');
  assert.deepEqual(prefill.relatedSpecificationIds, ['spec']);
  assert.deepEqual(prefill.evidenceReferences, [{ documentId: 'drawing', sectionId: 'section1' }]);
  assert.equal(prefill.result, undefined);
  assert.equal(prefill.observedConditions, undefined);
  assert.equal(prefill.correctiveActionRequired, undefined);
});

test('Current Work requires one exact primary document and never copies the package', () => {
  const result = buildConstructionWorkPackage({ planResult, documents });
  const activation = currentWorkActivationTarget(result);
  assert.equal(activation.available, true);
  assert.deepEqual(activation.request, { projectId: 'p1', documentId: 'drawing', sectionId: '', source: 'Construction Work Package' });
  const ambiguous = currentWorkActivationTarget({ ...result, drawings: [...result.drawings, { ...result.drawings[0], id: 'sheet2', documentId: 'other' }] });
  assert.equal(ambiguous.available, false);
  assert.equal('workPackage' in activation.request, false);
});

test('empty categories stay empty and unsupported graphical conclusions are absent', () => {
  const result = buildConstructionWorkPackage({ planResult, documents: [{ id: 'drawing', category: 'Drawings' }] });
  assert.deepEqual(result.specifications, []);
  assert.deepEqual(result.rfis, []);
  assert.deepEqual(result.submittals, []);
  assert.deepEqual(result.risks, []);
  assert.doesNotMatch(JSON.stringify(result.workSummary), /duct routing|installed equipment|diffuser quantity|clash|compliance/i);
});

test('presentation is construction-first, exact, and hides unsupported groups', () => {
  const result = buildConstructionWorkPackage({ planResult, documents, inspections: [inspection] });
  assert.equal(result.presentation.location.room, '137');
  assert.equal(result.presentation.tradeSystem, 'Mechanical');
  assert.equal(result.presentation.primaryDrawing.sheetId, 'sheet1');
  assert.equal(result.presentation.primaryDrawing.drawingId, 'drawing-sheet1');
  assert.equal(result.presentation.exactPlanEvidence[0].quality, 'Exact');
  assert.deepEqual(result.presentation.relatedPlans, []);
  assert.equal(result.presentation.projectRecords.inspections[0].id, 'ins');
  assert.doesNotMatch(JSON.stringify(result.presentation), /installed quantity|duct route|room ownership/i);
});

test('response actions are exact and deduplicated', () => {
  const duplicate = { ...planResult, actions: [...planResult.actions, structuredClone(planResult.actions[0])] };
  const result = buildConstructionWorkPackage({ planResult: duplicate, documents });
  assert.equal(result.responseActions.length, 1);
  assert.equal(result.responseActions[0].target.sheetId, 'sheet1');
});

test('source-only omits recommendations while expert-assisted separates them', () => {
  const result = buildConstructionWorkPackage({ planResult, documents, inspections: [inspection] });
  const source = workPackageModePresentation(result, 'source');
  assert.equal(source.sourceOnly, true);
  assert.deepEqual(source.risks, []);
  assert.deepEqual(source.recommendedActions, []);
  assert.equal(source.inspectionPreparation, null);
  const expert = workPackageModePresentation(result, 'assisted');
  assert.equal(expert.sourceOnly, false);
  assert.ok(expert.risks.length > 0);
  assert.ok(expert.recommendedActions.length > 0);
  assert.ok(expert.limitations.length > 0);
});
