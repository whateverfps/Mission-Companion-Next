import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBedfordWorkspaceModel } from '../src/workspace-registry.js';
import { buildBedfordProjectMilestoneContext } from '../src/workspace-milestones.js';
import { buildWorkspaceIssuesModel } from '../src/workspace-issues.js';

function issuesFor(id, pmisRuntime = null) {
  const workspaceModel = buildBedfordWorkspaceModel(id);
  return buildWorkspaceIssuesModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    pmisRuntime
  });
}

test('Workspace issue derivation exists without inventing room-specific B13 issues', () => {
  const issues = issuesFor('B13');
  assert.equal(issues.workspaceId, 'B13');
  assert.equal(issues.roomIssues.length, 0);
  assert.equal(issues.emptyState, 'No room-specific issues recorded.');
  assert.ok(issues.projectIssues.some(item => item.title === 'Awaiting Contractor Schedule'));
  assert.ok(issues.projectIssues.some(item => item.title === 'APP Date Pending'));
  assert.ok(issues.counts.dependencies > 0);
  assert.equal(issues.counts.critical, 0);
});

test('Existing transition workspaces keep their truthful room-specific issue', () => {
  const issues = issuesFor('137');
  assert.equal(issues.roomIssues.length, 1);
  assert.match(issues.roomIssues[0].title, /Existing condition inventory/i);
  assert.equal(issues.roomIssues[0].scope, 'ROOM');
  assert.equal(issues.roomIssues[0].severity, 'INFO');
  assert.ok(issues.roomIssues[0].relatedSheets.length > 0);
  assert.ok(issues.roomIssues[0].relatedSpecifications.length > 0);
});

test('Deterministic contractor schedule dependency references the NTP source document', () => {
  const issues = issuesFor('124');
  const schedule = issues.issues.find(item => item.title === 'Awaiting Contractor Schedule');
  assert.ok(schedule);
  assert.equal(schedule.scope, 'PROJECT');
  assert.equal(schedule.type, 'SCHEDULE');
  assert.equal(schedule.sourceDocument?.id, 'bedford-ntp-notice-to-proceed');
  assert.match(schedule.description, /interim contractor schedule/i);
  assert.ok(schedule.relatedMilestones.some(item => item.id === 'interim-project-schedule'));
});

test('Workspace issues reuse actual PMIS open question and shutdown records when present', () => {
  const pmisRuntime = {
    buildings: [
      {
        Building: '61',
        readinessPct: 0.41,
        'Open Risks': 2,
        'Open Questions': 1,
        'Overall Status': 'Attention',
        'OIT Status': 'Blocked'
      }
    ],
    shutdowns: [
      { Building: '61', Status: 'Open', Title: 'Weekend shutdown', 'Shutdown ID': 'SH-1' }
    ],
    projectRegister: [
      { 'Record Type': 'Question', Building: '61', Title: 'Need contractor schedule', Status: 'Open' },
      { 'Record Type': 'Risk', Building: '61', Title: 'Open risk', Status: 'Open' }
    ]
  };
  const issues = issuesFor('B13', pmisRuntime);
  assert.ok(issues.issues.some(item => item.title === 'Building 61 PMIS readiness attention'));
  assert.ok(issues.issues.some(item => item.type === 'SHUTDOWN'));
  assert.ok(issues.counts.questions > 0);
  assert.ok(issues.counts.open >= 3);
  assert.ok(issues.filters.some(filter => filter.id === 'question' && filter.count > 0));
});

test('Low PMIS readiness alone does not create an actionable issue', () => {
  const pmisRuntime = {
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
  };
  const issues = issuesFor('B13', pmisRuntime);
  assert.ok(!issues.issues.some(item => item.title === 'Building 61 PMIS readiness attention'));
  assert.equal(issues.buildingIssues.length, 0);
  assert.equal(issues.counts.building, 0);
  assert.equal(issues.counts.critical, 0);
  assert.equal(issues.counts.questions, 0);
  assert.equal(issues.counts.open, 3);
  assert.ok(issues.projectIssues.some(item => item.title === 'Awaiting Contractor Schedule'));
  assert.ok(issues.projectIssues.some(item => item.title === 'APP Date Pending'));
  assert.ok(issues.projectIssues.some(item => item.title === 'Interim Project Schedule'));
});

test('A real PMIS blocker or question still creates an actionable issue', () => {
  const pmisRuntime = {
    buildings: [
      {
        Building: '61',
        readinessPct: 0.01,
        'Open Risks': 1,
        'Open Questions': 1,
        'Overall Status': 'Attention',
        'OIT Status': 'Blocked'
      }
    ],
    shutdowns: [
      { Building: '61', Status: 'Open', Title: 'Shutdown coordination', 'Shutdown ID': 'SH-2' }
    ],
    projectRegister: [
      { 'Record Type': 'Question', Building: '61', Title: 'Need contractor schedule', Status: 'Open' }
    ]
  };
  const issues = issuesFor('B13', pmisRuntime);
  assert.ok(issues.issues.some(item => item.title === 'Building 61 PMIS readiness attention'));
  assert.ok(issues.issues.some(item => item.type === 'SHUTDOWN'));
  assert.ok(issues.issues.some(item => item.type === 'QUESTION'));
  assert.ok(issues.counts.questions > 0);
  assert.ok(issues.counts.open > 3);
});

test('Workspace switching changes the issue context without carrying stale room issues', () => {
  const b13 = issuesFor('B13');
  const b124 = issuesFor('124');
  const b226 = issuesFor('226');
  const b137 = issuesFor('137');
  assert.equal(b13.roomIssues.length, 0);
  assert.equal(b124.roomIssues.length, 0);
  assert.equal(b226.roomIssues.length, 0);
  assert.equal(b137.roomIssues.length, 1);
  assert.notEqual(b13.issues[0]?.id || '', b137.issues[0]?.id || '');
});

test('Empty-state rendering remains truthful when no room-specific issue exists', () => {
  const issues = buildWorkspaceIssuesModel({
    workspace: {
      id: 'demo',
      room: 'demo',
      name: 'Demo Workspace',
      building: '61',
      level: 'Basement',
      disciplineFocus: 'Telecommunication',
      sourceSheets: [],
      relatedSheets: [],
      applicableSpecifications: [],
      relatedRooms: [],
      issues: [{ label: 'No room-specific issues recorded', detail: 'Demo placeholder' }]
    },
    projectMilestoneContext: buildBedfordProjectMilestoneContext({ workspace: { id: 'demo', building: '61', room: 'demo' } }),
    pmisRuntime: { buildings: [], shutdowns: [], projectRegister: [] }
  });
  assert.equal(issues.roomIssues.length, 0);
  assert.equal(issues.emptyState, 'No room-specific issues recorded.');
});
