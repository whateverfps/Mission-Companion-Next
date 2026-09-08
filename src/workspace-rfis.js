import { createIdentifier } from './identifiers.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

export const WORKSPACE_RFI_STATUSES = Object.freeze([
  Object.freeze({ id: 'DRAFT', label: 'Draft' }),
  Object.freeze({ id: 'OPEN', label: 'Open' }),
  Object.freeze({ id: 'ANSWERED', label: 'Answered' }),
  Object.freeze({ id: 'CLOSED', label: 'Closed' })
]);

const DEFAULT_STORAGE_KEY = 'mission-companion:workspace-rfis:v1';
const STATUS_LABELS = new Map(WORKSPACE_RFI_STATUSES.map(item => [item.id, item.label]));

function nowIso(now = () => new Date().toISOString()) {
  try {
    return text(now?.()) || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizeStatus(value = '') {
  const key = text(value).replace(/[\s-]+/g, '_').toUpperCase();
  return STATUS_LABELS.has(key) ? key : 'DRAFT';
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

function normalizeObservation(observation = {}) {
  const id = text(observation.id);
  return id ? {
    kind: 'observation',
    id,
    title: text(observation.title || observation.label || id),
    status: text(observation.status || 'OPEN').toUpperCase() || 'OPEN',
    severity: text(observation.severity || 'INFO').toUpperCase() || 'INFO',
    relationship: text(observation.relationship || 'Related observation'),
    openTarget: { kind: 'observation', id }
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

function normalizeRfi(record = {}, { existing = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  const timestamp = nowIso(now);
  const createdAt = text(existing?.createdAt || record.createdAt || timestamp) || timestamp;
  const updatedAt = text(record.updatedAt || timestamp) || timestamp;
  const selectedSheet = normalizeDrawing(record.selectedSheet || existing?.selectedSheet || {});
  const relatedSpecifications = list(record.relatedSpecifications || existing?.relatedSpecifications).map(spec => normalizeSpecification(spec)).filter(Boolean);
  const relatedIssues = list(record.relatedIssues || existing?.relatedIssues).map(issue => normalizeIssue(issue)).filter(Boolean);
  const relatedChecklistItems = list(record.relatedChecklistItems || existing?.relatedChecklistItems).map(item => normalizeChecklist(item)).filter(Boolean);
  const relatedObservations = list(record.relatedObservations || existing?.relatedObservations).map(item => normalizeObservation(item)).filter(Boolean);
  const attachments = list(record.attachments || existing?.attachments).map(normalizeAttachment).filter(Boolean);
  const sourceContext = record.sourceContext && typeof record.sourceContext === 'object'
    ? structuredClone(record.sourceContext)
    : existing?.sourceContext && typeof existing.sourceContext === 'object'
      ? structuredClone(existing.sourceContext)
      : {};
  return Object.freeze({
    id: text(existing?.id || record.id || idFactory()),
    localId: text(existing?.localId || record.localId || ''),
    projectId: text(record.projectId || existing?.projectId || ''),
    workspaceId: text(record.workspaceId || existing?.workspaceId || ''),
    building: text(record.building || existing?.building || ''),
    room: text(record.room || existing?.room || ''),
    level: text(record.level || existing?.level || ''),
    createdAt,
    updatedAt,
    status: normalizeStatus(record.status || existing?.status || 'DRAFT'),
    subject: text(record.subject || existing?.subject || ''),
    question: text(record.question || existing?.question || ''),
    suggestedResolution: text(record.suggestedResolution || existing?.suggestedResolution || ''),
    requestedResponseDate: text(record.requestedResponseDate || existing?.requestedResponseDate || ''),
    selectedSheet,
    relatedSpecifications,
    relatedIssues,
    relatedChecklistItems,
    relatedObservations,
    attachments,
    sourceContext
  });
}

function loadCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : list(parsed?.rfis);
    return records.map(record => normalizeRfi(record, { existing: record })).filter(record => record.id);
  } catch {
    return [];
  }
}

function saveCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, records = []) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify({ version: 1, rfis: records }));
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

function sortRfis(rfis = []) {
  return [...rfis].sort((a, b) => {
    const rank = status => ({ DRAFT: 0, OPEN: 1, ANSWERED: 2, CLOSED: 3 }[normalizeStatus(status)] ?? 0);
    return rank(a.status) - rank(b.status)
      || compareIsoDesc(a.updatedAt, b.updatedAt)
      || compareIsoDesc(a.createdAt, b.createdAt)
      || text(a.subject).localeCompare(text(b.subject))
      || text(a.id).localeCompare(text(b.id));
  });
}

export function createWorkspaceRfisStore({ storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, persistence = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  let rfis = loadCollection(storage, storageKey);
  const loadedProjects = new Set();
  const persistToStorage = () => {
    if (!storage) return true;
    return saveCollection(storage, storageKey, rfis);
  };
  const persistToExternalStore = async record => {
    if (!persistence?.putRfi) return;
    await persistence.putRfi(structuredClone(record));
  };
  const buildLocalId = () => {
    const next = rfis.filter(record => String(record.localId || '').startsWith('DRAFT-RFI-')).length + 1;
    return `DRAFT-RFI-${String(next).padStart(3, '0')}`;
  };
  const write = () => {
    persistToStorage();
    return rfis;
  };
  const getById = id => rfis.find(item => item.id === text(id)) || null;
  const mutate = (id, changes = {}) => {
    const index = rfis.findIndex(item => item.id === text(id));
    if (index < 0) return null;
    const updated = normalizeRfi({ ...rfis[index], ...changes, id }, { existing: rfis[index], now, idFactory });
    rfis = [...rfis.slice(0, index), updated, ...rfis.slice(index + 1)];
    write();
    return updated;
  };
  return Object.freeze({
    storageKey,
    async load(projectId = '') {
      const needleProjectId = text(projectId);
      if (needleProjectId && !loadedProjects.has(needleProjectId)) {
        const persisted = persistence?.loadRfis ? await persistence.loadRfis(needleProjectId) : [];
        const persistedRfis = list(persisted).map(record => normalizeRfi(record, { existing: record })).filter(record => record.id);
        const storageRfis = loadCollection(storage, storageKey).filter(record => !needleProjectId || record.projectId === needleProjectId);
        const merged = [...rfis, ...storageRfis, ...persistedRfis].filter(record => !needleProjectId || record.projectId === needleProjectId);
        const deduped = [...new Map(merged.map(record => [record.id, record])).values()];
        rfis = [...rfis.filter(record => needleProjectId && record.projectId !== needleProjectId), ...deduped];
        loadedProjects.add(needleProjectId);
        persistToStorage();
      }
      return this.list({ projectId: needleProjectId });
    },
    listAll() {
      return rfis.map(record => ({
        ...record,
        localId: record.localId || '',
        selectedSheet: record.selectedSheet ? { ...record.selectedSheet, openTarget: record.selectedSheet.openTarget ? { ...record.selectedSheet.openTarget } : null } : null,
        relatedSpecifications: record.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedIssues: record.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedChecklistItems: record.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedObservations: record.relatedObservations.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        attachments: record.attachments.map(item => ({ ...item })),
        sourceContext: structuredClone(record.sourceContext)
      }));
    },
    list({ projectId = '', workspaceId = '', includeClosed = true } = {}) {
      const needleProjectId = text(projectId);
      const needleWorkspaceId = text(workspaceId);
      return sortRfis(rfis.filter(record => {
        if (needleProjectId && record.projectId !== needleProjectId) return false;
        if (needleWorkspaceId && record.workspaceId !== needleWorkspaceId) return false;
        if (!includeClosed && normalizeStatus(record.status) === 'CLOSED') return false;
        return true;
      })).map(record => ({
        ...record,
        localId: record.localId || '',
        selectedSheet: record.selectedSheet ? { ...record.selectedSheet, openTarget: record.selectedSheet.openTarget ? { ...record.selectedSheet.openTarget } : null } : null,
        relatedSpecifications: record.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedIssues: record.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedChecklistItems: record.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedObservations: record.relatedObservations.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        attachments: record.attachments.map(item => ({ ...item })),
        sourceContext: structuredClone(record.sourceContext)
      }));
    },
    get(id) {
      const record = getById(id);
      return record ? {
        ...record,
        localId: record.localId || '',
        selectedSheet: record.selectedSheet ? { ...record.selectedSheet, openTarget: record.selectedSheet.openTarget ? { ...record.selectedSheet.openTarget } : null } : null,
        relatedSpecifications: record.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedIssues: record.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedChecklistItems: record.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        relatedObservations: record.relatedObservations.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
        attachments: record.attachments.map(item => ({ ...item })),
        sourceContext: structuredClone(record.sourceContext)
      } : null;
    },
    create(input = {}) {
      const record = normalizeRfi({ ...input, localId: text(input.localId || buildLocalId()) }, { now, idFactory });
      rfis = [...rfis, record];
      write();
      void persistToExternalStore(record);
      return this.get(record.id);
    },
    update(id, changes = {}) {
      const current = getById(id);
      if (!current) return null;
      const updated = normalizeRfi({ ...current, ...changes, id: current.id, localId: current.localId || buildLocalId(), updatedAt: nowIso(now) }, { existing: current, now, idFactory });
      rfis = rfis.map(record => record.id === current.id ? updated : record);
      write();
      void persistToExternalStore(updated);
      return this.get(updated.id);
    },
    save(input = {}) {
      if (input.id && getById(input.id)) return this.update(input.id, input);
      return this.create(input);
    },
    close(id, closed = true) {
      const status = closed ? 'CLOSED' : 'OPEN';
      return this.update(id, { status });
    },
    delete(id) {
      const record = getById(id);
      if (!record) return null;
      rfis = rfis.filter(item => item.id !== record.id);
      write();
      return record;
    },
    clear() {
      rfis = [];
      write();
    }
  });
}

export function buildWorkspaceRfisModel({
  projectId = '',
  workspace = null,
  observationsModel = null,
  issuesModel = null,
  checklistModel = null,
  rfis = null,
  rfisStore = null,
  filter = 'all',
  selectedRfiId = ''
} = {}) {
  const workspaceId = text(workspace?.id || '');
  const projectIdValue = text(projectId || '');
  const storeRfis = list(rfis);
  const allRfis = sortRfis((storeRfis.length ? storeRfis : rfisStore?.list({ projectId: projectIdValue, workspaceId, includeClosed: true }) || []).filter(record => (!projectIdValue || record.projectId === projectIdValue) && (!workspaceId || record.workspaceId === workspaceId)));
  const normalizedFilter = text(filter).toLowerCase();
  const filteredRfis = allRfis.filter(record => {
    if (!normalizedFilter || normalizedFilter === 'all') return true;
    if (normalizedFilter === 'draft') return normalizeStatus(record.status) === 'DRAFT';
    if (normalizedFilter === 'open') return normalizeStatus(record.status) === 'OPEN';
    if (normalizedFilter === 'answered') return normalizeStatus(record.status) === 'ANSWERED';
    if (normalizedFilter === 'closed') return normalizeStatus(record.status) === 'CLOSED';
    return true;
  });
  const selectedRfi = filteredRfis.find(record => record.id === text(selectedRfiId)) || filteredRfis[0] || null;
  const statusCounts = new Map(WORKSPACE_RFI_STATUSES.map(item => [item.id, 0]));
  for (const rfi of allRfis) statusCounts.set(normalizeStatus(rfi.status), (statusCounts.get(normalizeStatus(rfi.status)) || 0) + 1);
  const counts = {
    total: allRfis.length,
    draft: allRfis.filter(record => normalizeStatus(record.status) === 'DRAFT').length,
    open: allRfis.filter(record => normalizeStatus(record.status) === 'OPEN').length,
    answered: allRfis.filter(record => normalizeStatus(record.status) === 'ANSWERED').length,
    closed: allRfis.filter(record => normalizeStatus(record.status) === 'CLOSED').length,
    linkedIssues: allRfis.filter(record => record.relatedIssues.length).length,
    linkedChecklistItems: allRfis.filter(record => record.relatedChecklistItems.length).length,
    linkedObservations: allRfis.filter(record => record.relatedObservations.length).length
  };
  return Object.freeze({
    projectId: projectIdValue,
    workspaceId,
    workspaceRoom: text(workspace?.room || workspaceId),
    workspaceName: text(workspace?.name || ''),
    building: text(workspace?.building || ''),
    level: text(workspace?.level || ''),
    disciplineFocus: text(workspace?.disciplineFocus || ''),
    filter: ['draft', 'open', 'answered', 'closed'].includes(normalizedFilter) ? normalizedFilter : 'all',
    filters: [
      { id: 'all', label: 'All', count: counts.total },
      { id: 'draft', label: 'Draft', count: counts.draft },
      { id: 'open', label: 'Open', count: counts.open },
      { id: 'answered', label: 'Answered', count: counts.answered },
      { id: 'closed', label: 'Closed', count: counts.closed }
    ],
    statuses: WORKSPACE_RFI_STATUSES.map(item => ({ ...item })),
    counts: Object.freeze(counts),
    rfis: filteredRfis.map(record => ({
      ...record,
      localId: record.localId || '',
      selectedSheet: record.selectedSheet ? { ...record.selectedSheet, openTarget: record.selectedSheet.openTarget ? { ...record.selectedSheet.openTarget } : null } : null,
      relatedSpecifications: record.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedIssues: record.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedChecklistItems: record.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedObservations: record.relatedObservations.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      attachments: record.attachments.map(item => ({ ...item })),
      sourceContext: structuredClone(record.sourceContext)
    })),
    selectedRfi: selectedRfi ? {
      ...selectedRfi,
      localId: selectedRfi.localId || '',
      selectedSheet: selectedRfi.selectedSheet ? { ...selectedRfi.selectedSheet, openTarget: selectedRfi.selectedSheet.openTarget ? { ...selectedRfi.selectedSheet.openTarget } : null } : null,
      relatedSpecifications: selectedRfi.relatedSpecifications.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedIssues: selectedRfi.relatedIssues.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedChecklistItems: selectedRfi.relatedChecklistItems.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      relatedObservations: selectedRfi.relatedObservations.map(item => ({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })),
      attachments: selectedRfi.attachments.map(item => ({ ...item })),
      sourceContext: structuredClone(selectedRfi.sourceContext)
    } : null,
    selectedRfiId: selectedRfi?.id || '',
    emptyState: allRfis.length ? (filteredRfis.length ? '' : 'No RFIs match the current filter.') : 'No Workspace RFIs have been recorded yet.',
    linkedIssues: counts.linkedIssues,
    linkedChecklistItems: counts.linkedChecklistItems,
    linkedObservations: counts.linkedObservations
  });
}

export function workspaceRfiStatusOptions() {
  return WORKSPACE_RFI_STATUSES.map(item => ({ ...item }));
}

export function workspaceRfiTimestampLabel(timestamp = '') {
  if (!timestamp) return 'Unavailable';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}

export function buildWorkspaceRfiDraft({
  projectId = '',
  workspace = null,
  selectedSheet = null,
  relatedIssue = null,
  relatedChecklistItem = null,
  relatedObservation = null,
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
    status: 'DRAFT',
    subject: '',
    question: '',
    suggestedResolution: '',
    requestedResponseDate: '',
    selectedSheet: drawing,
    relatedSpecifications: list(relatedSpecifications).map(spec => normalizeSpecification(spec)).filter(Boolean),
    relatedIssues: relatedIssue ? [normalizeIssue(relatedIssue)].filter(Boolean) : [],
    relatedChecklistItems: relatedChecklistItem ? [normalizeChecklist(relatedChecklistItem)].filter(Boolean) : [],
    relatedObservations: relatedObservation ? [normalizeObservation(relatedObservation)].filter(Boolean) : [],
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
      relatedObservationId: relatedObservation?.id || '',
      capturedAt: nowIso()
    }
  };
}
