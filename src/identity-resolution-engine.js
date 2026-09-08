import { createConstructionGraph } from './construction-graph.js';

class IdentityResolutionEngine {
  constructor() {
    this.canonicalIdentities = new Map(); // canonicalId -> Identity
    this.aliasMap = new Map(); // alias -> canonicalId
    this.conflicts = [];
    this.manualReviewRequired = [];
  }

  /**
   * Extract identity patterns from entity attributes
   */
  extractIdentityPatterns(entity) {
    const patterns = [];
    
    // Extract from label/title
    if (entity.attributes?.label) {
      patterns.push(...this.extractPatternsFromText(entity.attributes.label));
    }
    
    // Extract from tag
    if (entity.attributes?.tag) {
      patterns.push(...this.extractPatternsFromText(entity.attributes.tag));
    }
    
    // Extract from number
    if (entity.attributes?.number) {
      patterns.push(entity.attributes.number);
    }
    
    // Extract from identifier
    if (entity.attributes?.identifier) {
      patterns.push(entity.attributes.identifier);
    }
    
    // Extract from normalized key
    if (entity.attributes?.normalizedKey) {
      patterns.push(entity.attributes.normalizedKey);
    }
    
    return [...new Set(patterns)]; // Deduplicate
  }

  extractPatternsFromText(text) {
    const patterns = [];
    const cleanText = text?.toString().trim() || '';
    
    if (!cleanText) return patterns;
    
    // Extract numeric patterns (e.g., "17", "FD-17", "AHU-2")
    const numericPatterns = cleanText.match(/\b[A-Z]*-?\d+|[A-Z]+\d+\b/gi);
    if (numericPatterns) {
      patterns.push(...numericPatterns);
    }
    
    // Extract base identifier (letters + numbers)
    const baseId = cleanText.replace(/[^a-zA-Z0-9]/g, '');
    if (baseId.length >= 2) {
      patterns.push(baseId);
    }
    
    // Extract with common prefixes removed
    const prefixes = ['door', 'wall', 'window', 'equipment', 'device', 'panel', 'conduit', 'duct', 'pipe', 'fire', 'cable', 'fixture'];
    const lowerText = cleanText.toLowerCase();
    for (const prefix of prefixes) {
      if (lowerText.startsWith(prefix)) {
        patterns.push(cleanText.substring(prefix.length).trim());
      }
    }
    
    return patterns;
  }

  /**
   * Normalize an identifier to canonical form
   */
  normalizeIdentifier(identifier) {
    if (!identifier) return null;
    
    // Remove special characters, normalize case
    const normalized = identifier
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    
    return normalized || null;
  }

  /**
   * Calculate similarity between two identifiers
   */
  calculateSimilarity(id1, id2) {
    if (!id1 || !id2) return 0;
    
    const norm1 = this.normalizeIdentifier(id1);
    const norm2 = this.normalizeIdentifier(id2);
    
    if (!norm1 || !norm2) return 0;
    
    // Exact match
    if (norm1 === norm2) return 1.0;
    
    // One contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;
    
    // Levenshtein distance-like comparison
    const longer = norm1.length > norm2.length ? norm1 : norm2;
    const shorter = norm1.length > norm2.length ? norm2 : norm1;
    
    if (longer.length === 0) return 0;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    return matches / longer.length;
  }

  /**
   * Resolve entity to canonical identity
   */
  resolveEntity(entity) {
    const patterns = this.extractIdentityPatterns(entity);
    
    if (patterns.length === 0) {
      // No identity patterns - generate a new canonical ID
      return this.createCanonicalIdentity(entity, []);
    }
    
    // Check for existing canonical identities
    for (const pattern of patterns) {
      const existingId = this.aliasMap.get(pattern);
      if (existingId) {
        // Found existing identity - merge evidence
        return this.mergeWithCanonicalIdentity(existingId, entity, pattern);
      }
    }
    
    // Check for partial matches
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [canonicalId, identity] of this.canonicalIdentities) {
      for (const pattern of patterns) {
        const similarity = this.calculateSimilarity(pattern, canonicalId);
        if (similarity > bestSimilarity && similarity >= 0.7) {
          bestSimilarity = similarity;
          bestMatch = canonicalId;
        }
      }
    }
    
    if (bestMatch && bestSimilarity >= 0.8) {
      // High confidence match - merge
      return this.mergeWithCanonicalIdentity(bestMatch, entity, patterns[0]);
    } else if (bestMatch && bestSimilarity >= 0.7) {
      // Medium confidence - mark for review
      this.manualReviewRequired.push({
        entityId: entity.id,
        canonicalId: bestMatch,
        similarity: bestSimilarity,
        patterns,
        reason: 'Medium confidence match requiring manual review'
      });
      return this.mergeWithCanonicalIdentity(bestMatch, entity, patterns[0]);
    }
    
    // No match - create new canonical identity
    return this.createCanonicalIdentity(entity, patterns);
  }

  /**
   * Create a new canonical identity
   */
  createCanonicalIdentity(entity, patterns) {
    // Use the first pattern as canonical ID, or generate one
    const canonicalId = patterns.length > 0 
      ? this.normalizeIdentifier(patterns[0])
      : `ENTITY-${entity.id}`;
    
    const identity = {
      canonicalId,
      type: entity.type,
      primaryId: patterns[0] || entity.id,
      aliases: [...new Set([entity.id, ...patterns])],
      entities: [entity.id],
      attributes: { ...entity.attributes },
      evidence: [{
        type: 'creation',
        sourceEntity: entity.id,
        sourceSystem: entity.attributes?.sourceSystem || 'unknown',
        timestamp: new Date().toISOString()
      }],
      relationships: entity.relationships || [],
      confidence: 1.0,
      resolvedAt: new Date().toISOString()
    };
    
    this.canonicalIdentities.set(canonicalId, identity);
    
    // Register all aliases
    for (const alias of identity.aliases) {
      const normAlias = this.normalizeIdentifier(alias);
      if (normAlias) {
        this.aliasMap.set(normAlias, canonicalId);
      }
    }
    
    return identity;
  }

  /**
   * Merge entity with existing canonical identity
   */
  mergeWithCanonicalIdentity(canonicalId, entity, matchPattern) {
    const identity = this.canonicalIdentities.get(canonicalId);
    
    if (!identity) {
      return this.createCanonicalIdentity(entity, [matchPattern]);
    }
    
    // Add entity ID if not already present
    if (!identity.entities.includes(entity.id)) {
      identity.entities.push(entity.id);
    }
    
    // Add aliases
    const patterns = this.extractIdentityPatterns(entity);
    for (const pattern of patterns) {
      if (!identity.aliases.includes(pattern)) {
        identity.aliases.push(pattern);
        const normAlias = this.normalizeIdentifier(pattern);
        if (normAlias) {
          this.aliasMap.set(normAlias, canonicalId);
        }
      }
    }
    
    // Merge attributes (canonical wins for conflicts)
    identity.attributes = { ...identity.attributes, ...entity.attributes };
    
    // Add evidence
    identity.evidence.push({
      type: 'identity-merge',
      sourceEntity: entity.id,
      matchPattern,
      sourceSystem: entity.attributes?.sourceSystem || 'unknown',
      timestamp: new Date().toISOString()
    });
    
    // Merge relationships
    const existingRelSet = new Set(identity.relationships.map(r => JSON.stringify(r)));
    for (const rel of entity.relationships || []) {
      if (!existingRelSet.has(JSON.stringify(rel))) {
        identity.relationships.push(rel);
      }
    }
    
    // Update confidence based on match quality
    const similarity = this.calculateSimilarity(matchPattern, canonicalId);
    identity.confidence = Math.min(identity.confidence, similarity);
    
    identity.resolvedAt = new Date().toISOString();
    
    this.canonicalIdentities.set(canonicalId, identity);
    
    return identity;
  }

  /**
   * Get canonical identity for an entity
   */
  getCanonicalIdentity(entityId) {
    // Check direct alias map
    const normId = this.normalizeIdentifier(entityId);
    if (normId) {
      const canonicalId = this.aliasMap.get(normId);
      if (canonicalId) {
        return this.canonicalIdentities.get(canonicalId);
      }
    }
    
    // Search in identities
    for (const identity of this.canonicalIdentities.values()) {
      if (identity.entities.includes(entityId) || identity.aliases.includes(entityId)) {
        return identity;
      }
    }
    
    return null;
  }

  /**
   * Resolve multiple entities at once
   */
  resolveEntities(entities) {
    const resolved = new Map();
    
    for (const entity of entities) {
      const identity = this.resolveEntity(entity);
      resolved.set(entity.id, identity);
    }
    
    return resolved;
  }

  /**
   * Generate diagnostics
   */
  generateDiagnostics() {
    return {
      canonicalIdentities: this.canonicalIdentities.size,
      resolvedIdentities: this.canonicalIdentities.size,
      unresolvedAliases: this.countUnresolvedAliases(),
      conflictingIdentities: this.conflicts.length,
      duplicateEvidence: this.countDuplicateEvidence(),
      manualReviewRequired: this.manualReviewRequired.length,
      details: {
        conflicts: this.conflicts,
        manualReviewRequired: this.manualReviewRequired
      }
    };
  }

  countUnresolvedAliases() {
    // Count entities that couldn't be resolved
    let count = 0;
    for (const identity of this.canonicalIdentities.values()) {
      if (identity.confidence < 0.8) {
        count++;
      }
    }
    return count;
  }

  countDuplicateEvidence() {
    let count = 0;
    for (const identity of this.canonicalIdentities.values()) {
      const evidenceTypes = new Set(identity.evidence.map(e => e.type));
      if (evidenceTypes.size < identity.evidence.length) {
        count += identity.evidence.length - evidenceTypes.size;
      }
    }
    return count;
  }

  /**
   * Get identity for a given identifier (alias resolution)
   */
  resolveIdentifier(identifier) {
    const normId = this.normalizeIdentifier(identifier);
    if (!normId) return null;
    
    const canonicalId = this.aliasMap.get(normId);
    if (canonicalId) {
      return this.canonicalIdentities.get(canonicalId);
    }
    
    return null;
  }

  /**
   * Merge evidence for an entity without changing identity
   */
  addEvidence(canonicalId, evidence) {
    const identity = this.canonicalIdentities.get(canonicalId);
    if (!identity) return false;
    
    identity.evidence.push({
      ...evidence,
      timestamp: new Date().toISOString()
    });
    
    this.canonicalIdentities.set(canonicalId, identity);
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
   * Export identity state
   */
  exportState() {
    return {
      canonicalIdentities: Array.from(this.canonicalIdentities.entries()),
      aliasMap: Array.from(this.aliasMap.entries()),
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
    this.aliasMap = new Map(state.aliasMap);
    this.conflicts = state.conflicts || [];
    this.manualReviewRequired = state.manualReviewRequired || [];
  }
}

export { IdentityResolutionEngine };
