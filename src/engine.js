import { parseFiles, parsePdfFile } from './parsers.js';
import { arrayValue } from './data-model.js';
import { createIdentifier } from './identifiers.js';
import {
  defaultConversationTitle,
  migrateLegacyChat,
  normalizeAttachmentDocumentIds,
  normalizeConversation,
  renameConversation as renameConversationRecord,
  selectActiveConversation,
  sortConversations
} from './conversations.js';
import {
  nextInspectionNumber,
  normalizeInspectionRecord,
  validateInspectionRecord,
  validateStatusTransition
} from './inspection-records.js';
import {
  retrieve,
  invalidateRetrievalCaches,
  buildContext,
  scoreAnswer,
  verifyCitations
} from './retrieval.js';
import {
  logger,
  moduleStatus
} from './diagnostics.js';
import { analyzeCorpus } from './core/reasoning.js';
import { normalizeChiefResponseMode } from './chief-response-mode.js';
import { createPdfSourceRecord, inspectStorageCapacity } from './pdf-source.js';
import { buildDrawingAnalysis } from './drawing-intelligence.js';
import { classifyDrawingOrphans, validateDrawingOwnership } from './drawing-lifecycle.js';
import { COMPACT_STATE_KEY, COMPACT_STATE_MAX_BYTES, compactStateCategorySizes, legacyLargeState, safeWriteCompactState } from './compact-state.js';
import { createProjectDocumentCache } from './cache/project-document-cache.js';
import { createProjectSectionCache } from './cache/project-section-cache.js';
import { isDrawingDocument, persistDocumentClassification } from './document-routing.js';
import { getChiefIntelligenceBridge } from './chief-intelligence-bridge.js';
import { loadAuthoritativeProjectRecords } from './project-record-store.js';
import { selectRelevantProjectRecords, buildProjectRecordContext } from './chief-project-record-context.js';
import { getActiveProjectRecordContext } from './chief-context-adapter.js';
import { assessAssistedEvidence, buildAssistedEvidenceExpansion, buildAssistedSearchQueries, selectAssistedPassages } from './chief-assisted-evidence.js';

const STATE_KEY = COMPACT_STATE_KEY;
const DOC_DB = 'mc-master-documents-v2';
const DOC_DB_VERSION = 8;
const APP_VERSION = '2.8.1';
const STARTUP_EXPERIENCES = new Set(['mission-control', 'professional-workspace']);
const normalizeStartupExperience = value => STARTUP_EXPERIENCES.has(value) ? value : 'mission-control';
const perfNow = () => globalThis.performance?.now?.() ?? Date.now();
const diagnosticsEnabled = globalThis.__MC_DIAGNOSTICS_ENABLED === true;
const logSlowOperation = (name, startedAt, details = {}) => {
  if (!diagnosticsEnabled) return Math.max(0, perfNow() - startedAt);
  const elapsed = Math.max(0, perfNow() - startedAt);
  if (elapsed > 10) console.warn(name, elapsed, { ...details, stack: new Error().stack });
  return elapsed;
};

const defaults = {
  settings: {
    openaiUrl: 'https://api.openai.com/v1',
    openaiModel: 'gpt-4.1-mini',
    openaiKey: '',
    timeout: 180000,
    mode: 'offline',
    topK: 10,
    startupExperience: 'mission-control'
  },
  projects: [
    {
      id: 'general',
      name: 'General'
    }
  ],
  activeProject: 'general',
  libraries: [
    {
      id: 'general-library',
      projectId: 'general',
      name: 'General Library',
      description: 'Default project knowledge library',
      enabled: true,
      createdAt: new Date().toISOString()
    }
  ],
  activeLibrary: 'general-library',
  chat: [],
  conversations: [],
  activeConversationId: '',
  evaluations: []
};

let pendingLegacyLargeState = null;
let persistenceQueue = Promise.resolve();
let persistenceStatus = { migration: 'not-required', lastFailure: null, compactBytes: 0 };
let state = loadState();
let documentCache;
let sectionCache;

function normalizeProjectIds(projectIds) {
  return [...new Set((Array.isArray(projectIds) ? projectIds : [projectIds]).map(value => String(value ?? '').trim()).filter(Boolean))];
}

export function resolveActiveConversationTarget(conversations = [], activeConversationId = '') {
  const normalizedConversations = Array.isArray(conversations) ? conversations : [];
  const exact = normalizedConversations.find(item => item.conversationId === activeConversationId) || null;
  if (exact) return exact;
  return selectActiveConversation(normalizedConversations, activeConversationId);
}

function conversationResponseMode(conversation = null) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const latestMode = [...messages].reverse().find(item => String(item?.mode || '').trim())?.mode;
  return String(latestMode || '').trim() || 'offline';
}

function invalidateProjectKnowledgeCaches(projectIds, { documents = true, sections = true } = {}) {
  for (const projectId of normalizeProjectIds(projectIds)) {
    if (sections) sectionCache.invalidateProject(projectId);
    if (documents) documentCache.invalidateProject(projectId);
  }
}

sectionCache = createProjectSectionCache({
  maxProjects: 2,
  ttlMs: 10 * 60 * 1000,
  now: perfNow,
  loadSections: async projectId => all('sections', 'projectId', projectId),
  onInvalidate: sections => invalidateRetrievalCaches(sections)
});

documentCache = createProjectDocumentCache({
  maxProjects: 2,
  ttlMs: 10 * 60 * 1000,
  now: perfNow,
  loadDocuments: async projectId => {
    const persisted = await all('documents', 'projectId', projectId);
    const documents = persisted.map(item => persistDocumentClassification(item));
    const changed = documents.filter((item, index) => item.documentType !== persisted[index].documentType || item.documentClassificationMethod !== persisted[index].documentClassificationMethod);

    if (changed.length) {
      await putMany('documents', changed);
      sectionCache.invalidateProject(projectId);
    }

    return documents;
  }
});

globalThis.__mcCacheStats = {
  snapshot: () => ({
    documents: documentCache.snapshot(),
    sections: sectionCache.snapshot()
  }),
  clear: () => {
    documentCache.clear();
    sectionCache.clear();
  }
};

moduleStatus('State Manager', 'ready', {
  summary: 'State loaded'
});

logger.info('Application state loaded', {
  projects: state.projects.length,
  activeProject: state.activeProject
});

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    const legacy = legacyLargeState(stored);

    const loaded = {
      ...structuredClone(defaults),
      ...stored,
      settings: {
        ...structuredClone(defaults.settings),
        ...(stored.settings || {})
      }
    };

    loaded.settings.startupExperience = normalizeStartupExperience(
      loaded.settings.startupExperience
    );

    loaded.projects = Array.isArray(loaded.projects)
      ? loaded.projects
      : structuredClone(defaults.projects);
    if (!loaded.projects.some(project => project.id === loaded.activeProject)) loaded.activeProject = loaded.projects.find(project => project.id === 'general')?.id || loaded.projects[0]?.id || '';

    loaded.libraries = Array.isArray(loaded.libraries)
      ? loaded.libraries
      : structuredClone(defaults.libraries);

    loaded.chat = Array.isArray(loaded.chat) ? loaded.chat : [];
    const migrated = migrateLegacyChat({
      chat: loaded.chat,
      conversations: loaded.conversations,
      activeConversationId: loaded.activeConversationId,
      projectId: loaded.activeProject
    });
    loaded.conversations = migrated.conversations;
    loaded.activeConversationId = migrated.activeConversationId;
    loaded.chat = selectActiveConversation(loaded.conversations, loaded.activeConversationId)?.messages || [];
    loaded.settings.mode = conversationResponseMode(selectActiveConversation(loaded.conversations, loaded.activeConversationId)) || loaded.settings.mode || 'offline';

    loaded.evaluations = Array.isArray(loaded.evaluations)
      ? loaded.evaluations
      : [];
    if (legacy.conversations.length || legacy.evaluations.length || legacy.chat.length) {
      pendingLegacyLargeState = { conversations: loaded.conversations, evaluations: loaded.evaluations };
      persistenceStatus.migration = 'legacy-large-state-pending';
    }

    for (const project of loaded.projects) {
      const hasLibrary = loaded.libraries.some(
        library => library.projectId === project.id
      );

      if (!hasLibrary) {
        loaded.libraries.push({
          id: createIdentifier(),
          projectId: project.id,
          name: `${project.name} Library`,
          description: 'Project knowledge library',
          enabled: true,
          createdAt: new Date().toISOString()
        });
      }
    }

    const activeLibraryIsValid = loaded.libraries.some(
      library =>
        library.id === loaded.activeLibrary &&
        library.projectId === loaded.activeProject
    );

    if (!activeLibraryIsValid) {
      loaded.activeLibrary =
        loaded.libraries.find(
          library => library.projectId === loaded.activeProject
        )?.id || null;
    }

    if (!pendingLegacyLargeState) {
      const compactWrite = safeWriteCompactState(localStorage, loaded, { onFailure: failure => { persistenceStatus.lastFailure = failure; } });
      persistenceStatus.compactBytes = compactWrite.bytes;
    }
    return loaded;
  } catch (error) {
    logger.warning('Stored state could not be loaded', {
      message: error.message
    });

    return structuredClone(defaults);
  }
}

function save() {
  const write = safeWriteCompactState(localStorage, state, { onFailure: failure => {
    persistenceStatus.lastFailure = { ...failure, at: new Date().toISOString() };
    logger.warning('Compact state persistence was rejected', persistenceStatus.lastFailure);
  } });
  persistenceStatus.compactBytes = write.bytes;
  const snapshot = { id: 'application-large-state', conversations: structuredClone(state.conversations), evaluations: structuredClone(state.evaluations), updatedAt: new Date().toISOString() };
  persistenceQueue = persistenceQueue.then(() => putMany('stateRecords', [snapshot])).catch(error => {
    persistenceStatus.lastFailure = { reason: 'indexeddb-large-state-write-failed', message: error?.message || String(error), at: new Date().toISOString() };
    logger.warning('Large application state could not be persisted', persistenceStatus.lastFailure);
  });
  return write;
}

async function contentHash(file) {
  if (!file || !globalThis.crypto?.subtle || typeof file.arrayBuffer !== 'function') {
    return null;
  }

  try {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      await file.arrayBuffer()
    );

    return [...new Uint8Array(digest)]
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

function sameLegacyFingerprint(file, document) {
  return (
    document.name === file.name &&
    Number(document.size) === Number(file.size) &&
    Number.isFinite(Number(file.lastModified)) &&
    Number.isFinite(Number(document.lastModified)) &&
    Number(document.lastModified) === Number(file.lastModified)
  );
}

function sameDocumentContent(file, hash, document) {
  if (hash && document.contentHash) {
    return hash === document.contentHash;
  }

  return sameLegacyFingerprint(file, document);
}

function usableIndexedDocument(document, indexedSectionCount) {
  const status = String(document.status || '').toLowerCase();
  const lineageStatus = String(document.lineageStatus || '').toLowerCase();

  return (
    ['verified', 'complete', 'indexed', 'ready'].includes(status) &&
    !['superseded', 'duplicate'].includes(lineageStatus) &&
    Number(document.sectionCount) > 0 &&
    Number(indexedSectionCount) > 0
  );
}

function openDB() {
  const startedAt = perfNow();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DOC_DB, DOC_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('documents')) {
        const documents = db.createObjectStore('documents', {
          keyPath: 'id'
        });
        documents.createIndex('projectId', 'projectId');
        documents.createIndex('libraryId', 'libraryId');
      } else {
        const documents = request.transaction.objectStore('documents');
        if (!documents.indexNames.contains('projectId')) documents.createIndex('projectId', 'projectId');
        if (!documents.indexNames.contains('libraryId')) documents.createIndex('libraryId', 'libraryId');
      }

      let sections;
      if (!db.objectStoreNames.contains('sections')) {
        sections = db.createObjectStore('sections', {
          keyPath: 'id'
        });
      } else {
        sections = request.transaction.objectStore('sections');
      }

      if (!sections.indexNames.contains('projectId')) sections.createIndex('projectId', 'projectId');
      if (!sections.indexNames.contains('documentId')) sections.createIndex('documentId', 'documentId');
      if (!sections.indexNames.contains('parentId')) sections.createIndex('parentId', 'parentId');
      if (!sections.indexNames.contains('sectionNumber')) sections.createIndex('sectionNumber', 'sectionNumber');

      let inspectionRecords;
      if (!db.objectStoreNames.contains('inspectionRecords')) {
        inspectionRecords = db.createObjectStore('inspectionRecords', { keyPath: 'inspectionId' });
      } else {
        inspectionRecords = request.transaction.objectStore('inspectionRecords');
      }
      if (!inspectionRecords.indexNames.contains('projectId')) inspectionRecords.createIndex('projectId', 'projectId');
      if (!inspectionRecords.indexNames.contains('inspectionNumber')) inspectionRecords.createIndex('inspectionNumber', 'inspectionNumber');
      if (!inspectionRecords.indexNames.contains('status')) inspectionRecords.createIndex('status', 'status');

      let sourceFiles;
      if (!db.objectStoreNames.contains('sourceFiles')) sourceFiles = db.createObjectStore('sourceFiles', { keyPath: 'documentId' });
      else sourceFiles = request.transaction.objectStore('sourceFiles');
      if (!sourceFiles.indexNames.contains('projectId')) sourceFiles.createIndex('projectId', 'projectId');
      if (!sourceFiles.indexNames.contains('contentHash')) sourceFiles.createIndex('contentHash', 'contentHash');

      let drawingAnalyses;
      if (!db.objectStoreNames.contains('drawingAnalyses')) drawingAnalyses = db.createObjectStore('drawingAnalyses', { keyPath: 'drawingSetId' });
      else drawingAnalyses = request.transaction.objectStore('drawingAnalyses');
      if (!drawingAnalyses.indexNames.contains('projectId')) drawingAnalyses.createIndex('projectId', 'projectId');
      if (!drawingAnalyses.indexNames.contains('documentId')) drawingAnalyses.createIndex('documentId', 'documentId');
      if (!drawingAnalyses.indexNames.contains('analysisVersion')) drawingAnalyses.createIndex('analysisVersion', 'analysisVersion');
      if (!drawingAnalyses.indexNames.contains('status')) drawingAnalyses.createIndex('status', 'status');

      if (!db.objectStoreNames.contains('stateRecords')) db.createObjectStore('stateRecords', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('workspaceEvidenceBlobs')) {
        const blobs = db.createObjectStore('workspaceEvidenceBlobs', { keyPath: 'id' });
        blobs.createIndex('projectId', 'projectId');
        blobs.createIndex('workspaceId', 'workspaceId');
        blobs.createIndex('evidenceId', 'evidenceId');
      } else {
        const blobs = request.transaction.objectStore('workspaceEvidenceBlobs');
        if (!blobs.indexNames.contains('projectId')) blobs.createIndex('projectId', 'projectId');
        if (!blobs.indexNames.contains('workspaceId')) blobs.createIndex('workspaceId', 'workspaceId');
        if (!blobs.indexNames.contains('evidenceId')) blobs.createIndex('evidenceId', 'evidenceId');
      }
    };

    request.onsuccess = () => { logSlowOperation('indexeddb open', startedAt, { database: DOC_DB, version: DOC_DB_VERSION }); resolve(request.result); };
    request.onerror = () => { logSlowOperation('indexeddb open', startedAt, { database: DOC_DB, version: DOC_DB_VERSION, failed: true }); reject(request.error); };
  });
}

async function tx(store, mode, operation) {
  const startedAt = perfNow();
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const objectStore = transaction.objectStore(store);
    const output = operation(objectStore);

    transaction.oncomplete = () => {
      db.close();
      logSlowOperation('indexeddb transaction', startedAt, { store, mode });
      resolve(output);
    };

    transaction.onerror = () => {
      db.close();
      logSlowOperation('indexeddb transaction', startedAt, { store, mode, failed: true });
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      logSlowOperation('indexeddb transaction', startedAt, { store, mode, aborted: true });
      reject(transaction.error || new Error('Database transaction aborted.'));
    };
  });
}

async function all(store, index = null, key = null) {
  const startedAt = perfNow();
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');

    const source = index
      ? transaction.objectStore(store).index(index)
      : transaction.objectStore(store);

    const request = key === null
      ? source.getAll()
      : source.getAll(key);

    request.onsuccess = () => {
      db.close();
      logSlowOperation('indexeddb read', startedAt, { store, index: index || '', key: key === null ? '' : String(key), resultCount: Array.isArray(request.result) ? request.result.length : 0 });
      resolve(request.result || []);
    };

    request.onerror = () => {
      db.close();
      logSlowOperation('indexeddb read', startedAt, { store, index: index || '', key: key === null ? '' : String(key), failed: true });
      reject(request.error);
    };
  });
}

async function one(store, key) {
  const startedAt = perfNow();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).get(key);
    request.onsuccess = () => { db.close(); logSlowOperation('indexeddb read-one', startedAt, { store, key: String(key), hit: Boolean(request.result) }); resolve(request.result || null); };
    request.onerror = () => { db.close(); logSlowOperation('indexeddb read-one', startedAt, { store, key: String(key), failed: true }); reject(request.error); };
  });
}

async function putMany(store, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  const startedAt = perfNow();
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);

    for (const item of items) {
      objectStore.put(item);
    }

    transaction.oncomplete = () => {
      db.close();
      logSlowOperation('indexeddb write', startedAt, { store, itemCount: items.length });
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      logSlowOperation('indexeddb write', startedAt, { store, itemCount: items.length, failed: true });
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      logSlowOperation('indexeddb write', startedAt, { store, itemCount: items.length, aborted: true });
      reject(transaction.error || new Error('Database transaction aborted.'));
    };
  });
}

async function commitKnowledgeImport(
  documents,
  sections,
  lineageUpdates = [],
  sourceFiles = [],
  drawingAnalyses = []
) {
  if (!documents.length && !sections.length && !lineageUpdates.length && !sourceFiles.length && !drawingAnalyses.length) {
    return;
  }

  const startedAt = perfNow();
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      ['documents', 'sections', 'sourceFiles', 'drawingAnalyses'],
      'readwrite'
    );
    const documentStore = transaction.objectStore('documents');
    const sectionStore = transaction.objectStore('sections');
    const sourceFileStore = transaction.objectStore('sourceFiles');
    const drawingAnalysisStore = transaction.objectStore('drawingAnalyses');

    let lineageCount = 0;
    for (const document of lineageUpdates) {
      lineageCount += 1;
      documentStore.put(document);
    }

    let documentCount = 0;
    for (const document of documents) {
      documentCount += 1;
      documentStore.put(document);
    }

    let sectionCount = 0;
    for (const section of sections) {
      sectionCount += 1;
      sectionStore.put(section);
    }
    let sourceFileCount = 0;
    for (const sourceFile of sourceFiles) { sourceFileCount += 1; sourceFileStore.put(sourceFile); }
    let drawingAnalysisCount = 0;
    for (const analysis of drawingAnalyses) { drawingAnalysisCount += 1; drawingAnalysisStore.put(analysis); }

    transaction.oncomplete = () => {
      db.close();
      logSlowOperation('indexeddb write', startedAt, { store: 'documents+sections+sourceFiles+drawingAnalyses', lineageCount, documentCount, sectionCount, sourceFileCount, drawingAnalysisCount });
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      logSlowOperation('indexeddb write', startedAt, { store: 'documents+sections+sourceFiles+drawingAnalyses', failed: true, lineageCount, documentCount, sectionCount, sourceFileCount, drawingAnalysisCount });
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      logSlowOperation('indexeddb write', startedAt, { store: 'documents+sections+sourceFiles+drawingAnalyses', aborted: true, lineageCount, documentCount, sectionCount, sourceFileCount, drawingAnalysisCount });
      reject(transaction.error || new Error('Database transaction aborted.'));
    };
  });
}

async function delByIndex(store, index, key) {
  const rows = await all(store, index, key);

  if (!rows.length) {
    return;
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);

    for (const row of rows) {
      objectStore.delete(row.id || row.inspectionId || row.documentId || row.drawingSetId);
    }

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export const engine = {
  putMany,
  async initialize() {
    const retained = await one('stateRecords', 'application-large-state').catch(error => {
      persistenceStatus.lastFailure = { reason: 'indexeddb-large-state-read-failed', message: error?.message || String(error), at: new Date().toISOString() };
      return null;
    });
    let compactLegacyState = true;
    if (pendingLegacyLargeState) {
      state.conversations = pendingLegacyLargeState.conversations;
      state.evaluations = pendingLegacyLargeState.evaluations;
      try {
        await putMany('stateRecords', [{ id: 'application-large-state', conversations: structuredClone(state.conversations), evaluations: structuredClone(state.evaluations), updatedAt: new Date().toISOString() }]);
        persistenceStatus.migration = 'legacy-large-state-migrated'; pendingLegacyLargeState = null;
      } catch (error) {
        compactLegacyState = false;
        persistenceStatus.migration = 'legacy-large-state-retained';
        persistenceStatus.lastFailure = { reason: 'legacy-state-migration-failed', message: error?.message || String(error), at: new Date().toISOString() };
        logger.warning('Legacy large state remains available for manual recovery', persistenceStatus.lastFailure);
      }
    } else if (retained) {
      state.conversations = Array.isArray(retained.conversations) ? retained.conversations : [];
      state.evaluations = Array.isArray(retained.evaluations) ? retained.evaluations : [];
      persistenceStatus.migration = 'indexeddb-large-state-restored';
    }
    const active = selectActiveConversation(state.conversations, state.activeConversationId);
    if (!active && state.conversations.length) state.activeConversationId = sortConversations(state.conversations)[0]?.conversationId || '';
    state.chat = selectActiveConversation(state.conversations, state.activeConversationId)?.messages || [];
    const write = compactLegacyState ? safeWriteCompactState(localStorage, state, { onFailure: failure => { persistenceStatus.lastFailure = { ...failure, at: new Date().toISOString() }; } }) : { ok: false, bytes: new TextEncoder().encode(localStorage.getItem(STATE_KEY) || '').byteLength };
    persistenceStatus.compactBytes = write.bytes;
    logger.info('Compact state startup migration complete', { status: persistenceStatus.migration, compactBytes: write.bytes, conversations: state.conversations.length });
    return { ok: true, migration: persistenceStatus.migration, compactBytes: write.bytes };
  },

  async flushPersistence() { await persistenceQueue; return structuredClone(persistenceStatus); },

  async projectRecords(projectId = '') {
    const records = await all('stateRecords');
    return records.filter(item => item.kind === 'normalized-project-record' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record));
  },

  async saveProjectRecords(records = []) {
    const normalized = records.filter(item => item?.recordId && item?.projectId).map(record => ({ id: `normalized-project-record:${record.projectId}:${record.recordId}`, kind: 'normalized-project-record', projectId: record.projectId, record: structuredClone(record), updatedAt: new Date().toISOString() }));
    await putMany('stateRecords', normalized);
    return structuredClone(records);
  },

  async storageDiagnostics() {
    const [documents, sections, drawingAnalyses, stateRecords] = await Promise.all([all('documents'), all('sections'), all('drawingAnalyses'), all('stateRecords')]);
    const compact = localStorage.getItem(STATE_KEY) || '';
    const missionKeys = new Set([STATE_KEY, 'mission-companion:specification-index:v1', 'mc-drawing-page-catalog-v1', 'mission-companion:project-relationships:v1', 'mission-companion:drawing-spec-links:v1']);
    const keyBytes = {};
    for (const key of missionKeys) { const value = localStorage.getItem(key); if (value !== null) keyBytes[key] = new TextEncoder().encode(value).byteLength; }
    return {
      localStorageMissionCompanionBytes: Object.values(keyBytes).reduce((sum, value) => sum + value, 0),
      compactStateBytes: new TextEncoder().encode(compact).byteLength,
      compactStateLimitBytes: COMPACT_STATE_MAX_BYTES,
      indexedDbDocumentCount: documents.length,
      indexedDbKnowledgeChunkCount: sections.length,
      specificationSectionCount: sections.filter(item => /specification/i.test(`${item.category || ''} ${item.documentType || ''} ${item.metadata?.documentType || ''}`) || /^\d{2}\s?\d{2}\s?\d{2}/.test(String(item.sectionNumber || item.number || ''))).length,
      drawingAnalysisCount: drawingAnalyses.length,
      relationshipCount: 0,
      drawingSpecificationLinkCount: stateRecords.filter(item => item.kind === 'drawing-spec-link').length,
      drawingSpecificationLinkBackend: 'IndexedDB',
      drawingSpecificationLinkLocalStorageBytes: keyBytes['mission-companion:drawing-spec-links:v1'] || 0,
      largeStateRecordCount: stateRecords.length,
      lastPersistenceFailure: persistenceStatus.lastFailure,
      compactStateMigrationStatus: persistenceStatus.migration,
      localStorageCategoryBytes: keyBytes,
      categoryBytes: compactStateCategorySizes(state)
    };
  },

  state() {
    const active = selectActiveConversation(state.conversations, state.activeConversationId);
    return structuredClone({ ...state, chat: active?.messages || [] });
  },

  conversations() {
    return structuredClone(sortConversations(state.conversations));
  },

  activeConversation() {
    return structuredClone(selectActiveConversation(state.conversations, state.activeConversationId));
  },

  ensureActiveConversation({ projectId = state.activeProject } = {}) {
    const activeConversation = resolveActiveConversationTarget(state.conversations, state.activeConversationId);
    if (activeConversation) {
      if (state.activeConversationId !== activeConversation.conversationId) {
        state.activeConversationId = activeConversation.conversationId;
        state.chat = activeConversation.messages;
        save();
      }
      return { conversation: structuredClone(activeConversation), created: false, repaired: state.activeConversationId === activeConversation.conversationId };
    }
    const created = this.createConversation({ projectId });
    return { conversation: created, created: true, repaired: false };
  },

  createConversation({ projectId = '', title = '', now = new Date().toISOString() } = {}) {
    const conversation = normalizeConversation({
      conversationId: createIdentifier(),
      title,
      projectId: projectId && state.projects.some(project => project.id === projectId) ? projectId : '',
      createdAt: now,
      updatedAt: now,
      messages: [],
      attachmentDocumentIds: []
    }, { now });
    state.conversations.push(conversation);
    state.activeConversationId = conversation.conversationId;
    state.chat = conversation.messages;
    state.settings.mode = 'offline';
    save();
    return structuredClone(conversation);
  },

  activateConversation(conversationId) {
    const conversation = state.conversations.find(item => item.conversationId === conversationId);
    if (!conversation) throw new Error('Conversation not found.');
    state.activeConversationId = conversationId;
    state.chat = conversation.messages;
    state.settings.mode = conversationResponseMode(conversation);
    save();
    return structuredClone(conversation);
  },

  renameConversation(conversationId, title) {
    const index = state.conversations.findIndex(item => item.conversationId === conversationId);
    if (index < 0) throw new Error('Conversation not found.');
    state.conversations[index] = renameConversationRecord(state.conversations[index], title, new Date().toISOString());
    save();
    return structuredClone(state.conversations[index]);
  },

  appendConversationMessage(message, conversationId = state.activeConversationId) {
    let resolvedConversationId = conversationId;
    let conversation = state.conversations.find(item => item.conversationId === resolvedConversationId);
    if (!conversation) {
      const active = resolveActiveConversationTarget(state.conversations, state.activeConversationId);
      if (active) {
        resolvedConversationId = active.conversationId;
        state.activeConversationId = resolvedConversationId;
        state.chat = active.messages;
        conversation = state.conversations.find(item => item.conversationId === resolvedConversationId) || null;
      }
    }
    if (!conversation) {
      throw new Error('Conversation not found.');
    }
    const normalized = { ...structuredClone(message), id: message?.id || createIdentifier(), createdAt: message?.createdAt || new Date().toISOString() };
    conversation.messages.push(normalized);
    conversation.updatedAt = normalized.createdAt;
    if (conversation.title === 'New conversation') conversation.title = defaultConversationTitle(conversation.messages);
    if (resolvedConversationId === state.activeConversationId) state.chat = conversation.messages;
    save();
    return structuredClone(normalized);
  },

  addConversationAttachment(documentId, conversationId = state.activeConversationId) {
    const conversation = state.conversations.find(item => item.conversationId === conversationId);
    if (!conversation) throw new Error('Conversation not found.');
    conversation.attachmentDocumentIds = normalizeAttachmentDocumentIds([...conversation.attachmentDocumentIds, documentId]);
    conversation.updatedAt = new Date().toISOString();
    save();
    return structuredClone(conversation);
  },

  removeConversationAttachment(documentId, conversationId = state.activeConversationId) {
    const conversation = state.conversations.find(item => item.conversationId === conversationId);
    if (!conversation) throw new Error('Conversation not found.');
    conversation.attachmentDocumentIds = conversation.attachmentDocumentIds.filter(id => id !== documentId);
    conversation.updatedAt = new Date().toISOString();
    save();
    return structuredClone(conversation);
  },

  async healthCheck() {
    const db = await openDB();
    db.close();
    return true;
  },

  async testConnection() {
    const settings = state.settings;

    if (!settings.openaiKey) {
      throw new Error('Enter an OpenAI API key first.');
    }

    logger.info('OpenAI connection test started', {
      model: settings.openaiModel
    });

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.min(settings.timeout, 30000)
    );

    try {
      const response = await fetch(
        `${settings.openaiUrl.replace(/\/$/, '')}/models`,
        {
          headers: {
            Authorization: `Bearer ${settings.openaiKey}`
          },
          signal: controller.signal
        }
      );

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          responseBody?.error?.message ||
          `Connection failed (${response.status})`
        );
      }

      logger.info('OpenAI connection test passed');

      return {
        ok: true
      };
    } finally {
      clearTimeout(timer);
    }
  },

  async resetApplication() {
    logger.warning('Application reset requested');

    localStorage.removeItem(STATE_KEY);

    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DOC_DB);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });

    return true;
  },

  saveSettings(patch) {
    const normalizedPatch = {
      ...patch,
      ...(Object.hasOwn(patch, 'startupExperience')
        ? { startupExperience: normalizeStartupExperience(patch.startupExperience) }
        : {})
    };
    state.settings = {
      ...state.settings,
      ...normalizedPatch
    };

    save();

    logger.info('Settings updated', {
      keys: Object.keys(normalizedPatch).filter(key => key !== 'openaiKey')
    });
  },

  setProject(id) {
    const projectExists = state.projects.some(project => project.id === id);

    if (!projectExists) {
      throw new Error('Project not found.');
    }

    const previousProjectId = state.activeProject;
    state.activeProject = id;
    invalidateProjectKnowledgeCaches(previousProjectId);

    state.activeLibrary =
      state.libraries.find(
        library =>
          library.projectId === id &&
          library.enabled
      )?.id ||
      state.libraries.find(
        library => library.projectId === id
      )?.id ||
      null;

    save();

    logger.info('Active project changed', {
      id
    });
  },

  addProject(name) {
    const cleanedName = String(name || '').trim();

    if (!cleanedName) {
      throw new Error('Enter a project name.');
    }

    const project = {
      id: createIdentifier(),
      name: cleanedName
    };

    const library = {
      id: createIdentifier(),
      projectId: project.id,
      name: `${project.name} Library`,
      description: 'Project knowledge library',
      enabled: true,
      createdAt: new Date().toISOString()
    };

    state.projects.push(project);
    state.libraries.push(library);
    const previousProjectId = state.activeProject;
    state.activeProject = project.id;
    state.activeLibrary = library.id;
    invalidateProjectKnowledgeCaches(previousProjectId);

    save();

    logger.info('Project created', {
      id: project.id,
      name: project.name
    });

    return structuredClone(project);
  },

  async deleteProject(id) {
    if (id === 'general') {
      throw new Error('General cannot be deleted.');
    }

    const cleanup = { projectId: id, sections: false, inspectionRecords: false, sourceFiles: false, drawingAnalyses: false, documents: false, state: false };
    try {
      await delByIndex('sections', 'projectId', id); cleanup.sections = true;
      await delByIndex('inspectionRecords', 'projectId', id); cleanup.inspectionRecords = true;
      await delByIndex('sourceFiles', 'projectId', id); cleanup.sourceFiles = true;
      await delByIndex('drawingAnalyses', 'projectId', id); cleanup.drawingAnalyses = true;

    const documents = await all('documents', 'projectId', id);

    for (const document of documents.filter(
      item => item.projectId === id
    )) {
      await tx(
        'documents',
        'readwrite',
        store => store.delete(document.id)
      );
    }

      cleanup.documents = true;
    state.projects = state.projects.filter(
      project => project.id !== id
    );

    state.libraries = state.libraries.filter(
      library => library.projectId !== id
    );

    state.activeProject = 'general';

    state.activeLibrary =
      state.libraries.find(
        library => library.projectId === 'general'
      )?.id || null;

    invalidateProjectKnowledgeCaches(id);

    save(); cleanup.state = true;
    return { ok: true, status: 'deleted', cleanup };
    } catch (error) {
      error.cleanup = cleanup;
      logger.error('Project cleanup was incomplete', { projectId: id, cleanup, message: error.message });
      throw error;
    }
  },

  libraries() {
    return structuredClone(
      state.libraries.filter(
        library => library.projectId === state.activeProject
      )
    );
  },

  setLibrary(id) {
    const libraryExists = state.libraries.some(
      library =>
        library.id === id &&
        library.projectId === state.activeProject
    );

    if (!libraryExists) {
      throw new Error('Library not found.');
    }

    state.activeLibrary = id;
    save();
  },

  addLibrary(name, description = '') {
    const cleanedName = String(name || '').trim();

    if (!cleanedName) {
      throw new Error('Enter a library name.');
    }

    const library = {
      id: createIdentifier(),
      projectId: state.activeProject,
      name: cleanedName,
      description: String(description || '').trim(),
      enabled: true,
      createdAt: new Date().toISOString()
    };

    state.libraries.push(library);
    state.activeLibrary = library.id;

    save();

    logger.info('Knowledge library created', {
      name: library.name
    });

    return structuredClone(library);
  },

  updateLibrary(id, patch) {
    const library = state.libraries.find(
      item =>
        item.id === id &&
        item.projectId === state.activeProject
    );

    if (!library) {
      throw new Error('Library not found.');
    }

    Object.assign(library, patch, {
      updatedAt: new Date().toISOString()
    });

    if (!library.enabled && state.activeLibrary === id) {
      state.activeLibrary =
        state.libraries.find(
          item =>
            item.projectId === state.activeProject &&
            item.enabled &&
            item.id !== id
        )?.id || id;
    }

    save();

    return structuredClone(library);
  },

  async deleteLibrary(id) {
    const projectLibraries = state.libraries.filter(
      library => library.projectId === state.activeProject
    );

    if (projectLibraries.length <= 1) {
      throw new Error('Each project must keep at least one library.');
    }

    const documents = await all('documents', 'libraryId', id);

    for (const document of documents) {
      await this.removeDocument(document.id);
    }

    state.libraries = state.libraries.filter(
      library => library.id !== id
    );

    if (state.activeLibrary === id) {
      state.activeLibrary =
        state.libraries.find(
          library => library.projectId === state.activeProject
        )?.id || null;
    }

    save();
  },

  async documents(libraryId = null) {
    const documents = await documentCache.get(state.activeProject);
    return libraryId
      ? documents.filter(document => document.libraryId === libraryId)
      : documents;
  },

  async reclassifyDocument(documentId, patch = {}) {
    const existing = await one('documents', documentId);
    if (!existing) return { ok: false, reason: 'document-not-found' };
    const updated = persistDocumentClassification({ ...existing, buildingAssociation: Object.hasOwn(patch, 'buildingAssociation') ? patch.buildingAssociation : existing.buildingAssociation, revision: Object.hasOwn(patch, 'revision') ? patch.revision : existing.revision }, patch.documentType);
    if (patch.projectId && patch.projectId !== existing.projectId) {
      if (!state.projects.some(project => project.id === patch.projectId)) return { ok: false, reason: 'project-not-found' };
      updated.projectId = patch.projectId;
    }
    await putMany('documents', [updated]);
    invalidateProjectKnowledgeCaches([existing.projectId, updated.projectId]);
    logger.info('Document classification updated', { documentId, documentType: updated.documentType, projectId: updated.projectId });
    return { ok: true, document: structuredClone(updated), sourcePreserved: Boolean(await one('sourceFiles', documentId)), indexedSectionCount: (await all('sections', 'documentId', documentId)).length };
  },

  projectObjectPersistence() {
    return {
      loadObjects: async (projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === 'project-object' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record)),
      loadObservations: async (projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === 'project-object-observation' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record)),
      putObject: async record => putMany('stateRecords', [{ id: `project-object:${record.objectId}`, kind: 'project-object', projectId: record.projectId, pageId: record.drawingPageId, objectType: record.objectType, normalizedKey: record.normalizedKey, record: structuredClone(record), updatedAt: record.updatedAt }]),
      putObservation: async record => putMany('stateRecords', [{ id: `project-object-observation:${record.observationId}`, kind: 'project-object-observation', projectId: record.projectId, pageId: record.pageId, record: structuredClone(record), updatedAt: record.timestamp }])
    };
  },

  workspaceNotesPersistence() {
    return {
      loadNotes: async (projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === 'workspace-note' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record)),
      putNote: async record => putMany('stateRecords', [{ id: `workspace-note:${record.projectId}:${record.workspaceId}:${record.id}`, kind: 'workspace-note', projectId: record.projectId, workspaceId: record.workspaceId, noteCategory: record.category, record: structuredClone(record), updatedAt: record.updatedAt }]),
      deleteNote: async (noteId, projectId = state.activeProject, workspaceId = '') => tx('stateRecords', 'readwrite', store => store.delete(`workspace-note:${projectId}:${workspaceId}:${noteId}`))
    };
  },

  workspaceChecklistPersistence() {
    return {
      loadVerifications: async (projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === 'workspace-checklist-verification' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record)),
      putVerification: async record => putMany('stateRecords', [{ id: `workspace-checklist-verification:${record.projectId}:${record.workspaceId}:${record.itemId}`, kind: 'workspace-checklist-verification', projectId: record.projectId, workspaceId: record.workspaceId, itemId: record.itemId, verificationStatus: record.verificationStatus, record: structuredClone(record), updatedAt: record.updatedAt }]),
      deleteVerification: async (itemId, projectId = state.activeProject, workspaceId = '') => tx('stateRecords', 'readwrite', store => store.delete(`workspace-checklist-verification:${projectId}:${workspaceId}:${itemId}`))
    };
  },

  workspaceEvidencePersistence() {
    return {
      loadEvidence: async (projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === 'workspace-evidence' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record)),
      putEvidence: async record => putMany('stateRecords', [{ id: `workspace-evidence:${record.projectId}:${record.workspaceId}:${record.id}`, kind: 'workspace-evidence', projectId: record.projectId, workspaceId: record.workspaceId, evidenceType: record.type, record: structuredClone(record), updatedAt: record.updatedAt }]),
      deleteEvidence: async (evidenceId, projectId = state.activeProject, workspaceId = '') => {
        await tx('stateRecords', 'readwrite', store => store.delete(`workspace-evidence:${projectId}:${workspaceId}:${evidenceId}`));
        await tx('workspaceEvidenceBlobs', 'readwrite', store => store.delete(`workspace-evidence-blob:${projectId}:${workspaceId}:${evidenceId}`));
      }
    };
  },

  workspaceDrawingMarkupsPersistence() {
    const keyFor = (projectId = state.activeProject, workspaceId = '', drawingSetId = '', markupId = '') => `workspace-drawing-markup:${projectId}:${workspaceId}:${drawingSetId}:${markupId}`;
    const scopeMatch = (item = {}, projectId = '', workspaceId = '', drawingSetId = '') =>
      item.kind === 'workspace-drawing-markup' &&
      (!projectId || item.projectId === projectId) &&
      (!workspaceId || item.workspaceId === workspaceId) &&
      (!drawingSetId || item.drawingSetId === drawingSetId);
    return {
      loadMarkups: async (projectId = state.activeProject, workspaceId = '', drawingSetId = '') => (await all('stateRecords')).filter(item => scopeMatch(item, projectId, workspaceId, drawingSetId)).map(item => structuredClone(item.record)),
      saveMarkups: async (records = [], projectId = state.activeProject, workspaceId = '', drawingSetId = '') => {
        const existing = await all('stateRecords');
        const nextIds = new Set(records.map(record => keyFor(record.projectId || projectId, record.workspaceId || workspaceId, record.drawingSetId || drawingSetId, record.id)));
        const stale = existing.filter(item => scopeMatch(item, projectId, workspaceId, drawingSetId) && !nextIds.has(item.id));
        const normalized = records.map(record => ({ id: keyFor(record.projectId || projectId, record.workspaceId || workspaceId, record.drawingSetId || drawingSetId, record.id), kind: 'workspace-drawing-markup', projectId: record.projectId || projectId, workspaceId: record.workspaceId || workspaceId, drawingSetId: record.drawingSetId || drawingSetId, sheetNumber: record.sheetNumber || '', pdfPageNumber: Number(record.pdfPageNumber) || 0, markupType: record.type, record: structuredClone(record), updatedAt: record.updatedAt }));
        return tx('stateRecords', 'readwrite', store => {
          stale.forEach(item => store.delete(item.id));
          normalized.forEach(item => store.put(item));
        });
      },
      deleteMarkup: async (markupId, projectId = state.activeProject, workspaceId = '', drawingSetId = '') => tx('stateRecords', 'readwrite', store => store.delete(keyFor(projectId, workspaceId, drawingSetId, markupId)))
    };
  },

  workspaceDrawingToolsPersistence() {
    const keyFor = (projectId = state.activeProject, workspaceId = '', drawingSetId = '', toolId = '') => `workspace-drawing-tool:${projectId}:${workspaceId}:${drawingSetId}:${toolId}`;
    const scopeMatch = (item = {}, projectId = '', workspaceId = '', drawingSetId = '') =>
      item.kind === 'workspace-drawing-tool' &&
      (!projectId || item.projectId === projectId) &&
      (!workspaceId || item.workspaceId === workspaceId) &&
      (!drawingSetId || item.drawingSetId === drawingSetId);
    return {
      loadMarkupTools: async (projectId = state.activeProject, workspaceId = '', drawingSetId = '') => (await all('stateRecords')).filter(item => scopeMatch(item, projectId, workspaceId, drawingSetId)).map(item => structuredClone(item.record)),
      saveMarkupTools: async (records = [], projectId = state.activeProject, workspaceId = '', drawingSetId = '') => {
        const existing = await all('stateRecords');
        const nextIds = new Set(records.map(record => keyFor(record.projectId || projectId, record.workspaceId || workspaceId, record.drawingSetId || drawingSetId, record.id)));
        const stale = existing.filter(item => scopeMatch(item, projectId, workspaceId, drawingSetId) && !nextIds.has(item.id));
        const normalized = records.map(record => ({ id: keyFor(record.projectId || projectId, record.workspaceId || workspaceId, record.drawingSetId || drawingSetId, record.id), kind: 'workspace-drawing-tool', projectId: record.projectId || projectId, workspaceId: record.workspaceId || workspaceId, drawingSetId: record.drawingSetId || drawingSetId, toolSection: record.section || '', toolName: record.name || '', record: structuredClone(record), updatedAt: record.updatedAt }));
        return tx('stateRecords', 'readwrite', store => {
          stale.forEach(item => store.delete(item.id));
          normalized.forEach(item => store.put(item));
        });
      },
      deleteMarkupTool: async (toolId, projectId = state.activeProject, workspaceId = '', drawingSetId = '') => tx('stateRecords', 'readwrite', store => store.delete(keyFor(projectId, workspaceId, drawingSetId, toolId)))
    };
  },

  workspaceEvidenceBlobPersistence() {
    const blobIdFor = (projectId = state.activeProject, workspaceId = '', evidenceId = '') => `workspace-evidence-blob:${projectId}:${workspaceId}:${evidenceId}`;
    return {
      blobIdFor,
      loadBlob: async (evidenceId = '', projectId = state.activeProject, workspaceId = '') => {
        if (!evidenceId) return null;
        const record = await one('workspaceEvidenceBlobs', blobIdFor(projectId, workspaceId, evidenceId));
        return record ? structuredClone(record) : null;
      },
      putBlob: async record => {
        if (!record?.id || !(record.blob instanceof Blob)) throw new Error('workspace evidence blob records require a Blob payload.');
        const startedAt = perfNow();
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction('workspaceEvidenceBlobs', 'readwrite');
          const objectStore = transaction.objectStore('workspaceEvidenceBlobs');
          const payload = { ...record, blob: record.blob };
          const request = objectStore.put(payload);
          request.onerror = () => {
          };
          transaction.oncomplete = () => {
            db.close();
            resolve(structuredClone(record));
          };
          transaction.onabort = () => {
            db.close();
            reject(transaction.error || new Error('Database transaction aborted.'));
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        });
      },
      deleteBlob: async (evidenceId = '', projectId = state.activeProject, workspaceId = '') => tx('workspaceEvidenceBlobs', 'readwrite', store => store.delete(blobIdFor(projectId, workspaceId, evidenceId))),
      listBlobs: async (projectId = state.activeProject, workspaceId = '') => (await all('workspaceEvidenceBlobs')).filter(item => (!projectId || item.projectId === projectId) && (!workspaceId || item.workspaceId === workspaceId)).map(item => structuredClone(item)),
      debugBlobStore: async (projectId = state.activeProject, workspaceId = '') => {
        const db = await openDB();
        const rows = await all('workspaceEvidenceBlobs');
        const filtered = rows.filter(item => (!projectId || item.projectId === projectId) && (!workspaceId || item.workspaceId === workspaceId));
        db.close();
        return filtered.map(item => structuredClone(item));
      }
    };
  },

  workspaceObservationsPersistence() {
    return {
      loadObservations: async (projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === 'workspace-observation' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record)),
      putObservation: async record => putMany('stateRecords', [{ id: `workspace-observation:${record.projectId}:${record.workspaceId}:${record.id}`, kind: 'workspace-observation', projectId: record.projectId, workspaceId: record.workspaceId, observationCategory: record.category, record: structuredClone(record), updatedAt: record.updatedAt }]),
      deleteObservation: async (observationId, projectId = state.activeProject, workspaceId = '') => tx('stateRecords', 'readwrite', store => store.delete(`workspace-observation:${projectId}:${workspaceId}:${observationId}`))
    };
  },

  workspaceRfisPersistence() {
    return {
      loadRfis: async (projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === 'workspace-rfi' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record)),
      putRfi: async record => putMany('stateRecords', [{ id: `workspace-rfi:${record.projectId}:${record.workspaceId}:${record.id}`, kind: 'workspace-rfi', projectId: record.projectId, workspaceId: record.workspaceId, rfiStatus: record.status, record: structuredClone(record), updatedAt: record.updatedAt }]),
      deleteRfi: async (rfiId, projectId = state.activeProject, workspaceId = '') => tx('stateRecords', 'readwrite', store => store.delete(`workspace-rfi:${projectId}:${workspaceId}:${rfiId}`))
    };
  },

  constructionGraphPersistence() {
    const records = async (kind, projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === kind && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record));
    return {
      loadNodes: projectId => records('construction-graph-node', projectId),
      loadEdges: projectId => records('construction-graph-edge', projectId),
      loadHistory: async (projectId, recordId = '') => (await records('construction-graph-history', projectId)).filter(item => !recordId || item.recordId === recordId),
      putNode: async record => putMany('stateRecords', [{ id: `construction-graph-node:${record.projectId}:${record.nodeId}`, kind: 'construction-graph-node', projectId: record.projectId, nodeType: record.nodeType, sourcePageId: record.sourcePageId, record: structuredClone(record), updatedAt: record.updatedAt }]),
      putEdge: async record => putMany('stateRecords', [{ id: `construction-graph-edge:${record.projectId}:${record.edgeId}`, kind: 'construction-graph-edge', projectId: record.projectId, sourceNodeId: record.sourceNodeId, targetNodeId: record.targetNodeId, edgeType: record.edgeType, record: structuredClone(record), updatedAt: record.updatedAt }]),
      putHistory: async record => putMany('stateRecords', [{ id: record.historyId, kind: 'construction-graph-history', projectId: record.projectId, recordId: record.recordId, record: structuredClone(record), updatedAt: record.createdAt }])
    };
  },

  async sourceFile(documentId) {
    const record = await one('sourceFiles', documentId);
    if (record?.projectId !== state.activeProject) return null;
    return record ? structuredClone(record) : null;
  },

  drawingSpecificationLinkPersistence() {
    return {
      loadLinks: async (projectId = state.activeProject) => (await all('stateRecords')).filter(item => item.kind === 'drawing-spec-link' && (!projectId || item.projectId === projectId)).map(item => structuredClone(item.record)),
      putLink: async record => putMany('stateRecords', [{ id: `drawing-spec-link:${record.linkId}`, kind: 'drawing-spec-link', projectId: record.projectId, pageId: record.drawingPageId, objectId: record.objectId, activeKey: record.activeKey, record: structuredClone(record), updatedAt: record.updatedAt }]),
      deleteLink: async linkId => tx('stateRecords', 'readwrite', store => store.delete(`drawing-spec-link:${linkId}`))
    };
  },

  async drawingAnalysis(documentId) {
    const records = await all('drawingAnalyses', 'documentId', documentId);
    const record = records.find(item => item.projectId === state.activeProject);
    return record ? structuredClone(record) : null;
  },

  async drawingAnalyses() {
    const [analyses, documents] = await Promise.all([all('drawingAnalyses', 'projectId', state.activeProject), all('documents', 'projectId', state.activeProject)]);
    const drawingIds = new Set(documents.filter(isDrawingDocument).map(item => item.id));
    return structuredClone(analyses.filter(item => drawingIds.has(item.documentId)));
  },

  async drawingRegistryAnalyses() {
    const [analyses, documents] = await Promise.all([all('drawingAnalyses'), all('documents')]);
    const drawingIds = new Set(documents.filter(isDrawingDocument).map(item => item.id));
    return structuredClone(analyses.filter(item => drawingIds.has(item.documentId)));
  },

  async drawingLifecycle(documentId = '', drawingSetId = '') {
    const document = documentId ? await one('documents', documentId) : null;
    const sourceFile = documentId ? await one('sourceFiles', documentId) : null;
    const analysis = drawingSetId ? await one('drawingAnalyses', drawingSetId) : (documentId ? (await all('drawingAnalyses', 'documentId', documentId))[0] || null : null);
    if (document && !isDrawingDocument(document)) return { ok: false, status: 'unavailable', errorCode: 'invalid-document-role', warning: 'This document is not a drawing set.', document: structuredClone(document), sourceFile: sourceFile ? structuredClone(sourceFile) : null, analysis: null, owningProjectId: document.projectId || '' };
    const result = validateDrawingOwnership({ analysis, documents: document ? [document] : [], sourceFiles: sourceFile ? [sourceFile] : [], activeProjectId: state.activeProject, requireSource: document?.sourceAvailability === 'available' });
    return { ...result, document: result.document || (document ? structuredClone(document) : null), sourceFile: result.sourceFile || (sourceFile ? structuredClone(sourceFile) : null), owningProjectId: result.owningProjectId || document?.projectId || analysis?.projectId || '' };
  },

  async drawingLifecycleDiagnostics() {
    const [documents, analyses, sourceFiles] = await Promise.all([all('documents'), all('drawingAnalyses'), all('sourceFiles')]);
    const drawingDocuments = documents.filter(isDrawingDocument); const drawingIds = new Set(drawingDocuments.map(item => item.id));
    return classifyDrawingOrphans({ documents: drawingDocuments, analyses: analyses.filter(item => drawingIds.has(item.documentId)), sourceFiles: sourceFiles.filter(item => drawingIds.has(item.documentId)), activeProjectId: state.activeProject });
  },

  async removeDrawingAnalysis(drawingSetId) {
    const analysis = await one('drawingAnalyses', drawingSetId);
    if (!analysis) return { ok: false, status: 'unavailable', errorCode: 'drawing-analysis-orphan', warning: 'Drawing analysis is already unavailable.' };
    try {
      await tx('drawingAnalyses', 'readwrite', store => store.delete(drawingSetId));
      return { ok: true, status: 'removed', drawingSetId, documentId: analysis.documentId, projectId: analysis.projectId };
    } catch (error) {
      return { ok: false, status: 'failed', errorCode: 'drawing-save-failed', warning: 'Drawing analysis could not be removed.' };
    }
  },

  async saveDrawingAnalysis(analysis) {
    const document = analysis?.documentId ? await one('documents', analysis.documentId) : null;
    const sourceFile = analysis?.documentId ? await one('sourceFiles', analysis.documentId) : null;
    const existing = analysis?.drawingSetId ? await one('drawingAnalyses', analysis.drawingSetId) : null;
    if (document && !isDrawingDocument(document)) return { ok: false, status: 'unavailable', errorCode: 'invalid-document-role', warning: 'Only drawing-set documents may own drawing analyses.', analysis: structuredClone(analysis || null), document: structuredClone(document), recoverable: false };
    if (existing && existing.documentId !== analysis?.documentId) return { ok: false, status: 'unavailable', errorCode: 'drawing-analysis-invalid', warning: 'Drawing-set ownership does not match the exact document.', analysis: structuredClone(analysis || null), document: document ? structuredClone(document) : null, recoverable: true };
    const validation = validateDrawingOwnership({ analysis, documents: document ? [document] : [], sourceFiles: sourceFile ? [sourceFile] : [], activeProjectId: state.activeProject, requireSource: document?.sourceAvailability === 'available' });
    if (!validation.ok) return validation;
    try {
      await tx('drawingAnalyses', 'readwrite', store => store.put(structuredClone(analysis)));
      return { ...validation, ok: true, status: 'saved', analysis: structuredClone(analysis), warning: '', recoverable: false };
    } catch (error) {
      logger.error('Drawing analysis save failed', { drawingSetId: analysis.drawingSetId, documentId: analysis.documentId, message: error.message });
      return { ...validation, ok: false, status: 'failed', errorCode: 'drawing-save-failed', warning: 'Drawing analysis could not be saved.', recoverable: true };
    }
  },

  async reattachPdfSource(documentId, file) {
    const document = await one('documents', documentId);
    if (!document) return { ok: false, status: 'unavailable', errorCode: 'drawing-document-missing', warning: 'Drawing source unavailable.' };
    if (!(file instanceof Blob) || (file.type && file.type !== 'application/pdf')) return { ok: false, status: 'unavailable', errorCode: 'drawing-analysis-invalid', warning: 'Select the original PDF file.' };
    if (!document.contentHash) return { ok: false, status: 'unavailable', errorCode: 'drawing-analysis-invalid', warning: 'The stored document has no authoritative content hash. Reimport it as a new document.' };
    const hash = await contentHash(file);
    if (document.contentHash && (!hash || hash !== document.contentHash)) return { ok: false, status: 'unavailable', errorCode: 'drawing-source-missing', warning: 'The selected PDF does not match the stored document hash.' };
    const capacity = await inspectStorageCapacity(file.size);
    if (capacity.sufficient === false) throw new Error(`Not enough browser storage is available for this ${file.size}-byte PDF.`);
    const parsed = await parsePdfFile(file);
    const sourceBlob = file.type === 'application/pdf' ? file : new Blob([await file.arrayBuffer()], { type: 'application/pdf' });
    const sourceRecord = createPdfSourceRecord({ documentId, projectId: document.projectId, sourceBlob, contentHash: hash || document.contentHash || '', storedAt: new Date().toISOString() });
    const analysis = isDrawingDocument(document) ? buildDrawingAnalysis({ documentId, projectId: document.projectId, pages: parsed.pages, analyzedAt: new Date().toISOString() }) : null;
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['documents', 'sourceFiles', 'drawingAnalyses'], 'readwrite');
      transaction.objectStore('documents').put({ ...document, pageCount: parsed.pageCount, sourceAvailability: 'available', drawingAnalysisStatus: analysis?.status || 'not-applicable' });
      transaction.objectStore('sourceFiles').put(sourceRecord);
      if (analysis) transaction.objectStore('drawingAnalyses').put(analysis);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error('PDF reattachment transaction aborted.')); };
    });
    invalidateProjectKnowledgeCaches(document.projectId);
    return { ok: true, status: 'saved', documentId, projectId: document.projectId, drawingSetId: analysis?.drawingSetId || '', pageCount: parsed.pageCount, documentType: persistDocumentClassification(document).documentType };
  },

  async inspectionRecords({ includeArchived = false } = {}) {
    const records = await all('inspectionRecords', 'projectId', state.activeProject);
    return records
      .filter(record => includeArchived || !record.archivedAt)
      .sort((a, b) => String(a.inspectionNumber).localeCompare(String(b.inspectionNumber)));
  },

  async inspectionRecord(inspectionId) {
    const records = await all('inspectionRecords');
    return records.find(record => record.inspectionId === inspectionId) || null;
  },

  async nextInspectionNumber(projectId = state.activeProject) {
    return nextInspectionNumber(await all('inspectionRecords'), projectId);
  },

  async createInspectionRecord(input) {
    const now = new Date().toISOString();
    const existingRecords = await all('inspectionRecords');
    const candidate = normalizeInspectionRecord({
      ...input,
      inspectionId: input?.inspectionId || createIdentifier(),
      projectId: input?.projectId || state.activeProject,
      inspectionNumber: input?.inspectionNumber || nextInspectionNumber(existingRecords, input?.projectId || state.activeProject),
      createdAt: input?.createdAt || now,
      updatedAt: now
    });
    const validation = validateInspectionRecord(candidate, { projectIds: state.projects.map(project => project.id), existingRecords });
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    await tx('inspectionRecords', 'readwrite', store => store.put(validation.record));
    return structuredClone(validation.record);
  },

  async updateInspectionRecord(inspectionId, patch, options = {}) {
    const current = await this.inspectionRecord(inspectionId);
    if (!current || current.projectId !== state.activeProject) throw new Error('Inspection Record not found.');
    const transition = validateStatusTransition(current.status, patch?.status || current.status, { reopen: options.reopen === true });
    if (!transition.valid) throw new Error(transition.reason);
    const candidate = normalizeInspectionRecord({ ...current, ...patch, inspectionId: current.inspectionId, projectId: current.projectId, inspectionNumber: current.inspectionNumber, createdAt: current.createdAt, updatedAt: new Date().toISOString() });
    const validation = validateInspectionRecord(candidate, { projectIds: state.projects.map(project => project.id), existingRecords: await all('inspectionRecords'), currentInspectionId: inspectionId });
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    await tx('inspectionRecords', 'readwrite', store => store.put(validation.record));
    return structuredClone(validation.record);
  },

  async archiveInspectionRecord(inspectionId) {
    return this.updateInspectionRecord(inspectionId, { archivedAt: new Date().toISOString() });
  },

  async sections() {
    return sectionCache.get(state.activeProject);
  },

  async specificationSections(documentIds = [], sectionNumbers = []) {
    const ids = [...new Set((Array.isArray(documentIds) ? documentIds : []).map(String).filter(Boolean))];
    const numbers = [...new Set((Array.isArray(sectionNumbers) ? sectionNumbers : []).map(String).filter(Boolean))];
    if (!ids.length || !numbers.length) return [];
    const matched = (await Promise.all(numbers.map(number => all('sections', 'sectionNumber', number)))).flat().filter(section => ids.includes(section.documentId));
    const roots = matched.filter(section => section.hierarchyType === 'spec-section');
    const firstChildren = (await Promise.all(roots.map(section => all('sections', 'parentId', section.id)))).flat().filter(section => ids.includes(section.documentId));
    const secondChildren = (await Promise.all(firstChildren.map(section => all('sections', 'parentId', section.id)))).flat().filter(section => ids.includes(section.documentId));
    return [...roots, ...firstChildren, ...secondChildren];
  },

  async retrievableSections() {
    const [sections, documents] = await Promise.all([
      this.sections(),
      this.documents()
    ]);
    const supersededDocumentIds = new Set(
      documents
        .filter(document => document.lineageStatus === 'superseded')
        .map(document => document.id)
    );

    return sections.filter(section =>
      !supersededDocumentIds.has(section.documentId)
    );
  },

  async ingest(
    files,
    onProgress,
    libraryId = state.activeLibrary,
    options = {}
  ) {
    if (!libraryId) {
      throw new Error(
        'Create or select a knowledge library first.'
      );
    }

    const library = state.libraries.find(item =>
      item.id === libraryId && item.projectId === state.activeProject
    );

    if (!library) {
      throw new Error('The selected knowledge library is not available in this project.');
    }

    const reportProgress = typeof onProgress === 'function'
      ? onProgress
      : () => {};
    const incoming = [...files];
    const action = ['skip', 'reimport', 'replace'].includes(options.duplicateAction)
      ? options.duplicateAction
      : 'skip';
    const descriptors = await Promise.all(
      incoming.map(async file => ({
        file,
        contentHash: await contentHash(file),
        duplicate: null
      }))
    );
    let existing = await this.documents(libraryId);
    const projectSections = await this.sections();
    const sectionCounts = new Map();

    for (const section of projectSections) {
      sectionCounts.set(
        section.documentId,
        (sectionCounts.get(section.documentId) || 0) + 1
      );
    }

    const abandoned = existing.filter(document =>
      descriptors.some(({ file }) =>
        document.name === file.name &&
        Number(document.size) === Number(file.size)
      ) &&
      !usableIndexedDocument(document, sectionCounts.get(document.id))
    );

    for (const document of abandoned) {
      await this.removeDocument(document.id);
    }

    existing = existing.filter(
      document => !abandoned.some(item => item.id === document.id)
    );

    for (const descriptor of descriptors) {
      descriptor.duplicate = existing.find(document =>
        usableIndexedDocument(document, sectionCounts.get(document.id)) &&
        sameDocumentContent(
          descriptor.file,
          descriptor.contentHash,
          document
        )
      ) || null;
    }

    const acceptedDescriptors = descriptors.filter(descriptor =>
      action !== 'skip' || !descriptor.duplicate
    );
    const accepted = acceptedDescriptors.map(descriptor => descriptor.file);
    const project = state.projects.find(item => item.id === state.activeProject);
    const skipped = descriptors
      .filter(descriptor => action === 'skip' && descriptor.duplicate)
      .map(descriptor => ({
        name: descriptor.file.name,
        size: descriptor.file.size,
        lastModified: descriptor.file.lastModified || null,
        reason: 'A usable indexed copy already exists in this library.',
        duplicate: {
          projectId: state.activeProject,
          projectName: project?.name || state.activeProject,
          libraryId,
          libraryName: library?.name || libraryId,
          documentId: descriptor.duplicate.id,
          status: descriptor.duplicate.status,
          sectionCount: sectionCounts.get(descriptor.duplicate.id) || 0,
          contentHash: descriptor.duplicate.contentHash || null
        }
      }));

    logger.info('Document ingestion started', {
      files: accepted.map(file => file.name),
      libraryId,
      skipped: skipped.length,
      abandonedRemoved: abandoned.length,
      duplicateAction: action
    });

    try {
      const parsedResult = await parseFiles(
        accepted,
        state.activeProject,
        reportProgress,
        libraryId
      );

      const parsed = {
        ...parsedResult,
        documents: parsedResult.documents.map((document, index) => ({
          ...document,
          contentHash: acceptedDescriptors[index]?.contentHash || null
        }))
      };
      const sourceFiles = (parsed.sourceFiles || []).map(sourceFile => {
        const descriptorIndex = parsed.documents.findIndex(document => document.id === sourceFile.documentId);
        return { ...sourceFile, contentHash: acceptedDescriptors[descriptorIndex]?.contentHash || '' };
      });
      for (const sourceFile of sourceFiles) {
        const capacity = await inspectStorageCapacity(sourceFile.byteLength);
        if (capacity.sufficient === false) throw new Error(`Not enough browser storage is available to preserve ${sourceFile.byteLength} PDF bytes. Import was not registered.`);
      }
      const successfulDocuments = parsed.documents.filter(document =>
        document.status === 'verified'
      );
      const failedDocuments = parsed.documents.filter(document =>
        document.status !== 'verified'
      );

      for (const document of failedDocuments) {
        logger.error('Document extraction failed', {
          document: document.name,
          libraryId,
          message:
            document.error ||
            document.healthDetail ||
            'Document extraction failed.',
          stack: document.errorStack || ''
        });
      }

      const successfulIds = new Set(
        successfulDocuments.map(document => document.id)
      );
      const registeredSections = parsed.sections.filter(section =>
        successfulIds.has(section.documentId)
      );

      for (const document of successfulDocuments) {
        const detectedSections = registeredSections.filter(section =>
          section.documentId === document.id
        ).length;

        if (
          detectedSections <= 0 ||
          detectedSections !== Number(document.sectionCount)
        ) {
          throw new Error(
            `Document verification failed for ${document.name}: expected ${document.sectionCount} section(s), found ${detectedSections}.`
          );
        }
      }

      const successfulSourceFiles = sourceFiles.filter(sourceFile => successfulIds.has(sourceFile.documentId));
      const successfulDrawingAnalyses = (parsed.drawingAnalyses || []).filter(analysis => successfulIds.has(analysis.documentId));
      for (const document of successfulDocuments.filter(item => item.extension === 'pdf')) {
        const source = successfulSourceFiles.find(item => item.documentId === document.id);
        const analysis = successfulDrawingAnalyses.find(item => item.documentId === document.id);
        if (!source || isDrawingDocument(document) && !analysis) throw new Error(`Authoritative PDF source registration was unavailable for ${document.name}. Import was not registered.`);
        document.sourceAvailability = 'available';
        document.drawingAnalysisStatus = analysis?.status || 'not-applicable';
      }

      successfulDocuments.forEach((document, index) => {
        reportProgress({
          current: index + 1,
          total: successfulDocuments.length,
          name: document.name,
          stage: 'indexing'
        });
      });

      const importedAt = new Date().toISOString();
      const lineageUpdates = [];

      for (const document of successfulDocuments) {
        const parsedIndex = parsed.documents.indexOf(document);
        const descriptor = acceptedDescriptors[parsedIndex];
        const duplicateId =
          options.duplicateDocumentId ||
          descriptor?.duplicate?.id;
        const priorDocument = existing.find(item => item.id === duplicateId);

        if (action === 'replace' && priorDocument) {
          const lineageId = priorDocument.lineageId || priorDocument.id;
          Object.assign(document, {
            lineageId,
            lineageStatus: 'current',
            previousDocumentId: priorDocument.id,
            importedAt
          });
          lineageUpdates.push({
            ...priorDocument,
            lineageId,
            lineageStatus: 'superseded',
            supersededByDocumentId: document.id
          });
        } else if (action === 'reimport' && priorDocument) {
          Object.assign(document, {
            lineageId: priorDocument.lineageId || priorDocument.id,
            lineageStatus: 'duplicate',
            duplicateOfDocumentId: priorDocument.id,
            importedAt
          });
        } else {
          Object.assign(document, {
            lineageId: document.lineageId || document.id,
            lineageStatus: document.lineageStatus || 'current',
            importedAt: document.importedAt || importedAt
          });
        }
      }

      await commitKnowledgeImport(
        successfulDocuments,
        registeredSections,
        lineageUpdates,
        successfulSourceFiles,
        successfulDrawingAnalyses
      );
      invalidateProjectKnowledgeCaches(state.activeProject);

      successfulDocuments.forEach((document, index) => {
        reportProgress({
          current: index + 1,
          total: successfulDocuments.length,
          name: document.name,
          stage: 'verifying'
        });
      });

      logger.info('Document ingestion completed', {
        documents: successfulDocuments.length,
        failedDocuments: failedDocuments.length,
        sections: registeredSections.length,
        skipped: skipped.length,
        abandonedRemoved: abandoned.length,
        duplicateAction: action
      });

      return {
        ...parsed,
        sections: registeredSections,
        skipped,
        abandonedRemoved: abandoned.map(document => document.id)
      };
    } catch (error) {
      logger.error('Document ingestion failed', {
        message: error.message
      });

      throw error;
    }
  },

  async removeDocument(id) {
    const cleanup = { documentId: id, sections: false, sourceFile: false, drawingAnalyses: false, document: false };
    try {
      await delByIndex('sections', 'documentId', id); cleanup.sections = true;
      await tx('sourceFiles', 'readwrite', store => store.delete(id)); cleanup.sourceFile = true;
      await delByIndex('drawingAnalyses', 'documentId', id); cleanup.drawingAnalyses = true;
      invalidateProjectKnowledgeCaches(document?.projectId || state.activeProject);
      await tx('documents', 'readwrite', store => store.delete(id)); cleanup.document = true;
      logger.info('Document removed', { id });
      return { ok: true, status: 'deleted', cleanup };
    } catch (error) {
      error.cleanup = cleanup;
      logger.error('Document cleanup was incomplete', { documentId: id, cleanup, message: error.message });
      throw error;
    }
  },

  async search(query, options = {}) {
    const allSections = await this.retrievableSections();
    const scopeIds = normalizeAttachmentDocumentIds(options.documentIds);
    const sectionIds = normalizeAttachmentDocumentIds(options.sectionIds);
    const pageNumbers = [...new Set((Array.isArray(options.pageNumbers) ? options.pageNumbers : []).map(Number).filter(value => Number.isInteger(value) && value > 0))];
    let sections = scopeIds.length
      ? allSections.filter(section => scopeIds.includes(section.documentId))
      : allSections;
    if (sectionIds.length) sections = sections.filter(section => sectionIds.includes(section.id));
    if (pageNumbers.length) sections = sections.filter(section => {
      const start = Number(section.pageStart || section.metadata?.pageRange?.start || 0);
      const end = Number(section.pageEnd || section.metadata?.pageRange?.end || start);
      return pageNumbers.some(page => start <= page && end >= page);
    });

    const hits = retrieve(
      query,
      sections,
      state.settings.topK
    );

    logger.info('Retrieval completed', {
      query,
      sectionsSearched: sections.length,
      hits: hits.length
    });

    return hits;
  },

  async extractRequirements(query = '', options = {}) {
    const sections = await this.retrievableSections();
    const cleanedQuery = String(query || '').trim();
    const sourceSections = cleanedQuery
      ? retrieve(cleanedQuery, sections, Math.min(50, Number(options.limit) || 50))
      : sections;
    const result = extractRequirementsFromSections(sourceSections, cleanedQuery, {
      limit: options.limit || 100,
      includeAdvisory: options.includeAdvisory !== false,
      includeNegative: options.includeNegative !== false
    });

    logger.info('Requirement extraction completed', {
      query,
      sectionsSearched: sourceSections.length,
      requirements: result.requirements.length,
      mandatory: result.summary.mandatory,
      prohibited: result.summary.prohibited
    });

    return structuredClone(result);
  },

  async extractDefinitions(query = '', options = {}) {
    const sections = await this.retrievableSections();
    const cleanedQuery = String(query || '').trim();
    const sourceSections = cleanedQuery
      ? retrieve(cleanedQuery, sections, Math.min(50, Number(options.limit) || 50))
      : sections;
    const result = extractDefinitionsFromSections(sourceSections, cleanedQuery, {
      limit: options.limit || 100
    });

    logger.info('Definition extraction completed', {
      query,
      sectionsSearched: sourceSections.length,
      definitions: result.definitions.length
    });

    return structuredClone(result);
  },

  async compareSources(query, options = {}) {
    const cleanedQuery = String(query || '').trim();

    if (!cleanedQuery) {
      throw new Error('Enter a topic or question to compare.');
    }

    const sections = await this.retrievableSections();
    const hits = retrieve(
      cleanedQuery,
      sections,
      Math.max(Number(options.topK || state.settings.topK || 10), 10)
    );

    const comparison = compareRetrievedSources(cleanedQuery, hits, {
      maximumSources: options.maximumSources || 8
    });

    logger.info('Source comparison completed', {
      query: cleanedQuery,
      hits: hits.length,
      agreements: comparison.agreements.length,
      differences: comparison.differences.length,
      conflicts: comparison.conflicts.length
    });

    return structuredClone(comparison);
  },

  async analyzeKnowledge(query, options = {}) {
    const cleanedQuery = String(query || '').trim();

    if (!cleanedQuery) {
      throw new Error('Enter a topic or question to analyze.');
    }

    const sections = await this.retrievableSections();
    const hits = retrieve(
      cleanedQuery,
      sections,
      options.topK || state.settings.topK
    );

    const requirements = extractRequirementsFromSections(hits, cleanedQuery, {
      limit: options.requirementLimit || 50,
      includeAdvisory: true,
      includeNegative: true
    });

    const definitions = extractDefinitionsFromSections(hits, cleanedQuery, {
      limit: options.definitionLimit || 50
    });

    const comparison = compareRetrievedSources(cleanedQuery, hits, {
      maximumSources: options.maximumSources || 8
    });

    return structuredClone({
      query: cleanedQuery,
      generatedAt: new Date().toISOString(),
      retrieval: {
        hits,
        meta: hits.meta || {}
      },
      requirements,
      definitions,
      comparison
    });
  },

  async ask(prompt, mode = state.settings.mode, options = {}) {
    const cleanedPrompt = String(prompt || '').trim();
    const rawMode = String(mode || '');
    const normalizedMode = normalizeChiefResponseMode(rawMode);
    const requestId = String(options.requestId || createIdentifier());

    if (!cleanedPrompt) {
      throw new Error('Enter a question.');
    }

    console.log('ENGINE_RESPONSE_MODE_RECEIVED', {
      rawMode,
      normalizedMode
    });

    logger.info('Analysis started', {
      mode: normalizedMode,
      promptLength: cleanedPrompt.length
    });

    const documentIds = normalizeAttachmentDocumentIds(options.documentIds);
    const sectionIds = normalizeAttachmentDocumentIds(options.sectionIds);
    const pageNumbers = [...new Set((Array.isArray(options.pageNumbers) ? options.pageNumbers : []).map(Number).filter(value => Number.isInteger(value) && value > 0))];
    const sheetIds = normalizeAttachmentDocumentIds(options.sheetIds);
    const routingDocumentIds = normalizeAttachmentDocumentIds(options.routingDocumentIds);
    const scopedDocumentIds = [...new Set([...documentIds, ...routingDocumentIds].filter(Boolean))];
    const bridge = getChiefIntelligenceBridge?.();
    if (bridge?.readyPromise) {
      await bridge.readyPromise;
    }
    const bridgeContext = bridge?.initialized ? bridge.buildProjectContext(cleanedPrompt, options.drawingContext) : null;
    if (bridgeContext) {
      const projectRecords = await loadAuthoritativeProjectRecords({ engine: this, projectId: state.activeProject });
      const selectedRecordId = options.projectRecordId || options.selectedRecordId || getActiveProjectRecordContext();
      const relevantRecords = selectRelevantProjectRecords(projectRecords, cleanedPrompt, { selectedRecordId, projectId: state.activeProject });
      bridgeContext.normalizedProjectRecords = relevantRecords;
      bridgeContext.normalizedProjectRecordContext = buildProjectRecordContext(relevantRecords);
    }
    const hasBridgeEvidence = Boolean(
      bridgeContext?.specificationAnswer &&
      bridge?.hasSufficientEvidence?.(bridgeContext)
    ) || Boolean(
      bridgeContext?.pmisAnswer &&
      bridge?.hasSufficientEvidence?.(bridgeContext)
    );
    const bridgeSpecificationCount = bridgeContext?.specificationAnswer?.specifications?.length || 0;
    console.log('CHIEF_ASK_ROUTE', {
      question: cleanedPrompt,
      mode: normalizedMode,
      bridgeInitialized: Boolean(bridge?.initialized),
      bridgeHasSpecAnswer: Boolean(bridgeContext?.specificationAnswer),
      bridgeHasSufficientEvidence: hasBridgeEvidence,
      providerRequired: mode !== 'offline',
      bridgeSpecificationCount,
      retrievalHitCount: 0,
      drawingContextSheet: options.drawingContext?.identity?.sheetNumber || options.drawingContext?.sheetNumber || '',
      drawingContextPageId: options.drawingContext?.identity?.pageId || options.drawingContext?.pageId || ''
    });
    if (hasBridgeEvidence && normalizedMode === 'offline') {
      const bridgeAnswer = bridge.generateMissionCompanionAnswer(cleanedPrompt, bridgeContext, normalizedMode);
      console.log('CHIEF_ASK_SPEC_RESULT', {
        question: cleanedPrompt,
        mode: normalizedMode,
        queryType: bridgeContext.specificationAnswer?.queryType || '',
        sectionNumbers: bridgeContext.specificationAnswer?.specifications?.map(item => item.sectionNumber) || [],
        drawingCount: bridgeContext.specificationAnswer?.drawings?.length || 0
      });
      const answer = {
        content: bridgeAnswer?.answer || bridgeContext.pmisAnswer?.answer || bridgeContext.specificationAnswer?.answer || '',
        citations: [],
        source: 'mission-companion',
        specificationAnswer: bridgeAnswer?.specificationAnswer || bridgeContext.specificationAnswer,
        pmisAnswer: bridgeAnswer?.pmisAnswer || bridgeContext.pmisAnswer || null,
        reasoningPath: bridgeAnswer?.reasoningPath || [],
        evidence: bridgeAnswer?.evidence || [],
        assumptions: bridgeAnswer?.assumptions || [],
        unresolvedQuestions: bridgeAnswer?.unresolvedQuestions || [],
        conflicts: bridgeAnswer?.conflicts || [],
        diagnostics: bridgeAnswer?.diagnostics || { source: 'specification-sme' }
      };
      const citationVerification = verifyCitations(answer.content, []);
      const message = {
        id: createIdentifier(),
        role: 'assistant',
        content: answer.content,
        citations: answer.citations,
        hits: [],
        retrievalMeta: {},
        citationVerification,
        createdAt: new Date().toISOString(),
        mode: normalizedMode,
        requestId,
        specificationAnswer: answer.specificationAnswer,
        pmisAnswer: answer.pmisAnswer
      };
      const activeConversation = this.ensureActiveConversation({ projectId: state.activeProject });
      const activeConversationId = activeConversation.conversation.conversationId;
      this.appendConversationMessage({
        id: createIdentifier(),
        role: 'user',
        content: cleanedPrompt,
        createdAt: new Date().toISOString()
      }, activeConversationId);
      this.appendConversationMessage(message, activeConversationId);
      console.log('ASSISTANT_MESSAGE_FINALIZED', {
        requestId,
        mode: normalizedMode,
        contentPreview: String(message.content || '').slice(0, 160)
      });
      return structuredClone(message);
    }
    const hits = await this.search(cleanedPrompt, { documentIds: scopedDocumentIds, sectionIds, pageNumbers });
    console.log('CHIEF_AI_ROUTE', {
      question: cleanedPrompt,
      mode: normalizedMode,
      hasBridgeEvidence,
      bridgeSpecificationCount,
      retrievalHitCount: hits.length,
      providerRequired: mode !== 'offline'
    });
    console.log('CHIEF_ASK_GENERIC_RETRIEVAL', {
      question: cleanedPrompt,
      hits: hits.length,
      mode
    });
    if ((scopedDocumentIds.length || sectionIds.length || pageNumbers.length) && !hits.length && !options.drawingContext) {
      throw new Error(pageNumbers.length || sectionIds.length ? 'The exact drawing scope has no usable indexed section evidence. The drawing viewer remains available.' : 'The selected attachments do not contain usable indexed sections for this question.');
    }

    let answer;

    console.log('SME_CONTEXT_READY', {
      requestId,
      mode: normalizedMode,
      hasBridgeEvidence,
      bridgeSpecificationCount,
      retrievalHitCount: hits.length
    });

    if (normalizedMode === 'offline') {
      answer = callOffline(cleanedPrompt, hits);
    } else {
      let structuredAnalysis = '';
      let dependencyAnalysis = '';
      let assistedEvidenceExpansion = { assessment: null, query: '', hits: [], context: '' };

      try {
        const analysis = analyzeCorpus(cleanedPrompt, hits, {
          preset: 'answer',
          includeContext: false
        });

        structuredAnalysis = buildStructuredAnalysisBlock(analysis, hits);
      } catch (error) {
        logger.warning('Structured analysis unavailable', {
          message: error?.message || String(error)
        });
      }

      if (
        hits.length &&
        hits.meta?.queryExpansion?.intents?.includes('dependency')
      ) {
        try {
          const {
            buildDependencyGraph,
            answerDependencyQuestion,
            buildWorkflowSequence
          } = await import('./core/dependency.js');

          const graph = buildDependencyGraph(hits, {
            includePhaseInference: true
          });

          const dependencyResult = answerDependencyQuestion(
            graph,
            cleanedPrompt,
            {
              limit: 3,
              maxDepth: 4,
              minimumScore: 0.25
            }
          );

          const sequence = shouldIncludeDependencySequence(cleanedPrompt)
            ? buildWorkflowSequence(graph)
            : null;

          dependencyAnalysis = buildDependencyAnalysisBlock(
            graph,
            dependencyResult,
            sequence,
            hits
          );
        } catch (error) {
          logger.warning('Dependency analysis unavailable', {
            message: error?.message || String(error)
          });
        }
      }

      if (normalizedMode === 'assisted') {
        const assessment = assessAssistedEvidence({
          question: cleanedPrompt,
          bridgeContext,
          initialHits: hits
        });
        const assistedSearchQueries = buildAssistedSearchQueries({
          question: cleanedPrompt,
          bridgeContext,
          initialHits: hits,
          assessment
        });

        console.log('ASSISTED_QUERY_ANALYSIS', {
          requestId,
          question: cleanedPrompt,
          mode: normalizedMode,
          initialEvidenceCount: assessment.initialEvidenceCount,
          hasProjectEvidence: assessment.hasProjectEvidence,
          scheduleIntent: assessment.scheduleIntent,
          directTimingEvidence: assessment.directTimingEvidence,
          sufficient: assessment.sufficient,
          needsExpansion: assessment.needsExpansion,
          sectionHints: assessment.sectionHints.slice(0, 12)
        });
        console.log('ASSISTED_SEARCH_QUERIES', {
          requestId,
          queryCount: assistedSearchQueries.length,
          queries: assistedSearchQueries.slice(0, 12)
        });

        if (assessment.needsExpansion) {
          const authoritativeSections = await this.retrievableSections();
          const corpusDocumentCount = new Set(
            authoritativeSections.map(section =>
              String(section.documentId || section.document?.id || section.documentName || '').trim()
            ).filter(Boolean)
          ).size;

          console.log('ASSISTED_CORPUS_STATS', {
            requestId,
            sectionCount: authoritativeSections.length,
            documentCount: corpusDocumentCount,
            retrievedSectionCount: 0,
            mode: normalizedMode,
            question: cleanedPrompt,
            query: assessment.expansionQuery
          });

          assistedEvidenceExpansion = buildAssistedEvidenceExpansion({
            question: cleanedPrompt,
            bridgeContext,
            initialHits: hits,
            authoritativeSections,
            retrieve,
            limit: Math.max(8, state.settings.topK || 10)
          });

          const selectedPassages = selectAssistedPassages(
            assistedEvidenceExpansion.hits,
            assistedEvidenceExpansion.assessment
          );

          console.log('ASSISTED_RETRIEVAL_HITS', {
            requestId,
            queryCount: assistedEvidenceExpansion.queries?.length || assistedSearchQueries.length,
            hitCount: assistedEvidenceExpansion.hits.length,
            sectionNumbers: assistedEvidenceExpansion.hits.map(hit => hit.sectionNumber).slice(0, 12),
            pageRanges: assistedEvidenceExpansion.hits.map(hit => `${hit.pageStart || ''}-${hit.pageEnd || ''}`).slice(0, 12)
          });
          console.log('ASSISTED_PASSAGES_SELECTED', {
            requestId,
            selectedCount: selectedPassages.length,
            sectionNumbers: selectedPassages.map(hit => hit.sectionNumber).slice(0, 8),
            pageRanges: selectedPassages.map(hit => `${hit.pageStart || ''}-${hit.pageEnd || ''}`).slice(0, 8),
            previews: selectedPassages.map(hit => String(hit.text || hit.summary || '').slice(0, 120)).slice(0, 3)
          });
          console.log('ASSISTED_PROVIDER_CONTEXT', {
            requestId,
            contextLength: assistedEvidenceExpansion.context.length,
            preview: assistedEvidenceExpansion.context.slice(0, 400)
          });
        }
      }

      const bridgeEvidenceContext = bridge?.buildContextString?.(bridgeContext) || '';
      const evidenceContext = buildContext(hits, cleanedPrompt, options.drawingContext);
      const context = [
        bridgeEvidenceContext ? `AUTHORITATIVE PROJECT SME CONTEXT:\n${bridgeEvidenceContext}` : '',
        evidenceContext ? `INDEXED PROJECT EVIDENCE:\n${evidenceContext}` : '',
        normalizedMode === 'assisted' && assistedEvidenceExpansion.context
          ? assistedEvidenceExpansion.context
          : '',
        structuredAnalysis,
        dependencyAnalysis
      ].filter(Boolean).join('\n\n');

      answer = await callAI(
        cleanedPrompt,
        context,
        normalizedMode,
        {
          requestId,
          bridgeContextIncluded: Boolean(bridgeEvidenceContext),
          contextLength: context.length
        }
      );
    }

    const citationVerification = verifyCitations(
      answer.content,
      hits
    );

    const message = {
      id: createIdentifier(),
      role: 'assistant',
      content: answer.content,
      citations: answer.citations,
      hits,
      retrievalMeta: hits.meta || {},
      citationVerification,
      createdAt: new Date().toISOString(),
      mode: normalizedMode,
      requestId,
      specificationAnswer: bridgeContext?.specificationAnswer || null,
      pmisAnswer: bridgeContext?.pmisAnswer || null,
      drawingContext: options.drawingContext ? {
        projectId: String(options.drawingContext.projectId || ''), documentId: String(options.drawingContext.documentId || ''),
        drawingSetId: String(options.drawingContext.drawingSetId || ''), sheetId: String(options.drawingContext.sheetId || ''),
        pageNumber: Number(options.drawingContext.pageNumber) || null, sheetNumber: String(options.drawingContext.sheetNumber || ''),
        observationId: String(options.drawingContext.observationId || ''), region: options.drawingContext.region ? structuredClone(options.drawingContext.region) : null
      } : null,
      workPackageReferences: options.workPackageReferences ? {
        matchingSheetIds: normalizeAttachmentDocumentIds(options.workPackageReferences.matchingSheetIds),
        matchingObservationIds: normalizeAttachmentDocumentIds(options.workPackageReferences.matchingObservationIds),
        documentIds: scopedDocumentIds, sectionIds, pageNumbers, sheetIds
      } : null
    };

    const conversationPrep = this.ensureActiveConversation({ projectId: state.activeProject });
    const conversationId = conversationPrep?.conversation?.conversationId || state.activeConversationId;
    this.appendConversationMessage({
      id: createIdentifier(),
      role: 'user',
      content: cleanedPrompt,
      createdAt: new Date().toISOString()
    }, conversationId);
    this.appendConversationMessage(message, conversationId);

    console.log('ASSISTANT_MESSAGE_FINALIZED', {
      requestId,
      mode: normalizedMode,
      contentPreview: String(message.content || '').slice(0, 160)
    });

    logger.info('Analysis completed', {
      mode,
      hits: hits.length,
      citations: message.citations.length,
      citationCoverage: citationVerification.coverage,
      conflicts: hits.meta?.conflicts?.length || 0
    });

    return structuredClone(message);
  },

  clearChat() {
    const active = state.conversations.find(item => item.conversationId === state.activeConversationId);
    if (active) {
      active.messages = [];
      active.title = 'New conversation';
      active.updatedAt = new Date().toISOString();
      state.chat = active.messages;
    }
    save();
  },

  addEvaluation(evaluation) {
    state.evaluations.push({
      id: createIdentifier(),
      ...evaluation
    });

    save();
  },

  removeEvaluation(id) {
    state.evaluations = state.evaluations.filter(
      evaluation => evaluation.id !== id
    );

    save();
  },

  async runEvaluation(evaluation) {
    const hits = await this.search(evaluation.question);
    let answer;

    if (state.settings.openaiKey) {
      answer = await callAI(
        evaluation.question,
        buildContext(hits),
        'source'
      );
    } else {
      answer = callOffline(
        evaluation.question,
        hits
      );
    }

    return scoreAnswer(
      answer.content,
      evaluation,
      hits
    );
  },

  async exportProject() {
    return {
      manifest: {
        version: APP_VERSION,
        project: state.projects.find(
          project => project.id === state.activeProject
        ),
        exportedAt: new Date().toISOString()
      },
      libraries: this.libraries(),
      documents: await this.documents(),
      sections: await this.sections(),
      inspectionRecords: await this.inspectionRecords({ includeArchived: true }),
      drawingAnalyses: await this.drawingAnalyses(),
      sourceFilesIncluded: false,
      evaluations: structuredClone(state.evaluations)
    };
  },

  async importProject(data, options = {}) {
    if (
      !data?.manifest ||
      !Array.isArray(data.documents) ||
      !Array.isArray(data.sections)
    ) {
      throw new Error(
        'Invalid Mission Companion project file.'
      );
    }

    const preserveIdentifiers = options.preserveIdentifiers === true;
    const sourceProject = data.manifest.project || {};
    const incomingDocumentIds = data.documents.map(item => String(item?.id || '').trim());
    if (incomingDocumentIds.some(id => !id) || new Set(incomingDocumentIds).size !== incomingDocumentIds.length) throw new Error('Imported projects require unique document identifiers.');
    const incomingAnalyses = Array.isArray(data.drawingAnalyses) ? data.drawingAnalyses : [];
    const incomingDrawingSetIds = incomingAnalyses.map(item => String(item?.drawingSetId || '').trim());
    if (incomingDrawingSetIds.some(id => !id) || new Set(incomingDrawingSetIds).size !== incomingDrawingSetIds.length) throw new Error('Imported projects require unique drawing-set identifiers.');
    for (const analysis of incomingAnalyses) {
      if (!incomingDocumentIds.includes(String(analysis.documentId || '').trim())) throw new Error(`Imported drawing analysis ${analysis.drawingSetId || 'unavailable'} has no exact source document.`);
      if (analysis.projectId && sourceProject.id && analysis.projectId !== sourceProject.id) throw new Error(`Imported drawing analysis ${analysis.drawingSetId} does not belong to the exported project.`);
    }
    for (const sourceFile of Array.isArray(data.sourceFiles) ? data.sourceFiles : []) {
      if (!incomingDocumentIds.includes(String(sourceFile.documentId || '').trim())) throw new Error('Imported drawing source has no exact document.');
      if (sourceFile.projectId && sourceProject.id && sourceFile.projectId !== sourceProject.id) throw new Error('Imported drawing source does not belong to the exported project.');
    }
    const sourceInspectionRecords = Array.isArray(data.inspectionRecords) ? data.inspectionRecords : [];
    const existingInspectionRecords = await all('inspectionRecords');
    const sourceInspectionValidationRecords = sourceInspectionRecords.map(normalizeInspectionRecord);
    const sourceInspectionIds = new Set();
    for (const record of sourceInspectionValidationRecords) {
      if (record.projectId !== sourceProject.id) throw new Error(`Invalid imported Inspection Record: ${record.inspectionId} does not belong to the exported project.`);
      if (sourceInspectionIds.has(record.inspectionId)) throw new Error(`Duplicate imported Inspection Record identifier: ${record.inspectionId}`);
      sourceInspectionIds.add(record.inspectionId);
      const validation = validateInspectionRecord(record, {
        projectIds: [record.projectId],
        existingRecords: sourceInspectionValidationRecords,
        currentInspectionId: record.inspectionId
      });
      if (!validation.valid) throw new Error(`Invalid imported Inspection Record: ${validation.errors.join(' ')}`);
    }
    const sourceNumbers = new Set();
    for (const record of sourceInspectionValidationRecords) {
      const key = `${record.projectId}:${record.inspectionNumber}`;
      if (sourceNumbers.has(key)) throw new Error(`Duplicate imported Inspection Record number: ${record.inspectionNumber}`);
      sourceNumbers.add(key);
    }
    let importedProject;

    if (preserveIdentifiers) {
      const requiredIds = [sourceProject.id, ...data.documents.map(item => item.id), ...data.sections.map(item => item.id)];
      const sourceLibraries = Array.isArray(data.libraries) ? data.libraries : [];
      requiredIds.push(...sourceLibraries.map(item => item.id));
      requiredIds.push(...sourceInspectionRecords.map(item => item.inspectionId));
      if (requiredIds.some(id => !String(id || '').trim()) || new Set(requiredIds).size !== requiredIds.length) {
        throw new Error('Deterministic project imports require unique project, library, document, section, and Inspection Record identifiers.');
      }
      const existingDocuments = await all('documents');
      const existingSections = await all('sections');
      const existingIds = new Set([
        ...state.projects.map(item => item.id),
        ...state.libraries.map(item => item.id),
        ...existingDocuments.map(item => item.id),
        ...existingSections.map(item => item.id),
        ...existingInspectionRecords.map(item => item.inspectionId)
      ]);
      const collision = requiredIds.find(id => existingIds.has(id));
      if (collision) throw new Error(`Project import identifier collision: ${collision}`);
      importedProject = { ...sourceProject };
      state.projects.push(importedProject);
      state.activeProject = importedProject.id;
    } else {
      importedProject = this.addProject(
        `${sourceProject.name || 'Imported'} (Imported)`
      );
    }

    const importedLibraries = Array.isArray(data.libraries)
      ? data.libraries
      : [];

    const libraryIdMap = new Map();

    if (importedLibraries.length) {
      const defaultLibrary = state.libraries.find(
        library =>
          library.projectId === importedProject.id
      );

      for (const sourceLibrary of importedLibraries) {
        const newLibraryId = preserveIdentifiers
          ? sourceLibrary.id
          : sourceLibrary === importedLibraries[0] &&
          defaultLibrary
            ? defaultLibrary.id
            : createIdentifier();

        libraryIdMap.set(
          sourceLibrary.id,
          newLibraryId
        );

        if (
          !state.libraries.some(
            library => library.id === newLibraryId
          )
        ) {
          state.libraries.push({
            ...sourceLibrary,
            id: newLibraryId,
            projectId: importedProject.id,
            createdAt:
              sourceLibrary.createdAt ||
              new Date().toISOString()
          });
        } else if (defaultLibrary) {
          defaultLibrary.name =
            sourceLibrary.name ||
            defaultLibrary.name;

          defaultLibrary.description =
            sourceLibrary.description ||
            defaultLibrary.description;
        }
      }
    }

    const fallbackLibraryId =
      state.libraries.find(
        library =>
          library.projectId === importedProject.id
      )?.id || null;

    if (preserveIdentifiers) state.activeLibrary = fallbackLibraryId;

    const documentIdMap = new Map();

    const importedDocuments = data.documents.map(document => {
      const newId = preserveIdentifiers ? document.id : createIdentifier();

      documentIdMap.set(
        document.id,
        newId
      );

      const pdf = String(document.extension || '').toLowerCase() === 'pdf' || String(document.type || '').toLowerCase().includes('pdf');
      return persistDocumentClassification({
        ...document,
        id: newId,
        projectId: importedProject.id,
        libraryId:
          libraryIdMap.get(document.libraryId) ||
          fallbackLibraryId,
        ...(pdf ? { sourceAvailability: 'reattachment-required' } : {})
      });
    });

    const sectionIdMap = new Map(
      data.sections.map(section => [section.id, preserveIdentifiers ? section.id : createIdentifier()])
    );
    const importedSections = data.sections.map(section => ({
      ...section,
      id: sectionIdMap.get(section.id),
      parentId: sectionIdMap.get(section.parentId) || null,
      crossReferenceIds: (section.crossReferenceIds || [])
        .map(id => sectionIdMap.get(id))
        .filter(Boolean),
      metadata: {
        ...(section.metadata || {}),
        parent: sectionIdMap.get(section.parentId) || null
      },
      projectId: importedProject.id,
      libraryId:
        libraryIdMap.get(section.libraryId) ||
        fallbackLibraryId,
      documentId:
        documentIdMap.get(section.documentId) ||
        section.documentId
    }));

    const mapDocumentIds = value => (Array.isArray(value) ? value : []).map(id => documentIdMap.get(id)).filter(Boolean);
    const mapSectionIds = value => (Array.isArray(value) ? value : []).map(id => sectionIdMap.get(id)).filter(Boolean);
    const importedInspectionRecords = sourceInspectionRecords.map(record => normalizeInspectionRecord({
      ...record,
      inspectionId: preserveIdentifiers ? record.inspectionId : createIdentifier(),
      projectId: importedProject.id,
      sourceDocumentIds: mapDocumentIds(record.sourceDocumentIds),
      sourceSectionIds: mapSectionIds(record.sourceSectionIds),
      evidenceReferences: (record.evidenceReferences || []).map(reference => ({ documentId: documentIdMap.get(reference.documentId) || '', sectionId: sectionIdMap.get(reference.sectionId) || '' })).filter(reference => reference.documentId || reference.sectionId),
      relatedDrawingIds: mapDocumentIds(record.relatedDrawingIds),
      relatedSpecificationIds: mapDocumentIds(record.relatedSpecificationIds),
      relatedRfiIds: mapDocumentIds(record.relatedRfiIds),
      relatedSubmittalIds: mapDocumentIds(record.relatedSubmittalIds),
      relatedDeficiencyIds: mapDocumentIds(record.relatedDeficiencyIds),
      relationshipIds: preserveIdentifiers ? record.relationshipIds : [],
      versionIds: mapDocumentIds(record.versionIds),
      revisionIds: preserveIdentifiers
        ? record.revisionIds
        : (record.revisionIds || []).map(value => {
            const [earlier, later] = String(value).split('->');
            const mappedEarlier = documentIdMap.get(earlier);
            const mappedLater = documentIdMap.get(later);
            return mappedEarlier && mappedLater ? `${mappedEarlier}->${mappedLater}` : '';
          }).filter(Boolean)
    }));
    const importedDrawingAnalyses = (Array.isArray(data.drawingAnalyses) ? data.drawingAnalyses : []).flatMap(sourceAnalysis => {
      const mappedDocumentId = documentIdMap.get(sourceAnalysis.documentId);
      if (!mappedDocumentId || !isDrawingDocument(importedDocuments.find(item => item.id === mappedDocumentId))) return [];
      const pages = (sourceAnalysis.sheets || []).map(sheet => ({
        pageNumber: sheet.pageNumber, width: sheet.pageWidth, height: sheet.pageHeight,
        rotation: sheet.rotation, textItems: sheet.textItems || []
      }));
      return [buildDrawingAnalysis({ documentId: mappedDocumentId, projectId: importedProject.id, pages, analyzedAt: sourceAnalysis.analyzedAt || new Date().toISOString() })];
    });
    for (const record of importedInspectionRecords) {
      const validation = validateInspectionRecord(record, { projectIds: [importedProject.id], existingRecords: [...existingInspectionRecords, ...importedInspectionRecords], currentInspectionId: record.inspectionId });
      if (!validation.valid) throw new Error(`Invalid imported Inspection Record: ${validation.errors.join(' ')}`);
    }

    await putMany('documents', importedDocuments);

    await putMany(
      'sections',
      importedSections
    );
    await putMany('inspectionRecords', importedInspectionRecords);
    await putMany('drawingAnalyses', importedDrawingAnalyses);
    invalidateProjectKnowledgeCaches(state.activeProject);

    state.evaluations.push(
      ...(Array.isArray(data.evaluations)
        ? data.evaluations.map(evaluation => ({
            ...evaluation,
            id: createIdentifier()
          }))
        : [])
    );

    save();

    logger.info('Project imported', {
      projectId: importedProject.id,
      documents: importedDocuments.length,
      sections: importedSections.length
    });

    return structuredClone(importedProject);
  }
};

function compactText(value, maximumLength) {
  return truncateText(
    String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim(),
    maximumLength
  );
}

const safeArray = arrayValue;

function compactStringList(values) {
  return safeArray(values)
    .filter(value => value !== null && value !== undefined)
    .slice(0, 5)
    .map(value => compactText(value, 160))
    .filter(Boolean);
}

function buildStructuredAnalysisBlock(analysis, hits) {
  const records = value => safeArray(value)
    .filter(record => record && typeof record === 'object' && !Array.isArray(record));

  const validSources = new Set(
    safeArray(hits)
      .map(hit => Number(hit?.sourceNumber))
      .filter(sourceNumber => Number.isInteger(sourceNumber) && sourceNumber > 0)
  );

  const sourceNumber = record => {
    const value = Number(record?.sourceNumber);
    return Number.isInteger(value) && value > 0 && validSources.has(value)
      ? value
      : null;
  };

  const sourceBacked = (value, limit, project) => records(value)
    .filter(record => sourceNumber(record) !== null)
    .slice(0, limit)
    .map(record => project(record, sourceNumber(record)));

  const payload = {
    sourceBacked: {
      requirements: sourceBacked(
        analysis?.requirements?.requirements,
        12,
        (record, source) => ({
          statement: compactText(record.statement, 300),
          type: compactText(record.type, 60),
          responsibleParty: compactText(record.responsibleParty, 160),
          timing: compactText(record.timing, 200),
          deliverables: compactStringList(record.deliverables),
          exceptions: compactStringList(record.exceptions),
          sourceNumber: source
        })
      ),
      acceptance: sourceBacked(
        analysis?.acceptance?.criteria,
        8,
        (record, source) => ({
          statement: compactText(record.statement, 300),
          sourceNumber: source
        })
      ),
      exceptions: sourceBacked(
        analysis?.exceptions?.exceptions,
        8,
        (record, source) => ({
          statement: compactText(record.statement, 300),
          sourceNumber: source
        })
      )
    },
    aggregates: {
      responsibilities: records(analysis?.responsibilities?.responsibilities)
        .slice(0, 8)
        .map(record => ({
          party: compactText(record.party, 160),
          requirementCount: Number.isFinite(Number(record.requirementCount))
            ? Number(record.requirementCount)
            : null
        })),
      deliverables: records(analysis?.deliverables?.deliverables)
        .slice(0, 8)
        .map(record => ({
          name: compactText(record.name, 200),
          type: compactText(record.type, 60),
          responsibleParties: compactStringList(record.responsibleParties)
        }))
    }
  };

  const header = [
    'STRUCTURED ANALYSIS',
    'This block is derived from the retrieved evidence.',
    'It is supplemental and is not an independent source.',
    'Any source-backed claim must cite the corresponding original [S#] source.',
    'Aggregate analysis summarizes the source-backed records and must not be treated as direct evidence.',
    'The evidence context remains authoritative.'
  ].join('\n');

  const removalOrder = [
    payload.aggregates.deliverables,
    payload.aggregates.responsibilities,
    payload.sourceBacked.exceptions,
    payload.sourceBacked.acceptance,
    payload.sourceBacked.requirements
  ];

  let block = `${header}\n${JSON.stringify(payload)}`;

  for (const category of removalOrder) {
    while (block.length > 16000 && category.length) {
      category.pop();
      block = `${header}\nSTRUCTURED ANALYSIS TRUNCATED\n${JSON.stringify(payload)}`;
    }
  }

  return block;
}

function shouldIncludeDependencySequence(prompt) {
  return /\b(sequence of (?:work|activities)|order of operations|what comes next|what follows|what happens after|handoffs?|downstream(?: impacts?)?)\b/i.test(
    String(prompt || '')
  );
}

function buildDependencyAnalysisBlock(graph, result, sequence, hits) {
  const validSources = new Set(
    safeArray(hits)
      .map(hit => Number(hit?.sourceNumber))
      .filter(source => Number.isInteger(source) && source > 0)
  );

  const nodes = new Map(
    safeArray(graph?.nodes).map(node => [node.id, node])
  );

  const sourceNumbers = (...values) => [...new Set(
    values
      .flat()
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0 && validSources.has(value))
  )].slice(0, 4);

  const edgeSources = edge => sourceNumbers(
    nodes.get(edge?.from)?.sourceNumber,
    nodes.get(edge?.to)?.sourceNumber,
    nodes.get(edge?.sourceRequirementId)?.sourceNumber
  );

  const edgeRecord = edge => {
    const sources = edgeSources(edge);

    if (!sources.length) return null;

    return {
      from: compactText(nodes.get(edge.from)?.label, 300),
      to: compactText(nodes.get(edge.to)?.label, 300),
      relationship: compactText(edge.type, 80),
      reason: compactText(edge.reason, 240),
      sourceNumbers: sources,
      confidencePercent: Number.isFinite(Number(edge.confidence))
        ? Number(edge.confidence)
        : null,
      algorithmicallyMatched: true
    };
  };

  const traversals = safeArray(result?.matches).flatMap(match => [
    ...safeArray(match?.prerequisites),
    ...safeArray(match?.successors)
  ]);

  const questionEdges = [...new Map(
    traversals
      .map(item => item?.via)
      .filter(Boolean)
      .map(edge => [edge.id, edge])
  ).values()];

  const relationships = questionEdges
    .filter(edge => edge.type === 'explicit-predecessor' || edge.type === 'explicit-successor')
    .map(edgeRecord)
    .filter(Boolean)
    .slice(0, 10);

  const phaseRelationships = safeArray(graph?.edges)
    .filter(edge => edge?.type === 'phase-sequence')
    .map(edge => {
      const sources = edgeSources(edge);

      return sources.length
        ? {
            from: compactText(nodes.get(edge.from)?.label, 300),
            to: compactText(nodes.get(edge.to)?.label, 300),
            relationship: 'phase-sequence',
            sourceNumbers: sources,
            confidencePercent: Number.isFinite(Number(edge.confidence))
              ? Number(edge.confidence)
              : null,
            inferred: true,
            basis: 'Typical phase ordering, not an explicit source statement'
          }
        : null;
    })
    .filter(Boolean)
    .slice(0, 6);

  const sequenceSteps = safeArray(sequence?.ordered)
    .map((node, index) => {
      const sources = sourceNumbers(node?.sourceNumber);

      return sources.length
        ? {
            step: index + 1,
            activity: compactText(node?.label, 300),
            phase: compactText(node?.phase, 80),
            sourceNumbers: sources,
            inferred: true,
            basis: 'Topological ordering of the dependency graph'
          }
        : null;
    })
    .filter(Boolean)
    .slice(0, 12);

  const downstreamImpacts = safeArray(result?.matches)
    .flatMap(match => safeArray(match?.successors).map(successor => {
      const sources = sourceNumbers(
        match?.requirement?.sourceNumber,
        successor?.requirement?.sourceNumber
      );

      return sources.length
        ? {
            cause: compactText(match?.requirement?.statement, 300),
            affectedActivity: compactText(successor?.requirement?.label, 300),
            sourceNumbers: sources,
            inferred: true,
            basis: 'Dependency traversal'
          }
        : null;
    }))
    .filter(Boolean)
    .slice(0, 8);

  const payload = {
    sourceBacked: { relationships },
    inferred: {
      phaseRelationships,
      sequence: sequenceSteps,
      downstreamImpacts
    }
  };

  const header = [
    'DEPENDENCY ANALYSIS',
    'This block is supplemental to the retrieved evidence.',
    'Source citations support the underlying requirements; dependency relationships may be algorithmically derived.',
    'Source-backed relationships use explicit dependency language but are algorithmically matched.',
    'Inferred records are not direct source statements.',
    'The evidence context remains authoritative.'
  ].join('\n');

  const removalOrder = [
    payload.inferred.phaseRelationships,
    payload.inferred.sequence,
    payload.inferred.downstreamImpacts,
    payload.sourceBacked.relationships
  ];

  let block = `${header}\n${JSON.stringify(payload)}`;

  for (const category of removalOrder) {
    while (block.length > 12000 && category.length) {
      category.pop();
      block = `${header}\nDEPENDENCY ANALYSIS TRUNCATED\n${JSON.stringify(payload)}`;
    }
  }

  return block;
}

function callOffline(prompt, hits) {
  if (!hits.length) {
    return {
      content: [
        '## Offline evidence report',
        '',
        `**Question:** ${prompt}`,
        '',
        'No relevant project evidence was retrieved.',
        '',
        '### Evidence gaps',
        '',
        'The indexed knowledge base does not currently contain enough matching material to answer this question.'
      ].join('\n'),
      citations: []
    };
  }

  const intent = detectOfflineAnalysisIntent(prompt);

  if (intent === 'requirements') {
    return buildOfflineRequirementReport(prompt, hits);
  }

  if (intent === 'definitions') {
    return buildOfflineDefinitionReport(prompt, hits);
  }

  if (intent === 'comparison') {
    return buildOfflineComparisonReport(prompt, hits);
  }

  return buildOfflineEvidenceReport(prompt, hits);
}

function buildOfflineEvidenceReport(prompt, hits) {
  const evidenceBlocks = hits
    .slice(0, Math.min(hits.length, 6))
    .map(hit => formatOfflineSource(hit, prompt));

  const citations = hits
    .slice(0, Math.min(hits.length, 6))
    .map(hit => hit.sourceNumber);

  const conflicts = hits.meta?.conflicts || [];
  const conflictBlock = conflicts.length
    ? [
        '',
        '### Potential source conflicts',
        '',
        ...conflicts.map(
          conflict =>
            `- [S${conflict.sourceA}] may conflict with [S${conflict.sourceB}]: ${conflict.reason}.`
        )
      ]
    : [
        '',
        '### Potential source conflicts',
        '',
        'No opposing requirement language was detected among the retrieved sources.'
      ];

  const confidence = calculateOfflineConfidence(hits);
  const content = [
    '## Offline evidence report',
    '',
    `**Question:** ${prompt}`,
    '',
    `**Evidence confidence:** ${confidence.label} (${confidence.score}%)`,
    '',
    'This report was assembled locally from indexed project evidence. No AI model was used to create a synthesized conclusion.',
    '',
    '### Most relevant evidence',
    '',
    ...evidenceBlocks,
    ...conflictBlock,
    '',
    '### Evidence gaps',
    '',
    'Offline mode presents the strongest matching source language but does not infer facts that are not expressly contained in the retrieved sections.'
  ].join('\n');

  return {
    content,
    citations: [...new Set(citations)]
  };
}

const REQUIREMENT_PATTERNS = [
  { type: 'prohibited', strength: 100, pattern: /\bshall not\b/i },
  { type: 'prohibited', strength: 100, pattern: /\bmust not\b/i },
  { type: 'prohibited', strength: 100, pattern: /\bmay not\b/i },
  { type: 'prohibited', strength: 100, pattern: /\bis prohibited\b/i },
  { type: 'mandatory', strength: 100, pattern: /\bshall\b/i },
  { type: 'mandatory', strength: 100, pattern: /\bmust\b/i },
  { type: 'mandatory', strength: 95, pattern: /\bis required to\b/i },
  { type: 'mandatory', strength: 90, pattern: /\bis responsible for\b/i },
  { type: 'permitted', strength: 70, pattern: /\bmay\b/i },
  { type: 'advisory', strength: 45, pattern: /\bshould\b/i },
  { type: 'informational', strength: 30, pattern: /\bwill\b/i }
];

const DEFINITION_PATTERNS = [
  { pattern: /^(.{2,120}?)\s+(?:shall mean|means|is defined as|refers to)\s+(.+)$/i, termGroup: 1, definitionGroup: 2 },
  { pattern: /^(.{2,120}?):\s+(.+)$/i, termGroup: 1, definitionGroup: 2 },
  { pattern: /^(.{2,120}?)\s+[—–-]\s+(.+)$/i, termGroup: 1, definitionGroup: 2 }
];

function detectOfflineAnalysisIntent(prompt) {
  const value = String(prompt || '').toLowerCase();

  if (/\b(compare|comparison|difference|conflict|contradiction|consistent|agreement|precedence)\b/i.test(value)) {
    return 'comparison';
  }

  if (/\b(define|definition|definitions|meaning|what does .* mean|what is meant by)\b/i.test(value)) {
    return 'definitions';
  }

  if (/\b(requirement|requirements|shall|must|required|responsible|prohibited|obligation|duties)\b/i.test(value)) {
    return 'requirements';
  }

  return 'evidence';
}

function normalizeAnalysisText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitAnalysisSentences(value) {
  return normalizeAnalysisText(value)
    .split(/(?<=[.!?;:])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 12);
}

function matchesAnalysisQuery(text, query) {
  const queryTerms = tokenizeOffline(query);

  if (!queryTerms.length) {
    return true;
  }

  const lower = String(text || '').toLowerCase();
  return queryTerms.some(term => lower.includes(term));
}

function classifyRequirement(sentence) {
  for (const rule of REQUIREMENT_PATTERNS) {
    if (rule.pattern.test(sentence)) {
      return {
        type: rule.type,
        strength: rule.strength
      };
    }
  }

  return null;
}

function extractResponsibleParty(sentence) {
  const patterns = [
    /^\s*(?:the\s+)?([A-Z][A-Za-z0-9 /&()_-]{1,80}?)\s+(?:shall|must|will|should|may)\b/,
    /\b(?:the\s+)?([A-Za-z][A-Za-z0-9 /&()_-]{1,80}?)\s+is responsible for\b/i
  ];

  for (const pattern of patterns) {
    const match = String(sentence || '').match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function requirementKey(requirement) {
  return `${requirement.type}|${String(requirement.text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
}

function extractRequirementsFromSections(sections, query = '', options = {}) {
  const limit = Math.max(1, Number(options.limit || 100));
  const includeAdvisory = options.includeAdvisory !== false;
  const includeNegative = options.includeNegative !== false;
  const requirements = [];
  const seen = new Set();

  for (const section of Array.isArray(sections) ? sections : []) {
    for (const sentence of splitAnalysisSentences(section.text)) {
      const classification = classifyRequirement(sentence);

      if (!classification) {
        continue;
      }

      if (!includeAdvisory && ['advisory', 'informational'].includes(classification.type)) {
        continue;
      }

      if (!includeNegative && classification.type === 'prohibited') {
        continue;
      }

      if (!matchesAnalysisQuery(`${section.heading || ''} ${sentence}`, query)) {
        continue;
      }

      const requirement = {
        id: `${section.id || section.documentId || 'section'}:${requirements.length + 1}`,
        type: classification.type,
        strength: classification.strength,
        text: truncateText(sentence, 700),
        responsibleParty: extractResponsibleParty(sentence),
        documentId: section.documentId || null,
        documentName: section.documentName || 'Unknown document',
        heading: section.heading || 'Unheaded section',
        path: Array.isArray(section.path) ? section.path : [],
        location: section.location || 'Location not specified',
        sourceNumber: section.sourceNumber || null
      };

      const key = requirementKey(requirement);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      requirements.push(requirement);

      if (requirements.length >= limit) {
        break;
      }
    }

    if (requirements.length >= limit) {
      break;
    }
  }

  requirements.sort((a, b) => b.strength - a.strength || a.documentName.localeCompare(b.documentName));

  const summary = {
    total: requirements.length,
    mandatory: requirements.filter(item => item.type === 'mandatory').length,
    prohibited: requirements.filter(item => item.type === 'prohibited').length,
    permitted: requirements.filter(item => item.type === 'permitted').length,
    advisory: requirements.filter(item => item.type === 'advisory').length,
    informational: requirements.filter(item => item.type === 'informational').length,
    responsibleParties: [...new Set(requirements.map(item => item.responsibleParty).filter(Boolean))]
  };

  return {
    query: String(query || '').trim(),
    generatedAt: new Date().toISOString(),
    summary,
    requirements
  };
}

function cleanDefinitionTerm(value) {
  return String(value || '')
    .replace(/^[\s•*#\d.)-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDefinitionsFromSections(sections, query = '', options = {}) {
  const limit = Math.max(1, Number(options.limit || 100));
  const definitions = [];
  const seen = new Set();

  for (const section of Array.isArray(sections) ? sections : []) {
    for (const sentence of splitAnalysisSentences(section.text)) {
      let parsed = null;

      for (const rule of DEFINITION_PATTERNS) {
        const match = sentence.match(rule.pattern);
        if (!match) {
          continue;
        }

        const term = cleanDefinitionTerm(match[rule.termGroup]);
        const definition = String(match[rule.definitionGroup] || '').trim();

        if (term.length < 2 || term.length > 120 || definition.length < 10) {
          continue;
        }

        if (rule.pattern === DEFINITION_PATTERNS[1].pattern && !/definition|definitions|glossary/i.test(`${section.heading || ''} ${(section.path || []).join(' ')}`)) {
          continue;
        }

        parsed = { term, definition };
        break;
      }

      if (!parsed) {
        continue;
      }

      if (!matchesAnalysisQuery(`${parsed.term} ${parsed.definition} ${section.heading || ''}`, query)) {
        continue;
      }

      const key = parsed.term.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      definitions.push({
        id: `${section.id || section.documentId || 'section'}:${definitions.length + 1}`,
        term: parsed.term,
        definition: truncateText(parsed.definition, 800),
        documentId: section.documentId || null,
        documentName: section.documentName || 'Unknown document',
        heading: section.heading || 'Unheaded section',
        path: Array.isArray(section.path) ? section.path : [],
        location: section.location || 'Location not specified',
        sourceNumber: section.sourceNumber || null
      });

      if (definitions.length >= limit) {
        break;
      }
    }

    if (definitions.length >= limit) {
      break;
    }
  }

  definitions.sort((a, b) => a.term.localeCompare(b.term));

  return {
    query: String(query || '').trim(),
    generatedAt: new Date().toISOString(),
    summary: {
      total: definitions.length,
      documents: new Set(definitions.map(item => item.documentId).filter(Boolean)).size
    },
    definitions
  };
}

function analysisTerms(value) {
  return new Set(tokenizeOffline(value).map(term => term.replace(/(ing|ed|es|s)$/i, '')));
}

function analysisSimilarity(first, second) {
  const a = analysisTerms(first);
  const b = analysisTerms(second);

  if (!a.size || !b.size) {
    return 0;
  }

  const intersection = [...a].filter(term => b.has(term)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / Math.max(1, union);
}

function compareRetrievedSources(query, hits, options = {}) {
  const maximumSources = Math.max(2, Number(options.maximumSources || 8));
  const sources = (Array.isArray(hits) ? hits : [])
    .slice(0, maximumSources)
    .map(hit => ({
      sourceNumber: hit.sourceNumber,
      documentId: hit.documentId || null,
      documentName: hit.documentName || 'Unknown document',
      heading: hit.heading || 'Unheaded section',
      location: hit.location || 'Location not specified',
      path: Array.isArray(hit.path) ? hit.path : [],
      score: Number(hit.score || 0),
      excerpts: selectEvidenceSentences(hit.text, query, hit.matchedTerms || [], 3),
      requirements: extractRequirementsFromSections([hit], query, { limit: 12 }).requirements,
      definitions: extractDefinitionsFromSections([hit], query, { limit: 12 }).definitions
    }));

  const agreements = [];
  const differences = [];

  for (let i = 0; i < sources.length; i += 1) {
    for (let j = i + 1; j < sources.length; j += 1) {
      const first = sources[i];
      const second = sources[j];
      const firstText = first.excerpts.join(' ');
      const secondText = second.excerpts.join(' ');
      const similarity = analysisSimilarity(firstText, secondText);

      if (similarity >= 0.28) {
        agreements.push({
          sourceA: first.sourceNumber,
          sourceB: second.sourceNumber,
          similarity: Math.round(similarity * 100),
          reason: 'The sources use materially overlapping language or address the same obligation.'
        });
      } else if (similarity >= 0.08) {
        differences.push({
          sourceA: first.sourceNumber,
          sourceB: second.sourceNumber,
          similarity: Math.round(similarity * 100),
          reason: 'The sources address related subject matter but emphasize different details, duties, or conditions.'
        });
      }
    }
  }

  const conflicts = (hits?.meta?.conflicts || []).map(conflict => ({ ...conflict }));

  return {
    query,
    generatedAt: new Date().toISOString(),
    summary: {
      sources: sources.length,
      documents: new Set(sources.map(source => source.documentId).filter(Boolean)).size,
      agreements: agreements.length,
      differences: differences.length,
      conflicts: conflicts.length
    },
    sources,
    agreements,
    differences,
    conflicts
  };
}

function buildOfflineRequirementReport(prompt, hits) {
  const result = extractRequirementsFromSections(hits, prompt, {
    limit: 30,
    includeAdvisory: true,
    includeNegative: true
  });
  const confidence = calculateOfflineConfidence(hits);
  const citations = result.requirements.map(item => item.sourceNumber).filter(Boolean);

  const requirementLines = result.requirements.length
    ? result.requirements.map(item => {
        const party = item.responsibleParty ? ` — **Responsible party:** ${item.responsibleParty}` : '';
        const citation = item.sourceNumber ? ` [S${item.sourceNumber}]` : '';
        return `- **${item.type.toUpperCase()}** (${item.strength}%): ${item.text}${party}${citation}`;
      })
    : ['No explicit requirement language was found in the retrieved sources.'];

  return {
    content: [
      '## Offline requirement report',
      '',
      `**Question:** ${prompt}`,
      '',
      `**Evidence confidence:** ${confidence.label} (${confidence.score}%)`,
      '',
      `**Extracted:** ${result.summary.total} requirements — ${result.summary.mandatory} mandatory, ${result.summary.prohibited} prohibited, ${result.summary.permitted} permitted, ${result.summary.advisory} advisory.`,
      '',
      '### Extracted requirements',
      '',
      ...requirementLines,
      '',
      '### Evidence gaps',
      '',
      'This is deterministic language extraction. Each item should be reviewed in its full section context before it is treated as a controlling obligation.'
    ].join('\n'),
    citations: [...new Set(citations)]
  };
}

function buildOfflineDefinitionReport(prompt, hits) {
  const result = extractDefinitionsFromSections(hits, prompt, { limit: 30 });
  const confidence = calculateOfflineConfidence(hits);
  const citations = result.definitions.map(item => item.sourceNumber).filter(Boolean);

  const definitionLines = result.definitions.length
    ? result.definitions.map(item => {
        const citation = item.sourceNumber ? ` [S${item.sourceNumber}]` : '';
        return `- **${item.term}:** ${item.definition}${citation}`;
      })
    : ['No explicit definitions were found in the retrieved sources.'];

  return {
    content: [
      '## Offline definition report',
      '',
      `**Question:** ${prompt}`,
      '',
      `**Evidence confidence:** ${confidence.label} (${confidence.score}%)`,
      '',
      '### Extracted definitions',
      '',
      ...definitionLines,
      '',
      '### Evidence gaps',
      '',
      'Only explicit definitional language was extracted. Implied meanings were not created.'
    ].join('\n'),
    citations: [...new Set(citations)]
  };
}

function buildOfflineComparisonReport(prompt, hits) {
  const comparison = compareRetrievedSources(prompt, hits, { maximumSources: 8 });
  const citations = comparison.sources.map(source => source.sourceNumber).filter(Boolean);

  const sourceLines = comparison.sources.map(source => {
    const excerpts = source.excerpts.length
      ? source.excerpts.map(excerpt => `  - ${excerpt} [S${source.sourceNumber}]`).join('\n')
      : `  - No readable excerpt was available. [S${source.sourceNumber}]`;
    return `- **[S${source.sourceNumber}] ${source.documentName} — ${source.heading}**\n${excerpts}`;
  });

  const agreementLines = comparison.agreements.length
    ? comparison.agreements.map(item => `- [S${item.sourceA}] and [S${item.sourceB}]: ${item.reason} (${item.similarity}% textual similarity).`)
    : ['No strong cross-source agreement was detected.'];

  const differenceLines = comparison.differences.length
    ? comparison.differences.map(item => `- [S${item.sourceA}] and [S${item.sourceB}]: ${item.reason}`)
    : ['No material differences were detected by the comparison rules.'];

  const conflictLines = comparison.conflicts.length
    ? comparison.conflicts.map(item => `- [S${item.sourceA}] may conflict with [S${item.sourceB}]: ${item.reason}.`)
    : ['No opposing requirement language was detected among the retrieved sources.'];

  return {
    content: [
      '## Offline source comparison',
      '',
      `**Topic:** ${prompt}`,
      '',
      '### Compared sources',
      '',
      ...sourceLines,
      '',
      '### Agreements',
      '',
      ...agreementLines,
      '',
      '### Differences',
      '',
      ...differenceLines,
      '',
      '### Potential conflicts',
      '',
      ...conflictLines,
      '',
      '### Evidence gaps',
      '',
      'Similarity and conflict indicators are screening tools. Review the complete cited sections, referenced clauses, and order-of-precedence provisions before relying on a final interpretation.'
    ].join('\n'),
    citations: [...new Set(citations)]
  };
}

function formatOfflineSource(hit, prompt) {
  const heading = hit.heading || 'Unheaded section';
  const documentName = hit.documentName || 'Unknown document';
  const location = hit.location || 'Location not specified';
  const path = Array.isArray(hit.path)
    ? hit.path.join(' › ')
    : '';

  const sentences = selectEvidenceSentences(
    hit.text,
    prompt,
    hit.matchedTerms || [],
    3
  );

  const citedEvidence = sentences.length
    ? sentences.map(
        sentence =>
          `> ${sentence} [S${hit.sourceNumber}]`
      )
    : [
        `> No readable excerpt was available for this indexed section. [S${hit.sourceNumber}]`
      ];

  return [
    `#### [S${hit.sourceNumber}] ${heading}`,
    '',
    `**Document:** ${documentName}`,
    '',
    `**Location:** ${location}${path ? ` · ${path}` : ''}`,
    '',
    ...citedEvidence,
    ''
  ].join('\n');
}

function selectEvidenceSentences(
  text,
  prompt,
  matchedTerms,
  limit = 3
) {
  const cleanedText = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanedText) {
    return [];
  }

  const candidates = cleanedText
    .split(/(?<=[.!?;:])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 25)
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreOfflineSentence(
        sentence,
        prompt,
        matchedTerms
      )
    }));

  if (!candidates.length) {
    return [
      truncateText(
        cleanedText,
        500
      )
    ];
  }

  const selected = candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.index - b.index
    )
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map(item => truncateText(item.sentence, 500));

  return selected;
}

function scoreOfflineSentence(
  sentence,
  prompt,
  matchedTerms
) {
  const lowerSentence = sentence.toLowerCase();

  const queryTerms = [
    ...tokenizeOffline(prompt),
    ...matchedTerms.flatMap(tokenizeOffline)
  ];

  let score = 0;

  for (const term of new Set(queryTerms)) {
    if (lowerSentence.includes(term)) {
      score += term.length >= 7
        ? 5
        : 3;
    }
  }

  if (
    /\b(shall|must|required|responsible|prohibited|may not|will)\b/i.test(
      sentence
    )
  ) {
    score += 5;
  }

  if (
    /\b(exception|except|unless|however|notwithstanding)\b/i.test(
      sentence
    )
  ) {
    score += 4;
  }

  if (
    /\b(means|defined|definition|refers to)\b/i.test(
      sentence
    )
  ) {
    score += 4;
  }

  if (sentence.length >= 60 && sentence.length <= 350) {
    score += 2;
  }

  return score;
}

function tokenizeOffline(value) {
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'that',
    'this',
    'what',
    'when',
    'where',
    'which',
    'who',
    'why',
    'how',
    'does',
    'are',
    'was',
    'were',
    'has',
    'have',
    'will',
    'would',
    'should',
    'could'
  ]);

  return (
    String(value || '')
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9._/-]*/g) || []
  ).filter(
    term =>
      term.length > 2 &&
      !stopWords.has(term)
  );
}

function truncateText(text, maximumLength) {
  const value = String(text || '').trim();

  if (value.length <= maximumLength) {
    return value;
  }

  return `${value.slice(0, maximumLength - 1).trim()}…`;
}

function calculateOfflineConfidence(hits) {
  if (!hits.length) {
    return {
      score: 0,
      label: 'Insufficient'
    };
  }

  const averageCoverage =
    hits.reduce(
      (total, hit) =>
        total +
        Number(hit.components?.coverage || 0),
      0
    ) / hits.length;

  const distinctDocuments = new Set(
    hits.map(hit => hit.documentId)
  ).size;

  const sourceDiversity = Math.min(
    20,
    distinctDocuments * 5
  );

  const topScore = Number(
    hits[0]?.score || 0
  );

  const retrievalStrength = Math.min(
    35,
    topScore / 2
  );

  const conflictPenalty =
    (hits.meta?.conflicts?.length || 0) * 8;

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        averageCoverage * 0.45 +
        sourceDiversity +
        retrievalStrength -
        conflictPenalty
      )
    )
  );

  const label =
    score >= 80
      ? 'Strong'
      : score >= 60
        ? 'Moderate'
        : score >= 35
          ? 'Limited'
          : 'Insufficient';

  return {
    score,
    label
  };
}

async function callAI(prompt, context, mode, meta = {}) {
  const settings = state.settings;

  if (!settings.openaiKey) {
    throw new Error(
      'This answer mode requires an OpenAI API key. Select Offline Evidence mode or enter a key in Settings.'
    );
  }

  const rules = {
    source:
      'Answer directly in the first 1-3 sentences using only the supplied evidence. Then briefly state the controlling Bedford specification sections, drawings, or other authoritative evidence that support the answer. Do not repeat the evidence verbatim, do not dump tables or raw retrieval text, and do not mention internal markers, raw PDF-page IDs, or "Evidence Gaps". If the evidence does not support an answer, say exactly what was found and what controlling source category should be checked next. Cite material claims using the supplied evidence, but prefer plain section numbers and titles in the prose. For project-specific questions, do not invent deadlines, durations, quantities, tolerances, acceptance criteria, or contractual obligations from general knowledge; any such requirement must be supported by the supplied evidence.',

    assisted:
      'Act as a senior owner-side construction and engineering advisor. Answer directly in the first 1-3 sentences. Use the supplied evidence as the controlling source, then interpret it concisely in practical project terms. Distinguish explicit contract requirements from reasonable interpretation and professional recommendation. Prefer a concise answer-first structure such as "Answer", "Basis", and "Practical takeaway" when helpful. Do not repeat the evidence verbatim, do not dump raw retrieval text, do not expose internal markers, raw PDF page identifiers, or generic evidence-gap boilerplate, and do not use generic schedule ranges or other outside knowledge unless the user explicitly asks for general practice. For project-specific questions, do not invent deadlines, durations, quantities, tolerances, acceptance criteria, responsibilities, or contractual obligations from general knowledge; any such requirement must be supported by the supplied evidence. Treat retrieved hits as candidate evidence only; evaluate section titles and content for relevance before treating them as controlling. If the evidence is incomplete, state what was found, what was not found, and the next controlling source to inspect. Clearly label any general professional knowledge as "General SME context" and never present it as project-specific. If the context includes an AUTHORITATIVE PROJECT PDF EVIDENCE block, treat that block as higher-priority project evidence and synthesize from it instead of repeating lower-confidence summaries or retrieval trails. Cite project claims using the supplied evidence, but keep the prose focused on the answer rather than the retrieval trail.',

    general:
      'Answer as a general professional assistant. Answer directly first, then use supplied evidence when relevant to support or refine the response. Avoid copying raw retrieval text, raw PDF-page IDs, or internal markers. Cite material project claims using the supplied evidence and keep the prose concise and useful.'
  };

  const system = [
    'You are Mission Companion, a rigorous subject-matter analysis system.',
    rules[mode] || rules.source,
    'Use the supplied evidence as context, not as prose to reproduce.',
    'Answer the user first, then summarize the basis and practical takeaway in a concise professional style.',
    'Check for conflicts, exceptions, definitions, and cross-references.',
    'Prefer precise, defensible conclusions over confident guesses.',
    'Do not expose raw retrieval logs, page lists, internal confidence text, raw PDF-page identifiers, or placeholder markers in the final answer.',
    mode === 'assisted'
      ? 'For expert-assisted mode, present the controlling project evidence first and only add general SME interpretation when it is clearly distinguished from project-specific requirements. Treat the deterministic SME findings as evidence to reason from, not prose to echo. Do not promote generalized construction knowledge into a project-specific deadline, duration, quantity, tolerance, acceptance criterion, or contractual obligation unless the supplied evidence explicitly supports it. When retrieved evidence is tangential, explain that it is not controlling and look for the actual governing section or contract provision instead.'
      : 'When anything important is uncertain, explain the specific gap without adding generic industry ranges unless the user explicitly asks for them.'
  ].join(' ');

  const body = {
    model: settings.openaiModel,
    messages: [
      {
        role: 'system',
        content: system
      },
      {
        role: 'user',
        content: [
          'QUESTION:',
          prompt,
          '',
          'EVIDENCE:',
          context || '(No evidence retrieved.)'
        ].join('\n')
      }
    ]
  };

  if (!settings.openaiModel.startsWith('gpt-5')) {
    body.temperature = 0.1;
  }

  console.log('AI_PROVIDER_REQUEST', {
    requestId: String(meta.requestId || ''),
    mode,
    model: settings.openaiModel,
    contextLength: Number(meta.contextLength) || String(context || '').length,
    bridgeContextIncluded: Boolean(meta.bridgeContextIncluded)
  });
  console.log('CHIEF_AI_PROVIDER_CALL', {
    requestId: String(meta.requestId || ''),
    mode,
    model: settings.openaiModel,
    contextLength: Number(meta.contextLength) || String(context || '').length,
    bridgeContextIncluded: Boolean(meta.bridgeContextIncluded)
  });

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    settings.timeout
  );

  try {
    const response = await fetch(
      `${settings.openaiUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.openaiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      }
    );

    const responseBody = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        responseBody?.error?.message ||
        `OpenAI request failed (${response.status})`
      );
    }

    const content =
      responseBody?.choices?.[0]?.message?.content ||
      'No response returned.';

    console.log('AI_PROVIDER_RESPONSE', {
      requestId: String(meta.requestId || ''),
      mode,
      success: true,
      preview: String(content).slice(0, 160)
    });
    console.log('CHIEF_AI_PROVIDER_RESULT', {
      requestId: String(meta.requestId || ''),
      mode,
      success: true,
      responseLength: content.length
    });

    const citations = [
      ...content.matchAll(/\[S(\d+)\]/g)
    ].map(match => Number(match[1]));

    return {
      content,
      citations: [...new Set(citations)]
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'The OpenAI request timed out.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}
