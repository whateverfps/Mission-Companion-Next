export const DEMO_PROJECT_ID = 'mc-demo-vchc-renovation';
export const DEMO_PROJECT_NAME = 'Veterans Community Health Clinic Renovation';
export const DEMO_LIBRARY_IDS = Object.freeze({ design: 'mc-demo-lib-design', field: 'mc-demo-lib-field', turnover: 'mc-demo-lib-turnover' });
export const DEMO_INITIAL_DOCUMENT_ID = 'mc-demo-doc-rfi-002';
export const DEMO_INITIAL_SECTION_ID = 'mc-demo-sec-rfi-002';

export const DEMO_QUESTIONS = Object.freeze([
  'What inspection requirements apply to penetration firestopping under 07 84 13?',
  'How was RFI-002 Existing duct conflicts with new cable tray resolved?',
  'What evidence documents the cable tray conflict above Exam Room 112?',
  'What is required for Telecom Room TR-1 readiness?'
]);

const dates = Object.freeze({ importedAt: '2026-01-06T14:00:00.000Z', indexedAt: '2026-01-06T14:05:00.000Z', lastModified: '2026-01-05T17:00:00.000Z' });
const section = (id, documentId, libraryId, sectionNumber, title, text, crossReferenceIds = [], metadata = {}) => ({
  id, documentId, projectId: DEMO_PROJECT_ID, libraryId, sectionNumber, sectionTitle: title,
  title, heading: title, text, content: text, order: 1, level: 1, hierarchyLevel: 1,
  hierarchyType: 'section', path: [sectionNumber, title], parentId: null,
  crossReferenceIds, crossReferences: metadata.crossReferences || [], characterCount: text.length,
  metadata: { ...metadata, sectionNumber, sectionTitle: title, parent: null }
});
const document = (id, libraryId, name, category, type, sectionId, metadata = {}) => ({
  id, projectId: DEMO_PROJECT_ID, libraryId, name, originalFilename: `${name}.txt`, extension: 'txt',
  mimeType: 'text/plain', category, type, tags: [category, type], status: 'verified', sectionCount: 1,
  parser: 'demonstration fixture', hierarchyVersion: 'mc-hierarchy-v2', ...dates, ...metadata
});

const design = DEMO_LIBRARY_IDS.design;
const field = DEMO_LIBRARY_IDS.field;
const turnover = DEMO_LIBRARY_IDS.turnover;

const specs = [
  ['011000','01 10 00','Summary','Work occurs in an occupied outpatient clinic. Maintain safe access, coordinate phasing, and protect ongoing clinical operations.'],
  ['013100','01 31 00','Project Management and Coordination','Coordinate shutdowns, above-ceiling work, and owner access with documented notice and approved sequencing.'],
  ['013300','01 33 00','Submittal Procedures','Submit product data with specification references, deviations, and coordinated drawing impacts clearly identified.'],
  ['013526','01 35 26','Governmental Safety Requirements','Maintain controlled work areas, safe egress, and documented daily safety coordination.'],
  ['013533','01 35 33','Infection Control Procedures','Maintain barriers, negative pressure where required, and daily infection-control inspection records.'],
  ['014500','01 45 00','Quality Control','Verify preparatory, initial, and follow-up inspections against approved documents and record deficiencies.'],
  ['017700','01 77 00','Closeout Procedures','Provide testing records, training materials, as-built documents, and resolved deficiency records before turnover.'],
  ['078413','07 84 13','Penetration Firestopping','Use listed systems at rated penetrations. Inspect substrate, annular space, backing, sealant depth, and identification before concealment.'],
  ['095100','09 51 00','Acoustical Ceilings','Coordinate ceiling suspension, access panels, devices, and above-ceiling services before closing the grid.'],
  ['211313','21 13 13','Wet-Pipe Sprinkler Systems','Coordinate sprinkler piping and head locations with ceilings, lighting, ductwork, and access requirements.'],
  ['220500','22 05 00','Common Work Results for Plumbing','Coordinate shutdowns, valve identification, penetrations, access, testing, and restoration.'],
  ['230500','23 05 00','Common Work Results for HVAC','Maintain service clearances and coordinate ductwork with ceilings, cable tray, piping, and access panels.'],
  ['260500','26 05 00','Common Work Results for Electrical','Coordinate raceways, equipment clearances, grounding, labeling, testing, and rated penetrations.'],
  ['271000','27 10 00','Structured Cabling','Coordinate cable tray routing with mechanical services. Bond racks and tray, maintain bend radius, and provide certified test results.'],
  ['283100','28 31 00','Fire Detection and Alarm','Coordinate device locations and mounting heights with casework, ceilings, and accessibility requirements; complete pretesting.']
];

const documents = [];
const sections = [];
for (const [key, number, title, content] of specs) {
  const docId = `mc-demo-doc-spec-${key}`;
  const secId = `mc-demo-sec-spec-${key}`;
  documents.push(document(docId, design, `${number} — ${title}`, 'Specifications', 'specification', secId, { specificationNumber: number, division: number.slice(0, 2), discipline: 'General' }));
  sections.push(section(secId, docId, design, number, title, content));
}

const records = [
  ['drawing-g001',design,'G001 — Cover Sheet and Drawing Index','Drawings','drawing','G001','Cover Sheet and Drawing Index','Fictional drawing index for the clinic renovation design set.',['mc-demo-sec-drawing-a101'],{drawingNumber:'G001',discipline:'General'}],
  ['drawing-a101',design,'A101 — Renovation Floor Plan','Drawings','drawing','A101','Renovation Floor Plan','Renovation plan identifies Reception, Exam Wings A and B, Pharmacy, Corridor C-100, and support rooms.',['mc-demo-sec-drawing-a201-r2'],{drawingNumber:'A101',discipline:'Architectural'}],
  ['drawing-a201-r0',design,'A201 Revision 0 — Reflected Ceiling Plan','Drawings','drawing','A201','Reflected Ceiling Plan Revision 0','Original ceiling layout for Exam Wing A before above-ceiling coordination.',['mc-demo-sec-spec-095100'],{drawingNumber:'A201',revision:'0',lineageId:'mc-demo-lineage-a201',lineageStatus:'superseded',supersededByDocumentId:'mc-demo-doc-drawing-a201-r1',division:'09'}],
  ['drawing-a201-r1',design,'A201 Revision 1 — Reflected Ceiling Plan','Drawings','drawing','A201','Reflected Ceiling Plan Revision 1','Ceiling layout updated in Exam Wing A after initial coordination.',['mc-demo-sec-rfi-002'],{drawingNumber:'A201',revision:'1',lineageId:'mc-demo-lineage-a201',lineageStatus:'superseded',previousDocumentId:'mc-demo-doc-drawing-a201-r0',supersededByDocumentId:'mc-demo-doc-drawing-a201-r2',division:'09'}],
  ['drawing-a201-r2',design,'A201 Revision 2 — Reflected Ceiling Plan','Drawings','drawing','A201','Reflected Ceiling Plan Revision 2','Cable-tray route revised at Exam Room 112 to clear the existing duct. Revision 2 closes RFI-002.',['mc-demo-sec-rfi-002','mc-demo-sec-drawing-m101','mc-demo-sec-drawing-t101'],{drawingNumber:'A201',revision:'2',lineageId:'mc-demo-lineage-a201',lineageStatus:'current',previousDocumentId:'mc-demo-doc-drawing-a201-r1',division:'09'}],
  ['drawing-m101',design,'M101 — HVAC Renovation Plan','Drawings','drawing','M101','HVAC Renovation Plan','Existing duct remains above Exam Room 112. Maintain access and coordinate clearances with cable tray.',['mc-demo-sec-rfi-002','mc-demo-sec-spec-230500'],{drawingNumber:'M101',discipline:'Mechanical',division:'23'}],
  ['drawing-t101',design,'T101 — Telecommunications Plan','Drawings','drawing','T101','Telecommunications Plan','Route cable tray to Telecom Room TR-1 using the revised corridor alignment shown by A201 Revision 2.',['mc-demo-sec-rfi-002','mc-demo-sec-spec-271000'],{drawingNumber:'T101',discipline:'Telecommunications',division:'27'}],
  ['drawing-fa101',design,'FA101 — Fire Alarm Plan','Drawings','drawing','FA101','Fire Alarm Plan','Coordinate pharmacy notification appliance mounting with casework and approved RFI-003 response.',['mc-demo-sec-rfi-003','mc-demo-sec-spec-283100'],{drawingNumber:'FA101',discipline:'Fire Alarm',division:'28'}],
  ['drawing-e201',design,'E201 — Power Plan','Drawings','drawing','E201','Power Plan','Panelboard and branch-circuit modifications serve renovated clinical and support areas.',['mc-demo-sec-sub-006','mc-demo-sec-spec-260500'],{drawingNumber:'E201',discipline:'Electrical',division:'26'}],
  ['rfi-001',field,'RFI-001 — Ceiling conflict above Exam Room 112','RFIs','rfi','RFI-001','Ceiling conflict above Exam Room 112','Open coordination question concerning device and suspension clearance above Room 112.',['mc-demo-sec-drawing-a201-r2'],{status:'Open',date:'2026-02-03',roomId:'room-112'}],
  ['rfi-002',field,'RFI-002 — Existing duct conflicts with new cable tray','RFIs','rfi','RFI-002','Existing duct conflicts with new cable tray','Closed response: retain the existing duct and reroute the telecommunications cable tray south of the duct. A201 Revision 2 documents the approved route.',['mc-demo-sec-drawing-a201-r2','mc-demo-sec-drawing-m101','mc-demo-sec-drawing-t101','mc-demo-sec-spec-271000','mc-demo-sec-meeting-004','mc-demo-sec-evidence-002'],{status:'Closed',date:'2026-02-12',roomId:'room-112',buildingId:'clinic-building',discipline:'Coordination'}],
  ['rfi-003',field,'RFI-003 — Fire alarm device mounting at pharmacy casework','RFIs','rfi','RFI-003','Fire alarm device mounting at pharmacy casework','Approved response coordinates the notification appliance above pharmacy casework while maintaining required visibility.',['mc-demo-sec-drawing-fa101'],{status:'Closed',date:'2026-02-18',roomId:'room-121'}],
  ['rfi-004',field,'RFI-004 — Plumbing shutdown duration','RFIs','rfi','RFI-004','Plumbing shutdown duration','Approved four-hour shutdown window requires owner notice and contingency planning.',['mc-demo-sec-spec-220500'],{status:'Closed',date:'2026-02-20'}],
  ['rfi-005',field,'RFI-005 — Firestopping detail at rated corridor wall','RFIs','rfi','RFI-005','Firestopping detail at rated corridor wall','Use the listed tested system matching the penetrant and annular space at Corridor C-100.',['mc-demo-sec-spec-078413','mc-demo-sec-inspection-002'],{status:'Open',date:'2026-03-02'}],
  ['rfi-006',field,'RFI-006 — Telecom-room grounding clarification','RFIs','rfi','RFI-006','Telecom-room grounding clarification','Bond the rack, ladder tray, and telecommunications grounding busbar in Telecom Room TR-1.',['mc-demo-sec-spec-271000'],{status:'Closed',date:'2026-03-04',roomId:'room-130'}],
  ['sub-002',field,'SUB-002 — Firestopping system','Submittals','submittal','SUB-002','Firestopping system','Approved as Noted. Provide listed systems matching each penetrant and rated assembly; coordinate with RFI-005.',['mc-demo-sec-spec-078413','mc-demo-sec-rfi-005'],{status:'Approved as Noted',disposition:'Approved as Noted'}],
  ['sub-004',field,'SUB-004 — Fire alarm devices','Submittals','submittal','SUB-004','Fire alarm devices','Approved device package coordinated with FA101 and the RFI-003 mounting response.',['mc-demo-sec-spec-283100','mc-demo-sec-drawing-fa101'],{status:'Approved'}],
  ['sub-005',field,'SUB-005 — Structured cabling','Submittals','submittal','SUB-005','Structured cabling','Approved as Noted with tray-route deviation governed by RFI-002 and A201 Revision 2.',['mc-demo-sec-spec-271000','mc-demo-sec-rfi-002'],{status:'Approved as Noted'}],
  ['sub-006',field,'SUB-006 — Electrical panelboards','Submittals','submittal','SUB-006','Electrical panelboards','Revise and Resubmit to clarify available fault-current rating and directory labeling.',['mc-demo-sec-drawing-e201'],{status:'Revise and Resubmit'}],
  ['inspection-002',field,'INS-002 — Firestopping inspection','Inspection Reports','inspection','INS-002','Firestopping inspection','Inspection at Corridor C-100 found a missing firestop at one conduit penetration and generated DEF-001.',['mc-demo-sec-spec-078413','mc-demo-sec-def-001','mc-demo-sec-evidence-004'],{status:'Action required',date:'2026-03-12'}],
  ['inspection-003',field,'INS-003 — Telecom-room readiness inspection','Inspection Reports','inspection','INS-003','Telecom-room readiness inspection','Telecom Room TR-1 is ready except rack bonding remains incomplete under DEF-004.',['mc-demo-sec-spec-271000','mc-demo-sec-def-004'],{status:'Ready for reinspection',date:'2026-03-15',roomId:'room-130',trade:'Telecommunications'}],
  ['def-001',field,'DEF-001 — Missing firestop at corridor penetration','Deficiencies','deficiency','DEF-001','Missing firestop at corridor penetration','Open deficiency: install and label the approved system at the Corridor C-100 conduit penetration.',['mc-demo-sec-inspection-002','mc-demo-sec-evidence-004'],{status:'Open',priority:'High'}],
  ['def-004',field,'DEF-004 — Telecom rack bonding incomplete','Deficiencies','deficiency','DEF-004','Telecom rack bonding incomplete','Ready for reinspection after bonding conductor and labels were installed in Telecom Room TR-1.',['mc-demo-sec-inspection-003','mc-demo-sec-spec-271000'],{status:'Ready for Reinspection'}],
  ['meeting-004',field,'Meeting Minutes 004 — Ceiling coordination','Meeting Minutes','meeting minutes','MM-004','Ceiling coordination','Team accepted the cable tray reroute south of the existing duct. A201 Revision 2 will close RFI-002.',['mc-demo-sec-rfi-002','mc-demo-sec-drawing-a201-r2'],{date:'2026-02-14'}],
  ['daily-003',field,'Daily Report 003 — Above-ceiling rough-in','Daily Reports','daily report','DR-003','Above-ceiling rough-in','Mechanical and telecommunications crews coordinated the revised route above Exam Room 112.',['mc-demo-sec-rfi-002'],{date:'2026-02-22'}],
  ['evidence-002',field,'EV-002 — Cable tray conflict field observation','Evidence Records','evidence','EV-002','Cable tray conflict field observation','Field observation records the existing duct occupying the planned cable-tray route above Exam Room 112.',['mc-demo-sec-rfi-002'],{evidenceType:'field observation',roomId:'room-112'}],
  ['evidence-004',field,'EV-004 — Corridor penetration observation','Evidence Records','evidence','EV-004','Corridor penetration observation','Inspection evidence records an unsealed conduit penetration at the rated Corridor C-100 wall.',['mc-demo-sec-def-001'],{evidenceType:'inspection observation'}],
  ['evidence-010',field,'EV-010 — Baseline corridor condition','Evidence Records','evidence','EV-010','Baseline corridor condition','Baseline record documents the undisturbed finish condition at Corridor C-100 before renovation work.',[],{evidenceType:'field observation'}],
  ['test-cabling',turnover,'Structured-cabling test summary','Commissioning and Testing','testing','TEST-2710','Structured-cabling test summary','Permanent links serving renovated areas passed the recorded wiremap and performance tests.',['mc-demo-sec-spec-271000','mc-demo-sec-sub-005'],{status:'Complete'}],
  ['procedure-owner-qa',turnover,'Owner QA Field Observation Procedure','SOPs and Procedures','procedure','SOP-QA-01','Owner QA Field Observation Procedure','Record the exact location, governing source, observed condition, evidence, responsible party, and objective closure status.',['mc-demo-sec-spec-014500'],{type:'procedure',tags:['owner qa','procedure']}],
  ['procedure-close',turnover,'Deficiency Verification and Closure Procedure','SOPs and Procedures','procedure','SOP-QA-02','Deficiency Verification and Closure Procedure','Verify corrective work against the cited source and retain objective evidence before closing a deficiency.',['mc-demo-sec-def-001'],{type:'procedure'}]
];

records.push(
  ['sub-001',field,'SUB-001 — Acoustical ceiling system','Submittals','submittal','SUB-001','Acoustical ceiling system','Approved ceiling suspension and panel package for renovated clinical areas.',['mc-demo-sec-spec-095100','mc-demo-sec-drawing-a201-r2'],{status:'Approved'}],
  ['sub-003',field,'SUB-003 — HVAC terminal units','Submittals','submittal','SUB-003','HVAC terminal units','Approved as Noted with access-clearance coordination required above Exam Wing A.',['mc-demo-sec-spec-230500','mc-demo-sec-drawing-m101'],{status:'Approved as Noted'}],
  ['inspection-001',field,'INS-001 — Above-ceiling coordination inspection','Inspection Reports','inspection','INS-001','Above-ceiling coordination inspection','Inspection confirmed the revised tray route and identified one remaining access-clearance item.',['mc-demo-sec-rfi-002','mc-demo-sec-drawing-a201-r2','mc-demo-sec-evidence-002'],{status:'Complete',date:'2026-02-24',roomId:'room-112'}],
  ['inspection-004',field,'INS-004 — Fire alarm rough-in inspection','Inspection Reports','inspection','INS-004','Fire alarm rough-in inspection','Rough-in inspection identified the pharmacy device mounting height condition recorded as DEF-003.',['mc-demo-sec-rfi-003','mc-demo-sec-def-003','mc-demo-sec-evidence-006'],{status:'Action required',date:'2026-03-16',roomId:'room-121'}],
  ['inspection-005',field,'INS-005 — HVAC startup observation','Inspection Reports','inspection','INS-005','HVAC startup observation','Startup observation confirmed terminal-unit operation and recorded limited access at one service panel.',['mc-demo-sec-spec-230500','mc-demo-sec-def-008'],{status:'Complete',date:'2026-03-19'}],
  ['def-002',field,'DEF-002 — Cable tray conflicts with ductwork','Deficiencies','deficiency','DEF-002','Cable tray conflicts with ductwork','Closed after the cable tray was rerouted in accordance with RFI-002 and A201 Revision 2.',['mc-demo-sec-rfi-002','mc-demo-sec-drawing-a201-r2','mc-demo-sec-evidence-002'],{status:'Closed',priority:'High'}],
  ['def-003',field,'DEF-003 — Fire alarm device mounted at incorrect height','Deficiencies','deficiency','DEF-003','Fire alarm device mounted at incorrect height','Correct the pharmacy notification appliance mounting to match the approved RFI-003 response.',['mc-demo-sec-inspection-004','mc-demo-sec-rfi-003'],{status:'Corrected',priority:'Medium'}],
  ['def-005',field,'DEF-005 — Ceiling grid damaged','Deficiencies','deficiency','DEF-005','Ceiling grid damaged','Replace the damaged grid member in Corridor C-100 and verify alignment before panel installation.',['mc-demo-sec-spec-095100'],{status:'Open',priority:'Low'}],
  ['def-006',field,'DEF-006 — Plumbing valve label missing','Deficiencies','deficiency','DEF-006','Plumbing valve label missing','Install the missing durable valve identification required by 22 05 00.',['mc-demo-sec-spec-220500'],{status:'Ready for Reinspection',priority:'Medium'}],
  ['def-007',field,'DEF-007 — Unsealed conduit penetration','Deficiencies','deficiency','DEF-007','Unsealed conduit penetration','Seal and label the electrical conduit penetration using the approved firestopping system.',['mc-demo-sec-spec-078413','mc-demo-sec-sub-002'],{status:'Corrected',priority:'High'}],
  ['def-008',field,'DEF-008 — HVAC access clearance insufficient','Deficiencies','deficiency','DEF-008','HVAC access clearance insufficient','Maintain service access at the terminal unit by relocating the adjacent support.',['mc-demo-sec-inspection-005','mc-demo-sec-spec-230500'],{status:'Open',priority:'Medium'}],
  ['meeting-001',field,'Meeting Minutes 001 — Project kickoff','Meeting Minutes','meeting minutes','MM-001','Project kickoff','Team confirmed occupied-clinic phasing, safety controls, submittal routing, and owner coordination responsibilities.',['mc-demo-sec-spec-011000','mc-demo-sec-spec-013100'],{date:'2026-01-08'}],
  ['meeting-002',field,'Meeting Minutes 002 — Infection-control phasing','Meeting Minutes','meeting minutes','MM-002','Infection-control phasing','Team confirmed barrier sequencing and daily infection-control inspection responsibilities for Exam Wing A.',['mc-demo-sec-spec-013533'],{date:'2026-01-22'}],
  ['meeting-003',field,'Meeting Minutes 003 — Shutdown coordination','Meeting Minutes','meeting minutes','MM-003','Shutdown coordination','Owner accepted the proposed plumbing shutdown window subject to notice and contingency requirements.',['mc-demo-sec-rfi-004','mc-demo-sec-spec-220500'],{date:'2026-02-06'}],
  ['meeting-005',field,'Meeting Minutes 005 — Commissioning readiness','Meeting Minutes','meeting minutes','MM-005','Commissioning readiness','Team reviewed pretest, cabling certification, owner training, and closeout-document prerequisites.',['mc-demo-sec-test-cabling','mc-demo-sec-spec-017700'],{date:'2026-03-20'}],
  ['daily-001',field,'Daily Report 001 — Mobilization','Daily Reports','daily report','DR-001','Mobilization','Installed protected access routes and initial occupied-clinic work-area controls.',['mc-demo-sec-spec-011000'],{date:'2026-01-12'}],
  ['daily-002',field,'Daily Report 002 — Selective demolition','Daily Reports','daily report','DR-002','Selective demolition','Completed controlled ceiling removal in Exam Wing A after barrier verification.',['mc-demo-sec-spec-013533'],{date:'2026-02-10'}],
  ['daily-004',field,'Daily Report 004 — Firestopping correction','Daily Reports','daily report','DR-004','Firestopping correction','Installed listed firestopping at the Corridor C-100 penetration and prepared the work for reinspection.',['mc-demo-sec-def-001','mc-demo-sec-sub-002'],{date:'2026-03-14'}],
  ['daily-005',field,'Daily Report 005 — Telecom-room work','Daily Reports','daily report','DR-005','Telecom-room work','Completed rack bonding corrective work and labeling in Telecom Room TR-1.',['mc-demo-sec-def-004'],{date:'2026-03-18',roomId:'room-130'}],
  ['evidence-001',field,'EV-001 — Exam Wing A ceiling coordination markup','Evidence Records','evidence','EV-001','Exam Wing A ceiling coordination markup','Stored markup identifies the coordinated device, duct, and tray zones above Exam Wing A.',['mc-demo-sec-drawing-a201-r2'],{evidenceType:'marked-up detail'}],
  ['evidence-003',field,'EV-003 — Cable tray reroute verification','Evidence Records','evidence','EV-003','Cable tray reroute verification','Field observation confirms the installed cable tray follows the route approved by RFI-002.',['mc-demo-sec-rfi-002','mc-demo-sec-def-002'],{evidenceType:'field observation'}],
  ['evidence-005',field,'EV-005 — Firestop correction observation','Evidence Records','evidence','EV-005','Firestop correction observation','Observation records the corrected and labeled firestop installation before concealment.',['mc-demo-sec-def-001','mc-demo-sec-sub-002'],{evidenceType:'inspection observation'}],
  ['evidence-006',field,'EV-006 — Pharmacy device mounting observation','Evidence Records','evidence','EV-006','Pharmacy device mounting observation','Observation records the original fire alarm device mounting condition at pharmacy casework.',['mc-demo-sec-rfi-003','mc-demo-sec-def-003'],{evidenceType:'field observation'}],
  ['evidence-007',field,'EV-007 — Telecom rack bonding observation','Evidence Records','evidence','EV-007','Telecom rack bonding observation','Observation records the installed bonding conductor and labels for Telecom Room TR-1 reinspection.',['mc-demo-sec-def-004'],{evidenceType:'inspection observation'}],
  ['evidence-008',field,'EV-008 — Structured cabling test excerpt','Evidence Records','evidence','EV-008','Structured cabling test excerpt','Stored test excerpt records passing permanent-link results for the renovated exam rooms.',['mc-demo-sec-test-cabling'],{evidenceType:'test result'}],
  ['evidence-009',field,'EV-009 — A201 Revision 2 excerpt','Evidence Records','evidence','EV-009','A201 Revision 2 excerpt','Revision excerpt identifies the relocated cable-tray route used to close RFI-002.',['mc-demo-sec-drawing-a201-r2'],{evidenceType:'revision excerpt'}],
  ['test-hvac',turnover,'HVAC startup checklist','Commissioning and Testing','testing','TEST-2305','HVAC startup checklist','Recorded startup checks confirm operation, controls response, and access observations for renovated terminal units.',['mc-demo-sec-spec-230500','mc-demo-sec-inspection-005'],{status:'Complete'}],
  ['test-fire-alarm',turnover,'Fire alarm pretest','Commissioning and Testing','testing','TEST-2831','Fire alarm pretest','Pretest record documents device addressing, notification operation, and correction of the pharmacy mounting condition.',['mc-demo-sec-spec-283100','mc-demo-sec-def-003'],{status:'Complete'}],
  ['turnover-closeout',turnover,'Closeout-document checklist','Commissioning and Testing','turnover checklist','TURN-001','Closeout-document checklist','Checklist tracks as-built drawings, test results, training materials, warranties, and closed deficiency records.',['mc-demo-sec-spec-017700'],{status:'In progress'}],
  ['procedure-shutdown',turnover,'Shutdown Coordination Procedure','SOPs and Procedures','procedure','SOP-QA-03','Shutdown Coordination Procedure','Identify affected systems and areas, obtain owner approval, provide notice, confirm contingency measures, and document restoration.',['mc-demo-sec-rfi-004','mc-demo-sec-spec-013100'],{type:'procedure'}]
);

for (const [key, libraryId, name, category, type, number, title, content, refs, metadata] of records) {
  const docId = `mc-demo-doc-${key}`;
  const secId = key === 'rfi-002' ? DEMO_INITIAL_SECTION_ID : `mc-demo-sec-${key}`;
  documents.push(document(docId, libraryId, name, category, type, secId, metadata));
  sections.push(section(secId, docId, libraryId, number, title, content, refs, metadata));
}

const inspectionRecords = [
  {
    inspectionId: 'mc-demo-inspection-record-001', projectId: DEMO_PROJECT_ID, inspectionNumber: 'INS-001',
    title: 'Above-ceiling coordination inspection', inspectionType: 'Coordination', status: 'Complete', result: 'Acceptable', inspectionDate: '2026-02-24',
    createdAt: '2026-02-24T19:00:00.000Z', updatedAt: '2026-02-24T20:00:00.000Z', inspectorName: 'Demonstration Inspector',
    building: 'Clinic Building', area: 'Exam Wing A', room: 'Room 112 Exam', trade: 'Coordination', discipline: 'Architectural',
    description: 'Fictional above-ceiling coordination inspection.', scope: 'Verify the approved cable-tray reroute before ceiling closure.',
    observedConditions: 'The installed route clears the existing duct and follows A201 Revision 2.', correctiveActionRequired: false, followUpRequired: false, followUpDate: '', notes: '',
    sourceDocumentIds: ['mc-demo-doc-inspection-001'], sourceSectionIds: ['mc-demo-sec-inspection-001'], evidenceReferences: [{ documentId: 'mc-demo-doc-evidence-003', sectionId: 'mc-demo-sec-evidence-003' }],
    relatedDrawingIds: ['mc-demo-doc-drawing-a201-r2','mc-demo-doc-drawing-m101','mc-demo-doc-drawing-t101'], relatedSpecificationIds: ['mc-demo-doc-spec-271000'], relatedRfiIds: ['mc-demo-doc-rfi-002'], relatedSubmittalIds: ['mc-demo-doc-sub-005'], relatedDeficiencyIds: ['mc-demo-doc-def-002'],
    relationshipIds: [], versionIds: ['mc-demo-doc-drawing-a201-r2'], revisionIds: ['mc-demo-doc-drawing-a201-r1->mc-demo-doc-drawing-a201-r2'], workflowTemplateId: 'Inspection Preparation', archivedAt: ''
  },
  {
    inspectionId: 'mc-demo-inspection-record-002', projectId: DEMO_PROJECT_ID, inspectionNumber: 'INS-002',
    title: 'Firestopping inspection', inspectionType: 'Quality Control', status: 'Closed', result: 'Deficient', inspectionDate: '2026-03-12',
    createdAt: '2026-03-12T18:00:00.000Z', updatedAt: '2026-03-18T18:00:00.000Z', inspectorName: 'Demonstration Inspector', building: 'Clinic Building', area: 'Corridor C-100', room: '', trade: 'Firestopping', discipline: 'Architectural',
    description: 'Fictional rated-penetration inspection.', scope: 'Verify listed systems before concealment.', observedConditions: 'One conduit penetration was unsealed at the initial inspection.', correctiveActionRequired: true, followUpRequired: false, followUpDate: '', notes: 'Closed after documented correction.',
    sourceDocumentIds: ['mc-demo-doc-inspection-002'], sourceSectionIds: ['mc-demo-sec-inspection-002'], evidenceReferences: [{ documentId: 'mc-demo-doc-evidence-004', sectionId: 'mc-demo-sec-evidence-004' },{ documentId: 'mc-demo-doc-evidence-005', sectionId: 'mc-demo-sec-evidence-005' }],
    relatedDrawingIds: [], relatedSpecificationIds: ['mc-demo-doc-spec-078413'], relatedRfiIds: ['mc-demo-doc-rfi-005'], relatedSubmittalIds: ['mc-demo-doc-sub-002'], relatedDeficiencyIds: ['mc-demo-doc-def-001'], relationshipIds: [], versionIds: [], revisionIds: [], workflowTemplateId: 'Inspection Preparation', archivedAt: ''
  },
  {
    inspectionId: 'mc-demo-inspection-record-003', projectId: DEMO_PROJECT_ID, inspectionNumber: 'INS-003',
    title: 'Telecom-room readiness inspection', inspectionType: 'Readiness', status: 'Follow-Up Required', result: 'Acceptable with Comments', inspectionDate: '2026-03-15',
    createdAt: '2026-03-15T18:00:00.000Z', updatedAt: '2026-03-15T19:00:00.000Z', inspectorName: 'Demonstration Inspector', building: 'Clinic Building', area: 'Telecom Room TR-1', room: 'Room 130 Telecom', trade: 'Telecommunications', discipline: 'Telecommunications',
    description: 'Fictional telecom-room readiness inspection.', scope: 'Verify room, rack, tray, grounding, and labeling readiness.', observedConditions: 'Room was ready except rack bonding required correction.', correctiveActionRequired: true, followUpRequired: true, followUpDate: '2026-03-19', notes: '',
    sourceDocumentIds: ['mc-demo-doc-inspection-003'], sourceSectionIds: ['mc-demo-sec-inspection-003'], evidenceReferences: [{ documentId: 'mc-demo-doc-evidence-007', sectionId: 'mc-demo-sec-evidence-007' }], relatedDrawingIds: ['mc-demo-doc-drawing-t101'], relatedSpecificationIds: ['mc-demo-doc-spec-271000'], relatedRfiIds: ['mc-demo-doc-rfi-006'], relatedSubmittalIds: ['mc-demo-doc-sub-005'], relatedDeficiencyIds: ['mc-demo-doc-def-004'], relationshipIds: [], versionIds: [], revisionIds: [], workflowTemplateId: 'Inspection Preparation', archivedAt: ''
  },
  {
    inspectionId: 'mc-demo-inspection-record-004', projectId: DEMO_PROJECT_ID, inspectionNumber: 'INS-004', title: 'Fire alarm rough-in inspection', inspectionType: 'Rough-In', status: 'Complete', result: 'Deficient', inspectionDate: '2026-03-16', createdAt: '2026-03-16T18:00:00.000Z', updatedAt: '2026-03-16T19:00:00.000Z', inspectorName: 'Demonstration Inspector', building: 'Clinic Building', area: 'Pharmacy', room: 'Room 121 Pharmacy', trade: 'Fire Alarm', discipline: 'Fire Alarm', description: 'Fictional fire alarm rough-in inspection.', scope: 'Verify device rough-in against approved sources.', observedConditions: 'The pharmacy device mounting height required correction.', correctiveActionRequired: true, followUpRequired: true, followUpDate: '2026-03-20', notes: '', sourceDocumentIds: ['mc-demo-doc-inspection-004'], sourceSectionIds: ['mc-demo-sec-inspection-004'], evidenceReferences: [{ documentId: 'mc-demo-doc-evidence-006', sectionId: 'mc-demo-sec-evidence-006' }], relatedDrawingIds: ['mc-demo-doc-drawing-fa101'], relatedSpecificationIds: ['mc-demo-doc-spec-283100'], relatedRfiIds: ['mc-demo-doc-rfi-003'], relatedSubmittalIds: ['mc-demo-doc-sub-004'], relatedDeficiencyIds: ['mc-demo-doc-def-003'], relationshipIds: [], versionIds: [], revisionIds: [], workflowTemplateId: 'Inspection Preparation', archivedAt: ''
  },
  {
    inspectionId: 'mc-demo-inspection-record-005', projectId: DEMO_PROJECT_ID, inspectionNumber: 'INS-005', title: 'HVAC startup observation', inspectionType: 'Startup', status: 'Closed', result: 'Acceptable with Comments', inspectionDate: '2026-03-19', createdAt: '2026-03-19T18:00:00.000Z', updatedAt: '2026-03-21T18:00:00.000Z', inspectorName: 'Demonstration Inspector', building: 'Clinic Building', area: 'Exam Wing A', room: '', trade: 'HVAC', discipline: 'Mechanical', description: 'Fictional HVAC startup observation.', scope: 'Observe startup and service-access conditions.', observedConditions: 'Operation was acceptable; one access-clearance correction was documented.', correctiveActionRequired: true, followUpRequired: false, followUpDate: '', notes: 'Closed after access correction.', sourceDocumentIds: ['mc-demo-doc-inspection-005'], sourceSectionIds: ['mc-demo-sec-inspection-005'], evidenceReferences: [], relatedDrawingIds: ['mc-demo-doc-drawing-m101'], relatedSpecificationIds: ['mc-demo-doc-spec-230500'], relatedRfiIds: [], relatedSubmittalIds: ['mc-demo-doc-sub-003'], relatedDeficiencyIds: ['mc-demo-doc-def-008'], relationshipIds: [], versionIds: [], revisionIds: [], workflowTemplateId: 'Inspection Preparation', archivedAt: ''
  }
];

const fixture = {
  manifest: { version: 'demo-1', project: {
    id: DEMO_PROJECT_ID, name: DEMO_PROJECT_NAME, canonicalName: 'Mission Companion Demonstration Project',
    projectType: 'Occupied healthcare renovation', description: 'Renovation of an approximately 18,500-square-foot fictional outpatient clinic including phased architectural, mechanical, electrical, life-safety, telecommunications, security, testing, and turnover work.',
    isDemonstration: true, demonstrationLabel: 'Demonstration Project', dataLabel: 'Fictional Sample Data', fixtureVersion: 1,
    buildingId: 'clinic-building', buildingName: 'Clinic Building', createdAt: '2026-01-05T13:00:00.000Z', updatedAt: '2026-03-20T17:00:00.000Z'
  } },
  libraries: [
    { id: design, projectId: DEMO_PROJECT_ID, name: 'Design and Requirements', description: 'Specifications and design records', enabled: true, createdAt: dates.importedAt },
    { id: field, projectId: DEMO_PROJECT_ID, name: 'Field Coordination', description: 'RFIs, submittals, inspections, deficiencies, and evidence records', enabled: true, createdAt: dates.importedAt },
    { id: turnover, projectId: DEMO_PROJECT_ID, name: 'Testing and Turnover', description: 'Testing records and owner procedures', enabled: true, createdAt: dates.importedAt }
  ],
  documents,
  sections,
  inspectionRecords,
  evaluations: []
};

function deepFreeze(value) {
  Object.freeze(value);
  Object.values(value).forEach(item => item && typeof item === 'object' && !Object.isFrozen(item) && deepFreeze(item));
  return value;
}

export const DEMONSTRATION_PROJECT = deepFreeze(fixture);

export function validateDemonstrationProject(value = DEMONSTRATION_PROJECT) {
  const errors = [];
  const project = value?.manifest?.project;
  const libraries = Array.isArray(value?.libraries) ? value.libraries : [];
  const docs = Array.isArray(value?.documents) ? value.documents : [];
  const secs = Array.isArray(value?.sections) ? value.sections : [];
  const inspections = Array.isArray(value?.inspectionRecords) ? value.inspectionRecords : [];
  const unique = (records, label) => {
    const ids = records.map(item => item?.id).filter(Boolean);
    if (ids.length !== records.length || new Set(ids).size !== ids.length) errors.push(`${label} identifiers must be present and unique.`);
  };
  unique(libraries, 'Library'); unique(docs, 'Document'); unique(secs, 'Section');
  unique(inspections.map(item => ({ id: item.inspectionId })), 'Inspection Record');
  if (project?.id !== DEMO_PROJECT_ID || !project?.isDemonstration) errors.push('Canonical demonstration project metadata is invalid.');
  const libraryIds = new Set(libraries.map(item => item.id));
  const documentIds = new Set(docs.map(item => item.id));
  const sectionIds = new Set(secs.map(item => item.id));
  libraries.forEach(item => { if (item.projectId !== project?.id) errors.push(`Library ${item.id} has an invalid project link.`); });
  docs.forEach(item => {
    if (item.projectId !== project?.id || !libraryIds.has(item.libraryId)) errors.push(`Document ${item.id} has an invalid project or library link.`);
    const actual = secs.filter(sectionItem => sectionItem.documentId === item.id).length;
    if (item.sectionCount !== actual) errors.push(`Document ${item.id} section count does not match stored sections.`);
    for (const field of ['previousDocumentId', 'supersededByDocumentId', 'duplicateOfDocumentId']) if (item[field] && !documentIds.has(item[field])) errors.push(`Document ${item.id} has a broken ${field}.`);
  });
  secs.forEach(item => {
    if (!documentIds.has(item.documentId) || !libraryIds.has(item.libraryId) || item.projectId !== project?.id) errors.push(`Section ${item.id} has an invalid ownership link.`);
    if (item.parentId && !sectionIds.has(item.parentId)) errors.push(`Section ${item.id} has a broken parent reference.`);
    if (!Array.isArray(item.path) || item.path.some(part => typeof part !== 'string')) errors.push(`Section ${item.id} has an invalid hierarchy path.`);
    (item.crossReferenceIds || []).forEach(id => { if (!sectionIds.has(id)) errors.push(`Section ${item.id} has a broken cross reference ${id}.`); });
  });
  inspections.forEach(item => {
    if (item.projectId !== project?.id) errors.push(`Inspection Record ${item.inspectionId} has an invalid project link.`);
    [...(item.sourceDocumentIds || []), ...(item.relatedDrawingIds || []), ...(item.relatedSpecificationIds || []), ...(item.relatedRfiIds || []), ...(item.relatedSubmittalIds || []), ...(item.relatedDeficiencyIds || [])].forEach(id => { if (!documentIds.has(id)) errors.push(`Inspection Record ${item.inspectionId} has a broken document reference ${id}.`); });
    [...(item.sourceSectionIds || []), ...(item.evidenceReferences || []).map(reference => reference.sectionId)].filter(Boolean).forEach(id => { if (!sectionIds.has(id)) errors.push(`Inspection Record ${item.inspectionId} has a broken section reference ${id}.`); });
  });
  if (!documentIds.has(DEMO_INITIAL_DOCUMENT_ID) || !sectionIds.has(DEMO_INITIAL_SECTION_ID)) errors.push('Initial demonstration context is unavailable.');
  return { valid: errors.length === 0, errors, counts: { libraries: libraries.length, documents: docs.length, sections: secs.length, inspectionRecords: inspections.length } };
}

export function createDemonstrationProjectFixture() {
  const validation = validateDemonstrationProject();
  if (!validation.valid) throw new Error(`Demonstration project fixture is invalid: ${validation.errors.join(' ')}`);
  return structuredClone(DEMONSTRATION_PROJECT);
}
