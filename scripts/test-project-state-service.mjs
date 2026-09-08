import { ProjectStateService } from '../src/project-state-service.js';

async function testProjectStateService() {
  console.log('=== Testing Project State Service ===\n');

  const stateService = new ProjectStateService();

  // Initialize default states
  console.log('Initializing default states...\n');
  stateService.initializeDefaultStates();

  console.log(`Initialized ${stateService.states.size} default states\n`);

  // Get complete project state
  console.log('=== Complete Project State ===\n');

  const projectState = stateService.getProjectState();

  for (const [category, state] of Object.entries(projectState)) {
    if (state) {
      console.log(`${category}:`);
      console.log(`  Current State: ${state.currentState}`);
      console.log(`  Previous State: ${state.previousState || 'none'}`);
      console.log(`  Reason: ${state.reason}`);
      console.log(`  Updated By: ${state.updatedBy}`);
      console.log(`  Confidence: ${(state.confidence * 100).toFixed(0)}%`);
      console.log(`  Last Updated: ${state.lastUpdated}`);
      console.log('');
    }
  }

  // Test state transition
  console.log('=== Testing State Transition ===\n');

  const oldProjectState = stateService.getStateByCategory('project');
  console.log(`Previous project state: ${oldProjectState.currentState}`);

  const newProjectState = stateService.setState({
    category: 'project',
    currentState: 'construction',
    reason: 'Project moved to construction phase',
    evidence: [
      { type: 'milestone', id: 'M-001', description: 'Construction kickoff' },
      { type: 'contract', id: 'C-001', description: 'Contract signed' }
    ],
    updatedBy: 'project-manager',
    confidence: 1.0
  });

  console.log(`New project state: ${newProjectState.currentState}`);
  console.log(`Transition reason: ${newProjectState.reason}`);
  console.log(`Evidence count: ${newProjectState.evidence.length}`);
  console.log(`History entries: ${newProjectState.history.length}`);

  // Test state transitions
  console.log('\nState History:');
  for (const entry of newProjectState.history) {
    console.log(`  ${entry.from} → ${entry.to}`);
    console.log(`    Reason: ${entry.reason}`);
    console.log(`    Updated By: ${entry.updatedBy}`);
    console.log(`    Timestamp: ${entry.timestamp}`);
  }

  // Test activation state transition
  console.log('\n=== Testing Activation State Transition ===\n');

  const oldActivationState = stateService.getStateByCategory('activation');
  console.log(`Previous activation state: ${oldActivationState.currentState}`);

  const newActivationState = stateService.setState({
    category: 'activation',
    currentState: 'ready',
    reason: 'All blockers resolved, activation ready',
    evidence: [
      { type: 'inspection', id: 'INS-0042', description: 'Final inspection passed' },
      { type: 'deficiency', id: 'DEF-0012', description: 'All deficiencies resolved' }
    ],
    updatedBy: 'commissioning-agent',
    confidence: 0.95
  });

  console.log(`New activation state: ${newActivationState.currentState}`);
  console.log(`Transition reason: ${newActivationState.reason}`);
  console.log(`Evidence count: ${newActivationState.evidence.length}`);

  // Test scoped state (building-specific)
  console.log('\n=== Testing Scoped State ===\n');

  const building61InspectionState = stateService.setState({
    category: 'inspection',
    currentState: 'complete',
    reason: 'Building 61 inspection complete',
    evidence: [
      { type: 'inspection', id: 'INS-B61-001', description: 'Building 61 final inspection' }
    ],
    updatedBy: 'inspector',
    confidence: 1.0,
    scope: 'building-61'
  });

  console.log(`Building 61 inspection state: ${building61InspectionState.currentState}`);
  console.log(`Scope: ${building61InspectionState.scope}`);

  // Get scoped state
  const retrievedScopedState = stateService.getStateByCategory('inspection', 'building-61');
  console.log(`Retrieved scoped state: ${retrievedScopedState.currentState}`);

  // Test stale state detection
  console.log('\n=== Testing Stale State Detection ===\n');

  // Simulate a stale state by manually setting lastUpdated
  const staleState = stateService.setState({
    category: 'qa',
    currentState: 'inactive',
    reason: 'Testing stale state detection',
    evidence: [],
    updatedBy: 'system',
    confidence: 1.0
  });

  // Manually set lastUpdated to a very old date
  staleState.lastUpdated = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  stateService.states.set(staleState.stateId, staleState);

  const staleStates = stateService.getStaleStates(24);
  console.log(`Stale states (24h threshold): ${staleStates.length}`);
  for (const stale of staleStates) {
    console.log(`  ${stale.stateId}: ${stale.currentState} (${stale.hoursSinceUpdate.toFixed(1)} hours since update)`);
  }

  // Test missing evidence detection
  console.log('\n=== Testing Missing Evidence Detection ===\n');

  const statesWithoutEvidence = stateService.getStatesWithMissingEvidence();
  console.log(`States without evidence: ${statesWithoutEvidence.length}`);
  for (const state of statesWithoutEvidence) {
    console.log(`  ${state.stateId}: ${state.currentState} - ${state.reason}`);
  }

  // Test conflicting states
  console.log('\n=== Testing Conflicting States ===\n');

  // Create a conflicting state
  const conflictingState = stateService.setState({
    category: 'project',
    currentState: 'design',
    reason: 'Conflicting state for testing',
    evidence: [],
    updatedBy: 'test',
    confidence: 0.5,
    scope: 'test-conflict'
  });

  const conflicts = stateService.getConflictingStates();
  console.log(`Conflicting states: ${conflicts.length}`);
  for (const conflict of conflicts) {
    console.log(`  ${conflict.category}: ${conflict.conflictingStates.join(', ')} - ${conflict.reason}`);
  }

  // Generate diagnostics
  console.log('\n=== State Service Diagnostics ===\n');

  const diagnostics = stateService.generateDiagnostics();

  console.log(`Total States: ${diagnostics.totalStates}`);
  console.log(`Current Phase: ${diagnostics.currentPhase}`);
  console.log(`State Transitions: ${diagnostics.stateTransitions.length}`);
  console.log(`Stale States: ${diagnostics.staleStates}`);
  console.log(`Missing Evidence: ${diagnostics.missingEvidence}`);
  console.log(`Conflicting States: ${diagnostics.conflictingStates}`);
  console.log(`State History Size: ${diagnostics.stateHistorySize}`);

  // Export state
  console.log('\n=== State Export ===\n');

  const exportedState = stateService.exportState();
  console.log(`Exported ${exportedState.states.length} states`);
  console.log(`Exported at: ${exportedState.exportedAt}`);

  // Test import
  console.log('\n=== Testing State Import ===\n');

  const importedService = new ProjectStateService();
  importedService.importState(exportedState);

  console.log(`Imported ${importedService.states.size} states`);
  console.log(`Imported project state: ${importedService.getStateByCategory('project').currentState}`);

  console.log('\n=== Project State Service Test Complete ===');
}

testProjectStateService().catch(console.error);
