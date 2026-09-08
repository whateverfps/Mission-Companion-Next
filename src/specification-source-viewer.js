import { isSpecificationDocument } from './document-routing.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const pageNumber = value => Math.max(0, Math.trunc(Number(value) || 0));

const pdfCache = new Map();
const renderCache = new Map();

const cacheKey = ({ documentId = '', fingerprint = '' } = {}) => `${text(documentId)}::${text(fingerprint)}`;
const renderKey = ({ documentId = '', fingerprint = '', pageNumber: requestedPage = 0, scale = 1.25, rotation = 0 } = {}) => `${cacheKey({ documentId, fingerprint })}::${pageNumber(requestedPage)}::${Number(scale) || 0}::${Number(rotation) || 0}`;

function cloneCanvas(canvas) {
  if (!canvas?.width || !canvas?.height) return null;
  if (typeof globalThis.document?.createElement === 'function') {
    const snapshot = globalThis.document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext?.('2d')?.drawImage?.(canvas, 0, 0);
    return snapshot;
  }
  return { width: canvas.width, height: canvas.height };
}

export function createSpecificationSourceViewer({ openPdf, renderPage, now = () => new Date().toISOString(), onDiagnostic = () => {} } = {}) {
  if (typeof openPdf !== 'function' || typeof renderPage !== 'function') throw new Error('Specification source viewer requires PDF open and render functions.');
  let proxy = null;
  let render = null;
  let canvas = null;
  let target = null;
  let cleanupTimestamp = '';
  let generation = 0;
  let activeRequestKey = '';
  let activePdfCacheKey = '';
  let lifecycleSequence = 0;
  let activeLifecycleId = 0;

  const diagnostics = () => ({
    specificationPdfProxyActive: Boolean(proxy),
    specificationSourcePage: target?.pageNumber || null,
    sourceViewRenderTaskActive: Boolean(render),
    sourceViewCanvasPixels: canvas ? { width: Number(canvas.width) || 0, height: Number(canvas.height) || 0 } : { width: 0, height: 0 },
    sourceViewCacheEntryCount: 0,
    sourceViewCleanupTimestamp: cleanupTimestamp,
    retainedSpecificationPageRecordsInMemory: target ? 1 : 0
  });

  async function close(reason = 'closed') {
    const lifecycleId = activeLifecycleId || lifecycleSequence || 0;
    console.info(`SOURCE EVIDENCE CLOSE #${lifecycleId}`, {
      reason,
      target: target ? structuredClone(target) : null,
      diagnostics: diagnostics(),
      activeRequestKey,
      activePdfCacheKey
    });
    generation += 1;
    activeRequestKey = '';
    try { render?.cancel?.(); } catch {}
    try { render?.release?.(); } catch {}
    render = null;
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    canvas = null;
    try { await proxy?.cleanup?.(); } catch {}
    try { await proxy?.destroy?.(); } catch {}
    if (activePdfCacheKey) pdfCache.delete(activePdfCacheKey);
    proxy = null;
    target = null;
    activePdfCacheKey = '';
    activeLifecycleId = 0;
    cleanupTimestamp = now();
    const state = { ...diagnostics(), reason };
    onDiagnostic(state);
    return state;
  }

  async function replaceCurrentRequest() {
    generation += 1;
    activeRequestKey = '';
    try { render?.cancel?.(); } catch {}
    try { render?.release?.(); } catch {}
    render = null;
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    canvas = null;
    target = null;
  }

  async function open({ document, sourceBlob, pageNumber: requestedPage, sectionNumber = '', sectionTitle = '', articleReference = '', returnTarget = null, canvas: targetCanvas } = {}) {
    const exactPage = pageNumber(requestedPage);
    if (!isSpecificationDocument(document)) return { ok: false, status: 'invalid-document-role', diagnostics: diagnostics() };
    if (!exactPage || !sourceBlob || !targetCanvas?.getContext) return { ok: false, status: 'exact-source-page-required', diagnostics: diagnostics() };
    
    // Store the target canvas before clearing previous request
    const activeCanvas = targetCanvas;
    await replaceCurrentRequest();
    // Re-assign after replaceCurrentRequest (which sets canvas = null)
    canvas = activeCanvas;
    
    const requestGeneration = generation;
    const fingerprint = text(document.contentHash || document.version || document.revision || sourceBlob?.lastModified || sourceBlob?.size || '');
    const pdfKey = cacheKey({ documentId: document.id, fingerprint });
    let cachedProxy = pdfCache.get(pdfKey) || null;
    if (!cachedProxy) {
      cachedProxy = await openPdf(sourceBlob);
      pdfCache.set(pdfKey, cachedProxy);
    }
    if (generation !== requestGeneration) { return { ok: false, status: 'superseded', diagnostics: diagnostics() }; }
    proxy = cachedProxy;
    activePdfCacheKey = pdfKey;
    activeLifecycleId = ++lifecycleSequence;
    if (exactPage > Number(proxy?.numPages || 0)) { await close('page-unavailable'); return { ok: false, status: 'page-unavailable', diagnostics: diagnostics() }; }
    // canvas is already assigned to activeCanvas above
    target = { documentId: text(document.id), pageNumber: exactPage, sectionNumber: text(sectionNumber), sectionTitle: text(sectionTitle), articleReference: text(articleReference), returnTarget: returnTarget ? structuredClone(returnTarget) : null };
    activeRequestKey = renderKey({ documentId: document.id, fingerprint, pageNumber: exactPage, scale: 1.25, rotation: 0 });
    console.info(`SOURCE EVIDENCE OPEN #${activeLifecycleId}`, {
      documentId: text(document.id),
      pageNumber: exactPage,
      sectionNumber: text(sectionNumber),
      sectionTitle: text(sectionTitle),
      articleReference: text(articleReference),
      requestGeneration,
      activeRequestKey,
      activePdfCacheKey,
      diagnostics: diagnostics(),
      target: structuredClone(target)
    });
    const cachedRender = renderCache.get(activeRequestKey) || null;
    if (cachedRender?.snapshot) {
      canvas.width = cachedRender.width;
      canvas.height = cachedRender.height;
      canvas.getContext('2d')?.drawImage?.(cachedRender.snapshot, 0, 0);
      const state = diagnostics();
      onDiagnostic({ ...state, operation: 'render-cache-hit', durationMs: 0, cacheKey: activeRequestKey });
      return { ok: true, status: 'rendered', target: structuredClone(target), diagnostics: state, cacheHit: true };
    }
    const pageRender = await renderPage(proxy, exactPage, canvas, { scale: 1.25 });
    if (generation !== requestGeneration) { try { pageRender?.cancel?.(); pageRender?.release?.(); } catch {} return { ok: false, status: 'superseded', diagnostics: diagnostics() }; }
    render = pageRender;
    try {
      await render.promise;
      if (generation !== requestGeneration) return { ok: false, status: 'superseded', diagnostics: diagnostics() };
      render?.releasePage?.();
      renderCache.set(activeRequestKey, { width: canvas.width, height: canvas.height, snapshot: cloneCanvas(canvas), sourceDocumentId: target.documentId, pageNumber: exactPage });
      render = null;
      const state = diagnostics(); 
      onDiagnostic(state);
      return { ok: true, status: 'rendered', target: structuredClone(target), diagnostics: state };
    } catch (error) {
      if (generation === requestGeneration) await close('render-failed');
      return { ok: false, status: 'render-failed', error: error?.message || String(error), diagnostics: diagnostics() };
    }
  }

  return { open, close, diagnostics, target: () => target ? structuredClone(target) : null };
}
