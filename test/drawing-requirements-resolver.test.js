import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingRequirementsResolver, createRequirementRecord } from '../src/drawing-requirements-resolver.js';
import { createSpecificationIndex } from '../src/specification-index.js';
import { createProjectRelationshipEngine } from '../src/project-relationship-engine.js';
import { tradeChannel } from '../src/drawing-trade-context.js';

const memory = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
const EVIDENCE = [{ evidenceType: 'explicit drawing reference', sourceText: 'Explicit fixture evidence', confidenceReason: 'Exact fixture link.' }];
const SECTIONS = [
  ['09 65 13','Resilient Base and Accessories'], ['09 65 19','Resilient Tile Flooring'], ['09 91 00','Painting'], ['10 14 00','Signage'], ['10 26 00','Wall and Door Protection'], ['10 44 13','Fire Extinguisher Cabinets'],
  ['23 05 11','Common Work Results for HVAC'], ['23 05 93','Testing, Adjusting, and Balancing'], ['23 08 00','Commissioning of HVAC Systems'], ['23 31 00','HVAC Ducts and Casings'], ['23 37 00','Air Outlets and Inlets'],
  ['27 05 00','Common Work Results for Communications'], ['27 05 26','Grounding and Bonding'], ['27 05 36','Cable Trays'], ['27 08 00','Commissioning'], ['27 10 00','Structured Cabling'], ['27 11 16','Cabinets, Racks, Frames, and Enclosures'],
  ['26 05 26','Grounding and Bonding for Electrical Systems'], ['01 45 00','Quality Control'], ['01 91 00','General Commissioning Requirements']
];

function fixture() {
  const index = createSpecificationIndex({ storage: memory() });
  index.index({ document: { id: 'spec', projectId: 'bedford', title: 'Bedford IFC Specifications' }, tocRows: SECTIONS.map(([sectionNumber, sectionTitle], i) => ({ id: `sec-${i}`, sectionNumber, sectionTitle, pageStart: i + 10,
    articles: sectionNumber === '23 05 93' ? [{ id: 'testing', heading: 'TESTING AND BALANCING', page: i + 10 }] : sectionNumber.includes('08 00') || sectionNumber === '01 91 00' ? [{ id: 'commissioning', heading: 'COMMISSIONING', page: i + 10 }] : sectionNumber === '01 45 00' ? [{ id: 'qa', heading: 'QUALITY ASSURANCE', page: i + 10 }] : [] })) });
  const graph = createProjectRelationshipEngine({ storage: memory() });
  const add = (entityId, entityType, extra = {}) => graph.registerEntity({ entityId, projectId: 'bedford', entityType, label: entityId, verificationState: 'confirmed', origin: 'imported', ...extra });
  add('page-in', 'drawing-page', { sourceDocumentId: 'b61', sourcePageId: '61in101' }); add('page-m', 'drawing-page', { sourceDocumentId: 'b61', sourcePageId: '61m101' }); add('page-t', 'drawing-page', { sourceDocumentId: 'b61', sourcePageId: '61t402' }); add('page-e', 'drawing-page', { sourceDocumentId: 'b61', sourcePageId: '61e101' });
  for (const [id, page] of [['signage','page-in'],['duct','page-m'],['rack','page-t'],['panel','page-e']]) { add(id, 'drawing-object', { sourceDocumentId: 'b61', sourcePageId: page, sourceObjectId: id }); graph.registerRelationship({ projectId: 'bedford', sourceEntityId: page, targetEntityId: id, relationshipType: 'contains', verificationState: 'confirmed', origin: 'explicit', evidence: EVIDENCE }); }
  for (const [number] of SECTIONS) add(`spec-${number.replace(/\D/g,'')}`, 'specification-section', { sourceDocumentId: 'spec', normalizedKey: number.replace(/\D/g,'') });
  const govern = (object, number, state = 'confirmed') => graph.registerRelationship({ projectId: 'bedford', sourceEntityId: object, targetEntityId: `spec-${number.replace(/\D/g,'')}`, relationshipType: 'governed-by', verificationState: state, origin: state === 'confirmed' ? 'explicit' : 'rule', confidence: state === 'confirmed' ? .95 : .55, evidence: EVIDENCE });
  govern('signage','10 14 00'); govern('signage','23 31 00','suggested'); govern('duct','23 31 00'); govern('duct','23 05 93','suggested'); govern('rack','27 10 00'); govern('rack','27 11 16','suggested'); govern('panel','26 05 26');
  return { index, graph, resolver: createDrawingRequirementsResolver({ specificationIndex: index, relationshipEngine: graph }) };
}

test('requirement contract rejects unsupported sections and preserves exact applicability scope', () => {
  const { index } = fixture();
  assert.equal(createRequirementRecord({ projectId: 'bedford', specificationDocumentId: 'spec', sectionNumber: '99 99 99', applicabilityScope: 'object-specific', evidenceType: 'manual confirmation', evidenceText: 'x' }, index), null);
  assert.equal(createRequirementRecord({ projectId: 'bedford', specificationDocumentId: 'spec', sectionNumber: '10 14 00', applicabilityScope: 'object-specific', evidenceType: 'manual confirmation', evidenceText: 'Confirmed', status: 'confirmed' }, index).applicabilityScope, 'object-specific');
});

test('61IN101 object resolves only supported interior requirements at object scope', () => {
  const { resolver } = fixture(); const result = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-in', selectedObjectEntityId: 'signage', tradeChannel: tradeChannel('interiors') });
  assert.deepEqual(result.requirements.map(item => item.sectionNumber), ['10 14 00']); assert.equal(result.requirements[0].applicabilityScope, 'object-specific');
});

test('61M-101 and 61T-402 trade channels exclude unrelated divisions', () => {
  const { resolver } = fixture();
  const mechanical = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-m', selectedObjectEntityId: 'duct', tradeChannel: tradeChannel('mechanical') });
  assert.deepEqual(mechanical.requirements.map(item => item.sectionNumber), ['23 31 00','23 05 93']); assert.ok(mechanical.fieldRequirements.testing.length);
  const communications = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-t', selectedObjectEntityId: 'rack', tradeChannel: tradeChannel('communications') });
  assert.deepEqual(communications.requirements.map(item => item.sectionNumber), ['27 10 00','27 11 16']); assert.equal(communications.requirements.some(item => item.sectionNumber.startsWith('23')), false);
});

test('Electrical excludes Mechanical and All Trades does not fabricate applicability', () => {
  const { resolver } = fixture();
  assert.deepEqual(resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-e', selectedObjectEntityId: 'panel', tradeChannel: tradeChannel('electrical') }).requirements.map(item => item.sectionNumber), ['26 05 26']);
  assert.equal(resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-e', selectedObjectEntityId: 'panel', tradeChannel: tradeChannel('all-trades') }).requirements.length, 1);
});

test('page, room, region, and project scopes remain explicit and rejected links stay suppressed', () => {
  const { resolver } = fixture();
  const result = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-in', viewportContext: { pageId: '61in101', selectedRegion: { x: .1, y: .1, width: .1, height: .1 } }, tradeChannel: tradeChannel('all-trades'),
    drawingSpecLinks: [{ linkId: 'page-spec', projectId: 'bedford', drawingDocumentId: 'b61', drawingPageId: '61in101', specificationDocumentId: 'spec', sectionNumber: '09 91 00', evidenceSource: 'drawing note', evidenceText: 'PAINT NOTE', confidence: .8, status: 'suggested', origin: 'explicit' }, { linkId: 'rejected', projectId: 'bedford', drawingDocumentId: 'b61', drawingPageId: '61in101', specificationDocumentId: 'spec', sectionNumber: '10 26 00', evidenceText: 'Rejected', status: 'rejected' }],
    projectWideRequirements: [{ specificationDocumentId: 'spec', sectionNumber: '01 91 00', evidenceText: 'Explicit project commissioning baseline.', status: 'confirmed', confidence: 1 }] });
  assert.equal(result.requirements.find(item => item.sectionNumber === '09 91 00').applicabilityScope, 'page-wide');
  assert.equal(result.projectWideRequirements[0].applicabilityScope, 'project-wide'); assert.equal(result.requirements.some(item => item.sectionNumber === '10 26 00'), false);
});

test('provider failure is nonblocking and latest generation wins', async () => {
  const { index, graph } = fixture(); const resolver = createDrawingRequirementsResolver({ specificationIndex: index, relationshipEngine: graph, providers: [() => { throw new Error('Provider unavailable'); }] });
  const result = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-in', selectedObjectEntityId: 'signage', tradeChannel: tradeChannel('interiors') }); assert.equal(result.requirements.length, 1); assert.equal(result.warnings[0], 'Provider unavailable');
  const first = resolver.resolveLatest({ projectId: 'bedford', pageEntityId: 'page-in', selectedObjectEntityId: 'signage', tradeChannel: tradeChannel('interiors') });
  const second = resolver.resolveLatest({ projectId: 'bedford', pageEntityId: 'page-m', selectedObjectEntityId: 'duct', tradeChannel: tradeChannel('mechanical') });
  assert.equal((await first).committed, false); assert.equal((await second).committed, true);
});

test('hosted page-context fixture normalizes undefined trade divisions before includes', () => {
  const { resolver } = fixture();
  const result = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-in', tradeChannel: { key: 'interiors', divisions: undefined }, drawingSpecLinks: [{ linkId: 'paint', drawingDocumentId: 'b61', drawingPageId: '61in101', specificationDocumentId: 'spec', sectionNumber: '09 91 00', evidenceSource: 'finish legend', evidenceText: null, note: 'P-1', status: 'suggested' }], observations: undefined });
  assert.equal(result.status, 'complete'); assert.equal(result.tradeChannel, 'interiors'); assert.deepEqual(result.requirements, []);
});

test('nullable and malformed resolver inputs produce deterministic structured results', () => {
  const { index, graph } = fixture();
  const resolver = createDrawingRequirementsResolver({ specificationIndex: index, relationshipEngine: { ...graph, getRelatedEntities: () => [null, { entity: null }] } });
  const result = resolver.resolve({ projectId: 'bedford', tradeChannel: { key: 'mechanical', divisions: null }, drawingSpecLinks: [null, { status: 'rejected' }], projectWideRequirements: undefined });
  assert.equal(result.status, 'complete'); assert.deepEqual(result.requirements, []); assert.equal(result.diagnostics.skippedRecordCount, 1);
  const absent = createDrawingRequirementsResolver({ specificationIndex: null }).resolve({ projectId: 'bedford' });
  assert.equal(absent.status, 'unavailable'); assert.equal(absent.providerFailures[0].contained, true);
});

test('failed relationship and article providers preserve successful drawing links', () => {
  const { index } = fixture(); const brokenIndex = { get(documentId, number) { const section = index.get(documentId, number); if (section) return { ...section, get articles() { throw new Error('Article provider failed'); } }; return section; } };
  const resolver = createDrawingRequirementsResolver({ specificationIndex: brokenIndex, relationshipEngine: { getEntity: () => null, getRelatedEntities: () => { throw new Error('Relationship provider failed'); } } });
  const result = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-in', tradeChannel: { key: 'all-trades' }, drawingSpecLinks: [{ linkId: 'paint', drawingDocumentId: 'b61', drawingPageId: '61in101', specificationDocumentId: 'spec', sectionNumber: '09 91 00', evidenceSource: 'manual', evidenceText: 'Confirmed paint link', status: 'confirmed', origin: 'manual' }] });
  assert.equal(result.status, 'partial'); assert.equal(result.confirmedSpecifications.length, 1); assert.ok(result.providerFailures.length);
});

test('rejected async provider promises are contained and stale generations cannot commit', async () => {
  const { index, graph } = fixture(); const resolver = createDrawingRequirementsResolver({ specificationIndex: index, relationshipEngine: graph, providers: [() => Promise.reject(new Error('PMIS lookup failed'))] });
  assert.doesNotThrow(() => resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-in' }));
  const first = resolver.resolveLatest({ projectId: 'bedford', pageEntityId: 'page-in' }); const second = resolver.resolveLatest({ projectId: 'bedford', pageEntityId: 'page-m' });
  assert.equal((await first).committed, false); assert.equal((await second).committed, true);
});
