import { createConstructionGraph } from '../src/construction-graph.js';
import { ProjectRelationshipEngine } from '../src/project-relationship-engine.js';
import { ProjectFactEngine } from '../src/project-fact-engine.js';
import { ConstructionReasoningEngine } from '../src/construction-reasoning-engine.js';

async function testConstructionReasoningEngine() {
  console.log('=== Testing Construction Reasoning Engine ===\n');

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

  // Register project context nodes
  console.log('Registering project context nodes...\n');

  constructionGraph.registerNode({
    nodeId: 'DOOR:FD17',
    projectId: 'bedford',
    nodeType: 'construction-object',
    title: 'Door FD17',
    label: 'Fire Door 17',
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
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'PANEL:LP1',
    projectId: 'bedford',
    nodeType: 'construction-object',
    title: 'Panel LP1',
    label: 'Lighting Panel LP1',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'CABLE:C17',
    projectId: 'bedford',
    nodeType: 'construction-object',
    title: 'Cable C17',
    label: 'Data Cable C17',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'BUILDING-61',
    projectId: 'bedford',
    nodeType: 'building',
    title: 'Building 61',
    label: 'Building 61',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  // Register specification
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

  // Register inspection
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

  // Register deficiency
  constructionGraph.registerNode({
    nodeId: 'DEF-0012',
    projectId: 'bedford',
    nodeType: 'deficiency',
    title: 'DEF-0012',
    label: 'Door Deficiency',
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

  // Test questions
  console.log('=== Testing Questions ===\n');

  const testQuestions = [
    'What governs Door FD17?',
    'Why isn\'t Room 127 ready?',
    'What inspections remain before turnover?',
    'What evidence supports Door FD17?',
    'What changed since IFC?',
    'What blocks Building 61 activation?'
  ];

  for (const question of testQuestions) {
    console.log(`Question: ${question}`);
    console.log('');
    
    const result = reasoningEngine.processQuestion(question);
    
    console.log(`Answer: ${result.answer}`);
    console.log(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    console.log('');
    console.log('Reasoning Path:');
    for (const step of result.reasoningPath) {
      console.log(`  - ${step}`);
    }
    console.log('');
    
    if (result.evidence.length > 0) {
      console.log('Evidence:');
      for (const evidence of result.evidence) {
        console.log(`  - ${evidence.type}: ${evidence.title || evidence.id || evidence.statement}`);
      }
      console.log('');
    }
    
    if (result.assumptions.length > 0) {
      console.log('Assumptions:');
      for (const assumption of result.assumptions) {
        console.log(`  - ${assumption}`);
      }
      console.log('');
    }
    
    if (result.unresolvedQuestions.length > 0) {
      console.log('Unresolved Questions:');
      for (const uq of result.unresolvedQuestions) {
        console.log(`  - ${uq}`);
      }
      console.log('');
    }
    
    if (result.conflicts.length > 0) {
      console.log('Conflicts:');
      for (const conflict of result.conflicts) {
        console.log(`  - ${JSON.stringify(conflict)}`);
      }
      console.log('');
    }
    
    console.log('Diagnostics:');
    console.log(`  Reasoning Time: ${result.diagnostics.reasoningTime.toFixed(2)}ms`);
    console.log(`  Facts Traversed: ${result.diagnostics.factsTraversed}`);
    console.log(`  Relationships Traversed: ${result.diagnostics.relationshipsTraversed}`);
    console.log(`  Evidence Reviewed: ${result.diagnostics.evidenceReviewed}`);
    console.log(`  Conflicts Encountered: ${result.diagnostics.conflictsEncountered}`);
    console.log(`  Confidence Calculation: ${result.diagnostics.confidenceCalculation}`);
    
    console.log('\n' + '='.repeat(60) + '\n');
  }

  // Generate engine diagnostics
  const engineDiagnostics = reasoningEngine.generateDiagnostics();

  console.log('=== Reasoning Engine Diagnostics ===');
  console.log(`Graph Nodes: ${engineDiagnostics.graphNodes}`);
  console.log(`Graph Edges: ${engineDiagnostics.graphEdges}`);
  console.log(`Total Facts: ${engineDiagnostics.totalFacts}`);
  console.log(`Total Relationships: ${engineDiagnostics.totalRelationships}`);
  console.log(`Total Conflicts: ${engineDiagnostics.totalConflicts}`);

  console.log('\n=== Construction Reasoning Engine Test Complete ===');
}

testConstructionReasoningEngine().catch(console.error);
