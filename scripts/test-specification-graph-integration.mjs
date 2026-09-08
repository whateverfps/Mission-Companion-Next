import { createConstructionGraph } from '../src/construction-graph.js';
import { SpecificationGraphAdapter } from '../src/specification-graph-adapter.js';

async function testSpecificationGraphIntegration() {
  console.log('=== Testing Specification Graph Integration ===\n');

  // Create a construction graph
  const constructionGraph = createConstructionGraph({
    persistence: null // Use in-memory for testing
  });

  // Create specification graph adapter
  const specAdapter = new SpecificationGraphAdapter();

  // Initialize the integration
  const result = specAdapter.initialize(constructionGraph, 'bedford');

  console.log('\n=== Integration Results ===');
  console.log(`Success: ${result.success}`);
  console.log(`Indexed sections: ${result.indexedSections}`);
  console.log(`Linked relationships: ${result.linkedRelationships}`);

  // Test object evidence retrieval
  console.log('\n=== Testing Object Evidence Retrieval ===');

  // Create a test construction object
  const testObject = constructionGraph.registerNode({
    nodeId: 'test-object-001',
    projectId: 'bedford',
    nodeType: 'construction-object',
    title: 'Test Fire Door',
    label: 'Fire Door Assembly',
    trade: 'Doors',
    system: 'Fire Protection',
    normalizedKey: 'test-object-001',
    sourceSystem: 'test',
    verificationState: 'confirmed',
    origin: 'manual'
  });

  if (testObject) {
    console.log(`Created test object: ${testObject.nodeId}`);

    // Get evidence for the test object
    const evidence = specAdapter.getObjectEvidence(constructionGraph, testObject.nodeId);

    if (evidence) {
      console.log(`\nObject: ${evidence.object.label}`);
      console.log(`Trade: ${evidence.object.trade}`);
      console.log(`System: ${evidence.object.system}`);
      console.log(`\nGoverning specifications: ${evidence.specifications.length}`);
      for (const spec of evidence.specifications) {
        console.log(`  - ${spec.node.title}: ${spec.node.label} (confidence: ${spec.confidence})`);
      }
      console.log(`\nGoverning drawings: ${evidence.drawings.length}`);
      console.log(`Inspections: ${evidence.inspections.length}`);
    }
  }

  // Get graph diagnostics
  const diagnostics = constructionGraph.getDiagnostics('bedford');
  console.log('\n=== Graph Diagnostics ===');
  console.log(`Total nodes: ${diagnostics.nodeCount}`);
  console.log(`Total edges: ${diagnostics.edgeCount}`);
  console.log(`Orphan nodes: ${diagnostics.orphanNodeCount}`);
  console.log(`Broken edges: ${diagnostics.brokenEdgeCount}`);

  // Find specification sections
  const specSections = constructionGraph.findNodes({
    projectId: 'bedford',
    nodeTypes: ['specification-section']
  });

  console.log(`\nSpecification sections in graph: ${specSections.length}`);
  console.log('First 5 sections:');
  for (let i = 0; i < Math.min(5, specSections.length); i++) {
    const spec = specSections[i];
    console.log(`  ${spec.title}: ${spec.label} (page ${spec.metadata.startPage}-${spec.metadata.endPage})`);
  }

  console.log('\n=== Integration Test Complete ===');
}

testSpecificationGraphIntegration().catch(console.error);
