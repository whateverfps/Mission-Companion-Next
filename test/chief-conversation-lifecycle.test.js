import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window ??= { dispatchEvent() {} };
globalThis.CustomEvent ??= class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.localStorage ??= {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
  clear() {}
};

const { engine, resolveActiveConversationTarget } = await import('../src/engine.js');

test('Chief conversation lifecycle resolves a fallback conversation and accepts the first message without a stale id', async () => {
  const fallback = resolveActiveConversationTarget([
    { conversationId: 'conversation-a', messages: [{ id: 'm1', content: 'Existing thread' }] },
    { conversationId: 'conversation-b', messages: [] }
  ], 'missing-conversation-id');
  assert.equal(fallback?.conversationId, 'conversation-a');

  engine.saveSettings({ mode: 'assisted' });
  const created = engine.createConversation({ projectId: engine.state().activeProject });
  assert.equal(engine.state().settings.mode, 'offline');
  const appended = engine.appendConversationMessage({ role: 'user', content: 'Lifecycle probe message' }, 'missing-conversation-id');
  assert.equal(appended.content, 'Lifecycle probe message');
  assert.equal(engine.activeConversation()?.conversationId, created.conversationId);
  assert.ok(engine.activeConversation()?.messages.some(message => message.content === 'Lifecycle probe message'));
  engine.appendConversationMessage({ role: 'assistant', content: 'Lifecycle probe reply' });
  assert.ok(engine.activeConversation()?.messages.some(message => message.content === 'Lifecycle probe reply'));

  engine.appendConversationMessage({ role: 'assistant', mode: 'assisted', content: 'Legacy assisted reply' }, created.conversationId);
  const nextConversation = engine.createConversation({ projectId: engine.state().activeProject });
  assert.equal(engine.state().settings.mode, 'offline');
  assert.notEqual(nextConversation.conversationId, created.conversationId);
  assert.equal(engine.activeConversation()?.conversationId, nextConversation.conversationId);
  assert.equal(engine.activeConversation()?.messages.length, 0);

  engine.activateConversation(created.conversationId);
  assert.equal(engine.state().settings.mode, 'assisted');
});
