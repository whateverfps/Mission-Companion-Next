const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

const CHECKLIST_CATEGORY_ORDER = Object.freeze([
  'ROOM',
  'TELECOM',
  'POWER',
  'GROUNDING / BONDING',
  'FIRESTOPPING',
  'OIT / ACTIVATION',
  'DOCUMENTATION',
  'TESTING',
  'COORDINATION'
]);

const CHECKLIST_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'active', label: 'Active' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'awaiting-schedule', label: 'Awaiting Schedule' },
  { id: 'complete', label: 'Complete' },
  { id: 'room', label: 'Room' },
  { id: 'telecom', label: 'Telecom' },
  { id: 'power', label: 'Power' },
  { id: 'oit', label: 'OIT' },
  { id: 'documentation', label: 'Documentation' }
]);

const WORKBOOK_SOURCE = 'Bedford_VA_EHRM_PMIS_MASTER_v9.0 (1).xlsx';
const ASSESSMENT_SOURCE_SHEET = 'B61_Assessment';
const ASSESSMENT_SECTION_ROW_MAP = Object.freeze({
  'ROOM INVENTORY': '8-13',
  'ROOM READINESS': '15-20',
  'FIRE PROTECTION': '22-27',
  'HVAC / COOLING': '29-34',
  'ELECTRICAL / UPS': '36-41',
  'TELECOMMUNICATIONS': '43-48',
  'SECURITY / PACS / CCTV': '50-55',
  'OWNER RISKS': '57-66',
  'OPEN QUESTIONS': '68-78',
  'PHOTO LOG': '79-88',
  'OWNER READINESS SCORE': '90-95',
  'PAYMENT VERIFICATION': '97-105',
  'OIT ACTIVATION READINESS': '106-116',
  'SUBMITTAL / MATERIAL VERIFICATION': '118-125',
  'PRODUCTIVITY OBSERVATIONS': '127-133',
  'OWNER ACCEPTANCE READINESS': '135-143',
  'SOURCE / DRAWING REVIEW NOTES': '145-153',
  'OWNER DECISION SUMMARY': '155-164',
  'CONSTRUCTION STATUS': '166-174',
  'OIT STATUS': '176-184',
  'ACCEPTANCE': '186-196',
  'INSPECTOR COMMENTS': '198-212',
  'PILOT COMPLETION / ACCEPTANCE GATES': '213-240'
});

const CATEGORY_FILTER_MAP = Object.freeze({
  ROOM: 'room',
  'ROOM / CONSTRUCTION': 'room',
  TELECOM: 'telecom',
  POWER: 'power',
  'GROUNDING / BONDING': 'power',
  FIRESTOPPING: 'telecom',
  'OIT / ACTIVATION': 'oit',
  DOCUMENTATION: 'documentation',
  TESTING: 'telecom',
  COORDINATION: 'documentation'
});

function normalizeBuildingKey(value) {
  const raw = text(value).replace(/^building\s*/i, '').replace(/^b/i, '').trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return raw.padStart(2, '0');
  return raw.toUpperCase();
}

function itemId(parts = []) {
  return parts.map(value => text(value)).filter(Boolean).join('|');
}

function sourceSheetRef(sheet = {}, relationship = 'Source') {
  const source = sheet && typeof sheet === 'object' ? sheet : {};
  const sheetNumber = text(source.sheetNumber);
  return sheetNumber ? {
    kind: 'drawing',
    relationship,
    sheetNumber,
    sheetTitle: text(source.sheetTitle),
    discipline: text(source.discipline),
    level: text(source.level),
    documentId: text(source.documentId),
    pageId: text(source.pageId),
    pageNumber: Number(source.pdfPageNumber) || 0
  } : null;
}

function specRef(spec = {}, relationship = 'Applicable') {
  const source = spec && typeof spec === 'object' ? spec : {};
  const sectionNumber = text(source.sectionNumber);
  return sectionNumber ? {
    kind: 'specification',
    relationship,
    sectionNumber,
    sectionTitle: text(source.sectionTitle),
    sourceLabel: 'Bedford IFC specification index'
  } : null;
}

function milestoneRef(milestone = {}, relationship = 'Milestone') {
  const id = text(milestone.id);
  return id ? {
    kind: 'milestone',
    relationship,
    id,
    label: text(milestone.label || milestone.name || milestone.id),
    dueDate: text(milestone.dueDate),
    dueDateLabel: text(milestone.dueDateLabel),
    status: text(milestone.status),
    category: text(milestone.category),
    scope: text(milestone.scope),
    source: text(milestone.source)
  } : null;
}

function assessmentTrace(section = '', requirement = '', note = '') {
  const assessmentSection = text(section).toUpperCase();
  return {
    workbook: WORKBOOK_SOURCE,
    sheet: ASSESSMENT_SOURCE_SHEET,
    section: assessmentSection,
    rowRange: ASSESSMENT_SECTION_ROW_MAP[assessmentSection] || '',
    requirement: text(requirement),
    note: text(note)
  };
}

function normalizeScheduleDate(value = '') {
  const textValue = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(textValue) ? textValue : '';
}

function normalizeScheduleActivity(record = {}, { workspace = null, projectMilestoneContext = null } = {}) {
  if (!record || typeof record !== 'object') return null;
  const recordId = text(record['Record ID'] || record.recordId || record.id || record['Schedule ID'] || record.scheduleId);
  const title = text(record.Title || record.title || record.Name || record.name || record['Record Type'] || record.recordType || record.Category || record.category || recordId);
  if (!recordId && !title) return null;
  const plannedStart = normalizeScheduleDate(record['Planned Start'] || record.plannedStart || record['Start Date'] || record.startDate || '');
  const plannedFinish = normalizeScheduleDate(record['Planned Finish'] || record.plannedFinish || record['Due Date'] || record.dueDate || '');
  const actualStart = normalizeScheduleDate(record['Actual Start'] || record.actualStart || '');
  const actualFinish = normalizeScheduleDate(record['Actual Finish'] || record.actualFinish || '');
  const sourceRecordType = text(record['Record Type'] || record.recordType || '');
  const sourceStatus = text(record.Status || record.status || record['Activity Status'] || '').toUpperCase() || 'WAITING';
  const building = normalizeBuildingKey(record.Building || record.building || workspace?.building || '');
  const workspaceId = text(record.workspaceId || workspace?.id || '');
  const room = text(record['Floor / Room'] || record.room || workspace?.room || '');
  const trade = text(record.Trade || record.trade || record.Discipline || record.discipline || sourceRecordType || '');
  const system = text(record.System || record.system || record.Category || record.category || '');
  const phase = text(record.Phase || record.phase || projectMilestoneContext?.projectPhase || '');
  const predecessorText = text(record.Predecessors || record.predecessors || record['Predecessor IDs'] || record['Predecessor ID'] || '');
  const successorText = text(record.Successors || record.successors || record['Successor IDs'] || record['Successor ID'] || '');
  const predecessors = predecessorText ? predecessorText.split(/[;,|]/).map(value => text(value)).filter(Boolean) : [];
  const successors = successorText ? successorText.split(/[;,|]/).map(value => text(value)).filter(Boolean) : [];
  return {
    id: recordId || title,
    activityId: recordId || title,
    name: title,
    building,
    workspaceId,
    room,
    trade,
    system,
    phase,
    plannedStart,
    plannedFinish,
    actualStart,
    actualFinish,
    status: sourceStatus,
    predecessors,
    successors,
    source: {
      workbook: WORKBOOK_SOURCE,
      sheet: text(record['Source Sheet'] || record.sourceSheet || record.source || projectMilestoneContext?.sourceDocument?.originalFilename || projectMilestoneContext?.sourceDocument?.name || 'Project_Register'),
      recordType: sourceRecordType,
      recordId: recordId || title,
      rowLabel: text(record['Report Section'] || record['Decision / Action Needed'] || record['Notes'] || '')
    }
  };
}

function buildWorkspaceScheduleModel({
  workspace = null,
  projectMilestoneContext = null,
  pmisRuntime = null
} = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const registerActivities = list(pmisRuntime?.projectRegister)
    .filter(record => record && typeof record === 'object')
    .filter(record => /schedule/i.test(text(record['Record Type'] || record.recordType || record.Category || record.category || record.Title || record.title)) || /^SCH-/i.test(text(record['Record ID'] || record.recordId || record.id || '')))
    .map(record => normalizeScheduleActivity(record, { workspace, projectMilestoneContext }))
    .filter(Boolean);
  const milestoneActivities = list(projectMilestoneContext?.milestones)
    .filter(item => item && typeof item === 'object')
    .filter(item => /schedule|contract|preconstruction|turnover|acceptance/i.test(text(item.category) || text(item.name)))
    .map(item => {
      const dueDate = normalizeScheduleDate(item.dueDate || '');
      return {
        id: text(item.id || item.name),
        activityId: text(item.id || item.name),
        name: text(item.name || item.label || item.id),
        building: normalizeBuildingKey(workspace?.building || ''),
        workspaceId: text(workspace?.id || ''),
        room: text(workspace?.room || workspace?.id || ''),
        trade: text(item.category || 'PROJECT'),
        system: text(item.scope || 'PROJECT'),
        phase: text(projectMilestoneContext?.projectPhase || ''),
        plannedStart: dueDate,
        plannedFinish: dueDate,
        actualStart: item.status === 'complete' ? dueDate : '',
        actualFinish: item.status === 'complete' ? dueDate : '',
        status: text(item.status || 'pending').toUpperCase() || 'PENDING',
        predecessors: [],
        successors: [],
        source: {
          workbook: WORKBOOK_SOURCE,
          sheet: ASSESSMENT_SOURCE_SHEET,
          recordType: 'Milestone',
          recordId: text(item.id || item.name),
          rowLabel: text(item.notes || item.detail || '')
        }
      };
    });
  const scheduleActivities = milestoneActivities.filter(item => item.plannedStart || item.plannedFinish || /complete|closed|done/i.test(item.status));
  const activities = [...registerActivities, ...scheduleActivities];
  const completed = scheduleActivities.filter(item => /complete|closed|done/i.test(item.status));
  const active = scheduleActivities.filter(item => !/complete|closed|done/i.test(item.status) && item.plannedStart && item.plannedFinish);
  const upcoming = scheduleActivities.filter(item => !/complete|closed|done/i.test(item.status) && !item.plannedStart && item.plannedFinish);
  const overdue = scheduleActivities.filter(item => !/complete|closed|done/i.test(item.status) && item.plannedFinish && item.plannedFinish < today);
  const readyForInspection = scheduleActivities.filter(item => /ready|verification|inspection/i.test(item.status));
  const currentWindow = completed.length
    ? 'COMPLETED'
    : overdue.length
      ? 'OVERDUE'
      : active.length
        ? 'ACTIVE'
        : upcoming.length
          ? 'UPCOMING'
          : projectMilestoneContext?.roomScheduleStatus || 'Awaiting Contractor Schedule';
  return Object.freeze({
    status: projectMilestoneContext?.roomScheduleStatus || 'Awaiting Contractor Schedule',
    statusDetail: registerActivities.length
      ? 'Contractor baseline schedule is registered in Project_Register.'
      : 'Contractor schedule is not yet available.',
    activities,
    windows: Object.freeze({
      upcoming,
      active,
      overdue,
      readyForInspection,
      completed,
      allActive: [...active, ...upcoming]
    }),
    hasDetailedActivitySchedule: registerActivities.some(item => Boolean(item.plannedStart || item.plannedFinish || item.actualStart || item.actualFinish)),
    currentWindow,
    source: registerActivities.length ? 'Project_Register' : 'Project milestone context',
    sourceRecords: registerActivities.map(item => ({
      id: item.id,
      activityId: item.activityId,
      name: item.name,
      status: item.status,
      plannedStart: item.plannedStart,
      plannedFinish: item.plannedFinish,
      source: item.source
    }))
  });
}

function inspectionQueueStateLabel(state = '') {
  switch (text(state).toUpperCase()) {
    case 'READY': return 'Ready';
    case 'ACTIVE': return 'Active';
    case 'UPCOMING': return 'Upcoming';
    case 'BLOCKED': return 'Blocked';
    case 'AWAITING_SCHEDULE': return 'Awaiting Schedule';
    case 'COMPLETE': return 'Complete';
    default: return 'Awaiting Schedule';
  }
}

function inspectionVerificationLabel(state = '') {
  switch (text(state).toUpperCase()) {
    case 'PASS': return 'Pass';
    case 'FAIL': return 'Fail';
    case 'NA': return 'NA';
    case 'VERIFIED_SESSION': return 'Session Verified';
    default: return 'Not Verified';
  }
}

function normalizeVerificationRecord(record = {}) {
  const itemId = text(record.itemId || record.checklistItemId || record.id);
  if (!itemId) return null;
  return Object.freeze({
    id: text(record.id || `workspace-checklist-verification:${text(record.projectId || '')}:${text(record.workspaceId || '')}:${itemId}`),
    projectId: text(record.projectId || ''),
    workspaceId: text(record.workspaceId || ''),
    itemId,
    verificationStatus: text(record.verificationStatus || record.status || 'NOT_VERIFIED').toUpperCase() || 'NOT_VERIFIED',
    notes: text(record.notes || ''),
    verifiedAt: text(record.verifiedAt || ''),
    verifiedBy: text(record.verifiedBy || ''),
    evidenceIds: list(record.evidenceIds).map(value => text(value)).filter(Boolean),
    issueIds: list(record.issueIds).map(value => text(value)).filter(Boolean),
    createdAt: text(record.createdAt || ''),
    updatedAt: text(record.updatedAt || '')
  });
}

function sanitizeVerificationRecordVerifier(record = {}, workspace = null) {
  const verifiedBy = text(record.verifiedBy || '');
  if (!verifiedBy) return { ...record, verifiedBy: '' };
  const invalidVerifierNames = new Set([
    workspace?.name,
    workspace?.title,
    workspace?.label,
    workspace?.room
  ].map(value => text(value)).filter(Boolean));
  return invalidVerifierNames.has(verifiedBy)
    ? { ...record, verifiedBy: '' }
    : { ...record, verifiedBy };
}

function checklistQueueStateMatches(item = {}, filterId = 'all') {
  const filter = text(filterId).toLowerCase();
  if (!filter || filter === 'all') return true;
  if (filter === 'blocked') return text(item.queueState || item.inspectionQueueState || '').toUpperCase() === 'BLOCKED';
  if (['ready', 'active', 'upcoming', 'complete'].includes(filter)) return text(item.queueState || item.inspectionQueueState || '').toUpperCase() === filter.toUpperCase();
  if (filter === 'awaiting-schedule') return text(item.queueState || item.inspectionQueueState || '').toUpperCase() === 'AWAITING_SCHEDULE';
  return false;
}

function issueRef(issue = {}, relationship = 'Issue') {
  const id = text(issue.id);
  return id ? {
    kind: 'issue',
    relationship,
    id,
    title: text(issue.title),
    type: text(issue.type),
    severity: text(issue.severity),
    status: text(issue.status)
  } : null;
}

function createChecklistItem({
  id,
  title,
  description,
  category,
  scope,
  status = 'NOT_VERIFIED',
  sourceType,
  sourceRefs = [],
  workspaceId = '',
  assessmentSection = '',
  assessmentRequirement = '',
  assessmentSource = ASSESSMENT_SOURCE_SHEET,
  assessmentRows = '',
  plannedInspectionWindow = '',
  required = true,
  verifiable = true,
  verificationState = 'NOT_VERIFIED',
  blockedBy = [],
  relatedIssues = [],
  relatedSpecifications = [],
  relatedSheets = [],
  relatedMilestones = [],
  notes = '',
  canToggle = true,
  authoritative = false
}) {
  return Object.freeze({
    id: text(id),
    title: text(title),
    description: text(description),
    category: text(category).toUpperCase() || 'COORDINATION',
    scope: text(scope).toUpperCase() || 'WORKSPACE',
    status: text(status).toUpperCase() || 'NOT_VERIFIED',
    sourceType: text(sourceType),
    sourceRefs: list(sourceRefs).map(ref => ref ? { ...ref } : null).filter(Boolean),
    workspaceId: text(workspaceId),
    assessmentSection: text(assessmentSection),
    assessmentRequirement: text(assessmentRequirement),
    assessmentSource: text(assessmentSource) || ASSESSMENT_SOURCE_SHEET,
    assessmentRows: text(assessmentRows),
    plannedInspectionWindow: text(plannedInspectionWindow),
    required: Boolean(required),
    verifiable: Boolean(verifiable),
    verificationState: text(verificationState).toUpperCase() || 'NOT_VERIFIED',
    blockedBy: list(blockedBy).map(value => text(value)).filter(Boolean),
    relatedIssues: list(relatedIssues).map(item => issueRef(item)).filter(Boolean),
    relatedSpecifications: list(relatedSpecifications).map(item => specRef(item)).filter(Boolean),
    relatedSheets: list(relatedSheets).map(item => sourceSheetRef(item)).filter(Boolean),
    relatedMilestones: list(relatedMilestones).map(item => milestoneRef(item)).filter(Boolean),
    notes: text(notes),
    canToggle: Boolean(canToggle),
    authoritative: Boolean(authoritative)
  });
}

function checklistSortRank(item = {}) {
  const statusRank = {
    BLOCKED: 0,
    UNKNOWN: 1,
    NOT_VERIFIED: 2,
    VERIFIED_SESSION: 3,
    NOT_APPLICABLE: 4
  };
  const categoryRank = CHECKLIST_CATEGORY_ORDER.indexOf(item.category);
  return (statusRank[item.status] ?? 99) * 100
    + (categoryRank >= 0 ? categoryRank : 99)
    + (item.required ? 0 : 10);
}

function checklistFilterMatches(item, filterId = 'all') {
  const filter = text(filterId).toLowerCase();
  if (!filter || filter === 'all') return true;
  if (['ready', 'active', 'upcoming', 'blocked', 'awaiting-schedule', 'complete'].includes(filter)) {
    return checklistQueueStateMatches(item, filter);
  }
  if (filter === 'blocked') return checklistQueueStateMatches(item, 'blocked');
  const mapped = CATEGORY_FILTER_MAP[item.category] || CATEGORY_FILTER_MAP[item.scope] || '';
  return filter === mapped;
}

function groupChecklistItems(items = []) {
  const groups = [];
  for (const category of CHECKLIST_CATEGORY_ORDER) {
    const groupItems = items.filter(item => item.category === category);
    if (!groupItems.length) continue;
    groups.push({
      id: category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: category,
      items: groupItems
    });
  }
  return groups;
}

function buildPrimaryWorkspaceChecklist({
  workspace = null,
  projectMilestoneContext = null,
  issuesModel = null,
  pmisRuntime = null,
  verificationRecords = []
} = {}) {
  const workspaceId = text(workspace?.id || '');
  const room = text(workspace?.room || workspace?.id || '');
  const building = normalizeBuildingKey(workspace?.building);
  const level = text(workspace?.level || 'Workspace');
  const roomType = text(workspace?.type);
  const sourceSheets = list(workspace?.sourceSheets).filter(item => item && typeof item === 'object');
  const relatedSheets = list(workspace?.relatedSheets).filter(item => item && typeof item === 'object');
  const applicableSpecifications = list(workspace?.applicableSpecifications).filter(item => item && typeof item === 'object');
  const relatedRooms = list(workspace?.relatedRooms).filter(Boolean);
  const issueList = list(issuesModel?.issues);
  const scheduleIssue = issueList.find(issue => /awaiting contractor schedule/i.test(text(issue.title))) || null;
  const appIssue = issueList.find(issue => /app date pending/i.test(text(issue.title))) || null;
  const pmisBuildingRecord = list(pmisRuntime?.buildings).find(item => normalizeBuildingKey(item?.Building) === building) || null;
  const pmisRiskCount = Math.max(0, Number(pmisBuildingRecord?.['Open Risks'] || pmisBuildingRecord?.openRisks || 0) || 0);
  const pmisQuestionCount = Math.max(0, Number(pmisBuildingRecord?.['Open Questions'] || pmisBuildingRecord?.openQuestions || 0) || 0);
  const pmisGateStatus = text(pmisBuildingRecord?.['OIT Status'] || pmisBuildingRecord?.['OIT Readiness'] || pmisBuildingRecord?.['Overall Status'] || '');
  const scheduleMilestone = list(projectMilestoneContext?.milestones).find(item => /schedule/i.test(text(item.category)) && /awaiting/i.test(text(item.status))) || null;
  const appMilestone = list(projectMilestoneContext?.milestones).find(item => text(item.id) === 'accident-prevention-plan' || /accident prevention plan/i.test(text(item.name)));
  const scheduleModel = buildWorkspaceScheduleModel({ workspace, projectMilestoneContext, pmisRuntime });
  const verificationRecordsByItemId = new Map(list(verificationRecords).map(record => {
    const normalized = normalizeVerificationRecord(sanitizeVerificationRecordVerifier(record, workspace));
    return normalized ? [normalized.itemId, normalized] : null;
  }).filter(Boolean));
  const sourceSheetRefs = sourceSheets.map(sheet => sourceSheetRef(sheet, 'Source Sheet')).filter(Boolean);
  const relatedSheetRefs = relatedSheets.map(sheet => sourceSheetRef(sheet, 'Related Sheet')).filter(Boolean);
  const firstSheet = sourceSheets[0] || null;
  const firstSpec = applicableSpecifications[0] || null;
  const firstSpecRef = specRef(firstSpec, 'Governing Spec');
  const scheduleBlocked = Boolean(scheduleIssue);
  const appBlocked = Boolean(appIssue);
  const items = [];

  if (sourceSheetRefs.length || firstSpecRef) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'documentation', 'source-records']),
      title: 'Review source documentation',
      description: 'Confirm the workspace is grounded in current source drawings and governing specification references.',
      category: 'DOCUMENTATION',
      scope: 'WORKSPACE',
      status: sourceSheetRefs.length ? 'NOT_VERIFIED' : 'UNKNOWN',
      sourceType: 'Workspace registry',
      sourceRefs: [...sourceSheetRefs.slice(0, 2), firstSpecRef].filter(Boolean),
      workspaceId,
      assessmentSection: 'SOURCE / DRAWING REVIEW NOTES',
      assessmentRequirement: 'Review source documentation',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['SOURCE / DRAWING REVIEW NOTES'],
      plannedInspectionWindow: scheduleModel.status,
      required: true,
      verifiable: true,
      relatedSpecifications: applicableSpecifications.slice(0, 3),
      relatedSheets: sourceSheets.slice(0, 2),
      notes: `Workspace ${room || workspaceId || 'workspace'} has ${sourceSheetRefs.length} source sheet${sourceSheetRefs.length === 1 ? '' : 's'} available for review.`
    }));
  }

  if (applicableSpecifications.some(spec => text(spec.sectionNumber) === '27 05 11')) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'room', 'construction']),
      title: 'Verify room construction and boundaries',
      description: 'Confirm the room layout, major construction conditions, and drawing boundaries against the source sheets.',
      category: 'ROOM',
      scope: 'ROOM',
      status: scheduleBlocked ? 'BLOCKED' : 'NOT_VERIFIED',
      sourceType: 'Applicable specification',
      sourceRefs: [firstSheet ? sourceSheetRef(firstSheet, 'Source Sheet') : null, specRef(applicableSpecifications.find(spec => text(spec.sectionNumber) === '27 05 11'), 'Governing Spec')].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: true,
      blockedBy: scheduleIssue ? [scheduleIssue.id] : [],
      relatedIssues: scheduleIssue ? [scheduleIssue] : [],
      relatedSpecifications: applicableSpecifications.filter(spec => text(spec.sectionNumber) === '27 05 11'),
      relatedSheets: sourceSheets.slice(0, 2),
      relatedMilestones: scheduleMilestone ? [scheduleMilestone] : [],
      assessmentSection: 'ROOM READINESS',
      assessmentRequirement: 'Verify room construction and boundaries',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['ROOM READINESS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Room construction checks stay tied to the room schedule and the governing room layout sheets.'
    }));
  }

  if (applicableSpecifications.some(spec => text(spec.sectionNumber) === '27 05 33')) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'telecom', 'pathways']),
      title: 'Confirm cable tray and pathway coordination',
      description: 'Confirm communications pathways, tray routing, and cable support coordination against the source documents.',
      category: 'TELECOM',
      scope: 'ROOM',
      status: scheduleBlocked ? 'BLOCKED' : 'NOT_VERIFIED',
      sourceType: 'Applicable specification',
      sourceRefs: [firstSheet ? sourceSheetRef(firstSheet, 'Source Sheet') : null, specRef(applicableSpecifications.find(spec => text(spec.sectionNumber) === '27 05 33'), 'Governing Spec')].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: true,
      blockedBy: scheduleIssue ? [scheduleIssue.id] : [],
      relatedIssues: scheduleIssue ? [scheduleIssue] : [],
      relatedSpecifications: applicableSpecifications.filter(spec => text(spec.sectionNumber) === '27 05 33'),
      relatedSheets: sourceSheets.slice(0, 2),
      relatedMilestones: scheduleMilestone ? [scheduleMilestone] : [],
      assessmentSection: 'TELECOMMUNICATIONS',
      assessmentRequirement: 'Confirm cable tray and pathway coordination',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['TELECOMMUNICATIONS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Pathway coordination is part of the preconstruction sequence and should not be treated as complete until the contractor schedule is available.'
    }));
  }

  if (applicableSpecifications.some(spec => text(spec.sectionNumber) === '27 05 26')) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'power', 'grounding']),
      title: 'Verify grounding and bonding',
      description: 'Confirm grounding and bonding conditions against the source drawing and communications grounding specification.',
      category: 'GROUNDING / BONDING',
      scope: 'ROOM',
      status: scheduleBlocked ? 'BLOCKED' : 'NOT_VERIFIED',
      sourceType: 'Applicable specification',
      sourceRefs: [firstSheet ? sourceSheetRef(firstSheet, 'Source Sheet') : null, specRef(applicableSpecifications.find(spec => text(spec.sectionNumber) === '27 05 26'), 'Governing Spec')].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: true,
      blockedBy: scheduleIssue ? [scheduleIssue.id] : [],
      relatedIssues: scheduleIssue ? [scheduleIssue] : [],
      relatedSpecifications: applicableSpecifications.filter(spec => text(spec.sectionNumber) === '27 05 26'),
      relatedSheets: sourceSheets.slice(0, 2),
      relatedMilestones: scheduleMilestone ? [scheduleMilestone] : [],
      assessmentSection: 'ELECTRICAL / UPS',
      assessmentRequirement: 'Verify grounding and bonding',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['ELECTRICAL / UPS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Grounding and bonding is a prerequisite for room turnover and should stay blocked if the room schedule is still pending.'
    }));
  }

  if (applicableSpecifications.some(spec => text(spec.sectionNumber) === '27 15 00')) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'telecom', 'cabling']),
      title: 'Verify horizontal cabling and testing readiness',
      description: 'Confirm cable pathways, cabling, and testing readiness from the approved source sheets and cabling specification.',
      category: 'TESTING',
      scope: 'ROOM',
      status: scheduleBlocked ? 'BLOCKED' : 'NOT_VERIFIED',
      sourceType: 'Applicable specification',
      sourceRefs: [firstSheet ? sourceSheetRef(firstSheet, 'Source Sheet') : null, specRef(applicableSpecifications.find(spec => text(spec.sectionNumber) === '27 15 00'), 'Governing Spec')].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: true,
      blockedBy: scheduleIssue ? [scheduleIssue.id] : [],
      relatedIssues: scheduleIssue ? [scheduleIssue] : [],
      relatedSpecifications: applicableSpecifications.filter(spec => text(spec.sectionNumber) === '27 15 00'),
      relatedSheets: sourceSheets.slice(0, 2),
      relatedMilestones: scheduleMilestone ? [scheduleMilestone] : [],
      assessmentSection: 'TELECOMMUNICATIONS',
      assessmentRequirement: 'Verify horizontal cabling and testing readiness',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['TELECOMMUNICATIONS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Testing readiness remains pending until the contractor schedule and room sequence are established.'
    }));
  }

  if (applicableSpecifications.some(spec => text(spec.sectionNumber) === '28 23 00')) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'coordination', 'security']),
      title: 'Verify video surveillance and security coordination',
      description: 'Confirm surveillance / security coordination where the governing sheets indicate it applies to the workspace.',
      category: 'COORDINATION',
      scope: 'ROOM',
      status: 'NOT_VERIFIED',
      sourceType: 'Applicable specification',
      sourceRefs: [firstSheet ? sourceSheetRef(firstSheet, 'Source Sheet') : null, specRef(applicableSpecifications.find(spec => text(spec.sectionNumber) === '28 23 00'), 'Governing Spec')].filter(Boolean),
      workspaceId,
      required: false,
      verifiable: true,
      relatedSpecifications: applicableSpecifications.filter(spec => text(spec.sectionNumber) === '28 23 00'),
      relatedSheets: sourceSheets.slice(0, 2),
      assessmentSection: 'SECURITY / PACS / CCTV',
      assessmentRequirement: 'Verify video surveillance and security coordination',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['SECURITY / PACS / CCTV'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Security-related coordination remains a review item when the governing evidence identifies it.'
    }));
  }

  if (relatedRooms.length) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'coordination', 'related-rooms']),
      title: 'Review related room dependencies',
      description: 'Confirm the related room sequence and coordination points before relying on this workspace alone.',
      category: 'COORDINATION',
      scope: 'WORKSPACE',
      status: 'NOT_VERIFIED',
      sourceType: 'Workspace registry',
      sourceRefs: relatedRooms.map(roomId => ({ kind: 'workspace', relationship: 'Related room', roomId, label: roomId })).slice(0, 4),
      workspaceId,
      required: false,
      verifiable: true,
      relatedIssues: list(issuesModel?.issues).filter(issue => issue.scope === 'ROOM'),
      relatedSpecifications: applicableSpecifications.slice(0, 2),
      relatedSheets: relatedSheetRefs.slice(0, 4).map(ref => ({ ...ref, relationship: 'Related Sheet' })),
      assessmentSection: 'ROOM INVENTORY',
      assessmentRequirement: 'Review related room dependencies',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['ROOM INVENTORY'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Related rooms are helpful for construction sequencing and dependency review.'
    }));
  }

  if (roomType === 'EXISTING_TRANSITION') {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'transition', 'inventory']),
      title: 'Inventory existing equipment and conditions',
      description: 'Document the existing room inventory before assuming the transition scope is complete.',
      category: 'DOCUMENTATION',
      scope: 'ROOM',
      status: 'NOT_VERIFIED',
      sourceType: 'Workspace registry',
      sourceRefs: [...sourceSheetRefs.slice(0, 2), firstSpecRef].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: true,
      relatedSpecifications: applicableSpecifications.slice(0, 3),
      relatedSheets: sourceSheets.slice(0, 2),
      assessmentSection: 'ROOM INVENTORY',
      assessmentRequirement: 'Inventory existing equipment and conditions',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['ROOM INVENTORY'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Existing / transition rooms require a current inventory check before migration work proceeds.'
    }));
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'transition', 'continuity']),
      title: 'Confirm active service continuity',
      description: 'Review the transition scope to keep active services available while the room is reworked.',
      category: 'COORDINATION',
      scope: 'WORKSPACE',
      status: scheduleBlocked ? 'BLOCKED' : 'NOT_VERIFIED',
      sourceType: 'Workspace registry',
      sourceRefs: [...sourceSheetRefs.slice(0, 2), firstSpecRef].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: true,
      blockedBy: scheduleIssue ? [scheduleIssue.id] : [],
      relatedIssues: scheduleIssue ? [scheduleIssue] : [],
      relatedSpecifications: applicableSpecifications.slice(0, 3),
      relatedSheets: sourceSheets.slice(0, 2),
      assessmentSection: 'CONSTRUCTION STATUS',
      assessmentRequirement: 'Confirm active service continuity',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['CONSTRUCTION STATUS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Service continuity stays dependent on the live transition sequence and schedule status.'
    }));
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'transition', 'migration']),
      title: 'Review turnover and migration dependencies',
      description: 'Confirm turnover and migration dependencies before planning any transition cutover.',
      category: 'COORDINATION',
      scope: 'WORKSPACE',
      status: appBlocked ? 'BLOCKED' : 'NOT_VERIFIED',
      sourceType: 'Workspace registry',
      sourceRefs: [...sourceSheetRefs.slice(0, 2), firstSpecRef].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: true,
      blockedBy: appIssue ? [appIssue.id] : [],
      relatedIssues: appIssue ? [appIssue] : [],
      relatedSpecifications: applicableSpecifications.slice(0, 3),
      relatedSheets: sourceSheets.slice(0, 2),
      relatedMilestones: appMilestone ? [appMilestone] : [],
      assessmentSection: 'OIT STATUS',
      assessmentRequirement: 'Review turnover and migration dependencies',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['OIT STATUS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Transition dependencies should not be marked complete while the APP date remains pending.'
    }));
  }

  if (pmisBuildingRecord) {
    const pmisEvidence = [
      { kind: 'pmis', relationship: 'PMIS readiness', building: building || pmisBuildingRecord.Building, label: `${normalizeBuildingKey(pmisBuildingRecord.Building) || 'Campus'} PMIS`, readinessPct: Number(pmisBuildingRecord.readinessPct || 0), openRisks: pmisRiskCount, openQuestions: pmisQuestionCount, status: pmisGateStatus || 'Monitor' }
    ];
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'oit', 'pmis-context']),
      title: 'Review PMIS activation context',
      description: 'Check the current PMIS building context for readiness, risks, and open questions before treating activation as complete.',
      category: 'OIT / ACTIVATION',
      scope: 'PROJECT',
      status: pmisRiskCount > 0 || pmisQuestionCount > 0 ? 'BLOCKED' : 'UNKNOWN',
      sourceType: 'PMIS runtime',
      sourceRefs: pmisEvidence,
      workspaceId,
      required: true,
      verifiable: true,
      blockedBy: pmisRiskCount > 0 || pmisQuestionCount > 0 ? ['pmis-context'] : [],
      relatedIssues: list(issuesModel?.issues).filter(issue => issue.scope === 'BUILDING' || issue.type === 'QUESTION' || issue.type === 'RISK' || issue.type === 'SHUTDOWN'),
      relatedSpecifications: applicableSpecifications.slice(0, 2),
      relatedSheets: sourceSheets.slice(0, 1),
      assessmentSection: 'OIT ACTIVATION READINESS',
      assessmentRequirement: 'Review PMIS activation context',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['OIT ACTIVATION READINESS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: pmisRiskCount > 0 || pmisQuestionCount > 0
        ? `PMIS reports ${pmisRiskCount} open risk(s) and ${pmisQuestionCount} open question(s) for ${normalizeBuildingKey(pmisBuildingRecord.Building) || building || 'the building'}.`
        : `PMIS provides readiness context for ${normalizeBuildingKey(pmisBuildingRecord.Building) || building || 'the building'} without an explicit blocker.`
    }));
  }

  if (scheduleIssue) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'coordination', 'room-schedule']),
      title: 'Room schedule confirmed',
      description: 'Room-level work remains blocked until the contractor schedule is received.',
      category: 'COORDINATION',
      scope: 'PROJECT',
      status: 'BLOCKED',
      sourceType: 'Workspace Issues & Risks',
      sourceRefs: [issueRef(scheduleIssue, 'Workspace issue')].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: false,
      blockedBy: [scheduleIssue.id],
      relatedIssues: [scheduleIssue],
      relatedMilestones: scheduleMilestone ? [scheduleMilestone] : [],
      assessmentSection: 'CONSTRUCTION STATUS',
      assessmentRequirement: 'Room schedule confirmed',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['CONSTRUCTION STATUS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'Waiting for the contractor schedule is a project dependency, not a failure.'
    }));
  }

  if (appIssue) {
    items.push(createChecklistItem({
      id: itemId([workspaceId, 'documentation', 'app']),
      title: 'APP / preconstruction gate reviewed',
      description: 'The Accident Prevention Plan remains pending until the preconstruction conference date is established.',
      category: 'DOCUMENTATION',
      scope: 'PROJECT',
      status: 'BLOCKED',
      sourceType: 'Workspace Issues & Risks',
      sourceRefs: [issueRef(appIssue, 'Workspace issue')].filter(Boolean),
      workspaceId,
      required: true,
      verifiable: false,
      blockedBy: [appIssue.id],
      relatedIssues: [appIssue],
      relatedMilestones: appMilestone ? [appMilestone] : [],
      assessmentSection: 'OWNER RISKS',
      assessmentRequirement: 'APP / preconstruction gate reviewed',
      assessmentRows: ASSESSMENT_SECTION_ROW_MAP['OWNER RISKS'],
      plannedInspectionWindow: scheduleModel.status,
      notes: 'The APP gate should stay blocked until the related milestone has a valid date.'
    }));
  }

  const filtered = items.sort((a, b) => checklistSortRank(a) - checklistSortRank(b));
  const inspectionPlan = filtered.map(item => {
    const verificationRecord = verificationRecordsByItemId.get(item.id) || null;
    const queueState = item.blockedBy?.length || item.status === 'BLOCKED'
      ? 'BLOCKED'
      : item.authoritative && ['VERIFIED_SESSION', 'PASS'].includes(text(item.verificationState).toUpperCase())
        ? 'COMPLETE'
        : item.sourceType === 'Workspace registry' && (
            item.title === 'Review source documentation'
            || item.title === 'Review PMIS activation context'
            || item.title === 'Review related room dependencies'
          )
          ? 'READY'
          : scheduleModel.hasDetailedActivitySchedule
            ? 'UPCOMING'
            : 'AWAITING_SCHEDULE';
    const verificationStatus = verificationRecord?.verificationStatus || text(item.verificationState).toUpperCase() || 'NOT_VERIFIED';
    const scheduleActivityId = scheduleModel.hasDetailedActivitySchedule ? scheduleModel.activities.find(activity => activity.workspaceId === item.workspaceId && (activity.trade === item.category || activity.system === item.category || activity.room === room || activity.phase === projectMilestoneContext?.projectPhase || activity.source?.recordId === item.id))?.activityId || null : null;
    const scheduleActivity = scheduleModel.hasDetailedActivitySchedule ? scheduleModel.activities.find(activity => activity.activityId === scheduleActivityId) || null : null;
    return Object.freeze({
      id: item.id,
      projectId: workspace?.projectId || projectMilestoneContext?.projectId || '',
      workspaceId: item.workspaceId || workspaceId,
      buildingId: building,
      roomId: room,
      trade: item.category,
      workPackage: text(item.scope || item.category || ''),
      scheduleActivityId,
      scheduleActivityName: scheduleActivity?.name || null,
      scheduleStart: scheduleActivity?.plannedStart || null,
      scheduleFinish: scheduleActivity?.plannedFinish || null,
      scheduleStatus: queueState,
      assessmentSheet: item.assessmentSource || ASSESSMENT_SOURCE_SHEET,
      assessmentSection: item.assessmentSection,
      assessmentRequirement: item.assessmentRequirement || item.title,
      assessmentRows: item.assessmentRows,
      drawingRefs: list(item.relatedSheets).map(ref => ref ? { ...ref } : null).filter(Boolean),
      specificationRefs: list(item.relatedSpecifications).map(ref => ref ? { ...ref } : null).filter(Boolean),
      status: queueState,
      blocked: queueState === 'BLOCKED',
      blockers: list(item.blockedBy).map(value => text(value)).filter(Boolean),
      verificationStatus,
      verifiedAt: verificationRecord?.verifiedAt || '',
      verifiedBy: verificationRecord?.verifiedBy || '',
      verificationNotes: verificationRecord?.notes || '',
      verificationEvidenceIds: list(verificationRecord?.evidenceIds),
      verificationIssueIds: list(verificationRecord?.issueIds),
      evidenceIds: [],
      issueIds: list(item.relatedIssues).map(issue => issue?.id || issue?.title).filter(Boolean),
      sourceBasis: [
        { kind: 'assessment', workbook: WORKBOOK_SOURCE, sheet: item.assessmentSource || ASSESSMENT_SOURCE_SHEET, section: item.assessmentSection, rows: item.assessmentRows },
        ...list(item.sourceRefs).map(ref => ({ kind: ref.kind || 'source', ...ref }))
      ]
    });
  });
  const inspectionPlanById = new Map(inspectionPlan.map(plan => [plan.id, plan]));
  const normalizedItems = filtered.map(item => ({
    ...item,
    queueState: inspectionPlanById.get(item.id)?.status || 'AWAITING_SCHEDULE',
    inspectionQueueState: inspectionPlanById.get(item.id)?.status || 'AWAITING_SCHEDULE',
    scheduleActivityId: inspectionPlanById.get(item.id)?.scheduleActivityId || null,
    scheduleActivityName: inspectionPlanById.get(item.id)?.scheduleActivityName || null,
    scheduleStart: inspectionPlanById.get(item.id)?.scheduleStart || null,
    scheduleFinish: inspectionPlanById.get(item.id)?.scheduleFinish || null,
    scheduleStatus: inspectionPlanById.get(item.id)?.scheduleStatus || 'AWAITING_SCHEDULE',
    verificationStatus: inspectionPlanById.get(item.id)?.verificationStatus || item.verificationState || 'NOT_VERIFIED',
    verifiedAt: inspectionPlanById.get(item.id)?.verifiedAt || '',
    verifiedBy: inspectionPlanById.get(item.id)?.verifiedBy || '',
    verificationNotes: inspectionPlanById.get(item.id)?.verificationNotes || '',
    verificationEvidenceIds: inspectionPlanById.get(item.id)?.verificationEvidenceIds || [],
    verificationIssueIds: inspectionPlanById.get(item.id)?.verificationIssueIds || [],
    inspectionPlan: inspectionPlanById.get(item.id) || null
  }));
  const counts = Object.freeze({
    applicableItems: normalizedItems.length,
    blocked: normalizedItems.filter(item => item.queueState === 'BLOCKED').length,
    unknown: normalizedItems.filter(item => item.verificationStatus === 'UNKNOWN' || item.verificationStatus === 'NOT_VERIFIED').length,
    reviewedThisSession: 0,
    pass: normalizedItems.filter(item => item.verificationStatus === 'PASS').length,
    fail: normalizedItems.filter(item => item.verificationStatus === 'FAIL').length,
    na: normalizedItems.filter(item => item.verificationStatus === 'NA').length,
    notVerified: normalizedItems.filter(item => item.verificationStatus === 'NOT_VERIFIED').length,
    ready: normalizedItems.filter(item => item.queueState === 'READY').length,
    active: normalizedItems.filter(item => item.queueState === 'ACTIVE').length,
    upcoming: normalizedItems.filter(item => item.queueState === 'UPCOMING').length,
    complete: normalizedItems.filter(item => item.queueState === 'COMPLETE').length,
    awaitingSchedule: normalizedItems.filter(item => item.queueState === 'AWAITING_SCHEDULE').length,
    room: normalizedItems.filter(item => item.category === 'ROOM').length,
    telecom: normalizedItems.filter(item => item.category === 'TELECOM').length,
    power: normalizedItems.filter(item => item.category === 'POWER' || item.category === 'GROUNDING / BONDING').length,
    oit: normalizedItems.filter(item => item.category === 'OIT / ACTIVATION').length,
    documentation: normalizedItems.filter(item => item.category === 'DOCUMENTATION').length,
    testing: normalizedItems.filter(item => item.category === 'TESTING').length,
    coordination: normalizedItems.filter(item => item.category === 'COORDINATION').length
  });

  return Object.freeze({
    workspaceId,
    workspaceRoom: room,
    workspaceName: text(workspace?.name || ''),
    building,
    level,
    disciplineFocus: text(workspace?.disciplineFocus || ''),
    schedule: scheduleModel,
    verificationModel: Object.freeze({
      states: Object.freeze(['NOT_VERIFIED', 'PASS', 'FAIL', 'NA']),
      defaultState: 'NOT_VERIFIED'
    }),
    items: normalizedItems,
    inspectionPlan,
    groups: groupChecklistItems(normalizedItems),
    overviewItems: normalizedItems.slice(0, 4),
    selectedItemId: normalizedItems.find(item => item.queueState === 'BLOCKED')?.id || normalizedItems[0]?.id || '',
    counts,
    filters: CHECKLIST_FILTERS.map(filter => ({
      ...filter,
      count: filter.id === 'all'
        ? normalizedItems.length
        : filter.id === 'blocked'
          ? counts.blocked
          : normalizedItems.filter(item => checklistFilterMatches(item, filter.id)).length
    })),
    emptyState: normalizedItems.length ? '' : 'No deterministic checklist items are available for this Workspace yet.'
  });
}

export function buildWorkspaceChecklistModel(options = {}) {
  return buildPrimaryWorkspaceChecklist(options);
}

export { buildWorkspaceScheduleModel, checklistFilterMatches, inspectionQueueStateLabel, inspectionVerificationLabel };
