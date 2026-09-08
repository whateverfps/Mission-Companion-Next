const queryValue = (env, key) => {
  try {
    return new URL(env.location?.href || 'http://localhost/').searchParams.get(key);
  } catch {
    return null;
  }
};

export function resolveDrawingSafeMode(env = globalThis) {
  const query = queryValue(env, 'drawingSafeMode');
  const stored = env.localStorage?.getItem?.('drawingSafeMode') || '';
  const hosted = env.location?.hostname ? /(^|\.)github\.io$/i.test(env.location.hostname) : false;
  return query === '1' || stored === '1' || (hosted && query !== '0');
}

export const drawingSafeMode = resolveDrawingSafeMode();
