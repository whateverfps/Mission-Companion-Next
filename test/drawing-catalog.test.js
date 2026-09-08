import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingCatalog } from '../src/drawing-catalog.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test('catalog persists exactly one record for every retained PDF page', () => {
  const storage = memoryStorage();
  const first = createDrawingCatalog({ storage });
  const records = first.reconcile({ documentId: 'doc', drawingSetId: 'set', projectId: 'general', pageCount: 3 });
  assert.equal(records.length, 3);
  assert.deepEqual(records.map(item => item.identityState), ['fallback', 'fallback', 'fallback']);
  assert.equal(createDrawingCatalog({ storage }).recordsForDocument('doc').length, 3);
});

test('catalog priority protects manual and authoritative metadata from parser replacement', () => {
  const storage = memoryStorage();
  const differences = [];
  const catalog = createDrawingCatalog({ storage, onDifference: item => differences.push(item) });
  catalog.setManual('doc', 1, { sheetNumber: '61M-101', sheetTitle: 'Corrected Plan', discipline: 'Mechanical', drawingType: 'Plan' }, { projectId: 'general', drawingSetId: 'set' });
  catalog.setAuthoritative('doc', 2, { sheetNumber: '61T-402', sheetTitle: 'Inventory', discipline: 'Telecommunications', drawingType: 'Inventory' }, { projectId: 'general', drawingSetId: 'set' });
  const records = catalog.reconcile({ documentId: 'doc', drawingSetId: 'set', projectId: 'general', pageCount: 2, parserRecords: [
    { pageNumber: 1, sheetNumber: 'WRONG-1', sheetTitle: 'Parser title' },
    { pageNumber: 2, sheetNumber: 'WRONG-2', sheetTitle: 'Parser title' }
  ] });
  assert.deepEqual(records.map(item => item.sheetNumber), ['61M-101', '61T-402']);
  assert.deepEqual(records.map(item => item.identityState), ['manual', 'authoritative']);
  assert.equal(differences.length, 2);
});

test('valid parser and stored metadata enrich fallback catalog records without false identities', () => {
  const catalog = createDrawingCatalog({ storage: memoryStorage() });
  const records = catalog.reconcile({ documentId: 'doc', pageCount: 3,
    parserRecords: [{ pageNumber: 1, sheetNumber: '61G-001', sheetTitle: 'Drawing Index', discipline: 'General', drawingType: 'Drawing Index' }, { pageNumber: 3, sheetNumber: 'FX500' }],
    storedMetadata: [{ pageNumber: 2, sheetTitle: 'Stored title', discipline: 'Mechanical', drawingType: 'Plan' }]
  });
  assert.equal(records[0].identityState, 'parser');
  assert.equal(records[1].identityState, 'parser');
  assert.equal(records[2].identityState, 'fallback');
  assert.equal(records[2].sheetNumber, '');
});

test('page IDs remain stable across rename, reload, parser enrichment, reset, and defaults', () => {
  const storage = memoryStorage();
  let tick = 0;
  const catalog = createDrawingCatalog({ storage, now: () => `2026-08-01T00:00:0${tick++}Z` });
  const initial = catalog.reconcile({ documentId: 'doc', drawingSetId: 'set', projectId: 'general', pageCount: 1, parserRecords: [{ pageNumber: 1, sheetNumber: '61M-101', sheetTitle: 'Parser Plan', discipline: 'Mechanical', drawingType: 'Plan' }] })[0];
  const renamed = catalog.applyToCatalog('doc', 1, { sheetNumber: '61M-101', sheetTitle: 'Corrected Plan', discipline: 'Mechanical', drawingType: 'Plan' }, { drawingSetId: 'set', projectId: 'general' }, 'manual');
  const reloaded = createDrawingCatalog({ storage, now: () => `2026-08-01T00:00:0${tick++}Z` });
  const afterParser = reloaded.reconcile({ documentId: 'doc', drawingSetId: 'set', projectId: 'general', pageCount: 1, parserRecords: [{ pageNumber: 1, sheetNumber: '61M-999', sheetTitle: 'New Parser Plan', discipline: 'General', drawingType: 'Reference' }] })[0];
  assert.equal(initial.pageId, renamed.pageId);
  assert.equal(renamed.pageId, afterParser.pageId);
  assert.equal(afterParser.sheetTitle, 'Corrected Plan');
  assert.equal(afterParser.identityState, 'manual');
  assert.ok(afterParser.auditTrail.length >= 3);
  assert.deepEqual(afterParser.auditTrail.at(-1).changes.parserValues.newValue, { sheetNumber: '61M-999', sheetTitle: 'New Parser Plan', discipline: 'General', drawingType: 'Reference' });
  assert.equal(reloaded.resetToParser('doc', 1).sheetNumber, '61M-999');
  assert.equal(reloaded.restoreDefaults('doc', 1).sheetNumber, '61M-101');
});

test('comparison explains parser, catalog, chosen values, and precedence reason', () => {
  const catalog = createDrawingCatalog({ storage: memoryStorage() });
  catalog.reconcile({ documentId: 'doc', pageCount: 1, parserRecords: [{ pageNumber: 1, sheetNumber: '61M-101', sheetTitle: 'Parser Plan' }] });
  catalog.setManual('doc', 1, { sheetNumber: '61M-101', sheetTitle: 'Manual Plan' });
  const title = catalog.compare('doc', 1).find(item => item.field === 'sheetTitle');
  assert.deepEqual(title, { field: 'sheetTitle', parserValue: 'Parser Plan', catalogValue: 'Manual Plan', chosenValue: 'Manual Plan', reason: 'manual-catalog-precedence' });
});

test('catalog diagnostics report incomplete, duplicate, disputed, and fallback metadata without interruption', () => {
  const catalog = createDrawingCatalog({ storage: memoryStorage() });
  catalog.reconcile({ documentId: 'doc', pageCount: 3, parserRecords: [{ pageNumber: 1, sheetNumber: '61M-101' }, { pageNumber: 2, sheetNumber: '61M-101', sheetTitle: 'Plan' }] });
  catalog.setManual('doc', 1, { sheetNumber: '61M-101', sheetTitle: 'Corrected' });
  const diagnostics = catalog.diagnostics('doc');
  assert.equal(diagnostics.pageCount, 3);
  assert.ok(diagnostics.missingTitles.length);
  assert.ok(diagnostics.missingDisciplines.length);
  assert.ok(diagnostics.missingDrawingTypes.length);
  assert.equal(diagnostics.duplicateSheets.length, 1);
  assert.ok(diagnostics.parserDisagreements.length);
  assert.deepEqual(diagnostics.unknownIdentities, ['drawing-page:doc:3']);
});

test('catalog ignores specification documents without creating page identities', () => {
  const catalog = createDrawingCatalog({ storage: memoryStorage() });
  assert.deepEqual(catalog.reconcile({ documentId: 'spec', documentType: 'specifications', pageCount: 2363 }), []);
  assert.deepEqual(catalog.recordsForDocument('spec'), []);
});
