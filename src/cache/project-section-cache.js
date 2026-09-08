import { invalidateRetrievalCaches } from '../retrieval.js';
import { createCachePolicy } from './cache-policy.js';

export function createProjectSectionCache({
  loadSections,
  maxProjects = 2,
  ttlMs = 0,
  now = () => Date.now(),
  onInvalidate = sections => invalidateRetrievalCaches(sections)
} = {}) {
  if (typeof loadSections !== 'function') {
    throw new TypeError('loadSections must be a function.');
  }

  const cache = createCachePolicy({
    maxEntries: maxProjects,
    ttlMs,
    now,
    onEvict: ({ value }) => {
      if (Array.isArray(value)) {
        onInvalidate(value);
      }
    }
  });

  return {
    async get(projectId) {
      const cachedSections = cache.get(projectId);

      if (cachedSections !== undefined) {
        return cachedSections;
      }

      const sections = await loadSections(String(projectId ?? ''));
      cache.set(projectId, sections);
      return sections;
    },

    invalidateProject(projectId) {
      cache.invalidate(projectId);
    },

    clear() {
      cache.clear();
    },

    snapshot() {
      return {
        type: 'sections',
        ...cache.snapshot()
      };
    }
  };
}