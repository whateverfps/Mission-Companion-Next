import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSpecificationSourceViewer } from '../src/specification-source-viewer.js';

const specification = { id: 'spec', projectId: 'bedford', documentType: 'specifications', pageCount: 2363 };
const canvas = () => ({ width: 0, height: 0, getContext: () => ({}) });

function harness() {
  const events = [];
  const proxies = [];
  const rendered = [];
  const viewer = createSpecificationSourceViewer({
    openPdf: async () => {
      const proxy = { numPages: 2363, cleaned: 0, destroyed: 0, cleanup() { this.cleaned += 1; }, destroy() { this.destroyed += 1; } };
      proxies.push(proxy); return proxy;
    },
    renderPage: async (_proxy, page, target) => {
      rendered.push(page); target.width = 1200; target.height = 1600;
      return { promise: Promise.resolve(), cancelled: false, cancel() { this.cancelled = true; }, release() { target.width = 0; target.height = 0; }, releasePage() {} };
    },
    now: () => '2026-08-01T12:00:00.000Z',
    onDiagnostic: event => events.push(event)
  });
  return { viewer, proxies, rendered, events };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('ordinary section lookup keeps the specification PDF dormant', () => {
  const { viewer, proxies } = harness();
  assert.deepEqual(viewer.diagnostics(), { specificationPdfProxyActive: false, specificationSourcePage: null, sourceViewRenderTaskActive: false, sourceViewCanvasPixels: { width: 0, height: 0 }, sourceViewCacheEntryCount: 0, sourceViewCleanupTimestamp: '', retainedSpecificationPageRecordsInMemory: 0 });
  assert.equal(proxies.length, 0);
});

test('View Source Page opens one exact specification page without a page model', async () => {
  const { viewer, rendered } = harness();
  const result = await viewer.open({ document: { ...specification, contentHash: 'spec-v1' }, sourceBlob: new Blob(['pdf'], { type: 'application/pdf' }), pageNumber: 417, sectionNumber: '23 31 00', sectionTitle: 'HVAC Ducts and Casings', canvas: canvas() });
  assert.equal(result.ok, true);
  assert.deepEqual(rendered, [417]);
  assert.equal(result.diagnostics.retainedSpecificationPageRecordsInMemory, 1);
  assert.equal(result.diagnostics.sourceViewCacheEntryCount, 0);
});

test('a second page reuses the same isolated proxy handle', async () => {
  const { viewer, proxies, rendered } = harness();
  const isolatedDocument = { ...specification, id: 'spec-reuse-handle', contentHash: 'spec-v1' };
  await viewer.open({ document: isolatedDocument, sourceBlob: new Blob(['one'], { type: 'application/pdf' }), pageNumber: 10, canvas: canvas() });
  await viewer.open({ document: isolatedDocument, sourceBlob: new Blob(['two'], { type: 'application/pdf' }), pageNumber: 11, canvas: canvas() });
  assert.deepEqual(rendered, [10, 11]);
  assert.equal(proxies.length, 1);
  assert.equal(viewer.diagnostics().specificationSourcePage, 11);
});

test('closing a loaded source page clears stale state before the next source selection', async () => {
  const { viewer, rendered } = harness();
  const firstDocument = { ...specification, id: 'spec-first', contentHash: 'spec-first' };
  const secondDocument = { ...specification, id: 'spec-second', contentHash: 'spec-second' };
  const thirdDocument = { ...specification, id: 'spec-third', contentHash: 'spec-third' };
  const firstCanvas = canvas();
  const secondCanvas = canvas();
  const thirdCanvas = canvas();

  const first = await viewer.open({
    document: firstDocument,
    sourceBlob: new Blob(['first'], { type: 'application/pdf' }),
    pageNumber: 120,
    sectionNumber: '09 91 00',
    sectionTitle: 'Interior Finishes',
    canvas: firstCanvas
  });
  assert.equal(first.ok, true);
  assert.equal(viewer.diagnostics().specificationSourcePage, 120);

  const closed = await viewer.close('return');
  assert.equal(closed.specificationSourcePage, null);
  assert.equal(firstCanvas.width, 0);
  assert.equal(firstCanvas.height, 0);

  const second = await viewer.open({
    document: secondDocument,
    sourceBlob: new Blob(['second'], { type: 'application/pdf' }),
    pageNumber: 121,
    sectionNumber: '28 31 00',
    sectionTitle: 'Fire Protection',
    canvas: secondCanvas
  });
  assert.equal(second.ok, true);
  assert.equal(viewer.diagnostics().specificationSourcePage, 121);

  const secondClosed = await viewer.close('return');
  assert.equal(secondClosed.specificationSourcePage, null);

  const third = await viewer.open({
    document: thirdDocument,
    sourceBlob: new Blob(['third'], { type: 'application/pdf' }),
    pageNumber: 122,
    sectionNumber: '09 91 00',
    sectionTitle: 'Painting',
    canvas: thirdCanvas
  });
  assert.equal(third.ok, true);
  assert.equal(viewer.diagnostics().specificationSourcePage, 122);
  assert.deepEqual(rendered, [120, 121, 122]);
});

test('reopening the same specification after close rebuilds the viewer from a fresh proxy', async () => {
  const { viewer, proxies, rendered } = harness();
  const firstDocument = { ...specification, id: 'spec-reopen', contentHash: 'spec-reopen' };
  const firstCanvas = canvas();
  const secondCanvas = canvas();

  const first = await viewer.open({
    document: firstDocument,
    sourceBlob: new Blob(['first'], { type: 'application/pdf' }),
    pageNumber: 210,
    sectionNumber: '21 13 13',
    sectionTitle: 'Wet Pipe Sprinkler Systems',
    canvas: firstCanvas
  });
  assert.equal(first.ok, true);
  assert.equal(proxies.length, 1);
  assert.equal(viewer.diagnostics().specificationSourcePage, 210);

  const closed = await viewer.close('return');
  assert.equal(closed.specificationSourcePage, null);
  assert.equal(closed.specificationPdfProxyActive, false);

  const reopened = await viewer.open({
    document: firstDocument,
    sourceBlob: new Blob(['first'], { type: 'application/pdf' }),
    pageNumber: 211,
    sectionNumber: '21 13 13',
    sectionTitle: 'Wet Pipe Sprinkler Systems',
    canvas: secondCanvas
  });

  assert.equal(reopened.ok, true);
  assert.equal(proxies.length, 2);
  assert.equal(viewer.diagnostics().specificationSourcePage, 211);
  assert.deepEqual(rendered, [210, 211]);
});

test('same-page reopen uses the rendered-page cache', async () => {
  const { viewer, rendered } = harness();
  const first = await viewer.open({ document: { ...specification, contentHash: 'spec-v1' }, sourceBlob: new Blob(['pdf'], { type: 'application/pdf' }), pageNumber: 88, canvas: canvas() });
  const second = await viewer.open({ document: { ...specification, contentHash: 'spec-v1' }, sourceBlob: new Blob(['pdf'], { type: 'application/pdf' }), pageNumber: 88, canvas: canvas() });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.cacheHit, true);
  assert.deepEqual(rendered, [88]);
});

test('stale source request is suppressed', async () => {
  const pending = deferred();
  const rendered = [];
  const viewer = createSpecificationSourceViewer({
    openPdf: async () => ({ numPages: 2363, cleanup() {}, destroy() {} }),
    renderPage: async (_proxy, page, target) => {
      rendered.push(page);
      target.width = 1200;
      target.height = 1600;
      await pending.promise;
      return { promise: Promise.resolve(), cancel() {}, release() {}, releasePage() {} };
    }
  });
  const first = viewer.open({ document: { ...specification, contentHash: 'spec-v1' }, sourceBlob: new Blob(['pdf'], { type: 'application/pdf' }), pageNumber: 5, canvas: canvas() });
  const second = viewer.open({ document: { ...specification, contentHash: 'spec-v2' }, sourceBlob: new Blob(['pdf2'], { type: 'application/pdf' }), pageNumber: 6, canvas: canvas() });
  pending.resolve();
  await Promise.all([first, second]);
  assert.equal(viewer.diagnostics().specificationSourcePage, 6);
  assert.deepEqual(rendered, [5, 6]);
});

test('return or workspace switching releases canvas, page, render, and proxy resources', async () => {
  const { viewer, proxies } = harness();
  const targetCanvas = canvas();
  await viewer.open({ document: { ...specification, contentHash: 'spec-v1' }, sourceBlob: new Blob(['pdf'], { type: 'application/pdf' }), pageNumber: 100, canvas: targetCanvas });
  const result = await viewer.close('workspace-changed');
  assert.equal(targetCanvas.width, 0);
  assert.equal(targetCanvas.height, 0);
  assert.equal(result.specificationPdfProxyActive, false);
  assert.equal(result.retainedSpecificationPageRecordsInMemory, 0);
  assert.equal(result.sourceViewCleanupTimestamp, '2026-08-01T12:00:00.000Z');
});

test('drawing documents and inexact requests cannot enter specification evidence', async () => {
  const { viewer, proxies } = harness();
  assert.equal((await viewer.open({ document: { ...specification, documentType: 'drawing-set' }, sourceBlob: new Blob(['pdf'], { type: 'application/pdf' }), pageNumber: 1, canvas: canvas() })).status, 'invalid-document-role');
  assert.equal((await viewer.open({ document: { ...specification, contentHash: 'spec-v1' }, sourceBlob: new Blob(['pdf'], { type: 'application/pdf' }), pageNumber: 0, canvas: canvas() })).status, 'exact-source-page-required');
  assert.equal(proxies.length, 0);
});

test('production source keeps specification and drawing PDF ownership isolated', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const sourceViewer = readFileSync(new URL('../src/specification-source-viewer.js', import.meta.url), 'utf8');
  assert.match(app, /createSpecificationSourceViewer\(\{ openPdf: openPdfBlob, renderPage: renderPdfPage/);
  assert.match(app, /data-specification-view-source-page/);
  assert.match(app, /specificationDrawingReturnTarget[\s\S]*drawingViewerEngine\.restoreViewport/);
  assert.match(sourceViewer, /retainedSpecificationPageRecordsInMemory: target \? 1 : 0/);
  assert.doesNotMatch(sourceViewer, /buildDrawingPageModel|createDrawingCatalog|drawingRenderCache/);
});
