import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const report = await readFile(new URL('../project-documents/bedford/PMIS/js/reports-center.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../project-documents/bedford/PMIS/index.html', import.meta.url), 'utf8');

test('Reports Center exposes schedule and submittal review views', () => {
  assert.match(index, /setReportType\('schedule_review'\)/);
  assert.match(index, /setReportType\('submittal_review'\)/);
  assert.match(report, /Interim Schedule Submitted \/ Under Review/);
  assert.match(report, /not the approved project baseline/);
});

test('project controls report reads the existing runtime register', () => {
  assert.match(report, /function reportRegister\(\)\{return Array\.isArray\(data\.projectRegister\)/);
  assert.doesNotMatch(report, /SUB-\d+.*SUB-\d+.*SUB-\d+/s);
  assert.match(report, /function pcRecords/);
  assert.match(report, /function pcSource/);
});

test('schedule review preserves source dates and B61/MCR filtering', () => {
  assert.match(report, /Planned Finish/);
  assert.match(report, /building\\s\*61/);
  assert.match(report, /\\bMCR\\b/);
  assert.match(report, /Not reported/);
});

test('submittal review includes required traceability fields without inventing values', () => {
  for (const field of ['Submittal ID', 'Specification Section', 'Requirement Text', 'Source Document', 'Related Schedule Activity']) {
    assert.match(report, new RegExp(field.replaceAll(' ', '\\s+')));
  }
  assert.match(report, /Required Date.*Target Date.*Due Date/);
});
