import { IdentityResolutionEngine } from '../src/identity-resolution-engine.js';

async function testIdentityResolutionEngine() {
  console.log('=== Testing Identity Resolution Engine ===\n');

  const identityEngine = new IdentityResolutionEngine();

  // Test entities that should resolve to the same identity
  const testEntities = [
    {
      id: 'door-001',
      type: 'Door',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-001',
      attributes: {
        label: 'Fire Door 17',
        tag: 'fire-door',
        number: 'FD-17',
        sourceSystem: 'drawing'
      },
      relationships: []
    },
    {
      id: 'door-schedule-ref-001',
      type: 'Door',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-001',
      attributes: {
        label: 'Door 17',
        tag: 'door',
        number: 'FD17',
        sourceSystem: 'schedule'
      },
      relationships: []
    },
    {
      id: 'inspection-door-001',
      type: 'Door',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-001',
      attributes: {
        label: 'Door Tag FD17',
        tag: 'door-tag',
        identifier: 'FD-17',
        sourceSystem: 'inspection'
      },
      relationships: []
    },
    {
      id: 'photo-door-001',
      type: 'Door',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-001',
      attributes: {
        label: 'Photo Door 17',
        tag: 'photo',
        sourceSystem: 'photo'
      },
      relationships: []
    },
    {
      id: 'equipment-001',
      type: 'Equipment',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-002',
      attributes: {
        label: 'Air Handler 2',
        tag: 'ahu',
        number: 'AHU-2',
        sourceSystem: 'drawing'
      },
      relationships: []
    },
    {
      id: 'equipment-schedule-ref-001',
      type: 'Equipment',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-002',
      attributes: {
        label: 'Equipment AHU2',
        tag: 'equipment',
        number: 'AHU-2',
        sourceSystem: 'schedule'
      },
      relationships: []
    },
    {
      id: 'startup-report-001',
      type: 'Equipment',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-002',
      attributes: {
        label: 'Startup Report AHU2',
        tag: 'startup',
        identifier: 'AHU-2',
        sourceSystem: 'report'
      },
      relationships: []
    },
    {
      id: 'wall-001',
      type: 'Wall',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-001',
      attributes: {
        label: 'Partition Wall W-101',
        tag: 'partition',
        number: 'W-101',
        sourceSystem: 'drawing'
      },
      relationships: []
    },
    {
      id: 'wall-schedule-ref-001',
      type: 'Wall',
      building: 'building-001',
      floor: 'floor-001',
      room: 'room-001',
      attributes: {
        label: 'Wall 101',
        tag: 'wall',
        number: 'W101',
        sourceSystem: 'schedule'
      },
      relationships: []
    }
  ];

  console.log(`Processing ${testEntities.length} test entities...\n`);

  // Resolve entities
  const resolved = identityEngine.resolveEntities(testEntities);

  console.log('=== Resolution Results ===\n');

  // Group by canonical identity
  const groups = new Map();
  for (const [entityId, identity] of resolved) {
    if (!groups.has(identity.canonicalId)) {
      groups.set(identity.canonicalId, []);
    }
    groups.get(identity.canonicalId).push({ entityId, identity });
  }

  // Display grouped results
  for (const [canonicalId, items] of groups) {
    const identity = items[0].identity;
    console.log(`Canonical Identity: ${identity.canonicalId}`);
    console.log(`  Type: ${identity.type}`);
    console.log(`  Primary ID: ${identity.primaryId}`);
    console.log(`  Aliases: ${identity.aliases.join(', ')}`);
    console.log(`  Entities: ${identity.entities.join(', ')}`);
    console.log(`  Confidence: ${(identity.confidence * 100).toFixed(0)}%`);
    console.log(`  Evidence entries: ${identity.evidence.length}`);
    console.log('');
  }

  // Test identifier resolution
  console.log('=== Identifier Resolution Tests ===\n');

  const testIdentifiers = ['FD-17', 'FD17', 'AHU-2', 'AHU2', 'W-101', 'W101'];
  for (const id of testIdentifiers) {
    const identity = identityEngine.resolveIdentifier(id);
    if (identity) {
      console.log(`"${id}" -> ${identity.canonicalId} (confidence: ${(identity.confidence * 100).toFixed(0)}%)`);
    } else {
      console.log(`"${id}" -> NOT FOUND`);
    }
  }

  // Test evidence addition without identity change
  console.log('\n=== Evidence Addition Test ===\n');

  const doorIdentity = identityEngine.resolveIdentifier('FD-17');
  if (doorIdentity) {
    console.log(`Adding evidence to ${doorIdentity.canonicalId}...`);
    identityEngine.addEvidence(doorIdentity.canonicalId, {
      type: 'inspection-verification',
      inspector: 'John Doe',
      date: '2026-08-07',
      result: 'passed'
    });
    console.log('Evidence added successfully');
    
    const updatedIdentity = identityEngine.canonicalIdentities.get(doorIdentity.canonicalId);
    console.log(`New evidence count: ${updatedIdentity.evidence.length}`);
  }

  // Test relationship addition without identity change
  console.log('\n=== Relationship Addition Test ===\n');

  if (doorIdentity) {
    console.log(`Adding relationship to ${doorIdentity.canonicalId}...`);
    identityEngine.addRelationship(doorIdentity.canonicalId, {
      type: 'contains',
      target: 'hardware-set-H-101',
      source: 'specification'
    });
    console.log('Relationship added successfully');
    
    const updatedIdentity = identityEngine.canonicalIdentities.get(doorIdentity.canonicalId);
    console.log(`New relationship count: ${updatedIdentity.relationships.length}`);
  }

  // Generate diagnostics
  const diagnostics = identityEngine.generateDiagnostics();

  console.log('\n=== Identity Resolution Diagnostics ===');
  console.log(`Canonical Identities: ${diagnostics.canonicalIdentities}`);
  console.log(`Resolved Identities: ${diagnostics.resolvedIdentities}`);
  console.log(`Unresolved Aliases: ${diagnostics.unresolvedAliases}`);
  console.log(`Conflicting Identities: ${diagnostics.conflictingIdentities}`);
  console.log(`Duplicate Evidence: ${diagnostics.duplicateEvidence}`);
  console.log(`Manual Review Required: ${diagnostics.manualReviewRequired}`);

  if (diagnostics.manualReviewRequired > 0) {
    console.log('\n=== Manual Review Required ===');
    for (const item of diagnostics.details.manualReviewRequired) {
      console.log(`Entity: ${item.entityId}`);
      console.log(`  Canonical ID: ${item.canonicalId}`);
      console.log(`  Similarity: ${(item.similarity * 100).toFixed(0)}%`);
      console.log(`  Patterns: ${item.patterns.join(', ')}`);
      console.log(`  Reason: ${item.reason}`);
      console.log('');
    }
  }

  // Export state
  const exportedState = identityEngine.exportState();
  console.log(`\n=== State Export ===`);
  console.log(`Exported ${exportedState.canonicalIdentities.length} canonical identities`);
  console.log(`Exported ${exportedState.aliasMap.length} alias mappings`);

  console.log('\n=== Identity Resolution Engine Test Complete ===');
}

testIdentityResolutionEngine().catch(console.error);
