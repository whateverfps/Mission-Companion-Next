import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDrawingPageConsistency, createDrawingTarget, drawingAnnouncementText, drawingFocusTarget, drawingReturnAction, reconcileDrawingMatchingSheetIds, resolveDrawingPageNavigation, resolveDrawingTarget } from '../src/drawing-navigation.js';

test('resolveDrawingTarget preserves page and region context for exact drawing restoration', () => {
  const analysis = {
    documentId: 'doc-1',
    drawingSetId: 'set-1',
    projectId: 'project-1',
    sheets: [{ sheetId: 'sheet-1', pageNumber: 2, sheetNumber: 'S2' }],
    observations: [{ observationId: 'obs-1', sheetId: 'sheet-1', region: { x: 0.2, y: 0.3, width: 0.4, height: 0.5 } }]
  };
  const target = createDrawingTarget({
    projectId: 'project-1',
    documentId: 'doc-1',
    drawingSetId: 'set-1',
    sheetId: 'sheet-1',
    pageNumber: 2,
    region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
  });

  const resolved = resolveDrawingTarget(target, { documents: [{ id: 'doc-1', documentType: 'drawing-set' }], analyses: [analysis] });

  assert.equal(resolved.sheet?.sheetId, 'sheet-1');
  assert.equal(resolved.sheet?.pageNumber, 2);
  assert.deepEqual(resolved.region, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
});

test('resolveDrawingTarget uses the permanent drawing registry identity before sheet metadata', () => {
  const analysis = { documentId: 'doc-1', drawingSetId: 'set-1', projectId: 'project-1', sheets: [
    { drawingId: 'drawing-1', sheetId: 'sheet-1', pageNumber: 1 },
    { drawingId: 'drawing-2', sheetId: 'sheet-2', pageNumber: 2 }
  ], observations: [] };
  const target = createDrawingTarget({ projectId: 'project-1', documentId: 'doc-1', drawingSetId: 'set-1', drawingId: 'drawing-2', sheetId: 'stale-sheet', pageNumber: 99 });
  const resolved = resolveDrawingTarget(target, { documents: [{ id: 'doc-1', projectId: 'project-1', documentType: 'drawing-set' }], analyses: [analysis] });
  assert.equal(resolved.sheet?.drawingId, 'drawing-2');
  assert.equal(resolved.sheet?.pageNumber, 2);
});

test('resolveDrawingTarget prefers exact plan-object and region state over stale observations', () => {
  const analysis = {
    documentId: 'doc-2',
    drawingSetId: 'set-2',
    projectId: 'project-2',
    sheets: [{ sheetId: 'sheet-2', pageNumber: 3, sheetNumber: 'S3' }],
    observations: [{ observationId: 'obs-stale', sheetId: 'sheet-2', region: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }],
    candidateOccurrences: [{ occurrenceId: 'plan-1', sheetId: 'sheet-2', pageNumber: 3, region: { x: 0.2, y: 0.2, width: 0.1, height: 0.1 } }]
  };
  const target = createDrawingTarget({
    projectId: 'project-2',
    documentId: 'doc-2',
    drawingSetId: 'set-2',
    sheetId: 'sheet-2',
    pageNumber: 3,
    observationId: 'obs-stale',
    planObjectId: 'plan-1',
    region: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 }
  });

  const resolved = resolveDrawingTarget(target, { documents: [{ id: 'doc-2', documentType: 'drawing-set' }], analyses: [analysis] });

  assert.equal(resolveDrawingTarget({ documentId: 'spec' }, { documents: [{ id: 'spec', documentType: 'specifications' }], analyses: [] }).status, 'invalid-document-role');

  assert.equal(resolved.kind, 'plan-object');
  assert.equal(resolved.planObject?.occurrenceId, 'plan-1');
  assert.deepEqual(resolved.region, { x: 0.2, y: 0.2, width: 0.1, height: 0.1 });
});

test('createDrawingTarget preserves plan-object, matching-sheet, and return metadata for later restoration', () => {
  const target = createDrawingTarget({
    projectId: 'project-2',
    documentId: 'doc-2',
    drawingSetId: 'set-2',
    sheetId: 'sheet-3',
    pageNumber: 3,
    planObjectId: 'plan-1',
    matchingSheetIds: ['sheet-3', 'sheet-4'],
    returnTarget: 'work-package'
  });

  assert.equal(target?.planObjectId, 'plan-1');
  assert.deepEqual(target?.matchingSheetIds, ['sheet-3', 'sheet-4']);
  assert.equal(target?.returnTarget, 'work-package');
});

test('matching-sheet reconciliation removes stale ids and preserves order', () => {
  const analysis = {
    drawingSetId: 'set-2',
    sheets: [{ sheetId: 'sheet-2' }, { sheetId: 'sheet-3' }, { sheetId: 'sheet-4' }]
  };
  const matched = reconcileDrawingMatchingSheetIds({
    target: createDrawingTarget({ documentId: 'doc-2', drawingSetId: 'set-2', sheetId: 'sheet-3', matchingSheetIds: ['sheet-4', 'stale', 'sheet-3'] }),
    analysis,
    previousMatchingSheetIds: ['sheet-2', 'sheet-3']
  });

  assert.deepEqual(matched.matchingSheetIds, ['sheet-4', 'sheet-3']);
  assert.equal(matched.activeSheetId, 'sheet-3');
});

test('drawing return and focus helpers produce deterministic labels and announcements', () => {
  assert.equal(drawingReturnAction('chief-answer').label, 'Return to Chief Answer');
  assert.equal(drawingReturnAction('work-package').label, 'Return to Work Package');
  assert.equal(drawingFocusTarget({ observation: { observationId: 'obs' } }), 'mc-drawing-selected-evidence');
  assert.match(drawingAnnouncementText({ sheet: { sheetNumber: 'S-101', sheetTitle: 'Floor Plan' }, observation: { value: 'Room 101' } }), /S-101/);
  assert.equal(drawingAnnouncementText({ sheet: null }), 'No drawing selected');
  assert.equal(drawingAnnouncementText(), 'No drawing selected');
});

test('navigation contract resolves drawing ID, sheet number, then PDF page without side effects', () => {
  const pages = [{ drawingId: 'drawing-1', normalizedSheetNumber: '61G001', pdfPageNumber: 2 }, { drawingId: 'drawing-2', normalizedSheetNumber: '61M101', pdfPageNumber: 26 }];
  assert.equal(resolveDrawingPageNavigation({ drawingId: 'drawing-2', pdfPageNumber: 2 }, pages).pageNumber, 26);
  assert.equal(resolveDrawingPageNavigation({ sheetNumber: '61M-101' }, pages).pageNumber, 26);
  assert.equal(resolveDrawingPageNavigation({ pdfPageNumber: 2 }, pages).pageNumber, 2);
  assert.deepEqual(resolveDrawingPageNavigation({ sheetNumber: 'missing' }, pages, 10), { resolved: false, pageNumber: 10, page: null, reason: 'unresolved' });
});

test('catalog page ID is the stable first-priority navigation identity', () => {
  const pages = [{ pageId: 'drawing-page:doc:4', drawingId: 'legacy-drawing', sheetNumber: '61M-101', pdfPageNumber: 4 }];
  const resolved = resolveDrawingPageNavigation({ pageId: 'drawing-page:doc:4', drawingId: 'wrong', sheetNumber: 'WRONG', pdfPageNumber: 1 }, pages);
  assert.equal(resolved.resolved, true);
  assert.equal(resolved.reason, 'page-id');
  assert.equal(resolved.pageNumber, 4);
});

test('development page consistency assertion rejects sidebar, toolbar, viewer, and target disagreement', () => {
  assert.equal(assertDrawingPageConsistency({ selectedPage: 5, renderedPage: 5, targetPage: 5, toolbarPage: 5, activePage: 5 }), true);
  assert.throws(() => assertDrawingPageConsistency({ selectedPage: 5, renderedPage: 4, targetPage: 5, toolbarPage: 5, activePage: 5 }), /state disagreement/);
});
