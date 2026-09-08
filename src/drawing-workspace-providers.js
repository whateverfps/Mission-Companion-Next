export async function loadDrawingWorkspaceProviders({ loadSections, loadDocuments, onFailure = () => {} } = {}) {
  let documents = []; const providerFailures = [];
  try {
    documents = typeof loadDocuments === 'function' ? await loadDocuments() : [];
    if (!Array.isArray(documents)) throw new Error('Document provider returned an invalid result.');
  } catch (error) {
    const warning = 'Drawing documents are unavailable.'; const failure = { provider: 'documents', code: 'construction-intelligence-provider-failure', warning, message: error?.message || String(error), contained: true }; providerFailures.push(failure); onFailure(failure);
    return { status: 'unavailable', documents: [], sections: [], warnings: [warning], providerFailures };
  }
  try {
    const sections = typeof loadSections === 'function' ? await loadSections(documents) : [];
    if (!Array.isArray(sections)) throw new Error('Specification section provider returned an invalid result.');
    return { documents, sections, warnings: [] };
  } catch (error) {
    const warning = 'Specification requirements are unavailable. Manual drawing use remains available.';
    const failure = { provider: 'specification-sections', code: 'construction-intelligence-provider-failure', warning, message: error?.message || String(error), contained: true }; providerFailures.push(failure); onFailure(failure);
    return { status: 'partial', documents, sections: [], warnings: [warning], providerFailures };
  }
}
