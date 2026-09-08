import { createIdentifier } from './identifiers.js';

export function createImportQueueItem(file, libraryId) {
  return {
    id: createIdentifier(),
    file,
    name: file.name,
    size: file.size,
    libraryId,
    status: 'waiting',
    stage: 'queued',
    detail: 'Queued',
    technicalDetail: ''
  };
}

export function completeImportQueueItem(
  queueItem,
  detail = 'Indexed and verified'
) {
  return {
    ...queueItem,
    status: 'complete',
    stage: 'ready',
    detail,
    duplicate: null,
    technicalDetail: ''
  };
}

export function failImportQueueItem(
  queueItem,
  detail,
  technicalDetail
) {
  return {
    ...queueItem,
    status: 'error',
    stage: 'failed',
    detail,
    technicalDetail: String(technicalDetail || 'No technical details were provided.')
  };
}
