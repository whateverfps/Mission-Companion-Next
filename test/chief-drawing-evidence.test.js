import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChiefDrawingEvidence } from '../src/chief-drawing-evidence.js';

test('buildChiefDrawingEvidence creates a preview for an exact drawing target', () => {
  const message = {
    id: 'message-1',
    role: 'assistant',
    content: 'The exact drawing target is here.',
    drawingContext: {
      documentId: 'doc-1',
      drawingSetId: 'set-1',
      sheetId: 'sheet-1',
      pageNumber: 3,
      sheetNumber: 'S-101',
      observationId: 'obs-1',
      region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 }
    }
  };
  const preview = buildChiefDrawingEvidence(message, {
    documents: [{ id: 'doc-1', title: 'Drawing Set' }],
    analyses: [{
      documentId: 'doc-1',
      drawingSetId: 'set-1',
      sheets: [{
        sheetId: 'sheet-1',
        sheetNumber: 'S-101',
        sheetTitle: 'First Floor Plan',
        pageNumber: 3,
        discipline: 'Mechanical',
        primarySheetType: 'Floor Plan',
        confidence: 0.92,
        warnings: []
      }],
      observations: [{ observationId: 'obs-1', sheetId: 'sheet-1', region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } }]
    }]
  });

  assert.ok(preview);
  assert.equal(preview.sheetNumber, 'S-101');
  assert.equal(preview.pageNumber, 3);
  assert.equal(preview.discipline, 'Mechanical');
  assert.equal(preview.observationId, 'obs-1');
  assert.deepEqual(preview.region, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  assert.equal(preview.reason, 'Exact drawing evidence selected from the active plan context.');
});

test('buildChiefDrawingEvidence skips unresolved drawing targets', () => {
  const message = {
    id: 'message-2',
    role: 'assistant',
    content: 'No exact drawing target.',
    drawingContext: {
      documentId: 'doc-2',
      sheetId: 'missing-sheet',
      pageNumber: 99
    }
  };
  const preview = buildChiefDrawingEvidence(message, {
    documents: [{ id: 'doc-2', title: 'Drawing Set' }],
    analyses: [{ documentId: 'doc-2', drawingSetId: 'set-2', sheets: [] }]
  });

  assert.equal(preview, null);
});

test('buildChiefDrawingEvidence skips ambiguous page-based targets', () => {
  const message = {
    id: 'message-3',
    role: 'assistant',
    content: 'The drawing target is page-based but ambiguous.',
    drawingContext: {
      documentId: 'doc-3',
      pageNumber: 4
    }
  };
  const preview = buildChiefDrawingEvidence(message, {
    documents: [{ id: 'doc-3', title: 'Ambiguous Drawing Set' }],
    analyses: [{
      documentId: 'doc-3',
      drawingSetId: 'set-3',
      sheets: [{
        sheetId: 'sheet-a',
        sheetNumber: 'S-201',
        sheetTitle: 'Foundation Plan',
        pageNumber: 4,
        discipline: 'Structural',
        primarySheetType: 'Plan',
        confidence: 0.88
      }, {
        sheetId: 'sheet-b',
        sheetNumber: 'S-202',
        sheetTitle: 'Roof Plan',
        pageNumber: 4,
        discipline: 'Structural',
        primarySheetType: 'Plan',
        confidence: 0.78
      }],
      observations: []
    }]
  });

  assert.equal(preview, null);
});
