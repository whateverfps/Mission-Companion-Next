import { BEDFORD_NTP_SOURCE_DOCUMENT } from './workspace-milestones.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

const severityRank = Object.freeze({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 });
const scopeRank = Object.freeze({ ROOM: 0, BUILDING: 1, PROJECT: 2 });
const statusRank = Object.freeze({ BLOCKED: 0, OPEN: 1, PENDING: 2, WATCH: 3, RESOLVED: 4, NO_DATA: 5 });
const filterIds = Object.freeze(['all', 'workspace', 'building', 'project', 'risk', 'question', 'schedule', 'coordination']);

function normalizeBuildingKey(value) {
  const raw = text(value).replace(/^building\s*/i, '').replace(/^b/i, '').trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return raw.padStart(2, '0');
  return raw.toUpperCase();
}

function buildingLabel(value) {
  const key = normalizeBuildingKey(value);
  return key ? `Building ${key}` : 'Campus';
}

function isOpenStatus(status = '') {
  const value = text(status).toUpperCase();
  return !value || !['RESOLVED', 'CLOSED', 'COMPLETE', 'COMPLETED', 'CANCELLED', 'CANCELED', 'NO DATA'].includes(value);
}

function isPlaceholderRoomIssue(item = {}) {
  return /no room-specific issues recorded/i.test(text(item.label || item.title || ''))
    || /does not have separate issue data yet/i.test(text(item.detail || item.description || ''));
}

function issueKey(parts = []) {
  return parts.map(value => text(value)).filter(Boolean).join('|');
}

function issueSourceDocument(projectMilestoneContext = null) {
  return projectMilestoneContext?.sourceDocument || BEDFORD_NTP_SOURCE_DOCUMENT;
}

function createIssue({
  id,
  title,
  description,
  type,
  scope,
  severity,
  status,
  source,
  sourceType,
  workspaceId,
  building,
  room,
  relatedRooms = [],
  relatedSheets = [],
  relatedSpecifications = [],
  relatedMilestones = [],
  evidence = [],
  impact = '',
  recommendedNextStep = '',
  sourceDocument = null
}) {
  return Object.freeze({
    id: text(id),
    title: text(title),
    description: text(description),
    type: text(type).toUpperCase() || 'DEPENDENCY',
    scope: text(scope).toUpperCase() || 'PROJECT',
    severity: text(severity).toUpperCase() || 'INFO',
    status: text(status).toUpperCase() || 'OPEN',
    source: text(source),
    sourceType: text(sourceType),
    workspaceId: text(workspaceId),
    building: text(building),
    room: text(room),
    relatedRooms: list(relatedRooms).map(value => text(value)).filter(Boolean),
    relatedSheets: list(relatedSheets).map(item => ({
      sheetNumber: text(item?.sheetNumber),
      sheetTitle: text(item?.sheetTitle),
      discipline: text(item?.discipline),
      level: text(item?.level),
      documentId: text(item?.documentId),
      pageId: text(item?.pageId),
      relationship: text(item?.relationship)
    })).filter(item => item.sheetNumber || item.sheetTitle),
    relatedSpecifications: list(relatedSpecifications).map(item => ({
      sectionNumber: text(item?.sectionNumber),
      sectionTitle: text(item?.sectionTitle),
      sourceLabel: text(item?.sourceLabel),
      relationship: text(item?.relationship)
    })).filter(item => item.sectionNumber || item.sectionTitle),
    relatedMilestones: list(relatedMilestones).map(item => ({
      id: text(item?.id),
      label: text(item?.label || item?.name),
      dueDate: text(item?.dueDate),
      dueDateLabel: text(item?.dueDateLabel),
      status: text(item?.status),
      category: text(item?.category),
      scope: text(item?.scope),
      source: text(item?.source)
    })).filter(item => item.id || item.label),
    evidence: list(evidence).map(item => ({
      label: text(item?.label),
      detail: text(item?.detail),
      openTarget: item?.openTarget ? { ...item.openTarget } : null
    })).filter(item => item.label || item.detail || item.openTarget),
    impact: text(impact),
    recommendedNextStep: text(recommendedNextStep),
    sourceDocument: sourceDocument ? {
      id: text(sourceDocument.id),
      title: text(sourceDocument.originalFilename || sourceDocument.name || sourceDocument.title || sourceDocument.id),
      staticPath: text(sourceDocument.staticPath || '')
    } : null
  });
}

function issueMatchesFilter(issue, filterId = 'all') {
  if (!issue) return false;
  const filter = text(filterId).toLowerCase();
  if (!filter || filter === 'all') return true;
  if (filter === 'workspace') return issue.scope === 'ROOM';
  if (filter === 'building') return issue.scope === 'BUILDING';
  if (filter === 'project') return issue.scope === 'PROJECT';
  if (filter === 'risk') return issue.type === 'RISK';
  if (filter === 'question') return issue.type === 'QUESTION';
  if (filter === 'schedule') return issue.type === 'SCHEDULE';
  if (filter === 'coordination') return issue.type === 'COORDINATION' || issue.type === 'SHUTDOWN';
  return true;
}

function sortIssues(a, b) {
  return (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99)
    || (scopeRank[a.scope] ?? 99) - (scopeRank[b.scope] ?? 99)
    || (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99)
    || a.title.localeCompare(b.title)
    || a.id.localeCompare(b.id);
}

function resolveWorkspaceBuildingKey(workspace = {}) {
  return normalizeBuildingKey(workspace?.building || workspace?.pmisBuilding || '');
}

function buildWorkspaceRoomIssues(workspace = {}) {
  const issues = [];
  const workspaceId = text(workspace?.id);
  const building = text(workspace?.building);
  const room = text(workspace?.room || workspace?.id);
  const roomIssues = list(workspace?.issues).filter(item => !isPlaceholderRoomIssue(item));
  for (const issue of roomIssues) {
    const title = text(issue.label || issue.title);
    issues.push(createIssue({
      id: issueKey(['room', workspaceId, title]),
      title,
      description: text(issue.detail || issue.description),
      type: 'DOCUMENTATION',
      scope: 'ROOM',
      severity: workspace?.type === 'EXISTING_TRANSITION' ? 'INFO' : 'LOW',
      status: 'OPEN',
      source: 'Workspace registry',
      sourceType: 'Workspace registry',
      workspaceId,
      building,
      room,
      relatedRooms: list(workspace?.relatedRooms),
      relatedSheets: (list(workspace?.sourceSheets).slice(0, 2)).map(sheet => ({
        sheetNumber: sheet.sheetNumber,
        sheetTitle: sheet.sheetTitle,
        discipline: sheet.discipline,
        level: sheet.level,
        documentId: sheet.documentId,
        pageId: sheet.pageId,
        relationship: 'Workspace Source'
      })),
      relatedSpecifications: list(workspace?.applicableSpecifications).slice(0, 3).map(spec => ({
        sectionNumber: spec.sectionNumber,
        sectionTitle: spec.sectionTitle,
        sourceLabel: 'Applicable specification',
        relationship: 'Workspace Specification'
      })),
      impact: `${room || workspaceId || 'Workspace'} inventory needs review before relying on legacy assumptions.`,
      recommendedNextStep: 'Review the current room inventory and reconcile with the source sheets.',
      evidence: [
        { label: 'Workspace record', detail: `${room || workspaceId || 'Workspace'} / ${workspace?.name || 'Workspace'}` },
        { label: 'Room scope', detail: room || workspaceId || 'Workspace' }
      ]
    }));
  }
  return issues;
}

function buildMilestoneIssues(projectMilestoneContext = null, workspace = null) {
  if (!projectMilestoneContext) return [];
  const sourceDocument = issueSourceDocument(projectMilestoneContext);
  const workspaceId = text(workspace?.id);
  const building = text(workspace?.building);
  const room = text(workspace?.room || workspace?.id);
  const issues = [];
  if (text(projectMilestoneContext.roomScheduleStatus).toLowerCase().includes('awaiting contractor schedule')) {
    issues.push(createIssue({
      id: issueKey(['milestone', workspaceId, 'awaiting-contractor-schedule']),
      title: 'Awaiting Contractor Schedule',
      description: 'Room-level construction dates are not yet available until the interim contractor schedule is received.',
      type: 'SCHEDULE',
      scope: 'PROJECT',
      severity: 'MEDIUM',
      status: 'PENDING',
      source: 'Project milestone model',
      sourceType: 'NTP / Contractual',
      workspaceId,
      building,
      room,
      relatedMilestones: list(projectMilestoneContext.milestones).filter(item => /schedule/i.test(text(item?.category) || text(item?.name))).slice(0, 2),
      evidence: [
        { label: 'NTP', detail: text(projectMilestoneContext.ntpDateLabel || projectMilestoneContext.ntpDate), openTarget: { kind: 'source', documentId: sourceDocument.id, destination: 'sources' } },
        { label: 'Contract completion', detail: text(projectMilestoneContext.contractCompletionDateLabel || projectMilestoneContext.contractCompletionDate), openTarget: { kind: 'source', documentId: sourceDocument.id, destination: 'sources' } }
      ],
      impact: 'Room-level construction sequencing cannot be finalized yet.',
      recommendedNextStep: 'Review the interim contractor schedule when it is submitted.',
      sourceDocument
    }));
  }
  const scheduleMilestone = list(projectMilestoneContext.milestones).find(item => text(item.category).toLowerCase() === 'schedule' && /awaiting/i.test(text(item.status)));
  if (scheduleMilestone) {
    issues.push(createIssue({
      id: issueKey(['milestone', workspaceId, scheduleMilestone.id || scheduleMilestone.name || 'schedule']),
      title: scheduleMilestone.name || scheduleMilestone.label || 'Project Schedule Pending',
      description: scheduleMilestone.notes || 'The project schedule milestone remains unresolved.',
      type: 'SCHEDULE',
      scope: 'PROJECT',
      severity: 'INFO',
      status: 'PENDING',
      source: 'Project milestone model',
      sourceType: 'NTP / Contractual',
      workspaceId,
      building,
      room,
      relatedMilestones: [scheduleMilestone],
      evidence: [
        { label: scheduleMilestone.name || 'Schedule milestone', detail: scheduleMilestone.dueDateLabel || scheduleMilestone.status, openTarget: { kind: 'source', documentId: sourceDocument.id, destination: 'sources' } }
      ],
      impact: 'Construction sequencing remains dependent on milestone submission.',
      recommendedNextStep: 'Monitor the submitted schedule and confirm the task sequence.',
      sourceDocument
    }));
  }
  const appMilestone = list(projectMilestoneContext.milestones).find(item => text(item.id) === 'accident-prevention-plan' || /accident prevention plan/i.test(text(item.name)));
  if (appMilestone && /pending-date/i.test(text(appMilestone.status))) {
    issues.push(createIssue({
      id: issueKey(['milestone', workspaceId, 'app-date-pending']),
      title: 'APP Date Pending',
      description: 'The Accident Prevention Plan remains pending until the preconstruction conference date is established.',
      type: 'DEPENDENCY',
      scope: 'PROJECT',
      severity: 'INFO',
      status: 'PENDING',
      source: 'Project milestone model',
      sourceType: 'NTP / Contractual',
      workspaceId,
      building,
      room,
      relatedMilestones: [appMilestone],
      evidence: [
        { label: appMilestone.name || 'Accident Prevention Plan', detail: appMilestone.dueDateLabel || 'Pending date', openTarget: { kind: 'source', documentId: sourceDocument.id, destination: 'sources' } }
      ],
      impact: 'The APP cannot be fully scheduled until that date is established.',
      recommendedNextStep: 'Establish the preconstruction conference date and update the APP milestone.',
      sourceDocument
    }));
  }
  return issues;
}

function buildPmisIssues({ workspace = null, pmisRuntime = null } = {}) {
  const data = pmisRuntime && typeof pmisRuntime === 'object' ? pmisRuntime : {};
  const workspaceId = text(workspace?.id);
  const building = text(workspace?.building || workspace?.pmisBuilding);
  const buildingKey = resolveWorkspaceBuildingKey(workspace || {});
  const issues = [];
  const buildings = list(data.buildings);
  const buildingRecord = buildings.find(item => normalizeBuildingKey(item?.Building) === buildingKey || normalizeBuildingKey(item?.Building) === normalizeBuildingKey(building));

  if (buildingRecord) {
    const openRisks = Math.max(0, Math.round(Number(buildingRecord['Open Risks'] || buildingRecord.openRisks || 0)));
    const openQuestions = Math.max(0, Math.round(Number(buildingRecord['Open Questions'] || buildingRecord.openQuestions || 0)));
    const readinessPct = Math.max(0, Math.round(Number(buildingRecord.readinessPct ?? buildingRecord.Readiness ?? buildingRecord['Sheet Readiness'] ?? 0)));
    if (openRisks > 0 || openQuestions > 0) {
      issues.push(createIssue({
        id: issueKey(['pmis', buildingKey || workspaceId || 'campus', 'readiness']),
        title: `${buildingLabel(buildingRecord.Building)} PMIS readiness attention`,
        description: `${buildingLabel(buildingRecord.Building)} reports ${openRisks} open risk(s) and ${openQuestions} open question(s).`,
        type: openRisks > 0 ? 'RISK' : openQuestions > 0 ? 'QUESTION' : 'READINESS',
        scope: 'BUILDING',
        severity: openRisks >= 5 ? 'HIGH' : openRisks > 0 || openQuestions > 0 ? 'MEDIUM' : 'INFO',
        status: 'OPEN',
        source: 'PMIS runtime',
        sourceType: 'PMIS workbook',
        workspaceId,
        building: buildingKey || workspace?.building || '',
        room: text(workspace?.room || workspace?.id),
        relatedMilestones: [],
        evidence: [
          { label: 'Readiness', detail: `${readinessPct}%` },
          { label: 'Open risks', detail: `${openRisks}` },
          { label: 'Open questions', detail: `${openQuestions}` }
        ],
        impact: `PMIS continues to flag ${buildingLabel(buildingRecord.Building)} for follow-up.`,
        recommendedNextStep: 'Review the PMIS dashboard for current building attention items.'
      }));
    }
  }

  const shutdowns = list(data.shutdowns).filter(item => {
    const itemBuilding = normalizeBuildingKey(item?.Building || item?.['Affected Building'] || item?.['Building / Area']);
    return !buildingKey || itemBuilding === buildingKey;
  }).filter(item => isOpenStatus(item?.Status));
  if (shutdowns.length) {
    issues.push(createIssue({
      id: issueKey(['pmis', buildingKey || workspaceId || 'campus', 'shutdowns']),
      title: 'Active shutdown coordination',
      description: `${shutdowns.length} active shutdown record${shutdowns.length === 1 ? '' : 's'} remain open for ${buildingLabel(buildingKey || workspace?.building || '')}.`,
      type: 'SHUTDOWN',
      scope: buildingKey ? 'BUILDING' : 'PROJECT',
      severity: shutdowns.length > 2 ? 'HIGH' : 'MEDIUM',
      status: 'OPEN',
      source: 'PMIS runtime',
      sourceType: 'PMIS workbook',
      workspaceId,
      building: buildingKey || workspace?.building || '',
      room: text(workspace?.room || workspace?.id),
      relatedMilestones: [],
      evidence: shutdowns.slice(0, 4).map(item => ({
        label: text(item.Title || item.System || item['Shutdown ID'] || item.ID || 'Shutdown'),
        detail: text(item.Status || 'Open'),
        openTarget: null
      })),
      impact: 'Shutdown coordination can affect sequencing and access for the workspace.',
      recommendedNextStep: 'Review the active shutdown records before planning field work.'
    }));
  }

  const register = list(data.projectRegister);
  const questionRecords = register.filter(record => {
    const haystack = [
      record?.['Record Type'],
      record?.Type,
      record?.Category,
      record?.Title,
      record?.Description,
      record?.Issue,
      record?.Question
    ].map(text).join(' ').toLowerCase();
    return /\bquestion(s)?\b/.test(haystack);
  }).filter(record => {
    const recordBuilding = normalizeBuildingKey(record?.Building || record?.['Affected Building'] || record?.['Building / Area'] || record?.building);
    return !buildingKey || !recordBuilding || recordBuilding === buildingKey;
  });
  for (const [index, record] of questionRecords.entries()) {
    const title = text(record?.Title || record?.Question || record?.Description || 'Open Question');
    issues.push(createIssue({
      id: issueKey(['pmis', buildingKey || workspaceId || 'campus', 'question', index]),
      title,
      description: text(record?.Description || record?.Question || record?.Detail || 'PMIS open question record.'),
      type: 'QUESTION',
      scope: record?.Building || record?.['Affected Building'] || record?.['Building / Area'] ? 'BUILDING' : 'PROJECT',
      severity: 'INFO',
      status: isOpenStatus(record?.Status || record?.state || record?.Outcome) ? 'OPEN' : 'RESOLVED',
      source: 'PMIS project register',
      sourceType: 'PMIS workbook',
      workspaceId,
      building: buildingKey || text(record?.Building || record?.['Affected Building'] || record?.['Building / Area']),
      room: text(workspace?.room || workspace?.id),
      relatedMilestones: [],
      evidence: [
        { label: text(record?.['Record Type'] || record?.Type || record?.Category || 'Question'), detail: text(record?.Status || 'Open') }
      ],
      impact: 'Open question records indicate active follow-up for the project.',
      recommendedNextStep: 'Review the PMIS question record and update the response status.'
    }));
  }

  return issues;
}

export function buildWorkspaceIssuesModel({
  workspace = null,
  projectMilestoneContext = null,
  pmisRuntime = null
} = {}) {
  const workspaceId = text(workspace?.id || '');
  const building = text(workspace?.building || '');
  const room = text(workspace?.room || workspace?.id || '');

  const roomIssues = buildWorkspaceRoomIssues(workspace);
  const projectIssues = [
    ...buildMilestoneIssues(projectMilestoneContext, workspace),
    ...buildPmisIssues({ workspace, pmisRuntime })
  ];

  const issues = [...roomIssues, ...projectIssues].sort(sortIssues);
  const compactIssues = issues.slice(0, 4);
  const selectedIssueId = compactIssues[0]?.id || issues[0]?.id || '';

  const filters = filterIds.map(id => {
    const items = issues.filter(issue => issueMatchesFilter(issue, id));
    return {
      id,
      label: id === 'all'
        ? 'All'
        : id === 'workspace'
          ? 'Workspace'
          : id === 'building'
            ? 'Building'
            : id === 'project'
              ? 'Project'
              : id[0].toUpperCase() + id.slice(1),
      count: items.length
    };
  });

  const roomSpecificIssues = issues.filter(issue => issue.scope === 'ROOM');
  const buildingIssues = issues.filter(issue => issue.scope === 'BUILDING');
  const projectDependencyIssues = issues.filter(issue => issue.scope === 'PROJECT');

  const counts = Object.freeze({
    open: issues.filter(issue => isOpenStatus(issue.status)).length,
    critical: issues.filter(issue => isOpenStatus(issue.status) && ['CRITICAL', 'HIGH'].includes(issue.severity)).length,
    questions: issues.filter(issue => isOpenStatus(issue.status) && issue.type === 'QUESTION').length,
    dependencies: issues.filter(issue => isOpenStatus(issue.status) && ['SCHEDULE', 'COORDINATION', 'DEPENDENCY', 'SHUTDOWN'].includes(issue.type)).length,
    room: roomSpecificIssues.length,
    building: buildingIssues.length,
    project: projectDependencyIssues.length
  });

  const selectedIssue = issues.find(issue => issue.id === selectedIssueId) || issues[0] || null;

  return Object.freeze({
    workspaceId,
    workspaceLabel: room || workspaceId || 'Workspace',
    building,
    room,
    roomIssues,
    buildingIssues,
    projectIssues: projectDependencyIssues,
    issues,
    compactIssues,
    selectedIssueId,
    selectedIssue,
    filters,
    counts,
    emptyState: roomIssues.length ? '' : 'No room-specific issues recorded.',
    roomEmptyState: 'No room-specific issues recorded.',
    projectEmptyState: 'No project-level dependencies recorded.'
  });
}

export function issueFilterMatches(issue, filterId = 'all') {
  return issueMatchesFilter(issue, filterId);
}
