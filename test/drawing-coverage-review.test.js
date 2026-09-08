import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyDrawingCoverageCorrection, buildDrawingCoverageReview, calculateDrawingCoverage } from '../src/drawing-coverage-review.js';
import { createProjectObjectRegistry } from '../src/project-object-registry.js';

const base={projectId:'p1',documentId:'drawings',pageId:'page-1',revision:'IFC'};
const evidence=(id,text,kind='finish-tag',region={x:.1,y:.1,width:.05,height:.03})=>({evidenceId:id,text,kind,source:'drawing-observation',region,confidence:.7});
const makeObject=(overrides={})=>({objectId:'finish-p1',projectId:'p1',drawingDocumentId:'drawings',drawingPageId:'page-1',objectType:'finish',tag:'P-1',label:'Finish P-1',graphicalRegion:{x:.1,y:.1,width:.05,height:.03},sourceObservationIds:['p1-a'],verificationState:'candidate',identitySource:'parser',confidence:.7,...overrides});

test('coverage is deterministic, category-scoped, and unsupported evidence does not inflate it',()=>{
  const records=[evidence('p1-a','P-1'),evidence('room-a','124','room-number-text'),evidence('sign-a','S-2','signage')];
  const objects=[makeObject()];
  const first=calculateDrawingCoverage({evidence:records,objects});
  const second=calculateDrawingCoverage({evidence:records,objects});
  assert.deepEqual(first,second);
  assert.equal(first.overallPageCoveragePercentage,33.3);
  assert.equal(first.categoryCoverage.finishes.coveragePercentage,100);
  assert.equal(first.categoryCoverage.rooms.coveragePercentage,0);
  assert.equal(first.categoryCoverage.signage.coveragePercentage,0);
});

test('missing regions and duplicates are review work counted once',()=>{
  const objects=[makeObject({graphicalRegion:null,graphicalRegions:[]}),makeObject({objectId:'finish-p1-duplicate',graphicalRegion:{x:.2,y:.2,width:.05,height:.03},sourceObservationIds:['p1-b']})];
  const review=buildDrawingCoverageReview({...base,evidence:[evidence('p1-a','P-1'),evidence('p1-b','P-1')],objects});
  assert.equal(review.items.filter(item=>item.issueType==='possible-duplicate').length,1);
  assert.equal(review.items.filter(item=>item.issueType==='missing-region').length,1);
  assert.equal(review.metrics.duplicateCandidates,1);
  assert.equal(review.metrics.objectsWithoutRegions,1);
});

test('review queue is page-scoped, bounded, and suppresses duplicate source work',()=>{
  const repeated=[evidence('same','noise'),evidence('same','noise')];
  const review=buildDrawingCoverageReview({...base,evidence:repeated,objects:[],maxItems:1});
  assert.equal(review.items.length,1);
  assert.equal(review.items[0].pageId,'page-1');
  assert.equal(review.diagnostics.boundedItemLimit,1);
});

test('assigning evidence and a second region preserves one permanent object ID',()=>{
  const registry=createProjectObjectRegistry();
  registry.registerObject(makeObject(),{source:'parser'});
  const itemEvidence=evidence('p1-b','P-1','finish-tag',{x:.3,y:.3,width:.05,height:.03});
  const review=buildDrawingCoverageReview({...base,evidence:[itemEvidence],objects:registry.getObjectsForPage('page-1',{projectId:'p1'})});
  const assignment=review.items.find(item=>item.sourceObservationIds.includes('p1-b'));
  const result=applyDrawingCoverageCorrection({registry,review,itemId:assignment.reviewItemId,action:'assign-existing',objectId:'finish-p1'});
  assert.equal(result.object.objectId,'finish-p1');
  assert.deepEqual(result.object.sourceObservationIds.sort(),['p1-a','p1-b']);
  assert.equal(result.object.graphicalRegions.length,2);
  assert.equal(registry.getObjectsForPage('page-1',{projectId:'p1'}).length,1);
  const adjusted=applyDrawingCoverageCorrection({registry,review:{...review,items:[{...assignment,currentRegistryMatch:result.object}]},itemId:assignment.reviewItemId,action:'adjust-region',objectId:'finish-p1',region:{x:.5,y:.5,width:.1,height:.1}});
  assert.deepEqual(adjusted.object.graphicalRegions,[{x:.5,y:.5,width:.1,height:.1}]);
});

test('manual create, edit, region adjustment, confirmation, and audit survive reload persistence',async()=>{
  const stored=new Map();
  const persistence={loadObjects:async()=>[...stored.values()],loadObservations:async()=>[],putObject:async object=>stored.set(object.objectId,structuredClone(object)),putObservation:async()=>{}};
  const registry=createProjectObjectRegistry({persistence});
  const review=buildDrawingCoverageReview({...base,evidence:[evidence('fec-a','FEC','symbol',{x:.4,y:.4,width:.04,height:.05})],objects:[]});
  let result=applyDrawingCoverageCorrection({registry,review,itemId:review.items[0].reviewItemId,action:'create-object',patch:{objectType:'fire-extinguisher-cabinet',label:'FEC-2',tag:'FEC-2',trade:'Fire Protection'}});
  const objectId=result.object.objectId;
  const nextReview=buildDrawingCoverageReview({...base,evidence:[],objects:registry.getObjectsForPage('page-1',{projectId:'p1'})});
  result=applyDrawingCoverageCorrection({registry,review:{...nextReview,items:[{...review.items[0],currentRegistryMatch:result.object}]},itemId:review.items[0].reviewItemId,action:'change-label',objectId,patch:{value:'Fire Extinguisher Cabinet 2'}});
  registry.updateObject(objectId,{graphicalRegion:{x:.45,y:.45,width:.06,height:.06},graphicalRegions:[{x:.45,y:.45,width:.06,height:.06}]},{source:'manual'});
  await registry.flush();
  const restored=createProjectObjectRegistry({persistence});await restored.load('p1');
  assert.equal(restored.getObject(objectId).objectId,objectId);
  assert.equal(restored.getObject(objectId).label,'Fire Extinguisher Cabinet 2');
  assert.ok(restored.getObjectHistory(objectId).length>=2);
});

test('rejected and ignored evidence is suppressed for one revision and materially changed revisions reopen',()=>{
  const registry=createProjectObjectRegistry();
  const raw=evidence('noise-a','unclassified text');
  let review=buildDrawingCoverageReview({...base,evidence:[raw],objects:[]});
  applyDrawingCoverageCorrection({registry,review,itemId:review.items[0].reviewItemId,action:'ignore-revision'});
  const objects=registry.getObjectsForPage('page-1',{projectId:'p1',includeRejected:true});
  review=buildDrawingCoverageReview({...base,evidence:[raw],objects});
  assert.equal(review.items.length,0);
  const changed=buildDrawingCoverageReview({...base,revision:'ADD-1',evidence:[{...raw,text:'materially changed evidence'}],objects});
  assert.equal(changed.items.length,1);
});

test('short matching schedule text alone is surfaced and never forces a merge',()=>{
  const registry=createProjectObjectRegistry();registry.registerObject(makeObject(),{source:'parser'});
  const row={...evidence('schedule-p1','P-1','finish schedule'),source:'drawing-schedule-row'};
  const review=buildDrawingCoverageReview({...base,evidence:[row],objects:registry.getObjectsForPage('page-1',{projectId:'p1'})});
  assert.ok(review.items.some(item=>item.issueType==='schedule-unlinked'));
  assert.equal(registry.getObjectsForPage('page-1',{projectId:'p1'}).length,1);
});

test('room numeric evidence remains unconfirmed until manually reviewed',()=>{
  const room=makeObject({objectId:'room-124',objectType:'room',tag:'124',label:'Room 124',sourceObservationIds:['room-a'],confidence:.6});
  const review=buildDrawingCoverageReview({...base,evidence:[evidence('room-a','124','room-number-text')],objects:[room]});
  assert.ok(review.items.some(item=>item.issueType==='room-unverified'));
  assert.equal(room.verificationState,'candidate');
});

test('manual specification linking accepts only sections exposed by the existing index',()=>{
  const registry=createProjectObjectRegistry();registry.registerObject(makeObject(),{source:'parser'});
  const review={...buildDrawingCoverageReview({...base,evidence:[],objects:[makeObject()]}),items:[{reviewItemId:'spec',...base,revision:'IFC',sourceObservationIds:['p1-a'],sourceText:'P-1 paint',detectedCategory:'finishes',proposedObjectType:'finish',confidence:.8,issueType:'unmatched-spec-evidence',currentRegistryMatch:makeObject(),evidenceFingerprint:'spec'}]};
  const calls=[];const specificationLinks={link:record=>{calls.push(record);return record;}};const index={getSection:number=>number==='09 91 00'?{documentId:'specs',sectionNumber:number,sectionTitle:'Painting'}:null};
  const valid=applyDrawingCoverageCorrection({registry,specificationLinks,index,review,itemId:'spec',action:'link-specification',objectId:'finish-p1',patch:{sectionNumber:'09 91 00'}});
  const invalid=applyDrawingCoverageCorrection({registry,specificationLinks,index,review,itemId:'spec',action:'link-specification',objectId:'finish-p1',patch:{sectionNumber:'99 99 99'}});
  assert.equal(valid.status,'complete');assert.equal(invalid.status,'unavailable');assert.equal(calls.length,1);
});

test('production review uses the existing overlay, registry, graph, and specification services without PDF ownership',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/app.css',import.meta.url),'utf8');
  assert.match(app,/buildDrawingCoverageReview/);
  assert.match(app,/applyDrawingCoverageCorrection\(\{registry:projectObjectRegistry/);
  assert.match(app,/preserveProjectObjectMerge/);
  assert.match(app,/specificationLinks:drawingSpecificationLinks,index:specificationIndex/);
  assert.match(app,/mc-drawing-overlay-layer/);
  assert.match(css,/\.mc-drawing-object-overlay\.coverage-review/);
  assert.doesNotMatch(readFileSync(new URL('../src/drawing-coverage-review.js',import.meta.url),'utf8'),/openPdfBlob|renderPdfPage|PDFDocumentProxy/);
});
