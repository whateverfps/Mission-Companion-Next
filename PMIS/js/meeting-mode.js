function execLabel(b){ return reportBuildingLabel(b||{}); }
function execStatusSummary(b){
  const risks=num(b['Open Risks']), questions=num(b['Open Questions']), r=pct(b.readinessPct||0);
  if(risks>=8 || r<55) return ['red','Executive Attention Required','Critical building condition or low readiness requires leadership awareness.'];
  if(risks>=4 || questions>=6 || r<80) return ['yellow','On Track With Actions','Progress can continue, but decisions/coordination are needed to protect schedule.'];
  return ['green','Ready To Proceed','No major executive blocker is currently elevated for the selected building.'];
}
function execCampusStatus(){
  const s=data.stats||{};
  const critical=[...data.buildings].filter(b=>statusClass(b)==='critical').length;
  const watch=[...data.buildings].filter(b=>statusClass(b)==='warn').length;
  return {total:s.total||0, ready:s.ready||0, watch, critical, avg:pct(s.avgReadiness||0), risks:Math.round(s.risks||0), questions:Math.round(s.questions||0)};
}
function executiveBlockers(b){
  const blockers=[];
  const r=pct(b.readinessPct||0);
  if(r<80) blockers.push(`Readiness remains below target at ${r}%`);
  if(num(b['Open Risks'])>0) blockers.push(`${b['Open Risks']} open risk${num(b['Open Risks'])===1?'':'s'} require owner awareness`);
  if(num(b['Open Questions'])>0) blockers.push(`${b['Open Questions']} open question${num(b['Open Questions'])===1?'':'s'} require resolution`);
  const oit=valueText(b['OIT Status']||b['OIT Readiness'],'');
  if(oit && !/pass|ready|complete|compliant/i.test(oit)) blockers.push(`OIT readiness: ${oit}`);
  const acceptance=valueText(b['Acceptance Status']||b['Acceptance Readiness'],'');
  if(acceptance && !/ready|complete|pass|accepted/i.test(acceptance)) blockers.push(`Owner acceptance: ${acceptance}`);
  const major=valueText(b['Major Blocker'],'');
  if(major) blockers.push(major);
  return blockers.length?blockers.slice(0,5):['No executive-level blocker currently elevated for this building.'];
}
function executiveActions(b){
  const actions=[];
  const next=valueText(b['Next Action'],'');
  if(next) actions.push(next);
  if(num(b['Open Risks'])>0) actions.push('Confirm risk owner and mitigation path.');
  if(num(b['Open Questions'])>0) actions.push('Resolve open questions blocking acceptance or field progress.');
  if(!/yes|ready|complete|pass/i.test(valueText(b['Construction Ready'],''))) actions.push('Confirm construction readiness gate.');
  if(!/ready|complete|pass|accepted/i.test(valueText(b['Acceptance Status'],''))) actions.push('Schedule or confirm owner acceptance review.');
  const unique=[...new Set(actions)].filter(Boolean);
  return unique.length?unique.slice(0,5):['Maintain monitoring and continue normal inspection rhythm.'];
}
function tradeWatchRows(b){
  const rows=[
    ['Fire', firstVal(b,['Fire Protection','Fire Alarm','Fire'],'PASS'), 'fire'],
    ['HVAC', firstVal(b,['HVAC','Mechanical','HVAC / Cooling'],'PASS'), 'hvac'],
    ['Electrical', firstVal(b,['Electrical','Electrical / UPS'],'PASS'), 'electrical'],
    ['Telecom', firstVal(b,['Telecom','Telecom / Fiber','OIT'],'PASS'), 'telecom'],
    ['Security', firstVal(b,['Security','Security / PACS / CCTV'],'PASS'), 'security']
  ];
  return rows.map(([label,val,cls])=>{
    const n=healthPct(val);
    const state=n>=90?'Clear':n>=60?'Watch':'Action';
    return `<div class="exec-trade-row"><span class="trade-dot ${cls}"></span><b>${esc(label)}</b><div class="exec-trade-bar ${cls}"><i style="width:${n}%"></i></div><strong>${state}</strong></div>`;
  }).join('');
}
function executiveForecast(b){
  const r=pct(b.readinessPct||0), risks=num(b['Open Risks']), qs=num(b['Open Questions']);
  const confidence=Math.max(0,Math.min(100,Math.round(r - Math.min(risks,10)*2 - Math.min(qs,10))));
  let trend='Proceed with monitoring';
  if(confidence<55) trend='Hold for corrective action';
  else if(confidence<80) trend='Proceed with conditions';
  return {confidence,trend};
}
function meetingBriefText(){
  const c=execCampusStatus(); const b=selectedBuilding()||{}; const [tone,headline]=execStatusSummary(b); const forecast=executiveForecast(b);
  return `Mission PMIS Executive Brief\n${window.missionProjectLabel?.()||'Loaded Project Workbook'}\nGenerated: ${new Date().toLocaleString()}\n\nMission Status: ${headline}\nCampus Readiness: ${c.avg}%\nBuildings: ${c.total} tracked | ${c.ready} ready | ${c.watch} watch | ${c.critical} critical\nOpen Risks: ${c.risks}\nOpen Questions: ${c.questions}\n\nSelected Building: ${execLabel(b)}\nReadiness: ${pct(b.readinessPct||0)}%\nRisks: ${b['Open Risks']||0}\nQuestions: ${b['Open Questions']||0}\nForecast: ${forecast.confidence}% confidence — ${forecast.trend}\n\nReadiness Blockers:\n- ${executiveBlockers(b).join('\n- ')}\n\nExecutive Actions:\n- ${executiveActions(b).join('\n- ')}`;
}
function renderMeetingMode(){
  const c=execCampusStatus(); const b=selectedBuilding()||{}; const [tone,headline,subline]=execStatusSummary(b); const forecast=executiveForecast(b);
  const el=document.getElementById('meetingContent'); if(!el) return;
  const blockers=executiveBlockers(b).map(x=>`<li>${esc(x)}</li>`).join('');
  const actions=executiveActions(b).map(x=>`<li>${esc(x)}</li>`).join('');
  el.innerHTML=`
    <div class="exec-hero ${tone}">
      <div><div class="mini">Executive Meeting Mode</div><h2>${esc(headline)}</h2><p>${esc(subline)}</p></div>
      <div class="exec-hero-score"><span>Selected</span><strong>${esc(execLabel(b))}</strong><em>${pct(b.readinessPct||0)}%</em></div>
    </div>
    <div class="exec-strip">
      <div><span>Campus Readiness</span><strong>${c.avg}%</strong></div>
      <div><span>Buildings</span><strong>${c.total}</strong></div>
      <div><span>Ready</span><strong>${c.ready}</strong></div>
      <div><span>Watch</span><strong>${c.watch}</strong></div>
      <div><span>Critical</span><strong>${c.critical}</strong></div>
      <div><span>Open Risks</span><strong>${c.risks}</strong></div>
      <div><span>Open Questions</span><strong>${c.questions}</strong></div>
    </div>
    <div class="exec-grid">
      <div class="meeting-card exec-card primary"><h3>Mission Readiness Blockers</h3><ul class="exec-list">${blockers}</ul></div>
      <div class="meeting-card exec-card action"><h3>Executive Actions Required</h3><ul class="exec-list checks">${actions}</ul></div>
      <div class="meeting-card exec-card"><h3>Pilot Forecast</h3><div class="forecast-gauge"><b>${forecast.confidence}%</b><span>${esc(forecast.trend)}</span></div><p>Based on readiness, risk count, and open questions for the selected building.</p></div>
      <div class="meeting-card exec-card"><h3>Trade Watch</h3>${tradeWatchRows(b)}</div>
      <div class="meeting-card exec-card wide"><h3>30-Second Talking Point</h3><p><b>${esc(execLabel(b))}</b> is at <b>${pct(b.readinessPct||0)}%</b> readiness. Current posture is <b>${esc(riskPosture(b))}</b>. Recommended executive focus: <b>${esc(executiveActions(b)[0])}</b></p></div>
      <div class="meeting-card exec-card wide"><h3>Copied Brief Preview</h3><div class="meeting-text">${esc(meetingBriefText())}</div></div>
    </div>`;
}
function openMeetingMode(){renderMeetingMode(); const o=document.getElementById('meetingOverlay'); if(o) o.classList.add('show');}
function closeMeetingMode(){const o=document.getElementById('meetingOverlay'); if(o) o.classList.remove('show');}
async function copyMeetingBrief(){
  const txt=meetingBriefText();
  try{await navigator.clipboard.writeText(txt);}catch(e){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
}
const meetingButton=document.getElementById('meetingLaunch'); if(meetingButton) meetingButton.addEventListener('click',openMeetingMode);
const meetingOverlay=document.getElementById('meetingOverlay'); if(meetingOverlay) meetingOverlay.addEventListener('click',e=>{if(e.target===meetingOverlay) closeMeetingMode();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMeetingMode();closeFieldMode();}});
const renderAll_103 = renderAll;
renderAll = function(reset=true){ renderAll_103(reset); if(document.getElementById('meetingOverlay')?.classList.contains('show')) renderMeetingMode(); };
