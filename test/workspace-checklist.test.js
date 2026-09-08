import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBedfordWorkspaceModel } from '../src/workspace-registry.js';
import { buildWorkspaceIssuesModel } from '../src/workspace-issues.js';
import { buildWorkspaceChecklistModel, buildWorkspaceScheduleModel, checklistFilterMatches } from '../src/workspace-checklist.js';
import { readFileSync } from 'node:fs';

function checklistFor(id, pmisRuntime = null) {
  const workspaceModel = buildBedfordWorkspaceModel(id);
  const issuesModel = buildWorkspaceIssuesModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    pmisRuntime
  });
  return buildWorkspaceChecklistModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel,
    pmisRuntime
  });
}

test('B13 derives a deterministic checklist from source drawings, specs, and project dependencies', () => {
  const checklist = checklistFor('B13');
  assert.equal(checklist.workspaceId, 'B13');
  assert.ok(checklist.items.length > 0);
  assert.equal(checklist.counts.applicableItems, checklist.items.length);
  assert.equal(checklist.schedule.status, 'Awaiting Contractor Schedule');
  assert.equal(checklist.schedule.hasDetailedActivitySchedule, false);
  assert.ok(checklist.schedule.activities.length > 0);
  assert.ok(checklist.items.some(item => item.title === 'Verify room construction and boundaries'));
  assert.ok(checklist.items.some(item => item.title === 'Verify grounding and bonding'));
  assert.ok(checklist.items.some(item => item.title === 'Verify horizontal cabling and testing readiness'));
  assert.ok(checklist.items.some(item => item.title === 'Room schedule confirmed' && item.status === 'BLOCKED'));
  assert.ok(checklist.items.some(item => item.title === 'APP / preconstruction gate reviewed' && item.status === 'BLOCKED'));
  const grounding = checklist.items.find(item => item.title === 'Verify grounding and bonding');
  assert.ok(grounding?.sourceRefs.some(ref => ref.kind === 'specification' && ref.sectionNumber === '27 05 26'));
  assert.ok(grounding?.sourceRefs.some(ref => ref.kind === 'drawing' && ref.sheetNumber === '61T-100'));
  assert.equal(grounding?.assessmentSection, 'ELECTRICAL / UPS');
  assert.equal(grounding?.assessmentRequirement, 'Verify grounding and bonding');
  assert.equal(grounding?.assessmentSource, 'B61_Assessment');
  assert.equal(grounding?.assessmentRows, '36-41');
  assert.equal(grounding?.plannedInspectionWindow, 'Awaiting Contractor Schedule');
  assert.equal(grounding?.queueState, 'BLOCKED');
  assert.equal(grounding?.inspectionPlan?.status, 'BLOCKED');
  assert.equal(grounding?.inspectionPlan?.assessmentSheet, 'B61_Assessment');
  assert.equal(grounding?.inspectionPlan?.assessmentSection, 'ELECTRICAL / UPS');
  assert.equal(grounding?.inspectionPlan?.assessmentRows, '36-41');
  assert.equal(grounding?.inspectionPlan?.verificationStatus, 'NOT_VERIFIED');
  assert.equal(grounding?.inspectionPlan?.scheduleActivityId, null);
  assert.equal(grounding?.inspectionPlan?.scheduleStatus, 'BLOCKED');
  assert.ok(Array.isArray(grounding?.inspectionPlan?.sourceBasis));
  const sourceDocs = checklist.items.find(item => item.title === 'Review source documentation');
  assert.equal(sourceDocs?.assessmentSection, 'SOURCE / DRAWING REVIEW NOTES');
  assert.equal(sourceDocs?.assessmentRows, '145-153');
  assert.equal(sourceDocs?.assessmentSource, 'B61_Assessment');
  assert.equal(sourceDocs?.queueState, 'READY');
  assert.equal(sourceDocs?.inspectionPlan?.status, 'READY');
  assert.ok(checklist.items.every(item => item.workspaceId === 'B13'));
});

test('Existing transition workspace 137 gets transition-specific checklist items without B13-specific source bleed-through', () => {
  const checklist = checklistFor('137');
  assert.equal(checklist.workspaceId, '137');
  assert.ok(checklist.items.some(item => item.title === 'Inventory existing equipment and conditions'));
  assert.ok(checklist.items.some(item => item.title === 'Confirm active service continuity'));
  assert.ok(checklist.items.some(item => item.title === 'Review turnover and migration dependencies'));
  assert.ok(checklist.items.some(item => item.title === 'Room schedule confirmed'));
  assert.ok(checklist.items.every(item => item.sourceRefs.every(ref => ref.kind !== 'drawing' || !['61T-100', '61T-101', '61T-102'].includes(ref.sheetNumber) || item.title === 'Review source documentation' || item.title === 'Room schedule confirmed')));
});

test('Checklist filters stay deterministic and blocked state remains distinct', () => {
  const checklist = checklistFor('B13');
  assert.ok(checklistFilterMatches(checklist.items[0], 'all'));
  assert.ok(checklist.items.some(item => checklistFilterMatches(item, 'blocked')));
  assert.ok(checklist.items.some(item => checklistFilterMatches(item, 'awaiting-schedule')));
  assert.ok(checklist.items.some(item => checklistFilterMatches(item, 'documentation')));
  assert.ok(checklist.items.some(item => checklistFilterMatches(item, 'power')));
  assert.ok(checklist.items.some(item => checklistFilterMatches(item, 'telecom')));
});

test('Low PMIS readiness does not create checklist-only fabrications', () => {
  const checklist = checklistFor('B13', {
    buildings: [
      {
        Building: '61',
        readinessPct: 0.01,
        'Open Risks': 0,
        'Open Questions': 0,
        'Overall Status': 'Attention',
        'OIT Status': 'Blocked'
      }
    ],
    shutdowns: [],
    projectRegister: []
  });
  const pmisItem = checklist.items.find(item => item.title === 'Review PMIS activation context');
  assert.ok(pmisItem);
  assert.equal(pmisItem.status, 'UNKNOWN');
  assert.equal(pmisItem.blockedBy.length, 0);
  assert.ok(checklist.items.some(item => item.title === 'Review source documentation'));
  assert.equal(checklist.counts.blocked, 6);
});

test('Workspace checklist schedule adapter normalizes Project_Register schedule control and keeps truthfully awaiting contractor schedule when no usable dates exist', () => {
  const workspaceModel = buildBedfordWorkspaceModel('B13');
  const schedule = buildWorkspaceScheduleModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    pmisRuntime: {
      projectRegister: [
        {
          'Record ID': 'SCH-001',
          'Record Type': 'Schedule Item',
          Category: 'Schedule',
          Discipline: 'Project Controls',
          Building: 'ALL',
          'Floor / Room': '',
          Title: 'Contractor Baseline Schedule',
          Status: 'Waiting',
          Phase: 'Preconstruction',
          'Decision / Action Needed': 'Contractor schedule has not been received.'
        }
      ]
    }
  });

  assert.equal(schedule.status, 'Awaiting Contractor Schedule');
  assert.equal(schedule.source, 'Project_Register');
  assert.equal(schedule.sourceRecords.length, 1);
  assert.equal(schedule.sourceRecords[0].activityId, 'SCH-001');
  assert.equal(schedule.sourceRecords[0].name, 'Contractor Baseline Schedule');
  assert.equal(schedule.windows.overdue.length, 0);
  assert.equal(schedule.windows.readyForInspection.length, 0);
  assert.ok(schedule.activities.some(item => item.activityId === 'SCH-001'));
});

test('Workspace checklist inspection plan exposes compact queue states and verification metadata', () => {
  const checklist = checklistFor('137', {
    buildings: [
      {
        Building: '61',
        readinessPct: 0.42,
        'Open Risks': 0,
        'Open Questions': 0,
        'Overall Status': 'Monitor',
        'OIT Status': 'Monitor'
      }
    ],
    projectRegister: []
  });
  const inventory = checklist.items.find(item => item.title === 'Inventory existing equipment and conditions');
  const continuity = checklist.items.find(item => item.title === 'Confirm active service continuity');
  const pmis = checklist.items.find(item => item.title === 'Review PMIS activation context');

  assert.equal(inventory?.inspectionPlan?.workspaceId, '137');
  assert.equal(inventory?.inspectionPlan?.buildingId, '61');
  assert.equal(inventory?.inspectionPlan?.roomId, '137');
  assert.equal(inventory?.inspectionPlan?.trade, inventory?.category);
  assert.equal(inventory?.inspectionPlan?.workPackage, 'ROOM');
  assert.equal(inventory?.inspectionPlan?.scheduleStatus, inventory?.queueState);
  assert.equal(inventory?.inspectionPlan?.verificationStatus, inventory?.verificationStatus);
  assert.deepEqual(inventory?.inspectionPlan?.evidenceIds, []);
  assert.deepEqual(inventory?.inspectionPlan?.issueIds, []);
  assert.ok(Array.isArray(inventory?.inspectionPlan?.drawingRefs));
  assert.ok(Array.isArray(inventory?.inspectionPlan?.specificationRefs));
  assert.ok(Array.isArray(inventory?.inspectionPlan?.sourceBasis));
  assert.equal(continuity?.queueState, 'BLOCKED');
  assert.equal(pmis?.queueState, 'AWAITING_SCHEDULE');
  assert.ok(checklist.filters.some(filter => filter.id === 'ready'));
  assert.ok(checklist.filters.some(filter => filter.id === 'awaiting-schedule'));
  assert.ok(checklist.filters.some(filter => filter.id === 'complete'));
  assert.equal(checklist.counts.ready >= 1, true);
  assert.equal(checklist.counts.awaitingSchedule >= 1, true);
});

test('Workspace checklist hydrates durable verification records without changing queue state semantics', () => {
  const workspaceModel = buildBedfordWorkspaceModel('B13');
  const issuesModel = buildWorkspaceIssuesModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext
  });
  const baseline = buildWorkspaceChecklistModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel
  });
  const baselineGrounding = baseline.items.find(item => item.id === 'B13|power|grounding');
  const verificationRecords = [
    {
      id: 'workspace-checklist-verification:bedford:B13:B13|power|grounding',
      projectId: 'bedford',
      workspaceId: 'B13',
      itemId: 'B13|power|grounding',
      verificationStatus: 'PASS',
      notes: 'Field verified and accepted.',
      verifiedBy: 'Inspector',
      verifiedAt: '2026-08-14T12:00:00Z',
      evidenceIds: ['evidence-1'],
      issueIds: ['issue-1']
    }
  ];
  const checklist = buildWorkspaceChecklistModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel,
    verificationRecords
  });
  const grounding = checklist.items.find(item => item.id === 'B13|power|grounding');
  assert.equal(checklist.counts.reviewedThisSession, 0);
  assert.equal(baselineGrounding?.queueState, 'BLOCKED');
  assert.equal(grounding?.queueState, baselineGrounding?.queueState);
  assert.equal(grounding?.verificationStatus, 'PASS');
  assert.equal(grounding?.verifiedBy, 'Inspector');
  assert.equal(grounding?.verifiedAt, '2026-08-14T12:00:00Z');
  assert.equal(grounding?.verificationNotes, 'Field verified and accepted.');
  assert.deepEqual(grounding?.verificationEvidenceIds, ['evidence-1']);
  assert.deepEqual(grounding?.verificationIssueIds, ['issue-1']);
  assert.ok(new Set(checklist.items.map(item => item.id)).size === checklist.items.length);
});

test('Workspace checklist verification summary counts PASS, FAIL, and NA while leaving NOT_VERIFIED separate', () => {
  const workspaceModel = buildBedfordWorkspaceModel('B13');
  const issuesModel = buildWorkspaceIssuesModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext
  });
  const checklist = buildWorkspaceChecklistModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel,
    verificationRecords: [
      {
        id: 'workspace-checklist-verification:bedford:B13:B13|room|construction',
        projectId: 'bedford',
        workspaceId: 'B13',
        itemId: 'B13|room|construction',
        verificationStatus: 'PASS',
        notes: 'Room boundaries verified.',
        verifiedBy: 'Inspector',
        verifiedAt: '2026-08-15T12:00:00Z'
      },
      {
        id: 'workspace-checklist-verification:bedford:B13:B13|power|grounding',
        projectId: 'bedford',
        workspaceId: 'B13',
        itemId: 'B13|power|grounding',
        verificationStatus: 'FAIL',
        notes: 'Grounding incomplete.',
        verifiedBy: 'Inspector',
        verifiedAt: '2026-08-15T12:30:00Z'
      },
      {
        id: 'workspace-checklist-verification:bedford:B13:B13|telecom|cabling',
        projectId: 'bedford',
        workspaceId: 'B13',
        itemId: 'B13|telecom|cabling',
        verificationStatus: 'NA',
        notes: 'Not applicable for this phase.',
        verifiedBy: 'Inspector',
        verifiedAt: '2026-08-15T13:00:00Z'
      }
    ]
  });

  assert.equal(checklist.counts.pass, 1);
  assert.equal(checklist.counts.fail, 1);
  assert.equal(checklist.counts.na, 1);
  assert.equal(checklist.counts.notVerified, checklist.items.length - 3);
  assert.equal(checklist.counts.reviewedThisSession, 0);
  assert.equal(checklist.items.find(item => item.id === 'B13|room|construction')?.verificationStatus, 'PASS');
  assert.equal(checklist.items.find(item => item.id === 'B13|power|grounding')?.verificationStatus, 'FAIL');
  assert.equal(checklist.items.find(item => item.id === 'B13|telecom|cabling')?.verificationStatus, 'NA');
});

test('Workspace checklist verification records do not invent verifier identity when none is available', () => {
  const workspaceModel = buildBedfordWorkspaceModel('B13');
  const issuesModel = buildWorkspaceIssuesModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext
  });
  const checklist = buildWorkspaceChecklistModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel,
    verificationRecords: [
      {
        id: 'workspace-checklist-verification:bedford:B13:B13|room|construction',
        projectId: 'bedford',
        workspaceId: 'B13',
        itemId: 'B13|room|construction',
        verificationStatus: 'PASS',
        notes: 'Room boundaries verified.',
        verifiedAt: '2026-08-15T12:00:00Z'
      }
    ]
  });
  const grounding = checklist.items.find(item => item.id === 'B13|room|construction');
  assert.equal(grounding?.verifiedBy, '');
  assert.equal(grounding?.verifiedAt, '2026-08-15T12:00:00Z');
});

test('Workspace checklist sanitizes legacy workspace-name verifier attribution while preserving verification state', () => {
  const workspaceModel = buildBedfordWorkspaceModel('B13');
  const issuesModel = buildWorkspaceIssuesModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext
  });
  const checklist = buildWorkspaceChecklistModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel,
    verificationRecords: [
      {
        id: 'workspace-checklist-verification:bedford:B13:B13|room|construction',
        projectId: 'bedford',
        workspaceId: 'B13',
        itemId: 'B13|room|construction',
        verificationStatus: 'PASS',
        notes: 'Field verified and accepted.',
        verifiedBy: 'Primary Telecommunications Room',
        verifiedAt: '2026-08-14T12:00:00Z',
        evidenceIds: ['evidence-1'],
        issueIds: ['issue-1']
      }
    ]
  });
  const grounding = checklist.items.find(item => item.id === 'B13|room|construction');
  assert.equal(grounding?.verificationStatus, 'PASS');
  assert.equal(grounding?.verifiedBy, '');
  assert.equal(grounding?.verifiedAt, '2026-08-14T12:00:00Z');
  assert.equal(grounding?.verificationNotes, 'Field verified and accepted.');
  assert.deepEqual(grounding?.verificationEvidenceIds, ['evidence-1']);
  assert.deepEqual(grounding?.verificationIssueIds, ['issue-1']);
});

test('Workspace checklist detail renders the verification editor in the normal selected-item flow', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const detail = app.slice(app.indexOf('function renderWorkspaceChecklistDetail'), app.indexOf('function renderWorkspaceChecklistView'));
  const verificationIndex = detail.indexOf('<strong>VERIFICATION</strong>');
  const pmisGateIndex = detail.indexOf('<strong>PMIS GATE</strong>');
  const sourceDrawingsIndex = detail.indexOf('<strong>SOURCE DRAWINGS</strong>');
  assert.ok(verificationIndex > -1);
  assert.ok(sourceDrawingsIndex > -1);
  assert.ok(pmisGateIndex > -1);
  assert.ok(verificationIndex > sourceDrawingsIndex);
  assert.ok(verificationIndex < pmisGateIndex);
  assert.match(detail, /PASS/);
  assert.match(detail, /FAIL/);
  assert.match(detail, /NOT VERIFIED/);
  assert.match(detail, /Inspection Notes/);
  assert.match(detail, /Save Verification/);
});
