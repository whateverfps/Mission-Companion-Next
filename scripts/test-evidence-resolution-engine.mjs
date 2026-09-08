import { EvidenceResolutionEngine } from '../src/evidence-resolution-engine.js';

async function testEvidenceResolutionEngine() {
  console.log('=== Testing Evidence Resolution Engine ===\n');

  const evidenceEngine = new EvidenceResolutionEngine();

  // Test entity with multiple evidence sources
  const testEntity = {
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
  };

  // Multiple evidence sources for the same door
  const evidenceList = [
    {
      type: 'drawing',
      sourceType: 'drawing',
      sourceId: 'drawing-001',
      sourceDocumentId: 'floor-plan',
      sourcePageId: 17,
      data: {
        tag: 'FD-17',
        number: 'FD-17',
        identifier: 'FD-17',
        label: 'Fire Door 17'
      },
      timestamp: '2026-08-07T10:00:00Z'
    },
    {
      type: 'schedule',
      sourceType: 'schedule',
      sourceId: 'door-schedule-001',
      sourceDocumentId: 'door-schedule',
      sourcePageId: 5,
      data: {
        itemNumber: 'FD-17',
        tag: 'FD-17',
        identifier: 'FD-17',
        label: 'Fire Door'
      },
      timestamp: '2026-08-07T11:00:00Z'
    },
    {
      type: 'detail',
      sourceType: 'detail',
      sourceId: 'detail-001',
      sourceDocumentId: 'detail-drawing',
      sourcePageId: 12,
      data: {
        detailNumber: 'FD-17',
        tag: 'FD-17',
        identifier: 'FD-17',
        label: 'Fire Door Detail'
      },
      timestamp: '2026-08-07T12:00:00Z'
    },
    {
      type: 'inspection',
      sourceType: 'inspection',
      sourceId: 'inspection-001',
      sourceDocumentId: 'inspection-report',
      sourcePageId: 45,
      data: {
        inspectionNumber: 'FD-17',
        tag: 'FD-17',
        identifier: 'FD-17',
        label: 'Fire Door Inspection'
      },
      timestamp: '2026-08-07T13:00:00:00Z'
    },
    {
      type: 'photo',
      sourceType: 'photo',
      sourceId: 'photo-001',
      sourceDocumentId: 'photo-log',
      sourcePageId: 88,
      data: {
        photoTag: 'FD-17',
        tag: 'FD-17',
        identifier: 'FD-17',
        label: 'Photo of Door FD-17'
      },
      timestamp: '2026-08-07T14:00:00Z'
    }
  ];

  console.log('Processing entity with 5 evidence sources...\n');

  // Resolve entity with multiple evidence
  const identity = evidenceEngine.resolveEntityWithMultipleEvidence(testEntity, evidenceList);

  if (identity) {
    console.log('=== Resolved Identity ===');
    console.log(`Canonical ID: ${identity.canonicalId}`);
    console.log(`Type: ${identity.type}`);
    console.log(`Primary Identifier: ${identity.primaryIdentifier}`);
    console.log(`Confidence: ${(identity.confidence * 100).toFixed(0)}%`);
    console.log(`Evidence Sources: ${identity.evidenceSources.join(', ')}`);
    console.log(`Supporting Evidence: ${identity.supportingEvidence.length} items`);
    console.log(`Entities: ${identity.entities.join(', ')}`);
    console.log(`Aliases: ${identity.aliases.join(', ')}`);
    console.log('');

    // Show merge explanation
    const explanation = evidenceEngine.getMergeExplanation(identity.canonicalId);
    console.log('=== Merge Explanation ===');
    console.log(`Canonical ID: ${explanation.canonicalId}`);
    console.log(`Primary Identifier: ${explanation.primaryIdentifier}`);
    console.log(`Confidence: ${explanation.confidence * 100}%`);
    console.log(`Evidence Count: ${explanation.evidenceCount}`);
    console.log(`Source Count: ${explanation.sourceCount}`);
    console.log(`Sources: ${explanation.sources.join(', ')}`);
    console.log(`\nEvidence Citations:`);
    for (const citation of explanation.evidenceCitations) {
      console.log(`  - ${citation.type} from ${citation.sourceType} (${citation.extractedIdentifier}) at ${citation.timestamp}`);
    }
    console.log(`\nMerge History:`);
    for (const merge of explanation.mergeHistory) {
      console.log(`  - ${merge.action} (${merge.timestamp})`);
    }
  }

  // Test single evidence (low confidence)
  console.log('\n=== Testing Single Evidence (Low Confidence) ===\n');

  const singleEvidenceEntity = {
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
  };

  const singleEvidence = [
    {
      type: 'drawing',
      sourceType: 'drawing',
      sourceId: 'drawing-002',
      sourceDocumentId: 'floor-plan',
      sourcePageId: 25,
      data: {
        tag: 'AHU-2',
        number: 'AHU-2',
        identifier: 'AHU-2',
        label: 'Air Handler 2'
      },
      timestamp: '2026-08-07T15:00:00Z'
    }
  ];

  const singleIdentity = evidenceEngine.resolveEntityWithMultipleEvidence(singleEvidenceEntity, singleEvidence);

  if (singleIdentity) {
    console.log(`Canonical ID: ${singleIdentity.canonicalId}`);
    console.log(`Confidence: ${(singleIdentity.confidence * 100).toFixed(0)}% (Low - single source)`);
    console.log(`Evidence Sources: ${singleIdentity.evidenceSources.join(', ')}`);
  }

  // Test two evidence sources (medium confidence)
  console.log('\n=== Testing Two Evidence Sources (Medium Confidence) ===\n');

  const dualEvidenceEntity = {
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
  };

  const dualEvidence = [
    {
      type: 'drawing',
      sourceType: 'drawing',
      sourceId: 'drawing-003',
      sourceDocumentId: 'floor-plan',
      sourcePageId: 30,
      data: {
        tag: 'W-101',
        number: 'W-101',
        identifier: 'W-101',
        label: 'Partition Wall W-101'
      },
      timestamp: '2026-08-07T16:00:00Z'
    },
    {
      type: 'schedule',
      sourceType: 'schedule',
      sourceId: 'wall-schedule-001',
      sourceDocumentId: 'wall-schedule',
      sourcePageId:8,
      data: {
        itemNumber: 'W-101',
        tag: 'W-101',
        identifier: 'W-101',
        label: 'Partition Wall'
      },
      timestamp: '2026-08-07T17:00:00Z'
    }
  ];

  const dualIdentity = evidenceEngine.resolveEntityWithMultipleEvidence(dualEvidenceEntity, dualEvidence);

  if (dualIdentity) {
    console.log(`Canonical ID: ${dualIdentity.canonicalId}`);
    console.log(`Confidence: ${(dualIdentity.confidence * 100).toFixed(0)}% (Medium - two sources agree)`);
    console.log(`Evidence Sources: ${dualIdentity.evidenceSources.join(', ')}`);
  }

  // Test adding additional evidence without identity change
  console.log('\n=== Adding Evidence Without Identity Change ===\n');

  if (identity) {
    console.log(`Adding specification evidence to ${identity.canonicalId}...`);
    const specEvidence = {
      type: 'specification',
      sourceType: 'specification',
      sourceId: 'spec-07-84-00',
      sourceDocumentId: 'bedford-specifications',
      sourcePageId: 1252,
      data: {
        sectionNumber: '07 84 00',
        tag: 'FD-17',
        identifier: 'FD-17',
        label: 'Firestopping Requirements'
      },
      timestamp: '2026-08-07T18:00:00Z'
    };
    
    const added = evidenceEngine.addEvidence(identity.canonicalId, specEvidence);
    console.log(`Evidence added: ${added}`);
    
    const updatedIdentity = evidenceEngine.canonicalIdentities.get(identity.canonicalId);
    console.log(`New confidence: ${(updatedIdentity.confidence * 100).toFixed(0)}% (Verified - 6 sources agree)`);
    console.log(`New evidence sources: ${updatedIdentity.evidenceSources.join(', ')}`);
  }

  // Test identifier resolution
  console.log('\n=== Identifier Resolution Tests ===\n');

  const testIdentifiers = ['FD-17', 'AHU-2', 'W-101'];
  for (const id of testIdentifiers) {
    const resolved = evidenceEngine.resolveIdentifier(id);
    if (resolved) {
      console.log(`"${id}" -> ${resolved.canonicalId} (confidence: ${(resolved.confidence * 100).toFixed(0)}%)`);
    } else {
      console.log(`"${id}" -> NOT FOUND`);
    }
  }

  // Generate diagnostics
  const diagnostics = evidenceEngine.generateDiagnostics();

  console.log('\n=== Evidence Resolution Diagnostics ===');
  console.log(`Canonical Identities: ${diagnostics.canonicalIdentities}`);
  console.log(`Supporting Evidence: ${diagnostics.supportingEvidence}`);
  console.log(`Evidence Sources: ${diagnostics.evidenceSources}`);
  console.log(`Resolved Identities: ${diagnostics.resolvedIdentities}`);
  console.log(`Conflicts: ${diagnostics.conflicts}`);
  console.log(`Manual Review Required: ${diagnostics.manualReviewRequired}`);

  console.log('\n=== Confidence Breakdown ===');
  console.log(`Low confidence (<50%): ${diagnostics.confidenceBreakdown.low}`);
  console.log(`Medium confidence (50-74%): ${diagnostics.confidenceBreakdown.medium}`);
  console.log(`High confidence (75-99%): ${diagnostics.confidenceBreakdown.high}`);
  console.log(`Verified (100%): ${diagnostics.confidenceBreakdown.verified}`);

  if (diagnostics.details.manualReviewRequired.length > 0) {
    console.log('\n=== Manual Review Required ===');
    for (const item of diagnostics.details.manualReviewRequired) {
      console.log(`Entity: ${item.entityId}`);
      console.log(`  Conflicting IDs: ${item.conflictingCanonicalIds.join(', ')}`);
      console.log(`  Evidence count: ${item.evidenceCount}`);
      console.log(`  Reason: ${item.reason}`);
    }
  }

  // Export state
  const exportedState = evidenceEngine.exportState();
  console.log(`\n=== State Export ===`);
  console.log(`Exported ${exportedState.canonicalIdentities.length} canonical identities`);
  console.log(`Exported ${exportedState.evidenceMap.length} evidence mappings`);

  console.log('\n=== Evidence Resolution Engine Test Complete ===');
}

testEvidenceResolutionEngine().catch(console.error);
