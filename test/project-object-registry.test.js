import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectObjectRegistry, PROJECT_OBJECT_TYPES } from '../src/project-object-registry.js';
import { createProjectObjectOperationLink, preserveProjectObjectMerge, projectObjectEntity } from '../src/project-object-operations.js';
import { createDrawingSpecificationLinkService } from '../src/drawing-spec-links.js';
import { buildChiefProjectContext } from '../src/chief-project-context.js';
import { createProjectRelationshipEngine } from '../src/project-relationship-engine.js';
import { readFileSync } from 'node:fs';

function persistence() {
  const objects = new Map(), observations = new Map();
  return { objects, observations, adapter: { loadObjects: async project => [...objects.values()].filter(item => !project || item.projectId === project), loadObservations: async project => [...observations.values()].filter(item => !project || item.projectId === project), putObject: async item => objects.set(item.objectId, structuredClone(item)), putObservation: async item => observations.set(item.observationId, structuredClone(item)) } };
}
const base = { projectId: 'bedford', drawingDocumentId: 'b61', drawingPageId: 'page-61in101', objectType: 'signage', tag: 'S-3', label: 'Sign Type S-3', trade: 'Interiors', graphicalRegion: { x: .1, y: .2, width: .05, height: .03 }, verificationState: 'confirmed', identitySource: 'manual', confidence: 1 };

test('permanent IDs survive reload, rename, parser changes, and specification enrichment', async () => {
  const store = persistence(); const first = createProjectObjectRegistry({ persistence: store.adapter, now: () => '2026-08-01T12:00:00Z' }); await first.load('bedford');
  const created = first.registerObject(base, { source: 'manual' });
  first.updateObject(created.objectId, { label: 'Room Identification Sign', tag: 'S3' }, { source: 'manual' }); await first.flush();
  const second = createProjectObjectRegistry({ persistence: store.adapter }); await second.load('bedford');
  const reloaded = second.getObject(created.objectId);
  assert.equal(reloaded.objectId, created.objectId); assert.equal(reloaded.label, 'Room Identification Sign');
  const merge = second.mergeObservation({ observationId: 'obs-new', projectId: 'bedford', documentId: 'b61', pageId: 'page-61in101', detectedType: 'signage', detectedTag: 'S-3', text: 'S-3', confidence: .4, parserVersion: '9' });
  assert.equal(merge.object.objectId, created.objectId); assert.equal(merge.object.label, 'Room Identification Sign'); assert.equal(merge.object.verificationState, 'confirmed');
});

test('same normalized tag remains separate across pages and projects', () => {
  const registry = createProjectObjectRegistry();
  const one = registry.registerObject(base); const page = registry.registerObject({ ...base, drawingPageId: 'page-2', tag: 'S3' }); const project = registry.registerObject({ ...base, projectId: 'other', tag: 'S 3' });
  assert.notEqual(one.objectId, page.objectId); assert.notEqual(one.objectId, project.objectId);
  assert.equal(registry.resolveObject({ projectId: 'bedford', pageId: 'page-61in101', alias: 'S3' }).objectId, one.objectId);
});

test('observations remain evidence and multiple observations support one object', () => {
  const registry = createProjectObjectRegistry(); const object = registry.registerObject(base);
  registry.mergeObservation({ observationId: 'o1', projectId: 'bedford', documentId: 'b61', pageId: 'page-61in101', detectedType: 'signage', detectedTag: 'S3', text: 'S3', confidence: .6 });
  registry.mergeObservation({ observationId: 'o2', projectId: 'bedford', documentId: 'b61', pageId: 'page-61in101', detectedType: 'signage', detectedTag: 'S-3', text: 'SIGN TYPE S-3', confidence: .7 });
  assert.equal(registry.getObject(object.objectId).sourceObservationIds.length, 2); assert.equal(registry.observation('o1').text, 'S3');
});

test('new evidence creates a candidate but rejected evidence remains suppressed', () => {
  const registry = createProjectObjectRegistry();
  const result = registry.mergeObservation({ observationId: 'o1', projectId: 'bedford', documentId: 'b61', pageId: 'page-m101', detectedType: 'damper', detectedTag: 'FD-4', text: 'FD-4', confidence: .6 });
  registry.rejectObject(result.object.objectId, { source: 'manual' });
  const rerun = registry.mergeObservation({ observationId: 'o1', projectId: 'bedford', documentId: 'b61', pageId: 'page-m101', detectedType: 'damper', detectedTag: 'FD-4', text: 'FD-4', confidence: .6 });
  assert.equal(rerun.object.verificationState, 'rejected'); assert.equal(registry.findObjects({ projectId: 'bedford', pageId: 'page-m101' }).length, 0);
  assert.equal(registry.mergeObservation({ observationId: 'o1-rerun', projectId: 'bedford', documentId: 'b61', pageId: 'page-m101', detectedType: 'damper', detectedTag: 'FD-4', text: 'FD-4', region: result.object.graphicalRegion, confidence: .7 }).status, 'suppressed-rejected');
  const changed = registry.mergeObservation({ observationId: 'o2', projectId: 'bedford', documentId: 'b61', pageId: 'page-m101', detectedType: 'damper', detectedTag: 'FD-5', text: 'FD-5', confidence: .8 });
  assert.equal(changed.status, 'candidate-created');
});

test('page and viewport queries are bounded and do not leak projects', () => {
  const metrics = []; const registry = createProjectObjectRegistry({ onDiagnostic: item => metrics.push(item) });
  for (let index = 0; index < 200; index += 1) registry.registerObject({ ...base, tag: `S-${index}`, graphicalRegion: { x: (index % 10) / 10, y: Math.floor(index / 10) / 20, width: .02, height: .02 } });
  registry.registerObject({ ...base, projectId: 'other', tag: 'FOREIGN' });
  assert.equal(registry.getObjectsForPage(base.drawingPageId, { projectId: 'bedford', limit: 25 }).length, 25);
  assert.ok(registry.getObjectsForViewport({ projectId: 'bedford', pageId: base.drawingPageId, bounds: { x: 0, y: 0, width: .2, height: .2 } }, { limit: 10 }).length <= 10);
  assert.ok(metrics.some(item => item.operation === 'viewport-query'));
});

test('aliasing, merge, split, and audit history preserve permanent identities', () => {
  const registry = createProjectObjectRegistry(); const primary = registry.registerObject(base); const secondary = registry.registerObject({ ...base, tag: 'S3', label: 'Possible duplicate', graphicalRegion: { x: .105, y: .205, width: .05, height: .03 }, verificationState: 'candidate', identitySource: 'parser', allowDuplicate: true });
  registry.linkAlias(primary.objectId, '61IN101:S-3'); assert.equal(registry.resolveObject({ projectId: 'bedford', pageId: base.drawingPageId, alias: '61IN101:S-3' }).objectId, primary.objectId);
  const merged = registry.mergeObjects(primary.objectId, secondary.objectId, { source: 'manual' }); assert.ok(merged.mergedObjectIds.includes(secondary.objectId)); assert.equal(registry.getObject(secondary.objectId).verificationState, 'historical');
  registry.splitObject(primary.objectId, secondary.objectId, { source: 'manual' }); assert.equal(registry.getObject(secondary.objectId).verificationState, 'candidate'); assert.ok(registry.getObjectHistory(primary.objectId).length >= 3);
});

test('supported types and PMIS adapters reference permanent object IDs only', () => {
  assert.ok(PROJECT_OBJECT_TYPES.includes('telecom-rack')); assert.ok(PROJECT_OBJECT_TYPES.includes('fire-extinguisher-cabinet'));
  const object = createProjectObjectRegistry().registerObject(base);
  assert.equal(projectObjectEntity(object).metadata.objectId, object.objectId);
  assert.deepEqual(createProjectObjectOperationLink({ objectId: object.objectId, projectId: 'bedford', operationType: 'inspection', recordId: 'inspection-1' }).objectId, object.objectId);
  assert.equal(createProjectObjectOperationLink({ objectId: object.objectId, projectId: 'bedford', operationType: 'unsupported', recordId: 'x' }), null);
});

test('specification links survive object rename because they reference permanent objectId', () => {
  const registry = createProjectObjectRegistry(); const object = registry.registerObject(base);
  const storage = { value: '', getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
  const service = createDrawingSpecificationLinkService({ storage, index: { get: () => ({ projectId: 'bedford', documentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', specificationSectionId: 'spec-101400', startPdfPage: 100 }) } });
  service.link({ projectId: 'bedford', drawingDocumentId: 'b61', drawingPageId: base.drawingPageId, objectId: object.objectId, specificationDocumentId: 'spec', sectionNumber: '10 14 00', status: 'confirmed', origin: 'manual' });
  registry.updateObject(object.objectId, { label: 'Renamed Sign' }, { source: 'manual' });
  assert.equal(service.forPage(base.drawingPageId, object.objectId)[0].objectId, object.objectId);
});

test('object merge preserves graph relationships and specification links on the permanent primary ID', () => {
  const registry = createProjectObjectRegistry(); const primary = registry.registerObject(base); const secondary = registry.registerObject({ ...base, tag: 'S3', allowDuplicate: true, verificationState: 'candidate', identitySource: 'parser' });
  const storage = { value: '', getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
  const graph = createProjectRelationshipEngine({ storage: { getItem: () => '', setItem() {} } });
  const links = createDrawingSpecificationLinkService({ storage, index: { get: () => ({ projectId: 'bedford', documentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', specificationSectionId: 'spec-101400', startPdfPage: 100 }) } });
  graph.registerEntities([projectObjectEntity(primary), projectObjectEntity(secondary), { entityId: 'inspection:1', projectId: 'bedford', entityType: 'inspection', label: 'Inspection 1', verificationState: 'confirmed', origin: 'manual' }]);
  graph.registerRelationship({ projectId: 'bedford', sourceEntityId: `drawing-object:${secondary.objectId}`, targetEntityId: 'inspection:1', relationshipType: 'inspected-by', verificationState: 'confirmed', origin: 'manual' });
  links.link({ projectId: 'bedford', drawingDocumentId: 'b61', drawingPageId: base.drawingPageId, objectId: secondary.objectId, specificationDocumentId: 'spec', sectionNumber: '10 14 00', status: 'confirmed', origin: 'manual' });
  registry.mergeObjects(primary.objectId, secondary.objectId, { source: 'manual' }); preserveProjectObjectMerge({ primary: registry.getObject(primary.objectId), secondary, relationshipEngine: graph, specificationLinks: links });
  assert.ok(graph.getRelationships(`drawing-object:${primary.objectId}`, { includeRejected: true }).some(item => item.relationshipType === 'inspected-by'));
  assert.equal(links.forPage(base.drawingPageId, primary.objectId)[0].objectId, primary.objectId);
});

test('Chief adapter returns read-only permanent object context and excludes rejection', () => {
  const registry = createProjectObjectRegistry(); const object = registry.registerObject(base);
  const relationships = { getEntity: () => null, getRelationships: () => [] };
  const context = buildChiefProjectContext({ projectId: 'bedford', selectedPermanentObjectId: object.objectId, projectObjectRegistry: registry, relationshipEngine: relationships, linkedPmisRecords: [{ projectId: 'bedford', objectId: object.objectId, recordId: 'inspection-1' }] });
  assert.equal(context.selectedObject.objectId, object.objectId); assert.equal(context.linkedPmisRecords.length, 1);
  registry.rejectObject(object.objectId, { source: 'manual' });
  assert.equal(buildChiefProjectContext({ projectId: 'bedford', selectedPermanentObjectId: object.objectId, projectObjectRegistry: registry, relationshipEngine: relationships }).selectedObject, null);
});

test('Building 61 explicit fixtures remain page-scoped without fabricated browser objects', () => {
  const registry = createProjectObjectRegistry();
  const fixtures = [
    ['page-61in101', 'signage', 'S-3'], ['page-61in101', 'finish', 'P-1'], ['page-61in101', 'fire-extinguisher-cabinet', 'FEC-2'],
    ['page-61m101', 'equipment', 'VAV-12'], ['page-61m101', 'damper', 'FD-4'], ['page-61t402', 'telecom-rack', 'TR-1']
  ].map(([drawingPageId, objectType, tag]) => registry.registerObject({ ...base, drawingPageId, objectType, tag, label: tag, identitySource: 'manual' }));
  assert.equal(registry.getObjectsForPage('page-61in101', { projectId: 'bedford' }).length, 3);
  assert.equal(registry.getObjectsForPage('page-61m101', { projectId: 'bedford' }).length, 2);
  assert.equal(registry.getObjectsForPage('page-61t402', { projectId: 'bedford' })[0].objectId, fixtures[5].objectId);
});

test('production persistence uses IndexedDB stateRecords and object actions do not own PDF rendering', () => {
  const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8'); const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8'); const registry = readFileSync(new URL('../src/project-object-registry.js', import.meta.url), 'utf8');
  assert.match(engine, /projectObjectPersistence\(\)[\s\S]*project-object:/);
  assert.match(app, /createProjectObjectRegistry\(\{ persistence: engine\.projectObjectPersistence\(\)/);
  assert.match(app, /data-project-object-create/); assert.match(app, /data-project-object-edit/);
  assert.doesNotMatch(registry, /localStorage|renderPdfPage|drawingViewerEngine/);
});
