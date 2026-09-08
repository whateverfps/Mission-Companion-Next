const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));

export function renderPlansSheetCard(sheet, { active = false } = {}) {
  const sheetNumber = sheet.sheetNumber || '';
  const sheetTitle = sheet.sheetTitle || '';
  const discipline = sheet.discipline || '';
  const drawingType = sheet.drawingType || sheet.primarySheetType || '';
  return `<li><button type="button" data-plans-sheet="${esc(sheet.sheetId)}" class="${active ? 'active' : ''}" ${active ? 'aria-current="true"' : ''}><strong>${esc(sheetNumber)}</strong><span>${esc(sheetTitle)}</span><small>${esc([discipline, drawingType, `PDF page ${sheet.pdfPage || sheet.pageNumber || ''}`].filter(Boolean).join(' · '))}</small></button></li>`;
}

export function renderPlansView(root, { title = 'Plans', sheets = [] } = {}) {
  root.innerHTML = `
    <section class="mc-drawing-control mc-plans-v2" aria-labelledby="plansV2Title">
      <h1 id="plansV2Title" tabindex="-1">${title}</h1>
      <div data-plans-status class="mc-plans-v2-status" role="status" aria-live="polite">Loading drawing set…</div>
      <div class="mc-drawing-layout mc-plans-v2-layout">
        <aside class="mc-drawing-index mc-plans-v2-list" aria-label="Drawing sheets">
          <label>Drawing set
            <span data-plans-drawing-set class="mc-plans-v2-drawing-set"></span>
          </label>
          <p data-plans-sheet-summary class="mc-plans-v2-sheet-summary">Select a sheet to review its details.</p>
          <ol data-plans-sheet-list aria-label="Drawing sheets list">${sheets.map(sheet => renderPlansSheetCard(sheet, { active: Boolean(sheet.active) })).join('')}</ol>
        </aside>
        <main class="mc-drawing-viewer mc-plans-v2-viewer">
          <header class="mc-drawing-sheet-title" data-plans-sheet-header aria-live="polite">
            <div>
              <span data-plans-sheet-number></span>
              <h3 data-plans-sheet-title>Loading drawing…</h3>
              <p data-plans-sheet-subtitle>Waiting for the selected sheet to render.</p>
            </div>
            <dl>
              <div><dt>Building</dt><dd data-plans-sheet-building></dd></div>
              <div><dt>Discipline</dt><dd data-plans-sheet-discipline></dd></div>
              <div><dt>Type</dt><dd data-plans-sheet-type></dd></div>
              <div><dt>Position</dt><dd data-plans-sheet-position></dd></div>
              <div><dt>Identity</dt><dd data-plans-sheet-identity></dd></div>
            </dl>
          </header>
          <div class="mc-drawing-toolbar" data-plans-toolbar>
            <div role="group" aria-label="Drawing navigation">
              <button type="button" data-plans-action="previous">Previous</button>
              <button type="button" data-plans-action="next">Next</button>
              <button type="button" data-plans-action="toggle-finder">Show Sheet Finder</button>
            </div>
            <div role="group" aria-label="Drawing view controls">
              <button type="button" data-plans-action="fit-page">Fit Page</button>
              <button type="button" data-plans-action="fit-width">Fit Width</button>
              <button type="button" data-plans-action="zoom-out">Zoom Out</button>
              <button type="button" data-plans-action="zoom-in">Zoom In</button>
              <button type="button" data-plans-action="rotate">Rotate</button>
              <button type="button" data-plans-action="reset-view">Reset View</button>
              <button type="button" data-plans-action="toggle-expand">Expand Drawing</button>
            </div>
            <output data-plans-toolbar-status aria-label="Current drawing view">Fit</output>
          </div>
          <div class="mc-drawing-stage" data-plans-stage>
            <div data-plans-viewport class="mc-plans-v2-viewport">
              <canvas data-plans-canvas aria-label="Plans PDF canvas"></canvas>
            </div>
          </div>
        </main>
        <aside id="missionPlansSheetInspector" class="mc-drawing-evidence" data-plans-inspector aria-label="Construction Intelligence"></aside>
      </div>
      <div data-plans-diagnostics class="mc-plans-v2-diagnostics" style="position: fixed; bottom: 0; left: 0; right: 0; background: #f0f0f0; border-top: 2px solid #333; padding: 10px; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; z-index: 10000; display: block;">
        <h4 style="margin: 0 0 10px 0;">Plans V2 Diagnostics (Runtime State)</h4>
        <pre data-plans-diagnostics-content style="margin: 0; white-space: pre-wrap;"></pre>
      </div>
    </section>
  `;
  return root;
}
