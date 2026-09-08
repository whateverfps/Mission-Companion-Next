import { validNormalizedRegion } from './drawing-object-model.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const perfNow = () => globalThis.performance?.now?.() ?? Date.now();
const diagnosticsEnabled = globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED === true;
const logSlowOperation = (name, startedAt, details = {}) => {
  if (!diagnosticsEnabled) return Math.max(0, perfNow() - startedAt);
  const elapsed = Math.max(0, perfNow() - startedAt);
  if (elapsed > 10) console.warn(name, elapsed, { ...details, stack: new Error().stack });
  return elapsed;
};

export const DRAWING_OVERLAY_TYPES = Object.freeze(['rooms', 'confirmed', 'candidates', 'equipment', 'keyedNotes', 'callouts', 'scheduleLinks', 'warnings', 'selected']);

export function createDrawingOverlay(record = {}) {
  if (!text(record.projectId) || !text(record.documentId) || !text(record.pageId) || !validNormalizedRegion(record.region)) return null;
  const type = DRAWING_OVERLAY_TYPES.includes(record.type) ? record.type : 'candidates';
  return {
    overlayId: text(record.overlayId || record.id), projectId: text(record.projectId), documentId: text(record.documentId), pageId: text(record.pageId),
    type, region: { ...record.region }, geometry: record.geometry || null, label: text(record.label) || 'Drawing evidence', sourceObservationId: text(record.sourceObservationId),
    confidence: Math.max(0, Math.min(1, Number(record.confidence) || 0)), verificationState: text(record.verificationState).toLowerCase() || 'candidate',
    visible: record.visible !== false, selectable: record.selectable !== false, styleToken: text(record.styleToken) || type, metadata: record.metadata ? structuredClone(record.metadata) : {}
  };
}

export function transformOverlayRegion(region, rotation = 0) {
  const angle = ((Number(rotation) % 360) + 360) % 360;
  if (angle === 90) return { x: 1 - region.y - region.height, y: region.x, width: region.height, height: region.width };
  if (angle === 180) return { x: 1 - region.x - region.width, y: 1 - region.y - region.height, width: region.width, height: region.height };
  if (angle === 270) return { x: region.y, y: 1 - region.x - region.width, width: region.height, height: region.width };
  return { ...region };
}

const regionKey = region => [region.x, region.y, region.width, region.height].map(value => Math.round(Number(value) * 1000)).join(':');
const candidate = record => record.verificationState === 'candidate' || record.type === 'candidates';
const priority = record => record.type === 'selected' ? 0 : record.verificationState === 'confirmed' ? 1 : record.metadata?.related || record.styleToken === 'related' ? 2 : 3 + (1 - record.confidence);
const intersectsRegion = (a, b, buffer = 0) => {
  if (!validNormalizedRegion(a) || !validNormalizedRegion(b)) return true;
  const x1 = Math.max(0, Number(b.x) - Number(buffer) || 0);
  const y1 = Math.max(0, Number(b.y) - Number(buffer) || 0);
  const x2 = Math.min(1, Number(b.x) + Number(b.width) + Number(buffer) || 1);
  const y2 = Math.min(1, Number(b.y) + Number(b.height) + Number(buffer) || 1);
  return Number(a.x) + Number(a.width) >= x1 && Number(a.y) + Number(a.height) >= y1 && Number(a.x) <= x2 && Number(a.y) <= y2;
};

export function visibleDrawingOverlays(records = [], { projectId, documentId, pageId, visibility = {}, viewportRegion = null, viewportBuffer = .08, rotation = 0, reviewMode = false, maxVisible = 120, onDiagnostic = () => {} } = {}) {
  const startedAt = perfNow();
  const suppressionReasons = {}; const suppress = reason => { suppressionReasons[reason] = (suppressionReasons[reason] || 0) + 1; };
  const normalized = list(records).map(createDrawingOverlay).filter(Boolean);
  const owned = normalized.filter(record => record.projectId === text(projectId) && record.documentId === text(documentId) && record.pageId === text(pageId));
  const accepted = []; const seen = new Set(); let oversizedRegionsRejected = 0;
  let iterationCount = 0;
  for (const record of owned) {
    iterationCount += 1;
    const pinned = record.type === 'selected' || record.verificationState === 'confirmed';
    if (!pinned && candidate(record) && !reviewMode && visibility.candidates !== true) { suppress('candidate-hidden'); continue; }
    if (!pinned && candidate(record) && !reviewMode && record.confidence < .75) { suppress('low-confidence-candidate'); continue; }
    if (!record.visible || (visibility[record.type] === false && !(reviewMode && candidate(record)))) { suppress('visibility-disabled'); continue; }
    if (!pinned && viewportRegion && !intersectsRegion(record.region, viewportRegion, viewportBuffer)) { suppress('offscreen-region'); continue; }
    const area = record.region.width * record.region.height;
    if (candidate(record) && record.type !== 'rooms' && area > .2) { oversizedRegionsRejected += 1; suppress('oversized-candidate'); continue; }
    const identity = candidate(record) ? `${text(record.metadata?.objectType).toLowerCase()}:${record.label.toLowerCase()}` : record.overlayId;
    const key = `${identity}:${regionKey(record.region)}`;
    if (seen.has(key)) { suppress('duplicate-region'); continue; }
    seen.add(key); accepted.push(record);
  }
  accepted.sort((a, b) => priority(a) - priority(b) || b.confidence - a.confidence || a.overlayId.localeCompare(b.overlayId));
  const visible = accepted.slice(0, Math.max(1, Number(maxVisible) || 120));
  if (accepted.length > visible.length) suppressionReasons['page-limit'] = accepted.length - visible.length;
  const result = visible.map(record => ({ ...record, displayRegion: transformOverlayRegion(record.region, rotation) }));
  if (diagnosticsEnabled) onDiagnostic({ totalObservations: list(records).length, deduplicatedObjects: new Set(owned.map(item => item.overlayId)).size, regionsBeforeDeduplication: owned.length, regionsAfterDeduplication: accepted.length, oversizedRegionsRejected, normalViewOverlaysRendered: reviewMode ? 0 : result.length, reviewModeOverlaysRendered: reviewMode ? result.length : 0, suppressionReasons });
  logSlowOperation('overlay generation', startedAt, { iterationCount, ownedCount: owned.length, acceptedCount: accepted.length, visibleCount: result.length });
  return result;
}

export function overlayStyle(record) {
  const region = record?.displayRegion || record?.region;
  if (!validNormalizedRegion(region)) return null;
  return { left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${Math.max(region.width * 100, .8)}%`, height: `${Math.max(region.height * 100, .8)}%` };
}
