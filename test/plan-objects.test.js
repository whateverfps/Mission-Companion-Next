import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanObject, planObjectReport } from '../src/plan-objects.js';

const occurrence = { occurrenceId: 'o1', documentId: 'd', drawingSetId: 'set', sheetId: 's', pageNumber: 2, region: { x: .1, y: .2, width: .02, height: .02 }, nearbyText: 'CU-1', verification: { status: 'Unreviewed' }, limitations: [] };

test('creates candidate plan objects with exact provenance and no unsupported quantity', () => {
  const object = createPlanObject({ occurrence, legendEntry: { legendEntryId: 'l1', label: 'CONDENSING UNIT' }, scheduleMatch: { scheduleId: 'sch', rowId: 'r1' }, keyedNote: { keyedNoteId: 'k1' }, referenceIds: ['ref'] , roomAssociation: { room: '137', method: 'proximity' } });
  assert.equal(object.kind, 'Candidate occurrence');
  assert.equal(object.scheduleRowId, 'r1');
  assert.equal(object.roomAssociation.status, 'Unverified');
  assert.equal(object.quantity, null);
  assert.ok(object.evidenceBasis.derivedLinkage.includes('l1'));
});

test('confirmed occurrences remain separate from expert interpretation', () => {
  const object = createPlanObject({ occurrence: { ...occurrence, verification: { status: 'Confirmed' } }, legendEntry: { legendEntryId: 'l1', label: 'CONDENSING UNIT' }, roomAssociation: { room: '137', method: 'manual-confirmed', status: 'Confirmed' } });
  const report = planObjectReport([object]);
  assert.equal(object.kind, 'CONDENSING UNIT');
  assert.equal(report.humanVerifiedFindings.length, 1);
  assert.deepEqual(report.expertInterpretation, []);
});
