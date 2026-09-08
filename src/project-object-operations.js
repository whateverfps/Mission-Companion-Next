const text = value => value === null || value === undefined ? '' : String(value).trim();
export const PROJECT_OBJECT_OPERATION_TYPES = Object.freeze(['pmis-building', 'work-package', 'readiness-gate', 'risk', 'open-question', 'shutdown', 'inspection', 'schedule-activity', 'procurement-item', 'commissioning-gate', 'progress-metric']);

export function createProjectObjectOperationLink({ objectId, projectId, operationType, recordId, relationshipType = 'related-to', metadata = {} } = {}) {
  if (!text(objectId) || !text(projectId) || !PROJECT_OBJECT_OPERATION_TYPES.includes(text(operationType)) || !text(recordId)) return null;
  return Object.freeze({ objectId: text(objectId), projectId: text(projectId), operationType: text(operationType), recordId: text(recordId), relationshipType: text(relationshipType), metadata: structuredClone(metadata) });
}

export function projectObjectEntity(object = {}) {
  if (!text(object.objectId) || !text(object.projectId)) return null;
  return { entityId: `drawing-object:${text(object.objectId)}`, projectId: text(object.projectId), entityType: 'drawing-object', sourceDocumentId: text(object.drawingDocumentId), sourcePageId: text(object.drawingPageId), sourceObjectId: text(object.objectId), title: text(object.label), label: text(object.label), normalizedKey: text(object.normalizedKey), metadata: { objectId: text(object.objectId), objectType: text(object.objectType), trade: text(object.trade), system: text(object.system), tag: text(object.tag), roomId: text(object.roomId) }, verificationState: text(object.verificationState) || 'candidate', origin: object.identitySource === 'manual' ? 'manual' : object.identitySource === 'imported' ? 'imported' : 'parser', createdAt: object.createdAt, updatedAt: object.updatedAt };
}

export function registerProjectObjectRelationships(object, relationshipEngine, { pageEntityId = '', roomEntityId = '' } = {}) {
  const entity = projectObjectEntity(object); if (!entity || !relationshipEngine?.registerEntity) return null;
  relationshipEngine.registerEntity(entity);
  if (text(pageEntityId)) relationshipEngine.registerRelationship({ projectId: entity.projectId, sourceEntityId: text(pageEntityId), targetEntityId: entity.entityId, relationshipType: 'contains', direction: 'outbound', confidence: 1, verificationState: object.verificationState === 'confirmed' ? 'confirmed' : 'suggested', origin: object.identitySource === 'manual' ? 'manual' : 'parser', evidence: object.identitySource === 'manual' ? [] : object.evidence, sourceDocumentId: object.drawingDocumentId, sourcePageId: object.drawingPageId, sourceObjectId: object.objectId });
  if (text(roomEntityId)) relationshipEngine.registerRelationship({ projectId: entity.projectId, sourceEntityId: entity.entityId, targetEntityId: text(roomEntityId), relationshipType: 'located-in', direction: 'outbound', confidence: object.confidence, verificationState: object.verificationState === 'confirmed' ? 'confirmed' : 'suggested', origin: object.identitySource === 'manual' ? 'manual' : 'parser', evidence: object.identitySource === 'manual' ? [] : object.evidence, sourceDocumentId: object.drawingDocumentId, sourcePageId: object.drawingPageId, sourceObjectId: object.objectId });
  return entity;
}

export function preserveProjectObjectMerge({ primary, secondary, relationshipEngine, specificationLinks } = {}) {
  if (!primary?.objectId || !secondary?.objectId || primary.projectId !== secondary.projectId) return { relationships: [], specificationLinks: [] };
  const primaryEntity = projectObjectEntity(primary); const secondaryEntityId = `drawing-object:${secondary.objectId}`;
  relationshipEngine?.registerEntity?.(primaryEntity);
  const movedRelationships = [];
  for (const relationship of relationshipEngine?.getRelationships?.(secondaryEntityId, { projectId: primary.projectId, includeRejected: true, limit: 500 }) || []) {
    if (relationship.verificationState === 'rejected') continue;
    const sourceEntityId = relationship.sourceEntityId === secondaryEntityId ? primaryEntity.entityId : relationship.sourceEntityId;
    const targetEntityId = relationship.targetEntityId === secondaryEntityId ? primaryEntity.entityId : relationship.targetEntityId;
    const moved = relationshipEngine.registerRelationship({ ...relationship, relationshipId: '', sourceEntityId, targetEntityId, sourceObjectId: primary.objectId, metadata: { ...relationship.metadata, mergedFromObjectId: secondary.objectId } });
    if (moved) movedRelationships.push(moved);
    relationshipEngine.setRelationshipState?.(relationship.relationshipId, 'historical', { origin: 'manual', source: 'project-object-merge', note: `Moved to ${primary.objectId}` });
  }
  const movedLinks = [];
  for (const link of specificationLinks?.forPage?.(secondary.drawingPageId, secondary.objectId) || []) {
    const { linkId: _linkId, ...copy } = link;
    const moved = specificationLinks.link?.({ ...copy, objectId: primary.objectId, origin: link.origin === 'manual' ? 'manual' : link.origin });
    if (moved) movedLinks.push(moved);
  }
  return { relationships: movedRelationships, specificationLinks: movedLinks };
}
