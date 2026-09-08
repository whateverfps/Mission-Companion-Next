import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSPECTION_RESULTS,
  INSPECTION_STATUSES,
  inspectionContextSeed,
  nextInspectionNumber,
  normalizeInspectionRecord,
  validateInspectionRecord,
  validateStatusTransition
} from '../src/inspection-records.js';
import { createDemonstrationProjectFixture } from '../src/demo-project.js';
import { createEngineeringContext } from '../src/engineering-context.js';
import { createContextBusSnapshot } from '../src/context-bus.js';

const base = {
  inspectionId: 'inspection-1', projectId: 'project-1', inspectionNumber: 'INS-001',
  title: 'Above-ceiling inspection', inspectionDate: '2026-07-31', status: 'Draft', result: 'Not Evaluated'
};

test('normalizes the approved shape and deterministic references', () => {
  const record = normalizeInspectionRecord({ ...base, sourceDocumentIds: ['b','a','a',''], evidenceReferences: [{ documentId: 'b', sectionId: '2' }, { documentId: 'b', sectionId: '2' }] });
  assert.deepEqual(record.sourceDocumentIds, ['a','b']);
  assert.deepEqual(record.evidenceReferences, [{ documentId: 'b', sectionId: '2' }]);
  assert.equal(record.correctiveActionRequired, false);
});

test('validates required fields, statuses, results, dates, and closing requirements', () => {
  assert.equal(validateInspectionRecord(base, { projectIds: ['project-1'] }).valid, true);
  for (const status of INSPECTION_STATUSES) assert.equal(validateInspectionRecord({ ...base, status, result: status === 'Closed' ? 'Acceptable' : 'Not Evaluated' }).valid, true);
  for (const result of INSPECTION_RESULTS) assert.equal(validateInspectionRecord({ ...base, result }).valid, true);
  assert.equal(validateInspectionRecord({ ...base, title: '' }).valid, false);
  assert.equal(validateInspectionRecord({ ...base, inspectionDate: 'not-a-date' }).valid, false);
  assert.equal(validateInspectionRecord({ ...base, status: 'Closed' }).valid, false);
  assert.equal(validateInspectionRecord({ ...base, status: 'Invented' }).valid, false);
  assert.equal(validateInspectionRecord({ ...base, result: 'Invented' }).valid, false);
  assert.equal(validateInspectionRecord({ ...base, workflowTemplateId: 'Invented Workflow' }).valid, false);
});

test('rejects duplicate IDs, project-local numbers, and invalid ownership', () => {
  assert.equal(validateInspectionRecord({ ...base, inspectionId: 'new' }, { projectIds: ['project-1'], existingRecords: [base] }).valid, false);
  assert.equal(validateInspectionRecord({ ...base, projectId: 'other' }, { projectIds: ['project-1'] }).valid, false);
});

test('numbering follows the highest imported or archived number without reuse', () => {
  assert.equal(nextInspectionNumber([{ ...base, inspectionNumber: 'INS-002' }, { ...base, inspectionId: 'archived', inspectionNumber: 'INS-009', archivedAt: 'now' }], 'project-1'), 'INS-010');
  assert.equal(nextInspectionNumber([], 'project-1'), 'INS-001');
});

test('terminal transitions require an explicit reopen action', () => {
  assert.equal(validateStatusTransition('Closed', 'In Progress').valid, false);
  assert.equal(validateStatusTransition('Closed', 'In Progress', { reopen: true }).valid, true);
  assert.equal(validateStatusTransition('Complete', 'Closed').valid, true);
  assert.equal(validateStatusTransition('Draft', 'In Progress', { reopen: true }).valid, false);
});

test('context seed prefers exact source section then document then related source', () => {
  const documents = [
    { id: 'doc-1', projectId: 'project-1', libraryId: 'library-1' },
    { id: 'drawing-1', projectId: 'project-1', libraryId: 'library-1' }
  ];
  const sections = [{ id: 'section-1', documentId: 'doc-1', projectId: 'project-1' }];
  assert.deepEqual(inspectionContextSeed({ ...base, sourceSectionIds: ['section-1'], sourceDocumentIds: ['doc-1'] }, { documents, sections }), { projectId: 'project-1', libraryId: 'library-1', documentId: 'doc-1', sectionId: 'section-1' });
  assert.deepEqual(inspectionContextSeed({ ...base, sourceDocumentIds: ['doc-1'] }, { documents, sections }), { projectId: 'project-1', libraryId: 'library-1', documentId: 'doc-1', sectionId: '' });
  assert.deepEqual(inspectionContextSeed({ ...base, relatedDrawingIds: ['drawing-1'] }, { documents, sections }), { projectId: 'project-1', libraryId: 'library-1', documentId: 'drawing-1', sectionId: '' });
  assert.equal(inspectionContextSeed({ ...base, sourceDocumentIds: ['missing'] }, { documents, sections }), null);
});

test('ambiguous exact records never produce a context seed', () => {
  const duplicate = { id: 'doc-1', projectId: 'project-1', libraryId: 'library-1' };
  assert.equal(inspectionContextSeed({ ...base, sourceDocumentIds: ['doc-1'] }, { documents: [duplicate, { ...duplicate }], sections: [] }), null);
});

test('demonstration fixture seeds five valid first-class records without replacing source documents', () => {
  const fixture = createDemonstrationProjectFixture();
  assert.equal(fixture.inspectionRecords.length, 5);
  for (const record of fixture.inspectionRecords) {
    assert.equal(validateInspectionRecord(record, { projectIds: [fixture.manifest.project.id], existingRecords: fixture.inspectionRecords, currentInspectionId: record.inspectionId }).valid, true);
    assert.ok(record.sourceDocumentIds.every(id => fixture.documents.some(document => document.id === id && document.type === 'inspection')));
  }
});

test('an exact Inspection Record seed synchronizes the existing Context Bus', () => {
  const projects = [{ id: 'project-1' }];
  const documents = [{ id: 'doc-1', projectId: 'project-1', libraryId: 'library-1', type: 'drawing' }];
  const sections = [{ id: 'section-1', documentId: 'doc-1', projectId: 'project-1', libraryId: 'library-1', text: 'Stored source.' }];
  const seed = inspectionContextSeed({ ...base, sourceSectionIds: ['section-1'] }, { documents, sections });
  const context = createEngineeringContext({ ...seed, projects, documents, sections });
  const snapshot = createContextBusSnapshot({ engineeringContext: context, activation: { source: 'Inspection Record' }, documents });
  assert.equal(snapshot.active, true);
  assert.equal(snapshot.context.activationSource, 'Inspection Record');
});
