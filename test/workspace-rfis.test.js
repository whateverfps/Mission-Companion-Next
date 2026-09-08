import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkspaceRfiDraft,
  buildWorkspaceRfisModel,
  createWorkspaceRfisStore,
  workspaceRfiStatusOptions,
  workspaceRfiTimestampLabel
} from '../src/workspace-rfis.js';

function createMemoryStorage(initial = {}) {
  const state = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(String(key), String(value));
    },
    removeItem(key) {
      state.delete(key);
    }
  };
}

test('workspace RFI draft captures active sheet, sheet specs, and linked context', () => {
  const draft = buildWorkspaceRfiDraft({
    projectId: 'bedford',
    workspace: { id: 'B13', building: '61', room: 'B13', level: 'Basement', type: 'PRIMARY TELECOMMUNICATIONS ROOM' },
    selectedSheet: { sheetNumber: '61E-100', sheetTitle: 'POWER PLAN - BASEMENT LEVEL', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:16', pageNumber: 16, drawingSetId: 'bedford-b61-drawings' },
    relatedIssue: { id: 'issue-1', title: 'Awaiting contractor schedule' },
    relatedChecklistItem: { id: 'check-1', title: 'Contractor schedule review' },
    relatedObservation: { id: 'obs-1', title: 'Observation from active context' },
    relatedSpecifications: [
      { sectionNumber: '26 05 11', sectionTitle: 'REQUIREMENTS FOR ELECTRICAL INSTALLATIONS' },
      { sectionNumber: '26 26 00', sectionTitle: 'GROUNDING AND BONDING FOR ELECTRICAL SYSTEMS' }
    ],
    sourceContext: { launchedFrom: 'issues' }
  });

  assert.equal(draft.projectId, 'bedford');
  assert.equal(draft.workspaceId, 'B13');
  assert.equal(draft.building, '61');
  assert.equal(draft.room, 'B13');
  assert.equal(draft.level, 'Basement');
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.selectedSheet.sheetNumber, '61E-100');
  assert.deepEqual(draft.relatedSpecifications.map(spec => spec.sectionNumber), ['26 05 11', '26 26 00']);
  assert.equal(draft.relatedIssues[0]?.id, 'issue-1');
  assert.equal(draft.relatedChecklistItems[0]?.id, 'check-1');
  assert.equal(draft.relatedObservations[0]?.id, 'obs-1');
  assert.equal(draft.sourceContext.projectId, 'bedford');
  assert.equal(draft.sourceContext.workspaceId, 'B13');
  assert.equal(draft.sourceContext.selectedSheet.sheetNumber, '61E-100');
  assert.deepEqual(draft.sourceContext.selectedSheetSpecifications.map(spec => spec.sectionNumber), ['26 05 11', '26 26 00']);
  assert.equal(draft.sourceContext.relatedIssueId, 'issue-1');
  assert.equal(draft.sourceContext.relatedChecklistItemId, 'check-1');
  assert.equal(draft.sourceContext.relatedObservationId, 'obs-1');
  assert.ok(draft.sourceContext.capturedAt);
});

test('workspace RFIs persist, reload, and remain isolated by workspace id', async () => {
  const storage = createMemoryStorage();
  const persisted = [];
  const persistence = {
    async loadRfis(projectId) {
      return persisted.filter(record => record.projectId === projectId);
    },
    async putRfi(record) {
      persisted.push(structuredClone(record));
    }
  };
  const store = createWorkspaceRfisStore({ storage, persistence, now: () => '2026-08-15T10:00:00Z' });

  const b13 = store.create({
    projectId: 'bedford',
    workspaceId: 'B13',
    building: '61',
    room: 'B13',
    level: 'Basement',
    subject: 'Cable tray routing conflict',
    question: 'Confirm revised routing and required clearance from existing piping.',
    suggestedResolution: 'Coordinate a revised path and clearance detail.',
    requestedResponseDate: '2026-08-20',
    status: 'DRAFT',
    selectedSheet: {
      sheetNumber: '61E-100',
      sheetTitle: 'POWER PLAN - BASEMENT LEVEL',
      documentId: 'bedford-b61-drawings',
      pageId: 'drawing-page:bedford-b61-drawings:16',
      pageNumber: 16,
      drawingSetId: 'bedford-b61-drawings'
    },
    relatedSpecifications: [{ sectionNumber: '26 05 11', sectionTitle: 'REQUIREMENTS FOR ELECTRICAL INSTALLATIONS' }],
    relatedIssues: [{ kind: 'issue', id: 'issue-1', title: 'Awaiting contractor schedule' }],
    relatedChecklistItems: [{ kind: 'checklist', id: 'check-1', title: 'Contractor schedule review' }],
    relatedObservations: [{ kind: 'observation', id: 'obs-1', title: 'Observed cable tray conflict' }],
    sourceContext: { launchedFrom: 'issues' }
  });
  assert.match(b13.localId, /^DRAFT-RFI-/);

  const created124 = store.create({
    projectId: 'bedford',
    workspaceId: '124',
    building: '61',
    room: '124',
    level: 'First Level',
    subject: 'Grounding bond label missing',
    question: 'Confirm the intended label and location for the missing grounding bond marker.',
    status: 'OPEN',
    selectedSheet: {
      sheetNumber: '61T-101',
      sheetTitle: 'TELECOMMUNICATION PLAN - FIRST LEVEL',
      documentId: 'bedford-b61-drawings',
      pageId: 'drawing-page:bedford-b61-drawings:17',
      pageNumber: 17,
      drawingSetId: 'bedford-b61-drawings'
    },
    relatedSpecifications: [{ sectionNumber: '27 05 26', sectionTitle: 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS' }],
    sourceContext: { launchedFrom: 'checklist' }
  });

  const updated = store.update(b13.id, {
    subject: 'Cable tray routing conflict - revised',
    requestedResponseDate: '2026-08-21',
    status: 'OPEN'
  });
  assert.equal(updated.status, 'OPEN');
  const closed = store.close(created124.id, true);
  assert.equal(closed.status, 'CLOSED');

  assert.equal(store.list({ projectId: 'bedford', workspaceId: 'B13' }).length, 1);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: '124' }).length, 1);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: 'B13', includeClosed: false }).length, 1);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: '124', includeClosed: false }).length, 0);

  const reloaded = createWorkspaceRfisStore({ storage: createMemoryStorage(), persistence, now: () => '2026-08-15T11:00:00Z' });
  await reloaded.load('bedford');

  const reloadedB13 = reloaded.get(b13.id);
  const reloaded124 = reloaded.get(created124.id);
  assert.equal(reloadedB13?.workspaceId, 'B13');
  assert.equal(reloadedB13?.status, 'OPEN');
  assert.equal(reloadedB13?.selectedSheet?.sheetNumber, '61E-100');
  assert.deepEqual(reloadedB13?.relatedSpecifications.map(spec => spec.sectionNumber), ['26 05 11']);
  assert.equal(reloadedB13?.sourceContext?.launchedFrom, 'issues');
  assert.equal(reloaded124?.workspaceId, '124');
  assert.equal(reloaded124?.status, 'CLOSED');
  assert.equal(reloaded124?.selectedSheet?.sheetNumber, '61T-101');
  assert.equal(reloaded124?.sourceContext?.launchedFrom, 'checklist');
  assert.equal(reloaded.list({ projectId: 'bedford', workspaceId: 'B13' }).length, 1);
  assert.equal(reloaded.list({ projectId: 'bedford', workspaceId: '124' }).length, 1);
});

test('workspace RFI model keeps filters, selection, and linked counts scoped to the active workspace', () => {
  const workspace = { id: 'B13', building: '61', room: 'B13', name: 'Primary Telecommunications Room', level: 'Basement' };
  const rfis = [
    {
      id: 'rfi-a',
      projectId: 'bedford',
      workspaceId: 'B13',
      status: 'OPEN',
      localId: 'DRAFT-RFI-001',
      subject: 'Open RFI',
      question: 'Confirm routing',
      selectedSheet: { sheetNumber: '61E-100', sheetTitle: 'POWER PLAN - BASEMENT LEVEL', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:16', pageNumber: 16 },
      relatedSpecifications: [{ sectionNumber: '26 05 11', sectionTitle: 'REQUIREMENTS FOR ELECTRICAL INSTALLATIONS' }],
      relatedIssues: [{ id: 'issue-1', title: 'Dependency' }],
      relatedChecklistItems: [{ id: 'check-1', title: 'Checklist item' }],
      relatedObservations: [{ id: 'obs-1', title: 'Observation item' }],
      attachments: [],
      sourceContext: { launchedFrom: 'overview' }
    },
    {
      id: 'rfi-b',
      projectId: 'bedford',
      workspaceId: 'B13',
      status: 'CLOSED',
      localId: 'DRAFT-RFI-002',
      subject: 'Closed RFI',
      question: 'Confirm detail',
      selectedSheet: { sheetNumber: '61E-101', sheetTitle: 'POWER PLAN - FIRST LEVEL', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:17', pageNumber: 17 },
      relatedSpecifications: [],
      relatedIssues: [],
      relatedChecklistItems: [],
      relatedObservations: [],
      attachments: [],
      sourceContext: { launchedFrom: 'issues' }
    },
    {
      id: 'rfi-c',
      projectId: 'bedford',
      workspaceId: '124',
      status: 'OPEN',
      localId: 'DRAFT-RFI-003',
      subject: 'Other workspace RFI',
      question: 'Confirm detail',
      selectedSheet: { sheetNumber: '61T-101', sheetTitle: 'TELECOMMUNICATION PLAN - FIRST LEVEL', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:17', pageNumber: 17 },
      relatedSpecifications: [],
      relatedIssues: [],
      relatedChecklistItems: [],
      relatedObservations: [],
      attachments: [],
      sourceContext: { launchedFrom: 'checklist' }
    }
  ];

  const model = buildWorkspaceRfisModel({
    projectId: 'bedford',
    workspace,
    rfis,
    filter: 'open',
    selectedRfiId: 'rfi-b'
  });

  assert.equal(model.projectId, 'bedford');
  assert.equal(model.workspaceId, 'B13');
  assert.equal(model.counts.total, 2);
  assert.equal(model.counts.open, 1);
  assert.equal(model.counts.closed, 1);
  assert.equal(model.counts.linkedIssues, 1);
  assert.equal(model.counts.linkedChecklistItems, 1);
  assert.equal(model.counts.linkedObservations, 1);
  assert.equal(model.rfis.length, 1);
  assert.equal(model.rfis[0].id, 'rfi-a');
  assert.equal(model.selectedRfi?.id, 'rfi-a');
  assert.equal(model.selectedRfiId, 'rfi-a');
  assert.equal(model.emptyState, '');
  assert.equal(model.filters.find(filter => filter.id === 'all')?.count, 2);
  assert.equal(model.filters.find(filter => filter.id === 'open')?.count, 1);
  assert.equal(model.filters.find(filter => filter.id === 'closed')?.count, 1);
});

test('workspace RFI option helpers expose the approved lifecycle set', () => {
  assert.deepEqual(workspaceRfiStatusOptions().map(item => item.id), ['DRAFT', 'OPEN', 'ANSWERED', 'CLOSED']);
  assert.match(workspaceRfiTimestampLabel('2026-08-15T10:00:00Z'), /\d{1,2}\/\d{1,2}\/\d{4}/);
  assert.equal(workspaceRfiTimestampLabel(''), 'Unavailable');
});
