import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWorkspaceDrawingMarkupStore,
  getWorkspaceDrawingMarkupPalette,
  normalizeMarkupGeometry,
  normalizeMarkupPoint,
  normalizeMarkupStyle,
  normalizeMarkupDisplayStyle,
  renderWorkspaceDrawingMarkupPrimitive,
  renderWorkspaceDrawingMarkupSelectionOverlay,
  WORKSPACE_DRAWING_MARKUP_TYPES,
  WORKSPACE_DRAWING_MARKUP_TOOL_SECTIONS
} from '../src/workspace-drawing-markups.js';

test('workspace drawing markup helpers normalize geometry and style', () => {
  assert.equal(normalizeMarkupPoint({ x: 1.5, y: -0.25 }).x, 1);
  assert.equal(normalizeMarkupPoint({ x: 1.5, y: -0.25 }).y, 0);
  assert.deepEqual(normalizeMarkupGeometry({ x: 1.5, y: -0.25, width: 0, height: 0 }, 'TEXT'), { x: 1, y: 0, width: 0.22, height: 0.1 });
  assert.equal(normalizeMarkupStyle({ stroke: '', opacity: 2 }, 'HIGHLIGHTER').stroke, '#f6d04d');
  assert.equal(WORKSPACE_DRAWING_MARKUP_TYPES[0].id, 'SELECT');
  assert.equal(WORKSPACE_DRAWING_MARKUP_TOOL_SECTIONS[0].id, 'recent');
});

test('workspace drawing markup display style keeps primitive rendering bounded and tool-specific', () => {
  const expectations = {
    PEN: { strokeWidth: 1.5, fill: 'transparent', vectorEffect: 'non-scaling-stroke' },
    HIGHLIGHTER: { strokeWidth: 4, fill: 'transparent', opacity: 0.28 },
    LINE: { strokeWidth: 1.5, fill: 'transparent' },
    ARROW: { strokeWidth: 1.5, fill: 'transparent', markerSize: 6 },
    RECTANGLE: { strokeWidth: 1.5, fill: 'transparent' },
    ELLIPSE: { strokeWidth: 1.5, fill: 'transparent' },
    CLOUD: { strokeWidth: 1.5, fill: 'transparent' },
    TEXT: { strokeWidth: 1.5, fill: 'transparent', fontSize: 12 },
    CALLOUT: { strokeWidth: 1.5, fill: 'transparent', fontSize: 12, markerSize: 6 }
  };

  for (const [tool, expected] of Object.entries(expectations)) {
    const style = normalizeMarkupDisplayStyle({}, tool);
    assert.equal(style.fill, expected.fill);
    assert.equal(style.vectorEffect, 'non-scaling-stroke');
    assert.ok(style.strokeWidth >= 1 && style.strokeWidth <= 6);
    if ('opacity' in expected) assert.equal(style.opacity, expected.opacity);
    if ('fontSize' in expected) assert.equal(style.fontSize, expected.fontSize);
    if ('markerSize' in expected) assert.equal(style.markerSize, expected.markerSize);
  }
});

test('workspace drawing markup primitive rendering keeps each tool visually distinct and bounded', () => {
  const pen = renderWorkspaceDrawingMarkupPrimitive({
    id: 'pen',
    type: 'PEN',
    geometry: { points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.15 }, { x: 0.3, y: 0.18 }] },
    style: {}
  });
  assert.match(pen, /<path/);
  assert.match(pen, /fill="none"/);
  assert.match(pen, /stroke-width="1.5px"/);

  const highlighter = renderWorkspaceDrawingMarkupPrimitive({
    id: 'highlighter',
    type: 'HIGHLIGHTER',
    geometry: { points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.16 }, { x: 0.32, y: 0.18 }] },
    style: {}
  });
  assert.match(highlighter, /<path/);
  assert.match(highlighter, /fill="none"/);
  assert.match(highlighter, /opacity="0\.28"/);

  const line = renderWorkspaceDrawingMarkupPrimitive({
    id: 'line',
    type: 'LINE',
    geometry: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 },
    style: {}
  });
  assert.match(line, /<line/);
  assert.doesNotMatch(line, /marker-end/);
  assert.match(line, /fill="none"/);

  const arrow = renderWorkspaceDrawingMarkupPrimitive({
    id: 'arrow',
    type: 'ARROW',
    geometry: { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 },
    style: {}
  });
  assert.match(arrow, /marker-end="url\(#mc-mdi-arrowhead\)"/);

  const rectangle = renderWorkspaceDrawingMarkupPrimitive({
    id: 'rectangle',
    type: 'RECTANGLE',
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.18 },
    style: {}
  });
  assert.match(rectangle, /<rect/);
  assert.match(rectangle, /fill="none"/);

  const ellipse = renderWorkspaceDrawingMarkupPrimitive({
    id: 'ellipse',
    type: 'ELLIPSE',
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.18 },
    style: {}
  });
  assert.match(ellipse, /<ellipse/);
  assert.match(ellipse, /fill="none"/);

  const cloud = renderWorkspaceDrawingMarkupPrimitive({
    id: 'cloud',
    type: 'CLOUD',
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.18 },
    style: {}
  });
  assert.match(cloud, /<path/);
  assert.match(cloud, /stroke-dasharray/);
  assert.match(cloud, /fill="none"/);

  const text = renderWorkspaceDrawingMarkupPrimitive({
    id: 'text',
    type: 'TEXT',
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.12 },
    text: 'Note',
    style: {}
  });
  assert.match(text, /<rect/);
  assert.match(text, /font-size="12px"/);
  assert.match(text, /fill="none"/);

  const callout = renderWorkspaceDrawingMarkupPrimitive({
    id: 'callout',
    type: 'CALLOUT',
    geometry: { x: 0.1, y: 0.1, width: 0.24, height: 0.16 },
    text: 'Callout',
    style: {}
  });
  assert.match(callout, /<path/);
  assert.match(callout, /<rect/);
  assert.match(callout, /font-size="12px"/);

  const selection = renderWorkspaceDrawingMarkupSelectionOverlay({
    id: 'rectangle',
    type: 'RECTANGLE',
    geometry: { x: 0.1, y: 0.1, width: 0.2, height: 0.18 }
  });
  assert.match(selection, /data-mdi-handle="nw"/);
  assert.match(selection, /data-mdi-handle="se"/);
});

test('workspace drawing markup palette remains compact and professional', () => {
  assert.deepEqual(getWorkspaceDrawingMarkupPalette(), ['#d9534f', '#2f80ed', '#27ae60', '#f2c94c', '#f2994a', '#111111', '#ffffff']);
});

test('workspace drawing markup store replaces scoped records and tool chest data', async () => {
  const stateRecords = [];
  const removeScoped = (kind, projectId, workspaceId, drawingSetId) => {
    for (let index = stateRecords.length - 1; index >= 0; index -= 1) {
      const item = stateRecords[index];
      if (item.kind === kind && item.projectId === projectId && item.workspaceId === workspaceId && item.drawingSetId === drawingSetId) {
        stateRecords.splice(index, 1);
      }
    }
  };
  const persistence = {
    async loadMarkups(projectId, workspaceId, drawingSetId) {
      return stateRecords.filter(item => item.kind === 'workspace-drawing-markup' && item.projectId === projectId && item.workspaceId === workspaceId && item.drawingSetId === drawingSetId).map(item => structuredClone(item.record));
    },
    async saveMarkups(records, projectId, workspaceId, drawingSetId) {
      removeScoped('workspace-drawing-markup', projectId, workspaceId, drawingSetId);
      stateRecords.push(...records.map(record => ({
        id: `workspace-drawing-markup:${projectId}:${workspaceId}:${drawingSetId}:${record.id}`,
        kind: 'workspace-drawing-markup',
        projectId,
        workspaceId,
        drawingSetId,
        record: structuredClone(record),
        updatedAt: record.updatedAt
      })));
    },
    async deleteMarkup(markupId, projectId, workspaceId, drawingSetId) {
      const key = `workspace-drawing-markup:${projectId}:${workspaceId}:${drawingSetId}:${markupId}`;
      const index = stateRecords.findIndex(item => item.id === key);
      if (index >= 0) stateRecords.splice(index, 1);
    },
    async loadMarkupTools(projectId, workspaceId, drawingSetId) {
      return stateRecords.filter(item => item.kind === 'workspace-drawing-tool' && item.projectId === projectId && item.workspaceId === workspaceId && item.drawingSetId === drawingSetId).map(item => structuredClone(item.record));
    },
    async saveMarkupTools(records, projectId, workspaceId, drawingSetId) {
      removeScoped('workspace-drawing-tool', projectId, workspaceId, drawingSetId);
      stateRecords.push(...records.map(record => ({
        id: `workspace-drawing-tool:${projectId}:${workspaceId}:${drawingSetId}:${record.id}`,
        kind: 'workspace-drawing-tool',
        projectId,
        workspaceId,
        drawingSetId,
        record: structuredClone(record),
        updatedAt: record.updatedAt
      })));
    },
    async deleteMarkupTool(toolId, projectId, workspaceId, drawingSetId) {
      const key = `workspace-drawing-tool:${projectId}:${workspaceId}:${drawingSetId}:${toolId}`;
      const index = stateRecords.findIndex(item => item.id === key);
      if (index >= 0) stateRecords.splice(index, 1);
    }
  };

  const store = createWorkspaceDrawingMarkupStore({
    persistence,
    now: () => '2026-08-17T10:00:00.000Z',
    idFactory: () => 'generated-id'
  });

  await store.save({
    id: 'markup-a',
    projectId: 'bedford',
    workspaceId: 'B13',
    drawingSetId: 'set-a',
    sheetNumber: '61T-100',
    pdfPageNumber: 48,
    type: 'RECTANGLE',
    geometry: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    style: {},
    linkedRecords: { issueIds: [], rfiIds: [], evidenceIds: [], observationIds: [] }
  });
  await store.save({
    id: 'markup-b',
    projectId: 'bedford',
    workspaceId: 'B13',
    drawingSetId: 'set-a',
    sheetNumber: '61T-100',
    pdfPageNumber: 48,
    type: 'LINE',
    geometry: { x1: 0.2, y1: 0.2, x2: 0.4, y2: 0.4 },
    style: {},
    linkedRecords: { issueIds: [], rfiIds: [], evidenceIds: [], observationIds: [] }
  });

  assert.equal((await store.list({ projectId: 'bedford', workspaceId: 'B13', drawingSetId: 'set-a' })).length, 2);

  await store.remove('markup-a', 'bedford', 'B13', 'set-a');
  assert.equal((await store.list({ projectId: 'bedford', workspaceId: 'B13', drawingSetId: 'set-a' })).length, 1);
  assert.equal((await store.list({ projectId: 'bedford', workspaceId: 'B13', drawingSetId: 'set-b' })).length, 0);

  await store.saveTool({
    id: 'tool-a',
    projectId: 'bedford',
    workspaceId: 'B13',
    drawingSetId: 'set-a',
    name: 'Utility Line',
    section: 'my-tools'
  }, {
    id: 'markup-b',
    projectId: 'bedford',
    workspaceId: 'B13',
    drawingSetId: 'set-a',
    sheetNumber: '61T-100',
    pdfPageNumber: 48,
    type: 'LINE',
    geometry: { x1: 0.2, y1: 0.2, x2: 0.4, y2: 0.4 },
    style: {},
    linkedRecords: { issueIds: [], rfiIds: [], evidenceIds: [], observationIds: [] }
  });

  assert.equal((await store.listTools({ projectId: 'bedford', workspaceId: 'B13', drawingSetId: 'set-a' })).length, 1);
  assert.equal(store.diagnostics().backend, 'IndexedDB');
  assert.equal(store.diagnostics().storageKey, 'mission-companion:workspace-drawing-markups:v1');
  assert.equal(store.diagnostics().toolStorageKey, 'mission-companion:workspace-drawing-tool-chest:v1');
  assert.equal(store.diagnostics().markupCount, 1);
  assert.equal(store.diagnostics().toolCount, 1);
  assert.ok(store.diagnostics().scopes.includes('bedford::B13::set-a'));
  assert.ok(await store.deleteTool('tool-a', 'bedford', 'B13', 'set-a'));
  assert.equal((await store.listTools({ projectId: 'bedford', workspaceId: 'B13', drawingSetId: 'set-a' })).length, 0);
});
