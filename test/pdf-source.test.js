import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPdfSourceRecord, inspectStorageCapacity, normalizePageMetadata, normalizeRegion,
  openPdfBlob, positionedTextItem, readPdfPage, readPdfPageGraphics, renderPdfPage, validatePdfSourceOwnership
} from '../src/pdf-source.js';

test('creates one authoritative Blob source model and validates ownership', () => {
  const blob = new Blob(['%PDF'], { type: 'application/pdf' });
  const record = createPdfSourceRecord({ documentId: 'd1', projectId: 'p1', sourceBlob: blob, contentHash: 'hash', storedAt: '2026-01-01' });
  assert.equal(record.byteLength, blob.size);
  assert.equal(record.sourceBlob, blob);
  assert.equal(validatePdfSourceOwnership(record, { documentId: 'd1', projectId: 'p1' }).available, true);
  assert.equal(validatePdfSourceOwnership(record, { documentId: 'd1', projectId: 'p2' }).available, false);
  assert.equal(validatePdfSourceOwnership(null, { documentId: 'd1', projectId: 'p1' }).reason, 'Original PDF unavailable');
});

test('reads one bounded selected-page operator list into compact primitives', async () => {
  let selected = 0;
  const page = { rotate: 0, getViewport: () => ({ width: 100, height: 50 }), getOperatorList: async () => ({ fnArray: [91, 20], argsArray: [[[0], [10, 10, 30, 20], 10, 10, 30, 20], []] }), cleanup() {} };
  const pdf = { numPages: 2, __mcPdfjsOps: { constructPath: 91, stroke: 20 }, getPage: async number => { selected = number; return page; } };
  const result = await readPdfPageGraphics(pdf, 2, { maxOperations: 10 });
  assert.equal(selected, 2);
  assert.equal(result.status, 'ready');
  assert.equal(result.primitives.length, 1);
  assert.equal(result.primitives[0].stroke, true);
  assert.deepEqual(result.primitives[0].bounds, { x: .1, y: .6, width: .2, height: .2 });
  assert.equal('operatorList' in result, false);
});

test('operator analysis is cancellable and reports unsupported pages honestly', async () => {
  const cancelled = await readPdfPageGraphics({ getPage: async () => { throw new Error('must not read'); } }, 1, { signal: { aborted: true } });
  assert.equal(cancelled.status, 'cancelled');
  const unsupported = await readPdfPageGraphics({ getPage: async () => ({ getViewport: () => ({ width: 1, height: 1 }) }) }, 1);
  assert.equal(unsupported.status, 'unsupported');
});

test('normalizes page metadata, coordinates, and rotation', () => {
  assert.deepEqual(normalizePageMetadata({ pageNumber: 2, width: 1000, height: 500, rotation: -90 }), { pageNumber: 2, width: 1000, height: 500, rotation: 270 });
  assert.deepEqual(normalizeRegion({ x: -.2, y: .9, width: .5, height: .5 }), { x: 0, y: .9, width: .5, height: .09999999999999998 });
  assert.deepEqual(positionedTextItem({ str: 'Room 137', transform: [1,0,0,10,100,400], width: 80, height: 10 }, { pageNumber: 1, width: 1000, height: 500 }), { text: 'Room 137', region: { x: .1, y: .18, width: .08, height: .02 } });
});

test('reports storage capacity and quota failures without guessing', async () => {
  assert.equal((await inspectStorageCapacity(100, { estimate: async () => ({ quota: 1000, usage: 200 }) })).sufficient, true);
  assert.equal((await inspectStorageCapacity(900, { estimate: async () => ({ quota: 1000, usage: 200 }) })).sufficient, false);
  const unavailable = await inspectStorageCapacity(10, { estimate: async () => { throw new Error('denied'); } });
  assert.equal(unavailable.sufficient, null);
  assert.equal(unavailable.error, 'denied');
});

test('loads page metadata, positioned text, and annotations through injected PDF.js', async () => {
  const page = { rotate: 90, getViewport: () => ({ width: 600, height: 800, rotation: 90 }), getTextContent: async () => ({ items: [{ str: 'A101', transform: [1,0,0,10,500,700], width: 40, height: 10 }] }), getAnnotations: async () => [{ subtype: 'Link' }] };
  const pdf = { numPages: 1, getPage: async () => page };
  const opened = await openPdfBlob(new Blob(['pdf'], { type: 'application/pdf' }), { pdfjs: { getDocument: () => ({ promise: Promise.resolve(pdf) }) } });
  const result = await readPdfPage(opened, 1);
  assert.equal(result.rotation, 90);
  assert.equal(result.textItems[0].text, 'A101');
  assert.equal(result.annotations.length, 1);
  await assert.rejects(readPdfPage(opened, 2), /unavailable/);
});

test('validates render targets and exposes cancellation and cleanup', async () => {
  let cancelled = false;
  let cleaned = false;
  const task = { promise: Promise.resolve(), cancel: () => { cancelled = true; } };
  const page = { rotate: 0, getViewport: () => ({ width: 100, height: 200 }), render: () => task, cleanup: () => { cleaned = true; } };
  const canvas = { width: 0, height: 0, getContext: () => ({}) };
  const render = await renderPdfPage({ getPage: async () => page }, 1, canvas);
  render.cancel(); render.release();
  assert.equal(cancelled, true); assert.equal(cleaned, true); assert.equal(canvas.width, 0);
  await assert.rejects(renderPdfPage({ getPage: async () => page }, 1, {}), /canvas/);
});
