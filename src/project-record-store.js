import { loadStructuredRecords, saveStructuredRecords } from './structured-records.js';

export async function loadAuthoritativeProjectRecords({ engine, projectId = '' } = {}) {
  const persisted = await engine?.projectRecords?.(projectId).catch?.(() => []) || [];
  if (persisted.length) return persisted;
  const legacy = loadStructuredRecords(projectId);
  if (legacy.length && engine?.saveProjectRecords) await engine.saveProjectRecords(legacy);
  return legacy;
}

export async function saveAuthoritativeProjectRecords({ engine, records = [] } = {}) {
  if (engine?.saveProjectRecords) return engine.saveProjectRecords(records);
  return saveStructuredRecords(records);
}
