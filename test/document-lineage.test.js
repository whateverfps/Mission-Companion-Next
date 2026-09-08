import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDocumentLineage,
  compareDocumentVersions,
  lineageForDocument,
  lineageNavigationTarget
} from '../src/document-lineage.js';

const previous = {
  id: 'doc-1', name: 'spec.pdf', size: 100, lastModified: 10,
  contentHash: 'same', lineageId: 'family-1', lineageStatus: 'superseded',
  supersededByDocumentId: 'doc-2', sectionCount: 1, characterCount: 100,
  hierarchyVersion: 1, libraryId: 'library-1'
};
const current = {
  id: 'doc-2', name: 'spec.pdf', size: 100, lastModified: 20,
  lineageId: 'family-1', lineageStatus: 'current', previousDocumentId: 'doc-1',
  sectionCount: 2, characterCount: 200, hierarchyVersion: 2,
  libraryId: 'library-1'
};
const sections = [
  { id: 's1', documentId: 'doc-1', division: '01', text: 'Old' },
  { id: 's2', documentId: 'doc-2', division: '01', text: 'New' },
  { id: 's3', documentId: 'doc-2', division: '02', text: 'Added' }
];

test('detects duplicates using exact stored hashes', () => {
  const model = buildDocumentLineage({
    documents: [previous, { ...previous, id: 'copy', lineageId: '', lineageStatus: '' }],
    sections
  });
  assert.deepEqual(model.detectedDuplicates[0].documentIds, ['copy', 'doc-1']);
});

test('builds an explicit lineage chain', () => {
  const model = buildDocumentLineage({ documents: [previous, current], sections });
  const chain = lineageForDocument(model, current.id).chain;
  assert.equal(chain.current.documentId, 'doc-2');
  assert.deepEqual(chain.previous.map(item => item.documentId), ['doc-1']);
});

test('classifies explicit superseded records', () => {
  const model = buildDocumentLineage({ documents: [previous, current], sections });
  assert.equal(lineageForDocument(model, previous.id).record.status, 'superseded');
});

test('compares versions without diffing full text', () => {
  const comparison = compareDocumentVersions(previous, current, {
    documents: [previous, current], sections
  });
  assert.equal(comparison.extractionChanged, true);
  assert.ok(comparison.changes.some(item => item.field === 'Section count' && item.changed));
  assert.ok(!comparison.changes.some(item => item.field === 'Text'));
});

test('classifies documents without explicit lineage metadata as unknown', () => {
  const model = buildDocumentLineage({
    documents: [{ id: 'legacy', name: 'legacy.pdf' }],
    sections: []
  });
  assert.equal(model.records[0].status, 'unknown');
  assert.equal(model.validation.unknownVersions, 1);
});

test('reports broken lineage targets', () => {
  const model = buildDocumentLineage({
    documents: [{ ...current, previousDocumentId: 'missing' }], sections: []
  });
  assert.equal(model.validation.brokenLineage[0].targetId, 'missing');
});

test('does not choose between multiple explicit current records', () => {
  const model = buildDocumentLineage({
    documents: [current, { ...current, id: 'doc-3' }], sections: []
  });
  assert.equal(lineageForDocument(model, current.id).current, null);
  assert.deepEqual(
    model.validation.ambiguousCurrentFamilies[0].documentIds,
    ['doc-2', 'doc-3']
  );
});

test('generates navigation only for an exact document ID', () => {
  assert.deepEqual(lineageNavigationTarget('doc-2'), { documentId: 'doc-2', view: 'versions' });
  assert.equal(lineageNavigationTarget(''), null);
});
