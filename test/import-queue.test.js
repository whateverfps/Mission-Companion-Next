import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeImportQueueItem,
  createImportQueueItem,
  failImportQueueItem
} from '../src/import-queue.js';

const file = {
  name: 'requirements.docx',
  size: 42
};

test('queue item reaches a dismissible ready state after success', () => {
  const queued = createImportQueueItem(file, 'library-1');
  const completed = completeImportQueueItem(
    queued,
    'Indexed and verified (8 sections)'
  );

  assert.equal(queued.status, 'waiting');
  assert.equal(queued.stage, 'queued');
  assert.equal(completed.status, 'complete');
  assert.equal(completed.stage, 'ready');
  assert.match(completed.detail, /8 sections/);
  assert.equal(completed.file, file);
});

test('queue failure keeps a safe message, technical detail, and file reference for retry', () => {
  const queued = createImportQueueItem(file, 'library-1');
  const failed = failImportQueueItem(
    queued,
    'Mission Companion could not create the document record.',
    'TypeError: crypto.randomUUID is not a function'
  );

  assert.equal(failed.status, 'error');
  assert.equal(failed.stage, 'failed');
  assert.equal(
    failed.detail,
    'Mission Companion could not create the document record.'
  );
  assert.match(failed.technicalDetail, /randomUUID/);
  assert.equal(failed.file, file);
});
