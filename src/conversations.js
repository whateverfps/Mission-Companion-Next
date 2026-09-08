const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function stableConversationId(seed = '') {
  return `conversation-${hash(text(seed) || 'blank')}`;
}

export function normalizeAttachmentDocumentIds(value) {
  return [...new Set(list(value).map(text).filter(Boolean))].sort();
}

export function normalizeConversationMessage(message = {}, index = 0) {
  const role = message.role === 'assistant' ? 'assistant' : 'user';
  const content = String(message.content ?? '');
  return {
    ...message,
    id: text(message.id) || `message-${hash(`${role}:${index}:${content}:${text(message.createdAt)}`)}`,
    role,
    content,
    createdAt: text(message.createdAt) || '',
    ...(Array.isArray(message.hits) ? { hits: structuredClone(message.hits) } : {}),
    ...(Array.isArray(message.citations) ? { citations: structuredClone(message.citations) } : {})
  };
}

export function defaultConversationTitle(messages = []) {
  const firstUser = list(messages).find(message => message?.role === 'user' && text(message.content));
  if (!firstUser) return 'New conversation';
  const title = text(firstUser.content).replace(/\s+/g, ' ');
  return title.length > 52 ? `${title.slice(0, 49).trimEnd()}…` : title;
}

export function conversationPreview(conversation = {}) {
  const message = [...list(conversation.messages)].reverse().find(item => text(item?.content));
  if (!message) return 'No messages yet';
  const preview = text(message.content).replace(/\s+/g, ' ');
  return preview.length > 88 ? `${preview.slice(0, 85).trimEnd()}…` : preview;
}

export function normalizeConversation(conversation = {}, options = {}) {
  const messages = list(conversation.messages).map(normalizeConversationMessage);
  const createdAt = text(conversation.createdAt) || text(options.now) || '';
  const updatedAt = text(conversation.updatedAt) || [...messages].reverse().find(item => item.createdAt)?.createdAt || createdAt;
  const seed = conversation.conversationId || `${text(conversation.projectId)}:${createdAt}:${messages.map(item => item.id).join(':')}`;
  return {
    conversationId: text(conversation.conversationId) || stableConversationId(seed),
    title: text(conversation.title) || defaultConversationTitle(messages),
    projectId: text(conversation.projectId),
    createdAt,
    updatedAt,
    messages,
    attachmentDocumentIds: normalizeAttachmentDocumentIds(conversation.attachmentDocumentIds)
  };
}

export function migrateLegacyChat({ chat = [], conversations = [], activeConversationId = '', projectId = '', now = '' } = {}) {
  const normalized = list(conversations).map(item => normalizeConversation(item, { now }));
  if (normalized.length) {
    const active = normalized.some(item => item.conversationId === activeConversationId)
      ? activeConversationId
      : normalized[0].conversationId;
    return { conversations: normalized, activeConversationId: active, migrated: false };
  }
  const messages = list(chat).map(normalizeConversationMessage);
  if (!messages.length) return { conversations: [], activeConversationId: '', migrated: false };
  const firstTimestamp = messages.find(item => item.createdAt)?.createdAt || now;
  const conversation = normalizeConversation({
    conversationId: stableConversationId(`legacy:${projectId}:${messages.map(item => item.id).join(':')}`),
    projectId,
    createdAt: firstTimestamp,
    updatedAt: [...messages].reverse().find(item => item.createdAt)?.createdAt || firstTimestamp,
    messages
  }, { now });
  return { conversations: [conversation], activeConversationId: conversation.conversationId, migrated: true };
}

export function sortConversations(conversations = []) {
  return list(conversations).map(normalizeConversation).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt) || a.conversationId.localeCompare(b.conversationId)
  );
}

export function selectActiveConversation(conversations = [], activeConversationId = '') {
  const normalized = list(conversations).map(normalizeConversation);
  return normalized.find(item => item.conversationId === activeConversationId) || normalized[0] || null;
}

export function isEmptyConversation(conversation) {
  return !conversation || (!list(conversation.messages).length && !normalizeAttachmentDocumentIds(conversation.attachmentDocumentIds).length);
}

export function renameConversation(conversation, title, now = '') {
  const normalized = normalizeConversation(conversation, { now });
  const cleaned = text(title);
  if (!cleaned) throw new Error('Enter a conversation name.');
  return { ...normalized, title: cleaned, updatedAt: text(now) || normalized.updatedAt };
}
