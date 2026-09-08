import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRetrievalSession,
  evidenceNavigationTarget
} from '../src/retrieval-session.js';

const documents = [
  { id: 'doc-1', name: 'requirements.pdf', libraryId: 'library-1' },
  { id: 'doc-2', name: 'manual.docx', libraryId: 'library-1' }
];
const libraries = [{ id: 'library-1', name: 'Project Library' }];

function hit(sourceNumber, documentId = 'doc-1', overrides = {}) {
  return {
    id: `section-${sourceNumber}`,
    documentId,
    documentName: documents.find(item => item.id === documentId)?.name,
    libraryId: 'library-1',
    sourceNumber,
    heading: `Heading ${sourceNumber}`,
    text: `Stored evidence text ${sourceNumber}`,
    score: 90 - sourceNumber,
    path: ['Requirements', `Heading ${sourceNumber}`],
    sectionNumber: `01 00 0${sourceNumber}`,
    ...overrides
  };
}

function session(overrides = {}) {
  return createRetrievalSession({
    question: 'What is required?',
    timestamp: '2026-07-31T12:00:00.000Z',
    project: { id: 'project-1', name: 'Project One' },
    library: libraries[0],
    mode: 'offline',
    messageId: 'message-1',
    hits: [hit(1), hit(2, 'doc-2'), hit(3)],
    citations: [1, 2, 3],
    citationVerification: {
      coverage: 90,
      invalid: [],
      materialClaims: 3,
      passed: true,
      uncited: [],
      used: [1, 2, 3]
    },
    retrievalMeta: {
      totalCandidates: 14,
      totalSectionsAvailable: 80,
      totalSectionsSearched: 32,
      hierarchyFirst: true,
      retrievalVersion: '3.0'
    },
    documents,
    libraries,
    sections: [
      { id: 'parent-1', heading: 'Parent heading' }
    ],
    ...overrides
  });
}

test('retrieval session captures ephemeral query context and production counts', () => {
  const result = session();
  assert.equal(result.question, 'What is required?');
  assert.equal(result.project.name, 'Project One');
  assert.equal(result.library.name, 'Project Library');
  assert.equal(result.candidateSections, 32);
  assert.equal(result.matchedSections, 14);
  assert.equal(result.evidenceUsed, 3);
});

test('evidence preserves engine hit ordering exactly', () => {
  const result = session({
    hits: [hit(3), hit(1), hit(2)]
  });
  assert.deepEqual(
    result.evidence.map(item => item.sourceNumber),
    [3, 1, 2]
  );
});

test('evidence mapping uses stored section text and source metadata', () => {
  const result = session({
    hits: [hit(1, 'doc-1', { parentId: 'parent-1' })]
  });
  assert.equal(result.evidence[0].fullText, 'Stored evidence text 1');
  assert.equal(result.evidence[0].libraryName, 'Project Library');
  assert.deepEqual(result.evidence[0].hierarchyPath, [
    'Requirements',
    'Heading 1'
  ]);
  assert.equal(result.evidence[0].parentHeading, 'Parent heading');
  assert.equal(result.evidence[0].documentMetadata.extension, '');
});

test('citation validation distinguishes cited, uncited, and invalid references', () => {
  const result = session({
    citations: [1, 9],
    citationVerification: {
      coverage: 50,
      invalid: [9],
      materialClaims: 2,
      passed: false,
      uncited: ['A material claim without a citation.'],
      used: [1]
    }
  });
  assert.equal(result.evidence[0].retrievalStatus, 'Cited in answer');
  assert.equal(result.evidence[1].retrievalStatus, 'Retrieved, not cited');
  assert.deepEqual(result.citationVerification.invalid, [9]);
  assert.equal(result.citationVerification.uncited.length, 1);
});

test('empty retrieval produces no supporting evidence', () => {
  const result = session({
    hits: [],
    citations: [],
    citationVerification: {
      coverage: 100,
      used: [],
      invalid: [],
      uncited: []
    }
  });
  assert.equal(result.coverageClassification, 'No Supporting Evidence');
  assert.equal(result.evidence.length, 0);
});

test('evidence navigation targets existing Knowledge and Source views', () => {
  const result = session();
  assert.deepEqual(
    evidenceNavigationTarget(result, 'section-1'),
    {
      documentId: 'doc-1',
      knowledgeView: 'knowledge',
      sourceView: 'sources'
    }
  );
  assert.equal(evidenceNavigationTarget(result, 'missing'), null);
});

test('evidence classification follows deterministic citation thresholds', () => {
  assert.equal(session().coverageClassification, 'High Evidence');
  assert.equal(session({
    hits: [hit(1), hit(2)],
    citations: [1, 2],
    citationVerification: { coverage: 60, used: [1, 2] }
  }).coverageClassification, 'Moderate Evidence');
  assert.equal(session({
    hits: [hit(1)],
    citations: [],
    citationVerification: { coverage: 0, used: [] }
  }).coverageClassification, 'Limited Evidence');
});
