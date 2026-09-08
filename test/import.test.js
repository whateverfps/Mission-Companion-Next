import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function createLocalStorage() {
  const values = new Map();

  return {
    getItem: key => values.get(key) ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, String(value))
  };
}

function createIndexedDB() {
  const stores = new Map();
  let failNextSectionWrite = false;

  const ensureStore = name => {
    if (!stores.has(name)) {
      stores.set(name, {
        indexes: new Map(),
        records: new Map()
      });
    }
    return stores.get(name);
  };

  const database = {
    objectStoreNames: {
      contains: name => stores.has(name)
    },
    createObjectStore(name) {
      ensureStore(name);
      return upgradeStore(name);
    },
    transaction(storeNames, mode) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const operations = [];
      const transaction = {
        error: null,
        objectStore: name => transactionStore(name, operations)
      };

      setTimeout(() => {
        if (
          mode === 'readwrite' &&
          failNextSectionWrite &&
          operations.some(operation =>
            operation.store === 'sections' &&
            operation.type === 'put'
          )
        ) {
          failNextSectionWrite = false;
          transaction.error = new Error('Simulated section transaction failure');
          transaction.onabort?.();
          return;
        }

        for (const operation of operations) {
          const records = ensureStore(operation.store).records;

          if (operation.type === 'put') {
            const key = operation.store === 'drawingAnalyses' ? operation.value.drawingSetId
              : operation.store === 'sourceFiles' ? operation.value.documentId
                : operation.store === 'inspectionRecords' ? operation.value.inspectionId
                  : operation.value.id;
            records.set(key, structuredClone(operation.value));
          } else {
            records.delete(operation.key);
          }
        }

        transaction.oncomplete?.();
      }, 5);

      return transaction;
    },
    close() {}
  };

  function requestResult(value) {
    const request = {};
    setTimeout(() => {
      request.result = structuredClone(value);
      request.onsuccess?.();
    }, 0);
    return request;
  }

  function matchingRecords(storeName, indexName, key) {
    const store = ensureStore(storeName);
    const property = store.indexes.get(indexName);

    return [...store.records.values()].filter(record =>
      record[property] === key
    );
  }

  function indexApi(storeName, indexName, operations = null) {
    return {
      getAll: key => requestResult(
        matchingRecords(storeName, indexName, key)
      ),
      getAllKeys: key => {
        const request = {};
        setTimeout(() => {
              request.result = matchingRecords(storeName, indexName, key)
                .map(record => record.id || record.inspectionId || record.documentId || record.drawingSetId);
          request.onsuccess?.();
        }, 0);
        return request;
      }
    };
  }

  function upgradeStore(name) {
    const store = ensureStore(name);

    return {
      indexNames: {
        contains: indexName => store.indexes.has(indexName)
      },
      createIndex(indexName, property) {
        store.indexes.set(indexName, property);
      }
    };
  }

  function transactionStore(name, operations) {
    const store = ensureStore(name);

    return {
      delete(key) {
        operations.push({ key, store: name, type: 'delete' });
      },
      getAll() {
        return requestResult([...store.records.values()]);
      },
      get(key) {
        return requestResult(store.records.get(key) || null);
      },
      index(indexName) {
        const api = indexApi(name, indexName, operations);

        return {
          ...api,
          getAllKeys(key) {
            const request = {};
            setTimeout(() => {
              request.result = matchingRecords(name, indexName, key)
                .map(record => record.id || record.inspectionId || record.documentId || record.drawingSetId);
              request.onsuccess?.();

              for (const record of matchingRecords(name, indexName, key)) {
                operations.push({
                  key: record.id || record.inspectionId || record.documentId || record.drawingSetId,
                  store: name,
                  type: 'delete'
                });
              }
            }, 0);
            return request;
          }
        };
      },
      put(value) {
        operations.push({
          store: name,
          type: 'put',
          value: structuredClone(value)
        });
      }
    };
  }

  return {
    api: {
      deleteDatabase() {
        const request = {};
        setTimeout(() => {
          stores.clear();
          request.onsuccess?.();
        }, 0);
        return request;
      },
      open() {
        const request = {
          result: database,
          transaction: {
            objectStore: name => upgradeStore(name)
          }
        };

        setTimeout(() => {
          if (!stores.size) {
            request.onupgradeneeded?.();
          }
          request.onsuccess?.();
        }, 0);

        return request;
      }
    },
    failNextSectionWrite() {
      failNextSectionWrite = true;
    },
    storeNames() {
      return [...stores.keys()].sort();
    }
  };
}

function textFile(name = 'requirements.txt') {
  const content = '# Requirements\nChief shall preserve evidence.\n';

  return {
    name,
    type: 'text/plain',
    size: content.length,
    lastModified: 123,
    text: async () => content
  };
}

const database = createIndexedDB();
globalThis.indexedDB = database.api;
globalThis.localStorage = createLocalStorage();
globalThis.window = {
  dispatchEvent() {}
};
globalThis.CustomEvent = class {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
};

const { engine } = await import('../src/engine.js');
const {
  createDemonstrationProjectFixture,
  DEMO_PROJECT_ID
} = await import('../src/demo-project.js');
const { retrieve } = await import('../src/retrieval.js');

test('schema version 6 adds large state records while preserving existing settings and all prior stores', async () => {
  await engine.documents();
  assert.match(readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8'), /const DOC_DB_VERSION = 6;/);
  assert.equal(engine.state().settings.startupExperience, 'mission-control');
  assert.deepEqual(database.storeNames(), ['documents', 'drawingAnalyses', 'inspectionRecords', 'sections', 'sourceFiles', 'stateRecords']);
  engine.saveSettings({ startupExperience: 'professional-workspace' });
  assert.equal(engine.state().settings.startupExperience, 'professional-workspace');
  assert.equal(JSON.parse(globalThis.localStorage.getItem('mc-master-state-v2')).settings.startupExperience, 'professional-workspace');
  engine.saveSettings({ startupExperience: 'unsupported' });
  assert.equal(engine.state().settings.startupExperience, 'mission-control');
  assert.deepEqual(database.storeNames(), ['documents', 'drawingAnalyses', 'inspectionRecords', 'sections', 'sourceFiles', 'stateRecords']);
});

test('successful imports atomically register one document and its sections', async () => {
  const stages = [];
  const result = await engine.ingest(
    [textFile()],
    progress => stages.push(progress.stage),
    'general-library'
  );
  const documents = await engine.documents();
  const sections = await engine.sections();

  assert.equal(result.documents[0].status, 'verified');
  assert.equal(result.documents[0].lineageId, result.documents[0].id);
  assert.equal(result.documents[0].lineageStatus, 'current');
  assert.ok(result.documents[0].importedAt);
  assert.equal(documents.length, 1);
  assert.equal(sections.length, result.documents[0].sectionCount);
  assert.ok(sections.every(section =>
    section.documentId === documents[0].id
  ));
  assert.deepEqual(
    [...new Set(stages)],
    ['extracting', 'detecting', 'indexing', 'verifying']
  );
});

test('failed extraction leaves no document or section and retry does not duplicate', async () => {
  let attempt = 0;
  const file = textFile('retry.txt');
  file.text = async () => {
    attempt += 1;
    if (attempt === 1) throw new Error('Temporary read failure');
    return '# Retry\nRecovered content.';
  };

  const failed = await engine.ingest(
    [file],
    () => {},
    'general-library',
    { duplicateAction: 'reimport' }
  );

  assert.equal(failed.documents[0].status, 'error');
  assert.equal((await engine.documents()).length, 1);

  const retried = await engine.ingest(
    [file],
    () => {},
    'general-library',
    { duplicateAction: 'reimport' }
  );
  const documents = await engine.documents();
  const retryDocuments = documents.filter(document =>
    document.name === file.name
  );
  const retrySections = (await engine.sections()).filter(section =>
    section.documentId === retryDocuments[0].id
  );

  assert.equal(retried.documents[0].status, 'verified');
  assert.equal(retryDocuments.length, 1);
  assert.equal(retrySections.length, retryDocuments[0].sectionCount);
});

test('a failed document-and-section transaction rolls back the document write', async () => {
  const beforeDocuments = await engine.documents();
  const beforeSections = await engine.sections();
  database.failNextSectionWrite();

  await assert.rejects(
    engine.ingest(
      [textFile('atomic.txt')],
      () => {},
      'general-library',
      { duplicateAction: 'reimport' }
    ),
    /Simulated section transaction failure/
  );

  assert.equal((await engine.documents()).length, beforeDocuments.length);
  assert.equal((await engine.sections()).length, beforeSections.length);
});

test('duplicate detection leaves library and section counts unchanged', async () => {
  const file = textFile('duplicate.txt');
  await engine.ingest([file], () => {}, 'general-library');
  const documentsBefore = await engine.documents();
  const sectionsBefore = await engine.sections();
  const duplicate = await engine.ingest(
    [file],
    () => {},
    'general-library'
  );

  assert.equal(duplicate.documents.length, 0);
  assert.equal(duplicate.skipped.length, 1);
  assert.equal((await engine.documents()).length, documentsBefore.length);
  assert.equal((await engine.sections()).length, sectionsBefore.length);
});

test('re-import records an explicit duplicate without replacing the current document', async () => {
  const file = textFile('lineage-duplicate.txt');
  const original = await engine.ingest([file], () => {}, 'general-library');
  const duplicate = await engine.ingest(
    [file],
    () => {},
    'general-library',
    { duplicateAction: 'reimport' }
  );
  const originalDocument = original.documents[0];
  const duplicateDocument = duplicate.documents[0];

  assert.equal(duplicateDocument.lineageId, originalDocument.lineageId);
  assert.equal(duplicateDocument.lineageStatus, 'duplicate');
  assert.equal(duplicateDocument.duplicateOfDocumentId, originalDocument.id);
  assert.equal(
    (await engine.documents()).find(item => item.id === originalDocument.id).lineageStatus,
    'current'
  );
});

test('replace atomically preserves the superseded document and its sections', async () => {
  const file = textFile('lineage-replace.txt');
  const original = await engine.ingest([file], () => {}, 'general-library');
  const originalDocument = original.documents[0];
  const replaced = await engine.ingest(
    [file],
    () => {},
    'general-library',
    {
      duplicateAction: 'replace',
      duplicateDocumentId: originalDocument.id
    }
  );
  const currentDocument = replaced.documents[0];
  const documents = await engine.documents();
  const storedOriginal = documents.find(item => item.id === originalDocument.id);
  const storedCurrent = documents.find(item => item.id === currentDocument.id);
  const sections = await engine.sections();

  assert.equal(storedOriginal.lineageId, originalDocument.lineageId);
  assert.equal(storedOriginal.lineageStatus, 'superseded');
  assert.equal(storedOriginal.supersededByDocumentId, currentDocument.id);
  assert.equal(storedCurrent.lineageId, originalDocument.lineageId);
  assert.equal(storedCurrent.lineageStatus, 'current');
  assert.equal(storedCurrent.previousDocumentId, originalDocument.id);
  assert.equal(
    sections.filter(section => section.documentId === originalDocument.id).length,
    originalDocument.sectionCount
  );
  assert.equal(
    sections.filter(section => section.documentId === currentDocument.id).length,
    currentDocument.sectionCount
  );
  assert.ok((await engine.retrievableSections()).every(section =>
    section.documentId !== originalDocument.id
  ));
});

test('failed replacement leaves the existing lineage current and unchanged', async () => {
  const file = textFile('lineage-rollback.txt');
  const original = await engine.ingest([file], () => {}, 'general-library');
  const originalDocument = original.documents[0];
  database.failNextSectionWrite();

  await assert.rejects(
    engine.ingest(
      [file],
      () => {},
      'general-library',
      {
        duplicateAction: 'replace',
        duplicateDocumentId: originalDocument.id
      }
    ),
    /Simulated section transaction failure/
  );

  const family = (await engine.documents()).filter(document =>
    document.lineageId === originalDocument.lineageId
  );
  assert.equal(family.length, 1);
  assert.equal(family[0].id, originalDocument.id);
  assert.equal(family[0].lineageStatus, 'current');
  assert.equal(family[0].supersededByDocumentId, undefined);
});

test('approved deterministic project import preserves fixture identifiers and metadata', async () => {
  if (engine.state().projects.some(project => project.id === DEMO_PROJECT_ID)) await engine.deleteProject(DEMO_PROJECT_ID);
  const fixture = createDemonstrationProjectFixture();
  const imported = await engine.importProject(fixture, { preserveIdentifiers: true });
  const current = engine.state();
  const documents = await engine.documents();
  const sections = await engine.sections();

  assert.equal(imported.id, fixture.manifest.project.id);
  assert.equal(current.activeProject, DEMO_PROJECT_ID);
  assert.equal(current.projects.find(project => project.id === DEMO_PROJECT_ID).dataLabel, 'Fictional Sample Data');
  assert.deepEqual(documents.map(item => item.id).sort(), fixture.documents.map(item => item.id).sort());
  assert.deepEqual(sections.map(item => item.id).sort(), fixture.sections.map(item => item.id).sort());
  assert.equal(documents.find(item => item.id === 'mc-demo-doc-drawing-a201-r2').lineageId, 'mc-demo-lineage-a201');
  const inspectionRecords = await engine.inspectionRecords({ includeArchived: true });
  assert.equal(inspectionRecords.length, 5);
  assert.deepEqual(inspectionRecords.map(item => item.inspectionId).sort(), fixture.inspectionRecords.map(item => item.inspectionId).sort());
  const questions = [
    'What is required for Telecom Room TR-1 readiness?',
    'What inspection requirements apply to penetration firestopping under 07 84 13?',
    'How was RFI-002 Existing duct conflicts with new cable tray resolved?',
    'What evidence documents the cable tray conflict above Exam Room 112?'
  ];
  for (const question of questions) {
    const answer = await engine.ask(question, 'offline');
    assert.ok(answer.content);
    assert.ok(answer.hits.length);
    assert.ok(answer.hits.every(hit =>
      Array.isArray(hit.path) && hit.path.every(part => typeof part === 'string')
    ));
  }
});

test('final retrieval hits canonicalize legacy string and missing paths without mutating sources', () => {
  const legacy = { id: 'legacy-path', documentId: 'legacy-document', heading: 'Legacy', text: 'legacy path searchable evidence', path: 'Specifications / 01 45 00' };
  const missing = { id: 'missing-path', documentId: 'legacy-document', heading: 'Missing', text: 'missing path searchable evidence' };
  const hits = retrieve('searchable evidence', [legacy, missing], 2);
  assert.deepEqual(hits.find(hit => hit.id === legacy.id).path, ['Specifications / 01 45 00']);
  assert.deepEqual(hits.find(hit => hit.id === missing.id).path, []);
  assert.equal(legacy.path, 'Specifications / 01 45 00');
  assert.equal(Object.hasOwn(missing, 'path'), false);
});

test('deterministic import rejects collisions before duplicating fixture records', async () => {
  const beforeDocuments = await engine.documents();
  await assert.rejects(
    engine.importProject(createDemonstrationProjectFixture(), { preserveIdentifiers: true }),
    /identifier collision/
  );
  assert.equal((await engine.documents()).length, beforeDocuments.length);
});

test('reset deletes only the deterministic demonstration project and restores canonical records', async () => {
  engine.saveSettings({ startupExperience: 'professional-workspace' });
  const retainedConversation = engine.createConversation({ projectId: DEMO_PROJECT_ID });
  engine.appendConversationMessage({ role: 'user', content: 'Retain this demonstration conversation.' }, retainedConversation.conversationId);
  const unrelated = engine.addProject('Unaffected import test project');
  const unrelatedId = unrelated.id;
  await engine.deleteProject(DEMO_PROJECT_ID);
  assert.ok(engine.state().projects.some(project => project.id === unrelatedId));
  await engine.importProject(createDemonstrationProjectFixture(), { preserveIdentifiers: true });
  assert.ok(engine.state().projects.some(project => project.id === DEMO_PROJECT_ID));
  assert.ok(engine.state().projects.some(project => project.id === unrelatedId));
  assert.equal(engine.state().settings.startupExperience, 'professional-workspace');
  assert.ok(engine.conversations().some(item => item.conversationId === retainedConversation.conversationId));
  assert.equal((await engine.inspectionRecords({ includeArchived: true })).length, 5);
  engine.saveSettings({ startupExperience: 'mission-control' });
});

test('ordinary project imports retain identifier remapping and imported naming behavior', async () => {
  const ordinary = {
    manifest: { project: { id: 'ordinary-source-project', name: 'Ordinary Source', custom: 'not promoted' } },
    libraries: [{ id: 'ordinary-source-library', projectId: 'ordinary-source-project', name: 'Source Library', enabled: true }],
    documents: [{ id: 'ordinary-source-document', projectId: 'ordinary-source-project', libraryId: 'ordinary-source-library', name: 'Source.txt', status: 'verified', sectionCount: 1 }],
    sections: [{ id: 'ordinary-source-section', projectId: 'ordinary-source-project', libraryId: 'ordinary-source-library', documentId: 'ordinary-source-document', text: 'Ordinary import content.', crossReferenceIds: [] }],
    inspectionRecords: [{ inspectionId: 'ordinary-inspection', projectId: 'ordinary-source-project', inspectionNumber: 'INS-004', title: 'Imported inspection', inspectionDate: '2026-07-30', status: 'Complete', result: 'Acceptable', sourceDocumentIds: ['ordinary-source-document'], sourceSectionIds: ['ordinary-source-section'], evidenceReferences: [{ documentId: 'ordinary-source-document', sectionId: 'ordinary-source-section' }] }]
  };
  const imported = await engine.importProject(ordinary);
  assert.notEqual(imported.id, ordinary.manifest.project.id);
  assert.equal(imported.name, 'Ordinary Source (Imported)');
  assert.notEqual((await engine.documents())[0].id, ordinary.documents[0].id);
  assert.notEqual((await engine.sections())[0].id, ordinary.sections[0].id);
  const importedInspection = (await engine.inspectionRecords())[0];
  assert.notEqual(importedInspection.inspectionId, ordinary.inspectionRecords[0].inspectionId);
  assert.deepEqual(importedInspection.sourceDocumentIds, [(await engine.documents())[0].id]);
  assert.deepEqual(importedInspection.sourceSectionIds, [(await engine.sections())[0].id]);
});

test('drawing metadata imports without source bytes and requires exact PDF reattachment', async () => {
  const drawingPackage = {
    manifest: { project: { id: 'drawing-package-project', name: 'Drawing Package' } },
    libraries: [{ id: 'drawing-library', projectId: 'drawing-package-project', name: 'Drawings', enabled: true }],
    documents: [{ id: 'drawing-document', projectId: 'drawing-package-project', libraryId: 'drawing-library', name: 'Plans.pdf', extension: 'pdf', type: 'application/pdf', status: 'verified', sectionCount: 1 }],
    sections: [{ id: 'drawing-section', projectId: 'drawing-package-project', libraryId: 'drawing-library', documentId: 'drawing-document', text: 'M-101 MECHANICAL PLAN', crossReferenceIds: [] }],
    drawingAnalyses: [{ drawingSetId: 'source-analysis', documentId: 'drawing-document', projectId: 'drawing-package-project', analyzedAt: '2026-07-31T00:00:00Z', sheets: [{ pageNumber: 1, pageWidth: 1000, pageHeight: 700, rotation: 0, textItems: [{ text: 'M-101', region: { x: .8, y: .9, width: .1, height: .02 } }, { text: 'MECHANICAL PLAN', region: { x: .6, y: .86, width: .3, height: .02 } }] }] }]
  };
  await engine.importProject(drawingPackage);
  const [document] = await engine.documents();
  assert.equal(document.sourceAvailability, 'reattachment-required');
  assert.equal(await engine.sourceFile(document.id), null);
  const analysis = await engine.drawingAnalysis(document.id);
  assert.equal(analysis.sheets[0].sheetNumber, 'M-101');
  const exported = await engine.exportProject();
  assert.equal(exported.sourceFilesIncluded, false);
  assert.equal(Object.hasOwn(exported, 'sourceFiles'), false);
  assert.equal(exported.drawingAnalyses.length, 1);
});

test('Inspection Record CRUD is project-isolated, archived numbers are not reused, and export includes records', async () => {
  const project = engine.addProject('Inspection CRUD Project');
  const created = await engine.createInspectionRecord({ title: 'Initial inspection', inspectionDate: '2026-07-31' });
  assert.equal(created.inspectionNumber, 'INS-001');
  assert.equal((await engine.inspectionRecord(created.inspectionId)).title, 'Initial inspection');
  const updated = await engine.updateInspectionRecord(created.inspectionId, { status: 'Complete', result: 'Acceptable', observedConditions: 'User-entered condition.' });
  assert.equal(updated.result, 'Acceptable');
  await engine.archiveInspectionRecord(created.inspectionId);
  assert.equal((await engine.inspectionRecords()).length, 0);
  assert.equal(await engine.nextInspectionNumber(project.id), 'INS-002');
  assert.equal((await engine.exportProject()).inspectionRecords.length, 1);
  const other = engine.addProject('Other Inspection Project');
  assert.equal((await engine.inspectionRecords({ includeArchived: true })).length, 0);
  engine.setProject(project.id);
  await engine.deleteProject(project.id);
  engine.setProject(other.id);
  assert.equal(await engine.inspectionRecord(created.inspectionId), null);
});

test('ordinary import remains backward compatible when Inspection Records are absent', async () => {
  await engine.importProject({ manifest: { project: { name: 'Legacy without inspections' } }, libraries: [], documents: [], sections: [] });
  assert.deepEqual(await engine.inspectionRecords({ includeArchived: true }), []);
});

test('conversations persist in IndexedDB while compact localStorage retains only the active pointer', async () => {
  const conversation = engine.createConversation({ projectId: engine.state().activeProject, now: '2026-07-31T12:00:00Z' });
  engine.appendConversationMessage({ id: 'conversation-user-message', role: 'user', content: 'Persist this thread', createdAt: '2026-07-31T12:01:00Z' }, conversation.conversationId);
  engine.addConversationAttachment('stable-document-reference', conversation.conversationId);
  const stored = JSON.parse(globalThis.localStorage.getItem('mc-master-state-v2'));
  assert.equal(stored.activeConversationId, conversation.conversationId);
  assert.equal(Object.hasOwn(stored, 'conversations'), false);
  assert.equal(Object.hasOwn(stored, 'evaluations'), false);
  await engine.flushPersistence();
  const diagnostics = await engine.storageDiagnostics();
  assert.equal(diagnostics.largeStateRecordCount, 1);
  assert.deepEqual(engine.state().chat.map(item => item.id), ['conversation-user-message']);
  assert.deepEqual(engine.activeConversation().attachmentDocumentIds, ['stable-document-reference']);
  engine.clearChat();
  assert.equal(engine.conversations().some(item => item.conversationId === conversation.conversationId), true);
});

test('attachment scope constrains eligible sections without changing ordinary search', async () => {
  engine.setProject('general');
  const documents = await engine.documents();
  const scoped = documents[0];
  if (!scoped) return;
  const ordinary = await engine.search('Chief preserve evidence');
  const attached = await engine.search('Chief preserve evidence', { documentIds: [scoped.id] });
  assert.ok(attached.every(hit => hit.documentId === scoped.id));
  assert.ok(ordinary.length >= attached.length);
});

test('legacy flat chat migrates once into the active conversation compatibility view', async () => {
  const legacyStorage = createLocalStorage();
  legacyStorage.setItem('mc-master-state-v2', JSON.stringify({
    settings: { startupExperience: 'professional-workspace' },
    projects: [{ id: 'general', name: 'General' }, { id: 'bedford', name: 'Bedford VAMC' }],
    libraries: [{ id: 'general-library', projectId: 'general', name: 'General Library', enabled: true }, { id: 'bedford-library', projectId: 'bedford', name: 'Bedford Library', enabled: true }],
    activeProject: 'bedford', activeLibrary: 'bedford-library',
    chat: [{ id: 'legacy-message', role: 'user', content: 'Legacy retained message', createdAt: '2026-01-01T00:00:00Z' }]
  }));
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = legacyStorage;
  try {
    const { engine: migratedEngine } = await import(`../src/engine.js?legacy-migration=${Date.now()}`);
    assert.equal(migratedEngine.conversations().length, 1);
    assert.deepEqual(migratedEngine.state().chat.map(item => item.id), ['legacy-message']);
    await migratedEngine.initialize();
    migratedEngine.saveSettings({ topK: 10 }); await migratedEngine.flushPersistence();
    const stored = JSON.parse(legacyStorage.getItem('mc-master-state-v2'));
    assert.equal(Object.hasOwn(stored, 'conversations'), false);
    assert.ok(stored.activeConversationId);
    assert.equal(stored.activeProject, 'bedford');
    assert.equal(stored.settings.startupExperience, 'professional-workspace');
  } finally {
    globalThis.localStorage = originalStorage;
  }
});

test('localStorage quota failure does not abort initialization or conversation creation', async () => {
  const quotaStorage = { getItem: () => null, removeItem() {}, setItem() { const error = new Error('Storage quota exceeded'); error.name = 'QuotaExceededError'; throw error; } };
  const originalStorage = globalThis.localStorage; globalThis.localStorage = quotaStorage;
  try {
    const { engine: quotaEngine } = await import(`../src/engine.js?quota-recovery=${Date.now()}`);
    const startup = await quotaEngine.initialize(); assert.equal(startup.ok, true);
    const conversation = quotaEngine.createConversation({ projectId: 'general' });
    quotaEngine.appendConversationMessage({ role: 'user', content: 'In-memory work remains available.' }, conversation.conversationId);
    await quotaEngine.flushPersistence();
    assert.equal(quotaEngine.activeConversation().messages.length, 1);
    assert.equal((await quotaEngine.storageDiagnostics()).lastPersistenceFailure.reason, 'quota-exceeded');
  } finally { globalThis.localStorage = originalStorage; }
});

test('drawing lifecycle save resolves exact ownership globally while General is active', async () => {
  const imported = await engine.importProject({
    manifest: { project: { id: 'lifecycle-project', name: 'Lifecycle Project' } }, libraries: [],
    documents: [{ id: 'lifecycle-document', projectId: 'lifecycle-project', name: 'plans.pdf', extension: 'pdf' }], sections: [],
    drawingAnalyses: [{ drawingSetId: 'lifecycle-source-set', documentId: 'lifecycle-document', projectId: 'lifecycle-project', analysisVersion: 2, sheets: [{ pageNumber: 1, pageWidth: 100, pageHeight: 100, rotation: 0, textItems: [{ text: 'M-101', region: { x: .8, y: .9, width: .1, height: .02 } }, { text: 'MECHANICAL PLAN', region: { x: .6, y: .85, width: .3, height: .02 } }] }] }]
  });
  const [analysis] = await engine.drawingAnalyses();
  const [document] = await engine.documents();
  engine.setProject('general');
  const lifecycle = await engine.drawingLifecycle(document.id, analysis.drawingSetId);
  assert.equal(lifecycle.ok, true, JSON.stringify({ errorCode: lifecycle.errorCode, warning: lifecycle.warning, analysis: lifecycle.analysis?.drawingSetId, document: lifecycle.document?.id }));
  assert.equal(lifecycle.owningProjectId, imported.id);
  const saved = await engine.saveDrawingAnalysis({ ...analysis, status: 'Ready for review' });
  assert.equal(saved.ok, true);
  assert.equal(saved.document.projectId, imported.id);
  assert.equal(engine.state().activeProject, 'general');
  engine.setProject(imported.id);
  const deleted = await engine.deleteProject(imported.id);
  assert.equal(deleted.ok, true);
  assert.equal(deleted.cleanup.drawingAnalyses, true);
  assert.equal((await engine.drawingLifecycle(document.id, analysis.drawingSetId)).ok, false);
});

test('drawing lifecycle save returns structured ownership failures', async () => {
  const result = await engine.saveDrawingAnalysis({ drawingSetId: 'missing-set', documentId: 'missing-document', projectId: 'missing-project', analysisVersion: 3 });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'drawing-document-missing');
});

test('project import rejects duplicate drawing lifecycle identifiers before registration', async () => {
  const base = { manifest: { project: { id: 'duplicate-project', name: 'Duplicate Project' } }, libraries: [], sections: [] };
  await assert.rejects(engine.importProject({ ...base, documents: [{ id: 'same' }, { id: 'same' }] }), /unique document identifiers/);
  await assert.rejects(engine.importProject({ ...base, documents: [{ id: 'drawing' }], drawingAnalyses: [{ drawingSetId: 'same-set', documentId: 'drawing', projectId: 'duplicate-project' }, { drawingSetId: 'same-set', documentId: 'drawing', projectId: 'duplicate-project' }] }), /unique drawing-set identifiers/);
  await assert.rejects(engine.importProject({ ...base, documents: [{ id: 'drawing' }], drawingAnalyses: [{ drawingSetId: 'owned-set', documentId: 'drawing', projectId: 'wrong-project' }] }), /does not belong/);
});

test('reattachment and analysis saves use exact document ownership rather than active project ownership', () => {
  const source = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  const reattach = source.slice(source.indexOf('async reattachPdfSource'), source.indexOf('async inspectionRecords'));
  assert.match(reattach, /const document = await one\('documents', documentId\)/);
  assert.match(reattach, /projectId: document\.projectId/);
  assert.doesNotMatch(reattach, /projectId: state\.activeProject/);
  const saveAnalysis = source.slice(source.indexOf('async saveDrawingAnalysis'), source.indexOf('async reattachPdfSource'));
  assert.match(saveAnalysis, /await one\('documents', analysis\.documentId\)/);
  assert.doesNotMatch(saveAnalysis, /await this\.documents/);
});

test('document reclassification preserves stable identity and indexed records', async () => {
  const project = await engine.importProject({ manifest: { project: { name: 'Classification Fixture' } }, libraries: [], documents: [{ id: 'legacy-spec', name: 'project-manual.pdf', extension: 'pdf', pageCount: 2363 }], sections: [{ id: 'legacy-spec-section', documentId: 'legacy-spec', sectionNumber: '23 31 00', heading: 'HVAC Ducts' }] });
  const [document] = await engine.documents(); const beforeId = document.id; const beforeSections = (await engine.sections()).length;
  const result = await engine.reclassifyDocument(document.id, { documentType: 'specifications', revision: 'IFC' });
  assert.equal(result.ok, true); assert.equal(result.document.id, beforeId); assert.equal(result.document.documentType, 'specifications'); assert.equal(result.document.revision, 'IFC');
  assert.equal(result.indexedSectionCount, beforeSections); assert.equal((await engine.sections()).length, beforeSections);
  const source = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  const method = source.slice(source.indexOf('async reclassifyDocument'), source.indexOf('async sourceFile'));
  assert.doesNotMatch(method, /delete|remove/);
  await engine.deleteProject(project.id);
});
