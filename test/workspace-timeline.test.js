import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBedfordWorkspaceModel } from '../src/workspace-registry.js';
import { buildWorkspaceIssuesModel } from '../src/workspace-issues.js';
import { buildWorkspaceChecklistModel } from '../src/workspace-checklist.js';
import { buildWorkspaceTimelineModel, timelineFilterMatches } from '../src/workspace-timeline.js';

function timelineFor(id, { workspaceOverride = null } = {}) {
  const workspaceModel = buildBedfordWorkspaceModel(id);
  const workspace = workspaceOverride || workspaceModel.activeWorkspace;
  const issuesModel = buildWorkspaceIssuesModel({
    workspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext
  });
  const checklistModel = buildWorkspaceChecklistModel({
    workspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel
  });
  return buildWorkspaceTimelineModel({
    workspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext,
    issuesModel,
    checklistModel,
    now: new Date('2026-08-14T12:00:00Z')
  });
}

test('B13 builds a deterministic timeline from shared contractual milestones and workspace dependencies', () => {
  const timeline = timelineFor('B13');
  assert.equal(timeline.workspaceId, 'B13');
  assert.equal(timeline.summary.projectPhase, 'Preconstruction');
  assert.equal(timeline.summary.nextContractualMilestone?.title, 'Quality Control Plan');
  assert.equal(timeline.summary.contractCompletion?.title, 'Contract Completion');
  assert.equal(timeline.summary.roomScheduleStatus, 'Awaiting Contractor Schedule');
  assert.ok(timeline.items.some(item => item.title === 'Notice to Proceed' && item.status === 'COMPLETE'));
  assert.ok(timeline.items.some(item => item.title === 'Quality Control Plan' && item.status === 'UPCOMING'));
  assert.ok(timeline.items.some(item => item.title === 'Interim Project Schedule' && item.status === 'UPCOMING'));
  assert.ok(timeline.items.some(item => item.title === 'Final Project Schedule' && item.status === 'UPCOMING'));
  assert.ok(timeline.items.some(item => item.title === 'Accident Prevention Plan' && item.status === 'PENDING_DATE'));
  assert.ok(timeline.items.some(item => item.title === 'Room Schedule' && item.status === 'AWAITING_SOURCE'));
  const roomSchedule = timeline.items.find(item => item.title === 'Room Schedule');
  assert.ok(roomSchedule?.relatedIssues.some(item => item.title === 'Awaiting Contractor Schedule'));
  assert.ok(roomSchedule?.relatedChecklistItems.length > 0);
  const interim = timeline.items.find(item => item.title === 'Interim Project Schedule');
  assert.ok(interim?.relatedChecklistItems.length > 0);
  assert.ok(interim?.relatedIssues.some(item => item.title === 'Awaiting Contractor Schedule'));
  assert.ok(timeline.counts.complete >= 3);
  assert.ok(timeline.counts.upcoming >= 3);
  assert.equal(timeline.counts.pendingDate, 1);
  assert.equal(timeline.counts.awaitingSource >= 1, true);
  assert.ok(timeline.overviewItems.length <= 4);
  assert.ok(timeline.overviewItems[0].sourceRefs.some(ref => ref.documentId === 'bedford-ntp-notice-to-proceed'));
});

test('Existing transition workspace 137 gets transition-specific timeline context without B13 bleed-through', () => {
  const timeline = timelineFor('137');
  assert.equal(timeline.workspaceId, '137');
  assert.equal(timeline.summary.roomScheduleStatus, 'Awaiting Contractor Schedule');
  assert.ok(timeline.items.some(item => item.title === 'Transition Planning'));
  const transition = timeline.items.find(item => item.title === 'Transition Planning');
  assert.ok(transition?.relatedChecklistItems.some(item => /transition|continuity|migration/i.test(item.title)));
  assert.ok(transition?.relatedIssues.every(item => item.scope === 'ROOM'));
  assert.ok(timeline.items.every(item => item.workspaceId === '137'));
  assert.ok(transition?.sourceRefs.some(ref => ref.kind === 'drawing' && ref.documentId === 'bedford-b61-drawings'));
});

test('Timeline filters remain deterministic and status buckets remain distinct', () => {
  const timeline = timelineFor('B13');
  const qcp = timeline.items.find(item => item.title === 'Quality Control Plan');
  const app = timeline.items.find(item => item.title === 'Accident Prevention Plan');
  const roomSchedule = timeline.items.find(item => item.title === 'Room Schedule');
  assert.ok(qcp && timelineFilterMatches(qcp, 'contract'));
  assert.ok(timelineFilterMatches(roomSchedule, 'schedule'));
  assert.ok(timelineFilterMatches(app, 'pending'));
  assert.equal(timeline.items.filter(item => item.bucket === 'past').length, timeline.counts.complete);
  assert.equal(timeline.items.filter(item => item.bucket === 'pending').length, timeline.counts.pendingDate + timeline.counts.awaitingSource + timeline.counts.unknown);
});
