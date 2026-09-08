import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBedfordWorkspaceModel } from '../src/workspace-registry.js';
import { buildWorkspaceDocumentsModel } from '../src/workspace-documents.js';
import { buildWorkspaceIssuesModel } from '../src/workspace-issues.js';
import { buildWorkspaceChecklistModel } from '../src/workspace-checklist.js';
import { buildWorkspaceTimelineModel } from '../src/workspace-timeline.js';
import {
  buildWorkspaceNotesModel,
  createWorkspaceNotesStore,
  workspaceNoteCategoryOptions,
  workspaceNoteFilterOptions
} from '../src/workspace-notes.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function memoryPersistence() {
  const records = new Map();
  return {
    records,
    async loadNotes(projectId = '') {
      return [...records.values()].filter(record => !projectId || record.projectId === projectId).map(record => structuredClone(record));
    },
    async putNote(record) {
      const key = `${record.projectId}:${record.workspaceId}:${record.id}`;
      records.set(key, structuredClone(record));
    },
    async deleteNote(noteId, projectId = '', workspaceId = '') {
      records.delete(`${projectId}:${workspaceId}:${noteId}`);
    }
  };
}

function workspaceContext(id) {
  const workspaceModel = buildBedfordWorkspaceModel(id);
  const workspace = workspaceModel.activeWorkspace;
  const documentsModel = buildWorkspaceDocumentsModel({
    workspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext
  });
  const issuesModel = buildWorkspaceIssuesModel({
    workspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext
  });
  const checklistModel = buildWorkspaceChecklistModel({
    workspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel
  });
  const timelineModel = buildWorkspaceTimelineModel({
    workspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel,
    checklistModel,
    now: new Date('2026-08-14T12:00:00Z')
  });
  return { workspaceModel, workspace, documentsModel, issuesModel, checklistModel, timelineModel };
}

test('Workspace notes create, edit, pin, archive, and persist across store reloads', () => {
  let tick = 0;
  const storage = memoryStorage();
  const store = createWorkspaceNotesStore({
    storage,
    now: () => `2026-08-14T12:00:0${tick++}Z`,
    idFactory: () => `note-${tick}`
  });

  const created = store.create({
    projectId: 'bedford',
    workspaceId: 'B13',
    text: 'Verify grounding conductor routing before rack installation.',
    category: 'field',
    tags: ['OIT', ' POWER ', 'OIT'],
    pinned: true
  });

  assert.equal(created.projectId, 'bedford');
  assert.equal(created.workspaceId, 'B13');
  assert.equal(created.category, 'FIELD');
  assert.deepEqual(created.tags, ['OIT', 'POWER']);
  assert.equal(created.createdAt, created.updatedAt);
  assert.equal(created.pinned, true);

  const updated = store.update(created.id, {
    text: 'Verify grounding conductor routing and bonding before rack installation.',
    tags: ['OIT', 'POWER', 'FIELD']
  });
  assert.equal(updated.createdAt, created.createdAt);
  assert.notEqual(updated.updatedAt, created.updatedAt);
  assert.match(updated.text, /bonding/);
  assert.deepEqual(updated.tags, ['OIT', 'POWER', 'FIELD']);

  const reloaded = createWorkspaceNotesStore({ storage, idFactory: () => 'never-used' });
  assert.equal(reloaded.list({ projectId: 'bedford', workspaceId: 'B13' }).length, 1);
  assert.equal(reloaded.get(created.id)?.text, updated.text);
  assert.equal(reloaded.get(created.id)?.pinned, true);

  const archived = reloaded.archive(created.id, true);
  assert.equal(archived?.archived, true);
  assert.equal(reloaded.list({ projectId: 'bedford', workspaceId: 'B13' }).length, 0);
  assert.equal(reloaded.list({ projectId: 'bedford', workspaceId: 'B13', includeArchived: true }).length, 1);
});

test('Workspace notes persist through durable project storage and reload by workspace without cross-leakage', async () => {
  const persistence = memoryPersistence();
  const storage = memoryStorage();
  let tick = 0;
  const store = createWorkspaceNotesStore({
    storage,
    persistence,
    now: () => `2026-08-14T12:00:0${tick++}Z`,
    idFactory: () => `note-${tick}`
  });

  const createdB13 = store.create({
    projectId: 'bedford',
    workspaceId: 'B13',
    text: 'B13 field note',
    category: 'FIELD',
    tags: ['OIT', 'Grounding'],
    pinned: true,
    sourceLinks: [{ kind: 'drawing', id: 'drawing:61T-100', label: '61T-100', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:48', pageNumber: 48, sheetNumber: '61T-100' }]
  });
  const created124 = store.create({
    projectId: 'bedford',
    workspaceId: '124',
    text: '124 coordination note',
    category: 'COORDINATION',
    archived: false
  });

  const reloaded = createWorkspaceNotesStore({ storage: memoryStorage(), persistence, idFactory: () => 'never-used' });
  await reloaded.load('bedford');

  const reloadedB13 = reloaded.list({ projectId: 'bedford', workspaceId: 'B13' });
  const reloaded124 = reloaded.list({ projectId: 'bedford', workspaceId: '124' });

  assert.equal(reloadedB13.length, 1);
  assert.equal(reloaded124.length, 1);
  assert.equal(reloadedB13[0].id, createdB13.id);
  assert.equal(reloaded124[0].id, created124.id);
  assert.equal(reloadedB13[0].pinned, true);
  assert.deepEqual(reloadedB13[0].tags, ['OIT', 'Grounding']);
  assert.equal(reloadedB13[0].sourceLinks.length, 1);
  assert.equal(reloadedB13[0].sourceLinks[0].documentId, 'bedford-b61-drawings');

  const updated = reloaded.update(createdB13.id, {
    text: 'B13 field note updated',
    tags: ['OIT', 'Bonding'],
    sourceLinks: [{ kind: 'document', id: 'document:bedford-ntp-notice-to-proceed', label: 'Notice to Proceed', documentId: 'bedford-ntp-notice-to-proceed', openTarget: { kind: 'source', documentId: 'bedford-ntp-notice-to-proceed', destination: 'sources' } }]
  });
  assert.match(updated.text, /updated/);
  assert.deepEqual(updated.tags, ['OIT', 'Bonding']);
  assert.equal(updated.sourceLinks[0].documentId, 'bedford-ntp-notice-to-proceed');

  const archived = reloaded.archive(created124.id, true);
  assert.equal(archived.archived, true);

  const finalReload = createWorkspaceNotesStore({ storage: memoryStorage(), persistence, idFactory: () => 'never-used-again' });
  await finalReload.load('bedford');
  const finalB13 = finalReload.list({ projectId: 'bedford', workspaceId: 'B13' });
  const final124 = finalReload.list({ projectId: 'bedford', workspaceId: '124' });
  assert.equal(finalB13.length, 1);
  assert.equal(final124.length, 0);
  assert.equal(finalB13[0].text, 'B13 field note updated');
  assert.equal(finalB13[0].archived, false);
  assert.equal(finalB13[0].pinned, true);
  assert.deepEqual(finalB13[0].tags, ['OIT', 'Bonding']);
  assert.equal(finalB13[0].sourceLinks[0].documentId, 'bedford-ntp-notice-to-proceed');
});

test('Workspace notes stay scoped by project and workspace with no cross-room leakage', () => {
  const storage = memoryStorage();
  const store = createWorkspaceNotesStore({ storage, idFactory: () => 'note-scope' });
  store.create({ projectId: 'bedford', workspaceId: 'B13', text: 'B13 note', category: 'FIELD' });
  store.create({ projectId: 'bedford', workspaceId: '124', text: '124 note', category: 'COORDINATION' });
  store.create({ projectId: 'bedford', workspaceId: '137', text: '137 note', category: 'QUESTION' });
  assert.equal(store.list({ projectId: 'bedford', workspaceId: 'B13' }).length, 1);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: '124' }).length, 1);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: '137' }).length, 1);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: 'B13' })[0].text, 'B13 note');
  assert.equal(store.list({ projectId: 'bedford', workspaceId: '124' })[0].text, '124 note');
});

test('Pinned notes sort first, then newest updated and created notes', () => {
  let tick = 0;
  const storage = memoryStorage();
  const store = createWorkspaceNotesStore({
    storage,
    now: () => `2026-08-14T12:00:0${tick++}Z`,
    idFactory: () => `note-${tick}`
  });
  const first = store.create({ projectId: 'bedford', workspaceId: 'B13', text: 'Older unpinned', category: 'GENERAL' });
  const second = store.create({ projectId: 'bedford', workspaceId: 'B13', text: 'Pinned and newest', category: 'FIELD', pinned: true });
  const third = store.create({ projectId: 'bedford', workspaceId: 'B13', text: 'Newest unpinned', category: 'QUESTION' });
  store.update(first.id, { text: 'Older unpinned updated later' });
  const sorted = store.list({ projectId: 'bedford', workspaceId: 'B13' });
  assert.equal(sorted[0].id, second.id);
  assert.equal(sorted[1].id, first.id);
  assert.equal(sorted[2].id, third.id);
});

test('Workspace notes filters and search stay deterministic', () => {
  const storage = memoryStorage();
  const store = createWorkspaceNotesStore({ storage, idFactory: () => 'note-filter' });
  store.create({ projectId: 'bedford', workspaceId: 'B13', text: 'Field grounding note', category: 'FIELD', tags: ['POWER'], pinned: true, sourceLinks: [{ kind: 'drawing', id: 'drawing:61T-100', label: '61T-100' }] });
  store.create({ projectId: 'bedford', workspaceId: 'B13', text: 'Coordination reminder', category: 'COORDINATION' });
  store.create({ projectId: 'bedford', workspaceId: 'B13', text: 'Follow up question', category: 'FOLLOW_UP' });
  const { workspace, documentsModel, issuesModel, checklistModel, timelineModel } = workspaceContext('B13');
  const base = buildWorkspaceNotesModel({
    projectId: 'bedford',
    workspace,
    documentsModel,
    issuesModel,
    checklistModel,
    timelineModel,
    notesStore: store
  });
  assert.equal(base.notes.length, 3);
  assert.equal(buildWorkspaceNotesModel({ projectId: 'bedford', workspace, documentsModel, issuesModel, checklistModel, timelineModel, notesStore: store, filter: 'pinned' }).notes.length, 1);
  assert.equal(buildWorkspaceNotesModel({ projectId: 'bedford', workspace, documentsModel, issuesModel, checklistModel, timelineModel, notesStore: store, filter: 'FIELD' }).notes.length, 1);
  assert.equal(buildWorkspaceNotesModel({ projectId: 'bedford', workspace, documentsModel, issuesModel, checklistModel, timelineModel, notesStore: store, filter: 'linked' }).notes.length, 1);
  assert.equal(buildWorkspaceNotesModel({ projectId: 'bedford', workspace, documentsModel, issuesModel, checklistModel, timelineModel, notesStore: store, search: 'coordination' }).notes.length, 1);
  assert.equal(buildWorkspaceNotesModel({ projectId: 'bedford', workspace, documentsModel, issuesModel, checklistModel, timelineModel, notesStore: store, search: 'power' }).notes.length, 1);
  assert.ok(workspaceNoteCategoryOptions().some(item => item.id === 'DOCUMENT_REVIEW'));
  assert.ok(workspaceNoteFilterOptions().some(item => item.id === 'linked'));
});

test('Workspace notes evidence choices are scoped to the active Workspace and preserve all supported reference types', () => {
  const b13 = workspaceContext('B13');
  const b124 = workspaceContext('124');
  const store = createWorkspaceNotesStore({ storage: memoryStorage(), idFactory: () => 'note-links' });
  const b13Model = buildWorkspaceNotesModel({
    projectId: 'bedford',
    workspace: b13.workspace,
    documentsModel: b13.documentsModel,
    issuesModel: b13.issuesModel,
    checklistModel: b13.checklistModel,
    timelineModel: b13.timelineModel,
    notesStore: store
  });
  const b124Model = buildWorkspaceNotesModel({
    projectId: 'bedford',
    workspace: b124.workspace,
    documentsModel: b124.documentsModel,
    issuesModel: b124.issuesModel,
    checklistModel: b124.checklistModel,
    timelineModel: b124.timelineModel,
    notesStore: store
  });
  assert.ok(b13Model.evidenceGroups.some(group => group.items.some(item => item.kind === 'drawing' && item.sheetNumber === '61T-100')));
  assert.ok(b13Model.evidenceGroups.some(group => group.items.some(item => item.kind === 'specification' && item.sectionNumber === '27 10 00')));
  assert.ok(b13Model.evidenceGroups.some(group => group.items.some(item => item.kind === 'document')));
  assert.ok(b13Model.evidenceGroups.some(group => group.items.some(item => item.kind === 'issue')));
  assert.ok(b13Model.evidenceGroups.some(group => group.items.some(item => item.kind === 'checklist')));
  assert.ok(b13Model.evidenceGroups.some(group => group.items.some(item => item.kind === 'timeline')));
  assert.equal(b124Model.evidenceGroups.some(group => group.items.some(item => item.sheetNumber === '61T-100')), false);
  assert.ok(b124Model.evidenceGroups.some(group => group.items.some(item => item.sheetNumber === '61T-101')));
  assert.ok(b124Model.evidenceGroups.some(group => group.items.some(item => item.sectionNumber === '27 10 00')));
  assert.equal(b124Model.evidenceGroups.filter(group => group.id === 'drawings-primary').length, 1);
  assert.equal(b13Model.evidenceGroups.filter(group => group.id === 'drawings-primary').length, 1);
});

test('Linked evidence references persist for drawings, specifications, documents, issues, checklist items, and timeline items', () => {
  const storage = memoryStorage();
  const store = createWorkspaceNotesStore({ storage, idFactory: () => 'note-ref' });
  const created = store.create({
    projectId: 'bedford',
    workspaceId: 'B13',
    text: 'Verify grounding and schedule context.',
    category: 'DECISION',
    sourceLinks: [
      { kind: 'drawing', id: 'drawing:61T-100', label: '61T-100', sheetNumber: '61T-100', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:1', pageNumber: 1 },
      { kind: 'specification', id: 'specification:27 05 26', label: '27 05 26', sectionNumber: '27 05 26', openTarget: { kind: 'specification', sectionNumber: '27 05 26' } },
      { kind: 'document', id: 'document:bedford-ntp-notice-to-proceed', label: 'Notice to Proceed', documentId: 'bedford-ntp-notice-to-proceed', openTarget: { kind: 'source', documentId: 'bedford-ntp-notice-to-proceed', destination: 'sources' } },
      { kind: 'issue', id: 'issue:awaiting-schedule', label: 'Awaiting Contractor Schedule', issueId: 'awaiting-schedule' },
      { kind: 'checklist', id: 'checklist:room-schedule', label: 'Room Schedule', checklistId: 'room-schedule' },
      { kind: 'timeline', id: 'timeline:interim-project-schedule', label: 'Interim Project Schedule', timelineId: 'interim-project-schedule' }
    ]
  });
  const reloaded = createWorkspaceNotesStore({ storage, idFactory: () => 'never-used' });
  const persisted = reloaded.get(created.id);
  assert.equal(persisted?.sourceLinks.length, 6);
  assert.equal(persisted?.sourceLinks[0].kind, 'drawing');
  assert.equal(persisted?.sourceLinks[1].kind, 'specification');
  assert.equal(persisted?.sourceLinks[2].kind, 'document');
  assert.equal(persisted?.sourceLinks[3].kind, 'issue');
  assert.equal(persisted?.sourceLinks[4].kind, 'checklist');
  assert.equal(persisted?.sourceLinks[5].kind, 'timeline');
});

test('Workspace notes do not invent authors or depend on OpenAI', () => {
  const storage = memoryStorage();
  const store = createWorkspaceNotesStore({ storage, idFactory: () => 'note-auth' });
  const note = store.create({
    projectId: 'bedford',
    workspaceId: '137',
    text: 'Confirm transition context.',
    category: 'QUESTION',
    tags: ['TRANSITION']
  });
  assert.equal(note.author, undefined);
  assert.equal(typeof globalThis.openai, 'undefined');
  const { workspace, documentsModel, issuesModel, checklistModel, timelineModel } = workspaceContext('137');
  const model = buildWorkspaceNotesModel({
    projectId: 'bedford',
    workspace,
    documentsModel,
    issuesModel,
    checklistModel,
    timelineModel,
    notesStore: store
  });
  assert.equal(model.notes.length, 1);
  assert.equal(model.notes[0].text, 'Confirm transition context.');
});

test('Workspace switching does not leak note state and existing Workspace records remain intact', () => {
  const storage = memoryStorage();
  const store = createWorkspaceNotesStore({ storage, idFactory: () => 'note-switch' });
  store.create({ projectId: 'bedford', workspaceId: 'B13', text: 'B13 private note', category: 'FIELD' });
  store.create({ projectId: 'bedford', workspaceId: '124', text: '124 private note', category: 'GENERAL' });
  const b13 = workspaceContext('B13');
  const b124 = workspaceContext('124');
  const b13Notes = buildWorkspaceNotesModel({ projectId: 'bedford', workspace: b13.workspace, documentsModel: b13.documentsModel, issuesModel: b13.issuesModel, checklistModel: b13.checklistModel, timelineModel: b13.timelineModel, notesStore: store });
  const b124Notes = buildWorkspaceNotesModel({ projectId: 'bedford', workspace: b124.workspace, documentsModel: b124.documentsModel, issuesModel: b124.issuesModel, checklistModel: b124.checklistModel, timelineModel: b124.timelineModel, notesStore: store });
  assert.equal(b13Notes.notes[0].text, 'B13 private note');
  assert.equal(b124Notes.notes[0].text, '124 private note');
  assert.equal(b13.workspaceModel.activeWorkspace.id, 'B13');
  assert.equal(b124.workspaceModel.activeWorkspace.id, '124');
});
