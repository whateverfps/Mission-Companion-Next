import { validNormalizedRegion } from './drawing-object-model.js';
import { objectTypeForObservation } from './drawing-object-interaction.js';

const list=value=>Array.isArray(value)?value:[];
const text=value=>value===null||value===undefined?'':String(value).trim();
const key=value=>text(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
const perfNow = () => globalThis.performance?.now?.() ?? Date.now();
const diagnosticsEnabled = globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED === true;
const logSlowOperation = (name, startedAt, details = {}) => {
  if (!diagnosticsEnabled) return Math.max(0, perfNow() - startedAt);
  const elapsed = Math.max(0, perfNow() - startedAt);
  if (elapsed > 10) console.warn(name, elapsed, { ...details, stack: new Error().stack });
  return elapsed;
};
const hash=value=>{let output=2166136261;for(const character of String(value)){output^=character.charCodeAt(0);output=Math.imul(output,16777619);}return(output>>>0).toString(36);};
const rectanglePolygon=region=>validNormalizedRegion(region)?[{x:region.x,y:region.y},{x:region.x+region.width,y:region.y},{x:region.x+region.width,y:region.y+region.height},{x:region.x,y:region.y+region.height}]:[];
const center=region=>validNormalizedRegion(region)?{x:region.x+region.width/2,y:region.y+region.height/2}:null;
const diagnosticCategory=type=>type==='room'?'Rooms':['equipment','diffuser','panel','telecom-outlet','fire-protection-device','fire-extinguisher-cabinet'].includes(type)?'Equipment':type==='finish'?'Finishes':type==='door'?'Doors':type==='window'?'Windows':type==='schedule-entry'?'Schedules':['callout','detail-reference','keynote'].includes(type)?'Callouts':'Symbols';
const enrichmentCache = new Map();
const ENRICHMENT_CACHE_LIMIT = 12;

const PATTERNS = [
  {type:'room',subtype:'Room',pattern:/^(?:ROOM\s*)?(\d{2,5}[A-Z]?)$/i,kinds:/room/i,trade:'General'},
  {type:'finish',subtype:'Paint Finish',pattern:/^(P[- ]?\d+[A-Z]?)$/i,trade:'Architectural'},
  {type:'finish',subtype:'Resilient Base',pattern:/^(?:RB|BASE)[- ]?\d+[A-Z]?$/i,trade:'Architectural'},
  {type:'finish',subtype:'Floor Finish',pattern:/^(?:LVT|VCT|FT|FLOOR)[- ]?\d+[A-Z]?$/i,trade:'Architectural'},
  {type:'finish',subtype:'Ceiling Finish',pattern:/^(?:ACT|CT|CEILING)[- ]?\d+[A-Z]?$/i,trade:'Architectural'},
  {type:'signage',subtype:'Sign',pattern:/^(?:SIGN\s*)?S[- ]?\d+[A-Z]?$/i,trade:'Architectural'},
  {type:'fire-extinguisher-cabinet',subtype:'Fire Extinguisher Cabinet',pattern:/^(?:FEC|FIRE EXTINGUISHER CABINET)(?:[- ]?\d+[A-Z]?)?$/i,trade:'Fire Protection'},
  {type:'fire-protection-device',subtype:'Fire Extinguisher',pattern:/^(?:FE|FIRE EXTINGUISHER)[- ]?\d*[A-Z]?$/i,trade:'Fire Protection'},
  {type:'door',subtype:'Door',pattern:/^(?:DOOR\s*)?[A-Z]?\d{2,5}[A-Z]?$/i,kinds:/door/i,trade:'Architectural'},
  {type:'window',subtype:'Window',pattern:/^(?:WINDOW\s*)?W[- ]?\d+[A-Z]?$/i,trade:'Architectural'},
  {type:'wall',subtype:'Wall Type',pattern:/^(?:WALL\s*(?:TYPE)?\s*)?W[- ]?\d+[A-Z]?$/i,trade:'Architectural'},
  {type:'diffuser',subtype:'Diffuser or Grille',pattern:/^(?:D|GR|RG|SG)[- ]?\d+[A-Z]?$/i,kinds:/diffuser|grille/i,trade:'Mechanical'},
  {type:'equipment',subtype:'Thermostat',pattern:/^(?:TSTAT|THERMOSTAT|TS)[- ]?\d*[A-Z]?$/i,trade:'Mechanical'},
  {type:'telecom-outlet',subtype:'Telecommunications Outlet',pattern:/^(?:DATA|VOICE|TO|WA|4A)[- ]?\d*[A-Z]?$/i,kinds:/telecom|data|outlet/i,trade:'Communications'},
  {type:'panel',subtype:'Electrical Panel',pattern:/^(?:PANEL\s*)?[A-Z]{1,4}P?[- ]?\d+[A-Z-]*$/i,kinds:/panel/i,trade:'Electrical'},
  {type:'equipment',subtype:'Equipment Tag',pattern:/^(?:AHU|RTU|VAV|FCU|CU|EF|SF|HP|P|XFMR|UPS|RACK|FACP|FAAP|TGB|TMGB|CUH|UH)[- ]?\d+[A-Z]?$/i,trade:'Unknown'},
  {type:'callout',subtype:'Detail Callout',pattern:/^\d{1,3}[A-Z]?\s*\/\s*[A-Z]{1,4}[-.]?\d{2,4}[A-Z]?$/i,trade:'General'},
  {type:'keynote',subtype:'Keynote',pattern:/^(?:KEYNOTE|NOTE)\s*\d{1,3}[A-Z]?$/i,trade:'General'},
  {type:'generic-drawing-object',subtype:'Grid Reference',pattern:/^(?:GRID\s*)?[A-Z]{1,2}|\d{1,3}$/i,kinds:/grid/i,trade:'General'},
  {type:'generic-drawing-object',subtype:'Dimension',pattern:/^\d+(?:[-' ]\d+)?(?:"|')$/i,kinds:/dimension/i,trade:'General'}
];

function classification(value,kind='') {
  const label=text(value), sourceKind=text(kind);
  for(const rule of PATTERNS){if(rule.kinds&&!rule.kinds.test(sourceKind))continue;if(rule.pattern.test(label))return{...rule,tag:label,label};}
  const mapped=objectTypeForObservation(sourceKind,'generic-drawing-object');
  if(mapped!=='generic-drawing-object'&&label)return{type:mapped,subtype:sourceKind.replace(/[-_]/g,' '),tag:label,label,trade:'Unknown'};
  return null;
}

function scheduleRegion(row) {
  const regions=list(row?.cells).map(cell=>cell.sourceRegion).filter(validNormalizedRegion);if(!regions.length)return null;
  const x=Math.min(...regions.map(item=>item.x)),y=Math.min(...regions.map(item=>item.y)),right=Math.max(...regions.map(item=>item.x+item.width)),bottom=Math.max(...regions.map(item=>item.y+item.height));return{x,y,width:right-x,height:bottom-y};
}

export function collectPageObjectEvidence({ observations=[],schedules=[],legends=[],occurrences=[],keyedNotes=[] }={}) {
  const startedAt = perfNow();
  const evidence=[];
  const legendEntries=new Map(list(legends).flatMap(legend=>list(legend.entries)).map(entry=>[entry.legendEntryId,entry]));
  let observationCount = 0;
  for(const item of list(observations)) { observationCount += 1; if(validNormalizedRegion(item.region)) evidence.push({evidenceId:item.observationId,source:'drawing-observation',kind:item.kind,text:item.value||item.text,region:item.region,confidence:Number(item.confidence)||.5,verificationState:item.verification?.status}); }
  logSlowOperation('object evidence observations', startedAt, { iterationCount: observationCount, evidenceCount: evidence.length });
  let scheduleCount = 0;
  for(const schedule of list(schedules)) for(const row of list(schedule.rows)){ scheduleCount += 1; const region=scheduleRegion(row);if(!region)continue;const tagCell=list(row.cells).find(cell=>cell.columnId===schedule.tagColumn)||row.cells[0];evidence.push({evidenceId:`${schedule.scheduleId}:${row.rowId}`,source:'drawing-schedule-row',kind:`${schedule.title} schedule`,text:tagCell?.rawText||'',contextText:list(row.cells).map(cell=>cell.rawText).join(' '),region,confidence:schedule.verification?.status==='Confirmed'?.95:.7,verificationState:schedule.verification?.status,scheduleId:schedule.scheduleId,rowId:row.rowId});}
  logSlowOperation('object evidence schedules', startedAt, { iterationCount: scheduleCount, evidenceCount: evidence.length });
  let legendCount = 0;
  for(const legend of list(legends)) for(const entry of list(legend.entries)) { legendCount += 1; if(validNormalizedRegion(entry.symbolRegion)) evidence.push({evidenceId:entry.legendEntryId,source:'drawing-legend',kind:legend.legendTitle||'legend',text:entry.abbreviation||entry.label,contextText:entry.description,region:entry.symbolRegion,confidence:Number(entry.confidence)||.5,verificationState:entry.verification?.status,legendId:legend.legendId}); }
  logSlowOperation('object evidence legends', startedAt, { iterationCount: legendCount, evidenceCount: evidence.length });
  let occurrenceCount = 0;
  for(const item of list(occurrences)) { occurrenceCount += 1; if(validNormalizedRegion(item.region)){const legendEntry=legendEntries.get(item.legendEntryId);evidence.push({evidenceId:item.occurrenceId,source:'drawing-symbol-occurrence',kind:item.type||item.subtype||legendEntry?.description||'symbol',text:item.label||item.nearbyText||legendEntry?.abbreviation||legendEntry?.label||item.symbolFingerprint,contextText:legendEntry?.description||item.nearbyText,region:item.region,confidence:Number(item.confidence||item.matchScore)||.5,verificationState:item.verification?.status,legendEntryId:item.legendEntryId});}}
  logSlowOperation('object evidence occurrences', startedAt, { iterationCount: occurrenceCount, evidenceCount: evidence.length });
  let keyedNoteCount = 0;
  for(const item of list(keyedNotes)) { keyedNoteCount += 1; if(validNormalizedRegion(item.region)) evidence.push({evidenceId:item.keyedNoteOccurrenceId||item.observationId,source:'keyed-note',kind:'keynote',text:item.identifier||item.text,contextText:item.noteText,region:item.region,confidence:Number(item.confidence)||.7,verificationState:item.verification?.status}); }
  logSlowOperation('object evidence keyed notes', startedAt, { iterationCount: keyedNoteCount, evidenceCount: evidence.length });
  return evidence;
}

export function enrichPageConstructionObjects(input={}) {
  const cacheKey = text(input.cacheKey);
  const onMetric = typeof input.onMetric === 'function' ? input.onMetric : () => {};
  if (cacheKey && enrichmentCache.has(cacheKey)) {
    const cached = enrichmentCache.get(cacheKey);
    onMetric({ operation: 'object-enrichment-cache-hit', durationMs: 0, evidenceCount: cached.diagnostics.evidenceCount, objectsDiscovered: cached.diagnostics.objectsDiscovered });
    return structuredClone(cached);
  }
  const started=globalThis.performance?.now?.()??Date.now(), evidence=collectPageObjectEvidence(input), groups=new Map(), unsupported=[];
  const classifyStartedAt = perfNow();
  let classificationCount = 0;
  for(const item of evidence){classificationCount += 1; const resolved=classification(item.text,item.kind);if(!resolved){unsupported.push(item);continue;}const identity=key(resolved.tag);if(!identity){unsupported.push(item);continue;}const clusterKey=`${resolved.type}:${identity}`;if(!groups.has(clusterKey))groups.set(clusterKey,{...resolved,evidence:[],regions:[]});const group=groups.get(clusterKey);group.evidence.push(item);group.regions.push(item.region);}
  logSlowOperation('object classification', classifyStartedAt, { iterationCount: classificationCount, evidenceCount: evidence.length, unsupportedCount: unsupported.length });
  const objects=[...groups.values()].map(group=>{const regions=[...new Map(group.regions.map(item=>[[item.x,item.y,item.width,item.height].join(':'),item])).values()];const primary=regions.sort((a,b)=>b.width*b.height-a.width*a.height)[0];const confidence=Math.min(.98,Math.max(...group.evidence.map(item=>item.confidence))+.03*Math.max(0,group.evidence.length-1));return{projectId:text(input.projectId),drawingDocumentId:text(input.documentId),drawingPageId:text(input.pageId),objectType:group.type,objectSubtype:group.subtype,trade:group.trade,tag:group.tag,label:group.label,normalizedKey:key(group.tag),graphicalRegion:primary,graphicalRegions:regions,geometry:{type:'multi-region',polygons:regions.map(rectanglePolygon),centers:regions.map(center),viewportAnchors:regions.map(center)},sourceObservationIds:group.evidence.map(item=>item.evidenceId),sourceText:group.evidence.map(item=>item.contextText||item.text).filter(Boolean).join(' · '),aliases:[...new Set(group.evidence.map(item=>item.text).filter(Boolean))],verificationState:group.evidence.some(item=>item.verificationState==='Confirmed')?'confirmed':'candidate',identitySource:group.evidence.some(item=>item.source==='drawing-schedule-row')?'schedule':'parser',confidence,evidence:group.evidence.map(item=>({observationId:item.evidenceId,source:item.source,text:item.contextText||item.text,region:item.region,scheduleId:item.scheduleId,rowId:item.rowId,legendId:item.legendId}))};});
  const categoriesStartedAt = perfNow();
  const categoryCounts=Object.fromEntries(['Rooms','Equipment','Finishes','Doors','Windows','Schedules','Callouts','Symbols'].map(category=>[category,0]));let categoryCount = 0;for(const object of objects){categoryCount += 1;categoryCounts[diagnosticCategory(object.objectType)]+=1;}
  logSlowOperation('object category counts', categoriesStartedAt, { iterationCount: categoryCount, objectCount: objects.length });
  const roomEvidence=evidence.filter(item=>/room[-_ ]?(?:number|tag)/i.test(item.kind)),scheduleEvidence=evidence.filter(item=>item.source==='drawing-schedule-row');
  const output = {objects,unsupported,evidence,diagnostics:{evidenceCount:evidence.length,supportedEvidenceCount:evidence.length-unsupported.length,objectsDiscovered:objects.length,objectsWithRegions:objects.filter(item=>item.graphicalRegions.length).length,objectsWithoutRegions:objects.filter(item=>!item.graphicalRegions.length).length,duplicateCandidates:[...groups.values()].reduce((sum,item)=>sum+Math.max(0,item.evidence.length-1),0),unsupportedObservations:unsupported.length,coveragePercent:evidence.length?Math.round((evidence.length-unsupported.length)/evidence.length*1000)/10:0,coverageByCategory:categoryCounts,roomCompleteness:roomEvidence.length?Math.round(objects.filter(item=>item.objectType==='room').length/roomEvidence.length*1000)/10:null,scheduleCompleteness:scheduleEvidence.length?Math.round(scheduleEvidence.filter(item=>!unsupported.includes(item)).length/scheduleEvidence.length*1000)/10:null,durationMs:Math.max(0,(globalThis.performance?.now?.()??Date.now())-started)}};
  if (cacheKey) {
    enrichmentCache.set(cacheKey, structuredClone(output));
    if (enrichmentCache.size > ENRICHMENT_CACHE_LIMIT) enrichmentCache.delete(enrichmentCache.keys().next().value);
  }
  onMetric({ operation: 'object-enrichment', durationMs: output.diagnostics.durationMs, evidenceCount: output.diagnostics.evidenceCount, objectsDiscovered: output.diagnostics.objectsDiscovered });
  return output;
}

export function applyPageObjectEnrichment(registry,result={}) {
  const startedAt = perfNow();
  const promoted=[],rejected=[];
  let candidateCount = 0;
  for(const candidate of list(result.objects)){candidateCount += 1;let object=registry.resolveObject?.({projectId:candidate.projectId,pageId:candidate.drawingPageId,tag:candidate.tag});if(object&&object.objectType!==candidate.objectType)object=null;if(object?.verificationState==='rejected'){rejected.push(object.objectId);continue;}if(object){const currentEvidence=new Set(list(object.sourceObservationIds)),currentRegions=new Set(list(object.graphicalRegions).map(item=>[item.x,item.y,item.width,item.height].join(':'))),candidateRegions=candidate.graphicalRegions.map(item=>[item.x,item.y,item.width,item.height].join(':'));const unchanged=candidate.sourceObservationIds.every(id=>currentEvidence.has(id))&&candidateRegions.every(value=>currentRegions.has(value));if(!unchanged)object=registry.updateObject(object.objectId,{sourceObservationIds:[...currentEvidence,...candidate.sourceObservationIds],graphicalRegions:[...list(object.graphicalRegions),...candidate.graphicalRegions],geometry:candidate.geometry,evidence:[...list(object.evidence),...candidate.evidence],confidence:Math.max(object.confidence,candidate.confidence),aliases:[...list(object.aliases),...candidate.aliases]},{source:'parser',note:'Existing extracted evidence enriched graphical coverage.'});}else object=registry.registerObject(candidate,{source:candidate.identitySource,note:'Promoted from existing extracted page evidence.'});if(object)promoted.push(object);}
  logSlowOperation('apply page object enrichment', startedAt, { iterationCount: candidateCount, promotedCount: promoted.length, rejectedCount: rejected.length });
  return{objects:promoted,rejected,diagnostics:{...result.diagnostics,objectsPromoted:promoted.length,objectsRejected:rejected.length,duplicateSuppression:Math.max(0,result.objects?.length-promoted.length-rejected.length)}};
}

export function relatedObjectIdsForSelection(selectedObject,objects=[]) {
  if(!selectedObject)return[];const regions=list(selectedObject.graphicalRegions).length?selectedObject.graphicalRegions:[selectedObject.graphicalRegion].filter(Boolean);const contains=object=>{const point=center(object.graphicalRegion);return point&&regions.some(region=>point.x>=region.x&&point.x<=region.x+region.width&&point.y>=region.y&&point.y<=region.y+region.height);};
  return list(objects).filter(object=>object.objectId!==selectedObject.objectId&&(selectedObject.objectType==='room'?(object.roomId&&object.roomId===selectedObject.roomId)||contains(object):object.objectType==='room'&&((selectedObject.roomId&&object.roomId===selectedObject.roomId)||contains(selectedObject))||selectedObject.normalizedKey&&object.normalizedKey===selectedObject.normalizedKey)).map(object=>object.objectId);
}
