import { WORKFLOW_TYPES } from './workflow-engine.js';

const text = value => value == null ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const stableIds = value => [...new Set(list(value).map(text).filter(Boolean))].sort();

export const INSPECTION_STATUSES = Object.freeze([
  'Draft', 'Scheduled', 'In Progress', 'Complete',
  'Follow-Up Required', 'Closed', 'Cancelled'
]);

export const INSPECTION_RESULTS = Object.freeze([
  'Not Evaluated', 'Acceptable', 'Acceptable with Comments',
  'Deficient', 'Unable to Inspect'
]);

const terminalStatuses = new Set(['Closed', 'Cancelled']);
const inspectionNumberPattern = /^INS-(\d{3,})$/;

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value)) && !Number.isNaN(Date.parse(`${text(value)}T00:00:00Z`));
}

export function normalizeEvidenceReferences(value) {
  const keyed = new Map();
  for (const reference of list(value)) {
    const documentId = text(reference?.documentId);
    const sectionId = text(reference?.sectionId);
    if (!documentId && !sectionId) continue;
    keyed.set(`${documentId}\u0000${sectionId}`, { documentId, sectionId });
  }
  return [...keyed.values()].sort((a, b) =>
    a.documentId.localeCompare(b.documentId) || a.sectionId.localeCompare(b.sectionId)
  );
}

export function normalizeInspectionRecord(record = {}) {
  return {
    inspectionId: text(record.inspectionId),
    projectId: text(record.projectId),
    inspectionNumber: text(record.inspectionNumber).toUpperCase(),
    title: text(record.title),
    inspectionType: text(record.inspectionType),
    status: text(record.status) || 'Draft',
    result: text(record.result) || 'Not Evaluated',
    inspectionDate: text(record.inspectionDate),
    createdAt: text(record.createdAt),
    updatedAt: text(record.updatedAt),
    inspectorName: text(record.inspectorName),
    building: text(record.building),
    area: text(record.area),
    room: text(record.room),
    trade: text(record.trade),
    discipline: text(record.discipline),
    description: text(record.description),
    scope: text(record.scope),
    observedConditions: text(record.observedConditions),
    correctiveActionRequired: record.correctiveActionRequired === true,
    followUpRequired: record.followUpRequired === true,
    followUpDate: text(record.followUpDate),
    notes: text(record.notes),
    sourceDocumentIds: stableIds(record.sourceDocumentIds),
    sourceSectionIds: stableIds(record.sourceSectionIds),
    evidenceReferences: normalizeEvidenceReferences(record.evidenceReferences),
    relatedDrawingIds: stableIds(record.relatedDrawingIds),
    relatedSpecificationIds: stableIds(record.relatedSpecificationIds),
    relatedRfiIds: stableIds(record.relatedRfiIds),
    relatedSubmittalIds: stableIds(record.relatedSubmittalIds),
    relatedDeficiencyIds: stableIds(record.relatedDeficiencyIds),
    relationshipIds: stableIds(record.relationshipIds),
    versionIds: stableIds(record.versionIds),
    revisionIds: stableIds(record.revisionIds),
    workflowTemplateId: text(record.workflowTemplateId),
    archivedAt: text(record.archivedAt)
  };
}

export function validateInspectionRecord(record, { projectIds = [], existingRecords = [], currentInspectionId = '' } = {}) {
  const value = normalizeInspectionRecord(record);
  const errors = [];
  for (const field of ['inspectionId', 'projectId', 'inspectionNumber', 'title', 'inspectionDate']) {
    if (!value[field]) errors.push(`${field} is required.`);
  }
  if (!inspectionNumberPattern.test(value.inspectionNumber)) errors.push('inspectionNumber must use INS-001 format.');
  if (!validDate(value.inspectionDate)) errors.push('inspectionDate must be a valid YYYY-MM-DD date.');
  if (value.followUpDate && !validDate(value.followUpDate)) errors.push('followUpDate must be a valid YYYY-MM-DD date.');
  if (!INSPECTION_STATUSES.includes(value.status)) errors.push('status is invalid.');
  if (!INSPECTION_RESULTS.includes(value.result)) errors.push('result is invalid.');
  if (value.workflowTemplateId && !WORKFLOW_TYPES.includes(value.workflowTemplateId)) errors.push('workflowTemplateId is invalid.');
  if (value.status === 'Closed' && value.result === 'Not Evaluated') errors.push('Closed inspections require an evaluated result.');
  if (projectIds.length && !projectIds.includes(value.projectId)) errors.push('projectId does not resolve to an existing project.');
  const others = list(existingRecords).filter(item => text(item.inspectionId) !== text(currentInspectionId || value.inspectionId));
  if (others.some(item => text(item.inspectionId) === value.inspectionId)) errors.push('inspectionId already exists.');
  if (others.some(item => text(item.projectId) === value.projectId && text(item.inspectionNumber).toUpperCase() === value.inspectionNumber)) errors.push('inspectionNumber already exists in this project.');
  return { valid: errors.length === 0, errors, record: value };
}

export function nextInspectionNumber(records = [], projectId = '') {
  const highest = list(records).filter(item => text(item.projectId) === text(projectId)).reduce((maximum, item) => {
    const match = text(item.inspectionNumber).toUpperCase().match(inspectionNumberPattern);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `INS-${String(highest + 1).padStart(3, '0')}`;
}

export function validateStatusTransition(previousStatus, nextStatus, { reopen = false } = {}) {
  const previous = text(previousStatus);
  const next = text(nextStatus);
  if (!INSPECTION_STATUSES.includes(next)) return { valid: false, reason: 'Invalid inspection status.' };
  if (previous === next || !previous) return { valid: true, reason: '' };
  if (terminalStatuses.has(previous) && !reopen) return { valid: false, reason: `${previous} inspections require an explicit reopen action.` };
  if (reopen && !terminalStatuses.has(previous)) return { valid: false, reason: 'Only Closed or Cancelled inspections can be explicitly reopened.' };
  return { valid: true, reason: '' };
}

export function inspectionContextSeed(record, { documents = [], sections = [] } = {}) {
  const value = normalizeInspectionRecord(record);
  const exactDocuments = id => list(documents).filter(item => text(item?.id) === id && text(item?.projectId) === value.projectId);
  const exactSections = id => list(sections).filter(item => text(item?.id) === id && text(item?.projectId) === value.projectId);
  for (const sectionId of value.sourceSectionIds) {
    const matches = exactSections(sectionId);
    if (matches.length > 1) return null;
    if (matches.length !== 1) continue;
    const documentMatches = exactDocuments(text(matches[0].documentId));
    if (documentMatches.length > 1) return null;
    if (documentMatches.length === 1) return { projectId: value.projectId, libraryId: text(documentMatches[0].libraryId), documentId: text(documentMatches[0].id), sectionId };
  }
  for (const documentId of value.sourceDocumentIds) {
    const matches = exactDocuments(documentId);
    if (matches.length > 1) return null;
    if (matches.length === 1) return { projectId: value.projectId, libraryId: text(matches[0].libraryId), documentId, sectionId: '' };
  }
  for (const documentId of [...value.relatedDrawingIds, ...value.relatedSpecificationIds]) {
    const matches = exactDocuments(documentId);
    if (matches.length > 1) return null;
    if (matches.length === 1) return { projectId: value.projectId, libraryId: text(matches[0].libraryId), documentId, sectionId: '' };
  }
  return null;
}
