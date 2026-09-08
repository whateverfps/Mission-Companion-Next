import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeChiefResponseMode, resolveChiefResponseModeSelection, missionControlResponseModeLabel, missionControlVisibleResponseMode } from '../src/chief-response-mode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

test('Mission Control response modes normalize to canonical engine values', () => {
  assert.equal(normalizeChiefResponseMode('offline'), 'offline');
  assert.equal(normalizeChiefResponseMode('source'), 'source');
  assert.equal(normalizeChiefResponseMode('assisted'), 'assisted');
  assert.equal(normalizeChiefResponseMode('general'), 'general');
  assert.equal(normalizeChiefResponseMode('expert-assisted-ai'), 'assisted');
  assert.equal(normalizeChiefResponseMode('source-only-evidence'), 'offline');
});

test('Mission Control response mode selection maps UI labels to engine modes', () => {
  const offline = resolveChiefResponseModeSelection({ selectedOptionText: 'Source Evidence', selectedOptionValue: 'offline', uiStateMode: 'offline' });
  const assisted = resolveChiefResponseModeSelection({ selectedOptionText: 'Chief Analysis', selectedOptionValue: 'assisted', uiStateMode: 'offline' });
  const fallback = resolveChiefResponseModeSelection({ selectedOptionText: '', selectedOptionValue: '', uiStateMode: '' });

  assert.deepEqual(offline, {
    selectedOptionText: 'Source Evidence',
    selectedOptionValue: 'offline',
    uiStateMode: 'offline',
    normalizedMode: 'offline',
    modePassedToEngine: 'offline'
  });
  assert.deepEqual(fallback, {
    selectedOptionText: '',
    selectedOptionValue: '',
    uiStateMode: 'offline',
    normalizedMode: 'offline',
    modePassedToEngine: 'offline'
  });
  assert.equal(assisted.modePassedToEngine, 'assisted');
  assert.equal(missionControlVisibleResponseMode('source'), 'assisted');
  assert.equal(missionControlVisibleResponseMode('general'), 'assisted');
});

test('Mission Control labels remain stable for each engine mode', () => {
  assert.equal(missionControlResponseModeLabel('offline'), 'Source Evidence');
  assert.equal(missionControlResponseModeLabel('source'), 'Chief Analysis');
  assert.equal(missionControlResponseModeLabel('assisted'), 'Chief Analysis');
  assert.equal(missionControlResponseModeLabel('general'), 'Chief Analysis');
});

test('Chief UI exposes exactly two response-mode choices', () => {
  const appSource = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const selectorMatch = appSource.match(/<label class="mc-control-mode">Response mode <select id="missionControlMode">([\s\S]*?)<\/select><\/label>/);
  assert.ok(selectorMatch, 'expected the Chief response-mode selector markup');
  const options = [...selectorMatch[1].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map(match => ({ value: match[1], label: match[2] }));
  assert.deepEqual(options, [
    { value: 'offline', label: 'Source Evidence' },
    { value: 'assisted', label: 'Chief Analysis' }
  ]);
  assert.equal(appSource.includes('Source-only AI'), false);
  assert.equal(appSource.includes('General assistant AI'), false);
});
