import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createChiefSpecificationSME } from '../src/chief-specification-sme.js';
import { createSpecificationReverseIndex } from '../src/specification-reverse-index.js';
import { createChiefIntelligenceBridge } from '../src/chief-intelligence-bridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const authoritativeSections = readJson('project-data/bedford/specifications/authoritative-spec-index.json');
const relationshipData = readJson('project-data/bedford/relationships/building-61-spec-links.json');
const relationshipDataB62 = readJson('project-data/bedford/relationships/building-62-spec-links.json');
const drawingCatalog = readJson('project-data/bedford/drawing-catalogs/building-61.json');
const drawingCatalogB62 = readJson('project-data/bedford/drawing-catalogs/building-62.json');
const textSections = readJson('project-data/bedford/specifications/bedford-spec-index.json');

const drawingLinks = {
  forProject() {
    const collect = data => Object.entries(data.results || {}).flatMap(([sheetNumber, sheetData]) =>
      (sheetData.links || []).map(link => ({
        ...link,
        sheetNumber,
        projectId: 'bedford'
      }))
    );
    return [...collect(relationshipData), ...collect(relationshipDataB62)];
  },
  forPage(pageId) {
    return this.forProject().filter(link => link.drawingPageId === pageId);
  }
};

const catalogByPage = new Map((drawingCatalog.sheets || []).map(sheet => [sheet.pageId, sheet]));
const catalogByPageB62 = new Map((drawingCatalogB62.sheets || []).map(sheet => [sheet.pageId, sheet]));
const drawingCatalogService = {
  recordsForDocument() {
    return [...(drawingCatalog.sheets || []), ...(drawingCatalogB62.sheets || [])];
  }
};

const reverseIndex = createSpecificationReverseIndex({
  drawingSpecificationLinks: drawingLinks
});

const sme = createChiefSpecificationSME({
  projectId: 'bedford',
  getAuthoritativeSections: () => authoritativeSections,
  getSectionTextSections: () => textSections,
  getDrawingLinks: () => drawingLinks.forProject(),
  getDrawingCatalog: () => drawingCatalogService.recordsForDocument('bedford-specification-manual'),
  reverseIndex
});
sme.setTextSections(textSections);

test('61FX100 returns its governing fire protection and alarm sections', () => {
  const activeSheet = catalogByPage.get('518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf:page:17');
  const result = sme.answerQuestion('What specs apply to this drawing?', { activeSheet });
  const sectionNumbers = result.specifications.map(item => item.sectionNumber);

  assert.ok(sectionNumbers.includes('21 13 13'));
  assert.ok(sectionNumbers.includes('28 31 00'));
  assert.ok(result.drawings.some(item => item.sheetNumber === '61FX100'));
  assert.ok(result.drawings.some(item => item.sheetNumber === '61FX401'));
});

test('28 31 00 returns related Building 61 fire drawings', () => {
  const result = sme.answerQuestion('What drawings relate to 28 31 00?');
  const sheetNumbers = result.drawings.map(item => item.sheetNumber);

  assert.ok(sheetNumbers.includes('61FX100'));
  assert.ok(sheetNumbers.includes('61FX101'));
  assert.ok(sheetNumbers.includes('61FX102'));
  assert.ok(sheetNumbers.includes('61FX401'));
  assert.ok(sheetNumbers.includes('61FX501'));
});

test('23 31 00 returns related Mechanical drawings', () => {
  const result = sme.answerQuestion('Where is 23 31 00 used?');
  const sheetNumbers = result.drawings.map(item => item.sheetNumber);

  assert.ok(sheetNumbers.includes('61M-102'));
  assert.ok(sheetNumbers.includes('61M-401'));
  assert.ok(sheetNumbers.includes('61M-501'));
});

test('HVAC discipline queries return Bedford HVAC sections and associated drawings', () => {
  const result = sme.answerQuestion('What specs cover HVAC?');
  const sectionNumbers = result.specifications.map(item => item.sectionNumber);

  assert.ok(sectionNumbers.includes('23 31 00') || sectionNumbers.includes('23 05 93'));
  assert.ok(result.drawings.length > 0);
  assert.ok(result.drawings.some(item => String(item.sheetNumber || '').startsWith('61M-')));
});

test('explicit building intent scopes discipline drawings to the requested Bedford drawing set', () => {
  const activeSheetB61 = catalogByPage.get('518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf:page:1');
  const b62 = sme.answerQuestion('What drawings apply to building 62 electrical?', { activeSheet: activeSheetB61 });
  assert.equal(b62.drawings.length > 0, true);
  assert.equal(b62.drawings.some(item => String(item.sheetNumber || '').startsWith('62E-') || String(item.sheetNumber || '').startsWith('62E')), true);
  assert.equal(b62.drawings.some(item => String(item.sheetNumber || '').startsWith('61E-')), false);
  assert.equal(b62.drawings.some(item => item.documentId === 'bedford-b61-drawings'), false);

  const activeSheetB62 = catalogByPageB62.get('518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf:page:1');
  const b61 = sme.answerQuestion('What drawings apply to building 61 electrical?', { activeSheet: activeSheetB62 });
  assert.equal(b61.drawings.length > 0, true);
  assert.equal(b61.drawings.some(item => String(item.sheetNumber || '').startsWith('61E-') || String(item.sheetNumber || '').startsWith('61E')), true);
  assert.equal(b61.drawings.some(item => String(item.sheetNumber || '').startsWith('62E-')), false);
  assert.equal(b61.drawings.some(item => item.documentId === 'bedford-b62-drawings'), false);

  const fallback = sme.answerQuestion('What drawings apply to electrical?', { activeSheet: activeSheetB61 });
  assert.equal(fallback.drawings.length > 0, true);
  assert.equal(fallback.drawings.some(item => String(item.sheetNumber || '').startsWith('61E-')), true);
  assert.equal(fallback.drawings.some(item => String(item.sheetNumber || '').startsWith('62E-')), false);
});

test('61T-100 returns telecom sections including 27 15 00 and 28 23 00', () => {
  const activeSheet = catalogByPage.get('518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf:page:48');
  const result = sme.answerQuestion('What specs apply to this drawing?', { activeSheet });
  const sectionNumbers = result.specifications.map(item => item.sectionNumber);

  assert.ok(sectionNumbers.includes('27 15 00'));
  assert.ok(sectionNumbers.includes('28 23 00'));
  assert.ok(result.drawings.some(item => item.sheetNumber === '61T-100'));
});

test('schedule-after-NTP questions stay focused on Bedford general requirements', () => {
  const result = sme.answerQuestion('How long after NTP until a schedule is posted according to specifications?');
  const sectionNumbers = result.specifications.map(item => item.sectionNumber);

  assert.ok(sectionNumbers.length > 0);
  assert.ok(sectionNumbers.every(sectionNumber => String(sectionNumber).startsWith('01')));
  assert.ok(result.answer.toLowerCase().includes('schedule') || result.answer.toLowerCase().includes('notice to proceed'));
});

test('Chief bridge preserves explicit building scope when answering drawing-related questions', () => {
  const bridge = createChiefIntelligenceBridge();
  const captured = [];
  const previousLookup = globalThis.__chiefRelationshipLookupForQuestion;
  const previousBuildingLookup = globalThis.__mcBedfordRelationshipLinksForBuilding;
  try {
    globalThis.__chiefRelationshipLookupForQuestion = () => [];
    globalThis.__mcBedfordRelationshipLinksForBuilding = buildingId => {
      const data = buildingId === '62' ? relationshipDataB62 : relationshipData;
      return Object.entries(data.results || {}).flatMap(([sheetNumber, sheetData]) =>
        (Array.isArray(sheetData?.links) ? sheetData.links : []).map(link => ({
          ...link,
          sheetNumber,
          projectId: 'bedford',
          drawingDocumentId: buildingId === '62' ? 'bedford-b62-drawings' : 'bedford-b61-drawings'
        }))
      );
    };
    bridge.initialize({
      specificationSME: {
        answerQuestion(question, options = {}) {
          captured.push(options);
          const drawingLinks = Array.isArray(options.drawingLinks) ? options.drawingLinks : [];
          return {
            queryType: 'discipline',
            question,
            answer: '',
            specifications: [],
            drawings: drawingLinks.map(link => ({
              sheetNumber: link.sheetNumber,
              documentId: link.drawingDocumentId,
              pageId: link.drawingPageId,
              relationshipTypes: [link.relationshipType || 'RELATED']
            })),
            sectionCount: 0,
            drawingCount: drawingLinks.length
          };
        }
      }
    });

    const b62 = bridge.buildProjectContext('What drawings relate to building 62 electrical?');
    assert.equal(captured.at(-1)?.buildingId, '62');
    assert.equal(b62.specificationAnswer.drawings.length > 0, true);
    assert.equal(b62.specificationAnswer.drawings.some(item => String(item.sheetNumber || '').startsWith('62E-')), true);
    assert.equal(b62.specificationAnswer.drawings.some(item => String(item.sheetNumber || '').startsWith('61E-')), false);

    const b61 = bridge.buildProjectContext('What drawings relate to building 61 electrical?');
    assert.equal(captured.at(-1)?.buildingId, '61');
    assert.equal(b61.specificationAnswer.drawings.length > 0, true);
    assert.equal(b61.specificationAnswer.drawings.some(item => String(item.sheetNumber || '').startsWith('61E-')), true);
    assert.equal(b61.specificationAnswer.drawings.some(item => String(item.sheetNumber || '').startsWith('62E-')), false);
  } finally {
    globalThis.__chiefRelationshipLookupForQuestion = previousLookup;
    globalThis.__mcBedfordRelationshipLinksForBuilding = previousBuildingLookup;
  }
});
