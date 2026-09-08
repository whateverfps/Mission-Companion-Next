import { createConstructionGraph } from './construction-graph.js';

class ProjectOrchestrationEngine {
  constructor() {
    this.constructionGraph = null;
    this.factEngine = null;
    this.relationshipEngine = null;
    this.reasoningEngine = null;
    this.missionEngine = null;
    this.dependencyGraph = new Map(); // actionId -> { action, dependencies, dependents }
    this.operationalTimeline = {
      past: [],
      current: [],
      next: [],
      blocked: [],
      waiting: [],
      completed: []
    };
    this.projectHealth = {};
  }

  initialize(constructionGraph, factEngine, relationshipEngine, reasoningEngine, missionEngine) {
    this.constructionGraph = constructionGraph;
    this.factEngine = factEngine;
    this.relationshipEngine = relationshipEngine;
    this.reasoningEngine = reasoningEngine;
    this.missionEngine = missionEngine;
  }

  /**
   * Evaluate project readiness continuously
   */
  evaluateProjectReadiness() {
    const evaluation = {
      timestamp: new Date().toISOString(),
      blockedWorkflows: this.detectBlockedWorkflows(),
      prerequisiteTasks: this.detectPrerequisiteTasks(),
      missingInspections: this.detectMissingInspections(),
      missingEvidence: this.detectMissingEvidence(),
      specificationComplianceGaps: this.detectSpecificationComplianceGaps(),
      scheduleImpacts: this.detectScheduleImpacts(),
      turnoverBlockers: this.detectTurnoverBlockers(),
      activationBlockers: this.detectActivationBlockers()
    };

    return evaluation;
  }

  /**
   * Detect blocked workflows
   */
  detectBlockedWorkflows() {
    const blocked = [];
    
    // Find relationships with conflicts
    for (const conflict of this.relationshipEngine.conflicts) {
      blocked.push({
        type: 'conflict',
        sourceId: conflict.relationship.sourceId,
        relationshipType: conflict.relationship.type,
        competingTargets: conflict.competingTargets,
        blocks: 'workflow-resolution',
        reason: 'Conflicting relationship prevents workflow execution'
      });
    }
    
    // Find facts in conflicted state
    const conflictedFacts = this.factEngine.getFactsByLifecycleState('conflicted');
    for (const fact of conflictedFacts) {
      blocked.push({
        type: 'conflicted-fact',
        factId: fact.factId,
        statement: `${fact.subjectId} ${fact.predicate} ${fact.objectId}`,
        blocks: 'fact-resolution',
        reason: 'Conflicting fact requires manual resolution'
      });
    }
    
    return blocked;
  }

  /**
   * Detect prerequisite tasks
   */
  detectPrerequisiteTasks() {
    const prerequisites = [];
    
    // Find objects that depend on incomplete tasks
    const constructionObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    });
    
    for (const object of constructionObjects) {
      // Check if object has missing submittals
      const submittalRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'covered-by-submittal', 'outgoing'
      );
      
      if (submittalRelationships.length === 0) {
        prerequisites.push({
          type: 'missing-submittal',
          objectId: object.nodeId,
          objectLabel: object.label,
          prerequisite: 'submittal-approval',
          blocks: 'inspection-start',
          reason: 'Submittal approval required before inspection'
        });
      }
      
      // Check if object has pending inspections
      const inspectionRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'inspected-by', 'outgoing'
      );
      
      const pendingInspections = inspectionRelationships.filter(r => {
        const inspectionNode = this.constructionGraph.getNode(r.targetId);
        return inspectionNode && inspectionNode.metadata?.status !== 'complete';
      });
      
      if (pendingInspections.length > 0) {
        prerequisites.push({
          type: 'pending-inspection',
          objectId: object.nodeId,
          objectLabel: object.label,
          prerequisite: 'inspection-completion',
          blocks: 'acceptance',
          reason: `${pendingInspections.length} pending inspections`
        });
      }
    }
    
    return prerequisites;
  }

  /**
   * Detect missing inspections
   */
  detectMissingInspections() {
    const missing = [];
    
    const constructionObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    });
    
    for (const object of constructionObjects) {
      // Get governing specifications
      const specRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'governed-by', 'outgoing'
      );
      
      // Check if specification requires inspection
      for (const specRel of specRelationships) {
        const specNode = this.constructionGraph.getNode(specRel.targetId);
        if (specNode && (specNode.label?.toLowerCase().includes('inspection') || 
                          specNode.label?.toLowerCase().includes('test'))) {
          // Check if inspection exists
          const inspectionRelationships = this.relationshipEngine.getRelationshipsByType(
            object.nodeId, 'inspected-by', 'outgoing'
          );
          
          if (inspectionRelationships.length === 0) {
            missing.push({
              type: 'missing-inspection',
              objectId: object.nodeId,
              objectLabel: object.label,
              specificationId: specNode.nodeId,
              specificationLabel: specNode.label,
              reason: 'Specification requires inspection'
            });
          }
        }
      }
    }
    
    return missing;
  }

  /**
   * Detect missing evidence
   */
  detectMissingEvidence() {
    const missing = [];
    
    const constructionObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    });
    
    for (const object of constructionObjects) {
      const evidence = [];
      
      // Check for drawings
      const drawingRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'appears-on', 'outgoing'
      );
      if (drawingRelationships.length === 0) {
        evidence.push('drawing');
      }
      
      // Check for specifications
      const specRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'governed-by', 'outgoing'
      );
      if (specRelationships.length === 0) {
        evidence.push('specification');
      }
      
      // Check for inspections
      const inspectionRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'inspected-by', 'outgoing'
      );
      if (inspectionRelationships.length === 0) {
        evidence.push('inspection');
      }
      
      if (evidence.length > 0) {
        missing.push({
          type: 'missing-evidence',
          objectId: object.nodeId,
          objectLabel: object.label,
          missingEvidence: evidence,
          reason: `Missing ${evidence.join(', ')}`
        });
      }
    }
    
    return missing;
  }

  /**
   * Detect specification compliance gaps
   */
  detectSpecificationComplianceGaps() {
    const gaps = [];
    
    const constructionObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    });
    
    for (const object of constructionObjects) {
      // Get governing specifications
      const specRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'governed-by', 'outgoing'
      );
      
      for (const specRel of specRelationships) {
        const specNode = this.constructionGraph.getNode(specRel.targetId);
        if (!specNode) continue;
        
        // Check if object has deficiencies
        const deficiencyRelationships = this.relationshipEngine.getRelationshipsByType(
          object.nodeId, 'has-deficiency', 'outgoing'
        );
        
        if (deficiencyRelationships.length > 0) {
          gaps.push({
            type: 'compliance-gap',
            objectId: object.nodeId,
            objectLabel: object.label,
            specificationId: specNode.nodeId,
            specificationLabel: specNode.label,
            deficiencyCount: deficiencyRelationships.length,
            reason: 'Object has deficiencies against specification'
          });
        }
      }
    }
    
    return gaps;
  }

  /**
   * Detect schedule impacts
   */
  detectScheduleImpacts() {
    const impacts = [];
    
    // This would integrate with a schedule system
    // For now, detect deficiencies that could impact schedule
    const openDeficiencies = [];
    
    for (const [factId, fact] of this.factEngine.facts) {
      if (fact.predicate === 'has-deficiency' && fact.lifecycleState !== 'retired') {
        const deficiencyNode = this.constructionGraph.getNode(fact.objectId);
        if (deficiencyNode && deficiencyNode.metadata?.status !== 'resolved') {
          openDeficiencies.push({
            factId,
            objectId: fact.subjectId,
            deficiencyId: fact.objectId
          });
        }
      }
    }
    
    if (openDeficiencies.length > 5) {
      impacts.push({
        type: 'schedule-impact',
        severity: 'high',
        deficiencyCount: openDeficiencies.length,
        reason: 'High deficiency backlog may impact schedule'
      });
    }
    
    return impacts;
  }

  /**
   * Detect turnover blockers
   */
  detectTurnoverBlockers() {
    const blockers = [];
    
    const rooms = this.constructionGraph.findNodes({
      nodeTypes: ['room']
    });
    
    for (const room of rooms) {
      // Check for deficiencies
      const deficiencyRelationships = this.relationshipEngine.getRelationshipsByType(
        room.nodeId, 'has-deficiency', 'outgoing'
      );
      
      if (deficiencyRelationships.length > 0) {
        blockers.push({
          type: 'deficiency-blocker',
          roomId: room.nodeId,
          roomLabel: room.label,
          deficiencyCount: deficiencyRelationships.length,
          blocks: 'turnover',
          reason: 'Room has open deficiencies'
        });
      }
      
      // Check for pending inspections
      const inspectionRelationships = this.relationshipEngine.getRelationshipsByType(
        room.nodeId, 'inspected-by', 'outgoing'
      );
      
      const pendingInspections = inspectionRelationships.filter(r => {
        const inspectionNode = this.constructionGraph.getNode(r.targetId);
        return inspectionNode && inspectionNode.metadata?.status !== 'complete';
      });
      
      if (pendingInspections.length > 0) {
        blockers.push({
          type: 'inspection-blocker',
          roomId: room.nodeId,
          roomLabel: room.label,
          inspectionCount: pendingInspections.length,
          blocks: 'turnover',
          reason: 'Room has pending inspections'
        });
      }
    }
    
    return blockers;
  }

  /**
   * Detect activation blockers
   */
  detectActivationBlockers() {
    const blockers = [];
    
    const constructionObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    });
    
    for (const object of constructionObjects) {
      // Check for deficiencies
      const deficiencyRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'has-deficiency', 'outgoing'
      );
      
      if (deficiencyRelationships.length > 0) {
        blockers.push({
          type: 'deficiency-blocker',
          objectId: object.nodeId,
          objectLabel: object.label,
          deficiencyCount: deficiencyRelationships.length,
          blocks: 'activation',
          reason: 'Object has open deficiencies'
        });
      }
      
      // Check for commissioning
      const commissioningRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'commissioned-by', 'outgoing'
      );
      
      const pendingCommissioning = commissioningRelationships.filter(r => {
        const commissioningNode = this.constructionGraph.getNode(r.targetId);
        return commissioningNode && commissioningNode.metadata?.status !== 'complete';
      });
      
      if (pendingCommissioning.length > 0) {
        blockers.push({
          type: 'commissioning-blocker',
          objectId: object.nodeId,
          objectLabel: object.label,
          commissioningCount: pendingCommissioning.length,
          blocks: 'activation',
          reason: 'Object has pending commissioning'
        });
      }
    }
    
    return blockers;
  }

  /**
   * Build dependency graph
   */
  buildDependencyGraph() {
    this.dependencyGraph.clear();
    
    // Define standard dependency chains
    const dependencyChains = [
      {
        action: 'install',
        dependsOn: [],
        blocks: ['firestopping', 'inspection']
      },
      {
        action: 'firestopping',
        dependsOn: ['install'],
        blocks: ['inspection']
      },
      {
        action: 'inspection',
        dependsOn: ['install', 'firestopping'],
        blocks: ['punch-resolution', 'acceptance']
      },
      {
        action: 'punch-resolution',
        dependsOn: ['inspection'],
        blocks: ['acceptance']
      },
      {
        action: 'acceptance',
        dependsOn: ['inspection', 'punch-resolution'],
        blocks: ['activation', 'turnover']
      },
      {
        action: 'activation',
        dependsOn: ['acceptance'],
        blocks: ['turnover']
      },
      {
        action: 'turnover',
        dependsOn: ['acceptance', 'activation'],
        blocks: []
      }
    ];
    
    // Build graph from chains
    for (const chain of dependencyChains) {
      const actionId = chain.action;
      
      this.dependencyGraph.set(actionId, {
        action: chain.action,
        dependencies: chain.dependsOn,
        dependents: chain.blocks
      });
    }
    
    return this.dependencyGraph;
  }

  /**
   * Identify critical path
   */
  identifyCriticalPath() {
    const criticalPath = [];
    
    // Start from turnover and work backwards
    let currentAction = 'turnover';
    
    while (currentAction) {
      criticalPath.unshift(currentAction);
      
      const actionNode = this.dependencyGraph.get(currentAction);
      if (!actionNode || actionNode.dependencies.length === 0) {
        break;
      }
      
      // Move to first dependency
      currentAction = actionNode.dependencies[0];
    }
    
    return criticalPath;
  }

  /**
   * Dynamically prioritize actions
   */
  dynamicallyPrioritizeActions() {
    const prioritized = [];
    
    const evaluation = this.evaluateProjectReadiness();
    
    // Priority factors
    const priorityFactors = {
      openDeficiencies: evaluation.specificationComplianceGaps.length,
      criticalPathImpact: this.isCriticalPathImpacted(evaluation),
      safetyRisk: this.detectSafetyRisk(evaluation),
      activationReadiness: evaluation.activationBlockers.length,
      shutdownWindows: 0, // Would be detected from schedule
      upcomingInspections: evaluation.missingInspections.length,
      pendingRFIs: 0, // Would be detected from RFI system
      missingSubmittals: evaluation.prerequisiteTasks.filter(t => t.type === 'missing-submittal').length,
      ownerRequests: 0, // Would be detected from owner communication
      contractMilestones: 0 // Would be detected from schedule
    };
    
    // Calculate priority score
    for (const [factor, value] of Object.entries(priorityFactors)) {
      if (value > 0) {
        prioritized.push({
          factor,
          value,
          priority: this.calculatePriorityScore(factor, value),
          reason: this.getPriorityReason(factor, value)
        });
      }
    }
    
    // Sort by priority score
    prioritized.sort((a, b) => b.priority - a.priority);
    
    return prioritized;
  }

  /**
   * Check if critical path is impacted
   */
  isCriticalPathImpacted(evaluation) {
    const criticalPath = this.identifyCriticalPath();
    
    // Check if any blocked workflows are on critical path
    for (const blocked of evaluation.blockedWorkflows) {
      if (criticalPath.includes(blocked.blocks)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Detect safety risk
   */
  detectSafetyRisk(evaluation) {
    // Check for safety-related blockers
    const safetyBlockers = evaluation.turnoverBlockers.filter(b => 
      b.reason?.toLowerCase().includes('safety') || 
      b.reason?.toLowerCase().includes('fire')
    );
    
    return safetyBlockers.length > 0;
  }

  /**
   * Calculate priority score
   */
  calculatePriorityScore(factor, value) {
    const weights = {
      openDeficiencies: 0.9,
      criticalPathImpact: 1.0,
      safetyRisk: 1.0,
      activationReadiness: 0.8,
      shutdownWindows: 0.7,
      upcomingInspections: 0.6,
      pendingRFIs: 0.5,
      missingSubmittals: 0.4,
      ownerRequests: 0.8,
      contractMilestones: 0.9
    };
    
    const weight = weights[factor] || 0.5;
    return Math.min(1.0, weight * (value / 10));
  }

  /**
   * Get priority reason
   */
  getPriorityReason(factor, value) {
    const reasons = {
      openDeficiencies: `${value} open deficiencies blocking progress`,
      criticalPathImpact: 'Critical path impacted by blockers',
      safetyRisk: 'Safety risk detected',
      activationReadiness: `${value} activation blockers`,
      shutdownWindows: 'Upcoming shutdown window',
      upcomingInspections: `${value} missing inspections`,
      pendingRFIs: 'Pending RFIs require resolution',
      missingSubmittals: `${value} missing submittals`,
      ownerRequests: 'Owner requests pending',
      contractMilestones: 'Contract milestone approaching'
    };
    
    return reasons[factor] || 'General priority factor';
  }

  /**
   * Calculate project health scores
   */
  calculateProjectHealth() {
    const evaluation = this.evaluateProjectReadiness();
    
    const scores = {
      constructionProgress: this.calculateConstructionProgress(evaluation),
      inspectionReadiness: this.calculateInspectionReadiness(evaluation),
      specificationCompliance: this.calculateSpecificationCompliance(evaluation),
      documentationCompleteness: this.calculateDocumentationCompleteness(evaluation),
      evidenceCompleteness: this.calculateEvidenceCompleteness(evaluation),
      commissioningReadiness: this.calculateCommissioningReadiness(evaluation),
      activationReadiness: this.calculateActivationReadiness(evaluation),
      turnoverReadiness: this.calculateTurnoverReadiness(evaluation)
    };
    
    // Calculate overall health
    const overallHealth = Object.values(scores).reduce((sum, score) => sum + score.value, 0) / Object.keys(scores).length;
    
    scores.overall = {
      value: overallHealth,
      explanation: `Overall project health based on ${Object.keys(scores).length} factors`
    };
    
    this.projectHealth = scores;
    
    return scores;
  }

  /**
   * Calculate construction progress
   */
  calculateConstructionProgress(evaluation) {
    const totalObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    }).length;
    
    const completedObjects = 0; // Would be determined from actual progress data
    
    const progress = totalObjects > 0 ? completedObjects / totalObjects : 0;
    
    return {
      value: progress,
      explanation: `${completedObjects}/${totalObjects} objects completed (${(progress * 100).toFixed(0)}%)`
    };
  }

  /**
   * Calculate inspection readiness
   */
  calculateInspectionReadiness(evaluation) {
    const totalObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    }).length;
    
    const missingInspections = evaluation.missingInspections.length;
    const readiness = totalObjects > 0 ? 1 - (missingInspections / totalObjects) : 0;
    
    return {
      value: readiness,
      explanation: `${missingInspections} missing inspections out of ${totalObjects} objects (${(readiness * 100).toFixed(0)}% ready)`
    };
  }

  /**
   * Calculate specification compliance
   */
  calculateSpecificationCompliance(evaluation) {
    const totalObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    }).length;
    
    const complianceGaps = evaluation.specificationComplianceGaps.length;
    const compliance = totalObjects > 0 ? 1 - (complianceGaps / totalObjects) : 0;
    
    return {
      value: compliance,
      explanation: `${complianceGaps} compliance gaps out of ${totalObjects} objects (${(compliance * 100).toFixed(0)}% compliant)`
    };
  }

  /**
   * Calculate documentation completeness
   */
  calculateDocumentationCompleteness(evaluation) {
    const totalObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    }).length;
    
    const objectsWithoutDrawings = evaluation.missingEvidence.filter(m => 
      m.missingEvidence.includes('drawing')
    ).length;
    
    const completeness = totalObjects > 0 ? 1 - (objectsWithoutDrawings / totalObjects) : 0;
    
    return {
      value: completeness,
      explanation: `${objectsWithoutDrawings} objects without drawings out of ${totalObjects} (${(completeness * 100).toFixed(0)}% complete)`
    };
  }

  /**
   * Calculate evidence completeness
   */
  calculateEvidenceCompleteness(evaluation) {
    const totalObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    }).length;
    
    const objectsMissingEvidence = evaluation.missingEvidence.length;
    const completeness = totalObjects > 0 ? 1 - (objectsMissingEvidence / totalObjects) : 0;
    
    return {
      value: completeness,
      explanation: `${objectsMissingEvidence} objects missing evidence out of ${totalObjects} (${(completeness * 100).toFixed(0)}% complete)`
    };
  }

  /**
   * Calculate commissioning readiness
   */
  calculateCommissioningReadiness(evaluation) {
    const totalObjects = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object']
    }).length;
    
    const pendingCommissioning = evaluation.activationBlockers.filter(b => 
      b.type === 'commissioning-blocker'
    ).length;
    
    const readiness = totalObjects > 0 ? 1 - (pendingCommissioning / totalObjects) : 0;
    
    return {
      value: readiness,
      explanation: `${pendingCommissioning} pending commissioning out of ${totalObjects} objects (${(readiness * 100).toFixed(0)}% ready)`
    };
  }

  /**
   * Calculate activation readiness
   */
  calculateActivationReadiness(evaluation) {
    const blockers = evaluation.activationBlockers.length;
    const readiness = blockers === 0 ? 1.0 : Math.max(0, 1 - (blockers / 10));
    
    return {
      value: readiness,
      explanation: `${blockers} activation blockers (${(readiness * 100).toFixed(0)}% ready)`
    };
  }

  /**
   * Calculate turnover readiness
   */
  calculateTurnoverReadiness(evaluation) {
    const blockers = evaluation.turnoverBlockers.length;
    const readiness = blockers === 0 ? 1.0 : Math.max(0, 1 - (blockers / 10));
    
    return {
      value: readiness,
      explanation: `${blockers} turnover blockers (${(readiness * 100).toFixed(0)}% ready)`
    };
  }

  /**
   * Generate recommended next actions
   */
  generateRecommendedNextActions() {
    const actions = [];
    const evaluation = this.evaluateProjectReadiness();
    const prioritizedFactors = this.dynamicallyPrioritizeActions();
    
    let actionIdCounter = 1;
    
    // Generate actions based on highest priority factors
    for (const factor of prioritizedFactors.slice(0, 5)) {
      const action = this.createActionFromFactor(factor, actionIdCounter++);
      if (action) {
        actions.push(action);
      }
    }
    
    return actions;
  }

  /**
   * Create action from priority factor
   */
  createActionFromFactor(factor, actionId) {
    const actionMap = {
      openDeficiencies: {
        title: 'Resolve Deficiencies',
        description: factor.reason,
        priority: 'high',
        assignedRole: 'contractor',
        dueCondition: 'before-inspection'
      },
      criticalPathImpact: {
        title: 'Address Critical Path Blockers',
        description: factor.reason,
        priority: 'critical',
        assignedRole: 'project-manager',
        dueCondition: 'immediate'
      },
      safetyRisk: {
        title: 'Address Safety Risks',
        description: factor.reason,
        priority: 'critical',
        assignedRole: 'safety-manager',
        dueCondition: 'immediate'
      },
      activationReadiness: {
        title: 'Resolve Activation Blockers',
        description: factor.reason,
        priority: 'high',
        assignedRole: 'commissioning-agent',
        dueCondition: 'before-activation'
      },
      upcomingInspections: {
        title: 'Complete Missing Inspections',
        description: factor.reason,
        priority: 'medium',
        assignedRole: 'inspector',
        dueCondition: 'before-turnover'
      },
      missingSubmittals: {
        title: 'Submit Required Submittals',
        description: factor.reason,
        priority: 'medium',
        assignedRole: 'contractor',
        dueCondition: 'before-approval'
      }
    };
    
    const actionTemplate = actionMap[factor.factor];
    if (!actionTemplate) return null;
    
    return {
      actionId: `ACTION-${actionId}`,
      ...actionTemplate,
      building: null,
      floor: null,
      room: null,
      relatedEntities: [],
      governingFacts: [],
      governingSpecifications: [],
      governingDrawings: [],
      requiredEvidence: [],
      dependencies: [],
      blockers: [],
      estimatedDuration: 60,
      confidence: factor.priority,
      status: 'pending'
    };
  }

  /**
   * Update operational timeline
   */
  updateOperationalTimeline() {
    const evaluation = this.evaluateProjectReadiness();
    
    // Categorize activities based on current state
    this.operationalTimeline.past = [];
    this.operationalTimeline.current = [];
    this.operationalTimeline.next = [];
    this.operationalTimeline.blocked = [];
    this.operationalTimeline.waiting = [];
    this.operationalTimeline.completed = [];
    
    // Blocked activities
    for (const blocked of evaluation.blockedWorkflows) {
      this.operationalTimeline.blocked.push({
        type: blocked.type,
        description: blocked.reason,
        sourceId: blocked.sourceId
      });
    }
    
    // Activities waiting on prerequisites
    for (const prerequisite of evaluation.prerequisiteTasks) {
      this.operationalTimeline.waiting.push({
        type: prerequisite.type,
        description: prerequisite.reason,
        objectId: prerequisite.objectId
      });
    }
    
    return this.operationalTimeline;
  }

  /**
   * Generate operational dashboard
   */
  generateOperationalDashboard() {
    const startTime = performance.now();
    
    // Build dependency graph
    this.buildDependencyGraph();
    
    // Evaluate project readiness
    const evaluation = this.evaluateProjectReadiness();
    
    // Calculate project health
    const projectHealth = this.calculateProjectHealth();
    
    // Identify critical path
    const criticalPath = this.identifyCriticalPath();
    
    // Generate recommended next actions
    const recommendedNextActions = this.generateRecommendedNextActions();
    
    // Update operational timeline
    const operationalTimeline = this.updateOperationalTimeline();
    
    // Identify blocked activities
    const blockedActivities = evaluation.blockedWorkflows;
    
    // Identify upcoming dependencies
    const upcomingDependencies = evaluation.prerequisiteTasks;
    
    // Identify highest risk items
    const highestRiskItems = evaluation.turnoverBlockers.concat(evaluation.activationBlockers);
    
    // Get readiness scores
    const readinessScores = projectHealth;
    
    // Generate explanation
    const explanation = this.generateExplanation(evaluation, projectHealth, criticalPath);
    
    const dashboard = {
      projectHealth,
      activeMissions: [],
      criticalPath,
      recommendedNextActions,
      blockedActivities,
      upcomingDependencies,
      highestRiskItems,
      readinessScores,
      operationalTimeline,
      explanation,
      diagnostics: {
        generationTime: performance.now() - startTime,
        evaluationResults: evaluation,
        dependencyGraphSize: this.dependencyGraph.size
      }
    };
    
    return dashboard;
  }

  /**
   * Generate explanation for dashboard
   */
  generateExplanation(evaluation, projectHealth, criticalPath) {
    const explanation = {
      summary: '',
      keyFindings: [],
      recommendations: []
    };
    
    const blockedCount = evaluation.blockedWorkflows.length;
    const blockerCount = evaluation.turnoverBlockers.length + evaluation.activationBlockers.length;
    const missingInspectionCount = evaluation.missingInspections.length;
    
    explanation.summary = `Project health: ${(projectHealth.overall.value * 100).toFixed(0)}%. ${blockedCount} blocked workflows, ${blockerCount} blockers, ${missingInspectionCount} missing inspections.`;
    
    if (blockedCount > 0) {
      explanation.keyFindings.push(`${blockedCount} workflows blocked by conflicts`);
    }
    
    if (blockerCount > 0) {
      explanation.keyFindings.push(`${blockerCount} blockers prevent progress`);
    }
    
    if (missingInspectionCount > 0) {
      explanation.keyFindings.push(`${missingInspectionCount} required inspections missing`);
    }
    
    if (projectHealth.turnoverReadiness.value < 0.8) {
      explanation.recommendations.push('Focus on resolving turnover blockers');
    }
    
    if (projectHealth.activationReadiness.value < 0.8) {
      explanation.recommendations.push('Prioritize activation readiness tasks');
    }
    
    if (evaluation.specificationComplianceGaps.length > 0) {
      explanation.recommendations.push('Address specification compliance gaps');
    }
    
    return explanation;
  }

  /**
   * Get current operational state
   */
  getOperationalState() {
    return {
      projectHealth: this.projectHealth,
      operationalTimeline: this.operationalTimeline,
      dependencyGraph: this.dependencyGraph
    };
  }

  /**
   * Generate diagnostics
   */
  generateDiagnostics() {
    return {
      graphNodes: this.constructionGraph.getDiagnostics().nodeCount,
      graphEdges: this.constructionGraph.getDiagnostics().edgeCount,
      totalFacts: this.factEngine.facts.size,
      totalRelationships: this.relationshipEngine.relationships.size,
      totalConflicts: this.relationshipEngine.conflicts.length,
      dependencyGraphSize: this.dependencyGraph.size,
      operationalTimelineSize: Object.values(this.operationalTimeline).reduce((sum, arr) => sum + arr.length, 0)
    };
  }
}

export { ProjectOrchestrationEngine };
