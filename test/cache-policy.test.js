import test from 'node:test';
import assert from 'node:assert/strict';

import { createCachePolicy } from '../src/cache/cache-policy.js';
import { createProjectDocumentCache } from '../src/cache/project-document-cache.js';
import { createProjectSectionCache } from '../src/cache/project-section-cache.js';

test('cache policy evicts the least recently used entry', () => {
  let now = 0;
  const evicted = [];
  const cache = createCachePolicy({
    maxEntries: 2,
    now: () => now,
    onEvict: entry => evicted.push(entry)
  });

  cache.set('a', 'alpha');
  now += 1;
  cache.set('b', 'bravo');
  now += 1;
  assert.equal(cache.get('a'), 'alpha');
  now += 1;
  cache.set('c', 'charlie');

  assert.equal(cache.has('b'), false);
  assert.equal(cache.snapshot().size, 2);
  assert.equal(evicted.at(-1).key, 'b');
});

test('cache policy expires stale entries on access', () => {
  let now = 0;
  const evicted = [];
  const cache = createCachePolicy({
    maxEntries: 2,
    ttlMs: 10,
    now: () => now,
    onEvict: entry => evicted.push(entry)
  });

  cache.set('a', 'alpha');
  now = 11;

  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.snapshot().staleEvictions, 1);
  assert.equal(evicted[0].reason, 'stale');
});

test('project document cache reuses loaded entries until invalidated', async () => {
  let loads = 0;
  const cache = createProjectDocumentCache({
    loadDocuments: async projectId => {
      loads += 1;
      return [{ id: `${projectId}-document`, projectId }];
    }
  });

  const first = await cache.get('alpha');
  const second = await cache.get('alpha');

  assert.strictEqual(second, first);
  assert.equal(loads, 1);

  cache.invalidateProject('alpha');

  const third = await cache.get('alpha');
  assert.equal(loads, 2);
  assert.notStrictEqual(third, first);
});

test('project section cache evicts old projects and clears retrieval state', async () => {
  let loads = 0;
  const invalidated = [];
  const cache = createProjectSectionCache({
    maxProjects: 2,
    loadSections: async projectId => {
      loads += 1;
      return [{ id: `${projectId}-section`, projectId, text: 'alpha' }];
    },
    onInvalidate: sections => invalidated.push(sections.map(section => section.id).join(','))
  });

  await cache.get('alpha');
  await cache.get('beta');
  await cache.get('alpha');
  await cache.get('gamma');

  assert.equal(loads, 3);
  assert.ok(invalidated.includes('beta-section'));

  cache.invalidateProject('alpha');

  assert.ok(invalidated.includes('alpha-section'));
});