import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRevisions,
  revisionMatchRuleLabel,
  revisionNavigationTarget
} from '../src/revision-comparison.js';

const earlier = { id: 'old', lineageId: 'family', libraryId: 'lib', parser: 'docx' };
const later = { id: 'new', lineageId: 'family', previousDocumentId: 'old', libraryId: 'lib', parser: 'docx' };
const docs = [earlier, later];
const section = (documentId, id, extra = {}) => ({ documentId, id, text: `Text ${id}`, ...extra });
const compare = sections => compareRevisions({ earlierDocument: earlier, laterDocument: later, documents: docs, sections });

test('requires two available documents in one explicit linked lineage', () => {
  assert.equal(compare([]).comparable, true);
  assert.equal(compareRevisions({ earlierDocument: earlier, laterDocument: { ...later, lineageId: '' }, documents: docs }).comparable, false);
  assert.equal(compareRevisions({ earlierDocument: earlier, laterDocument: { ...later, previousDocumentId: 'other' }, documents: docs }).comparable, false);
  assert.equal(compareRevisions({ earlierDocument: earlier, laterDocument: later, documents: [later] }).comparable, false);
});

test('matches exact unique section IDs first', () => {
  const result = compare([section('old', 'same'), section('new', 'same')]);
  assert.equal(result.matches[0].matchRule, 'exact-section-id');
});

test('matches unique normalized section numbers', () => {
  const result = compare([section('old', 'a', { sectionNumber: ' 01  20 00 ' }), section('new', 'b', { sectionNumber: '01 20 00' })]);
  assert.equal(result.matches[0].matchRule, 'unique-section-number');
});

test('matches unique normalized hierarchy paths', () => {
  const result = compare([section('old', 'a', { path: ['Part 1', 'General'] }), section('new', 'b', { path: [' Part 1 ', 'General'] })]);
  assert.equal(result.matches[0].matchRule, 'unique-hierarchy-path');
});

test('matches unique exact normalized content fingerprints', () => {
  const result = compare([section('old', 'a', { text: 'Exact  stored\ntext' }), section('new', 'b', { text: 'Exact stored text' })]);
  assert.equal(result.matches[0].matchRule, 'unique-content-fingerprint');
});

test('marks duplicate section numbers ambiguous without falling through', () => {
  const result = compare([
    section('old', 'a', { sectionNumber: '1', path: ['A'] }),
    section('old', 'b', { sectionNumber: '1', path: ['B'] }),
    section('new', 'c', { sectionNumber: '1', path: ['A'] })
  ]);
  assert.equal(result.ambiguous[0].rule, 'unique-section-number');
  assert.equal(result.matches.length, 0);
});

test('marks duplicate hierarchy paths ambiguous', () => {
  const result = compare([
    section('old', 'a', { path: ['A'] }), section('old', 'b', { path: ['A'] }),
    section('new', 'c', { path: ['A'] })
  ]);
  assert.equal(result.ambiguous[0].rule, 'unique-hierarchy-path');
});

test('classifies unpaired later sections as added and unmatched', () => {
  const result = compare([section('new', 'added')]);
  assert.equal(result.summary.added, 1);
  assert.deepEqual(result.added[0].flags, ['added', 'unmatched']);
});

test('classifies unpaired earlier sections as removed and unmatched', () => {
  const result = compare([section('old', 'removed')]);
  assert.equal(result.summary.removed, 1);
  assert.deepEqual(result.removed[0].flags, ['removed', 'unmatched']);
});

test('classifies objectively identical sections as unchanged', () => {
  const base = { sectionNumber: '1', title: 'Title', text: 'Same', order: 1 };
  const result = compare([section('old', 'same', base), section('new', 'same', base)]);
  assert.deepEqual(result.matches[0].flags, ['unchanged']);
});

test('detects stored content changes', () => {
  const result = compare([section('old', 'same', { text: 'Before' }), section('new', 'same', { text: 'After' })]);
  assert.ok(result.matches[0].flags.includes('content-changed'));
});

test('detects structural changes', () => {
  const result = compare([section('old', 'same', { path: ['A'], order: 1 }), section('new', 'same', { path: ['B'], order: 2 })]);
  assert.ok(result.matches[0].flags.includes('structurally-changed'));
});

test('detects exact reference changes', () => {
  const result = compare([section('old', 'same', { crossReferenceIds: ['x'] }), section('new', 'same', { crossReferenceIds: ['y'] })]);
  assert.ok(result.matches[0].flags.includes('reference-changed'));
  assert.deepEqual(result.matches[0].referenceDifferences.crossReferenceIds.added, ['y']);
});

test('detects extraction warning and parser metadata changes', () => {
  const result = compare([
    section('old', 'same', { warnings: ['old'], parser: 'plain' }),
    section('new', 'same', { warnings: ['new'], parser: 'docx' })
  ]);
  assert.ok(result.matches[0].flags.includes('extraction-changed'));
});

test('returns matches in deterministic earlier-section order', () => {
  const result = compare([
    section('old', 'b', { order: 2 }), section('new', 'b', { order: 2 }),
    section('old', 'a', { order: 1 }), section('new', 'a', { order: 1 })
  ]);
  assert.deepEqual(result.matches.map(item => item.earlierSectionId), ['a', 'b']);
});

test('generates transient navigation targets only for two exact IDs', () => {
  assert.deepEqual(revisionNavigationTarget('old', 'new'), {
    view: 'revisions', earlierDocumentId: 'old', laterDocumentId: 'new', originatingWorkspace: 'versions'
  });
  assert.equal(revisionNavigationTarget('', 'new'), null);
});

test('maps stored matching rules to clear presentation labels', () => {
  assert.deepEqual(
    [
      'exact-section-id',
      'unique-section-number',
      'unique-hierarchy-path',
      'unique-content-fingerprint'
    ].map(revisionMatchRuleLabel),
    [
      'Matched by exact section ID',
      'Matched by section number',
      'Matched by hierarchy path',
      'Matched by exact content fingerprint'
    ]
  );
  assert.equal(revisionMatchRuleLabel('unsupported-rule'), '');
});
