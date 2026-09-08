import { createConstructionGraph } from '../src/construction-graph.js';
import { ProjectRelationshipEngine } from '../src/project-relationship-engine.js';
import { ProjectFactEngine } from '../src/project-fact-engine.js';

async function testProjectFactEngine() {
  console.log('=== Testing Project Fact Engine ===\n');

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
    nodeId: 'ROOM-129',
    projectId: 'bedford',
    nodeType: 'room',
    title: 'Room 129',
    label: 'Room 129',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'WALL:W32',
    projectId: 'bedford',
    nodeType: 'construction-object',
    title: 'Wall W32',
    label: 'Partition Wall W32',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  // Register the FIRE-RATING-2HR node (attribute value) BEFORE creating relationships
  constructionGraph.registerNode({
    nodeId: 'FIRE-RATING-2HR',
    projectId: 'bedford',
    nodeType: 'attribute',
    title: 'Fire Rating 2 Hours',
    label: '2HR Fire Rating',
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
    nodeId: 'SPEC:09-91-00',
    projectId: 'bedford',
    nodeType: 'specification-section',
    title: '09 91 00',
    label: 'PAINTING',
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
    nodeId: 'TR-2',
    projectId: 'bedford',
    nodeType: 'construction-object',
    title: 'TR-2',
    label: 'Telecom Room 2',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  // Create relationships (these will become facts)
  console.log('Creating relationships (which will become facts)...\n');

  const relationships = [];

  // Door FD17 is located in Room 127
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'ROOM-127',
    type: 'located-in',
    evidence: [{ type: 'door-schedule', row: 'FD17', room: '127' }],
    sourceDocumentId: 'A601',
    sourcePageId: 5,
    sourceReference: 'FD17',
    evidenceQuality: 'explicit'
  }));

  // AHU-2 is supplied from Panel LP1
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'AHU:2',
    targetId: 'PANEL:LP1',
    type: 'supplied-from',
    evidence: [{ type: 'panel-schedule', ahu: 'AHU-2', panel: 'LP1' }],
    sourceDocumentId: 'E601',
    sourcePageId: 7,
    sourceReference: 'AHU-2',
    evidenceQuality: 'explicit'
  }));

  // Room 127 is governed by Specification 09 91 00
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'ROOM-127',
    targetId: 'SPEC:09-91-00',
    type: 'governed-by',
    evidence: [{ type: 'finish-schedule', room: '127', spec: '09 91 00' }],
    sourceDocumentId: 'A603',
    sourcePageId: 2,
    sourceReference: '127',
    evidenceQuality: 'explicit'
  }));

  // Cable C17 terminates in TR-2
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'CABLE:C17',
    targetId: 'TR-2',
    type: 'terminates-at',
    evidence: [{ type: 'cable-schedule', cable: 'C17', destination: 'TR-2' }],
    sourceDocumentId: 'T601',
    sourcePageId: 4,
    sourceReference: 'C17',
    evidenceQuality: 'explicit'
  }));

  // Register the FIRE-RATING-2HR node (attribute value)
  constructionGraph.registerNode({
    nodeId: 'FIRE-RATING-2HR',
    projectId: 'bedford',
    nodeType: 'attribute',
    title: 'Fire Rating 2 Hours',
    label: '2HR Fire Rating',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  console.log(`Created ${relationships.filter(r => r !== null).length} relationships\n`);

  // Create facts from relationships
  console.log('Creating facts from relationships...\n');

  const factResult = factEngine.createFactsFromRelationships(relationships.filter(r => r !== null));

  console.log(`Created ${factResult.createdFacts.length} new facts`);
  console.log(`Updated ${factResult.updatedFacts.length} existing facts\n`);

  // Display all facts
  console.log('=== All Facts ===\n');

  for (const fact of factEngine.facts.values()) {
    console.log(`Fact: ${fact.factId}`);
    console.log(`  Statement: ${fact.subjectId} ${fact.predicate} ${fact.objectId}`);
    console.log(`  Lifecycle State: ${fact.lifecycleState}`);
    console.log(`  Verification State: ${fact.verificationState}`);
    console.log(`  Confidence: ${(fact.confidence * 100).toFixed(0)}%`);
    console.log(`  Evidence Count: ${fact.evidenceIds.length}`);
    console.log(`  Evidence Sources: ${fact.evidenceSources.join(', ')}`);
    console.log(`  First Observed: ${fact.firstObserved}`);
    console.log(`  Review Status: ${fact.reviewStatus}`);
    console.log('');
  }

  // Test fact explanation
  console.log('=== Fact Explanation Example ===\n');

  const doorFact = factEngine.getFactsForSubject('DOOR:FD17')[0];
  if (doorFact) {
    const explanation = factEngine.getFactExplanation(doorFact.factId);
    console.log(`Statement: ${explanation.statement}`);
    console.log(`Why believed: ${explanation.whyBelieved}`);
    console.log(`Evidence supports: ${explanation.evidenceSupports.join(', ')}`);
    console.log(`Who verified: ${explanation.whoVerified.length > 0 ? explanation.whoVerified.join(', ') : 'Not verified'}`);
    console.log(`When verified: ${explanation.whenVerified || 'Not verified'}`);
    console.log(`Has changed: ${explanation.hasChanged}`);
    console.log(`Evidence disagrees: ${explanation.evidenceDisagrees}`);
    console.log('');
  }

  // Test fact verification
  console.log('=== Testing Fact Verification ===\n');

  const wallFact = factEngine.getFactsForSubject('WALL:W32')[0];
  if (wallFact) {
    console.log(`Verifying fact: ${wallFact.factId}`);
    const verified = factEngine.verifyFact(wallFact.factId, 'verifier-001', 'Verified against wall schedule');
    console.log(`Verification result: ${verified}`);
    
    const updatedFact = factEngine.getFact(wallFact.factId);
    console.log(`New verification state: ${updatedFact.verificationState}`);
    console.log(`New lifecycle state: ${updatedFact.lifecycleState}`);
    console.log(`Last verified: ${updatedFact.lastVerified}`);
    console.log('');
  }

  // Test conflicting facts
  console.log('=== Testing Conflicting Facts ===\n');

  // Create conflicting relationship (Door FD17 located in Room 129)
  const conflictingRelationship = relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'ROOM-129',
    type: 'located-in',
    evidence: [{ type: 'floor-plan', tag: 'FD17', room: '129' }],
    sourceDocumentId: 'A101',
    sourcePageId: 17,
    sourceReference: 'FD17',
    evidenceQuality: 'authoritative'
  });

  if (conflictingRelationship) {
    console.log(`Created conflicting relationship: ${conflictingRelationship.relationshipId}`);
    
    // Create fact from conflicting relationship
    const conflictingFact = factEngine.createFactFromRelationship(conflictingRelationship);
    console.log(`Created conflicting fact: ${conflictingFact.factId}`);
    console.log(`Lifecycle state: ${conflictingFact.lifecycleState}`);
    console.log(`Conflicts: ${conflictingFact.conflicts.length}`);
    console.log('');
  }

  // Show facts requiring review
  console.log('=== Facts Requiring Review ===\n');

  const factsRequiringReview = factEngine.getFactsRequiringReview();
  for (const fact of factsRequiringReview) {
    console.log(`Fact: ${fact.factId}`);
    console.log(`  Statement: ${fact.subjectId} ${fact.predicate} ${fact.objectId}`);
    console.log(`  Review Status: ${fact.reviewStatus}`);
    console.log(`  Conflicts: ${fact.conflicts.length}`);
    console.log('');
  }

  // Generate diagnostics
  const diagnostics = factEngine.generateDiagnostics();

  console.log('=== Fact Engine Diagnostics ===');
  console.log(`Total Facts: ${diagnostics.totalFacts}`);
  console.log(`Facts by State:`);
  for (const [state, count] of Object.entries(diagnostics.factsByState)) {
    console.log(`  ${state}: ${count}`);
  }
  console.log(`Facts Requiring Review: ${diagnostics.factsRequiringReview}`);
  console.log(`Verified Facts: ${diagnostics.verifiedFacts}`);
  console.log(`Conflicted Facts: ${diagnostics.conflictedFacts}`);
  console.log(`Retired Facts: ${diagnostics.retiredFacts}`);
  console.log(`Superseded Facts: ${diagnostics.supersededFacts}`);
  console.log(`Average Confidence: ${(diagnostics.averageConfidence * 100).toFixed(0)}%`);
  console.log(`Evidence to Fact Mappings: ${diagnostics.evidenceToFactMappings}`);

  console.log('\n=== Project Fact Engine Test Complete ===');
}

testProjectFactEngine().catch(console.error);
