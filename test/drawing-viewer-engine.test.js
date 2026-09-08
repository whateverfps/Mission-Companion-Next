import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingRenderCache, createDrawingViewerEngine, drawingResizeRenderIsCurrent } from '../src/drawing-viewer-engine.js';

test('detached or superseded resize observers cannot reset the selected PDF page', () => {
  const pageOneStage = { isConnected: false };
  const pageTwoStage = { isConnected: true };
  assert.equal(drawingResizeRenderIsCurrent({ observedStage: pageOneStage, activeStage: pageOneStage, observedPage: 1, selectedPage: 2 }), false);
  assert.equal(drawingResizeRenderIsCurrent({ observedStage: pageOneStage, activeStage: pageTwoStage, observedPage: 1, selectedPage: 2 }), false);
  assert.equal(drawingResizeRenderIsCurrent({ observedStage: pageTwoStage, activeStage: pageTwoStage, observedPage: 1, selectedPage: 2 }), false);
  assert.equal(drawingResizeRenderIsCurrent({ observedStage: pageTwoStage, activeStage: pageTwoStage, observedPage: 2, selectedPage: 2 }), true);
});

test('viewer engine opens retained documents and selects any bounded page', () => {
  const engine = createDrawingViewerEngine();
  assert.deepEqual(engine.openDocument('doc', 70, 1), { documentId: 'doc', pageCount: 70, selectedPage: 1, renderGeneration: 0 });
  assert.equal(engine.selectPage(10), 10);
  assert.equal(engine.nextPage(), 11);
  assert.equal(engine.previousPage(), 10);
  assert.equal(engine.selectPage(100), 70);
});

test('rapid render generations cancel stale work and only latest page commits', () => {
  const engine = createDrawingViewerEngine();
  engine.openDocument('doc', 70);
  let cancelled = 0;
  const first = engine.beginRender(1);
  engine.attachRender(first, { cancel: () => { cancelled += 1; } });
  const second = engine.beginRender(2);
  engine.attachRender(second, { cancel: () => { cancelled += 1; } });
  const tenth = engine.beginRender(10);
  assert.equal(cancelled, 2);
  assert.equal(engine.canCommit(first), false);
  assert.equal(engine.canCommit(second), false);
  assert.equal(engine.canCommit(tenth), true);
});

test('renderSelectedPage owns the render task and reports a committed selected page', async () => {
  const engine = createDrawingViewerEngine();
  engine.openDocument('doc', 3, 2);
  const rendered = [];
  const outcome = await engine.renderSelectedPage(pageNumber => {
    rendered.push(pageNumber);
    return { promise: Promise.resolve(), cancel() {} };
  });
  assert.deepEqual(rendered, [2]);
  assert.equal(outcome.committed, true);
  engine.cancelRender();
});

test('completed render tasks are not released when a later page starts rendering', async () => {
  const engine = createDrawingViewerEngine();
  engine.openDocument('doc', 3, 1);
  let released = 0;
  const first = await engine.renderSelectedPage(() => ({ promise: Promise.resolve(), cancel() {}, release() { released += 1; } }));
  assert.equal(first.committed, true);
  engine.selectPage(2);
  const second = engine.beginRender();
  assert.equal(second.pageNumber, 2);
  assert.equal(released, 0);
});

test('viewer engine preserves viewport, zoom bounds, pointer anchoring, and rotation', () => {
  const engine = createDrawingViewerEngine();
  engine.openDocument('doc', 2, 1);
  engine.restoreViewport(1, { mode: 'custom', zoom: 1.2, scrollLeft: 240, scrollTop: 180, rotation: 0 });
  const before = engine.getViewport(1);
  const after = engine.zoomAtPoint({ deltaY: -60, pointerX: 320, pointerY: 210 });
  assert.ok(after.zoom > before.zoom && after.zoom <= 3);
  assert.ok(Math.abs((before.scrollLeft + 320) / before.zoom - (after.scrollLeft + 320) / after.zoom) < 1e-9);
  assert.equal(engine.setZoom(100).zoom, 3);
  assert.equal(engine.setZoom(-100).zoom, .35);
  assert.equal(engine.rotate().rotation, 90);
  assert.equal(engine.fitWidth().mode, 'fit-width');
  assert.deepEqual(engine.resetView(), { mode: 'fit-page', zoom: null, rotation: 0, scrollLeft: 0, scrollTop: 0 });
});

test('viewport state is isolated by document and PDF page', () => {
  const engine = createDrawingViewerEngine();
  engine.openDocument('doc-1', 2, 1);
  engine.restoreViewport(1, { zoom: 1.5, scrollLeft: 20 });
  engine.restoreViewport(2, { zoom: 2, scrollLeft: 40 });
  assert.equal(engine.getViewport(1).zoom, 1.5);
  assert.equal(engine.getViewport(2).zoom, 2);
  engine.openDocument('doc-2', 1, 1);
  assert.equal(engine.getViewport(1).zoom, null);
  engine.openDocument('doc-1', 2, 1);
  assert.equal(engine.getViewport(1).zoom, 1.5);
});

test('page navigation sequence keeps selected and rendered PDF pages synchronized', async () => {
  const engine = createDrawingViewerEngine();
  engine.openDocument('doc', 70, 1);
  let canvasPage = 1;
  let toolbarPage = 1;
  for (const requestedPage of [2, 10, 37, 5]) {
    assert.equal(engine.selectPage(requestedPage), requestedPage);
    const outcome = await engine.renderSelectedPage(pageNumber => ({
      promise: Promise.resolve().then(() => { canvasPage = pageNumber; toolbarPage = engine.snapshot().selectedPage; }),
      cancel() {}
    }));
    assert.equal(outcome.committed, true);
    assert.equal(engine.snapshot().selectedPage, requestedPage);
    assert.equal(outcome.token.pageNumber, requestedPage);
    assert.equal(canvasPage, requestedPage);
    assert.equal(toolbarPage, requestedPage);
  }
});

test('viewer engine measures page selection, render, and zoom without changing behavior', async () => {
  let time = 0;
  const metrics = [];
  const engine = createDrawingViewerEngine({ clock: () => time += 2, onMetric: metric => metrics.push(metric) });
  engine.openDocument('doc', 2, 1);
  engine.selectPage(2);
  await engine.renderSelectedPage(() => ({ promise: Promise.resolve(), cancel() {} }));
  engine.zoomAtPoint({ deltaY: -20, pointerX: 10, pointerY: 10 });
  assert.deepEqual(metrics.filter(item => item.operation !== 'render-task').map(item => item.operation), ['page-selection', 'page-render', 'zoom']);
  assert.ok(metrics.some(item => item.operation === 'render-task' && item.state === 'attached'));
  assert.ok(metrics.some(item => item.operation === 'render-task' && item.state === 'completed'));
  assert.ok(metrics.filter(item => 'durationMs' in item).every(item => item.durationMs >= 0));
});

test('bounded render cache reports hits and misses and evicts the oldest bitmap', () => {
  const metrics = [];
  const cache = createDrawingRenderCache({ maxEntries: 2, onMetric: metric => metrics.push(metric) });
  const page1 = { page: 1 };
  cache.set('page-1', page1);
  cache.set('page-2', { page: 2 });
  assert.equal(cache.get('page-1'), page1);
  cache.set('page-3', { page: 3 });
  assert.equal(cache.get('page-2'), null);
  assert.equal(cache.size(), 2);
  assert.deepEqual(metrics.map(item => item.cache), ['hit', 'miss']);
});
