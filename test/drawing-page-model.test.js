import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDrawingPageModel, drawingPageModelFacets } from '../src/drawing-page-model.js';

test('page model produces one ordered record per retained PDF page', () => {
  const pages = buildDrawingPageModel({ documentId: 'doc', drawingSetId: 'set', projectId: 'general', pageCount: 70 });
  assert.equal(pages.length, 70);
  assert.equal(pages[0].pdfPageNumber, 1);
  assert.equal(pages[69].pdfPageIndex, 69);
  assert.equal(pages.every(page => page.identityStatus === 'fallback'), true);
});

test('specification source pages never enter the Drawing Page Model', () => {
  assert.deepEqual(buildDrawingPageModel({ documentId: 'spec', documentType: 'specifications', pageCount: 2363 }), []);
});

test('authoritative metadata wins while partial and stored metadata fill gaps', () => {
  const pages = buildDrawingPageModel({ documentId: 'doc', drawingSetId: 'set', projectId: 'general', pageCount: 3,
    registryRecords: [{ pageNumber: 1, drawingId: 'drawing-1', sheetNumber: '61A-001', sheetTitle: 'Architectural Notes' }],
    partialSheets: [{ pageNumber: 1, sheetNumber: 'wrong', discipline: 'Architectural', primarySheetType: 'General Notes' }, { pageNumber: 2, sheetNumber: '61M-101', sheetTitle: 'Mechanical Plan', discipline: 'Mechanical', sheetTypes: ['Plan'] }],
    storedPageMetadata: [{ pageNumber: 1, building: '61' }, { pageNumber: 2, building: '61' }] });
  assert.equal(pages[0].sheetNumber, '61A-001');
  assert.equal(pages[0].discipline, 'Architectural');
  assert.equal(pages[0].building, '61');
  assert.equal(pages[0].identityStatus, 'parser');
  assert.equal(pages[1].identityStatus, 'parser');
  assert.equal(pages[2].identityStatus, 'fallback');
  assert.match(pages[1].searchableText, /61M-101.*Mechanical Plan.*Mechanical.*Plan/);
});

test('fallback never creates false authoritative identities and facets include Unknown', () => {
  const pages = buildDrawingPageModel({ pageCount: 2, partialSheets: [{ pageNumber: 1, sheetNumber: 'FX500', discipline: 'Mechanical' }] });
  assert.equal(pages[0].sheetNumber, '');
  assert.equal(pages[0].identityStatus, 'parser');
  assert.equal(pages[1].identityStatus, 'fallback');
  assert.deepEqual(drawingPageModelFacets(pages), { disciplines: ['Mechanical', 'Unknown'], drawingTypes: ['Unknown'] });
});

test('catalog manual metadata overrides parser metadata for cards, filters, search, and navigation records', () => {
  const pages = buildDrawingPageModel({ documentId: 'doc', pageCount: 1,
    catalogRecords: [{ pdfPageNumber: 1, sheetNumber: '61M-101', sheetTitle: 'Corrected Mechanical Plan', discipline: 'Mechanical', drawingType: 'Plan', identityState: 'manual' }],
    registryRecords: [{ pageNumber: 1, sheetNumber: 'WRONG-1', sheetTitle: 'Parser title', discipline: 'General', drawingType: 'Reference' }]
  });
  assert.equal(pages[0].sheetNumber, '61M-101');
  assert.equal(pages[0].sheetTitle, 'Corrected Mechanical Plan');
  assert.equal(pages[0].identityStatus, 'manual');
  assert.match(pages[0].searchableText, /Mechanical Plan/);
  assert.deepEqual(drawingPageModelFacets(pages), { disciplines: ['Mechanical'], drawingTypes: ['Plan'] });
});
