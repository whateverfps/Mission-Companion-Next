let activeReportType='daily';
function reportBuildingLabel(value){
  const raw = (value && typeof value === 'object') ? value.Building : value;
  const v = String(raw ?? '').trim();
  if(!v) return 'B--';
  if(/^B\d/i.test(v)) return v.toUpperCase();
  if(/^\d+$/.test(v)) return 'B' + v.padStart(2,'0');
  return v.toUpperCase();
}
function reportTopRows(field,label,count=5){
  return topBuildingsBy(field,count).map(b=>`<div class="report-row"><b>${esc(reportBuildingLabel(b))}</b><span>${esc(b['Overall Status']||b['Dashboard Signal']||'Monitor')} · ${pct(b.readinessPct||0)}% ready</span><strong class="report-chip">${esc(b[field]||0)} ${label}</strong></div>`).join('');
}
function readyBuildings(){return [...data.buildings].filter(b=>statusClass(b)==='ready').length;}
function watchBuildings(){return [...data.buildings].filter(b=>statusClass(b)==='warn').length;}
function criticalBuildings(){return [...data.buildings].filter(b=>statusClass(b)==='critical').length;}
function allBuildingsReportText(){
  const s=data.stats||{};
  const lines=[];
  lines.push('Mission PMIS All Buildings Report');
  lines.push(window.missionProjectLabel?.()||'Loaded Project Workbook');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push(`Campus Readiness: ${pct(s.avgReadiness||0)}%`);
  lines.push(`Buildings Tracked: ${s.total||0}`);
  lines.push(`Ready: ${readyBuildings()} | Watch: ${watchBuildings()} | Critical: ${criticalBuildings()}`);
  lines.push(`Open Risks: ${Math.round(s.risks||0)} | Open Questions: ${Math.round(s.questions||0)}`);
  lines.push('');
  lines.push('BUILDING ROLLUP');
  lines.push('Building | Readiness | Status | Risks | Questions | Shutdowns | Construction Ready | Acceptance');
  lines.push('---------|-----------|--------|-------|-----------|-----------|--------------------|-----------');
  [...data.buildings].sort((a,b)=>String(a.Building).localeCompare(String(b.Building),undefined,{numeric:true})).forEach(b=>{
    lines.push(`${reportBuildingLabel(b)} | ${pct(b.readinessPct||0)}% | ${b['Overall Status']||b['Dashboard Signal']||'Monitor'} | ${b['Open Risks']||0} | ${b['Open Questions']||0} | ${b.Shutdowns||0} | ${b['Construction Ready']||'No'} | ${b['Acceptance Status']||'Monitor'}`);
  });
  lines.push('');
  lines.push('TOP RISK BUILDINGS');
  topBuildingsBy('Open Risks',8).forEach(b=>lines.push(`${reportBuildingLabel(b)}: ${b['Open Risks']||0} risks · ${pct(b.readinessPct||0)}% ready · ${b['Overall Status']||'Monitor'}`));
  lines.push('');
  lines.push('TOP QUESTION BUILDINGS');
  topBuildingsBy('Open Questions',8).forEach(b=>lines.push(`${reportBuildingLabel(b)}: ${b['Open Questions']||0} questions · ${pct(b.readinessPct||0)}% ready · ${b['Overall Status']||'Monitor'}`));
  return lines.join('\n');
}
function reportOpen(v){return !['complete','completed','closed','cancelled','canceled','deferred'].includes(String(v||'').trim().toLowerCase())}
function reportMatchesBuilding(r,b){
  const clean=v=>String(v??'').trim().toUpperCase().replace(/^BUILDING\s*/,'').replace(/^B(?=\d)/,'').replace(/^0+(?=\d)/,'');
  const target=clean(b?.Building); const raw=[r?.Building,r?.['Building ID'],r?.['Affected Building'],r?.['Linked Assessment'],r?.['Assessment Sheet']].join('|');
  const vals=raw.split(/[,;|/]+/).map(clean).filter(Boolean);
  return vals.includes('ALL')||vals.includes('CAMPUS')||vals.some(v=>v===target||v.includes(target+'_ASSESSMENT'));
}
function reportRegister(){return Array.isArray(data.projectRegister)?data.projectRegister:[]}
function reportShutdowns(){return Array.isArray(data.shutdowns)?data.shutdowns:[]}
function topOpenRecords(records,count=8){
  const weight={critical:4,high:3,medium:2,low:1};
  return records.filter(r=>reportOpen(r.Status)).sort((a,b)=>(weight[String(b.Priority||'').toLowerCase()]||0)-(weight[String(a.Priority||'').toLowerCase()]||0)).slice(0,count);
}
function lineList(items,formatter,empty='None currently reported.'){
  return items.length?items.map((x,i)=>`${i+1}. ${formatter(x)}`).join('\n'):empty;
}
function reportText(type=activeReportType){
  if(type==='all') return allBuildingsReportText();
  const s=data.stats||{}; const b=selectedBuilding()||{};
  const reg=reportRegister(), shuts=reportShutdowns();
  const bReg=reg.filter(r=>reportMatchesBuilding(r,b));
  const active=reg.filter(r=>reportOpen(r.Status));
  const bActive=bReg.filter(r=>reportOpen(r.Status));
  const activeShuts=shuts.filter(r=>reportOpen(r.Status));
  const bShuts=activeShuts.filter(r=>reportMatchesBuilding(r,b));
  const decisions=active.filter(r=>String(r['COR Decision Required']||'').toLowerCase()==='yes');
  const lookAhead=active.filter(r=>String(r['Look-Ahead Item']||'').toLowerCase()==='yes');
  const overdue=active.filter(r=>Number(r['Days to Due'])<0);
  const commissioning=active.filter(r=>/commission/i.test(String(r['Record Type']||r.Category||'')));
  const payApps=active.filter(r=>/pay application|payment/i.test(String(r['Record Type']||r.Category||r.Title||'')));
  const action=b['Next Action']||b['Major Blocker']||'Maintain monitoring and verify during next field walk.';
  const heading=`Mission PMIS ${type==='executive'?'Executive Brief':type==='cm_pm'?'CM/PM Operations Report':type==='field'?'Field Walk Brief':'Daily Command Report'}\nGenerated: ${new Date().toLocaleString()}`;
  if(type==='executive') return `${heading}\n\nEXECUTIVE POSTURE\nCampus readiness: ${pct(s.avgReadiness||0)}%\nReady / Watch / Critical: ${readyBuildings()} / ${watchBuildings()} / ${criticalBuildings()}\nOpen risks: ${Math.round(s.risks||0)} | Open questions: ${Math.round(s.questions||0)}\nActive shutdowns: ${activeShuts.length}\n\nDECISIONS REQUIRED\n${lineList(decisions.slice(0,6),r=>`${r.Title||r['Record ID']} — ${r['Decision / Action Needed']||'Decision required'} (${r.Priority||'Priority not set'})`)}\n\nTOP MANAGEMENT ATTENTION\n${lineList(topOpenRecords(active,6),r=>`${r.Title||r['Record ID']} — ${r.Status||'Open'} · ${r['Assigned To']||'Unassigned'} · ${r.Building||'Campus'}`)}\n\nTWO-WEEK LOOK AHEAD\n${lineList(lookAhead.slice(0,8),r=>`${r.Title||r['Record ID']} — ${r['Decision / Action Needed']||r['GCC Recommendation']||'Advance planned work'}`)}`;
  if(type==='cm_pm') return `${heading}\n\nACTIVE MANAGEMENT REGISTER\nActive records: ${active.length}\nOverdue: ${overdue.length}\nCommissioning items: ${commissioning.length}\nPay applications: ${payApps.length}\nActive shutdowns: ${activeShuts.length}\n\nDELIVERABLES AND ACTIONS\n${lineList(topOpenRecords(active,12),r=>`${r['Record ID']||''} ${r.Title||'Untitled'} — ${r.Status||'Open'} · Owner: ${r['Assigned To']||'Unassigned'} · Due: ${r['Due Date']||'Not set'}`)}\n\nOVERDUE / SCHEDULE WATCH\n${lineList(overdue.slice(0,8),r=>`${r.Title||r['Record ID']} — ${Math.abs(Number(r['Days to Due'])||0)} day(s) overdue`)}\n\nSHUTDOWN COORDINATION\n${lineList(activeShuts.slice(0,8),r=>`${r['Shutdown ID']||r.Title||r.System||'Shutdown'} — ${r.Building||r['Affected Building']||'Campus'} · ${r.Status||'Open'} · ${r['Scheduled Date']||r.Date||'Date not set'}`)}`;
  if(type==='field') return `${heading}\n\nSELECTED BUILDING\n${reportBuildingLabel(b)} · ${pct(b.readinessPct||0)}% ready · ${b['Overall Status']||'Monitor'}\nSource assessment: ${b.Sheet||'Not identified'}\n\nFIELD VERIFICATION FOCUS\n${action}\n\nOPEN BUILDING RECORDS\n${lineList(bActive.slice(0,10),r=>`${r['Record Type']||'Item'}: ${r.Title||r['Record ID']} — ${r.Status||'Open'} · ${r['Detailed Description']||r['Decision / Action Needed']||''}`)}\n\nACTIVE BUILDING SHUTDOWNS\n${lineList(bShuts.slice(0,8),r=>`${r['Shutdown ID']||r.Title||r.System||'Shutdown'} — ${r.Status||'Open'} · ${r['Operational Impact']||r.Impact||'Impact not entered'}`)}\n\nFIELD CLOSEOUT CHECK\n1. Verify room and system conditions.\n2. Capture evidence and photos.\n3. Update risks, questions, and record status in Excel.\n4. Confirm next action and responsible party.`;
  return `${heading}\n\nTODAY'S CAMPUS POSTURE\nCampus readiness: ${pct(s.avgReadiness||0)}%\nBuildings needing action: ${watchBuildings()+criticalBuildings()}\nOpen risks / questions: ${Math.round(s.risks||0)} / ${Math.round(s.questions||0)}\nActive shutdowns: ${activeShuts.length}\n\nSELECTED BUILDING PRIORITY\n${reportBuildingLabel(b)} — ${pct(b.readinessPct||0)}% ready · ${b['Overall Status']||'Monitor'}\nPrimary action: ${action}\n\nTODAY'S ACTION QUEUE\n${lineList(topOpenRecords(active,8),r=>`${r.Title||r['Record ID']} — ${r['Assigned To']||'Unassigned'} · ${r.Status||'Open'}`)}\n\nIMMEDIATE COORDINATION\n${lineList(activeShuts.slice(0,5),r=>`${r['Shutdown ID']||r.Title||r.System||'Shutdown'} — ${r.Building||r['Affected Building']||'Campus'} · ${r.Status||'Open'}`)}`;
}
function setReportType(type){activeReportType=type;renderReportsMode();}
function reportBuildingRows(limit=null){
  const rows = [...data.buildings].sort((a,b)=>String(a.Building).localeCompare(String(b.Building),undefined,{numeric:true}));
  return (limit ? rows.slice(0,limit) : rows)
    .map(b=>{
      const cls=statusClass(b);
      return `<tr><td><span class="report-health-dot ${cls}"></span><b>${esc(reportBuildingLabel(b))}</b></td><td>${pct(b.readinessPct||0)}%</td><td>${esc(b['Overall Status']||b['Dashboard Signal']||'Monitor')}</td><td>${esc(b['Open Risks']||0)}</td><td>${esc(b['Open Questions']||0)}</td><td>${esc(b.Shutdowns||0)}</td></tr>`;
    }).join('');
}
function renderReportsMode(){
  const s=data.stats||{}; const b=selectedBuilding()||{}; const el=document.getElementById('reportsContent'); if(!el) return;
  const reg=reportRegister(), shuts=reportShutdowns();
  const active=reg.filter(r=>reportOpen(r.Status));
  const bActive=active.filter(r=>reportMatchesBuilding(r,b));
  const action=b['Next Action']||b['Major Blocker']||'Continue field verification and update assessment source sheet.';
  const titles={daily:'Daily Command Report',executive:'Executive Brief',field:'Field Walk Brief',cm_pm:'CM/PM Operations',all:'All Buildings Report'};
  let contextTitle='Selected Building Talking Point', contextHtml=`<div class="report-note">${esc(reportBuildingLabel(b))} is ${pct(b.readinessPct||0)}% ready. Current focus: ${esc(action)}</div>`;
  if(activeReportType==='executive'){
    const decisions=active.filter(r=>String(r['COR Decision Required']||'').toLowerCase()==='yes').slice(0,6);
    contextTitle='Leadership Decisions and Attention';
    contextHtml=decisions.length?`<ul class="report-context-list">${decisions.map(r=>`<li><b>${esc(r.Title||r['Record ID'])}</b><span>${esc(r['Decision / Action Needed']||r.Status||'Decision required')}</span></li>`).join('')}</ul>`:'<div class="report-note">No COR decisions are currently flagged in the Project Register.</div>';
  }else if(activeReportType==='cm_pm'){
    contextTitle='Active Management Queue';
    contextHtml=active.length?`<ul class="report-context-list">${topOpenRecords(active,8).map(r=>`<li><b>${esc(r['Record ID']||'')} ${esc(r.Title||'Untitled')}</b><span>${esc(r.Status||'Open')} · ${esc(r['Assigned To']||'Unassigned')} · ${esc(r['Due Date']||'No due date')}</span></li>`).join('')}</ul>`:'<div class="report-note">No active management records are currently reported.</div>';
  }else if(activeReportType==='field'){
    contextTitle=`${esc(reportBuildingLabel(b))} Field Verification Queue`;
    contextHtml=bActive.length?`<ul class="report-context-list">${bActive.slice(0,8).map(r=>`<li><b>${esc(r['Record Type']||'Item')} · ${esc(r.Title||r['Record ID'])}</b><span>${esc(r['Detailed Description']||r['Decision / Action Needed']||r.Status||'')}</span></li>`).join('')}</ul>`:`<div class="report-note">${esc(action)}</div>`;
  }else if(activeReportType==='all'){
    contextTitle='Campus Management Attention';
    contextHtml=`<div class="report-note">${criticalBuildings()} critical and ${watchBuildings()} watch-status buildings are currently reported.</div>`;
  }
  el.innerHTML=`
    <div class="report-workspace">
      <aside class="report-side">
        <div class="report-side-title">Report Type</div>
        <div class="report-type-grid">
          <div class="report-type ${activeReportType==='daily'?'active':''}" onclick="setReportType('daily')"><strong>Daily Command Report</strong><span>Immediate campus posture and today's coordination queue.</span></div>
          <div class="report-type ${activeReportType==='executive'?'active':''}" onclick="setReportType('executive')"><strong>Executive Brief</strong><span>Leadership health, decisions required, and forward look.</span></div>
          <div class="report-type ${activeReportType==='cm_pm'?'active':''}" onclick="setReportType('cm_pm')"><strong>CM/PM Operations</strong><span>Deliverables, owners, due dates, shutdowns, and schedule watch.</span></div>
          <div class="report-type ${activeReportType==='field'?'active':''}" onclick="setReportType('field')"><strong>Field Walk Brief</strong><span>Selected-building verification and follow-up records.</span></div>
          <div class="report-type ${activeReportType==='all'?'active':''}" onclick="setReportType('all')"><strong>All Buildings Report</strong><span>Campus-wide readiness comparison and management attention.</span></div>
        </div>
        <div class="report-print-note">The preview and <b>Print Current</b> now follow the selected report type.</div>
      </aside>
      <main>
        <div class="report-kpis">
          <div class="report-kpi"><span>Readiness</span><strong>${pct(s.avgReadiness||0)}%</strong></div>
          <div class="report-kpi"><span>Active Register</span><strong>${active.length}</strong></div>
          <div class="report-kpi"><span>Active Shutdowns</span><strong>${shuts.filter(r=>reportOpen(r.Status)).length}</strong></div>
          <div class="report-kpi"><span>Selected Building</span><strong>${esc(reportBuildingLabel(b))}</strong></div>
        </div>
        <div class="report-current-title"><span>Current preview</span><strong>${esc(titles[activeReportType]||titles.daily)}</strong></div>
        <div class="report-grid">
          <div class="report-card"><h3>${esc(titles[activeReportType]||titles.daily)}</h3><div class="report-preview">${esc(reportText(activeReportType))}</div></div>
          <div class="report-card"><h3>${contextTitle}</h3>${contextHtml}<h3 style="margin-top:16px">${activeReportType==='all'?'Full Campus Rollup':'Campus Building Snapshot'}</h3><table class="report-building-table"><thead><tr><th>Building</th><th>Ready</th><th>Status</th><th>Risks</th><th>Q's</th><th>SD</th></tr></thead><tbody>${reportBuildingRows(activeReportType==='all'?null:10)}</tbody></table></div>
        </div>
      </main>
    </div>`;
}
function openReportsMode(){renderReportsMode();document.getElementById('reportOverlay')?.classList.add('show');}
function closeReportsMode(){document.getElementById('reportOverlay')?.classList.remove('show');}

function printHtmlDocument(title, bodyHtml, options={}){
  const w=window.open('', '_blank');
  if(!w){ alert('Your browser blocked the report window. Allow popups for this site, then select Print again.'); return; }
  const reportType=options.reportType||title;
  const preparedBy=options.preparedBy||'GCC Owner QA/QC Team';
  const generated=new Date().toLocaleString();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:letter portrait;margin:18mm 14mm 18mm 14mm}
    *{box-sizing:border-box}html,body{background:#fff;color:#172033}body{font-family:Arial,Helvetica,sans-serif;margin:0;line-height:1.42;font-size:10.5pt}
    .print-shell{max-width:100%;margin:0 auto}.print-header{border-bottom:3px solid #17365d;padding:0 0 10px;margin:0 0 16px;display:flex;justify-content:space-between;gap:18px;align-items:flex-end}
    .brand{font-size:9pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#2f75b5}.print-header h1{font-size:20pt;line-height:1.08;margin:3px 0 2px;color:#17365d}.subtitle{font-size:10pt;color:#53657a}.header-meta{text-align:right;font-size:8.5pt;color:#53657a;white-space:nowrap}
    h2{font-size:13pt;color:#17365d;margin:20px 0 8px;border-bottom:1px solid #aebdcb;padding-bottom:4px;break-after:avoid-page}h3{font-size:11pt;margin:14px 0 6px;break-after:avoid-page}
    p,li{orphans:3;widows:3}.friendly-note{background:#f3f7fb;border-left:4px solid #2f75b5;padding:10px 12px;margin:10px 0 14px;border-radius:0 6px 6px 0}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 18px}.kpi{border:1px solid #b8c5d2;padding:9px 10px;border-radius:7px;background:#f8fafc;break-inside:avoid}.kpi span{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.06em;color:#65788e}.kpi b{display:block;font-size:17pt;color:#17365d;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:8.4pt;margin:6px 0 14px;table-layout:auto}thead{display:table-header-group}tr{break-inside:avoid-page}th,td{border:1px solid #cfd8e2;padding:5px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf0f6;color:#17365d;font-size:7.4pt;text-transform:uppercase;letter-spacing:.04em}.section{break-inside:auto}.section.page-break{break-before:page}.avoid-break{break-inside:avoid-page}
    .empty{color:#68798b;font-style:italic;padding:8px 0}.status-line{font-size:9pt;color:#53657a;margin:0 0 10px}.report-pre{white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:10pt;margin:0}
    .print-footer{position:fixed;bottom:-12mm;left:0;right:0;border-top:1px solid #aebdcb;padding-top:4px;font-size:7.5pt;color:#65788e;display:flex;justify-content:space-between}.screen-only{display:none!important}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-shell{width:100%}.print-header{margin-top:0}.no-print{display:none!important}}
  </style></head><body><div class="print-shell"><header class="print-header"><div><div class="brand">Mission PMIS</div><h1>${esc(reportType)}</h1><div class="subtitle">${esc(window.missionProjectLabel?.()||"Loaded Project Workbook")}</div></div><div class="header-meta">Generated: ${esc(generated)}<br>Prepared by: ${esc(preparedBy)}</div></header>${bodyHtml}<footer class="print-footer"><span>Mission PMIS · Owner Project Management Information System</span><span>Version 2.0.4</span></footer></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script></body></html>`);
  w.document.close();
}
function printSelectedReport(){
  if(activeReportType==='all'){ printAllBuildingsReport(); return; }
  const b=selectedBuilding()||{};
  const typeLabel=activeReportType==='executive'?'Executive Brief':activeReportType==='cm_pm'?'CM/PM Operations Report':activeReportType==='field'?'Field Walk Brief':'Daily Command Report';
  const txt=reportText(activeReportType);
  const action=b['Next Action']||b['Major Blocker']||'Continue verification and update the source assessment as conditions develop.';
  const body=`<div class="friendly-note"><b>Current focus:</b> ${esc(action)}</div><section class="section"><h2>Report Narrative</h2><pre class="report-pre">${esc(txt)}</pre></section>`;
  printHtmlDocument(`Mission PMIS ${typeLabel}`,body,{reportType:typeLabel});
}
function printAllBuildingsReport(){
  const s=data.stats||{};
  const buildings=[...data.buildings].sort((a,b)=>String(a.Building).localeCompare(String(b.Building),undefined,{numeric:true}));
  const rows=buildings.map(b=>`<tr><td><b>${esc(reportBuildingLabel(b))}</b></td><td>${pct(b.readinessPct||0)}%</td><td>${esc(b['Overall Status']||b['Dashboard Signal']||'Monitor')}</td><td>${esc(b['Open Risks']||0)}</td><td>${esc(b['Open Questions']||0)}</td><td>${esc(b.Shutdowns||0)}</td><td>${esc(b['Construction Ready']||'No')}</td><td>${esc(b['Acceptance Status']||'Monitor')}</td><td>${esc(b['Next Action']||b['Major Blocker']||'Continue monitoring.')}</td></tr>`).join('');
  const topRisks=topBuildingsBy('Open Risks',8).filter(b=>Number(b['Open Risks']||0)>0).map(b=>`<li><b>${esc(reportBuildingLabel(b))}</b> — ${esc(b['Open Risks']||0)} open risk${Number(b['Open Risks']||0)===1?'':'s'}; ${pct(b.readinessPct||0)}% ready.</li>`).join('')||'<li>No open building risks are currently reported.</li>';
  const topQs=topBuildingsBy('Open Questions',8).filter(b=>Number(b['Open Questions']||0)>0).map(b=>`<li><b>${esc(reportBuildingLabel(b))}</b> — ${esc(b['Open Questions']||0)} open question${Number(b['Open Questions']||0)===1?'':'s'}; ${pct(b.readinessPct||0)}% ready.</li>`).join('')||'<li>No open building questions are currently reported.</li>';
  const body=`<div class="friendly-note">This report provides a campus-wide operational snapshot. Detailed conditions remain controlled by the building assessment sheets and supporting registers.</div><div class="kpis"><div class="kpi"><span>Campus Readiness</span><b>${pct(s.avgReadiness||0)}%</b></div><div class="kpi"><span>Buildings Tracked</span><b>${s.total||buildings.length||0}</b></div><div class="kpi"><span>Open Risks</span><b>${Math.round(s.risks||0)}</b></div><div class="kpi"><span>Open Questions</span><b>${Math.round(s.questions||0)}</b></div></div><section class="section"><h2>Building Readiness Rollup</h2><table><thead><tr><th>Building</th><th>Ready</th><th>Status</th><th>Risks</th><th>Questions</th><th>Shutdowns</th><th>Construction Ready</th><th>Acceptance</th><th>Primary Action</th></tr></thead><tbody>${rows}</tbody></table></section><section class="section page-break"><h2>Management Attention</h2><h3>Highest Open Risk Counts</h3><ol>${topRisks}</ol><h3>Highest Open Question Counts</h3><ol>${topQs}</ol></section>`;
  printHtmlDocument('Mission PMIS All Buildings Report', body,{reportType:'All Buildings Status Report'});
}

window.printHtmlDocument=printHtmlDocument;

async function copyReportsBrief(){
  const txt=reportText(activeReportType);
  try{await navigator.clipboard.writeText(txt);}catch(e){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
  const c=document.getElementById('reportsCopyStatus'); if(c){c.style.display='block'; setTimeout(()=>c.style.display='none',1800);}
}
const reportOverlay=document.getElementById('reportOverlay'); if(reportOverlay) reportOverlay.addEventListener('click',e=>{if(e.target===reportOverlay) closeReportsMode();});
document.addEventListener('keydown',e=>{if(e.key==='Escape') closeReportsMode();});
const renderAll_107 = renderAll;
renderAll = function(reset=true){renderAll_107(reset); if(document.getElementById('reportOverlay')?.classList.contains('show')) renderReportsMode();};

// 1.0.8 overlay cleanup: click outside a board closes the active mode without touching workbook logic.
['meetingOverlay','engineeringOverlay','reportOverlay'].forEach(id=>{
  const el=document.getElementById(id);
  if(el){ el.addEventListener('click', ev=>{ if(ev.target===el){ el.classList.remove('show'); } }); }
});
