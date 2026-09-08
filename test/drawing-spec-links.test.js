import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpecificationIndex } from '../src/specification-index.js';
import { createDrawingSpecificationLinkService, DRAWING_SPEC_AUDIT_HISTORY_LIMIT } from '../src/drawing-spec-links.js';

const memory = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
test('links only use indexed project sections and manual decisions survive enrichment', () => {
  const storage = memory(); const index = createSpecificationIndex({ storage, storageKey: 'index' });
  index.index({ document: { id: 'spec', projectId: 'p' }, tocRows: [{ id: 's', sectionNumber: '10 14 00', sectionTitle: 'Signage', pageStart: 55 }] });
  const links = createDrawingSpecificationLinkService({ index, storage, storageKey: 'links', now: () => '2026-08-01T00:00:00.000Z' });
  const [suggestion] = links.suggestForObject({ objectId: 'o', projectId: 'p', documentId: 'drawing', pageId: 'page', subtype: 'signage', evidenceText: 'SIGN TYPE A' }, { specificationDocumentId: 'spec' });
  assert.equal(suggestion.status, 'suggested');
  links.reject(suggestion.linkId, 'Not applicable');
  assert.equal(links.suggestForObject({ objectId: 'o', projectId: 'p', documentId: 'drawing', pageId: 'page', subtype: 'signage' }, { specificationDocumentId: 'spec' })[0].status, 'rejected');
  assert.equal(links.history(suggestion.linkId).at(-1).newStatus, 'rejected');
  assert.deepEqual(links.openTarget(suggestion), { kind: 'source', destination: 'knowledge', projectId: 'p', documentId: 'spec', sectionId: 's', pageNumber: 55, sectionNumber: '10 14 00' });
  assert.equal(links.link({ projectId: 'p', drawingDocumentId: 'd', drawingPageId: 'p', specificationDocumentId: 'spec', sectionNumber: '99 99 99' }), null);
});
test('explicit printed section reference is confirmed', () => {
  const storage = memory(); const index = createSpecificationIndex({ storage, storageKey: 'index' });
  index.index({ document: { id: 'spec', projectId: 'p' }, tocRows: [{ sectionNumber: '09 91 00', sectionTitle: 'Painting', pageStart: 12 }] });
  const service = createDrawingSpecificationLinkService({ index, storage, storageKey: 'links' });
  const [link] = service.suggestForObject({ objectId: 'paint', projectId: 'p', documentId: 'd', pageId: 'page', evidenceText: 'REFER TO SECTION 09 91 00' }, { specificationDocumentId: 'spec' });
  assert.equal(link.status, 'confirmed');
  assert.equal(link.origin, 'explicit');
});

function indexedDbMemory({ failWrites = false } = {}) {
  const records = new Map();
  return { records, loadLinks: async projectId => [...records.values()].filter(item => !projectId || item.projectId === projectId), putLink: async record => { if (failWrites) throw new Error('IndexedDB unavailable'); records.set(record.linkId, structuredClone(record)); }, deleteLink: async id => records.delete(id) };
}

test('drawing-spec links persist through IndexedDB without writing the collection to localStorage', async () => {
  const indexStorage = memory(); const index = createSpecificationIndex({ storage: indexStorage, storageKey: 'index' });
  index.index({ document: { id: 'spec', projectId: 'p' }, tocRows: [{ sectionNumber: '09 91 00', sectionTitle: 'Painting', pageStart: 12 }] });
  const persistence = indexedDbMemory(); let localWrites = 0;
  const local = { getItem: () => null, setItem: () => { localWrites += 1; }, removeItem: () => {} };
  const service = createDrawingSpecificationLinkService({ index, persistence, legacyStorage: local }); await service.load('p');
  service.link({ projectId: 'p', drawingDocumentId: 'd', drawingPageId: 'page', specificationDocumentId: 'spec', sectionNumber: '09 91 00', applicabilityScope: 'page-wide', evidenceText: 'P-1', status: 'suggested', origin: 'rule' });
  await service.flush(); assert.equal(persistence.records.size, 1); assert.equal(localWrites, 0); assert.equal(service.diagnostics().backend, 'IndexedDB');
});

test('legacy localStorage migrates once, deduplicates, and preserves manual decisions', async () => {
  const index = createSpecificationIndex({ storage: memory(), storageKey: 'index' }); index.index({ document: { id: 'spec', projectId: 'p' }, tocRows: [{ sectionNumber: '10 14 00', sectionTitle: 'Signage', pageStart: 55 }] });
  const base = { projectId: 'p', drawingDocumentId: 'd', drawingPageId: 'page', specificationDocumentId: 'spec', sectionNumber: '10 14 00', applicabilityScope: 'page-wide', evidenceText: 'SIGNAGE' };
  let raw = JSON.stringify([{ ...base, linkId: 'old-1', status: 'suggested', origin: 'rule' }, { ...base, linkId: 'old-2', status: 'rejected', origin: 'manual', note: 'Not applicable' }]); let removed = 0;
  const legacy = { getItem: () => raw, removeItem: () => { raw = ''; removed += 1; } }; const persistence = indexedDbMemory();
  const service = createDrawingSpecificationLinkService({ index, persistence, legacyStorage: legacy }); await service.load('p'); await service.flush();
  assert.equal(service.forPage('page', null).length, 1); assert.equal(service.forPage('page', null)[0].status, 'rejected'); assert.equal(persistence.records.size, 1); assert.equal(removed, 1);
  await service.load('p'); assert.equal(removed, 1); assert.equal(service.diagnostics().duplicateRecordsRemoved, 1);
});

test('equivalent enrichment is bounded and audit history never exceeds its limit', async () => {
  const index = createSpecificationIndex({ storage: memory(), storageKey: 'index' }); index.index({ document: { id: 'spec', projectId: 'p' }, tocRows: [{ sectionNumber: '09 91 00', sectionTitle: 'Painting', pageStart: 12 }] });
  const persistence = indexedDbMemory(); const service = createDrawingSpecificationLinkService({ index, persistence, legacyStorage: { getItem: () => null } }); await service.load('p');
  const input = { projectId: 'p', drawingDocumentId: 'd', drawingPageId: 'page', objectId: 'finish-p1', specificationDocumentId: 'spec', sectionNumber: '09 91 00', evidenceText: 'Finish P-1', status: 'suggested', origin: 'rule' };
  for (let index = 0; index < 50; index += 1) service.link(input);
  const id = service.forPage('page', 'finish-p1')[0].linkId;
  for (let index = 0; index < 40; index += 1) { service.confirm(id, `confirm-${index}`); service.reject(id, `reject-${index}`); }
  await service.flush(); assert.equal(service.forPage('page', 'finish-p1').length, 1); assert.equal(persistence.records.size, 1); assert.equal(service.history(id).length, DRAWING_SPEC_AUDIT_HISTORY_LIMIT);
});

test('IndexedDB failure is contained while transient in-memory links remain available', async () => {
  const index = createSpecificationIndex({ storage: memory(), storageKey: 'index' }); index.index({ document: { id: 'spec', projectId: 'p' }, tocRows: [{ sectionNumber: '10 44 13', sectionTitle: 'Fire Extinguisher Cabinets', pageStart: 80 }] });
  const service = createDrawingSpecificationLinkService({ index, persistence: indexedDbMemory({ failWrites: true }), legacyStorage: { getItem: () => null } }); await service.load('p');
  service.link({ projectId: 'p', drawingDocumentId: 'd', drawingPageId: 'page', objectId: 'fec', specificationDocumentId: 'spec', sectionNumber: '10 44 13', evidenceText: 'FEC-2', status: 'suggested', origin: 'rule' });
  await assert.doesNotReject(service.flush()); assert.equal(service.forPage('page', 'fec').length, 1); assert.equal(service.diagnostics().pendingRetryCount, 1); assert.match(service.diagnostics().lastWriteFailure.message, /IndexedDB unavailable/);
});

test('legacy cleanup quota failure is diagnostic-only after verified migration', async () => {
  const index = createSpecificationIndex({ storage: memory(), storageKey: 'index' }); index.index({ document: { id: 'spec', projectId: 'p' }, tocRows: [{ sectionNumber: '10 14 00', sectionTitle: 'Signage', pageStart: 55 }] });
  const raw = JSON.stringify([{ projectId: 'p', drawingDocumentId: 'd', drawingPageId: 'page', specificationDocumentId: 'spec', sectionNumber: '10 14 00', status: 'confirmed', origin: 'manual' }]);
  const error = new Error('quota'); error.name = 'QuotaExceededError'; const service = createDrawingSpecificationLinkService({ index, persistence: indexedDbMemory(), legacyStorage: { getItem: () => raw, removeItem: () => { throw error; } } });
  await assert.doesNotReject(service.load('p')); assert.equal(service.forPage('page', null)[0].status, 'confirmed'); assert.equal(service.diagnostics().lastWriteFailure.phase, 'legacy-cleanup');
});
