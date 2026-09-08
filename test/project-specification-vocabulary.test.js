import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpecificationIndex } from '../src/specification-index.js';
import { createProjectSpecificationVocabulary } from '../src/project-specification-vocabulary.js';
import { createDrawingSpecificationLinkService } from '../src/drawing-spec-links.js';
import { createDrawingRequirementsResolver } from '../src/drawing-requirements-resolver.js';
import { createProjectRelationshipEngine } from '../src/project-relationship-engine.js';

const memory = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) }; };
const sections = [
  ['01 45 00', 'Quality Control'], ['01 91 00', 'General Commissioning Requirements'],
  ['09 65 13', 'Resilient Base and Accessories'], ['09 65 19', 'Resilient Tile Flooring'], ['09 91 00', 'Painting'],
  ['10 14 00', 'Signage'], ['10 26 00', 'Wall and Door Protection'], ['10 44 13', 'Fire Extinguisher Cabinets'],
  ['21 13 13', 'Wet-Pipe Sprinkler Systems'], ['22 05 00', 'Common Work Results for Plumbing'],
  ['23 05 11', 'Common Work Results for HVAC'], ['23 05 93', 'Testing, Adjusting, and Balancing'], ['23 08 00', 'Commissioning of HVAC Systems'], ['23 31 00', 'HVAC Ducts and Casings'], ['23 37 00', 'Air Outlets and Inlets'],
  ['26 05 00', 'Common Work Results for Electrical'], ['26 05 26', 'Grounding and Bonding for Electrical Systems'], ['26 05 33', 'Raceways and Boxes for Electrical Systems'], ['26 24 16', 'Panelboards'],
  ['27 05 00','Common Work Results for Communications'],['27 05 26','Grounding and Bonding for Telecommunications'],['27 05 33','Raceways and Boxes for Communications'],['27 05 36','Cable Trays for Communications Systems'],['27 05 53','Identification for Communications Systems'],['27 10 00','Structured Cabling'],['27 11 16','Communications Cabinets, Racks, Frames, and Enclosures'],['27 13 23','Optical Fiber Backbone Cabling'],['27 15 13','Communications Copper Horizontal Cabling']
];
function fixture() {
  const index = createSpecificationIndex({ storage: memory() });
  index.index({ document: { id: 'bedford-spec', projectId: 'bedford' }, tocRows: sections.map(([sectionNumber, sectionTitle], index) => ({ id: `s-${index}`, sectionNumber, sectionTitle, pageStart: 400 + index * 10, pageEnd: 409 + index * 10,
    verificationState: 'indexed', articles: [{ id: `a-${index}`, heading: index === 2 ? '3.2 INSTALLATION' : '1.4 SUBMITTALS', page: 402 + index * 10 }] })) });
  return { index, vocabulary: createProjectSpecificationVocabulary({ specificationIndex: index }) };
}

test('real indexed Bedford sections resolve by normalized number with exact boundaries and articles', () => {
  const { index } = fixture();
  for (const [number, title] of sections) {
    const section = index.get('bedford-spec', number.replace(/\D/g, ''));
    assert.equal(section.sectionTitle, title); assert.equal(section.normalizedSectionNumber, number.replace(/\D/g, ''));
    assert.ok(section.startPdfPage); assert.ok(section.endPdfPage >= section.startPdfPage); assert.ok(section.articles.length); assert.equal(section.verificationState, 'indexed');
  }
});

test('61IN101 page evidence creates deduplicated page-wide suggestions only for supported terms', () => {
  const { vocabulary } = fixture();
  const matches = vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: '61in101', evidence: ['Interior Finish Plan, Signage & Schedules', 'P-1', 'P-1', 'FIRE EXTINGUISHER CABINET DETAIL', '518-22-700', '61IN101'] });
  assert.deepEqual(matches.map(item => item.sectionNumber), ['09 91 00', '10 14 00', '10 44 13']);
  assert.ok(matches.every(item => item.applicabilityScope === 'page-wide' && item.status === 'suggested'));
});

test('mechanical and electrical evidence resolve to indexed governing sections without leakage', () => {
  const { vocabulary } = fixture();
  const mechanical = vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: '61m101', evidence: ['MECHANICAL PLAN', 'HVAC DUCTWORK', 'VAV-12', 'AIR OUTLET', 'TESTING AND BALANCING', 'COMMISSIONING'] });
  assert.deepEqual(mechanical.map(item => item.sectionNumber), ['23 05 93', '23 08 00', '23 31 00', '23 37 00']);
  const electrical = vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: '61e401', evidence: ['ELECTRICAL PLAN', 'PANELBOARD', 'GROUNDING AND BONDING', 'RACEWAYS AND BOXES'] });
  assert.deepEqual(electrical.map(item => item.sectionNumber), ['26 05 00', '26 05 26', '26 05 33', '26 24 16']);
});

test('plumbing and fire protection evidence resolve to indexed governing sections without leakage', () => {
  const { vocabulary } = fixture();
  const plumbing = vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: '61p100', evidence: ['PLUMBING PLAN', 'PLUMBING PIPING', 'VALVE', 'FIXTURE', 'DOMESTIC WATER'] });
  assert.deepEqual(plumbing.map(item => item.sectionNumber), ['22 05 00']);
  const fireProtection = vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: '61fx100', evidence: ['FIRE PROTECTION PLAN', 'SPRINKLER HEAD', 'SPRINKLER RISER'] });
  assert.deepEqual(fireProtection.map(item => item.sectionNumber), ['21 13 13']);
});

test('generic discipline titles do not produce unsupported matches without specific evidence', () => {
  const { vocabulary } = fixture();
  assert.deepEqual(vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: '61m101', evidence: ['MECHANICAL PLAN'] }), []);
  assert.deepEqual(vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: '61e401', evidence: ['ELECTRICAL DETAILS'] }), []);
});

test('object vocabulary produces only object-specific indexed candidates', () => {
  const { vocabulary } = fixture();
  const cases = [['Finish P-1','09 91 00'], ['Sign Type S-3','10 14 00'], ['RB resilient base','09 65 13'], ['LVT resilient tile','09 65 19'], ['corner guard wall protection','10 26 00'], ['FEC-2 fire extinguisher cabinet','10 44 13']];
  for (const [evidence, expected] of cases) {
    const matches = vocabulary.matchObject({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: 'page', objectId: evidence, evidence: [evidence] });
    assert.deepEqual(matches.map(item => item.sectionNumber), [expected]); assert.equal(matches[0].applicabilityScope, 'object-specific'); assert.equal(matches[0].status, 'suggested');
  }
});

test('unsupported evidence and unindexed or cross-project sections never qualify', () => {
  const { vocabulary } = fixture();
  assert.deepEqual(vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', evidence: ['consultant address 700 Main Street'] }), []);
  assert.deepEqual(vocabulary.matchPage({ projectId: 'other', specificationDocumentId: 'bedford-spec', evidence: ['signage schedule'] }), []);
  assert.deepEqual(vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'missing', evidence: ['signage schedule'] }), []);
});

test('61T-401 page evidence resolves only indexed Division 27 sections without duplicates',()=>{const{vocabulary}=fixture();const matches=vocabulary.matchPage({projectId:'bedford',specificationDocumentId:'bedford-spec',pageId:'61t401',evidence:['TELECOMMUNICATIONS ROOM PLAN','TELECOM OUTLET SCHEDULE','CABLE TRAY','TELECOM OUTLET SCHEDULE']});assert.deepEqual(matches.map(item=>item.sectionNumber),['27 05 00','27 05 36','27 10 00']);assert.ok(matches.every(item=>item.status==='suggested'&&item.applicabilityScope==='page-wide'));});
test('telecom objects remain object-specific and generic room numbers produce no links',()=>{const{vocabulary}=fixture();assert.deepEqual(vocabulary.matchObject({projectId:'bedford',specificationDocumentId:'bedford-spec',pageId:'61t401',objectId:'outlet',evidence:['Data outlet 4A']}).map(item=>item.sectionNumber),['27 10 00']);assert.deepEqual(vocabulary.matchObject({projectId:'bedford',specificationDocumentId:'bedford-spec',pageId:'61t401',objectId:'room',evidence:['Room 137']}),[]);});
test('telecom vocabulary never returns a section absent from the active specification index',()=>{const index=createSpecificationIndex({storage:memory()});index.index({document:{id:'partial',projectId:'bedford'},tocRows:[{id:'structured',sectionNumber:'27 10 00',sectionTitle:'Structured Cabling',pageStart:100}]});const vocabulary=createProjectSpecificationVocabulary({specificationIndex:index});assert.deepEqual(vocabulary.matchPage({projectId:'bedford',specificationDocumentId:'partial',pageId:'61t401',evidence:['telecom outlet cable tray equipment rack']}).map(item=>item.sectionNumber),['27 10 00']);});

test('an explicit indexed section reference is confirmed while vocabulary remains suggested', () => {
  const { vocabulary } = fixture();
  assert.equal(vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', evidence: ['REFER TO SECTION 10 14 00'] })[0].status, 'confirmed');
  assert.equal(vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', evidence: ['SIGNAGE SCHEDULE'] })[0].status, 'suggested');
});

test('vocabulary links flow into scoped requirements while rejection and manual confirmation persist', () => {
  const { index, vocabulary } = fixture(); const storage = memory();
  const links = createDrawingSpecificationLinkService({ index, storage, storageKey: 'links' });
  const resolver = createDrawingRequirementsResolver({ specificationIndex: index, relationshipEngine: createProjectRelationshipEngine({ storage: memory() }) });
  const pageMatch = vocabulary.matchPage({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: 'page', evidence: ['SIGNAGE SCHEDULE'] })[0];
  const pageLink = links.link({ ...pageMatch, drawingDocumentId: 'drawing', drawingPageId: 'page' });
  const pageResult = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-entity', drawingSpecLinks: links.forPage('page', null), tradeChannel: { key: 'all-trades', divisions: [] } });
  assert.equal(pageResult.suggestedSpecifications[0].applicabilityScope, 'page-wide');
  links.reject(pageLink.linkId, 'Not applicable here');
  links.link({ ...pageMatch, drawingDocumentId: 'drawing', drawingPageId: 'page' });
  assert.equal(links.forPage('page', null)[0].status, 'rejected');
  const objectMatch = vocabulary.matchObject({ projectId: 'bedford', specificationDocumentId: 'bedford-spec', pageId: 'page', objectId: 'finish', evidence: ['Finish P-1'] })[0];
  const objectLink = links.link({ ...objectMatch, drawingDocumentId: 'drawing', drawingPageId: 'page', objectId: 'finish' });
  links.confirm(objectLink.linkId, 'Verified finish schedule');
  links.link({ ...objectMatch, drawingDocumentId: 'drawing', drawingPageId: 'page', objectId: 'finish' });
  const objectResult = resolver.resolve({ projectId: 'bedford', pageEntityId: 'page-entity', selectedObjectId: 'finish', drawingSpecLinks: links.forPage('page', 'finish'), tradeChannel: { key: 'all-trades', divisions: [] } });
  assert.equal(objectResult.confirmedSpecifications[0].sectionNumber, '09 91 00'); assert.equal(objectResult.confirmedSpecifications[0].applicabilityScope, 'object-specific');
});
