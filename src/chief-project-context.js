const text = value => value === null || value === undefined ? '' : String(value).trim();

export function buildChiefProjectContext({ projectId, activePageEntityId = '', selectedObjectEntityId = '', selectedPermanentObjectId = '', projectObjectRegistry = null, relationshipEngine, specificationIndex, viewportContext = null, tradeContext = null, requirements = [], linkedPmisRecords = [] } = {}) {
  const project = text(projectId); if (!project || !relationshipEngine) return null;
  const entryIds = [text(selectedObjectEntityId), text(activePageEntityId)].filter(Boolean);
  const entries = entryIds.map(entityId => relationshipEngine.getEntity(entityId)).filter(entity => entity?.projectId === project);
  const relationships = entryIds.flatMap(entityId => relationshipEngine.getRelationships(entityId, { projectId: project, verificationStates: ['confirmed'], limit: 100 }));
  const uniqueRelationships = [...new Map(relationships.map(item => [item.relationshipId, item])).values()];
  const entityIds = new Set(uniqueRelationships.flatMap(item => [item.sourceEntityId, item.targetEntityId]));
  const relatedEntities = [...entityIds].map(entityId => relationshipEngine.getEntity(entityId)).filter(entity => entity?.projectId === project && entity.verificationState !== 'rejected');
  const specifications = relatedEntities.filter(entity => ['specification-section', 'specification-article'].includes(entity.entityType)).map(entity => ({ entity, section: entity.entityType === 'specification-section' ? specificationIndex?.get?.(entity.sourceDocumentId, entity.normalizedKey) || null : null }));
  const verifiedRequirements = (Array.isArray(requirements) ? requirements : []).filter(item => item.status === 'confirmed' && item.projectId === project);
  const permanentObject = text(selectedPermanentObjectId) && projectObjectRegistry?.getObject ? projectObjectRegistry.getObject(selectedPermanentObjectId) : null;
  return structuredClone({ projectId: project, activePage: entries.find(item => item.entityId === activePageEntityId) || null, viewport: viewportContext?.projectId === project ? viewportContext : null, selectedRoomId: viewportContext?.selectedRoomId || null, selectedRegion: viewportContext?.selectedRegion || null,
    selectedObject: permanentObject?.projectId === project && permanentObject.verificationState !== 'rejected' ? permanentObject : entries.find(item => item.entityId === selectedObjectEntityId) || null, trade: tradeContext ? { key: tradeContext.key, label: tradeContext.label, status: tradeContext.status } : null,
    requirements: verifiedRequirements, relationships: uniqueRelationships, relatedEntities, specifications, linkedPmisRecords: (Array.isArray(linkedPmisRecords) ? linkedPmisRecords : []).filter(item => item.projectId === project && item.objectId === permanentObject?.objectId), freshness: permanentObject?.updatedAt || null });
}
