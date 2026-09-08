const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const normalize = value => text(value).toLowerCase().replace(/^\./, '').replace(/[\s_-]+/g, ' ');
const stable = values => [...new Set(list(values).map(text).filter(Boolean))].sort();

export const MISSION_CONTROL_EXPERIENCES = Object.freeze([
  'mission-control',
  'professional-workspace'
]);

export function normalizeStartupExperience(value) {
  return MISSION_CONTROL_EXPERIENCES.includes(value) ? value : 'mission-control';
}

export function missionControlResponseModeLabel(value) {
  return ({
    offline: 'Source Evidence',
    assisted: 'Chief Analysis'
  })[text(value)] || 'Chief Analysis';
}

export function separateMissionControlProjects(projects = [], demonstrationProjectId = '') {
  const ordered = list(projects).filter(project => text(project?.id)).slice().sort((a, b) =>
    text(a.name).localeCompare(text(b.name)) || text(a.id).localeCompare(text(b.id))
  );
  return {
    userProjects: ordered.filter(project => text(project.id) !== text(demonstrationProjectId)),
    demonstrationProject: ordered.find(project => text(project.id) === text(demonstrationProjectId)) || null
  };
}

export function resolvePreviousProject(previousProjectId, projects = [], demonstrationProjectId = '') {
  const candidate = text(previousProjectId);
  if (!candidate || candidate === text(demonstrationProjectId)) return null;
  return list(projects).find(project => text(project?.id) === candidate) || null;
}

export function friendlyWorkspaceLabel(value) {
  return ({
    engineering: 'Current Work',
    workflow: 'Current Task',
    knowledge: 'Project Library',
    evidence: 'Supporting References',
    relationships: 'Related Information',
    chat: 'Ask Companion',
    inspections: 'Inspection Records',
    sources: 'Source Review',
    versions: 'Version History',
    revisions: 'Revision Review'
  })[normalize(value)] || text(value) || 'Current Work';
}

function dateOnly(value) {
  const candidate = text(value);
  const match = candidate.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || '';
}

function timestamp(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function activeInspection(record) {
  return !record?.archivedAt && !['Closed', 'Cancelled'].includes(text(record?.status));
}

function target(record) {
  return { view: 'inspections', inspectionId: text(record.inspectionId) };
}

function inspectionPriority(record, today) {
  if (!activeInspection(record)) return null;
  const followUpDate = dateOnly(record.followUpDate);
  if (record.followUpRequired && followUpDate && followUpDate < today) {
    return { kind: 'overdue', rank: 1, title: `Follow up on ${record.inspectionNumber || record.title}`, reason: `Follow-up was due ${followUpDate}.`, meta: followUpDate, target: target(record) };
  }
  if (record.status === 'Scheduled' && dateOnly(record.inspectionDate) === today) {
    return { kind: 'due-today', rank: 2, title: `${record.inspectionNumber || record.title} is scheduled today`, reason: 'The recorded inspection date is today.', meta: today, target: target(record) };
  }
  if (record.followUpRequired && followUpDate === today) {
    return { kind: 'due-today', rank: 2, title: `Review ${record.inspectionNumber || record.title} today`, reason: 'A recorded follow-up is due today.', meta: today, target: target(record) };
  }
  if (record.followUpRequired || record.status === 'Follow-Up Required') {
    return { kind: 'follow-up', rank: 3, title: `Review ${record.inspectionNumber || record.title}`, reason: 'This inspection explicitly requires follow-up.', meta: followUpDate || record.status, target: target(record) };
  }
  if (record.status === 'In Progress') {
    return { kind: 'in-progress', rank: 4, title: `Continue ${record.inspectionNumber || record.title}`, reason: 'This inspection is marked In Progress.', meta: record.status, target: target(record) };
  }
  if (record.result === 'Deficient') {
    return { kind: 'deficient', rank: 5, title: `Review ${record.inspectionNumber || record.title}`, reason: 'The recorded inspection result is Deficient.', meta: record.result, target: target(record) };
  }
  return null;
}

function explicitRevisionPriority(document, todayMs) {
  if (!text(document?.previousDocumentId)) return null;
  const occurredAt = timestamp(document.updatedAt || document.indexedAt || document.importedAt || document.lastModified);
  if (occurredAt === null || todayMs - occurredAt > 7 * 86400000 || occurredAt > todayMs + 86400000) return null;
  return {
    kind: 'recent-revision', rank: 6,
    title: `Review ${document.title || document.name || 'the latest revision'}`,
    reason: 'An explicitly linked newer revision was recently recorded.',
    meta: dateOnly(document.updatedAt || document.indexedAt || document.importedAt || document.lastModified),
    target: { view: 'versions', documentId: text(document.id) }
  };
}

function exactPendingPriority(document) {
  if (normalize(document?.status) !== 'pending') return null;
  return {
    kind: 'informational', rank: 7,
    title: `Check ${document.title || document.name || 'pending document'}`,
    reason: 'The source document has an explicit Pending status.',
    meta: 'Pending', target: { view: 'knowledge', documentId: text(document.id) }
  };
}

export function buildMissionControlPriorities({ inspections = [], documents = [], today } = {}) {
  const day = dateOnly(today);
  if (!day) return [];
  const todayMs = Date.parse(`${day}T23:59:59.999Z`);
  return [
    ...list(inspections).map(record => inspectionPriority(record, day)),
    ...list(documents).map(document => explicitRevisionPriority(document, todayMs)),
    ...list(documents).map(exactPendingPriority)
  ].filter(Boolean).sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title) || JSON.stringify(a.target).localeCompare(JSON.stringify(b.target)));
}

function activityItem({ id, occurredAt, kind, title, detail, target }) {
  const time = timestamp(occurredAt);
  if (time === null) return null;
  return { id: text(id), occurredAt: new Date(time).toISOString(), kind, title, detail, target };
}

export function buildRecentActivity({ inspections = [], documents = [], project = null } = {}) {
  const activities = [];
  for (const record of list(inspections)) {
    const updated = timestamp(record.updatedAt);
    const created = timestamp(record.createdAt);
    const changed = updated !== null && (created === null || updated !== created);
    activities.push(activityItem({
      id: `inspection:${record.inspectionId}:${changed ? 'updated' : 'created'}`,
      occurredAt: changed ? record.updatedAt : record.createdAt,
      kind: changed ? 'inspection-updated' : 'inspection-created',
      title: `${record.inspectionNumber || 'Inspection'} ${changed ? 'updated' : 'created'}`,
      detail: changed ? `Current status: ${record.status || 'Unavailable'}` : text(record.title),
      target: target(record)
    }));
  }
  for (const document of list(documents)) {
    const revision = Boolean(text(document.previousDocumentId));
    activities.push(activityItem({
      id: `document:${document.id}:${revision ? 'revision' : 'imported'}`,
      occurredAt: document.updatedAt || document.indexedAt || document.importedAt,
      kind: revision ? 'revision-identified' : 'document-imported',
      title: revision ? 'Revision identified' : 'Document imported',
      detail: text(document.title || document.name),
      target: { view: revision ? 'versions' : 'knowledge', documentId: text(document.id) }
    }));
  }
  activities.push(activityItem({
    id: `project:${project?.id || ''}`,
    occurredAt: project?.importedAt || project?.updatedAt || project?.createdAt,
    kind: 'project-updated', title: 'Project updated', detail: text(project?.name), target: { view: 'project' }
  }));
  return activities.filter(Boolean).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.id.localeCompare(b.id)).slice(0, 8);
}

function classificationValues(document) {
  return stable([
    document?.category, document?.type, document?.extension,
    document?.metadata?.category, document?.metadata?.type, document?.metadata?.extension,
    ...list(document?.tags), ...list(document?.metadata?.tags)
  ].map(normalize));
}

const SOURCE_VALUES = Object.freeze({
  drawings: ['drawing', 'drawings', 'dwg', 'dxf'],
  specifications: ['spec', 'specification', 'specifications'],
  rfis: ['rfi', 'rfis'],
  submittals: ['submittal', 'submittals']
});

export function countMissionControlSources(documents = []) {
  const counts = { drawings: 0, specifications: 0, rfis: 0, submittals: 0 };
  for (const document of list(documents)) {
    const values = classificationValues(document);
    for (const [key, accepted] of Object.entries(SOURCE_VALUES)) {
      if (values.some(value => accepted.includes(value))) counts[key] += 1;
    }
  }
  return counts;
}

export function buildProjectHealth({ project = null, inspections = [], hasCurrentWork = false, today = '' } = {}) {
  if (!project?.id) return { label: 'No Project Open', tone: 'neutral', explanation: 'Open, import, or load a project to begin.' };
  const active = list(inspections).filter(activeInspection);
  const current = active.filter(record => ['Draft', 'Scheduled', 'In Progress', 'Follow-Up Required'].includes(record.status));
  const overdue = active.filter(record => record.followUpRequired && dateOnly(record.followUpDate) && dateOnly(record.followUpDate) < dateOnly(today)).length;
  const followUps = active.filter(record => record.followUpRequired || record.status === 'Follow-Up Required').length;
  const deficient = active.filter(record => record.result === 'Deficient').length;
  if (overdue || followUps || deficient) {
    const facts = [overdue && `${overdue} overdue follow-up`, followUps && `${followUps} inspection follow-up${followUps === 1 ? '' : 's'}`, deficient && `${deficient} deficient result${deficient === 1 ? '' : 's'}`].filter(Boolean);
    return { label: 'Needs Attention', tone: 'attention', explanation: facts.join(' · ') };
  }
  if (hasCurrentWork || current.length) return { label: 'Active', tone: 'active', explanation: 'Current project work is available and no explicit urgent inspection condition was detected.' };
  return { label: 'Ready to Begin', tone: 'neutral', explanation: 'The project is open, with no current inspection task or explicit attention item.' };
}

export function buildContinuation({ selectedInspectionId = '', activeWorkflowType = '', hasEngineeringContext = false, selectedDocumentId = '', hasConversation = false, currentWorkspace = '' } = {}) {
  const items = [];
  if (selectedInspectionId) items.push({ label: 'Resume Inspection', reason: 'An Inspection Record is selected in this session.', target: { view: 'inspections', inspectionId: text(selectedInspectionId) } });
  if (activeWorkflowType) items.push({ label: 'Continue Current Task', reason: `${activeWorkflowType} is active in this session.`, target: { view: 'workflow' } });
  if (hasEngineeringContext) items.push({ label: 'Return to Current Work', reason: 'Current Work is synchronized in this session.', target: { view: 'engineering' } });
  if (selectedDocumentId) items.push({ label: 'Continue Reviewing Source', reason: 'A source document is selected in this session.', target: { view: 'knowledge', documentId: text(selectedDocumentId) } });
  if (hasConversation) items.push({ label: 'Return to Conversation', reason: 'Your existing conversation is available.', target: { view: 'chat' } });
  const resumableWorkspace = ['inspections', 'workflow', 'engineering', 'knowledge', 'sources', 'evidence', 'relationships', 'versions', 'revisions'].includes(currentWorkspace);
  if (resumableWorkspace) items.push({ label: `Return to ${friendlyWorkspaceLabel(currentWorkspace)}`, reason: 'This workspace was open earlier in the current session.', target: { view: text(currentWorkspace) } });
  return items.filter((item, index) => items.findIndex(candidate => candidate.label === item.label && candidate.target.view === item.target.view) === index).slice(0, 4);
}

export function buildRecommendedActions(priorities = []) {
  return list(priorities).slice(0, 3).map(item => ({ label: item.title, reason: item.reason, target: { ...item.target }, kind: item.kind }));
}

export function buildMissionControlModel({ now, project = null, documents = [], sections = [], inspections = [], continuation = {}, isDemonstration = false } = {}) {
  const date = new Date(now);
  const validDate = Number.isFinite(date.getTime()) ? date : new Date(0);
  const hour = validDate.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = [validDate.getFullYear(), String(validDate.getMonth() + 1).padStart(2, '0'), String(validDate.getDate()).padStart(2, '0')].join('-');
  const priorities = buildMissionControlPriorities({ inspections, documents, today });
  const recentActivity = buildRecentActivity({ inspections, documents, project });
  const continuationItems = buildContinuation(continuation);
  const sourceCounts = countMissionControlSources(documents);
  const health = buildProjectHealth({ project, inspections, hasCurrentWork: continuationItems.length > 0, today });
  return {
    greeting,
    dateLabel: validDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    project: project ? { id: text(project.id), name: text(project.name), description: text(project.description), isDemonstration } : null,
    summary: { documents: list(documents).length, sections: list(sections).length, inspections: list(inspections).filter(record => !record.archivedAt).length, ...sourceCounts },
    priorities,
    recommendations: buildRecommendedActions(priorities),
    continuation: continuationItems,
    recentActivity,
    health,
    empty: {
      priorities: priorities.length ? '' : "You're caught up on the items Companion can verify.",
      continuation: continuationItems.length ? '' : 'Open an inspection, document, or task to begin current work.',
      activity: recentActivity.length ? '' : 'Activity will appear as projects, documents, and inspections are updated.'
    }
  };
}
