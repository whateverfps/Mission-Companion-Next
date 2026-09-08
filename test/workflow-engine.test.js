import test from 'node:test';
import assert from 'node:assert/strict';
import { clearWorkflowSession, createWorkflow, getWorkflowSession, startWorkflowSession, updateWorkflowNotes, workflowMetrics, workflowNavigationTarget, WORKFLOW_TYPES } from '../src/workflow-engine.js';

const documents = [
  { id: 'spec', category: 'Specifications', lineageId: 'family' },
  { id: 'draw', type: 'Drawing' },
  { id: 'sub', tags: ['Submittal'] },
  { id: 'rfi', category: 'RFI' }
];
const context = {
  projectId: 'p', documentId: 'spec', sectionId: 's1',
  documentIds: ['rfi', 'draw', 'spec', 'sub'], sectionIds: ['s2', 's1'],
  evidenceIds: ['e2', 'e1'], relationshipIds: ['rel2', 'rel1'], versionIds: ['old', 'spec'], warnings: []
};
const revisions = [{ comparable: true, earlierDocument: { id: 'old' }, laterDocument: { id: 'spec' } }];
const sections = [{ id: 's1', documentId: 'spec' }, { id: 's2', documentId: 'draw' }];
const make = type => createWorkflow({ workflowType: type, engineeringContext: context, documents, sections, revisionComparisons: revisions });

test('creates a valid identifier-only workflow', () => {
  const workflow = make('Inspection Preparation');
  assert.equal(workflow.status, 'Ready'); assert.equal(workflow.seedDocumentId, 'spec');
  assert.equal('engineeringContext' in workflow, false);
});
test('invalid context and unsupported types are unavailable', () => {
  assert.equal(createWorkflow({ workflowType: 'Owner QA Review' }).status, 'Unavailable');
  assert.equal(createWorkflow({ workflowType: 'Unknown', engineeringContext: context }).status, 'Unavailable');
});
test('Owner QA Review requires only an exact context', () => assert.equal(make('Owner QA Review').status, 'Ready'));
test('Specification Review uses exact classification', () => { assert.deepEqual(make('Specification Review').requiredDocumentIds, ['spec']); assert.deepEqual(make('Specification Review').requiredSectionIds, ['s1']); });
test('Drawing Review uses exact classification', () => { assert.deepEqual(make('Drawing Review').requiredDocumentIds, ['draw']); assert.deepEqual(make('Drawing Review').requiredSectionIds, ['s2']); });
test('Submittal Review uses exact category type or tags', () => assert.deepEqual(make('Submittal Review').requiredDocumentIds, ['sub']));
test('RFI Review uses exact category type or tags', () => assert.deepEqual(make('RFI Review').requiredDocumentIds, ['rfi']));
test('Inspection Preparation requires document and section identifiers', () => assert.equal(make('Inspection Preparation').status, 'Ready'));
test('Version Review requires explicit lineage identifiers', () => assert.deepEqual(make('Version Review').lineageIds, ['family']));
test('Relationship Investigation requires exact relationship identifiers', () => assert.deepEqual(make('Relationship Investigation').relationshipIds, ['rel1', 'rel2']));
test('Evidence Review requires exact evidence identifiers', () => assert.deepEqual(make('Evidence Review').evidenceIds, ['e1', 'e2']));
test('missing template groups classify a valid workflow as incomplete', () => {
  const result = createWorkflow({ workflowType: 'Drawing Review', engineeringContext: { ...context, documentIds: ['spec'] }, documents });
  assert.equal(result.status, 'Incomplete'); assert.deepEqual(result.missingGroups, ['drawingDocuments']);
});
test('integrates exact revisions and deterministic ordering', () => {
  const workflow = make('Owner QA Review');
  assert.deepEqual(workflow.revisionIds, ['old->spec']);
  assert.deepEqual(workflow.requiredDocumentIds, [...workflow.requiredDocumentIds].sort());
  assert.deepEqual(workflow.requiredSectionIds, ['s1', 's2']);
});
test('temporary notes clear when a workflow session is replaced', () => {
  clearWorkflowSession(); startWorkflowSession(make('Owner QA Review')); updateWorkflowNotes('temporary');
  assert.equal(getWorkflowSession().notes, 'temporary'); startWorkflowSession(make('Evidence Review'));
  assert.equal(getWorkflowSession().notes, ''); clearWorkflowSession(); assert.equal(getWorkflowSession(), null);
});
test('transient navigation supports only known workflow types', () => {
  assert.deepEqual(workflowNavigationTarget({ workflowType: 'Evidence Review', origin: 'engineering' }), { view: 'workflow', workflowType: 'Evidence Review', origin: 'engineering' });
  assert.equal(workflowNavigationTarget({ workflowType: 'Unknown' }), null);
});
test('current-state metrics report objective availability only', () => {
  const metrics = workflowMetrics(make('Owner QA Review'));
  assert.equal(metrics.activeWorkflow, 1); assert.equal(metrics.workflowReady, 1);
  assert.equal(metrics.workflowEvidence, 1); assert.equal(metrics.workflowRelationships, 1);
  assert.equal(metrics.workflowLineage, 1); assert.equal(metrics.workflowRevisions, 1);
});
test('all supported templates produce deterministic workflow objects', () => {
  assert.deepEqual(WORKFLOW_TYPES.map(type => make(type).workflowType), WORKFLOW_TYPES);
});
