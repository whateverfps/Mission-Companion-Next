import { normalizeSpecificationNumber } from './specification-index.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const clone = value => structuredClone(value);
const RULES = Object.freeze({ signage: '10 14 00', 'resilient-base': '09 65 13', 'resilient-tile': '09 65 19', 'paint-finish': '09 91 00', 'wall-protection': '10 26 00', 'door-protection': '10 26 00', 'fire-extinguisher-cabinet': '10 44 13' });
export const DRAWING_SPEC_AUDIT_HISTORY_LIMIT = 25;
export const DRAWING_SPEC_EVIDENCE_LIMIT = 20;
const perfNow = () => globalThis.performance?.now?.() ?? Date.now();
const diagnosticsEnabled = globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED === true;
const logSlowOperation = (name, startedAt, details = {}) => {
  if (!diagnosticsEnabled) return Math.max(0, perfNow() - startedAt);
  const elapsed = Math.max(0, perfNow() - startedAt);
  if (elapsed > 10) console.warn(name, elapsed, { ...details, stack: new Error().stack });
  return elapsed;
};

function revisionKey(section) { return text(section?.revisionSource?.revisionId || section?.revisionSource?.id || section?.supersessionStatus || 'current'); }
function activeKey(record, section) { return [text(record.projectId), text(record.drawingPageId), text(record.objectId) || 'page', text(record.specificationDocumentId), normalizeSpecificationNumber(record.sectionNumber).replace(/\s/g, ''), text(record.applicabilityScope || (record.objectId ? 'object-specific' : 'page-wide')), revisionKey(section)].join(':'); }
function linkId(record, section) { return `drawing-spec-link:${activeKey(record, section)}`; }
function bytes(value) { try { return new TextEncoder().encode(value || '').byteLength; } catch { return 0; } }
function decisionRank(record) { return record.origin === 'manual' ? 5 : record.status === 'rejected' ? 4 : record.status === 'confirmed' ? 3 : record.origin === 'explicit' ? 2 : 1; }

export function createDrawingSpecificationLinkService({ index, persistence = null, legacyStorage = globalThis.localStorage, legacyStorageKey = 'mission-companion:drawing-spec-links:v1', now = () => new Date().toISOString(), onDiagnostic = () => {} } = {}) {
  const records = new Map(); const loadedProjects = new Set(); const retryQueue = [];
  let persistenceQueue = Promise.resolve();
  let diagnostics = { backend: persistence ? 'IndexedDB' : 'memory', indexedDbRecordCount: 0, migratedLegacyRecordCount: 0, duplicateRecordsRemoved: 0, legacyRecordCount: 0, legacyPayloadBytes: 0, localStorageDrawingSpecBytes: 0, lastWriteDurationMs: 0, lastWriteFailure: null, pendingRetryCount: 0, auditHistoryLimit: DRAWING_SPEC_AUDIT_HISTORY_LIMIT };
  const report = patch => { diagnostics = { ...diagnostics, ...patch }; onDiagnostic(clone(diagnostics)); };
  const enqueue = operation => {
    if (!persistence) return Promise.resolve({ ok: true });
    const started = perfNow();
    persistenceQueue = persistenceQueue.then(operation).then(() => { report({ lastWriteDurationMs: Math.max(0, perfNow() - started), lastWriteFailure: null }); logSlowOperation('drawing specification write', started, { backend: diagnostics.backend }); return { ok: true }; }).catch(error => {
      retryQueue.push(operation); if (retryQueue.length > 100) retryQueue.shift();
      report({ lastWriteDurationMs: Math.max(0, perfNow() - started), lastWriteFailure: { message: error?.message || String(error), at: now() }, pendingRetryCount: retryQueue.length });
      logSlowOperation('drawing specification write', started, { backend: diagnostics.backend, failed: true });
      return { ok: false, error };
    });
    return persistenceQueue;
  };
  const normalize = (input, existing = null) => {
    const section = index?.get?.(input.specificationDocumentId, input.sectionNumber);
    if (!section || section.projectId !== text(input.projectId) || !text(input.drawingPageId)) return null;
    const timestamp = now(); const scope = text(input.applicabilityScope || (input.objectId ? 'object-specific' : 'page-wide'));
    const canonicalId = linkId({ ...input, applicabilityScope: scope }, section);
    const status = ['confirmed', 'suggested', 'rejected'].includes(input.status) ? input.status : 'suggested';
    const origin = ['explicit', 'parser', 'rule', 'manual'].includes(input.origin) ? input.origin : 'rule';
    const evidenceObservations = [...list(existing?.evidenceObservations), ...list(input.evidenceObservations), ...(text(input.evidenceText) ? [{ source: text(input.evidenceSource), text: text(input.evidenceText).slice(0, 2000), region: input.graphicalRegion ? clone(input.graphicalRegion) : null }] : [])];
    const evidence = [...new Map(evidenceObservations.map(item => [`${text(item.source)}:${text(item.text)}:${JSON.stringify(item.region || null)}`, item])).values()].slice(-DRAWING_SPEC_EVIDENCE_LIMIT);
    const changed = existing && (existing.status !== status || existing.note !== text(input.note) || existing.origin !== origin);
    const history = [...list(existing?.history), ...list(input.history), ...(changed ? [{ oldStatus: existing.status, newStatus: status, oldNote: existing.note || '', newNote: text(input.note), source: origin, time: timestamp }] : [])].slice(-DRAWING_SPEC_AUDIT_HISTORY_LIMIT);
    return { linkId: canonicalId, activeKey: activeKey({ ...input, applicabilityScope: scope }, section), activeRevision: revisionKey(section), projectId: text(input.projectId), drawingDocumentId: text(input.drawingDocumentId), drawingPageId: text(input.drawingPageId), objectId: text(input.objectId) || null,
      specificationDocumentId: section.documentId, sectionNumber: section.sectionNumber, sectionTitle: section.sectionTitle, articleReference: input.articleReference || null, applicabilityScope: scope,
      evidenceSource: text(input.evidenceSource), evidenceText: text(input.evidenceText).slice(0, 2000), evidenceObservations: evidence, graphicalRegion: input.graphicalRegion ? clone(input.graphicalRegion) : null,
      confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)), status, verificationState: status, origin, reason: text(input.reason), note: text(input.note),
      createdAt: text(existing?.createdAt || input.createdAt) || timestamp, updatedAt: timestamp, history };
  };
  const persist = record => enqueue(() => persistence.putLink(clone(record)));
  const upsert = input => {
    const candidate = normalize(input); if (!candidate) return null;
    const existing = records.get(candidate.linkId) || null;
    if (existing && existing.origin === 'manual' && candidate.origin !== 'manual') return clone(existing);
    if (existing && existing.status === 'rejected' && candidate.origin !== 'manual') return clone(existing);
    const record = normalize(input, existing); if (!record) return null;
    const comparable = ['sectionNumber','sectionTitle','evidenceSource','evidenceText','confidence','status','origin','applicabilityScope','reason','note','activeRevision'];
    if (existing && record.origin !== 'manual' && comparable.every(key => JSON.stringify(existing[key]) === JSON.stringify(record[key])) && JSON.stringify(existing.graphicalRegion || null) === JSON.stringify(record.graphicalRegion || null)) return clone(existing);
    records.set(record.linkId, record); void persist(record); return clone(record);
  };
  const migrateLegacy = async projectId => {
    let raw = ''; try { raw = legacyStorage?.getItem?.(legacyStorageKey) || ''; } catch (error) { report({ lastWriteFailure: { message: error?.message || String(error), at: now(), phase: 'legacy-read' } }); return; }
    report({ legacyPayloadBytes: bytes(raw), localStorageDrawingSpecBytes: bytes(raw) });
    if (!raw) return;
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = []; }
    if (!Array.isArray(parsed)) return;
    report({ legacyRecordCount: parsed.length });
    let migrated = 0; let duplicates = 0;
    const migrateStartedAt = perfNow();
    for (const item of parsed) {
      if (projectId && text(item?.projectId) !== projectId) continue;
      const candidate = normalize(item); if (!candidate) continue;
      const existing = records.get(candidate.linkId);
      if (existing) { duplicates += 1; if (decisionRank(existing) >= decisionRank(candidate)) continue; }
      records.set(candidate.linkId, normalize(item, existing)); migrated += 1;
    }
    for (const record of [...records.values()].filter(item => !projectId || item.projectId === projectId)) void persist(record);
    await persistenceQueue;
    const verified = await persistence.loadLinks(projectId);
    if (verified.length < [...records.values()].filter(item => !projectId || item.projectId === projectId).length) { report({ lastWriteFailure: { message: 'Legacy migration verification failed.', at: now(), phase: 'legacy-verify' } }); return; }
    try { legacyStorage?.removeItem?.(legacyStorageKey); } catch (error) { report({ lastWriteFailure: { message: error?.message || String(error), at: now(), phase: 'legacy-cleanup' } }); }
    report({ migratedLegacyRecordCount: migrated, duplicateRecordsRemoved: duplicates, indexedDbRecordCount: verified.length, localStorageDrawingSpecBytes: bytes(legacyStorage?.getItem?.(legacyStorageKey) || '') });
    logSlowOperation('drawing specification migrate', migrateStartedAt, { migrated, duplicates, verified: verified.length, projectId });
  };
  const api = {
    async load(projectId = '') { if (loadedProjects.has(projectId)) return api.forProject(projectId); const startedAt = perfNow(); const stored = persistence ? await persistence.loadLinks(projectId).catch(error => { report({ lastWriteFailure: { message: error?.message || String(error), at: now(), phase: 'load' } }); return []; }) : []; let storedCount = 0; for (const item of stored) { storedCount += 1; const normalized = normalize(item, item); if (normalized) records.set(normalized.linkId, normalized); } report({ indexedDbRecordCount: stored.length }); if (persistence) await migrateLegacy(projectId); loadedProjects.add(projectId); logSlowOperation('drawing specification load', startedAt, { projectId, storedCount, recordCount: records.size }); return api.forProject(projectId); },
    link: input => { const startedAt = perfNow(); const result = upsert(input); logSlowOperation('drawing specification link', startedAt, { projectId: input?.projectId || '', pageId: input?.drawingPageId || '', hasResult: Boolean(result) }); return result; },
    suggestForObject(object, { specificationDocumentId } = {}) { const explicit = text(object?.evidenceText).match(/\b(\d{2})\s?(\d{2})\s?(\d{2})\b/g) || []; const proposals = explicit.map(number => ({ sectionNumber: number, origin: 'explicit', status: 'confirmed', confidence: .95, evidenceSource: 'drawing-explicit-reference' })); const rule = RULES[text(object?.subtype || object?.type).toLowerCase()]; if (rule) proposals.push({ sectionNumber: rule, origin: 'rule', status: 'suggested', confidence: .55, evidenceSource: 'verified-object-project-vocabulary' }); return proposals.map(proposal => upsert({ ...proposal, projectId: object.projectId, drawingDocumentId: object.documentId, drawingPageId: object.pageId, objectId: object.objectId, specificationDocumentId, evidenceText: object.evidenceText })).filter(Boolean); },
    confirm(linkIdValue, note = '') { const current = records.get(text(linkIdValue)); return current ? upsert({ ...current, status: 'confirmed', origin: 'manual', note }) : null; },
    reject(linkIdValue, note = '') { const current = records.get(text(linkIdValue)); return current ? upsert({ ...current, status: 'rejected', origin: 'manual', note }) : null; },
    remove(linkIdValue) { const current = records.get(text(linkIdValue)); if (!current) return false; records.delete(current.linkId); void enqueue(() => persistence.deleteLink(current.linkId)); return true; },
    forProject(projectId = '') { return [...records.values()].filter(item => !projectId || item.projectId === text(projectId)).map(clone); },
    forPage(pageId, objectId = undefined) { return [...records.values()].filter(item => item.drawingPageId === text(pageId) && (objectId === undefined || item.objectId === (text(objectId) || null))).map(clone); },
    forSpecification(specificationDocumentId, sectionNumber) { return [...records.values()].filter(item => item.specificationDocumentId === text(specificationDocumentId) && item.sectionNumber === normalizeSpecificationNumber(sectionNumber)).map(clone); },
    forObject(objectId) { return [...records.values()].filter(item => item.objectId === text(objectId)).map(clone); },
    history(linkIdValue) { return clone(records.get(text(linkIdValue))?.history || []); },
    openTarget(link) { const section = index?.get?.(link?.specificationDocumentId, link?.sectionNumber); return section ? { kind: 'source', destination: 'knowledge', projectId: link.projectId, documentId: section.documentId, sectionId: section.specificationSectionId, pageNumber: link.articleReference?.pageNumber || section.startPdfPage, sectionNumber: section.sectionNumber } : null; },
    flush: () => persistenceQueue,
    async retryPending() { const pending = retryQueue.splice(0); report({ pendingRetryCount: 0 }); for (const operation of pending) void enqueue(operation); await persistenceQueue; return retryQueue.length === 0; },
    diagnostics() { return clone({ ...diagnostics, recordCount: records.size, pageLevelLinkCount: [...records.values()].filter(item => !item.objectId).length, objectLevelLinkCount: [...records.values()].filter(item => item.objectId).length, rejectedOrSuppressedRecordCount: [...records.values()].filter(item => item.status === 'rejected').length, auditHistoryEntries: [...records.values()].reduce((sum, item) => sum + item.history.length, 0), pendingRetryCount: retryQueue.length }); }
  };
  return api;
}
