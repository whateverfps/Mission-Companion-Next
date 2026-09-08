import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingContextService } from '../src/drawing-context.js';
import { classifyDrawingWorkspaceCommand, createDrawingWorkspace } from '../src/drawing-workspace.js';
import { createDrawingViewerEngine } from '../src/drawing-viewer-engine.js';

const page = { documentId: 'doc-1', drawingSetId: 'set-1', projectId: 'general', drawingId: 'drawing-2', sheetNumber: '61M-101', sheetTitle: 'Mechanical Plan', discipline: 'Mechanical', drawingType: 'Plan', pdfPageNumber: 2, searchableText: '61M-101 Mechanical Plan' };

test('empty page context is structured and never fabricates linked data', () => {
  const context = createDrawingContextService().getContext(page);
  assert.equal(context.page.sheetNumber, '61M-101');
  for (const key of ['specifications', 'relatedDrawings', 'inspectionItems', 'equipment', 'rooms', 'photos', 'documents', 'risks', 'questions', 'issues', 'history']) assert.deepEqual(context[key], []);
});

test('page links remain isolated and use structured records', () => {
  const service = createDrawingContextService();
  assert.equal(service.linkSpecification(page, { id: '23-05-00', title: 'Common Work Results' }), true);
  assert.equal(service.linkInspection(page, { id: 'inspection-1', title: 'Startup' }), true);
  const context = service.getContext(page);
  assert.equal(context.specifications[0].id, '23-05-00');
  assert.equal(context.inspectionItems[0].id, 'inspection-1');
  assert.deepEqual(service.getContext({ ...page, pdfPageNumber: 3 }).specifications, []);
});

test('failing context providers are contained and cannot break page context', () => {
  const service = createDrawingContextService({ providers: [() => { throw new Error('provider offline'); }, () => ({ rooms: [{ id: '127B' }] })] });
  const context = service.getContext(page);
  assert.deepEqual(context.rooms, [{ id: '127B' }]);
  assert.deepEqual(context.providerErrors, ['provider offline']);
});

test('workspace remains operational with zero providers, overlays, registry, analysis, or AI', () => {
  const viewerEngine = createDrawingViewerEngine();
  viewerEngine.openDocument('doc-1', 70, 1);
  const workspace = createDrawingWorkspace({ viewerEngine, contextService: createDrawingContextService() });
  workspace.setPages(Array.from({ length: 70 }, (_, index) => ({ documentId: 'doc-1', pdfPageNumber: index + 1, pageNumber: index + 1, searchableText: `Page ${index + 1}` })));
  assert.deepEqual(workspace.extensions(), { overlays: [], sidebarSections: [], toolbarActions: [] });
  assert.equal(workspace.open({ pdfPageNumber: 10 }).pageNumber, 10);
  assert.equal(viewerEngine.snapshot().selectedPage, 10);
  assert.deepEqual(workspace.getContext(10).specifications, []);
});

test('workspace navigation preserves per-page viewport and metadata upgrades do not reset it', () => {
  const viewerEngine = createDrawingViewerEngine();
  viewerEngine.openDocument('doc-1', 2, 1);
  viewerEngine.restoreViewport(1, { zoom: 1.75, scrollLeft: 35, scrollTop: 20 });
  const workspace = createDrawingWorkspace({ viewerEngine, contextService: createDrawingContextService() });
  workspace.setPages([{ documentId: 'doc-1', pdfPageNumber: 1 }, { documentId: 'doc-1', pdfPageNumber: 2 }]);
  workspace.setPages([{ documentId: 'doc-1', drawingId: 'drawing-1', sheetNumber: '61G-000', pdfPageNumber: 1 }, page]);
  assert.equal(viewerEngine.getViewport(1).zoom, 1.75);
  assert.equal(workspace.open({ drawingId: 'drawing-2' }).pageNumber, 2);
  assert.equal(workspace.search('mechanical').length, 1);
});

test('workspace extension hooks are optional and command modes remain explicit', () => {
  const workspace = createDrawingWorkspace({ viewerEngine: createDrawingViewerEngine(), contextService: createDrawingContextService() });
  assert.equal(workspace.registerOverlay('rooms', { label: 'Rooms' }), true);
  assert.equal(workspace.registerSidebarSection('records', { label: 'Records' }), true);
  assert.equal(workspace.registerToolbarAction('inspect', { label: 'Inspect' }), true);
  assert.equal(workspace.registerContextProvider(() => ({})), true);
  assert.deepEqual(workspace.extensions(), { overlays: ['rooms'], sidebarSections: ['records'], toolbarActions: ['inspect'] });
  assert.equal(classifyDrawingWorkspaceCommand('Open sheet 61M-101'), 'navigation');
  assert.equal(classifyDrawingWorkspaceCommand('Explain this drawing'), 'analysis');
  assert.equal(classifyDrawingWorkspaceCommand('What is here?'), 'conversation');
});
