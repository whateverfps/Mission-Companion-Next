import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deduplicateSelectableObjects, hitTestDrawingObjects, nextDrawingObject, objectTypeForObservation, searchDrawingObjects, sharedDrawingObjectContext, updateDrawingObjectSelection } from '../src/drawing-object-interaction.js';

const object=(objectId,x,y,extra={})=>({objectId,projectId:'p',pageId:'page',type:'finish',label:objectId,region:{x,y,width:.08,height:.05},confidence:.8,verificationState:'candidate',...extra});

test('hit testing prioritizes exact containment, polygons, drawing semantics, then nearest object',()=>{
  const nearest=object('nearest',.4,.4), polygon=object('polygon',.1,.1,{geometry:{polygon:[{x:.45,y:.45},{x:.55,y:.45},{x:.5,y:.55}]}}), contained=object('confirmed',.47,.47,{verificationState:'confirmed'});
  assert.equal(hitTestDrawingObjects([nearest,polygon,contained],{x:.5,y:.5}).object.objectId,'confirmed');
  assert.equal(hitTestDrawingObjects([polygon],{x:.5,y:.5}).object.objectId,'polygon');
  assert.equal(hitTestDrawingObjects([nearest],{x:.9,y:.9}).status,'empty');
});

test('duplicate permanent IDs collapse without merging distinct page objects',()=>{
  const duplicate=object('P-1',.1,.1), confirmed=object('P-1',.1,.1,{verificationState:'confirmed'}), separate=object('P-2',.2,.2);
  const result=deduplicateSelectableObjects([duplicate,confirmed,separate]);
  assert.equal(result.length,2); assert.equal(result.find(item=>item.objectId==='P-1').verificationState,'confirmed');
});

test('Shift selection toggles objects and blank space clears selection',()=>{
  assert.deepEqual(updateDrawingObjectSelection([], 'P-1'),['P-1']);
  assert.deepEqual(updateDrawingObjectSelection(['P-1'],'P-2',{additive:true}),['P-1','P-2']);
  assert.deepEqual(updateDrawingObjectSelection(['P-1','P-2'],'P-1',{additive:true}),['P-2']);
  assert.deepEqual(updateDrawingObjectSelection(['P-1'],'',{}),[]);
});

test('search finds labels, tags, room, trade, aliases, and navigation cycles spatially',()=>{
  const objects=[object('a',.1,.1,{label:'Finish P-1',tag:'P-1',trade:'Architectural'}),object('b',.2,.1,{label:'Door 105',type:'door',roomId:'124',aliases:['D105']}),object('c',.3,.1,{label:'FEC',type:'fire-protection-device'})];
  assert.equal(searchDrawingObjects(objects,'P-1')[0].objectId,'a'); assert.equal(searchDrawingObjects(objects,'Room 124')[0].objectId,'b'); assert.equal(searchDrawingObjects(objects,'FEC')[0].objectId,'c');
  assert.equal(nextDrawingObject(objects,'a').objectId,'b'); assert.equal(nextDrawingObject(objects,'b',{direction:-1}).objectId,'a'); assert.equal(nextDrawingObject(objects,'',{type:'door'}).objectId,'b');
});

test('multi-selection exposes only shared specifications and PMIS records',()=>{
  const objects=[object('a',.1,.1),object('b',.2,.2)];const links=[{objectId:'a',specificationDocumentId:'s',sectionNumber:'09 91 00'},{objectId:'b',specificationDocumentId:'s',sectionNumber:'09 91 00'},{objectId:'a',specificationDocumentId:'s',sectionNumber:'10 14 00'}];const pmis=[{objectId:'a',recordId:'risk-1',type:'risk'},{objectId:'b',recordId:'risk-1',type:'risk'}];
  const shared=sharedDrawingObjectContext(objects,{specificationLinks:links,pmisRecords:pmis});assert.equal(shared.selectionCount,2);assert.equal(shared.sharedSpecifications.length,1);assert.equal(shared.sharedRisks.length,1);
});

test('existing observation kinds normalize into supported registry types without inventing records',()=>{
  assert.equal(objectTypeForObservation('room-number-text'),'room');assert.equal(objectTypeForObservation('door-tag-text'),'door');assert.equal(objectTypeForObservation('finish-tag-text'),'finish');assert.equal(objectTypeForObservation('telecom-outlet-symbol'),'telecom-outlet');assert.equal(objectTypeForObservation('unknown-ocr'),'generic-drawing-object');
});

test('bounded page hit testing remains below the selection budget',()=>{
  const objects=Array.from({length:500},(_,index)=>object(`o-${index}`,(index%20)/21,(Math.floor(index/20)%20)/21));const result=hitTestDrawingObjects(objects,{x:.5,y:.5});assert.ok(result.durationMs<50,`hit test took ${result.durationMs}ms`);
});

test('production selection uses overlay state and preserves PDF rendering ownership',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');const css=fs.readFileSync(new URL('../src/app.css',import.meta.url),'utf8');
  assert.match(app,/selectedObjectIds:\[\.\.\.selectedDrawingObjectIds\]/);assert.match(app,/searchDrawingObjects\(activeDrawingObjects, drawingFilter\)/);assert.match(app,/data-drawing-object-nav/);assert.match(css,/mc-drawing-object-overlay\.selected/);
  assert.equal((app.match(/app\.addEventListener\('click', async event =>/g)||[]).length,1);
  const selection = app.slice(app.indexOf("if (button.dataset.overlayId)"), app.indexOf("if (button.hasAttribute('data-drawing-object-location')", app.indexOf("if (button.dataset.overlayId)")));
  assert.match(selection,/captureDrawingViewport\(\{selectedObjectId:selectedDrawingObject\?\.objectId\|\|null/);
  assert.match(selection,/syncDrawingOverlaySelectionState\(\)/);
  assert.match(selection,/drawingInteractionSession\.settleSoon\(\)/);
  assert.doesNotMatch(selection,/await repaintCurrentSheet\(\{ preserveSidebarScroll: true \}\);/);
  const interaction=fs.readFileSync(new URL('../src/drawing-object-interaction.js',import.meta.url),'utf8');assert.doesNotMatch(interaction,/renderPdfPage|PDFDocumentProxy|openPdfBlob|specificationIndex|createConstructionGraph/);
});
