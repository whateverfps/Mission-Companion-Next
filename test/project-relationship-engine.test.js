import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptDrawingSpecificationLinks, createProjectRelationshipEngine, normalizeProjectEntity, relationshipContextGroups, stableProjectEntityId } from '../src/project-relationship-engine.js';
import { buildChiefProjectContext } from '../src/chief-project-context.js';

const memory = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
const evidence = [{ evidenceType: 'fixture', sourceText: 'Explicit test evidence', ruleId: 'fixture-rule', confidenceReason: 'Test fixture' }];
const entity = (entityId, entityType, extra = {}) => ({ entityId, projectId: 'bedford', entityType, title: entityId, label: entityId, verificationState: 'confirmed', origin: 'imported', ...extra });

test('entity identities are stable, owned, type-gated, and persistent', () => {
  const input = { projectId: 'bedford', entityType: 'drawing-page', sourceDocumentId: 'b61', sourcePageId: 'page-61in101', normalizedKey: '61IN101' };
  assert.equal(stableProjectEntityId(input), stableProjectEntityId(input));
  assert.equal(normalizeProjectEntity({ ...input, entityType: 'future-magic' }), null);
  const storage = memory(); const graph = createProjectRelationshipEngine({ storage });
  const manual = graph.registerEntity({ ...input, origin: 'manual', verificationState: 'confirmed', label: '61IN101' });
  assert.equal(createProjectRelationshipEngine({ storage }).getEntity(manual.entityId).projectId, 'bedford');
});

test('relationships retain evidence, prevent duplicates, preserve conflicts, and audit decisions', () => {
  const graph = createProjectRelationshipEngine({ storage: memory(), now: () => '2026-08-01T12:00:00.000Z' });
  graph.registerEntity(entity('object', 'drawing-object')); graph.registerEntity(entity('spec', 'specification-section'));
  const suggested = graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'object', targetEntityId: 'spec', relationshipType: 'governed-by', verificationState: 'suggested', origin: 'parser', confidence: .6, evidence });
  assert.deepEqual(graph.registerRelationship({ ...suggested }), suggested);
  const confirmed = graph.registerRelationship({ ...suggested, relationshipId: '', verificationState: 'confirmed', origin: 'manual', evidence: [] });
  assert.notEqual(confirmed.relationshipId, suggested.relationshipId);
  assert.equal(graph.getRelationships('object').map(item => item.verificationState).join(','), 'confirmed,suggested');
  graph.rejectRelationship(suggested.relationshipId, { origin: 'manual', note: 'Not applicable' });
  assert.equal(graph.getRelationshipHistory(suggested.relationshipId)[0].newState, 'rejected');
  assert.equal(graph.getRelationshipHistory(confirmed.relationshipId)[0].newState, 'confirmed');
  const suppressed = graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'object', targetEntityId: 'spec', relationshipType: 'governed-by', verificationState: 'suggested', origin: 'parser', evidence });
  assert.equal(suppressed.verificationState, 'rejected');
  assert.equal(graph.getConflicts('object')[0].preferredRelationshipId, confirmed.relationshipId);
});

test('revision relationships supplement and supersede without deleting history', () => {
  const graph = createProjectRelationshipEngine({ storage: memory() });
  for (const item of [entity('base', 'specification-section'), entity('addendum', 'specification-section'), entity('history', 'history-record')]) graph.registerEntity(item);
  assert.ok(graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'addendum', targetEntityId: 'base', relationshipType: 'supplements', revisionKey: 'addendum-1', verificationState: 'confirmed', origin: 'imported' }));
  assert.ok(graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'base', targetEntityId: 'history', relationshipType: 'has-history', verificationState: 'historical', origin: 'imported' }));
  assert.equal(graph.getRelationships('base').length, 2);
});

function fixtureGraph() {
  const graph = createProjectRelationshipEngine({ storage: memory() });
  for (const item of [entity('set', 'drawing-set'), entity('page', 'drawing-page'), entity('signage', 'drawing-object'), entity('room', 'room'), entity('spec', 'specification-section'), entity('other-page', 'drawing-page'), { ...entity('foreign', 'drawing-page'), projectId: 'other' }]) graph.registerEntity(item);
  for (const relation of [
    ['set', 'page', 'contains'], ['page', 'signage', 'contains'], ['signage', 'spec', 'governed-by'], ['room', 'page', 'appears-on'], ['room', 'other-page', 'appears-on']
  ]) graph.registerRelationship({ projectId: 'bedford', sourceEntityId: relation[0], targetEntityId: relation[1], relationshipType: relation[2], verificationState: 'confirmed', origin: 'explicit', evidence });
  return graph;
}

test('bounded graph traversal supports page/object/spec and room/drawing queries without cross-project leakage', () => {
  const graph = fixtureGraph();
  assert.deepEqual(graph.getRelatedEntities('page', { entityTypes: ['drawing-object'] }).map(item => item.entity.entityId), ['signage']);
  assert.equal(graph.getRelationshipPath('page', 'spec', { maxDepth: 2 }).relationships.length, 2);
  assert.equal(graph.getRelationshipPath('set', 'spec', { maxDepth: 2 }), null);
  assert.deepEqual(graph.getRelatedEntities('room', { entityTypes: ['drawing-page'] }).map(item => item.entity.entityId), ['other-page', 'page']);
  assert.equal(graph.getRelatedEntities('page').some(item => item.entity.projectId === 'other'), false);
});

test('inheritance is explicit, bounded, and annotated rather than flattened', () => {
  const graph = fixtureGraph();
  assert.equal(graph.getInheritedRelatedEntities('signage').length, 0);
  graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'signage', targetEntityId: 'page', relationshipType: 'appears-on', verificationState: 'confirmed', origin: 'explicit', evidence });
  const inherited = graph.getInheritedRelatedEntities('signage', { rules: [{ ruleId: 'object-page-drawings', sourceEntityType: 'drawing-object', viaRelationshipTypes: ['appears-on'], inheritedFromEntityTypes: ['drawing-page'], relationshipTypes: ['contains'], targetEntityTypes: ['drawing-object'], reason: 'Explicit object-to-page hierarchy.' }] });
  assert.equal(inherited[0].inheritedFromEntityId, 'page');
  assert.equal(inherited[0].inheritanceRule, 'object-page-drawings');
});

test('provider failure is isolated and relationship groups separate confirmed and suggested', () => {
  const graph = createProjectRelationshipEngine({ storage: memory(), providers: [() => { throw new Error('offline'); }, () => [{ ok: true }]] });
  graph.registerEntity(entity('object', 'drawing-object')); graph.registerEntity(entity('spec', 'specification-section')); graph.registerEntity(entity('photo', 'photo'));
  graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'object', targetEntityId: 'spec', relationshipType: 'governed-by', verificationState: 'suggested', origin: 'rule', evidence });
  graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'object', targetEntityId: 'photo', relationshipType: 'documented-by', verificationState: 'confirmed', origin: 'explicit', evidence });
  assert.equal(graph.queryProviders({}).results.length, 1);
  const groups = relationshipContextGroups(graph, 'object');
  assert.equal(groups.suggestedSpecifications.length, 1); assert.equal(groups.photos.length, 1); assert.equal(groups.providerErrors.length, 1);
});

test('drawing specification links adapt only through existing indexed entities', () => {
  const graph = createProjectRelationshipEngine({ storage: memory() });
  graph.registerEntity(entity('page', 'drawing-page')); graph.registerEntity(entity('object', 'drawing-object'));
  graph.registerEntity(entity('specification-section:spec:101400', 'specification-section', { sourceDocumentId: 'spec', normalizedKey: '101400', label: '10 14 00 Signage' }));
  const created = adaptDrawingSpecificationLinks(graph, [{ projectId: 'bedford', drawingDocumentId: 'b61', drawingPageId: 'page', objectId: 'object-source', specificationDocumentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', status: 'suggested', origin: 'rule', evidenceSource: 'verified-object-project-vocabulary', evidenceText: 'SIGN TYPE A', confidence: .55 }], { pageEntityId: 'page', objectEntityIds: new Map([['object-source', 'object']]) });
  assert.equal(created[0].relationshipType, 'governed-by'); assert.equal(created[0].verificationState, 'suggested');
});

test('Building 61 61IN101 fixture represents only explicit test objects and supported spec links', () => {
  const graph = createProjectRelationshipEngine({ storage: memory() });
  const records = [entity('b61-set', 'drawing-set'), entity('61in101', 'drawing-page'), entity('signage', 'drawing-object', { sourceObjectId: 'confirmed-signage' }), entity('spec-signage', 'specification-section')];
  records.forEach(item => graph.registerEntity(item));
  graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'b61-set', targetEntityId: '61in101', relationshipType: 'contains', verificationState: 'confirmed', origin: 'imported' });
  graph.registerRelationship({ projectId: 'bedford', sourceEntityId: '61in101', targetEntityId: 'signage', relationshipType: 'contains', verificationState: 'confirmed', origin: 'explicit', evidence });
  graph.registerRelationship({ projectId: 'bedford', sourceEntityId: 'signage', targetEntityId: 'spec-signage', relationshipType: 'governed-by', verificationState: 'suggested', origin: 'rule', evidence });
  assert.equal(graph.getRelationshipPath('b61-set', 'spec-signage', { maxDepth: 3 }).relationships.length, 3);
  assert.equal(graph.entities({ projectId: 'bedford', entityTypes: ['drawing-object'] }).length, 1);
});

test('Chief adapter returns verified structured context and cannot mutate or navigate', () => {
  const graph = fixtureGraph();
  const context = buildChiefProjectContext({ projectId: 'bedford', activePageEntityId: 'page', selectedObjectEntityId: 'signage', relationshipEngine: graph,
    viewportContext: { projectId: 'bedford', pageId: 'page', selectedRegion: { x: .1, y: .2, width: .3, height: .4 }, selectedRoomId: 'room-127' },
    tradeContext: { key: 'mechanical', label: 'Mechanical', status: 'explicit' },
    requirements: [
      { requirementId: 'confirmed', projectId: 'bedford', status: 'confirmed', applicabilityScope: 'object-specific' },
      { requirementId: 'rejected', projectId: 'bedford', status: 'rejected', applicabilityScope: 'page-wide' }
    ] });
  assert.equal(context.relationships.every(item => item.verificationState === 'confirmed'), true);
  assert.equal(context.trade.key, 'mechanical');
  assert.equal(context.selectedRoomId, 'room-127');
  assert.equal(context.requirements.length, 1);
  assert.equal(context.requirements[0].applicabilityScope, 'object-specific');
  assert.equal(Object.hasOwn(context, 'navigate'), false); assert.equal(Object.hasOwn(context, 'mutate'), false);
  context.relationships.length = 0;
  assert.ok(graph.getRelationships('signage').length);
});
