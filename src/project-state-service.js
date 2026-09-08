class ProjectStateService {
  constructor() {
    this.states = new Map(); // stateId -> State
    this.stateCategories = new Set([
      'project',
      'schedule',
      'shutdown',
      'activation',
      'turnover',
      'commissioning',
      'inspection',
      'qa',
      'deficiency',
      'rfi',
      'submittal',
      'risk',
      'weather',
      'utility',
      'oit',
      'safety'
    ]);
  }

  /**
   * Generate a state ID
   */
  generateStateId(category, scope = '') {
    const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, '');
    const normalizedScope = scope.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `STATE:${normalizedCategory}:${normalizedScope}`;
  }

  /**
   * Create or update a state
   */
  setState(state) {
    const {
      category,
      currentState,
      reason,
      evidence,
      effectiveDate,
      updatedBy,
      confidence,
      scope = ''
    } = state;

    if (!this.stateCategories.has(category)) {
      throw new Error(`Invalid state category: ${category}`);
    }

    const stateId = this.generateStateId(category, scope);
    const existingState = this.states.get(stateId);

    const newHistoryEntry = {
      from: existingState ? existingState.currentState : null,
      to: currentState,
      reason,
      evidence,
      updatedBy,
      timestamp: new Date().toISOString()
    };

    const newState = {
      stateId,
      category,
      scope,
      currentState,
      previousState: existingState ? existingState.currentState : null,
      reason,
      evidence: evidence || [],
      effectiveDate: effectiveDate || new Date().toISOString(),
      updatedBy: updatedBy || 'system',
      confidence: confidence !== undefined ? confidence : 1.0,
      history: existingState ? [...existingState.history, newHistoryEntry] : [newHistoryEntry],
      lastUpdated: new Date().toISOString()
    };

    this.states.set(stateId, newState);

    return newState;
  }

  /**
   * Get a state by ID
   */
  getState(stateId) {
    return this.states.get(stateId);
  }

  /**
   * Get state by category and scope
   */
  getStateByCategory(category, scope = '') {
    const stateId = this.generateStateId(category, scope);
    return this.states.get(stateId);
  }

  /**
   * Get all states in a category
   */
  getStatesByCategory(category) {
    const states = [];
    
    for (const [stateId, state] of this.states) {
      if (state.category === category) {
        states.push(state);
      }
    }
    
    return states;
  }

  /**
   * Get all states
   */
  getAllStates() {
    return Array.from(this.states.values());
  }

  /**
   * Get current project phase
   */
  getCurrentPhase() {
    const projectState = this.getStateByCategory('project');
    return projectState ? projectState.currentState : 'unknown';
  }

  /**
   * Get state transitions for a state
   */
  getStateTransitions(stateId) {
    const state = this.states.get(stateId);
    return state ? state.history : [];
  }

  /**
   * Get stale states (states not updated recently)
   */
  getStaleStates(staleThresholdHours = 24) {
    const staleStates = [];
    const threshold = new Date(Date.now() - staleThresholdHours * 60 * 60 * 1000);
    
    for (const [stateId, state] of this.states) {
      const lastUpdated = new Date(state.lastUpdated);
      if (lastUpdated < threshold) {
        staleStates.push({
          stateId,
          category: state.category,
          currentState: state.currentState,
          lastUpdated: state.lastUpdated,
          hoursSinceUpdate: (Date.now() - lastUpdated.getTime()) / (60 * 60 * 1000)
        });
      }
    }
    
    return staleStates;
  }

  /**
   * Get states with missing evidence
   */
  getStatesWithMissingEvidence() {
    const statesWithoutEvidence = [];
    
    for (const [stateId, state] of this.states) {
      if (!state.evidence || state.evidence.length === 0) {
        statesWithoutEvidence.push({
          stateId,
          category: state.category,
          currentState: state.currentState,
          reason: 'No supporting evidence'
        });
      }
    }
    
    return statesWithoutEvidence;
  }

  /**
   * Get conflicting states
   */
  getConflictingStates() {
    const conflicts = [];
    
    // Find states in same category with different values
    const statesByCategory = new Map();
    
    for (const [stateId, state] of this.states) {
      if (!statesByCategory.has(state.category)) {
        statesByCategory.set(state.category, []);
      }
      statesByCategory.get(state.category).push(state);
    }
    
    for (const [category, states] of statesByCategory) {
      if (states.length > 1) {
        // Check for conflicting current states
        const uniqueStates = new Set(states.map(s => s.currentState));
        if (uniqueStates.size > 1) {
          conflicts.push({
            category,
            conflictingStates: Array.from(uniqueStates),
            count: states.length,
            reason: 'Multiple states with different values in same category'
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Get state history
   */
  getStateHistory(stateId) {
    const state = this.states.get(stateId);
    return state ? state.history : [];
  }

  /**
   * Get complete project state
   */
  getProjectState() {
    const projectState = {
      project: this.getStateByCategory('project'),
      schedule: this.getStateByCategory('schedule'),
      shutdown: this.getStateByCategory('shutdown'),
      activation: this.getStateByCategory('activation'),
      turnover: this.getStateByCategory('turnover'),
      commissioning: this.getStateByCategory('commissioning'),
      inspection: this.getStateByCategory('inspection'),
      qa: this.getStateByCategory('qa'),
      deficiency: this.getStateByCategory('deficiency'),
      rfi: this.getStateByCategory('rfi'),
      submittal: this.getStateByCategory('submittal'),
      risk: this.getStateByCategory('risk'),
      weather: this.getStateByCategory('weather'),
      utility: this.getStateByCategory('utility'),
      oit: this.getStateByCategory('oit'),
      safety: this.getStateByCategory('safety'),
      lastUpdated: new Date().toISOString()
    };
    
    return projectState;
  }

  /**
   * Initialize default states
   */
  initializeDefaultStates() {
    const defaultStates = [
      {
        category: 'project',
        currentState: 'planning',
        reason: 'Initial project state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'schedule',
        currentState: 'on-track',
        reason: 'Initial schedule state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'shutdown',
        currentState: 'none',
        reason: 'No shutdown scheduled',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'activation',
        currentState: 'not-ready',
        reason: 'Initial activation state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'turnover',
        currentState: 'not-ready',
        reason: 'Initial turnover state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'commissioning',
        currentState: 'not-started',
        reason: 'Initial commissioning state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'inspection',
        currentState: 'in-progress',
        reason: 'Initial inspection state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'qa',
        currentState: 'active',
        reason: 'Initial QA state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'deficiency',
        currentState: 'open',
        reason: 'Initial deficiency state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'rfi',
        currentState: 'none',
        reason: 'No open RFIs',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'submittal',
        currentState: 'pending',
        reason: 'Initial submittal state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'risk',
        currentState: 'low',
        reason: 'Initial risk state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'weather',
        currentState: 'normal',
        reason: 'Normal weather conditions',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'utility',
        currentState: 'available',
        reason: 'Utilities available',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'oit',
        currentState: 'not-ready',
        reason: 'Initial OIT state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      },
      {
        category: 'safety',
        currentState: 'compliant',
        reason: 'Initial safety state',
        evidence: [],
        updatedBy: 'system',
        confidence: 1.0
      }
    ];
    
    for (const defaultState of defaultStates) {
      this.setState(defaultState);
    }
  }

  /**
   * Export state
   */
  exportState() {
    return {
      states: Array.from(this.states.entries()),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import state
   */
  importState(stateData) {
    this.states = new Map(stateData.states);
  }

  /**
   * Generate diagnostics
   */
  generateDiagnostics() {
    const stateTransitions = [];
    
    for (const [stateId, state] of this.states) {
      stateTransitions.push({
        stateId,
        category: state.category,
        transitionCount: state.history.length
      });
    }
    
    const staleStates = this.getStaleStates(24);
    const statesWithoutEvidence = this.getStatesWithMissingEvidence();
    const conflictingStates = this.getConflictingStates();
    
    return {
      totalStates: this.states.size,
      currentPhase: this.getCurrentPhase(),
      stateTransitions: stateTransitions,
      staleStates: staleStates.length,
      staleStateDetails: staleStates,
      missingEvidence: statesWithoutEvidence.length,
      missingEvidenceDetails: statesWithoutEvidence,
      conflictingStates: conflictingStates.length,
      conflictingStateDetails: conflictingStates,
      stateHistorySize: stateTransitions.reduce((sum, t) => sum + t.transitionCount, 0)
    };
  }
}

export { ProjectStateService };
