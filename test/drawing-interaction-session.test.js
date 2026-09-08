import test from 'node:test';
import assert from 'node:assert/strict';

import { createDrawingInteractionSession } from '../src/drawing-interaction-session.js';
import { reportTrackedResources } from '../src/resource-lifecycle.js';
import { visibleDrawingOverlays } from '../src/drawing-overlays.js';

test('interaction session reuses one pending frame and settles once', async () => {
  let settleCount = 0;
  const frames = [];
  const session = createDrawingInteractionSession({
    settleMs: 5,
    requestAnimationFrame: callback => {
      frames.push(callback);
      return frames.length;
    },
    cancelAnimationFrame: () => {},
    onSettle: () => { settleCount += 1; }
  });

  session.begin('zoom');
  session.updateViewport({ zoom: 1.5, scrollLeft: 120, scrollTop: 80 });
  session.scheduleFrame(() => {});
  session.scheduleFrame(() => {});

  assert.equal(frames.length, 1);
  frames[0]();
  session.settleSoon();
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.equal(settleCount, 1);
  assert.equal(session.isActive(), false);
  assert.deepEqual(session.latestViewport(), { zoom: 1.5, scrollLeft: 120, scrollTop: 80 });
});

test('disabled drawing diagnostics do not emit overlay diagnostics or resource reports', () => {
  const previousFlag = globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED;
  globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED = false;
  try {
    let overlayDiagnostics = 0;
    const overlays = visibleDrawingOverlays([
      { overlayId: 'o1', projectId: 'p1', documentId: 'd1', pageId: 'p1', type: 'rooms', verificationState: 'confirmed', region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }, label: 'Object' }
    ], { projectId: 'p1', documentId: 'd1', pageId: 'p1', onDiagnostic: () => { overlayDiagnostics += 1; } });

    assert.equal(overlays.length, 1);
    assert.equal(overlayDiagnostics, 0);
    assert.equal(reportTrackedResources('disabled', { kind: 'test' }), null);
  } finally {
    globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED = previousFlag;
  }
});