const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || minimum));
const key = (documentId, pageNumber) => `${String(documentId || '')}:${Number(pageNumber) || 0}`;

export function drawingResizeRenderIsCurrent({ observedStage, activeStage, observedPage, selectedPage } = {}) {
  return Boolean(
    observedStage?.isConnected &&
    observedStage === activeStage &&
    Number(observedPage) === Number(selectedPage)
  );
}

export function createDrawingRenderCache({ maxEntries = 6, onMetric = () => {}, onEvict = () => {} } = {}) {
  const entries = new Map();
  return {
    get(cacheKey) {
      const keyValue = String(cacheKey || '');
      if (!entries.has(keyValue)) { onMetric({ operation: 'render-cache', cache: 'miss', key: keyValue }); return null; }
      const value = entries.get(keyValue);
      entries.delete(keyValue);
      entries.set(keyValue, value);
      onMetric({ operation: 'render-cache', cache: 'hit', key: keyValue });
      return value;
    },
    set(cacheKey, value) {
      const keyValue = String(cacheKey || '');
      if (!keyValue || !value) return false;
      entries.delete(keyValue);
      entries.set(keyValue, value);
      while (entries.size > Math.max(1, Number(maxEntries) || 6)) {
        const evictedKey = entries.keys().next().value;
        const evictedValue = entries.get(evictedKey);
        entries.delete(evictedKey);
        onEvict(evictedValue, evictedKey);
      }
      return true;
    },
    clear() {
      for (const [entryKey, entryValue] of entries.entries()) onEvict(entryValue, entryKey);
      entries.clear();
    },
    size: () => entries.size
  };
}

export function createDrawingViewerEngine({ viewportStore = new Map(), minZoom = .25, maxZoom = 8, clock = () => performance.now(), onMetric = () => {} } = {}) {
  let documentId = '';
  let pageCount = 0;
  let selectedPage = 0;
  let renderGeneration = 0;
  let activeRender = null;
  let activeRenderTaskCount = 0;
  let activeRenderPromiseCount = 0;
  let staleTasksCancelled = 0;

  const api = {
    openDocument(nextDocumentId, nextPageCount, requestedPage = 1) {
      const changed = documentId !== String(nextDocumentId || '');
      if (changed) api.cancelRender();
      documentId = String(nextDocumentId || '');
      pageCount = Math.max(0, Math.trunc(Number(nextPageCount) || 0));
      selectedPage = pageCount ? clamp(Math.trunc(Number(requestedPage) || 1), 1, pageCount) : 0;
      return api.snapshot();
    },
    getPageCount: () => pageCount,
    selectPage(pageNumber) {
      const startedAt = clock();
      if (!pageCount) return 0;
      selectedPage = clamp(Math.trunc(Number(pageNumber) || selectedPage || 1), 1, pageCount);
      onMetric({ operation: 'page-selection', durationMs: Math.max(0, clock() - startedAt), pageNumber: selectedPage });
      return selectedPage;
    },
    nextPage: () => api.selectPage(selectedPage + 1),
    previousPage: () => api.selectPage(selectedPage - 1),
    beginRender(pageNumber = selectedPage) {
      if (Number(pageNumber) !== selectedPage) api.selectPage(pageNumber);
      api.cancelRender();
      renderGeneration += 1;
      return { generation: renderGeneration, documentId, pageNumber: selectedPage };
    },
    attachRender(token, task) {
      if (token?.generation !== renderGeneration) { task?.cancel?.(); staleTasksCancelled += 1; onMetric({ operation: 'render-task', activeRenderTaskCount, staleTasksCancelled, state: 'stale-cancelled' }); return false; }
      activeRender = task || null;
      if (task) { activeRenderTaskCount += 1; onMetric({ operation: 'render-task', activeRenderTaskCount, staleTasksCancelled, state: 'attached' }); }
      return true;
    },
    async renderSelectedPage(startRender) {
      const startedAt = clock();
      const token = api.beginRender(selectedPage);
      activeRenderPromiseCount += 1;
      try {
        const task = await startRender(selectedPage, token);
        if (!api.attachRender(token, task)) {
          task?.releasePage?.();
          return { committed: false, cancelled: true, token, task };
        }
        try {
          await task.promise;
        } catch (error) {
          if (!api.canCommit(token)) return { committed: false, cancelled: true, token, task };
          throw error;
        } finally {
          task?.releasePage?.();
        }
        if (activeRender === task) {
          activeRender = null;
          activeRenderTaskCount = Math.max(0, activeRenderTaskCount - 1);
          onMetric({ operation: 'render-task', activeRenderTaskCount, staleTasksCancelled, state: 'completed' });
        }
        const committed = api.canCommit(token);
        onMetric({ operation: 'page-render', durationMs: Math.max(0, clock() - startedAt), pageNumber: token.pageNumber, committed });
        return { committed, cancelled: !committed, token, task };
      } finally {
        activeRenderPromiseCount = Math.max(0, activeRenderPromiseCount - 1);
      }
    },
    canCommit(token, canvasConnected = true) {
      return Boolean(canvasConnected) && token?.generation === renderGeneration && token?.documentId === documentId && token?.pageNumber === selectedPage;
    },
    cancelRender() {
      if (activeRender) {
        staleTasksCancelled += 1;
        activeRenderTaskCount = Math.max(0, activeRenderTaskCount - 1);
        onMetric({ operation: 'render-task', activeRenderTaskCount, staleTasksCancelled, state: 'cancelled' });
      }
      activeRender?.cancel?.();
      activeRender?.release?.();
      activeRender = null;
    },
    getViewport(pageNumber = selectedPage) {
      return structuredClone(viewportStore.get(key(documentId, pageNumber)) || { mode: 'fit-page', zoom: null, rotation: 0, scrollLeft: 0, scrollTop: 0 });
    },
    restoreViewport(pageNumber, viewport = {}) {
      const restored = { mode: 'fit-page', zoom: null, rotation: 0, scrollLeft: 0, scrollTop: 0, ...structuredClone(viewport) };
      viewportStore.set(key(documentId, pageNumber), restored);
      return structuredClone(restored);
    },
    setZoom(zoom, pageNumber = selectedPage) {
      const viewport = api.getViewport(pageNumber);
      return api.restoreViewport(pageNumber, { ...viewport, mode: 'custom', zoom: clamp(zoom, minZoom, maxZoom) });
    },
    zoomAtPoint({ deltaY = 0, pointerX = 0, pointerY = 0, pageNumber = selectedPage, sensitivity = .002 } = {}) {
      const startedAt = clock();
      const viewport = api.getViewport(pageNumber);
      const currentZoom = clamp(viewport.zoom || 1, minZoom, maxZoom);
      const zoom = clamp(currentZoom * Math.exp(-(Number(deltaY) || 0) * sensitivity), minZoom, maxZoom);
      const drawingX = ((Number(viewport.scrollLeft) || 0) + Number(pointerX || 0)) / currentZoom;
      const drawingY = ((Number(viewport.scrollTop) || 0) + Number(pointerY || 0)) / currentZoom;
      const result = api.restoreViewport(pageNumber, { ...viewport, mode: 'custom', zoom, scrollLeft: Math.max(0, drawingX * zoom - Number(pointerX || 0)), scrollTop: Math.max(0, drawingY * zoom - Number(pointerY || 0)) });
      onMetric({ operation: 'zoom', durationMs: Math.max(0, clock() - startedAt), pageNumber, zoom: result.zoom });
      return result;
    },
    fitPage: (pageNumber = selectedPage) => api.restoreViewport(pageNumber, { ...api.getViewport(pageNumber), mode: 'fit-page', zoom: null, scrollLeft: 0, scrollTop: 0 }),
    fitWidth: (pageNumber = selectedPage) => api.restoreViewport(pageNumber, { ...api.getViewport(pageNumber), mode: 'fit-width', zoom: null, scrollLeft: 0, scrollTop: 0 }),
    rotate(pageNumber = selectedPage) { const viewport = api.getViewport(pageNumber); return api.restoreViewport(pageNumber, { ...viewport, rotation: ((Number(viewport.rotation) || 0) + 90) % 360 }); },
    resetView: (pageNumber = selectedPage) => api.restoreViewport(pageNumber, { mode: 'fit-page', zoom: null, rotation: 0, scrollLeft: 0, scrollTop: 0 }),
    snapshot: () => ({ documentId, pageCount, selectedPage, renderGeneration }),
    renderLifecycle: () => ({ documentId, pageCount, selectedPage, renderGeneration, activeRenderTaskCount, activeRenderPromiseCount, staleTasksCancelled })
  };
  return api;
}
