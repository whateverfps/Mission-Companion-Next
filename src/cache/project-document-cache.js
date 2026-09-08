import { createCachePolicy } from './cache-policy.js';

export function createProjectDocumentCache({
  loadDocuments,
  maxProjects = 2,
  ttlMs = 0,
  now = () => Date.now()
} = {}) {
  if (typeof loadDocuments !== 'function') {
    throw new TypeError('loadDocuments must be a function.');
  }

  const cache = createCachePolicy({
    maxEntries: maxProjects,
    ttlMs,
    now
  });

  return {
    async get(projectId) {
      const cachedDocuments = cache.get(projectId);

      if (cachedDocuments !== undefined) {
        return cachedDocuments;
      }

      const documents = await loadDocuments(String(projectId ?? ''));
      cache.set(projectId, documents);
      return documents;
    },

    invalidateProject(projectId) {
      cache.invalidate(projectId);
    },

    clear() {
      cache.clear();
    },

    snapshot() {
      return {
        type: 'documents',
        ...cache.snapshot()
      };
    }
  };
}