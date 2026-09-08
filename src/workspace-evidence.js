import { createIdentifier } from './identifiers.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

export const WORKSPACE_EVIDENCE_TYPES = Object.freeze([
  Object.freeze({ id: 'PHOTO', label: 'Photo' }),
  Object.freeze({ id: 'FILE', label: 'File' }),
  Object.freeze({ id: 'DRAWING', label: 'Drawing' }),
  Object.freeze({ id: 'SPECIFICATION', label: 'Specification' }),
  Object.freeze({ id: 'NOTE', label: 'Note' })
]);

const DEFAULT_STORAGE_KEY = 'mission-companion:workspace-evidence:v1';
const TYPE_LABELS = new Map(WORKSPACE_EVIDENCE_TYPES.map(item => [item.id, item.label]));

function nowIso(now = () => new Date().toISOString()) {
  try {
    return text(now?.()) || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function normalizeType(value = '') {
  const key = text(value).replace(/[\s-]+/g, '_').toUpperCase();
  return TYPE_LABELS.has(key) ? key : 'NOTE';
}

function normalizeSelectedSheet(sheet = {}) {
  const sheetNumber = text(sheet.sheetNumber);
  return sheetNumber ? {
    kind: 'drawing',
    relationship: text(sheet.relationship || 'Selected drawing'),
    sheetNumber,
    sheetTitle: text(sheet.sheetTitle),
    discipline: text(sheet.discipline),
    level: text(sheet.level),
    documentId: text(sheet.documentId || sheet.drawingDocumentId),
    pageId: text(sheet.pageId),
    pageNumber: Number(sheet.pdfPageNumber || sheet.pageNumber) || 0,
    drawingSetId: text(sheet.drawingSetId || ''),
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
    relationship: text(spec.relationship || 'Related specification'),
    sectionNumber,
    sectionTitle: text(spec.sectionTitle),
    sourceLabel: text(spec.sourceLabel || 'Bedford IFC specification index'),
    openTarget: { kind: 'specification', sectionNumber }
  } : null;
}

function normalizeLinks(value = []) {
  return [...new Set(list(value).map(item => text(item)).filter(Boolean))].sort();
}

function normalizeTags(value = []) {
  return [...new Set(list(value).map(item => text(item)).filter(Boolean))].sort();
}

function normalizeEvidence(record = {}, { existing = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  const timestamp = nowIso(now);
  const createdAt = text(existing?.createdAt || record.createdAt || timestamp) || timestamp;
  const updatedAt = text(record.updatedAt || timestamp) || timestamp;
  const selectedSheet = normalizeSelectedSheet(record.selectedSheet || existing?.selectedSheet || {});
  const relatedSpecifications = list(record.relatedSpecifications || existing?.relatedSpecifications).map(normalizeSpecification).filter(Boolean);
  const sourceContext = record.sourceContext && typeof record.sourceContext === 'object'
    ? structuredClone(record.sourceContext)
    : existing?.sourceContext && typeof existing.sourceContext === 'object'
      ? structuredClone(existing.sourceContext)
      : {};
  return Object.freeze({
    id: text(existing?.id || record.id || idFactory()),
    projectId: text(record.projectId || existing?.projectId || ''),
    workspaceId: text(record.workspaceId || existing?.workspaceId || ''),
    type: normalizeType(record.type || existing?.type || 'NOTE'),
    title: text(record.title || existing?.title || ''),
    description: text(record.description || existing?.description || ''),
    createdAt,
    updatedAt,
    fileName: text(record.fileName || existing?.fileName || ''),
    mimeType: text(record.mimeType || existing?.mimeType || ''),
    size: Number(record.size ?? existing?.size ?? 0) || 0,
    storageRef: text(record.storageRef || existing?.storageRef || ''),
    tags: normalizeTags(record.tags || existing?.tags),
    pinned: Boolean(record.pinned ?? existing?.pinned ?? false),
    archived: Boolean(record.archived ?? existing?.archived ?? false),
    selectedSheet,
    relatedSpecifications,
    linkedIssueIds: normalizeLinks(record.linkedIssueIds || existing?.linkedIssueIds),
    linkedChecklistItemIds: normalizeLinks(record.linkedChecklistItemIds || existing?.linkedChecklistItemIds),
    linkedObservationIds: normalizeLinks(record.linkedObservationIds || existing?.linkedObservationIds),
    linkedRfiIds: normalizeLinks(record.linkedRfiIds || existing?.linkedRfiIds),
    sourceContext
  });
}

function loadCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : list(parsed?.evidence);
    return records.map(record => normalizeEvidence(record, { existing: record })).filter(record => record.id);
  } catch {
    return [];
  }
}

function saveCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, evidence = []) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify({ version: 1, evidence }));
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

function sortEvidence(a = {}, b = {}) {
  return compareIsoDesc(a.updatedAt, b.updatedAt)
    || compareIsoDesc(a.createdAt, b.createdAt)
    || text(a.type).localeCompare(text(b.type))
    || text(a.title).localeCompare(text(b.title))
    || text(a.id).localeCompare(text(b.id));
}

function evidenceTypeCounts(records = []) {
  return Object.fromEntries(WORKSPACE_EVIDENCE_TYPES.map(type => [type.id, records.filter(item => item.type === type.id).length]));
}

export function workspaceEvidenceFileMeta(file = null, { workspaceId = '', type = 'FILE' } = {}) {
  if (!file || typeof file !== 'object') return null;
  const fileName = text(file.name || '');
  if (!fileName) return null;
  const size = Number(file.size || 0) || 0;
  return {
    fileName,
    mimeType: text(file.type || (String(type).toUpperCase() === 'PHOTO' ? 'image/*' : 'application/octet-stream')),
    size,
    lastModified: Number(file.lastModified || Date.now()) || Date.now()
  };
}

export function buildWorkspaceEvidenceDraft({
  projectId = '',
  workspace = null,
  selectedSheet = null,
  relatedSpecifications = [],
  sourceContext = {},
  type = 'NOTE',
  title = '',
  description = '',
  fileName = '',
  mimeType = '',
  size = 0,
  storageRef = '',
  linkedIssueIds = [],
  linkedChecklistItemIds = [],
  linkedObservationIds = [],
  linkedRfiIds = []
} = {}) {
  const drawing = normalizeSelectedSheet(selectedSheet || {});
  const specs = list(relatedSpecifications).map(normalizeSpecification).filter(Boolean);
  const workspaceId = text(workspace?.id || '');
  return {
    id: '',
    projectId: text(projectId || workspace?.projectId || ''),
    workspaceId,
    building: text(workspace?.building || ''),
    room: text(workspace?.room || workspaceId || ''),
    level: text(workspace?.level || ''),
    type: normalizeType(type),
    title: text(title),
    description: text(description),
    fileName: text(fileName),
    mimeType: text(mimeType),
    size: Number(size) || 0,
    storageRef: text(storageRef),
    tags: normalizeTags([]),
    pinned: false,
    archived: false,
    selectedSheet: drawing,
    relatedSpecifications: specs,
    linkedIssueIds: normalizeLinks(linkedIssueIds),
    linkedChecklistItemIds: normalizeLinks(linkedChecklistItemIds),
    linkedObservationIds: normalizeLinks(linkedObservationIds),
    linkedRfiIds: normalizeLinks(linkedRfiIds),
    sourceContext: {
      ...structuredClone(sourceContext || {}),
      projectId: text(projectId || workspace?.projectId || ''),
      workspaceId,
      building: text(workspace?.building || ''),
      room: text(workspace?.room || workspaceId || ''),
      level: text(workspace?.level || ''),
      selectedSheet: drawing ? { ...drawing, openTarget: drawing.openTarget ? { ...drawing.openTarget } : null } : null,
      selectedSheetSpecifications: specs.map(spec => ({ ...spec, openTarget: spec.openTarget ? { ...spec.openTarget } : null })),
      capturedAt: text(sourceContext?.capturedAt || new Date().toISOString()) || new Date().toISOString()
    }
  };
}

export function buildWorkspaceEvidenceModel({ projectId = '', workspace = null, evidence = [], filter = 'all', selectedEvidenceId = '' } = {}) {
  const workspaceId = text(workspace?.id || '');
  const activeEvidence = list(evidence).map(item => normalizeEvidence(item, { existing: item })).filter(item => {
    if (projectId && text(item.projectId) !== text(projectId)) return false;
    if (workspaceId && text(item.workspaceId) !== workspaceId) return false;
    return true;
  });
  const sortedEvidence = [...activeEvidence].sort(sortEvidence);
  const normalizedFilter = text(filter).toUpperCase() || 'ALL';
  const filteredEvidence = normalizedFilter === 'ALL'
    ? sortedEvidence
    : sortedEvidence.filter(item => item.type === normalizedFilter);
  const counts = {
    total: sortedEvidence.length,
    photos: activeEvidence.filter(item => item.type === 'PHOTO').length,
    files: activeEvidence.filter(item => item.type === 'FILE').length,
    drawings: activeEvidence.filter(item => item.type === 'DRAWING').length,
    specifications: activeEvidence.filter(item => item.type === 'SPECIFICATION').length,
    notes: activeEvidence.filter(item => item.type === 'NOTE').length,
    linkedIssues: activeEvidence.filter(item => item.linkedIssueIds.length).length,
    linkedChecklistItems: activeEvidence.filter(item => item.linkedChecklistItemIds.length).length,
    linkedObservations: activeEvidence.filter(item => item.linkedObservationIds.length).length,
    linkedRfis: activeEvidence.filter(item => item.linkedRfiIds.length).length
  };
  const filters = [
    { id: 'all', label: 'All', count: counts.total },
    ...WORKSPACE_EVIDENCE_TYPES.map(type => ({
      id: type.id,
      label: type.label,
      count: ({
        PHOTO: counts.photos,
        FILE: counts.files,
        DRAWING: counts.drawings,
        SPECIFICATION: counts.specifications,
        NOTE: counts.notes
      })[type.id] || 0
    }))
  ];
  const selectedEvidence = filteredEvidence.find(item => item.id === selectedEvidenceId) || sortedEvidence.find(item => item.id === selectedEvidenceId) || filteredEvidence[0] || sortedEvidence[0] || null;
  return Object.freeze({
    projectId: text(projectId),
    workspaceId,
    evidence: filteredEvidence,
    allEvidence: sortedEvidence,
    selectedEvidence,
    selectedEvidenceId: text(selectedEvidence?.id || selectedEvidenceId || ''),
    filters,
    counts,
    emptyState: sortedEvidence.length ? '' : 'No shared evidence has been recorded for this Workspace yet.'
  });
}

export function createWorkspaceEvidenceStore({ storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, persistence = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  let evidence = loadCollection(storage, storageKey);
  const loadedProjects = new Set();
  const persistToStorage = () => {
    if (!storage) return true;
    return saveCollection(storage, storageKey, evidence);
  };
  const persistToExternalStore = async record => {
    if (!persistence?.putEvidence) return;
    await persistence.putEvidence(structuredClone(record));
  };
  const write = () => {
    persistToStorage();
    return evidence;
  };
  const getById = id => evidence.find(item => item.id === text(id)) || null;
  const mutate = (id, changes = {}) => {
    const index = evidence.findIndex(item => item.id === text(id));
    if (index < 0) return null;
    const updated = normalizeEvidence({ ...evidence[index], ...changes, id }, { existing: evidence[index], now, idFactory });
    evidence = [...evidence.slice(0, index), updated, ...evidence.slice(index + 1)];
    write();
    return updated;
  };
  const ensureLoaded = async (projectId = '') => {
    const key = text(projectId);
    if (!key || loadedProjects.has(key)) return evidence.filter(item => !key || text(item.projectId) === key);
    const persisted = persistence?.loadEvidence ? await persistence.loadEvidence(key) : [];
    loadedProjects.add(key);
    if (persisted.length) {
      const next = [...evidence.filter(item => text(item.projectId) !== key), ...persisted.map(record => normalizeEvidence(record, { existing: record, now, idFactory }))];
      evidence = next;
      write();
    }
    return evidence.filter(item => text(item.projectId) === key);
  };
  return {
    async load(projectId = '') {
      await ensureLoaded(projectId);
      return this;
    },
    list({ projectId = '', workspaceId = '', filter = 'all' } = {}) {
      const normalizedFilter = text(filter).toUpperCase() || 'ALL';
      return [...evidence].filter(item => {
        if (projectId && text(item.projectId) !== text(projectId)) return false;
        if (workspaceId && text(item.workspaceId) !== text(workspaceId)) return false;
        if (normalizedFilter !== 'ALL' && item.type !== normalizedFilter) return false;
        return true;
      }).sort(sortEvidence);
    },
    get: getById,
    create(record = {}) {
      const normalized = normalizeEvidence(record, { now, idFactory });
      evidence = [...evidence, normalized];
      write();
      void persistToExternalStore(normalized);
      return normalized;
    },
    update(id, changes = {}) {
      const updated = mutate(id, changes);
      if (updated) void persistToExternalStore(updated);
      return updated;
    },
    delete(id) {
      const existing = getById(id);
      if (!existing) return null;
      evidence = evidence.filter(item => item.id !== text(id));
      write();
      if (persistence?.deleteEvidence) void persistence.deleteEvidence(id, existing.projectId, existing.workspaceId);
      return existing;
    },
    link(id, links = {}) {
      const existing = getById(id);
      if (!existing) return null;
      const updated = mutate(id, {
        linkedIssueIds: normalizeLinks(list(existing.linkedIssueIds).concat(links.issueId ? [links.issueId] : [])),
        linkedChecklistItemIds: normalizeLinks(list(existing.linkedChecklistItemIds).concat(links.checklistItemId ? [links.checklistItemId] : [])),
        linkedObservationIds: normalizeLinks(list(existing.linkedObservationIds).concat(links.observationId ? [links.observationId] : [])),
        linkedRfiIds: normalizeLinks(list(existing.linkedRfiIds).concat(links.rfiId ? [links.rfiId] : []))
      });
      if (updated) void persistToExternalStore(updated);
      return updated;
    },
    unlink(id, links = {}) {
      const existing = getById(id);
      if (!existing) return null;
      const updated = mutate(id, {
        linkedIssueIds: links.issueId ? existing.linkedIssueIds.filter(item => item !== text(links.issueId)) : existing.linkedIssueIds,
        linkedChecklistItemIds: links.checklistItemId ? existing.linkedChecklistItemIds.filter(item => item !== text(links.checklistItemId)) : existing.linkedChecklistItemIds,
        linkedObservationIds: links.observationId ? existing.linkedObservationIds.filter(item => item !== text(links.observationId)) : existing.linkedObservationIds,
        linkedRfiIds: links.rfiId ? existing.linkedRfiIds.filter(item => item !== text(links.rfiId)) : existing.linkedRfiIds
      });
      if (updated) void persistToExternalStore(updated);
      return updated;
    },
    all: () => [...evidence].sort(sortEvidence),
    counts: () => evidenceTypeCounts(evidence)
  };
}

export function workspaceEvidenceTypeLabel(type = 'NOTE') {
  return TYPE_LABELS.get(normalizeType(type)) || 'Evidence';
}
