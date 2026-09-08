import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkspaceEvidenceDraft,
  buildWorkspaceEvidenceModel,
  createWorkspaceEvidenceStore,
  workspaceEvidenceTypeLabel,
  workspaceEvidenceFileMeta
} from '../src/workspace-evidence.js';

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

function createIndexedDB({ initialVersion = 0 } = {}) {
  const stores = new Map();
  let databaseVersion = initialVersion;

  const ensureStore = name => {
    if (!stores.has(name)) {
      stores.set(name, {
        indexes: new Map(),
        records: new Map()
      });
    }
    return stores.get(name);
  };

  const requestResult = value => {
    const request = {};
    setTimeout(() => {
      request.result = structuredClone(value);
      request.onsuccess?.();
    }, 0);
    return request;
  };

  const matchingRecords = (storeName, indexName, key) => {
    const store = ensureStore(storeName);
    const property = store.indexes.get(indexName);
    return [...store.records.values()].filter(record => record[property] === key);
  };

  const upgradeStore = name => {
    const store = ensureStore(name);
    return {
      indexNames: { contains: indexName => store.indexes.has(indexName) },
      createIndex(indexName, property) {
        store.indexes.set(indexName, property);
      }
    };
  };

  const transactionStore = name => ({
    delete(key) {
      pendingOperations.push({ store: name, type: 'delete', key });
    },
    get(key) {
      return requestResult(ensureStore(name).records.get(key) || null);
    },
    getAll() {
      return requestResult([...ensureStore(name).records.values()]);
    },
    index(indexName) {
      return {
        getAll: key => requestResult(matchingRecords(name, indexName, key)),
        getAllKeys: key => requestResult(matchingRecords(name, indexName, key).map(record => record.id || record.inspectionId || record.documentId || record.drawingSetId))
      };
    },
    put(value) {
      const request = {};
      pendingOperations.push({ store: name, type: 'put', value: structuredClone(value), request });
      return request;
    }
  });

  let pendingOperations = [];
  const database = {
    objectStoreNames: { contains: name => stores.has(name) },
    createObjectStore(name) {
      ensureStore(name);
      return upgradeStore(name);
    },
    transaction(storeNames, mode) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      pendingOperations = [];
      const transaction = {
        error: null,
        objectStore: name => transactionStore(name)
      };
      setTimeout(() => {
        for (const operation of pendingOperations) {
          const store = ensureStore(operation.store);
          if (operation.type === 'put') {
            const key = operation.value.id || operation.value.inspectionId || operation.value.documentId || operation.value.drawingSetId;
            store.records.set(key, structuredClone(operation.value));
            operation.request.onsuccess?.({ target: { result: structuredClone(operation.value) } });
          } else {
            store.records.delete(operation.key);
          }
        }
        transaction.oncomplete?.();
      }, 0);
      return transaction;
    },
    close() {}
  };

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
      open(_name, requestedVersion = 0) {
        const request = {
          result: database,
          transaction: { objectStore: name => upgradeStore(name) }
        };
        setTimeout(() => {
          if (requestedVersion && requestedVersion > databaseVersion) {
            databaseVersion = requestedVersion;
            request.onupgradeneeded?.();
          } else if (!stores.size) {
            request.onupgradeneeded?.();
          }
          request.onsuccess?.();
        }, 0);
        return request;
      }
    },
    storeNames: () => [...stores.keys()].sort(),
    version: () => databaseVersion
  };
}

globalThis.localStorage = createMemoryStorage();
globalThis.indexedDB = createIndexedDB().api;
globalThis.window = globalThis.window || globalThis;
globalThis.window.dispatchEvent ||= () => true;
globalThis.window.addEventListener ||= () => {};
globalThis.CustomEvent ||= class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
const { engine } = await import('../src/engine.js');

test('workspace evidence drafts preserve active workspace context and linked sources', () => {
  const draft = buildWorkspaceEvidenceDraft({
    projectId: 'bedford',
    workspace: { id: 'B13', room: 'B13', building: '61', level: 'Basement' },
    selectedSheet: {
      sheetNumber: '61A-401',
      sheetTitle: 'Fire Protection Plan',
      documentId: 'bedford-b61-drawings',
      pageId: 'drawing-page:bedford-b61-drawings:12'
    },
    relatedSpecifications: [{ sectionNumber: '21 13 13', sectionTitle: 'Fire Protection' }],
    sourceContext: { capturedAt: '2026-08-15T10:00:00Z' },
    type: 'photo',
    title: 'Basement condition photo',
    linkedIssueIds: ['issue-1'],
    linkedChecklistItemIds: ['check-1'],
    linkedObservationIds: ['obs-1'],
    linkedRfiIds: ['rfi-1']
  });
  assert.equal(draft.projectId, 'bedford');
  assert.equal(draft.workspaceId, 'B13');
  assert.equal(draft.selectedSheet.sheetNumber, '61A-401');
  assert.equal(draft.relatedSpecifications[0].sectionNumber, '21 13 13');
  assert.equal(draft.linkedIssueIds[0], 'issue-1');
  assert.equal(draft.sourceContext.selectedSheet.sheetNumber, '61A-401');
  assert.equal(workspaceEvidenceTypeLabel('photo'), 'Photo');
});

test('workspace evidence file metadata is derived from the selected file and does not expose persistent storage metadata', () => {
  const metadata = workspaceEvidenceFileMeta({
    name: 'photo.jpg',
    type: 'image/jpeg',
    size: 2048,
    lastModified: 1712345678901
  }, { workspaceId: 'B13', type: 'PHOTO' });

  assert.equal(metadata.fileName, 'photo.jpg');
  assert.equal(metadata.mimeType, 'image/jpeg');
  assert.equal(metadata.size, 2048);
  assert.equal(metadata.lastModified, 1712345678901);
  assert.equal(Object.hasOwn(metadata, 'storageRef'), false);
});

test('workspace evidence blob persistence saves, loads, and isolates durable binary data', async () => {
  const blobStore = engine.workspaceEvidenceBlobPersistence();
  const storage = createMemoryStorage();
  const persistence = engine.workspaceEvidencePersistence();
  const createBlob = (text, type) => new Blob([text], { type });

  const photoBlobId = blobStore.blobIdFor('bedford', 'B13', 'evidence-photo');
  const fileBlobId = blobStore.blobIdFor('bedford', '124', 'evidence-file');

  await blobStore.putBlob({
    id: photoBlobId,
    evidenceId: 'evidence-photo',
    projectId: 'bedford',
    workspaceId: 'B13',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 5,
    blob: createBlob('photo', 'image/jpeg'),
    createdAt: '2026-08-15T10:00:00Z',
    updatedAt: '2026-08-15T10:00:00Z'
  });

  await blobStore.putBlob({
    id: fileBlobId,
    evidenceId: 'evidence-file',
    projectId: 'bedford',
    workspaceId: '124',
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    size: 6,
    blob: createBlob('report', 'application/pdf'),
    createdAt: '2026-08-15T10:01:00Z',
    updatedAt: '2026-08-15T10:01:00Z'
  });

  const loadedPhoto = await blobStore.loadBlob('evidence-photo', 'bedford', 'B13');
  const loadedFile = await blobStore.loadBlob('evidence-file', 'bedford', '124');

  assert.equal(loadedPhoto.id, photoBlobId);
  assert.equal(await loadedPhoto.blob.text(), 'photo');
  assert.equal(loadedFile.id, fileBlobId);
  assert.equal(await loadedFile.blob.text(), 'report');
  assert.equal((await blobStore.listBlobs('bedford', 'B13')).length, 1);
  assert.equal((await blobStore.listBlobs('bedford', '124')).length, 1);

  const store = createWorkspaceEvidenceStore({
    storage,
    persistence,
    idFactory: (() => {
      let index = 0;
      return () => `evidence-${++index}`;
    })(),
    now: () => '2026-08-15T10:02:00Z'
  });
  await store.load('bedford');
  const noteBlobId = blobStore.blobIdFor('bedford', 'B13', 'evidence-note');
  const created = store.create({
    id: 'evidence-note',
    projectId: 'bedford',
    workspaceId: 'B13',
    type: 'FILE',
    title: 'B13 file evidence',
    description: 'Binary evidence',
    fileName: 'evidence.txt',
    mimeType: 'text/plain',
    size: 7,
    storageRef: noteBlobId
  });
  await blobStore.putBlob({
    id: noteBlobId,
    evidenceId: 'evidence-note',
    projectId: 'bedford',
    workspaceId: 'B13',
    fileName: 'evidence.txt',
    mimeType: 'text/plain',
    size: 7,
    blob: createBlob('payload', 'text/plain'),
    createdAt: '2026-08-15T10:02:00Z',
    updatedAt: '2026-08-15T10:02:00Z'
  });

  const localState = storage.getItem('mission-companion:workspace-evidence:v1');
  assert.doesNotMatch(localState, /blob:https?:\/\//);
  assert.doesNotMatch(localState, /data:[^"']+/);
  assert.equal(created.storageRef, noteBlobId);

  const reloaded = createWorkspaceEvidenceStore({ storage, persistence, now: () => '2026-08-15T10:03:00Z' });
  await reloaded.load('bedford');
  const b13 = reloaded.list({ projectId: 'bedford', workspaceId: 'B13' });
  assert.equal(b13.length, 1);
  assert.equal(b13[0].storageRef, noteBlobId);
  const reloadedBlob = await blobStore.loadBlob('evidence-note', 'bedford', 'B13');
  assert.equal(await reloadedBlob.blob.text(), 'payload');

  reloaded.delete('evidence-note');
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.equal(await blobStore.loadBlob('evidence-note', 'bedford', 'B13'), null);
  assert.equal((await blobStore.listBlobs('bedford', 'B13')).length, 1);
});

test('workspace evidence blob persistence upgrades an existing database and creates the blob store', async () => {
  const previousIndexedDB = globalThis.indexedDB;
  const fakeIndexedDB = createIndexedDB({ initialVersion: 7 });
  globalThis.indexedDB = fakeIndexedDB.api;
  try {
    const blobStore = engine.workspaceEvidenceBlobPersistence();
    const blobId = blobStore.blobIdFor('bedford', 'B13', 'evidence-upgrade');

    await blobStore.putBlob({
      id: blobId,
      evidenceId: 'evidence-upgrade',
      projectId: 'bedford',
      workspaceId: 'B13',
      fileName: 'upgrade.png',
      mimeType: 'image/png',
      size: 3,
      blob: new Blob(['png'], { type: 'image/png' }),
      createdAt: '2026-08-15T10:05:00Z',
      updatedAt: '2026-08-15T10:05:00Z'
    });

    assert.equal(fakeIndexedDB.storeNames().includes('workspaceEvidenceBlobs'), true);
    assert.equal(fakeIndexedDB.version(), 8);
    const loaded = await blobStore.loadBlob('evidence-upgrade', 'bedford', 'B13');
    assert.equal(loaded?.id, blobId);
    assert.equal(await loaded.blob.text(), 'png');
  } finally {
    globalThis.indexedDB = previousIndexedDB;
  }
});

test('workspace evidence missing blobs remain truthful and do not invent previews', async () => {
  const blobStore = engine.workspaceEvidenceBlobPersistence();
  const storage = createMemoryStorage();
  const persistence = engine.workspaceEvidencePersistence();
  const store = createWorkspaceEvidenceStore({
    storage,
    persistence,
    idFactory: () => 'evidence-missing',
    now: () => '2026-08-15T10:04:00Z'
  });

  await store.load('bedford');
  const storageRef = blobStore.blobIdFor('bedford', 'B13', 'evidence-missing');
  store.create({
    id: 'evidence-missing',
    projectId: 'bedford',
    workspaceId: 'B13',
    type: 'PHOTO',
    title: 'Missing photo evidence',
    storageRef
  });

  assert.equal(await blobStore.loadBlob('evidence-missing', 'bedford', 'B13'), null);
  assert.equal(store.get('evidence-missing').storageRef, storageRef);
  const persisted = storage.getItem('mission-companion:workspace-evidence:v1');
  assert.match(persisted, new RegExp(storageRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('workspace evidence persists across reloads and remains isolated by workspace', async () => {
  const storage = createMemoryStorage();
  const persistence = {
    async loadEvidence() {
      return [];
    },
    async putEvidence() {},
    async deleteEvidence() {}
  };
  const store = createWorkspaceEvidenceStore({
    storage,
    persistence,
    idFactory: (() => {
      let index = 0;
      return () => `evidence-${++index}`;
    })(),
    now: () => '2026-08-15T10:00:00Z'
  });
  await store.load('bedford');
  const first = store.create({
    projectId: 'bedford',
    workspaceId: 'B13',
    type: 'NOTE',
    title: 'B13 note',
    description: 'Persisted B13 evidence',
    selectedSheet: { sheetNumber: '61A-401', sheetTitle: 'Fire Protection Plan' },
    relatedSpecifications: [{ sectionNumber: '21 13 13', sectionTitle: 'Fire Protection' }],
    linkedIssueIds: ['issue-b13'],
    linkedChecklistItemIds: ['check-b13'],
    linkedObservationIds: ['obs-b13'],
    linkedRfiIds: ['rfi-b13']
  });
  const second = store.create({
    projectId: 'bedford',
    workspaceId: '124',
    type: 'DRAWING',
    title: '124 drawing evidence',
    description: 'Persisted 124 evidence',
    selectedSheet: { sheetNumber: '124E-101', sheetTitle: 'Electrical Plan' },
    relatedSpecifications: [{ sectionNumber: '26 05 11', sectionTitle: 'Requirements for Electrical Work' }]
  });
  store.update(first.id, { pinned: true, archived: true, tags: ['field', 'photo'] });

  const reloaded = createWorkspaceEvidenceStore({ storage, persistence: null });
  await reloaded.load('bedford');
  const b13 = reloaded.list({ projectId: 'bedford', workspaceId: 'B13' });
  const b124 = reloaded.list({ projectId: 'bedford', workspaceId: '124' });

  assert.equal(b13.length, 1);
  assert.equal(b124.length, 1);
  assert.equal(b13[0].id, first.id);
  assert.equal(b13[0].title, 'B13 note');
  assert.equal(b13[0].selectedSheet.sheetNumber, '61A-401');
  assert.equal(b13[0].linkedIssueIds[0], 'issue-b13');
  assert.equal(b13[0].pinned, true);
  assert.equal(b124[0].id, second.id);
  assert.equal(b124[0].selectedSheet.sheetNumber, '124E-101');
  assert.equal(b124[0].relatedSpecifications[0].sectionNumber, '26 05 11');
});

test('workspace evidence links are deduplicated while preserving existing relationships', async () => {
  const storage = createMemoryStorage();
  const persistence = {
    async loadEvidence() {
      return [];
    },
    async putEvidence() {},
    async deleteEvidence() {}
  };
  const store = createWorkspaceEvidenceStore({ storage, persistence, idFactory: () => 'evidence-link', now: () => '2026-08-15T10:05:00Z' });
  await store.load('bedford');
  store.create({
    id: 'evidence-link',
    projectId: 'bedford',
    workspaceId: 'B13',
    type: 'NOTE',
    title: 'Link target',
    linkedIssueIds: ['issue-a'],
    linkedChecklistItemIds: ['check-a'],
    linkedObservationIds: ['obs-a'],
    linkedRfiIds: ['rfi-a']
  });
  const linked = store.link('evidence-link', {
    issueId: 'issue-a',
    checklistItemId: 'check-a',
    observationId: 'obs-a',
    rfiId: 'rfi-a'
  });
  assert.deepEqual(linked.linkedIssueIds, ['issue-a']);
  assert.deepEqual(linked.linkedChecklistItemIds, ['check-a']);
  assert.deepEqual(linked.linkedObservationIds, ['obs-a']);
  assert.deepEqual(linked.linkedRfiIds, ['rfi-a']);
});

test('workspace evidence model provides a usable filtered detail view', () => {
  const model = buildWorkspaceEvidenceModel({
    projectId: 'bedford',
    workspace: { id: 'B13' },
    evidence: [
      {
        id: 'e-1',
        projectId: 'bedford',
        workspaceId: 'B13',
        type: 'NOTE',
        title: 'Note A',
        selectedSheet: { sheetNumber: '61A-401' }
      },
      {
        id: 'e-2',
        projectId: 'bedford',
        workspaceId: 'B13',
        type: 'DRAWING',
        title: 'Drawing A',
        selectedSheet: { sheetNumber: '61A-402' }
      }
    ],
    filter: 'drawing',
    selectedEvidenceId: 'e-2'
  });
  assert.equal(model.evidence.length, 1);
  assert.equal(model.selectedEvidence.id, 'e-2');
  assert.deepEqual(model.filters.map(item => item.id), ['all', 'PHOTO', 'FILE', 'DRAWING', 'SPECIFICATION', 'NOTE']);
  assert.equal(model.counts.total, 2);
  assert.equal(model.emptyState, '');
});
