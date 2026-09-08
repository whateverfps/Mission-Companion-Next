import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSpecificationHierarchy, parseFiles } from '../src/parsers.js';
import { hierarchySections, specificationText, textFile } from './fixtures/specification.js';

test('CSI variants create divisions, sections, inherited parents, metadata, pages, and references', () => {
  const nodes = buildSpecificationHierarchy(specificationText, 'compact-specification.txt');
  assert.equal(nodes[0].hierarchyType, 'division');
  assert.equal(nodes[0].division, '01');
  assert.equal(nodes[1].sectionNumber, '01 45 00');
  assert.equal(nodes.at(-1).sectionNumber, '01 91 00');
  assert.equal(nodes[3].parentKey, nodes[2].key);
  assert.equal(nodes[3].metadata.sectionNumber, '01 45 00');
  assert.deepEqual(nodes[3].metadata.pageRange, { start: 10, end: 10 });
  assert.deepEqual(nodes[3].crossReferences, ['01 91 00']);
  assert.match(nodes[3].text, /document deficiencies/);
  assert.equal(nodes[3].location, 'Pages 10-10');
});

test('flat documents and orphan headings retain text and line locations', () => {
  const nodes = buildSpecificationHierarchy('Plain introduction text.\nMore source text.', 'notes.txt');
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].parentKey, null);
  assert.match(nodes[0].text, /Plain introduction text/);
  assert.match(nodes[0].location, /^Lines /);
});

test('real parseFiles output preserves citations and resolves cross-reference ids on re-import', async () => {
  const first = await parseFiles([textFile()], 'project-1', () => {}, 'library-1');
  const second = await parseFiles([textFile()], 'project-1', () => {}, 'library-1');
  assert.equal(first.documents[0].hierarchyVersion, 1);
  assert.equal(first.sections.length, hierarchySections().length);
  assert.ok(first.sections.every(section => section.citations.length === 1));
  assert.ok(first.sections.some(section => section.crossReferenceIds.length > 0));
  assert.notEqual(first.documents[0].id, second.documents[0].id);
  assert.deepEqual(
    first.sections.map(section => [section.heading, section.text, section.location]),
    second.sections.map(section => [section.heading, section.text, section.location])
  );
});
