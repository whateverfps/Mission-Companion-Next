import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_61_DRAWING_CATALOG } from '../src/building-61-drawing-catalog.js';
import { buildDrawingsModel, relationshipsForDrawing } from '../src/drawings-adapter.js';
import { buildSpecificationsModel, reverseDrawingLookup } from '../src/specifications-adapter.js';
import { buildChiefContext } from '../src/chief-context-adapter.js';

test('drawing list derives from the authoritative Bedford catalog', () => {
  const model = buildDrawingsModel({ catalogs: [BUILDING_61_DRAWING_CATALOG] });
  assert.ok(model.records.length > 50);
  assert.ok(model.records.some(item => item.sheetNumber === '61E-601'));
  assert.ok(model.records.every(item => item.sheetNumber && item.title));
});

test('drawing relationships retain sheet and evidence fields without duplication', () => {
  const records = [{ sheetNumber: 'E-601', sectionNumber: '26 05 00', relationshipType: 'RELATED', status: 'related' }];
  assert.equal(relationshipsForDrawing(records, 'E-601')[0].sectionNumber, '26 05 00');
  assert.equal(relationshipsForDrawing(records, 'A-101').length, 0);
});

test('specification list preserves section and source identity', () => {
  const model = buildSpecificationsModel({ documents: [{ id: 'spec-doc', category: 'Specifications' }], sections: [{ id: 'sec-1', documentId: 'spec-doc', sectionNumber: '26 05 00', sectionTitle: 'Common Work Results' }] });
  assert.equal(model.records[0].sourceDocumentId, 'spec-doc');
  assert.equal(model.records[0].sectionNumber, '26 05 00');
});

test('reverse lookup and Chief contexts are bounded and contextual', () => {
  const links = [{ sectionNumber: '26 05 00', sheetNumber: 'E-601' }];
  assert.equal(reverseDrawingLookup(links, '260500')[0].sheetNumber, 'E-601');
  assert.equal(buildChiefContext({ surface: 'drawing', documentId: 'drawing-doc', drawingPageId: 'page-1' }).drawingPageId, 'page-1');
  assert.equal(buildChiefContext({ surface: 'specification', documentId: 'spec-doc' }).documentId, 'spec-doc');
});
