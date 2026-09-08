import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHeaderRow, extractWorkbookTables } from '../src/xlsx-structured-adapter.js';

test('XLSX adapter finds a header after leading report rows', () => { const result = detectHeaderRow([['Procore Export'], ['Generated', 'today'], ['Submittal Number', 'Spec Section', 'Status'], ['S-1', '28 23 00', 'Open']]); assert.deepEqual(result, { index: 2, score: 3 }); });
test('XLSX adapter preserves sheet, header, and row provenance', () => { const tables = extractWorkbookTables({ SheetNames: ['Instructions', 'Submittals'], Sheets: { Instructions: { rows: [['Read me']] }, Submittals: { rows: [['Report'], ['Submittal Number', 'Status'], ['S-1', 'Open']] } } }); assert.equal(tables[0].status, 'not-structured'); assert.equal(tables[1].headerRow, 2); assert.equal(tables[1].records[0]._source.sheetName, 'Submittals'); assert.equal(tables[1].records[0]._source.rowNumber, 3); });
