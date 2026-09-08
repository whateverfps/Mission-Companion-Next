import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidateRetrievalCaches, retrieve } from '../src/retrieval.js';
import { hierarchySections } from './fixtures/specification.js';

const ranking = hits => hits.map(hit => [hit.id, hit.score]);

test('hierarchy retrieval supports title, semantic, and section-number lookup with stable warm ordering', () => {
  const sections = hierarchySections();
  for (const query of ['Owner QC requirements', 'quality control testing', '01 91 00']) {
    invalidateRetrievalCaches(sections);
    const cold = retrieve(query, sections, 4);
    const warm = retrieve(query, sections, 4);
    assert.deepEqual(ranking(warm), ranking(cold));
    assert.ok(cold.length > 0);
  }
  assert.equal(retrieve('Owner QC requirements', sections, 3)[0].heading, '1.1 Owner QC');
  assert.equal(retrieve('01 91 00', sections, 2)[0].sectionNumber, '01 91 00');
});

test('hierarchy candidates traverse parents, children, and cross references before linear fallback', () => {
  const sections = hierarchySections();
  const narrowed = retrieve('Owner QC', sections, 2);
  assert.ok(narrowed.meta.totalSectionsSearched <= narrowed.meta.totalSectionsAvailable);
  assert.ok(narrowed.meta.hierarchyNeighbors.length > 0);
  const fallback = retrieve('documented commissioning records', sections, 3);
  assert.equal(fallback[0].sectionNumber, '01 91 00');
  assert.ok(sections.find(section => section.crossReferences.length)?.crossReferenceIds.length);
});

test('explicit invalidation rebuilds changed section and hierarchy metadata without stale results', () => {
  const sections = hierarchySections();
  retrieve('Owner QC', sections, 3);
  const owner = sections.find(section => section.heading.includes('Owner QC'));
  owner.heading = 'Architect Review';
  owner.text = 'Architect shall review substitutions.';
  owner.metadata.keywords = ['architect', 'substitutions'];
  invalidateRetrievalCaches(sections);
  assert.equal(retrieve('architect substitutions', sections, 2)[0].id, owner.id);

  const replacement = sections.map(section => ({ ...section }));
  const withoutOwner = replacement.filter(section => section.id !== owner.id);
  assert.ok(!retrieve('architect substitutions', withoutOwner, 5).some(hit => hit.id === owner.id));
});

test('separate project and library collections remain isolated and malformed queries remain safe', () => {
  const sections = hierarchySections();
  const projectOne = sections.filter(section => section.projectId === 'project-1');
  const projectTwo = sections.map(section => ({ ...section, id: `p2-${section.id}`, projectId: 'project-2', libraryId: 'library-2' }));
  assert.ok(retrieve('Owner QC', projectOne, 2).every(hit => hit.projectId === 'project-1'));
  assert.ok(retrieve('Owner QC', projectTwo.filter(section => section.libraryId === 'library-2'), 2)
    .every(hit => hit.libraryId === 'library-2'));
  assert.doesNotThrow(() => retrieve(null, null, 10));
  assert.deepEqual([...retrieve('', [], 10)], []);
});
