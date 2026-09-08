import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDemonstrationProjectFixture,
  DEMONSTRATION_PROJECT,
  DEMO_INITIAL_DOCUMENT_ID,
  DEMO_INITIAL_SECTION_ID,
  DEMO_PROJECT_ID,
  validateDemonstrationProject
} from '../src/demo-project.js';
import { buildKnowledgeRelationships } from '../src/knowledge-relationships.js';
import { buildDocumentLineage } from '../src/document-lineage.js';
import { compareRevisions } from '../src/revision-comparison.js';
import { createEngineeringContext } from '../src/engineering-context.js';
import { createContextBusSnapshot } from '../src/context-bus.js';
import { retrieve } from '../src/retrieval.js';

test('canonical demonstration fixture is immutable, deterministic, and internally valid', () => {
  const validation = validateDemonstrationProject();
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(Object.isFrozen(DEMONSTRATION_PROJECT), true);
  assert.equal(Object.isFrozen(DEMONSTRATION_PROJECT.documents), true);
  assert.equal(DEMONSTRATION_PROJECT.manifest.project.id, DEMO_PROJECT_ID);
  assert.equal(DEMONSTRATION_PROJECT.manifest.project.isDemonstration, true);
  assert.ok(validation.counts.documents >= 30);
});

test('all fixture identifiers and explicit relationship endpoints resolve', () => {
  const fixture = createDemonstrationProjectFixture();
  const allIds = [fixture.manifest.project.id, ...fixture.libraries.map(item => item.id), ...fixture.documents.map(item => item.id), ...fixture.sections.map(item => item.id)];
  assert.equal(new Set(allIds).size, allIds.length);
  const sectionIds = new Set(fixture.sections.map(item => item.id));
  assert.ok(fixture.sections.every(item => item.crossReferenceIds.every(id => sectionIds.has(id))));
  assert.ok(fixture.sections.every(item => Array.isArray(item.path) && item.path.every(part => typeof part === 'string')));
  const relationships = buildKnowledgeRelationships(fixture);
  assert.equal(relationships.validation.brokenReferences.length, 0);
});

test('A201 fixture lineage and revision pair are explicit and comparable', () => {
  const fixture = createDemonstrationProjectFixture();
  const lineage = buildDocumentLineage(fixture);
  const chain = lineage.chains.find(item => item.lineageId === 'mc-demo-lineage-a201');
  assert.ok(chain);
  assert.equal(chain.current.documentId, 'mc-demo-doc-drawing-a201-r2');
  const earlierDocument = fixture.documents.find(item => item.id === 'mc-demo-doc-drawing-a201-r1');
  const laterDocument = fixture.documents.find(item => item.id === 'mc-demo-doc-drawing-a201-r2');
  const comparison = compareRevisions({ earlierDocument, laterDocument, documents: fixture.documents, sections: fixture.sections });
  assert.equal(comparison.comparable, true);
  assert.ok(comparison.matches.some(match => match.matchRule === 'unique-section-number'));
});

test('initial exact identifiers create Engineering Context and Context Bus synchronization', () => {
  const fixture = createDemonstrationProjectFixture();
  const document = fixture.documents.find(item => item.id === DEMO_INITIAL_DOCUMENT_ID);
  const context = createEngineeringContext({
    projectId: DEMO_PROJECT_ID,
    documentId: DEMO_INITIAL_DOCUMENT_ID,
    sectionId: DEMO_INITIAL_SECTION_ID,
    libraryId: document.libraryId,
    projects: [fixture.manifest.project], documents: fixture.documents, sections: fixture.sections
  });
  assert.ok(context);
  assert.ok(context.relationshipIds.length);
  assert.ok(context.classification.drawings.length);
  assert.ok(context.classification.specifications.length);
  const bus = createContextBusSnapshot({ engineeringContext: context, activation: { source: 'Knowledge Catalog document' }, documents: fixture.documents });
  assert.equal(bus.active, true);
  assert.equal(bus.synchronizedConsumers.length, 9);
});

test('offline retrieval operates normally over stored demonstration section text', () => {
  const fixture = createDemonstrationProjectFixture();
  const hits = retrieve('existing duct conflicts with new cable tray RFI-002', fixture.sections, 5);
  assert.ok(hits.length);
  assert.ok(hits.some(hit => hit.documentId === DEMO_INITIAL_DOCUMENT_ID));
  assert.ok(hits.every(hit => fixture.sections.some(section => section.id === hit.id)));
});

test('fixture clones can be loaded without mutating the canonical fixture', () => {
  const clone = createDemonstrationProjectFixture();
  clone.manifest.project.name = 'Changed copy';
  assert.notEqual(clone.manifest.project.name, DEMONSTRATION_PROJECT.manifest.project.name);
});
