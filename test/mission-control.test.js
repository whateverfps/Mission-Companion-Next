import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStartupExperience,
  buildMissionControlPriorities,
  buildRecentActivity,
  buildProjectHealth,
  buildRecommendedActions,
  buildContinuation,
  friendlyWorkspaceLabel,
  countMissionControlSources,
  buildMissionControlModel,
  separateMissionControlProjects,
  resolvePreviousProject,
  missionControlResponseModeLabel
} from '../src/mission-control.js';
import { createWorkspaceFullscreenReviewController } from '../src/workspace-fullscreen-review.js';
import fs from 'node:fs';
import { createDemonstrationProjectFixture, DEMO_PROJECT_ID } from '../src/demo-project.js';

const project = { id: 'p1', name: 'Clinic Renovation' };
const baseInspection = {
  inspectionId: 'i1', inspectionNumber: 'INS-001', title: 'Firestopping',
  status: 'Complete', result: 'Acceptable', inspectionDate: '2026-07-31'
};

test('startup experience defaults and invalid values normalize to Mission Control', () => {
  assert.equal(normalizeStartupExperience(), 'mission-control');
  assert.equal(normalizeStartupExperience('invalid'), 'mission-control');
  assert.equal(normalizeStartupExperience('professional-workspace'), 'professional-workspace');
});

test('Mission Control labels each response mode without combining answer surfaces', () => {
  assert.equal(missionControlResponseModeLabel('offline'), 'Source Evidence');
  assert.equal(missionControlResponseModeLabel('source'), 'Chief Analysis');
  assert.equal(missionControlResponseModeLabel('assisted'), 'Chief Analysis');
  assert.equal(missionControlResponseModeLabel('general'), 'Chief Analysis');
});

test('priorities use the approved practical urgency order', () => {
  const priorities = buildMissionControlPriorities({
    today: '2026-07-31',
    inspections: [
      { ...baseInspection, inspectionId: 'deficient', inspectionNumber: 'INS-005', result: 'Deficient' },
      { ...baseInspection, inspectionId: 'progress', inspectionNumber: 'INS-004', status: 'In Progress' },
      { ...baseInspection, inspectionId: 'follow', inspectionNumber: 'INS-003', followUpRequired: true },
      { ...baseInspection, inspectionId: 'today', inspectionNumber: 'INS-002', followUpRequired: true, followUpDate: '2026-07-31' },
      { ...baseInspection, inspectionId: 'overdue', inspectionNumber: 'INS-001', followUpRequired: true, followUpDate: '2026-07-30' }
    ]
  });
  assert.deepEqual(priorities.map(item => item.kind), ['overdue', 'due-today', 'follow-up', 'in-progress', 'deficient']);
});

test('closed inspections do not create overdue or deficient priorities', () => {
  const priorities = buildMissionControlPriorities({ today: '2026-07-31', inspections: [{ ...baseInspection, status: 'Closed', result: 'Deficient', followUpRequired: true, followUpDate: '2026-07-01' }] });
  assert.deepEqual(priorities, []);
});

test('RFI and submittal type alone never fabricate pending priorities', () => {
  const documents = [
    { id: 'r1', category: 'RFIs', type: 'rfi', status: 'Open' },
    { id: 's1', category: 'Submittals', type: 'submittal', status: 'Approved' }
  ];
  assert.deepEqual(buildMissionControlPriorities({ today: '2026-07-31', documents }), []);
  assert.deepEqual(countMissionControlSources(documents), { drawings: 0, specifications: 0, rfis: 1, submittals: 1 });
});

test('recent activity requires explicit timestamps and orders deterministically', () => {
  const activity = buildRecentActivity({
    project,
    inspections: [
      { ...baseInspection, inspectionId: 'untimed' },
      { ...baseInspection, inspectionId: 'updated', createdAt: '2026-07-29T12:00:00Z', updatedAt: '2026-07-31T12:00:00Z', status: 'Complete' }
    ],
    documents: [
      { id: 'd1', title: 'Drawing', importedAt: '2026-07-30T12:00:00Z' },
      { id: 'd2', title: 'No timestamp' }
    ]
  });
  assert.deepEqual(activity.map(item => item.id), ['inspection:updated:updated', 'document:d1:imported']);
  assert.equal(activity[0].detail, 'Current status: Complete');
});

test('health categories explain exact facts and do not infer positive health from missing data', () => {
  assert.equal(buildProjectHealth().label, 'No Project Open');
  const empty = buildProjectHealth({ project, inspections: [], today: '2026-07-31' });
  assert.equal(empty.label, 'Ready to Begin');
  assert.match(empty.explanation, /no current inspection task/i);
  const attention = buildProjectHealth({ project, today: '2026-07-31', inspections: [{ ...baseInspection, result: 'Deficient' }] });
  assert.equal(attention.label, 'Needs Attention');
  assert.match(attention.explanation, /deficient result/i);
});

test('recommended actions preserve deterministic reasons and targets', () => {
  const priorities = buildMissionControlPriorities({ today: '2026-07-31', inspections: [{ ...baseInspection, result: 'Deficient' }] });
  const actions = buildRecommendedActions(priorities);
  assert.equal(actions[0].reason, 'The recorded inspection result is Deficient.');
  assert.deepEqual(actions[0].target, { view: 'inspections', inspectionId: 'i1' });
});

test('continuation describes only current-session state', () => {
  const items = buildContinuation({ selectedInspectionId: 'i1', activeWorkflowType: 'Inspection Preparation', hasEngineeringContext: true, selectedDocumentId: 'd1', hasConversation: true });
  assert.deepEqual(items.map(item => item.label), ['Resume Inspection', 'Continue Current Task', 'Return to Current Work', 'Continue Reviewing Source']);
  assert.ok(items.every(item => item.reason.includes('session') || item.label === 'Continue Current Task'));
});

test('friendly labels remain presentation-only', () => {
  assert.equal(friendlyWorkspaceLabel('engineering'), 'Current Work');
  assert.equal(friendlyWorkspaceLabel('workflow'), 'Current Task');
  assert.equal(friendlyWorkspaceLabel('knowledge'), 'Project Library');
  assert.equal(friendlyWorkspaceLabel('evidence'), 'Supporting References');
  assert.equal(friendlyWorkspaceLabel('relationships'), 'Related Information');
});

test('empty-state selection is explicit and helpful', () => {
  const model = buildMissionControlModel({ now: '2026-07-31T10:00:00', project, documents: [], sections: [], inspections: [] });
  assert.match(model.empty.priorities, /caught up/i);
  assert.match(model.empty.continuation, /Open an inspection/i);
  assert.match(model.empty.activity, /Activity will appear/i);
});

test('the demonstration fixture is compatible without project-name special cases', () => {
  const fixture = createDemonstrationProjectFixture();
  const demoProject = fixture.manifest.project;
  const model = buildMissionControlModel({
    now: '2026-03-20T10:00:00', project: demoProject,
    documents: fixture.documents, sections: fixture.sections,
    inspections: fixture.inspectionRecords, isDemonstration: demoProject.id === DEMO_PROJECT_ID
  });
  assert.equal(model.project.isDemonstration, true);
  assert.ok(model.summary.drawings > 0);
  assert.ok(model.summary.specifications > 0);
  assert.ok(model.summary.rfis > 0);
  assert.ok(model.summary.submittals > 0);
  assert.ok(model.priorities.some(item => item.kind === 'overdue'));
  assert.ok(model.priorities.some(item => item.kind === 'due-today'));
});

test('My Projects separates user projects from the built-in demonstration', () => {
  const separated = separateMissionControlProjects([
    { id: DEMO_PROJECT_ID, name: 'Veterans Community Health Clinic Renovation' },
    { id: 'zeta', name: 'Zeta Project' },
    { id: 'alpha', name: 'Alpha Project' }
  ], DEMO_PROJECT_ID);
  assert.deepEqual(separated.userProjects.map(item => item.id), ['alpha', 'zeta']);
  assert.equal(separated.demonstrationProject.id, DEMO_PROJECT_ID);
});

test('return navigation restores only an available prior user project', () => {
  const projects = [{ id: 'user-project', name: 'User Project' }, { id: DEMO_PROJECT_ID, name: 'Demo' }];
  assert.equal(resolvePreviousProject('user-project', projects, DEMO_PROJECT_ID)?.id, 'user-project');
  assert.equal(resolvePreviousProject('removed', projects, DEMO_PROJECT_ID), null);
  assert.equal(resolvePreviousProject(DEMO_PROJECT_ID, projects, DEMO_PROJECT_ID), null);
});

test('Mission Control retains the shared dark visual system without white surfaces', () => {
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  const refinement = css.slice(css.indexOf('/* Phase 22.1'), css.indexOf('/* Phase 22.2'));
  assert.match(refinement, /\.mc-control-shell\{[^}]*#071119/);
  assert.match(refinement, /\.mc-control-card[^}]*#0d1c26/);
  assert.doesNotMatch(refinement, /background(?:-color)?:#fff(?:fff)?(?:[;}]|$)/i);
});

test('Mission Control workspace presentation keeps the shell, summary cards, checklist filters, and evidence panels compact', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(app, /<p>\$\{esc\(activeWorkspace\?\.name \|\| 'Select a workspace to review checklist evidence\.'\)\}<\/p>/);
  assert.match(app, /<nav class="mc-ws-checklist-filters mc-ws-checklist-filters-status" aria-label="Checklist status filters">/);
  assert.match(app, /<nav class="mc-ws-checklist-filters mc-ws-checklist-filters-category" aria-label="Checklist category filters">/);
  assert.match(css, /\.mc-ws-header > div:first-child\{/);
  assert.match(css, /\.mc-ws-project-clock > div\{/);
  assert.match(css, /\.mc-ws-checklist-filters-status::before\{/);
  assert.match(css, /\.mc-ws-checklist-filters-category::before\{/);
  assert.match(css, /\.mc-ws-evidence-viewer-body\{/);
  assert.match(css, /\.mc-ws-observation-actions button,/);
});

test('Mission Control uses Dashboard, Chief, and Workspace as the primary shell navigation', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const sidebar = app.slice(app.indexOf('function renderMissionControlSidebar()'), app.indexOf('async function renderMissionControlWorkspace()'));
  assert.match(app, /<section id="missionControlShell" class="mc-control-shell mc-ws mc-mission-shell"/);
  assert.match(app, /<aside id="missionControlSidebar" class="mc-ws-sidebar" aria-label="Mission Companion navigation"><\/aside>/);
  assert.match(sidebar, /data-control-view="dashboard">Dashboard<\/button>/);
  assert.match(sidebar, /data-control-home[^>]*>Chief<\/button>/);
  assert.match(sidebar, /data-control-view="workspace" aria-current="\$\{missionControlView === 'workspace' \? 'page' : 'false'\}">Workspace<\/button>/);
  assert.doesNotMatch(sidebar, /data-control-view="plans">Drawings<\/button>/);
  assert.doesNotMatch(app, /data-control-experience="professional-workspace">Professional Workspace<\/button>/);
  assert.doesNotMatch(app, /data-control-more-tools/);
  assert.doesNotMatch(app, /aria-label="More Tools"/);
  assert.match(app, /id="openProfessionalWorkspace"[^>]*aria-label="Open Professional Workspace"/);
});

test('Mission Control workspace is registry-backed and no longer hard-codes Room 107 prototype content', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const sidebar = app.slice(app.indexOf('function renderMissionControlSidebar()'), app.indexOf('async function renderMissionControlWorkspace()'));
  const roomTree = app.slice(app.indexOf('function workspaceRoomTreeMarkup(workspaceModel = {}, activeWorkspace = null, previewSheet = null, workspaceDrawingCategories = [], workspaceTradesState = null)'), app.indexOf('function workspaceNextStepPriority(item = {})'));
  const workspace = app.slice(app.indexOf('async function renderMissionControlWorkspace()'), app.indexOf('async function renderMissionControlDashboard()'));
  const chiefWorkspace = app.slice(app.indexOf('async function renderChiefWorkspace({ historyVisible = false } = {})'), app.indexOf('async function renderMissionControlChat()'));
  assert.match(app, /missionControlView = 'landing';/);
  assert.match(app, /missionControlSidebar/);
  assert.match(workspace, /buildBedfordWorkspaceModel\(activeBedfordWorkspaceId\)/);
  assert.match(app, /function renderMissionControlSidebar\(\)/);
  assert.match(sidebar, /mc-mission-workspace-select/);
  assert.match(sidebar, /workspaceRoomTreeMarkup\(workspaceModel, activeWorkspace, previewSheet, workspaceModel\?\.activeWorkspace\?\.drawingCategories \|\| \[\], workspaceTradesSessionState\)/);
  assert.match(sidebar, /Select Workspace/);
  assert.doesNotMatch(sidebar, /<select data-ws-select/);
  assert.doesNotMatch(sidebar, /mc-mission-workspace-picker-list/);
  assert.doesNotMatch(sidebar, /mc-mission-workspace-option/);
  assert.match(roomTree, /data-ws-select=/);
  assert.match(roomTree, /data-ws-trades=/);
  assert.match(roomTree, /data-ws-trade-category=/);
  assert.match(roomTree, /data-ws-sheet=/);
  const composerIndex = chiefWorkspace.indexOf('<form id="missionControlComposer" class="mc-control-composer">');
  assert.ok(composerIndex > 0);
  assert.doesNotMatch(chiefWorkspace.slice(0, composerIndex), /renderChiefSuggestedQuestionsMarkup\(\)/);
  assert.match(chiefWorkspace.slice(composerIndex), /renderChiefSuggestedQuestionsMarkup\(\)/);
  assert.doesNotMatch(workspace, /ACTIVE WORKSPACE/);
  assert.doesNotMatch(workspace, /PMIS Context:/);
  assert.doesNotMatch(workspace, /Telecom Room 107/);
  assert.doesNotMatch(workspace, /B61 – Telecom Room 107/);
});

test('Mission Control starts on the landing screen and waits for a click to enter the shell', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /let missionControlView = 'landing';/);
  assert.match(app, /function renderMissionControlLanding\(\)/);
  assert.match(app, /data-control-action="enter-mission-control"/);
  assert.match(app, /if \(button\.dataset\.controlAction === 'enter-mission-control'\) {\s*return showMissionControlView\('workspace'\);/);
  assert.match(app, /updateMissionControlNavigationVisibility\(\);/);
});

test('Mission Control workspace exposes the shared Evidence layer in Documents and quick actions', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const workspace = app.slice(app.indexOf('function renderWorkspaceDocumentsView(workspaceModel, activeWorkspace, projectMilestoneContext)'), app.indexOf('function workspaceEvidenceLinkCount(item = {})'));
  const evidenceView = app.slice(app.indexOf('function renderWorkspaceEvidenceView(workspaceModel, activeWorkspace, projectMilestoneContext)'), app.indexOf('function openWorkspaceEvidence(evidenceId = \'\')'));
  const detail = app.slice(app.indexOf('function renderWorkspaceEvidenceDetail(item = {})'), app.indexOf('function renderWorkspaceLinkedEvidence(records = [], relationKind = \'\', relationId = \'\')'));
  const card = app.slice(app.indexOf('function renderWorkspaceEvidenceCard(item = {}, selected = false)'), app.indexOf('function workspaceEvidenceTimestampLabel(timestamp = \'\')'));
  const existing = app.slice(app.indexOf('function renderWorkspaceEvidenceExistingCards(records = [])'), app.indexOf('function renderWorkspaceEvidenceEditor(draft = {}, { mode = \'create\', workspaceEvidence = [], selectedSpecificationNumber = \'\', fileMeta = null } = {})'));
  const editor = app.slice(app.indexOf('function renderWorkspaceEvidenceEditor(draft = {}, { mode = \'create\', workspaceEvidence = [], selectedSpecificationNumber = \'\', fileMeta = null } = {})'), app.indexOf('function openWorkspaceEvidenceModal({'));
  const observationEditor = app.slice(app.indexOf('function renderWorkspaceObservationEditor(draft = {}, { mode = \'create\', workspaceEvidence = [] } = {})'), app.indexOf('function openWorkspaceObservationModal({'));
  const rfiEditor = app.slice(app.indexOf('function renderWorkspaceRfiEditor(draft = {}, { mode = \'create\', workspaceEvidence = [] } = {})'), app.indexOf('function openWorkspaceRfiModal({'));
  const linked = app.slice(app.indexOf('function renderWorkspaceLinkedEvidence(records = [], relationKind = \'\', relationId = \'\')'), app.indexOf('function renderWorkspaceEvidenceEditor(draft = {}, { mode = \'create\', workspaceEvidence = [], selectedSpecificationNumber = \'\', fileMeta = null } = {})'));
  const linkPicker = app.slice(app.indexOf('function renderWorkspaceEvidenceLinkPicker({ targetEvidence = null, linkedIssueId = \'\', linkedChecklistItemId = \'\', linkedObservationId = \'\', linkedRfiId = \'\', workspace = null, selectedSheet = null, relatedSpecifications = [], sourceContext = {}, mode = \'record\' } = {})'), app.indexOf('function workspaceEvidenceBlobIdFor(record = {})'));
  assert.match(workspace, /Workspace Evidence/);
  assert.match(workspace, /data-ws-section="evidence"/);
  assert.match(workspace, /Open Evidence Viewer/);
  assert.match(app, /function renderWorkspaceEvidenceToc\(workspaceEvidenceModel = \{\}, evidenceState = \{\}\)/);
  assert.match(app, /function renderWorkspaceEvidenceViewerMedia\(item = \{\}\)/);
  assert.match(app, /function renderWorkspaceEvidenceContext\(item = \{\}, activeWorkspace = null, projectMilestoneContext = null, evidenceState = \{\}\)/);
  assert.match(app, /async function openWorkspaceEvidence\(evidenceId = ''\)/);
  assert.match(app, /function renderWorkspaceEvidenceLinkPicker\(/);
  assert.match(app, /function openWorkspaceEvidenceLinkPicker\(options = \{\}\)/);
  assert.match(app, /function workspaceEvidenceStorageRefFor\(record = \{\}\)/);
  assert.match(app, /workspaceEvidenceBlobIdFor\(\{ id: evidenceId, projectId, workspaceId \}\)/);
  assert.match(app, /data-ws-evidence-open=/);
  assert.match(app, /data-ws-evidence-facet=/);
  assert.match(app, /data-ws-evidence-preview-open=/);
  assert.match(card, /data-ws-evidence-id=/);
  assert.match(linked, /data-ws-evidence-unlink=/);
  assert.match(app, /data-ws-action="evidence"/);
  assert.match(app, /data-ws-evidence-action="create"/);
  assert.match(app, /data-ws-evidence-edit=/);
  assert.match(app, /data-ws-evidence-link-record=/);
  assert.match(app, /data-ws-evidence-delete=/);
  assert.match(detail, /data-ws-evidence-action="link-existing"/);
  assert.match(detail, /data-ws-evidence-action="preview"/);
  assert.match(detail, /renderWorkspaceEvidenceLinkedRecordGroups\(item\)/);
  assert.match(app, /if \(button\.dataset\.wsEvidenceAction === 'preview'\)/);
  assert.match(app, /openWorkspaceEvidencePreviewModal/);
  assert.match(existing, /data-evidence-open-detail=/);
  assert.match(existing, /data-evidence-link-existing=/);
  assert.match(linkPicker, /Link Existing Evidence/);
  assert.match(linkPicker, /Link Evidence to Record/);
  assert.match(app, /data-ws-evidence-link-target-kind=/);
  assert.match(app, /Open Evidence<\/button>/);
  assert.match(app, /const detailButtons = \[\.\.\.modal\.querySelectorAll\('\[data-evidence-open-detail\]'\)\];/);
  assert.match(app, /detailButtons\.forEach\(button => \{/);
  assert.match(app, /await openWorkspaceEvidence\(target\.id\);/);
  assert.match(app, /let selectedBinaryFile = null;/);
  assert.match(app, /selectedBinaryFile = selectedFile;/);
  assert.match(app, /const selectedFile = fileField\?\.files\?\.\[0\] \|\| selectedBinaryFile \|\| null;/);
  assert.match(app, /draft\.id = evidenceId;/);
  assert.match(app, /evidenceState\.draft = structuredClone\(draft\);/);
  assert.match(app, /const saveMethod = existingEvidence\?\.id \? 'update' : 'create';/);
  assert.match(app, /const saved = saveMethod === 'update'\s+\?\s+workspaceEvidenceStore\.update\(payload\.id, payload\)\s+\:\s+workspaceEvidenceStore\.create\(payload\);/);
  assert.match(observationEditor, /EXISTING EVIDENCE/);
  assert.match(observationEditor, /renderWorkspaceRecordEvidenceSection\(\{ kind: 'observation'/);
  assert.match(observationEditor, /renderWorkspaceEvidenceExistingCards\(workspaceEvidence\)/);
  assert.doesNotMatch(observationEditor, /ATTACHMENTS/);
  assert.doesNotMatch(observationEditor, /Attachment ingestion/);
  assert.match(rfiEditor, /EXISTING EVIDENCE/);
  assert.match(rfiEditor, /renderWorkspaceRecordEvidenceSection\(\{ kind: 'rfi'/);
  assert.match(rfiEditor, /renderWorkspaceEvidenceExistingCards\(workspaceEvidence\)/);
  assert.doesNotMatch(rfiEditor, /ATTACHMENTS/);
  assert.doesNotMatch(rfiEditor, /Attachment ingestion/);
  assert.match(editor, /Add Photo \/ Choose Photo/);
  assert.match(editor, /Choose File/);
  assert.match(editor, /data-evidence-file/);
  assert.match(editor, /data-evidence-spec-section/);
  assert.match(editor, /Link Existing/);
  assert.match(existing, /mc-ws-evidence-existing-card/);
  assert.match(editor, /SELECTED DRAWING/);
  assert.match(editor, /Specification<select/);
  assert.match(app, /<strong>EVIDENCE<\/strong><small>\$\{linkedEvidenceForObservation\(selectedObservation\.id\)\.length\}<\/small>/);
  assert.match(app, /<strong>EVIDENCE<\/strong><small>\$\{linkedEvidenceForRfi\(selectedRfi\.id\)\.length\}<\/small>/);
  assert.match(app, /<strong>EVIDENCE<\/strong><small>\$\{linkedEvidenceForIssue\(selectedIssue\.id\)\.length\}<\/small>/);
  assert.doesNotMatch(editor, /File name/);
  assert.doesNotMatch(editor, /MIME type/);
  assert.doesNotMatch(editor, /Size \(bytes\)/);
  assert.doesNotMatch(editor, /Storage reference/);
  assert.doesNotMatch(editor, /Pin evidence/);
  assert.doesNotMatch(editor, /Archive evidence/);
});

test('Mission Control workspace defines local normalization helpers for the compact room tree', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /const list = value => Array\.isArray\(value\) \? value : \[\];/);
  assert.match(app, /const text = value => value === null \|\| value === undefined \? '' : String\(value\)\.trim\(\);/);
  assert.match(app, /function workspaceRailSectionMarkup\(\{/);
  assert.match(app, /const WORKSPACE_NAVIGATION_STATE_KEY = 'mission-companion:workspace-navigation-state:v1';/);
  assert.match(app, /function workspaceRoomTreeMarkup\(workspaceModel = \{\}, activeWorkspace = null, previewSheet = null, workspaceDrawingCategories = \[\], workspaceTradesState = null\)/);
  assert.match(app, /const workspaces = list\(workspaceModel\.workspaces\);/);
});

test('Mission Control workspace room-tree markup executes without undeclared helpers', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function workspaceRoomTreeMarkup(workspaceModel = {}, activeWorkspace = null, previewSheet = null, workspaceDrawingCategories = [], workspaceTradesState = null)');
  const end = app.indexOf('function workspaceNextStepPriority(item = {})');
  assert.ok(start >= 0 && end > start);
  const fnSource = app.slice(start, end);
  const workspaceRoomTreeMarkup = new Function('list', 'text', 'esc', 'fmt', 'workspaceDisplayTitle', 'workspaceSelectableSheets', `${fnSource}; return workspaceRoomTreeMarkup;`)(
    value => Array.isArray(value) ? value : [],
    value => value === null || value === undefined ? '' : String(value).trim(),
    value => String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]),
    value => Number(value || 0).toLocaleString('en-US'),
    value => {
      const trimmed = value === null || value === undefined ? '' : String(value).trim();
      if (!trimmed) return '';
      if (trimmed !== trimmed.toUpperCase()) return trimmed;
      return trimmed
        .split(/(\s+|\/|—|-)/)
        .map(part => {
          if (/^(\s+|\/|—|-)$/.test(part)) return part === '-' ? ' — ' : part;
          if (/^[A-Z0-9&]{2,6}$/.test(part)) return part;
          return part.toLowerCase().replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase());
        })
        .join('')
        .replace(/\s+—\s+/g, ' — ')
        .replace(/\s{2,}/g, ' ');
    },
    workspace => {
      const seen = new Set();
      const sheets = [];
      const push = sheet => {
        if (!sheet) return;
        const sheetNumber = String(sheet.sheetNumber || '').trim();
        const pageId = String(sheet.pageId || '').trim();
        const key = pageId || sheetNumber;
        if (!key || seen.has(key)) return;
        seen.add(key);
        sheets.push({
          sheetNumber,
          sheetTitle: String(sheet.sheetTitle || '').trim(),
          discipline: String(sheet.discipline || '').trim(),
          drawingType: String(sheet.drawingType || '').trim(),
          pdfPageNumber: Number(sheet.pdfPageNumber) || 0,
          pageId
        });
      };
      for (const sheet of workspace?.sourceSheets || []) push(sheet);
      for (const sheet of workspace?.relatedSheets || []) push(sheet);
      for (const category of workspace?.drawingCategories || []) {
        for (const sheet of category?.items || []) push(sheet);
      }
      return sheets;
    }
  );
  const workspaceModel = {
    workspaces: [{
      id: 'B13',
      room: 'B13',
      level: 'B1',
      name: 'Primary Telecommunications Room',
      drawingCategories: [{ label: 'Electrical / Power', id: 'electrical-power', items: [{ sheetNumber: '13E-101', sheetTitle: 'Power Plan', discipline: 'Electrical', drawingType: 'Plan', pdfPageNumber: 12, pageId: 'demo:page:12', relevance: 'DIRECT' }] }],
      sourceSheets: [{ sheetNumber: '13E-100', sheetTitle: 'Source Plan', discipline: 'Electrical', drawingType: 'Plan', pdfPageNumber: 11, pageId: 'demo:page:11' }],
      relatedSheets: [{ sheetNumber: '13E-102', sheetTitle: 'Related Plan', discipline: 'Electrical', drawingType: 'Plan', pdfPageNumber: 13, pageId: 'demo:page:13' }]
    }]
  };
  const activeWorkspace = workspaceModel.workspaces[0];
  const collapsedMarkup = workspaceRoomTreeMarkup(
    workspaceModel,
    activeWorkspace,
    { sheetNumber: '13E-100' },
    activeWorkspace.drawingCategories,
    { expandedWorkspaces: {}, expandedTrades: {}, expandedCategories: {} }
  );
  const expandedMarkup = workspaceRoomTreeMarkup(
    workspaceModel,
    activeWorkspace,
    { sheetNumber: '13E-101' },
    activeWorkspace.drawingCategories,
    { expandedWorkspaces: { B13: true }, expandedTrades: { B13: true }, expandedCategories: { B13: 'B13:electrical-power' } }
  );
  assert.match(collapsedMarkup, /mc-ws-room-tree-shell/);
  assert.match(collapsedMarkup, /data-ws-select="B13"/);
  assert.match(collapsedMarkup, /data-ws-trades="B13"/);
  assert.match(collapsedMarkup, /data-ws-trades-details="B13"/);
  assert.doesNotMatch(collapsedMarkup, /data-ws-trade-category="B13:electrical-power"/);
  assert.doesNotMatch(collapsedMarkup, /data-ws-sheet="13E-101"/);
  assert.match(expandedMarkup, /data-ws-trade-category="B13:electrical-power"/);
  assert.match(expandedMarkup, /data-ws-sheet-group="B13"/);
  assert.match(expandedMarkup, /data-ws-sheet-group-key="B13:electrical-power"/);
  assert.match(expandedMarkup, /data-ws-sheet="13E-101"/);
  assert.match(expandedMarkup, /13E-101/);
  assert.doesNotMatch(expandedMarkup, /workspaceButtons/);
});

test('Mission Control workspace preserves the approved wide composition and four-panel lower grid', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  const workspaceDocuments = fs.readFileSync(new URL('../src/workspace-documents.js', import.meta.url), 'utf8');
  const checklistItemMarkup = app.slice(app.indexOf('function renderWorkspaceChecklistItem'), app.indexOf('function renderWorkspaceChecklistDetail'));
  const workspace = app.slice(app.indexOf('async function renderMissionControlWorkspace()'), app.indexOf('async function renderMissionControlDashboard()'));
  const sidebar = app.slice(app.indexOf('function renderMissionControlSidebar()'), app.indexOf('async function renderMissionControlWorkspace()'));
  const checklistSummaryMarkup = workspace.slice(workspace.indexOf('const checklistSummaryMarkup'), workspace.indexOf('const timelineSummaryItems'));
  assert.match(checklistItemMarkup, /<div class="mc-ws-checklist-row-title">\s*<strong>\$\{esc\(item\.title\)\}<\/strong>\s*<\/div>/);
  assert.doesNotMatch(checklistItemMarkup, /item\.category/);
  assert.match(app, /<main id="missionControlMain" class="mc-ws-main" tabindex="-1">/);
  assert.match(app, /<div id="missionControlContent" aria-live="polite"><\/div>/);
  assert.match(workspace, /<h1 id="missionControlTitle" tabindex="-1">B\$\{esc\(activeWorkspace\?\.building \|\| '61'\)\} — Telecom Room \$\{esc\(activeWorkspace\?\.room \|\| 'Workspace'\)\}<\/h1>/);
  assert.match(workspace, /<strong>ISSUES & RISKS<\/strong>/);
  assert.match(workspace, /<article id="workspaceChiefInsightPanel" class="mc-ws-chief-panel">/);
  assert.match(workspace, /<strong>Chief Insight<\/strong>/);
  assert.doesNotMatch(workspace, /<strong>TRACEABILITY MAP<\/strong>/);
  assert.doesNotMatch(workspace, /<div class="mc-ws-chief" id="workspaceChiefInsightPanel">/);
  assert.match(workspace, /<strong>VERIFICATION PROGRESS<\/strong>/);
  assert.match(workspace, /Open Full Checklist/);
  assert.match(workspace, /<strong>NEXT STEPS<\/strong>/);
  assert.match(workspace, /mc-ws-project-clock/);
  assert.match(workspace, /PROJECT PHASE/);
  assert.match(workspace, /NTP/);
  assert.match(workspace, /CONTRACT COMPLETION/);
  assert.match(workspace, /SCHEDULE STATUS/);
  assert.match(workspace, /mc-ws-timeline/);
  assert.match(app, /function workspaceRoomTreeMarkup\(workspaceModel = \{\}, activeWorkspace = null, previewSheet = null, workspaceDrawingCategories = \[\], workspaceTradesState = null\)/);
  assert.match(workspace, /renderWorkspaceTimelineView\(/);
  assert.match(workspace, /buildWorkspaceTimelineModel\(/);
  assert.match(workspace, /combinedNextSteps\.slice\(0, 5\)/);
  assert.match(workspace, /mc-ws-next-summary/);
  assert.match(workspace, /RELATED DOCUMENTS \/ SOURCE SHEETS/);
  assert.doesNotMatch(workspace, /workspaceDrawingTree = workspaceRoomTreeMarkup/);
  assert.match(sidebar, /PRIMARY MODES/);
  assert.match(sidebar, /PROJECT \/ WORKSPACE/);
  assert.match(sidebar, /WORKSPACE SECTIONS/);
  assert.match(sidebar, /QUICK ACTIONS/);
  assert.match(sidebar, /SETTINGS \/ UTILITIES/);
  assert.match(sidebar, /workspaceRailSectionMarkup\(\{/);
  assert.match(sidebar, /sectionKey: 'primaryModes'/);
  assert.match(sidebar, /sectionKey: 'projectWorkspace'/);
  assert.match(sidebar, /sectionKey: 'workspaceSections'/);
  assert.match(sidebar, /sectionKey: 'quickActions'/);
  assert.match(sidebar, /sectionKey: 'settingsUtilities'/);
  assert.match(sidebar, /data-ws-section="overview"/);
  assert.match(sidebar, /data-ws-section="documents"/);
  assert.match(sidebar, /data-ws-section="comparisons"/);
  assert.match(sidebar, /data-ws-section="notes"/);
  assert.match(sidebar, /data-ws-action="compare-spec"/);
  assert.match(sidebar, /data-ws-action="rfi"/);
  assert.match(sidebar, /mc-mission-workspace-select/);
  assert.match(sidebar, /data-control-view="dashboard">Dashboard<\/button>/);
  assert.match(sidebar, /data-control-home[^>]*>Chief<\/button>/);
  assert.match(sidebar, /data-control-view="workspace" aria-current="\$\{missionControlView === 'workspace' \? 'page' : 'false'\}">Workspace<\/button>/);
  assert.match(app, /data-ws-checklist-id=/);
  assert.match(app, /<article><span>Verified<\/span><strong>/);
  assert.match(app, /verified item/);
  assert.doesNotMatch(app, /data-ws-checklist-review=/);
  assert.match(app, /data-ws-checklist-verification-status=/);
  assert.match(app, /data-ws-checklist-verification-notes=/);
  assert.match(app, /data-ws-checklist-verification-save=/);
  assert.doesNotMatch(app, /data-ws-checklist-toggle=/);
  assert.match(checklistSummaryMarkup, /checklistVerificationStateLabel\(item\.verificationStatus/);
  assert.doesNotMatch(workspace, /SESSION REVIEW PROGRESS/);
  assert.doesNotMatch(workspace, /reviewed this session/);
  assert.match(workspace, /renderWorkspaceNotesView\(/);
  assert.match(workspace, /workspaceNotesStore\.list\(/);
  assert.match(app, /data-ws-source-sheet=/);
  assert.match(app, /data-ws-drawing-sheet=/);
  assert.match(app, /data-ws-spec-section=/);
  assert.match(app, /data-ws-project-document=/);
  assert.match(app, /data-ws-issue-filter=/);
  assert.match(app, /data-ws-issue-id=/);
  assert.match(app, /data-ws-timeline-filter=/);
  assert.match(app, /data-ws-timeline-id=/);
  assert.match(app, /function workspaceSelectableSheets\(workspace = null\)/);
  assert.match(app, /const selectableSheets = workspaceSelectableSheets\(workspace\);/);
  assert.match(app, /const previewSheet = selectableSheets\.find\(sheet => sheet\.sheetNumber === activeBedfordWorkspaceSheetNumber\)\s*\|\|\s*selectableSheets\[0\]\s*\|\|\s*null;/);
  assert.match(app, /const workspaceContextModel = previewSheet\?\.sheetNumber/);
  assert.match(app, /selectedSheetNumber: previewSheet\.sheetNumber/);
  assert.match(app, /drawingLinks: bedfordRelationshipLinksForSheet\(previewSheet\.sheetNumber\)/);
  assert.match(app, /view=Fit/);
  assert.match(app, /: workspaceModel;/);
  assert.match(app, /const activeWorkspace = workspaceContextModel\.activeWorkspace \|\| workspaceSeed \|\| null;/);
  assert.doesNotMatch(workspace, /mc-ws-sheet-picker/);
  assert.doesNotMatch(workspace, /ACTIVE ROOM/);
  assert.doesNotMatch(workspace, /MARKUPS & ITEMS/);
  assert.match(app, /if \(button\.dataset\.wsSheet\) \{\s*activeBedfordWorkspaceSheetNumber = button\.dataset\.wsSheet;\s*keepWorkspaceTreeOpen\(activeBedfordWorkspaceId\);\s*activeBedfordWorkspaceSection = 'overview';\s*await showMissionControlView\('workspace'\);/);
  assert.match(app, /if \(button\.dataset\.wsDrawingSheet\) \{\s*const activeWorkspace = buildBedfordWorkspaceModel\(activeBedfordWorkspaceId\)\.activeWorkspace \|\| null;\s*const target = buildWorkspaceDrawingTarget\(activeWorkspace, button\.dataset\.wsDrawingSheet\);\s*if \(target\) drawingTarget = target;\s*activeBedfordWorkspaceSheetNumber = button\.dataset\.wsDrawingSheet;\s*keepWorkspaceTreeOpen\(activeBedfordWorkspaceId\);\s*activeBedfordWorkspaceSection = 'overview';\s*await showMissionControlView\('workspace'\);/);
  assert.match(app, /if \(button\.dataset\.wsAction === 'drawings'\) \{\s*const activeWorkspace = buildBedfordWorkspaceModel\(activeBedfordWorkspaceId\)\.activeWorkspace \|\| null;\s*const target = buildWorkspaceDrawingTarget\(activeWorkspace, activeBedfordWorkspaceSheetNumber\);\s*if \(target\) drawingTarget = target;\s*activeBedfordWorkspaceSection = 'overview';\s*await showMissionControlView\('plans'\);/);
  assert.match(app, /if \(button\.dataset\.wsTrades\) \{\s*const workspaceId = String\(button\.dataset\.wsTrades \|\| ''\)\.trim\(\);\s*keepWorkspaceTreeOpen\(workspaceId\);\s*setWorkspaceTreeTradesOpen\(workspaceId, !\(workspaceTreeSessionState\.expandedTrades\[workspaceId\]\)\);\s*setWorkspaceTreeCategoryOpen\(workspaceId, workspaceTreeSessionState\.expandedCategories\[workspaceId\] \|\| '', false\);\s*refreshMissionControlSidebar\(\);\s*return true;/);
  assert.match(app, /if \(button\.dataset\.wsTradeCategory\) \{\s*const categoryKey = String\(button\.dataset\.wsTradeCategory \|\| ''\)\.trim\(\);\s*const \[workspaceId\] = categoryKey\.split\(':'\);\s*if \(workspaceId && buildBedfordWorkspaceModel\(activeBedfordWorkspaceId\)\.activeWorkspace\?\.\id === workspaceId\) \{\s*keepWorkspaceTreeOpen\(workspaceId\);\s*setWorkspaceTreeTradesOpen\(workspaceId, true\);\s*setWorkspaceTreeCategoryOpen\(workspaceId, categoryKey, workspaceTreeSessionState\.expandedCategories\[workspaceId\] !== categoryKey\);\s*refreshMissionControlSidebar\(\);\s*\}\s*return true;/);
  assert.match(app, /mc-ws-documents/);
  assert.match(app, /mc-ws-documents-grid/);
  assert.match(workspaceDocuments, /PRIMARY SOURCE DRAWINGS/);
  assert.match(workspaceDocuments, /RELATED DRAWINGS/);
  assert.match(workspaceDocuments, /PROJECT \/ CONTRACTUAL DOCUMENTS/);
  assert.match(app, /mc-ws-issues/);
  assert.match(app, /Issues &amp; Risks/);
  assert.match(app, /No room-specific issues recorded\./);
  assert.match(app, /data-ws-rfi-view="rfis"/);
  assert.match(app, /data-ws-action="rfi"/);
  assert.match(app, /if \(button\.dataset\.wsAction === 'rfi'\) \{[\s\S]*openWorkspaceRfiFromWorkspaceContext\(\{/);
  assert.match(app, /if \(button\.dataset\.wsAction === 'observation'\) \{[\s\S]*openWorkspaceObservationModal\(\{/);
  assert.match(app, /data-ws-rfi-create="issue"/);
  assert.match(app, /data-ws-rfi-create="observation"/);
  assert.match(app, /data-ws-rfi-create="checklist"/);
  assert.match(app, /data-ws-rfi-chief=/);
  assert.doesNotMatch(workspace, /Create RFI is not configured yet/);
  assert.match(app, /action: 'checklist-verification'/);
  assert.match(app, /safeText\(workspace\?\.(?:id|workspaceId) \|\| draft\.workspaceId \|\| ''\)/);
  assert.match(css, /\.mc-ws\{grid-template-columns:240px minmax\(0,1fr\)\}/);
  assert.match(css, /\.mc-mission-shell \.mc-ws-sidebar\{[^}]*height:100dvh;[^}]*min-height:0;[^}]*overflow-y:auto;[^}]*overflow-x:hidden\}/);
  assert.match(css, /\.mc-ws-rail-section\{[^}]*display:grid;[^}]*gap:8px;[^}]*padding:0 0 10px;[^}]*border-top:1px solid #17313c\}/);
  assert.match(css, /\.mc-ws-rail-section>summary\{[^}]*display:grid;[^}]*gap:4px;[^}]*padding:12px 8px 10px;[^}]*cursor:pointer\}/);
  assert.match(css, /\.mc-ws-rail-body\{[^}]*display:grid;[^}]*gap:8px;[^}]*padding:0 8px 0\}/);
  assert.match(css, /\.mc-ws-upper\{grid-template-columns:minmax\(0,2\.55fr\) minmax\(300px,1fr\)/);
  assert.match(css, /\.mc-ws-lower\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.mc-ws-lower > article\{min-height:320px;max-height:380px;display:grid;grid-template-rows:auto minmax\(0,1fr\) auto auto;overflow:hidden\}/);
  assert.match(css, /\.mc-ws-risks,\.mc-ws-check,\.mc-ws-next,\.mc-ws-timeline\{min-height:0;overflow:auto;max-height:160px\}/);
  assert.match(css, /\.mc-ws-risks\{max-height:none\}/);
  assert.match(css, /#workspaceIssuesPanel\{grid-template-rows:auto minmax\(0,1fr\)\}/);
  assert.match(css, /#workspaceChiefInsightPanel\{grid-template-rows:auto minmax\(0,1fr\)\}/);
  assert.match(css, /\.mc-ws-chief-panel-body\{display:grid;grid-template-columns:auto minmax\(0,1fr\);gap:10px;align-items:start;min-height:0;padding:12px 12px 14px;overflow:auto\}/);
  assert.match(css, /\.mc-ws-room-tree-shell\{/);
  assert.match(css, /\.mc-ws-trades\{/);
  assert.match(css, /\.mc-ws-trades-toggle\{/);
  assert.match(css, /\.mc-ws-room-group\{/);
  assert.match(css, /\.mc-ws-room-group-body\{/);
  assert.match(css, /\.mc-ws-room-group\{/);
  assert.match(css, /\.mc-ws-sheet-group\{/);
  assert.match(css, /\.mc-ws-sheet-grid\{/);
  assert.match(css, /\.mc-ws-room-group\{[^}]*overflow:visible\}/);
  assert.match(css, /\.mc-ws-trades\{[^}]*overflow:visible\}/);
  assert.match(css, /\.mc-ws-sheet-group\{[^}]*overflow:visible\}/);
  assert.match(css, /\.mc-ws-sheet-grid\{[^}]*overflow:visible\}/);
  assert.doesNotMatch(css, /#missionControlContent \.mc-ws-pdf::before/);
  assert.match(css, /\.mc-ws-checklist-layout\{/);
  assert.match(css, /\.mc-ws-timeline-view\{/);
  assert.match(css, /\.mc-ws-timeline-layout\{/);
  assert.match(css, /\.mc-ws-comparisons\{/);
  assert.match(css, /\.mc-ws-comparison-summary\{/);
  assert.match(css, /\.mc-ws-comparison-layout\{/);
  assert.match(css, /\.mc-ws-comparison-field\{/);
  assert.match(css, /\.mc-ws-notes-view/);
  assert.match(css, /\.mc-ws-notes-layout/);
  assert.match(css, /\.mc-ws-note-editor/);
  assert.match(css, /\.mc-ws-project-clock/);
  assert.match(css, /\.mc-ws-timeline/);
  assert.match(css, /\.mc-ws-documents/);
  assert.match(css, /\.mc-ws-documents-grid/);
  assert.match(css, /\.mc-ws-document-card/);
});

test('Mission Control workspace checklist KPI and checklist panel share one effective summary path', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const workspace = app.slice(app.indexOf('async function renderMissionControlWorkspace()'), app.indexOf('async function renderMissionControlDashboard()'));
  const checklistView = app.slice(app.indexOf('function renderWorkspaceChecklistView('), app.indexOf('function renderWorkspaceTimelineSourceRefs'));
  assert.match(app, /function workspaceChecklistEffectiveState\(checklistModel = \{\}, sessionState = null, selectedFilter = 'all', selectedItemId = ''\)/);
  assert.match(app, /verificationDraft\.verifiedBy = verificationDraft\.verifiedBy \|\| '';/);
  assert.match(workspace, /const checklistOverviewState = workspaceChecklistEffectiveState\(checklistModel, checklistState, 'all', checklistState\.selectedItemId\);/);
  assert.match(workspace, /const checklistVerifiedCount = checklistOverviewState\.verifiedCount;/);
  assert.match(workspace, /const checklistApplicableCount = checklistOverviewState\.checklistApplicableCount;/);
  assert.match(workspace, /const checklistSummaryItems = checklistOverviewState\.summaryItems;/);
  assert.match(checklistView, /const checklistViewState = workspaceChecklistEffectiveState\(checklistModel, sessionState, selectedFilter, selectedItemId\);/);
  assert.match(checklistView, /const \{ withSessionState, selected, checklistApplicableCount, verifiedCount \} = checklistViewState;/);
  assert.match(checklistView, /const summaryItems = checklistViewState\.summaryItems;/);
  assert.doesNotMatch(workspace, /withSessionState\.slice\(0, 3\)/);
  assert.doesNotMatch(app, /verifiedBy: verificationDraft\?\.verifiedBy \|\| activeWorkspace\?\.name \|\| ''/);
});

test('Mission Control workspace overview actions and summaries are clickable and preserve Chief context', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  const promptSection = app.slice(app.indexOf('function buildWorkspaceChiefPrompt'), app.indexOf('function renderWorkspaceDocumentItem'));
  assert.match(promptSection, /const selectedSheetNumber = text\(workspaceContext\.selectedSheet\?\./);
  assert.match(promptSection, /const selectedSheetTitle = text\(workspaceContext\.selectedSheet\?\./);
  assert.match(promptSection, /const selectedSheetSpecs = list\(workspaceContext\.selectedSheet\?\./);
  assert.match(promptSection, /currentIssueTitles = list\(workspaceContext\.issuesModel/);
  assert.match(promptSection, /Selected drawing:/);
  assert.match(promptSection, /Selected-sheet applicable specs:/);
  assert.match(promptSection, /Workspace issues:/);
  assert.match(promptSection, /Blocked checklist items:/);
  assert.match(promptSection, /Open questions:/);
  assert.match(promptSection, /Current milestone state:/);
  assert.match(promptSection, /Source sheets:/);
  assert.match(promptSection, /Applicable specs:/);
  assert.match(promptSection, /PMIS context:/);
  assert.match(app, /data-ws-overview-action="\$\{esc\(action\)\}"/);
  assert.match(app, /class="mc-ws-kpi-button \$\{esc\(tone\)\}"/);
  assert.match(app, /class="mc-ws-overview-row-button"/);
  assert.match(app, /data-ws-issue-id="\$\{esc\(item\.id\)\}"/);
  assert.match(app, /data-ws-timeline-id="\$\{esc\(item\.id\)\}"/);
  assert.match(app, /data-ws-action="observation"/);
  assert.match(app, /renderWorkspaceObservationEditor/);
  assert.match(app, /buildWorkspaceObservationsModel\(/);
  assert.match(app, /workspaceObservationTimestampLabel/);
  assert.match(app, /data-ws-observation-view="observations"/);
  assert.match(app, /data-ws-observation-filter="\$\{esc\(filter\.id\)\}"/);
  assert.match(app, /data-ws-observation-edit="\$\{esc\(selectedObservation\.id\)\}"/);
  assert.match(app, /data-ws-observation-close="\$\{esc\(selectedObservation\.id\)\}"/);
  assert.match(app, /Create Observation/);
  assert.match(app, /Field Observations/);
  assert.match(app, /mc-ws-observation-editor/);
  assert.match(app, /mc-ws-modal-header/);
  assert.match(app, /mc-ws-modal-form/);
  assert.match(app, /mc-ws-observation-context-grid/);
  assert.match(app, /mc-ws-modal-scroll/);
  assert.match(app, /Create RFI/);
  assert.match(css, /\.mc-ws-observation-editor\{display:grid;gap:14px;min-height:0\}/);
  assert.match(css, /\.mc-ws-modal-header\{display:grid;gap:8px;min-height:0\}/);
  assert.match(css, /\.mc-ws-modal-form\{display:grid;gap:14px;min-height:0;overflow:visible\}/);
  assert.match(css, /\.mc-ws-modal-scroll\{display:grid;gap:14px;min-height:0;overflow:visible;padding-right:0;scrollbar-gutter:auto\}/);
  assert.match(css, /\.modal-card\{width:min\(760px,92vw\);max-height:calc\(100dvh - 40px\);overflow-y:auto;overflow-x:hidden/);
  assert.match(css, /\.mc-ws-kpis article\{display:grid;min-height:92px;padding:0;border:1px solid #1d3a47;border-radius:8px;background:#091b26;overflow:hidden\}/);
  assert.match(css, /\.mc-ws-kpi-button,\s*\.mc-ws-overview-row-button\{appearance:none;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background \.15s ease,transform \.15s ease,color \.15s ease\}/);
  assert.match(css, /\.mc-ws-kpi-button\{display:grid;gap:3px;align-content:start;width:100%;min-height:104px;padding:10px 12px\}/);
  assert.match(css, /\.mc-ws-kpi-button:hover,\.mc-ws-kpi-button:focus-visible,\.mc-ws-overview-row-button:hover,\.mc-ws-overview-row-button:focus-visible\{background:#0b2230\}/);
  assert.match(css, /\.mc-ws-risks li,\.mc-ws-next li\{padding:0\}/);
  assert.match(css, /\.mc-ws-risks li > button,\.mc-ws-next li > button\{display:grid;grid-template-columns:auto minmax\(0,1fr\) auto;gap:8px;align-items:center;width:100%;padding:9px 10px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer\}/);
  assert.match(css, /\.mc-ws-observation-editor/);
  assert.match(css, /\.mc-ws-observation-context-grid/);
  assert.match(css, /\.mc-ws-observation-form-grid/);
  assert.match(css, /\.mc-ws-observation-actions/);
  assert.match(css, /\.mc-mission-shell\{grid-template-columns:286px minmax\(0,1fr\);min-height:100vh;margin:0;background:linear-gradient\(180deg,#06131c 0,#071119 100%\)\}/);
  assert.match(css, /\.mc-mission-workspace-select summary\{/);
  assert.match(css, /\.mc-mission-workspace-picker-tree\{/);
  assert.doesNotMatch(css, /\.mc-mission-workspace-picker-list\{/);
  assert.doesNotMatch(css, /\.mc-mission-workspace-option\{/);
});

test('Mission Control workspace comparison card rendering uses local string normalization instead of an undeclared text helper', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function renderWorkspaceComparisonChoice');
  const end = app.indexOf('function renderWorkspaceComparisonRefGroup');
  const renderChoice = app.slice(start, end);
  assert.match(renderChoice, /String\(item\?\.[^)]*\)\.trim\(\)/);
  assert.doesNotMatch(renderChoice, /\btext\(/);
});

test('Professional Workspace remains available through the gear launcher without a visible top-nav entry', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /id="professionalWorkspaceShell"/);
  assert.match(app, /data-view="project">Project Workspace/);
  assert.match(app, /data-view="chat">Command Desk/);
  assert.match(app, /data-view="knowledge">Knowledge Workspace/);
  assert.match(app, /data-view="sources">Source Inspector/);
  assert.match(app, /Drawing \/ Engineering/);
  assert.match(app, /data-view="drawings">Drawings<\/button>/);
  assert.match(app, /data-view="engineering">Engineering Workspace/);
  assert.match(app, /data-view="workflow">Workflow Workspace/);
  assert.match(app, /data-view="relationships">Relationship Explorer/);
  assert.match(app, /data-view="versions">Version Explorer/);
  assert.match(app, /data-view="evaluate">Knowledge Validation/);
  assert.match(app, /data-view="settings">Settings/);
  assert.match(app, /data-view="diagnostics">Diagnostics/);
  assert.match(app, /showMissionControlView\('home'\)/);
  assert.match(app, /id="openProfessionalWorkspace"/);
  assert.doesNotMatch(app, /LEGACY DRAWINGS WORKSPACE/);
  assert.doesNotMatch(app, /Legacy src\/app\.js workspace running/);
  assert.doesNotMatch(app, /data-control-experience="professional-workspace"/);
});

test('Mission Control embeds the hosted PMIS dashboard with dedicated actions and a safe iframe', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /missionPmisDashboardUrl/);
  assert.match(app, /project-documents\/bedford\/PMIS\/index\.html\?embedded=1/);
  assert.match(app, /renderMissionControlDashboard/);
  assert.match(app, /title="Mission PMIS Dashboard"/);
  assert.match(app, /sandbox="allow-forms allow-popups allow-scripts allow-same-origin"/);
  assert.match(app, /data-control-action="refresh-dashboard"/);
  assert.match(app, /window\.open\(missionPmisDashboardUrl/);
  assert.match(app, /Mission PMIS ready|Loading Mission PMIS/);
});

test('Mission Control uses a single Chief workspace for heading, composer, messages, and evidence', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /function renderChiefWorkspace/);
  assert.match(app, /mc-chief-workspace/);
  assert.match(app, /data-control-action="show-history"/);
  assert.match(app, /data-control-action="new-conversation"/);
  assert.match(app, /data-control-prompt/);
  assert.match(app, /chiefAssets\.idle/);
  assert.match(app, /mc-chief-evidence/);
  assert.doesNotMatch(app, /showMissionControlView\('chat'\).*renderMissionControlChat/);
});

test('Source Inspector maps built-in PDFs to their packaged source file paths', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /function buildDrawingSourceVerification\(document, drawingAnalysis = null, sourcePdfRecord = null\)/);
  assert.match(app, /function documentSourcePath\(document = null, sourcePdfRecord = null\)/);
  assert.match(app, /const sourcePath = documentSourcePath\(selected, sourcePdfRecord\);/);
  assert.match(app, /const verification = isDrawingDocumentRole\(selected\)\s*\?\s*buildDrawingSourceVerification\(selected, sourceDrawingAnalysis, sourcePdfRecord\)\s*:\s*verifyExtraction\(/);
  assert.match(app, /Source file mapped/);
  assert.match(app, /Source file path/);
  assert.doesNotMatch(app, /verifyExtraction\(selected,\s*sections,\s*documents\)[\s\S]*buildDrawingSourceVerification/);
});

test('Mission Control presents synchronized deterministic work packages without dead graphical claims', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(app, /buildActiveConstructionPackage/);
  assert.match(app, /CONSTRUCTION WORK PACKAGE/);
  assert.match(app, /Work shown or referenced/);
  assert.match(app, /Supporting requirements/);
  assert.match(app, /Current inspections/);
  assert.match(app, /Graphical association has not been verified/);
  assert.match(app, /data-work-package-current/);
  assert.match(app, /data-work-package-inspection/);
  assert.match(app, /data-work-package-target/);
  assert.match(app, /updateDrawingSearchResults/);
  assert.match(app, /pendingDrawingContext/);
  assert.match(css, /\.mc-work-package/);
  assert.doesNotMatch(app, /duct routing (?:is|shown)|diffuser quantity (?:is|shown)|clash detected/i);
});

test('Phase 23C presents drawings as construction evidence with a field-grade hierarchy', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(app, /CONSTRUCTION INTELLIGENCE · PLANS/);
  assert.match(app, /Find a sheet, room, trade, or tag/);
  assert.match(app, /Matched Room|matchedReason/);
  assert.match(app, /Construction Evidence/);
  assert.match(app, /Analysis details/);
  assert.match(app, /Reanalyze Drawing Set/);
  assert.match(app, /aria-label="Drawing navigation"/);
  assert.match(app, /aria-label="Drawing view controls"/);
  assert.match(app, /aria-label="Construction context actions"/);
  assert.match(app, /Reset View/);
  assert.match(app, /observationKindLabel/);
  assert.doesNotMatch(app, /<strong>\$\{esc\(item\.kind\)\}<\/strong>/);
  assert.match(css, /Phase 23C/);
  assert.match(css, /#missionDrawingViewer \.mc-drawing-evidence/);
  assert.match(css, /\.mc-drawing-stage\{min-height:520px/);
});

test('Plans keeps exactly one shared Sheet Inspector beneath the drawing viewer', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /renderDrawingWorkspace\('mission-control'\)/);
  assert.match(app, /getActivePlansSheetContext\(/);
  assert.match(app, /updatePlansInspectorOwnership\(/);
  assert.match(app, /activePlansInspectorPanel/);
  assert.match(app, /activePlansInspectorSheetId/);
  assert.match(app, /activePlansInspectorGeneration/);
  assert.match(app, /missionPlansSheetInspector/);
  assert.match(app, /constructionIntelligencePanelMarkup\(constructionIntelligencePanel\)/);
  assert.match(app, /buildConstructionIntelligencePanelModel\(/);
  assert.match(app, /const livePlansPanel = shell === 'mission-control' \? document\.querySelector\('#missionPlansSheetInspector'\) : null;/);
  assert.match(app, /const panel = shell === 'mission-control'\s*\?\s*\(livePlansPanel && livePlansPanel\.isConnected \? livePlansPanel : activePlansInspectorPanel\)\s*:\s*activeDrawingInspectorPanel;/);
  assert.match(app, /if \(panel !== activePlansInspectorPanel\) activePlansInspectorPanel = panel;/);
  assert.match(app, /panel\.innerHTML = constructionIntelligencePanelMarkup\(panelModel\)/);
  assert.equal((app.match(/missionPlansSheetInspector/g) || []).length >= 1, true);
});

test('Phase 24A keeps construction work primary and viewport/search controls stable', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(app, /mc-construction-orientation/);
  assert.match(app, /drawingZoom = null/);
  assert.match(app, /preservedCanvas/);
  assert.match(app, /PageDown.*PageUp.*Home.*End/);
  assert.match(app, /Construction Timeline/);
  assert.doesNotMatch(app, /Matched positioned drawing text/);
  assert.match(css, /Phase 24A/);
  assert.match(css, /position:sticky/);
});

test('Phase 24A.1 contains drawing lifecycle failures without blanking the workspace', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(app, /drawingUpgradeWork = new Map/);
  assert.match(app, /drawingUpgradeFailures = new Set/);
  assert.match(app, /drawingLifecycleUnavailable/);
  assert.match(app, /Drawing source unavailable/);
  assert.match(app, /open-owning-project/);
  assert.match(app, /return-to-drawing-sets/);
  assert.match(app, /retry-analysis-upgrade/);
  assert.match(app, /reduceStaleDrawingTarget/);
  assert.doesNotMatch(app.slice(app.indexOf('async function currentDrawingAnalyses'), app.indexOf('async function buildActiveConstructionPackage')), /throw /);
  assert.match(css, /mc-drawing-recovery/);
});

test('Phase 24A.2 exposes a full-scale stable viewer and verified construction overlays', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(app, /Analyze Page Objects/);
  assert.doesNotMatch(app, /data-drawing-overlay/);
  assert.match(app, /Expand Drawing/);
  assert.match(app, /calculateDrawingFit/);
  assert.match(app, /Candidate occurrence/);
  assert.match(css, /\.mc-drawing-layout\.drawing-expanded/);
  assert.match(css, /\.mc-drawing-object-overlay\.confirmed/);
  assert.doesNotMatch(css, /\.mc-drawing-stage\{[^}]*background:\s*(?:white|#fff(?:fff)?)/i);
});

test('Mission Control drawing workspace exposes a workspace-local fullscreen mode without changing the main viewer', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  const moduleSource = fs.readFileSync(new URL('../src/workspace-fullscreen-review.js', import.meta.url), 'utf8');
  const workspaceRenderer = app.slice(app.indexOf('async function renderMissionControlWorkspace()'), app.indexOf('async function renderMissionControlDashboard'));
  assert.match(app, /createWorkspaceFullscreenReviewController/);
  assert.match(app, /resolveWorkspaceFullscreenSourceUrl/);
  assert.match(app, /workspaceFullscreenReviewController/);
  assert.match(app, /workspaceFullscreenReviewRoot/);
  assert.match(app, /refreshWorkspaceFullscreenReviewController/);
  assert.match(app, /workspaceFullscreenSourceUrlForSheet/);
  assert.match(app, /onWorkspaceChange/);
  assert.match(app, /onActiveSheetChange/);
  assert.match(app, /onSheetSelect/);
  assert.match(app, /onToolChange/);
  assert.match(app, /!workspaceDrawingFullscreen && workspaceFullscreenReviewController/);
  assert.match(app, /workspaceFullscreenReviewController\.destroy\('fullscreen-exit'\)/);
  assert.match(app, /event\.key !== 'Escape' \|\| experience !== 'mission-control' \|\| !workspaceDrawingFullscreen \|\| workspaceFullscreenReviewController \|\| \(missionControlView !== 'plans' && missionControlView !== 'workspace'\)/);
  assert.match(workspaceRenderer, /<div id="workspaceFullscreenReviewRoot" class="mc-workspace-fullscreen-root"><\/div>/);
  assert.match(workspaceRenderer, /await refreshWorkspaceFullscreenReviewController\(/);
  assert.match(workspaceRenderer, /workspaceFullscreenSourceUrlForSheet/);
  assert.match(moduleSource, /export function createWorkspaceFullscreenReviewController/);
  assert.match(moduleSource, /export function workspaceFullscreenSheetIdentity/);
  assert.match(moduleSource, /export function resolveWorkspaceFullscreenSelectedSheet/);
  assert.match(moduleSource, /export function buildWorkspaceFullscreenNavigatorModel/);
  assert.match(moduleSource, /data-mdi-shell/);
  assert.match(moduleSource, /data-mdi-viewer-host/);
  assert.match(moduleSource, /data-mdi-stack/);
  assert.match(moduleSource, /data-mdi-fit="width"/);
  assert.match(moduleSource, /data-mdi-fit="page"/);
  assert.match(moduleSource, /data-mdi-zoom-out/);
  assert.match(moduleSource, /data-mdi-zoom-in/);
  assert.match(moduleSource, /data-mdi-viewer-host/);
  assert.match(moduleSource, /IntersectionObserver/);
  assert.match(moduleSource, /const requestToken = Symbol\(`page-render:\$\{pageNumber\}`\);/);
  assert.match(moduleSource, /state\.promise = run;/);
  assert.match(moduleSource, /if \(existingPromise && !force\) return existingPromise;/);
  assert.doesNotMatch(moduleSource, /pageMetaByNumber = new Map\(pageInfos\.map\(info => \[info\.pageNumber, info\]\)\)/);
  assert.doesNotMatch(moduleSource, /Promise\.all\(numbers\.map\(page => requestPageRender\(page, \{ source: 'adjacent' \}\)\)\)/);
  assert.match(css, /\.mc-workspace-fullscreen-root/);
  assert.match(css, /\.mc-mdi-shell/);
  assert.match(css, /\.mc-mdi-topbar/);
  assert.match(css, /\.mc-mdi-viewport/);
  assert.match(css, /\.mc-mdi-stack/);
  assert.match(css, /\.mc-mdi-page/);
  assert.match(css, /\.mc-mdi-pulse/);
  assert.doesNotMatch(moduleSource, /\.mc-mdi-rail/);
  assert.doesNotMatch(moduleSource, /\.mc-mdi-navigator/);
});

test('Mission Control fullscreen drawing review initializes without stale helper references', async () => {
  const previousReviewDiagnosticsFlag = globalThis.__MC_DRAWING_REVIEW_DIAGNOSTICS_ENABLED;
  globalThis.__MC_DRAWING_REVIEW_DIAGNOSTICS_ENABLED = true;
  class MockNode {
    constructor(role = 'node') {
      this.role = role;
      this.dataset = {};
      this.attributes = new Map();
      this.style = {};
      this.hidden = false;
      this.textContent = '';
      this.scrollTop = 0;
      this.scrollLeft = 0;
      this.clientWidth = 1200;
      this.clientHeight = 900;
      this.pageNodes = [];
      this.listeners = Object.create(null);
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    removeEventListener() {}
    append() {}
    setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
    getAttribute(name) { return this.attributes.get(String(name)) || null; }
    hasAttribute(name) { return this.attributes.has(String(name)); }
    contains(node) { return Boolean(node); }
    scrollBy({ top = 0, left = 0 } = {}) { this.scrollTop += Number(top) || 0; this.scrollLeft += Number(left) || 0; }
    scrollIntoView() {}
    setPointerCapture() {}
    releasePointerCapture() {}
    getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight, top: 0, left: 0, right: this.clientWidth, bottom: this.clientHeight }; }
    querySelector(selector) {
      if (selector === 'canvas') return this.canvas || null;
      return null;
    }
    querySelectorAll(selector) {
      if (selector === '.mc-mdi-page') return this.pageNodes;
      return [];
    }
    set innerHTML(markup) {
      this._innerHTML = markup;
      if (this.role === 'stack') {
        this.pageNodes = [...String(markup).matchAll(/data-mdi-page="(\d+)"/g)].map(match => {
          const pageNode = new MockNode('page');
          pageNode.dataset.pageNumber = match[1];
          pageNode.canvas = new MockNode('canvas');
          pageNode.canvas.getContext = () => ({});
          pageNode.querySelector = selector => selector === 'canvas' ? pageNode.canvas : null;
          pageNode.getBoundingClientRect = () => ({ width: 1000, height: 1400, top: 0, left: 0, right: 1000, bottom: 1400 });
          return pageNode;
        });
      }
    }
    get innerHTML() { return this._innerHTML || ''; }
  }

  const root = new MockNode('root');
  const viewerHost = new MockNode('viewer');
  const stackNode = new MockNode('stack');
  const loadingNode = new MockNode('loading');
  const sheetLabelNode = new MockNode('sheet-label');
  const sheetSubtitleNode = new MockNode('sheet-subtitle');
  const positionNode = new MockNode('position');
  const pulseSheetNode = new MockNode('pulse-sheet');
  const pulsePositionNode = new MockNode('pulse-position');
  const pulseZoomNode = new MockNode('pulse-zoom');
  const pulseFitNode = new MockNode('pulse-fit');
  const pulseCountsNode = new MockNode('pulse-counts');
  const markupbarNode = new MockNode('markupbar');
  const exitButton = new MockNode('exit');
  const fitWidthButton = new MockNode('fit-width');
  fitWidthButton.dataset.mdiFit = 'width';
  const fitPageButton = new MockNode('fit-page');
  fitPageButton.dataset.mdiFit = 'page';
  const zoomOutButton = new MockNode('zoom-out');
  const zoomInButton = new MockNode('zoom-in');
  const listeners = Object.create(null);
  const penButton = {
    dataset: { mdiTool: 'pen' },
    hasAttribute: name => name === 'data-mdi-tool',
    getAttribute: name => (name === 'data-mdi-tool' ? 'pen' : null),
    closest: selector => selector === 'button' ? penButton : null
  };
  const rectangleButton = {
    dataset: { mdiTool: 'rectangle' },
    hasAttribute: name => name === 'data-mdi-tool',
    getAttribute: name => (name === 'data-mdi-tool' ? 'rectangle' : null),
    closest: selector => selector === 'button' ? rectangleButton : null
  };
  const lineButton = {
    dataset: { mdiTool: 'line' },
    hasAttribute: name => name === 'data-mdi-tool',
    getAttribute: name => (name === 'data-mdi-tool' ? 'line' : null),
    closest: selector => selector === 'button' ? lineButton : null
  };
  const panButton = {
    dataset: { mdiTool: 'pan' },
    hasAttribute: name => name === 'data-mdi-tool',
    getAttribute: name => (name === 'data-mdi-tool' ? 'pan' : null),
    closest: selector => selector === 'button' ? panButton : null
  };
  const emptyPageTarget = pageNode => ({
    closest: selector => {
      if (selector === '.mc-mdi-page') return pageNode;
      if (selector === '[data-markup-id]') return null;
      return null;
    }
  });
  const createPointerEvent = (pageNode, overrides = {}) => ({
    button: 0,
    clientX: 250,
    clientY: 180,
    pointerId: 1,
    target: emptyPageTarget(pageNode),
    preventDefault() {},
    ...overrides
  });

  const waitFor = async (predicate, timeoutMs = 250) => {
    const started = Date.now();
    while (!predicate()) {
      if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for fullscreen render state.');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  };

  root.querySelector = selector => ({
    '[data-mdi-viewer-host]': viewerHost,
    '[data-mdi-stack]': stackNode,
    '[data-mdi-loading]': loadingNode,
    '[data-mdi-sheet-label]': sheetLabelNode,
    '[data-mdi-sheet-subtitle]': sheetSubtitleNode,
    '[data-mdi-position]': positionNode,
    '[data-mdi-pulse-sheet]': pulseSheetNode,
    '[data-mdi-pulse-position]': pulsePositionNode,
    '[data-mdi-pulse-zoom]': pulseZoomNode,
    '[data-mdi-pulse-fit]': pulseFitNode,
    '[data-mdi-pulse-counts]': pulseCountsNode,
    '[data-mdi-markupbar]': markupbarNode,
    '[data-mdi-exit]': exitButton,
    '[data-mdi-zoom-out]': zoomOutButton,
    '[data-mdi-zoom-in]': zoomInButton
  })[selector] || null;
  root.querySelectorAll = selector => selector === '[data-mdi-fit]' ? [fitWidthButton, fitPageButton] : [];
  root.addEventListener = (type, handler) => { listeners[type] = handler; };
  root.classList = { add() {}, remove() {}, toggle() {} };
  Object.defineProperty(root, 'innerHTML', {
    get() { return this._innerHTML || ''; },
    set(value) { this._innerHTML = value; }
  });

  const getPageOrder = [];
  const renderOrder = [];
  const loadOrder = [];
  let resolveSelectedRender = null;
  const fakePdf = {
    numPages: 70,
    async getPage(pageNumber) {
      getPageOrder.push(pageNumber);
      return {
        rotate: 0,
        cleanup() {},
        getViewport() { return { width: pageNumber === 48 ? 1000 : 900, height: pageNumber === 48 ? 1400 : 1300, rotation: 0 }; }
      };
    },
    async destroy() {}
  };

  try {
    const controller = createWorkspaceFullscreenReviewController({
      root,
      workspaceModel: { activeWorkspace: { buildingId: '61', room: 'B13', name: 'Primary Telecommunications Room', drawingCategories: [] } },
      activeWorkspace: { buildingId: '61', room: 'B13', name: 'Primary Telecommunications Room' },
      sheets: Array.from({ length: 70 }, (_, index) => {
        const pageNumber = index + 1;
        return {
          sheetNumber: pageNumber === 48 ? '61T-100' : `61T-${String(pageNumber).padStart(3, '0')}`,
          sheetTitle: pageNumber === 48 ? 'Telecommunication Plan - Basement Level' : `Telecommunication Plan - Page ${pageNumber}`,
          pdfPageNumber: pageNumber,
          pageNumber
        };
      }),
      selectedSheetNumber: '61T-100',
      sourceUrl: 'https://example.test/project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
      openPdfSource: async ({ sourceUrl }) => {
        loadOrder.push(sourceUrl);
        return fakePdf;
      },
      renderPage: async (pdf, pageNumber, canvas) => {
        assert.equal(pdf, fakePdf);
        assert.ok(canvas?.getContext);
        renderOrder.push(pageNumber);
        if (pageNumber === 48) {
          return {
            promise: new Promise(resolve => { resolveSelectedRender = resolve; }),
            releasePage() {}
          };
        }
        return { promise: Promise.resolve(), releasePage() {} };
      },
      calculateFit: ({ containerWidth, containerHeight, pageWidth, pageHeight, mode }) => ({
        ready: true,
        mode,
        scale: mode === 'fit-width' ? (containerWidth - 48) / pageWidth : Math.min((containerWidth - 48) / pageWidth, (containerHeight - 48) / pageHeight)
      })
    });

    await waitFor(() => renderOrder.length > 0);
    assert.ok(controller.root);
    assert.equal(controller.getState().selectedSheetNumber, '61T-100');
    assert.equal(controller.root.dataset.diagnostics, 'enabled');
    const initialDiagnostics = controller.getDiagnostics();
    assert.equal(initialDiagnostics.activeMarkupTool, 'SELECT');
    assert.equal(initialDiagnostics.markupCountOnCurrentPage, 0);
    assert.equal(initialDiagnostics.history.undoDepth, 0);
    assert.equal(initialDiagnostics.history.redoDepth, 0);
    assert.equal(initialDiagnostics.renderRequestsOnCurrentPage, 1);
    assert.ok(root.innerHTML.includes('data-mdi-shell'));
    assert.ok(controller.root.querySelector('[data-mdi-markupbar]'));
    assert.match(root.innerHTML, /data-mdi-markupbar/);
    assert.match(root.innerHTML, /data-mdi-markups-panel/);
    assert.match(root.innerHTML, /data-mdi-toolchest-panel/);
    assert.match(root.innerHTML, /data-mdi-tool="pen"/);
    assert.match(root.innerHTML, /data-mdi-action="toggle-markups"/);
    assert.equal(loadOrder.length, 1);
    assert.equal(loadOrder[0], 'https://example.test/project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf');
    assert.equal(renderOrder[0], 48);
    assert.equal(renderOrder.length, 1);
    assert.deepEqual(getPageOrder, [48]);
    assert.equal(controller.getDiagnostics().activeMarkupTool, 'SELECT');
    const activePageNode = stackNode.pageNodes.find(node => node.dataset.pageNumber === '48') || stackNode.pageNodes[0];
    assert.ok(activePageNode);
    assert.equal(activePageNode.dataset.pageNumber, '48');
    assert.ok(viewerHost.listeners.pointerdown);
    assert.ok(viewerHost.listeners.pointermove);
    assert.ok(viewerHost.listeners.pointerup);
    viewerHost.listeners.pointerdown?.(createPointerEvent(activePageNode));
    assert.equal(controller.getDiagnostics().markupCountOnCurrentPage, 0);
    assert.equal(renderOrder.length, 1);
    viewerHost.listeners.pointermove?.(createPointerEvent(activePageNode, { clientX: 275, clientY: 205 }));
    await viewerHost.listeners.pointerup?.(createPointerEvent(activePageNode));
    assert.equal(controller.getDiagnostics().markupCountOnCurrentPage, 0);
    assert.equal(renderOrder.length, 1);
    listeners.click?.({ target: panButton, preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    viewerHost.listeners.pointerdown?.(createPointerEvent(activePageNode));
    viewerHost.listeners.pointermove?.(createPointerEvent(activePageNode, { clientX: 300, clientY: 220 }));
    await viewerHost.listeners.pointerup?.(createPointerEvent(activePageNode));
    assert.equal(controller.getDiagnostics().markupCountOnCurrentPage, 0);
    assert.equal(renderOrder.length, 1);
    listeners.click?.({ target: rectangleButton, preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.getDiagnostics().activeMarkupTool, 'RECTANGLE');
    viewerHost.listeners.pointerdown?.(createPointerEvent(activePageNode, { clientX: 320, clientY: 240 }));
    viewerHost.listeners.pointermove?.(createPointerEvent(activePageNode, { clientX: 420, clientY: 340 }));
    await viewerHost.listeners.pointerup?.(createPointerEvent(activePageNode, { clientX: 420, clientY: 340 }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.getDiagnostics().markupCountOnCurrentPage, 1);
    assert.equal(controller.getDiagnostics().activeMarkupTool, 'RECTANGLE');
    const rectangleMarkup = controller.getDiagnostics().selectedMarkupId;
    assert.ok(rectangleMarkup);
    viewerHost.listeners.keydown?.({ key: 'Escape', preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.getDiagnostics().activeMarkupTool, 'SELECT');
    assert.equal(controller.getDiagnostics().selectedMarkupId, '');
    listeners.click?.({ target: { closest: selector => selector === 'button' ? { hasAttribute: name => name === 'data-mdi-tool', dataset: { mdiTool: 'bogus' } } : null }, preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.getDiagnostics().activeMarkupTool, 'SELECT');
    viewerHost.listeners.pointerdown?.(createPointerEvent(activePageNode, { clientX: 360, clientY: 280 }));
    await viewerHost.listeners.pointerup?.(createPointerEvent(activePageNode, { clientX: 480, clientY: 380 }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.getDiagnostics().markupCountOnCurrentPage, 1);
    listeners.click?.({ target: lineButton, preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.getDiagnostics().activeMarkupTool, 'LINE');
    viewerHost.listeners.pointerdown?.(createPointerEvent(activePageNode, { clientX: 150, clientY: 130 }));
    viewerHost.listeners.pointermove?.(createPointerEvent(activePageNode, { clientX: 260, clientY: 210 }));
    await viewerHost.listeners.pointerup?.(createPointerEvent(activePageNode, { clientX: 260, clientY: 210 }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.getDiagnostics().markupCountOnCurrentPage, 2);
    listeners.click?.({ target: { closest: selector => selector === 'button' ? { hasAttribute: name => name === 'data-mdi-tool', dataset: { mdiTool: 'select' } } : null }, preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(controller.getDiagnostics().activeMarkupTool, 'SELECT');
    viewerHost.listeners.pointerdown?.(createPointerEvent(activePageNode));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(renderOrder.length, 1);
    resolveSelectedRender?.();
    await waitFor(() => renderOrder.length > 1);
    assert.ok(renderOrder.length > 1);
    assert.ok(renderOrder.some(page => page === 47 || page === 49));
    await controller.destroy('test');

    const controllerAgain = createWorkspaceFullscreenReviewController({
      root,
      workspaceModel: { activeWorkspace: { buildingId: '61', room: 'B13', name: 'Primary Telecommunications Room', drawingCategories: [] } },
      activeWorkspace: { buildingId: '61', room: 'B13', name: 'Primary Telecommunications Room' },
      sheets: Array.from({ length: 70 }, (_, index) => {
        const pageNumber = index + 1;
        return {
          sheetNumber: pageNumber === 48 ? '61T-100' : `61T-${String(pageNumber).padStart(3, '0')}`,
          sheetTitle: pageNumber === 48 ? 'Telecommunication Plan - Basement Level' : `Telecommunication Plan - Page ${pageNumber}`,
          pdfPageNumber: pageNumber,
          pageNumber
        };
      }),
      selectedSheetNumber: '61T-100',
      sourceUrl: 'https://example.test/project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
      openPdfSource: async ({ sourceUrl }) => {
        loadOrder.push(`repeat:${sourceUrl}`);
        return fakePdf;
      },
      renderPage: async (pdf, pageNumber, canvas) => {
        assert.equal(pdf, fakePdf);
        assert.ok(canvas?.getContext);
        return { promise: Promise.resolve(), releasePage() {} };
      },
      calculateFit: ({ containerWidth, containerHeight, pageWidth, pageHeight, mode }) => ({
        ready: true,
        mode,
        scale: mode === 'fit-width' ? (containerWidth - 48) / pageWidth : Math.min((containerWidth - 48) / pageWidth, (containerHeight - 48) / pageHeight)
      })
    });
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.ok(controllerAgain.root);
    assert.equal(loadOrder.filter(entry => entry === 'https://example.test/project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf').length, 1);
    await controllerAgain.destroy('test-repeat');

    const otherSource = 'https://example.test/project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf';
    const controllerOther = createWorkspaceFullscreenReviewController({
      root,
      workspaceModel: { activeWorkspace: { buildingId: '62', room: 'B13', name: 'Primary Telecommunications Room', drawingCategories: [] } },
      activeWorkspace: { buildingId: '62', room: 'B13', name: 'Primary Telecommunications Room' },
      sheets: Array.from({ length: 70 }, (_, index) => ({
        sheetNumber: index === 47 ? '62T-100' : `62T-${String(index + 1).padStart(3, '0')}`,
        sheetTitle: index === 47 ? 'Telecommunication Plan - Basement Level' : `Telecommunication Plan - Page ${index + 1}`,
        pdfPageNumber: index + 1,
        pageNumber: index + 1
      })),
      selectedSheetNumber: '62T-100',
      sourceUrl: otherSource,
      openPdfSource: async ({ sourceUrl }) => {
        loadOrder.push(sourceUrl);
        return fakePdf;
      },
      renderPage: async () => ({ promise: Promise.resolve(), releasePage() {} }),
      calculateFit: ({ containerWidth, containerHeight, pageWidth, pageHeight, mode }) => ({
        ready: true,
        mode,
        scale: mode === 'fit-width' ? (containerWidth - 48) / pageWidth : Math.min((containerWidth - 48) / pageWidth, (containerHeight - 48) / pageHeight)
      })
    });
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.ok(controllerOther.root.querySelector('[data-mdi-exit]'));
    assert.equal(loadOrder.includes(otherSource), true);
    await controllerOther.destroy('test-other');

    const slowLoad = new Promise(() => {});
    const controllerSlow = createWorkspaceFullscreenReviewController({
      root,
      workspaceModel: { activeWorkspace: { buildingId: '61', room: 'B13', name: 'Primary Telecommunications Room', drawingCategories: [] } },
      activeWorkspace: { buildingId: '61', room: 'B13', name: 'Primary Telecommunications Room' },
      sheets: [{ sheetNumber: '61T-100', sheetTitle: 'Telecommunication Plan - Basement Level', pdfPageNumber: 48, pageNumber: 48 }],
      selectedSheetNumber: '61T-100',
      sourceUrl: 'https://example.test/project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
      openPdfSource: async () => ({ numPages: 1, async getPage() { return { rotate: 0, cleanup() {}, getViewport() { return { width: 1000, height: 1400, rotation: 0 }; } }; }, async destroy() {} }),
      renderPage: async () => ({ promise: slowLoad, releasePage() {} }),
      calculateFit: ({ containerWidth, containerHeight, pageWidth, pageHeight, mode }) => ({
        ready: true,
        mode,
        scale: mode === 'fit-width' ? (containerWidth - 48) / pageWidth : Math.min((containerWidth - 48) / pageWidth, (containerHeight - 48) / pageHeight)
      })
    });
    assert.ok(controllerSlow.root.querySelector('[data-mdi-exit]'));
    await controllerSlow.destroy('test-slow');
  } finally {
    globalThis.__MC_DRAWING_REVIEW_DIAGNOSTICS_ENABLED = previousReviewDiagnosticsFlag;
  }
});

test('Phase 24B makes Chief construction-first with one synchronized drawing state', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  const messageMarkup = app.slice(app.indexOf('class="mc-control-messages"'), app.indexOf('id="missionControlComposer"'));
  assert.ok(messageMarkup.indexOf('constructionWorkPackageMarkup(message)') < messageMarkup.indexOf('mc-control-message-content'));
  assert.match(app, /chiefConstructionContext/);
  assert.match(app, /validateChiefConstructionContext/);
  assert.match(app, /missionInlineDrawingViewer/);
  assert.match(app, /Open Full Drawing Workspace/);
  assert.match(app, /activeDrawingRenderIdentity/);
  assert.match(app, /renderCanvas/);
  assert.match(app, /updateDrawingOverlays/);
  assert.match(app, /message\.workPackageReferences\) return ''/);
  assert.match(css, /Phase 24B/);
  assert.match(css, /\.mc-inline-plan/);
  assert.doesNotMatch(app, /engine\.setState\([^)]*workPackage|persistWorkPackage/);
});

test('Mission Control hides built-in demo entry points and opens to Workspace by default', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const sidebar = app.slice(app.indexOf('function renderMissionControlSidebar()'), app.indexOf('async function renderMissionControlWorkspace()'));
  assert.match(app, /missionControlView = 'workspace';/);
  assert.match(sidebar, /data-control-view="workspace" aria-current="\$\{missionControlView === 'workspace' \? 'page' : 'false'\}">Workspace<\/button>/);
  assert.match(sidebar, /data-control-home[^>]*>Chief<\/button>/);
  assert.doesNotMatch(sidebar, /<button[^>]*data-control-view="plans">Drawings<\/button>/);
  assert.doesNotMatch(app, /<button[^>]*data-control-experience="professional-workspace">Professional Workspace<\/button>/);
  assert.doesNotMatch(app, /Explore Demonstration Project/);
  assert.doesNotMatch(app, /Load Demonstration Project/);
  assert.doesNotMatch(app, /Open Demonstration Project/);
  assert.doesNotMatch(app, /Stop Demonstration/);
  assert.doesNotMatch(app, /Reset Demonstration Project/);
});

test('Mission Control uses the compact primary navigation without the compatibility drawer', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const sidebar = app.slice(app.indexOf('function renderMissionControlSidebar()'), app.indexOf('async function renderMissionControlWorkspace()'));
  assert.match(sidebar, /data-control-view="dashboard">Dashboard<\/button>/);
  assert.match(sidebar, /data-control-home[^>]*>Chief<\/button>/);
  assert.match(sidebar, /data-control-view="workspace" aria-current="\$\{missionControlView === 'workspace' \? 'page' : 'false'\}">Workspace<\/button>/);
  assert.doesNotMatch(app, /<nav class="mc-control-nav"/);
  assert.doesNotMatch(app, /<button type="button" class="active" data-control-view="plans">Drawings<\/button>/);
  assert.doesNotMatch(sidebar, /<button[^>]*data-control-view="plans">Drawings<\/button>/);
  assert.doesNotMatch(app, /<button[^>]*data-control-experience="professional-workspace">Professional Workspace<\/button>/);
  assert.doesNotMatch(app, /<button[^>]*data-control-more-tools[^>]*>More Tools<\/button>/);
  assert.doesNotMatch(app, /aria-label="More Tools"/);
});

test('stopping the demonstration clears transient state without deleting the fixture or restoring a project', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const lifecycle = app.slice(app.indexOf('function clearDemonstrationTransientState'), app.indexOf('async function openDemonstrationProject'));
  assert.match(lifecycle, /activeRetrievalSession = null/);
  assert.match(lifecycle, /selectedInspectionId = null/);
  assert.match(lifecycle, /clearActiveContext/);
  assert.match(lifecycle, /engine\.setProject\('general'\)/);
  assert.match(lifecycle, /engine\.createConversation/);
  assert.doesNotMatch(lifecycle, /deleteProject|resetDemoProject/);
});

test('Mission Control explicitly isolates inactive shells from layout and focus', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
  assert.match(app, /\.inert = !missionControl/);
  assert.match(app, /\.inert = missionControl/);
  assert.match(app, /setAttribute\('aria-hidden'/);
  assert.match(css, /\[hidden\],\.mc-shell-inactive\{display:none!important\}/);
});

test('Mission Control owns native chat, conversation history, and precise source actions', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /function renderMissionControlChat/);
  assert.match(app, /function renderConversationHistory/);
  assert.match(app, /id="missionControlComposer"/);
  assert.match(app, /data-control-source-document/);
  assert.doesNotMatch(app.slice(app.indexOf('if \(button\.dataset\.controlPrompt\)'), app.indexOf('const action = button.dataset.controlAction')), /openProfessionalDestination\(\{ view: 'chat'/);
});

test('Mission Control uses user-facing Chief, command-desk, and drawing guidance', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /Select or create a project to begin construction analysis\./);
  assert.match(app, /Ask Chief about \$\{esc\(project\.name\)\}/);
  assert.match(app, /No construction context selected/);
  assert.match(app, /No drawing set is available for this project\./);
  assert.match(app, /Import Drawing/);
  assert.match(app, /Return to Chief/);
  assert.doesNotMatch(app, /No active Engineering Context/);
});

test('exact engineering navigation returns before retrieval and preserves registry ownership', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const submitStart = app.indexOf("$('#missionControlContent').addEventListener('submit'");
  const submit = app.slice(submitStart, app.indexOf('async function ingestMissionControlFiles', submitStart));
  const exactBranch = submit.indexOf('if (navigationIntent.exact)');
  const retrieval = submit.indexOf('await engine.ask');
  assert.ok(exactBranch >= 0 && retrieval > exactBranch);
  assert.match(submit.slice(exactBranch, retrieval), /await showMissionControlView\('plans'\)/);
  assert.match(submit.slice(exactBranch, retrieval), /await openProfessionalDestination\(\{ \.\.\.locationPresentation\.target, view: 'knowledge' \}\)/);
  assert.match(submit.slice(exactBranch, retrieval), /return;/);
  assert.match(submit, /projectId: locationPresentation\.target\.projectId/);
  assert.match(submit, /drawingId: locationPresentation\.target\.drawingId/);
  assert.match(submit, /currentGlobalDrawingRegistryAnalyses\(promptValue\)/);
  const globalUpgrade = app.slice(app.indexOf('async function currentGlobalDrawingRegistryAnalyses'), app.indexOf('async function buildActiveConstructionPackage'));
  assert.match(globalUpgrade, /engine\.drawingRegistryAnalyses\(\)/);
  assert.match(globalUpgrade, /drawingAnalysisRequiresUpgrade\(analysis\)/);
  assert.match(globalUpgrade, /loadAuthoritativeDrawingRegistry/);
  assert.match(globalUpgrade, /loadAnalyses: \(\) => engine\.drawingRegistryAnalyses\(\)/);
  assert.match(globalUpgrade, /save: analysis => engine\.saveDrawingAnalysis\(analysis\)/);
  assert.match(globalUpgrade, /const commandAnalyses = activeExactMatch/);
  assert.match(globalUpgrade, /inspectDrawingRegistryRuntime/);
  const exactCommand = submit.slice(exactBranch, retrieval);
  assert.equal((exactCommand.match(/logger\.info\('Drawing registry runtime inspection'/g) || []).length, 1);
  assert.match(exactCommand, /latestDrawingRegistryInspection = null/);
});

test('legacy Command Desk exact drawing commands terminate before Expert-assisted generation', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const askStart = app.indexOf('async function ask()');
  const ask = app.slice(askStart, app.indexOf("$('#send').onclick = ask", askStart));
  const navigation = ask.indexOf('await navigateExactDrawingCommand');
  const ai = ask.indexOf('await engine.ask');
  assert.ok(navigation >= 0 && ai > navigation);
  const successfulBranch = ask.slice(navigation, ai);
  assert.match(successfulBranch, /if \(navigation\.handled\)/);
  assert.match(successfulBranch, /await showMissionControlView\('plans'\)/);
  assert.match(successfulBranch, /return;/);
});

test('Chief exact drawing navigation delegates page selection to the Drawing Workspace API', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const submitStart = app.indexOf("$('#missionControlContent').addEventListener('submit'");
  const submit = app.slice(submitStart, app.indexOf('async function ingestMissionControlFiles', submitStart));
  const navigation = submit.indexOf('drawingWorkspace.open(resolvedLocationTarget');
  const ai = submit.indexOf('await engine.ask');
  assert.ok(navigation >= 0 && ai > navigation);
  assert.match(submit.slice(navigation, ai), /await showMissionControlView\('plans'\)/);
  assert.match(submit.slice(navigation, ai), /return;/);
});

test('Drawing Workspace context panel is page-scoped and exposes honest empty sections', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /drawingWorkspace\.setPages\(\(analysis\?\.sheets \|\| \[\]\)\.map/);
  assert.match(app, /drawingWorkspace\.getContext\(currentSheet \?/);
  for (const heading of ['Summary', 'Specifications', 'Related Drawings', 'Inspection Items', 'Equipment', 'Rooms', 'Photos', 'Documents', 'Issues', 'History']) assert.match(app, new RegExp(`<h3>${heading}<\\/h3>`));
  assert.match(app, /No linked data\./);
});

test('Drawing Workspace relationship groups separate trust states and delegate valid actions', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  for (const heading of ['Confirmed Specifications', 'Suggested Specifications', 'Related Drawings', 'Rooms', 'Equipment', 'Inspections', 'Photos', 'Issues', 'Risks', 'RFIs', 'Submittals', 'Shutdowns', 'Commissioning', 'History']) assert.match(app, new RegExp(`'${heading}'`));
  assert.match(app, /relationship\.verificationState === 'suggested'/);
  assert.match(app, /data-project-relationship-confirm/);
  assert.match(app, /data-project-relationship-reject/);
  assert.match(app, /entity\.metadata\?\.navigationTarget/);
  assert.match(app, /projectRelationshipEngine\.registerRelationship/);
  assert.match(app, /drawingWorkspace\.open\(target\)/);
});

test('Drawing Workspace requirements panel keeps scope, evidence, trade, and exact actions explicit', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  for (const heading of ['Current Context', 'Governing Drawings', 'Field Requirements', 'Project-Wide Requirements']) assert.match(app, new RegExp(`<h3>${heading}<\\/h3>`));
  assert.match(app, /<h3>Applicable Specifications — Confirmed<\/h3>/);
  assert.match(app, /<h3>Applicable Specifications — Suggested<\/h3>/);
  assert.match(app, /data-drawing-trade/);
  assert.match(app, /data-drawing-select-region/);
  assert.match(app, /data-drawing-clear-region/);
  assert.match(app, /data-requirement-open=/);
  assert.match(app, /data-requirement-open-drawing/);
  assert.match(app, /Review Evidence/);
  assert.match(app, /drawingRequirementsResolver\.invalidate\(\)/);
  assert.match(app, /drawingViewportContextService\.update/);
});

test('Drawing Workspace loads routed document metadata without loading specification chunks and contains provider failure', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const wrapper = app.slice(app.indexOf("async function renderDrawingWorkspace(shell = 'professional')"), app.indexOf("async function renderDrawingWorkspaceWithProviders"));
  const renderer = app.slice(app.indexOf("async function renderDrawingWorkspaceWithProviders"), app.indexOf('async function renderMissionControlDashboard'));
  assert.match(wrapper, /loadDrawingWorkspaceProviders/);
  assert.match(wrapper, /loadDocuments: \(\) => engine\.documents\(\)/);
  assert.match(renderer, /\{ documents: providerDocuments, warnings: providerWarnings = \[\] \}/);
  assert.match(renderer, /providerWarnings/);
  assert.match(renderer, /const documents = allDocuments\.filter\(isDrawingDocumentRole\)/);
  assert.match(renderer, /const specificationDocument = allDocuments\.find\(isSpecificationDocument\)/);
  assert.doesNotMatch(renderer, /await engine\.sections\(\)/);
});
