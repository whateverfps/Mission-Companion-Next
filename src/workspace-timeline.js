import { workspaceDrawingDocumentIdForPage } from './workspace-documents.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

const TIMELINE_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'contract', label: 'Contract' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'safety', label: 'Safety' },
  { id: 'coordination', label: 'Coordination' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'pending', label: 'Pending' }
]);

const CATEGORY_FILTER_MAP = Object.freeze({
  CONTRACT: 'contract',
  SUBMITTAL: 'contract',
  SCHEDULE: 'schedule',
  SAFETY: 'safety',
  COORDINATION: 'coordination',
  WORKSPACE: 'workspace'
});

const STATUS_BUCKET = Object.freeze({
  COMPLETE: 'past',
  OVERDUE: 'past',
  DUE: 'current',
  UPCOMING: 'upcoming',
  PENDING_DATE: 'pending',
  AWAITING_SOURCE: 'pending',
  UNKNOWN: 'pending'
});

const STATUS_ORDER = Object.freeze({
  COMPLETE: 0,
  DUE: 1,
  OVERDUE: 2,
  UPCOMING: 3,
  PENDING_DATE: 4,
  AWAITING_SOURCE: 5,
  UNKNOWN: 6
});

function normalizeBuildingKey(value) {
  const raw = text(value).replace(/^building\s*/i, '').replace(/^b/i, '').trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return raw.padStart(2, '0');
  return raw.toUpperCase();
}

function formatTimelineDate(dateText = '') {
  if (!dateText) return '';
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return text(dateText);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function compareDates(a = '', b = '') {
  const aValue = Number.isNaN(new Date(`${text(a)}T00:00:00Z`).getTime()) ? Number.POSITIVE_INFINITY : new Date(`${text(a)}T00:00:00Z`).getTime();
  const bValue = Number.isNaN(new Date(`${text(b)}T00:00:00Z`).getTime()) ? Number.POSITIVE_INFINITY : new Date(`${text(b)}T00:00:00Z`).getTime();
  return aValue - bValue;
}

function createSourceRef({
  kind = 'document',
  relationship = '',
  label = '',
  detail = '',
  documentId = '',
  title = '',
  openTarget = null,
  sheetNumber = '',
  sectionNumber = '',
  id = ''
} = {}) {
  return {
    kind: text(kind),
    relationship: text(relationship),
    label: text(label),
    detail: text(detail),
    documentId: text(documentId),
    title: text(title),
    sheetNumber: text(sheetNumber),
    sectionNumber: text(sectionNumber),
    id: text(id),
    openTarget: openTarget ? { ...openTarget } : null
  };
}

function createMilestoneSourceRef(milestone = {}) {
  const documentId = text(milestone.sourceDocumentId || milestone.sourceDocument?.id || '');
  return createSourceRef({
    kind: 'document',
    relationship: text(milestone.source || milestone.sourceType || 'Milestone'),
    label: text(milestone.sourceDocumentTitle || milestone.sourceDocument?.title || milestone.sourceDocument?.name || milestone.sourceDocument?.id || milestone.source || 'Source document'),
    detail: text(milestone.sourceDocumentTitle || milestone.sourceDocument?.name || milestone.sourceDocument?.id || ''),
    documentId,
    title: text(milestone.sourceDocumentTitle || milestone.sourceDocument?.name || milestone.sourceDocument?.id || milestone.name || milestone.id),
    openTarget: documentId ? { kind: 'source', documentId, destination: 'sources' } : null
  });
}

function createIssueSourceRef(issue = {}) {
  return createSourceRef({
    kind: 'issue',
    relationship: text(issue.source || issue.sourceType || 'Workspace issue'),
    label: text(issue.title || issue.label || issue.id || 'Issue'),
    detail: text(issue.description || issue.impact || issue.status || ''),
    id: text(issue.id)
  });
}

function createChecklistSourceRef(item = {}) {
  return createSourceRef({
    kind: 'checklist',
    relationship: 'Checklist',
    label: text(item.title || item.id || 'Checklist item'),
    detail: text(item.notes || item.description || item.status || ''),
    id: text(item.id)
  });
}

function statusFromMilestone(milestone = {}, now = new Date()) {
  const dueDate = text(milestone.dueDate);
  const milestoneStatus = text(milestone.status).toUpperCase();
  if (milestoneStatus === 'COMPLETE') return 'COMPLETE';
  if (milestoneStatus === 'PENDING-DATE') return 'PENDING_DATE';
  if (milestoneStatus === 'AWAITING-SCHEDULE' && !dueDate) return 'AWAITING_SOURCE';
  if (milestoneStatus === 'AWAITING-SUBMISSION') return dueDate ? compareDates(dueDate, now.toISOString().slice(0, 10)) <= 0 ? 'DUE' : 'UPCOMING' : 'AWAITING_SOURCE';
  if (!dueDate) return 'UNKNOWN';
  const comparison = compareDates(dueDate, now.toISOString().slice(0, 10));
  if (comparison < 0) return 'OVERDUE';
  if (comparison === 0) return 'DUE';
  return 'UPCOMING';
}

function timelineBucketForStatus(status = '') {
  return STATUS_BUCKET[text(status).toUpperCase()] || 'pending';
}

function filterMatches(item = {}, filterId = 'all') {
  const filter = text(filterId).toLowerCase();
  if (!filter || filter === 'all') return true;
  if (filter === 'pending') return ['PENDING_DATE', 'AWAITING_SOURCE', 'UNKNOWN'].includes(text(item.status).toUpperCase());
  return filter === (CATEGORY_FILTER_MAP[text(item.category).toUpperCase()] || '');
}

function createTimelineRecord({
  id,
  title,
  description,
  date = '',
  dateLabel = '',
  dateType = 'UNKNOWN',
  status = 'UNKNOWN',
  scope = 'PROJECT',
  category = 'CONTRACT',
  sourceType = '',
  sourceRefs = [],
  workspaceId = '',
  building = '',
  room = '',
  relatedIssues = [],
  relatedChecklistItems = [],
  relatedDocuments = [],
  authoritative = false,
  nextStep = '',
  workspaceImpact = ''
}) {
  return Object.freeze({
    id: text(id),
    title: text(title),
    description: text(description),
    date: text(date),
    dateLabel: text(dateLabel),
    dateType: text(dateType).toUpperCase() || 'UNKNOWN',
    status: text(status).toUpperCase() || 'UNKNOWN',
    scope: text(scope).toUpperCase() || 'PROJECT',
    category: text(category).toUpperCase() || 'CONTRACT',
    sourceType: text(sourceType),
    sourceRefs: list(sourceRefs).map(ref => ref ? { ...ref } : null).filter(Boolean),
    workspaceId: text(workspaceId),
    building: text(building),
    room: text(room),
    relatedIssues: list(relatedIssues).map(item => item ? { ...item } : null).filter(Boolean),
    relatedChecklistItems: list(relatedChecklistItems).map(item => item ? { ...item } : null).filter(Boolean),
    relatedDocuments: list(relatedDocuments).map(item => item ? { ...item } : null).filter(Boolean),
    authoritative: Boolean(authoritative),
    nextStep: text(nextStep),
    workspaceImpact: text(workspaceImpact),
    bucket: timelineBucketForStatus(status)
  });
}

function sortTimelineRecords(a = {}, b = {}) {
  return (compareDates(a.date, b.date) || 0)
    || (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    || a.title.localeCompare(b.title)
    || a.id.localeCompare(b.id);
}

function buildTimelineMilestoneRecord(milestone = {}, { workspace = null, checklistModel = null, issuesModel = null, now = new Date() } = {}) {
  const workspaceId = text(workspace?.id || '');
  const building = normalizeBuildingKey(workspace?.building);
  const room = text(workspace?.room || workspace?.id || '');
  const status = statusFromMilestone(milestone, now);
  const milestoneId = text(milestone.id || milestone.name || milestone.sectionNumber);
  const issueList = list(issuesModel?.issues);
  const checklistItems = list(checklistModel?.items);
  const relatedIssues = issueList.filter(issue => {
    if (milestoneId === 'interim-project-schedule') return text(issue.title) === 'Awaiting Contractor Schedule';
    if (milestoneId === 'accident-prevention-plan') return text(issue.title) === 'APP Date Pending';
    return false;
  });
  const relatedChecklistItems = checklistItems.filter(item => {
    if (milestoneId === 'interim-project-schedule') return list(item.blockedBy).some(blocker => /schedule/i.test(blocker)) || /schedule/i.test(text(item.title));
    if (milestoneId === 'accident-prevention-plan') return /app/i.test(text(item.title)) || /preconstruction/i.test(text(item.title));
    return false;
  });
  const sourceRefs = [createMilestoneSourceRef(milestone)].filter(ref => ref.documentId || ref.label);
  const isPending = ['PENDING_DATE', 'AWAITING_SOURCE', 'UNKNOWN'].includes(status);
  return createTimelineRecord({
    id: milestoneId,
    title: text(milestone.name || milestone.label || milestoneId),
    description: text(milestone.notes || milestone.detail || ''),
    date: text(milestone.dueDate || ''),
    dateLabel: text(milestone.dueDateLabel || (milestone.dueDate ? formatTimelineDate(milestone.dueDate) : milestone.label || milestone.name || milestoneId)),
    dateType: status === 'PENDING_DATE' ? 'PENDING_DATE' : status === 'AWAITING_SOURCE' ? 'AWAITING_SOURCE' : milestone.dueDate ? 'AUTHORITATIVE' : 'UNKNOWN',
    status,
    scope: text(milestone.scope || 'PROJECT'),
    category: text(milestone.category || 'CONTRACT'),
    sourceType: text(milestone.sourceType || 'NTP / Contractual'),
    sourceRefs,
    workspaceId,
    building,
    room,
    relatedIssues,
    relatedChecklistItems,
    relatedDocuments: sourceRefs.filter(ref => ref.documentId),
    authoritative: Boolean(milestone.dueDate || status === 'COMPLETE' || status === 'DUE' || status === 'UPCOMING' || status === 'OVERDUE' || milestone.sourceDocumentId),
    nextStep: milestoneId === 'interim-project-schedule'
      ? 'Review contractor interim schedule when received.'
      : milestoneId === 'accident-prevention-plan'
        ? 'Confirm the preconstruction conference date to release the APP milestone.'
        : '',
    workspaceImpact: milestoneId === 'interim-project-schedule'
      ? `Room-level construction dates remain unavailable for ${room || workspaceId || 'this workspace'}.`
      : milestoneId === 'accident-prevention-plan'
        ? 'APP cannot be treated as scheduled until the preconstruction conference date is established.'
        : ''
  });
}

function buildRoomScheduleRecord({ workspace = null, projectMilestoneContext = null, checklistModel = null, issuesModel = null } = {}) {
  const workspaceId = text(workspace?.id || '');
  const building = normalizeBuildingKey(workspace?.building);
  const room = text(workspace?.room || workspace?.id || '');
  const scheduleIssue = list(issuesModel?.issues).find(issue => /awaiting contractor schedule/i.test(text(issue.title))) || null;
  const roomScheduleStatus = text(projectMilestoneContext?.roomScheduleStatus || 'Awaiting Contractor Schedule');
  const roomScheduleLabel = text(projectMilestoneContext?.roomScheduleLabel || `Room Schedule: ${roomScheduleStatus}`);
  const relatedChecklistItems = list(checklistModel?.items).filter(item => list(item.blockedBy).some(blocker => /schedule/i.test(blocker)));
  const relatedIssues = scheduleIssue ? [scheduleIssue] : [];
  const sourceRefs = [
    createSourceRef({
      kind: 'milestone',
      relationship: 'Project milestone',
      label: 'Interim Project Schedule',
      detail: roomScheduleStatus,
      id: 'interim-project-schedule'
    }),
    ...relatedIssues.map(issue => createIssueSourceRef(issue))
  ];
  return createTimelineRecord({
    id: itemId(['room-schedule', workspaceId]),
    title: 'Room Schedule',
    description: roomScheduleStatus,
    date: '',
    dateLabel: roomScheduleLabel,
    dateType: 'AWAITING_SOURCE',
    status: 'AWAITING_SOURCE',
    scope: 'WORKSPACE',
    category: 'SCHEDULE',
    sourceType: 'Project milestone model',
    sourceRefs,
    workspaceId,
    building,
    room,
    relatedIssues,
    relatedChecklistItems,
    relatedDocuments: sourceRefs.filter(ref => ref.documentId),
    authoritative: true,
    nextStep: 'Review the contractor schedule when it is received.',
    workspaceImpact: `${room || workspaceId || 'Workspace'} schedule remains ${roomScheduleStatus.toLowerCase()}.`
  });
}

function buildTransitionRecord({ workspace = null, checklistModel = null, issuesModel = null } = {}) {
  if (text(workspace?.type).toUpperCase() !== 'EXISTING_TRANSITION') return null;
  const workspaceId = text(workspace?.id || '');
  const building = normalizeBuildingKey(workspace?.building);
  const room = text(workspace?.room || workspace?.id || '');
  const sourceRefs = list(workspace?.sourceSheets).slice(0, 2).map(sheet => createSourceRef({
    kind: 'drawing',
    relationship: 'Transition evidence',
    label: text(sheet.sheetNumber || ''),
    detail: text(sheet.sheetTitle || ''),
    sheetNumber: text(sheet.sheetNumber),
    documentId: workspaceDrawingDocumentIdForPage(sheet.pageId) || text(sheet.documentId),
    title: text(sheet.sheetTitle),
    openTarget: (workspaceDrawingDocumentIdForPage(sheet.pageId) || text(sheet.documentId)) ? {
      kind: 'drawing',
      documentId: workspaceDrawingDocumentIdForPage(sheet.pageId) || text(sheet.documentId),
      sheetId: text(sheet.sheetNumber),
      sheetNumber: text(sheet.sheetNumber),
      pageId: text(sheet.pageId),
      pageNumber: Number(sheet.pdfPageNumber) || 0
    } : null
  }));
  const checklistItems = list(checklistModel?.items).filter(item => /transition|continuity|migration/i.test(text(item.title)));
  const relatedIssues = list(issuesModel?.issues).filter(issue => issue.scope === 'ROOM');
  return createTimelineRecord({
    id: itemId(['transition', workspaceId, 'planning']),
    title: 'Transition Planning',
    description: 'Transition planning remains dependent on the contractor schedule and existing service continuity.',
    date: '',
    dateLabel: 'Awaiting contractor schedule',
    dateType: 'AWAITING_SOURCE',
    status: 'AWAITING_SOURCE',
    scope: 'WORKSPACE',
    category: 'COORDINATION',
    sourceType: 'Workspace registry',
    sourceRefs,
    workspaceId,
    building,
    room,
    relatedIssues,
    relatedChecklistItems: checklistItems,
    relatedDocuments: sourceRefs.filter(ref => ref.documentId),
    authoritative: true,
    nextStep: 'Review the transition checklist when the contractor schedule is available.',
    workspaceImpact: 'The transition workspace cannot be fully sequenced until the contractor schedule is received.'
  });
}

function itemId(parts = []) {
  return parts.map(value => text(value)).filter(Boolean).join('|');
}

export function buildWorkspaceTimelineModel({
  workspace = null,
  projectMilestoneContext = null,
  issuesModel = null,
  checklistModel = null,
  now = new Date()
} = {}) {
  const timeline = [];
  const milestoneSource = list(projectMilestoneContext?.milestones).length
    ? list(projectMilestoneContext?.milestones)
    : list(projectMilestoneContext?.timeline);
  for (const milestone of milestoneSource) {
    timeline.push(buildTimelineMilestoneRecord(milestone, { workspace, checklistModel, issuesModel, now }));
  }

  const roomScheduleRecord = buildRoomScheduleRecord({ workspace, projectMilestoneContext, checklistModel, issuesModel });
  if (roomScheduleRecord) timeline.push(roomScheduleRecord);

  const transitionRecord = buildTransitionRecord({ workspace, checklistModel, issuesModel });
  if (transitionRecord) timeline.push(transitionRecord);

  const deduped = [];
  const seen = new Set();
  for (const item of timeline) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  const items = deduped.sort(sortTimelineRecords);
  const summaryItems = items.slice(0, 4);
  const nextContractualMilestone = items.find(item => ['UPCOMING', 'DUE'].includes(item.status) && item.authoritative && item.date) || items.find(item => item.authoritative && item.date) || null;
  const contractCompletion = items.find(item => item.id === 'contract-completion') || null;
  const counts = Object.freeze({
    total: items.length,
    complete: items.filter(item => item.status === 'COMPLETE').length,
    due: items.filter(item => item.status === 'DUE').length,
    overdue: items.filter(item => item.status === 'OVERDUE').length,
    upcoming: items.filter(item => item.status === 'UPCOMING').length,
    pendingDate: items.filter(item => item.status === 'PENDING_DATE').length,
    awaitingSource: items.filter(item => item.status === 'AWAITING_SOURCE').length,
    unknown: items.filter(item => item.status === 'UNKNOWN').length
  });
  const filters = TIMELINE_FILTERS.map(filter => ({
    ...filter,
    count: filter.id === 'all'
      ? items.length
      : filter.id === 'pending'
        ? items.filter(item => ['PENDING_DATE', 'AWAITING_SOURCE', 'UNKNOWN'].includes(item.status)).length
        : items.filter(item => filterMatches(item, filter.id)).length
  }));
  const summary = Object.freeze({
    projectPhase: text(projectMilestoneContext?.projectPhase || 'Preconstruction'),
    nextContractualMilestone: nextContractualMilestone ? {
      title: nextContractualMilestone.title,
      dateLabel: nextContractualMilestone.date ? formatTimelineDate(nextContractualMilestone.date) : nextContractualMilestone.description || 'Pending date',
      status: nextContractualMilestone.status
    } : null,
    contractCompletion: contractCompletion ? {
      title: contractCompletion.title,
      dateLabel: contractCompletion.date ? formatTimelineDate(contractCompletion.date) : contractCompletion.description || 'Pending date',
      status: contractCompletion.status
    } : null,
    roomScheduleStatus: text(projectMilestoneContext?.roomScheduleStatus || 'Awaiting Contractor Schedule'),
    currentPhaseLabel: text(projectMilestoneContext?.currentProjectStatus || `Project Phase: ${projectMilestoneContext?.projectPhase || 'Preconstruction'}`),
    roomScheduleLabel: text(projectMilestoneContext?.roomScheduleLabel || 'Room Schedule: Awaiting Contractor Schedule')
  });

  return Object.freeze({
    workspaceId: text(workspace?.id || ''),
    workspaceRoom: text(workspace?.room || workspace?.id || ''),
    workspaceName: text(workspace?.name || ''),
    building: normalizeBuildingKey(workspace?.building),
    level: text(workspace?.level || ''),
    disciplineFocus: text(workspace?.disciplineFocus || ''),
    projectPhase: summary.projectPhase,
    roomScheduleStatus: summary.roomScheduleStatus,
    items,
    overviewItems: summaryItems,
    filters,
    counts,
    summary,
    selectedItemId: items.find(item => item.status === 'UPCOMING' || item.status === 'DUE')?.id || items[0]?.id || ''
  });
}

export function timelineFilterMatches(item, filterId = 'all') {
  return filterMatches(item, filterId);
}

export function workspaceTimelineStatusLabel(status = '') {
  const value = text(status).toUpperCase();
  return value === 'COMPLETE'
    ? 'COMPLETE'
    : value === 'DUE'
      ? 'DUE'
      : value === 'OVERDUE'
        ? 'OVERDUE'
        : value === 'UPCOMING'
          ? 'UPCOMING'
          : value === 'PENDING_DATE'
            ? 'PENDING DATE'
            : value === 'AWAITING_SOURCE'
              ? 'AWAITING SOURCE'
              : 'UNKNOWN';
}
