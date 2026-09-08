import { WORKFLOW_EXACT_VALUES } from './workflow-engine.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const stable = values => [...new Set(values.map(text).filter(Boolean))].sort();
const normalize = value => text(value).toLowerCase().replace(/^\./, '').replace(/[\s_-]+/g, ' ');

export const CONTEXT_BUS_CONSUMERS = Object.freeze([
  'Command Desk', 'Engineering Workspace', 'Evidence Explorer',
  'Knowledge Validation', 'Relationship Explorer', 'Revision Review',
  'Source Inspector', 'Version Explorer', 'Workflow Workspace'
]);

const ownerQaValues = Object.freeze(['owner qa', 'owner qa review']);

function metadataValues(document) {
  return stable([
    document?.category, document?.type, document?.extension,
    document?.metadata?.category, document?.metadata?.type,
    document?.metadata?.extension, ...list(document?.tags),
    ...list(document?.metadata?.tags)
  ].map(normalize));
}

function exactTypedContext(context, documents, accepted) {
  const ids = new Set(list(context?.documentIds).map(text));
  return list(documents).some(document =>
    ids.has(text(document?.id)) && metadataValues(document).some(value => accepted.includes(value))
  );
}

export function selectSynchronizedWorkflow({ engineeringContext: context, documents = [], revisionIds = [] } = {}) {
  if (!context?.projectId || !context?.documentId) {
    return { status: 'unavailable', workflowType: '', candidates: [], reason: 'A valid Engineering Context is unavailable.' };
  }
  const candidates = [];
  if (list(context.classification?.specifications).length) candidates.push('Specification Review');
  if (list(context.classification?.drawings).length) candidates.push('Drawing Review');
  if (exactTypedContext(context, documents, WORKFLOW_EXACT_VALUES.submittals)) candidates.push('Submittal Review');
  if (exactTypedContext(context, documents, WORKFLOW_EXACT_VALUES.rfis)) candidates.push('RFI Review');
  if (exactTypedContext(context, documents, ownerQaValues)) candidates.push('Owner QA Review');
  const contextDocumentIds = new Set(list(context.documentIds).map(text));
  const hasExplicitLineage = list(documents).some(document =>
    contextDocumentIds.has(text(document?.id)) && text(document?.lineageId || document?.metadata?.lineageId)
  );
  if (hasExplicitLineage || list(context.versionIds).length > 1 || list(revisionIds).length) candidates.push('Version Review');
  if (list(context.relationshipIds).length) candidates.push('Relationship Investigation');
  if (list(context.evidenceIds).length) candidates.push('Evidence Review');
  const qualified = stable(candidates);
  if (qualified.length > 1) return { status: 'ambiguous', workflowType: '', candidates: qualified, reason: 'Select Workflow' };
  if (qualified.length === 1) return { status: 'selected', workflowType: qualified[0], candidates: qualified, reason: '' };
  return { status: 'selected', workflowType: 'Inspection Preparation', candidates: ['Inspection Preparation'], reason: '' };
}

export function createContextBusSnapshot({ engineeringContext: context, activation, documents = [], revisionIds = [] } = {}) {
  if (!context?.projectId || !context?.documentId || !activation?.source) {
    return {
      active: false,
      context: null,
      workflow: { status: 'unavailable', workflowType: '', candidates: [], reason: 'A valid Engineering Context is unavailable.' },
      synchronizedConsumers: [],
      unsynchronizedConsumers: [...CONTEXT_BUS_CONSUMERS]
    };
  }
  const contextReference = Object.freeze({
    projectId: text(context.projectId), libraryId: text(context.libraryId),
    documentId: text(context.documentId), sectionId: text(context.sectionId),
    evidenceId: text(context.evidenceId), relationshipIds: stable(context.relationshipIds),
    lineageIds: stable(list(documents).filter(document =>
      list(context.versionIds).includes(text(document.id)) && text(document.lineageId || document.metadata?.lineageId)
    ).map(document => document.lineageId || document.metadata?.lineageId)),
    revisionIds: stable(revisionIds), activationSource: text(activation.source)
  });
  return {
    active: true,
    context: contextReference,
    workflow: selectSynchronizedWorkflow({ engineeringContext: context, documents, revisionIds }),
    synchronizedConsumers: [...CONTEXT_BUS_CONSUMERS],
    unsynchronizedConsumers: []
  };
}

export function contextBusMetrics(snapshot) {
  return {
    activeSynchronization: snapshot?.active ? 1 : 0,
    synchronizedModules: list(snapshot?.synchronizedConsumers).length,
    unsynchronizedModules: list(snapshot?.unsynchronizedConsumers).length,
    activationSource: text(snapshot?.context?.activationSource)
  };
}
