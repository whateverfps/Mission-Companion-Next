const DEBUG_QUERY_KEY = 'debug';
const DEBUG_STORAGE_KEY = 'debug';
const HISTORY_LIMIT = 200;

const isDebugEnabled = () => {
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    if (params.get(DEBUG_QUERY_KEY) === '1') return true;
  } catch {}
  try {
    return String(globalThis.localStorage?.getItem?.(DEBUG_STORAGE_KEY) || '').toLowerCase() === 'true';
  } catch {
    return false;
  }
};

const enabled = isDebugEnabled();
const perfState = globalThis.__mcPerformanceDiagnostics || (globalThis.__mcPerformanceDiagnostics = {
  enabled,
  stages: [],
  heap: [],
  marks: [],
  firstPaintAt: null,
  hydratedAt: null
});

function pushBounded(list, value) {
  list.push(value);
  if (list.length > HISTORY_LIMIT) list.splice(0, list.length - HISTORY_LIMIT);
}

export function performanceDiagnosticsEnabled() {
  return enabled;
}

export function stageLabel(name = '') {
  return String(name || '').trim();
}

export function recordStageTiming(name, startedAt, detail = {}, extra = {}) {
  if (!enabled) return null;
  const label = stageLabel(name);
  const endedAt = globalThis.performance?.now?.() ?? Date.now();
  const durationMs = Math.max(0, endedAt - Number(startedAt || endedAt));
  const entry = { name: label, durationMs, startedAt, endedAt, ...detail, ...extra };
  pushBounded(perfState.stages, entry);
  if (durationMs > 50) console.warn('perf-stage', entry);
  try {
    if (globalThis.performance?.mark && globalThis.performance?.measure) {
      const startMark = `mc:${label}:start:${Math.random().toString(36).slice(2)}`;
      const endMark = `${startMark}:end`;
      globalThis.performance.mark(startMark);
      globalThis.performance.mark(endMark);
      globalThis.performance.measure(`mc:${label}`, startMark, endMark);
      pushBounded(perfState.marks, { name: label, durationMs, startedAt, endedAt });
    }
  } catch {}
  return entry;
}

export function recordHeapSample(sample = {}) {
  if (!enabled) return null;
  const entry = {
    at: globalThis.performance?.now?.() ?? Date.now(),
    usedJSHeapSize: sample.usedJSHeapSize ?? null,
    totalJSHeapSize: sample.totalJSHeapSize ?? null,
    jsHeapSizeLimit: sample.jsHeapSizeLimit ?? null
  };
  pushBounded(perfState.heap, entry);
  return entry;
}

export function markFirstPaint() {
  if (!enabled || perfState.firstPaintAt !== null) return perfState.firstPaintAt;
  perfState.firstPaintAt = globalThis.performance?.now?.() ?? Date.now();
  return perfState.firstPaintAt;
}

export function markHydrated() {
  if (!enabled || perfState.hydratedAt !== null) return perfState.hydratedAt;
  perfState.hydratedAt = globalThis.performance?.now?.() ?? Date.now();
  return perfState.hydratedAt;
}

export function getPerformanceDiagnosticsState() {
  return {
    enabled,
    stages: [...perfState.stages],
    heap: [...perfState.heap],
    marks: [...perfState.marks],
    firstPaintAt: perfState.firstPaintAt,
    hydratedAt: perfState.hydratedAt
  };
}

