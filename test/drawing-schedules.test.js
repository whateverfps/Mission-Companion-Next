import test from 'node:test';
import assert from 'node:assert/strict';
import { extractScheduleCandidates, findScheduleRowsByTag, normalizeEquipmentTag } from '../src/drawing-schedules.js';

const sheet = { sheetId: 'schedule-sheet', pageNumber: 4, sheetTypes: ['Schedule'], textItems: [
  { text: 'MECHANICAL EQUIPMENT SCHEDULE', region: { x: .1, y: .1, width: .3, height: .02 } },
  { text: 'TAG', region: { x: .1, y: .16, width: .08, height: .02 } }, { text: 'CAPACITY', region: { x: .3, y: .16, width: .1, height: .02 } },
  { text: 'CU-1', region: { x: .1, y: .2, width: .08, height: .02 } }, { text: '24 MBH', region: { x: .3, y: .2, width: .1, height: .02 } }
] };

test('extracts bounded schedule rows with cell provenance and a tag column', () => {
  const schedule = extractScheduleCandidates({ documentId: 'd', drawingSetId: 'set', sheet })[0];
  assert.match(schedule.title, /SCHEDULE/);
  assert.ok(schedule.rows.some(row => row.cells.some(cell => cell.rawText === 'CU-1')));
  assert.ok(schedule.tagColumn);
  assert.ok(schedule.rows.flatMap(row => row.cells).every(cell => cell.sourceRegion));
});

test('links only exact normalized tags and reports duplicate ambiguity', () => {
  const schedule = extractScheduleCandidates({ documentId: 'd', drawingSetId: 'set', sheet })[0];
  assert.equal(normalizeEquipmentTag('cu 1'), 'CU-1');
  assert.equal(findScheduleRowsByTag([schedule], 'CU-1').status, 'exact');
  assert.equal(findScheduleRowsByTag([schedule], 'CU-2').status, 'unavailable');
  assert.equal(findScheduleRowsByTag([schedule, { ...schedule, scheduleId: 'second' }], 'CU-1').status, 'ambiguous');
});
