import { createConstructionGraph } from './construction-graph.js';

class MissionExecutionEngine {
  constructor() {
    this.constructionGraph = null;
    this.factEngine = null;
    this.relationshipEngine = null;
    this.reasoningEngine = null;
    this.missionTypes = new Set([
      'inspection',
      'turnover',
      'deficiency',
      'executive-briefing',
      'daily-qa-plan',
      'shutdown-planning',
      'activation-readiness',
      'submittal-review',
      'rfi-review',
      'commissioning-readiness',
      'safety-walk',
      'firestopping-audit',
      'oit-readiness'
    ]);
  }

  initialize(constructionGraph, factEngine, relationshipEngine, reasoningEngine) {
    this.constructionGraph = constructionGraph;
    this.factEngine = factEngine;
    this.relationshipEngine = relationshipEngine;
    this.reasoningEngine = reasoningEngine;
  }

  /**
   * Parse mission goal and extract mission type and scope
   */
  parseMissionGoal(goal) {
    const parsed = {
      goal,
      missionType: this.classifyMission(goal),
      scope: this.extractScope(goal),
      priority: this.extractPriority(goal)
    };

    return parsed;
  }

  /**
   * Classify the mission type
   */
  classifyMission(goal) {
    const lower = goal.toLowerCase();
    
    if (lower.includes('inspection') || lower.includes('inspect')) return 'inspection';
    if (lower.includes('turnover') || lower.includes('turn over')) return 'turnover';
    if (lower.includes('deficiency') || lower.includes('defect')) return 'deficiency';
    if (lower.includes('briefing') || lower.includes('executive')) return 'executive-briefing';
    if (lower.includes('daily') || lower.includes('qa plan')) return 'daily-qa-plan';
    if (lower.includes('shutdown') || lower.includes('shut down')) return 'shutdown-planning';
    if (lower.includes('activation') || lower.includes('activate')) return 'activation-readiness';
    if (lower.includes('submittal') || lower.includes('submit')) return 'submittal-review';
    if (lower.includes('rfi') || lower.includes('request for information')) return 'rfi-review';
    if (lower.includes('commissioning') || lower.includes('commission')) return 'commissioning-readiness';
    if (lower.includes('safety') || lower.includes('walk')) return 'safety-walk';
    if (lower.includes('firestopping') || lower.includes('fire stop')) return 'firestopping-audit';
    if (lower.includes('oit') || lower.includes('owner')) return 'oit-readiness';
    
    return 'inspection'; // Default
  }

  /**
   * Extract scope from mission goal
   */
  extractScope(goal) {
    const scope = {
      building: null,
      floor: null,
      room: null,
      system: null,
      object: null
    };

    // Extract building
    const buildingMatch = goal.match(/building\s+(\d+)|building\s+([A-Z]+)/i);
    if (buildingMatch) {
      scope.building = buildingMatch[1] || buildingMatch[2];
    }

    // Extract floor
    const floorMatch = goal.match(/floor\s+(\d+)|level\s+(\d+)|l(\d+)/i);
    if (floorMatch) {
      scope.floor = floorMatch[1] || floorMatch[2] || floorMatch[3];
    }

    // Extract room
    const roomMatch = goal.match(/room\s+(\d+)|room\s+([A-Z]+)/i);
    if (roomMatch) {
      scope.room = roomMatch[1] || roomMatch[2];
    }

    // Extract system
    const systemMatch = goal.match(/system\s+(\w+)|(\w+)\s+system/i);
    if (systemMatch) {
      scope.system = systemMatch[1] || systemMatch[2];
    }

    // Extract object type
    const objectMatch = goal.match(/(\w+)\s+inspection|(\w+)\s+walk|(\w+)\s+audit/i);
    if (objectMatch) {
      scope.object = objectMatch[1] || objectMatch[2] || objectMatch[3];
    }

    return scope;
  }

  /**
   * Extract priority from mission goal
   */
  extractPriority(goal) {
    const lower = goal.toLowerCase();
    
    if (lower.includes('urgent') || lower.includes('critical') || lower.includes('emergency')) return 'critical';
    if (lower.includes('high') || lower.includes('priority')) return 'high';
    if (lower.includes('low') || lower.includes('routine')) return 'low';
    
    return 'medium'; // Default
  }

  /**
   * Retrieve verified project knowledge for mission
   */
  retrieveProjectKnowledge(parsedMission) {
    const startTime = performance.now();
    const knowledge = {
      objects: [],
      facts: [],
      specifications: [],
      drawings: [],
      inspections: [],
      deficiencies: [],
      conflicts: [],
      factsTraversed: 0,
      objectsTraversed: 0,
      evidenceReviewed: 0
    };

    // Find objects in scope
    const scopeNodes = this.findNodesInScope(parsedMission.scope);
    knowledge.objects = scopeNodes;
    knowledge.objectsTraversed = scopeNodes.length;

    // For each object, retrieve related data
    for (const object of scopeNodes) {
      // Get facts
      const objectFacts = this.factEngine.getFactsForSubject(object.nodeId);
      knowledge.facts.push(...objectFacts);
      knowledge.factsTraversed += objectFacts.length;

      // Get specifications
      const specRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'governed-by', 'outgoing'
      );
      for (const rel of specRelationships) {
        const specNode = this.constructionGraph.getNode(rel.targetId);
        if (specNode) {
          knowledge.specifications.push(specNode);
          knowledge.evidenceReviewed++;
        }
      }

      // Get drawings
      const drawingRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'appears-on', 'outgoing'
      );
      for (const rel of drawingRelationships) {
        const drawingNode = this.constructionGraph.getNode(rel.targetId);
        if (drawingNode) {
          knowledge.drawings.push(drawingNode);
          knowledge.evidenceReviewed++;
        }
      }

      // Get inspections
      const inspectionRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'inspected-by', 'outgoing'
      );
      for (const rel of inspectionRelationships) {
        const inspectionNode = this.constructionGraph.getNode(rel.targetId);
        if (inspectionNode) {
          knowledge.inspections.push(inspectionNode);
          knowledge.evidenceReviewed++;
        }
      }

      // Get deficiencies
      const deficiencyRelationships = this.relationshipEngine.getRelationshipsByType(
        object.nodeId, 'has-deficiency', 'outgoing'
      );
      for (const rel of deficiencyRelationships) {
        const deficiencyNode = this.constructionGraph.getNode(rel.targetId);
        if (deficiencyNode) {
          knowledge.deficiencies.push(deficiencyNode);
          knowledge.evidenceReviewed++;
        }
      }

      // Get conflicts
      const objectConflicts = this.relationshipEngine.conflicts.filter(
        c => c.relationship.sourceId === object.nodeId
      );
      knowledge.conflicts.push(...objectConflicts);
    }

    knowledge.retrievalTime = performance.now() - startTime;

    return knowledge;
  }

  /**
   * Find nodes in scope
   */
  findNodesInScope(scope) {
    let nodes = [];

    // Start with all construction objects
    nodes = this.constructionGraph.findNodes({
      nodeTypes: ['construction-object', 'room', 'floor', 'building']
    });

    // Filter by building
    if (scope.building) {
      nodes = nodes.filter(n => 
        n.nodeId.includes(scope.building) || 
        n.buildingId === scope.building ||
        n.label?.includes(scope.building)
      );
    }

    // Filter by floor
    if (scope.floor) {
      nodes = nodes.filter(n => 
        n.nodeId.includes(`L${scope.floor}`) || 
        n.floorId === scope.floor ||
        n.label?.includes(`Floor ${scope.floor}`) ||
        n.label?.includes(`Level ${scope.floor}`)
      );
    }

    // Filter by room
    if (scope.room) {
      nodes = nodes.filter(n => 
        n.nodeId.includes(scope.room) || 
        n.roomId === scope.room ||
        n.label?.includes(`Room ${scope.room}`)
      );
    }

    // Filter by system
    if (scope.system) {
      nodes = nodes.filter(n => 
        n.system?.toLowerCase().includes(scope.system.toLowerCase()) ||
        n.label?.toLowerCase().includes(scope.system.toLowerCase())
      );
    }

    // Filter by object type
    if (scope.object) {
      nodes = nodes.filter(n => 
        n.nodeType?.toLowerCase().includes(scope.object.toLowerCase()) ||
        n.label?.toLowerCase().includes(scope.object.toLowerCase())
      );
    }

    return nodes;
  }

  /**
   * Build action plan based on mission type and knowledge
   */
  buildActionPlan(parsedMission, knowledge) {
    const missionType = parsedMission.missionType;
    
    switch (missionType) {
      case 'inspection':
        return this.buildInspectionPlan(parsedMission, knowledge);
      case 'turnover':
        return this.buildTurnoverPlan(parsedMission, knowledge);
      case 'deficiency':
        return this.buildDeficiencyPlan(parsedMission, knowledge);
      case 'executive-briefing':
        return this.buildExecutiveBriefingPlan(parsedMission, knowledge);
      case 'daily-qa-plan':
        return this.buildDailyQAPlan(parsedMission, knowledge);
      case 'shutdown-planning':
        return this.buildShutdownPlan(parsedMission, knowledge);
      case 'activation-readiness':
        return this.buildActivationReadinessPlan(parsedMission, knowledge);
      case 'submittal-review':
        return this.buildSubmittalReviewPlan(parsedMission, knowledge);
      case 'rfi-review':
        return this.buildRFIReviewPlan(parsedMission, knowledge);
      case 'commissioning-readiness':
        return this.buildCommissioningReadinessPlan(parsedMission, knowledge);
      case 'safety-walk':
        return this.buildSafetyWalkPlan(parsedMission, knowledge);
      case 'firestopping-audit':
        return this.buildFirestoppingAuditPlan(parsedMission, knowledge);
      case 'oit-readiness':
        return this.buildOITReadinessPlan(parsedMission, knowledge);
      default:
        return this.buildInspectionPlan(parsedMission, knowledge);
    }
  }

  /**
   * Build inspection mission plan
   */
  buildInspectionPlan(parsedMission, knowledge) {
    const requiredObjects = knowledge.objects;
    const outstandingDeficiencies = knowledge.deficiencies.filter(d => 
      d.metadata?.status !== 'resolved' && d.metadata?.status !== 'closed'
    );
    const requiredSpecifications = knowledge.specifications;
    const requiredDrawings = knowledge.drawings;
    const existingInspections = knowledge.inspections;

    // Build inspection sequence
    const recommendedSequence = [];
    let sequenceNumber = 1;

    // First: Address outstanding deficiencies
    for (const deficiency of outstandingDeficiencies) {
      recommendedSequence.push({
        sequence: sequenceNumber++,
        action: 'resolve-deficiency',
        description: `Resolve deficiency: ${deficiency.label}`,
        object: deficiency.nodeId,
        priority: 'high',
        estimatedDuration: 30 // minutes
      });
    }

    // Second: Inspect required objects
    for (const object of requiredObjects) {
      const hasRecentInspection = existingInspections.some(i => 
        i.metadata?.object === object.nodeId && 
        i.metadata?.date && 
        new Date(i.metadata.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      if (!hasRecentInspection) {
        recommendedSequence.push({
          sequence: sequenceNumber++,
          action: 'inspect',
          description: `Inspect ${object.label}`,
          object: object.nodeId,
          priority: 'medium',
          estimatedDuration: 15,
          requiredSpecifications: requiredSpecifications.filter(s => 
            this.relationshipEngine.getRelationshipsByType(object.nodeId, 'governed-by', 'outgoing')
              .some(r => r.targetId === s.nodeId)
          ).map(s => s.label)
        });
      }
    }

    // Calculate estimated duration
    const estimatedDuration = recommendedSequence.reduce((sum, step) => sum + step.estimatedDuration, 0);

    // Identify blocking items
    const blockingItems = outstandingDeficiencies.map(d => ({
      type: 'deficiency',
      id: d.nodeId,
      description: d.label,
      blocks: 'inspection-completion'
    }));

    // Identify risks
    const risks = [];
    if (knowledge.conflicts.length > 0) {
      risks.push({
        type: 'conflict',
        description: `${knowledge.conflicts.length} conflicts require resolution`,
        impact: 'medium'
      });
    }
    if (outstandingDeficiencies.length > 5) {
      risks.push({
        type: 'backlog',
        description: `High deficiency backlog: ${outstandingDeficiencies.length} items`,
        impact: 'high'
      });
    }

    // Define completion criteria
    const completionCriteria = [
      'All outstanding deficiencies resolved',
      'All required objects inspected',
      'All inspection photos captured',
      'All inspection forms completed'
    ];

    // Calculate confidence
    const confidence = knowledge.specifications.length > 0 ? 0.85 : 0.6;

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: requiredObjects.map(o => o.nodeId),
      requiredDocuments: requiredDrawings.map(d => d.nodeId),
      requiredSpecifications: requiredSpecifications.map(s => s.nodeId),
      requiredDrawings: requiredDrawings.map(d => d.nodeId),
      requiredEvidence: requiredSpecifications.map(s => s.nodeId),
      requiredInspections: requiredObjects.map(o => ({
        object: o.nodeId,
        specification: requiredSpecifications.filter(s => 
          this.relationshipEngine.getRelationshipsByType(o.nodeId, 'governed-by', 'outgoing')
            .some(r => r.targetId === s.nodeId)
        ).map(s => s.nodeId)
      })),
      blockingItems,
      risks,
      recommendedSequence,
      estimatedDuration,
      estimatedDurationUnit: 'minutes',
      completionCriteria,
      confidence,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build turnover mission plan
   */
  buildTurnoverPlan(parsedMission, knowledge) {
    const outstandingDeficiencies = knowledge.deficiencies.filter(d => 
      d.metadata?.status !== 'resolved' && d.metadata?.status !== 'closed'
    );
    const pendingInspections = knowledge.inspections.filter(i => 
      i.metadata?.status !== 'complete' && i.metadata?.status !== 'passed'
    );

    const recommendedSequence = [];
    let sequenceNumber = 1;

    // Address deficiencies first
    for (const deficiency of outstandingDeficiencies) {
      recommendedSequence.push({
        sequence: sequenceNumber++,
        action: 'resolve-deficiency',
        description: `Resolve deficiency: ${deficiency.label}`,
        object: deficiency.nodeId,
        priority: 'critical',
        estimatedDuration: 60
      });
    }

    // Complete pending inspections
    for (const inspection of pendingInspections) {
      recommendedSequence.push({
        sequence: sequenceNumber++,
        action: 'complete-inspection',
        description: `Complete inspection: ${inspection.label}`,
        object: inspection.nodeId,
        priority: 'high',
        estimatedDuration: 45
      });
    }

    // Final walkthrough
    recommendedSequence.push({
      sequence: sequenceNumber++,
      action: 'final-walkthrough',
      description: 'Final turnover walkthrough',
      priority: 'high',
      estimatedDuration: 120
    });

    const blockingItems = [
      ...outstandingDeficiencies.map(d => ({
        type: 'deficiency',
        id: d.nodeId,
        description: d.label,
        blocks: 'turnover'
      })),
      ...pendingInspections.map(i => ({
        type: 'inspection',
        id: i.nodeId,
        description: i.label,
        blocks: 'turnover'
      }))
    ];

    const completionCriteria = [
      'All deficiencies resolved',
      'All inspections passed',
      'Owner acceptance received',
      'Documentation completed',
      'Keys transferred'
    ];

    const confidence = outstandingDeficiencies.length === 0 && pendingInspections.length === 0 ? 0.95 : 0.7;

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: [...knowledge.specifications.map(s => s.nodeId), ...knowledge.deficiencies.map(d => d.nodeId)],
      requiredInspections: pendingInspections.map(i => i.nodeId),
      blockingItems,
      risks: [
        {
          type: 'readiness',
          description: `${outstandingDeficiencies.length} deficiencies, ${pendingInspections.length} pending inspections`,
          impact: outstandingDeficiencies.length > 0 || pendingInspections.length > 0 ? 'high' : 'low'
        }
      ],
      recommendedSequence,
      estimatedDuration: recommendedSequence.reduce((sum, step) => sum + step.estimatedDuration, 0),
      estimatedDurationUnit: 'minutes',
      completionCriteria,
      confidence,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build deficiency mission plan
   */
  buildDeficiencyPlan(parsedMission, knowledge) {
    const outstandingDeficiencies = knowledge.deficiencies.filter(d => 
      d.metadata?.status !== 'resolved' && d.metadata?.status !== 'closed'
    );

    const recommendedSequence = [];
    let sequenceNumber = 1;

    for (const deficiency of outstandingDeficiencies) {
      recommendedSequence.push({
        sequence: sequenceNumber++,
        action: 'address-deficiency',
        description: `Address deficiency: ${deficiency.label}`,
        object: deficiency.nodeId,
        priority: 'high',
        estimatedDuration: 45,
        requiredSpecifications: knowledge.specifications.map(s => s.nodeId)
      });
    }

    const completionCriteria = [
      'All deficiencies addressed',
      'Corrective work completed',
      'Re-inspection passed',
      'Documentation updated'
    ];

    const confidence = outstandingDeficiencies.length > 0 ? 0.9 : 0.5;

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: knowledge.deficiencies.map(d => d.nodeId),
      requiredInspections: [],
      blockingItems: outstandingDeficiencies.map(d => ({
        type: 'deficiency',
        id: d.nodeId,
        description: d.label,
        blocks: 'deficiency-resolution'
      })),
      risks: [],
      recommendedSequence,
      estimatedDuration: recommendedSequence.reduce((sum, step) => sum + step.estimatedDuration, 0),
      estimatedDurationUnit: 'minutes',
      completionCriteria,
      confidence,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build executive briefing plan
   */
  buildExecutiveBriefingPlan(parsedMission, knowledge) {
    const recommendedSequence = [
      {
        sequence: 1,
        action: 'gather-status',
        description: 'Gather current project status',
        priority: 'high',
        estimatedDuration: 30
      },
      {
        sequence: 2,
        action: 'compile-metrics',
        description: 'Compile key performance metrics',
        priority: 'high',
        estimatedDuration: 20
      },
      {
        sequence: 3,
        action: 'prepare-slides',
        description: 'Prepare executive briefing materials',
        priority: 'medium',
        estimatedDuration: 60
      }
    ];

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: [],
      requiredInspections: [],
      blockingItems: [],
      risks: [],
      recommendedSequence,
      estimatedDuration: 110,
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'Status compiled',
        'Metrics prepared',
        'Briefing materials ready'
      ],
      confidence: 0.75,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build daily QA plan
   */
  buildDailyQAPlan(parsedMission, knowledge) {
    const outstandingDeficiencies = knowledge.deficiencies.filter(d => 
      d.metadata?.status !== 'resolved' && d.metadata?.status !== 'closed'
    );

    const recommendedSequence = [];
    let sequenceNumber = 1;

    // Morning inspection
    recommendedSequence.push({
      sequence: sequenceNumber++,
      action: 'morning-inspection',
      description: 'Morning site inspection',
      priority: 'high',
      estimatedDuration: 60
    });

    // Address high-priority deficiencies
    for (const deficiency of outstandingDeficiencies.slice(0, 3)) {
      recommendedSequence.push({
        sequence: sequenceNumber++,
        action: 'address-deficiency',
        description: `Address deficiency: ${deficiency.label}`,
        object: deficiency.nodeId,
        priority: 'high',
        estimatedDuration: 30
      });
    }

    // Afternoon inspection
    recommendedSequence.push({
      sequence: sequenceNumber++,
      action: 'afternoon-inspection',
      description: 'Afternoon site inspection',
      priority: 'medium',
      estimatedDuration: 45
    });

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: knowledge.deficiencies.map(d => d.nodeId),
      requiredInspections: [],
      blockingItems: outstandingDeficiencies.map(d => ({
        type: 'deficiency',
        id: d.nodeId,
        description: d.label,
        blocks: 'daily-qa'
      })),
      risks: [],
      recommendedSequence,
      estimatedDuration: recommendedSequence.reduce((sum, step) => sum + step.estimatedDuration, 0),
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'Morning inspection complete',
        'Priority deficiencies addressed',
        'Afternoon inspection complete',
        'Daily report submitted'
      ],
      confidence: 0.8,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build shutdown planning plan
   */
  buildShutdownPlan(parsedMission, knowledge) {
    const recommendedSequence = [
      {
        sequence: 1,
        action: 'identify-systems',
        description: 'Identify systems to be shut down',
        priority: 'critical',
        estimatedDuration: 30
      },
      {
        sequence: 2,
        action: 'coordinate-utilities',
        description: 'Coordinate with utility providers',
        priority: 'critical',
        estimatedDuration: 60
      },
      {
        sequence: 3,
        action: 'create-checklist',
        description: 'Create shutdown checklist',
        priority: 'high',
        estimatedDuration: 45
      }
    ];

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: [],
      requiredInspections: [],
      blockingItems: [],
      risks: [
        {
          type: 'coordination',
          description: 'Utility coordination required',
          impact: 'high'
        }
      ],
      recommendedSequence,
      estimatedDuration: 135,
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'Systems identified',
        'Utilities coordinated',
        'Checklist created',
        'Personnel notified'
      ],
      confidence: 0.7,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build activation readiness plan
   */
  buildActivationReadinessPlan(parsedMission, knowledge) {
    const outstandingDeficiencies = knowledge.deficiencies.filter(d => 
      d.metadata?.status !== 'resolved' && d.metadata?.status !== 'closed'
    );
    const pendingInspections = knowledge.inspections.filter(i => 
      i.metadata?.status !== 'complete' && i.metadata?.status !== 'passed'
    );

    const blockingItems = [
      ...outstandingDeficiencies.map(d => ({
        type: 'deficiency',
        id: d.nodeId,
        description: d.label,
        blocks: 'activation'
      })),
      ...pendingInspections.map(i => ({
        type: 'inspection',
        id: i.nodeId,
        description: i.label,
        blocks: 'activation'
      }))
    ];

    const isReady = outstandingDeficiencies.length === 0 && pendingInspections.length === 0;

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: [...knowledge.specifications.map(s => s.nodeId), ...knowledge.deficiencies.map(d => d.nodeId)],
      requiredInspections: pendingInspections.map(i => i.nodeId),
      blockingItems,
      risks: [],
      recommendedSequence: isReady ? [
        {
          sequence: 1,
          action: 'authorize-activation',
          description: 'Authorize system activation',
          priority: 'critical',
          estimatedDuration: 15
        }
      ] : [
        {
          sequence: 1,
          action: 'resolve-blocking-items',
          description: 'Resolve blocking deficiencies and inspections',
          priority: 'critical',
          estimatedDuration: 120
        }
      ],
      estimatedDuration: isReady ? 15 : 120,
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'All deficiencies resolved',
        'All inspections passed',
        'Commissioning complete',
        'Owner approval received'
      ],
      confidence: isReady ? 0.95 : 0.6,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build submittal review plan
   */
  buildSubmittalReviewPlan(parsedMission, knowledge) {
    const recommendedSequence = [
      {
        sequence: 1,
        action: 'review-submittal',
        description: 'Review submittal compliance',
        priority: 'high',
        estimatedDuration: 45
      },
      {
        sequence: 2,
        action: 'check-specifications',
        description: 'Verify against specifications',
        priority: 'high',
        estimatedDuration: 30
      },
      {
        sequence: 3,
        action: 'approve-or-reject',
        description: 'Approve or reject submittal',
        priority: 'high',
        estimatedDuration: 15
      }
    ];

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: knowledge.specifications.map(s => s.nodeId),
      requiredInspections: [],
      blockingItems: [],
      risks: [],
      recommendedSequence,
      estimatedDuration: 90,
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'Submittal reviewed',
        'Specification compliance verified',
        'Decision recorded'
      ],
      confidence: 0.8,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build RFI review plan
   */
  buildRFIReviewPlan(parsedMission, knowledge) {
    const recommendedSequence = [
      {
        sequence: 1,
        action: 'analyze-rfi',
        description: 'Analyze RFI requirements',
        priority: 'high',
        estimatedDuration: 30
      },
      {
        sequence: 2,
        action: 'consult-records',
        description: 'Consult project records',
        priority: 'medium',
        estimatedDuration: 45
      },
      {
        sequence: 3,
        action: 'prepare-response',
        description: 'Prepare RFI response',
        priority: 'high',
        estimatedDuration: 60
      }
    ];

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: [],
      requiredInspections: [],
      blockingItems: [],
      risks: [],
      recommendedSequence,
      estimatedDuration: 135,
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'RFI analyzed',
        'Records consulted',
        'Response prepared'
      ],
      confidence: 0.75,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build commissioning readiness plan
   */
  buildCommissioningReadinessPlan(parsedMission, knowledge) {
    const pendingCommissioning = knowledge.objects.filter(o => 
      o.metadata?.commissioningStatus !== 'complete'
    );

    const recommendedSequence = [];
    let sequenceNumber = 1;

    for (const object of pendingCommissioning) {
      recommendedSequence.push({
        sequence: sequenceNumber++,
        action: 'commission',
        description: `Commission ${object.label}`,
        object: object.nodeId,
        priority: 'high',
        estimatedDuration: 60
      });
    }

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: knowledge.specifications.map(s => s.nodeId),
      requiredInspections: pendingCommissioning.map(o => o.nodeId),
      blockingItems: pendingCommissioning.map(o => ({
        type: 'commissioning',
        id: o.nodeId,
        description: o.label,
        blocks: 'commissioning-readiness'
      })),
      risks: [],
      recommendedSequence,
      estimatedDuration: recommendedSequence.reduce((sum, step) => sum + step.estimatedDuration, 0),
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'All equipment commissioned',
        'Testing complete',
        'Documentation complete',
        'Performance verified'
      ],
      confidence: pendingCommissioning.length === 0 ? 0.9 : 0.7,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build safety walk plan
   */
  buildSafetyWalkPlan(parsedMission, knowledge) {
    const recommendedSequence = [
      {
        sequence: 1,
        action: 'pre-walk-briefing',
        description: 'Pre-walk safety briefing',
        priority: 'critical',
        estimatedDuration: 15
      },
      {
        sequence: 2,
        action: 'safety-inspection',
        description: 'Conduct safety inspection',
        priority: 'critical',
        estimatedDuration: 60
      },
      {
        sequence: 3,
        action: 'document-findings',
        description: 'Document safety findings',
        priority: 'high',
        estimatedDuration: 30
      }
    ];

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: [],
      requiredInspections: [],
      blockingItems: [],
      risks: [],
      recommendedSequence,
      estimatedDuration: 105,
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'Briefing complete',
        'Inspection complete',
        'Findings documented',
        'PPE verified'
      ],
      confidence: 0.85,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build firestopping audit plan
   */
  buildFirestoppingAuditPlan(parsedMission, knowledge) {
    const firestoppingSpecs = knowledge.specifications.filter(s => 
      s.label?.toLowerCase().includes('firestop') || 
      s.title?.toLowerCase().includes('firestop')
    );

    const recommendedSequence = [
      {
        sequence: 1,
        action: 'review-specifications',
        description: 'Review firestopping specifications',
        priority: 'high',
        estimatedDuration: 30
      },
      {
        sequence: 2,
        action: 'inspect-penetrations',
        description: 'Inspect penetrations',
        priority: 'critical',
        estimatedDuration: 90
      },
      {
        sequence: 3,
        action: 'verify-compliance',
        description: 'Verify compliance',
        priority: 'high',
        estimatedDuration: 45
      }
    ];

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: firestoppingSpecs.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: firestoppingSpecs.map(s => s.nodeId),
      requiredInspections: [],
      blockingItems: [],
      risks: [],
      recommendedSequence,
      estimatedDuration: 165,
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'Specifications reviewed',
        'Penetrations inspected',
        'Compliance verified',
        'Documentation complete'
      ],
      confidence: firestoppingSpecs.length > 0 ? 0.9 : 0.6,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Build OIT readiness plan
   */
  buildOITReadinessPlan(parsedMission, knowledge) {
    const outstandingDeficiencies = knowledge.deficiencies.filter(d => 
      d.metadata?.status !== 'resolved' && d.metadata?.status !== 'closed'
    );
    const pendingInspections = knowledge.inspections.filter(i => 
      i.metadata?.status !== 'complete' && i.metadata?.status !== 'passed'
    );

    const isReady = outstandingDeficiencies.length === 0 && pendingInspections.length === 0;

    return {
      mission: parsedMission.goal,
      missionType: parsedMission.missionType,
      priority: parsedMission.priority,
      scope: parsedMission.scope,
      requiredObjects: knowledge.objects.map(o => o.nodeId),
      requiredDocuments: knowledge.drawings.map(d => d.nodeId),
      requiredSpecifications: knowledge.specifications.map(s => s.nodeId),
      requiredDrawings: knowledge.drawings.map(d => d.nodeId),
      requiredEvidence: [...knowledge.specifications.map(s => s.nodeId), ...knowledge.deficiencies.map(d => d.nodeId)],
      requiredInspections: pendingInspections.map(i => i.nodeId),
      blockingItems: [
        ...outstandingDeficiencies.map(d => ({
          type: 'deficiency',
          id: d.nodeId,
          description: d.label,
          blocks: 'oit-readiness'
        })),
        ...pendingInspections.map(i => ({
          type: 'inspection',
          id: i.nodeId,
          description: i.label,
          blocks: 'oit-readiness'
        }))
      ],
      risks: [],
      recommendedSequence: isReady ? [
        {
          sequence: 1,
          action: 'authorize-acceptance',
          description: 'Authorize OIT acceptance',
          priority: 'critical',
          estimatedDuration: 15
        }
      ] : [
        {
          sequence: 1,
          action: 'resolve-blocking-items',
          description: 'Resolve blocking deficiencies and inspections',
          priority: 'critical',
          estimatedDuration: 120
        }
      ],
      estimatedDuration: isReady ? 15 : 120,
      estimatedDurationUnit: 'minutes',
      completionCriteria: [
        'All deficiencies resolved',
        'All inspections passed',
        'Documentation complete',
        'Owner sign-off'
      ],
      confidence: isReady ? 0.95 : 0.6,
      supportingFacts: knowledge.facts.length,
      supportingEvidence: knowledge.evidenceReviewed
    };
  }

  /**
   * Execute mission and return mission package
   */
  executeMission(goal) {
    const startTime = performance.now();
    
    // Parse mission goal
    const parsedMission = this.parseMissionGoal(goal);
    
    // Retrieve project knowledge
    const knowledge = this.retrieveProjectKnowledge(parsedMission);
    
    // Build action plan
    const actionPlan = this.buildActionPlan(parsedMission, knowledge);
    
    // Add diagnostics
    actionPlan.diagnostics = {
      missionGenerationTime: performance.now() - startTime,
      factsTraversed: knowledge.factsTraversed,
      objectsTraversed: knowledge.objectsTraversed,
      evidenceReviewed: knowledge.evidenceReviewed,
      actionItemsGenerated: actionPlan.recommendedSequence.length,
      blockingItems: actionPlan.blockingItems.length,
      riskScore: actionPlan.risks.length > 0 ? 'medium' : 'low',
      confidenceCalculation: `Based on ${knowledge.factsTraversed} facts, ${knowledge.specifications.length} specifications, ${knowledge.deficiencies.length} deficiencies`
    };
    
    return actionPlan;
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
      totalConflicts: this.relationshipEngine.conflicts.length
    };
  }
}

export { MissionExecutionEngine };
