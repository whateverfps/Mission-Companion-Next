const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

export const CONTEXT_ACTIVATION_SOURCES = Object.freeze({
  knowledgeObjectDocument: 'Knowledge Object document',
  knowledgeObjectSection: 'Knowledge Object section',
  evidence: 'Evidence',
  sourceInspectorDocument: 'Source Inspector document',
  sourceInspectorSection: 'Source Inspector section',
  relationshipDocument: 'Relationship document',
  relationshipSection: 'Relationship section',
  versionDocument: 'Version Explorer',
  revisionPair: 'Revision pair',
  revisionSection: 'Revision matched section',
  workflowOpen: 'Workflow opened',
  workflowReplace: 'Workflow replaced',
  commandDesk: 'Command Desk evidence',
  projectSwitch: 'Project switch',
  knowledgeCatalog: 'Knowledge Catalog document',
  engineeringWorkspace: 'Engineering Workspace launch',
  inspectionRecord: 'Inspection Record',
  constructionWorkPackage: 'Construction Work Package',
  knowledgeObjectClose: 'Knowledge Object close',
  newConversation: 'New conversation',
  projectRemoval: 'Project removal'
});

const allowedActivationFields = [
  'projectId', 'libraryId', 'documentId', 'sectionId', 'evidenceId',
  'relationshipId', 'lineageId', 'revisionId', 'source', 'activatedAt'
];

function exact(records, identifier, field = 'id') {
  const target = text(identifier);
  if (!target) return { status: 'absent', record: null };
  const matches = list(records).filter(record => text(record?.[field]) === target);
  if (matches.length === 1) return { status: 'exact', record: matches[0] };
  return { status: matches.length ? 'ambiguous' : 'missing', record: null };
}

function unavailable(reasons) {
  return { available: false, transition: 'cleared', activation: null, reasons: [...reasons].sort() };
}

export function createContextActivation(request = {}, records = {}) {
  const source = text(request.source);
  const activatedAt = text(request.activatedAt);
  if (!Object.values(CONTEXT_ACTIVATION_SOURCES).includes(source)) return unavailable(['Unsupported activation source.']);
  if (!activatedAt) return unavailable(['Caller-supplied activatedAt is required.']);
  const project = exact(records.projects, request.projectId);
  if (project.status !== 'exact') return unavailable([project.status === 'ambiguous' ? 'Project identifier is ambiguous.' : 'Project identifier is unavailable.']);
  if (source === CONTEXT_ACTIVATION_SOURCES.projectSwitch && !text(request.documentId)) {
    return {
      available: false,
      transition: 'cleared',
      activation: null,
      reasons: ['Project-only activation cannot seed Engineering Context.'],
      clearedEvent: { projectId: text(request.projectId), source, activatedAt, transition: 'cleared' }
    };
  }
  const document = exact(records.documents, request.documentId);
  if (document.status !== 'exact') return unavailable([document.status === 'ambiguous' ? 'Document identifier is ambiguous.' : 'Document identifier is unavailable.']);
  if (text(document.record.projectId) !== text(request.projectId)) return unavailable(['Document does not belong to the exact project.']);
  const library = exact(records.libraries, request.libraryId);
  if (request.libraryId && library.status !== 'exact') return unavailable([library.status === 'ambiguous' ? 'Library identifier is ambiguous.' : 'Library identifier is unavailable.']);
  if (request.libraryId && text(document.record.libraryId) !== text(request.libraryId)) return unavailable(['Document does not belong to the exact library.']);
  const section = exact(records.sections, request.sectionId);
  if (request.sectionId && section.status !== 'exact') return unavailable([section.status === 'ambiguous' ? 'Section identifier is ambiguous.' : 'Section identifier is unavailable.']);
  if (section.record && text(section.record.documentId) !== text(request.documentId)) return unavailable(['Section does not belong to the exact document.']);
  for (const [requestField, collection, recordField, label] of [
    ['evidenceId', records.evidence, 'id', 'Evidence'],
    ['relationshipId', records.relationships, 'id', 'Relationship'],
    ['lineageId', records.lineages, 'lineageId', 'Lineage'],
    ['revisionId', records.revisions, 'revisionId', 'Revision']
  ]) {
    if (!request[requestField]) continue;
    const resolved = exact(collection, request[requestField], recordField);
    if (resolved.status !== 'exact') return unavailable([`${label} identifier is ${resolved.status === 'ambiguous' ? 'ambiguous' : 'unavailable'}.`]);
    if (requestField === 'evidenceId') {
      if (resolved.record.documentId && text(resolved.record.documentId) !== text(request.documentId)) return unavailable(['Evidence does not belong to the exact document.']);
      if (request.sectionId && resolved.record.sectionId && text(resolved.record.sectionId) !== text(request.sectionId)) return unavailable(['Evidence does not belong to the exact section.']);
    }
  }
  const activation = Object.fromEntries(allowedActivationFields.map(field => [field, text(request[field])])) ;
  return { available: true, transition: 'activated', activation, reasons: [] };
}

export function createContextClearedEvent({ projectId = '', source, activatedAt } = {}) {
  const label = text(source);
  const timestamp = text(activatedAt);
  if (!Object.values(CONTEXT_ACTIVATION_SOURCES).includes(label) || !timestamp) return null;
  return { projectId: text(projectId), source: label, activatedAt: timestamp, transition: 'cleared' };
}

export function contextActivationMetrics(activation, clearedEvent = null) {
  return {
    activeEngineeringContext: activation ? 1 : 0,
    activationSource: text(activation?.source || clearedEvent?.source),
    currentTransition: activation ? 'activated' : clearedEvent ? 'cleared' : 'unavailable',
    contextCleared: !activation && clearedEvent ? 1 : 0
  };
}

export function activationIdentifierOrder(activation = {}) {
  return allowedActivationFields.filter(field => text(activation[field]));
}
