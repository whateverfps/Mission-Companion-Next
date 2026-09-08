import { createConstructionGraph } from './construction-graph.js';

class ConstructionReasoningEngine {
  constructor() {
    this.constructionGraph = null;
    this.factEngine = null;
    this.relationshipEngine = null;
    this.evidenceEngine = null;
  }

  initialize(constructionGraph, factEngine, relationshipEngine, evidenceEngine) {
    this.constructionGraph = constructionGraph;
    this.factEngine = factEngine;
    this.relationshipEngine = relationshipEngine;
    this.evidenceEngine = evidenceEngine;
  }

  /**
   * Parse natural language question and extract key entities
   */
  parseQuestion(question) {
    const parsed = {
      question,
      entities: [],
      predicates: [],
      questionType: this.classifyQuestion(question)
    };

    // Extract entity identifiers
    const entityPatterns = [
      /(?:door|wall|window|equipment|panel|cable|room|building|floor)\s*[:\s-]*([A-Z0-9-]+)/gi,
      /([A-Z]{2,3}-?\d+)/g,
      /([A-Z]+\d+)/g
    ];

    for (const pattern of entityPatterns) {
      const matches = question.match(pattern);
      if (matches) {
        parsed.entities.push(...matches);
      }
    }

    // Extract predicates/relationships
    const predicatePatterns = [
      /governs|governed by/i,
      /ready|readiness/i,
      /blocks|blocked by/i,
      /located|location/i,
      /connected|connection/i,
      /specification|spec/i,
      /inspection|inspected/i,
      /deficiency|defect/i,
      /rfi/i,
      /submittal/i,
      /commissioning|commissioned/i,
      /evidence|support/i,
      /changed|change/i,
      /since|from/i
    ];

    for (const pattern of predicatePatterns) {
      const matches = question.match(pattern);
      if (matches) {
        parsed.predicates.push(...matches);
      }
    }

    return parsed;
  }

  /**
   * Classify the type of question
   */
  classifyQuestion(question) {
    const lower = question.toLowerCase();
    
    if (lower.includes('govern') || lower.includes('spec')) return 'governance';
    if (lower.includes('ready') || lower.includes('readiness')) return 'readiness';
    if (lower.includes('block') || lower.includes('prevents')) return 'blocking';
    if (lower.includes('evidence') || lower.includes('support')) return 'evidence';
    if (lower.includes('changed') || lower.includes('since')) return 'change';
    if (lower.includes('why')) return 'explanation';
    if (lower.includes('what')) return 'information';
    
    return 'general';
  }

  /**
   * Identify project entities from parsed question
   */
  identifyEntities(parsedQuestion) {
    const entities = [];
    
    for (const entityRef of parsedQuestion.entities) {
      // Try to find exact match in graph
      const exactMatch = this.constructionGraph.findNodes({
        limit: 10
      }).find(n => 
        n.nodeId === entityRef || 
        n.label === entityRef || 
        n.title === entityRef ||
        n.normalizedKey === entityRef.toUpperCase().replace(/[^A-Z0-9]/g, '')
      );
      
      if (exactMatch) {
        entities.push(exactMatch);
      } else {
        // Try fuzzy match
        const fuzzyMatches = this.constructionGraph.findNodes({
          limit: 50
        }).filter(n => 
          n.label?.toLowerCase().includes(entityRef.toLowerCase()) ||
          n.title?.toLowerCase().includes(entityRef.toLowerCase())
        );
        
        if (fuzzyMatches.length > 0) {
          entities.push(...fuzzyMatches);
        }
      }
    }
    
    return [...new Set(entities)]; // Deduplicate
  }

  /**
   * Build reasoning context for a question
   */
  buildReasoningContext(question, entities) {
    const startTime = performance.now();
    const context = {
      question,
      entities,
      facts: [],
      specifications: [],
      drawings: [],
      inspections: [],
      deficiencies: [],
      rfis: [],
      submittals: [],
      commissioningRecords: [],
      conflicts: [],
      reasoningPath: [],
      factsTraversed: 0,
      relationshipsTraversed: 0,
      evidenceReviewed: 0
    };

    // For each entity, retrieve related data
    for (const entity of entities) {
      // Get facts for this entity
      const entityFacts = this.factEngine.getFactsForSubject(entity.nodeId);
      context.facts.push(...entityFacts);
      context.factsTraversed += entityFacts.length;

      // Get specifications governing this entity
      const specRelationships = this.relationshipEngine.getRelationshipsByType(
        entity.nodeId, 'governed-by', 'outgoing'
      );
      for (const rel of specRelationships) {
        const specNode = this.constructionGraph.getNode(rel.targetId);
        if (specNode) {
          context.specifications.push(specNode);
          context.evidenceReviewed++;
        }
      }
      context.relationshipsTraversed += specRelationships.length;

      // Get drawings
      const drawingRelationships = this.relationshipEngine.getRelationshipsByType(
        entity.nodeId, 'appears-on', 'outgoing'
      );
      for (const rel of drawingRelationships) {
        const drawingNode = this.constructionGraph.getNode(rel.targetId);
        if (drawingNode) {
          context.drawings.push(drawingNode);
          context.evidenceReviewed++;
        }
      }
      context.relationshipsTraversed += drawingRelationships.length;

      // Get inspections
      const inspectionRelationships = this.relationshipEngine.getRelationshipsByType(
        entity.nodeId, 'inspected-by', 'outgoing'
      );
      for (const rel of inspectionRelationships) {
        const inspectionNode = this.constructionGraph.getNode(rel.targetId);
        if (inspectionNode) {
          context.inspections.push(inspectionNode);
          context.evidenceReviewed++;
        }
      }
      context.relationshipsTraversed += inspectionRelationships.length;

      // Get deficiencies
      const deficiencyRelationships = this.relationshipEngine.getRelationshipsByType(
        entity.nodeId, 'has-deficiency', 'outgoing'
      );
      for (const rel of deficiencyRelationships) {
        const deficiencyNode = this.constructionGraph.getNode(rel.targetId);
        if (deficiencyNode) {
          context.deficiencies.push(deficiencyNode);
          context.evidenceReviewed++;
        }
      }
      context.relationshipsTraversed += deficiencyRelationships.length;

      // Get RFIs
      const rfiRelationships = this.relationshipEngine.getRelationshipsByType(
        entity.nodeId, 'affected-by-rfi', 'outgoing'
      );
      for (const rel of rfiRelationships) {
        const rfiNode = this.constructionGraph.getNode(rel.targetId);
        if (rfiNode) {
          context.rfis.push(rfiNode);
          context.evidenceReviewed++;
        }
      }
      context.relationshipsTraversed += rfiRelationships.length;

      // Get submittals
      const submittalRelationships = this.relationshipEngine.getRelationshipsByType(
        entity.nodeId, 'covered-by-submittal', 'outgoing'
      );
      for (const rel of submittalRelationships) {
        const submittalNode = this.constructionGraph.getNode(rel.targetId);
        if (submittalNode) {
          context.submittals.push(submittalNode);
          context.evidenceReviewed++;
        }
      }
      context.relationshipsTraversed += submittalRelationships.length;

      // Get commissioning records
      const commissioningRelationships = this.relationshipEngine.getRelationshipsByType(
        entity.nodeId, 'commissioned-by', 'outgoing'
      );
      for (const rel of commissioningRelationships) {
        const commissioningNode = this.constructionGraph.getNode(rel.targetId);
        if (commissioningNode) {
          context.commissioningRecords.push(commissioningNode);
          context.evidenceReviewed++;
        }
      }
      context.relationshipsTraversed += commissioningRelationships.length;

      // Get conflicts
      const entityConflicts = this.relationshipEngine.conflicts.filter(
        c => c.relationship.sourceId === entity.nodeId
      );
      context.conflicts.push(...entityConflicts);
    }

    context.reasoningTime = performance.now() - startTime;

    return context;
  }

  /**
   * Generate answer based on reasoning context
   */
  generateAnswer(context, parsedQuestion) {
    const questionType = parsedQuestion.questionType;
    let answer = '';
    let confidence = 0;
    let reasoningPath = [];
    let evidence = [];
    let assumptions = [];
    let unresolvedQuestions = [];
    let conflicts = [];

    switch (questionType) {
      case 'governance':
        return this.answerGovernanceQuestion(context);
      case 'readiness':
        return this.answerReadinessQuestion(context);
      case 'blocking':
        return this.answerBlockingQuestion(context);
      case 'evidence':
        return this.answerEvidenceQuestion(context);
      case 'change':
        return this.answerChangeQuestion(context);
      case 'explanation':
        return this.answerExplanationQuestion(context);
      default:
        return this.answerGeneralQuestion(context);
    }
  }

  /**
   * Answer governance questions
   */
  answerGovernanceQuestion(context) {
    if (context.specifications.length === 0) {
      return {
        answer: 'I cannot determine what governs this entity. No governing specifications found in the graph.',
        confidence: 0,
        reasoningPath: ['No specifications found'],
        evidence: [],
        assumptions: [],
        unresolvedQuestions: ['Are there specifications that should govern this entity?'],
        conflicts: context.conflicts
      };
    }

    const specTitles = context.specifications.map(s => s.label).join(', ');
    const reasoningPath = [
      `Entity: ${context.entities[0]?.label || context.entities[0]?.nodeId}`,
      `Found ${context.specifications.length} governing specifications`,
      `Specifications: ${specTitles}`
    ];

    return {
      answer: `${context.entities[0]?.label || context.entities[0]?.nodeId} is governed by: ${specTitles}`,
      confidence: context.specifications.length > 0 ? 0.9 : 0,
      reasoningPath,
      evidence: context.specifications.map(s => ({
        type: 'specification',
        id: s.nodeId,
        title: s.label
      })),
      assumptions: [],
      unresolvedQuestions: [],
      conflicts: context.conflicts
    };
  }

  /**
   * Answer readiness questions
   */
  answerReadinessQuestion(context) {
    const deficiencies = context.deficiencies;
    const inspections = context.inspections;
    const commissioning = context.commissioningRecords;

    if (deficiencies.length === 0 && inspections.length === 0 && commissioning.length === 0) {
      return {
        answer: `I cannot determine readiness for ${context.entities[0]?.label || context.entities[0]?.nodeId}. No inspection, deficiency, or commissioning records found in the graph.`,
        confidence: 0,
        reasoningPath: ['No readiness evidence found'],
        evidence: [],
        assumptions: [],
        unresolvedQuestions: ['Are there inspection records? Are there deficiencies? Is commissioning complete?'],
        conflicts: context.conflicts
      };
    }

    const reasoningPath = [
      `Entity: ${context.entities[0]?.label || context.entities[0]?.nodeId}`,
      `Deficiencies: ${deficiencies.length}`,
      `Inspections: ${inspections.length}`,
      `Commissioning records: ${commissioning.length}`
    ];

    if (deficiencies.length > 0) {
      reasoningPath.push(`Not ready due to ${deficiencies.length} open deficiencies`);
    }

    if (inspections.length > 0) {
      const completedInspections = inspections.filter(i => i.metadata?.status === 'complete').length;
      reasoningPath.push(`${completedInspections}/${inspections.length} inspections complete`);
    }

    if (commissioning.length > 0) {
      const completedCommissioning = commissioning.filter(c => c.metadata?.status === 'complete').length;
      reasoningPath.push(`${completedCommissioning}/${commissioning.length} commissioning items complete`);
    }

    const isReady = deficiencies.length === 0 && 
                    inspections.every(i => i.metadata?.status === 'complete') &&
                    commissioning.every(c => c.metadata?.status === 'complete');

    return {
      answer: isReady 
        ? `${context.entities[0]?.label || context.entities[0]?.nodeId} appears ready. No open deficiencies, all inspections and commissioning complete.`
        : `${context.entities[0]?.label || context.entities[0]?.nodeId} is not ready. Has ${deficiencies.length} deficiencies, ${inspections.length} inspections, ${commissioning.length} commissioning records.`,
      confidence: 0.8,
      reasoningPath,
      evidence: [
        ...deficiencies.map(d => ({ type: 'deficiency', id: d.nodeId, title: d.label })),
        ...inspections.map(i => ({ type: 'inspection', id: i.nodeId, title: i.label })),
        ...commissioning.map(c => ({ type: 'commissioning', id: c.nodeId, title: c.label }))
      ],
      assumptions: [],
      unresolvedQuestions: [],
      conflicts: context.conflicts
    };
  }

  /**
   * Answer blocking questions
   */
  answerBlockingQuestion(context) {
    const blockingRelationships = [];
    
    for (const entity of context.entities) {
      const blocks = this.relationshipEngine.getRelationshipsByType(entity.nodeId, 'blocks', 'outgoing');
      blockingRelationships.push(...blocks);
    }

    if (blockingRelationships.length === 0) {
      return {
        answer: `I cannot determine what blocks ${context.entities[0]?.label || context.entities[0]?.nodeId}. No blocking relationships found in the graph.`,
        confidence: 0,
        reasoningPath: ['No blocking relationships found'],
        evidence: [],
        assumptions: [],
        unresolvedQuestions: ['Are there dependencies or blocking relationships?'],
        conflicts: context.conflicts
      };
    }

    const blockedItems = blockingRelationships.map(r => {
      const target = this.constructionGraph.getNode(r.targetId);
      return target ? target.label : r.targetId;
    }).join(', ');

    return {
      answer: `${context.entities[0]?.label || context.entities[0]?.nodeId} is blocked by: ${blockedItems}`,
      confidence: 0.85,
      reasoningPath: [
        `Entity: ${context.entities[0]?.label || context.entities[0]?.nodeId}`,
        `Found ${blockingRelationships.length} blocking relationships`,
        `Blocked by: ${blockedItems}`
      ],
      evidence: blockingRelationships.map(r => ({
        type: 'blocking',
        relationshipId: r.relationshipId,
        targetId: r.targetId
      })),
      assumptions: [],
      unresolvedQuestions: [],
      conflicts: context.conflicts
    };
  }

  /**
   * Answer evidence questions
   */
  answerEvidenceQuestion(context) {
    const allEvidence = [
      ...context.specifications.map(s => ({ type: 'specification', id: s.nodeId, title: s.label })),
      ...context.drawings.map(d => ({ type: 'drawing', id: d.nodeId, title: d.label })),
      ...context.inspections.map(i => ({ type: 'inspection', id: i.nodeId, title: i.label })),
      ...context.deficiencies.map(d => ({ type: 'deficiency', id: d.nodeId, title: d.label })),
      ...context.rfis.map(r => ({ type: 'rfi', id: r.nodeId, title: r.label })),
      ...context.submittals.map(s => ({ type: 'submittal', id: s.nodeId, title: s.label })),
      ...context.commissioningRecords.map(c => ({ type: 'commissioning', id: c.nodeId, title: c.label }))
    ];

    if (allEvidence.length === 0) {
      return {
        answer: `I cannot find evidence for ${context.entities[0]?.label || context.entities[0]?.nodeId}. No supporting records found in the graph.`,
        confidence: 0,
        reasoningPath: ['No evidence found'],
        evidence: [],
        assumptions: [],
        unresolvedQuestions: ['Are there drawings, specifications, inspections, or other records?'],
        conflicts: context.conflicts
      };
    }

    const evidenceByType = {};
    for (const evidence of allEvidence) {
      if (!evidenceByType[evidence.type]) {
        evidenceByType[evidence.type] = [];
      }
      evidenceByType[evidence.type].push(evidence);
    }

    const reasoningPath = [
      `Entity: ${context.entities[0]?.label || context.entities[0]?.nodeId}`,
      ...Object.entries(evidenceByType).map(([type, items]) => `${type}: ${items.length}`)
    ];

    return {
      answer: `${context.entities[0]?.label || context.entities[0]?.nodeId} is supported by ${allEvidence.length} evidence items: ${Object.entries(evidenceByType).map(([type, items]) => `${items.length} ${type}`).join(', ')}`,
      confidence: 0.9,
      reasoningPath,
      evidence: allEvidence,
      assumptions: [],
      unresolvedQuestions: [],
      conflicts: context.conflicts
    };
  }

  /**
   * Answer change questions
   */
  answerChangeQuestion(context) {
    // This would require tracking changes over time
    return {
      answer: `I cannot determine what changed since the specified date. Change tracking is not implemented in the current graph.`,
      confidence: 0,
      reasoningPath: ['Change tracking not implemented'],
      evidence: [],
      assumptions: [],
      unresolvedQuestions: ['When was the reference point? What type of changes are we tracking?'],
      conflicts: context.conflicts
    };
  }

  /**
   * Answer explanation questions
   */
  answerExplanationQuestion(context) {
    // General explanation based on available context
    const reasoningPath = [
      `Entity: ${context.entities[0]?.label || context.entities[0]?.nodeId}`,
      `Facts: ${context.facts.length}`,
      `Specifications: ${context.specifications.length}`,
      `Inspections: ${context.inspections.length}`,
      `Deficiencies: ${context.deficiencies.length}`
    ];

    if (context.deficiencies.length > 0) {
      reasoningPath.push(`Has ${context.deficiencies.length} open deficiencies`);
    }

    if (context.conflicts.length > 0) {
      reasoningPath.push(`Has ${context.conflicts.length} conflicts requiring review`);
    }

    return {
      answer: `${context.entities[0]?.label || context.entities[0]?.nodeId} has ${context.facts.length} verified facts, is governed by ${context.specifications.length} specifications, has ${context.inspections.length} inspection records, and ${context.deficiencies.length} deficiencies.`,
      confidence: 0.75,
      reasoningPath,
      evidence: [
        ...context.facts.map(f => ({ type: 'fact', id: f.factId, statement: `${f.subjectId} ${f.predicate} ${f.objectId}` })),
        ...context.specifications.map(s => ({ type: 'specification', id: s.nodeId, title: s.label }))
      ],
      assumptions: [],
      unresolvedQuestions: [],
      conflicts: context.conflicts
    };
  }

  /**
   * Answer general questions
   */
  answerGeneralQuestion(context) {
    return this.answerExplanationQuestion(context);
  }

  /**
   * Process a question and return reasoning result
   */
  processQuestion(question) {
    const startTime = performance.now();
    
    // Parse question
    const parsed = this.parseQuestion(question);
    
    // Identify entities
    const entities = this.identifyEntities(parsed);
    
    if (entities.length === 0) {
      return {
        answer: 'I cannot answer this question. No identifiable project entities found in the question.',
        confidence: 0,
        reasoningPath: ['No entities identified'],
        evidence: [],
        assumptions: [],
        unresolvedQuestions: ['Which project entity are you asking about?'],
        conflicts: [],
        diagnostics: {
          reasoningTime: performance.now() - startTime,
          factsTraversed: 0,
          relationshipsTraversed: 0,
          evidenceReviewed: 0,
          conflictsEncountered: 0,
          confidenceCalculation: 'Zero confidence - no entities found'
        }
      };
    }
    
    // Build reasoning context
    const context = this.buildReasoningContext(question, entities);
    
    // Generate answer
    const result = this.generateAnswer(context, parsed);
    
    // Add diagnostics
    result.diagnostics = {
      reasoningTime: performance.now() - startTime,
      factsTraversed: context.factsTraversed,
      relationshipsTraversed: context.relationshipsTraversed,
      evidenceReviewed: context.evidenceReviewed,
      conflictsEncountered: context.conflicts.length,
      confidenceCalculation: `Based on ${context.facts.length} facts, ${context.specifications.length} specifications, ${context.inspections.length} inspections`
    };
    
    return result;
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

export { ConstructionReasoningEngine };
