import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDrawingOrphans, drawingRecoveryActions, drawingUpgradeKey, loadAuthoritativeDrawingRegistry, reduceStaleDrawingTarget, validateDrawingOwnership } from '../src/drawing-lifecycle.js';

const document = { id: 'd1', projectId: 'p1', sourceAvailability: 'available' };
const sourceFile = { documentId: 'd1', projectId: 'p1' };
const analysis = { drawingSetId: 'set1', documentId: 'd1', projectId: 'p1', analysisVersion: 2, sheets: [{ sheetId: 'sheet1', pageNumber: 1 }], observations: [{ observationId: 'obs1', sheetId: 'sheet1' }] };

test('valid ownership is global and independent of the active project', () => {
  const result = validateDrawingOwnership({ analysis, documents: [document], sourceFiles: [sourceFile], activeProjectId: 'general', requireSource: true });
  assert.equal(result.ok, true);
  assert.equal(result.owningProjectId, 'p1');
  assert.equal(result.activeProjectId, 'general');
});

test('missing and ambiguous documents are structured unavailable outcomes', () => {
  assert.equal(validateDrawingOwnership({ analysis }).errorCode, 'drawing-document-missing');
  assert.equal(validateDrawingOwnership({ analysis, documents: [document, { ...document }] }).errorCode, 'drawing-document-ambiguous');
});

test('project and source ownership mismatches are rejected', () => {
  assert.equal(validateDrawingOwnership({ analysis: { ...analysis, projectId: 'other' }, documents: [document] }).errorCode, 'drawing-project-mismatch');
  assert.equal(validateDrawingOwnership({ analysis, documents: [document], sourceFiles: [{ ...sourceFile, projectId: 'other' }] }).errorCode, 'drawing-source-project-mismatch');
  assert.equal(validateDrawingOwnership({ analysis, documents: [document], requireSource: true }).errorCode, 'drawing-source-missing');
});

test('analysis and source orphans are classified without mutation or deletion', () => {
  const diagnostics = classifyDrawingOrphans({ documents: [document], analyses: [{ ...analysis, documentId: 'missing' }], sourceFiles: [{ documentId: 'orphan', projectId: 'p1' }] });
  assert.deepEqual(diagnostics.map(item => item.errorCode).sort(), ['drawing-document-missing', 'drawing-source-orphan']);
});

test('stale target reduction preserves the highest valid exact level', () => {
  const target = { projectId: 'p1', documentId: 'd1', drawingSetId: 'set1', sheetId: 'sheet1', pageNumber: 1, observationId: 'missing', region: { x: .1, y: .1, width: .1, height: .1 } };
  const observation = reduceStaleDrawingTarget(target, { document, analysis });
  assert.equal(observation.status, 'drawing-observation-stale');
  assert.equal(observation.target.sheetId, 'sheet1');
  assert.equal(observation.target.observationId, '');
  const sheet = reduceStaleDrawingTarget({ ...target, sheetId: 'missing', pageNumber: 99 }, { document, analysis });
  assert.equal(sheet.status, 'drawing-sheet-stale');
  assert.equal(sheet.target.documentId, 'd1');
  assert.equal(sheet.target.sheetId, '');
  assert.equal(reduceStaleDrawingTarget(target, { document: null, analysis }).target, null);
});

test('recovery actions and upgrade keys are deterministic', () => {
  assert.equal(drawingUpgradeKey(analysis, 3), 'set1:d1:3:0:0:0:0:0');
  const labels = drawingRecoveryActions({ errorCode: 'drawing-document-missing', analysis, owningProjectId: 'p1', activeProjectId: 'general' }).map(item => item.label);
  assert.ok(labels.includes('Open Owning Project'));
  assert.ok(labels.includes('Remove Stale Analysis'));
  assert.ok(labels.includes('View Details'));
});

test('authoritative registry reload replaces a stale in-memory analysis during the same command', async () => {
  const stale = { ...analysis, analysisVersion: 7, profile: { profileVersion: 2 }, registryHealth: { unresolvedPages: 52 }, indexEntries: Array.from({ length: 70 }, (_, index) => ({ sheetNumber: `61M-${index}` })), drawingRegistry: Array.from({ length: 18 }, (_, index) => ({ drawingId: `old-${index}`, sheetNumber: `61M-${index}`, normalizedSheetNumber: `61M${index}` })) };
  const completeRegistry = Array.from({ length: 70 }, (_, index) => ({ drawingId: `new-${index}`, sheetNumber: index === 1 ? '61M-101' : `61M-${index}`, normalizedSheetNumber: index === 1 ? '61M101' : `61M${index}` }));
  const complete = { ...stale, registryHealth: { unresolvedPages: 0 }, drawingRegistry: completeRegistry };
  let persisted = structuredClone(stale);
  let saves = 0;
  const requiresUpgrade = item => item.drawingRegistry.length < item.indexEntries.length || item.registryHealth.unresolvedPages > 0;
  const result = await loadAuthoritativeDrawingRegistry({
    loadAnalyses: async () => [structuredClone(persisted)],
    requiresUpgrade,
    validateOwnership: async () => ({ ok: true }),
    rebuild: async () => structuredClone(complete),
    save: async rebuilt => { saves += 1; persisted = structuredClone(rebuilt); return { ok: true, status: 'saved', analysis: structuredClone(rebuilt) }; },
    reloadSaved: async () => structuredClone(persisted)
  });
  assert.equal(saves, 1);
  assert.equal(result.initial[0].drawingRegistry.length, 18);
  assert.equal(result.analyses[0].drawingRegistry.length, 70);
  assert.ok(result.analyses[0].drawingRegistry.some(item => item.normalizedSheetNumber === '61M101'));
  const second = await loadAuthoritativeDrawingRegistry({ loadAnalyses: async () => [structuredClone(persisted)], requiresUpgrade, validateOwnership: async () => ({ ok: true }), rebuild: async () => { throw new Error('must not rebuild'); }, save: async () => { throw new Error('must not save'); } });
  assert.equal(second.results.length, 0);
  assert.equal(saves, 1);
});

test('an incomplete rebuild is not saved or returned as authoritative', async () => {
  const stale = { ...analysis, drawingRegistry: [], indexEntries: [{}], registryHealth: { unresolvedPages: 1 } };
  let saved = false;
  const result = await loadAuthoritativeDrawingRegistry({ loadAnalyses: async () => [structuredClone(stale)], requiresUpgrade: item => item.registryHealth.unresolvedPages > 0, validateOwnership: async () => ({ ok: true }), rebuild: async () => structuredClone(stale), save: async () => { saved = true; return { ok: true }; } });
  assert.equal(saved, false);
  assert.equal(result.results[0].errorCode, 'drawing-upgrade-incomplete');
});

test('one unavailable analysis does not discard a separately refreshed registry', async () => {
  const staleA = { ...analysis, drawingSetId: 'missing-set', documentId: 'missing', drawingRegistry: [], indexEntries: [{}], registryHealth: { unresolvedPages: 1 } };
  const staleB = { ...analysis, drawingSetId: 'valid-set', drawingRegistry: [], indexEntries: [{}], registryHealth: { unresolvedPages: 1 } };
  const completeB = { ...staleB, drawingRegistry: [{ drawingId: '61m101', sheetNumber: '61M-101', normalizedSheetNumber: '61M101' }], registryHealth: { unresolvedPages: 0 } };
  let persisted = [structuredClone(staleA), structuredClone(staleB)];
  const requiresUpgrade = item => item.registryHealth.unresolvedPages > 0;
  const result = await loadAuthoritativeDrawingRegistry({
    loadAnalyses: async () => structuredClone(persisted), requiresUpgrade,
    validateOwnership: async item => item.documentId === 'missing' ? { ok: false, errorCode: 'drawing-document-missing', analysis: item } : { ok: true },
    rebuild: async item => item.drawingSetId === 'valid-set' ? structuredClone(completeB) : item,
    save: async rebuilt => { persisted = persisted.map(item => item.drawingSetId === rebuilt.drawingSetId ? structuredClone(rebuilt) : item); return { ok: true, analysis: rebuilt }; },
    reloadSaved: async rebuilt => structuredClone(persisted.find(item => item.drawingSetId === rebuilt.drawingSetId))
  });
  assert.equal(result.results[0].errorCode, 'drawing-document-missing');
  assert.equal(result.results[1].ok, true);
  assert.ok(result.analyses.find(item => item.drawingSetId === 'valid-set').drawingRegistry.some(item => item.normalizedSheetNumber === '61M101'));
});
