import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEngineeringDocument, clearInspectionSession, createEngineeringContext, engineeringContextMetrics, engineeringNavigationTarget, getInspectionSession, startInspectionSession, updateInspectionNotes } from '../src/engineering-context.js';

const projects = [{ id: 'p1', name: 'Project' }];
const documents = [
  { id: 'd1', projectId: 'p1', libraryId: 'l1', category: 'Specifications', lineageId: 'x', lineageStatus: 'current', previousDocumentId: 'd0' },
  { id: 'd0', projectId: 'p1', libraryId: 'l1', category: 'Specifications', lineageId: 'x', lineageStatus: 'superseded' },
  { id: 'd2', projectId: 'p1', libraryId: 'l1', type: 'Drawing' },
  { id: 'd3', projectId: 'p1', libraryId: 'l2', tags: ['SOP'] },
  { id: 'd4', projectId: 'p1', libraryId: 'l1', title: 'Specifications by title only' }
];
const sections = [
  { id: 's1', documentId: 'd1', parentId: '', crossReferenceIds: ['s2'], text: 'Seed', division: '01' },
  { id: 'child', documentId: 'd1', parentId: 's1', text: 'Child' },
  { id: 's2', documentId: 'd2', text: 'Referenced drawing', division: '01' },
  { id: 's3', documentId: 'd3', text: 'Procedure' }
];
const base = { projectId: 'p1', documentId: 'd1', sectionId: 's1', projects, documents, sections };

test('creates a context only from exact project and document identifiers', () => {
  assert.equal(createEngineeringContext(base).documentId, 'd1');
  assert.equal(createEngineeringContext({ ...base, documentId: 'missing' }), null);
  assert.equal(createEngineeringContext({ ...base, projectId: 'missing' }), null);
});
test('validates an optional exact section', () => assert.equal(createEngineeringContext({ ...base, sectionId: 'missing' }), null));
test('does not infer building, room, discipline, or trade', () => {
  const context = createEngineeringContext(base);
  assert.deepEqual([context.buildingId, context.roomId, context.discipline, context.trade], ['', '', '', '']);
});
test('composes exact hierarchy and explicit references', () => {
  const context = createEngineeringContext(base);
  assert.ok(context.sectionIds.includes('child'));
  assert.ok(context.sectionIds.includes('s2'));
  assert.ok(context.explicitReferenceIds.length);
});
test('keeps same-library associations contextual', () => {
  const context = createEngineeringContext(base);
  assert.ok(context.contextualSameLibrary.some(item => item.documentId === 'd4'));
  assert.ok(!context.referencedDocumentIds.includes('d4'));
});
test('keeps same-division associations contextual', () => {
  const context = createEngineeringContext(base);
  assert.ok(context.contextualSameDivision.some(item => item.documentId === 'd2'));
  assert.ok(!context.explicitReferenceIds.some(id => id.startsWith('same-division')));
});
test('classifies only exact metadata values and retains unclassified documents', () => {
  const context = createEngineeringContext(base);
  assert.ok(context.classification.specifications.some(item => item.documentId === 'd1'));
  assert.ok(context.classification.drawings.some(item => item.documentId === 'd2'));
  assert.equal(context.classification.unclassified.some(item => item.documentId === 'd4'), false);
  const unclassified = createEngineeringContext({ ...base, documentId: 'd4', sectionId: '' });
  assert.ok(unclassified.classification.unclassified.some(item => item.documentId === 'd4'));
  assert.equal(classifyEngineeringDocument(documents[3]).type, 'procedures');
  assert.equal(classifyEngineeringDocument(documents[4]).type, 'unclassified');
});
test('integrates only exact active-session evidence', () => {
  const context = createEngineeringContext({ ...base, retrievalSession: { evidence: [{ id: 'e1', documentId: 'd2', sectionId: 's2' }, { id: 'e2', documentId: 'd3', sectionId: 's3' }] } });
  assert.deepEqual(context.evidenceIds, ['e1']);
});
test('integrates explicit lineage only', () => {
  const context = createEngineeringContext(base);
  assert.equal(context.lineage.previousDocumentId, 'd0');
  assert.ok(context.versionIds.includes('d0'));
});
test('inspection session notes are transient and clearable', () => {
  clearInspectionSession(); startInspectionSession(createEngineeringContext(base)); updateInspectionNotes('Temporary');
  assert.equal(getInspectionSession().notes, 'Temporary');
  startInspectionSession(createEngineeringContext({ ...base, documentId: 'd4', sectionId: '' }));
  assert.equal(getInspectionSession().notes, '');
  clearInspectionSession(); assert.equal(getInspectionSession(), null);
});
test('generates navigation only from exact required IDs', () => {
  assert.equal(engineeringNavigationTarget({ projectId: 'p1', documentId: 'd1' }).view, 'engineering');
  assert.equal(engineeringNavigationTarget({ projectId: 'p1' }), null);
});
test('reports current transient context metrics', () => {
  const metrics = engineeringContextMetrics(createEngineeringContext(base));
  assert.equal(metrics.activeEngineeringContext, 1); assert.equal(metrics.contextHasSpecifications, 1);
  assert.equal(engineeringContextMetrics(null).activeEngineeringContext, 0);
});
test('returns deterministic identifier ordering', () => {
  const context = createEngineeringContext(base);
  assert.deepEqual(context.documentIds, [...context.documentIds].sort());
  assert.deepEqual(context.sectionIds, [...context.sectionIds].sort());
});
