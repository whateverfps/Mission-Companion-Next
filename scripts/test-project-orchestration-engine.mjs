import { createConstructionGraph } from '../src/construction-graph.js';
import { ProjectRelationshipEngine } from '../src/project-relationship-engine.js';
import { ProjectFactEngine } from '../src/project-fact-engine.js';
import { ConstructionReasoningEngine } from '../src/construction-reasoning-engine.js';
import { MissionExecutionEngine } from '../src/mission-execution-engine.js';
import { ProjectOrchestrationEngine } from '../src/project-orchestration-engine.js';

async function testProjectOrchestrationEngine() {
  console.log('=== Testing Project Orchestration Engine ===\n');

  // Create construction graph
  const constructionGraph = createConstructionGraph({
    persistence: null
  });

  // Create relationship engine
  const relationshipEngine = new ProjectRelationshipEngine();
  relationshipEngine.initialize(constructionGraph, null);

  // Create fact engine
  const factEngine = new ProjectFactEngine();
  factEngine.initialize(constructionGraph, relationshipEngine);

  // Create reasoning engine
  const reasoningEngine = new ConstructionReasoningEngine();
  reasoningEngine.initialize(constructionGraph, factEngine, relationshipEngine, null);

  // Create mission engine
  const missionEngine = new MissionExecutionEngine();
  missionEngine.initialize(constructionGraph, factEngine, relationshipEngine, reasoningEngine);

  // Create orchestration engine
  const orchestrationEngine = new ProjectOrchestrationEngine();
  orchestrationEngine.initialize(constructionGraph, factEngine, relationshipEngine, reasoningEngine, missionEngine);

  // Register project context nodes
  console.log('Registering project context nodes...\n');

  constructionGraph.registerNode({
    nodeId: 'DOOR:FD17',
    projectId: 'bedford',
    nodeType: 'construction-object',
    title: 'Door FD17',
    label: 'Fire Door 17',
    buildingId: 'B61',
    floorId: 'L1',
    roomId: 'ROOM-127',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'ROOM-127',
    projectId: 'bedford',
    nodeType: 'room',
    title: 'Room 127',
    label: 'Room 127',
    buildingId: 'B61',
    floorId: 'L1',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'AHU:2',
    projectId: 'bedford',
    nodeType: 'construction-object',
    title: 'AHU-2',
    label: 'Air Handler 2',
    buildingId: 'B61',
    floorId: 'L1',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'SPEC:08-11-13',
    projectId: 'bedford',
    nodeType: 'specification-section',
    title: '08 11 13',
    label: 'ACCESS DOORS AND FRAMES',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'INS-0042',
    projectId: 'bedford',
    nodeType: 'inspection',
    title: 'INS-0042',
    label: 'Door Inspection FD17',
    metadata: { status: 'complete' },
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'DEF-0012',
    projectId: 'bedford',
    nodeType: 'deficiency',
    title: 'DEF-0012',
    label: 'Door Deficiency',
    metadata: { status: 'open' },
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  // Create some relationships and facts
  console.log('Creating relationships and facts...\n');

  // Door FD17 governed by specification
  const specRel = relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'SPEC:08-11-13',
    type: 'governed-by',
    evidence: [{ type: 'specification-reference', section: '08 11 13' }],
    sourceDocumentId: 'bedford-specifications',
    sourcePageId: 1278,
    sourceReference: '08 11 13',
    evidenceQuality: 'explicit'
  });

  // Door FD17 inspected
  const inspectionRel = relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'INS-0042',
    type: 'inspected-by',
    evidence: [{ type: 'inspection-record', inspection: 'INS-0042' }],
    sourceDocumentId: 'INS-0042',
    sourcePageId: 1,
    sourceReference: 'FD17',
    evidenceQuality: 'inspection'
  });

  // Door FD17 has deficiency
  const deficiencyRel = relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'DEF-0012',
    type: 'has-deficiency',
    evidence: [{ type: 'deficiency-record', deficiency: 'DEF-0012' }],
    sourceDocumentId: 'DEF-0012',
    sourcePageId: 1,
    sourceReference: 'FD17',
    evidenceQuality: 'inspection'
  });

  // Room 127 has deficiency
  const roomDeficiencyRel = relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'ROOM-127',
    targetId: 'DEF-0012',
    type: 'has-deficiency',
    evidence: [{ type: 'deficiency-record', deficiency: 'DEF-0012' }],
    sourceDocumentId: 'DEF-0012',
    sourcePageId: 1,
    sourceReference: '127',
    evidenceQuality: 'inspection'
  });

  // Create facts from relationships
  const relationships = [specRel, inspectionRel, deficiencyRel, roomDeficiencyRel].filter(r => r !== null);
  factEngine.createFactsFromRelationships(relationships);

  console.log(`Created ${relationships.length} relationships\n`);

  // Test project readiness evaluation
  console.log('=== Testing Project Readiness Evaluation ===\n');

  const readiness = orchestrationEngine.evaluateProjectReadiness();

  console.log('Blocked Workflows:');
  for (const blocked of readiness.blockedWorkflows) {
    console.log(`  - ${blocked.type}: ${blocked.reason}`);
  }

  console.log('\nPrerequisite Tasks:');
  for (const prereq of readiness.prerequisiteTasks) {
    console.log(`  - ${prereq.type}: ${prereq.reason}`);
  }

  console.log('\nMissing Inspections:');
  for (const missing of readiness.missingInspections) {
    console.log(`  - ${missing.objectLabel}: ${missing.reason}`);
  }

  console.log('\nMissing Evidence:');
  for (const missing of readiness.missingEvidence) {
    console.log(`  - ${missing.objectLabel}: ${missing.reason}`);
  }

  console.log('\nSpecification Compliance Gaps:');
  for (const gap of readiness.specificationComplianceGaps) {
    console.log(`  - ${gap.objectLabel}: ${gap.reason}`);
  }

  console.log('\nTurnover Blockers:');
  for (const blocker of readiness.turnoverBlockers) {
    console.log(`  - ${blocker.roomLabel}: ${blocker.reason}`);
  }

  console.log('\nActivation Blockers:');
  for (const blocker of readiness.activationBlockers) {
    console.log(`  - ${blocker.objectLabel}: ${blocker.reason}`);
  }

  // Test dependency graph
  console.log('\n=== Testing Dependency Graph ===\n');

  orchestrationEngine.buildDependencyGraph();

  console.log('Dependency Graph:');
  for (const [actionId, node] of orchestrationEngine.dependencyGraph) {
    console.log(`  ${actionId}:`);
    console.log(`    Depends on: ${node.dependencies.join(', ') || 'none'}`);
    console.log(`    Blocks: ${node.dependents.join(', ') || 'none'}`);
  }

  console.log('\nCritical Path:');
  const criticalPath = orchestrationEngine.identifyCriticalPath();
  console.log(`  ${criticalPath.join(' → ')}`);

  // Test dynamic prioritization
  console.log('\n=== Testing Dynamic Prioritization ===\n');

  const prioritized = orchestrationEngine.dynamicallyPrioritizeActions();

  console.log('Prioritized Actions:');
  for (const action of prioritized) {
    console.log(`  - ${action.factor}: priority ${(action.priority * 100).toFixed(0)}%`);
    console.log(`    Reason: ${action.reason}`);
  }

  // Test project health calculation
  console.log('\n=== Testing Project Health Calculation ===\n');

  const projectHealth = orchestrationEngine.calculateProjectHealth();

  console.log('Project Health Scores:');
  for (const [scoreName, score] of Object.entries(projectHealth)) {
    console.log(`  ${scoreName}: ${(score.value * 100).toFixed(0)}%`);
    console.log(`    ${score.explanation}`);
  }

  // Test recommended next actions
  console.log('\n=== Testing Recommended Next Actions ===\n');

  const nextActions = orchestrationEngine.generateRecommendedNextActions();

  console.log('Recommended Next Actions:');
  for (const action of nextActions) {
    console.log(`  ${action.actionId}: ${action.title}`);
    console.log(`    Description: ${action.description}`);
    console.log(`    Priority: ${action.priority}`);
    console.log(`    Assigned Role: ${action.assignedRole}`);
    console.log(`    Estimated Duration: ${action.estimatedDuration} minutes`);
    console.log(`    Confidence: ${(action.confidence * 100).toFixed(0)}%`);
    console.log('');
  }

  // Test operational timeline
  console.log('=== Testing Operational Timeline ===\n');

  const timeline = orchestrationEngine.updateOperationalTimeline();

  console.log('Operational Timeline:');
  console.log(`  Blocked: ${timeline.blocked.length} activities`);
  console.log(`  Waiting: ${timeline.waiting.length} activities`);
  console.log(`  Completed: ${timeline.completed.length} activities`);

  // Test operational dashboard
  console.log('\n=== Testing Operational Dashboard ===\n');

  const dashboard = orchestrationEngine.generateOperationalDashboard();

  console.log('Operational Dashboard Summary:');
  console.log(`  Overall Health: ${(dashboard.projectHealth.overall.value * 100).toFixed(0)}%`);
  console.log(`  Critical Path: ${dashboard.criticalPath.join(' → ')}`);
  console.log(`  Recommended Actions: ${dashboard.recommendedNextActions.length}`);
  console.log(`  Blocked Activities: ${dashboard.blockedActivities.length}`);
  console.log(`  Upcoming Dependencies: ${dashboard.upcomingDependencies.length}`);
  console.log(`  Highest Risk Items: ${dashboard.highestRiskItems.length}`);

  console.log('\nDashboard Explanation:');
  console.log(`  Summary: ${dashboard.explanation.summary}`);
  console.log(`  Key Findings:`);
  for (const finding of dashboard.explanation.keyFindings) {
    console.log(`    - ${finding}`);
  }
  console.log(`  Recommendations:`);
  for (const rec of dashboard.explanation.recommendations) {
    console.log(`    - ${rec}`);
  }

  console.log('\nDashboard Diagnostics:');
  console.log(`  Generation Time: ${dashboard.diagnostics.generationTime.toFixed(2)}ms`);
  console.log(`  Dependency Graph Size: ${dashboard.diagnostics.dependencyGraphSize}`);

  // Generate engine diagnostics
  const engineDiagnostics = orchestrationEngine.generateDiagnostics();

  console.log('\n=== Orchestration Engine Diagnostics ===');
  console.log(`Graph Nodes: ${engineDiagnostics.graphNodes}`);
  console.log(`Graph Edges: ${engineDiagnostics.graphEdges}`);
  console.log(`Total Facts: ${engineDiagnostics.totalFacts}`);
  console.log(`Total Relationships: ${engineDiagnostics.totalRelationships}`);
  console.log(`Total Conflicts: ${engineDiagnostics.totalConflicts}`);
  console.log(`Dependency Graph Size: ${engineDiagnostics.dependencyGraphSize}`);
  console.log(`Operational Timeline Size: ${engineDiagnostics.operationalTimelineSize}`);

  console.log('\n=== Project Orchestration Engine Test Complete ===');
}

testProjectOrchestrationEngine().catch(console.error);
