import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkspaceComparisonsModel,
  resolveWorkspaceComparisonRightWorkspaceId,
  workspaceComparisonModeLabel,
  WORKSPACE_COMPARISON_MODES
} from '../src/workspace-comparisons.js';

test('Workspace comparisons expose the two approved user-facing modes', () => {
  assert.equal(workspaceComparisonModeLabel(WORKSPACE_COMPARISON_MODES.WORKSPACE), 'Workspace vs Workspace');
  assert.equal(workspaceComparisonModeLabel(WORKSPACE_COMPARISON_MODES.REQUIREMENT), 'Requirement vs Evidence');
  assert.equal(workspaceComparisonModeLabel('anything-else'), 'Workspace vs Workspace');
});

test('Workspace comparisons resolve a distinct right-hand workspace by default', () => {
  const right = resolveWorkspaceComparisonRightWorkspaceId('B13', '');
  assert.ok(right);
  assert.notEqual(right, 'B13');
  assert.equal(resolveWorkspaceComparisonRightWorkspaceId('B13', right), right);
});

test('Workspace vs workspace comparisons stay deterministic and retain issue metadata', () => {
  const model = buildWorkspaceComparisonsModel({
    leftWorkspaceId: 'B13',
    rightWorkspaceId: '124'
  });
  assert.equal(model.mode, WORKSPACE_COMPARISON_MODES.WORKSPACE);
  assert.equal(model.leftWorkspaceId, 'B13');
  assert.equal(model.rightWorkspaceId, '124');
  assert.ok(model.dimensions.some(item => item.id === 'identity'));
  assert.ok(model.dimensions.some(item => item.id === 'issues'));
  const issues = model.dimensions.find(item => item.id === 'issues');
  assert.ok(issues);
  assert.ok(issues.rows.length > 0);
  assert.ok(issues.rows.every(row => !row.left || (
    row.left.severity !== undefined &&
    row.left.scope !== undefined &&
    row.left.status !== undefined &&
    row.left.type !== undefined
  )));
  assert.ok(model.summary.dimensions >= 6);
});

test('Requirement vs evidence comparisons derive the approved checklist requirements', () => {
  const model = buildWorkspaceComparisonsModel({
    mode: WORKSPACE_COMPARISON_MODES.REQUIREMENT,
    leftWorkspaceId: 'B13'
  });
  assert.equal(model.mode, WORKSPACE_COMPARISON_MODES.REQUIREMENT);
  assert.equal(model.leftWorkspaceId, 'B13');
  assert.equal(model.rightWorkspaceId, '');
  assert.equal(model.requirements.length, 9);
  assert.equal(model.selectedRequirementId, 'B13|room|construction');
  const selected = model.requirements.find(item => item.id === model.selectedRequirementId);
  assert.ok(selected);
  assert.equal(selected.evidenceStatus, 'Blocked');
  assert.ok(selected.relatedDrawings.every(item => item.sheetNumber || item.sheetTitle));
  assert.ok(selected.relatedSpecifications.every(item => item.sectionNumber || item.sectionTitle));
});
