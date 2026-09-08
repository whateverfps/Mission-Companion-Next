export const COMPACT_STATE_KEY = 'mc-master-state-v2';
export const COMPACT_STATE_MAX_BYTES = 128 * 1024;

const bytes = value => new TextEncoder().encode(String(value || '')).byteLength;
const text = value => String(value ?? '').trim();

export function compactApplicationState(state = {}) {
  const settings = state.settings || {};
  return {
    compactStateVersion: 1,
    settings: {
      openaiUrl: text(settings.openaiUrl), openaiModel: text(settings.openaiModel), openaiKey: text(settings.openaiKey),
      timeout: Number(settings.timeout) || 180000, mode: text(settings.mode) || 'offline', topK: Number(settings.topK) || 10,
      startupExperience: text(settings.startupExperience) || 'mission-control'
    },
    projects: (Array.isArray(state.projects) ? state.projects : []).map(item => ({ id: text(item.id), name: text(item.name) })).filter(item => item.id),
    activeProject: text(state.activeProject),
    libraries: (Array.isArray(state.libraries) ? state.libraries : []).map(item => ({ id: text(item.id), projectId: text(item.projectId), name: text(item.name), description: text(item.description), enabled: item.enabled !== false, createdAt: text(item.createdAt), updatedAt: text(item.updatedAt) })).filter(item => item.id && item.projectId),
    activeLibrary: text(state.activeLibrary),
    activeConversationId: text(state.activeConversationId),
    largeStatePointer: 'indexeddb:application-large-state'
  };
}

export function serializeCompactState(state = {}) {
  const value = compactApplicationState(state);
  const serialized = JSON.stringify(value);
  return { value, serialized, bytes: bytes(serialized), withinLimit: bytes(serialized) <= COMPACT_STATE_MAX_BYTES };
}

export function legacyLargeState(stored = {}) {
  return {
    conversations: Array.isArray(stored.conversations) ? stored.conversations : [],
    evaluations: Array.isArray(stored.evaluations) ? stored.evaluations : [],
    chat: Array.isArray(stored.chat) ? stored.chat : []
  };
}

export function safeWriteCompactState(storage, state, { key = COMPACT_STATE_KEY, onFailure = () => {} } = {}) {
  const payload = serializeCompactState(state);
  if (!payload.withinLimit) {
    const result = { ok: false, reason: 'compact-state-size-limit', bytes: payload.bytes, limit: COMPACT_STATE_MAX_BYTES };
    onFailure(result); return result;
  }
  try {
    storage?.setItem?.(key, payload.serialized);
    return { ok: true, bytes: payload.bytes, limit: COMPACT_STATE_MAX_BYTES };
  } catch (error) {
    const result = { ok: false, reason: error?.name === 'QuotaExceededError' ? 'quota-exceeded' : 'storage-write-failed', bytes: payload.bytes, limit: COMPACT_STATE_MAX_BYTES, message: error?.message || String(error) };
    onFailure(result); return result;
  }
}

export function compactStateCategorySizes(state = {}) {
  const size = value => bytes(JSON.stringify(value ?? null));
  return {
    settings: size(state.settings), projects: size(state.projects), libraries: size(state.libraries),
    conversations: size(state.conversations), evaluations: size(state.evaluations), chat: size(state.chat),
    compact: serializeCompactState(state).bytes
  };
}
