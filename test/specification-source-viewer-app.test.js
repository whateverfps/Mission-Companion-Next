import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('source view opens the shell before async lookup and ignores stale requests', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /host\.innerHTML = `<header class="source-title">/);
  assert.match(app, /Loading source page/);
  assert.match(app, /const requestId = \+\+specificationSourceRequestId;/);
  assert.match(app, /if \(requestId !== specificationSourceRequestId\) return;/);
  assert.match(app, /stageMetric\('shell-visible'\)/);
  assert.match(app, /stageMetric\('page-rendered'/);
});