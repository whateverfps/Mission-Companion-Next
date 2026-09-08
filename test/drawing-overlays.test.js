import test from 'node:test';
import assert from 'node:assert/strict';

const previousDiagnosticsFlag = globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED;
globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED = true;
const { createDrawingOverlay, overlayStyle, transformOverlayRegion, visibleDrawingOverlays } = await import('../src/drawing-overlays.js?diagnostics=enabled');
globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED = previousDiagnosticsFlag;

const overlay = { overlayId: 'o1', projectId: 'p', documentId: 'd', pageId: 'page-1', type: 'rooms', region: { x: .1, y: .2, width: .3, height: .1 }, label: 'Room 127B' };
const withDiagnostics = callback => {
  const previousFlag = globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED;
  globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED = true;
  try {
    return callback();
  } finally {
    globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED = previousFlag;
  }
};
test('overlay contract requires page ownership and normalized geometry', () => {
  assert.ok(createDrawingOverlay(overlay));
  assert.equal(createDrawingOverlay({ ...overlay, pageId: '' }), null);
  assert.equal(visibleDrawingOverlays([overlay], { projectId: 'p', documentId: 'd', pageId: 'page-2' }).length, 0);
});
test('visibility and rotation alignment are independent of PDF rendering', () => {
  assert.equal(visibleDrawingOverlays([overlay], { projectId: 'p', documentId: 'd', pageId: 'page-1', visibility: { rooms: false } }).length, 0);
  const rotated = transformOverlayRegion(overlay.region, 90);
  assert.ok(Math.abs(rotated.x - .7) < Number.EPSILON * 2);
  assert.deepEqual({ y: rotated.y, width: rotated.width, height: rotated.height }, { y: .1, width: .1, height: .3 });
  assert.equal(overlayStyle({ region: overlay.region }).left, '10%');
});
test('ordinary telecom view suppresses candidate floods while preserving selected and confirmed overlays',()=>withDiagnostics(()=>{const records=[...Array.from({length:400},(_,index)=>({...overlay,overlayId:`candidate-${index}`,type:'candidates',verificationState:'candidate',confidence:.4,region:{x:(index%20)/20,y:(index%10)/10,width:.03,height:.03}})),{...overlay,overlayId:'confirmed',type:'confirmed',verificationState:'confirmed'},{...overlay,overlayId:'selected',type:'selected',verificationState:'confirmed'}];const visible=visibleDrawingOverlays(records,{projectId:'p',documentId:'d',pageId:'page-1',visibility:{candidates:false}});assert.deepEqual(visible.map(item=>item.overlayId),['selected','confirmed']);}));
test('explicit candidate visibility remains confidence-prioritized and page-bounded',()=>withDiagnostics(()=>{const records=Array.from({length:300},(_,index)=>({...overlay,overlayId:`candidate-${index}`,label:`Candidate ${index}`,type:'candidates',verificationState:'candidate',confidence:index%2?.9:.4,region:{x:(index%20)/20,y:(index%10)/10,width:.01,height:.01}}));const visible=visibleDrawingOverlays(records,{projectId:'p',documentId:'d',pageId:'page-1',visibility:{candidates:true}});assert.equal(visible.length,120);assert.ok(visible.every(item=>item.confidence>=.75));}));
test('review mode reveals bounded candidates, consolidates duplicate regions, and rejects oversized evidence',()=>withDiagnostics(()=>{const duplicate={...overlay,overlayId:'candidate',type:'candidates',verificationState:'candidate',region:{x:.1,y:.1,width:.02,height:.02}};const visible=visibleDrawingOverlays([duplicate,{...duplicate,overlayId:'same-evidence',region:{x:.1001,y:.1001,width:.0201,height:.0201}},{...duplicate,overlayId:'oversized',region:{x:0,y:0,width:.8,height:.8}},...Array.from({length:200},(_,index)=>({...duplicate,overlayId:`c-${index}`,label:`candidate ${index}`,region:{x:(index%20)/20,y:(index%10)/10,width:.01,height:.01}}))],{projectId:'p',documentId:'d',pageId:'page-1',visibility:{candidates:false},reviewMode:true,maxVisible:40});assert.equal(visible.length,40);assert.ok(visible.every(item=>item.type==='candidates'));}));
test('offscreen overlays stay unmounted while selected and confirmed overlays remain visible',()=>{const records=[{...overlay,overlayId:'offscreen-candidate',type:'candidates',verificationState:'candidate',region:{x:.85,y:.85,width:.04,height:.04},confidence:.9},{...overlay,overlayId:'offscreen-confirmed',type:'confirmed',verificationState:'confirmed',region:{x:.86,y:.86,width:.03,height:.03}},{...overlay,overlayId:'selected',type:'selected',verificationState:'candidate',region:{x:.88,y:.88,width:.02,height:.02}}];const visible=visibleDrawingOverlays(records,{projectId:'p',documentId:'d',pageId:'page-1',viewportRegion:{x:0,y:0,width:.25,height:.25}});assert.deepEqual(visible.map(item=>item.overlayId),['selected','offscreen-confirmed']);});
