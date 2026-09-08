import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeRelationships,
  buildRelationshipGraph,
  relationshipContext,
  relationshipNavigationTarget
} from '../src/knowledge-relationships.js';

const documents = [
  { id: 'doc-a', name: 'A.pdf', libraryId: 'library-1' },
  { id: 'doc-b', name: 'B.pdf', libraryId: 'library-1' },
  { id: 'doc-c', name: 'C.pdf', libraryId: 'library-2' }
];
const sections = [
  { id: 'root', documentId: 'doc-a', division: '01', sectionNumber: '01 00 00' },
  { id: 'child', documentId: 'doc-a', parentId: 'root', division: '01', crossReferenceIds: ['target'], crossReferences: ['01 20 00'] },
  { id: 'target', documentId: 'doc-b', division: '01', sectionNumber: '01 20 00' },
  { id: 'unique-source', documentId: 'doc-c', crossReferences: ['01-20-00'] }
];

test('looks up an exact parent', () => {
  const context = relationshipContext(buildKnowledgeRelationships({ documents, sections }), {
    documentId: 'doc-a', sectionId: 'child'
  });
  assert.equal(context.parent.id, 'root');
});

test('looks up exact children', () => {
  const context = relationshipContext(buildKnowledgeRelationships({ documents, sections }), {
    documentId: 'doc-a', sectionId: 'root'
  });
  assert.deepEqual(context.children.map(item => item.id), ['child']);
});

test('resolves an exact crossReferenceId first', () => {
  const model = buildKnowledgeRelationships({ documents, sections });
  assert.ok(model.explicitReferences.some(edge =>
    edge.from === 'child' && edge.to === 'target' && edge.sourceKind === 'crossReferenceId'
  ));
});

test('resolves an exact unique normalized section number', () => {
  const model = buildKnowledgeRelationships({ documents, sections });
  assert.ok(model.explicitReferences.some(edge =>
    edge.from === 'unique-source' && edge.to === 'target' && edge.sourceKind === 'sectionNumber'
  ));
});

test('does not choose among ambiguous exact section numbers', () => {
  const model = buildKnowledgeRelationships({
    documents,
    sections: [...sections, { id: 'target-2', documentId: 'doc-c', sectionNumber: '01 20 00' }]
  });
  assert.ok(model.validation.ambiguousReferences.some(item => item.sectionId === 'unique-source'));
  assert.ok(!model.validation.ambiguousReferences.some(item => item.sectionId === 'child'));
  assert.ok(!model.explicitReferences.some(edge => edge.from === 'unique-source'));
});

test('reports broken exact reference IDs and unresolved numbers', () => {
  const model = buildKnowledgeRelationships({
    documents,
    sections: [...sections, {
      id: 'broken', documentId: 'doc-a', crossReferenceIds: ['missing'], crossReferences: ['99 99 99']
    }]
  });
  assert.equal(model.validation.brokenReferences.length, 1);
  assert.equal(model.validation.unresolvedReferences.length, 1);
});

test('builds reverse references only from resolved edges', () => {
  const model = buildKnowledgeRelationships({ documents, sections });
  assert.ok(model.reverseReferences.some(edge => edge.from === 'target' && edge.to === 'child'));
});

test('derives cross-document relationships from resolved section references', () => {
  const model = buildKnowledgeRelationships({ documents, sections });
  assert.ok(model.documentReferences.some(edge => edge.from === 'doc-a' && edge.to === 'doc-b'));
});

test('reports duplicate explicit reference entries', () => {
  const model = buildKnowledgeRelationships({
    documents,
    sections: [...sections, { id: 'duplicate', documentId: 'doc-a', crossReferenceIds: ['target', 'target'] }]
  });
  assert.equal(model.validation.duplicateReferences[0].count, 2);
});

test('reports orphaned hierarchy', () => {
  const model = buildKnowledgeRelationships({
    documents,
    sections: [...sections, { id: 'orphan', documentId: 'doc-a', parentId: 'missing' }]
  });
  assert.equal(model.validation.orphanedHierarchy[0].sectionId, 'orphan');
});

test('detects circular parent chains', () => {
  const model = buildKnowledgeRelationships({
    documents,
    sections: [
      { id: 'one', documentId: 'doc-a', parentId: 'two' },
      { id: 'two', documentId: 'doc-a', parentId: 'one' }
    ]
  });
  assert.equal(model.validation.circularParentChains.length, 1);
});

test('detects circular explicit references', () => {
  const model = buildKnowledgeRelationships({
    documents,
    sections: [
      { id: 'one', documentId: 'doc-a', crossReferenceIds: ['two'] },
      { id: 'two', documentId: 'doc-b', crossReferenceIds: ['one'] }
    ]
  });
  assert.equal(model.validation.circularReferences.length, 1);
});

test('generates a deterministic graph with a text alternative', () => {
  const model = buildKnowledgeRelationships({ documents, sections });
  const first = buildRelationshipGraph(model, { documentId: 'doc-a' });
  const second = buildRelationshipGraph(model, { documentId: 'doc-a' });
  assert.deepEqual(first, second);
  assert.equal(first.textAlternative.length, first.edges.length);
});

test('generates transient navigation targets only with a document ID', () => {
  assert.equal(relationshipNavigationTarget({ sectionId: 'child' }), null);
  assert.deepEqual(
    relationshipNavigationTarget({ documentId: 'doc-a', sectionId: 'child' }),
    {
      documentId: 'doc-a', sectionId: 'child', origin: 'relationships',
      knowledgeView: 'knowledge', sourceView: 'sources', relationshipView: 'relationships'
    }
  );
});
