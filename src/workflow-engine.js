const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const stable = values => [...new Set(values.map(text).filter(Boolean))].sort();
const normalize = value => text(value).toLowerCase().replace(/^\./, '').replace(/[\s_-]+/g, ' ');

export const WORKFLOW_TYPES = Object.freeze([
  'Owner QA Review', 'Specification Review', 'Submittal Review', 'RFI Review',
  'Drawing Review', 'Inspection Preparation', 'Version Review',
  'Relationship Investigation', 'Evidence Review'
]);

export const WORKFLOW_EXACT_VALUES = Object.freeze({
  specifications: Object.freeze(['spec', 'specification', 'specifications']),
  drawings: Object.freeze(['drawing', 'drawings', 'dwg', 'dxf']),
  submittals: Object.freeze(['submittal', 'submittals']),
  rfis: Object.freeze(['rfi', 'rfis', 'request for information', 'requests for information'])
});

const templateGroups = Object.freeze({
  'Owner QA Review': [],
  'Specification Review': ['specificationDocuments'],
  'Submittal Review': ['submittalDocuments'],
  'RFI Review': ['rfiDocuments'],
  'Drawing Review': ['drawingDocuments'],
  'Inspection Preparation': ['documents', 'sections'],
  'Version Review': ['lineage'],
  'Relationship Investigation': ['relationships'],
  'Evidence Review': ['evidence']
});

let workflowSession = null;

function metadataValues(document) {
  return stable([
    document?.category, document?.type, document?.extension,
    document?.metadata?.category, document?.metadata?.type, document?.metadata?.extension,
    ...list(document?.tags), ...list(document?.metadata?.tags)
  ].map(normalize));
}

function exactDocuments(context, documents, accepted) {
  return stable(list(documents).filter(document =>
    list(context?.documentIds).includes(text(document?.id)) &&
    metadataValues(document).some(value => accepted.includes(value))
  ).map(document => document.id));
}

function contextKey(context) {
  return [context?.projectId, context?.documentId, context?.sectionId].map(text).join(':');
}

function revisionIdentifiers(context, revisionComparisons) {
  const contextDocuments = new Set([...list(context?.documentIds), ...list(context?.versionIds)].map(text));
  return stable(list(revisionComparisons).filter(comparison =>
    comparison?.comparable &&
    (contextDocuments.has(text(comparison.earlierDocument?.id)) || contextDocuments.has(text(comparison.laterDocument?.id)))
  ).map(comparison => `${text(comparison.earlierDocument?.id)}->${text(comparison.laterDocument?.id)}`));
}

export function createWorkflow({ workflowType, engineeringContext, documents = [], sections = [], revisionComparisons = [] } = {}) {
  const type = text(workflowType);
  if (!engineeringContext?.projectId || !engineeringContext?.documentId || !WORKFLOW_TYPES.includes(type)) {
    return {
      workflowId: '', workflowType: type, engineeringContextId: contextKey(engineeringContext),
      requiredDocumentIds: [], requiredSectionIds: [], evidenceIds: [], relationshipIds: [],
      lineageIds: [], revisionIds: [], warnings: ['A valid Engineering Context and supported workflow type are required.'],
      missingGroups: [], status: 'Unavailable'
    };
  }
  const contextDocumentIds = stable(engineeringContext.documentIds);
  const contextSectionIds = stable(engineeringContext.sectionIds);
  const specificationDocuments = exactDocuments(engineeringContext, documents, WORKFLOW_EXACT_VALUES.specifications);
  const drawingDocuments = exactDocuments(engineeringContext, documents, WORKFLOW_EXACT_VALUES.drawings);
  const submittalDocuments = exactDocuments(engineeringContext, documents, WORKFLOW_EXACT_VALUES.submittals);
  const rfiDocuments = exactDocuments(engineeringContext, documents, WORKFLOW_EXACT_VALUES.rfis);
  const evidenceIds = stable(engineeringContext.evidenceIds);
  const relationshipIds = stable(engineeringContext.relationshipIds);
  const lineageIds = stable(list(documents).filter(document =>
    [...contextDocumentIds, ...list(engineeringContext.versionIds)].includes(text(document.id)) && text(document.lineageId || document.metadata?.lineageId)
  ).map(document => document.lineageId || document.metadata?.lineageId));
  const revisionIds = revisionIdentifiers(engineeringContext, revisionComparisons);
  const groups = {
    documents: contextDocumentIds,
    sections: contextSectionIds,
    specificationDocuments,
    drawingDocuments,
    submittalDocuments,
    rfiDocuments,
    evidence: evidenceIds,
    relationships: relationshipIds,
    lineage: lineageIds
  };
  const missingGroups = templateGroups[type].filter(group => !groups[group]?.length);
  const requiredDocumentIds = stable({
    'Specification Review': specificationDocuments,
    'Submittal Review': submittalDocuments,
    'RFI Review': rfiDocuments,
    'Drawing Review': drawingDocuments
  }[type] || contextDocumentIds);
  const relevantDocuments = new Set(requiredDocumentIds);
  const typedDocumentWorkflow = ['Specification Review', 'Submittal Review', 'RFI Review', 'Drawing Review'].includes(type);
  const requiredSectionIds = stable(list(engineeringContext.sectionIds).filter(sectionId => {
    if (!typedDocumentWorkflow) return true;
    const section = list(sections).find(item => text(item?.id) === text(sectionId));
    return section ? relevantDocuments.has(text(section.documentId)) : false;
  }));
  const warnings = stable([
    ...list(engineeringContext.warnings),
    ...missingGroups.map(group => `Required identifier group unavailable: ${group}`)
  ]);
  return {
    workflowId: `workflow:${normalize(type).replace(/ /g, '-')}:${contextKey(engineeringContext)}`,
    workflowType: type,
    engineeringContextId: contextKey(engineeringContext),
    projectId: text(engineeringContext.projectId),
    seedDocumentId: text(engineeringContext.documentId),
    seedSectionId: text(engineeringContext.sectionId),
    requiredDocumentIds,
    requiredSectionIds,
    evidenceIds,
    relationshipIds,
    lineageIds,
    revisionIds,
    versionIds: stable(engineeringContext.versionIds),
    warnings,
    missingGroups,
    status: missingGroups.length ? 'Incomplete' : 'Ready'
  };
}

export function startWorkflowSession(workflow, navigation = {}) {
  if (!workflow || workflow.status === 'Unavailable') return null;
  workflowSession = { workflow: structuredClone(workflow), notes: '', navigation: { ...navigation } };
  return getWorkflowSession();
}

export function updateWorkflowNotes(notes) {
  if (!workflowSession) return null;
  workflowSession.notes = String(notes ?? '');
  return getWorkflowSession();
}

export function clearWorkflowSession() { workflowSession = null; }
export function getWorkflowSession() { return workflowSession ? structuredClone(workflowSession) : null; }

export function workflowNavigationTarget({ workflowType, origin = '' } = {}) {
  const type = text(workflowType);
  return WORKFLOW_TYPES.includes(type) ? { view: 'workflow', workflowType: type, origin: text(origin) } : null;
}

export function workflowMetrics(workflow) {
  return {
    activeWorkflow: workflow ? 1 : 0,
    workflowReady: workflow?.status === 'Ready' ? 1 : 0,
    workflowIncomplete: workflow?.status === 'Incomplete' ? 1 : 0,
    workflowUnavailable: workflow?.status === 'Unavailable' ? 1 : 0,
    workflowEvidence: workflow?.evidenceIds?.length ? 1 : 0,
    workflowRelationships: workflow?.relationshipIds?.length ? 1 : 0,
    workflowLineage: workflow?.lineageIds?.length ? 1 : 0,
    workflowRevisions: workflow?.revisionIds?.length ? 1 : 0
  };
}
