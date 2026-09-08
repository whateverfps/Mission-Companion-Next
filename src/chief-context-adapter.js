export function buildChiefContext({ projectId = 'bedford', surface = 'overview', workspaceId = '', documentId = '', drawingPageId = '' } = {}) {
  return { projectId, surface, workspaceId, documentId, drawingPageId, projectRecordId: activeProjectRecordId, promptPrefix: `Ask Chief about this ${surface}.` };
}

let activeProjectRecordId = '';
export function setActiveProjectRecordContext(recordId = '') { activeProjectRecordId = String(recordId || '').trim(); return activeProjectRecordId; }
export function getActiveProjectRecordContext() { return activeProjectRecordId; }
export function clearActiveProjectRecordContext() { activeProjectRecordId = ''; }
