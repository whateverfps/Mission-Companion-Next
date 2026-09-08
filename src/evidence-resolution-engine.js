import { createConstructionGraph } from './construction-graph.js';

class EvidenceResolutionEngine {
  constructor() {
    this.canonicalIdentities = new Map(); // canonicalId -> Identity
    this.evidenceMap = new Map(); // evidenceKey -> canonicalId
    this.conflicts = [];
    this.manualReviewRequired = [];
    this.evidenceSources = new Set(['drawing', 'schedule', 'detail', 'keynote', 'specification', 'rfi', 'submittal', 'inspection', 'commissioning', 'photo']);
  }

  /**
   * Generate a canonical ID from entity type and identifier
   * Format: TYPE:IDENTIFIER (e.g., DOOR:FD17, ROOM:61-127, AHU:2)
   */
  generateCanonicalId(entityType, identifier) {
    const normalizedType = entityType.toUpperCase().replace(/[^A-Z]/g, '');
    const normalizedId = identifier.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${normalizedType}:${normalizedId}`;
  }

  /**
   * Extract identifier from entity evidence
   */
  extractIdentifierFromEvidence(evidence) {
    const evidenceType = evidence.type;
    const data = evidence.data || {};
    
    // Extract identifier based on evidence type
    switch (evidenceType) {
      case 'drawing':
        return data.tag || data.number || data.identifier || data.label;
      case 'schedule':
        return data.itemNumber || data.tag || data.identifier;
      case 'detail':
        return data.detailNumber || data.tag || data.identifier;
      case 'keynote':
        return data.keynoteNumber || data.tag || data.identifier;
      case 'specification':
        return data.sectionNumber || data.tag || data.identifier;
      case 'rfi':
        return data.subjectNumber || data.tag || data.identifier;
      case 'submittal':
        return data.submittalNumber || data.tag || data.identifier;
      case 'inspection':
        return data.inspectionNumber || data.tag || data.identifier;
      case 'commissioning':
        return data.commissioningNumber || data.tag || data.identifier;
      case 'photo':
        return data.photoTag || data.tag || data.identifier;
      default:
        return data.identifier || data.tag || data.number;
    }
  }

  /**
   * Normalize identifier for comparison
   */
  normalizeIdentifier(identifier) {
    if (!identifier) return null;
    return identifier.toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Create an evidence key for tracking
   */
  createEvidenceKey(evidence) {
    const evidenceType = evidence.type;
    const identifier = this.extractIdentifierFromEvidence(evidence);
    const sourceId = evidence.sourceId || evidence.documentId || 'unknown';
    const sourceType = evidence.sourceType || 'unknown';
    
    return `${evidenceType}:${sourceType}:${sourceId}:${this.normalizeIdentifier(identifier)}`;
  }

  /**
   * Resolve entity based on evidence
   */
  resolveEntityFromEvidence(entity, evidence) {
    const identifier = this.extractIdentifierFromEvidence(evidence);
    if (!identifier) {
      return null;
    }

    const canonicalId = this.generateCanonicalId(entity.type, identifier);
    const evidenceKey = this.createEvidenceKey(evidence);

    // Check if this evidence already points to a canonical identity
    const existingCanonicalId = this.evidenceMap.get(evidenceKey);
    
    if (existingCanonicalId) {
      // Evidence already resolves to an identity - merge
      return this.mergeEvidenceWithIdentity(existingCanonicalId, entity, evidence, evidenceKey);
    } else {
      // New evidence - create or resolve to existing identity
      return this.createIdentityFromEvidence(entity, evidence, evidenceKey, canonicalId);
    }
  }

  /**
   * Create or find identity from single evidence
   */
  createIdentityFromEvidence(entity, evidence, evidenceKey, proposedCanonicalId) {
    const identifier = this.extractIdentifierFromEvidence(evidence);
    
    // Check if canonical ID already exists (from other evidence)
    const existingIdentity = this.canonicalIdentities.get(proposedCanonicalId);
    
    if (existingIdentity) {
      // Add this evidence to existing identity
      return this.mergeEvidenceWithIdentity(proposedCanonicalId, entity, evidence, evidenceKey);
    }
    
    // Create new identity with single evidence
    const identity = {
      canonicalId: proposedCanonicalId,
      type: entity.type,
      primaryIdentifier: identifier,
      normalizedIdentifier: this.normalizeIdentifier(identifier),
      aliases: [entity.id, identifier],
      entities: [entity.id],
      evidence: [{
        key: evidenceKey,
        type: evidence.type,
        sourceType: evidence.sourceType,
        sourceId: evidence.sourceId,
        sourceDocumentId: evidence.sourceDocumentId,
        sourcePageId: evidence.sourcePageId,
        data: evidence.data,
        extractedIdentifier: identifier,
        timestamp: evidence.timestamp || new Date().toISOString()
      }],
      confidence: this.calculateSingleEvidenceConfidence(evidence),
      supportingEvidence: [evidenceKey],
      evidenceSources: [evidence.sourceType || evidence.type],
      resolvedAt: new Date().toISOString(),
      mergeHistory: [{
        action: 'created-from-evidence',
        evidenceKey,
        timestamp: new Date().toISOString()
      }]
    };
    
    this.canonicalIdentities.set(proposedCanonicalId, identity);
    this.evidenceMap.set(evidenceKey, proposedCanonicalId);
    
    return identity;
  }

  /**
   * Calculate confidence for single evidence
   */
  calculateSingleEvidenceConfidence(evidence) {
    // Single evidence always has low confidence
    return 0.25;
  }

  /**
   * Merge evidence with existing identity
   */
  mergeEvidenceWithIdentity(canonicalId, entity, evidence, evidenceKey) {
    const identity = this.canonicalIdentities.get(canonicalId);
    
    if (!identity) {
      return this.createIdentityFromEvidence(entity, evidence, evidenceKey, canonicalId);
    }
    
    // Check if evidence already exists for this identity
    const existingEvidence = identity.evidence.find(e => e.key === evidenceKey);
    if (existingEvidence) {
      // Evidence already processed - return existing identity
      return identity;
    }
    
    // Add new evidence
    const newEvidence = {
      key: evidenceKey,
      type: evidence.type,
      sourceType: evidence.sourceType,
      sourceId: evidence.sourceId,
      sourceDocumentId: evidence.sourceDocumentId,
      sourcePageId: evidence.sourcePageId,
      data: evidence.data,
      extractedIdentifier: this.extractIdentifierFromEvidence(evidence),
      timestamp: evidence.timestamp || new Date().toISOString()
    };
    
    identity.evidence.push(newEvidence);
    
    // Add supporting evidence
    if (!identity.supportingEvidence.includes(evidenceKey)) {
      identity.supportingEvidence.push(evidenceKey);
    }
    
    // Add evidence source if new
    const sourceType = evidence.sourceType || evidence.type;
    if (!identity.evidenceSources.includes(sourceType)) {
      identity.evidenceSources.push(sourceType);
    }
    
    // Add entity if not already present
    if (!identity.entities.includes(entity.id)) {
      identity.entities.push(entity.id);
    }
    
    // Add alias if not already present
    const identifier = this.extractIdentifierFromEvidence(evidence);
    const normalizedId = this.normalizeIdentifier(identifier);
    if (!identity.aliases.includes(identifier) && identifier) {
      identity.aliases.push(identifier);
    }
    if (!identity.aliases.includes(entity.id) && entity.id) {
      identity.aliases.push(entity.id);
    }
    
    // Recalculate confidence based on evidence agreement
    identity.confidence = this.calculateEvidenceAgreementConfidence(identity);
    
    // Record merge history
    identity.mergeHistory.push({
      action: 'evidence-merged',
      evidenceKey,
      timestamp: new Date().toISOString(),
      previousConfidence: identity.confidence
    });
    
    identity.resolvedAt = new Date().toISOString();
    
    this.canonicalIdentities.set(canonicalId, identity);
    this.evidenceMap.set(evidenceKey, canonicalId);
    
    return identity;
  }

  /**
   * Calculate confidence based on evidence agreement
   */
  calculateEvidenceAgreementConfidence(identity) {
    const evidenceCount = identity.evidence.length;
    const sourceCount = identity.evidenceSources.length;
    
    // Confidence based on number of independent evidence sources
    if (sourceCount === 1) return 0.25; // Low - single source
    if (sourceCount === 2) return 0.50; // Medium - two sources agree
    if (sourceCount === 3) return 0.75; // High - three sources agree
    if (sourceCount >= 4) return 1.00; // Verified - multiple sources agree
    
    return 0.25;
  }

  /**
   * Resolve entity with multiple evidence sources
   */
  resolveEntityWithMultipleEvidence(entity, evidenceList) {
    const resolvedIdentities = new Map();
    
    for (const evidence of evidenceList) {
      const identity = this.resolveEntityFromEvidence(entity, evidence);
      if (identity) {
        resolvedIdentities.set(identity.canonicalId, identity);
      }
    }
    
    // If multiple different canonical IDs were found, we have a conflict
    if (resolvedIdentities.size > 1) {
      this.conflicts.push({
        entityId: entity.id,
        conflictingCanonicalIds: Array.from(resolvedIdentities.keys()),
        evidenceKeys: evidenceList.map(e => this.createEvidenceKey(e)),
        reason: 'Multiple evidence sources resolve to different canonical identities'
      });
      
      // Mark for manual review
      this.manualReviewRequired.push({
        entityId: entity.id,
        conflictingCanonicalIds: Array.from(resolvedIdentities.keys()),
        evidenceCount: evidenceList.length,
        reason: 'Evidence conflict requiring manual resolution'
      });
      
      // Return the identity with highest confidence
      let bestIdentity = null;
      let bestConfidence = 0;
      
      for (const identity of resolvedIdentities.values()) {
        if (identity.confidence > bestConfidence) {
          bestConfidence = identity.confidence;
          bestIdentity = identity;
        }
      }
      
      return bestIdentity;
    }
    
    // Single canonical ID resolved
    return resolvedIdentities.values().next().value || null;
  }

  /**
   * Get canonical identity for an entity
   */
  getCanonicalIdentity(entityId) {
    for (const identity of this.canonicalIdentities.values()) {
      if (identity.entities.includes(entityId) || identity.aliases.includes(entityId)) {
        return identity;
      }
    }
    return null;
  }

  /**
   * Resolve identifier to canonical identity
   */
  resolveIdentifier(identifier) {
    const normalizedId = this.normalizeIdentifier(identifier);
    if (!normalizedId) return null;
    
    for (const identity of this.canonicalIdentities.values()) {
      if (identity.normalizedIdentifier === normalizedId || identity.aliases.includes(identifier)) {
        return identity;
      }
    }
    
    return null;
  }

  /**
   * Add evidence to an identity without changing identity
   */
  addEvidence(canonicalId, evidence) {
    const identity = this.canonicalIdentities.get(canonicalId);
    if (!identity) return false;
    
    const evidenceKey = this.createEvidenceKey(evidence);
    
    // Check if evidence already exists
    if (identity.evidence.find(e => e.key === evidenceKey)) {
      return true; // Already exists
    }
    
    const newEvidence = {
      key: evidenceKey,
      type: evidence.type,
      sourceType: evidence.sourceType,
      sourceId: evidence.sourceId,
      sourceDocumentId: evidence.sourceDocumentId,
      sourcePageId: evidence.sourcePageId,
      data: evidence.data,
      extractedIdentifier: this.extractIdentifierFromEvidence(evidence),
      timestamp: evidence.timestamp || new Date().toISOString()
    };
    
    identity.evidence.push(newEvidence);
    
    if (!identity.supportingEvidence.includes(evidenceKey)) {
      identity.supportingEvidence.push(evidenceKey);
    }
    
    const sourceType = evidence.sourceType || evidence.type;
    if (!identity.evidenceSources.includes(sourceType)) {
      identity.evidenceSources.push(sourceType);
    }
    
    // Recalculate confidence
    identity.confidence = this.calculateEvidenceAgreementConfidence(identity);
    
    identity.resolvedAt = new Date().toISOString();
    
    this.canonicalIdentities.set(canonicalId, identity);
    this.evidenceMap.set(evidenceKey, canonicalId);
    
    return true;
  }

  /**
   * Add relationship to an identity without changing identity
   */
  addRelationship(canonicalId, relationship) {
    const identity = this.canonicalIdentities.get(canonicalId);
    if (!identity) return false;
    
    const existingRelSet = new Set(identity.relationships.map(r => JSON.stringify(r)));
    if (!existingRelSet.has(JSON.stringify(relationship))) {
      identity.relationships.push(relationship);
    }
    
    this.canonicalIdentities.set(canonicalId, identity);
    return true;
  }

  /**
   * Get all canonical identities
   */
  getAllIdentities() {
    return Array.from(this.canonicalIdentities.values());
  }

  /**
   * Generate diagnostics
   */
  generateDiagnostics() {
    return {
      canonicalIdentities: this.canonicalIdentities.size,
      supportingEvidence: Array.from(this.evidenceMap.values()).length,
      evidenceSources: this.evidenceSources.size,
      resolvedIdentities: this.canonicalIdentities.size,
      conflicts: this.conflicts.length,
      manualReviewRequired: this.manualReviewRequired.length,
      confidenceBreakdown: this.getConfidenceBreakdown(),
      details: {
        conflicts: this.conflicts,
        manualReviewRequired: this.manualReviewRequired
      }
    };
  }

  getConfidenceBreakdown() {
    const breakdown = { low: 0, medium: 0, high: 0, verified: 0 };
    
    for (const identity of this.canonicalIdentities.values()) {
      if (identity.confidence < 0.5) breakdown.low++;
      else if (identity.confidence < 0.75) breakdown.medium++;
      else if (identity.confidence < 1.0) breakdown.high++;
      else breakdown.verified++;
    }
    
    return breakdown;
  }

  /**
   * Export identity state
   */
  exportState() {
    return {
      canonicalIdentities: Array.from(this.canonicalIdentities.entries()),
      evidenceMap: Array.from(this.evidenceMap.entries()),
      conflicts: this.conflicts,
      manualReviewRequired: this.manualReviewRequired,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import identity state
   */
  importState(state) {
    this.canonicalIdentities = new Map(state.canonicalIdentities);
    this.evidenceMap = new Map(state.evidenceMap);
    this.conflicts = state.conflicts || [];
    this.manualReviewRequired = state.manualReviewRequired || [];
  }

  /**
   * Get merge explanation for an identity
   */
  getMergeExplanation(canonicalId) {
    const identity = this.canonicalIdentities.get(canonicalId);
    if (!identity) return null;
    
    const explanation = {
      canonicalId,
      primaryIdentifier: identity.primaryIdentifier,
      type: identity.type,
      confidence: identity.confidence,
      evidenceCount: identity.evidence.length,
      sourceCount: identity.evidenceSources.length,
      sources: identity.evidenceSources,
      aliases: identity.aliases,
      entities: identity.entities,
      evidenceCitations: identity.evidence.map(e => ({
        type: e.type,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        extractedIdentifier: e.extractedIdentifier,
        timestamp: e.timestamp
      })),
      mergeHistory: identity.mergeHistory
    };
    
    return explanation;
  }
}

export { EvidenceResolutionEngine };
