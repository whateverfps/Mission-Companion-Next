import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildConstructionIntelligencePanelModel, loadConstructionIntelligencePanelState, saveConstructionIntelligencePanelState } from '../src/construction-intelligence-panel.js';

const sheet = { pageId: 'page-1', pageNumber: 12, sheetNumber: '61IN101', discipline: 'Interiors', identityStatus: 'authoritative', building: '61' };

test('page context contains only drawing facts and deduplicated object counts', () => {
  const model = buildConstructionIntelligencePanelModel({ document: { title: 'Building 61' }, sheet, trade: { label: 'Interiors' }, pageObjects: [
    { objectId: 'a', type: 'finish', verificationState: 'confirmed' },
    { objectId: 'b', type: 'finish', verificationState: 'candidate' },
    { objectId: 'c', type: 'room', verificationState: 'rejected' }
  ] });
  assert.equal(model.mode, 'page');
  assert.deepEqual(model.page.objectCounts, { finish: 2 });
  assert.equal('relationships' in model, false);
  assert.deepEqual(model.specifications, { confirmed: [], suggested: [] });
});

test('resolver confirmed and suggested specifications populate the shared panel model directly', () => {
  const confirmed = { requirementId: 'c1', specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'confirmed', applicabilityScope: 'page-wide', evidenceText: 'Confirmed paint note.', startPdfPage: 410, sourcePageNumber: 410, sourceDocumentId: 'b61', evidence: [{ id: 'e1' }] };
  const suggested = { requirementId: 's1', specificationDocumentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', status: 'suggested', applicabilityScope: 'page-wide', evidenceText: 'Suggested sign note.', startPdfPage: 415, sourcePageNumber: 415, sourceDocumentId: 'b61', evidenceObservations: [{ id: 'e2' }] };
  const model = buildConstructionIntelligencePanelModel({ sheet, requirements: { status: 'complete', confirmedSpecifications: [confirmed], suggestedSpecifications: [suggested], fieldRequirements: {} }, specificationLinks: [] });
  assert.equal(model.specifications.confirmed.length, 1);
  assert.equal(model.specifications.suggested.length, 1);
  assert.equal(model.specifications.confirmed[0].sectionNumber, '09 91 00');
  assert.equal(model.specifications.confirmed[0].sourceDocumentId, 'b61');
  assert.equal(model.specifications.confirmed[0].canShowSource, true);
  assert.equal(model.specifications.confirmed[0].evidenceCount, 1);
  assert.equal(model.specifications.suggested[0].sectionNumber, '10 14 00');
  assert.equal(model.specifications.suggested[0].sourcePageNumber, 415);
  assert.equal(model.specifications.suggested[0].evidenceCount, 1);
});

test('resolver specification arrays take precedence over specificationRecords fallback data', () => {
  const confirmed = { requirementId: 'c1', specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'confirmed', applicabilityScope: 'page-wide', evidenceText: 'Confirmed paint note.', startPdfPage: 410, sourceDocumentId: 'b61' };
  const fallback = { requirementId: 'f1', specificationDocumentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', status: 'suggested', applicabilityScope: 'page-wide', evidenceText: 'Fallback suggestion.', startPdfPage: 415 };
  const model = buildConstructionIntelligencePanelModel({ sheet, requirements: { confirmedSpecifications: [confirmed], suggestedSpecifications: [], fieldRequirements: {} }, specificationLinks: [fallback] });
  assert.deepEqual(model.specifications.confirmed.map(item => item.sectionNumber), ['09 91 00']);
  assert.deepEqual(model.specifications.suggested, []);
});

test('fallback specificationRecords remain available when resolver arrays are absent', () => {
  const fallback = { requirementId: 'f1', specificationDocumentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', status: 'suggested', applicabilityScope: 'page-wide', evidenceText: 'Fallback suggestion.', startPdfPage: 415 };
  const model = buildConstructionIntelligencePanelModel({ sheet, requirements: { fieldRequirements: {} }, specificationLinks: [fallback] });
  assert.equal(model.specifications.suggested.length, 1);
  assert.equal(model.specifications.suggested[0].sectionNumber, '10 14 00');
  assert.equal(model.specifications.suggested[0].canShowSource, true);
});

test('Plans and object contexts can produce the same specification counts for the same sheet context', () => {
  const confirmed = { requirementId: 'c1', specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'confirmed', applicabilityScope: 'object-specific', objectId: 'p1', evidenceText: 'Confirmed paint note.', startPdfPage: 410 };
  const suggested = { requirementId: 's1', specificationDocumentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', status: 'suggested', applicabilityScope: 'object-specific', objectId: 'p1', evidenceText: 'Suggested sign note.', startPdfPage: 415 };
  const pageModel = buildConstructionIntelligencePanelModel({ sheet, requirements: { confirmedSpecifications: [confirmed], suggestedSpecifications: [suggested], fieldRequirements: {} }, specificationLinks: [] });
  const objectModel = buildConstructionIntelligencePanelModel({ sheet, selectedObject: { objectId: 'p1', label: 'Finish P-1', type: 'finish' }, requirements: { confirmedSpecifications: [confirmed], suggestedSpecifications: [suggested], fieldRequirements: {} }, specificationLinks: [] });
  assert.deepEqual([pageModel.specifications.confirmed.length, pageModel.specifications.suggested.length], [1, 1]);
  assert.deepEqual([objectModel.specifications.confirmed.length, objectModel.specifications.suggested.length], [1, 1]);
});

test('selected object replaces page context and deduplicates specifications', () => {
  const requirement = { requirementId: 'r1', specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'confirmed', evidenceText: 'Finish schedule P-1.', startPdfPage: 410 };
  const model = buildConstructionIntelligencePanelModel({ sheet, selectedObject: { objectId: 'permanent-1', label: 'Finish P-1', type: 'finish', trade: 'Interiors', confidence: .97, verificationState: 'confirmed', region: { x: .1, y: .2, width: .3, height: .4 }, evidenceText: 'Room finish tag.' }, schedules: [{ identifier: 'S-1', label: 'Door schedule' }], legends: [{ identifier: 'L-1', label: 'Legend 1' }], keyedNotes: [{ identifier: 'K-1', label: 'Keyed note 1' }], references: [{ label: 'Detail 1' }], relatedDetails: [{ label: 'Detail A' }], requirements: { confirmedSpecifications: [requirement], suggestedSpecifications: [], fieldRequirements: {} }, specificationLinks: [{ ...requirement, linkId: 'link-1' }], relationshipGroups: {}, objectHistory: [] });
  assert.equal(model.mode, 'object');
  assert.equal(model.object.objectId, 'permanent-1');
  assert.equal(model.specifications.confirmed.length, 1);
  assert.equal(model.specifications.confirmed[0].canShowSource, true);
  assert.equal(model.object.sourceSheet, '61IN101');
  assert.equal(model.object.evidenceSource, 'Room finish tag.');
  assert.equal(model.object.regionSummary, 'x 10%, y 20%, w 30%, h 40%');
  assert.equal(model.object.schedules.length, 1);
  assert.equal(model.object.legends.length, 1);
  assert.equal(model.object.keyedNotes.length, 1);
  assert.equal(model.object.references.length, 1);
  assert.equal(model.object.relatedDetails.length, 1);
  assert.equal('page' in model, false);
});

test('empty operational categories disappear and rejected relationships stay hidden', () => {
  const model = buildConstructionIntelligencePanelModel({ sheet, selectedObject: { objectId: 'fec-2', label: 'Fire Extinguisher FEC-2', type: 'fire-extinguisher-cabinet', verificationState: 'confirmed' }, requirements: {}, relationshipGroups: { issues: [{ entity: { entityId: 'issue-1', label: 'Rejected issue' }, relationship: { relationshipId: 'rel-1', verificationState: 'rejected' } }] } });
  assert.deepEqual(model.pmis.issues, []);
  assert.deepEqual(model.documents.photos, []);
  assert.deepEqual(model.schedule, []);
  assert.deepEqual(model.procurement, []);
});

test('object change creates a new isolated panel model without mutating viewport input', () => {
  const viewport = { pageId: 'page-1', zoom: 2, bounds: { x: .1, y: .2, width: .4, height: .4 } };
  const first = buildConstructionIntelligencePanelModel({ sheet, viewportContext: viewport, selectedObject: { objectId: 'p1', label: 'Finish P-1', type: 'finish', verificationState: 'confirmed' } });
  const second = buildConstructionIntelligencePanelModel({ sheet, viewportContext: viewport, selectedObject: { objectId: 'fec', label: 'FEC-2', type: 'fire-extinguisher-cabinet', verificationState: 'confirmed' } });
  assert.equal(first.object.objectId, 'p1');
  assert.equal(second.object.objectId, 'fec');
  assert.deepEqual(viewport, { pageId: 'page-1', zoom: 2, bounds: { x: .1, y: .2, width: .4, height: .4 } });
});

test('page context exposes page-wide specifications and section-scoped articles without duplicates', () => {
  const requirement = { requirementId: 'page-paint', drawingSpecLinkId: 'link', specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'suggested', applicabilityScope: 'page-wide', evidenceText: 'Finish legend P-1 and P-2.', startPdfPage: 410 };
  const model = buildConstructionIntelligencePanelModel({ sheet, requirements: { confirmedSpecifications: [], suggestedSpecifications: [requirement], fieldRequirements: { installation: [{ ...requirement, article: { id: 'install', heading: '3.2 INSTALLATION' } }] }, projectWideRequirements: [] }, specificationLinks: [{ ...requirement, linkId: 'link' }] });
  assert.equal(model.specifications.suggested.length, 1); assert.equal(model.specifications.suggested[0].applicabilityScope, 'page-wide');
  assert.deepEqual(model.fieldRequirements.map(item => item.article.heading), ['3.2 INSTALLATION']);
});

test('page context restores only populated sheet relationships and drawing content', () => {
  const related = { entity: { entityId: 'drawing-2', label: '61IN102', metadata: { navigationTarget: { pageNumber: 2 } } }, relationship: { relationshipId: 'rel-drawing', verificationState: 'confirmed' } };
  const model = buildConstructionIntelligencePanelModel({ document: { title: 'Building 61 - Interiors' }, sheet: { ...sheet, sheetTitle: 'Interior Finish Plan', primarySheetType: 'Plan' }, pageObjects: [{ objectId: 'finish', type: 'finish', verificationState: 'confirmed' }], schedules: [{ identifier: 'S-1', label: 'Door schedule' }], legends: [{ identifier: 'L-1', label: 'Legend 1' }], keyedNotes: [{ identifier: 'K-1', label: 'Keyed note 1' }], references: [{ label: 'Detail 1' }], relatedDetails: [{ label: 'Detail A' }], relationshipGroups: { relatedDrawings: [related], photos: [], risks: [] } });
  assert.equal(model.page.sheetTitle, 'Interior Finish Plan');
  assert.equal(model.page.drawingSet, 'Building 61 - Interiors');
  assert.equal(model.page.drawingType, 'Plan');
  assert.equal(model.page.pdfPage, 12);
  assert.equal(model.page.schedules.length, 1);
  assert.equal(model.page.legends.length, 1);
  assert.equal(model.page.keyedNotes.length, 1);
  assert.equal(model.page.references.length, 1);
  assert.equal(model.page.relatedDetails.length, 1);
  assert.deepEqual(model.drawingContent, { finish: 1 });
  assert.equal(model.relatedDrawings.length, 1);
  assert.equal(model.projectInformation.photos.length, 0);
});

test('object context excludes page-wide specifications and swaps by permanent object identity', () => {
  const page = { specificationDocumentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', status: 'suggested', applicabilityScope: 'page-wide' };
  const object = { specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'confirmed', applicabilityScope: 'object-specific', objectId: 'p1' };
  const model = buildConstructionIntelligencePanelModel({ sheet, selectedObject: { objectId: 'p1', label: 'Finish P-1', type: 'finish' }, requirements: { confirmedSpecifications: [object], suggestedSpecifications: [page] }, specificationLinks: [page, object] });
  assert.deepEqual(model.specifications.confirmed.map(item => item.sectionNumber), ['09 91 00']);
  assert.deepEqual(model.specifications.suggested, []);
});

test('collapsible state uses commercial defaults and persists a bounded UI preference', () => {
  const values = new Map(); const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(loadConstructionIntelligencePanelState(storage).expanded, ['construction-summary', 'chief-recommendation', 'specifications', 'field-requirements']);
  saveConstructionIntelligencePanelState(['current', 'history', 'history'], storage);
  assert.deepEqual(loadConstructionIntelligencePanelState(storage).expanded, ['current', 'history']);
});

test('developer diagnostics remain separate from operational panel records', () => {
  const model = buildConstructionIntelligencePanelModel({ sheet, developerDiagnostics: [{ kind: 'ocr-ambiguity', value: 'P-l' }] });
  assert.equal(model.diagnostics.length, 1);
  assert.equal(JSON.stringify(model.page).includes('ocr-ambiguity'), false);
  assert.equal(JSON.stringify(model.specifications).includes('ocr-ambiguity'), false);
});

test('Chief insights appear only when backed by an explicit page relationship', () => {
  const insight = { entity: { entityId: 'insight-1', label: 'Awaiting RFI 18.' }, relationship: { relationshipId: 'rel-insight', verificationState: 'confirmed' } };
  assert.equal(buildConstructionIntelligencePanelModel({ sheet }).chiefInsights.length, 0);
  assert.deepEqual(buildConstructionIntelligencePanelModel({ sheet, relationshipGroups: { chiefInsights: [insight] } }).chiefInsights.map(item => item.label), ['Awaiting RFI 18.']);
});

test('production panel preserves two-mode scroll, restores blank-click page context, and never owns PDF rendering', () => {
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const markup = source.slice(source.indexOf('function constructionIntelligencePanelMarkup'), source.indexOf('function relationshipGroupsMarkup'));
  assert.match(markup, /data-panel-mode=\"page\"/); assert.match(markup, /data-panel-mode=\"object\"/);
  assert.match(markup, /Sheet Inspector/); assert.match(markup, /Object Inspector/); assert.match(markup, /View Source/);
  assert.doesNotMatch(markup, /Open Section|Open Source Page|Review Evidence/);
  assert.match(markup, /Developer Diagnostics[^]*hidden/); assert.doesNotMatch(markup, /paintDrawingPage|renderPdfPage|PDFDocumentProxy/);
  assert.match(source, /constructionIntelligenceScroll\[priorIntelligence\.querySelector\('\[data-panel-mode\]'\)\.dataset\.panelMode\]/);
  assert.match(source, /data-drawing-clear-object[^]*selectedDrawingObject = null[^]*renderDrawingWorkspace/);
});

test('panel exposes compact degraded states and drawing paint precedes asynchronous enrichment', () => {
  assert.equal(buildConstructionIntelligencePanelModel({ sheet, requirements: { status: 'partial' } }).status, 'partial');
  assert.equal(buildConstructionIntelligencePanelModel({ sheet, requirements: { status: 'unavailable' } }).status, 'unavailable');
  const loadingPanel = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(loadingPanel, /Loading governing requirements/);
  const source = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const render = source.slice(source.indexOf('async function renderDrawingWorkspaceWithProviders'), source.indexOf('async function renderMissionControlDashboard'));
  assert.ok(render.indexOf('await paintDrawingPage') < render.indexOf('drawingRequirementsResolver.resolveLatest'));
  assert.match(render, /drawingRequirementsCacheKey\(/);
  assert.match(render, /drawingRequirementsRefreshTimer = setTimeout\(/);
  assert.match(render, /const requirementsRequestKey = drawingRequirementsCacheKey/);
  assert.match(render, /workspaceRenderRequest !== drawingWorkspaceRenderRequest/);
});

test('indexed articles become phased field work without invented checklist text', () => {
  const requirement = { requirementId: 'paint', specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'confirmed', applicabilityScope: 'object-specific', objectId: 'p1' };
  const model = buildConstructionIntelligencePanelModel({ sheet, selectedObject: { objectId: 'p1', label: 'Finish P-1', type: 'finish' }, requirements: { confirmedSpecifications: [requirement], fieldRequirements: {
    submittals: [{ ...requirement, article: { id: 'a1', heading: '1.3 SUBMITTALS' } }],
    installation: [{ ...requirement, article: { id: 'a2', heading: '3.3 APPLICATION' } }],
    inspection: [{ ...requirement, article: { id: 'a3', heading: '3.5 FIELD QUALITY CONTROL' } }]
  } } });
  assert.deepEqual(model.fieldWork.map(group => group.phase), ['Before Installation', 'Installation', 'Inspection and Testing']);
  assert.deepEqual(model.fieldWork.flatMap(group => group.items.map(item => item.label)), ['1.3 SUBMITTALS', '3.3 APPLICATION', '3.5 FIELD QUALITY CONTROL']);
});

test('Chief recommendation uses only explicit insight or governing specification evidence', () => {
  const requirement = { specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'confirmed', applicabilityScope: 'object-specific', objectId: 'p1' };
  const governed = buildConstructionIntelligencePanelModel({ sheet, selectedObject: { objectId: 'p1', label: 'Finish P-1' }, requirements: { confirmedSpecifications: [requirement] } });
  assert.match(governed.chiefRecommendation.text, /Section 09 91 00/);
  const empty = buildConstructionIntelligencePanelModel({ sheet, selectedObject: { objectId: 'p2', label: 'Unknown work' } });
  assert.equal(empty.chiefRecommendation, null);
});

test('project status and related information expose only populated linked records', () => {
  const linked = (id, label) => ({ entity: { entityId: id, label }, relationship: { relationshipId: `rel-${id}`, verificationState: 'confirmed' } });
  const model = buildConstructionIntelligencePanelModel({ sheet, selectedObject: { objectId: 'p1', label: 'Finish P-1' }, relationshipGroups: { inspections: [linked('inspection-1', 'Finish inspection')], photos: [linked('photo-1', 'Area photo')], rfis: [], meetingMinutes: [] } });
  assert.equal(model.pmis.inspections.length, 1); assert.equal(model.pmis.rfis.length, 0);
  assert.equal(model.documents.photos.length, 1); assert.equal(model.documents.meetingMinutes.length, 0);
});

test('graph summary supplements panel requirements without duplicating resolver results', () => {
  const model = buildConstructionIntelligencePanelModel({ sheet: { pageNumber: 1 }, requirements: { confirmedSpecifications: [{ specificationDocumentId: 'spec', sectionNumber: '09 91 00', sectionTitle: 'Painting', status: 'confirmed' }] }, graphSummary: { requirements: { confirmed: [{ node: { sourceDocumentId: 'spec', normalizedKey: '099100', label: '09 91 00 — Painting' }, edge: { scope: 'page', evidence: [] } }], suggested: [] } } });
  assert.equal(model.specifications.confirmed.length, 1);
});

test('page overview derives governed work and referenced content from current page data only', () => {
  const requirement = { specificationDocumentId: 'spec', sectionNumber: '10 14 00', sectionTitle: 'Signage', status: 'suggested', applicabilityScope: 'page-wide' };
  const model = buildConstructionIntelligencePanelModel({ sheet, pageObjects: [{ objectId: 'sign', type: 'signage', verificationState: 'confirmed' }], requirements: { suggestedSpecifications: [requirement] } });
  assert.deepEqual(model.constructionSummary.governedWork, ['Signage']);
  assert.deepEqual(model.constructionSummary.referencedContent, [{ label: 'signage', count: 1 }]);
});
