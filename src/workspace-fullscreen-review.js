import { getBedfordDrawingSetForReference } from './bedford-project.js';
import { calculateDrawingFit, drawingWheelZoom } from './drawing-navigation.js';
import { createIdentifier } from './identifiers.js';
import { openPdfBlob, openPdfUrl, renderPdfPage } from './pdf-source.js';
import {
  createWorkspaceDrawingMarkupStore,
  getWorkspaceDrawingMarkupPalette,
  normalizeMarkupGeometry,
  normalizeMarkupPoint,
  normalizeMarkupDisplayStyle,
  normalizeMarkupStyle,
  WORKSPACE_DRAWING_MARKUP_TYPES,
  renderWorkspaceDrawingMarkupPrimitive,
  renderWorkspaceDrawingMarkupSelectionOverlay,
  WORKSPACE_DRAWING_MARKUP_TOOL_SECTIONS
} from './workspace-drawing-markups.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const CREATION_MARKUP_TOOLS = new Set(['PEN', 'HIGHLIGHTER', 'LINE', 'ARROW', 'RECTANGLE', 'ELLIPSE', 'CLOUD', 'TEXT', 'CALLOUT']);

const pdfCache = new Map();
const fullscreenTimingEnabled = true;
const scheduleFrame = typeof globalThis.requestAnimationFrame === 'function'
  ? globalThis.requestAnimationFrame.bind(globalThis)
  : callback => setTimeout(() => callback(typeof performance?.now === 'function' ? performance.now() : Date.now()), 0);

export function workspaceFullscreenSheetIdentity(sheet = {}) {
  return [text(sheet.sheetNumber || sheet.sheetId || ''), number(sheet.pdfPageNumber || sheet.pageNumber || 0)].join(':');
}

export function resolveWorkspaceFullscreenSelectedSheet(sheets = [], selectedSheetNumber = '') {
  const needle = text(selectedSheetNumber);
  if (!needle) return sheets[0] || null;
  return sheets.find(sheet => text(sheet.sheetNumber) === needle) || sheets.find(sheet => workspaceFullscreenSheetIdentity(sheet).startsWith(`${needle}:`)) || sheets[0] || null;
}

export function buildWorkspaceFullscreenNavigatorModel(workspaceModel = {}, sheets = [], selectedSheetNumber = '') {
  const activeWorkspace = workspaceModel?.activeWorkspace || null;
  const sourceCategories = Array.isArray(activeWorkspace?.drawingCategories) ? activeWorkspace.drawingCategories : [];
  const selected = resolveWorkspaceFullscreenSelectedSheet(sheets, selectedSheetNumber);
  const selectedIdentity = workspaceFullscreenSheetIdentity(selected || {});
  const searchSheetIds = new Set(sheets.map(sheet => workspaceFullscreenSheetIdentity(sheet)));
  const categories = sourceCategories.length
    ? sourceCategories.map(category => ({
      id: text(category.id),
      label: text(category.label || category.title || category.id || 'Sheets'),
      relationship: text(category.relationship || ''),
      items: Array.isArray(category.items) ? category.items.map(item => ({
        sheetNumber: text(item.sheetNumber),
        sheetTitle: text(item.sheetTitle),
        discipline: text(item.discipline),
        drawingType: text(item.drawingType),
        pdfPageNumber: number(item.pdfPageNumber || item.pageNumber || 0),
        pageId: text(item.pageId),
        relevance: text(item.relevance || 'DIRECT'),
        category: text(item.category || category.label || 'Sheets'),
        selected: workspaceFullscreenSheetIdentity(item) === selectedIdentity || text(item.sheetNumber) === text(selected?.sheetNumber)
      })) : []
    }))
    : [{
      id: 'discipline-sheets',
      label: activeWorkspace?.disciplineFocus ? `${activeWorkspace.disciplineFocus} Sheets` : 'Sheets',
      relationship: 'Selected Workspace',
      items: sheets.map(item => ({
        sheetNumber: text(item.sheetNumber),
        sheetTitle: text(item.sheetTitle),
        discipline: text(item.discipline),
        drawingType: text(item.drawingType),
        pdfPageNumber: number(item.pdfPageNumber || item.pageNumber || 0),
        pageId: text(item.pageId),
        relevance: 'DIRECT',
        category: text(item.category || 'Sheets'),
        selected: workspaceFullscreenSheetIdentity(item) === selectedIdentity || text(item.sheetNumber) === text(selected?.sheetNumber)
      }))
    }];
  return {
    activeWorkspace,
    selectedSheet: selected,
    categories,
    sheetCount: searchSheetIds.size
  };
}

function buildFullScreenShellMarkup() {
  return `
    <div class="mc-mdi-shell" data-mdi-shell>
      <header class="mc-mdi-topbar">
        <div class="mc-mdi-brand">
          <span>MISSION COMPANION</span>
          <strong>Fullscreen Drawing Review</strong>
        </div>
        <div class="mc-mdi-center" data-mdi-top-center>
          <strong data-mdi-sheet-label>Loading drawing…</strong>
          <small data-mdi-sheet-subtitle>Preparing the selected workspace sheet</small>
        </div>
        <div class="mc-mdi-right">
          <span data-mdi-position>Page -- of --</span>
          <button type="button" data-mdi-fit="width" aria-pressed="true">Fit Width</button>
          <button type="button" data-mdi-fit="page" aria-pressed="false">Fit Page</button>
          <button type="button" data-mdi-zoom-out>-</button>
          <span class="mc-mdi-zoom-readout" data-mdi-pulse-zoom>100%</span>
          <button type="button" data-mdi-zoom-in>+</button>
          <button type="button" data-mdi-exit>Exit</button>
        </div>
      </header>
      <div class="mc-mdi-markupbar" data-mdi-markupbar>
        <div class="mc-mdi-markup-group" data-mdi-tools="navigation">
          <button type="button" data-mdi-tool="select" aria-pressed="true">Select</button>
          <button type="button" data-mdi-tool="pan" aria-pressed="false">Pan</button>
        </div>
        <div class="mc-mdi-markup-group" data-mdi-tools="draw">
          <button type="button" data-mdi-tool="pen" aria-pressed="false">Pen</button>
          <button type="button" data-mdi-tool="highlighter" aria-pressed="false">Highlighter</button>
          <button type="button" data-mdi-tool="line" aria-pressed="false">Line</button>
          <button type="button" data-mdi-tool="arrow" aria-pressed="false">Arrow</button>
          <button type="button" data-mdi-tool="rectangle" aria-pressed="false">Rectangle</button>
          <button type="button" data-mdi-tool="ellipse" aria-pressed="false">Ellipse</button>
          <button type="button" data-mdi-tool="cloud" aria-pressed="false">Cloud</button>
          <button type="button" data-mdi-tool="text" aria-pressed="false">Text</button>
          <button type="button" data-mdi-tool="callout" aria-pressed="false">Callout</button>
        </div>
        <div class="mc-mdi-markup-group" data-mdi-tools="edit">
          <button type="button" data-mdi-action="undo">Undo</button>
          <button type="button" data-mdi-action="redo">Redo</button>
          <button type="button" data-mdi-action="copy">Copy</button>
          <button type="button" data-mdi-action="paste">Paste</button>
          <button type="button" data-mdi-action="duplicate">Duplicate</button>
          <button type="button" data-mdi-action="delete">Delete</button>
        </div>
        <div class="mc-mdi-markup-group mc-mdi-markup-group-aux">
          <button type="button" data-mdi-action="save-tool">Tool Chest</button>
          <button type="button" data-mdi-action="toggle-markups">Markups</button>
        </div>
      </div>
      <div class="mc-mdi-properties" data-mdi-properties></div>
      <div class="mc-mdi-viewport" data-mdi-viewer-host tabindex="0" aria-label="Fullscreen drawing pages">
        <aside class="mc-mdi-panel mc-mdi-markups-panel" data-mdi-markups-panel hidden>
          <header>
            <strong>Markups</strong>
            <span data-mdi-markups-count>0</span>
          </header>
          <div class="mc-mdi-panel-body" data-mdi-markups-list></div>
        </aside>
        <aside class="mc-mdi-panel mc-mdi-toolchest-panel" data-mdi-toolchest-panel hidden>
          <header>
            <strong>Tool Chest</strong>
            <span data-mdi-toolchest-count>0</span>
          </header>
          <div class="mc-mdi-panel-body" data-mdi-toolchest-list></div>
        </aside>
        <div class="mc-mdi-stack" data-mdi-stack>
          <div class="mc-mdi-stage-loading" data-mdi-loading>Loading drawing…</div>
        </div>
      </div>
      <footer class="mc-mdi-pulse" data-mdi-pulse>
        <span data-mdi-pulse-sheet>Sheet --</span>
        <span data-mdi-pulse-position>Page -- of --</span>
        <span data-mdi-pulse-zoom>Zoom --</span>
        <span data-mdi-pulse-fit>Fit Page</span>
        <span data-mdi-pulse-counts>Issues 0 · RFIs 0 · Evidence 0</span>
      </footer>
    </div>`;
}

function buildPageShellMarkup({ pageNumber = 1, shellWidth = 1, shellHeight = 1, sheet = null } = {}) {
  const label = sheet?.sheetNumber || `Page ${pageNumber}`;
  const title = sheet?.sheetTitle || 'Drawing page';
  return `
          <section class="mc-mdi-page" data-mdi-page="${pageNumber}" data-sheet-number="${text(sheet?.sheetNumber || '')}" data-page-number="${pageNumber}" data-drawing-set-id="${text(sheet?.drawingSetId || '')}" style="width:${shellWidth}px;min-height:${shellHeight}px;aspect-ratio:${shellWidth} / ${shellHeight};">
            <header class="mc-mdi-page-header">
              <strong>${label}</strong>
              <span>${title}</span>
            </header>
            <div class="mc-mdi-page-canvas-shell">
              <canvas class="mc-mdi-page-canvas" aria-label="${label} ${title}"></canvas>
            </div>
            <svg class="mc-mdi-markup-layer" data-mdi-markup-layer aria-hidden="true" focusable="false"></svg>
          </section>`;
}

function normalizePageInfo(pdf, pageNumber, sheet) {
  return pdf.getPage(pageNumber).then(page => {
    try {
      const viewport = page.getViewport({ scale: 1, rotation: 0 });
      return {
        pageNumber,
        width: Number(viewport.width) || 1,
        height: Number(viewport.height) || 1,
        rotation: page.rotate || 0,
        sheet: sheet || null
      };
    } finally {
      try { page.cleanup?.(); } catch {}
    }
  });
}

export function createWorkspaceFullscreenReviewController({
  root,
  workspaceModel = null,
  activeWorkspace = null,
  sheets = [],
  selectedSheetNumber = '',
  sourceUrl = '',
  counts = {},
  onExit = () => {},
  onWorkspaceChange = () => {},
  onActiveSheetChange = () => {},
  onToolChange = () => {},
  onSheetSelect = () => {},
  onDiagnostics = () => {},
  markupStore = null,
  toolChestStore = null,
  openPdf = openPdfBlob,
  openPdfSource = null,
  renderPage = renderPdfPage,
  calculateFit = calculateDrawingFit,
  wheelZoom = drawingWheelZoom,
  now = () => new Date().toISOString(),
  startedAt = 0
} = {}) {
  if (!root) throw new Error('Fullscreen review controller requires a root element.');
  const diagnosticsEnabled = globalThis.__MC_DRAWING_REVIEW_DIAGNOSTICS_ENABLED === true || globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED === true;

  root.innerHTML = buildFullScreenShellMarkup();
  root.classList.add('mc-mdi-shell-root');
  if (diagnosticsEnabled) root.dataset.diagnostics = 'enabled';

  const viewerHost = root.querySelector('[data-mdi-viewer-host]');
  const stackNode = root.querySelector('[data-mdi-stack]');
  const loadingNode = root.querySelector('[data-mdi-loading]');
  const sheetLabelNode = root.querySelector('[data-mdi-sheet-label]');
  const sheetSubtitleNode = root.querySelector('[data-mdi-sheet-subtitle]');
  const positionNode = root.querySelector('[data-mdi-position]');
  const pulseSheetNode = root.querySelector('[data-mdi-pulse-sheet]');
  const pulsePositionNode = root.querySelector('[data-mdi-pulse-position]');
  const pulseZoomNode = root.querySelector('[data-mdi-pulse-zoom]');
  const pulseFitNode = root.querySelector('[data-mdi-pulse-fit]');
  const pulseCountsNode = root.querySelector('[data-mdi-pulse-counts]');
  const propertiesNode = root.querySelector('[data-mdi-properties]');
  const markupsPanelNode = root.querySelector('[data-mdi-markups-panel]');
  const toolChestPanelNode = root.querySelector('[data-mdi-toolchest-panel]');
  const exitButton = root.querySelector('[data-mdi-exit]');
  const fitButtons = [...root.querySelectorAll('[data-mdi-fit]')];
  const zoomOutButton = root.querySelector('[data-mdi-zoom-out]');
  const zoomInButton = root.querySelector('[data-mdi-zoom-in]');
  let dragState = null;

  let destroyed = false;
  let controllerGeneration = 0;
  let currentWorkspaceModel = workspaceModel;
  let currentActiveWorkspace = activeWorkspace;
  let currentSheets = Array.isArray(sheets) ? [...sheets] : [];
  let currentSelectedSheetNumber = text(selectedSheetNumber);
  let currentSourceUrl = text(sourceUrl);
  let currentCounts = { issues: 0, rfis: 0, evidence: 0, ...(counts || {}) };
  let currentTool = 'select';
  let currentFitMode = 'width';
  let currentCustomZoom = null;
  let currentRotation = 0;
  let currentPdf = null;
  let currentSourceBlob = null;
  let currentMarkups = [];
  let currentMarkupTools = [];
  let activeMarkupTool = 'SELECT';
  let selectedMarkupId = '';
  let toolDefaultStyles = new Map();
  let markupsPanelOpen = false;
  let toolChestPanelOpen = false;
  let pendingMarkupDraft = null;
  let clipboardMarkup = null;
  let historyStack = [];
  let futureStack = [];
  let dragMarkupState = null;
  let lastPointerPoint = null;
  let pageMetaByNumber = new Map();
  let pageShellByNumber = new Map();
  let markupLayerByNumber = new Map();
  let renderedScaleByNumber = new Map();
  let pageRenderRequestCountByNumber = new Map();
  let activePageNumber = 1;
  let activePageSheetNumber = '';
  let pageObserver = null;
  let sourceLoadAbort = null;
  let loadSequence = 0;
  const controllerStartedAt = Number(startedAt) || (typeof performance?.now === 'function' ? performance.now() : Date.now());
  const perfNow = () => (typeof performance?.now === 'function' ? performance.now() : Date.now());
  const perfElapsed = () => Math.max(0, Math.round(perfNow() - controllerStartedAt));
  const pageRenderState = new Map();
  const pageInfoState = new Map();
  const debugFullscreenPdf = false;
  const loadPdfDocument = typeof openPdfSource === 'function'
    ? openPdfSource
    : async ({ sourceUrl = '', sourceBlob = null } = {}) => {
      if (sourceBlob instanceof Blob) return openPdf(sourceBlob);
      return openPdfUrl(sourceUrl);
    };
  const loadMarkups = typeof markupStore?.load === 'function'
    ? markupStore.load.bind(markupStore)
    : async () => [];
  const loadMarkupTools = typeof toolChestStore?.load === 'function'
    ? toolChestStore.load.bind(toolChestStore)
    : async () => [];
  const saveMarkup = typeof markupStore?.save === 'function'
    ? markupStore.save.bind(markupStore)
    : async () => null;
  const removeMarkup = typeof markupStore?.remove === 'function'
    ? markupStore.remove.bind(markupStore)
    : async () => false;
  const saveMarkupTool = typeof toolChestStore?.saveTool === 'function'
    ? toolChestStore.saveTool.bind(toolChestStore)
    : async () => null;
  const getMarkupTool = typeof toolChestStore?.getTool === 'function'
    ? toolChestStore.getTool.bind(toolChestStore)
    : () => null;
  const traceFullscreenTiming = (stage, data = {}) => {
    if (!fullscreenTimingEnabled) return;
    try { console.info('[fullscreen-timing]', stage, { elapsedMs: perfElapsed(), ...data }); } catch {}
  };
  const diagnosticsSnapshot = () => {
    const scope = currentScope();
    const selected = selectedSheet();
    const currentPage = pageInfo(activePageNumber);
    return {
      activeDrawingSet: scope.drawingSetId,
      activeWorkspaceId: scope.workspaceId,
      activeProjectId: scope.projectId,
      activeSheet: selected?.sheetNumber || currentSelectedSheetNumber || '',
      physicalPdfPage: activePageNumber,
      activeTool: currentTool,
      activeMarkupTool,
      selectedMarkupId,
      markupCountOnCurrentPage: pageMarkups(activePageNumber).length,
      currentZoom: currentFitMode === 'custom' ? currentCustomZoom : getEffectiveScaleForPage(activePageNumber),
      currentFitMode,
      viewport: {
        width: Math.round(viewerDimension().width || 0),
        height: Math.round(viewerDimension().height || 0)
      },
      page: currentPage
        ? {
          width: Math.round(currentPage.width || 0),
          height: Math.round(currentPage.height || 0),
          rotation: Number(currentPage.rotation) || 0
        }
        : null,
      pointerNormalized: lastPointerPoint ? { ...lastPointerPoint } : null,
      history: {
        undoDepth: historyStack.length,
        redoDepth: futureStack.length
      },
      persistence: {
        markups: typeof markupStore?.diagnostics === 'function' ? markupStore.diagnostics() : null,
        toolChest: typeof toolChestStore?.diagnostics === 'function' ? toolChestStore.diagnostics() : null
      },
      renderRequestsOnCurrentPage: Number(pageRenderRequestCountByNumber.get(Number(activePageNumber)) || 0)
    };
  };

  const cachedSource = sourceUrl ? pdfCache.get(currentSourceUrl) || null : null;
  if (cachedSource?.pdf) {
    currentPdf = cachedSource.pdf;
    currentSourceBlob = cachedSource.blob || null;
  }

  const safeUpdateDiagnostics = (state = {}) => {
    try { onDiagnostics({ ...state, controllerGeneration, sourceUrl: currentSourceUrl, activePageNumber, selectedSheetNumber: currentSelectedSheetNumber, tool: currentTool, markupTool: activeMarkupTool }); } catch {}
    if (diagnosticsEnabled) {
      try { console.info('[fullscreen-review-diagnostics]', { ...state, ...diagnosticsSnapshot() }); } catch {}
    }
  };

  const selectedSheet = () => resolveWorkspaceFullscreenSelectedSheet(currentSheets, currentSelectedSheetNumber);
  const selectedSheetKey = () => workspaceFullscreenSheetIdentity(selectedSheet() || {});
  const viewerDimension = () => viewerHost?.getBoundingClientRect?.() || { width: 0, height: 0 };
  const pageInfo = pageNumber => pageMetaByNumber.get(Number(pageNumber)) || null;
  const pageShell = pageNumber => pageShellByNumber.get(Number(pageNumber)) || null;
  const markupLayer = pageNumber => markupLayerByNumber.get(Number(pageNumber)) || null;
  traceFullscreenTiming('SHELL_MOUNTED', { sourceUrl: currentSourceUrl, selectedSheetNumber: currentSelectedSheetNumber });

  function scopeDescriptor() {
    const scope = currentScope();
    return {
      ...scope,
      hasMarkups: currentMarkups.length > 0,
      hasTools: currentMarkupTools.length > 0
    };
  }

  function defaultMarkupStyleForTool(tool = 'RECTANGLE') {
    const type = text(tool).toUpperCase();
    const defaults = toolDefaultStyles.get(type) || {};
    const base = normalizeMarkupDisplayStyle(defaults, type);
    if (type === 'HIGHLIGHTER') return normalizeMarkupDisplayStyle({ ...base, stroke: defaults.stroke || '#f2d15b', fill: 'transparent', opacity: 0.28, strokeWidth: 4 }, type);
    if (type === 'TEXT' || type === 'CALLOUT') return normalizeMarkupDisplayStyle({ ...base, stroke: defaults.stroke || '#4dc2c1', fill: 'transparent', strokeWidth: defaults.strokeWidth || 1.5, fontSize: defaults.fontSize || 12 }, type);
    if (type === 'PEN') return normalizeMarkupDisplayStyle({ ...base, stroke: defaults.stroke || '#4dc2c1', fill: 'transparent', strokeWidth: defaults.strokeWidth || 1.5 }, type);
    return normalizeMarkupDisplayStyle(base, type);
  }

  function currentPropertiesTarget() {
    const selected = selectedMarkup();
    return selected || { type: activeMarkupTool, style: toolDefaultStyles.get(activeMarkupTool) || defaultMarkupStyleForTool(activeMarkupTool), text: '', subject: '' };
  }

  function persistToolDefaultStyle(tool = activeMarkupTool, style = {}) {
    const type = text(tool).toUpperCase();
    toolDefaultStyles.set(type, normalizeMarkupStyle(style, type));
    try {
      const scope = currentScope();
      const storageKey = `mission-companion:workspace-drawing-tool-defaults:v1:${scope.projectId}:${scope.workspaceId}:${scope.drawingSetId}`;
      globalThis.localStorage?.setItem?.(storageKey, JSON.stringify([...toolDefaultStyles.entries()]));
    } catch {}
  }

  function loadToolDefaultStyles() {
    try {
      const scope = currentScope();
      const storageKey = `mission-companion:workspace-drawing-tool-defaults:v1:${scope.projectId}:${scope.workspaceId}:${scope.drawingSetId}`;
      const raw = globalThis.localStorage?.getItem?.(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      toolDefaultStyles = new Map(parsed.map(([key, style]) => [text(key).toUpperCase(), normalizeMarkupStyle(style || {}, text(key))]).filter(([key]) => Boolean(key)));
    } catch {}
  }

  function updateShellState() {
    const resolvedSelected = selectedSheet();
    const sheetNumber = resolvedSelected?.sheetNumber || currentSelectedSheetNumber || '—';
    const sheetTitle = resolvedSelected?.sheetTitle || '';
    if (sheetLabelNode) sheetLabelNode.textContent = resolvedSelected ? `${sheetNumber} — ${sheetTitle || 'Drawing sheet'}` : 'No sheet selected';
    if (sheetSubtitleNode) sheetSubtitleNode.textContent = currentActiveWorkspace ? `${currentActiveWorkspace.buildingId || currentActiveWorkspace.building || ''} ${currentActiveWorkspace.room || ''}`.trim() || currentActiveWorkspace.name || 'Selected workspace' : 'Select a workspace';
    const totalPages = Number(currentPdf?.numPages || pageMetaByNumber.size || 0);
    if (positionNode) positionNode.textContent = `Page ${activePageNumber || '--'} of ${totalPages || '--'}`;
    if (pulseSheetNode) pulseSheetNode.textContent = `Sheet ${sheetNumber}`;
    if (pulsePositionNode) pulsePositionNode.textContent = `Page ${activePageNumber || '--'} of ${totalPages || '--'}`;
    if (pulseZoomNode) pulseZoomNode.textContent = `${Math.round((getEffectiveScaleForPage(activePageNumber) || 1) * 100)}%`;
    if (pulseFitNode) pulseFitNode.textContent = currentFitMode === 'width' ? 'Fit Width' : currentFitMode === 'custom' ? 'Zoom' : 'Fit Page';
    if (pulseCountsNode) pulseCountsNode.textContent = `Issues ${number(currentCounts.issues)} · RFIs ${number(currentCounts.rfis)} · Evidence ${number(currentCounts.evidence)}`;
    fitButtons.forEach(button => button.setAttribute('aria-pressed', button.dataset.mdiFit === currentFitMode ? 'true' : 'false'));
    if (zoomOutButton) zoomOutButton.disabled = !(currentFitMode === 'custom' ? currentCustomZoom > .25 : true);
    if (zoomInButton) zoomInButton.disabled = false;
  }

  function viewportRect() {
    return viewerHost?.getBoundingClientRect?.() || { width: viewerHost?.clientWidth || 0, height: viewerHost?.clientHeight || 0 };
  }

  function getEffectiveScaleForPage(pageNumber) {
    const info = pageInfo(pageNumber) || pageInfo(activePageNumber) || pageMetaByNumber.values().next().value || null;
    if (!info) return 1;
    if (currentFitMode === 'custom' && Number(currentCustomZoom) > 0) return currentCustomZoom;
    const rect = viewportRect();
    const fit = calculateFit({
      containerWidth: rect.width || 1,
      containerHeight: rect.height || 1,
      pageWidth: info.width,
      pageHeight: info.height,
      rotation: currentRotation || info.rotation || 0,
      padding: 24,
      toolbarHeight: 0,
      mode: currentFitMode === 'width' ? 'fit-width' : 'fit-page'
    });
    return fit.ready ? fit.scale : 1;
  }

  function sizePageShell(pageNumber, scale) {
    const info = pageInfo(pageNumber);
    const shell = pageShell(pageNumber);
    if (!info || !shell) return;
    const nextScale = Number(scale) || 1;
    shell.style.minHeight = `${Math.max(1, Math.round(info.height * nextScale))}px`;
  }

  function pageRenderRecord(pageNumber) {
    const key = Number(pageNumber);
    if (!pageRenderState.has(key)) pageRenderState.set(key, { status: 'idle', task: null, promise: null, canvas: null, requestedScale: null, requestSource: '' });
    return pageRenderState.get(key);
  }

  function pageInfoRecord(pageNumber) {
    const key = Number(pageNumber);
    if (!pageInfoState.has(key)) pageInfoState.set(key, { status: 'idle', promise: null, info: null });
    return pageInfoState.get(key);
  }

  async function ensurePageInfo(pageNumber, { sheet = null, source = 'unknown' } = {}) {
    const key = Number(pageNumber);
    if (pageMetaByNumber.has(key)) return pageMetaByNumber.get(key);
    const state = pageInfoRecord(key);
    if (state.status === 'ready' && state.info) return state.info;
    if (state.status === 'loading' && state.promise) return state.promise;
    state.status = 'loading';
    state.promise = (async () => {
      if (debugFullscreenPdf) console.info('[FULLSCREEN PDF] get-page', { pageNumber: key, source });
      const info = await normalizePageInfo(currentPdf, key, sheet || currentSheets.find(item => Number(item.pdfPageNumber || item.pageNumber) === key) || null);
      pageMetaByNumber.set(key, info);
      state.info = info;
      state.status = 'ready';
      state.promise = null;
      return info;
    })().catch(error => {
      state.status = 'idle';
      state.promise = null;
      throw error;
    });
    return state.promise;
  }

  async function requestPageRender(pageNumber, { force = false, source = 'unknown' } = {}) {
    if (!currentPdf) return;
    const info = await ensurePageInfo(pageNumber, { source });
    const shell = pageShell(pageNumber);
    const canvas = shell?.querySelector('canvas');
    if (!info || !shell || !canvas) return;
    const scale = getEffectiveScaleForPage(pageNumber);
    const renderedKey = renderedScaleByNumber.get(Number(pageNumber));
    const desiredKey = `${scale}:${currentRotation || info.rotation || 0}`;
    const state = pageRenderRecord(pageNumber);
    const existingPromise = state.promise;
    if (!force && renderedKey === desiredKey && state.status === 'rendered' && state.requestedScale === scale && state.canvas === canvas) return existingPromise || Promise.resolve();
    if (existingPromise && !force) return existingPromise;
    if (existingPromise && force && state.task?.cancel) {
      try { state.task.cancel(); } catch {}
    }
    const requestToken = Symbol(`page-render:${pageNumber}`);
    state.token = requestToken;
    pageRenderRequestCountByNumber.set(Number(pageNumber), Number(pageRenderRequestCountByNumber.get(Number(pageNumber)) || 0) + 1);
    state.status = 'queued';
    state.canvas = canvas;
    state.requestedScale = scale;
    state.requestSource = source;
    const run = (async () => {
      if (destroyed || state.token !== requestToken) return;
      if (state.status === 'rendering' && state.canvas === canvas && state.requestedScale === scale && state.promise) return state.promise;
      if (debugFullscreenPdf) console.info('[FULLSCREEN PDF] REQUEST', { pageNumber, source, scale, rotation: currentRotation || info.rotation || 0 });
      sizePageShell(pageNumber, scale);
      state.status = 'rendering';
      if (debugFullscreenPdf) console.info('[FULLSCREEN PDF] render-start', { pageNumber, source });
      const renderTask = await renderPage(currentPdf, Number(pageNumber), canvas, { scale, rotation: currentRotation || info.rotation || 0 });
      state.task = renderTask;
      try {
        if (state.token !== requestToken) {
          try { renderTask.cancel?.(); } catch {}
          return;
        }
        await renderTask.promise;
        if (state.token !== requestToken) return;
        renderedScaleByNumber.set(Number(pageNumber), desiredKey);
        shell.dataset.renderedScale = `${scale}`;
        shell.dataset.renderedRotation = `${currentRotation || info.rotation || 0}`;
        state.status = 'rendered';
        if (debugFullscreenPdf) console.info('[FULLSCREEN PDF] render-complete', { pageNumber, source });
      } catch (error) {
        state.status = 'idle';
        console.error('[FULLSCREEN PDF] render-error', error?.stack || error?.message || error);
        throw error;
      } finally {
        renderTask.releasePage?.();
        if (state.task === renderTask) state.task = null;
        if (state.token === requestToken) state.promise = null;
      }
    })().catch(error => {
      if (state.token === requestToken) {
        state.status = 'idle';
        state.promise = null;
      }
      throw error;
    });
    state.promise = run;
    return run;
  }

  async function renderPageIfNeeded(pageNumber, { force = false, source = 'manual' } = {}) {
    return requestPageRender(pageNumber, { force, source });
  }

  async function renderNearbyPages(centerPageNumber = activePageNumber) {
    const totalPages = Number(currentPdf?.numPages || 0);
    const numbers = [centerPageNumber - 1, centerPageNumber + 1].filter(page => Number.isInteger(Number(page)) && Number(page) > 0 && Number(page) <= totalPages);
    for (const page of numbers) {
      await requestPageRender(page, { source: 'adjacent' });
    }
  }

  function registerPageShellNodes() {
    pageShellByNumber = new Map();
    markupLayerByNumber = new Map();
    stackNode.querySelectorAll('.mc-mdi-page').forEach(node => {
      const pageNumber = Number(node.dataset.pageNumber) || 0;
      if (pageNumber) pageShellByNumber.set(pageNumber, node);
      const layer = node.querySelector?.('[data-mdi-markup-layer]') || null;
      if (pageNumber && layer) markupLayerByNumber.set(pageNumber, layer);
    });
    pageShellByNumber.forEach(node => pageObserver?.observe(node));
    renderMarkupLayers();
  }

  function appendPageShellMarkup(markup = '') {
    if (!markup) return;
    if (typeof stackNode.insertAdjacentHTML === 'function') {
      stackNode.insertAdjacentHTML('beforeend', markup);
      return;
    }
    stackNode.innerHTML = `${stackNode.innerHTML}${markup}`;
  }

  function scheduleRemainingPageShells({ totalPages = 0, selectedPage = 0, shellWidth = 1, shellHeight = 1, requestGeneration = 0 } = {}) {
    const pageNumbers = [];
    for (let offset = 1; offset < totalPages; offset += 1) {
      const lower = selectedPage - offset;
      const upper = selectedPage + offset;
      if (lower > 0) pageNumbers.push(lower);
      if (upper <= totalPages) pageNumbers.push(upper);
    }
    const batchSize = Math.max(4, Math.min(12, pageNumbers.length));
    let cursor = 0;
    const flush = () => {
      if (destroyed || requestGeneration !== controllerGeneration) return;
      if (cursor >= pageNumbers.length) return;
      const chunk = pageNumbers.slice(cursor, cursor + batchSize);
      cursor += batchSize;
      appendPageShellMarkup(chunk.map(pageNumber => buildPageShellMarkup({
        pageNumber,
        shellWidth,
        shellHeight,
        sheet: currentSheets.find(item => Number(item.pdfPageNumber || item.pageNumber) === pageNumber) || null
      })).join(''));
      registerPageShellNodes();
      chunk.forEach(pageNumber => {
        if (pageNumber !== activePageNumber) void renderPageIfNeeded(pageNumber, { source: 'hydrate' });
      });
      if (cursor < pageNumbers.length) {
        setTimeout(flush, 0);
      } else {
        void renderNearbyPages(activePageNumber);
      }
    };
    setTimeout(flush, 0);
  }

  function currentScope() {
    const drawingSetId = currentSourceUrl || currentActiveWorkspace?.drawingSetId || currentActiveWorkspace?.buildingId || '';
    return {
      projectId: text(currentWorkspaceModel?.activeWorkspace?.projectId || currentActiveWorkspace?.projectId || currentWorkspaceModel?.projectId || ''),
      workspaceId: text(currentActiveWorkspace?.id || currentActiveWorkspace?.workspaceId || currentActiveWorkspace?.buildingId || ''),
      drawingSetId: text(drawingSetId)
    };
  }

  function renderMarkupLabel(record = {}) {
    return record.subject || record.text || record.type || 'Markup';
  }

  function markupSelectionClass(record = {}) {
    return record.id === selectedMarkupId ? ' is-selected' : '';
  }

  function isActiveMarkupTool(tool = '') {
    return text(tool).toUpperCase() === activeMarkupTool;
  }

  function renderMarkupItem(record = {}) {
    const label = renderMarkupLabel(record);
    const typeLabel = text(record.type || 'Markup').toUpperCase();
    const selected = record.id === selectedMarkupId ? ' is-selected' : '';
    return `
      <button type="button" class="mc-mdi-list-item${selected}" data-mdi-markup-id="${record.id}">
        <strong>${label}</strong>
        <span>${typeLabel} · Page ${Number(record.pdfPageNumber) || 0}</span>
      </button>`;
  }

  function renderToolItem(tool = {}) {
    const markup = tool.markup || {};
    const label = text(tool.name || markup.subject || markup.text || markup.type || 'Tool');
    return `
      <button type="button" class="mc-mdi-list-item" data-mdi-tool-id="${tool.id}">
        <strong>${label}</strong>
        <span>${text(tool.section || 'recent')} · ${text(markup.type || 'Markup')}</span>
      </button>`;
  }

  function renderMarkupPanels() {
    if (markupsPanelNode) {
      markupsPanelNode.hidden = !markupsPanelOpen;
      const markupsCountNode = markupsPanelNode.querySelector('[data-mdi-markups-count]');
      if (markupsCountNode) markupsCountNode.textContent = String(currentMarkups.length);
      const list = markupsPanelNode.querySelector('[data-mdi-markups-list]');
      if (list) {
        list.innerHTML = currentMarkups.length
          ? currentMarkups.map(record => renderMarkupItem(record)).join('')
          : '<div class="mc-mdi-panel-empty">No markups on this sheet yet.</div>';
      }
    }
    if (toolChestPanelNode) {
      toolChestPanelNode.hidden = !toolChestPanelOpen;
      const toolChestCountNode = toolChestPanelNode.querySelector('[data-mdi-toolchest-count]');
      if (toolChestCountNode) toolChestCountNode.textContent = String(currentMarkupTools.length);
      const list = toolChestPanelNode.querySelector('[data-mdi-toolchest-list]');
      if (list) {
        list.innerHTML = currentMarkupTools.length
          ? currentMarkupTools.map(tool => renderToolItem(tool)).join('')
          : '<div class="mc-mdi-panel-empty">No saved tools yet.</div>';
      }
    }
  }

  function renderPropertiesPanel() {
    if (!propertiesNode) return;
    const target = currentPropertiesTarget();
    const type = text(target.type || activeMarkupTool).toUpperCase();
    const style = normalizeMarkupDisplayStyle(target.style || {}, type);
    const palette = getWorkspaceDrawingMarkupPalette();
    const isSelected = Boolean(selectedMarkupId && selectedMarkup());
    const showTextControls = type === 'TEXT' || type === 'CALLOUT';
    const showFillControls = ['RECTANGLE', 'ELLIPSE', 'CLOUD', 'TEXT', 'CALLOUT'].includes(type);
    const title = isSelected ? 'Selected Markup' : 'Tool Defaults';
    propertiesNode.hidden = false;
    propertiesNode.innerHTML = `
      <div class="mc-mdi-properties-head">
        <strong>${title}</strong>
        <span>${isSelected ? text(target.type || 'Markup') : text(activeMarkupTool)}</span>
      </div>
      <div class="mc-mdi-properties-grid">
        <label class="mc-mdi-property">
          <span>Stroke Color</span>
          <div class="mc-mdi-property-swatches">${palette.map(color => `<button type="button" data-mdi-style-color="${color}" aria-label="${color}" style="--mc-swatch:${color}"></button>`).join('')}<input type="color" value="${style.stroke || '#4dc2c1'}" data-mdi-style-input="stroke"></div>
        </label>
        <label class="mc-mdi-property">
          <span>Stroke Width</span>
          <input type="range" min="0.75" max="8" step="0.25" value="${style.strokeWidth || 1.5}" data-mdi-style-input="strokeWidth">
        </label>
        <label class="mc-mdi-property">
          <span>Opacity</span>
          <input type="range" min="0.1" max="1" step="0.05" value="${style.opacity ?? 1}" data-mdi-style-input="opacity">
        </label>
        ${showFillControls ? `
          <label class="mc-mdi-property">
            <span>Fill</span>
            <div class="mc-mdi-property-inline">
              <button type="button" data-mdi-style-fill-toggle aria-pressed="${style.fill && style.fill !== 'transparent' ? 'true' : 'false'}">${style.fill && style.fill !== 'transparent' ? 'Fill On' : 'Fill Off'}</button>
              <input type="color" value="${style.fill && style.fill !== 'transparent' ? style.fill : '#ffffff'}" data-mdi-style-input="fill">
            </div>
          </label>` : ''}
        ${showTextControls ? `
          <label class="mc-mdi-property">
            <span>Text Color</span>
            <input type="color" value="${style.textColor || style.stroke || '#4dc2c1'}" data-mdi-style-input="textColor">
          </label>
          <label class="mc-mdi-property">
            <span>Font Size</span>
            <input type="number" min="9" max="18" step="1" value="${style.fontSize || 12}" data-mdi-style-input="fontSize">
          </label>
          <label class="mc-mdi-property mc-mdi-property-text">
            <span>Text</span>
            <textarea rows="2" data-mdi-style-input="text">${text(target.text || '')}</textarea>
          </label>` : ''}
      </div>
    `;
  }

  async function applyStylePatch(patch = {}) {
    const selected = selectedMarkup();
    if (selected) {
      await commitMarkupChange({
        ...selected,
        style: normalizeMarkupStyle({ ...(selected.style || {}), ...patch }, selected.type),
        text: patch.text !== undefined ? text(patch.text) : selected.text
      }, { replaceId: selected.id });
      renderPropertiesPanel();
      return;
    }
    const type = activeMarkupTool;
    const merged = normalizeMarkupStyle({ ...(toolDefaultStyles.get(type) || {}), ...patch }, type);
    persistToolDefaultStyle(type, merged);
    renderPropertiesPanel();
  }

  function pageMarkups(pageNumber = 0) {
    const sheet = pageInfo(pageNumber)?.sheet || currentSheets.find(item => Number(item.pdfPageNumber || item.pageNumber) === Number(pageNumber)) || null;
    return currentMarkups.filter(record => {
      if (record.pdfPageNumber && Number(record.pdfPageNumber) === Number(pageNumber)) return true;
      if (sheet?.sheetNumber && text(record.sheetNumber) === text(sheet.sheetNumber)) return true;
      return false;
    });
  }

  function markupPathD(points = []) {
    const segments = [];
    points.forEach((point, index) => {
      const x = Math.max(0, Math.min(100, Number(point.x) * 100));
      const y = Math.max(0, Math.min(100, Number(point.y) * 100));
      segments.push(`${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    });
    return segments.join(' ');
  }

  function renderMarkupLayerForPage(pageNumber = activePageNumber) {
    const svg = markupLayer(pageNumber);
    if (!svg) return;
    const items = pageMarkups(pageNumber);
    const draftItems = dragMarkupState?.draft && Number(dragMarkupState.pageNumber) === Number(pageNumber)
      ? [dragMarkupState.draft]
      : [];
    const renderItems = [...items, ...draftItems];
    const selected = items.find(item => item.id === selectedMarkupId) || null;
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    const defs = renderItems.some(record => record.type === 'ARROW' || record.type === 'CALLOUT')
      ? '<defs><marker id="mc-mdi-arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 z" fill="currentColor" /></marker></defs>'
      : '';
    svg.innerHTML = `${defs}${renderItems.map(record => renderWorkspaceDrawingMarkupPrimitive(record, { selected: record.id === selectedMarkupId })).join('')}${selected ? renderWorkspaceDrawingMarkupSelectionOverlay(selected) : ''}`;
    svg.dataset.hasSelection = selected ? 'true' : 'false';
  }

  function renderMarkupLayers() {
    pageShellByNumber.forEach((_, pageNumber) => renderMarkupLayerForPage(pageNumber));
    renderMarkupPanels();
    renderPropertiesPanel();
  }

  async function loadWorkspaceMarkups() {
    const scope = currentScope();
    currentMarkups = await loadMarkups(scope.projectId, scope.workspaceId, scope.drawingSetId);
    currentMarkupTools = await loadMarkupTools(scope.projectId, scope.workspaceId, scope.drawingSetId);
    if (!currentMarkupTools.length) {
      currentMarkupTools = WORKSPACE_DRAWING_MARKUP_TOOL_SECTIONS.map(section => ({ id: section.id, label: section.label, section: section.id, projectId: scope.projectId, workspaceId: scope.workspaceId, markup: null }));
    }
    renderMarkupLayers();
  }

  function pushMarkupHistory() {
    historyStack.push(structuredClone(currentMarkups));
    if (historyStack.length > 100) historyStack.shift();
    futureStack = [];
  }

  async function saveCurrentMarkups(nextMarkups = currentMarkups, previousMarkups = currentMarkups) {
    const scope = currentScope();
    const previousIds = new Set((previousMarkups || []).map(item => item.id));
    const nextIds = new Set((nextMarkups || []).map(item => item.id));
    currentMarkups = nextMarkups.map(item => ({ ...item, geometry: structuredClone(item.geometry), style: structuredClone(item.style), linkedRecords: structuredClone(item.linkedRecords) }));
    for (const id of [...previousIds].filter(recordId => !nextIds.has(recordId))) {
      await removeMarkup(id, scope.projectId, scope.workspaceId, scope.drawingSetId);
    }
    for (const record of currentMarkups) {
      await saveMarkup(record);
    }
    renderMarkupLayers();
  }

  function selectedMarkup() {
    return currentMarkups.find(item => item.id === selectedMarkupId) || null;
  }

  function setMarkupTool(tool = 'select') {
    activeMarkupTool = WORKSPACE_DRAWING_MARKUP_TYPES.some(item => item.id.toLowerCase() === String(tool).toLowerCase()) ? String(tool).toUpperCase() : 'SELECT';
    currentTool = 'select';
    root.dataset.viewerTool = currentTool;
    root.dataset.markupTool = activeMarkupTool.toLowerCase();
    root.querySelectorAll('[data-mdi-tool]').forEach(button => {
      const buttonTool = text(button.dataset.mdiTool).toUpperCase();
      if (buttonTool === 'SELECT') button.setAttribute('aria-pressed', 'true');
      else if (buttonTool === 'PAN') button.setAttribute('aria-pressed', 'false');
      else button.setAttribute('aria-pressed', buttonTool === activeMarkupTool ? 'true' : 'false');
    });
    onToolChange?.(currentTool);
    updateShellState();
    renderMarkupPanels();
    renderPropertiesPanel();
  }

  function setNavigationTool(tool = 'select') {
    currentTool = text(tool).toLowerCase() === 'pan' ? 'pan' : 'select';
    activeMarkupTool = 'SELECT';
    root.dataset.viewerTool = currentTool;
    root.dataset.markupTool = activeMarkupTool.toLowerCase();
    root.querySelectorAll('[data-mdi-tool]').forEach(button => {
      const navTool = ['select', 'pan'].includes(text(button.dataset.mdiTool).toLowerCase()) ? text(button.dataset.mdiTool).toLowerCase() : '';
      if (navTool) button.setAttribute('aria-pressed', navTool === currentTool ? 'true' : 'false');
      if (!navTool) button.setAttribute('aria-pressed', 'false');
    });
    onToolChange?.(currentTool);
    renderMarkupPanels();
    renderPropertiesPanel();
  }

  function clearMarkupDraft() {
    dragMarkupState = null;
    pendingMarkupDraft = null;
  }

  function setSelectedMarkup(markupId = '') {
    selectedMarkupId = text(markupId);
    renderMarkupLayers();
  }

  function normalizeMarkupForScope(record = {}) {
    const scope = currentScope();
    return {
      ...record,
      projectId: text(record.projectId || scope.projectId),
      workspaceId: text(record.workspaceId || scope.workspaceId),
      drawingSetId: text(record.drawingSetId || scope.drawingSetId),
      sheetNumber: text(record.sheetNumber || currentSelectedSheetNumber),
      pdfPageNumber: Number(record.pdfPageNumber || activePageNumber || 0) || 0
    };
  }

  async function persistMarkups(nextMarkups = currentMarkups, previousMarkups = currentMarkups) {
    const previous = currentMarkups;
    const normalized = nextMarkups.map(item => normalizeMarkupForScope({
      ...item,
      geometry: structuredClone(item.geometry),
      style: structuredClone(item.style),
      linkedRecords: structuredClone(item.linkedRecords)
    }));
    currentMarkups = normalized;
    await saveCurrentMarkups(normalized, previousMarkups || previous);
    renderMarkupLayers();
    return normalized;
  }

  async function persistSelectedMarkup(nextMarkup = null) {
    if (!nextMarkup) {
      selectedMarkupId = '';
      renderMarkupLayers();
      return null;
    }
    const normalized = normalizeMarkupForScope(nextMarkup);
    const nextMarkups = currentMarkups.some(item => item.id === normalized.id)
      ? currentMarkups.map(item => item.id === normalized.id ? normalized : item)
      : [...currentMarkups, normalized];
    selectedMarkupId = normalized.id;
    await persistMarkups(nextMarkups);
    return normalized;
  }

  function pageShellFromEvent(event) {
    const page = event.target?.closest?.('.mc-mdi-page') || null;
    return page && root.contains(page) ? page : null;
  }

  function markupFromEvent(event) {
    const markup = event.target?.closest?.('[data-markup-id]') || null;
    return markup && root.contains(markup) ? markup : null;
  }

  function handleFromEvent(event) {
    const handle = event.target?.closest?.('[data-mdi-handle]') || null;
    return handle && root.contains(handle) ? handle : null;
  }

  function pageNumberFromShell(shell = null) {
    return Number(shell?.dataset?.pageNumber) || 0;
  }

  function pagePointFromEvent(event, shell = null) {
    if (!shell?.getBoundingClientRect) return null;
    const rect = shell.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const point = {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
    };
    lastPointerPoint = { ...point };
    return point;
  }

  function createMarkupDraft(pageNumber, sheet, startPoint) {
    const type = activeMarkupTool;
    const drawingSetId = currentScope().drawingSetId;
    const base = {
      id: `draft-${Date.now()}`,
      projectId: currentScope().projectId,
      workspaceId: currentScope().workspaceId,
      drawingSetId,
      sheetNumber: sheet?.sheetNumber || currentSelectedSheetNumber,
      pdfPageNumber: pageNumber,
      type,
      geometry: {},
      style: defaultMarkupStyleForTool(type),
      text: '',
      author: '',
      createdAt: now(),
      updatedAt: now(),
      status: 'active',
      subject: '',
      layer: 'default',
      linkedRecords: { issueIds: [], rfiIds: [], evidenceIds: [], observationIds: [] }
    };
    if (type === 'TEXT' || type === 'CALLOUT') {
      base.geometry = normalizeMarkupGeometry({ x: startPoint.x, y: startPoint.y, width: 0.22, height: 0.12 }, type);
      base.text = '';
    } else if (type === 'LINE' || type === 'ARROW') {
      base.geometry = normalizeMarkupGeometry({ x1: startPoint.x, y1: startPoint.y, x2: startPoint.x + 0.12, y2: startPoint.y + 0.06 }, type);
    } else if (type === 'PEN' || type === 'HIGHLIGHTER') {
      base.geometry = normalizeMarkupGeometry({ points: [startPoint] }, type);
    } else {
      base.geometry = normalizeMarkupGeometry({ x: startPoint.x, y: startPoint.y, width: 0.12, height: 0.08 }, type);
    }
    return base;
  }

  function selectMarkupById(markupId = '') {
    const record = currentMarkups.find(item => item.id === text(markupId)) || null;
    selectedMarkupId = record?.id || '';
    renderMarkupLayers();
    return record;
  }

  function updateMarkupGeometryFromDrag(record = {}, originPoint = null, currentPoint = null) {
    if (!originPoint || !currentPoint) return record;
    const type = text(record.type).toUpperCase();
    const baseGeometry = structuredClone(record.geometry || {});
    if (type === 'LINE' || type === 'ARROW') {
      return { ...record, geometry: normalizeMarkupGeometry({ x1: originPoint.x, y1: originPoint.y, x2: currentPoint.x, y2: currentPoint.y }, type) };
    }
    if (type === 'PEN' || type === 'HIGHLIGHTER') {
      const dx = currentPoint.x - originPoint.x;
      const dy = currentPoint.y - originPoint.y;
      return {
        ...record,
        geometry: normalizeMarkupGeometry({
          points: Array.isArray(baseGeometry.points) ? baseGeometry.points.map(point => ({ x: clamp(point.x + dx, 0, 1), y: clamp(point.y + dy, 0, 1) })) : []
        }, type)
      };
    }
    const geometry = {
      x: clamp((baseGeometry.x || 0) + (currentPoint.x - originPoint.x), 0, 1),
      y: clamp((baseGeometry.y || 0) + (currentPoint.y - originPoint.y), 0, 1),
      width: Math.max(0.01, Number(baseGeometry.width || 0.1)),
      height: Math.max(0.01, Number(baseGeometry.height || 0.1))
    };
    return { ...record, geometry: normalizeMarkupGeometry(geometry, type) };
  }

  async function commitMarkupChange(nextRecord = null, { replaceId = '', removeId = '' } = {}) {
    if (!nextRecord && !removeId) return null;
    pushMarkupHistory();
    futureStack = [];
    const nextMarkups = [...currentMarkups];
    if (removeId) {
      const index = nextMarkups.findIndex(item => item.id === removeId);
      if (index >= 0) nextMarkups.splice(index, 1);
    }
    if (nextRecord) {
      const normalized = normalizeMarkupForScope({
        ...nextRecord,
        updatedAt: now()
      });
      const index = nextMarkups.findIndex(item => item.id === (replaceId || normalized.id));
      if (index >= 0) nextMarkups.splice(index, 1, normalized);
      else nextMarkups.push(normalized);
      selectedMarkupId = normalized.id;
      await persistMarkups(nextMarkups);
      return normalized;
    }
    if (selectedMarkupId === removeId) selectedMarkupId = '';
    await persistMarkups(nextMarkups);
    return null;
  }

  function updateMarkupDraft(point) {
    if (!dragMarkupState?.draft) return;
    const draft = dragMarkupState.draft;
    const origin = dragMarkupState.originPoint || point;
    const type = draft.type;
    if (type === 'TEXT' || type === 'CALLOUT') {
      draft.geometry = normalizeMarkupGeometry({ x: origin.x, y: origin.y, width: Math.max(0.12, point.x - origin.x), height: Math.max(0.08, point.y - origin.y) }, type);
    } else if (type === 'LINE' || type === 'ARROW') {
      draft.geometry = normalizeMarkupGeometry({ x1: origin.x, y1: origin.y, x2: point.x, y2: point.y }, type);
    } else if (type === 'PEN' || type === 'HIGHLIGHTER') {
      draft.geometry = normalizeMarkupGeometry({ points: [...(draft.geometry.points || []), point] }, type);
    } else {
      const x = Math.min(origin.x, point.x);
      const y = Math.min(origin.y, point.y);
      const width = Math.abs(point.x - origin.x);
      const height = Math.abs(point.y - origin.y);
      draft.geometry = normalizeMarkupGeometry({ x, y, width, height }, type);
    }
    renderMarkupLayers();
  }

  function beginMarkupCreate(pageNumber, sheet, point) {
    const draft = createMarkupDraft(pageNumber, sheet, point);
    dragMarkupState = {
      mode: 'create',
      draft,
      originPoint: point,
      pageNumber,
      sheetNumber: sheet?.sheetNumber || currentSelectedSheetNumber,
      pointerId: null
    };
    pendingMarkupDraft = draft;
    selectedMarkupId = '';
    renderMarkupLayers();
  }

  function beginMarkupMove(record, pageNumber, point) {
    dragMarkupState = {
      mode: 'move',
      originalId: record.id,
      draft: structuredClone(record),
      originPoint: point,
      startGeometry: structuredClone(record.geometry || {}),
      pageNumber,
      sheetNumber: record.sheetNumber || currentSelectedSheetNumber,
      pointerId: null
    };
    pendingMarkupDraft = dragMarkupState.draft;
  }

  function beginMarkupResize(record, pageNumber, point, handle = 'se') {
    dragMarkupState = {
      mode: 'resize',
      originalId: record.id,
      draft: structuredClone(record),
      originPoint: point,
      startGeometry: structuredClone(record.geometry || {}),
      pageNumber,
      sheetNumber: record.sheetNumber || currentSelectedSheetNumber,
      pointerId: null,
      handle: text(handle || 'se').toLowerCase()
    };
    pendingMarkupDraft = dragMarkupState.draft;
  }

  function updateMarkupMove(point) {
    if (!dragMarkupState?.draft || dragMarkupState.mode !== 'move') return;
    const draft = dragMarkupState.draft;
    const origin = dragMarkupState.originPoint || point;
    const start = dragMarkupState.startGeometry || draft.geometry || {};
    draft.geometry = updateMarkupGeometryFromDrag({ ...draft, geometry: start }, origin, point).geometry;
    renderMarkupLayers();
  }

  function updateMarkupResize(point) {
    if (!dragMarkupState?.draft || dragMarkupState.mode !== 'resize') return;
    const draft = dragMarkupState.draft;
    const start = dragMarkupState.startGeometry || draft.geometry || {};
    const type = text(draft.type).toUpperCase();
    const handle = text(dragMarkupState.handle || 'se').toLowerCase();
    const origin = dragMarkupState.originPoint || point;
    if (type === 'LINE' || type === 'ARROW') {
      draft.geometry = normalizeMarkupGeometry(handle === 'start'
        ? { x1: point.x, y1: point.y, x2: Number(start.x2 || origin.x), y2: Number(start.y2 || origin.y) }
        : { x1: Number(start.x1 || origin.x), y1: Number(start.y1 || origin.y), x2: point.x, y2: point.y }, type);
      renderMarkupLayers();
      return;
    }
    if (type === 'PEN' || type === 'HIGHLIGHTER') {
      const bbox = normalizeMarkupGeometry({
        x: Math.min(origin.x, point.x),
        y: Math.min(origin.y, point.y),
        width: Math.max(0.01, Math.abs(point.x - origin.x)),
        height: Math.max(0.01, Math.abs(point.y - origin.y))
      }, 'RECTANGLE');
      const points = Array.isArray(start.points) ? start.points : [];
      const startBounds = points.length
        ? {
          x: Math.min(...points.map(item => item.x)),
          y: Math.min(...points.map(item => item.y)),
          width: Math.max(0.01, Math.max(...points.map(item => item.x)) - Math.min(...points.map(item => item.x))),
          height: Math.max(0.01, Math.max(...points.map(item => item.y)) - Math.min(...points.map(item => item.y)))
        }
        : bbox;
      const nextPoints = points.map(pointItem => ({
        x: clamp(bbox.x + ((pointItem.x - startBounds.x) / Math.max(0.01, startBounds.width)) * bbox.width, 0, 1),
        y: clamp(bbox.y + ((pointItem.y - startBounds.y) / Math.max(0.01, startBounds.height)) * bbox.height, 0, 1)
      }));
      draft.geometry = normalizeMarkupGeometry({ points: nextPoints }, type);
      renderMarkupLayers();
      return;
    }
    const next = { ...start };
    const baseX = Number(start.x || 0);
    const baseY = Number(start.y || 0);
    const baseW = Math.max(0.01, Number(start.width || 0.01));
    const baseH = Math.max(0.01, Number(start.height || 0.01));
    let left = baseX;
    let top = baseY;
    let right = baseX + baseW;
    let bottom = baseY + baseH;
    if (handle.includes('n')) top = point.y;
    if (handle.includes('s')) bottom = point.y;
    if (handle.includes('w')) left = point.x;
    if (handle.includes('e')) right = point.x;
    if (!handle || handle === 'se') {
      left = Math.min(origin.x, point.x);
      top = Math.min(origin.y, point.y);
      right = Math.max(origin.x, point.x);
      bottom = Math.max(origin.y, point.y);
    }
    next.x = clamp(Math.min(left, right), 0, 1);
    next.y = clamp(Math.min(top, bottom), 0, 1);
    next.width = Math.max(0.01, Math.abs(right - left));
    next.height = Math.max(0.01, Math.abs(bottom - top));
    draft.geometry = normalizeMarkupGeometry(next, type);
    renderMarkupLayers();
  }

  async function commitActiveMarkupDraft() {
    if (!dragMarkupState?.draft) return;
    pushMarkupHistory();
    futureStack = [];
    const draft = structuredClone(dragMarkupState.draft);
    if (draft.type === 'TEXT' || draft.type === 'CALLOUT') {
      const textValue = globalThis.prompt?.('Markup text', draft.text || '') || draft.text || '';
      draft.text = text(textValue);
    }
    const committed = normalizeMarkupForScope({
      ...draft,
      id: draft.id && !String(draft.id).startsWith('draft-') ? draft.id : createIdentifier(),
      updatedAt: now()
    });
    const nextMarkups = [...currentMarkups];
    if (dragMarkupState.mode === 'move' && dragMarkupState.originalId) {
      const index = nextMarkups.findIndex(item => item.id === dragMarkupState.originalId);
      if (index >= 0) nextMarkups.splice(index, 1, committed); else nextMarkups.push(committed);
    } else {
      const index = nextMarkups.findIndex(item => item.id === committed.id);
      if (index >= 0) nextMarkups.splice(index, 1, committed); else nextMarkups.push(committed);
    }
    dragMarkupState = null;
    pendingMarkupDraft = null;
    selectedMarkupId = committed.id;
    await persistMarkups(nextMarkups);
    return committed;
  }

  async function undoMarkups() {
    if (!historyStack.length) return;
    const previous = structuredClone(currentMarkups);
    futureStack.push(structuredClone(currentMarkups));
    currentMarkups = historyStack.pop() || [];
    selectedMarkupId = currentMarkups.find(item => item.id === selectedMarkupId)?.id || currentMarkups[0]?.id || '';
    await persistMarkups(currentMarkups, previous);
  }

  async function redoMarkups() {
    if (!futureStack.length) return;
    const previous = structuredClone(currentMarkups);
    historyStack.push(structuredClone(currentMarkups));
    currentMarkups = futureStack.pop() || [];
    selectedMarkupId = currentMarkups.find(item => item.id === selectedMarkupId)?.id || currentMarkups[0]?.id || '';
    await persistMarkups(currentMarkups, previous);
  }

  function copySelectedMarkup() {
    const record = selectedMarkup();
    clipboardMarkup = record ? structuredClone(record) : null;
  }

  async function pasteClipboardMarkup() {
    if (!clipboardMarkup) return;
    await commitMarkupChange({
      ...structuredClone(clipboardMarkup),
      id: createIdentifier(),
      createdAt: now(),
      updatedAt: now()
    });
  }

  async function duplicateSelectedMarkup() {
    const record = selectedMarkup();
    if (!record) return;
    await commitMarkupChange({
      ...structuredClone(record),
      id: createIdentifier(),
      createdAt: now(),
      updatedAt: now()
    });
  }

  async function deleteSelectedMarkup() {
    const record = selectedMarkup();
    if (!record) return;
    await commitMarkupChange(null, { removeId: record.id });
  }

  async function saveSelectedMarkupToToolChest() {
    const record = selectedMarkup();
    if (!record) return;
    const scope = currentScope();
    const name = text(globalThis.prompt?.('Tool name', record.subject || record.text || renderMarkupLabel(record)) || '');
    if (!name) return;
    const saved = await saveMarkupTool({
      id: createIdentifier(),
      projectId: scope.projectId,
      workspaceId: scope.workspaceId,
      drawingSetId: scope.drawingSetId,
      name,
      section: 'my-tools',
      subject: record.subject || record.text || record.type
    }, record);
    if (saved) {
      currentMarkupTools = [...currentMarkupTools.filter(tool => tool.id !== saved.id), saved];
      renderMarkupPanels();
    }
  }

  function openMarkupPanels(next = null) {
    markupsPanelOpen = next === null ? !markupsPanelOpen : Boolean(next);
    renderMarkupPanels();
  }

  function openToolChestPanels(next = null) {
    toolChestPanelOpen = next === null ? !toolChestPanelOpen : Boolean(next);
    renderMarkupPanels();
  }

  async function handleToolbarAction(action = '') {
    switch (text(action).toLowerCase()) {
      case 'undo':
        await undoMarkups();
        break;
      case 'redo':
        await redoMarkups();
        break;
      case 'copy':
        copySelectedMarkup();
        break;
      case 'paste':
        await pasteClipboardMarkup();
        break;
      case 'duplicate':
        await duplicateSelectedMarkup();
        break;
      case 'delete':
        await deleteSelectedMarkup();
        break;
      case 'save-tool':
        await saveSelectedMarkupToToolChest();
        break;
      case 'toggle-markups':
        openMarkupPanels();
        break;
      default:
        break;
    }
  }

  async function handleMarkupListAction(event) {
    const markupButton = event.target?.closest?.('[data-mdi-markup-id]') || null;
    if (markupButton && root.contains(markupButton)) {
      event.preventDefault();
      const record = selectMarkupById(markupButton.dataset.mdiMarkupId || '');
      if (record) openMarkupPanels(true);
      return true;
    }
    const toolButton = event.target?.closest?.('[data-mdi-tool-id]') || null;
    if (toolButton && root.contains(toolButton)) {
      event.preventDefault();
      const tool = currentMarkupTools.find(item => item.id === toolButton.dataset.mdiToolId) || null;
      if (!tool) return true;
      const template = tool.markup || null;
      if (template?.type) {
        activeMarkupTool = text(template.type).toUpperCase();
        root.dataset.markupTool = activeMarkupTool.toLowerCase();
        root.querySelectorAll('[data-mdi-tool]').forEach(button => {
          button.setAttribute('aria-pressed', text(button.dataset.mdiTool).toUpperCase() === activeMarkupTool ? 'true' : 'false');
        });
      }
      if (template) {
        clipboardMarkup = structuredClone(template);
      }
      openToolChestPanels(true);
      renderMarkupLayers();
      return true;
    }
    return false;
  }

  function updateActivePageFromViewport() {
    if (!viewerHost) return;
    const hostRect = viewerHost.getBoundingClientRect();
    const hostCenter = hostRect.top + (hostRect.height / 2);
    let closest = null;
    let closestDistance = Infinity;
    for (const [pageNumber, shell] of pageShellByNumber.entries()) {
      const rect = shell.getBoundingClientRect();
      const center = rect.top + (rect.height / 2);
      const distance = Math.abs(center - hostCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = pageNumber;
      }
    }
    if (closest && closest !== activePageNumber) {
      activePageNumber = closest;
      const info = pageInfo(activePageNumber);
      activePageSheetNumber = info?.sheet?.sheetNumber || '';
      currentSelectedSheetNumber = activePageSheetNumber || currentSelectedSheetNumber;
      updateShellState();
      onActiveSheetChange?.(activeSelectedSheet());
      safeUpdateDiagnostics({ reason: 'active-page-change' });
    }
  }

  function activeSelectedSheet() {
    return resolveWorkspaceFullscreenSelectedSheet(currentSheets, currentSelectedSheetNumber);
  }

  function scrollSheetIntoView(sheetNumber, { behavior = 'smooth' } = {}) {
    const sheet = resolveWorkspaceFullscreenSelectedSheet(currentSheets, sheetNumber);
    const pageNumber = Number(sheet?.pdfPageNumber || sheet?.pageNumber || 0);
    const shell = pageShell(pageNumber);
    if (shell?.scrollIntoView) shell.scrollIntoView({ behavior, block: 'center', inline: 'center' });
    activePageNumber = pageNumber || activePageNumber;
    activePageSheetNumber = sheet?.sheetNumber || activePageSheetNumber;
    currentSelectedSheetNumber = sheet?.sheetNumber || currentSelectedSheetNumber;
    updateShellState();
    onActiveSheetChange?.(sheet || null);
    onSheetSelect?.(sheet || null);
  }

  function setTool(tool = 'select') {
    setNavigationTool(tool);
  }

  function setFitMode(mode = 'page') {
    currentFitMode = mode === 'width' ? 'width' : 'page';
    currentCustomZoom = null;
    renderedScaleByNumber = new Map();
    void requestPageRender(activePageNumber, { force: true, source: 'fit' });
    updateShellState();
    safeUpdateDiagnostics({ reason: 'fit-mode' });
  }

  function setZoom(nextZoom = 1) {
    currentFitMode = 'custom';
    currentCustomZoom = clamp(nextZoom, 0.25, 8);
    renderedScaleByNumber = new Map();
    void requestPageRender(activePageNumber, { force: true, source: 'zoom' });
    updateShellState();
    safeUpdateDiagnostics({ reason: 'zoom' });
  }

  async function handleWheel(event) {
    if (currentTool !== 'pan') return;
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    viewerHost.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: 'auto' });
  }

  function handleViewerPointerDown(event) {
    if (event.button !== 0) return;
    const shell = pageShellFromEvent(event);
    if (!shell) return;
    const pageNumber = pageNumberFromShell(shell);
    const sheet = pageInfo(pageNumber)?.sheet || currentSheets.find(item => Number(item.pdfPageNumber || item.pageNumber) === Number(pageNumber)) || null;
    const point = pagePointFromEvent(event, shell);
    if (!point) return;
    const handleNode = handleFromEvent(event);
    const markupNode = markupFromEvent(event);
    const currentMarkup = markupNode ? currentMarkups.find(item => item.id === markupNode.dataset.markupId) || null : null;
    if (handleNode && selectedMarkup() && selectedMarkup().id === currentMarkup?.id) {
      beginMarkupResize(selectedMarkup(), pageNumber, point, handleNode.dataset.mdiHandle || 'se');
      viewerHost.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    if (currentTool === 'pan') {
      dragState = { startX: event.clientX, startY: event.clientY, startScrollLeft: viewerHost.scrollLeft, startScrollTop: viewerHost.scrollTop };
      viewerHost.classList.add('is-dragging');
      viewerHost.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    if (currentMarkup) {
      selectedMarkupId = currentMarkup.id;
      beginMarkupMove(currentMarkup, pageNumber, point);
      viewerHost.setPointerCapture?.(event.pointerId);
      renderMarkupLayers();
      event.preventDefault();
      return;
    }
    if (CREATION_MARKUP_TOOLS.has(activeMarkupTool)) {
      beginMarkupCreate(pageNumber, sheet, point);
      viewerHost.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }
    selectMarkupById('');
  }

  function handleViewerPointerMove(event) {
    if (dragState && currentTool === 'pan') {
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      viewerHost.scrollLeft = dragState.startScrollLeft - deltaX;
      viewerHost.scrollTop = dragState.startScrollTop - deltaY;
      return;
    }
    if (!dragMarkupState?.draft) return;
    const shell = pageShellFromEvent(event) || pageShell(dragMarkupState.pageNumber);
    const point = pagePointFromEvent(event, shell);
    if (!point) return;
    if (dragMarkupState.mode === 'move') updateMarkupMove(point);
    else if (dragMarkupState.mode === 'resize') updateMarkupResize(point);
    else updateMarkupDraft(point);
  }

  async function handleViewerPointerUp(event) {
    if (dragState) {
      dragState = null;
      viewerHost.classList.remove('is-dragging');
      try { viewerHost.releasePointerCapture?.(event.pointerId); } catch {}
    }
    if (!dragMarkupState?.draft) return;
    await commitActiveMarkupDraft();
    try { viewerHost.releasePointerCapture?.(event.pointerId); } catch {}
  }

  function handleViewerPointerCancel(event) {
    if (dragState) {
      dragState = null;
      viewerHost.classList.remove('is-dragging');
    }
    clearMarkupDraft();
    try { viewerHost.releasePointerCapture?.(event.pointerId); } catch {}
  }

  function handleViewerScroll() {
    updateActivePageFromViewport();
  }

  function handleViewerKeydown(event) {
    if (event.key === 'Escape') {
      const hasDraft = Boolean(dragMarkupState);
      const hasSelection = Boolean(selectedMarkupId);
      if (hasDraft || hasSelection || currentTool !== 'select') event.preventDefault();
      setNavigationTool('select');
      if (dragMarkupState) {
        clearMarkupDraft();
        selectedMarkupId = '';
        renderMarkupLayers();
        return;
      }
      if (selectedMarkupId) {
        selectMarkupById('');
        return;
      }
      return;
    }
    const isShortcut = event.metaKey || event.ctrlKey;
    if (isShortcut && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      void undoMarkups();
      return;
    }
    if ((isShortcut && event.key.toLowerCase() === 'z' && event.shiftKey) || (isShortcut && event.key.toLowerCase() === 'y')) {
      event.preventDefault();
      void redoMarkups();
      return;
    }
    if (isShortcut && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      copySelectedMarkup();
      return;
    }
    if (isShortcut && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      void pasteClipboardMarkup();
      return;
    }
    if (isShortcut && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      void duplicateSelectedMarkup();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!selectedMarkupId) return;
      event.preventDefault();
      void deleteSelectedMarkup();
      return;
    }
    if (event.key === 'PageDown') {
      event.preventDefault();
      const selected = resolveWorkspaceFullscreenSelectedSheet(currentSheets, currentSelectedSheetNumber);
      const next = pageShell((selected?.pdfPageNumber || selected?.pageNumber || activePageNumber) + 1) ? (selected?.pdfPageNumber || selected?.pageNumber || activePageNumber) + 1 : activePageNumber;
      pageShell(next)?.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
    }
  }

  async function loadSource({ nextSourceUrl = currentSourceUrl, nextSelectedSheetNumber = currentSelectedSheetNumber, nextWorkspaceModel = currentWorkspaceModel, nextActiveWorkspace = currentActiveWorkspace, nextSheets = currentSheets, nextCounts = currentCounts } = {}) {
    if (destroyed) return { ok: false, status: 'destroyed' };
    currentSourceUrl = text(nextSourceUrl);
    currentWorkspaceModel = nextWorkspaceModel;
    currentActiveWorkspace = nextActiveWorkspace;
    currentSheets = Array.isArray(nextSheets) ? [...nextSheets] : [];
    currentCounts = { issues: 0, rfis: 0, evidence: 0, ...(nextCounts || {}) };
    currentSelectedSheetNumber = text(nextSelectedSheetNumber || currentSelectedSheetNumber);
    const selected = resolveWorkspaceFullscreenSelectedSheet(currentSheets, currentSelectedSheetNumber);
    if (selected?.sheetNumber) currentSelectedSheetNumber = selected.sheetNumber;
    updateShellState();
    if (!currentSourceUrl) {
      loadingNode.textContent = 'No drawing source is available for this workspace.';
      return { ok: false, status: 'missing-source' };
    }

    const sourceKey = currentSourceUrl;
    const requestGeneration = ++controllerGeneration;
    const abort = new AbortController();
    sourceLoadAbort?.abort?.();
    sourceLoadAbort = abort;
    loadingNode.textContent = 'Loading drawing…';
    try {
      let cached = pdfCache.get(sourceKey) || null;
      traceFullscreenTiming('PDF_FETCH_START', { sourceUrl: sourceKey, cacheHit: Boolean(cached?.pdf), loadingMode: 'url' });
      if (!cached?.pdf) {
        if (!cached?.promise) {
          const promise = (async () => {
            const pdf = await loadPdfDocument({ sourceUrl: sourceKey, sourceBlob: currentSourceBlob, signal: abort.signal });
            return { pdf, sourceUrl: sourceKey };
          })();
          cached = { promise };
          pdfCache.set(sourceKey, cached);
        }
        const resolved = await cached.promise;
        cached.pdf = resolved.pdf;
        cached.promise = null;
        pdfCache.set(sourceKey, cached);
      }
      if (destroyed || requestGeneration !== controllerGeneration) return { ok: false, status: 'superseded' };
      currentSourceBlob = cached.blob || null;
      currentPdf = cached.pdf;
      traceFullscreenTiming('PDF_DOCUMENT_READY', { sourceUrl: sourceKey, numPages: Number(currentPdf?.numPages || 0), fromCache: Boolean(cached?.promise === null && cached?.pdf) });
      pageMetaByNumber = new Map();
      pageShellByNumber = new Map();
      renderedScaleByNumber = new Map();
      pageRenderState.clear();
      pageInfoState.clear();
      pageRenderRequestCountByNumber = new Map();
      const totalPages = Number(currentPdf?.numPages || 0);
      const selectedPage = selected ? Number(selected.pdfPageNumber || selected.pageNumber) : 1;
      activePageNumber = Number.isFinite(selectedPage) && selectedPage > 0 ? selectedPage : 1;
      activePageSheetNumber = selected?.sheetNumber || '';
      traceFullscreenTiming('SELECTED_PAGE_GET_START', { pageNumber: activePageNumber, selectedSheetNumber: selected?.sheetNumber || '' });
      const selectedInfo = selectedPage ? await ensurePageInfo(activePageNumber, { sheet: selected || null, source: 'selected-info' }) : null;
      traceFullscreenTiming('SELECTED_PAGE_GET_COMPLETE', { pageNumber: activePageNumber, width: Number(selectedInfo?.width || 0), height: Number(selectedInfo?.height || 0) });
      if (destroyed || requestGeneration !== controllerGeneration) return { ok: false, status: 'superseded' };
      const shellWidth = Math.max(1, Math.round(selectedInfo?.width || viewerHost.clientWidth || 1200));
      const shellHeight = Math.max(1, Math.round(selectedInfo?.height || viewerHost.clientHeight || 900));
      stackNode.innerHTML = selectedPage
        ? buildPageShellMarkup({
          pageNumber: activePageNumber,
          shellWidth,
          shellHeight,
          sheet: selected || null
        })
        : '<div class="mc-mdi-empty">No drawing pages were found.</div>';
      if (pageObserver) pageObserver.disconnect();
      pageObserver = typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(entries => {
          let bestPage = activePageNumber;
          let bestRatio = 0;
          for (const entry of entries) {
            const pageNumber = Number(entry.target?.dataset?.pageNumber) || 0;
            if (!pageNumber) continue;
            if (entry.isIntersecting) {
              void renderPageIfNeeded(pageNumber, { source: 'observer' });
              if (entry.intersectionRatio >= bestRatio) {
                bestRatio = entry.intersectionRatio;
                bestPage = pageNumber;
              }
            }
          }
          if (bestPage && bestPage !== activePageNumber) {
            activePageNumber = bestPage;
            const info = pageInfo(activePageNumber);
            activePageSheetNumber = info?.sheet?.sheetNumber || '';
            currentSelectedSheetNumber = activePageSheetNumber || currentSelectedSheetNumber;
            updateShellState();
            onActiveSheetChange?.(info?.sheet || null);
            safeUpdateDiagnostics({ reason: 'observer' });
          }
      }, { root: viewerHost, threshold: [0.1, 0.5, 0.9] })
        : null;
      registerPageShellNodes();
      loadToolDefaultStyles();
      updateShellState();
      await loadWorkspaceMarkups();
      if (selectedPage && pageShell(selectedPage)?.scrollIntoView) {
        scheduleFrame(() => pageShell(selectedPage)?.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' }));
      }
      traceFullscreenTiming('SELECTED_PAGE_RENDER_START', { pageNumber: activePageNumber });
      await requestPageRender(activePageNumber, { force: true, source: 'initial' });
      traceFullscreenTiming('SELECTED_PAGE_RENDER_COMPLETE', { pageNumber: activePageNumber });
      loadingNode.remove?.();
      safeUpdateDiagnostics({ reason: 'loaded' });
      scheduleFrame(() => traceFullscreenTiming('VIEWER_INTERACTIVE', { pageNumber: activePageNumber }));
      scheduleRemainingPageShells({ totalPages, selectedPage: activePageNumber, shellWidth, shellHeight, requestGeneration });
      return { ok: true, status: 'loaded' };
    } catch (error) {
      const message = error?.message || String(error);
      if (loadingNode) loadingNode.textContent = `Unable to load drawing: ${message}`;
      pageMetaByNumber = new Map();
      pageShellByNumber = new Map();
      safeUpdateDiagnostics({ reason: 'load-failed', message });
      return { ok: false, status: 'load-failed', error: message };
    }
  }

  async function update(next = {}) {
    if (destroyed) return { ok: false, status: 'destroyed' };
    const nextWorkspaceModel = next.workspaceModel || currentWorkspaceModel;
    const nextActiveWorkspace = next.activeWorkspace || nextWorkspaceModel?.activeWorkspace || currentActiveWorkspace;
    const nextSheets = Array.isArray(next.sheets) ? next.sheets : currentSheets;
    const nextCounts = next.counts || currentCounts;
    const nextSelected = text(next.selectedSheetNumber || currentSelectedSheetNumber);
    const nextSourceUrl = text(next.sourceUrl || currentSourceUrl);
    const sourceChanged = nextSourceUrl && nextSourceUrl !== currentSourceUrl;
    if (next.fitMode) {
      currentFitMode = next.fitMode === 'width' ? 'width' : next.fitMode === 'custom' ? 'custom' : 'page';
      if (currentFitMode !== 'custom') currentCustomZoom = null;
    }
    if (number(next.rotation, currentRotation) !== currentRotation) currentRotation = number(next.rotation, currentRotation);
    currentWorkspaceModel = nextWorkspaceModel;
    currentActiveWorkspace = nextActiveWorkspace;
    currentSheets = nextSheets;
    currentCounts = { ...currentCounts, ...nextCounts };
    currentSelectedSheetNumber = nextSelected || currentSelectedSheetNumber;
    updateShellState();
    if (sourceChanged || !currentPdf) {
      return loadSource({ nextSourceUrl, nextSelectedSheetNumber: currentSelectedSheetNumber, nextWorkspaceModel, nextActiveWorkspace, nextSheets, nextCounts });
    }
    const selected = resolveWorkspaceFullscreenSelectedSheet(currentSheets, currentSelectedSheetNumber);
    if (selected?.sheetNumber) {
      currentSelectedSheetNumber = selected.sheetNumber;
      activePageNumber = Number(selected.pdfPageNumber || selected.pageNumber || activePageNumber || 1);
      activePageSheetNumber = selected.sheetNumber;
      updateShellState();
      await requestPageRender(activePageNumber, { force: true, source: 'update' });
      void renderNearbyPages(activePageNumber);
    }
    return { ok: true, status: 'updated' };
  }

  async function openFromNavigator(sheetNumber) {
    const sheet = resolveWorkspaceFullscreenSelectedSheet(currentSheets, sheetNumber);
    if (!sheet) return { ok: false, status: 'missing-sheet' };
    currentSelectedSheetNumber = sheet.sheetNumber;
    updateShellState();
    scrollSheetIntoView(sheet.sheetNumber, { behavior: 'smooth' });
    return { ok: true, sheet };
  }

  async function close(reason = 'exit') {
    if (destroyed) return { ok: false, status: 'destroyed' };
    destroyed = true;
    try { pageObserver?.disconnect?.(); } catch {}
    pageObserver = null;
    sourceLoadAbort?.abort?.();
    sourceLoadAbort = null;
    currentPdf = null;
    currentSourceBlob = null;
    root.innerHTML = '';
    onDiagnostics?.({ reason: `closed:${reason}`, controllerGeneration });
    return { ok: true, status: 'closed' };
  }

  function handleRootClick(event) {
    const button = event.target?.closest?.('button');
    if (!button || !root.contains(button)) return;
    if (button.hasAttribute('data-mdi-exit')) {
      event.preventDefault();
      void onExit?.();
      return;
    }
    if (button.hasAttribute('data-mdi-fit')) {
      event.preventDefault();
      setFitMode(button.dataset.mdiFit || 'page');
      return;
    }
    if (button.hasAttribute('data-mdi-zoom-out')) {
      event.preventDefault();
      setZoom(currentFitMode === 'custom' ? Math.max(.25, Number(currentCustomZoom) - .1) : .9);
      return;
    }
    if (button.hasAttribute('data-mdi-zoom-in')) {
      event.preventDefault();
      setZoom(currentFitMode === 'custom' ? Math.min(8, Number(currentCustomZoom) + .1) : 1.1);
      return;
    }
    if (button.hasAttribute('data-mdi-tool')) {
      event.preventDefault();
      const tool = text(button.dataset.mdiTool || '');
      if (['select', 'pan'].includes(tool.toLowerCase())) setNavigationTool(tool);
      else setMarkupTool(tool);
      renderMarkupPanels();
      return;
    }
    if (button.hasAttribute('data-mdi-action')) {
      event.preventDefault();
      void handleToolbarAction(button.dataset.mdiAction || '');
      return;
    }
    if (button.hasAttribute('data-mdi-style-color')) {
      event.preventDefault();
      void applyStylePatch({ stroke: button.dataset.mdiStyleColor || '#4dc2c1' });
      return;
    }
    if (button.hasAttribute('data-mdi-style-fill-toggle')) {
      event.preventDefault();
      const target = currentPropertiesTarget();
      const nextFill = target.style?.fill && target.style.fill !== 'transparent' ? 'transparent' : (target.style?.fillColor || target.style?.fill || '#ffffff');
      void applyStylePatch({ fill: nextFill });
      return;
    }
    if (button.hasAttribute('data-mdi-markup-id') || button.hasAttribute('data-mdi-tool-id')) {
      void handleMarkupListAction(event);
    }
  }

  function handleRootInput(event) {
    const input = event.target?.closest?.('[data-mdi-style-input]') || null;
    if (!input || !root.contains(input)) return;
    const field = text(input.dataset.mdiStyleInput).toLowerCase();
    if (!field) return;
    const value = input.type === 'range' || input.type === 'number' ? Number(input.value) : input.value;
    void applyStylePatch(field === 'text' ? { text: value } : { [field]: value });
  }

  viewerHost.addEventListener('scroll', handleViewerScroll, { passive: true });
  viewerHost.addEventListener('keydown', handleViewerKeydown);
  viewerHost.addEventListener('pointerdown', handleViewerPointerDown);
  viewerHost.addEventListener('pointermove', handleViewerPointerMove);
  viewerHost.addEventListener('pointerup', handleViewerPointerUp);
  viewerHost.addEventListener('pointercancel', handleViewerPointerCancel);
  viewerHost.addEventListener('wheel', handleWheel, { passive: false });
  root.addEventListener('click', handleRootClick);
  root.addEventListener('input', handleRootInput);
  root.addEventListener('keydown', handleViewerKeydown);

  updateShellState();
  void loadSource({ nextSourceUrl: currentSourceUrl, nextSelectedSheetNumber: currentSelectedSheetNumber, nextWorkspaceModel: currentWorkspaceModel, nextActiveWorkspace: currentActiveWorkspace, nextSheets: currentSheets, nextCounts: currentCounts });

  const controller = {
    root,
    viewerHost,
    update,
    destroy: close,
    setTool,
    setFitMode,
    setZoom,
    scrollSheetIntoView,
    getDiagnostics: () => diagnosticsSnapshot(),
    getState: () => ({
      selectedSheetNumber: currentSelectedSheetNumber,
      tool: currentTool,
      fitMode: currentFitMode,
      zoom: currentCustomZoom,
      activePageNumber,
      sourceUrl: currentSourceUrl
    })
  };
  safeUpdateDiagnostics({ reason: 'mounted' });
  return controller;
}

export function resolveWorkspaceFullscreenSourceUrl(sheet = null, baseURI = globalThis.document?.baseURI || 'http://localhost/') {
  const drawingSet = sheet ? getBedfordDrawingSetForReference(sheet) : null;
  return drawingSet?.sourceFileName
    ? new URL(`project-documents/bedford/drawings/${drawingSet.sourceFileName}`, baseURI).toString()
    : '';
}
