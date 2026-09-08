import { openPdfBlob, renderPdfPage } from '../pdf-source.js';

const MAX_RENDER_PIXELS = 4194304;
const MAX_CANVAS_WIDTH = 4096;
const MAX_CANVAS_HEIGHT = 4096;
const MAX_OUTPUT_SCALE = 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

export function resolvePlansAssetUrl(path, baseURI = globalThis.document?.baseURI || 'http://localhost/') {
  return new URL(path, baseURI).toString();
}

export function createPlansPdfViewer({ root, sourceLoader = null, onRenderState = () => {}, baseURI = globalThis.document?.baseURI || 'http://localhost/', openDocument = openPdfBlob } = {}) {
  const canvas = root?.querySelector('[data-plans-canvas]') || document.createElement('canvas');
  const stage = root?.querySelector('[data-plans-stage]') || root;
  const viewport = root?.querySelector('[data-plans-viewport]') || stage;
  let pdf = null;
  let sourceRecord = null;
  let renderGeneration = 0;
  let renderTask = null;
  let currentSheet = null;
  let fitMode = 'fit-page';

  const ensureCanvas = () => {
    if (canvas.parentNode !== stage) stage?.append?.(canvas);
    return canvas;
  };

  const clearCanvas = () => {
    if (!canvas) return;
    canvas.width = 0;
    canvas.height = 0;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
  };

  const releasePdf = async () => {
    try { renderTask?.cancel?.(); } catch {}
    try { renderTask?.releasePage?.(); } catch {}
    renderTask = null;
    try { await pdf?.destroy?.(); } catch {}
    pdf = null;
    sourceRecord = null;
  };

  const loadDocument = async sheet => {
    if (!sourceLoader) throw new Error('Plans PDF source loader is unavailable.');
    const nextSource = await sourceLoader(sheet);
    if (!nextSource?.sourceBlob) throw new Error('The selected PDF source is unavailable.');
    if (!pdf || sourceRecord?.documentId !== nextSource.documentId) {
      await releasePdf();
      sourceRecord = nextSource;
      pdf = await openDocument(nextSource.sourceBlob);
    }
    return nextSource;
  };

  const computeScale = (page, requestedScale = 1) => {
    const baseViewport = page.getViewport({ scale: 1, rotation: currentSheet?.rotation || 0 });
    const widthCap = Math.min(MAX_CANVAS_WIDTH / Math.max(1, baseViewport.width), MAX_OUTPUT_SCALE);
    const heightCap = Math.min(MAX_CANVAS_HEIGHT / Math.max(1, baseViewport.height), MAX_OUTPUT_SCALE);
    const pixelCap = Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, baseViewport.width * baseViewport.height));
    const safeScaleCap = Math.max(.1, Math.min(widthCap, heightCap, pixelCap));
    return {
      baseViewport,
      scale: clamp(requestedScale, .1, safeScaleCap)
    };
  };

  const render = async ({ sheet, requestedScale = 1 } = {}) => {
    if (!sheet) return { committed: false, cancelled: false };
    currentSheet = { ...sheet };
    const generation = ++renderGeneration;
    renderTask?.cancel?.();
    onRenderState({ state: 'LOADING_DOCUMENT', sheet: currentSheet });
    const nextSource = await loadDocument(sheet);
    if (generation !== renderGeneration) return { committed: false, cancelled: true };
    const page = await pdf.getPage(Number(sheet.pageNumber) || 1);
    if (generation !== renderGeneration) { page.cleanup?.(); return { committed: false, cancelled: true }; }
    const { baseViewport, scale } = computeScale(page, requestedScale);
    const viewport = page.getViewport({ scale, rotation: currentSheet.rotation || 0 });
    onRenderState({ state: 'VIEWPORT_READY', sheet: currentSheet, canvasWidth: Math.ceil(viewport.width), canvasHeight: Math.ceil(viewport.height), viewportWidth: viewport.width, viewportHeight: viewport.height, scale });
    const nextCanvas = ensureCanvas();
    nextCanvas.width = Math.max(1, Math.min(MAX_CANVAS_WIDTH, Math.ceil(viewport.width)));
    nextCanvas.height = Math.max(1, Math.min(MAX_CANVAS_HEIGHT, Math.ceil(viewport.height)));
    onRenderState({ state: 'CANVAS_CREATED', sheet: currentSheet, canvasWidth: nextCanvas.width, canvasHeight: nextCanvas.height, viewportWidth: viewport.width, viewportHeight: viewport.height, scale });
    const context = nextCanvas.getContext('2d');
    onRenderState({ state: 'RENDER_STARTED', sheet: currentSheet, canvasWidth: nextCanvas.width, canvasHeight: nextCanvas.height, viewportWidth: viewport.width, viewportHeight: viewport.height, scale });
    const task = page.render({ canvasContext: context, viewport });
    renderTask = task;
    try {
      await task.promise;
      if (generation !== renderGeneration) return { committed: false, cancelled: true };
      if (fitMode === 'fit-page' || fitMode === 'fit-width') {
        nextCanvas.style.width = '100%';
        nextCanvas.style.height = 'auto';
      } else {
        nextCanvas.style.width = `${Math.ceil(baseViewport.width * scale)}px`;
        nextCanvas.style.height = `${Math.ceil(baseViewport.height * scale)}px`;
      }
      onRenderState({ state: 'RENDER_COMPLETED', sheet: currentSheet, canvasWidth: nextCanvas.width, canvasHeight: nextCanvas.height, viewportWidth: viewport.width, viewportHeight: viewport.height, scale });
      onRenderState({ state: 'CANVAS_PRESENTED', sheet: currentSheet, canvasWidth: nextCanvas.width, canvasHeight: nextCanvas.height, viewportWidth: viewport.width, viewportHeight: viewport.height, scale });
      return { committed: true, cancelled: false, source: nextSource, page, viewport, canvas: nextCanvas };
    } catch (error) {
      const message = String(error?.message || error || '');
      if (error?.name === 'RenderingCancelledException' || error?.name === 'AbortError' || /cancel/i.test(message) || generation !== renderGeneration) {
        return { committed: false, cancelled: true };
      }
      onRenderState({ state: 'FAILED', sheet: currentSheet, error: error?.message || String(error) });
      clearCanvas();
      throw error;
    } finally {
      try { page.cleanup?.(); } catch {}
    }
  };

  const api = {
    resolvePlansAssetUrl,
    async setSheet(sheet, requestedScale = 1) {
      currentSheet = { ...sheet };
      return render({ sheet: currentSheet, requestedScale });
    },
    zoom(value) {
      const next = clamp(value, .35, MAX_OUTPUT_SCALE);
      fitMode = 'custom';
      if (canvas) canvas.style.transform = `scale(${next})`;
      return next;
    },
    pan(x = 0, y = 0) {
      if (!viewport) return { x: 0, y: 0 };
      viewport.scrollLeft = Math.max(0, Number(x) || 0);
      viewport.scrollTop = Math.max(0, Number(y) || 0);
      return { x: viewport.scrollLeft, y: viewport.scrollTop };
    },
    rotate() {
      const rotation = ((Number(currentSheet?.rotation) || 0) + 90) % 360;
      currentSheet = { ...currentSheet, rotation };
      return rotation;
    },
    fitPage() {
      fitMode = 'fit-page';
      if (canvas) {
        canvas.style.transform = 'none';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
      }
      return 'fit-page';
    },
    fitWidth() {
      fitMode = 'fit-width';
      if (canvas) {
        canvas.style.transform = 'none';
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
      }
      return 'fit-width';
    },
    cancel() { renderTask?.cancel?.(); },
    destroy: releasePdf,
    get canvas() { return canvas; },
    get currentSheet() { return currentSheet ? { ...currentSheet } : null; },
    get renderGeneration() { return renderGeneration; }
  };

  return api;
}
