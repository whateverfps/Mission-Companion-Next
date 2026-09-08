import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBedfordWorkspaceModel } from '../src/workspace-registry.js';
import { buildWorkspaceDocumentsModel } from '../src/workspace-documents.js';

function documentsFor(id) {
  const workspaceModel = buildBedfordWorkspaceModel(id);
  return buildWorkspaceDocumentsModel({
    workspace: workspaceModel.activeWorkspace,
    projectMilestoneContext: workspaceModel.projectMilestoneContext
  });
}

test('Workspace documents derive from the selected registry record', () => {
  const documents = documentsFor('B13');
  assert.equal(documents.workspaceId, 'B13');
  assert.equal(documents.counts.drawings, 4);
  assert.equal(documents.counts.specifications, 6);
  assert.equal(documents.counts.projectDocuments, 1);
  assert.equal(documents.counts.relatedEvidence, 0);
  assert.deepEqual(documents.categories.map(category => category.label), ['Drawings', 'Specifications', 'Contract / Project Documents', 'Related Evidence']);
  assert.equal(documents.categories[0].groups[0].items[0].sheetNumber, '61T-100');
  assert.equal(documents.categories[0].groups[1].items[0].sheetNumber, '61T-601');
  assert.equal(documents.categories[1].groups[0].items[0].sectionNumber, '27 10 00');
  assert.match(documents.categories[2].groups[0].items[0].title, /Notice to Proceed/i);
  assert.equal(documents.categories[2].groups[0].items[0].openTarget.documentId, 'bedford-ntp-notice-to-proceed');
});

test('Workspace documents change when the active workspace changes', () => {
  const b13 = documentsFor('B13');
  const b124 = documentsFor('124');
  const b226 = documentsFor('226');
  const b137 = documentsFor('137');
  assert.equal(b13.categories[0].groups[0].items[0].sheetNumber, '61T-100');
  assert.equal(b124.categories[0].groups[0].items[0].sheetNumber, '61T-101');
  assert.equal(b226.categories[0].groups[0].items[0].sheetNumber, '61T-102');
  assert.equal(b137.categories[0].groups[0].items[0].sheetNumber, '61T-402');
});

test('Workspace documents deduplicate repeated records and keep truthful empty categories hidden', () => {
  const repeated = buildWorkspaceDocumentsModel({
    workspace: {
      id: 'repeat',
      room: 'repeat',
      name: 'Repeated Documents',
      building: '61',
      level: 'Basement',
      disciplineFocus: 'Telecommunication / OIT',
      sourceSheets: [
        { sheetNumber: '61T-100', sheetTitle: 'TELECOMMUNICATION PLAN - BASEMENT LEVEL', discipline: 'Telecommunication', level: 'Basement', pdfPageNumber: 1, pageId: 'drawing-page:bedford-b61-drawings:1' },
        { sheetNumber: '61T-100', sheetTitle: 'TELECOMMUNICATION PLAN - BASEMENT LEVEL', discipline: 'Telecommunication', level: 'Basement', pdfPageNumber: 1, pageId: 'drawing-page:bedford-b61-drawings:1' }
      ],
      relatedSheets: [
        { sheetNumber: '61T-601', sheetTitle: 'TELECOMMUNICATION DETAILS', discipline: 'Telecommunication', level: 'Basement', pdfPageNumber: 2, pageId: 'drawing-page:bedford-b61-drawings:2' },
        { sheetNumber: '61T-601', sheetTitle: 'TELECOMMUNICATION DETAILS', discipline: 'Telecommunication', level: 'Basement', pdfPageNumber: 2, pageId: 'drawing-page:bedford-b61-drawings:2' }
      ],
      applicableSpecifications: [
        { sectionNumber: '27 10 00', sectionTitle: 'INFORMATION TRANSPORT INFRASTRUCTURE' },
        { sectionNumber: '27 10 00', sectionTitle: 'INFORMATION TRANSPORT INFRASTRUCTURE' }
      ],
      sourceEvidence: [
        { kind: 'source-sheet', sheetNumber: '61T-100', sheetTitle: 'TELECOMMUNICATION PLAN - BASEMENT LEVEL' }
      ]
    },
    projectMilestoneContext: null
  });
  assert.equal(repeated.counts.drawings, 2);
  assert.equal(repeated.counts.specifications, 1);
  assert.equal(repeated.counts.relatedEvidence, 0);
  const related = repeated.categories.find(category => category.id === 'related-evidence');
  assert.ok(related);
  assert.deepEqual(related.groups, []);
  assert.match(related.emptyState, /No related evidence has been linked to this Workspace/);
});
