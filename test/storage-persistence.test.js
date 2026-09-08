import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPACT_STATE_MAX_BYTES, compactApplicationState, compactStateCategorySizes, safeWriteCompactState, serializeCompactState } from '../src/compact-state.js';
import { loadDrawingWorkspaceProviders } from '../src/drawing-workspace-providers.js';

test('fresh compacted state defaults Mission Companion to offline source evidence', () => {
  const compact = compactApplicationState({});
  assert.equal(compact.settings.mode, 'offline');
});

const largeState = () => ({
  settings: { startupExperience: 'professional-workspace', mode: 'offline' },
  projects: [{ id: 'general', name: 'General' }], activeProject: 'general',
  libraries: [{ id: 'general-library', projectId: 'general', name: 'General' }], activeLibrary: 'general-library',
  activeConversationId: 'conversation-1',
  conversations: [{ conversationId: 'conversation-1', messages: Array.from({ length: 15000 }, (_, index) => ({ content: `Specification chunk ${index} ${'x'.repeat(200)}`, hits: [{ text: 'y'.repeat(300) }] })) }],
  evaluations: [{ expected: 'z'.repeat(500000) }]
});

test('compact state excludes large conversation, retrieval, and evaluation payloads', () => {
  const state = largeState(); const compact = compactApplicationState(state); const payload = serializeCompactState(state); const sizes = compactStateCategorySizes(state);
  assert.equal(Object.hasOwn(compact, 'conversations'), false); assert.equal(Object.hasOwn(compact, 'evaluations'), false); assert.equal(Object.hasOwn(compact, 'chat'), false);
  assert.equal(compact.activeProject, 'general'); assert.equal(compact.settings.startupExperience, 'professional-workspace');
  assert.equal(payload.withinLimit, true); assert.ok(payload.bytes < COMPACT_STATE_MAX_BYTES); assert.ok(sizes.conversations > payload.bytes * 100);
});

test('quota failures are contained without deleting or mutating in-memory project data', () => {
  const state = largeState(); const failures = []; const storage = { setItem() { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; } };
  const result = safeWriteCompactState(storage, state, { onFailure: failure => failures.push(failure) });
  assert.equal(result.ok, false); assert.equal(result.reason, 'quota-exceeded'); assert.equal(failures.length, 1);
  assert.equal(state.projects[0].id, 'general'); assert.equal(state.conversations[0].messages.length, 15000);
});

test('drawing provider branch receives sections explicitly and degrades honestly', async () => {
  const loaded = await loadDrawingWorkspaceProviders({ loadSections: async () => [{ id: 'spec-section' }] });
  assert.deepEqual(loaded, { documents: [], sections: [{ id: 'spec-section' }], warnings: [] });
  const failures = []; const unavailable = await loadDrawingWorkspaceProviders({ loadSections: async () => { throw new Error('provider failed'); }, onFailure: failure => failures.push(failure) });
  assert.deepEqual(unavailable.sections, []); assert.equal(unavailable.warnings.length, 1); assert.equal(failures[0].provider, 'specification-sections');
});
