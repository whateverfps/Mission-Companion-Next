import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateDrawingFit, createDrawingRenderIdentity, createPdfPageViewerAnalysis, defaultDrawingViewport, drawingRenderDecision, drawingRenderRequestIsCurrent, drawingWheelZoom, sameDrawingRenderIdentity, drawingWorkspaceLayout, restoreDrawingViewport, saveDrawingViewport } from '../src/drawing-navigation.js';
import { searchDrawingSheets } from '../src/plan-query.js';

test('true Fit Page waits for size and accounts for rotation', () => {
  assert.equal(calculateDrawingFit({ containerWidth: 0, containerHeight: 500, pageWidth: 1000, pageHeight: 700 }).ready, false);
  const normal = calculateDrawingFit({ containerWidth: 1000, containerHeight: 800, pageWidth: 1000, pageHeight: 500, padding: 20 });
  assert.equal(normal.ready, true);
  assert.equal(normal.scale, .96);
  const rotated = calculateDrawingFit({ containerWidth: 1000, containerHeight: 800, pageWidth: 1000, pageHeight: 500, rotation: 90, padding: 20 });
  assert.ok(rotated.scale < normal.scale);
});

test('fitted rendering clamps to the intrinsic safe scale before presentation', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /const intrinsicScale = Math\.max\(\.1, Math\.min\(Number\.isFinite\(safeScaleCap\) && safeScaleCap > 0 \? safeScaleCap : 1, preferredScale\)\);/);
  assert.match(app, /updateMissionRenderState\(RenderState\.VIEWPORT_READY, \{ sheet, viewportWidth: baseWidth \* intrinsicScale, viewportHeight: baseHeight \* intrinsicScale \}\);/);
  assert.match(app, /renderPdfPage\(activeDrawingPdf, pageNumber, renderCanvas, \{ scale: intrinsicScale, rotation: nextIdentity\.rotation \}\)/);
});

test('per-sheet viewport restores custom zoom, scroll, selection, and overlays', () => {
  let viewports = {};
  viewports = saveDrawingViewport(viewports, 'set', 'sheet', { mode: 'custom', zoom: 1.4, scrollLeft: 22, scrollTop: 44, selectedObservationId: 'o1', overlays: { candidates: false } });
  const restored = restoreDrawingViewport(viewports, 'set', 'sheet');
  assert.equal(restored.zoom, 1.4);
  assert.equal(restored.scrollTop, 44);
  assert.equal(restored.overlays.candidates, false);
  assert.equal(restoreDrawingViewport(viewports, 'set', 'new').mode, 'fit-page');
  assert.equal(defaultDrawingViewport().zoom, null);
});

test('trackpad pinch and modified wheel zoom within the existing scale bounds', () => {
  const zoomIn = drawingWheelZoom({ ctrlKey: true, deltaY: -80, zoom: 1 });
  const zoomOut = drawingWheelZoom({ metaKey: true, deltaY: 80, zoom: 1 });
  assert.equal(zoomIn.recognized, true);
  assert.ok(zoomIn.zoom > 1);
  assert.ok(zoomOut.zoom < 1);
  assert.equal(drawingWheelZoom({ ctrlKey: true, deltaY: -100000, zoom: 1 }).zoom, 8);
  assert.equal(drawingWheelZoom({ ctrlKey: true, deltaY: 100000, zoom: 1 }).zoom, .25);
});

test('drawing gesture zoom keeps the same drawing point under the cursor', () => {
  const input = { ctrlKey: true, deltaY: -60, zoom: 1.2, scrollLeft: 240, scrollTop: 180, pointerX: 320, pointerY: 210 };
  const next = drawingWheelZoom(input);
  assert.ok(Math.abs((input.scrollLeft + input.pointerX) / input.zoom - (next.scrollLeft + input.pointerX) / next.zoom) < 1e-9);
  assert.ok(Math.abs((input.scrollTop + input.pointerY) / input.zoom - (next.scrollTop + input.pointerY) / next.zoom) < 1e-9);
});

test('ordinary wheel scrolling is not intercepted by drawing zoom', () => {
  const result = drawingWheelZoom({ deltaY: 80, zoom: 1.4, scrollLeft: 22, scrollTop: 44 });
  assert.deepEqual(result, { recognized: false, preventDefault: false, zoom: 1.4, scrollLeft: 22, scrollTop: 44 });
});

test('drawing stage gesture handling reuses the existing zoom controls and viewport map', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /stage\.onwheel = event =>/);
  assert.match(app, /if \(!next\.recognized\) return;\s*event\.preventDefault\(\)/);
  assert.match(app, /drawingInteractionSession\.begin\('zoom'/);
  assert.match(app, /drawingInteractionSession\.updateViewport\(\{ zoom: next\.zoom, scrollLeft: next\.scrollLeft, scrollTop: next\.scrollTop \}\)/);
  assert.match(app, /drawingInteractionSession\.scheduleFrame\(\(\) => applyDrawingInteractionViewport\(stage, next\.zoom, drawingRotation\)\)/);
  assert.match(app, /drawingInteractionSession\.settleSoon\(\)/);
  assert.match(app, /viewOutput\.textContent = `\$\{Math\.round\(intrinsicScale \* 100\)\}% · \$\{drawingRotation\}°`/);
  assert.match(app, /button\.dataset\.drawingZoom/);
  assert.equal((app.match(/const drawingViewportBySet = new Map\(\);/g) || []).length, 1);
});

test('first paint renders from intrinsic page size without waiting for measurable layout', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /const MAX_RENDER_PIXELS = 4194304;/);
  assert.match(app, /const MAX_CANVAS_WIDTH = 4096;/);
  assert.match(app, /const MAX_CANVAS_HEIGHT = 4096;/);
  assert.match(app, /const MAX_OUTPUT_SCALE = 2;/);
  assert.match(app, /const DrawingRenderedEvent = 'DrawingRendered';/);
  assert.match(app, /function emitDrawingRendered\(detail = \{\}\)/);
  assert.match(app, /drawingRenderedEventTarget\.addEventListener\(DrawingRenderedEvent, event =>/);
  assert.match(app, /const renderPage = await activeDrawingPdf\.getPage\(sheet\.pageNumber\);/);
  assert.match(app, /const baseViewport = renderPage\.getViewport\(\{ scale: 1, rotation: \(sheet\.rotation \+ drawingRotation\) % 360 \}\);/);
  assert.match(app, /const safeScaleCap = Math\.min\(/);
  assert.doesNotMatch(app, /Drawing viewer is waiting for a measurable layout/);
  assert.doesNotMatch(app, /measureDrawingLayout/);
});

test('drawing workspace expands and restores both rails without viewport mutation', () => {
  assert.deepEqual(drawingWorkspaceLayout({}, 'expand'), { finderHidden: true, evidenceHidden: true, expanded: true });
  assert.deepEqual(drawingWorkspaceLayout({ finderHidden: true, evidenceHidden: true, expanded: true }, 'restore'), { finderHidden: false, evidenceHidden: false, expanded: false });
});

test('render identity repaints only for actual drawing inputs', () => {
  const identity = createDrawingRenderIdentity({ documentId: 'd1', drawingSetId: 'set', pageNumber: 2, scale: 1.234567, rotation: 0, sourceAvailable: true });
  const canvas = { isConnected: true, dataset: { drawingDocument: 'd1', drawingSet: 'set', drawingPage: '2' } };
  assert.equal(identity.scale, 1.2346);
  assert.equal(sameDrawingRenderIdentity(identity, { ...identity }), true);
  assert.deepEqual(drawingRenderDecision({ previousIdentity: identity, nextIdentity: { ...identity }, canvas }), { repaint: false, reason: 'unchanged-render-inputs' });
  for (const change of [{ pageNumber: 3 }, { scale: 1.4 }, { rotation: 90 }, { documentId: 'd2' }, { drawingSetId: 'set2' }]) {
    assert.equal(drawingRenderDecision({ previousIdentity: identity, nextIdentity: { ...identity, ...change }, canvas }).repaint, true);
  }
});

test('observation, verification, overlays, and rail state are outside render identity', () => {
  const base = createDrawingRenderIdentity({ documentId: 'd1', drawingSetId: 'set', pageNumber: 1, scale: .8, rotation: 0 });
  const canvas = { isConnected: true, dataset: { drawingDocument: 'd1', drawingSet: 'set', drawingPage: '1' } };
  const UI_ONLY = ['observation', 'verification', 'overlays', 'sidebar', 'chief-target'];
  for (const reason of UI_ONLY) assert.equal(drawingRenderDecision({ previousIdentity: base, nextIdentity: { ...base }, canvas }).reason, 'unchanged-render-inputs', reason);
  assert.equal(drawingRenderDecision({ previousIdentity: base, nextIdentity: { ...base }, canvas, fittedScaleChanged: true }).reason, 'fitted-scale-changed');
  assert.equal(drawingRenderDecision({ previousIdentity: base, nextIdentity: { ...base }, canvas: { ...canvas, isConnected: false } }).reason, 'canvas-unavailable');
});

test('Plans is the only drawing view and switching does not reset its state', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.equal((app.match(/let drawingTarget = null;/g) || []).length, 1);
  assert.equal((app.match(/const drawingViewportBySet = new Map\(\);/g) || []).length, 1);
  assert.equal((app.match(/let drawingMatchingSheetIds = \[\];/g) || []).length, 1);
  assert.match(app, /renderDrawingWorkspace\('mission-control'\)/);
  const routeStart = app.indexOf('function show(name)');
  const route = app.slice(routeStart, routeStart + 5000);
  assert.doesNotMatch(route, /if \(name === 'drawings'\)/);
  assert.doesNotMatch(route, /drawingTarget\s*=\s*null|drawingViewportBySet\.clear|drawingMatchingSheetIds\s*=\s*\[\]/);
});

test('Plans inspector owns a dedicated host and immutable sheet context on every sheet render', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /let activePlansInspectorPanel = null;/);
  assert.match(app, /let activePlansInspectorSheetId = '';/);
  assert.match(app, /let activePlansInspectorGeneration = 0;/);
  assert.match(app, /let activePlansInspectorContext = null;/);
  assert.match(app, /function plansInspectorHost\(\)/);
  assert.match(app, /function getActivePlansSheetContext\(overrides = \{\}\)/);
  assert.match(app, /function normalizePlansInspectorContext\(/);
  assert.match(app, /function updatePlansInspectorOwnership\(context = \{\}\)/);
  assert.match(app, /function plansInspectorOwnershipValid\(\{ panel, sheetId, generationId, shell \} = \{\}\)/);
  assert.match(app, /const plansInspectorContext = shell === 'mission-control'\s*\?\s*getActivePlansSheetContext\(/);
  assert.match(app, /inspectorContext,\n/);
  assert.match(app, /if \(shell === 'mission-control'\) updatePlansInspectorOwnership\(\{ \.\.\.\(plansInspectorContext \|\| \{\}\), panel: nextIntelligence \}\);/);
  assert.match(app, /missionPlansSheetInspector/);
  assert.match(app, /panel === activePlansInspectorPanel/);
  assert.match(app, /document\.querySelector\('#missionPlansSheetInspector'\)/);
  assert.match(app, /sheetId === activePlansInspectorSheetId/);
  assert.match(app, /Number\(generationId\) === Number\(activePlansInspectorGeneration\)/);
});

test('retained PDF fallback enumerates pages without fabricating drawing identities', () => {
  const fallback = createPdfPageViewerAnalysis({ documentId: 'pdf-1', projectId: 'general', pageCount: 70, selectedPage: 2, pageWidth: 1000, pageHeight: 700 });
  assert.equal(fallback.viewerFallback, true);
  assert.equal(fallback.sheets.length, 70);
  assert.equal(fallback.sheets[0].sheetTitle, '');
  assert.equal(fallback.sheets[1].pageWidth, 1000);
  assert.equal(fallback.sheets.every(sheet => sheet.sheetNumber === '' && sheet.drawingId === ''), true);
  assert.deepEqual(fallback.drawingRegistry, []);
});

test('retained PDF fallback merges authoritative and partial page metadata without hiding unknown pages', () => {
  const fallback = createPdfPageViewerAnalysis({
    documentId: 'pdf-1', projectId: 'general', pageCount: 4, selectedPage: 1,
    metadataAnalysis: {
      drawingSetId: 'set-1',
      drawingRegistry: [{ drawingId: 'drawing-a', sheetId: 'sheet-a', pageNumber: 2, sheetNumber: '61A-001', sheetTitle: 'ARCHITECTURAL SYMBOLS & GENERAL NOTES', discipline: 'Architectural', primarySheetType: 'General Notes' }],
      sheets: [
        { sheetId: 'partial-2', pageNumber: 2, sheetNumber: '61 A001', sheetTitle: 'Partial title', discipline: 'Unknown', sheetTypes: ['Unknown'] },
        { sheetId: 'partial-3', pageNumber: 3, sheetNumber: '61M-101', sheetTitle: 'MECHANICAL PLAN - FIRST LEVEL - OVERALL', discipline: 'Mechanical', primarySheetType: 'Plan', sheetTypes: ['Plan'] },
        { sheetId: 'false-4', pageNumber: 4, sheetNumber: 'FX500', sheetTitle: '', discipline: 'Unknown', sheetTypes: ['Unknown'] }
      ], observations: []
    }
  });
  assert.equal(fallback.sheets.length, 4);
  assert.equal(fallback.sheets[1].sheetNumber, '61A-001');
  assert.equal(fallback.sheets[1].sheetTitle, 'ARCHITECTURAL SYMBOLS & GENERAL NOTES');
  assert.equal(fallback.sheets[1].discipline, 'Architectural');
  assert.equal(fallback.sheets[1].primarySheetType, 'General Notes');
  assert.equal(fallback.sheets[2].sheetNumber, '61M-101');
  assert.equal(fallback.sheets[3].sheetNumber, '');
  assert.equal(fallback.sheets[0].metadataAvailable, false);
});

test('mixed fallback metadata supports discipline, type, sheet, and page search', () => {
  const analysis = createPdfPageViewerAnalysis({ documentId: 'pdf-1', projectId: 'general', pageCount: 3, metadataAnalysis: {
    sheets: [{ sheetId: 'm101', pageNumber: 2, sheetNumber: '61M-101', sheetTitle: 'Mechanical Plan', discipline: 'Mechanical', primarySheetType: 'Plan', sheetTypes: ['Plan'] }]
  } });
  assert.deepEqual(searchDrawingSheets({ analysis, discipline: 'Mechanical' }).map(item => item.pageNumber), [2]);
  assert.deepEqual(searchDrawingSheets({ analysis, sheetType: 'Plan' }).map(item => item.pageNumber), [2]);
  assert.deepEqual(searchDrawingSheets({ analysis, query: '61M-101' }).map(item => item.pageNumber), [2]);
  assert.deepEqual(searchDrawingSheets({ analysis, query: 'Page 3' }).map(item => item.pageNumber), [3]);
  assert.equal(new Set(analysis.sheets.map(sheet => sheet.discipline)).has('Unknown'), true);
  assert.equal(new Set(analysis.sheets.flatMap(sheet => sheet.sheetTypes)).has('Unknown'), true);
});

test('rapid page selections allow only the newest PDF render to commit', () => {
  assert.equal(drawingRenderRequestIsCurrent({ requestId: 1, activeRequestId: 3, requestedPage: 1, activePage: 10 }), false);
  assert.equal(drawingRenderRequestIsCurrent({ requestId: 2, activeRequestId: 3, requestedPage: 2, activePage: 10 }), false);
  assert.equal(drawingRenderRequestIsCurrent({ requestId: 3, activeRequestId: 3, requestedPage: 10, activePage: 10 }), true);
});

test('drawing workspace uses retained PDF pages when analysis is missing or stale', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /const announcementText = currentSheet \? drawingAnnouncementText\(\{ sheet: currentSheet, observation: effectiveObservation, planObject: effectivePlanObject, region: effectiveRegion \}\) : 'No drawing selected';/);
  assert.match(app, /createRetainedPdfViewerAnalysis\(selected, source/);
  assert.match(app, /activeDrawingViewerAnalysis/);
  assert.match(app, /analysis\?\.viewerFallback \|\| sheet\?\.viewerFallback\s*\? analysis\.sheets\.map/);
  assert.match(app, /metadataAnalysis: persistedAnalysis|persistedAnalysis\)/);
  assert.match(app, /if \(!sheet\) return/);
  assert.match(app, /drawingViewerEngine\.renderSelectedPage/);
  assert.match(app, /const analysis = activeDrawingViewerAnalysis\?\.documentId === drawingTarget\?\.documentId \? activeDrawingViewerAnalysis : persistedAnalysis/);
  assert.match(app, /Manual PDF page viewing remains available/);
  assert.doesNotMatch(app, /<strong>No drawing selected\.<\/strong>/);
  assert.doesNotMatch(app, /sheetNumber:\s*['"](?:UNRESOLVED|UNKNOWN)/);
});

test('retained page-model navigation keeps the complete PDF page set available to Previous and Next', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /drawingMatchingSheetIds = analysis\?\.viewerFallback \|\| sheet\?\.viewerFallback/);
  assert.match(app, /analysis\.sheets\.map\(item => item\.sheetId\)/);
  assert.match(app, /drawingMatchingSetTarget\(drawingMatchingSheetIds, drawingTarget\?\.sheetId, offset, analysis\)/);
});

test('page clicks prefer the rendered retained-PDF page model and select the engine page before repaint', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const clickStart = app.indexOf("app.addEventListener('click', async event =>");
  const click = app.slice(clickStart, app.indexOf("app.addEventListener('wheel'", clickStart));
  assert.match(click, /const analysis = activeDrawingViewerAnalysis\?\.documentId === drawingTarget\?\.documentId \? activeDrawingViewerAnalysis : persistedAnalysis/);
  assert.match(click, /pageSelectionRequest !== drawingPageSelectionRequest/);
  const sheetBranch = click.slice(click.indexOf("if (button.dataset.drawingSheet"), click.indexOf("if (button.hasAttribute('data-drawing-reanalyze')"));
  assert.match(sheetBranch, /await selectPlansSheet\(\{ shell, analysis, sheet, observation, navigationStartedAt, scrollActiveCard: true \}\)/);
  assert.equal((sheetBranch.match(/selectPlansSheet\(/g) || []).length, 1);
  assert.equal((sheetBranch.match(/paintDrawingSelectionFast\(/g) || []).length, 0);
});

test('rapid page switching paints first and defers heavy workspace reconstruction', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /async function paintDrawingSelectionFast\(/);
  assert.match(app, /await paintDrawingSelectionFast\(/);
  assert.match(app, /function scheduleDeferredDrawingWorkspaceRefresh\(shell, requestToken\)/);
  assert.doesNotMatch(app, /if \(requestToken !== drawingPagePaintRequest\) return;\s*void renderDrawingWorkspace\(shell\);/);
  assert.doesNotMatch(app, /scheduleDeferredDrawingWorkspaceRefresh\(shell, requestToken\);[\s\S]*void renderDrawingWorkspace\(shell\)/);
});

test('sheet-card click path issues one page selection and one fast paint request', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const clickStart = app.indexOf("app.addEventListener('click', async event =>");
  const click = app.slice(clickStart, app.indexOf("if (button.hasAttribute('data-drawing-reanalyze')", clickStart));
  const sheetBranch = click.slice(click.indexOf("if (button.dataset.drawingSheet && analysis)"));
  assert.match(sheetBranch, /await selectPlansSheet\(\{ shell, analysis, sheet, observation, navigationStartedAt, scrollActiveCard: true \}\)/);
  assert.equal((sheetBranch.match(/selectPlansSheet\(/g) || []).length, 1);
  assert.equal((sheetBranch.match(/paintDrawingSelectionFast\(/g) || []).length, 0);
});

test('zoom fit rotate reset stay on the repaint path while object selection refreshes the workspace', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const clickStart = app.indexOf("app.addEventListener('click', async event =>");
  const click = app.slice(clickStart, app.indexOf("const activationTimestamp =", clickStart));
  const fastPaths = [
    'button.dataset.drawingZoom',
    'button.dataset.drawingFit',
    'button.hasAttribute(\'data-drawing-rotate\')',
    'button.hasAttribute(\'data-drawing-reset-view\')',
    'button.hasAttribute(\'data-drawing-return-location\')',
  ];
  for (const token of fastPaths) assert.match(click, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(click, /await repaintCurrentSheet\(\{ preserveSidebarScroll: true \}\)/);
  const selectionStart = click.indexOf("if (button.dataset.drawingObjectNav)");
  const selectionSlice = click.slice(selectionStart, click.indexOf("if (button.hasAttribute('data-drawing-object-location')", selectionStart));
  assert.match(selectionSlice, /captureDrawingViewport\(\{selectedObjectId:next\.objectId/);
  assert.match(selectionSlice, /syncDrawingOverlaySelectionState\(\)/);
  assert.match(selectionSlice, /drawingInteractionSession\.settleSoon\(\)/);
  assert.doesNotMatch(selectionSlice, /await repaintCurrentSheet\(\{ preserveSidebarScroll: true \}\);/);
});

test('scroll and panel updates are deferred rather than rebuilding synchronously', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /stage\.onscroll = \(\) => \{/);
  assert.match(app, /if \(scrollFrame\) return;/);
  assert.match(app, /scrollFrame = requestAnimationFrame\(\(\) => \{/);
  assert.match(app, /drawingInteractionSession\.settleSoon\(\);/);
  assert.match(app, /requestAnimationFrame\(\(\) => \{/);
  assert.match(app, /drawingPanelRefreshRequest/);
  assert.match(app, /operation: 'click-to-visible-bitmap'/);
  assert.match(app, /operation: 'click-to-active-card'/);
});

test('drawing workspace dom helpers reuse list, overlay, and panel nodes', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /drawingSelectionActiveSheetId/);
  assert.match(app, /scheduleDrawingSearchResultsUpdate\(/);
  assert.match(app, /__drawingSearchNodeCache/);
  assert.match(app, /__drawingSearchNodesBySheetId/);
  assert.match(app, /drawingOverlayNodeCache/);
  assert.match(app, /viewportRegion, viewportBuffer: \.12/);
  assert.match(app, /panel\.dataset\.panelSignature/);
  assert.match(app, /Drawing workspace DOM/);
});

test('repeated page switches do not register duplicate drawing click handlers', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.equal((app.match(/app\.addEventListener\('click', async event =>/g) || []).length, 1);
});

test('catalog editor exposes apply, reset, compare, and default restoration without touching PDF rendering', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /data-drawing-edit-metadata>Edit Page Metadata/);
  assert.match(app, /drawingCatalog\.applyToCatalog/);
  assert.match(app, /drawingCatalog\.resetToParser/);
  assert.match(app, /drawingCatalog\.compare/);
  assert.match(app, /drawingCatalog\.restoreDefaults/);
  assert.match(app, /data-drawing-page-id/);
});

test('professional viewer interactions include double-click zoom, drag pan, keyboard navigation, loading state, and active-card restoration', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /async function renderDrawingFirstPaint\(/);
  assert.match(app, /function scheduleDrawingHydration\(/);
  assert.match(app, /markFirstPaint\(\)/);
});

test('production hardening preserves focus and browser scroll while reporting cache and viewport diagnostics', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const diagnostics = readFileSync(new URL('../src/diagnostics.js', import.meta.url), 'utf8');
  const engine = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  assert.match(app, /createDrawingRenderCache/);
  assert.match(app, /maxEntries: 2/);
  assert.match(app, /drawingRenderCache\.get/);
  assert.match(app, /drawingRenderCache\.set/);
  assert.match(app, /canvas\.width = 0; canvas\.height = 0;/);
  assert.match(app, /drawingRequirementsResultCacheMaxEntries = 8/);
  assert.match(app, /requestIdleCallback/);
  assert.match(app, /drawingRelationshipGraphSummaryCache/);
  assert.match(app, /constructionGraph\.adaptRelationshipEngine\(projectId\);/);
  assert.match(diagnostics, /const diagnosticsEnabled=globalThis\.__MC_DIAGNOSTICS_ENABLED===true;/);
  assert.match(diagnostics, /const diagnosticsPersistenceEnabled=diagnosticsEnabled\|\|globalThis\.__MC_DIAGNOSTICS_PERSISTENCE_ENABLED===true;/);
  assert.match(engine, /const diagnosticsEnabled = globalThis\.__MC_DIAGNOSTICS_ENABLED === true;/);
  assert.match(app, /preservedBrowserScroll/);
  assert.match(app, /const preservedIntelligenceScroll = priorIntelligence\?\.scrollTop \|\| 0;/);
  assert.match(app, /nextIntelligence\.scrollTop = pendingDrawingPanelScroll \?\? preservedIntelligenceScroll \?\? constructionIntelligenceScroll\[constructionIntelligencePanel\.mode\] \?\? 0;/);
  assert.match(app, /preservedFocusSelector/);
  assert.match(app, /operation: 'viewport-restore'/);
  assert.match(app, /operation: 'search'/);
  assert.match(app, /operation: 'navigation'/);
  assert.match(app, /Drawing viewer metadata source/);
  assert.match(app, /drawingResizeRenderIsCurrent\(\{ observedStage: stage, activeStage: activeDrawingResizeStage, observedPage: sheet\.pageNumber, selectedPage: drawingTarget\?\.pageNumber \}\)/);
});
