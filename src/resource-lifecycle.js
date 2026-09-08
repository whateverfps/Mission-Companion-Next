const globalKey = '__mcResourceLifecycle';
const state = globalThis[globalKey] || (globalThis[globalKey] = {
  nextId: 0,
  liveByKind: new Map(),
  currentByKind: new Map(),
  totals: { created: Object.create(null), released: Object.create(null), reused: Object.create(null) }
});

const objectIds = globalThis.__mcResourceLifecycleObjectIds || (globalThis.__mcResourceLifecycleObjectIds = new WeakMap());
const listenerState = globalThis.__mcEventListenerLifecycle || (globalThis.__mcEventListenerLifecycle = {
  installed: false,
  counts: Object.create(null),
  total: 0
});

const installEventListenerTracker = () => {
  if (listenerState.installed || !globalThis.EventTarget?.prototype) return;
  listenerState.installed = true;
  const { addEventListener, removeEventListener } = globalThis.EventTarget.prototype;
  if (typeof addEventListener !== 'function' || typeof removeEventListener !== 'function') return;
  globalThis.EventTarget.prototype.addEventListener = function(type, listener, options) {
    const key = String(type || '');
    if (key) {
      listenerState.counts[key] = (listenerState.counts[key] || 0) + 1;
      listenerState.total += 1;
    }
    return addEventListener.call(this, type, listener, options);
  };
  globalThis.EventTarget.prototype.removeEventListener = function(type, listener, options) {
    const key = String(type || '');
    if (key && listenerState.counts[key] > 0) {
      listenerState.counts[key] -= 1;
      listenerState.total = Math.max(0, listenerState.total - 1);
    }
    return removeEventListener.call(this, type, listener, options);
  };
};

installEventListenerTracker();

const ensureKind = kind => {
  const key = String(kind || '').trim();
  if (!key) throw new Error('A resource kind is required.');
  if (!state.liveByKind.has(key)) state.liveByKind.set(key, new Map());
  if (!state.totals.created[key]) state.totals.created[key] = 0;
  if (!state.totals.released[key]) state.totals.released[key] = 0;
  if (!state.totals.reused[key]) state.totals.reused[key] = 0;
  return key;
};

const resourceId = (kind, resource, detail = {}) => {
  const normalizedKind = ensureKind(kind);
  if (resource && (typeof resource === 'object' || typeof resource === 'function')) {
    if (!objectIds.has(resource)) objectIds.set(resource, `${normalizedKind}:${++state.nextId}`);
    return objectIds.get(resource);
  }
  if (detail?.resourceId) return `${normalizedKind}:${String(detail.resourceId)}`;
  return `${normalizedKind}:${++state.nextId}:${String(resource ?? '')}`;
};

const liveEntry = (kind, resource, detail = {}) => ({ id: resourceId(kind, resource, detail), resource, detail: { ...detail } });

export function acquireTrackedResource(kind, resource, detail = {}) {
  const normalizedKind = ensureKind(kind);
  const id = resourceId(normalizedKind, resource, detail);
  const live = state.liveByKind.get(normalizedKind);
  if (live.has(id)) {
    state.totals.reused[normalizedKind] += 1;
    return { id, kind: normalizedKind, reused: true, activeCount: live.size };
  }
  live.set(id, liveEntry(normalizedKind, resource, detail));
  state.totals.created[normalizedKind] += 1;
  return { id, kind: normalizedKind, created: true, activeCount: live.size };
}

export function markTrackedResourceReused(kind, resource, detail = {}) {
  const normalizedKind = ensureKind(kind);
  const id = resourceId(normalizedKind, resource, detail);
  state.totals.reused[normalizedKind] += 1;
  return { id, kind: normalizedKind, reused: true, activeCount: state.liveByKind.get(normalizedKind).size };
}

export function releaseTrackedResource(kind, resource, detail = {}) {
  const normalizedKind = ensureKind(kind);
  const id = resourceId(normalizedKind, resource, detail);
  const live = state.liveByKind.get(normalizedKind);
  if (!live.has(id)) return { id, kind: normalizedKind, released: false, activeCount: live.size };
  live.delete(id);
  state.totals.released[normalizedKind] += 1;
  if (state.currentByKind.get(normalizedKind)?.id === id) state.currentByKind.delete(normalizedKind);
  return { id, kind: normalizedKind, released: true, activeCount: live.size };
}

export function replaceTrackedResource(kind, resource, detail = {}) {
  const normalizedKind = ensureKind(kind);
  const prior = state.currentByKind.get(normalizedKind);
  const nextId = resourceId(normalizedKind, resource, detail);
  if (prior && prior.id !== nextId) releaseTrackedResource(normalizedKind, prior.resource, prior.detail);
  const entry = acquireTrackedResource(normalizedKind, resource, detail);
  state.currentByKind.set(normalizedKind, { id: entry.id, resource, detail: { ...detail } });
  return entry;
}

export function clearTrackedResources(kinds = []) {
  for (const kind of kinds) {
    const normalizedKind = ensureKind(kind);
    for (const entry of [...state.liveByKind.get(normalizedKind).values()]) releaseTrackedResource(normalizedKind, entry.resource, entry.detail);
  }
}

const summarizeLive = entries => ({
  count: entries.length,
  items: entries.map(entry => ({ id: entry.id, ...entry.detail }))
});

export function snapshotTrackedResources({ workspaceRoot = null, drawingRenderCacheSize = 0, drawingCanvas = null, renderQueueDepth = 0 } = {}) {
  const live = kind => [...(state.liveByKind.get(kind) || new Map()).values()];
  const pdfDocuments = live('pdf-document');
  const pdfPages = live('pdf-page');
  const canvases = live('canvas');
  const imageBitmaps = live('image-bitmap');
  const offscreenCanvases = live('offscreen-canvas');
  const overlays = live('overlay');
  const requirements = live('requirement-model');
  const relationships = live('relationship-model');
  const inspectors = live('inspector-model');
  const workspaceNodeCount = workspaceRoot?.querySelectorAll?.('*')?.length ?? 0;
  const workspaceCanvasCount = workspaceRoot?.querySelectorAll?.('canvas')?.length ?? 0;
  const heapBytes = globalThis.performance?.memory?.usedJSHeapSize ?? null;
  return {
    pdfDocument: summarizeLive(pdfDocuments),
    pdfPage: summarizeLive(pdfPages),
    canvas: summarizeLive(canvases),
    imageBitmap: summarizeLive(imageBitmaps),
    offscreenCanvas: summarizeLive(offscreenCanvases),
    overlay: summarizeLive(overlays),
    requirementModel: summarizeLive(requirements),
    relationshipModel: summarizeLive(relationships),
    inspectorModel: summarizeLive(inspectors),
    counts: {
      activePdfDocuments: pdfDocuments.length,
      activePdfPages: pdfPages.length,
      cachedPdfPages: Number(drawingRenderCacheSize) || 0,
      renderQueueDepth: Number(renderQueueDepth) || 0,
      canvasCount: canvases.length + workspaceCanvasCount,
      imageBitmapCount: imageBitmaps.length,
      offscreenCanvasCount: offscreenCanvases.length,
      overlayCount: overlays.length,
      requirementCount: requirements.length,
      relationshipCount: relationships.length,
      inspectorModelCount: inspectors.length,
      domNodeCount: workspaceNodeCount,
      domCanvasCount: workspaceCanvasCount,
      approxJsHeapBytes: heapBytes,
      drawingCanvasConnected: Boolean(drawingCanvas?.isConnected)
    },
    eventListeners: { total: listenerState.total, byType: { ...listenerState.counts } },
    totals: structuredClone(state.totals)
  };
}

export function reportTrackedResources(label, detail = {}, snapshotOptions = {}) {
  if (globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED !== true) return null;
  const snapshot = snapshotTrackedResources(snapshotOptions);
  const payload = { label, ...detail, ...snapshot, stack: new Error().stack };
  console.warn('drawing resource snapshot', payload);
  return payload;
}
