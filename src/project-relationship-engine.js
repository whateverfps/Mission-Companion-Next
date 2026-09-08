const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

export const PROJECT_ENTITY_TYPES = Object.freeze([
  'project', 'building', 'document', 'drawing-set', 'drawing-page', 'drawing-object', 'room', 'equipment',
  'specification-section', 'specification-article', 'inspection', 'photo', 'issue', 'risk', 'RFI', 'submittal',
  'shutdown', 'commissioning-record', 'history-record'
]);
export const PROJECT_RELATIONSHIP_TYPES = Object.freeze([
  'belongs-to', 'located-in', 'appears-on', 'governed-by', 'references', 'related-to', 'serves', 'contains',
  'inspected-by', 'documented-by', 'affected-by', 'resolved-by', 'submitted-under', 'requires', 'supersedes',
  'supplements', 'commissioned-by', 'has-history'
]);
const STATES = new Set(['confirmed', 'suggested', 'rejected', 'historical']);
const ENTITY_ORIGINS = new Set(['imported', 'parser', 'rule', 'manual', 'system']);
const RELATIONSHIP_ORIGINS = new Set(['explicit', 'parser', 'rule', 'manual', 'imported']);
const ACTIVE_STATES = new Set(['confirmed', 'suggested']);
const stateRank = value => ({ confirmed: 0, suggested: 1, historical: 2, rejected: 3 }[value] ?? 4);
const originRank = value => ({ manual: 0, imported: 1, explicit: 2, parser: 3, rule: 4, system: 5 }[value] ?? 6);

function hash(value) {
  let result = 2166136261;
  for (const character of text(value)) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(36);
}

export function stableProjectEntityId(entity = {}) {
  const supplied = text(entity.entityId);
  if (supplied) return supplied;
  const identity = [entity.projectId, entity.entityType, entity.sourceDocumentId, entity.sourcePageId, entity.sourceObjectId, entity.normalizedKey].map(text);
  return identity[0] && identity[1] && identity.slice(2).some(Boolean) ? `project-entity-${hash(identity.join('|'))}` : '';
}

export function normalizeProjectEntity(input = {}, now = () => new Date().toISOString()) {
  const entityType = text(input.entityType);
  const projectId = text(input.projectId);
  if (!projectId || !PROJECT_ENTITY_TYPES.includes(entityType)) return null;
  const entityId = stableProjectEntityId({ ...input, entityType, projectId });
  if (!entityId) return null;
  const verificationState = STATES.has(text(input.verificationState).toLowerCase()) ? text(input.verificationState).toLowerCase() : 'suggested';
  const origin = ENTITY_ORIGINS.has(text(input.origin).toLowerCase()) ? text(input.origin).toLowerCase() : 'system';
  const timestamp = now();
  return {
    entityId, projectId, entityType, sourceDocumentId: text(input.sourceDocumentId) || null, sourcePageId: text(input.sourcePageId) || null,
    sourceObjectId: text(input.sourceObjectId) || null, title: text(input.title || input.label), label: text(input.label || input.title) || entityType,
    normalizedKey: text(input.normalizedKey) || null, metadata: input.metadata && typeof input.metadata === 'object' ? structuredClone(input.metadata) : {},
    verificationState, origin, createdAt: text(input.createdAt) || timestamp, updatedAt: text(input.updatedAt) || timestamp
  };
}

function stableRelationshipId(input = {}) {
  return text(input.relationshipId) || `project-relationship-${hash([input.projectId, input.sourceEntityId, input.targetEntityId, input.relationshipType, input.revisionKey || 'active'].map(text).join('|'))}`;
}

export function normalizeProjectRelationship(input = {}, entities = new Map(), now = () => new Date().toISOString()) {
  const projectId = text(input.projectId);
  const sourceEntityId = text(input.sourceEntityId);
  const targetEntityId = text(input.targetEntityId);
  const relationshipType = text(input.relationshipType);
  const source = entities.get(sourceEntityId); const target = entities.get(targetEntityId);
  if (!projectId || !source || !target || source.projectId !== projectId || target.projectId !== projectId || !PROJECT_RELATIONSHIP_TYPES.includes(relationshipType)) return null;
  const verificationState = STATES.has(text(input.verificationState).toLowerCase()) ? text(input.verificationState).toLowerCase() : 'suggested';
  const origin = RELATIONSHIP_ORIGINS.has(text(input.origin).toLowerCase()) ? text(input.origin).toLowerCase() : 'rule';
  const evidence = list(input.evidence).filter(item => item && typeof item === 'object').map(item => ({ evidenceType: text(item.evidenceType), sourceText: text(item.sourceText), sourceObservationId: text(item.sourceObservationId) || null, graphicalRegion: item.graphicalRegion || null, sourceDocumentId: text(item.sourceDocumentId || input.sourceDocumentId) || null, sourcePageId: text(item.sourcePageId || input.sourcePageId) || null, ruleId: text(item.ruleId), confidenceReason: text(item.confidenceReason) }));
  if (!evidence.length && !['manual', 'imported'].includes(origin)) return null;
  const timestamp = now();
  return {
    relationshipId: stableRelationshipId(input), projectId, sourceEntityId, targetEntityId, relationshipType,
    direction: ['outgoing', 'incoming', 'bidirectional'].includes(input.direction) ? input.direction : 'outgoing', confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
    verificationState, origin, evidence, sourceDocumentId: text(input.sourceDocumentId) || null, sourcePageId: text(input.sourcePageId) || null,
    sourceObjectId: text(input.sourceObjectId) || null, revisionKey: text(input.revisionKey || input.metadata?.revisionKey) || 'active',
    metadata: input.metadata && typeof input.metadata === 'object' ? structuredClone(input.metadata) : {}, createdAt: text(input.createdAt) || timestamp,
    updatedAt: text(input.updatedAt) || timestamp, auditHistory: list(input.auditHistory).map(item => structuredClone(item))
  };
}

export function createProjectRelationshipEngine({ storage = globalThis.localStorage, storageKey = 'mission-companion:project-relationships:v1', now = () => new Date().toISOString(), providers = [] } = {}) {
  const entityMap = new Map(); const relationshipMap = new Map(); const providerList = list(providers).filter(item => typeof item === 'function');
  const failures = [];
  const persist = () => { try { storage?.setItem?.(storageKey, JSON.stringify({ entities: [...entityMap.values()], relationships: [...relationshipMap.values()] })); return true; } catch (error) { failures.push({ provider: 'persistence', message: error?.message || 'Relationship persistence unavailable.' }); return false; } };
  try {
    const saved = JSON.parse(storage?.getItem?.(storageKey) || '{}');
    for (const input of list(saved.entities)) { const entity = normalizeProjectEntity(input, now); if (entity) entityMap.set(entity.entityId, { ...entity, createdAt: input.createdAt, updatedAt: input.updatedAt }); }
    for (const input of list(saved.relationships)) { const relationship = normalizeProjectRelationship(input, entityMap, now); if (relationship) relationshipMap.set(relationship.relationshipId, { ...relationship, createdAt: input.createdAt, updatedAt: input.updatedAt, auditHistory: list(input.auditHistory) }); }
  } catch (error) { failures.push({ provider: 'persistence', message: error?.message || 'Relationship persistence unavailable.' }); }

  const allRelationships = (entityId, options = {}) => {
    const projectId = text(options.projectId || entityMap.get(entityId)?.projectId);
    const states = options.verificationStates ? new Set(list(options.verificationStates)) : new Set(options.includeRejected ? [...STATES] : ['confirmed', 'suggested', 'historical']);
    const types = options.relationshipTypes ? new Set(list(options.relationshipTypes)) : null;
    const direction = text(options.direction);
    return [...relationshipMap.values()].filter(item => item.projectId === projectId && states.has(item.verificationState) && (!types || types.has(item.relationshipType))
      && (!entityId || (direction === 'outgoing' ? item.sourceEntityId === entityId : direction === 'incoming' ? item.targetEntityId === entityId : item.sourceEntityId === entityId || item.targetEntityId === entityId)))
      .sort((a, b) => stateRank(a.verificationState) - stateRank(b.verificationState) || originRank(a.origin) - originRank(b.origin) || b.confidence - a.confidence || a.relationshipId.localeCompare(b.relationshipId));
  };
  const api = {
    registerEntity(input) {
      const entity = normalizeProjectEntity(input, now); if (!entity) return null;
      const current = entityMap.get(entity.entityId);
      if (current?.origin === 'manual' && entity.origin !== 'manual') return structuredClone(current);
      entityMap.set(entity.entityId, { ...entity, createdAt: current?.createdAt || entity.createdAt }); persist(); return structuredClone(entityMap.get(entity.entityId));
    },
    registerEntities(inputs = []) {
      const results = [];
      for (const input of list(inputs)) {
        const entity = normalizeProjectEntity(input, now); if (!entity) continue;
        const current = entityMap.get(entity.entityId);
        const value = current?.origin === 'manual' && entity.origin !== 'manual' ? current : { ...entity, createdAt: current?.createdAt || entity.createdAt };
        entityMap.set(value.entityId, value); results.push(structuredClone(value));
      }
      if (results.length) persist(); return results;
    },
    getEntity(entityId) { const entity = entityMap.get(text(entityId)); return entity ? structuredClone(entity) : null; },
    entities({ projectId = '', entityTypes = [], verificationStates = ['confirmed', 'suggested', 'historical'] } = {}) {
      const types = new Set(entityTypes); const states = new Set(verificationStates);
      return [...entityMap.values()].filter(item => (!projectId || item.projectId === projectId) && (!types.size || types.has(item.entityType)) && states.has(item.verificationState)).sort((a, b) => stateRank(a.verificationState) - stateRank(b.verificationState) || a.label.localeCompare(b.label) || a.entityId.localeCompare(b.entityId)).map(item => structuredClone(item));
    },
    registerRelationship(input) {
      const candidate = normalizeProjectRelationship(input, entityMap, now); if (!candidate) return null;
      const sameKey = [...relationshipMap.values()].filter(item => item.projectId === candidate.projectId && item.sourceEntityId === candidate.sourceEntityId && item.targetEntityId === candidate.targetEntityId && item.relationshipType === candidate.relationshipType && item.revisionKey === candidate.revisionKey);
      const protectedDecision = sameKey.find(item => item.origin === 'manual' && item.verificationState === 'rejected');
      if (protectedDecision && candidate.origin !== 'manual') return structuredClone(protectedDecision);
      const duplicate = sameKey.find(item => item.verificationState === candidate.verificationState && item.origin === candidate.origin);
      if (duplicate) return structuredClone(duplicate);
      if (sameKey.length && ACTIVE_STATES.has(candidate.verificationState)) candidate.relationshipId = `${candidate.relationshipId}:${candidate.verificationState}:${candidate.origin}`;
      if (candidate.origin === 'manual' && !candidate.auditHistory.length) candidate.auditHistory.push({ priorState: null, newState: candidate.verificationState, source: text(candidate.metadata?.createdBy || 'manual'), note: text(candidate.metadata?.note), time: candidate.createdAt });
      relationshipMap.set(candidate.relationshipId, candidate); persist(); return structuredClone(candidate);
    },
    removeRelationship(relationshipId) { const item = relationshipMap.get(text(relationshipId)); if (!item || item.origin !== 'manual') return false; relationshipMap.delete(item.relationshipId); persist(); return true; },
    getRelationships(entityId, options = {}) { return allRelationships(text(entityId), options).slice(0, Math.max(1, Math.min(500, Number(options.limit) || 100))).map(item => structuredClone(item)); },
    getRelatedEntities(entityId, options = {}) {
      const source = entityMap.get(text(entityId)); if (!source) return [];
      const types = new Set(list(options.entityTypes));
      return allRelationships(source.entityId, options).map(relationship => {
        const relatedId = relationship.sourceEntityId === source.entityId ? relationship.targetEntityId : relationship.sourceEntityId;
        const entity = entityMap.get(relatedId); return entity && (!types.size || types.has(entity.entityType)) ? { entity: structuredClone(entity), relationship: structuredClone(relationship) } : null;
      }).filter(Boolean).slice(0, Math.max(1, Math.min(500, Number(options.limit) || 100)));
    },
    getInheritedRelatedEntities(entityId, { rules = [], limit = 100 } = {}) {
      const source = entityMap.get(text(entityId)); if (!source) return [];
      const results = [];
      for (const rule of list(rules)) {
        if (rule.sourceEntityType && rule.sourceEntityType !== source.entityType) continue;
        const parents = api.getRelatedEntities(source.entityId, { projectId: source.projectId, relationshipTypes: list(rule.viaRelationshipTypes), entityTypes: list(rule.inheritedFromEntityTypes), verificationStates: ['confirmed'], limit });
        for (const parent of parents) {
          const inherited = api.getRelatedEntities(parent.entity.entityId, { projectId: source.projectId, relationshipTypes: list(rule.relationshipTypes), entityTypes: list(rule.targetEntityTypes), verificationStates: ['confirmed'], limit });
          for (const item of inherited) results.push({ ...item, inheritedFromEntityId: parent.entity.entityId, inheritanceRule: text(rule.ruleId), confidence: Math.min(parent.relationship.confidence || 1, item.relationship.confidence || 1), reason: text(rule.reason) });
        }
      }
      return results.sort((a, b) => a.inheritanceRule.localeCompare(b.inheritanceRule) || a.entity.label.localeCompare(b.entity.label)).slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
    },
    getRelationshipPath(sourceId, targetId, options = {}) {
      const source = entityMap.get(text(sourceId)); const target = entityMap.get(text(targetId));
      if (!source || !target || source.projectId !== target.projectId) return null;
      const maxDepth = Math.max(1, Math.min(6, Number(options.maxDepth) || 3)); const limit = Math.max(1, Math.min(100, Number(options.limit) || 25));
      const queue = [{ entityId: source.entityId, entities: [source.entityId], relationships: [] }]; const visited = new Set([source.entityId]); let examined = 0;
      while (queue.length && examined < limit) {
        const current = queue.shift(); examined += 1;
        if (current.entityId === target.entityId) return { projectId: source.projectId, entityIds: current.entities, relationships: current.relationships.map(item => structuredClone(item)) };
        if (current.relationships.length >= maxDepth) continue;
        for (const edge of allRelationships(current.entityId, { ...options, projectId: source.projectId })) {
          const next = edge.sourceEntityId === current.entityId ? edge.targetEntityId : edge.sourceEntityId;
          if (visited.has(next)) continue; visited.add(next); queue.push({ entityId: next, entities: [...current.entities, next], relationships: [...current.relationships, edge] });
        }
      }
      return null;
    },
    confirmRelationship(relationshipId, metadata = {}) { return api.setRelationshipState(relationshipId, 'confirmed', metadata); },
    rejectRelationship(relationshipId, metadata = {}) { return api.setRelationshipState(relationshipId, 'rejected', metadata); },
    setRelationshipState(relationshipId, verificationState, metadata = {}) {
      const current = relationshipMap.get(text(relationshipId)); if (!current || !STATES.has(verificationState)) return null;
      const timestamp = now(); const next = { ...current, verificationState, origin: metadata.origin === 'manual' ? 'manual' : current.origin, updatedAt: timestamp,
        auditHistory: [...current.auditHistory, { priorState: current.verificationState, newState: verificationState, source: text(metadata.source || metadata.origin || 'manual'), note: text(metadata.note), time: timestamp }] };
      relationshipMap.set(current.relationshipId, next); persist(); return structuredClone(next);
    },
    getRelationshipHistory(relationshipId) { return structuredClone(relationshipMap.get(text(relationshipId))?.auditHistory || []); },
    getConflicts(entityId = '') {
      const candidates = allRelationships(text(entityId), { includeRejected: true, limit: 500 }); const groups = new Map();
      for (const item of candidates) { const key = [item.projectId, item.sourceEntityId, item.targetEntityId, item.relationshipType, item.revisionKey].join('|'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); }
      return [...groups.entries()].filter(([, items]) => new Set(items.map(item => `${item.verificationState}:${item.origin}`)).size > 1).map(([conflictId, items]) => ({ conflictId, relationships: items.map(item => structuredClone(item)), preferredRelationshipId: [...items].sort((a, b) => stateRank(a.verificationState) - stateRank(b.verificationState) || originRank(a.origin) - originRank(b.origin))[0].relationshipId }));
    },
    registerProvider(provider) { if (typeof provider !== 'function') return false; providerList.push(provider); return true; },
    queryProviders(context = {}) {
      const results = [];
      for (const provider of providerList) { try { results.push(...list(provider(structuredClone(context)))); } catch (error) { failures.push({ provider: text(provider.name) || 'anonymous', message: error?.message || 'Relationship provider unavailable.' }); } }
      return { results: structuredClone(results), failures: structuredClone(failures) };
    },
    failures() { return structuredClone(failures); }
  };
  return api;
}

export function relationshipContextGroups(engine, entityId) {
  const groups = { confirmedSpecifications: [], suggestedSpecifications: [], relatedDrawings: [], rooms: [], equipment: [], inspections: [], photos: [], issues: [], risks: [], rfis: [], submittals: [], shutdowns: [], commissioning: [], history: [], providerErrors: engine?.failures?.() || [] };
  const names = { 'drawing-page': 'relatedDrawings', room: 'rooms', equipment: 'equipment', inspection: 'inspections', photo: 'photos', issue: 'issues', risk: 'risks', RFI: 'rfis', submittal: 'submittals', shutdown: 'shutdowns', 'commissioning-record': 'commissioning', 'history-record': 'history' };
  for (const item of engine?.getRelatedEntities?.(entityId, { includeRejected: false, limit: 200 }) || []) {
    if (item.entity.entityType === 'specification-section' || item.entity.entityType === 'specification-article') groups[item.relationship.verificationState === 'confirmed' ? 'confirmedSpecifications' : 'suggestedSpecifications'].push(item);
    else if (names[item.entity.entityType]) groups[names[item.entity.entityType]].push(item);
  }
  return groups;
}

export function adaptDrawingSpecificationLinks(engine, links = [], { pageEntityId = '', objectEntityIds = new Map() } = {}) {
  const created = [];
  for (const link of list(links)) {
    const sectionEntity = engine.getEntity(`specification-section:${link.specificationDocumentId}:${normalizeNumber(link.sectionNumber)}`);
    const sourceEntityId = objectEntityIds.get(link.objectId) || pageEntityId;
    if (!sectionEntity || !sourceEntityId) continue;
    if (link.status === 'rejected') {
      for (const existing of engine.getRelationships(sourceEntityId, { includeRejected: true, relationshipTypes: ['governed-by'], limit: 200 }).filter(item => item.targetEntityId === sectionEntity.entityId)) engine.rejectRelationship(existing.relationshipId, { origin: 'manual', source: 'drawing-spec-link', note: link.note || 'Specification link rejected.' });
      continue;
    }
    const relationship = engine.registerRelationship({ projectId: link.projectId, sourceEntityId, targetEntityId: sectionEntity.entityId, relationshipType: 'governed-by', confidence: link.confidence,
      verificationState: link.status === 'confirmed' ? 'confirmed' : 'suggested', origin: link.origin === 'manual' ? 'manual' : link.origin === 'explicit' ? 'explicit' : 'rule', sourceDocumentId: link.drawingDocumentId,
      sourcePageId: link.drawingPageId, sourceObjectId: link.objectId, evidence: link.origin === 'manual' ? [] : [{ evidenceType: link.evidenceSource, sourceText: link.evidenceText, sourceDocumentId: link.drawingDocumentId, sourcePageId: link.drawingPageId, ruleId: link.origin, confidenceReason: link.origin === 'explicit' ? 'Exact printed specification reference.' : 'Project vocabulary suggestion.' }] });
    if (relationship) created.push(relationship);
  }
  return created;
}

const normalizeNumber = value => text(value).replace(/\D/g, '');
