import test from 'node:test';
import assert from 'node:assert/strict';
import {
  conversationPreview,
  defaultConversationTitle,
  isEmptyConversation,
  migrateLegacyChat,
  normalizeAttachmentDocumentIds,
  normalizeConversation,
  renameConversation,
  selectActiveConversation,
  sortConversations,
  stableConversationId
} from '../src/conversations.js';

test('conversation normalization is deterministic and preserves messages', () => {
  const input = { projectId: 'p1', createdAt: '2026-01-01T00:00:00Z', messages: [{ role: 'user', content: 'Question' }] };
  assert.deepEqual(normalizeConversation(input), normalizeConversation(input));
  assert.equal(normalizeConversation(input).messages[0].content, 'Question');
});

test('stable IDs use their seed and legacy migration does not duplicate', () => {
  assert.equal(stableConversationId('same'), stableConversationId('same'));
  const migrated = migrateLegacyChat({ chat: [{ id: 'm1', role: 'user', content: 'Legacy question' }], projectId: 'p1' });
  assert.equal(migrated.conversations.length, 1);
  const repeated = migrateLegacyChat({ chat: [{ id: 'm1', role: 'user', content: 'Legacy question' }], conversations: migrated.conversations, activeConversationId: migrated.activeConversationId });
  assert.equal(repeated.conversations.length, 1);
  assert.equal(repeated.migrated, false);
});

test('titles, rename, and previews are bounded and readable', () => {
  const messages = [{ role: 'user', content: 'A detailed question about project firestopping requirements and inspection records' }];
  assert.match(defaultConversationTitle(messages), /…$/);
  const conversation = normalizeConversation({ conversationId: 'c1', messages, createdAt: '2026-01-01' });
  assert.equal(renameConversation(conversation, 'Firestopping review').title, 'Firestopping review');
  assert.match(conversationPreview(conversation), /firestopping/i);
  assert.throws(() => renameConversation(conversation, '   '), /name/i);
});

test('project association and attachment references normalize exactly', () => {
  const conversation = normalizeConversation({ conversationId: 'c1', projectId: 'p1', attachmentDocumentIds: ['d2', 'd1', 'd2', ''] });
  assert.equal(conversation.projectId, 'p1');
  assert.deepEqual(conversation.attachmentDocumentIds, ['d1', 'd2']);
  assert.deepEqual(normalizeAttachmentDocumentIds('d1'), []);
});

test('conversation ordering and active selection are deterministic', () => {
  const conversations = [
    { conversationId: 'b', updatedAt: '2026-01-01', messages: [] },
    { conversationId: 'a', updatedAt: '2026-02-01', messages: [] }
  ];
  assert.deepEqual(sortConversations(conversations).map(item => item.conversationId), ['a', 'b']);
  assert.equal(selectActiveConversation(conversations, 'b').conversationId, 'b');
  assert.equal(selectActiveConversation(conversations, 'missing').conversationId, 'b');
});

test('blank conversation behavior includes attachments', () => {
  assert.equal(isEmptyConversation(null), true);
  assert.equal(isEmptyConversation(normalizeConversation({ conversationId: 'blank' })), true);
  assert.equal(isEmptyConversation(normalizeConversation({ conversationId: 'attached', attachmentDocumentIds: ['d1'] })), false);
});
