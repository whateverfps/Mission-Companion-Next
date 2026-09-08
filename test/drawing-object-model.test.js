import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingObject, createDrawingObjectDecisionStore, createRoomObject, screenToNormalizedPoint, selectDrawingObject } from '../src/drawing-object-model.js';

test('non-room numeric evidence is rejected and schedule evidence remains candidate', () => {
  assert.equal(createRoomObject({ roomNumber: '518', sourceText: 'PROJECT 518-22-700' }).verificationState, 'rejected');
  assert.equal(createRoomObject({ roomNumber: '61IN101', sourceText: 'SHEET 61IN101' }).verificationState, 'rejected');
  assert.equal(createRoomObject({ roomNumber: '127B', sourceText: 'ROOM 127B', scheduleOnly: true }).verificationState, 'candidate');
});

test('screen coordinates normalize and deterministic selection prefers confirmed containment', () => {
  assert.deepEqual(screenToNormalizedPoint({ clientX: 60, clientY: 40, bounds: { left: 10, top: 10 }, contentWidth: 100, contentHeight: 100 }), { x: .5, y: .3 });
  const candidate = createDrawingObject({ objectId: 'c', verificationState: 'candidate', region: { x: .4, y: .2, width: .2, height: .2 } });
  const confirmed = createDrawingObject({ objectId: 'x', verificationState: 'confirmed', region: { x: .4, y: .2, width: .2, height: .2 } });
  assert.equal(selectDrawingObject([candidate, confirmed], { x: .5, y: .3 }).object.objectId, 'x');
  assert.equal(selectDrawingObject([candidate], { x: .9, y: .9 }).status, 'empty');
});

test('manual object decisions survive enrichment', () => {
  const values = new Map(); const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const store = createDrawingObjectDecisionStore({ storage, now: () => '2026-08-01T00:00:00.000Z' });
  store.decide('room-1', 'rejected', 'Not a room');
  assert.equal(store.apply({ objectId: 'room-1', verificationState: 'candidate' }).verificationState, 'rejected');
});
