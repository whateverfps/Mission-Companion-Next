const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const clone = value => value === undefined ? undefined : structuredClone(value);

const action = (id, label, enabled = true) => enabled ? { id, label } : null;

export function drawingUpgradeKey(analysis = {}, targetVersion = 0) {
  const registryRevision = Number(analysis.registryRevision || analysis.registryHealth?.registryRevision || 0);
  const profileVersion = Number(analysis.profile?.profileVersion || 0);
  const registered = list(analysis.drawingRegistry).filter(item => text(item.sheetNumber) && text(item.normalizedSheetNumber)).length;
  const expected = list(analysis.indexEntries).length;
  const unresolved = Number(analysis.registryHealth?.unresolvedPages || 0);
  return [text(analysis.drawingSetId), text(analysis.documentId), Number(targetVersion) || 0, profileVersion, registryRevision, registered, expected, unresolved].join(':');
}

export async function loadAuthoritativeDrawingRegistry({
  loadAnalyses,
  requiresUpgrade,
  validateOwnership,
  rebuild,
  save,
  reloadSaved,
  upgradeWork = new Map()
} = {}) {
  const initial = list(await loadAnalyses());
  const results = [];
  for (const analysis of initial) {
    if (!requiresUpgrade(analysis)) continue;
    const key = drawingUpgradeKey(analysis, analysis.analysisVersion);
    if (!upgradeWork.has(key)) upgradeWork.set(key, (async () => {
      const ownership = await validateOwnership(analysis);
      if (!ownership?.ok) return ownership;
      const rebuilt = await rebuild(analysis);
      if (!rebuilt || requiresUpgrade(rebuilt)) return { ok: false, status: 'failed', errorCode: 'drawing-upgrade-incomplete', analysis: rebuilt || analysis, warning: 'Drawing registry rebuild did not satisfy its authoritative quality gate.' };
      const saved = await save(rebuilt);
      if (!saved?.ok) return saved;
      const persisted = reloadSaved ? await reloadSaved(rebuilt) : saved.analysis || rebuilt;
      if (!persisted || requiresUpgrade(persisted)) return { ok: false, status: 'failed', errorCode: 'drawing-upgrade-persistence-failed', analysis: persisted || analysis, warning: 'The persisted drawing registry did not satisfy its authoritative quality gate.' };
      return { ...saved, analysis: persisted };
    })().finally(() => upgradeWork.delete(key)));
    results.push(await upgradeWork.get(key));
  }
  const analyses = list(await loadAnalyses());
  return { analyses, initial, results };
}

export function drawingRecoveryActions(outcome = {}) {
  const code = text(outcome.errorCode);
  return [
    action('open-owning-project', 'Open Owning Project', Boolean(outcome.owningProjectId && outcome.owningProjectId !== outcome.activeProjectId)),
    action('return-to-drawing-sets', 'Return to Drawing Sets', true),
    action('reattach-original-pdf', 'Reattach Original PDF', Boolean(outcome.document && !outcome.sourceFile)),
    action('reimport-drawing', 'Reimport Drawing', code === 'drawing-document-missing'),
    action('retry-analysis-upgrade', 'Retry Analysis Upgrade', Boolean(outcome.document && outcome.analysis)),
    action('remove-stale-analysis', 'Remove Stale Analysis', Boolean(outcome.analysis && ['drawing-document-missing', 'drawing-analysis-orphan', 'drawing-project-mismatch'].includes(code))),
    action('view-technical-details', 'View Details', true)
  ].filter(Boolean);
}

function outcome({ ok = false, status = 'unavailable', errorCode = '', document = null, sourceFile = null, analysis = null, activeProjectId = '', warning = '', diagnostics = {} } = {}) {
  const owningProjectId = text(document?.projectId || analysis?.projectId || sourceFile?.projectId);
  const result = { ok, status, errorCode, document: clone(document), sourceFile: clone(sourceFile), analysis: clone(analysis), owningProjectId, activeProjectId: text(activeProjectId), warning: text(warning), recoverable: !ok, diagnostics: { ...clone(diagnostics), errorCode, owningProjectId, activeProjectId: text(activeProjectId) } };
  return { ...result, actions: drawingRecoveryActions(result) };
}

export function validateDrawingOwnership({ analysis = null, documents = [], sourceFiles = [], activeProjectId = '', requireSource = false } = {}) {
  if (!analysis?.drawingSetId || !analysis?.documentId || !analysis?.projectId || !Number.isFinite(Number(analysis?.analysisVersion))) return outcome({ errorCode: 'drawing-analysis-invalid', analysis, activeProjectId, warning: 'Drawing analysis information is incomplete.' });
  const matches = list(documents).filter(item => text(item?.id) === text(analysis.documentId));
  if (!matches.length) return outcome({ errorCode: 'drawing-document-missing', analysis, activeProjectId, warning: 'The exact drawing document could not be resolved.' });
  if (matches.length > 1) return outcome({ errorCode: 'drawing-document-ambiguous', analysis, activeProjectId, warning: 'More than one exact drawing document was supplied.' });
  const document = matches[0];
  if (text(document.projectId) !== text(analysis.projectId)) return outcome({ errorCode: 'drawing-project-mismatch', document, analysis, activeProjectId, warning: 'Drawing analysis ownership does not match the source document.' });
  const sources = list(sourceFiles).filter(item => text(item?.documentId) === text(document.id));
  if (sources.length > 1) return outcome({ errorCode: 'drawing-source-project-mismatch', document, analysis, activeProjectId, warning: 'More than one source record was supplied for the drawing.' });
  const sourceFile = sources[0] || null;
  if (sourceFile && text(sourceFile.projectId) !== text(document.projectId)) return outcome({ errorCode: 'drawing-source-project-mismatch', document, sourceFile, analysis, activeProjectId, warning: 'Original drawing ownership does not match the document.' });
  if (requireSource && !sourceFile) return outcome({ errorCode: 'drawing-source-missing', document, analysis, activeProjectId, warning: 'The original drawing is unavailable.' });
  return outcome({ ok: true, status: sourceFile ? 'ready' : 'text-only', document, sourceFile, analysis, activeProjectId });
}

export function classifyDrawingOrphans({ documents = [], analyses = [], sourceFiles = [], activeProjectId = '' } = {}) {
  const diagnostics = [];
  const documentIds = new Set(list(documents).map(item => text(item.id)));
  for (const analysis of list(analyses)) {
    const sourceDocument = list(documents).find(item => text(item.id) === text(analysis.documentId));
    const validation = validateDrawingOwnership({ analysis, documents, sourceFiles, activeProjectId, requireSource: sourceDocument?.sourceAvailability === 'available' });
    if (!validation.ok) diagnostics.push({ kind: 'analysis', id: text(analysis.drawingSetId), ...validation });
  }
  for (const sourceFile of list(sourceFiles)) {
    const document = list(documents).find(item => text(item.id) === text(sourceFile.documentId));
    if (!documentIds.has(text(sourceFile.documentId))) diagnostics.push({ kind: 'source', id: text(sourceFile.documentId), ...outcome({ errorCode: 'drawing-source-orphan', sourceFile, activeProjectId, warning: 'Original drawing bytes have no source document.' }) });
    else if (text(document.projectId) !== text(sourceFile.projectId)) diagnostics.push({ kind: 'source', id: text(sourceFile.documentId), ...outcome({ errorCode: 'drawing-source-project-mismatch', document, sourceFile, activeProjectId, warning: 'Original drawing ownership does not match the document.' }) });
  }
  return diagnostics.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

export function reduceStaleDrawingTarget(target, { document = null, analysis = null } = {}) {
  if (!target?.documentId) return { status: 'none', target: null, warning: '' };
  if (!document || text(document.id) !== text(target.documentId)) return { status: 'drawing-target-stale', target: null, warning: 'Drawing source unavailable.' };
  const base = { ...clone(target), projectId: text(document.projectId), documentId: text(document.id) };
  if (!analysis) return { status: 'document', target: { ...base, drawingSetId: '', sheetId: '', pageNumber: null, observationId: '', region: null }, warning: 'Drawing analysis unavailable.' };
  const sheet = target.sheetId ? list(analysis.sheets).find(item => text(item.sheetId) === text(target.sheetId)) : target.pageNumber ? list(analysis.sheets).find(item => Number(item.pageNumber) === Number(target.pageNumber)) : null;
  if ((target.sheetId || target.pageNumber) && !sheet) return { status: 'drawing-sheet-stale', target: { ...base, drawingSetId: text(analysis.drawingSetId), sheetId: '', pageNumber: null, observationId: '', region: null }, warning: 'The selected sheet is unavailable.' };
  const observation = target.observationId ? list(analysis.observations).find(item => text(item.observationId) === text(target.observationId) && (!sheet || item.sheetId === sheet.sheetId)) : null;
  if (target.observationId && !observation) return { status: 'drawing-observation-stale', target: { ...base, drawingSetId: text(analysis.drawingSetId), sheetId: text(sheet?.sheetId), pageNumber: sheet?.pageNumber || null, observationId: '', region: null }, warning: 'The selected observation is unavailable.' };
  return { status: observation ? 'observation' : sheet ? 'sheet' : 'document', target: base, warning: '' };
}
