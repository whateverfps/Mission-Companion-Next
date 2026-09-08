export function createCachePolicy({
  maxEntries = 2,
  ttlMs = 0,
  now = () => Date.now(),
  onEvict = () => {}
} = {}) {
  const capacity = Math.max(1, Number(maxEntries) || 1);
  const lifetimeMs = Math.max(0, Number(ttlMs) || 0);
  const entries = new Map();
  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let staleEvictions = 0;

  function keyOf(key) {
    return String(key ?? '');
  }

  function snapshot() {
    const currentTime = now();

    return {
      size: entries.size,
      maxEntries: capacity,
      ttlMs: lifetimeMs,
      hits,
      misses,
      evictions,
      staleEvictions,
      keys: [...entries.keys()].map(key => ({
        key,
        ageMs: Math.max(0, currentTime - (entries.get(key)?.accessedAt || currentTime))
      }))
    };
  }

  function evict(key, reason) {
    const entry = entries.get(key);

    if (!entry) {
      return undefined;
    }

    entries.delete(key);

    if (reason === 'stale') {
      staleEvictions += 1;
    } else {
      evictions += 1;
    }

    onEvict({
      key,
      value: entry.value,
      reason,
      snapshot: snapshot()
    });

    return entry.value;
  }

  function prune() {
    while (entries.size > capacity) {
      const oldestKey = entries.keys().next().value;
      evict(oldestKey, 'lru');
    }
  }

  function isStale(entry) {
    return lifetimeMs > 0 && now() >= entry.expiresAt;
  }

  function refresh(entry) {
    const currentTime = now();
    entry.accessedAt = currentTime;
    entry.expiresAt = lifetimeMs > 0 ? currentTime + lifetimeMs : Number.POSITIVE_INFINITY;
  }

  return {
    get(key) {
      const normalizedKey = keyOf(key);
      const entry = entries.get(normalizedKey);

      if (!entry) {
        misses += 1;
        return undefined;
      }

      if (isStale(entry)) {
        misses += 1;
        evict(normalizedKey, 'stale');
        return undefined;
      }

      hits += 1;
      entries.delete(normalizedKey);
      refresh(entry);
      entries.set(normalizedKey, entry);
      return entry.value;
    },

    set(key, value) {
      const normalizedKey = keyOf(key);

      if (entries.has(normalizedKey)) {
        entries.delete(normalizedKey);
      }

      const currentTime = now();
      entries.set(normalizedKey, {
        value,
        createdAt: currentTime,
        accessedAt: currentTime,
        expiresAt: lifetimeMs > 0 ? currentTime + lifetimeMs : Number.POSITIVE_INFINITY
      });
      prune();
      return value;
    },

    invalidate(key) {
      return evict(keyOf(key), 'manual');
    },

    clear() {
      for (const key of [...entries.keys()]) {
        evict(key, 'clear');
      }
    },

    has(key) {
      const normalizedKey = keyOf(key);
      const entry = entries.get(normalizedKey);

      if (!entry) {
        return false;
      }

      if (isStale(entry)) {
        evict(normalizedKey, 'stale');
        return false;
      }

      return true;
    },

    snapshot
  };
}