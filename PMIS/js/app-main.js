let data = window.PMIS_DATA || {buildings:[], focus:[], stats:{total:0,avgReadiness:0,ready:0,notReady:0,risks:0,questions:0}, corReports:null, projectRegister:[], shutdowns:[], loadedAt:''};
window.data = data;

window.missionProjectLabel = function(){
  const raw=String(window.data?.sourceFileName||'').replace(/\.(xlsx|xlsm|xls)$/i,'').trim();
  if(!raw)return 'Loaded Project Workbook';
  return raw.replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
};
window.refreshProjectIdentity = function(){
  const label=window.missionProjectLabel();
  const eyebrow=document.getElementById('projectEyebrow');
  if(eyebrow)eyebrow.textContent=label;
  const about=document.getElementById('aboutProjectName');
  if(about)about.textContent=label;
  const mapTitle=document.getElementById('campusMapTitle');
  if(mapTitle)mapTitle.textContent=label==='Loaded Project Workbook'?'Project Campus Map':`${label} · Campus Map`;
};


// SITE guard: the packaged snapshot in v1.2.4 omitted SITE from the building
// collection while the focus queue still contained a SITE record. Normalize the
// record here and after every workbook import so the dashboard cannot inherit a
// stale or unrelated risk count.
function normalizeSiteRecord(dataset){
  if(!dataset) dataset={};
  if(!Array.isArray(dataset.buildings)) dataset.buildings=[];
  if(dataset.buildings.length===0){
    dataset.stats=buildStats(dataset.buildings);
    return dataset;
  }
  let site=dataset.buildings.find(b=>String(b?.Building||'').trim().toUpperCase().replace(/^B/,'')==='SITE');
  if(!site){
    site={
      Building:'SITE', Sheet:'SITE_Assesment', 'Overall Status':'Not Started',
      'Sheet Readiness':0, 'Avg Readiness':0, 'Construction Ready':'No',
      'Room Count':0, 'Open Risks':0, 'Open Questions':0, 'Open Photos':0,
      HVAC:'N/A', Electrical:'Verify', Telecom:'Verify',
      'Fire Protection':'N/A', 'Fire Alarm':'Verify', Security:'N/A',
      'Next Action':'Review the SITE assessment and update the Excel source of truth.',
      'Major Blocker':'Site-package status is controlled by the SITE assessment.',
      Shutdowns:0, readinessPct:0, tradeNotes:{}, action:{}
    };
    dataset.buildings.push(site);
  }
  site.Building='SITE';
  site['Open Risks']=0;
  site['Open Questions']=Number(site['Open Questions'])||0;
  site['Room Count']=Number(site['Room Count'])||0;
  site.readinessPct=Number(site.readinessPct ?? site['Sheet Readiness'] ?? 0)||0;
  dataset.stats=buildStats(dataset.buildings);
  return dataset;
}
const $ = id => document.getElementById(id);
let selected = data.buildings[0]?.Building;

function pct(v){ return Math.round((Number(v)||0)*100); }
function esc(s){ return String(s||'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }
function normBuilding(v){
  const s = String(v ?? '').trim().replace(/^B/i,'');
  if(!s) return '';
  return /^\d+$/.test(s) ? s.padStart(2,'0') : s.toUpperCase();
}
function num(v){
  if(v === true) return 1;
  if(v === false || v == null || v === '') return 0;
  if(typeof v === 'string' && v.includes('%')) return Number(v.replace('%',''))/100 || 0;
  return Number(v) || 0;
}
function first(row, names){
  for(const n of names){ if(row[n] !== undefined && row[n] !== null && row[n] !== '') return row[n]; }
  return '';
}
function sheetRows(wb, name){
  // Smart reader: many workbook sheets have a title row above the real headers.
  // This finds the real header row instead of assuming row 1.
  const sheetName = wb.SheetNames.find(n => n.toLowerCase() === name.toLowerCase())
    || wb.SheetNames.find(n => n.toLowerCase().replace(/\s+/g,'').startsWith(name.toLowerCase().replace(/\s+/g,'')));
  if(!sheetName) return [];
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {header:1, defval:'', raw:false});
  const wanted = {
    'PMIS_Data': ['Building','Sheet'],
    'PMIS_Trade_Notes': ['Building_ID','Owner Risks'],
    "Today's_Focus": ['Building','Driver / Major Blocker'],
    '_V4_ActionQueue': ['Rank','Building','Action Required']
  };
  const keys = wanted[name] || ['Building'];
  let headerIndex = aoa.findIndex(row => keys.every(k => row.map(x=>String(x).trim()).includes(k)));
  if(headerIndex < 0) headerIndex = aoa.findIndex(row => row.map(x=>String(x).trim()).includes('Building'));
  if(headerIndex < 0) return [];
  const headers = aoa[headerIndex].map((h,i)=>String(h||`col${i+1}`).trim() || `col${i+1}`);
  return aoa.slice(headerIndex+1).map(row => {
    const obj = {};
    headers.forEach((h,i)=> obj[h] = row[i] ?? '');
    return obj;
  }).filter(obj => Object.values(obj).some(v => String(v).trim() !== ''));
}
function sheetAoa(wb, name){
  const target=wb.SheetNames.find(n=>n.toLowerCase()===String(name).toLowerCase());
  if(!target) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[target], {header:1, defval:'', raw:false});
}
function excelDisplay(v){
  if(v==null) return '';
  if(v instanceof Date) return v.toLocaleDateString();
  return String(v).trim();
}
function rowHasData(row){return Array.isArray(row)&&row.some(v=>excelDisplay(v)!=='');}
function rowObject(headers,row){
  const out={};
  headers.forEach((h,i)=>{const key=excelDisplay(h);if(key)out[key]=row[i]??'';});
  return out;
}
function workbookTable(wb,name,requiredHeaders=[]){
  const rows=sheetAoa(wb,name); if(!rows.length) return [];
  const wanted=requiredHeaders.map(x=>String(x).toLowerCase());
  let hi=rows.findIndex(row=>{const cells=row.map(x=>excelDisplay(x).toLowerCase());return wanted.every(h=>cells.includes(h));});
  if(hi<0)return []; const headers=rows[hi].map((h,i)=>excelDisplay(h)||`col${i+1}`);
  return rows.slice(hi+1).filter(rowHasData).map(r=>rowObject(headers,r));
}
function workbookToCorReports(wb){
  const cor=sheetAoa(wb,'COR_Report'), cm=sheetAoa(wb,'CM_PM Operations');
  const projectRegister=workbookTable(wb,'Project_Register',['Record ID','Record Type','Title']);
  const shutdowns=workbookTable(wb,'Shutdown_Tracker',['Shutdown ID','System','Building']);
  if(!cor.length&&!cm.length&&!projectRegister.length)return null;
  const get=(rows,r,c)=>excelDisplay((rows[r-1]||[])[c-1]);
  const meta={reportType:get(cor,4,2)||get(cm,6,4)||'Weekly',periodStart:get(cor,4,4)||get(cm,7,2),preparedBy:get(cor,5,2)||get(cm,8,2),periodEnd:get(cor,5,4)||get(cm,7,4),reviewedWith:get(cor,6,2)||get(cm,8,4),selectedBuilding:get(cor,6,4)||get(cm,6,2),projectPhase:get(cor,7,2)||'Project Status',contractorSchedule:get(cor,7,4)||'Pending',reportSource:'PMIS assessments + Project Register + Shutdown Tracker',executiveSummary:get(cor,15,1)};
  function rowsFromRange(headerRow,startRow,endRow){if(!cm.length)return[];const header=cm[headerRow-1]||[];return cm.slice(startRow-1,endRow).filter(rowHasData).map(r=>rowObject(header,r));}
  function meaningfulRecords(rows){return rows.filter(r=>{const vals=Object.values(r).map(excelDisplay).filter(Boolean);return vals.length&&!vals.every(v=>['0','0%','01/00/1900','1/0/1900','N/A','None'].includes(v));});}
  const sections=[];
  sections.push({id:'1',title:'PROJECT AND ASSESSMENT STATUS',source:'CM_PM Operations / PMIS_Data',rows:meaningfulRecords(rowsFromRange(16,17,46)),operational:[],lookAhead:''});
  sections.push({id:'2',title:'FIELD AND INSPECTION ACTIVITY',source:'CM_PM Operations / Assessment Sheets',rows:meaningfulRecords(rowsFromRange(50,51,80)),operational:[],lookAhead:''});
  sections.push({id:'3',title:'RISKS, DEFICIENCIES, AND OPEN QUESTIONS',source:'CM_PM Operations / Assessment Sheets',rows:meaningfulRecords(rowsFromRange(84,85,114)),operational:[],lookAhead:''});
  const activeShutdowns=meaningfulRecords(shutdowns).filter(r=>!['closed','complete','completed','cancelled','canceled'].includes(String(r.Status||'').trim().toLowerCase()));
  sections.push({id:'4',title:'SCHEDULE, SHUTDOWNS, RELOCATIONS, AND OPERATIONAL IMPACTS',source:'CM_PM Operations + Shutdown Tracker',rows:meaningfulRecords(rowsFromRange(118,119,128)),operational:activeShutdowns,lookAhead:''});
  sections.push({id:'5',title:'DESIGN AND TECHNICAL COORDINATION',source:'CM_PM Operations / Assessment Sheets',rows:meaningfulRecords(rowsFromRange(138,139,168)),operational:[],lookAhead:''});
  sections.push({id:'6',title:'QUALITY AND CONSTRUCTION READINESS',source:'CM_PM Operations / Assessment Sheets',rows:meaningfulRecords(rowsFromRange(172,173,202)),operational:[],lookAhead:''});
  sections.push({id:'7',title:'OIT, COMMISSIONING, TURNOVER, AND ACCEPTANCE',source:'CM_PM Operations / Assessment Sheets',rows:meaningfulRecords(rowsFromRange(206,207,236)),operational:[],lookAhead:''});
  const actions=meaningfulRecords(projectRegister).filter(r=>String(r['Include in COR Report']||'').trim().toLowerCase()==='yes');
  sections.push({id:'8',title:'CM/PM DELIVERABLES, ACTIONS, AND CONTRACT ADMINISTRATION',source:'Project_Register',rows:actions,operational:[],lookAhead:''});
  const decisions=actions.filter(r=>String(r['COR Decision Required']||'').trim().toLowerCase()==='yes').map(r=>({'Record ID':r['Record ID'],'Title':r['Title'],'Building':r['Building'],'Decision / Action Needed':r['Decision / Action Needed'],'Assigned To':r['Assigned To'],'Status':r['Status'],'Priority':r['Priority']}));
  const lookAheadItems=actions.filter(r=>String(r['Look-Ahead Item']||'').trim().toLowerCase()==='yes').map(r=>r['Decision / Action Needed']||r['Title']).filter(Boolean);
  const lookAhead=lookAheadItems.length?`Two-week look ahead: ${lookAheadItems.join('; ')}.`:(get(cm,334,1)||get(cor,144,1)||'');
  sections.push({id:'9',title:'COR DECISIONS REQUIRED AND TWO-WEEK LOOK AHEAD',source:'Project_Register',rows:decisions,operational:[],lookAhead});
  return {meta,sections,actions,decisions,projectRegister,shutdowns};
}
function statusClass(b){
  const r = Number(b.readinessPct)||0;
  const risks = Number(b['Open Risks'])||0;
  if((b['Construction Ready']+'').toLowerCase()==='yes' || (b['Overall Status']+'').toUpperCase()==='READY') return 'ready';
  if(risks>=8 || r<.51) return 'critical';
  return 'warn';
}
function kpi(label,value,sub){return `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="mini">${sub||''}</div></div>`;}
function buildStats(buildings){
  const total=buildings.length;
  const avg=total?buildings.reduce((a,b)=>a+num(b.readinessPct),0)/total:0;
  const ready=buildings.filter(b=>statusClass(b)==='ready').length;
  return {total,avgReadiness:avg,ready,notReady:total-ready,risks:buildings.reduce((a,b)=>a+num(b['Open Risks']),0),questions:buildings.reduce((a,b)=>a+num(b['Open Questions']),0)};
}
function findActionSheet(wb){
  return wb.SheetNames.find(n => n.toLowerCase().includes('actionqueue')) || '_V4_ActionQueue';
}
function isRealBuildingRow(r){
  const b = normBuilding(first(r,['Building','Building_ID','Building ID','Bldg','ID']));
  const sheet = String(first(r,['Sheet','Source Sheet','Assessment Sheet'])||'').trim();
  const readiness = num(first(r,['Sheet Readiness','Avg Readiness','Readiness']));
  // PMIS_Data carries formulas farther down the sheet. Only keep the true rollup rows.
  if(!b || b === 'BUILDING') return false;
  if(!sheet || !/assessment/i.test(sheet)) return false;
  if(readiness < 0 || readiness > 1) return false;
  if(!/^(\d{2}|BCH|MCR|SITE)$/i.test(b)) return false;
  return true;
}
function workbookToData(wb){
  const pmis = sheetRows(wb,'PMIS_Data').filter(isRealBuildingRow);
  const trade = sheetRows(wb,'PMIS_Trade_Notes');
  const focus = sheetRows(wb,"Today's_Focus");
  const action = sheetRows(wb, findActionSheet(wb));

  const tradeBy = Object.fromEntries(trade.map(r => [normBuilding(first(r,['Building_ID','Building','Building ID'])), r]).filter(x=>x[0]));
  const actionBy = Object.fromEntries(action.map(r => [normBuilding(first(r,['Building','Building_ID','Building ID'])), r]).filter(x=>x[0]));

  const seen = new Set();
  const buildings = pmis.map(r => {
    const b = normBuilding(first(r,['Building','Building_ID','Building ID','Bldg','ID']));
    if(seen.has(b)) return null;
    seen.add(b);
    const readiness = Math.max(0, Math.min(1, num(first(r,['Sheet Readiness','Avg Readiness','Readiness','Completion','Acceptance Readiness']))));
    const row = {...r};
    row.Building = b;
    row.Sheet = first(r,['Sheet','Source Sheet','Assessment Sheet']) || `B${b}_Assessment`;
    row['Overall Status'] = first(r,['Overall Status','Status','Execution Gate']) || (readiness >= .8 ? 'READY' : 'WATCH');
    row['Open Risks'] = Math.max(0, Math.round(num(first(r,['Open Risks','Risks']))));
    row['Open Questions'] = Math.max(0, Math.round(num(first(r,['Open Questions','Questions']))));
    row['Open Photos'] = Math.max(0, Math.round(num(first(r,['Open Photos','Photos']))));
    row['Room Count'] = Math.max(0, Math.round(num(first(r,['Room Count','Rooms']))));
    row['Construction Ready'] = first(r,['Construction Ready','Ready']);
    row.readinessPct = readiness;
    row.tradeNotes = tradeBy[b] || {};
    row.action = actionBy[b] || {};
    return row;
  }).filter(Boolean);

  const focusRows = focus.map(r => ({...r, Building:normBuilding(first(r,['Building','Building_ID','Building ID']))})).filter(r=>r.Building && buildings.some(b=>b.Building===r.Building)).slice(0,12);
  const corReports=workbookToCorReports(wb);
  const assessmentIndex=[];
  wb.SheetNames.filter(n=>/assessment/i.test(n)).forEach(sheetName=>{
    const aoa=sheetAoa(wb,sheetName);
    const building=normBuilding((sheetName.match(/^B?([0-9]+|BCH|MCR|SITE|SPEC)/i)||[])[1]||sheetName);
    aoa.forEach((row,rowIndex)=>{
      const values=(row||[]).map(excelDisplay).filter(Boolean);
      if(!values.length)return;
      const text=values.join(' | ');
      const roomTokens=[...new Set((text.match(/\b(?:TR|ROOM|RM)?\s*[A-Z]*\d+[A-Z0-9\/-]*\b/gi)||[]).map(x=>x.replace(/\s+/g,'').toUpperCase()))];
      assessmentIndex.push({building,sheet:sheetName,row:rowIndex+1,text,roomTokens});
    });
  });
  return {buildings, focus: focusRows.length ? focusRows : buildings.slice().sort((a,b)=>num(b['Open Risks'])-num(a['Open Risks'])).slice(0,8), stats: buildStats(buildings), corReports, projectRegister:corReports?.projectRegister||[], shutdowns:corReports?.shutdowns||[], assessmentIndex, loadedAt: new Date().toLocaleString()};
}
// Normalize the empty shell or the currently loaded workbook data.
data = normalizeSiteRecord(data);
selected = data.buildings.find(b=>b.Building===selected)?.Building || data.buildings[0]?.Building;

function workbookSourceSummary(wb){
  const expected=['PMIS_Data','PMIS_Trade_Notes',"Today's_Focus",'_V4_ActionQueue'];
  return {
    expected,
    present: expected.filter(name=>wb.SheetNames.some(sheet=>sheet.toLowerCase()===name.toLowerCase())),
    allSheets:[...wb.SheetNames]
  };
}
function logBootstrap(stage, details){
  console.info(`PMIS_BOOTSTRAP_${stage}`, details);
}
function applyLoadedWorkbook(next, sourceName){
  const normalized = normalizeSiteRecord(next);
  normalized.sourceFileName = sourceName;
  if(!normalized.buildings.length) throw new Error('PMIS_Data did not return building rows.');
  data = normalized;
  window.data = data;
  window.getMissionData = ()=>data;
  selected = data.buildings.find(b=>b.Building===selected)?.Building || data.buildings[0].Building;
  renderAll(true);
  window.refreshProjectIdentity?.();
  updateShellState();
}
async function loadWorkbookBuffer(buffer, sourceName, diagnostics={}){
  if(!window.XLSX){ setSource('Excel reader did not load. Check your internet connection, then reload the page.', 'bad'); return; }
  try{
    const wb = XLSX.read(buffer, {type:'array', cellDates:true});
    const sheetSummary = workbookSourceSummary(wb);
    if(diagnostics.fetchUrl) logBootstrap('FETCH_SUCCESS', {url: diagnostics.fetchUrl, bytes: buffer.byteLength || buffer.length || 0});
    logBootstrap('PARSED', {sourceName, sheetCount: wb.SheetNames.length, presentSheets: sheetSummary.present, expectedSheets: sheetSummary.expected});
    const next = workbookToData(wb);
    applyLoadedWorkbook(next, sourceName);
    setSource(`${diagnostics.kind==='auto'?'Bundled':'Live'} workbook loaded: ${sourceName} • ${data.buildings.length} buildings • ${data.loadedAt}`, 'good');
    logBootstrap('RUNTIME_INITIALIZED', {buildings:data.buildings.length, stats:data.stats, selected});
    logBootstrap('DASHBOARD_READY', {mission:!!$('missionSection'), commandHud:!!$('commandHud'), kpis:!!$('kpis'), buildingDetail:!!$('buildingDetail')});
  }catch(e){
    console.error(e);
    setSource(`Could not read workbook: ${e.message}. No workbook data was loaded.`, 'bad');
  }
}
async function loadWorkbookFile(file){
  try{
    const buf = await file.arrayBuffer();
    await loadWorkbookBuffer(buf, file.name, {kind:'manual'});
  }catch(e){
    console.error(e); setSource(`Could not read workbook: ${e.message}. No workbook data was loaded.`, 'bad');
  }
}
window.loadWorkbookFile = loadWorkbookFile;
window.loadWorkbookBuffer = loadWorkbookBuffer;
function setSource(msg, cls=''){
  const el=$('sourceStatus'); el.textContent=msg; el.className='source-status '+cls;
}

function currentTimeString(){
  const now=new Date();
  return now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function currentDateString(){
  const now=new Date();
  return now.toLocaleDateString([], {weekday:'long', month:'short', day:'numeric'});
}
function selectedBuilding(){return data.buildings.find(x=>x.Building==selected)||data.buildings[0]||{};}
window.selectedBuilding = selectedBuilding;
window.getMissionData = ()=>data;
function readinessPosture(avg){return avg>=80?'Mission Ready':avg>=55?'Watch Conditions':'Critical Review';}
function renderCommandHud(){
  const s=data.stats||{};
  const b=selectedBuilding();
  const riskLeader=topBuildingsBy('Open Risks',1)[0]||{};
  const qLeader=topBuildingsBy('Open Questions',1)[0]||{};
  const nextShutdown=(data.buildings||[]).filter(x=>Number(x.Shutdowns||0)>0).sort((a,b)=>Number(b.Shutdowns||0)-Number(a.Shutdowns||0))[0];
  $('commandHud').innerHTML=`
    <div class="hud-card mission-clock"><div class="hud-label">Mission Clock</div><div class="hud-value" id="liveClock">${currentTimeString()}</div><div class="hud-note">${currentDateString()} · Local browser time</div></div>
    <div class="hud-card"><div class="hud-label">Mission Posture</div><div class="hud-value"><span class="mission-mode-badge"><i class="pulse-dot"></i>${readinessPosture(s.avgReadiness||0)}</span></div><div class="hud-note">Campus readiness ${pct(s.avgReadiness||0)}% across ${s.total||0} buildings.</div></div>
    <div class="hud-card"><div class="hud-label">Risk Watch</div><div class="hud-value">B${esc(riskLeader.Building||'--')}</div><div class="hud-note">Top risk driver: ${riskLeader['Open Risks']||0} open risks. Questions leader: B${esc(qLeader.Building||'--')}.</div></div>
    <div class="hud-card"><div class="hud-label">Selected Building</div><div class="hud-value">B${esc(b.Building||'--')}</div><div class="hud-note">${pct(b.readinessPct||0)}% ready · ${b['Open Risks']||0} risks · ${b['Open Questions']||0} questions${nextShutdown?` · Shutdown watch B${esc(nextShutdown.Building)}`:''}</div></div>`;
}
function renderActivityFeed(){
  const b=selectedBuilding();
  const items=[
    ['Now',`B${esc(b.Building||'--')} selected in Mission PMIS.`],
    ['PMIS',`Excel engine active. ${data.stats.total||0} building rollup records loaded.`],
    ['Risk',`${Math.round(data.stats.risks||0)} open risk items visible across campus rollup.`],
    ['Brief','Command Brief generated from workbook snapshot and selected building.'],
    ['Map','Campus map markers synchronized to building readiness status.']
  ];
  const el=$('activityFeed'); if(!el) return;
  el.innerHTML='<h3>Operational Activity Feed</h3>'+items.map(x=>`<div class="activity-line"><div class="activity-time">${x[0]}</div><div class="activity-text">${x[1]}</div></div>`).join('');
}
function dismissLaunch(){const o=$('launchOverlay'); if(o) o.classList.add('hide');}
setTimeout(dismissLaunch,2600);
setInterval(()=>{const c=$('liveClock'); if(c) c.textContent=currentTimeString();},15000);

function renderKpis(){const s=data.stats;$('kpis').innerHTML=[kpi('Buildings',s.total,'rollup source'),kpi('Avg Readiness',pct(s.avgReadiness)+'%','campus health'),kpi('Ready',s.ready,'green gate'),kpi('Not Ready',s.notReady,'needs action'),kpi('Open Risks',Math.round(s.risks),'owner attention'),kpi('Open Questions',Math.round(s.questions),'field answers')].join('');}
function renderSelect(){const sel=$('buildingSelect');sel.innerHTML=data.buildings.map(b=>`<option value="${b.Building}">Building ${b.Building}</option>`).join('');sel.value=selected;sel.onchange=()=>{selected=sel.value;renderAll(false);};}
function renderTiles(){const q=($('searchBox').value||'').toLowerCase();$('tileGrid').innerHTML=data.buildings.filter(b=>('building '+b.Building+' '+b.Sheet).toLowerCase().includes(q)).map(b=>{const cls=statusClass(b);const active=b.Building==selected?' active':'';return `<div class="tile ${cls}${active}" onclick="selectBuilding('${b.Building}')"><div class="b">B${b.Building}</div><div class="r"><span style="width:${pct(b.readinessPct)}%"></span></div><div class="meta">Readiness ${pct(b.readinessPct)}%<br>Risks ${b['Open Risks']||0} | Questions ${b['Open Questions']||0}<br>Rooms ${b['Room Count']||0}</div><span class="badge">${b['Overall Status']||'Status'}</span></div>`;}).join('');}

let mapMode='operations';
let mapFilter='all';
const CAMPUS_HOTSPOTS = [
  {id:'80',x:16.5,y:13.8},{id:'82',x:7.2,y:28.5},{id:'04',x:28.3,y:26.4},{id:'05',x:44.6,y:18.8},{id:'06',x:54.0,y:18.0},{id:'07',x:62.3,y:25.2},{id:'61',x:75.5,y:22.7},{id:'62',x:84.2,y:34.4},{id:'08',x:68.7,y:41.3},{id:'09',x:62.8,y:54.4},{id:'81',x:71.6,y:54.7},{id:'12',x:71.5,y:74.2},{id:'13',x:64.8,y:79.5},{id:'14',x:58.8,y:80.2},{id:'15',x:53.6,y:80.4},{id:'16',x:47.8,y:79.5},{id:'03',x:25.0,y:50.8},{id:'18',x:14.9,y:51.2},{id:'17',x:16.1,y:58.4},{id:'01',x:29.0,y:64.4},{id:'02',x:38.2,y:65.4},{id:'78',x:42.7,y:51.5},{id:'78A',x:51.2,y:50.9},{id:'T78',x:36.5,y:52.5},{id:'10',x:52.5,y:57.6}
];

function renderMapIntelCard(){
  const host=$('mapIntelCard'); if(!host) return;
  const b=data.buildings.find(x=>x.Building==selected)||data.buildings[0]; if(!b){host.innerHTML='';return;}
  const a=b.action||{};
  const blocker=String(b['Major Blocker']||a['Why Summary']||'No major blocker documented.').slice(0,230);
  host.innerHTML=`<div><h3>Selected: Building ${esc(b.Building)} · ${pct(b.readinessPct)}%</h3><p><b>${esc(b['Overall Status']||'Status')}</b> · Risks ${esc(b['Open Risks']||0)} · Questions ${esc(b['Open Questions']||0)} · Rooms ${esc(b['Room Count']||0)}<br>${esc(blocker)}${blocker.length>=230?'…':''}</p></div><div class="intel-actions"><button class="intel-btn" type="button" onclick="jumpToDetail('Owner Risks')">Risks</button><button class="intel-btn" type="button" onclick="jumpToDetail('Open Questions')">Questions</button><button class="intel-btn" type="button" onclick="scrollTarget(document.querySelector('.detail-panel'))">Detail</button></div>`;
}
function updateMapModeUI(){
  document.querySelectorAll('[data-map-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mapMode===mapMode));
  const img=$('campusMapImage'); const note=$('engineeringNote');
  // Keep the campus map fixed as the navigation layer.
  // Engineering Site Plan now lives in Engineering Mode so it does not shrink/replace the clickable map.
  if(img){ img.src = 'assets/campus_map-2.png'; img.alt = 'Project campus map'; }
  if(note) note.style.display = mapMode==='engineering' ? 'block' : 'none';
}
function jumpToDetail(title){
  const el=$(sectionId(title));
  if(el) scrollTarget(el); else scrollTarget(document.querySelector('.detail-panel'));
}

function renderCampusIntelligence(){
  const host=$('campusIntelligence'); const strip=$('decisionStrip');
  if(!host) return;
  const by=Object.fromEntries(data.buildings.map(b=>[b.Building,b]));
  const counts={ready:0,warn:0,critical:0,nodata:0,total:CAMPUS_HOTSPOTS.length};
  CAMPUS_HOTSPOTS.forEach(h=>{const b=by[h.id]; if(!b) counts.nodata++; else counts[statusClass(b)]++;});
  const avg=pct(data.stats.avgReadiness||0);
  const topRisk=data.buildings.slice().sort((a,b)=>num(b['Open Risks'])-num(a['Open Risks']) || num(a.readinessPct)-num(b.readinessPct))[0];
  const mostQuestions=data.buildings.slice().sort((a,b)=>num(b['Open Questions'])-num(a['Open Questions']))[0];
  host.innerHTML=`<div class="intel-metric ready"><span>Ready Buildings</span><strong>${counts.ready}</strong><small>Green map markers</small></div><div class="intel-metric warn"><span>Watch Buildings</span><strong>${counts.warn}</strong><small>Needs monitoring</small></div><div class="intel-metric critical"><span>Critical Buildings</span><strong>${counts.critical}</strong><small>Priority attention</small></div><div class="intel-metric nodata"><span>Campus Health</span><strong>${avg}%</strong><small>${data.buildings.length} Excel rollup rows</small></div>`;
  if(strip){
    const r=topRisk?`Building ${esc(topRisk.Building)} carries the highest visible risk count (${esc(topRisk['Open Risks']||0)}).`: 'No risk driver found.';
    const q=mostQuestions?`Building ${esc(mostQuestions.Building)} has the most open questions (${esc(mostQuestions['Open Questions']||0)}).`: 'No open question driver found.';
    strip.innerHTML=`<div class="decision-card"><h4>Risk Driver</h4><p>${r}</p></div><div class="decision-card"><h4>Question Driver</h4><p>${q}</p></div>`;
  }
}
function updateMapFilterUI(){
  document.querySelectorAll('[data-map-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.mapFilter===mapFilter));
}

function renderCampusMap(){
  updateMapModeUI();
  updateMapFilterUI();
  renderMapIntelCard();
  renderCampusIntelligence();
  const host=$('campusHotspots'); if(!host) return;
  const by=Object.fromEntries(data.buildings.map(b=>[b.Building,b]));
  if(mapMode==='engineering'){
    host.innerHTML='';
    return;
  }
  host.innerHTML=CAMPUS_HOTSPOTS.map(h=>{
    const b=by[h.id]; const cls=b?statusClass(b):'no-data'; const active=(h.id===selected)?' active':''; const filtered=(mapFilter!=='all' && mapFilter!==cls)?' filtered-out':'';
    const label=h.id.startsWith('T')?h.id:'B'+h.id;
    const tip=b?`<strong>${label} · ${pct(b.readinessPct)}%</strong><div class="tip-meter"><i style="width:${pct(b.readinessPct)}%"></i></div><span>${esc(b['Overall Status']||'Status')} · Risks ${b['Open Risks']||0} · Questions ${b['Open Questions']||0}</span><span>Rooms ${b['Room Count']||0} · ${esc(b.Sheet||'Assessment')}</span>`:`<strong>${label}</strong><span>No active PMIS rollup row yet.</span>`;
    return `<button class="map-hotspot ${cls}${active}${filtered}" type="button" style="left:${h.x}%;top:${h.y}%" onclick="selectBuilding('${h.id}')">${label.replace('B','')}<span class="map-tip">${tip}</span></button>`;
  }).join('');
}
window.selectBuilding=(id)=>{const exists=data.buildings.some(b=>b.Building===id); if(!exists){setSource(`No PMIS rollup data found for Building ${id} in the loaded workbook.`, 'bad'); return;} selected=id;$('buildingSelect').value=id;renderAll(false);};
function sectionId(title){return 'section-'+String(title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function tradeBlock(title,text){if(!text)return'';return `<div class="section" id="${sectionId(title)}"><h3>${title}</h3><div class="bullets">${esc(text)}</div></div>`;}

function cleanStatus(v){
  const raw = String(v ?? '').trim();
  if(!raw) return 'N/A';
  const up = raw.toUpperCase();
  if(['PASS','YES','READY','COMPLETE','COMPLETED','GREEN','OK'].includes(up)) return 'PASS';
  if(['FAIL','NO','RED','NOT READY','DEFICIENT','OPEN'].includes(up)) return 'FAIL';
  if(['WATCH','YELLOW','PENDING','PARTIAL','MONITOR','IN PROGRESS'].includes(up)) return 'WATCH';
  return raw;
}
function statusTone(v){
  const s = cleanStatus(v).toUpperCase();
  if(s.includes('PASS') || s.includes('READY') || s.includes('COMPLETE') || s === 'YES') return 'pass';
  if(s.includes('FAIL') || s.includes('RED') || s.includes('NOT READY') || s.includes('DEFICIENT') || s === 'NO') return 'fail';
  if(s === 'N/A' || s === '-') return 'na';
  return 'watch';
}
function pickStatus(row, names){
  const val = first(row, names);
  return cleanStatus(val || 'N/A');
}
function renderProgressOverview(b){
  const rooms = Math.max(0, Math.round(num(b['Room Count'] || b['Rooms'])));
  const fire = pickStatus(b, ['Fire','Fire Protection','Fire Alarm','Fire / Life Safety','Fire Status']);
  const hvac = pickStatus(b, ['HVAC','HVAC / Cooling','Mechanical','Mechanical Status']);
  const electrical = pickStatus(b, ['Electrical','Electrical / UPS','Electrical Status','UPS']);
  const telecom = pickStatus(b, ['Telecom','Telecom / Fiber','Fiber','OIT','OIT Status']);
  const security = pickStatus(b, ['Security','Security / PACS / CCTV','PACS','CCTV','Security Status']);
  const cell = (label,value,extra='') => `<div class="progress-cell ${extra || statusTone(value)}"><span class="cell-label">${esc(label)}</span><span class="cell-value">${extra==='rooms' ? esc(value) : '✓ '+esc(value)}</span></div>`;
  return `<div class="progress-overview"><div class="progress-title">Progress Overview</div><div class="progress-grid">${cell('Rooms', rooms || '0', 'rooms')}${cell('Fire', fire)}<div class="progress-cell blank"></div>${cell('HVAC', hvac)}<div class="progress-cell blank"></div>${cell('Electrical', electrical)}${cell('Telecom', telecom)}<div class="progress-cell blank"></div>${cell('Security', security)}</div></div>`;
}


function valueText(v, fallback='Monitor'){
  const s = String(v ?? '').trim();
  return s || fallback;
}
function shortItems(text, max=4){
  return String(text||'').split(/\n|•|;|\.\s+/).map(x=>x.replace(/^[-–—\s]+/,'').trim()).filter(Boolean).slice(0,max);
}
function simpleStatus(v){
  const s=String(v||'').trim().toUpperCase();
  if(!s) return 'MONITOR';
  if(['PASS','PASSED','YES','READY','COMPLETE','COMPLETED','GREEN','OK'].includes(s)) return 'PASS';
  if(['FAIL','FAILED','NO','RED','NOT READY','DEFICIENT','CRITICAL'].includes(s)) return 'FAIL';
  if(['N/A','NA','NOT APPLICABLE'].includes(s)) return 'N/A';
  if(['OPEN','VERIFY','WATCH','PENDING','REVIEW','IN PROGRESS','YELLOW','MONITOR'].includes(s)) return 'WATCH';
  return s;
}
function toneFromStatus(v){
  const s=simpleStatus(v);
  if(s==='PASS') return 'pass';
  if(s==='FAIL') return 'fail';
  if(s==='N/A') return 'na';
  return 'watch';
}
function healthPct(v){
  // Trade Health is a completion/readiness percentage, not a qualitative heat score.
  // Preserve real numeric values from Excel when present and never invent mid-range
  // percentages for statuses such as Verify / Watch / N/A.
  if(typeof v === 'number' && Number.isFinite(v)){
    return Math.max(0, Math.min(100, Math.round(v <= 1 ? v * 100 : v)));
  }
  const raw=String(v ?? '').trim();
  if(/^[-+]?\d+(?:\.\d+)?%$/.test(raw)){
    return Math.max(0, Math.min(100, Math.round(Number(raw.replace('%','')) || 0)));
  }
  if(/^[-+]?\d+(?:\.\d+)?$/.test(raw)){
    const n=Number(raw);
    return Math.max(0, Math.min(100, Math.round(n <= 1 ? n * 100 : n)));
  }
  const s=simpleStatus(raw);
  if(s==='PASS') return 100;
  // FAIL, WATCH/VERIFY, N/A, blank, and other unverified states are 0% complete.
  return 0;
}
function firstVal(row,names,fallback='Monitor'){
  const v=first(row,names);
  return valueText(v,fallback);
}
function riskPosture(b){
  const risks=num(b['Open Risks']), q=num(b['Open Questions']), r=num(b.readinessPct);
  if(risks>=8 || r<.55) return 'High';
  if(risks>=4 || q>=6 || r<.8) return 'Elevated';
  if(risks>0 || q>0) return 'Monitor';
  return 'Controlled';
}
function missionAssessment(b,t,a){
  const level=riskPosture(b);
  const blocker=valueText(a['Why Summary'] || b['Major Blocker'] || t['Owner Risks'], 'No major exception detected.');
  const next=valueText(a['Next Action'] || b['Next Action'], 'Maintain monitoring and verify during the next building walk.');
  return `<div class="mission-assessment"><div class="headline">Mission Assessment</div><p>Building <b>${esc(b.Building)}</b> is at <b>${pct(b.readinessPct)}%</b> readiness with a <b>${esc(level)}</b> risk posture. ${esc(blocker)}</p><p><b>Recommended focus:</b> ${esc(next)}</p></div>`;
}
function occupancyCard(b){
  const risks=num(b['Open Risks']), q=num(b['Open Questions']), r=num(b.readinessPct);
  let rec='READY FOR PILOT', cls='';
  if(risks>=8 || r<.55){rec='NOT READY'; cls=' stop';}
  else if(risks>=4 || q>=6 || r<.8){rec='READY WITH CONDITIONS'; cls=' warning';}
  const conf=Math.max(0,Math.min(100,Math.round(r*100 - Math.min(risks,10)*1.5 - Math.min(q,10)*.8)));
  return `<div class="ops-card occupancy-card${cls}"><h3>Occupancy Recommendation</h3><p><b>${rec}</b></p><p class="mini">Confidence ${conf}% · ${risks} risks · ${q} questions</p></div>`;
}
function acceptanceGate(name,val){
  const s=simpleStatus(val);
  return `<div class="acceptance-gate ${toneFromStatus(s)}"><div class="gate-name">${esc(name)}</div><div class="gate-state">${esc(s)}</div></div>`;
}
function acceptanceGates(b){
  return `<div class="ops-card wide"><h3>Pilot Acceptance Gates</h3><div class="acceptance-grid">${acceptanceGate('Construction Ready', b['Construction Ready']||b['Overall Status'])}${acceptanceGate('OIT Readiness', b['OIT Status']||b['OIT Readiness'])}${acceptanceGate('QA / Material', b['QA / Material Status']||b['Material Compliance'])}${acceptanceGate('Owner Acceptance', b['Acceptance Status']||b['Acceptance Readiness'])}</div></div>`;
}
function timelineRow(label,val){
  const n=Math.max(0,Math.min(100,pct(val)));
  return `<div class="timeline-row"><div>${esc(label)}</div><div class="timeline-bar"><span style="width:${n}%"></span></div><div>${n}%</div></div>`;
}
function readinessTimeline(b){
  return `<div class="ops-card wide"><h3>Readiness Timeline</h3>${timelineRow('Inspection',b.readinessPct)}${timelineRow('OIT',b['OIT Readiness']||b.readinessPct)}${timelineRow('Material',b['Material Compliance']||b.readinessPct)}${timelineRow('Acceptance',b['Acceptance Readiness']||b.readinessPct)}</div>`;
}
function tradeHealth(b){
  // Do not default missing trade data to PASS. The workbook is the source of truth:
  // unverified/missing trade completion remains 0 until Excel records completion.
  const rows=[['Fire',firstVal(b,['Fire','Fire Protection','Fire Alarm'],'N/A'),'fire'],['HVAC',firstVal(b,['HVAC','Mechanical','HVAC / Cooling'],'N/A'),'hvac'],['Electrical',firstVal(b,['Electrical','Electrical / UPS'],'N/A'),'electrical'],['Telecom',firstVal(b,['Telecom','Telecom / Fiber','OIT'],'N/A'),'telecom'],['Security',firstVal(b,['Security','Security / PACS / CCTV'],'N/A'),'security']];
  return `<div class="ops-card"><h3>Trade Health</h3>${rows.map(([l,v,c])=>`<div class="trade-health-row"><div>${esc(l)}</div><div class="trade-bar ${c}"><span style="width:${healthPct(v)}%"></span></div><div>${healthPct(v)}%</div></div>`).join('')}</div>`;
}
function criticalAlerts(b,t,a){
  let items=[];
  if(b['Major Blocker']) items.push(b['Major Blocker']);
  if(a['Why Summary']) items.push(a['Why Summary']);
  items=items.concat(shortItems(t['Owner Risks'],3));
  if(!items.length) items=['No critical blocking item currently elevated.'];
  return `<div class="ops-card wide"><h3>Critical Alerts</h3>${items.slice(0,4).map(x=>`<div class="critical-item">⚠ ${esc(x)}</div>`).join('')}</div>`;
}
function actionList(b,a){
  const actions=[a['Next Action'],b['Next Action'],a['Action Required']].map(x=>valueText(x,'')).filter(Boolean);
  const unique=[...new Set(actions.length?actions:['Maintain monitoring and verify building status during next walk.'])];
  return `<div class="ops-card wide"><h3>Field Action Queue</h3>${unique.slice(0,4).map(x=>`<div class="action-item">□ ${esc(x)}</div>`).join('')}</div>`;
}
function inspectionMetrics(b){
  const metrics=[['Rooms',b['Room Count']||0],['Risks',b['Open Risks']||0],['Questions',b['Open Questions']||0],['Photos',b['Open Photos']||0],['Shutdowns',b['Shutdowns']||0],['Gate',b['Overall Status']||'Watch']];
  return `<div class="ops-card"><h3>Inspection Metrics</h3><div class="inspection-metrics">${metrics.map(([k,v])=>`<div class="metric-tile"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div></div>`;
}
function robustOps(b,t,a){
  return `${missionAssessment(b,t,a)}<div class="ops-grid">${occupancyCard(b)}${tradeHealth(b)}${acceptanceGates(b)}${readinessTimeline(b)}${criticalAlerts(b,t,a)}${actionList(b,a)}${inspectionMetrics(b)}</div>`;
}
function renderDetail(){
  const b=data.buildings.find(x=>x.Building==selected)||data.buildings[0];
  if(!b)return;
  const t=b.tradeNotes||{}; const a=b.action||{};
  $('selectedStatus').className='status-pill '+(statusClass(b)==='ready'?'green':statusClass(b)==='critical'?'red':'yellow');
  $('selectedStatus').textContent=`${b['Overall Status']||'Status'} • ${pct(b.readinessPct)}%`;
  try{
    $('buildingDetail').innerHTML=`<div class="detail-title"><div><div class="mini">Selected Building Source Detail</div><h2>Building ${b.Building}</h2><p>${b.Sheet||''}</p></div><div class="score">${pct(b.readinessPct)}%</div></div><div class="meter"><span style="width:${pct(b.readinessPct)}%"></span></div><div class="small-grid"><div class="small"><span class="mini">Risks</span><strong>${b['Open Risks']||0}</strong></div><div class="small"><span class="mini">Questions</span><strong>${b['Open Questions']||0}</strong></div><div class="small"><span class="mini">Photos</span><strong>${b['Open Photos']||0}</strong></div></div>${renderProgressOverview(b)}${robustOps(b,t,a)}<div class="section"><h3>Source Detail Notes</h3><p class="mini">Detailed rollup from PMIS_Trade_Notes and action queue.</p></div>${tradeBlock('Owner Risks',t['Owner Risks'])}${tradeBlock('Open Questions',t['Open Questions'])}${tradeBlock('Fire / Life Safety',t['Fire / Life Safety'])}${tradeBlock('HVAC / Cooling',t['HVAC / Cooling'])}${tradeBlock('Electrical / UPS',t['Electrical / UPS'])}${tradeBlock('Telecom / Fiber',t['Telecom / Fiber'])}${tradeBlock('Security / PACS / CCTV',t['Security / PACS / CCTV'])}`;
  }catch(e){
    console.error(e);
    $('buildingDetail').innerHTML=`<div class="section"><h3>Detail Panel Error</h3><p class="red">${esc(e.message)}</p></div>`;
  }
}

function topBuildingsBy(field, count=5){
  return [...data.buildings].sort((a,b)=>num(b[field])-num(a[field])).slice(0,count);
}
function briefRow(b, extra){
  const r=pct(b.readinessPct);
  return `<div class="brief-row"><b>${esc(reportBuildingLabel(b))}</b><div><div class="brief-mini-meter"><i style="width:${r}%"></i></div><span>${esc(b['Overall Status']||'Status')} · ${r}% ready</span></div><span>${esc(extra)}</span></div>`;
}
function commandBriefText(){
  const s=data.stats;
  const b=data.buildings.find(x=>x.Building==selected)||data.buildings[0]||{};
  const action=b['Next Action']||b['Major Blocker']||'Maintain monitoring and verify during the next building walk.';
  return `Mission PMIS Command Brief\nCampus readiness: ${pct(s.avgReadiness)}% across ${s.total} buildings. Ready: ${s.ready}. Watch/Not Ready: ${s.notReady}.\nSelected building: B${b.Building} — ${pct(b.readinessPct)}% ready, ${b['Open Risks']||0} risks, ${b['Open Questions']||0} questions.\nRecommended focus: ${action}`;
}
function renderCommandBrief(){
  const s=data.stats;
  const b=data.buildings.find(x=>x.Building==selected)||data.buildings[0]||{};
  const avg=pct(s.avgReadiness);
  const readyPct=s.total?Math.round((s.ready/s.total)*100):0;
  const selectedPosture=riskPosture(b||{});
  const action=b['Next Action']||b['Major Blocker']||'Maintain monitoring and verify during the next building walk.';
  const signal=statusClass(b)==='ready'?'Ready to Proceed':statusClass(b)==='critical'?'Priority Attention':'Watch / Coordinate';
  $('commandBrief').innerHTML=`<div class="brief-grid">
    <div class="brief-card"><h3>Campus Status</h3><div class="brief-number ${avg>=80?'green':avg>=55?'yellow':'red'}">${avg}%</div><p><b>${s.ready}</b> of <b>${s.total}</b> buildings are ready. ${s.notReady} remain on watch or need action.</p><div class="brief-simple-line"><b>Open Risks</b><span>${Math.round(s.risks)}</span></div><div class="brief-simple-line"><b>Open Questions</b><span>${Math.round(s.questions)}</span></div></div>
    <div class="brief-card"><h3>Selected Building</h3><div class="brief-talking-point"><b>B${esc(b.Building||'--')}</b> is at <b>${pct(b.readinessPct)}%</b> readiness with a <b>${esc(selectedPosture)}</b> risk posture.</div><div class="brief-simple-line"><b>Risks</b><span>${b['Open Risks']||0}</span></div><div class="brief-simple-line"><b>Questions</b><span>${b['Open Questions']||0}</span></div><div class="brief-simple-line"><b>Status</b><span>${esc(signal)}</span></div></div>
    <div class="brief-card"><h3>Recommended Focus</h3><p>${esc(action)}</p><p class="mini">Use this as the meeting lead-in or field walk focus.</p></div>
  </div>`;
}
async function copyCommandBrief(){
  const txt=commandBriefText();
  try{ await navigator.clipboard.writeText(txt); }
  catch(e){ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  const c=$('copyStatus'); if(c){c.style.display='block'; setTimeout(()=>c.style.display='none',1800);}
}


function fieldModeMissionText(){
  const b=selectedBuilding();
  const t=b.tradeNotes||{};
  const blockers=[];
  if(num(b['Open Risks'])>0) blockers.push(`${b['Open Risks']} open risk(s)`);
  if(num(b['Open Questions'])>0) blockers.push(`${b['Open Questions']} open question(s)`);
  if(num(b['Shutdowns'])>0) blockers.push(`${b['Shutdowns']} shutdown item(s)`);
  if(t['Owner Risks']) blockers.push('owner risk notes present');
  return blockers.length?blockers.join(' · '):'No elevated blockers shown in the current rollup.';
}
function routeBuildings(){
  const rows=[...data.buildings].sort((a,b)=>{
    const sa=(num(a['Open Risks'])*3)+(num(a['Open Questions'])*2)+(100-pct(a.readinessPct));
    const sb=(num(b['Open Risks'])*3)+(num(b['Open Questions'])*2)+(100-pct(b.readinessPct));
    return sb-sa;
  }).slice(0,5);
  return rows;
}
function renderFieldMode(){
  const b=selectedBuilding();
  const route=routeBuildings();
  const action=b['Next Action']||b['Major Blocker']||'Walk selected building, verify trade status, capture photos, and update the workbook after field review.';
  const checks=[
    'Verify selected building readiness against field conditions',
    'Review open risks before entering the building',
    'Confirm open questions that need owner or trade response',
    'Capture photos for unresolved items',
    'Update Excel workbook after the walk'
  ];
  const el=$('fieldModeContent'); if(!el) return;
  el.innerHTML=`
    <div class="field-mission-card"><h3>Current Field Mission</h3><div class="field-primary">Building ${esc(b.Building||'--')}</div><div class="field-sub">${pct(b.readinessPct||0)}% ready · ${esc(fieldModeMissionText())}</div></div>
    <div class="field-grid"><div class="field-stat"><span>Readiness</span><strong>${pct(b.readinessPct||0)}%</strong></div><div class="field-stat"><span>Risks</span><strong>${b['Open Risks']||0}</strong></div><div class="field-stat"><span>Questions</span><strong>${b['Open Questions']||0}</strong></div></div>
    <div class="field-mission-card"><h3>Action for This Walk</h3><div class="field-sub">${esc(action)}</div></div>
    <div class="field-mission-card"><h3>Inspection Checklist</h3><div class="field-checklist">${checks.map((c,i)=>`<label class="field-check"><input type="checkbox"><span>${esc(c)}</span><small>${i+1}/5</small></label>`).join('')}</div></div>
    <div class="field-mission-card"><h3>Suggested Walk Priority</h3><div class="field-route">${route.map(x=>`<div class="route-item"><b>B${esc(x.Building)}</b><span>${pct(x.readinessPct||0)}% · ${x['Open Risks']||0} risks · ${x['Open Questions']||0} questions</span></div>`).join('')}</div></div>
    <div class="field-actions"><button type="button" onclick="copyFieldBrief()">Copy Field Brief</button><button type="button" onclick="goNav('risks');closeFieldMode()">Jump to Risks</button><button type="button" onclick="goNav('questions');closeFieldMode()">Jump to Questions</button></div>`;
}
function openFieldMode(){renderFieldMode(); const d=$('fieldDrawer'); if(d){d.classList.add('open');d.setAttribute('aria-hidden','false');}}
function closeFieldMode(){const d=$('fieldDrawer'); if(d){d.classList.remove('open');d.setAttribute('aria-hidden','true');}}
async function copyFieldBrief(){
  const b=selectedBuilding();
  const txt=`Mission PMIS Field Brief
Building ${b.Building}
Readiness: ${pct(b.readinessPct||0)}%
Risks: ${b['Open Risks']||0}
Questions: ${b['Open Questions']||0}
Action: ${b['Next Action']||b['Major Blocker']||'Verify field conditions and update workbook.'}`;
  try{await navigator.clipboard.writeText(txt);}catch(e){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeFieldMode(); if(typeof closeMeetingMode==='function')closeMeetingMode(); if(typeof closeEngineeringMode==='function')closeEngineeringMode(); if(typeof closeReportsMode==='function')closeReportsMode(); if(typeof closeCorWorkspace==='function')closeCorWorkspace();}});

function renderFocus(){ $('focusList').innerHTML=(data.focus||[]).map(f=>`<div class="focus-item"><strong>Building ${f.Building}</strong> <span class="badge">Priority ${Number(f.Priority||f['Priority Score']||0).toFixed(2)}</span><p>${esc(f['Driver / Major Blocker']||f['Why Summary']||f['Major Blocker']||'')}</p><p class="mini">${esc(f['Recommended Action']||f['Next Action']||'')}</p></div>`).join(''); }
function renderAll(reset=true){renderKpis();if(reset)renderSelect();renderTiles();renderCampusMap();renderDetail();renderFocus();renderCommandBrief();renderCommandHud();renderActivityFeed();renderFieldMode();}

function activateNav(name){
  document.querySelectorAll('.mission-ribbon [data-nav]').forEach(btn=>btn.classList.toggle('active', btn.dataset.nav===name));
  if(typeof activateRail==='function') activateRail(name);
}
function scrollTarget(el){
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'start'});
  el.classList.remove('flash-section');
  void el.offsetWidth;
  el.classList.add('flash-section');
}

function renderBuildingDrawer(){
  const grid=$('buildingDrawerGrid'); if(!grid) return;
  const q=(($('buildingDrawerSearch')&&$('buildingDrawerSearch').value)||'').toLowerCase();
  const rows=data.buildings.filter(b=>('building '+b.Building+' '+(b.Sheet||'')).toLowerCase().includes(q));
  const count=$('buildingDrawerCount'); if(count) count.textContent=`${rows.length} buildings`;
  grid.innerHTML=rows.map(b=>{const cls=statusClass(b);const active=b.Building==selected?' active':'';return `<div class="drawer-building-card ${cls}${active}" onclick="selectBuilding('${b.Building}'); closeBuildingDrawer();"><div class="b">B${b.Building}</div><div class="r"><span style="width:${pct(b.readinessPct)}%"></span></div><div class="meta">Readiness ${pct(b.readinessPct)}%<br>Risks ${b['Open Risks']||0} | Questions ${b['Open Questions']||0}<br>Rooms ${b['Room Count']||0}</div><span class="badge">${esc(b['Overall Status']||'Status')}</span></div>`;}).join('') || '<div class="drawer-empty">No matching buildings found.</div>';
}
function openBuildingDrawer(){renderBuildingDrawer(); const el=$('buildingDrawer'); if(el) el.classList.add('open'); setTimeout(()=>{const s=$('buildingDrawerSearch'); if(s) s.focus();},80);}
function closeBuildingDrawer(){const el=$('buildingDrawer'); if(el) el.classList.remove('open');}

function goNav(name){
  activateNav(name);
  const detail = document.querySelector('.detail-panel');
  if(name==='mission') return scrollTarget(document.querySelector('.hero'));
  if(name==='campus') return scrollTarget($('campusSection'));
  if(name==='buildings') return openBuildingDrawer();
  if(name==='focus') return scrollTarget($('focusSection'));
  if(name==='brief') return scrollTarget($('briefSection'));
  if(name==='risks'){
    scrollTarget(detail);
    setTimeout(()=>scrollTarget($('section-owner-risks') || detail), 250);
    return;
  }
  if(name==='questions'){
    scrollTarget(detail);
    setTimeout(()=>scrollTarget($('section-open-questions') || detail), 250);
    return;
  }
}
document.querySelectorAll('.mission-ribbon [data-nav]').forEach(btn=>btn.addEventListener('click',()=>goNav(btn.dataset.nav)));

function openAbout(){const o=document.getElementById('aboutOverlay'); if(o) o.classList.add('show');}
function closeAbout(){const o=document.getElementById('aboutOverlay'); if(o) o.classList.remove('show');}
function activateRail(name){document.querySelectorAll('.app-rail [data-rail]').forEach(btn=>btn.classList.toggle('active',btn.dataset.rail===name));}

// COR Reports is a true modal workspace. Force it hidden during normal page load,
// then reveal it only from the left-rail button. Inline styles make this reliable
// even when GitHub Pages serves an older cached stylesheet.
function initializeCorWorkspace(){
  const overlay=document.getElementById('corOverlay');
  if(!overlay) return;
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden','true');
  Object.assign(overlay.style,{
    display:'none', position:'fixed', inset:'0', zIndex:'25000',
    overflow:'auto', background:'rgba(4,10,20,.96)', padding:'22px 26px 40px 96px'
  });
}
function openCorWorkspace(){
  const overlay=document.getElementById('corOverlay');
  if(!overlay){ console.error('COR Reports overlay not found.'); return; }
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden','false');
  overlay.style.display='block';
  document.body.style.overflow='hidden';
  try{
    if(typeof window.renderCorReports==='function') window.renderCorReports();
    else {
      const host=document.getElementById('corReportsContent');
      if(host) host.innerHTML='<div class="cor-summary"><h3>COR Reports</h3><p>The reporting module did not load. Refresh the page after the GitHub Pages deployment completes.</p></div>';
    }
  }catch(err){
    console.error('COR Reports render failed',err);
    const host=document.getElementById('corReportsContent');
    if(host) host.innerHTML='<div class="cor-summary"><h3>COR Reports opened</h3><p>Report rendering failed: '+esc(err.message||err)+'</p></div>';
  }
}
function closeCorWorkspace(){
  const overlay=document.getElementById('corOverlay');
  if(!overlay) return;
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden','true');
  overlay.style.display='none';
  document.body.style.overflow='';
}
window.openCorReports=openCorWorkspace;
window.closeCorReports=closeCorWorkspace;
initializeCorWorkspace();
document.querySelectorAll('.app-rail [data-rail]').forEach(btn=>btn.addEventListener('click',()=>{
  const name=btn.dataset.rail;
  activateRail(name);
  if(['mission','campus','buildings','risks','questions'].includes(name)) return goNav(name);
  if(name==='meeting') return openMeetingMode();
  if(name==='field') return openFieldMode();
  if(name==='engineering') return openEngineeringMode();
  if(name==='reports') return openReportsMode();
  if(name==='cor') return openCorWorkspace();
  if(name==='about') return openAbout();
}));


const buildingDrawerSearch=$('buildingDrawerSearch');
if(buildingDrawerSearch) buildingDrawerSearch.addEventListener('input',renderBuildingDrawer);
const buildingDrawer=$('buildingDrawer');
if(buildingDrawer) buildingDrawer.addEventListener('click',e=>{if(e.target===buildingDrawer) closeBuildingDrawer();});
document.addEventListener('keydown',e=>{if(e.key==='Escape') closeBuildingDrawer();});

$('searchBox').addEventListener('input',renderTiles);
document.querySelectorAll('[data-map-mode]').forEach(btn=>btn.addEventListener('click',()=>{
  mapMode=btn.dataset.mapMode;
  renderCampusMap();
  if(mapMode==='engineering' && typeof openEngineeringMode==='function'){ openEngineeringMode(); }
}));
document.querySelectorAll('[data-map-filter]').forEach(btn=>btn.addEventListener('click',()=>{mapFilter=btn.dataset.mapFilter;renderCampusMap();}));
$('workbookInput').addEventListener('change', e => { if(e.target.files[0]) loadWorkbookFile(e.target.files[0]); });
const dz=$('dropZone');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('hot');}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('hot');}));
dz.addEventListener('drop', e => { const file=e.dataTransfer.files[0]; if(file) loadWorkbookFile(file); });
function initializeEmptyShell(){
  data={buildings:[],focus:[],stats:buildStats([]),corReports:null,projectRegister:[],shutdowns:[],loadedAt:''};
  window.data=data;
  selected=undefined;
  renderAll(true);
  setSource('No workbook loaded • Select or drop a PMIS Excel workbook to begin.','');
}
initializeEmptyShell();
async function loadBundledWorkbook(){
  const workbookUrl = new URL('Bedford_VA_EHRM_PMIS_MASTER_v9.0 (1).xlsx', document.baseURI).toString();
  try{
    const response = await fetch(workbookUrl);
    if(!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    await loadWorkbookBuffer(buffer, 'Bedford_VA_EHRM_PMIS_MASTER_v9.0 (1).xlsx', {kind:'auto', fetchUrl:workbookUrl});
  }catch(e){
    console.error('PMIS bundled workbook auto-load failed', e);
    setSource(`Bundled workbook unavailable: ${e.message}. Use the workbook control to load a local .xlsx.`, 'bad');
  }
}
window.loadBundledWorkbook = loadBundledWorkbook;
setTimeout(()=>{ loadBundledWorkbook(); }, 0);
