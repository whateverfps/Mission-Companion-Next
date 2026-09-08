import { createIdentifier } from './identifiers.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

export const WORKSPACE_OBSERVATION_TYPES = Object.freeze([
  Object.freeze({ id: 'GENERAL', label: 'General' }),
  Object.freeze({ id: 'QUALITY', label: 'Quality' }),
  Object.freeze({ id: 'SAFETY', label: 'Safety' }),
  Object.freeze({ id: 'COORDINATION', label: 'Coordination' }),
  Object.freeze({ id: 'DOCUMENTATION', label: 'Documentation' }),
  Object.freeze({ id: 'CONSTRUCTION', label: 'Construction' }),
  Object.freeze({ id: 'TESTING', label: 'Testing' }),
  Object.freeze({ id: 'PUNCH', label: 'Punch' })
]);

export const WORKSPACE_OBSERVATION_STATUSES = Object.freeze([
  Object.freeze({ id: 'OPEN', label: 'Open' }),
  Object.freeze({ id: 'WATCH', label: 'Watch' }),
  Object.freeze({ id: 'CLOSED', label: 'Closed' })
]);

export const WORKSPACE_OBSERVATION_SEVERITIES = Object.freeze([
  Object.freeze({ id: 'INFO', label: 'Info' }),
  Object.freeze({ id: 'LOW', label: 'Low' }),
  Object.freeze({ id: 'MEDIUM', label: 'Medium' }),
  Object.freeze({ id: 'HIGH', label: 'High' }),
  Object.freeze({ id: 'CRITICAL', label: 'Critical' })
]);

const DEFAULT_STORAGE_KEY = 'mission-companion:workspace-observations:v1';
const TYPE_LABELS = new Map(WORKSPACE_OBSERVATION_TYPES.map(item => [item.id, item.label]));
const STATUS_LABELS = new Map(WORKSPACE_OBSERVATION_STATUSES.map(item => [item.id, item.label]));
const SEVERITY_LABELS = new Map(WORKSPACE_OBSERVATION_SEVERITIES.map(item => [item.id, item.label]));

function nowIso(now = () => new Date().toISOString()) {
  try {
    return text(now?.()) || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizeType(value = '') {
  const key = text(value).replace(/[\s-]+/g, '_').toUpperCase();
  return TYPE_LABELS.has(key) ? key : 'GENERAL';
}

function normalizeStatus(value = '') {
  const key = text(value).replace(/[\s-]+/g, '_').toUpperCase();
  return STATUS_LABELS.has(key) ? key : 'OPEN';
}

function normalizeSeverity(value = '') {
  const key = text(value).replace(/[\s-]+/g, '_').toUpperCase();
  return SEVERITY_LABELS.has(key) ? key : 'INFO';
}

function normalizeDrawing(sheet = {}) {
  const sheetNumber = text(sheet.sheetNumber);
  return sheetNumber ? {
    kind: 'drawing',
    sheetNumber,
    sheetTitle: text(sheet.sheetTitle),
    documentId: text(sheet.documentId || sheet.drawingDocumentId),
    pageId: text(sheet.pageId),
    pageNumber: Number(sheet.pdfPageNumber || sheet.pageNumber) || 0,
    drawingSetId: text(sheet.drawingSetId || ''),
    relationship: text(sheet.relationship || 'Selected drawing'),
    openTarget: sheet.documentId || sheet.drawingDocumentId ? {
      kind: 'drawing',
      documentId: text(sheet.documentId || sheet.drawingDocumentId),
      sheetId: sheetNumber,
      pageId: text(sheet.pageId),
      pageNumber: Number(sheet.pdfPageNumber || sheet.pageNumber) || 0,
      sheetNumber
    } : null
  } : null;
}

function normalizeSpecification(spec = {}) {
  const sectionNumber = text(spec.sectionNumber);
  return sectionNumber ? {
    kind: 'specification',
    sectionNumber,
    sectionTitle: text(spec.sectionTitle),
    sourceLabel: text(spec.sourceLabel || 'Applicable specification'),
    relationship: text(spec.relationship || 'Selected-sheet specification'),
    openTarget: { kind: 'specification', sectionNumber }
  } : null;
}

function normalizeIssue(issue = {}) {
  const id = text(issue.id);
  return id ? {
    kind: 'issue',
    id,
    title: text(issue.title || issue.label || id),
    status: text(issue.status || 'OPEN').toUpperCase() || 'OPEN',
    severity: text(issue.severity || 'INFO').toUpperCase() || 'INFO',
    scope: text(issue.scope || 'PROJECT').toUpperCase() || 'PROJECT',
    relationship: text(issue.relationship || 'Related issue'),
    openTarget: { kind: 'issue', id }
  } : null;
}

function normalizeChecklist(item = {}) {
  const id = text(item.id);
  return id ? {
    kind: 'checklist',
    id,
    title: text(item.title || item.label || id),
    status: text(item.status || 'NOT_VERIFIED').toUpperCase() || 'NOT_VERIFIED',
    category: text(item.category || 'COORDINATION').toUpperCase() || 'COORDINATION',
    relationship: text(item.relationship || 'Related checklist item'),
    openTarget: { kind: 'checklist', id }
  } : null;
}

function normalizeAttachment(attachment = {}, index = 0) {
  const title = text(attachment.title || attachment.label || attachment.fileName || attachment.name || `Attachment ${index + 1}`);
  return {
    id: text(attachment.id || attachment.fileId || `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'attachment'}-${index + 1}`),
    title,
    fileName: text(attachment.fileName || attachment.name || ''),
    kind: text(attachment.kind || 'file'),
    description: text(attachment.description || ''),
    createdAt: text(attachment.createdAt || ''),
    updatedAt: text(attachment.updatedAt || '')
  };
}

function normalizeObservation(record = {}, { existing = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  const timestamp = nowIso(now);
  const createdAt = text(existing?.createdAt || record.createdAt || timestamp) || timestamp;
  const updatedAt = text(record.updatedAt || timestamp) || timestamp;
  const selectedSheet = normalizeDrawing(record.selectedSheet || existing?.selectedSheet || {});
  const relatedSpecifications = list(record.relatedSpecifications || existing?.relatedSpecifications).map(spec => normalizeSpecification(spec)).filter(Boolean);
  const relatedIssues = list(record.relatedIssues || existing?.relatedIssues).map(issue => normalizeIssue(issue)).filter(Boolean);
  const relatedChecklistItems = list(record.relatedChecklistItems || existing?.relatedChecklistItems).map(item => normalizeChecklist(item)).filter(Boolean);
  const attachments = list(record.attachments || existing?.attachments).map(normalizeAttachment).filter(Boolean);
  const sourceContext = record.sourceContext && typeof record.sourceContext === 'object'
    ? structuredClone(record.sourceContext)
    : existing?.sourceContext && typeof existing.sourceContext === 'object'
      ? structuredClone(existing.sourceContext)
      : {};
  return Object.freeze({
    id: text(existing?.id || record.id || idFactory()),
    projectId: text(record.projectId || existing?.projectId || ''),
    workspaceId: text(record.workspaceId || existing?.workspaceId || ''),
    building: text(record.building || existing?.building || ''),
    room: text(record.room || existing?.room || ''),
    level: text(record.level || existing?.level || ''),
    createdAt,
    updatedAt,
    status: normalizeStatus(record.status || existing?.status || 'OPEN'),
    category: normalizeType(record.category || existing?.category || 'GENERAL'),
    severity: normalizeSeverity(record.severity || existing?.severity || 'INFO'),
    title: text(record.title || existing?.title || ''),
    description: text(record.description || existing?.description || ''),
    selectedSheet,
    relatedSpecifications,
    relatedIssues,
    relatedChecklistItems,
    attachments,
    sourceContext
  });
}

function loadCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const observations = Array.isArray(parsed) ? parsed : list(parsed?.observations);
    return observations.map(record => normalizeObservation(record, { existing: record })).filter(record => record.id);
  } catch {
    return [];
  }
}

function saveCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, observations = []) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify({ version: 1, observations }));
    return true;
  } catch {
    return false;
  }
}

function compareIsoDesc(a = '', b = '') {
  const aTime = new Date(text(a) || 0).getTime();
  const bTime = new Date(text(b) || 0).getTime();
  const aValue = Number.isNaN(aTime) ? 0 : aTime;
  const bValue = Number.isNaN(bTime) ? 0 : bTime;
  return bValue - aValue;
}

function sortObservations(observations = []) {
  return [...observations].sort((a, b) => {
    return (normalizeStatus(a.status) === 'OPEN' ? 0 : 1) - (normalizeStatus(b.status) === 'OPEN' ? 0 : 1)
      || compareIsoDesc(a.updatedAt, b.updatedAt)
      || compareIsoDesc(a.createdAt, b.createdAt)
      || text(a.category).localeCompare(text(b.category))
      || text(a.title).localeCompare(text(b.title))
      || text(a.id).localeCompare(text(b.id));
  });
}

export function createWorkspaceObservationsStore({ storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, persistence = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  let observations = loadCollection(storage, storageKey);
  const loadedProjects = new Set();
  const persistToStorage = () => {
    if (!storage) return true;
    return saveCollection(storage, storageKey, observations);
  };
  const persistToExternalStore = async record => {
    if (!persistence?.putObservation) return;
    await persistence.putObservation(structuredClone(record));
  };
  const write = () => {
    persistToStorage();
    return observations;
  };
  const getById = id => observations.find(item => item.id === text(id)) || null;
  const mutate = (id, changes = {}) => {
    const index = observations.findIndex(item => item.id === text(id));
    if (index < 0) return null;
    const updated = normalizeObservation({ ...observations[index], ...changes, id }, { existing: observations[index], now, idFactory });
    observations = [...observations.slice(0, index), updated, ...observations.slice(index + 1)];
    write();
    return updated;
  };
  return Object.freeze({
    storageKey,
    async load(projectId = '') {
      const needleProjectId = text(projectId);
      if (needleProjectId && !loadedProjects.has(needleProjectId)) {
        const persisted = persistence?.loadObservations ? await persistence.loadObservations(needleProjectId) : [];
        const persistedObservations = list(persisted).map(record => normalizeObservation(record, { existing: record })).filter(record => record.id);
        const storageObservations = loadCollection(storage, storageKey).filter(record => !needleProjectId || record.projectId === needleProjectId);
        const merged = [...observations, ...storageObservations, ...persistedObservations].filter(record => !needleProjectId || record.projectId === needleProjectId);
        const deduped = [...new Map(merged.map(record => [record.id, record])).values()];
        observations = [...observations.filter(record => needleProjectId && record.projectId !== needleProjectId), ...deduped];
        loadedProjects.add(needleProjectId);
        persistToStorage();
      }
      return this.list({ projectId: needleProjectId });
    },
    listAll() {
      return observations.map(record => ({
        ...record,
        selectedSheet: record.selectedSheet ? { ...record.selectedSheet, openTarget: record.selectedSheet.openTarget ? { ...record.selectedSheet.openTarget } : null } : null,
        relatedSpecifications: record.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedIssues: record.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedChecklistItems: record.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        attachments: record.attachments.map(item => ({ ...item })),
        sourceContext: structuredClone(record.sourceContext)
      }));
    },
    list({ projectId = '', workspaceId = '', includeClosed = true } = {}) {
      const needleProjectId = text(projectId);
      const needleWorkspaceId = text(workspaceId);
      return sortObservations(observations.filter(record => {
        if (needleProjectId && record.projectId !== needleProjectId) return false;
        if (needleWorkspaceId && record.workspaceId !== needleWorkspaceId) return false;
        if (!includeClosed && normalizeStatus(record.status) === 'CLOSED') return false;
        return true;
      })).map(record => ({
        ...record,
        selectedSheet: record.selectedSheet ? { ...record.selectedSheet, openTarget: record.selectedSheet.openTarget ? { ...record.selectedSheet.openTarget } : null } : null,
        relatedSpecifications: record.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedIssues: record.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedChecklistItems: record.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        attachments: record.attachments.map(item => ({ ...item })),
        sourceContext: structuredClone(record.sourceContext)
      }));
    },
    get(id) {
      const record = getById(id);
      return record ? {
        ...record,
        selectedSheet: record.selectedSheet ? { ...record.selectedSheet, openTarget: record.selectedSheet.openTarget ? { ...record.selectedSheet.openTarget } : null } : null,
        relatedSpecifications: record.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedIssues: record.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedChecklistItems: record.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        attachments: record.attachments.map(item => ({ ...item })),
        sourceContext: structuredClone(record.sourceContext)
      } : null;
    },
    create(input = {}) {
      const record = normalizeObservation(input, { now, idFactory });
      observations = [...observations, record];
      write();
      void persistToExternalStore(record);
      return this.get(record.id);
    },
    update(id, changes = {}) {
      const current = getById(id);
      if (!current) return null;
      const updated = normalizeObservation({ ...current, ...changes, id: current.id, updatedAt: nowIso(now) }, { existing: current, now, idFactory });
      observations = observations.map(record => record.id === current.id ? updated : record);
      write();
      void persistToExternalStore(updated);
      return this.get(updated.id);
    },
    save(input = {}) {
      if (input.id && getById(input.id)) return this.update(input.id, input);
      return this.create(input);
    },
    close(id, closed = true) {
      return this.update(id, { status: closed ? 'CLOSED' : 'OPEN' });
    },
    clear() {
      observations = [];
      write();
    }
  });
}

export function buildWorkspaceObservationsModel({
  projectId = '',
  workspace = null,
  issuesModel = null,
  checklistModel = null,
  timelineModel = null,
  observations = null,
  observationsStore = null,
  filter = 'all',
  selectedObservationId = ''
} = {}) {
  const workspaceId = text(workspace?.id || '');
  const projectIdValue = text(projectId || '');
  const storeObservations = list(observations);
  const allObservations = sortObservations((storeObservations.length ? storeObservations : observationsStore?.list({ projectId: projectIdValue, workspaceId, includeClosed: true }) || []).filter(record => (!projectIdValue || record.projectId === projectIdValue) && (!workspaceId || record.workspaceId === workspaceId)));
  const normalizedFilter = text(filter).toLowerCase();
  const filteredObservations = allObservations.filter(record => {
    if (!normalizedFilter || normalizedFilter === 'all') return true;
    if (normalizedFilter === 'open') return normalizeStatus(record.status) !== 'CLOSED';
    if (normalizedFilter === 'closed') return normalizeStatus(record.status) === 'CLOSED';
    return true;
  });
  const selectedObservation = filteredObservations.find(record => record.id === text(selectedObservationId)) || filteredObservations[0] || null;
  const typeCounts = new Map(WORKSPACE_OBSERVATION_TYPES.map(item => [item.id, 0]));
  for (const observation of allObservations) {
    const key = normalizeType(observation.category);
    typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
  }
  const counts = {
    total: allObservations.length,
    open: allObservations.filter(record => normalizeStatus(record.status) !== 'CLOSED').length,
    closed: allObservations.filter(record => normalizeStatus(record.status) === 'CLOSED').length,
    linkedIssues: allObservations.filter(record => record.relatedIssues.length).length,
    linkedChecklistItems: allObservations.filter(record => record.relatedChecklistItems.length).length
  };
  return Object.freeze({
    projectId: projectIdValue,
    workspaceId,
    workspaceRoom: text(workspace?.room || workspaceId),
    workspaceName: text(workspace?.name || ''),
    building: text(workspace?.building || ''),
    level: text(workspace?.level || ''),
    disciplineFocus: text(workspace?.disciplineFocus || ''),
    filter: normalizedFilter === 'open' || normalizedFilter === 'closed' ? normalizedFilter : 'all',
    filters: [
      { id: 'all', label: 'All', count: counts.total },
      { id: 'open', label: 'Open', count: counts.open },
      { id: 'closed', label: 'Closed', count: counts.closed }
    ],
    types: WORKSPACE_OBSERVATION_TYPES.map(type => ({ ...type, count: typeCounts.get(type.id) || 0 })),
    severities: WORKSPACE_OBSERVATION_SEVERITIES.map(item => ({ ...item })),
    statuses: WORKSPACE_OBSERVATION_STATUSES.map(item => ({ ...item })),
    counts: Object.freeze(counts),
    observations: filteredObservations.map(record => ({
      ...record,
      selectedSheet: record.selectedSheet ? { ...record.selectedSheet, openTarget: record.selectedSheet.openTarget ? { ...record.selectedSheet.openTarget } : null } : null,
      relatedSpecifications: record.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedIssues: record.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedChecklistItems: record.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      attachments: record.attachments.map(item => ({ ...item })),
      sourceContext: structuredClone(record.sourceContext)
    })),
    selectedObservation: selectedObservation ? {
      ...selectedObservation,
      selectedSheet: selectedObservation.selectedSheet ? { ...selectedObservation.selectedSheet, openTarget: selectedObservation.selectedSheet.openTarget ? { ...selectedObservation.selectedSheet.openTarget } : null } : null,
      relatedSpecifications: selectedObservation.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedIssues: selectedObservation.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedChecklistItems: selectedObservation.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      attachments: selectedObservation.attachments.map(item => ({ ...item })),
      sourceContext: structuredClone(selectedObservation.sourceContext)
    } : null,
    selectedObservationId: selectedObservation?.id || '',
    emptyState: allObservations.length ? (filteredObservations.length ? '' : 'No observations match the current filter.') : 'No field observations have been recorded for this Workspace yet.',
    typeCounts: Object.freeze(Object.fromEntries(typeCounts.entries())),
    linkedIssues: counts.linkedIssues,
    linkedChecklistItems: counts.linkedChecklistItems
  });
}

export function workspaceObservationTypeOptions() {
  return WORKSPACE_OBSERVATION_TYPES.map(item => ({ ...item }));
}

export function workspaceObservationSeverityOptions() {
  return WORKSPACE_OBSERVATION_SEVERITIES.map(item => ({ ...item }));
}

export function workspaceObservationStatusOptions() {
  return WORKSPACE_OBSERVATION_STATUSES.map(item => ({ ...item }));
}

export function workspaceObservationTimestampLabel(timestamp = '') {
  if (!timestamp) return 'Unavailable';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}

export function buildWorkspaceObservationDraft({
  projectId = '',
  workspace = null,
  selectedSheet = null,
  relatedIssue = null,
  relatedChecklistItem = null,
  relatedSpecifications = [],
  sourceContext = {}
} = {}) {
  const drawing = normalizeDrawing(selectedSheet || {});
  return {
    id: '',
    projectId: text(projectId || ''),
    workspaceId: text(workspace?.id || ''),
    building: text(workspace?.building || ''),
    room: text(workspace?.room || workspace?.id || ''),
    level: text(workspace?.level || ''),
    status: 'OPEN',
    category: 'GENERAL',
    severity: 'INFO',
    title: '',
    description: '',
    selectedSheet: drawing,
    relatedSpecifications: list(relatedSpecifications).map(spec => normalizeSpecification(spec)).filter(Boolean),
    relatedIssues: relatedIssue ? [normalizeIssue(relatedIssue)].filter(Boolean) : [],
    relatedChecklistItems: relatedChecklistItem ? [normalizeChecklist(relatedChecklistItem)].filter(Boolean) : [],
    attachments: [],
    sourceContext: {
      ...structuredClone(sourceContext || {}),
      projectId: text(projectId || ''),
      workspaceId: text(workspace?.id || ''),
      building: text(workspace?.building || ''),
      room: text(workspace?.room || workspace?.id || ''),
      level: text(workspace?.level || ''),
      roomType: text(workspace?.type || workspace?.roomType || ''),
      selectedSheet: drawing ? {
        sheetNumber: drawing.sheetNumber,
        sheetTitle: drawing.sheetTitle,
        documentId: drawing.documentId,
        pageId: drawing.pageId,
        pageNumber: drawing.pageNumber,
        drawingSetId: drawing.drawingSetId
      } : null,
      selectedSheetSpecifications: list(relatedSpecifications).map(spec => ({
        sectionNumber: text(spec?.sectionNumber),
        sectionTitle: text(spec?.sectionTitle),
        relationship: text(spec?.relationship || spec?.sourceLabel || 'Applicable'),
        sourceLabel: text(spec?.sourceLabel || 'Applicable')
      })).filter(spec => spec.sectionNumber),
      relatedIssueId: relatedIssue?.id || '',
      relatedChecklistItemId: relatedChecklistItem?.id || '',
      capturedAt: nowIso()
    }
  };
}
