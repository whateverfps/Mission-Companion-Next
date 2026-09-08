import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDrawingWorkspaceProviders } from '../src/drawing-workspace-providers.js';

test('specification provider failure preserves valid drawing documents', async () => {
  const failures = []; const documents = [{ id: 'b61', documentType: 'drawing-set' }];
  const result = await loadDrawingWorkspaceProviders({ loadDocuments: async () => documents, loadSections: async () => { throw new Error('Index unavailable'); }, onFailure: failure => failures.push(failure) });
  assert.equal(result.status, 'partial'); assert.deepEqual(result.documents, documents); assert.deepEqual(result.sections, []);
  assert.equal(result.providerFailures[0].contained, true); assert.equal(failures.length, 1);
});

test('rejected and malformed providers return a contained unavailable result', async () => {
  const rejected = await loadDrawingWorkspaceProviders({ loadDocuments: async () => Promise.reject(new Error('Documents failed')) });
  assert.equal(rejected.status, 'unavailable'); assert.equal(rejected.providerFailures[0].provider, 'documents');
  const malformed = await loadDrawingWorkspaceProviders({ loadDocuments: async () => ({ id: 'not-an-array' }) });
  assert.equal(malformed.status, 'unavailable'); assert.deepEqual(malformed.documents, []);
});

test('successful providers remain complete and bounded', async () => {
  const result = await loadDrawingWorkspaceProviders({ loadDocuments: async () => [{ id: 'b61' }], loadSections: async documents => [{ id: `section-for-${documents[0].id}` }] });
  assert.equal(result.documents.length, 1); assert.equal(result.sections.length, 1); assert.deepEqual(result.warnings, []);
});
