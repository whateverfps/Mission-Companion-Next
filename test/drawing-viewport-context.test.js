import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingViewportContextService, normalizedViewportBounds } from '../src/drawing-viewport-context.js';

const identity = { projectId: 'p', documentId: 'd', pageId: 'page-1', pdfPageNumber: 1, zoom: 2, rotation: 0 };
const memory = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
test('normalized viewport bounds update correctly and invert rotation', () => {
  assert.deepEqual(normalizedViewportBounds({ scrollLeft: 100, scrollTop: 50, viewportWidth: 200, viewportHeight: 100, contentWidth: 400, contentHeight: 200 }), { x: .25, y: .25, width: .5, height: .5 });
  assert.deepEqual(normalizedViewportBounds({ scrollLeft: 100, scrollTop: 50, viewportWidth: 200, viewportHeight: 100, contentWidth: 400, contentHeight: 200, rotation: 90 }), { x: .25, y: .25, width: .5, height: .5 });
});
test('context state persists regions by page and never invokes rendering', () => {
  const storage = memory(); let updates = 0; const service = createDrawingViewportContextService({ storage, throttleMs: 0, onChange: () => updates++ });
  service.selectRegion(identity, { x: .2, y: .3, width: .1, height: .2 });
  service.update({ ...identity, zoom: 2.5, selectedObjectId: 'object', source: 'object-selection' }, { immediate: true });
  assert.equal(updates, 2); assert.equal(service.get('d', 'page-1').selectedRegion.x, .2);
  service.update({ ...identity, pageId: 'page-2', pdfPageNumber: 2 }, { immediate: true });
  assert.equal(service.get('d', 'page-1').selectedObjectId, 'object'); assert.equal(service.get('d', 'page-2').selectedRegion, null);
  assert.equal(Object.hasOwn(service, 'render'), false);
});
test('verified visible rooms remain suggestions until explicitly used', () => {
  const service = createDrawingViewportContextService({ storage: memory(), throttleMs: 0 }); const context = service.update({ ...identity, bounds: { x: .1, y: .1, width: .4, height: .4 } }, { immediate: true });
  const room = { roomId: 'r127', pageId: 'page-1', verificationState: 'confirmed', region: { x: .2, y: .2, width: .1, height: .1 } };
  assert.equal(service.visibleRooms(context, [room])[0].roomId, 'r127'); assert.equal(service.get('d', 'page-1').selectedRoomId, null);
  assert.equal(service.useRoom(identity, room).selectedRoomId, 'r127');
});
test('stale asynchronous context generations cannot commit', async () => {
  const service = createDrawingViewportContextService({ storage: memory(), throttleMs: 0 });
  let release; const first = service.resolveLatest(() => new Promise(resolve => { release = resolve; }), identity);
  const second = await service.resolveLatest(async () => 'new', identity); release('old');
  assert.equal(second.committed, true); assert.equal((await first).committed, false);
});
