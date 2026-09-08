import { createConstructionGraph } from './construction-graph.js';

class ProjectFactEngine {
  constructor() {
    this.constructionGraph = null;
    this.relationshipEngine = null;
    this.facts = new Map(); // factId -> Fact
    this.evidenceToFactMap = new Map(); // evidenceId -> factId
    this.factLifecycleStates = new Set(['observed', 'supported', 'verified', 'conflicted', 'superseded', 'retired']);
  }

  initialize(constructionGraph, relationshipEngine) {
    this.constructionGraph = constructionGraph;
    this.relationshipEngine = relationshipEngine;
  }

  /**
   * Generate a canonical fact ID
   * Format: FACT:SUBJECT:PREDICATE:OBJECT
   */
  generateFactId(subjectId, predicate, objectId) {
    const normalizedSubject = subjectId.toUpperCase().replace(/[^A-Z0-9:]/g, '');
    const normalizedPredicate = predicate.toUpperCase().replace(/[^A-Z]/g, '');
    const normalizedObject = objectId.toUpperCase().replace(/[^A-Z0-9:]/g, '');
    return `FACT:${normalizedSubject}:${normalizedPredicate}:${normalizedObject}`;
  }

  /**
   * Create a fact from relationship evidence
   */
  createFactFromRelationship(relationship) {
    const subjectId = relationship.sourceId;
    const objectId = relationship.targetId;
    const predicate = relationship.type;
    
    const factId = this.generateFactId(subjectId, predicate, objectId);
    
    // Check if fact already exists
    const existingFact = this.facts.get(factId);
    if (existingFact) {
      // Add evidence to existing fact
      return this.addEvidenceToFact(factId, relationship);
    }
    
    // Check for conflicting facts
    const conflicts = this.detectConflicts(subjectId, predicate, objectId);
    
    const fact = {
      factId,
      subjectId,
      predicate,
      objectId,
      evidenceIds: [relationship.relationshipId],
      evidenceSources: [relationship.sourceDocumentId],
      confidence: relationship.confidence,
      verificationState: conflicts.length > 0 ? 'conflicted' : 'observed',
      firstObserved: new Date().toISOString(),
      lastVerified: null,
      lastModified: new Date().toISOString(),
      conflicts: conflicts,
      provenance: [{
        type: 'derived-from-relationship',
        relationshipId: relationship.relationshipId,
        sourceDocumentId: relationship.sourceDocumentId,
        sourcePageId: relationship.sourcePageId,
        timestamp: new Date().toISOString()
      }],
      reviewStatus: conflicts.length > 0 ? 'manual-review' : 'pending',
      lifecycleState: conflicts.length > 0 ? 'conflicted' : 'observed'
    };
    
    this.facts.set(factId, fact);
    this.evidenceToFactMap.set(relationship.relationshipId, factId);
    
    return fact;
  }

  /**
   * Detect conflicting facts
   */
  detectConflicts(subjectId, predicate, objectId) {
    const conflicts = [];
    
    // Find facts with same subject and predicate but different object
    for (const [factId, fact] of this.facts) {
      if (fact.subjectId === subjectId && 
          fact.predicate === predicate && 
          fact.objectId !== objectId &&
          fact.lifecycleState !== 'retired' &&
          fact.lifecycleState !== 'superseded') {
        conflicts.push({
          conflictingFactId: fact.factId,
          conflictingObjectId: fact.objectId,
          reason: 'Same subject and predicate with different object'
        });
      }
    }
    
    return conflicts;
  }

  /**
   * Add evidence to existing fact
   */
  addEvidenceToFact(factId, relationship) {
    const fact = this.facts.get(factId);
    if (!fact) return null;
    
    // Add evidence if not already present
    if (!fact.evidenceIds.includes(relationship.relationshipId)) {
      fact.evidenceIds.push(relationship.relationshipId);
    }
    
    // Add evidence source if not already present
    if (!fact.evidenceSources.includes(relationship.sourceDocumentId)) {
      fact.evidenceSources.push(relationship.sourceDocumentId);
    }
    
    // Update confidence (use max of existing and new)
    fact.confidence = Math.max(fact.confidence, relationship.confidence);
    
    // Update provenance
    fact.provenance.push({
      type: 'evidence-added',
      relationshipId: relationship.relationshipId,
      sourceDocumentId: relationship.sourceDocumentId,
      sourcePageId: relationship.sourcePageId,
      timestamp: new Date().toISOString()
    });
    
    // Update lifecycle state based on evidence count
    if (fact.evidenceIds.length >= 2 && fact.lifecycleState === 'observed') {
      fact.lifecycleState = 'supported';
      fact.verificationState = 'supported';
    }
    
    fact.lastModified = new Date().toISOString();
    
    this.facts.set(factId, fact);
    this.evidenceToFactMap.set(relationship.relationshipId, factId);
    
    return fact;
  }

  /**
   * Verify a fact
   */
  verifyFact(factId, verifierId, verificationNotes = '') {
    const fact = this.facts.get(factId);
    if (!fact) return false;
    
    fact.verificationState = 'verified';
    fact.lifecycleState = 'verified';
    fact.lastVerified = new Date().toISOString();
    fact.lastModified = new Date().toISOString();
    fact.reviewStatus = 'verified';
    
    fact.provenance.push({
      type: 'verified',
      verifierId,
      notes: verificationNotes,
      timestamp: new Date().toISOString()
    });
    
    this.facts.set(factId, fact);
    
    return true;
  }

  /**
   * Reject a fact
   */
  rejectFact(factId, verifierId, rejectionReason = '') {
    const fact = this.facts.get(factId);
    if (!fact) return false;
    
    fact.verificationState = 'rejected';
    fact.lifecycleState = 'superseded';
    fact.lastModified = new Date().toISOString();
    fact.reviewStatus = 'rejected';
    
    fact.provenance.push({
      type: 'rejected',
      verifierId,
      reason: rejectionReason,
      timestamp: new Date().toISOString()
    });
    
    this.facts.set(factId, fact);
    
    return true;
  }

  /**
   * Retire a fact
   */
  retireFact(factId, retireeId, retirementReason = '') {
    const fact = this.facts.get(factId);
    if (!fact) return false;
    
    fact.lifecycleState = 'retired';
    fact.lastModified = new Date().toISOString();
    fact.reviewStatus = 'retired';
    
    fact.provenance.push({
      type: 'retired',
      retireeId,
      reason: retirementReason,
      timestamp: new Date().toISOString()
    });
    
    this.facts.set(factId, fact);
    
    return true;
  }

  /**
   * Get facts for a subject
   */
  getFactsForSubject(subjectId) {
    const facts = [];
    
    for (const [factId, fact] of this.facts) {
      if (fact.subjectId === subjectId && fact.lifecycleState !== 'retired') {
        facts.push(fact);
      }
    }
    
    return facts;
  }

  /**
   * Get facts by predicate
   */
  getFactsByPredicate(predicate) {
    const facts = [];
    
    for (const [factId, fact] of this.facts) {
      if (fact.predicate === predicate && fact.lifecycleState !== 'retired') {
        facts.push(fact);
      }
    }
    
    return facts;
  }

  /**
   * Get facts for an object
   */
  getFactsForObject(objectId) {
    const facts = [];
    
    for (const [factId, fact] of this.facts) {
      if (fact.objectId === objectId && fact.lifecycleState !== 'retired') {
        facts.push(fact);
      }
    }
    
    return facts;
  }

  /**
   * Get fact by ID
   */
  getFact(factId) {
    return this.facts.get(factId);
  }

  /**
   * Get conflicting facts
   */
  getConflictingFacts(factId) {
    const fact = this.facts.get(factId);
    if (!fact) return [];
    
    const conflicts = [];
    
    for (const [otherFactId, otherFact] of this.facts) {
      if (otherFactId !== factId &&
          otherFact.subjectId === fact.subjectId &&
          otherFact.predicate === fact.predicate &&
          otherFact.objectId !== fact.objectId &&
          otherFact.lifecycleState !== 'retired' &&
          otherFact.lifecycleState !== 'superseded') {
        conflicts.push(otherFact);
      }
    }
    
    return conflicts;
  }

  /**
   * Get evidence that disagrees with a fact
   */
  getDisagreeingEvidence(factId) {
    const fact = this.facts.get(factId);
    if (!fact) return [];
    
    const disagreeing = [];
    
    // Check relationship conflicts
    for (const conflict of fact.conflicts) {
      const conflictingFact = this.facts.get(conflict.conflictingFactId);
      if (conflictingFact) {
        disagreeing.push({
          type: 'conflicting-fact',
          factId: conflictingFact.factId,
          objectId: conflictingFact.objectId,
          evidenceIds: conflictingFact.evidenceIds,
          confidence: conflictingFact.confidence
        });
      }
    }
    
    return disagreeing;
  }

  /**
   * Get fact explanation
   */
  getFactExplanation(factId) {
    const fact = this.facts.get(factId);
    if (!fact) return null;
    
    const conflictingFacts = this.getConflictingFacts(factId);
    const disagreeingEvidence = this.getDisagreeingEvidence(factId);
    
    return {
      factId: fact.factId,
      statement: `${fact.subjectId} ${fact.predicate} ${fact.objectId}`,
      subjectId: fact.subjectId,
      predicate: fact.predicate,
      objectId: fact.objectId,
      evidenceIds: fact.evidenceIds,
      evidenceSources: fact.evidenceSources,
      confidence: fact.confidence,
      verificationState: fact.verificationState,
      lifecycleState: fact.lifecycleState,
      firstObserved: fact.firstObserved,
      lastVerified: fact.lastVerified,
      lastModified: fact.lastModified,
      conflicts: fact.conflicts,
      conflictingFacts: conflictingFacts.map(f => f.factId),
      disagreeingEvidence,
      provenance: fact.provenance,
      reviewStatus: fact.reviewStatus,
      // Answer key questions
      whyBelieved: fact.evidenceIds.length > 0 ? `Supported by ${fact.evidenceIds.length} evidence items` : 'No supporting evidence',
      evidenceSupports: fact.evidenceIds,
      whoVerified: fact.provenance.filter(p => p.type === 'verified').map(p => p.verifierId),
      whenVerified: fact.lastVerified,
      hasChanged: fact.provenance.length > 1,
      evidenceDisagrees: disagreeingEvidence.length > 0
    };
  }

  /**
   * Batch create facts from relationships
   */
  createFactsFromRelationships(relationships) {
    const createdFacts = [];
    const updatedFacts = [];
    
    for (const relationship of relationships) {
      const result = this.createFactFromRelationship(relationship);
      if (result) {
        // Check if this was a new fact or an update
        const isNew = result.evidenceIds.length === 1 && 
                     result.provenance.length === 1 &&
                     result.provenance[0].type === 'derived-from-relationship';
        
        if (isNew) {
          createdFacts.push(result);
        } else {
          updatedFacts.push(result);
        }
      }
    }
    
    return { createdFacts, updatedFacts };
  }

  /**
   * Get facts by lifecycle state
   */
  getFactsByLifecycleState(lifecycleState) {
    const facts = [];
    
    for (const [factId, fact] of this.facts) {
      if (fact.lifecycleState === lifecycleState) {
        facts.push(fact);
      }
    }
    
    return facts;
  }

  /**
   * Get facts requiring manual review
   */
  getFactsRequiringReview() {
    const facts = [];
    
    for (const [factId, fact] of this.facts) {
      if (fact.reviewStatus === 'manual-review' || fact.lifecycleState === 'conflicted') {
        facts.push(fact);
      }
    }
    
    return facts;
  }

  /**
   * Generate diagnostics
   */
  generateDiagnostics() {
    const factsByState = {};
    for (const state of this.factLifecycleStates) {
      factsByState[state] = this.getFactsByLifecycleState(state).length;
    }
    
    const factsRequiringReview = this.getFactsRequiringReview();
    
    return {
      totalFacts: this.facts.size,
      factsByState,
      factsRequiringReview: factsRequiringReview.length,
      verifiedFacts: factsByState.verified || 0,
      conflictedFacts: factsByState.conflicted || 0,
      retiredFacts: factsByState.retired || 0,
      supersededFacts: factsByState.superseded || 0,
      averageConfidence: this.calculateAverageConfidence(),
      evidenceToFactMappings: this.evidenceToFactMap.size
    };
  }

  calculateAverageConfidence() {
    let total = 0;
    let count = 0;
    
    for (const fact of this.facts.values()) {
      if (fact.lifecycleState !== 'retired' && fact.lifecycleState !== 'superseded') {
        total += fact.confidence;
        count++;
      }
    }
    
    return count > 0 ? total / count : 0;
  }

  /**
   * Export fact state
   */
  exportState() {
    return {
      facts: Array.from(this.facts.entries()),
      evidenceToFactMap: Array.from(this.evidenceToFactMap.entries()),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import fact state
   */
  importState(state) {
    this.facts = new Map(state.facts);
    this.evidenceToFactMap = new Map(state.evidenceToFactMap);
  }
}

export { ProjectFactEngine };
