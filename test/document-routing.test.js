import test from 'node:test';
import assert from 'node:assert/strict';
import { canOpenInDrawingWorkspace, classifyDocumentRole, documentIndexCounts, documentRoute, persistDocumentClassification } from '../src/document-routing.js';
import { readFileSync } from 'node:fs';

test('explicit roles persist and specifications can never route to Drawing Workspace', () => {
  const specification = persistDocumentClassification({ id: 'spec', name: '518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf', pageCount: 2363 }, 'specifications');
  assert.equal(classifyDocumentRole(specification).documentType, 'specifications');
  assert.equal(canOpenInDrawingWorkspace(specification), false);
  assert.deepEqual(documentRoute(specification).permittedViewers, ['source-evidence-viewer']);
  assert.equal(documentRoute(specification).indexingService, 'specification-index');
});

test('Building 61 profile routes only to drawing services', () => {
  const drawing = persistDocumentClassification({ name: '518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf' });
  assert.equal(drawing.documentType, 'drawing-set'); assert.equal(canOpenInDrawingWorkspace(drawing), true);
  assert.deepEqual(documentRoute(drawing).permittedViewers, ['drawing-viewer']);
});

test('persisted specifications cannot be reclassified by PDF type or page count', () => {
  assert.equal(classifyDocumentRole({ documentType: 'specifications', type: 'application/pdf', pageCount: 2363, category: 'Drawings' }).documentType, 'specifications');
  assert.equal(classifyDocumentRole({ type: 'application/pdf', pageCount: 70, name: 'unclassified.pdf' }).documentType, 'other');
});

test('retrieval chunks remain distinct from true CSI specification sections', () => {
  const sections = [{ documentId: 'spec', hierarchyType: 'spec-section', sectionNumber: '23 31 00' }, { documentId: 'spec', hierarchyType: 'section', sectionNumber: '' }];
  assert.deepEqual(documentIndexCounts({ id: 'spec', pageCount: 2363, retrievalChunkCount: 13802 }, sections), { sourcePageCount: 2363, retrievalChunkCount: 13802, specificationSectionCount: 1 });
});

test('production Drawing Workspace filters roles before opening retained PDFs', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const retained = app.slice(app.indexOf('async function createRetainedPdfViewerAnalysis'), app.indexOf('function captureDrawingViewport'));
  const workspace = app.slice(app.indexOf('async function renderDrawingWorkspaceWithProviders'), app.indexOf('async function renderMissionControlDashboard'));
  assert.match(retained, /!isDrawingDocumentRole\(documentRecord\)/);
  assert.match(workspace, /allDocuments\.filter\(isDrawingDocumentRole\)/);
  assert.match(workspace, /allDocuments\.find\(isSpecificationDocument\)/);
  assert.ok(workspace.indexOf('filter(isDrawingDocumentRole)') < workspace.indexOf('createRetainedPdfViewerAnalysis'));
});
