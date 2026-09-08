import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTEXT_BUS_CONSUMERS, contextBusMetrics, createContextBusSnapshot, selectSynchronizedWorkflow } from '../src/context-bus.js';

const document = (id, category = '') => ({ id, category });
const base = (extra = {}) => ({
  projectId: 'p', libraryId: 'l', documentId: 'd', sectionId: 's', evidenceId: '',
  documentIds: ['d'], sectionIds: ['s'], evidenceIds: [], relationshipIds: [],
  versionIds: ['d'], classification: { specifications: [], drawings: [], procedures: [], unclassified: [{ documentId: 'd' }] },
  ...extra
});
const snapshot = (context = base(), extra = {}) => createContextBusSnapshot({
  engineeringContext: context,
  activation: { source: 'Evidence' },
  documents: [document('d')],
  ...extra
});

test('creates an identifier-only bus snapshot without copying Engineering Context', () => {
  const context = base({ buildingId: 'building', warnings: ['warning'] });
  const result = snapshot(context);
  assert.equal(result.active, true);
  assert.deepEqual(Object.keys(result.context), ['projectId','libraryId','documentId','sectionId','evidenceId','relationshipIds','lineageIds','revisionIds','activationSource']);
  assert.equal(result.context.buildingId, undefined);
  assert.notEqual(result.context, context);
});

test('keeps synchronized consumers in deterministic order', () => {
  assert.deepEqual(snapshot().synchronizedConsumers, [...CONTEXT_BUS_CONSUMERS]);
  assert.deepEqual([...CONTEXT_BUS_CONSUMERS].sort(), [...CONTEXT_BUS_CONSUMERS]);
});

test('synchronizes retrieval evidence and all requested workspaces', () => {
  const result = snapshot(base({ evidenceId: 'e', evidenceIds: ['e'] }));
  assert.equal(result.context.evidenceId, 'e');
  for (const consumer of ['Engineering Workspace','Workflow Workspace','Source Inspector','Relationship Explorer','Version Explorer','Revision Review','Evidence Explorer','Command Desk','Knowledge Validation']) assert.ok(result.synchronizedConsumers.includes(consumer));
});

test('selects each exact specialized workflow uniquely', () => {
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base({ classification: { specifications: [{ documentId: 'd' }], drawings: [] } }) }).workflowType, 'Specification Review');
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base({ classification: { specifications: [], drawings: [{ documentId: 'd' }] } }) }).workflowType, 'Drawing Review');
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base(), documents: [document('d', 'submittal')] }).workflowType, 'Submittal Review');
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base(), documents: [document('d', 'rfi')] }).workflowType, 'RFI Review');
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base(), documents: [document('d', 'owner qa')] }).workflowType, 'Owner QA Review');
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base({ versionIds: ['d','old'] }) }).workflowType, 'Version Review');
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base({ relationshipIds: ['r'] }) }).workflowType, 'Relationship Investigation');
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base({ evidenceIds: ['e'] }) }).workflowType, 'Evidence Review');
});

test('falls back to Inspection Preparation for document or section context only', () => {
  assert.equal(selectSynchronizedWorkflow({ engineeringContext: base() }).workflowType, 'Inspection Preparation');
});

test('returns Select Workflow when multiple specialized templates qualify', () => {
  const result = selectSynchronizedWorkflow({ engineeringContext: base({ evidenceIds: ['e'], relationshipIds: ['r'] }) });
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.reason, 'Select Workflow');
  assert.deepEqual(result.candidates, ['Evidence Review', 'Relationship Investigation']);
});

test('reports unavailable synchronization and clearing without retained context', () => {
  const result = createContextBusSnapshot();
  assert.equal(result.active, false);
  assert.equal(result.context, null);
  assert.deepEqual(result.synchronizedConsumers, []);
  assert.deepEqual(result.unsynchronizedConsumers, [...CONTEXT_BUS_CONSUMERS]);
});

test('reports only current synchronization metrics', () => {
  assert.deepEqual(contextBusMetrics(snapshot()), { activeSynchronization: 1, synchronizedModules: 9, unsynchronizedModules: 0, activationSource: 'Evidence' });
  assert.equal(contextBusMetrics(createContextBusSnapshot()).unsynchronizedModules, 9);
});

test('orders identifier collections deterministically', () => {
  const result = snapshot(base({ relationshipIds: ['z','a','z'], versionIds: ['d','v'] }), { documents: [{ id: 'd', lineageId: 'lineage' }, { id: 'v', lineageId: 'lineage' }], revisionIds: ['z','a'] });
  assert.deepEqual(result.context.relationshipIds, ['a','z']);
  assert.deepEqual(result.context.lineageIds, ['lineage']);
  assert.deepEqual(result.context.revisionIds, ['a','z']);
});
