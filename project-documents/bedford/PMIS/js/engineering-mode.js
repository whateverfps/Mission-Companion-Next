function splitBullets(text, maxItems=6){
  const raw = String(text || '').replace(/\r/g,'').trim();
  if(!raw) return [];
  return raw.split(/\n+|(?=•\s+)/).map(x=>x.replace(/^•\s*/,'').trim()).filter(Boolean).slice(0,maxItems);
}
function selectedDriverList(fieldName, fallbackCount, emptyText){
  const b = selectedBuilding() || {};
  const notes = b.tradeNotes || {};
  let source = notes[fieldName] || '';
  const items = splitBullets(source, 6);
  if(items.length){
    return items.map(item=>`<li>${esc(item)}</li>`).join('');
  }
  const count = Number(b[fallbackCount]) || 0;
  if(count > 0){
    const blocker = b['Major Blocker'] || b['Next Action'] || b.action?.['Why Summary'] || 'Driver detail is not mapped in the current workbook snapshot.';
    return `<li>${esc(blocker)}</li>`;
  }
  return `<li class="eng-muted">${esc(emptyText)}</li>`;
}
function selectedTradeFocus(){
  const b = selectedBuilding() || {};
  const trades = [
    ['Fire', b['Fire Protection'] || b['Fire Alarm']],
    ['HVAC', b['HVAC']],
    ['Electrical', b['Electrical']],
    ['Telecom', b['Telecom']],
    ['Security', b['Security']]
  ];
  return trades.map(([name,status])=>{
    const clean = cleanStatus ? cleanStatus(status) : String(status||'N/A');
    const tone = statusTone ? statusTone(clean) : 'watch';
    return `<div class="eng-trade ${tone}"><span>${esc(name)}</span><strong>${esc(clean)}</strong></div>`;
  }).join('');
}
function engineeringBriefText(){
  const b=selectedBuilding()||{};
  const risks = splitBullets((b.tradeNotes||{})['Owner Risks'], 4).map(x=>`- ${x}`).join('\n') || '- No selected-building risk driver detail mapped.';
  const questions = splitBullets((b.tradeNotes||{})['Open Questions'], 4).map(x=>`- ${x}`).join('\n') || '- No selected-building question driver detail mapped.';
  return `Mission PMIS Engineering Brief\n${window.missionProjectLabel?.()||'Loaded Project Workbook'}\nGenerated: ${new Date().toLocaleString()}\n\nSelected Building: ${reportBuildingLabel(b)}\nReadiness: ${pct(b.readinessPct||0)}%\nConstruction Ready: ${b['Construction Ready']||'No'}\nAcceptance: ${b['Acceptance Status']||'Monitor'}\nRisks: ${b['Open Risks']||0}\nQuestions: ${b['Open Questions']||0}\nShutdowns: ${b['Shutdowns']||0}\n\nSelected-Building Risk Drivers:\n${risks}\n\nSelected-Building Question Drivers:\n${questions}\n\nEngineering Focus:\n- Verify selected building conditions against the assessment sheet.\n- Confirm field constraints, shutdown/access needs, and trade coordination.\n- Use the engineering plan as a reference layer; Excel remains the source of truth.`;
}
function renderEngineeringMode(){
  const b=selectedBuilding()||{};
  const el=document.getElementById('engineeringContent'); if(!el) return;
  const status = b['Overall Status'] || b['Dashboard Signal'] || 'Monitor';
  const action = b.action?.['Next Action'] || b['Next Action'] || 'Maintain monitoring.';
  el.innerHTML=`
  <div class="engineering-grid engineering-grid-clean">
    <div class="engineering-plan-card">
      <div class="eng-plan-header">
        <div>
          <span class="eyebrow">Engineering Drawing Viewer</span>
          <h3>Site Features / Engineering Reference Plan</h3>
        </div>
        <div class="eng-plan-tools">
          <button class="meeting-btn" type="button" onclick="engineeringFitPlan()">Fit</button>
          <button class="meeting-btn" type="button" onclick="engineeringZoomPlan(1.12)">Zoom +</button>
          <button class="meeting-btn" type="button" onclick="engineeringZoomPlan(.88)">Zoom −</button>
        </div>
      </div>
      <div class="engineering-plan landscape" id="engineeringPlanViewport">
        <img id="engineeringPlanImage" src="assets/engineering_site_plan_landscape.png" alt="Engineering site plan reference layer rotated landscape">
      </div>
    </div>
    <div class="engineering-side engineering-side-clean">
      <div class="eng-card eng-selected">
        <div class="eng-card-head"><span>Selected Building</span><strong>${esc(reportBuildingLabel(b))}</strong></div>
        <div class="eng-status-line"><b>${pct(b.readinessPct||0)}%</b><span>${esc(status)}</span></div>
        <div class="eng-mini-grid">
          <div class="eng-mini"><span>Risks</span><strong>${esc(b['Open Risks']||0)}</strong></div>
          <div class="eng-mini"><span>Questions</span><strong>${esc(b['Open Questions']||0)}</strong></div>
          <div class="eng-mini"><span>Shutdowns</span><strong>${esc(b['Shutdowns']||0)}</strong></div>
        </div>
      </div>
      <div class="eng-card">
        <div class="eng-card-head"><span>Trade Readiness</span><strong>Selected Building</strong></div>
        <div class="eng-trade-grid">${selectedTradeFocus()}</div>
      </div>
      <div class="eng-card">
        <div class="eng-card-head"><span>Risk Drivers</span><strong>${esc(reportBuildingLabel(b))}</strong></div>
        <ul class="eng-driver-list">${selectedDriverList('Owner Risks','Open Risks','No selected-building risk drivers mapped in the workbook snapshot.')}</ul>
      </div>
      <div class="eng-card">
        <div class="eng-card-head"><span>Question Drivers</span><strong>${esc(reportBuildingLabel(b))}</strong></div>
        <ul class="eng-driver-list">${selectedDriverList('Open Questions','Open Questions','No selected-building question drivers mapped in the workbook snapshot.')}</ul>
      </div>
      <div class="eng-card eng-focus">
        <div class="eng-card-head"><span>Engineering Focus</span><strong>Next Action</strong></div>
        <p class="eng-note">${esc(action)}</p>
        <div class="eng-checks"><span>Verify field condition</span><span>Confirm shutdown/access impacts</span><span>Coordinate OIT/trade constraints</span></div>
      </div>
    </div>
  </div>`;
  engineeringFitPlan();
}
let engineeringScale = 1;
function engineeringFitPlan(){
  engineeringScale = 1;
  const img=document.getElementById('engineeringPlanImage');
  if(img){ img.style.transform='scale(1)'; img.style.transformOrigin='center center'; }
}
function engineeringZoomPlan(factor){
  const img=document.getElementById('engineeringPlanImage'); if(!img) return;
  engineeringScale = Math.max(.6, Math.min(2.5, engineeringScale * factor));
  img.style.transform = `scale(${engineeringScale})`;
  img.style.transformOrigin = 'center center';
}
function openEngineeringMode(){renderEngineeringMode(); document.getElementById('engineeringOverlay')?.classList.add('show');}
function closeEngineeringMode(){document.getElementById('engineeringOverlay')?.classList.remove('show');}
async function copyEngineeringBrief(){
  const txt=engineeringBriefText();
  try{await navigator.clipboard.writeText(txt);}catch(e){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
}
const engineeringOverlay=document.getElementById('engineeringOverlay'); if(engineeringOverlay) engineeringOverlay.addEventListener('click',e=>{if(e.target===engineeringOverlay) closeEngineeringMode();});
document.addEventListener('keydown',e=>{if(e.key==='Escape') closeEngineeringMode();});
const renderAll_105 = renderAll;
renderAll = function(reset=true){ renderAll_105(reset); if(document.getElementById('engineeringOverlay')?.classList.contains('show')) renderEngineeringMode(); };
