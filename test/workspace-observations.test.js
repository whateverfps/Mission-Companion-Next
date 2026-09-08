import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkspaceObservationDraft,
  buildWorkspaceObservationsModel,
  createWorkspaceObservationsStore,
  workspaceObservationStatusOptions,
  workspaceObservationSeverityOptions,
  workspaceObservationTimestampLabel,
  workspaceObservationTypeOptions
} from '../src/workspace-observations.js';

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

test('workspace observation draft captures the active sheet, sheet specs, and contextual workspace data', () => {
  const draft = buildWorkspaceObservationDraft({
    projectId: 'bedford',
    workspace: { id: 'B13', building: '61', room: 'B13', level: 'Basement', type: 'PRIMARY' },
    selectedSheet: { sheetNumber: '61E-100', sheetTitle: 'POWER PLAN - BASEMENT LEVEL', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:16', pdfPageNumber: 16 },
    relatedSpecifications: [
      { sectionNumber: '26 05 11', sectionTitle: 'REQUIREMENTS FOR ELECTRICAL INSTALLATIONS' },
      { sectionNumber: '26 26 00', sectionTitle: 'GROUNDING AND BONDING FOR ELECTRICAL SYSTEMS' }
    ],
    relatedIssue: { id: 'issue-1', title: 'Awaiting contractor schedule' },
    relatedChecklistItem: { id: 'check-1', title: 'Contractor schedule review' },
    sourceContext: { launchedFrom: 'overview' }
  });

  assert.equal(draft.projectId, 'bedford');
  assert.equal(draft.workspaceId, 'B13');
  assert.equal(draft.building, '61');
  assert.equal(draft.room, 'B13');
  assert.equal(draft.level, 'Basement');
  assert.equal(draft.selectedSheet.sheetNumber, '61E-100');
  assert.equal(draft.relatedSpecifications.length, 2);
  assert.equal(draft.sourceContext.projectId, 'bedford');
  assert.equal(draft.sourceContext.workspaceId, 'B13');
  assert.equal(draft.sourceContext.selectedSheet.sheetNumber, '61E-100');
  assert.deepEqual(draft.sourceContext.selectedSheetSpecifications.map(spec => spec.sectionNumber), ['26 05 11', '26 26 00']);
  assert.equal(draft.sourceContext.relatedIssueId, 'issue-1');
  assert.equal(draft.sourceContext.relatedChecklistItemId, 'check-1');
  assert.ok(draft.sourceContext.capturedAt);
});

test('workspace observations persist, reload, and remain isolated by workspace id', async () => {
  const storage = createMemoryStorage();
  const persisted = [];
  const persistence = {
    async loadObservations(projectId) {
      return persisted.filter(record => record.projectId === projectId);
    },
    async putObservation(record) {
      persisted.push(structuredClone(record));
    }
  };
  const store = createWorkspaceObservationsStore({ storage, persistence, now: () => '2026-08-15T10:00:00Z' });

  const b13 = store.create({
    projectId: 'bedford',
    workspaceId: 'B13',
    building: '61',
    room: 'B13',
    level: 'Basement',
    title: 'Missing firestopping at cable tray',
    description: 'Observed open penetration above the cable tray.',
    category: 'CONSTRUCTION',
    severity: 'HIGH',
    status: 'OPEN',
    selectedSheet: {
      sheetNumber: '61E-100',
      sheetTitle: 'POWER PLAN - BASEMENT LEVEL',
      documentId: 'bedford-b61-drawings',
      pageId: 'drawing-page:bedford-b61-drawings:16',
      pdfPageNumber: 16
    },
    relatedSpecifications: [{ sectionNumber: '07 84 00', sectionTitle: 'FIRESTOPPING' }],
    sourceContext: { launchedFrom: 'issues' }
  });
  const created124 = store.create({
    projectId: 'bedford',
    workspaceId: '124',
    building: '61',
    room: '124',
    level: 'First Level',
    title: 'Grounding bond label missing',
    description: 'Bonding label not present on visible panel.',
    category: 'GENERAL',
    severity: 'INFO',
    status: 'WATCH',
    selectedSheet: {
      sheetNumber: '61T-101',
      sheetTitle: 'TELECOMMUNICATION PLAN - FIRST LEVEL',
      documentId: 'bedford-b61-drawings',
      pageId: 'drawing-page:bedford-b61-drawings:17',
      pdfPageNumber: 17
    },
    relatedSpecifications: [{ sectionNumber: '27 05 26', sectionTitle: 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS' }],
    sourceContext: { launchedFrom: 'checklist' }
  });

  const updated = store.update(b13.id, {
    title: 'Missing firestopping at cable tray opening',
    description: 'Observed open penetration above the cable tray.',
    severity: 'CRITICAL'
  });
  assert.equal(updated.severity, 'CRITICAL');
  const closed = store.close(b13.id, true);
  assert.equal(closed.status, 'CLOSED');

  assert.equal(store.list({ projectId: 'bedford', workspaceId: 'B13' }).length, 1);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: '124' }).length, 1);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: 'B13', includeClosed: false }).length, 0);
  assert.equal(store.list({ projectId: 'bedford', workspaceId: '124', includeClosed: false }).length, 1);

  const reloaded = createWorkspaceObservationsStore({ storage: createMemoryStorage(), persistence, now: () => '2026-08-15T11:00:00Z' });
  await reloaded.load('bedford');

  const reloadedB13 = reloaded.get(b13.id);
  const reloaded124 = reloaded.get(created124.id);
  assert.equal(reloadedB13?.status, 'CLOSED');
  assert.equal(reloadedB13?.severity, 'CRITICAL');
  assert.equal(reloadedB13?.selectedSheet?.sheetNumber, '61E-100');
  assert.deepEqual(reloadedB13?.relatedSpecifications.map(spec => spec.sectionNumber), ['07 84 00']);
  assert.equal(reloadedB13?.sourceContext?.launchedFrom, 'issues');
  assert.equal(reloaded124?.status, 'WATCH');
  assert.equal(reloaded124?.selectedSheet?.sheetNumber, '61T-101');
  assert.equal(reloaded124?.sourceContext?.launchedFrom, 'checklist');
  assert.equal(reloaded.list({ projectId: 'bedford', workspaceId: 'B13' }).length, 1);
  assert.equal(reloaded.list({ projectId: 'bedford', workspaceId: '124' }).length, 1);
  assert.equal(reloaded.list({ projectId: 'bedford', workspaceId: 'B13', includeClosed: false }).length, 0);
});

test('workspace observations model keeps filters, selection, and counts scoped to the active workspace', () => {
  const workspace = { id: 'B13', building: '61', room: 'B13', name: 'Primary Telecommunications Room', level: 'Basement' };
  const observations = [
    {
      id: 'obs-a',
      projectId: 'bedford',
      workspaceId: 'B13',
      status: 'OPEN',
      category: 'GENERAL',
      severity: 'INFO',
      title: 'Open observation',
      description: '',
      selectedSheet: { sheetNumber: '61E-100', sheetTitle: 'POWER PLAN - BASEMENT LEVEL', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:16', pdfPageNumber: 16 },
      relatedSpecifications: [{ sectionNumber: '26 05 11', sectionTitle: 'REQUIREMENTS FOR ELECTRICAL INSTALLATIONS' }],
      relatedIssues: [{ id: 'issue-1', title: 'Dependency' }],
      relatedChecklistItems: [{ id: 'check-1', title: 'Checklist item' }],
      attachments: [],
      sourceContext: { launchedFrom: 'overview' }
    },
    {
      id: 'obs-b',
      projectId: 'bedford',
      workspaceId: 'B13',
      status: 'CLOSED',
      category: 'SAFETY',
      severity: 'LOW',
      title: 'Closed observation',
      description: '',
      selectedSheet: { sheetNumber: '61E-101', sheetTitle: 'POWER PLAN - FIRST LEVEL', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:17', pdfPageNumber: 17 },
      relatedSpecifications: [],
      relatedIssues: [],
      relatedChecklistItems: [],
      attachments: [],
      sourceContext: { launchedFrom: 'issues' }
    },
    {
      id: 'obs-c',
      projectId: 'bedford',
      workspaceId: '124',
      status: 'OPEN',
      category: 'CONSTRUCTION',
      severity: 'HIGH',
      title: 'Other workspace observation',
      description: '',
      selectedSheet: { sheetNumber: '61T-101', sheetTitle: 'TELECOMMUNICATION PLAN - FIRST LEVEL', documentId: 'bedford-b61-drawings', pageId: 'drawing-page:bedford-b61-drawings:17', pdfPageNumber: 17 },
      relatedSpecifications: [],
      relatedIssues: [],
      relatedChecklistItems: [],
      attachments: [],
      sourceContext: { launchedFrom: 'checklist' }
    }
  ];

  const model = buildWorkspaceObservationsModel({
    projectId: 'bedford',
    workspace,
    observations,
    filter: 'open',
    selectedObservationId: 'obs-b'
  });

  assert.equal(model.projectId, 'bedford');
  assert.equal(model.workspaceId, 'B13');
  assert.equal(model.counts.total, 2);
  assert.equal(model.counts.open, 1);
  assert.equal(model.counts.closed, 1);
  assert.equal(model.counts.linkedIssues, 1);
  assert.equal(model.counts.linkedChecklistItems, 1);
  assert.equal(model.observations.length, 1);
  assert.equal(model.observations[0].id, 'obs-a');
  assert.equal(model.selectedObservation?.id, 'obs-a');
  assert.equal(model.selectedObservationId, 'obs-a');
  assert.equal(model.emptyState, '');
  assert.equal(model.types.find(type => type.id === 'GENERAL')?.count, 1);
  assert.equal(model.types.find(type => type.id === 'SAFETY')?.count, 1);
  assert.equal(model.filters.find(filter => filter.id === 'all')?.count, 2);
  assert.equal(model.filters.find(filter => filter.id === 'open')?.count, 1);
  assert.equal(model.filters.find(filter => filter.id === 'closed')?.count, 1);
});

test('workspace observation option helpers expose the approved category, severity, and status sets', () => {
  assert.deepEqual(workspaceObservationTypeOptions().map(item => item.id), ['GENERAL', 'QUALITY', 'SAFETY', 'COORDINATION', 'DOCUMENTATION', 'CONSTRUCTION', 'TESTING', 'PUNCH']);
  assert.deepEqual(workspaceObservationSeverityOptions().map(item => item.id), ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  assert.deepEqual(workspaceObservationStatusOptions().map(item => item.id), ['OPEN', 'WATCH', 'CLOSED']);
  assert.match(workspaceObservationTimestampLabel('2026-08-15T10:00:00Z'), /\d{1,2}\/\d{1,2}\/\d{4}/);
  assert.equal(workspaceObservationTimestampLabel(''), 'Unavailable');
});
