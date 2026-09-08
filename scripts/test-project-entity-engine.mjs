import { createConstructionGraph } from '../src/construction-graph.js';
import { SpecificationGraphAdapter } from '../src/specification-graph-adapter.js';
import { ProjectEntityEngine } from '../src/project-entity-engine.js';

async function testProjectEntityEngine() {
  console.log('=== Testing Project Entity Engine ===\n');

  // Create a construction graph
  const constructionGraph = createConstructionGraph({
    persistence: null // Use in-memory for testing
  });

  // Create specification graph adapter and initialize
  const specAdapter = new SpecificationGraphAdapter();
  const specInitResult = await specAdapter.initialize(constructionGraph, 'bedford');
  console.log(`Specification adapter initialized: ${specInitResult.indexedSections} sections indexed`);

  // Create project entity engine
  const entityEngine = new ProjectEntityEngine();
  entityEngine.initialize(constructionGraph, specAdapter);

  // Add some test drawing objects to the graph
  console.log('Adding test drawing objects...');
  
  const testObjects = [
    {
      nodeId: 'door-001',
      projectId: 'bedford',
      nodeType: 'construction-object',
      title: 'Fire Door 001',
      label: 'Fire Door Assembly',
      normalizedKey: 'door-001',
      buildingId: 'building-001',
      floorId: 'floor-001',
      roomId: 'room-001',
      trade: 'Doors',
      system: 'Fire Protection',
      sourceSystem: 'test',
      verificationState: 'confirmed',
      origin: 'manual',
      metadata: {
        objectType: 'door',
        tag: 'fire-door',
        number: 'FD-001'
      }
    },
    {
      nodeId: 'wall-001',
      projectId: 'bedford',
      nodeType: 'construction-object',
      title: 'Partition Wall 001',
      label: 'Gypsum Board Partition',
      normalizedKey: 'wall-001',
      buildingId: 'building-001',
      floorId: 'floor-001',
      roomId: 'room-001',
      trade: 'Walls',
      system: 'Partitions',
      sourceSystem: 'test',
      verificationState: 'confirmed',
      origin: 'manual',
      metadata: {
        objectType: 'wall',
        tag: 'partition',
        number: 'W-001'
      }
    },
    {
      nodeId: 'equipment-001',
      projectId: 'bedford',
      nodeType: 'construction-object',
      title: 'HVAC Unit 001',
      label: 'Air Handling Unit',
      normalizedKey: 'equipment-001',
      buildingId: 'building-001',
      floorId: 'floor-001',
      roomId: 'room-002',
      trade: 'HVAC',
      system: 'Mechanical',
      sourceSystem: 'test',
      verificationState: 'confirmed',
      origin: 'manual',
      metadata: {
        objectType: 'equipment',
        tag: 'ahu',
        number: 'AHU-001'
      }
    }
  ];

  for (const obj of testObjects) {
    constructionGraph.registerNode(obj);
  }

  // Add room, floor, building nodes
  constructionGraph.registerNode({
    nodeId: 'room-001',
    projectId: 'bedford',
    nodeType: 'room',
    title: 'Room 001',
    label: 'Patient Room',
    buildingId: 'building-001',
    floorId: 'floor-001',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'room-002',
    projectId: 'bedford',
    nodeType: 'room',
    title: 'Room 002',
    label: 'Equipment Room',
    buildingId: 'building-001',
    floorId: 'floor-001',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'floor-001',
    projectId: 'bedford',
    nodeType: 'floor',
    title: 'Floor 1',
    label: 'First Floor',
    buildingId: 'building-001',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  constructionGraph.registerNode({
    nodeId: 'building-001',
    projectId: 'bedford',
    nodeType: 'building',
    title: 'Building 001',
    label: 'Main Building',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  console.log(`Added ${testObjects.length} test drawing objects`);

  // Run the entity engine
  const diagnostics = await entityEngine.run('bedford');

  console.log('\n=== Entity Engine Results ===');
  console.log(`Total entities created: ${diagnostics.entitiesCreated}`);
  console.log(`Duplicate entities merged: ${diagnostics.duplicateEntitiesMerged}`);
  console.log(`Relationships created: ${diagnostics.relationshipsCreated}`);
  console.log(`Unresolved references: ${diagnostics.unresolvedReferences}`);
  console.log(`Missing evidence: ${diagnostics.missingEvidence}`);
  console.log(`Orphan objects: ${diagnostics.orphanObjects}`);

  // Show sample entities
  console.log('\n=== Sample Entities ===');
  const entityList = Array.from(entityEngine.entities.values()).slice(0, 3);
  for (const entity of entityList) {
    console.log(`\nEntity: ${entity.id}`);
    console.log(`  Type: ${entity.type}`);
    console.log(`  Building: ${entity.building}`);
    console.log(`  Floor: ${entity.floor}`);
    console.log(`  Room: ${entity.room}`);
    console.log(`  Trade: ${entity.attributes?.trade}`);
    console.log(`  System: ${entity.attributes?.system}`);
    console.log(`  Drawing refs: ${entity.drawingReferences.length}`);
    console.log(`  Spec refs: ${entity.specificationReferences.length}`);
    console.log(`  Relationships: ${entity.relationships.length}`);
  }

  // Show entity evidence for one object
  console.log('\n=== Entity Evidence for door-001 ===');
  const doorEntity = entityEngine.entities.get('door-001');
  if (doorEntity) {
    console.log(`Entity: ${doorEntity.id}`);
    console.log(`Type: ${doorEntity.type}`);
    console.log(`Specification references: ${doorEntity.specificationReferences.length}`);
    for (const specRef of doorEntity.specificationReferences) {
      const specNode = constructionGraph.getNode(specRef);
      if (specNode) {
        console.log(`  - ${specNode.title}: ${specNode.label}`);
      }
    }
  }

  console.log('\n=== Project Entity Engine Test Complete ===');
}

testProjectEntityEngine().catch(console.error);
