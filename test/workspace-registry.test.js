import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBedfordWorkspaceModel,
  buildChiefInsight,
  getBedfordWorkspaceDefaultId,
  getBedfordWorkspaceRecord,
  listBedfordWorkspaceRecords
} from '../src/workspace-registry.js';
import {
  buildBedfordProjectMilestoneContext,
  BEDFORD_NTP_SOURCE_DOCUMENT
} from '../src/workspace-milestones.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const relationshipData = readJson('project-data/bedford/relationships/building-61-spec-links.json');
const relationshipDataMCR = readJson('project-data/bedford/relationships/building-MCR-spec-links.json');

function flattenRelationshipLinks(data) {
  return Object.entries(data.results || {}).flatMap(([sheetNumber, sheetData]) =>
    (Array.isArray(sheetData?.links) ? sheetData.links : []).map(link => ({
      ...link,
      sheetNumber,
      projectId: 'bedford'
    }))
  );
}

test('Bedford workspace registry exposes the plan-derived Building 61 records plus MCR', () => {
  const records = listBedfordWorkspaceRecords();
  assert.deepEqual(records.map(item => item.id), ['B13', '124', '226', '137', 'MCR']);
  assert.equal(getBedfordWorkspaceDefaultId(), 'B13');
});

test('Bedford workspace registry grounds each record in live B61 sheet metadata', () => {
  const b13 = getBedfordWorkspaceRecord('B13');
  assert.ok(b13);
  assert.equal(b13.building, '61');
  assert.equal(b13.room, 'B13');
  assert.equal(b13.sourceSheets[0].sheetNumber, '61T-100');
  assert.equal(b13.sourceSheets[0].sheetTitle, 'TELECOMMUNICATION PLAN - BASEMENT LEVEL');
  assert.match(b13.sourceSheets[0].pageId, /^drawing-page:bedford-b61-drawings:/);
  assert.equal(b13.applicableSpecifications[0].sectionNumber, '27 10 00');
  assert.match(b13.chiefInsight, /B13 is .*Primary Telecommunications Room for Telecommunication \/ OIT/i);
  assert.match(b13.chiefInsight, /2 source sheets/i);
  assert.match(b13.chiefInsight, /6 applicable specification sections/i);
});

test('Bedford workspace registry preserves the 137 transition room grounding', () => {
  const room137 = getBedfordWorkspaceRecord('137');
  assert.ok(room137);
  assert.equal(room137.sourceSheets[0].sheetNumber, '61T-402');
  assert.equal(room137.sourceSheets[0].sheetTitle, 'TELECOMMUNICATION ROOM 137- INVENTORY LIST');
  assert.equal(room137.sourceSheets[1].sheetNumber, '61T-501');
  assert.ok(room137.relatedRooms.includes('B13'));
  assert.ok(room137.applicableSpecifications.some(item => item.sectionNumber === '27 15 00'));
});

test('Bedford workspace registry follows the selected sheet when resolving applicable specifications', () => {
  const drawingLinks = flattenRelationshipLinks(relationshipData);
  const telecom = buildBedfordWorkspaceModel('B13', { selectedSheetNumber: '61T-100', drawingLinks }).activeWorkspace;
  const electrical = buildBedfordWorkspaceModel('B13', { selectedSheetNumber: '61E-100', drawingLinks: [null, ...drawingLinks] }).activeWorkspace;
  const mechanical = buildBedfordWorkspaceModel('B13', { selectedSheetNumber: '61M-101', drawingLinks }).activeWorkspace;
  const unmapped = buildBedfordWorkspaceModel('B13', { selectedSheetNumber: '61T-999', drawingLinks: [null] }).activeWorkspace;

  assert.deepEqual(telecom?.applicableSpecifications.map(item => item.sectionNumber), ['27 10 00', '27 05 11', '27 05 26', '27 05 33', '27 15 00', '28 23 00']);
  assert.equal(telecom?.applicableSpecifications[0]?.sheetNumber, '61T-100');
  assert.deepEqual(electrical?.applicableSpecifications.map(item => item.sectionNumber), ['26 26 00', '26 51 00', '26 56 00', '26 05 11', '26 24 16', '26 09 23', '26 27 26']);
  assert.equal(electrical?.applicableSpecifications[0]?.sheetNumber, '61E-100');
  assert.ok(mechanical?.applicableSpecifications.some(item => item.sectionNumber === '23 05 93'));
  assert.equal(mechanical?.applicableSpecifications[0]?.sheetNumber, '61M-101');
  assert.match(electrical?.chiefInsight || '', /7 applicable specification sections/i);
  assert.deepEqual(unmapped?.applicableSpecifications, []);
});

test('Bedford workspace model keeps the active record and returns all records', () => {
  const model = buildBedfordWorkspaceModel('226');
  assert.equal(model.activeWorkspaceId, '226');
  assert.equal(model.activeWorkspace?.room, '226');
  assert.equal(model.workspaces.length, 5);
  assert.deepEqual(model.workspaces.map(item => item.id), ['B13', '124', '226', '137', 'MCR']);
  assert.equal(model.projectMilestoneContext?.sourceDocument?.id, BEDFORD_NTP_SOURCE_DOCUMENT.id);
});

test('Bedford workspace registry exposes MCR as a first-class building workspace', () => {
  const mcr = getBedfordWorkspaceRecord('MCR');
  assert.ok(mcr);
  assert.equal(mcr.building, 'MCR');
  assert.equal(mcr.room, 'MCR');
  assert.equal(mcr.sourceSheets[0].sheetNumber, 'MCRG-000');
  assert.equal(mcr.sourceSheets[1].sheetNumber, 'MCRG-001');
  assert.ok(mcr.drawingCategories.some(category => category.label === 'General'));
  assert.ok(mcr.drawingCategories.some(category => category.label === 'Electrical'));
  assert.match(mcr.chiefInsight, /MCR is the New Main Computer Room building/i);
});

test('Bedford workspace chief insight is derived from the active record rather than canned prose', () => {
  const insight = buildChiefInsight({
    id: '137',
    room: '137',
    name: 'Existing / Transition Telecom-Computer Room',
    type: 'EXISTING_TRANSITION',
    level: 'First Level',
    disciplineFocus: 'Telecommunication / OIT',
    sourceSheets: ['61T-402', '61T-501'],
    relatedSheets: ['61T-100', '61T-101', '61T-102', '61T-601', '61T-701'],
    applicableSpecifications: [{ sectionNumber: '27 15 00', sectionTitle: 'COMMUNICATIONS HORIZONTAL CABLING' }],
    relatedRooms: ['B13', '124', '226'],
    pmisBuilding: 'Building 61'
  });
  assert.match(insight, /137 is .*Existing \/ Transition Telecom-Computer Room for Telecommunication \/ OIT/);
  assert.match(insight, /2 source sheets/i);
  assert.match(insight, /5 related sheets/i);
  assert.match(insight, /1 applicable specification section/i);
  assert.match(insight, /existing-transition room/i);
});

test('Bedford workspace registry resolves selected MCR sheets against the MCR relationship graph', () => {
  const drawingLinks = flattenRelationshipLinks(relationshipDataMCR);
  const mcr = buildBedfordWorkspaceModel('MCR', { selectedSheetNumber: 'MCRA-101', drawingLinks }).activeWorkspace;
  assert.ok(mcr);
  assert.equal(mcr.applicableSpecifications.length > 0, true);
  assert.ok(mcr.applicableSpecifications.some(item => item.sectionNumber === '06 10 00'));
  assert.equal(mcr.sourceSheets[0].pageId, 'drawing-page:bedford-mcr-drawings:1');
  assert.ok(mcr.drawingCategories.some(category => category.label === 'Architectural'));
});

test('Bedford project milestone context is deterministic and shared across workspace records', () => {
  const context = buildBedfordProjectMilestoneContext({ workspace: { id: '137', room: '137', building: '61' } });
  assert.equal(context.sourceDocument.id, BEDFORD_NTP_SOURCE_DOCUMENT.id);
  assert.equal(context.sourceType, 'NTP / Contractual');
  assert.equal(context.contractNumber, '518-22-700');
  assert.equal(context.ntpDate, '2026-08-13');
  assert.equal(context.contractCompletionDate, '2028-08-14');
  assert.equal(context.contractDurationCalendarDays, 730);
  assert.equal(context.projectPhase, 'Preconstruction');
  assert.equal(context.scheduleStatus, 'Awaiting Interim Schedule');
  assert.equal(context.roomScheduleStatus, 'Awaiting Contractor Schedule');
  assert.match(context.summary, /Notice to Proceed dated Aug 13, 2026/);
  assert.match(context.summary, /room-level construction dates remain awaiting contractor schedule/i);
  assert.deepEqual(context.milestones.map(item => item.id), [
    'ntp-issued',
    'insurance-certificate',
    'performance-payment-bonds',
    'quality-control-plan',
    'interim-project-schedule',
    'final-project-schedule',
    'accident-prevention-plan',
    'contract-completion'
  ]);
  assert.equal(context.milestones.find(item => item.id === 'quality-control-plan')?.dueDate, '2026-08-28');
  assert.equal(context.milestones.find(item => item.id === 'interim-project-schedule')?.dueDate, '2026-09-03');
  assert.equal(context.milestones.find(item => item.id === 'final-project-schedule')?.dueDate, '2026-09-28');
  assert.equal(context.milestones.find(item => item.id === 'accident-prevention-plan')?.status, 'pending-date');
  assert.equal(context.milestones.find(item => item.id === 'insurance-certificate')?.status, 'complete');
  assert.equal(context.milestones.find(item => item.id === 'performance-payment-bonds')?.status, 'complete');
  assert.ok(context.timeline.length >= 5);
  assert.ok(context.nextSteps.some(item => /COR coordination/i.test(item.label)));
  const model = buildBedfordWorkspaceModel('137');
  assert.equal(model.projectMilestoneContext.ntpDate, '2026-08-13');
  assert.equal(model.workspaces.every(record => !Object.prototype.hasOwnProperty.call(record, 'projectMilestones')), true);
});
