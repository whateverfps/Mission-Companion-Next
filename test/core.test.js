import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReasoningResult,
  normalizeConfidence
} from '../src/core/conflicts/ConflictReasoner.js';
import { extractAcceptanceCriteria } from '../src/core/conflicts/AcceptanceRule.js';
import {
  extractComplianceRequirements,
  normalizeRequirement
} from '../src/core/conflicts/rules/ComplianceRule.js';
import {
  DocumentRecord,
  compareDocuments
} from '../src/core/conflicts/rules/DocumentPrecedenceRule.js';
import { extractScheduleActivity } from '../src/core/conflicts/rules/ScheduleRule.js';
import {
  WorkflowActivity,
  analyzeWorkflow,
  buildWorkflowGraph,
  mergeDuplicateActivities
} from '../src/core/conflicts/rules/WorkflowRule.js';
import { analyzeDependencies } from '../src/core/dependency.js';
import { analyzeTimeline } from '../src/core/timeline.js';
import { analyzeCorpus } from '../src/core/reasoning.js';
import { retrieve } from '../src/retrieval.js';
import { hierarchySections } from './fixtures/specification.js';

test('confidence is bounded and duplicate findings retain the strongest deterministic record', () => {
  assert.equal(normalizeConfidence(2), 1);
  assert.equal(normalizeConfidence(-1), 0);
  assert.equal(normalizeConfidence('bad', 0.4), 0.4);
  const result = new ReasoningResult();
  result.addFinding({ type: 'duplicate', title: 'Same issue', nodeId: 'n1', confidence: 0.3 });
  result.addFinding({ type: 'duplicate', title: 'Same issue', nodeId: 'n1', confidence: 0.9 });
  result.addRecommendation({ title: 'Correct issue', priority: 2 });
  result.addRecommendation({ title: 'Correct issue', priority: 1 });
  result.deduplicate();
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].confidence, 0.9);
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.metrics.duplicateFindingsRemoved, 1);
});

test('acceptance and compliance extraction tolerate missing and legacy metadata', () => {
  const acceptance = extractAcceptanceCriteria({
    id: 'a1',
    text: 'Owner shall approve installation after testing and receipt of the test report.',
    metadata: { document: 'spec.pdf' }
  });
  assert.ok(acceptance.actions.includes('approve'));
  assert.ok(acceptance.prerequisites.length > 0);
  assert.equal(normalizeRequirement('  Contractor   SHALL test. '), 'contractor shall test.');
  const requirements = extractComplianceRequirements({
    id: 'c1',
    text: 'Contractor must submit a certified test report.',
    metadata: null
  });
  assert.ok(requirements.length > 0);
});

test('document precedence and schedule normalization produce observable governing records', () => {
  const contract = new DocumentRecord({ nodeId: 'contract', type: 'contract', title: 'Contract' });
  const drawing = new DocumentRecord({ nodeId: 'drawing', type: 'drawing', title: 'Drawing' });
  const comparison = compareDocuments(contract, drawing);
  assert.equal(comparison.governing.nodeId, 'contract');
  assert.ok(comparison.confidence > 0.9);

  const activity = extractScheduleActivity({
    id: 'schedule-1',
    title: 'Testing',
    text: 'Complete testing before commissioning.',
    metadata: { plannedStart: '2026-01-02', plannedFinish: '2026-01-05', percentComplete: false }
  });
  assert.equal(activity.nodeId, 'schedule-1');
  assert.equal(activity.plannedStart.toISOString().slice(0, 10), '2026-01-02');
});

test('workflow graphs merge duplicates and return deterministic dependency findings', () => {
  const activities = [
    new WorkflowActivity({ id: 'submit', action: 'submit', object: 'shop drawings', successors: ['approve'], confidence: 0.8 }),
    new WorkflowActivity({ id: 'submit-copy', action: 'submit', object: 'shop drawings', confidence: 0.7 }),
    new WorkflowActivity({ id: 'approve', action: 'approve', object: 'shop drawings', predecessors: ['submit'], confidence: 0.9 })
  ];
  assert.equal(mergeDuplicateActivities(activities).length, 2);
  const graph = buildWorkflowGraph(mergeDuplicateActivities(activities));
  const first = analyzeWorkflow(graph);
  const second = analyzeWorkflow(graph);
  assert.deepEqual(second, first);
});

test('dependency, timeline, and core reasoning integrations are deterministic on production hits', () => {
  const sections = hierarchySections();
  sections.push({
    id: 'dated', documentId: 'document-1', documentName: 'compact-specification.txt',
    heading: 'Testing milestone', text: 'Complete testing within 10 days before commissioning on January 15, 2027.',
    path: ['Division 01', 'Testing'], location: 'Page 12', order: 99, level: 3,
    projectId: 'project-1', libraryId: 'library-1'
  });
  const hits = retrieve('testing commissioning requirements schedule', sections, 8);
  const dependencyA = analyzeDependencies(hits);
  const dependencyB = analyzeDependencies(hits);
  assert.deepEqual(dependencyB.sequence, dependencyA.sequence);
  const timelineA = analyzeTimeline(hits);
  const timelineB = analyzeTimeline(hits);
  assert.deepEqual(timelineB.summary, timelineA.summary);
  const reasoning = analyzeCorpus('Who performs testing?', hits, { preset: 'answer' });
  assert.ok(reasoning.requirements);
  assert.ok(reasoning.responsibilities);
});
