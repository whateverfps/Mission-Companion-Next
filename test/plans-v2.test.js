import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlansStore } from '../src/plans-v2/plans-store.js';
import { createPlansPdfViewer, resolvePlansAssetUrl } from '../src/plans-v2/pdf-viewer.js';
import { createPlansSheetInspector } from '../src/plans-v2/sheet-inspector.js';
import { createPlansController } from '../src/plans-v2/plans-controller.js';
import { renderPlansView, renderPlansSheetCard } from '../src/plans-v2/plans-view.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

function createFakePdfRoot() {
  const canvas = {
    parentNode: null,
    style: {},
    width: 0,
    height: 0,
    getContext: () => ({})
  };
  const stage = {
    appended: [],
    append(node) { this.appended.push(node); node.parentNode = this; }
  };
  const viewport = {
    scrollLeft: 0,
    scrollTop: 0
  };
  return {
    canvas,
    stage,
    viewport,
    querySelector(selector) {
      if (selector === '[data-plans-canvas]') return canvas;
      if (selector === '[data-plans-stage]') return stage;
      if (selector === '[data-plans-viewport]') return viewport;
      return null;
    }
  };
}

test('one authoritative currentSheet and generation live in the store', () => {
  const store = createPlansStore();
  const updates = [];
  store.subscribe(state => updates.push(state));
  store.setSheets([{ sheetId: 's1' }]);
  const state = store.setCurrentSheet({ sheetId: 's1', pageNumber: 1 });
  assert.equal(state.currentSheet.sheetId, 's1');
  assert.equal(state.renderGeneration, 1);
  assert.equal(state.renderStatus, 'loading');
  assert.equal(state.requirementsStatus, 'loading');
  assert.ok(updates.length >= 2);
});

test('Plans asset URLs resolve against the provided base URI', () => {
  assert.equal(resolvePlansAssetUrl('project-data/bedford/drawing-catalogs/building-61.json', 'https://whateverfps.github.io/Mission-Companion-Master/'), 'https://whateverfps.github.io/Mission-Companion-Master/project-data/bedford/drawing-catalogs/building-61.json');
});

test('Plans V2 uses the V1-compatible layout classes and real sheet card presentation', () => {
  const root = { innerHTML: '' };
  renderPlansView(root, { title: 'Plans', sheets: [{ sheetId: 's1', sheetNumber: '61G-000', sheetTitle: 'COVER SHEET', discipline: 'Electrical', drawingType: 'Electrical Plan', pdfPage: 1 }] });
  assert.match(root.innerHTML, /class="mc-drawing-control mc-plans-v2"/);
  assert.match(root.innerHTML, /class="mc-drawing-layout mc-plans-v2-layout"/);
  assert.match(root.innerHTML, /class="mc-drawing-index mc-plans-v2-list"/);
  assert.match(root.innerHTML, /class="mc-drawing-viewer mc-plans-v2-viewer"/);
  assert.match(root.innerHTML, /class="mc-drawing-sheet-title"/);
  assert.match(root.innerHTML, /class="mc-drawing-toolbar"/);
  assert.match(root.innerHTML, /class="mc-drawing-stage"/);
  assert.match(root.innerHTML, /class="mc-drawing-evidence"/);
  assert.match(renderPlansSheetCard({ sheetId: 's1', sheetNumber: '61G-000', sheetTitle: 'COVER SHEET', discipline: 'Electrical', drawingType: 'Electrical Plan', pdfPage: 1 }), /61G-000/);
  assert.match(renderPlansSheetCard({ sheetId: 's1', sheetNumber: '61G-000', sheetTitle: 'COVER SHEET', discipline: 'Electrical', drawingType: 'Electrical Plan', pdfPage: 1 }), /COVER SHEET/);
});

test('Plans sheet inspector hydrates the live panel and binds View Source actions', () => {
  const button = { dataset: { objectSpecSource: 'spec-doc-7', objectSpecPage: '12', objectSpecSection: '07 21 00' }, onclick: null };
  const panel = {
    isConnected: true,
    id: 'missionPlansSheetInspector',
    className: 'mc-drawing-evidence',
    dataset: {},
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(value) { this._html = String(value); },
    querySelectorAll(selector) {
      return selector === '[data-object-spec-source]' && this._html.includes('data-object-spec-source') ? [button] : [];
    },
    querySelector(selector) {
      if (selector === '[data-plans-inspector-title]') return this;
      return null;
    }
  };
  const viewSourceCalls = [];
  const inspector = createPlansSheetInspector({
    root: panel,
    buildPanelModel: input => input,
    panelMarkup: model => `<section><button data-object-spec-source="${model.requirements.confirmedSpecifications[0].documentId}" data-object-spec-page="${model.requirements.confirmedSpecifications[0].sourcePageNumber}" data-object-spec-section="${model.requirements.confirmedSpecifications[0].sectionNumber}">View Source</button></section>`,
    onViewSource: payload => viewSourceCalls.push(payload)
  });
  inspector.renderHydrated({
    sheet: { sheetId: 's1', sheetNumber: '61G-000' },
    requirements: {
      confirmedSpecifications: [{ documentId: 'spec-doc-7', sourcePageNumber: 12, sectionNumber: '07 21 00' }],
      suggestedSpecifications: []
    },
    specificationLinks: [],
    unresolvedEvidence: []
  });
  assert.match(panel.innerHTML, /data-object-spec-source="spec-doc-7"/);
  assert.equal(typeof button.onclick, 'function');
  button.onclick({ preventDefault() {} });
  assert.deepEqual(viewSourceCalls[0], { documentId: 'spec-doc-7', pageNumber: 12, sectionNumber: '07 21 00' });
});

test('Plans sheet inspector preserves confirmed and suggested specifications from resolver-shaped requirements output', () => {
  const panel = {
    isConnected: true,
    id: 'missionPlansSheetInspector',
    className: 'mc-drawing-evidence',
    dataset: {},
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(value) { this._html = String(value); },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (selector === '[data-plans-inspector-title]') return this;
      return null;
    }
  };
  const inspector = createPlansSheetInspector({
    root: panel,
    buildPanelModel: input => ({ ...input, specifications: { confirmed: input.requirements.confirmedSpecifications, suggested: input.requirements.suggestedSpecifications } }),
    panelMarkup: model => `<section class="mc-ci-specifications">${model.specifications.confirmed.map(item => `<li>${item.sectionNumber}</li>`).join('')}${model.specifications.suggested.map(item => `<li>${item.sectionNumber}</li>`).join('')}</section>`
  });
  inspector.renderHydrated({
    sheet: { sheetId: 's1', sheetNumber: '61G-000' },
    requirements: {
      status: 'complete',
      requirements: [{ status: 'confirmed', sectionNumber: '07 21 00' }, { status: 'suggested', sectionNumber: '09 91 00' }],
      fieldRequirements: {}
    },
    specificationLinks: [],
    unresolvedEvidence: []
  });
  assert.match(panel.innerHTML, /07 21 00/);
  assert.match(panel.innerHTML, /09 91 00/);
});

test('Plans PDF viewer renders one committed canvas and treats cancellation as control flow', async () => {
  const root = createFakePdfRoot();
  const states = [];
  const source = { documentId: 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) };
  const page = {
    rotate: 0,
    getViewport: ({ scale, rotation }) => ({ width: 100 * scale, height: 80 * scale, rotation }),
    render: () => ({ promise: Promise.resolve(), cancel() {}, releasePage() {} }),
    cleanup() {}
  };
  const pdf = {
    numPages: 1,
    getPage: async () => page,
    destroy: async () => {}
  };
  const viewer = createPlansPdfViewer({
    root,
    sourceLoader: async () => source,
    openDocument: async () => pdf,
    onRenderState: state => states.push(state)
  });
  const result = await viewer.setSheet({ sheetId: 's1', pageNumber: 1, sheetNumber: '61G-000' });
  assert.equal(result.committed, true);
  assert.equal(viewer.canvas.width > 0, true);
  assert.equal(viewer.canvas.height > 0, true);
  assert.ok(states.some(state => state.state === 'CANVAS_PRESENTED'));
  assert.equal(viewer.currentSheet.sheetId, 's1');
});

test('Plans controller drives one render per selection and discards stale completions', async () => {
  const title = { textContent: '' };
  const status = { textContent: '', dataset: {} };
  const list = { innerHTML: '' };
  const sheetNumber = { textContent: '' };
  const sheetTitle = { textContent: '' };
  const sheetSubtitle = { textContent: '' };
  const sheetDiscipline = { textContent: '' };
  const sheetType = { textContent: '' };
  const sheetPosition = { textContent: '' };
  const sheetIdentity = { textContent: '' };
  const toolbarStatus = { textContent: '' };
  const drawingSet = { textContent: '' };
  const sheetSummary = { textContent: '' };
  const layout = { classList: { toggle() {} } };
  const sheetButtons = [
    { dataset: { plansSheet: 'sheet-a' }, classList: { toggle() {} }, setAttribute() {}, removeAttribute() {} },
    { dataset: { plansSheet: 'sheet-b' }, classList: { toggle() {} }, setAttribute() {}, removeAttribute() {} }
  ];
  const view = {
    querySelector(selector) {
      if (selector === '#plansV2Title') return title;
      if (selector === '[data-plans-status]') return status;
      if (selector === '[data-plans-sheet-list]') return list;
      if (selector === '[data-plans-stage]') return { querySelector() { return null; } };
      if (selector === '[data-plans-inspector]') return { isConnected: true, innerHTML: '', querySelectorAll() { return []; }, querySelector() { return null; } };
      if (selector === '.mc-drawing-layout') return layout;
      if (selector === '[data-plans-sheet-number]') return sheetNumber;
      if (selector === '[data-plans-sheet-title]') return sheetTitle;
      if (selector === '[data-plans-sheet-subtitle]') return sheetSubtitle;
      if (selector === '[data-plans-sheet-discipline]') return sheetDiscipline;
      if (selector === '[data-plans-sheet-type]') return sheetType;
      if (selector === '[data-plans-sheet-position]') return sheetPosition;
      if (selector === '[data-plans-sheet-identity]') return sheetIdentity;
      if (selector === '[data-plans-toolbar-status]') return toolbarStatus;
      if (selector === '[data-plans-drawing-set]') return drawingSet;
      if (selector === '[data-plans-sheet-summary]') return sheetSummary;
      return null;
    },
    querySelectorAll(selector) {
      return selector === '[data-plans-sheet]' ? sheetButtons : [];
    },
    addEventListener() {}
  };
  const renderSheetCalls = [];
  const requirementsCalls = [];
  const pendingFirst = deferred();
  const controller = createPlansController({
    root: {},
    initialAnalysis: { projectId: 'p1', drawingSetId: 'set-1', documentId: 'doc-1', sheets: [] },
    initialSheetId: '',
    renderView: () => view,
    createPdfViewer: () => ({
      setSheet: sheet => {
        renderSheetCalls.push(sheet.sheetId);
        return sheet.sheetId === 'sheet-a'
          ? pendingFirst.promise
          : Promise.resolve({ committed: true, source: { documentId: 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) } });
      },
      destroy() {}
    }),
    createInspector: () => ({
      renderLoading: snapshot => snapshot,
      renderHydrated: snapshot => snapshot
    }),
    requirementsResolver: {
      resolveLatest: async input => {
        requirementsCalls.push(input.pageEntityId);
        return { committed: true, result: { confirmedSpecifications: [{ sectionNumber: '07 21 00' }], suggestedSpecifications: [] } };
      }
    },
    specificationIndex: { get() {}, sections() { return []; }, documents() { return []; } },
    buildPanelModel: input => input,
    panelMarkup: model => JSON.stringify(model),
    sourceResolver: async sheet => ({ documentId: sheet.documentId || 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) })
  });
  const first = controller.initialize({
    project: { id: 'p1', name: 'Project 1' },
    analysis: { projectId: 'p1', drawingSetId: 'set-1', documentId: 'doc-1', sheets: [{ sheetId: 'sheet-a', pageNumber: 1, sheetNumber: '61G-000', documentId: 'doc-1' }, { sheetId: 'sheet-b', pageNumber: 2, sheetNumber: '61G-001', documentId: 'doc-1' }] },
    drawingSet: { drawingSetId: 'set-1' },
    sheets: [{ sheetId: 'sheet-a', pageNumber: 1, sheetNumber: '61G-000', documentId: 'doc-1' }, { sheetId: 'sheet-b', pageNumber: 2, sheetNumber: '61G-001', documentId: 'doc-1' }],
    currentSheetId: 'sheet-a'
  });
  const second = controller.selectSheet({ sheetId: 'sheet-b', pageNumber: 2, sheetNumber: '61G-001', sheetTitle: 'FLOOR PLAN', documentId: 'doc-1' });
  pendingFirst.resolve({ committed: true, cancelled: false, source: { documentId: 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) } });
  await first;
  await second;
  assert.equal(title.textContent, 'Plans');
  assert.equal(sheetNumber.textContent, '61G-001');
  assert.equal(sheetTitle.textContent, 'FLOOR PLAN');
  assert.match(sheetSubtitle.textContent, /Sheet 61G-001/);
  assert.equal(sheetDiscipline.textContent, '');
  assert.equal(sheetType.textContent, '');
  assert.match(toolbarStatus.textContent, /Sheet 61G-001/);
  assert.equal(status.textContent, 'ready view');
  assert.match(list.innerHTML, /data-plans-sheet="sheet-a"/);
  assert.deepEqual(renderSheetCalls, ['sheet-a', 'sheet-b']);
  assert.ok(requirementsCalls.length >= 1);
});

test('Plans controller enriches sparse sheets from analysis metadata instead of falling back to Page numbering', async () => {
  const title = { textContent: '' };
  const sheetNumber = { textContent: '' };
  const sheetTitle = { textContent: '' };
  const list = { innerHTML: '' };
  const view = {
    querySelector(selector) {
      if (selector === '#plansV2Title') return title;
      if (selector === '[data-plans-status]') return { textContent: '', dataset: {} };
      if (selector === '[data-plans-sheet-list]') return list;
      if (selector === '[data-plans-stage]') return { querySelector() { return null; } };
      if (selector === '[data-plans-inspector]') return { isConnected: true, innerHTML: '', querySelectorAll() { return []; }, querySelector() { return null; } };
      if (selector === '[data-plans-sheet-number]') return sheetNumber;
      if (selector === '[data-plans-sheet-title]') return sheetTitle;
      if (selector === '[data-plans-sheet-subtitle]') return { textContent: '' };
      if (selector === '[data-plans-sheet-discipline]') return { textContent: '' };
      if (selector === '[data-plans-sheet-type]') return { textContent: '' };
      if (selector === '[data-plans-sheet-position]') return { textContent: '' };
      if (selector === '[data-plans-sheet-identity]') return { textContent: '' };
      if (selector === '[data-plans-toolbar-status]') return { textContent: '' };
      if (selector === '[data-plans-drawing-set]') return { textContent: '' };
      if (selector === '[data-plans-sheet-summary]') return { textContent: '' };
      if (selector === '.mc-drawing-layout') return { classList: { toggle() {} } };
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const controller = createPlansController({
    root: {},
    renderView: () => view,
    createPdfViewer: () => ({ setSheet: async sheet => ({ committed: true, source: { documentId: 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) }, sheet }), destroy() {}, fitPage() {}, fitWidth() {}, zoom(value) { return value; }, pan() {}, rotate() {} }),
    createInspector: () => ({ renderLoading() {}, renderHydrated() {} }),
    requirementsResolver: { resolveLatest: async () => ({ committed: true, result: { confirmedSpecifications: [], suggestedSpecifications: [] } }) },
    specificationIndex: { get() {}, sections() { return []; }, documents() { return []; } },
    buildPanelModel: input => input,
    panelMarkup: model => JSON.stringify(model),
    sourceResolver: async () => ({ documentId: 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) })
  });
  await controller.initialize({
    project: { id: 'p1' },
    analysis: { projectId: 'p1', drawingSetId: 'set-1', documentId: 'doc-1', sheets: [{ sheetId: 'sheet-a', pageNumber: 1, documentId: 'doc-1', sheetNumber: '61G-000', sheetTitle: 'COVER SHEET', discipline: 'Electrical', drawingType: 'Electrical Plan' }] },
    drawingSet: { drawingSetId: 'set-1' },
    sheets: [{ sheetId: 'sheet-a', pageNumber: 1, documentId: 'doc-1' }],
    currentSheetId: 'sheet-a'
  });
  assert.equal(sheetNumber.textContent, '61G-000');
  assert.equal(sheetTitle.textContent, 'COVER SHEET');
  assert.ok(!list.innerHTML.includes('Page 1'));
});

test('Plans V2 route integration uses the active Bedford analysis and avoids the legacy shell heading', () => {
  const app = new URL('../src/app.js', import.meta.url);
  const source = readFileSync(app, 'utf8');
  assert.match(source, /plansV2Controller\.initialize\(/);
  assert.match(source, /currentDrawingAnalyses\(\)/);
  assert.doesNotMatch(source, /<section class="mc-drawing-control" aria-labelledby="missionControlTitle"><h1 id="missionControlTitle" tabindex="-1">Plans<\/h1><div id="missionDrawingViewer"/);
});

test('Plans V2 initialize reports empty and failure states instead of leaving a loading bar', async () => {
  const status = { textContent: '', dataset: {} };
  const list = { innerHTML: '' };
  const view = {
    querySelector(selector) {
      if (selector === '#plansV2Title') return { textContent: '' };
      if (selector === '[data-plans-status]') return status;
      if (selector === '[data-plans-sheet-list]') return list;
      if (selector === '[data-plans-stage]') return { querySelector() { return null; } };
      if (selector === '[data-plans-inspector]') return { isConnected: true, innerHTML: '', querySelectorAll() { return []; }, querySelector() { return null; } };
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const emptyController = createPlansController({
    root: {},
    renderView: () => view,
    createPdfViewer: () => ({ setSheet: async () => ({ committed: true, source: { documentId: 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) } }), destroy() {} }),
    createInspector: () => ({ renderLoading() {}, renderHydrated() {} }),
    requirementsResolver: { resolveLatest: async () => ({ committed: true, result: { confirmedSpecifications: [], suggestedSpecifications: [] } }) },
    specificationIndex: { get() {}, sections() { return []; }, documents() { return []; } },
    buildPanelModel: input => input,
    panelMarkup: model => JSON.stringify(model),
    sourceResolver: async () => null
  });
  const emptyResult = await emptyController.initialize({ project: { id: 'p1' }, analysis: { projectId: 'p1', drawingSetId: 'set-1', documentId: 'doc-1' }, drawingSet: { drawingSetId: 'set-1' }, sheets: [] });
  assert.equal(emptyResult.empty, true);
  assert.equal(status.textContent, 'No drawings available');

  const failedController = createPlansController({
    root: {},
    renderView: () => view,
    createPdfViewer: () => ({ setSheet: async () => { throw new Error('pdf failed'); }, destroy() {} }),
    createInspector: () => ({ renderLoading() {}, renderHydrated() {} }),
    requirementsResolver: { resolveLatest: async () => ({ committed: true, result: { confirmedSpecifications: [], suggestedSpecifications: [] } }) },
    specificationIndex: { get() {}, sections() { return []; }, documents() { return []; } },
    buildPanelModel: input => input,
    panelMarkup: model => JSON.stringify(model),
    sourceResolver: async () => null
  });
  const failedResult = await failedController.initialize({ project: { id: 'p1' }, analysis: { projectId: 'p1', drawingSetId: 'set-1', documentId: 'doc-1' }, drawingSet: { drawingSetId: 'set-1' }, sheets: [{ sheetId: 'sheet-a', documentId: 'doc-1', pageNumber: 1, sheetNumber: '61G-000' }] });
  assert.equal(failedResult.committed, false);
  assert.match(status.textContent, /Failed to load drawings:/);
});

test('Plans controller selects the initial sheet title instead of falling back to Page numbering', async () => {
  const title = { textContent: '' };
  const sheetNumber = { textContent: '' };
  const sheetTitle = { textContent: '' };
  const sheetSubtitle = { textContent: '' };
  const view = {
    querySelector(selector) {
      if (selector === '#plansV2Title') return title;
      if (selector === '[data-plans-status]') return { textContent: '', dataset: {} };
      if (selector === '[data-plans-sheet-list]') return { innerHTML: '' };
      if (selector === '[data-plans-stage]') return { querySelector() { return null; } };
      if (selector === '[data-plans-inspector]') return { isConnected: true, innerHTML: '', querySelectorAll() { return []; }, querySelector() { return null; } };
      if (selector === '[data-plans-sheet-number]') return sheetNumber;
      if (selector === '[data-plans-sheet-title]') return sheetTitle;
      if (selector === '[data-plans-sheet-subtitle]') return sheetSubtitle;
      if (selector === '.mc-drawing-layout') return { classList: { toggle() {} } };
      if (selector === '[data-plans-toolbar-status]') return { textContent: '' };
      if (selector === '[data-plans-drawing-set]') return { textContent: '' };
      if (selector === '[data-plans-sheet-summary]') return { textContent: '' };
      if (selector === '[data-plans-sheet-discipline]') return { textContent: '' };
      if (selector === '[data-plans-sheet-type]') return { textContent: '' };
      if (selector === '[data-plans-sheet-position]') return { textContent: '' };
      if (selector === '[data-plans-sheet-identity]') return { textContent: '' };
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const controller = createPlansController({
    root: {},
    renderView: () => view,
    createPdfViewer: () => ({ setSheet: async sheet => ({ committed: true, source: { documentId: 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) }, sheet }), destroy() {}, fitPage() {}, fitWidth() {}, zoom(value) { return value; }, pan() {}, rotate() {} }),
    createInspector: () => ({ renderLoading() {}, renderHydrated() {} }),
    requirementsResolver: { resolveLatest: async () => ({ committed: true, result: { confirmedSpecifications: [], suggestedSpecifications: [] } }) },
    specificationIndex: { get() {}, sections() { return []; }, documents() { return []; } },
    buildPanelModel: input => input,
    panelMarkup: model => JSON.stringify(model),
    sourceResolver: async () => ({ documentId: 'doc-1', sourceBlob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) })
  });
  await controller.initialize({
    project: { id: 'p1' },
    analysis: { projectId: 'p1', drawingSetId: 'set-1', documentId: 'doc-1', sheets: [{ sheetId: 'sheet-a', pageNumber: 1, pdfPage: 1, sheetNumber: '61G-000', sheetTitle: 'COVER SHEET', documentId: 'doc-1' }] },
    drawingSet: { drawingSetId: 'set-1' },
    sheets: [{ sheetId: 'sheet-a', pageNumber: 1, pdfPage: 1, sheetNumber: '61G-000', sheetTitle: 'COVER SHEET', documentId: 'doc-1' }],
    currentSheetId: 'sheet-a'
  });
  assert.equal(title.textContent, 'Plans');
  assert.equal(sheetNumber.textContent, '61G-000');
  assert.equal(sheetTitle.textContent, 'COVER SHEET');
  assert.match(sheetSubtitle.textContent, /Sheet 61G-000/);
});
