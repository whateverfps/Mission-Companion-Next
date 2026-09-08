export const asString = value => value === null || value === undefined ? '' : String(value).trim();
export const asArray = value => Array.isArray(value) ? value : [];
export const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = asString;
const list = asArray;
const SCOPES = new Set(['project-wide', 'building-wide', 'page-wide', 'room-wide', 'object-specific', 'selected-region-candidate']);
const STATUSES = new Set(['confirmed', 'suggested', 'rejected']);

function requirementId(input) {
  return `drawing-requirement:${[input.projectId, input.scope, input.sourceObjectId || input.sourceRoomId || input.sourcePageId, input.specificationDocumentId, input.sectionNumber, input.articleId].map(text).join(':')}`;
}

export function createRequirementRecord(input = {}, specificationIndex) {
  input = asObject(input);
  const section = specificationIndex?.get?.(input.specificationDocumentId, input.sectionNumber);
  const scope = SCOPES.has(input.applicabilityScope) ? input.applicabilityScope : '';
  const status = STATUSES.has(input.status) ? input.status : 'suggested';
  if (!text(input.projectId) || !section || section.projectId !== text(input.projectId) || !scope || !text(input.evidenceType) || (!text(input.evidenceText) && input.origin !== 'manual')) return null;
  let articles = []; try { articles = list(section.articles); } catch { articles = []; }
  const article = input.articleId ? articles.find(item => item?.id === input.articleId) : null;
  return {
    requirementId: text(input.requirementId) || requirementId({ ...input, sectionNumber: section.sectionNumber }), projectId: text(input.projectId),
    relationshipId: text(input.relationshipId) || null, drawingSpecLinkId: text(input.drawingSpecLinkId) || null,
    sourceDocumentId: text(input.sourceDocumentId) || null, sourcePageId: text(input.sourcePageId) || null, sourceObjectId: text(input.sourceObjectId) || null, sourceRoomId: text(input.sourceRoomId) || null,
    evidenceType: text(input.evidenceType), evidenceText: text(input.evidenceText), graphicalRegion: input.graphicalRegion || null,
    specificationDocumentId: section.documentId, sectionNumber: section.sectionNumber, sectionTitle: section.sectionTitle,
    article: article ? structuredClone(article) : null, applicabilityScope: scope, confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)), status,
    reason: text(input.reason), origin: text(input.origin || 'relationship'), tradeChannels: list(input.tradeChannels).map(text).filter(Boolean),
    baselineSource: input.baselineSource ? structuredClone(input.baselineSource) : { documentId: section.documentId, sectionNumber: section.sectionNumber, revisionSource: section.revisionSource || null },
    modifications: list(input.modifications).map(item => structuredClone(item)), procurement: input.procurement ? structuredClone(input.procurement) : null, schedule: input.schedule ? structuredClone(input.schedule) : null
  };
}

function scopeFor(entity) {
  if (!entity) return '';
  if (entity.entityType === 'drawing-object' || entity.entityType === 'equipment') return 'object-specific';
  if (entity.entityType === 'room') return 'room-wide';
  if (entity.entityType === 'drawing-page') return 'page-wide';
  if (entity.entityType === 'building') return 'building-wide';
  if (entity.entityType === 'project') return 'project-wide';
  return '';
}

function sectionCategory(section) {
  const categories = new Set(list(section?.articles).map(item => text(item?.kind)).filter(Boolean));
  return { submittals: categories.has('submittal'), quality: categories.has('quality assurance'), testing: categories.has('testing'), inspection: categories.has('inspection'), commissioning: categories.has('commissioning'), closeout: categories.has('closeout') };
}

const perfNow = () => globalThis.performance?.now?.() ?? Date.now();
const diagnosticsEnabled = globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED === true;
const logSlowOperation = (name, startedAt, details = {}) => {
  if (!diagnosticsEnabled) return Math.max(0, perfNow() - startedAt);
  const elapsed = Math.max(0, perfNow() - startedAt);
  if (elapsed > 10) console.warn(name, elapsed, { ...details, stack: new Error().stack });
  return elapsed;
};

export function createDrawingRequirementsResolver({ specificationIndex, relationshipEngine, providers = [], onMetric = () => {}, now = () => Date.now() } = {}) {
  const cache = new Map(); let generation = 0;
  const providerList = list(providers).filter(item => typeof item === 'function');
  const emptyFieldRequirements = () => ({ submittals: [], 'quality assurance': [], quality: [], 'products/materials': [], execution: [], 'examination/preparation': [], installation: [], testing: [], inspection: [], protection: [], commissioning: [], closeout: [] });
  const unavailable = (input, message, providerFailures = []) => ({ status: 'unavailable', projectId: text(input?.projectId), contextSourceEntityId: null, tradeChannel: text(input?.tradeChannel?.key) || 'all-trades', governingDrawings: [], requirements: [], confirmedSpecifications: [], suggestedSpecifications: [], projectWideRequirements: [], fieldRequirements: emptyFieldRequirements(), warnings: [message], providerFailures, diagnostics: { skippedRecordCount: 0, providerFailureCount: providerFailures.length }, resolvedAt: new Date().toISOString() });
  const resolveCore = rawInput => {
    const input = asObject(rawInput); const started = now(); const projectId = text(input.projectId); const rawTrade = asObject(input.tradeChannel);
    const trade = { key: text(rawTrade.key) || 'all-trades', divisions: list(rawTrade.divisions).map(text).filter(Boolean) };
    if (typeof specificationIndex?.get !== 'function') return unavailable(input, 'Specification index is unavailable.', [{ provider: 'specification-index', code: 'construction-intelligence-provider-failure', message: 'Specification index is unavailable.', contained: true }]);
    const sourceIds = [text(input.selectedObjectEntityId), text(input.selectedRoomEntityId), text(input.pageEntityId)].filter(Boolean);
    const cacheKey = JSON.stringify([projectId, sourceIds, trade.key, input.viewportContext?.selectedRegion, list(input.drawingSpecLinks).map(item => [item?.linkId, item?.status, item?.updatedAt]), list(input.projectWideRequirements).map(item => [item?.sectionNumber, item?.status])]);
    if (cache.has(cacheKey)) return structuredClone(cache.get(cacheKey));
    const requirements = []; const governingDrawings = []; const warnings = []; const providerFailures = []; let skippedRecordCount = 0;
    const providerFailure = (provider, error) => { const failure = { provider, code: 'construction-intelligence-provider-failure', message: error?.message || String(error), contained: true }; providerFailures.push(failure); warnings.push(failure.message); };
    const relatedEntities = (provider, entityId, options) => { if (!entityId || typeof relationshipEngine?.getRelatedEntities !== 'function') return []; try { return list(relationshipEngine.getRelatedEntities(entityId, options)).filter(item => item && typeof item === 'object'); } catch (error) { providerFailure(provider, error); return []; } };
    const chosenSourceId = sourceIds[0]; const chosenSource = relationshipEngine?.getEntity?.(chosenSourceId);
    const relatedDrawingsStartedAt = perfNow();
    if (input.pageEntityId) {
      const page = relationshipEngine?.getEntity?.(input.pageEntityId);
      if (page) governingDrawings.push({ entity: page, relationship: null, status: page.verificationState, reason: 'Current active drawing page.' });
      let relatedDrawingCount = 0;
      for (const related of relatedEntities('related-drawings', input.pageEntityId, { projectId, entityTypes: ['drawing-page'], verificationStates: ['confirmed', 'suggested'], limit: 50 })) { relatedDrawingCount += 1; if (related.relationship) governingDrawings.push({ ...related, status: related.relationship.verificationState, reason: list(related.relationship.evidence)[0]?.confidenceReason || 'Explicit drawing relationship.' }); else skippedRecordCount += 1; }
      logSlowOperation('governing drawings', relatedDrawingsStartedAt, { iterationCount: relatedDrawingCount, governingDrawingCount: governingDrawings.length, pageEntityId: input.pageEntityId });
    }
    const requirementRelationshipsStartedAt = perfNow();
    let requirementRelationshipCount = 0;
    for (const related of relatedEntities('requirement-relationships', chosenSourceId, { projectId, entityTypes: ['specification-section', 'specification-article'], relationshipTypes: ['governed-by', 'requires', 'references'], verificationStates: ['confirmed', 'suggested'], limit: 100 })) {
      requirementRelationshipCount += 1;
      if (!related.entity || !related.relationship) { skippedRecordCount += 1; continue; }
      const sectionEntity = related.entity.entityType === 'specification-section' ? related.entity : relatedEntities('specification-article-parent', related.entity.entityId, { projectId, entityTypes: ['specification-section'], relationshipTypes: ['belongs-to'], verificationStates: ['confirmed'], limit: 1 })[0]?.entity;
      if (!sectionEntity) continue;
      const evidence = related.relationship.evidence?.[0] || {};
      const record = createRequirementRecord({ projectId, sourceDocumentId: related.relationship.sourceDocumentId || chosenSource?.sourceDocumentId, sourcePageId: related.relationship.sourcePageId || input.viewportContext?.pageId, sourceObjectId: chosenSource?.entityType === 'drawing-object' ? chosenSource.sourceObjectId : null, sourceRoomId: chosenSource?.entityType === 'room' ? chosenSource.entityId : null,
        specificationDocumentId: sectionEntity.sourceDocumentId, sectionNumber: sectionEntity.normalizedKey, articleId: related.entity.entityType === 'specification-article' ? related.entity.normalizedKey : '', applicabilityScope: scopeFor(chosenSource),
        evidenceType: evidence.evidenceType || (related.relationship.origin === 'manual' ? 'manual confirmation' : 'relationship evidence'), evidenceText: evidence.sourceText || related.relationship.metadata?.note || 'Authoritative manually linked project relationship.', graphicalRegion: evidence.graphicalRegion,
        confidence: related.relationship.confidence, status: related.relationship.verificationState, reason: evidence.confidenceReason || `${related.relationship.relationshipType} relationship from ${chosenSource?.label || 'active context'}.`, origin: related.relationship.origin, tradeChannels: list(related.relationship.metadata?.tradeChannels) }, specificationIndex);
      if (record) record.relationshipId = related.relationship.relationshipId;
      if (record) requirements.push(record);
    }
    logSlowOperation('requirement relationships', requirementRelationshipsStartedAt, { iterationCount: requirementRelationshipCount, requirementCount: requirements.length, chosenSourceId });
    const drawingSpecLinksStartedAt = perfNow();
    let drawingSpecLinkCount = 0;
    for (const rawLink of list(input.drawingSpecLinks).filter(item => item && item.status !== 'rejected')) {
      drawingSpecLinkCount += 1;
      const link = asObject(rawLink);
      const sourceScope = link.objectId && input.selectedObjectId === link.objectId ? 'object-specific' : link.objectId ? '' : 'page-wide';
      if (!sourceScope) continue;
      const record = createRequirementRecord({ projectId, sourceDocumentId: link.drawingDocumentId, sourcePageId: link.drawingPageId, sourceObjectId: link.objectId, specificationDocumentId: link.specificationDocumentId, sectionNumber: link.sectionNumber,
        applicabilityScope: sourceScope, evidenceType: link.evidenceSource || 'drawing specification link', evidenceText: link.evidenceText || link.note || 'Manual drawing-to-specification link.', graphicalRegion: link.graphicalRegion, confidence: link.confidence, status: link.status,
        reason: link.reason || (link.origin === 'explicit' ? 'Explicit specification reference on the drawing.' : link.origin === 'manual' ? 'Manually confirmed drawing requirement.' : 'Evidence-backed project vocabulary suggestion.'), origin: link.origin }, specificationIndex);
      if (record) record.drawingSpecLinkId = link.linkId;
      if (record) requirements.push(record);
    }
    logSlowOperation('drawing spec links', drawingSpecLinksStartedAt, { iterationCount: drawingSpecLinkCount, requirementCount: requirements.length });
    const projectRequirementsStartedAt = perfNow();
    let projectRequirementCount = 0;
    for (const related of relatedEntities('project-requirements', `project:${projectId}`, { projectId, entityTypes: ['specification-section'], relationshipTypes: ['governed-by', 'requires'], verificationStates: ['confirmed', 'suggested'], limit: 100 })) {
      projectRequirementCount += 1;
      if (!related.entity || !related.relationship) { skippedRecordCount += 1; continue; }
      const evidence = related.relationship.evidence?.[0] || {};
      const record = createRequirementRecord({ projectId, relationshipId: related.relationship.relationshipId, specificationDocumentId: related.entity.sourceDocumentId, sectionNumber: related.entity.normalizedKey, applicabilityScope: 'project-wide', evidenceType: evidence.evidenceType || 'project-wide requirement', evidenceText: evidence.sourceText || related.relationship.metadata?.note || 'Imported authoritative project-wide relationship.', confidence: related.relationship.confidence, status: related.relationship.verificationState, reason: evidence.confidenceReason || 'Explicit project-wide relationship.', origin: related.relationship.origin }, specificationIndex);
      if (record) requirements.push(record);
    }
    logSlowOperation('project requirements', projectRequirementsStartedAt, { iterationCount: projectRequirementCount, requirementCount: requirements.length });
    const projectWideStartedAt = perfNow();
    let projectWideCount = 0;
    for (const item of list(input.projectWideRequirements).filter(item => item && item.status !== 'rejected')) {
      projectWideCount += 1;
      const record = createRequirementRecord({ ...item, projectId, applicabilityScope: 'project-wide', evidenceType: item.evidenceType || 'project-wide requirement', evidenceText: item.evidenceText, reason: item.reason || 'Explicitly identified project-wide baseline requirement.' }, specificationIndex);
      if (record) requirements.push(record);
    }
    logSlowOperation('project-wide requirements', projectWideStartedAt, { iterationCount: projectWideCount, requirementCount: requirements.length });
    if (input.viewportContext?.selectedRegion && !chosenSource) warnings.push('Selected drawing region has no verified object or room requirement relationship.');
    const providerStartedAt = perfNow();
    let providerCount = 0;
    for (const provider of providerList) { providerCount += 1; try { const provided = provider(structuredClone(input)); if (provided && typeof provided.then === 'function') { void Promise.resolve(provided).catch(error => providerFailure(provider.name || 'requirement-provider', error)); continue; } for (const candidate of list(provided)) { const record = createRequirementRecord(asObject(candidate), specificationIndex); if (record) requirements.push(record); else skippedRecordCount += 1; } } catch (error) { providerFailure(provider.name || 'requirement-provider', error); } }
    logSlowOperation('requirement providers', providerStartedAt, { iterationCount: providerCount, requirementCount: requirements.length });
    const deduplicated = [...new Map(requirements.sort((a, b) => (a.status === 'confirmed' ? 0 : 1) - (b.status === 'confirmed' ? 0 : 1) || a.applicabilityScope.localeCompare(b.applicabilityScope) || a.sectionNumber.localeCompare(b.sectionNumber)).map(item => [item.requirementId, item])).values()];
    const allowed = trade.key === 'all-trades' ? deduplicated : deduplicated.filter(item => item.applicabilityScope === 'project-wide' || trade.divisions.includes(text(item.sectionNumber).replace(/\D/g, '').slice(0, 2)) || list(item.tradeChannels).includes(trade.key));
    const articleLookupStarted = now();
    const fieldRequirements = { submittals: [], 'quality assurance': [], 'products/materials': [], execution: [], 'examination/preparation': [], installation: [], testing: [], inspection: [], protection: [], commissioning: [], closeout: [] };
    let allowedCount = 0;
    for (const requirement of allowed) {
      allowedCount += 1;
      let section = null; try { section = specificationIndex.get(requirement.specificationDocumentId, requirement.sectionNumber); } catch (error) { providerFailure('specification-articles', error); }
      try {
        for (const article of list(section?.articles)) if (article?.kind && fieldRequirements[article.kind]) fieldRequirements[article.kind].push({ ...requirement, article: structuredClone(article) });
        const legacy = sectionCategory(section);
        if (legacy.quality && !fieldRequirements['quality assurance'].some(item => item.requirementId === requirement.requirementId)) fieldRequirements['quality assurance'].push(requirement);
      } catch (error) { providerFailure('specification-articles', error); }
    }
    logSlowOperation('requirement article lookup', articleLookupStarted, { iterationCount: allowedCount, requirementCount: allowed.length, articleCount: Object.entries(fieldRequirements).filter(([key]) => key !== 'quality').reduce((sum, [, items]) => sum + items.length, 0) });
    fieldRequirements.quality = fieldRequirements['quality assurance'];
    onMetric({ operation: 'requirement-article-lookup', durationMs: Math.max(0, now() - articleLookupStarted), sectionCount: allowed.length, articleCount: Object.entries(fieldRequirements).filter(([key]) => key !== 'quality').reduce((sum, [, items]) => sum + items.length, 0) });
    const output = { status: providerFailures.length ? (allowed.length || governingDrawings.length ? 'partial' : 'unavailable') : 'complete', projectId, contextSourceEntityId: chosenSourceId || null, tradeChannel: trade.key, governingDrawings, requirements: allowed, confirmedSpecifications: allowed.filter(item => item.status === 'confirmed' && item.applicabilityScope !== 'project-wide'), suggestedSpecifications: allowed.filter(item => item.status === 'suggested' && item.applicabilityScope !== 'project-wide'), projectWideRequirements: allowed.filter(item => item.applicabilityScope === 'project-wide'), fieldRequirements, warnings, providerFailures, diagnostics: { skippedRecordCount, providerFailureCount: providerFailures.length }, resolvedAt: new Date().toISOString() };
    cache.set(cacheKey, output); onMetric({ operation: 'requirement-resolution', durationMs: Math.max(0, now() - started), requirementCount: allowed.length }); return structuredClone(output);
  };
  const resolve = input => { try { return resolveCore(input); } catch (error) { const failure = { provider: 'requirements-resolver', code: 'construction-intelligence-provider-failure', message: error?.message || String(error), contained: true }; onMetric({ operation: 'requirement-resolution-failure', providerFailureCount: 1, contained: true }); return unavailable(input, 'Construction intelligence is unavailable for this page.', [failure]); } };
  return {
    resolve,
    async resolveLatest(input) { const requestGeneration = ++generation; const result = await Promise.resolve().then(() => resolve(input)); return requestGeneration === generation ? { committed: true, generation, result } : { committed: false, generation: requestGeneration, result: null }; },
    invalidate() { cache.clear(); generation += 1; },
    generation: () => generation
  };
}
