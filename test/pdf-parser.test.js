import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFiles, parsePdfFile } from '../src/parsers.js';

function pdfFile(name = 'drawings.pdf') {
  const blob = new Blob(['%PDF fixture'], { type: 'application/pdf' });
  Object.defineProperties(blob, { name: { value: name }, lastModified: { value: 123 } });
  return blob;
}

function pdfjs() {
  const pages = [
    { rotate: 0, getViewport: () => ({ width: 1000, height: 700, rotation: 0 }), getTextContent: async () => ({ items: [{ str: 'M-101', transform: [1,0,0,10,800,70], width: 60, height: 10 }, { str: 'MECHANICAL FLOOR PLAN', transform: [1,0,0,10,600,100], width: 250, height: 10 }] }), getAnnotations: async () => [] },
    { rotate: 90, getViewport: ({ rotation }) => rotation === 0 ? ({ width: 1000, height: 700, rotation: 0 }) : ({ width: 700, height: 1000, rotation: 90 }), getTextContent: async () => ({ items: [{ str: 'ROOM 137', transform: [1,0,0,10,300,500], width: 80, height: 10 }] }), getAnnotations: async () => [] }
  ];
  return { getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPage: async number => pages[number - 1], cleanup() {}, destroy() {} }) }) };
}

test('PDF parsing preserves page count, dimensions, rotation, positioned text, and plain text', async () => {
  const result = await parsePdfFile(pdfFile(), { pdfjs: pdfjs() });
  assert.equal(result.pageCount, 2);
  assert.deepEqual(result.pages.map(page => [page.width, page.height, page.rotation]), [[1000,700,0],[1000,700,90]]);
  assert.equal(result.pages[0].textItems[0].text, 'M-101');
  assert.match(result.text, /PAGE 1/);
  assert.match(result.text, /MECHANICAL FLOOR PLAN/);
});

test('parseFiles hands off one source Blob and one drawing analysis without changing sections', async () => {
  const result = await parseFiles([pdfFile()], 'p1', () => {}, 'l1', { pdfjs: pdfjs() });
  assert.equal(result.documents[0].pageCount, 2);
  assert.equal(result.documents[0].status, 'verified');
  assert.ok(result.sections.length > 0);
  assert.equal(result.sourceFiles.length, 1);
  assert.equal(result.sourceFiles[0].sourceBlob.type, 'application/pdf');
  assert.equal(result.drawingAnalyses.length, 1);
  assert.equal(result.drawingAnalyses[0].sheets.length, 2);
});

test('specification PDF retains its source and index without creating a drawing analysis', async () => {
  const file = pdfFile('518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  const result = await parseFiles([file], 'p1', () => {}, 'l1', { pdfjs: pdfjs() });
  assert.equal(result.documents[0].documentType, 'specifications');
  assert.equal(result.documents[0].pageCount, 2); assert.equal(result.sourceFiles.length, 1); assert.equal(result.drawingAnalyses.length, 0);
  assert.equal(result.documents[0].retrievalChunkCount, result.sections.length);
});

test('non-PDF parsing remains on the existing plain-text pathway', async () => {
  const file = { name: 'notes.txt', type: 'text/plain', size: 20, lastModified: 1, text: async () => '# Notes\nExisting text path.' };
  const result = await parseFiles([file], 'p1', () => {}, 'l1');
  assert.equal(result.documents[0].status, 'verified');
  assert.equal(result.sourceFiles.length, 0);
  assert.equal(result.drawingAnalyses.length, 0);
  assert.match(result.sections[0].text, /Existing text path/);
});

test('failed PDF parsing creates no source or drawing registration handoff', async () => {
  const result = await parseFiles([pdfFile()], 'p1', () => {}, 'l1', { pdfjs: { getDocument: () => ({ promise: Promise.reject(new Error('bad pdf')) }) } });
  assert.equal(result.documents[0].status, 'error');
  assert.equal(result.sourceFiles.length, 0);
  assert.equal(result.drawingAnalyses.length, 0);
});

test('page extraction failures release the PDF proxy before returning a failed record', async () => {
  let cleaned = false;
  let destroyed = false;
  const injected = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => { throw new Error('page failed'); }, cleanup: () => { cleaned = true; }, destroy: () => { destroyed = true; } }) }) };
  const result = await parseFiles([pdfFile()], 'p1', () => {}, 'l1', { pdfjs: injected });
  assert.equal(result.documents[0].status, 'error');
  assert.equal(cleaned, true);
  assert.equal(destroyed, true);
  assert.equal(result.sourceFiles.length, 0);
});
