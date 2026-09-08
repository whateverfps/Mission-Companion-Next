import { validNormalizedRegion } from './drawing-object-model.js';

const list = value => Array.isArray(value) ? value : [];
const text = value => value === null || value === undefined ? '' : String(value).trim();
const normalize = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const TYPE_RULES = Object.freeze([
  ['room','room'],['door','door'],['window','window'],['partition','wall'],['wall type','wall'],['wall','wall'],['floor finish','finish'],['base','finish'],['ceiling','finish'],['finish','finish'],['diffuser','diffuser'],['thermostat','equipment'],['mechanical','equipment'],['electrical','equipment'],['plumbing','equipment'],['telecom','telecom-outlet'],['data jack','telecom-outlet'],['fire alarm','fire-protection-device'],['fire protection','fire-protection-device'],['equipment','equipment'],['furniture','generic-drawing-object'],['casework','generic-drawing-object'],['fixture','generic-drawing-object'],['schedule','schedule-entry'],['legend','schedule-entry'],['callout','callout'],['detail','detail-reference'],['section marker','callout'],['elevation','callout'],['grid','generic-drawing-object'],['keynote','keynote'],['reference note','keynote'],['symbol','generic-drawing-object']
]);

export function objectTypeForObservation(kind = '', fallback = 'generic-drawing-object') {
  const value=normalize(kind); return TYPE_RULES.find(([term])=>value.includes(term))?.[1]||fallback;
}

function polygonPoints(object) {
  const geometry = object?.geometry;
  const points = Array.isArray(geometry) ? geometry : Array.isArray(geometry?.points) ? geometry.points : Array.isArray(geometry?.polygon) ? geometry.polygon : [];
  return points.map(point => Array.isArray(point) ? { x:Number(point[0]), y:Number(point[1]) } : { x:Number(point?.x), y:Number(point?.y) }).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function objectRegions(object) { const multiple=list(object?.graphicalRegions).filter(validNormalizedRegion);return multiple.length?multiple:[object?.region].filter(validNormalizedRegion); }

function pointInPolygon(point, polygon) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index], b = polygon[previous];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToRegion(point, region) {
  const dx = Math.max(region.x - point.x, 0, point.x - region.x - region.width);
  const dy = Math.max(region.y - point.y, 0, point.y - region.y - region.height);
  return Math.hypot(dx, dy);
}

function hitPriority(object, contained, polygonContained) {
  const kind = normalize(object.hitKind || object.metadata?.hitKind || object.type);
  if (contained) return 600;
  if (polygonContained) return 500;
  if (kind.includes('leader') || kind.includes('callout')) return 400;
  if (kind.includes('schedule')) return 300;
  if (kind.includes('symbol') || kind.includes('marker')) return 200;
  return 100;
}

export function deduplicateSelectableObjects(objects = [], { sort = true } = {}) {
  const selected = new Map();
  for (const object of list(objects)) {
    if (!object?.objectId || object.verificationState === 'rejected' || !validNormalizedRegion(object.region)) continue;
    const current = selected.get(object.objectId);
    if (!current || object.verificationState === 'confirmed' && current.verificationState !== 'confirmed' || Number(object.confidence) > Number(current.confidence)) selected.set(object.objectId, object);
  }
  const values=[...selected.values()];return sort?values.sort((a,b) => (a.region.y-b.region.y)||(a.region.x-b.region.x)||a.objectId.localeCompare(b.objectId)):values;
}

export function hitTestDrawingObjects(objects = [], point = {}, { maximumDistance = .025, visibleObjectIds = null } = {}) {
  const started = globalThis.performance?.now?.() ?? Date.now();
  const candidates = deduplicateSelectableObjects(objects,{sort:false}).filter(object => !visibleObjectIds || visibleObjectIds.has(object.objectId)).map(object => {
    const regions=objectRegions(object);const contained=regions.some(region=>point.x>=region.x&&point.x<=region.x+region.width&&point.y>=region.y&&point.y<=region.y+region.height);
    const geometryPolygons=list(object.geometry?.polygons),singlePolygon=geometryPolygons.length?[]:polygonPoints(object),polygons=geometryPolygons.length?geometryPolygons:[singlePolygon];const polygonContained=!contained&&polygons.some(polygon=>pointInPolygon(point,polygon));
    const distance=Math.min(...regions.map(region=>distanceToRegion(point,region)));
    const priority=hitPriority(object,contained,polygonContained);return { object, contained, polygonContained, distance, priority, score:priority+(object.verificationState==='confirmed'?25:0)+(Number(object.confidence)||0)*10-distance*100 };
  }).filter(item => item.contained || item.polygonContained || item.distance <= maximumDistance).sort((a,b)=>b.score-a.score||a.distance-b.distance||a.object.objectId.localeCompare(b.object.objectId));
  return { object:candidates[0]?.object||null, candidates, status:candidates.length?'selected':'empty', durationMs:Math.max(0,(globalThis.performance?.now?.()??Date.now())-started) };
}

export function updateDrawingObjectSelection(currentIds = [], objectId = '', { additive = false } = {}) {
  const current = [...new Set(list(currentIds).map(text).filter(Boolean))], id=text(objectId);
  if (!id) return [];
  if (!additive) return [id];
  return current.includes(id) ? current.filter(item=>item!==id) : [...current,id];
}

export function searchDrawingObjects(objects = [], query = '') {
  const terms=normalize(query).split(' ').filter(Boolean); if(!terms.length)return[];
  return deduplicateSelectableObjects(objects).filter(object=>{const haystack=normalize([object.label,object.tag,object.type,object.subtype,object.trade,object.system,object.roomId?`room ${object.roomId}`:'',...list(object.aliases)].join(' '));return terms.every(term=>haystack.includes(term));});
}

export function nextDrawingObject(objects = [], currentId = '', { direction = 1, type = '', matches = null } = {}) {
  const ordered=(matches||deduplicateSelectableObjects(objects)).filter(object=>!type||normalize(object.type).includes(normalize(type)));if(!ordered.length)return null;
  const current=Math.max(-1,ordered.findIndex(object=>object.objectId===currentId));const next=(current+(direction<0?-1:1)+ordered.length)%ordered.length;return ordered[next];
}

export function sharedDrawingObjectContext(objects = [], { specificationLinks = [], graphSummaries = [], pmisRecords = [] } = {}) {
  const ids=new Set(list(objects).map(item=>item.objectId));
  const intersect = (records,key) => { const groups=new Map();for(const record of list(records).filter(item=>ids.has(item.objectId))){const identity=key(record);if(!identity)continue;if(!groups.has(identity))groups.set(identity,new Map());groups.get(identity).set(record.objectId,record);}return [...groups.values()].filter(group=>group.size===ids.size).map(group=>structuredClone(group.values().next().value));};
  return { selectionCount:ids.size, sharedSpecifications:intersect(specificationLinks,item=>`${item.specificationDocumentId}:${text(item.sectionNumber).replace(/\D/g,'')}`), sharedPmis:intersect(pmisRecords,item=>item.recordId||item.id), sharedRisks:intersect(pmisRecords.filter(item=>item.type==='risk'||item.operationType==='risk'),item=>item.recordId||item.id), sharedReadiness:list(graphSummaries).length===ids.size&&list(graphSummaries).every(item=>item.readiness?.overallStatus===graphSummaries[0]?.readiness?.overallStatus)?graphSummaries[0]?.readiness||null:null };
}
