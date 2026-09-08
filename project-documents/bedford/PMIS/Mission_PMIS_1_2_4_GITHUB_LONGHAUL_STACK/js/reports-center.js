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
  lines.push('Bedford VA Medical Center');
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
function reportText(type=activeReportType){
  if(type==='all') return allBuildingsReportText();
  const s=data.stats||{}; const b=selectedBuilding()||{};
  const label=type==='executive'?'Executive':type==='field'?'Field':'Daily';
  const action=b['Next Action']||b['Major Blocker']||'Maintain monitoring and verify during next field walk.';
  const base=`Mission PMIS ${label} Report\nBedford VA Medical Center\nGenerated: ${new Date().toLocaleString()}\n\nCampus Readiness: ${pct(s.avgReadiness||0)}%\nBuildings Tracked: ${s.total||0}\nReady: ${readyBuildings()}\nWatch: ${watchBuildings()}\nCritical: ${criticalBuildings()}\nOpen Risks: ${Math.round(s.risks||0)}\nOpen Questions: ${Math.round(s.questions||0)}\n\nSelected Building: ${reportBuildingLabel(b)}\nReadiness: ${pct(b.readinessPct||0)}%\nStatus: ${b['Overall Status']||b['Dashboard Signal']||'Monitor'}\nConstruction Ready: ${b['Construction Ready']||'No'}\nAcceptance: ${b['Acceptance Status']||'Monitor'}\nRisks: ${b['Open Risks']||0}\nQuestions: ${b['Open Questions']||0}\nShutdowns: ${b.Shutdowns||0}\n\nPrimary Action: ${action}`;
  if(type==='executive') return base+`\n\nExecutive Focus:\n- Confirm buildings with critical risk posture.\n- Drive closure of high-risk open questions.\n- Use selected building status for meeting talking points.`;
  if(type==='field') return base+`\n\nField Walk Focus:\n- Verify readiness conditions in the selected building.\n- Capture photos for open conditions.\n- Update risk/question status in the Excel assessment source sheet.`;
  return base+`\n\nDaily Focus:\n- Review campus readiness.\n- Walk the selected building.\n- Close or update open risks/questions before end of day.`;
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
  const action=b['Next Action']||b['Major Blocker']||'Continue field verification and update assessment source sheet.';
  const selectedNote=`${esc(reportBuildingLabel(b))} is ${pct(b.readinessPct||0)}% ready with ${esc(b['Open Risks']||0)} risks and ${esc(b['Open Questions']||0)} open questions. Current focus: ${esc(action)}`;
  el.innerHTML=`
    <div class="report-workspace">
      <aside class="report-side">
        <div class="report-side-title">Report Type</div>
        <div class="report-type-grid">
          <div class="report-type ${activeReportType==='daily'?'active':''}" onclick="setReportType('daily')"><strong>Daily Command Report</strong><span>Morning sync, PMIS posture, and selected building action.</span></div>
          <div class="report-type ${activeReportType==='executive'?'active':''}" onclick="setReportType('executive')"><strong>Executive Summary</strong><span>Leadership-ready campus posture and decision focus.</span></div>
          <div class="report-type ${activeReportType==='field'?'active':''}" onclick="setReportType('field')"><strong>Field Walk Brief</strong><span>Site-walk oriented inspection notes and action checklist.</span></div>
          <div class="report-type ${activeReportType==='all'?'active':''}" onclick="setReportType('all')"><strong>All Buildings Report</strong><span>Campus-wide building rollup for printing or PDF export.</span></div>
        </div>
        <div class="report-print-note">Use <b>Print All Buildings</b> for the full campus report. In the print dialog, choose “Save as PDF” if you want a shareable file.</div>
      </aside>
      <main>
        <div class="report-kpis">
          <div class="report-kpi"><span>Readiness</span><strong>${pct(s.avgReadiness||0)}%</strong></div>
          <div class="report-kpi"><span>Ready</span><strong>${readyBuildings()}</strong></div>
          <div class="report-kpi"><span>Risks</span><strong>${Math.round(s.risks||0)}</strong></div>
          <div class="report-kpi"><span>Questions</span><strong>${Math.round(s.questions||0)}</strong></div>
        </div>
        <div class="report-grid">
          <div class="report-card"><h3>${activeReportType==='all'?'All Buildings Report Preview':'Current Report Preview'}</h3><div class="report-preview">${esc(reportText(activeReportType))}</div></div>
          <div class="report-card"><h3>Selected Building Talking Point</h3><div class="report-note">${selectedNote}</div><h3 style="margin-top:16px">Campus Building Rollup</h3><table class="report-building-table"><thead><tr><th>Building</th><th>Ready</th><th>Status</th><th>Risks</th><th>Q's</th><th>SD</th></tr></thead><tbody>${reportBuildingRows(activeReportType==='all'?null:12)}</tbody></table></div>
        </div>
      </main>
    </div>`;
}
function openReportsMode(){renderReportsMode();document.getElementById('reportOverlay')?.classList.add('show');}
function closeReportsMode(){document.getElementById('reportOverlay')?.classList.remove('show');}

function printHtmlDocument(title, bodyHtml){
  const w=window.open('', '_blank');
  if(!w){ alert('Popup blocked. Allow popups for this file to print reports.'); return; }
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:28px;line-height:1.35}
    h1{font-size:24px;margin:0 0 4px} h2{font-size:16px;margin:22px 0 8px;border-bottom:1px solid #999;padding-bottom:4px}
    .meta{color:#555;margin-bottom:18px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0 18px}.kpi{border:1px solid #bbb;padding:10px;border-radius:8px}.kpi b{display:block;font-size:20px}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}th{background:#f1f5f9;font-size:10px;text-transform:uppercase;letter-spacing:.06em} .page-break{page-break-before:always}
    @media print{button{display:none}body{margin:18mm}}
  </style></head><body>${bodyHtml}<script>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  w.document.close();
}
function printSelectedReport(){
  const txt=reportText(activeReportType);
  printHtmlDocument('Mission PMIS Report', `<h1>Mission PMIS Report</h1><div class="meta">Bedford VA Medical Center · ${new Date().toLocaleString()}</div><pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:12px">${esc(txt)}</pre>`);
}
function printAllBuildingsReport(){
  const s=data.stats||{};
  const rows=[...data.buildings].sort((a,b)=>String(a.Building).localeCompare(String(b.Building),undefined,{numeric:true})).map(b=>`<tr><td><b>${esc(reportBuildingLabel(b))}</b></td><td>${pct(b.readinessPct||0)}%</td><td>${esc(b['Overall Status']||b['Dashboard Signal']||'Monitor')}</td><td>${esc(b['Open Risks']||0)}</td><td>${esc(b['Open Questions']||0)}</td><td>${esc(b.Shutdowns||0)}</td><td>${esc(b['Construction Ready']||'No')}</td><td>${esc(b['Acceptance Status']||'Monitor')}</td><td>${esc(b['Next Action']||b['Major Blocker']||'')}</td></tr>`).join('');
  const topRisks=topBuildingsBy('Open Risks',8).map(b=>`<li>${esc(reportBuildingLabel(b))} — ${esc(b['Open Risks']||0)} risks, ${pct(b.readinessPct||0)}% ready</li>`).join('');
  const topQs=topBuildingsBy('Open Questions',8).map(b=>`<li>${esc(reportBuildingLabel(b))} — ${esc(b['Open Questions']||0)} questions, ${pct(b.readinessPct||0)}% ready</li>`).join('');
  const body=`<h1>Mission PMIS All Buildings Report</h1><div class="meta">Bedford VA Medical Center · Generated ${new Date().toLocaleString()}</div><div class="kpis"><div class="kpi">Campus Readiness<b>${pct(s.avgReadiness||0)}%</b></div><div class="kpi">Buildings<b>${s.total||0}</b></div><div class="kpi">Open Risks<b>${Math.round(s.risks||0)}</b></div><div class="kpi">Open Questions<b>${Math.round(s.questions||0)}</b></div></div><h2>Building Rollup</h2><table><thead><tr><th>Building</th><th>Ready</th><th>Status</th><th>Risks</th><th>Questions</th><th>Shutdowns</th><th>Const. Ready</th><th>Acceptance</th><th>Primary Action</th></tr></thead><tbody>${rows}</tbody></table><h2 class="page-break">Top Risk Buildings</h2><ol>${topRisks}</ol><h2>Top Question Buildings</h2><ol>${topQs}</ol>`;
  printHtmlDocument('Mission PMIS All Buildings Report', body);
}

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
