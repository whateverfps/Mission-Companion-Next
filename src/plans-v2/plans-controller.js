import { createPlansStore } from './plans-store.js';
import { createPlansPdfViewer } from './pdf-viewer.js';
import { createPlansSheetInspector } from './sheet-inspector.js';
import { renderPlansView, renderPlansSheetCard } from './plans-view.js';

const clone = value => {
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value ?? null)); }
};

const sheetIdentity = sheet => `${String(sheet?.sheetId || '')}:${String(sheet?.pageNumber || '')}`;

export function createPlansController({
  root,
  specificationIndex,
  requirementsResolver,
  buildPanelModel,
  panelMarkup,
  initialAnalysis = null,
  initialSheetId = '',
  sourceResolver = async () => null,
  onViewSource = () => {},
  drawingSpecificationLinks = null,
  bedfordDrawingSets = [],
  createPdfViewer = createPlansPdfViewer,
  createInspector = createPlansSheetInspector,
  renderView = renderPlansView
} = {}) {
  // Visual marker to prove Plans V2 is running
  if (document.title) {
    document.title = 'PLANS V2 WORKSPACE';
  }
  
  const store = createPlansStore({
    projectId: initialAnalysis?.projectId || '',
    drawingSetId: initialAnalysis?.drawingSetId || '',
    sheets: []
  });
  
  const resolveBedfordDrawingSet = value => {
    const needle = String(value ?? '').trim();
    return bedfordDrawingSets.find(set =>
      set.documentId === needle ||
      set.drawingSetId === needle ||
      set.buildingId === needle ||
      set.sourceFileName === needle
    ) || null;
  };

  const fallbackBedfordDrawingSet = {
    buildingId: '61',
    documentId: 'bedford-b61-drawings',
    drawingSetId: 'bedford-b61',
    sourceFileName: '518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
    catalogPath: 'project-data/bedford/drawing-catalogs/building-61.json',
    relationshipsPath: 'project-data/bedford/relationships/building-61-spec-links.json'
  };

  let activeBedfordDrawingSet = resolveBedfordDrawingSet(initialAnalysis?.documentId) || resolveBedfordDrawingSet(initialAnalysis?.drawingSetId) || bedfordDrawingSets[0] || fallbackBedfordDrawingSet;
  let bedfordDrawingCatalog = null;
  let bedfordSpecLinks = null;

  (async () => {
    try {
      const catalogResponse = await fetch(new URL(activeBedfordDrawingSet.catalogPath, document.baseURI).toString());
      if (catalogResponse && catalogResponse.ok) {
        bedfordDrawingCatalog = await catalogResponse.json();
      } else {
        console.error('[Plans V2] Failed to load Bedford catalog:', catalogResponse?.status, activeBedfordDrawingSet.catalogPath);
      }
    } catch (error) {
      console.error('[Plans V2] Error loading Bedford catalog:', error);
    }

    try {
      const specLinksResponse = await fetch(new URL(activeBedfordDrawingSet.relationshipsPath, document.baseURI).toString());
      if (specLinksResponse && specLinksResponse.ok) {
        bedfordSpecLinks = await specLinksResponse.json();
      } else {
        console.error('[Plans V2] Failed to load Bedford spec links:', specLinksResponse?.status, activeBedfordDrawingSet.relationshipsPath);
      }
    } catch (error) {
      console.error('[Plans V2] Error loading Bedford spec links:', error);
    }
  })();
  
  const view = renderView(root, { title: 'Plans', sheets: [] });
  const statusNode = () => view.querySelector('[data-plans-status]');
  const sheetListNode = () => view.querySelector('[data-plans-sheet-list]');
  const stageNode = () => view.querySelector('[data-plans-stage]');
  const inspectorNode = () => view.querySelector('[data-plans-inspector]');
  const layoutNode = () => view.querySelector('.mc-drawing-layout');
  const headerNode = () => view.querySelector('[data-plans-sheet-header]');
  const sheetNumberNode = () => view.querySelector('[data-plans-sheet-number]');
  const sheetTitleNode = () => view.querySelector('[data-plans-sheet-title]');
  const sheetSubtitleNode = () => view.querySelector('[data-plans-sheet-subtitle]');
  const sheetBuildingNode = () => view.querySelector('[data-plans-sheet-building]');
  const sheetDisciplineNode = () => view.querySelector('[data-plans-sheet-discipline]');
  const sheetTypeNode = () => view.querySelector('[data-plans-sheet-type]');
  const sheetPositionNode = () => view.querySelector('[data-plans-sheet-position]');
  const sheetIdentityNode = () => view.querySelector('[data-plans-sheet-identity]');
  const toolbarStatusNode = () => view.querySelector('[data-plans-toolbar-status]');
  const drawingSetNode = () => view.querySelector('[data-plans-drawing-set]');
  const sheetSummaryNode = () => view.querySelector('[data-plans-sheet-summary]');
  const diagnosticsNode = () => view.querySelector('[data-plans-diagnostics]');
  const diagnosticsContentNode = () => view.querySelector('[data-plans-diagnostics-content]');
  let pdfViewer = createPdfViewer({ root: stageNode(), sourceLoader: sourceResolver });
  let inspector = createInspector({ 
    root: inspectorNode(), 
    requirementsResolver, 
    specificationIndex, 
    buildPanelModel, 
    panelMarkup, 
    onViewSource,
    onDiagnosticsUpdate: (diagData) => {
      diagnostics.sheetInspector = {
        pageNumber: diagData.pageNumber,
        pageId: diagData.pageId,
        sheetNumber: diagData.sheetNumber,
        building: diagData.building,
        confirmedCount: diagData.confirmedCount,
        suggestedCount: diagData.suggestedCount,
        specLinksCount: diagData.specLinksCount
      };
      updateDiagnosticsPanel();
    }
  });
  let activeGeneration = 0;
  let currentAnalysis = initialAnalysis || null;
  let currentSource = null;
  let currentZoom = 1;
  let initialized = false;
  let destroyed = false;
  
  // Diagnostics state for debugging
  const diagnostics = {
    currentAnalysis: { documentId: null, selectedPage: null, sheetsCount: 0 },
    normalizeSheet: { pageNumber: null, pageId: null, sheetId: null, sheetNumber: null, building: null },
    updateHeader: { pageNumber: null, pageId: null, sheetNumber: null, sheetTitle: null, building: null, discipline: null, drawingType: null },
    selectSheet: { pageNumber: null, pageId: null, sheetId: null, sheetNumber: null },
    sheetInspector: { pageNumber: null, pageId: null, sheetNumber: null, building: null, confirmedCount: 0, suggestedCount: 0, specLinksCount: 0 }
  };
  
  const updateDiagnosticsPanel = () => {
    const diagNode = diagnosticsNode();
    const contentNode = diagnosticsContentNode();
    if (!diagNode || !contentNode) return;
    
    const output = {
      'currentAnalysis.documentId': diagnostics.currentAnalysis.documentId,
      'currentAnalysis.selectedPage': diagnostics.currentAnalysis.selectedPage,
      'currentAnalysis.sheetsCount': diagnostics.currentAnalysis.sheetsCount,
      'normalizeSheet.pageNumber': diagnostics.normalizeSheet.pageNumber,
      'normalizeSheet.pageId': diagnostics.normalizeSheet.pageId,
      'normalizeSheet.sheetId': diagnostics.normalizeSheet.sheetId,
      'normalizeSheet.sheetNumber': diagnostics.normalizeSheet.sheetNumber,
      'updateHeader.pageNumber': diagnostics.updateHeader.pageNumber,
      'updateHeader.pageId': diagnostics.updateHeader.pageId,
      'updateHeader.sheetNumber': diagnostics.updateHeader.sheetNumber,
      'updateHeader.sheetTitle': diagnostics.updateHeader.sheetTitle,
      'updateHeader.building': diagnostics.updateHeader.building,
      'updateHeader.discipline': diagnostics.updateHeader.discipline,
      'updateHeader.drawingType': diagnostics.updateHeader.drawingType,
      'selectSheet.pageNumber': diagnostics.selectSheet.pageNumber,
      'selectSheet.pageId': diagnostics.selectSheet.pageId,
      'selectSheet.sheetId': diagnostics.selectSheet.sheetId,
      'selectSheet.sheetNumber': diagnostics.selectSheet.sheetNumber,
      'sheet-inspector.pageNumber': diagnostics.sheetInspector.pageNumber,
      'sheet-inspector.pageId': diagnostics.sheetInspector.pageId,
      'sheet-inspector.sheetNumber': diagnostics.sheetInspector.sheetNumber,
      'sheet-inspector.building': diagnostics.sheetInspector.building,
      'specificationLinks.count': diagnostics.sheetInspector.specLinksCount,
      'confirmed.requirements': diagnostics.sheetInspector.confirmedCount,
      'suggested.requirements': diagnostics.sheetInspector.suggestedCount
    };
    
    // Always show panel for debugging
    diagNode.style.display = 'block';
    contentNode.textContent = Object.entries(output)
      .map(([key, value]) => `${key}: ${value ?? 'NULL'}`)
      .join('\n');
  };

  const setStatus = (text, state = 'loading') => {
    const node = statusNode();
    if (!node) return;
    node.dataset.state = state;
    node.textContent = text;
  };

  const normalizeSheet = sheet => {
    if (!sheet) return null;
    
    // Use authoritative catalog data based on PDF page number
    let building61Sheet = null;
    if (bedfordDrawingCatalog && sheet.pdfPage) {
      building61Sheet = bedfordDrawingCatalog.sheets.find(s => s.pdfPageNumber === sheet.pdfPage);
    }
    
    const analysisSheet = currentAnalysis?.sheets?.find(item => item.sheetId === sheet.sheetId || Number(item.pageNumber) === Number(sheet.pageNumber) || item.pageId === sheet.pageId) || null;
    
    // Use Bedford catalog data if available, otherwise fallback to analysis/snapshot
    const canonicalPageId = building61Sheet?.pageId || sheet.pageId || analysisSheet?.pageId || '';
    const sheetNumber = building61Sheet?.sheetNumber || sheet.sheetNumber || analysisSheet?.sheetNumber || '';
    const sheetTitle = building61Sheet?.sheetTitle || sheet.sheetTitle || analysisSheet?.sheetTitle || '';
    const discipline = building61Sheet?.discipline || sheet.discipline || analysisSheet?.discipline || '';
    const drawingType = building61Sheet?.drawingType || sheet.drawingType || sheet.primarySheetType || analysisSheet?.drawingType || analysisSheet?.primarySheetType || '';
    const building = bedfordDrawingCatalog?.building || building61Sheet?.building || sheet.building || analysisSheet?.building || '';
    
    const normalized = {
      projectId: sheet.projectId || analysisSheet?.projectId || currentAnalysis?.projectId || store.getState().projectId || '',
      drawingSetId: sheet.drawingSetId || analysisSheet?.drawingSetId || currentAnalysis?.drawingSetId || store.getState().drawingSetId || '',
      documentId: sheet.documentId || analysisSheet?.documentId || currentAnalysis?.documentId || '',
      drawingId: sheet.drawingId || analysisSheet?.drawingId || '',
      sheetId: sheet.sheetId || '',
      sheetNumber,
      sheetTitle,
      discipline,
      drawingType,
      pageId: canonicalPageId,
      pageNumber: Number(sheet.pageNumber) || 0,
      pdfPage: Number(sheet.pdfPage || sheet.pageNumber || analysisSheet?.pdfPage || analysisSheet?.pageNumber) || 0,
      building,
      sourceBlob: sheet.sourceBlob || currentAnalysis?.sourceBlob || null,
      specificationLinks: Array.isArray(sheet.specificationLinks) ? clone(sheet.specificationLinks) : [],
      unresolvedEvidence: Array.isArray(sheet.unresolvedEvidence) ? clone(sheet.unresolvedEvidence) : [],
      rotation: Number(sheet.rotation) || 0
    };
    // Update diagnostics for all sheets
    diagnostics.normalizeSheet = {
      pageNumber: normalized.pageNumber,
      pageId: normalized.pageId,
      sheetId: normalized.sheetId,
      sheetNumber: normalized.sheetNumber,
      building: normalized.building
    };
    updateDiagnosticsPanel();
    return normalized;
  };

  const renderSheetList = sheets => {
    const list = sheetListNode();
    if (!list) return;
    if (!sheets.length) {
      list.innerHTML = '<li class="mc-plans-v2-empty"><strong>No drawings available</strong></li>';
      return;
    }
    list.innerHTML = sheets.map(sheet => renderPlansSheetCard(sheet, { active: false })).join('');
  };

  const updateHeader = snapshot => {
    const title = view.querySelector('#plansV2Title');
    if (title) title.textContent = 'Plans';
    const sheetNumber = snapshot.sheetNumber || '';
    if (sheetNumberNode()) sheetNumberNode().textContent = sheetNumber;
    if (sheetTitleNode()) sheetTitleNode().textContent = snapshot.sheetTitle || '';
    if (sheetSubtitleNode()) sheetSubtitleNode().textContent = snapshot.sheetTitle ? `Sheet ${sheetNumber}` : 'Waiting for metadata';
    if (sheetBuildingNode()) sheetBuildingNode().textContent = snapshot.building ? `Building ${snapshot.building}` : '';
    if (sheetDisciplineNode()) sheetDisciplineNode().textContent = snapshot.discipline || '';
    if (sheetTypeNode()) sheetTypeNode().textContent = snapshot.drawingType || snapshot.primarySheetType || '';
    if (sheetPositionNode()) sheetPositionNode().textContent = snapshot.pdfPage || snapshot.pageNumber ? `PDF page ${snapshot.pdfPage || snapshot.pageNumber || ''}` : '';
    if (sheetIdentityNode()) sheetIdentityNode().textContent = snapshot.sheetId ? `Sheet ${snapshot.sheetId}` : 'Pending';
    if (drawingSetNode()) drawingSetNode().textContent = snapshot.drawingSetId || currentAnalysis?.drawingSetId || '';
    if (sheetSummaryNode()) sheetSummaryNode().textContent = `${snapshot.sheetNumber || ''}${snapshot.sheetTitle ? ` · ${snapshot.sheetTitle}` : ''}`;
    if (toolbarStatusNode()) toolbarStatusNode().textContent = snapshot.sheetNumber ? `Sheet ${snapshot.sheetNumber} · ${snapshot.pdfPage || snapshot.pageNumber || ''}` : `PDF page ${snapshot.pdfPage || snapshot.pageNumber || ''}`;
    // Update diagnostics for all sheets
    diagnostics.updateHeader = {
      pageNumber: snapshot.pageNumber,
      pageId: snapshot.pageId,
      sheetNumber: snapshot.sheetNumber,
      sheetTitle: snapshot.sheetTitle,
      building: snapshot.building,
      discipline: snapshot.discipline,
      drawingType: snapshot.drawingType
    };
    updateDiagnosticsPanel();
  };

  const updateSelection = snapshot => {
    for (const button of view.querySelectorAll('[data-plans-sheet]')) {
      const active = button.dataset.plansSheet === snapshot.sheetId;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  };

  async function selectSheet(sheet) {
    if (!sheet || destroyed) return { committed: false };
    // Normalize sheet to get authoritative Bedford drawing set data instead of stale incoming data
    const normalizedSheet = normalizeSheet(sheet);
    const snapshot = clone(normalizedSheet);
    const generation = ++activeGeneration;
    store.setCurrentSheet(snapshot);
    updateHeader(snapshot);
    updateSelection(snapshot);
    inspector.renderLoading({ sheet: snapshot });
    const renderOutcome = await pdfViewer.setSheet(snapshot);
    if (!renderOutcome?.committed || generation !== activeGeneration) return renderOutcome || { committed: false, cancelled: true };
    currentSource = renderOutcome.source || currentSource;
    currentZoom = 1;
    // Update diagnostics for all sheets
    diagnostics.selectSheet = {
      pageNumber: snapshot.pageNumber,
      pageId: snapshot.pageId,
      sheetId: snapshot.sheetId,
      sheetNumber: snapshot.sheetNumber
    };
    updateDiagnosticsPanel();
    
    // Query drawingSpecificationLinks for the canonical pageId
    const canonicalPageId = snapshot.pageId || '';
    let specificationLinksFromDb = [];
    
    // Use pre-populated spec links by sheet number
    if (bedfordSpecLinks && snapshot.sheetNumber) {
      const sheetResult = bedfordSpecLinks.results?.[snapshot.sheetNumber];
      if (sheetResult && sheetResult.success && sheetResult.pageId === canonicalPageId) {
        specificationLinksFromDb = sheetResult.links || [];
        console.log('[Plans V2] Using Bedford pre-populated spec links:', specificationLinksFromDb.length, 'for', snapshot.sheetNumber);
      }
    }
    
    // Fallback: try real drawingSpecificationLinks service
    if (specificationLinksFromDb.length === 0 && drawingSpecificationLinks && canonicalPageId) {
      specificationLinksFromDb = drawingSpecificationLinks.forPage(canonicalPageId);
    }
    
    // Fallback: load from pre-populated JSON file if database is empty
    if (specificationLinksFromDb.length === 0) {
      try {
        const specLinksPath = activeBedfordDrawingSet.relationshipsPath;
        const response = await fetch(specLinksPath);
        if (response && response.ok) {
          const specLinksData = await response.json();
          const sheetKey = snapshot.sheetNumber;
          const sheetResult = specLinksData.results?.[sheetKey];
          if (sheetResult && sheetResult.success && sheetResult.pageId === canonicalPageId) {
            specificationLinksFromDb = sheetResult.links || [];
          }
        }
      } catch (error) {
        // Silently fail - database will be used if available
      }
    }
    
    // Capture diagnostic information for specification links lookup
    const specLinksDiagnostic = {
      pageId: canonicalPageId,
      linksFound: specificationLinksFromDb.length,
      drawingSpecLinksAvailable: Boolean(drawingSpecificationLinks),
      hasPageId: Boolean(canonicalPageId)
    };
    
    // For Bedford drawings with spec links, bypass requirementsResolver and create requirements directly from spec links
    let requirementsResult = {};
    if (specificationLinksFromDb.length > 0) {
      requirementsResult = {
        status: 'complete',
        confirmedSpecifications: specificationLinksFromDb.filter(l => l.status === 'confirmed'),
        suggestedSpecifications: specificationLinksFromDb.filter(l => l.status === 'suggested'),
        rejectedSpecifications: specificationLinksFromDb.filter(l => l.status === 'rejected'),
        confirmedCount: specificationLinksFromDb.filter(l => l.status === 'confirmed').length,
        suggestedCount: specificationLinksFromDb.filter(l => l.status === 'suggested').length,
        rejectedCount: specificationLinksFromDb.filter(l => l.status === 'rejected').length
      };
      specLinksDiagnostic.confirmedCount = requirementsResult.confirmedCount;
      specLinksDiagnostic.suggestedCount = requirementsResult.suggestedCount;
      specLinksDiagnostic.rejectedCount = requirementsResult.rejectedCount;
      console.log('[Plans V2] Direct rendering of spec links:', specificationLinksFromDb.length, 'records');
    } else {
      // Use requirementsResolver for drawings without spec links
      const requirementInput = {
        projectId: snapshot.projectId || currentAnalysis?.projectId || '',
        pageEntityId: `drawing-page:${canonicalPageId}`,
        selectedObjectId: '',
        selectedObjectEntityId: '',
        selectedRoomEntityId: '',
        viewportContext: null,
        tradeChannel: null,
        drawingSpecLinks: specificationLinksFromDb || [],
        projectWideRequirements: []
      };
      const requirements = await requirementsResolver.resolveLatest(requirementInput);
      if (!requirements?.committed || generation !== activeGeneration) return { committed: false, cancelled: true };
      requirementsResult = requirements.result || {};
      specLinksDiagnostic.confirmedCount = (requirementsResult?.confirmedSpecifications || []).length;
      specLinksDiagnostic.suggestedCount = (requirementsResult?.suggestedSpecifications || []).length;
      specLinksDiagnostic.rejectedCount = (requirementsResult?.rejectedSpecifications || []).length;
    }
    
    const panelModel = inspector.renderHydrated({
      sheet: snapshot,
      requirements: requirementsResult,
      specificationLinks: specificationLinksFromDb || [],
      unresolvedEvidence: snapshot.unresolvedEvidence || [],
      specLinksDiagnostic
    });
    store.setRequirements('complete', requirementsResult);
    return { committed: true, panelModel, source: currentSource };
  }

  const refreshButtonBindings = () => {
    view.addEventListener('click', event => {
      const button = event.target.closest('[data-plans-sheet]');
      if (button) {
        const sheet = store.getState().sheets.find(item => item.sheetId === button.dataset.plansSheet);
        void selectSheet(sheet);
        return;
      }
      const action = event.target.closest('[data-plans-action]');
      if (!action) return;
      const state = store.getState();
      const sheets = state.sheets;
      const currentIndex = sheets.findIndex(item => item.sheetId === state.currentSheet?.sheetId);
      switch (action.dataset.plansAction) {
        case 'previous':
          if (currentIndex > 0) void selectSheet(sheets[currentIndex - 1]);
          break;
        case 'next':
          if (currentIndex >= 0 && currentIndex < sheets.length - 1) void selectSheet(sheets[currentIndex + 1]);
          break;
        case 'fit-page':
          pdfViewer.fitPage();
          break;
        case 'fit-width':
          pdfViewer.fitWidth();
          break;
        case 'zoom-out':
          currentZoom = pdfViewer.zoom(Math.max(.35, currentZoom - .1));
          break;
        case 'zoom-in':
          currentZoom = pdfViewer.zoom(Math.min(2, currentZoom + .1));
          break;
        case 'rotate':
          pdfViewer.rotate();
          break;
        case 'reset-view':
          currentZoom = pdfViewer.zoom(1);
          pdfViewer.pan(0, 0);
          break;
        case 'toggle-finder':
        case 'toggle-expand':
          layoutNode()?.classList.toggle(action.dataset.plansAction === 'toggle-finder' ? 'finder-hidden' : 'drawing-expanded');
          break;
      }
    });
  };

  refreshButtonBindings();

  async function initialize({ project = null, analysis = null, drawingSet = null, sheets = [] } = {}) {
    if (destroyed) throw new Error('Plans controller has been destroyed.');
    try {
      setStatus('Loading drawing set…', 'loading');
      currentAnalysis = analysis || currentAnalysis || null;
      // Update diagnostics for currentAnalysis
      diagnostics.currentAnalysis = {
        documentId: currentAnalysis?.documentId || null,
        selectedPage: drawingSet?.currentSheetId || null,
        sheetsCount: currentAnalysis?.sheets?.length || 0
      };
      updateDiagnosticsPanel();
      const normalizedSheets = Array.isArray(sheets) ? sheets.map(normalizeSheet).filter(sheet => sheet?.sheetId && sheet.documentId && Number(sheet.pageNumber) > 0) : [];
      if (project?.id || analysis?.projectId || drawingSet?.drawingSetId) {
        store.setState({
          projectId: project?.id || analysis?.projectId || drawingSet?.projectId || store.getState().projectId,
          drawingSetId: drawingSet?.drawingSetId || analysis?.drawingSetId || store.getState().drawingSetId
        });
      }
      store.setSheets(normalizedSheets);
      renderSheetList(normalizedSheets);
      if (!normalizedSheets.length) {
        setStatus('No drawings available', 'empty');
        inspector.renderLoading({ sheet: null });
        initialized = true;
        return { committed: false, empty: true };
      }
      const currentSheetId = initialSheetId || drawingSet?.currentSheetId || '';
      const selectedSheet = normalizedSheets.find(item => item.sheetId === currentSheetId) || normalizedSheets[0];
      setStatus('ready view', 'ready');
      const result = await selectSheet(selectedSheet);
      initialized = true;
      return { committed: Boolean(result?.committed), sheetId: selectedSheet.sheetId };
    } catch (error) {
      setStatus(`Failed to load drawings: ${error?.message || String(error)}`, 'failed');
      inspector.renderLoading({ sheet: null });
      initialized = true;
      return { committed: false, error };
    }
  }

  return {
    root: view,
    store,
    pdfViewer,
    inspector,
    initialize,
    selectSheet,
    get initialized() { return initialized; },
    destroy() {
      destroyed = true;
      pdfViewer.destroy();
    }
  };
}
