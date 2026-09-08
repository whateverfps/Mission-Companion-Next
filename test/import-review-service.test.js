import test from 'node:test';
import assert from 'node:assert/strict';
import { createImportBatch, analyzeImportBatch, correctImportFile, acceptImportBatch } from '../src/import-review-service.js';

const file = (name, content, type = 'text/csv') => new File([content], name, { type, lastModified: 1 });

test('import batch preserves each original source separately', () => {
  const batch = createImportBatch({ projectId: 'bedford', libraryId: 'library', sourceSystem: 'Procore', files: [file('Submittal Log.csv', 'Spec,Title\n01 33 23,Shop drawings'), file('RFI Log.csv', 'ID,Title\nRFI-1,Question')] });
  assert.equal(batch.sourceSystem, 'Procore');
  assert.equal(batch.files.length, 2);
  assert.equal(batch.files[0].originalName, 'Submittal Log.csv');
});

test('analysis classifies, maps, preserves provenance, and detects exact duplicate fingerprints', async () => {
  const source = file('Submittal Log.csv', 'Spec,Title\n01 33 23,Shop drawings');
  const batch = createImportBatch({ projectId: 'bedford', libraryId: 'library', files: [source] });
  const analyzed = await analyzeImportBatch(batch, { existingDocuments: [{ contentHash: 'not-this-hash' }] });
  assert.equal(analyzed.files[0].classification.detectedType, 'submittal');
  assert.equal(analyzed.files[0].mapping.destination, 'Submittals');
  assert.equal(analyzed.files[0].sourceIdentity.originalName, 'Submittal Log.csv');
  const duplicate = await analyzeImportBatch(createImportBatch({ projectId: 'bedford', libraryId: 'library', files: [source] }), { existingDocuments: [{ contentHash: analyzed.files[0].sourceIdentity.fingerprint }] });
  assert.equal(duplicate.files[0].duplicate.kind, 'exact');
});

test('mapping correction retains original extracted classification', async () => {
  const batch = await analyzeImportBatch(createImportBatch({ projectId: 'bedford', libraryId: 'library', files: [file('Project Export.csv', 'A,B\n1,2')] }));
  const original = batch.files[0].classification.detectedType;
  correctImportFile(batch, batch.files[0].id, { documentType: 'submittal', destination: 'Submittals' });
  assert.equal(batch.files[0].classification.detectedType, 'submittal');
  assert.equal(batch.files[0].corrections[0].original, original);
  assert.equal(batch.files[0].sourceIdentity.originalName, 'Project Export.csv');
});

test('acceptance delegates to the existing engine and leaves unaccepted files out', async () => {
  const source = file('Submittal Log.csv', 'Spec,Title\n01 33 23,Shop drawings');
  const batch = await analyzeImportBatch(createImportBatch({ projectId: 'bedford', libraryId: 'library', files: [source] }));
  let received = 0;
  const result = await acceptImportBatch(batch, { engine: { ingest: async files => { received = files.length; return { documents: [] }; } } });
  assert.equal(received, 1);
  assert.equal(result.batch.status, 'accepted');
});
