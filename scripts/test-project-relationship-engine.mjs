import { createConstructionGraph } from '../src/construction-graph.js';
import { ProjectRelationshipEngine } from '../src/project-relationship-engine.js';

async function testProjectRelationshipEngine() {
  console.log('=== Testing Project Relationship Engine ===\n');

  // Create construction graph
  const constructionGraph = createConstructionGraph({
    persistence: null
  });

  // Create relationship engine
  const relationshipEngine = new ProjectRelationshipEngine();
  relationshipEngine.initialize(constructionGraph, null);

  // Register project context nodes
  console.log('Registering project context nodes...\n');

  constructionGraph.registerNode({
    nodeId: 'BEDFORD',
    projectId: 'bedford',
    nodeType: 'project',
    title: 'Bedford EHRM',
    label: 'Bedford EHRM',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'B61',
    projectId: 'bedford',
    nodeType: 'building',
    title: 'Building 61',
    label: 'Building 61',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'L1',
    projectId: 'bedford',
    nodeType: 'floor',
    title: 'Level 1',
    label: 'Level 1',
    buildingId: 'B61',
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
    nodeId: 'ROOM-129',
    projectId: 'bedford',
    nodeType: 'room',
    title: 'Room 129',
    label: 'Room 129',
    buildingId: 'B61',
    floorId: 'L1',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

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

  // Register drawing/document nodes
  constructionGraph.registerNode({
    nodeId: 'A101',
    projectId: 'bedford',
    nodeType: 'drawing-page',
    title: 'A101',
    label: 'Floor Plan Level 1',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'A601',
    projectId: 'bedford',
    nodeType: 'document',
    title: 'A601',
    label: 'Door Schedule',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: '5/A501',
    projectId: 'bedford',
    nodeType: 'drawing-page',
    title: '5/A501',
    label: 'Door Detail FD17',
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
    nodeId: 'SUB-081113-01',
    projectId: 'bedford',
    nodeType: 'submittal',
    title: 'SUB-081113-01',
    label: 'Door Submittal',
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
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'PHOTO-0084',
    projectId: 'bedford',
    nodeType: 'photo',
    title: 'PHOTO-0084',
    label: 'Photo of Door FD17',
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
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  console.log('Creating relationships for Door FD17...\n');

  // Create relationships for Door FD17
  const relationships = [];

  // located-in -> Room 127
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

  // appears-on -> A101
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'A101',
    type: 'appears-on',
    evidence: [{ type: 'drawing-callout', tag: 'FD17' }],
    sourceDocumentId: 'A101',
    sourcePageId: 17,
    sourceReference: 'FD17',
    evidenceQuality: 'authoritative'
  }));

  // scheduled-on -> A601
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'A601',
    type: 'scheduled-on',
    evidence: [{ type: 'door-schedule', row: 'FD17' }],
    sourceDocumentId: 'A601',
    sourcePageId: 5,
    sourceReference: 'FD17',
    evidenceQuality: 'explicit'
  }));

  // detailed-by -> 5/A501
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: '5/A501',
    type: 'detailed-by',
    evidence: [{ type: 'detail-reference', tag: 'FD17' }],
    sourceDocumentId: '5/A501',
    sourcePageId: 12,
    sourceReference: 'FD17',
    evidenceQuality: 'explicit'
  }));

  // governed-by -> 08 11 13
  relationships.push(relationshipEngine.createRelationship({
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
  }));

  // covered-by-submittal -> SUB-081113-01
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'SUB-081113-01',
    type: 'covered-by-submittal',
    evidence: [{ type: 'submittal-reference', submittal: 'SUB-081113-01' }],
    sourceDocumentId: 'SUB-081113-01',
    sourcePageId: 1,
    sourceReference: 'FD17',
    evidenceQuality: 'submittal'
  }));

  // inspected-by -> INS-0042
  relationships.push(relationshipEngine.createRelationship({
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
  }));

  // photographed-by -> PHOTO-0084
  relationships.push(relationshipEngine.createRelationship({
    projectId: 'bedford',
    buildingId: 'B61',
    floorId: 'L1',
    sourceId: 'DOOR:FD17',
    targetId: 'PHOTO-0084',
    type: 'photographed-by',
    evidence: [{ type: 'photo-reference', photo: 'PHOTO-0084' }],
    sourceDocumentId: 'PHOTO-0084',
    sourcePageId: 1,
    sourceReference: 'FD17',
    evidenceQuality: 'photo'
  }));

  // has-deficiency -> DEF-0012
  relationships.push(relationshipEngine.createRelationship({
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
  }));

  console.log(`Created ${relationships.filter(r => r !== null).length} relationships\n`);

  // Display all relationships for Door FD17
  console.log('=== Door FD17 Relationships ===\n');

  const doorRelationships = relationshipEngine.getRelationships('DOOR:FD17', 'outgoing');

  for (const rel of doorRelationships) {
    console.log(`${rel.sourceId} -> ${rel.type} -> ${rel.targetId}`);
    console.log(`  Confidence: ${(rel.confidence * 100).toFixed(0)}%`);
    console.log(`  Evidence Quality: ${rel.evidenceQuality}`);
    console.log(`  Source Document: ${rel.sourceDocumentId} (page ${rel.sourcePageId})`);
    console.log(`  Evidence: ${JSON.stringify(rel.evidence)}`);
    console.log(`  Verification State: ${rel.verificationState}`);
    console.log('');
  }

  // Test conflict detection
  console.log('=== Testing Conflict Detection ===\n');

  // Try to create conflicting location relationship
  const conflictRelationship = relationshipEngine.createRelationship({
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

  if (conflictRelationship) {
    console.log(`Created conflicting relationship: ${conflictRelationship.relationshipId}`);
    console.log(`Verification state: ${conflictRelationship.verificationState}`);
  }

  // Show conflicts
  if (relationshipEngine.conflicts.length > 0) {
    console.log('\n=== Conflicts Detected ===\n');
    for (const conflict of relationshipEngine.conflicts) {
      console.log(`Source: ${conflict.relationship.sourceId}`);
      console.log(`Type: ${conflict.relationship.type}`);
      console.log(`Competing targets: ${conflict.competingTargets.join(', ')}`);
      console.log(`Status: ${conflict.status}`);
      console.log('');
    }
  }

  // Get complete relationship evidence
  console.log('=== Complete Relationship Evidence for Door FD17 ===\n');

  const evidence = relationshipEngine.getEntityRelationshipEvidence('DOOR:FD17');
  console.log(`Outgoing relationships: ${evidence.outgoing.length}`);
  console.log(`Incoming relationships: ${evidence.incoming.length}`);

  // Generate diagnostics
  const diagnostics = relationshipEngine.generateDiagnostics();

  console.log('\n=== Relationship Engine Diagnostics ===');
  console.log(`Relationships Created: ${diagnostics.relationshipsCreated}`);
  console.log(`Verified Relationships: ${diagnostics.verifiedRelationships}`);
  console.log(`Suggested Relationships: ${diagnostics.suggestedRelationships}`);
  console.log(`Conflicts: ${diagnostics.conflicts}`);
  console.log(`Unresolved References: ${diagnostics.unresolvedReferences}`);
  console.log(`Orphan Identities: ${diagnostics.orphanIdentities}`);
  console.log(`Objects Without Location: ${diagnostics.objectsWithoutLocation}`);
  console.log(`Objects Without Governing Evidence: ${diagnostics.objectsWithoutGoverningEvidence}`);
  console.log(`Objects Without Drawing Evidence: ${diagnostics.objectsWithoutDrawingEvidence}`);

  console.log('\n=== Confidence Breakdown ===');
  console.log(`Low confidence (<50%): ${diagnostics.confidenceBreakdown.low}`);
  console.log(`Medium confidence (50-74%): ${diagnostics.confidenceBreakdown.medium}`);
  console.log(`High confidence (75-99%): ${diagnostics.confidenceBreakdown.high}`);
  console.log(`Verified (100%): ${diagnostics.confidenceBreakdown.verified}`);

  console.log('\n=== Project Relationship Engine Test Complete ===');
}

testProjectRelationshipEngine().catch(console.error);
