import { buildConstructionIntelligencePanelModel } from '../construction-intelligence-panel.js';

const clone = value => {
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value ?? null)); }
};

const normalizeRequirements = requirements => {
  const source = clone(requirements || {});
  const confirmed = Array.isArray(source.confirmedSpecifications) ? source.confirmedSpecifications : Array.isArray(source.requirements) ? source.requirements.filter(item => item?.status === 'confirmed') : [];
  const suggested = Array.isArray(source.suggestedSpecifications) ? source.suggestedSpecifications : Array.isArray(source.requirements) ? source.requirements.filter(item => item?.status === 'suggested') : [];
  return {
    ...source,
    confirmedSpecifications: confirmed,
    suggestedSpecifications: suggested
  };
};

export function createPlansSheetInspector({ root, requirementsResolver, specificationIndex, buildPanelModel = buildConstructionIntelligencePanelModel, panelMarkup = model => `<pre>${JSON.stringify(model)}</pre>`, onViewSource = () => {}, onDiagnosticsUpdate = () => {} } = {}) {
  const panel = root?.querySelector('[data-plans-inspector]') || root;
  const rebindHandlers = () => {
    panel.querySelectorAll('[data-object-spec-source]').forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        onViewSource({
          documentId: button.dataset.objectSpecSource || '',
          pageNumber: Number(button.dataset.objectSpecPage) || 0,
          sectionNumber: button.dataset.objectSpecSection || ''
        });
      };
    });
  };
  const renderLoading = snapshot => {
    const model = buildPanelModel({
      sheet: snapshot.sheet || snapshot,
      requirements: { status: 'loading', requirements: [], confirmedSpecifications: [], suggestedSpecifications: [], projectWideRequirements: [], fieldRequirements: {}, warnings: [], providerFailures: [] },
      specificationLinks: [],
      unresolvedEvidence: []
    });
    panel.innerHTML = panelMarkup(model);
    rebindHandlers();
    return model;
  };
  const renderHydrated = snapshot => {
    const requirements = normalizeRequirements(snapshot.requirements || { confirmedSpecifications: [], suggestedSpecifications: [] });
    const sheet = snapshot.sheet || snapshot;
    // Update diagnostics for all sheets
    onDiagnosticsUpdate({
      pageNumber: sheet.pageNumber,
      pageId: sheet.pageId,
      sheetNumber: sheet.sheetNumber,
      building: sheet.building,
      confirmedCount: requirements.confirmedSpecifications?.length || 0,
      suggestedCount: requirements.suggestedSpecifications?.length || 0,
      specLinksCount: snapshot.specificationLinks?.length || 0
    });
    const model = buildPanelModel({
      sheet,
      requirements,
      specificationLinks: snapshot.specificationLinks || requirements.specificationLinks || [],
      unresolvedEvidence: snapshot.unresolvedEvidence || [],
      specLinksDiagnostic: snapshot.specLinksDiagnostic || null
    });
    panel.innerHTML = panelMarkup(model);
    rebindHandlers();
    return model;
  };
  return {
    panel,
    renderLoading,
    renderHydrated,
    setSheetTitle(snapshot) {
      const header = panel.querySelector('[data-plans-inspector-title]') || panel;
      header.dataset.sheetId = snapshot.sheetId || '';
    }
  };
}
