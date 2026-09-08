(function(){
'use strict';
const VERSION='2.0.4';
const $=id=>document.getElementById(id);
const esc2=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>Number(v)||0;
const hasWorkbook=()=>Array.isArray(window.data?.buildings)&&window.data.buildings.length>0;
const buildingKey=b=>String(b?.Building??'').trim();
const selectedB=()=>typeof window.selectedBuilding==='function'?window.selectedBuilding():(window.data?.buildings||[])[0]||{};
function updateShellState(){
  document.body.classList.toggle('no-workbook',!hasWorkbook());
  const status=$('productGateStatus');
  if(status) status.textContent=hasWorkbook()?'Workbook loaded. Preparing workspace…':'No workbook loaded. Your data stays on this computer.';
  const source=$('sourceStatus');
  if(source&&!hasWorkbook()) source.textContent='No workbook loaded.';
  renderProductHealth();
}
function openPicker(){ $('workbookInput')?.click(); }
window.openMissionWorkbookPicker=openPicker;
function addGate(){
  const gate=document.createElement('div');gate.id='productGate';gate.className='product-gate';gate.innerHTML=`<div class="product-gate-card"><img class="product-gate-logo" src="assets/mission_pmis_icon.png" alt="Mission PMIS"><div class="product-badge">Owner Project Management Information System</div><h1>Mission PMIS</h1><p class="tagline">Open a project workbook to begin.</p><button class="load-primary" type="button" onclick="openMissionWorkbookPicker()">Load Project Workbook</button><div id="productDrop" class="drop-message">Drag a compatible Excel PMIS workbook here</div><div id="productGateStatus" class="gate-error"></div><div class="product-meta"><span>Version ${VERSION}</span><span>Local browser processing</span><span>Excel remains source of truth</span></div></div>`;
  document.body.appendChild(gate);
  ['dragenter','dragover'].forEach(ev=>gate.addEventListener(ev,e=>{e.preventDefault();gate.querySelector('.product-gate-card').style.borderColor='#55b8d9'}));
  gate.addEventListener('dragleave',()=>gate.querySelector('.product-gate-card').style.borderColor='');
  gate.addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files?.[0];if(f&&typeof window.loadWorkbookFile==='function')window.loadWorkbookFile(f);});
}
function addSearch(){
  const hero=document.querySelector('.hero');if(!hero)return;
  const box=document.createElement('div');box.className='global-command';box.innerHTML='<input id="globalSearch" placeholder="Search buildings, rooms, records, shutdowns…" aria-label="Global search"><button type="button" id="globalSearchButton">Search</button>';
  hero.insertBefore(box,hero.querySelector('.selector-card'));
  const pop=document.createElement('div');pop.id='globalSearchResults';pop.className='search-results-popover';document.body.appendChild(pop);
  $('globalSearchButton').onclick=runGlobalSearch;$('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter')runGlobalSearch();if(e.key==='Escape')pop.classList.remove('show')});
}
function searchCorpus(q){
  const raw=String(q||'').trim();const query=raw.toLowerCase();if(!query)return[];
  const compact=raw.replace(/\s+/g,'').toUpperCase();const out=[];const seen=new Set();
  const push=r=>{const key=[r.type,r.title,r.sub,r.building,r.tab].join('|');if(!seen.has(key)){seen.add(key);out.push(r)}};
  (window.data?.buildings||[]).forEach(b=>{
    const hay=Object.values(b).join(' ').toLowerCase();
    if(hay.includes(query)||cleanBuildingToken(buildingKey(b))===cleanBuildingToken(raw))
      push({type:'Building',title:`Building ${buildingKey(b)}`,sub:`${b['Overall Status']||'Status not set'} · ${Math.round(num(b.readinessPct)*100)}% ready`,building:buildingKey(b),tab:'overview'});
  });
  (window.data?.assessmentIndex||[]).forEach(r=>{
    const tokenHit=(r.roomTokens||[]).some(t=>t.includes(compact)||compact.includes(t));
    if(tokenHit||String(r.text||'').toLowerCase().includes(query))
      push({type:'Assessment',title:(r.roomTokens||[]).find(t=>t.includes(compact)||compact.includes(t))||`Assessment row ${r.row}`,sub:`${r.sheet} · row ${r.row} · ${String(r.text||'').slice(0,150)}`,building:r.building,tab:'assessment',assessment:r});
  });
  (window.data?.projectRegister||[]).forEach(r=>{
    const hay=Object.values(r).join(' ').toLowerCase();
    if(hay.includes(query))push({type:r['Record Type']||'Project Record',title:r.Title||r['Record ID']||'Project record',sub:`${r.Building||'All buildings'} · ${r.Status||'Status not set'} · ${r['Assigned To']||''}`,building:String(r.Building||''),tab:'project'});
  });
  (window.data?.shutdowns||[]).forEach(r=>{
    const hay=Object.values(r).join(' ').toLowerCase();
    if(hay.includes(query))push({type:'Shutdown',title:r.Title||r.Description||r.System||r['Shutdown ID']||'Shutdown',sub:`${r.Building||r['Affected Building']||'Campus'} · ${r.Status||'Status not set'}`,building:String(r.Building||r['Affected Building']||''),tab:'shutdowns'});
  });
  return out.slice(0,60);
}
function runGlobalSearch(){
  const q=$('globalSearch')?.value||'';const results=searchCorpus(q);const pop=$('globalSearchResults');if(!pop)return;
  pop.innerHTML=`<div class="search-results-head"><b>${results.length} result${results.length===1?'':'s'} for “${esc2(q)}”</b><button type="button" aria-label="Close search results">×</button></div>`+(results.length?results.map((r,i)=>`<button class="search-result" data-search-index="${i}"><strong>${esc2(r.type)} · ${esc2(r.title)}</strong><span>${esc2(r.sub)}</span></button>`).join(''):'<div class="search-empty">No matching project information was found.</div>');
  pop.classList.add('show');pop.querySelector('.search-results-head button').onclick=()=>pop.classList.remove('show');
  pop.querySelectorAll('[data-search-index]').forEach(btn=>btn.onclick=()=>openSearchResult(results[Number(btn.dataset.searchIndex)]));
}
function selectBuildingValue(value){
  const select=$('buildingSelect');if(!select||!value)return false;
  const target=cleanBuildingToken(value);
  const opt=[...select.options].find(o=>cleanBuildingToken(o.value)===target||cleanBuildingToken(o.textContent)===target);
  if(!opt)return false;
  select.value=opt.value;select.dispatchEvent(new Event('change',{bubbles:true}));return true;
}
function openSearchResult(r){
  $('globalSearchResults')?.classList.remove('show');
  if(r.building&&r.building!=='ALL')selectBuildingValue(r.building);
  window.missionSearchContext=r;
  setTimeout(()=>openBuildingWorkspace(r.tab||'overview'),0);
}
function healthState(value,good,watch){return value<=good?['Good','health-good']:value<=watch?['Watch','health-watch']:['Attention','health-critical']}
function renderProductHealth(){
  const host=$('productHealth');if(!host||!hasWorkbook()){if(host)host.innerHTML='';return}
  const s=window.data.stats||{};const reg=window.data.projectRegister||[];const shuts=window.data.shutdowns||[];
  const openReg=reg.filter(r=>openStatus(r.Status));
  const overdue=openReg.filter(r=>r['Days to Due']!==''&&num(r['Days to Due'])<0).length;
  const openShutdowns=shuts.filter(r=>openStatus(r.Status)).length;
  const readiness=Math.round(num(s.avgReadiness)*100);
  const items=[
    ['Quality',...healthState(num(s.risks),0,5),`${Math.round(num(s.risks))} open risk(s)`,'overview'],
    ['Schedule',...healthState(overdue,0,3),`${overdue} overdue management item(s)`,'project'],
    ['Documentation',...healthState(openReg.length,5,15),`${openReg.length} active register item(s)`,'project'],
    ['Shutdown Coordination',...healthState(openShutdowns,0,4),`${openShutdowns} active shutdown(s)`,'shutdowns'],
    ['Questions',...healthState(num(s.questions),0,8),`${Math.round(num(s.questions))} open question(s)`,'assessment'],
    ['Readiness',readiness>=80?'Good':readiness>=55?'Watch':'Attention',readiness>=80?'health-good':readiness>=55?'health-watch':'health-critical',`${readiness}% campus readiness`,'overview'],
    ['Commissioning','Monitor','health-neutral','Based on Project Register','project'],
    ['Cost','Monitor','health-neutral','Confirmed impacts from Project Register','project']
  ];
  host.innerHTML=`<div class="health-head"><div><div class="product-badge">Owner's View</div><h2>Project Health</h2></div><span class="mini">Select an area to review supporting information</span></div><div class="health-grid">${items.map(x=>`<button type="button" class="health-card" data-health-tab="${esc2(x[4])}" data-health-name="${esc2(x[0])}"><span class="health-name">${esc2(x[0])}</span><span class="health-status"><i class="health-dot ${x[2]}"></i>${esc2(x[1])}</span><span class="health-evidence">${esc2(x[3])}</span></button>`).join('')}</div>`;
  host.querySelectorAll('[data-health-tab]').forEach(card=>card.addEventListener('click',()=>{
    window.missionSearchContext={type:'Health',title:card.dataset.healthName};
    openBuildingWorkspace(card.dataset.healthTab||'overview');
  }));
}
window.openHealthArea=function(name){const map={'Shutdown Coordination':'shutdowns','Documentation':'project','Schedule':'project','Commissioning':'project','Cost':'project','Questions':'assessment'};openBuildingWorkspace(map[name]||'overview')};
function addProductHealth(){const section=document.createElement('section');section.id='productHealth';section.className='product-health';const layout=document.querySelector('.layout');layout?.parentNode.insertBefore(section,layout)}
function cleanBuildingToken(v){
  return String(v??'').trim().toUpperCase().replace(/\.0$/,'').replace(/^BUILDING\s*/,'').replace(/^BLDG\s*/,'').replace(/^B(?=\d)/,'').replace(/^0+(?=\d)/,'');
}
function recordBuildingValues(r){
  const vals=[
    r?.Building,r?.['Building ID'],r?.['Building_ID'],r?.Bldg,r?.['Affected Building'],
    r?.['Linked Assessment'],r?.['Assessment Sheet'],r?.['Source Sheet'],
    r?.['Linked Shutdown'],r?.['Meeting / Reference'],r?.['Evidence / Link']
  ];
  return vals.flatMap(v=>String(v??'').split(/[,;|/]+/)).map(cleanBuildingToken).filter(Boolean);
}
function matchingBuildingRecord(r,b){
  const target=cleanBuildingToken(buildingKey(b));
  const values=recordBuildingValues(r);
  if(!values.length)return false;
  if(values.includes('ALL')||values.includes('CAMPUS'))return true;
  return values.some(v=>v===target||v===`B${target}`||v.includes(`B${target}_ASSESSMENT`)||v.includes(`${target}_ASSESSMENT`));
}
function openStatus(v){return !['complete','completed','closed','cancelled','canceled','deferred'].includes(String(v||'').trim().toLowerCase())}
function table(records,cols){
  if(!records.length)return'<div class="workspace-empty">No matching records are currently reported for this building.</div>';
  return `<div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${cols.map(c=>`<th>${esc2(c[0])}</th>`).join('')}</tr></thead><tbody>${records.map(r=>`<tr>${cols.map(c=>`<td>${esc2(typeof c[1]==='function'?c[1](r):r[c[1]])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}
function nonEmpty(v){return v!==undefined&&v!==null&&String(v).trim()!==''}
function displayDate(v){
  if(!nonEmpty(v))return'';
  const d=new Date(v);
  return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString();
}
function renderWorkspace(tab){
  const b=selectedB(),key=buildingKey(b),allReg=window.data.projectRegister||[],allSh=window.data.shutdowns||[];
  const reg=allReg.filter(r=>matchingBuildingRecord(r,b));
  const sh=allSh.filter(r=>matchingBuildingRecord(r,b));
  const body=$('workspaceBody');if(!body)return;

  const activeReg=reg.filter(r=>openStatus(r.Status));
  const riskFallback=activeReg.filter(r=>/risk|deficien|issue/i.test(String(r['Record Type']||r.Category||''))).length;
  const questionFallback=activeReg.filter(r=>/question|rfi|design/i.test(String(r['Record Type']||r.Category||''))).length;
  const riskCount=num(b['Open Risks'])||riskFallback;
  const questionCount=num(b['Open Questions'])||questionFallback;
  const activeShutdowns=sh.filter(r=>openStatus(r.Status));

  const status=firstValue(b,['Overall Status','Dashboard Signal','Execution Gate','Status'])||'Status not reported';
  const nextAction=firstValue(b,['Next Action','Driver / Major Blocker','Major Blocker'])||firstValue(b.action||{},['Action Required','Next Action','Driver / Major Blocker'])||'Continue assessment and coordination.';
  const blocker=firstValue(b,['Major Blocker','Driver / Major Blocker'])||firstValue(b.action||{},['Driver / Major Blocker','Major Blocker']);
  const overview=`<div class="workspace-summary">
    <div class="workspace-stat"><span>Readiness</span><b>${Math.round(num(b.readinessPct)*100)}%</b></div>
    <div class="workspace-stat"><span>Open Risks</span><b>${riskCount}</b></div>
    <div class="workspace-stat"><span>Open Questions</span><b>${questionCount}</b></div>
    <div class="workspace-stat"><span>Active Shutdowns</span><b>${activeShutdowns.length}</b></div>
  </div>
  <div class="workspace-card status-card"><h3>Current Status</h3><div class="workspace-status-pill">${esc2(status)}</div></div>
  <div class="workspace-card"><h3>Next Action</h3><p class="workspace-copy">${esc2(nextAction)}</p></div>
  ${blocker&&blocker!==nextAction?`<div class="workspace-card"><h3>Key Constraint</h3><p class="workspace-copy">${esc2(blocker)}</p></div>`:''}`;

  const project=table(reg,[['ID','Record ID'],['Type','Record Type'],['Title','Title'],['Owner','Assigned To'],['Priority','Priority'],['Status','Status'],['Due',r=>displayDate(r['Due Date'])]]);
  const shutdowns=table(sh,[['ID',r=>r['Shutdown ID']||r.ID||r['Record ID']],['System',r=>r.System||r.Title||r.Description],['Building',r=>r.Building||r['Affected Building']],['Status','Status'],['Date',r=>displayDate(r['Scheduled Date']||r.Date||r['Start Date'])],['Operational Impact',r=>r['Operational Impact']||r.Impact||r['Operational / Patient Impact']]]);

  const assessmentFields=[
    ['Source Sheet',b.Sheet],['Overall Status',status],['Construction Ready',firstValue(b,['Construction Ready','Ready'])],
    ['Acceptance Status',firstValue(b,['Acceptance Status','Pilot Status','Execution Gate'])],['Rooms Captured',firstValue(b,['Room Count','Rooms'])],
    ['Open Photos',firstValue(b,['Open Photos','Photos'])]
  ].filter(x=>nonEmpty(x[1]));
  const context=window.missionSearchContext;
  const matchedAssessment=(window.data.assessmentIndex||[]).filter(r=>cleanBuildingToken(r.building)===cleanBuildingToken(key)).filter(r=>{
    if(context?.assessment)return r.sheet===context.assessment.sheet&&r.row===context.assessment.row;
    const q=String($('globalSearch')?.value||'').trim().toLowerCase();return q&&String(r.text||'').toLowerCase().includes(q);
  }).slice(0,25);
  const searchMatches=matchedAssessment.length?`<div class="workspace-card"><h3>Matching Assessment Information</h3>${table(matchedAssessment,[['Sheet','sheet'],['Row','row'],['Room / Reference',r=>(r.roomTokens||[]).join(', ')],['Assessment Detail','text']])}</div>`:'';
  const assessment=`<div class="workspace-card"><h3>Assessment Summary</h3><div class="workspace-detail-grid">${assessmentFields.map(x=>`<div><span>${esc2(x[0])}</span><b>${esc2(x[1])}</b></div>`).join('')}</div></div>${searchMatches}`;

  const notes=b.tradeNotes||{};
  const excluded=/building|id|sheet/i;
  const systems=Object.entries(notes).filter(([k,v])=>!excluded.test(k)&&nonEmpty(v)).map(([k,v])=>`<div class="workspace-card"><h3>${esc2(k.replace(/_/g,' '))}</h3><p class="workspace-copy">${esc2(v)}</p></div>`).join('')||'<div class="workspace-empty">No trade or system notes are currently reported for this building.</div>';

  const documentRecords=reg.filter(r=>nonEmpty(r['Linked Document'])||nonEmpty(r['Evidence / Link'])||/document|submittal/i.test(String(r['Record Type']||r.Category||'')));
  const documents=table(documentRecords,[['ID','Record ID'],['Title','Title'],['Document',r=>r['Linked Document']||r['Evidence / Link']],['Status','Status'],['Owner','Assigned To']]);
  const photoRecords=reg.filter(r=>/photo/i.test(String(r['Record Type']||r.Category||r.Title||''))||nonEmpty(r['Evidence / Link']));
  const photos=table(photoRecords,[['ID','Record ID'],['Title','Title'],['Evidence / Link','Evidence / Link'],['Status','Status']]);

  const map={overview,assessment,project:`<div class="workspace-card"><h3>Project Register</h3><p class="workspace-intro">${reg.length} linked record${reg.length===1?'':'s'} from Project_Register.</p>${project}</div>`,shutdowns:`<div class="workspace-card"><h3>Shutdown Coordination</h3><p class="workspace-intro">${sh.length} linked shutdown record${sh.length===1?'':'s'} from Shutdown_Tracker.</p>${shutdowns}</div>`,systems,documents:`<div class="workspace-card"><h3>Documents and Evidence</h3>${documents}</div>`,photos:`<div class="workspace-card"><h3>Photo and Evidence Links</h3>${photos}</div>`};
  body.innerHTML=map[tab]||overview;
}
function firstValue(obj,names){
  for(const n of names){if(obj&&nonEmpty(obj[n]))return obj[n]}
  return '';
}
function addWorkspace(){
  const el=document.createElement('div');el.id='buildingWorkspace';el.className='workspace-overlay';el.innerHTML=`<div class="workspace-board"><div class="workspace-top"><div><div class="product-badge">Building Workspace</div><h2 id="workspaceTitle">Selected Building</h2><p>One coordinated view of assessment, management, and operational records.</p></div><button class="workspace-close" onclick="closeBuildingWorkspace()">Close</button></div><div class="workspace-tabs">${[['overview','Overview'],['assessment','Assessment'],['systems','Systems'],['project','Project Register'],['shutdowns','Shutdowns'],['documents','Documents'],['photos','Photos']].map(x=>`<button class="workspace-tab" data-workspace-tab="${x[0]}">${x[1]}</button>`).join('')}</div><div id="workspaceBody" class="workspace-body"></div></div>`;document.body.appendChild(el);el.querySelectorAll('[data-workspace-tab]').forEach(btn=>btn.onclick=()=>{el.querySelectorAll('.workspace-tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');renderWorkspace(btn.dataset.workspaceTab)});el.addEventListener('click',e=>{if(e.target===el)closeBuildingWorkspace()});
}
window.openBuildingWorkspace=function(tab='overview'){if(!hasWorkbook())return;const el=$('buildingWorkspace');const current=selectedB();$('workspaceTitle').textContent=`Building ${buildingKey(current)||'Workspace'}`;el.classList.add('show');const btn=el.querySelector(`[data-workspace-tab="${tab}"]`)||el.querySelector('[data-workspace-tab="overview"]');btn.click()};window.closeBuildingWorkspace=()=>$('buildingWorkspace')?.classList.remove('show');
function enhanceReports(){
  if(typeof window.renderReportsMode!=='function')return;const old=window.renderReportsMode;window.renderReportsMode=function(){old();const host=$('reportsContent');if(!host||host.querySelector('.report-launch-grid'))return;const cards=document.createElement('div');cards.className='report-launch-grid';cards.innerHTML=`<div class="report-launch-card"><strong>Executive Brief</strong><span>Leadership-level status, health, and decisions.</span><button onclick="setReportType('executive')">Preview</button></div><div class="report-launch-card"><strong>COR Report</strong><span>Accordion briefing generated from source registers.</span><button onclick="closeReportsMode();openCorReports()">Open</button></div><div class="report-launch-card"><strong>CM/PM Operations</strong><span>Management actions, schedule, shutdowns, and delivery.</span><button onclick="setReportType('cm_pm')">Preview</button></div><div class="report-launch-card"><strong>Building Report</strong><span>Selected-building readiness and owner action.</span><button onclick="openBuildingWorkspace('overview')">Open Workspace</button></div><div class="report-launch-card"><strong>Shutdown Report</strong><span>Operational shutdown coordination records.</span><button onclick="openBuildingWorkspace('shutdowns')">Open Workspace</button></div><div class="report-launch-card"><strong>All Buildings</strong><span>Campus-wide readiness and management attention.</span><button onclick="printAllBuildingsReport()">Print / PDF</button></div>`;host.prepend(cards)};
}
function addWorkspaceButton(){const detail=document.querySelector('.detail-panel');if(!detail)return;const btn=document.createElement('button');btn.type='button';btn.className='brief-btn';btn.style.cssText='margin:12px;width:calc(100% - 24px)';btn.textContent='Open Building Workspace';btn.onclick=()=>openBuildingWorkspace('overview');detail.prepend(btn)}
function neutralizeBranding(){document.querySelector('.hero .eyebrow').textContent='OWNER PROJECT MANAGEMENT INFORMATION SYSTEM';const launch=$('launchOverlay');if(launch)launch.style.display='none';const about=document.querySelector('#aboutOverlay .about-grid');if(about)about.innerHTML=`<div class="about-item"><span>Version</span><strong>${VERSION}</strong></div><div class="about-item"><span>Product</span><strong>Mission PMIS</strong></div><div class="about-item"><span>Backend</span><strong>Excel project workbook</strong></div><div class="about-item"><span>Processing</span><strong>Local browser mode</strong></div>`}
function installHooks(){
  const oldRender=window.renderAll;if(typeof oldRender==='function')window.renderAll=function(reset=true){oldRender(reset);updateShellState()};
  const input=$('workbookInput');input?.addEventListener('change',()=>setTimeout(updateShellState,500));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('globalSearchResults')?.classList.remove('show');closeBuildingWorkspace()}});
}
function init(){addGate();addSearch();addProductHealth();addWorkspace();addWorkspaceButton();neutralizeBranding();enhanceReports();installHooks();updateShellState()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
