import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpecificationIndex } from '../src/specification-index.js';

const memory = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
test('Bedford specification sections form a bounded persistent index', () => {
  const storage = memory(); const index = createSpecificationIndex({ storage });
  const result = index.index({ document: { id: 'spec', projectId: 'bedford', title: '518-22-700 Bedford Specifications' }, sourceSections: [
    { id: 's1', sectionNumber: '09 65 19', title: 'Resilient Tile Flooring', pageStart: 500, articles: [{ id: 'a', heading: 'PART 3 EXECUTION', page: 506 }] },
    { id: 's2', sectionNumber: '10 14 00', title: 'Signage', pageStart: 540, pageEnd: 552 }
  ] });
  assert.equal(result.sections[0].endPdfPage, 539);
  assert.equal(index.get('spec', '096519').sectionTitle, 'Resilient Tile Flooring');
  assert.deepEqual(index.answerContext(index.get('spec', '10 14 00')), { documentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', startPdfPage: 540, endPdfPage: 552, article: null });
  assert.equal(createSpecificationIndex({ storage }).sections({ documentId: 'spec' }).length, 2);
});
test('one project specification index supports multiple drawing sets without pooling pages', () => {
  const index = createSpecificationIndex({ storage: memory() });
  index.index({ document: { id: 'spec', projectId: 'p' }, tocRows: [{ sectionNumber: '10 14 00', sectionTitle: 'Signage', pageStart: 4 }] });
  assert.equal(index.sections({ projectId: 'p' }).length, 1);
  assert.equal(Object.hasOwn(index.answerContext(index.get('spec', '10 14 00')), 'text'), false);
});
