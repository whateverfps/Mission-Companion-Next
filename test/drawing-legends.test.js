import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOccurrenceVerification, extractLegendCandidates, matchLegendOccurrences, normalizeSymbolPrimitive, symbolFingerprint } from '../src/drawing-legends.js';

const sheet = { documentId: 'd1', drawingSetId: 'set1', sheetId: 'legend', pageNumber: 1, discipline: 'Mechanical', sheetTypes: ['Symbols and Abbreviations'], textItems: [
  { text: 'MECHANICAL SYMBOL LEGEND', region: { x: .1, y: .1, width: .3, height: .02 } },
  { text: 'SUPPLY AIR DEVICE', region: { x: .2, y: .18, width: .2, height: .02 } }
] };
const primitive = { kind: 'path', bounds: { x: .14, y: .18, width: .03, height: .02 }, points: [{ x: .14, y: .18 }, { x: .17, y: .2 }], stroke: true };

test('extracts same-sheet legend rows without treating them as occurrences', () => {
  const legends = extractLegendCandidates({ documentId: 'd1', drawingSetId: 'set1', sheet, primitives: [primitive] });
  assert.equal(legends.length, 1);
  assert.equal(legends[0].entries[0].label, 'SUPPLY AIR DEVICE');
  assert.ok(legends[0].entries[0].symbolFingerprint);
  assert.equal('occurrences' in legends[0], false);
});

test('fingerprints normalize translation and scale and separate different geometry', () => {
  const moved = { ...primitive, bounds: { x: .4, y: .4, width: .06, height: .04 }, points: [{ x: .4, y: .4 }, { x: .46, y: .44 }] };
  assert.equal(symbolFingerprint([primitive]), symbolFingerprint([moved]));
  assert.notEqual(symbolFingerprint([primitive]), symbolFingerprint([{ ...primitive, points: [{ x: .14, y: .18 }, { x: .14, y: .2 }] }]));
  assert.equal(normalizeSymbolPrimitive(primitive).stroke, true);
});

test('candidate occurrences require same-set governance and human confirmation', () => {
  const legend = extractLegendCandidates({ documentId: 'd1', drawingSetId: 'set1', sheet, primitives: [primitive] })[0];
  const target = { documentId: 'd1', drawingSetId: 'set1', sheetId: 'plan', pageNumber: 2, discipline: 'Mechanical', extractionEligibility: { equipment: true } };
  const occurrences = matchLegendOccurrences({ legend, targetSheet: target, primitives: [primitive] });
  assert.equal(occurrences[0].verification.status, 'Unreviewed');
  assert.match(occurrences[0].limitations[0], /requires human verification/i);
  assert.equal(matchLegendOccurrences({ legend, targetSheet: { ...target, drawingSetId: 'other' }, primitives: [primitive] }).length, 0);
  assert.equal(applyOccurrenceVerification(occurrences[0], { status: 'Confirmed', verifiedAt: 'now' }).verification.status, 'Confirmed');
});
