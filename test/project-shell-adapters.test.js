import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectShellModel } from '../src/project-shell-adapter.js';
import { buildProjectHomeModel } from '../src/project-home-adapter.js';
import { buildDocumentsModel } from '../src/documents-adapter.js';
import { buildControlsModel } from '../src/controls-adapter.js';
import { buildChiefContext } from '../src/chief-context-adapter.js';
import { BEDFORD_PROJECT } from '../src/bedford-project.js';

test('project shell preserves project identity and derives defensible counts', () => {
  const model = buildProjectShellModel({ project: BEDFORD_PROJECT.manifest.project, documents: [{ category: 'Drawings' }, { category: 'Specifications' }], milestones: [{ category: 'schedule', date: '2026-10-01', title: 'Mobilization' }], workspaces: [{ id: 'B61' }] });
  assert.equal(model.identity.id, 'bedford');
  assert.equal(model.identity.number, '518-22-700');
  assert.deepEqual(model.nextUp.map(item => item.title), ['Mobilization']);
  assert.equal(model.counts.drawings, 1);
  assert.equal(model.counts.specifications, 1);
  assert.equal(model.counts.workspaces, 1);
});

test('project home degrades safely with missing optional data', () => {
  const model = buildProjectHomeModel({ project: BEDFORD_PROJECT.manifest.project, documents: [], milestones: [], workspaces: [] });
  assert.equal(model.identity.id, 'bedford');
  assert.ok(Array.isArray(model.nextUp));
  assert.equal(model.counts.drawings, 0);
});

test('documents adapter preserves source identity and status', () => {
  const model = buildDocumentsModel([{ id: 'doc-1', name: 'Plans.pdf', category: 'Drawings', status: 'verified' }], [{ documentId: 'doc-1', id: 's-1' }]);
  assert.equal(model.records[0].title, 'Plans.pdf');
  assert.equal(model.records[0].sourceStatus, 'Available');
  assert.equal(model.records[0].sections[0].id, 's-1');
});

test('controls adapter does not claim a schedule exists when there are no activities', () => {
  assert.equal(buildControlsModel().scheduleStatus, 'Awaiting contractor schedule');
});

test('Chief context follows the active shell surface', () => {
  assert.deepEqual(buildChiefContext({ surface: 'workspace', workspaceId: 'B61' }), { projectId: 'bedford', surface: 'workspace', workspaceId: 'B61', documentId: '', drawingPageId: '', projectRecordId: '', promptPrefix: 'Ask Chief about this workspace.' });
});
