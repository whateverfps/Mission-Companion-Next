import { createIdentifier } from './identifiers.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

export const WORKSPACE_NOTE_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'GENERAL', label: 'General' }),
  Object.freeze({ id: 'FIELD', label: 'Field' }),
  Object.freeze({ id: 'COORDINATION', label: 'Coordination' }),
  Object.freeze({ id: 'FOLLOW_UP', label: 'Follow-Up' }),
  Object.freeze({ id: 'QUESTION', label: 'Question' }),
  Object.freeze({ id: 'DECISION', label: 'Decision' }),
  Object.freeze({ id: 'DOCUMENT_REVIEW', label: 'Document Review' })
]);

export const WORKSPACE_NOTE_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'All' }),
  Object.freeze({ id: 'pinned', label: 'Pinned' }),
  Object.freeze({ id: 'linked', label: 'Linked' }),
  ...WORKSPACE_NOTE_CATEGORIES.map(category => Object.freeze({ id: category.id, label: category.label }))
]);

const DEFAULT_STORAGE_KEY = 'mission-companion:workspace-notes:v1';
const CATEGORY_LABELS = new Map(WORKSPACE_NOTE_CATEGORIES.map(item => [item.id, item.label]));
const FILTER_LABELS = new Map(WORKSPACE_NOTE_FILTERS.map(item => [item.id, item.label]));

function nowIso(now = () => new Date().toISOString()) {
  try {
    return text(now?.()) || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function normalizeCategory(value = '') {
  const key = text(value).replace(/[\s-]+/g, '_').toUpperCase();
  return CATEGORY_LABELS.has(key) ? key : 'GENERAL';
}

function normalizeFilter(value = '') {
  const raw = text(value).replace(/[\s-]+/g, '_').toUpperCase();
  if (!raw || raw === 'ALL' || raw === 'PINNED' || raw === 'LINKED') return raw.toLowerCase() || 'all';
  return CATEGORY_LABELS.has(raw) ? raw : 'all';
}

function normalizeTags(tags = []) {
  const source = Array.isArray(tags)
    ? tags
    : text(tags).split(',').map(item => item.trim()).filter(Boolean);
  const seen = new Set();
  const result = [];
  for (const tag of source) {
    const normalized = text(tag);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizeSourceLink(link = {}) {
  const kind = text(link.kind).toLowerCase();
  const id = text(link.id || link.key || link.sheetNumber || link.sectionNumber || link.documentId || link.timelineId);
  if (!kind || !id) return null;
  return Object.freeze({
    kind,
    id,
    label: text(link.label || link.title || link.sheetNumber || link.sectionNumber || link.documentId || link.id || id),
    detail: text(link.detail || link.description || link.relationship || ''),
    projectId: text(link.projectId || ''),
    workspaceId: text(link.workspaceId || ''),
    documentId: text(link.documentId || ''),
    pageId: text(link.pageId || ''),
    pageNumber: Number(link.pageNumber) || 0,
    sheetNumber: text(link.sheetNumber || ''),
    sectionNumber: text(link.sectionNumber || ''),
    openTarget: link.openTarget ? { ...link.openTarget } : null
  });
}

function normalizeNote(note = {}, { projectId = '', workspaceId = '', now = () => new Date().toISOString(), idFactory = createIdentifier, existing = null } = {}) {
  const timestamp = nowIso(now);
  const createdAt = text(existing?.createdAt || note.createdAt || timestamp) || timestamp;
  const updatedAt = text(note.updatedAt || timestamp) || timestamp;
  const sourceLinks = list(note.sourceLinks).map(normalizeSourceLink).filter(Boolean);
  return Object.freeze({
    id: text(existing?.id || note.id || idFactory()),
    projectId: text(note.projectId || existing?.projectId || projectId),
    workspaceId: text(note.workspaceId || existing?.workspaceId || workspaceId),
    text: text(note.text || ''),
    category: normalizeCategory(note.category || existing?.category || 'GENERAL'),
    tags: normalizeTags(note.tags || existing?.tags || []),
    sourceLinks,
    pinned: Boolean(note.pinned ?? existing?.pinned ?? false),
    archived: Boolean(note.archived ?? existing?.archived ?? false),
    createdAt,
    updatedAt
  });
}

function loadCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY) {
  try {
    const raw = storage?.getItem?.(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const notes = Array.isArray(parsed) ? parsed : list(parsed?.notes);
    return notes.map(note => normalizeNote(note, { existing: note })).filter(note => note.id);
  } catch {
    return [];
  }
}

function saveCollection(storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, notes = []) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify({ version: 1, notes }));
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

function noteMatchesFilter(note = {}, filterId = 'all') {
  const filter = normalizeFilter(filterId);
  if (!filter || filter === 'all') return true;
  if (filter === 'pinned') return Boolean(note.pinned);
  if (filter === 'linked') return list(note.sourceLinks).length > 0;
  return normalizeCategory(note.category) === filter;
}

function noteMatchesSearch(note = {}, search = '') {
  const needle = text(search).toLowerCase();
  if (!needle) return true;
  const haystack = [
    note.text,
    note.category,
    ...list(note.tags)
  ].map(value => text(value).toLowerCase()).join(' ');
  return haystack.includes(needle);
}

function sortNotes(notes = []) {
  return [...notes].sort((a, b) => {
    return (Boolean(b.pinned) - Boolean(a.pinned))
      || compareIsoDesc(a.updatedAt, b.updatedAt)
      || compareIsoDesc(a.createdAt, b.createdAt)
      || text(a.category).localeCompare(text(b.category))
      || text(a.text).localeCompare(text(b.text))
      || text(a.id).localeCompare(text(b.id));
  });
}

function noteCategoryLabel(category = 'GENERAL') {
  return CATEGORY_LABELS.get(normalizeCategory(category)) || 'General';
}

function filterLabel(filter = 'all') {
  const normalized = normalizeFilter(filter);
  return FILTER_LABELS.get(normalized === 'all' || normalized === 'pinned' || normalized === 'linked' ? normalized : normalizeCategory(normalized)) || 'All';
}

function buildDrawingEvidenceChoice(sheet = {}, relationship = 'Primary Source') {
  const sheetNumber = text(sheet.sheetNumber);
  if (!sheetNumber) return null;
  const documentId = text(sheet.documentId || sheet.drawingDocumentId || sheet.pageId?.match?.(/^drawing-page:([^:]+):/i)?.[1] || '');
  const pageId = text(sheet.pageId);
  return {
    kind: 'drawing',
    id: `drawing:${sheetNumber}`,
    label: sheetNumber,
    detail: text(sheet.sheetTitle || sheet.discipline || relationship || 'Drawing'),
    relationship,
    sheetNumber,
    documentId,
    pageId,
    pageNumber: Number(sheet.pdfPageNumber || sheet.pageNumber) || 0,
    openTarget: documentId ? {
      kind: 'drawing',
      documentId,
      sheetId: sheetNumber,
      pageId,
      pageNumber: Number(sheet.pdfPageNumber || sheet.pageNumber) || 0,
      sheetNumber
    } : null
  };
}

function buildSpecificationEvidenceChoice(spec = {}, relationship = 'Applicable') {
  const sectionNumber = text(spec.sectionNumber);
  if (!sectionNumber) return null;
  return {
    kind: 'specification',
    id: `specification:${sectionNumber}`,
    label: sectionNumber,
    detail: text(spec.sectionTitle || relationship || 'Specification'),
    relationship,
    sectionNumber,
    sectionTitle: text(spec.sectionTitle),
    openTarget: {
      kind: 'specification',
      sectionNumber
    }
  };
}

function buildDocumentEvidenceChoice(document = {}, relationship = 'Project / Contractual') {
  const documentId = text(document.documentId || document.id);
  if (!documentId) return null;
  return {
    kind: 'document',
    id: `document:${documentId}`,
    label: text(document.title || document.originalFilename || document.name || documentId),
    detail: text(document.sourceLabel || document.category || relationship),
    relationship,
    documentId,
    openTarget: {
      kind: 'source',
      documentId,
      destination: 'sources'
    }
  };
}

function buildIssueEvidenceChoice(issue = {}, relationship = 'Issue') {
  const id = text(issue.id);
  if (!id) return null;
  return {
    kind: 'issue',
    id: `issue:${id}`,
    label: text(issue.title || issue.label || id),
    detail: text(issue.status || issue.severity || issue.scope || relationship),
    relationship,
    issueId: id
  };
}

function buildChecklistEvidenceChoice(item = {}, relationship = 'Checklist') {
  const id = text(item.id);
  if (!id) return null;
  return {
    kind: 'checklist',
    id: `checklist:${id}`,
    label: text(item.title || item.label || id),
    detail: text(item.status || item.category || relationship),
    relationship,
    checklistId: id
  };
}

function buildTimelineEvidenceChoice(item = {}, relationship = 'Timeline') {
  const id = text(item.id);
  if (!id) return null;
  return {
    kind: 'timeline',
    id: `timeline:${id}`,
    label: text(item.title || item.label || id),
    detail: text(item.status || item.category || relationship),
    relationship,
    timelineId: id
  };
}

function uniqueChoice(groups, seen, group, choice) {
  if (!choice || !choice.id || seen.has(choice.id)) return;
  seen.add(choice.id);
  group.items.push(choice);
}

export function createWorkspaceNotesStore({ storage = globalThis.localStorage, storageKey = DEFAULT_STORAGE_KEY, persistence = null, now = () => new Date().toISOString(), idFactory = createIdentifier } = {}) {
  let notes = loadCollection(storage, storageKey);
  let storageLoaded = true;
  const loadedProjects = new Set();
  const persistToStorage = () => {
    if (!storage) return true;
    return saveCollection(storage, storageKey, notes);
  };
  const persistToExternalStore = async record => {
    if (!persistence?.putNote) return;
    await persistence.putNote(structuredClone(record));
  };
  const removeFromExternalStore = async (noteId, projectId = '', workspaceId = '') => {
    if (!persistence?.deleteNote) return;
    await persistence.deleteNote(noteId, projectId, workspaceId);
  };
  const write = () => {
    persistToStorage();
    return notes;
  };
  const getById = id => notes.find(note => note.id === text(id)) || null;
  const mutate = (id, changes = {}) => {
    const index = notes.findIndex(note => note.id === text(id));
    if (index < 0) return null;
    const updated = normalizeNote({ ...notes[index], ...changes, id }, { existing: notes[index], now, idFactory, projectId: notes[index].projectId, workspaceId: notes[index].workspaceId });
    notes = [...notes.slice(0, index), updated, ...notes.slice(index + 1)];
    write();
    return updated;
  };
  return Object.freeze({
    storageKey,
    async load(projectId = '') {
      const needleProjectId = text(projectId);
      if (needleProjectId && !loadedProjects.has(needleProjectId)) {
        const persisted = persistence?.loadNotes ? await persistence.loadNotes(needleProjectId) : [];
        const persistedNotes = list(persisted).map(note => normalizeNote(note, { existing: note })).filter(note => note.id);
        const storageNotes = loadCollection(storage, storageKey).filter(note => !needleProjectId || note.projectId === needleProjectId);
        const merged = [...notes, ...storageNotes, ...persistedNotes].filter(note => !needleProjectId || note.projectId === needleProjectId);
        const deduped = [...new Map(merged.map(note => [note.id, note])).values()];
        notes = [...notes.filter(note => needleProjectId && note.projectId !== needleProjectId), ...deduped];
        loadedProjects.add(needleProjectId);
        persistToStorage();
      }
      return this.list({ projectId: needleProjectId });
    },
    listAll() {
      return notes.map(note => ({ ...note, tags: [...note.tags], sourceLinks: note.sourceLinks.map(link => ({ ...link, openTarget: link.openTarget ? { ...link.openTarget } : null })) }));
    },
    list({ projectId = '', workspaceId = '', includeArchived = false } = {}) {
      const needleProjectId = text(projectId);
      const needleWorkspaceId = text(workspaceId);
      return sortNotes(notes.filter(note => {
        if (needleProjectId && note.projectId !== needleProjectId) return false;
        if (needleWorkspaceId && note.workspaceId !== needleWorkspaceId) return false;
        if (!includeArchived && note.archived) return false;
        return true;
      })).map(note => ({ ...note, tags: [...note.tags], sourceLinks: note.sourceLinks.map(link => ({ ...link, openTarget: link.openTarget ? { ...link.openTarget } : null })) }));
    },
    get(id) {
      const note = getById(id);
      return note ? { ...note, tags: [...note.tags], sourceLinks: note.sourceLinks.map(link => ({ ...link, openTarget: link.openTarget ? { ...link.openTarget } : null })) } : null;
    },
    create(input = {}) {
      const note = normalizeNote(input, { now, idFactory });
      notes = [...notes, note];
      write();
      void persistToExternalStore(note);
      return { ...note, tags: [...note.tags], sourceLinks: note.sourceLinks.map(link => ({ ...link, openTarget: link.openTarget ? { ...link.openTarget } : null })) };
    },
    update(id, changes = {}) {
      const current = getById(id);
      if (!current) return null;
      const updated = normalizeNote({ ...current, ...changes, id: current.id, updatedAt: nowIso(now) }, { existing: current, now, idFactory });
      notes = notes.map(note => note.id === current.id ? updated : note);
      write();
      void persistToExternalStore(updated);
      return { ...updated, tags: [...updated.tags], sourceLinks: updated.sourceLinks.map(link => ({ ...link, openTarget: link.openTarget ? { ...link.openTarget } : null })) };
    },
    save(input = {}) {
      if (input.id && getById(input.id)) return this.update(input.id, input);
      return this.create(input);
    },
    togglePin(id, pinned = null) {
      const current = getById(id);
      if (!current) return null;
      return this.update(id, { pinned: pinned === null ? !current.pinned : Boolean(pinned) });
    },
    archive(id, archived = true) {
      return this.update(id, { archived: Boolean(archived) });
    },
    clear() {
      notes = [];
      write();
    }
  });
}

export function buildWorkspaceNotesEvidenceChoices({ workspace = null, documentsModel = null, issuesModel = null, checklistModel = null, timelineModel = null } = {}) {
  const groups = [];
  const seen = new Set();
  const sourceSheets = list(workspace?.sourceSheets);
  const relatedSheets = list(workspace?.relatedSheets);
  const applicableSpecifications = list(workspace?.applicableSpecifications);
  const sourceEvidence = list(workspace?.sourceEvidence);
  const projectDocuments = list(documentsModel?.categories || []).find(category => category.id === 'project-documents')?.groups?.flatMap(group => group.items || []) || [];
  const sourceGroup = { id: 'drawings-primary', label: 'Source Drawings', relationship: 'Drawings', items: [] };
  for (const sheet of sourceSheets) uniqueChoice(groups, seen, sourceGroup, buildDrawingEvidenceChoice(sheet, 'Source Drawing'));
  const relatedGroup = { id: 'drawings-related', label: 'Related Drawings', relationship: 'Drawings', items: [] };
  for (const sheet of relatedSheets) uniqueChoice(groups, seen, relatedGroup, buildDrawingEvidenceChoice(sheet, 'Related Drawing'));
  const specGroup = { id: 'specifications', label: 'Specifications', relationship: 'Specifications', items: [] };
  for (const spec of applicableSpecifications) uniqueChoice(groups, seen, specGroup, buildSpecificationEvidenceChoice(spec, 'Applicable Specification'));
  const docGroup = { id: 'documents', label: 'Documents', relationship: 'Documents', items: [] };
  for (const document of projectDocuments) uniqueChoice(groups, seen, docGroup, buildDocumentEvidenceChoice(document, 'Project / Contractual'));
  const issueGroup = { id: 'issues', label: 'Issues', relationship: 'Workspace Issues', items: [] };
  for (const issue of list(issuesModel?.issues)) uniqueChoice(groups, seen, issueGroup, buildIssueEvidenceChoice(issue, 'Workspace Issue'));
  const checklistGroup = { id: 'checklist', label: 'Checklist', relationship: 'Workspace Checklist', items: [] };
  for (const item of list(checklistModel?.items)) uniqueChoice(groups, seen, checklistGroup, buildChecklistEvidenceChoice(item, 'Workspace Checklist'));
  const timelineGroup = { id: 'timeline', label: 'Timeline', relationship: 'Workspace Timeline', items: [] };
  for (const item of list(timelineModel?.items)) uniqueChoice(groups, seen, timelineGroup, buildTimelineEvidenceChoice(item, 'Workspace Timeline'));
  for (const evidence of sourceEvidence) {
    if (text(evidence.kind) !== 'source-sheet') {
      uniqueChoice(groups, seen, docGroup, buildDocumentEvidenceChoice({ documentId: evidence.documentId, title: evidence.title || evidence.label, sourceLabel: evidence.relationship || evidence.kind || 'Related Evidence' }, evidence.relationship || 'Related Evidence'));
    }
  }
  if (sourceGroup.items.length) groups.unshift(sourceGroup);
  if (relatedGroup.items.length) groups.push(relatedGroup);
  if (specGroup.items.length) groups.push(specGroup);
  if (docGroup.items.length) groups.push(docGroup);
  if (issueGroup.items.length) groups.push(issueGroup);
  if (checklistGroup.items.length) groups.push(checklistGroup);
  if (timelineGroup.items.length) groups.push(timelineGroup);
  return Object.freeze({ groups: groups.map(group => Object.freeze({ ...group, items: group.items.map(item => Object.freeze({ ...item, openTarget: item.openTarget ? { ...item.openTarget } : null })) })) });
}

export function buildWorkspaceNotesModel({
  projectId = '',
  workspace = null,
  documentsModel = null,
  issuesModel = null,
  checklistModel = null,
  timelineModel = null,
  notes = null,
  notesStore = null,
  filter = 'all',
  search = '',
  selectedNoteId = ''
} = {}) {
  const workspaceId = text(workspace?.id || '');
  const projectIdValue = text(projectId || '');
  const storeNotes = list(notes);
  const allNotes = sortNotes((storeNotes.length ? storeNotes : notesStore?.list({ projectId: projectIdValue, workspaceId }) || []).filter(note => !note.archived && (!projectIdValue || note.projectId === projectIdValue) && (!workspaceId || note.workspaceId === workspaceId)));
  const filteredNotes = sortNotes(allNotes.filter(note => noteMatchesFilter(note, filter) && noteMatchesSearch(note, search)));
  const selectedNote = filteredNotes.find(note => note.id === text(selectedNoteId)) || filteredNotes[0] || null;
  const evidenceChoices = buildWorkspaceNotesEvidenceChoices({ workspace, documentsModel, issuesModel, checklistModel, timelineModel });
  const counts = {
    total: allNotes.length,
    pinned: allNotes.filter(note => note.pinned).length,
    linked: allNotes.filter(note => list(note.sourceLinks).length > 0).length,
    archived: notesStore ? notesStore.list({ projectId: projectIdValue, workspaceId, includeArchived: true }).filter(note => note.archived).length : 0
  };
  return Object.freeze({
    projectId: projectIdValue,
    workspaceId,
    workspaceRoom: text(workspace?.room || workspaceId),
    workspaceName: text(workspace?.name || ''),
    building: text(workspace?.building || ''),
    level: text(workspace?.level || ''),
    disciplineFocus: text(workspace?.disciplineFocus || ''),
    filter: normalizeFilter(filter),
    search: text(search),
    filters: WORKSPACE_NOTE_FILTERS,
    categories: WORKSPACE_NOTE_CATEGORIES,
    counts: Object.freeze(counts),
    notes: filteredNotes.map(note => ({
      ...note,
      tags: [...note.tags],
      sourceLinks: note.sourceLinks.map(link => ({ ...link, openTarget: link.openTarget ? { ...link.openTarget } : null }))
    })),
    selectedNote: selectedNote ? {
      ...selectedNote,
      tags: [...selectedNote.tags],
      sourceLinks: selectedNote.sourceLinks.map(link => ({ ...link, openTarget: link.openTarget ? { ...link.openTarget } : null }))
    } : null,
    selectedNoteId: selectedNote?.id || '',
    evidenceGroups: evidenceChoices.groups,
    emptyState: allNotes.length ? (filteredNotes.length ? '' : 'No notes match the current filter.') : 'No notes recorded for this Workspace yet.',
    localNotesLabel: 'LOCAL WORKSPACE NOTES'
  });
}

export function workspaceNoteCategoryOptions() {
  return WORKSPACE_NOTE_CATEGORIES.map(item => ({ ...item }));
}

export function workspaceNoteFilterOptions() {
  return WORKSPACE_NOTE_FILTERS.map(item => ({ ...item }));
}

export function workspaceNoteCategoryName(category = 'GENERAL') {
  return noteCategoryLabel(category);
}

export function workspaceNoteFilterName(filter = 'all') {
  return filterLabel(filter);
}

export function normalizeWorkspaceNote(note = {}, fallback = {}) {
  return normalizeNote(note, fallback);
}
