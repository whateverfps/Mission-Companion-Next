const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

function stableId(parts) {
  let hash = 2166136261;
  for (const character of parts.map(text).join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `drawing-object-${(hash >>> 0).toString(36)}`;
}

export function validNormalizedRegion(region) {
  if (!region || typeof region !== 'object') return false;
  const values = ['x', 'y', 'width', 'height'].map(key => Number(region[key]));
  return values.every(Number.isFinite) && values[0] >= 0 && values[1] >= 0 && values[2] > 0 && values[3] > 0
    && values[0] + values[2] <= 1.001 && values[1] + values[3] <= 1.001;
}

export function roomEvidenceDecision(value, evidence = {}) {
  const room = text(value).replace(/^room\s*/i, '');
  const source = text(evidence.sourceText || evidence.text || value);
  if (!room) return { accepted: false, reason: 'Room number is unavailable.' };
  if (/\b518[-\s]22[-\s]700\b/.test(source) || ['518', '700'].includes(room)) return { accepted: false, reason: 'Project-number component.' };
  if (/^\d{1,3}[A-Z]{1,3}-?\d{2,4}$/i.test(room) || /^\d{2}[A-Z]{1,3}\d{3,4}$/i.test(room)) return { accepted: false, reason: 'Sheet or equipment identifier.' };
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(room)) return { accepted: false, reason: 'Date value.' };
  if (/^\d{2}\s?\d{2}\s?\d{2}$/.test(room) || /^\d{6}$/.test(room)) return { accepted: false, reason: 'Specification section number.' };
  if (/^(?:page|sheet|detail|keynote|note|qty|quantity)\b/i.test(source)) return { accepted: false, reason: 'Non-room drawing reference.' };
  if (/^[0-9]{1,2}$/.test(room) && !/\broom\b/i.test(source)) return { accepted: false, reason: 'Unlabeled numeric value.' };
  if (evidence.scheduleOnly && !evidence.graphicalOccurrence) return { accepted: true, candidate: true, reason: 'Schedule-only room candidate; graphical occurrence is unverified.' };
  return { accepted: true, candidate: evidence.verificationState !== 'confirmed', reason: evidence.verificationState === 'confirmed' ? 'Human-confirmed room occurrence.' : 'Deterministic room-label candidate requires review.' };
}

export function createDrawingObject(record = {}) {
  const region = validNormalizedRegion(record.region) ? { x: Number(record.region.x), y: Number(record.region.y), width: Number(record.region.width), height: Number(record.region.height) } : null;
  const verificationState = ['confirmed', 'candidate', 'rejected', 'unavailable'].includes(text(record.verificationState).toLowerCase())
    ? text(record.verificationState).toLowerCase() : 'candidate';
  const objectId = text(record.objectId) || stableId([record.projectId, record.documentId, record.pageId, record.type, record.label, record.observationId]);
  return {
    objectId, projectId: text(record.projectId), documentId: text(record.documentId), pageId: text(record.pageId),
    type: text(record.type) || 'generic-candidate-object', subtype: text(record.subtype), tag: text(record.tag), label: text(record.label) || 'Unclassified drawing object',
    region, geometry: record.geometry || null, sourceObservationIds: [...new Set([...list(record.sourceObservationIds), record.observationId].map(text).filter(Boolean))],
    evidenceText: text(record.evidenceText || record.sourceText), confidence: Math.max(0, Math.min(1, Number(record.confidence) || 0)), verificationState,
    relatedScheduleReference: text(record.relatedScheduleReference), relatedKeynoteReferences: list(record.relatedKeynoteReferences).map(text).filter(Boolean),
    relatedDetailReferences: list(record.relatedDetailReferences).map(text).filter(Boolean), linkedSpecificationRecords: list(record.linkedSpecificationRecords),
    linkedRoomIds: list(record.linkedRoomIds).map(text).filter(Boolean), linkedEquipmentIds: list(record.linkedEquipmentIds).map(text).filter(Boolean),
    acceptanceReason: text(record.acceptanceReason), manualDecision: record.manualDecision ? structuredClone(record.manualDecision) : null
  };
}

export function createRoomObject(record = {}) {
  const decision = roomEvidenceDecision(record.roomNumber || record.label, record);
  const object = createDrawingObject({ ...record, type: 'room', label: record.roomName ? `${record.roomNumber} — ${record.roomName}` : record.roomNumber, acceptanceReason: decision.reason,
    verificationState: decision.accepted ? (decision.candidate ? 'candidate' : 'confirmed') : 'rejected' });
  return { ...object, roomId: text(record.roomId) || object.objectId.replace('drawing-object-', 'room-'), roomNumber: text(record.roomNumber), roomName: text(record.roomName), accepted: decision.accepted };
}

export function screenToNormalizedPoint({ clientX, clientY, bounds, scrollLeft = 0, scrollTop = 0, contentWidth, contentHeight, rotation = 0 } = {}) {
  const width = Number(contentWidth) || Number(bounds?.width) || 1;
  const height = Number(contentHeight) || Number(bounds?.height) || 1;
  let x = Math.max(0, Math.min(1, (Number(clientX) - Number(bounds?.left || 0) + Number(scrollLeft || 0)) / width));
  let y = Math.max(0, Math.min(1, (Number(clientY) - Number(bounds?.top || 0) + Number(scrollTop || 0)) / height));
  const angle = ((Number(rotation) % 360) + 360) % 360;
  if (angle === 90) [x, y] = [y, 1 - x];
  else if (angle === 180) [x, y] = [1 - x, 1 - y];
  else if (angle === 270) [x, y] = [1 - y, x];
  return { x, y };
}

function distanceToRegion(point, region) {
  const dx = Math.max(region.x - point.x, 0, point.x - region.x - region.width);
  const dy = Math.max(region.y - point.y, 0, point.y - region.y - region.height);
  return Math.hypot(dx, dy);
}

export function rankDrawingObjects(objects = [], point = {}, { visibleTypes = null, maximumDistance = .025 } = {}) {
  return list(objects).filter(object => object.verificationState !== 'rejected' && validNormalizedRegion(object.region) && (!visibleTypes || visibleTypes.has(object.type)))
    .map(object => {
      const contained = point.x >= object.region.x && point.x <= object.region.x + object.region.width && point.y >= object.region.y && point.y <= object.region.y + object.region.height;
      const distance = distanceToRegion(point, object.region);
      return { object, contained, distance, score: (object.verificationState === 'confirmed' ? 100 : 0) + (contained ? 50 : 0) + object.confidence * 10 - distance * 100 };
    }).filter(item => item.contained || item.distance <= maximumDistance)
    .sort((a, b) => b.score - a.score || a.object.objectId.localeCompare(b.object.objectId));
}

export function selectDrawingObject(objects = [], point = {}, options = {}) {
  const ranked = rankDrawingObjects(objects, point, options);
  if (!ranked.length) return { status: 'empty', object: null, choices: [] };
  if (ranked.length > 1 && Math.abs(ranked[0].score - ranked[1].score) < 0.001) return { status: 'ambiguous', object: null, choices: ranked.slice(0, 5).map(item => item.object) };
  return { status: 'selected', object: ranked[0].object, choices: [] };
}

export function createDrawingObjectDecisionStore({ storage = globalThis.localStorage, key = 'mission-companion:drawing-object-decisions:v1', now = () => new Date().toISOString() } = {}) {
  const read = () => { try { const value = JSON.parse(storage?.getItem?.(key) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };
  const write = value => { storage?.setItem?.(key, JSON.stringify(value)); };
  return {
    get(objectId) { return structuredClone(read()[text(objectId)] || null); },
    decide(objectId, verificationState, reason = '', source = 'manual') {
      if (!text(objectId) || !['confirmed', 'rejected', 'candidate'].includes(text(verificationState).toLowerCase())) return null;
      const decisions = read();
      decisions[text(objectId)] = { verificationState: text(verificationState).toLowerCase(), reason: text(reason), source: text(source), updatedAt: now() };
      write(decisions); return structuredClone(decisions[text(objectId)]);
    },
    apply(object) { const decision = read()[object?.objectId]; return decision ? { ...object, verificationState: decision.verificationState, manualDecision: structuredClone(decision) } : object; }
  };
}
