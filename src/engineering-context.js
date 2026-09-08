import { buildKnowledgeRelationships } from './knowledge-relationships.js';
import { buildDocumentLineage, lineageForDocument } from './document-lineage.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const stable = values => [...new Set(values.map(text).filter(Boolean))].sort();
const normalize = value => text(value).toLowerCase().replace(/^\./, '').replace(/[\s_-]+/g, ' ');

export const ENGINEERING_CLASSIFICATION_VALUES = Object.freeze({
  specifications: Object.freeze(['spec', 'specification', 'specifications']),
  drawings: Object.freeze(['drawing', 'drawings', 'dwg', 'dxf']),
  procedures: Object.freeze(['procedure', 'procedures', 'sop', 'sops', 'standard operating procedure', 'standard operating procedures'])
});

let inspectionSession = null;

function exactMetadata(field, document, section) {
  return text(section?.[field] ?? section?.metadata?.[field] ?? document?.[field] ?? document?.metadata?.[field]);
}

function classificationValues(document) {
  return stable([
    document?.category,
    document?.type,
    document?.extension,
    document?.metadata?.category,
    document?.metadata?.type,
    document?.metadata?.extension,
    ...list(document?.tags),
    ...list(document?.metadata?.tags)
  ].map(normalize));
}

export function classifyEngineeringDocument(document) {
  const values = classificationValues(document);
  for (const type of ['specifications', 'drawings', 'procedures']) {
    const basis = values.find(value => ENGINEERING_CLASSIFICATION_VALUES[type].includes(value));
    if (basis) return { type, basis };
  }
  return { type: 'unclassified', basis: '' };
}

function referencedEdgeIds(model, documentId, sectionId) {
  const explicit = model.explicitReferences.filter(edge =>
    sectionId
      ? edge.sourceSectionId === sectionId || edge.targetSectionId === sectionId
      : edge.sourceDocumentId === documentId || edge.targetDocumentId === documentId
  );
  const reverse = model.reverseReferences.filter(edge =>
    sectionId ? edge.from === sectionId || edge.to === sectionId : edge.sourceDocumentId === documentId || edge.targetDocumentId === documentId
  );
  return { explicit, reverse };
}

export function createEngineeringContext({
  projectId,
  documentId,
  sectionId = '',
  evidenceId = '',
  libraryId = '',
  projects = [],
  documents = [],
  sections = [],
  relationshipModel = null,
  lineageModel = null,
  retrievalSession = null
} = {}) {
  const project = list(projects).find(item => text(item?.id) === text(projectId)) || null;
  const document = list(documents).find(item =>
    text(item?.id) === text(documentId) && text(item?.projectId) === text(projectId)
  ) || null;
  if (!project || !document) return null;
  if (libraryId && text(document.libraryId) !== text(libraryId)) return null;
  const section = sectionId
    ? list(sections).find(item => text(item?.id) === text(sectionId) && text(item?.documentId) === text(documentId)) || null
    : null;
  if (sectionId && !section) return null;
  const relationships = relationshipModel || buildKnowledgeRelationships({ documents, sections });
  const lineage = lineageModel || buildDocumentLineage({ documents, sections });
  const edges = referencedEdgeIds(relationships, text(documentId), text(sectionId));
  const hierarchyEdges = relationships.hierarchy.filter(edge =>
    sectionId && (edge.from === text(sectionId) || edge.to === text(sectionId))
  );
  const relationshipIds = stable([
    ...edges.explicit.map(edge => edge.id),
    ...edges.reverse.map(edge => edge.id),
    ...hierarchyEdges.map(edge => edge.id)
  ]);
  const sectionIds = stable([
    sectionId,
    ...hierarchyEdges.flatMap(edge => [edge.from, edge.to]),
    ...edges.explicit.flatMap(edge => [edge.sourceSectionId, edge.targetSectionId]),
    ...edges.reverse.flatMap(edge => [edge.sourceSectionId, edge.targetSectionId])
  ]);
  const sectionDocuments = list(sections).filter(item => sectionIds.includes(text(item.id))).map(item => item.documentId);
  const documentIds = stable([documentId, ...sectionDocuments]);
  const sameDivision = relationships.sameDivision.filter(edge => edge.from === documentId || edge.to === documentId);
  const sameLibrary = relationships.sameLibrary.filter(edge => edge.from === documentId || edge.to === documentId);
  const classification = { specifications: [], drawings: [], procedures: [], unclassified: [] };
  documentIds.map(id => documents.find(item => text(item.id) === id)).filter(Boolean).forEach(item => {
    const result = classifyEngineeringDocument(item);
    classification[result.type].push({ documentId: text(item.id), basis: result.basis });
  });
  Object.values(classification).forEach(items => items.sort((a, b) => a.documentId.localeCompare(b.documentId)));
  const exactEvidence = list(retrievalSession?.evidence).filter(item =>
    documentIds.includes(text(item.documentId)) || sectionIds.includes(text(item.sectionId))
  );
  if (evidenceId && !exactEvidence.some(item => text(item.id) === text(evidenceId))) return null;
  const lineageContext = lineageForDocument(lineage, documentId);
  const versionIds = stable([
    lineageContext.current?.documentId,
    lineageContext.record?.previousDocumentId,
    ...list(lineageContext.chain?.previous).map(item => item.documentId),
    ...list(lineageContext.chain?.duplicates).map(item => item.documentId)
  ]);
  const relationshipWarnings = relationships.validation;
  const warnings = stable([
    ...list(document.extractionWarnings || document.warnings),
    ...relationshipWarnings.brokenReferences.filter(item => sectionIds.includes(text(item.sectionId))).map(item => `Broken reference: ${item.referenceId}`),
    ...relationshipWarnings.unresolvedReferences.filter(item => sectionIds.includes(text(item.sectionId))).map(item => `Unresolved reference: ${item.referenceNumber}`),
    ...relationshipWarnings.ambiguousReferences.filter(item => sectionIds.includes(text(item.sectionId))).map(item => `Ambiguous reference: ${item.reference}`),
    ...lineage.validation.brokenLineage.filter(item => item.documentId === documentId).map(item => `Broken lineage link: ${item.field}`)
  ]);
  const metadata = {
    buildingId: exactMetadata('buildingId', document, section),
    roomId: exactMetadata('roomId', document, section),
    discipline: exactMetadata('discipline', document, section),
    trade: exactMetadata('trade', document, section)
  };
  const referencedDocumentIds = stable(edges.explicit.flatMap(edge => [edge.sourceDocumentId, edge.targetDocumentId]).filter(id => id && id !== documentId));
  return {
    projectId: text(projectId), libraryId: text(document.libraryId), documentId: text(documentId), sectionId: text(sectionId), evidenceId: text(evidenceId),
    buildingId: metadata.buildingId, roomId: metadata.roomId, discipline: metadata.discipline, trade: metadata.trade,
    documentIds, sectionIds, relationshipIds, versionIds,
    evidenceIds: exactEvidence.map(item => text(item.id)),
    hierarchyRelationshipIds: hierarchyEdges.map(item => item.id).sort(),
    explicitReferenceIds: edges.explicit.map(item => item.id).sort(),
    reverseReferenceIds: edges.reverse.map(item => item.id).sort(),
    referencedDocumentIds,
    contextualSameDivision: sameDivision.map(edge => ({ relationshipId: edge.id, documentId: edge.from === documentId ? edge.to : edge.from })).sort((a, b) => a.documentId.localeCompare(b.documentId)),
    contextualSameLibrary: sameLibrary.map(edge => ({ relationshipId: edge.id, documentId: edge.from === documentId ? edge.to : edge.from })).sort((a, b) => a.documentId.localeCompare(b.documentId)),
    classification,
    lineage: {
      status: lineageContext.record?.status || 'unknown',
      currentDocumentId: lineageContext.current?.documentId || '',
      previousDocumentId: lineageContext.record?.previousDocumentId || '',
      supersededDocumentIds: list(lineageContext.chain?.previous).map(item => item.documentId).sort(),
      duplicateDocumentIds: list(lineageContext.chain?.duplicates).map(item => item.documentId).sort()
    },
    warnings,
    unavailableFields: Object.entries(metadata).filter(([, value]) => !value).map(([field]) => field),
    incomplete: !sectionIds.length || (!edges.explicit.length && !exactEvidence.length),
    evidence: exactEvidence.map(item => ({ id: text(item.id), documentId: text(item.documentId), sectionId: text(item.sectionId), citationReference: text(item.citationReference) }))
      .sort((a, b) => a.id.localeCompare(b.id))
  };
}

export function startInspectionSession(context, navigation = {}) {
  if (!context?.projectId || !context?.documentId) return null;
  inspectionSession = { context, notes: '', currentDocumentId: context.documentId, currentSectionId: context.sectionId, currentEvidenceId: context.evidenceId, navigation: { ...navigation } };
  return getInspectionSession();
}

export function updateInspectionNotes(notes) {
  if (!inspectionSession) return null;
  inspectionSession.notes = String(notes ?? '');
  return getInspectionSession();
}

export function clearInspectionSession() { inspectionSession = null; }
export function getInspectionSession() { return inspectionSession ? structuredClone(inspectionSession) : null; }

export function engineeringNavigationTarget({ projectId, documentId, sectionId = '', evidenceId = '', libraryId = '', origin = '' } = {}) {
  if (!text(projectId) || !text(documentId)) return null;
  return { view: 'engineering', projectId: text(projectId), documentId: text(documentId), sectionId: text(sectionId), evidenceId: text(evidenceId), libraryId: text(libraryId), origin: text(origin) };
}

export function engineeringContextMetrics(context) {
  return {
    activeEngineeringContext: context ? 1 : 0,
    contextHasEvidence: context?.evidenceIds?.length ? 1 : 0,
    contextHasExplicitRelationships: context?.explicitReferenceIds?.length || context?.hierarchyRelationshipIds?.length ? 1 : 0,
    contextHasVersionHistory: context?.versionIds?.length > 1 ? 1 : 0,
    contextHasSpecifications: context?.classification?.specifications?.length ? 1 : 0,
    contextHasDrawings: context?.classification?.drawings?.length ? 1 : 0,
    contextHasProcedures: context?.classification?.procedures?.length ? 1 : 0,
    incompleteContext: context?.incomplete ? 1 : 0
  };
}
