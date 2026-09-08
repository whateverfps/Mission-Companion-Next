import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const authoritativeSections = readJson('project-data/bedford/specifications/authoritative-spec-index.json');
const bedfordSpecificationSections = readJson('project-data/bedford/specifications/bedford-spec-index.json');
const relationshipData = readJson('project-data/bedford/relationships/building-61-spec-links.json');
const relationshipDataB62 = readJson('project-data/bedford/relationships/building-62-spec-links.json');
const relationshipDataMCR = readJson('project-data/bedford/relationships/building-MCR-spec-links.json');
const drawingCatalog = readJson('project-data/bedford/drawing-catalogs/building-61.json');
const drawingCatalogB62 = readJson('project-data/bedford/drawing-catalogs/building-62.json');
const drawingCatalogMCR = readJson('project-data/bedford/drawing-catalogs/building-MCR.json');

const { createSpecificationIndex } = await import('../src/specification-index.js');
const { createDrawingCatalog } = await import('../src/drawing-catalog.js');
const { createDrawingSpecificationLinkService } = await import('../src/drawing-spec-links.js');
const { loadBedfordDrawingSpecMappings } = await import('../src/specification-knowledge.js');
const { createChiefSpecificationSME } = await import('../src/chief-specification-sme.js');
const { createChiefIntelligenceBridge } = await import('../src/chief-intelligence-bridge.js');
const { openSpecificationDocument } = await import('../src/authoritative-spec-resolver.js');
const { getBedfordDrawingSetForReference } = await import('../src/bedford-project.js');
const { BEDFORD_PROJECT } = await import('../src/bedford-project.js');
const { BEDFORD_NTP_SOURCE_DOCUMENT } = await import('../src/workspace-milestones.js');

test('Bedford bootstrap loads the authoritative relationship graph before Chief asks questions', async () => {
  const specificationIndex = createSpecificationIndex();
  const drawingSpecificationLinks = createDrawingSpecificationLinkService({
    index: specificationIndex,
    persistence: null
  });
  const chiefSpecificationSME = createChiefSpecificationSME({
    projectId: 'bedford',
    getAuthoritativeSections: () => authoritativeSections,
    getSectionTextSections: () => bedfordSpecificationSections,
    getDrawingLinks: () => drawingSpecificationLinks.forProject('bedford'),
    getDrawingCatalog: () => drawingCatalog.sheets || [],
    reverseIndex: null
  });
  chiefSpecificationSME.setTextSections(bedfordSpecificationSections);

  const specDocument = {
    id: 'bedford-specifications',
    projectId: 'bedford',
    name: 'Bedford Specification Manual',
    title: 'Bedford Specification Manual'
  };
  specificationIndex.index({
    document: specDocument,
    sourceSections: authoritativeSections.map(section => ({
      ...section,
      pageStart: section.pageStart || section.startPdfPage || section.startPage || null,
      pageEnd: section.pageEnd || section.endPdfPage || section.endPage || section.startPdfPage || section.startPage || null
    }))
  });
  chiefSpecificationSME.setTextSections(bedfordSpecificationSections);

  const loadResult = await loadBedfordDrawingSpecMappings({
    drawingSpecificationLinks,
    specificationIndex,
    projectId: 'bedford',
    drawingDocumentId: 'bedford-specifications',
    baseUri: 'http://example.test/',
    fetcher: async url => ({
      ok: true,
      url,
      async json() {
        return relationshipData;
      }
    })
  });

  assert.equal(loadResult.loaded, 222);
  const records = drawingSpecificationLinks.forProject('bedford');
  assert.equal(records.length, 222);

  const sheetNumbers = [...new Set(Object.keys(relationshipData.results || {}))];
  assert.equal(sheetNumbers.length, 70);

  const fireSheet = relationshipData.results['61FX100'];
  assert.ok(fireSheet);
  assert.equal(fireSheet.links.length, 6);

  const firePageId = fireSheet.pageId;
  const fireRecords = records.filter(item => item.drawingPageId === firePageId);
  assert.equal(fireRecords.length, 6);
  assert.deepEqual(
    fireRecords.map(item => item.sectionNumber).sort(),
    ['01 33 23', '07 84 00', '09 91 00', '21 08 00', '21 13 13', '28 31 00'].sort()
  );

  const bridge = createChiefIntelligenceBridge();
  bridge.initialize({ specificationSME: chiefSpecificationSME });
  const context = bridge.buildProjectContext('What specs apply to 61FX100?');
  assert.equal(context.specificationAnswer?.specifications?.length, 6);
  assert.deepEqual(
    context.specificationAnswer?.specifications?.map(item => item.sectionNumber).sort(),
    ['01 33 23', '07 84 00', '09 91 00', '21 08 00', '21 13 13', '28 31 00'].sort()
  );
  assert.equal(context.specificationAnswer?.drawings?.some(item => item.sheetNumber === '61FX100'), true);
});

test('Bedford specification source resolution keeps the built-in specification document resolvable across repeated opens', async () => {
  const documents = [{
    id: 'bedford-specifications',
    projectId: 'bedford',
    name: 'Bedford Specification Manual',
    title: 'Bedford Specification Manual',
    role: 'specification',
    builtIn: true
  }];
  const engine = {
    documents: async () => documents,
    sourceFile: async documentId => documentId === 'bedford-specifications'
      ? { documentId, sourceBlob: new Blob(['pdf'], { type: 'application/pdf' }) }
      : null
  };
  const originalFetch = globalThis.fetch;
  const originalAlert = globalThis.alert;
  const originalDocument = globalThis.document;
  globalThis.fetch = async () => ({ ok: true, async json() { return authoritativeSections; } });
  globalThis.alert = () => {};
  globalThis.document = { baseURI: 'http://example.test/' };

  try {
    const first = await openSpecificationDocument('09 91 00', engine);
    const second = await openSpecificationDocument('28 31 00', engine);
    const third = await openSpecificationDocument('21 13 13', engine);

    assert.equal(first?.section?.documentId, 'bedford-specifications');
    assert.equal(second?.section?.documentId, 'bedford-specifications');
    assert.equal(third?.section?.documentId, 'bedford-specifications');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.alert = originalAlert;
    globalThis.document = originalDocument;
  }
});

test('Bedford project fixture includes the contractual Notice to Proceed source document', () => {
  assert.ok(BEDFORD_PROJECT.documents.some(document => document.id === BEDFORD_NTP_SOURCE_DOCUMENT.id));
  assert.equal(BEDFORD_PROJECT.documents.find(document => document.id === BEDFORD_NTP_SOURCE_DOCUMENT.id)?.staticPath, BEDFORD_NTP_SOURCE_DOCUMENT.staticPath);
});

test('Bedford built-in PDF source documents keep canonical packaged source paths without duplicates', () => {
  const builtInPdfDocs = BEDFORD_PROJECT.documents.filter(document => document.builtIn && document.staticPath && document.mimeType === 'application/pdf');
  const paths = builtInPdfDocs.map(document => document.staticPath);

  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(paths.sort(), [
    'project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
    'project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf',
    'project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.MCR.20260316.pdf',
    'project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf',
    'project-documents/bedford/drawings/C08 - Notice to Proceed Sawtooth - EHRM Upgrades Bedford MA.pdf'
  ].sort());
});

test('Bedford drawing catalog bootstrap seeds the authoritative sheet map and stays idempotent', async () => {
  const catalog = createDrawingCatalog({ storage: null });
  const document = {
    id: 'bedford-b61-drawings',
    projectId: 'bedford',
    documentType: 'drawing-set'
  };

  const first = catalog.reconcile({
    documentId: document.id,
    documentType: document.documentType,
    projectId: document.projectId,
    drawingSetId: 'bedford-b61',
    pageCount: drawingCatalog.pageCount || drawingCatalog.sheets?.length || 70,
    authoritativeRecords: drawingCatalog.sheets || []
  });

  assert.equal(first.length, 70);
  assert.equal(catalog.recordsForDocument(document.id).length, 70);
  assert.equal(catalog.recordsForDocument(document.id).find(item => item.sheetNumber === '61FX100')?.pageId, 'drawing-page:bedford-b61-drawings:16');

  const second = catalog.reconcile({
    documentId: document.id,
    documentType: document.documentType,
    projectId: document.projectId,
    drawingSetId: 'bedford-b61',
    pageCount: drawingCatalog.pageCount || drawingCatalog.sheets?.length || 70,
    authoritativeRecords: drawingCatalog.sheets || []
  });

  assert.equal(second.length, 70);
  assert.equal(catalog.recordsForDocument(document.id).length, 70);
});

test('Bedford startup registers source files for every built-in drawing set', async () => {
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  assert.match(app, /const bedfordDrawingDocs = bedfordDocs\.filter\(d => bedfordDrawingSets\.some\(set => set\.documentId === d\.id\)\);/);
  assert.match(app, /for \(const drawingDoc of bedfordDrawingDocs\) \{/);
  assert.match(app, /console\.log\('Bedford drawing source file registered', drawingDoc\.id\);/);
  assert.doesNotMatch(app, /const drawingDoc = bedfordDocs\.find\(d => d\.id === BEDFORD_DRAWING_DOCUMENT_ID\);/);
});

test('Chief drawing-query lookup prefers explicit Bedford building intent before active drawing context', async () => {
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  assert.match(app, /const explicitBuildingId = chiefQuestionBuildingId\(rawQuestion\) \|\| chiefQuestionBuildingId\(drawingContext\?\.identity\?\.building \|\| ''\);/);
  assert.match(app, /explicitBuildingId\s*\?\s*bedfordRelationshipLinksForBuilding\(explicitBuildingId\)/);
  assert.match(app, /function bedfordRelationshipLinksForBuilding\(buildingId = ''\)/);
});

test('Chief drawing reference lookup falls back across Bedford drawing catalogs instead of hardcoding Building 61', async () => {
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  assert.match(app, /const drawingSet = getBedfordDrawingSetForReference\(drawing\);/);
  assert.match(app, /const referenceCatalog = drawingSet/);
  assert.doesNotMatch(app, /drawingCatalog\.recordsForDocument\(BEDFORD_DRAWING_DOCUMENT_ID\)/);
});

test('Bedford drawing reference identity maps to the correct building set before catalog resolution', async () => {
  const b62Reference = {
    sheetNumber: '62E-702',
    pageId: '518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf:page:44',
    drawingPageId: '518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf:page:44'
  };
  const b61Reference = {
    sheetNumber: '61E-702',
    pageId: '518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf:page:44',
    drawingPageId: '518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf:page:44'
  };

  const b62Set = getBedfordDrawingSetForReference(b62Reference);
  const b61Set = getBedfordDrawingSetForReference(b61Reference);
  const mcrReference = {
    sheetNumber: 'MCRA-101',
    pageId: drawingCatalogMCR.sheets.find(item => item.sheetNumber === 'MCRA-101')?.pageId || 'drawing-page:bedford-mcr-drawings:0',
    drawingPageId: drawingCatalogMCR.sheets.find(item => item.sheetNumber === 'MCRA-101')?.pageId || 'drawing-page:bedford-mcr-drawings:0'
  };
  const mcrSet = getBedfordDrawingSetForReference(mcrReference);

  assert.equal(b62Set?.documentId, 'bedford-b62-drawings');
  assert.equal(b61Set?.documentId, 'bedford-b61-drawings');
  assert.equal(mcrSet?.documentId, 'bedford-mcr-drawings');
});

test('Bedford B62 catalog and relationships load through the same shared pipeline', async () => {
  const specificationIndex = createSpecificationIndex();
  const drawingSpecificationLinks = createDrawingSpecificationLinkService({
    index: specificationIndex,
    persistence: null
  });
  specificationIndex.index({
    document: {
      id: 'bedford-specifications',
      projectId: 'bedford',
      name: 'Bedford Specification Manual',
      title: 'Bedford Specification Manual'
    },
    sourceSections: authoritativeSections.map(section => ({
      ...section,
      pageStart: section.pageStart || section.startPdfPage || section.startPage || null,
      pageEnd: section.pageEnd || section.endPdfPage || section.endPage || section.startPdfPage || section.startPage || null
    }))
  });

  const loadResult = await loadBedfordDrawingSpecMappings({
    drawingSpecificationLinks,
    specificationIndex,
    projectId: 'bedford',
    drawingDocumentId: 'bedford-specifications',
    relationshipsPath: 'project-data/bedford/relationships/building-62-spec-links.json',
    baseUri: 'http://example.test/',
    fetcher: async url => ({
      ok: true,
      url,
      async json() {
        return relationshipDataB62;
      }
    })
  });

  assert.equal(loadResult.loaded, 216);
  const records = drawingSpecificationLinks.forProject('bedford');
  assert.equal(records.length, 216);

  const sheetNumbers = [...new Set(Object.keys(relationshipDataB62.results || {}))];
  assert.equal(sheetNumbers.length, 68);
  const fireSheet = relationshipDataB62.results['62FX100'];
  assert.ok(fireSheet);
  assert.equal(fireSheet.links.length, 6);

  const firePageId = fireSheet.pageId;
  const fireRecords = records.filter(item => item.drawingPageId === firePageId);
  assert.equal(fireRecords.length, 6);
  assert.equal(drawingCatalogB62.sheets.some(item => item.sheetNumber === '62FX100'), true);
});

test('Bedford MCR catalog and relationships load through the same shared pipeline', async () => {
  const specificationIndex = createSpecificationIndex();
  const drawingSpecificationLinks = createDrawingSpecificationLinkService({
    index: specificationIndex,
    persistence: null
  });
  specificationIndex.index({
    document: {
      id: 'bedford-specifications',
      projectId: 'bedford',
      name: 'Bedford Specification Manual',
      title: 'Bedford Specification Manual'
    },
    sourceSections: authoritativeSections.map(section => ({
      ...section,
      pageStart: section.pageStart || section.startPdfPage || section.startPage || null,
      pageEnd: section.pageEnd || section.endPdfPage || section.endPage || section.startPdfPage || section.startPage || null
    }))
  });

  const loadResult = await loadBedfordDrawingSpecMappings({
    drawingSpecificationLinks,
    specificationIndex,
    projectId: 'bedford',
    drawingDocumentId: 'bedford-specifications',
    relationshipsPath: 'project-data/bedford/relationships/building-MCR-spec-links.json',
    baseUri: 'http://example.test/',
    fetcher: async url => ({
      ok: true,
      url,
      async json() {
        return relationshipDataMCR;
      }
    })
  });

  assert.equal(loadResult.loaded, 711);
  const records = drawingSpecificationLinks.forProject('bedford');
  assert.equal(records.length, 711);
  assert.equal(drawingCatalogMCR.sheets.length, 120);
  assert.equal(drawingCatalogMCR.sheets.some(item => item.sheetNumber === 'MCRT-100'), true);
});
