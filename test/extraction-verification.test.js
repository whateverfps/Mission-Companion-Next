import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateExtractionVerification,
  buildSectionPreview,
  verifyExtraction
} from '../src/extraction-verification.js';

function document(overrides = {}) {
  return {
    id: 'doc-1',
    projectId: 'project-1',
    libraryId: 'library-1',
    name: 'requirements.txt',
    status: 'verified',
    characterCount: 240,
    sectionCount: 1,
    headingCount: 1,
    hierarchyVersion: 1,
    health: 'healthy',
    ...overrides
  };
}

function section(overrides = {}) {
  return {
    id: 'section-1',
    documentId: 'doc-1',
    documentName: 'requirements.txt',
    projectId: 'project-1',
    libraryId: 'library-1',
    heading: 'Requirements',
    text: 'A'.repeat(240),
    characters: 240,
    order: 0,
    level: 1,
    hierarchyType: 'heading',
    hierarchyVersion: 1,
    path: ['Requirements'],
    ...overrides
  };
}

test('ready document with valid sections passes extraction verification', () => {
  const sourceDocument = document();
  const report = verifyExtraction(
    sourceDocument,
    [section()],
    [sourceDocument]
  );

  assert.equal(report.verificationStatus, 'Ready');
  assert.equal(report.retrievalReadiness, 'Retrieval ready');
  assert.equal(report.failCount, 0);
});

test('text document with no sections is explicitly diagnosed', () => {
  const sourceDocument = document({ sectionCount: 0 });
  const report = verifyExtraction(sourceDocument, [], [sourceDocument]);

  assert.equal(report.verificationStatus, 'Failed');
  assert.equal(report.retrievalReadiness, 'Not retrieval ready');
  assert.ok(report.checks.some(item =>
    item.label === 'Indexed sections stored' &&
    item.status === 'WARNING'
  ));
});

test('indexed document with zero usable text is not retrieval ready', () => {
  const sourceDocument = document({
    characterCount: 0
  });
  const report = verifyExtraction(
    sourceDocument,
    [section({ text: '', characters: 0 })],
    [sourceDocument]
  );

  assert.equal(report.verificationStatus, 'Failed');
  assert.equal(report.usableText, false);
  assert.equal(report.retrievalReadiness, 'Not retrieval ready');
});

test('empty sections are counted and produce a warning', () => {
  const sourceDocument = document({ sectionCount: 2 });
  const report = verifyExtraction(
    sourceDocument,
    [
      section(),
      section({
        id: 'section-2',
        heading: 'Empty',
        text: '   ',
        characters: 0,
        order: 1
      })
    ],
    [sourceDocument]
  );

  assert.equal(report.emptySections.length, 1);
  assert.ok(report.checks.some(item =>
    item.label === 'Empty sections present' &&
    item.status === 'WARNING'
  ));
});

test('untitled sections are detected from raw production title fields', () => {
  const sourceDocument = document();
  const report = verifyExtraction(
    sourceDocument,
    [section({ heading: '' })],
    [sourceDocument]
  );

  assert.equal(report.untitledSections.length, 1);
  assert.equal(report.previews[0].title, 'Untitled section');
});

test('duplicate section identifiers produce an explainable failure', () => {
  const sourceDocument = document({ sectionCount: 2 });
  const report = verifyExtraction(
    sourceDocument,
    [
      section(),
      section({ heading: 'Second', order: 1 })
    ],
    [sourceDocument]
  );

  assert.deepEqual(report.duplicateSectionIds, ['section-1']);
  assert.equal(report.verificationStatus, 'Failed');
});

test('orphaned sections and invalid document links are detected at aggregate scope', () => {
  const sourceDocument = document();
  const aggregate = aggregateExtractionVerification(
    [sourceDocument],
    [
      section(),
      section({
        id: 'orphan',
        documentId: 'missing-document'
      }),
      section({
        id: 'invalid-link',
        libraryId: 'other-library',
        order: 2
      })
    ]
  );

  assert.equal(aggregate.orphanedSections, 1);
  assert.equal(aggregate.invalidDocumentLinks, 1);
});

test('recorded and stored section-count mismatch produces a warning', () => {
  const sourceDocument = document({ sectionCount: 3 });
  const report = verifyExtraction(
    sourceDocument,
    [section()],
    [sourceDocument]
  );

  assert.equal(report.sectionCountMismatch, true);
  assert.ok(report.checks.some(item =>
    item.label === 'Document and section counts agree' &&
    item.status === 'WARNING'
  ));
});

test('failed extraction status remains failed without stored sections', () => {
  const sourceDocument = document({
    status: 'error',
    error: 'Unsupported file type',
    characterCount: 0,
    sectionCount: 0
  });
  const report = verifyExtraction(
    sourceDocument,
    [],
    [sourceDocument]
  );

  assert.equal(report.verificationStatus, 'Failed');
  assert.equal(report.retrievalReadiness, 'Not retrieval ready');
  assert.ok(report.checks.some(item =>
    item.label === 'Extraction completed without errors' &&
    item.status === 'FAIL'
  ));
});

test('retrieval readiness distinguishes ready, limited, and unavailable records', () => {
  const readyDocument = document();
  const limitedDocument = document({
    id: 'doc-2',
    name: 'limited.txt',
    status: 'pending',
    sectionCount: 0
  });
  const unknownDocument = document({
    id: 'doc-3',
    name: 'unknown.txt',
    status: '',
    characterCount: 0,
    sectionCount: 0
  });

  assert.equal(
    verifyExtraction(
      readyDocument,
      [section()],
      [readyDocument]
    ).retrievalReadiness,
    'Retrieval ready'
  );
  assert.equal(
    verifyExtraction(
      limitedDocument,
      [],
      [limitedDocument]
    ).retrievalReadiness,
    'Retrieval limited'
  );
  assert.equal(
    verifyExtraction(
      unknownDocument,
      [],
      [unknownDocument]
    ).retrievalReadiness,
    'Readiness unavailable'
  );
});

test('missing optional metadata is informational and does not create failure', () => {
  const sourceDocument = document();
  const report = verifyExtraction(
    sourceDocument,
    [section()],
    [sourceDocument]
  );
  const pageCheck = report.checks.find(item =>
    item.label === 'Page metadata'
  );

  assert.equal(pageCheck.status, 'INFO');
  assert.equal(report.verificationStatus, 'Ready');
  assert.equal(report.failCount, 0);
});

test('section preview remains plain text, deterministic, and non-mutating', () => {
  const storedText = '<script>alert("x")</script> ' + 'Evidence '.repeat(30);
  const sourceSection = section({ text: storedText });
  const first = buildSectionPreview(sourceSection, 0, 80, [sourceSection]);
  const second = buildSectionPreview(sourceSection, 0, 80, [sourceSection]);

  assert.equal(first.excerpt, second.excerpt);
  assert.equal(first.excerpt.length, 80);
  assert.match(first.excerpt, /^<script>/);
  assert.ok(first.excerpt.endsWith('…'));
  assert.equal(sourceSection.text, storedText);
});
