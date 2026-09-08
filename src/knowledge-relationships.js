import { sectionNumberKey, textValue } from './data-model.js';

const value = input => textValue(input).trim();
const list = input => Array.isArray(input) ? input : [];
const stable = items => [...items].sort((a, b) =>
  `${a.type || ''}|${a.from || ''}|${a.to || ''}|${a.id || ''}`
    .localeCompare(`${b.type || ''}|${b.from || ''}|${b.to || ''}|${b.id || ''}`)
);

function cycles(nodes, adjacency) {
  const found = new Map();
  const visited = new Set();
  const active = new Set();
  const path = [];

  const visit = id => {
    if (active.has(id)) {
      const start = path.indexOf(id);
      const cycle = [...path.slice(start), id];
      const canonical = cycle.slice(0, -1).sort().join('|');
      found.set(canonical, cycle);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    active.add(id);
    path.push(id);
    for (const next of adjacency.get(id) || []) visit(next);
    path.pop();
    active.delete(id);
  };

  for (const node of [...nodes].sort()) visit(node);
  return [...found.values()].sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

export function buildKnowledgeRelationships({ documents = [], sections = [] } = {}) {
  const safeDocuments = list(documents).filter(item => value(item?.id));
  const safeSections = list(sections).filter(item => value(item?.id));
  const documentsById = new Map(safeDocuments.map(item => [value(item.id), item]));
  const sectionGroups = new Map();
  const sectionNumbers = new Map();

  for (const section of safeSections) {
    const id = value(section.id);
    if (!sectionGroups.has(id)) sectionGroups.set(id, []);
    sectionGroups.get(id).push(section);
    const number = sectionNumberKey(section.sectionNumber || section.metadata?.sectionNumber);
    if (number) {
      if (!sectionNumbers.has(number)) sectionNumbers.set(number, []);
      sectionNumbers.get(number).push(section);
    }
  }

  const sectionById = new Map(
    [...sectionGroups].filter(([, items]) => items.length === 1)
      .map(([id, items]) => [id, items[0]])
  );
  const membership = [];
  const hierarchy = [];
  const explicitReferences = [];
  const brokenReferences = [];
  const unresolvedReferences = [];
  const ambiguousReferences = [];
  const orphanedHierarchy = [];
  const duplicateReferences = [];
  const duplicateHierarchyEdges = [];
  const hierarchyEdgeCounts = new Map();
  const explicitEdgeKeys = new Set();

  for (const section of safeSections) {
    const sectionId = value(section.id);
    const documentId = value(section.documentId);
    if (documentId && documentsById.has(documentId)) {
      membership.push({
        id: `membership:${documentId}:${sectionId}`,
        type: 'Document membership',
        from: documentId,
        to: sectionId,
        documentId,
        sectionId
      });
    }

    const parentId = value(section.parentId);
    if (parentId) {
      if (sectionById.has(parentId)) {
        const key = `${parentId}->${sectionId}`;
        hierarchyEdgeCounts.set(key, (hierarchyEdgeCounts.get(key) || 0) + 1);
        hierarchy.push({
          id: `hierarchy:${parentId}:${sectionId}`,
          type: 'Hierarchy',
          from: parentId,
          to: sectionId,
          parentId,
          childId: sectionId
        });
      } else {
        orphanedHierarchy.push({ sectionId, parentId, documentId });
      }
    }

    const rawIds = list(section.crossReferenceIds).map(value).filter(Boolean);
    const rawNumbers = list(section.crossReferences)
      .map(reference => sectionNumberKey(reference))
      .filter(Boolean);
    const rawKeys = [
      ...rawIds.map(reference => `id:${reference}`),
      ...rawNumbers.map(reference => `number:${reference}`)
    ];
    const counts = rawKeys.reduce((map, key) =>
      map.set(key, (map.get(key) || 0) + 1), new Map());
    for (const [reference, count] of counts) {
      if (count > 1) duplicateReferences.push({ sectionId, reference, count });
    }

    const addReference = (target, sourceKind, reference) => {
      const targetId = value(target.id);
      const key = `${sectionId}->${targetId}`;
      if (explicitEdgeKeys.has(key)) return;
      explicitEdgeKeys.add(key);
      explicitReferences.push({
        id: `reference:${sectionId}:${targetId}`,
        type: 'Explicit reference',
        from: sectionId,
        to: targetId,
        sourceSectionId: sectionId,
        targetSectionId: targetId,
        sourceDocumentId: documentId,
        targetDocumentId: value(target.documentId),
        sourceKind,
        reference
      });
    };

    const resolvedReferenceNumbers = new Set();
    for (const referenceId of [...new Set(rawIds)]) {
      const candidates = sectionGroups.get(referenceId) || [];
      if (candidates.length === 1) {
        addReference(candidates[0], 'crossReferenceId', referenceId);
        const resolvedNumber = sectionNumberKey(
          candidates[0].sectionNumber || candidates[0].metadata?.sectionNumber
        );
        if (resolvedNumber) resolvedReferenceNumbers.add(resolvedNumber);
      } else if (!candidates.length) {
        brokenReferences.push({ sectionId, referenceId, documentId });
      } else {
        ambiguousReferences.push({
          sectionId,
          reference: referenceId,
          kind: 'crossReferenceId',
          matches: candidates.map(item => value(item.id))
        });
      }
    }

    for (const referenceNumber of [...new Set(rawNumbers)]) {
      if (resolvedReferenceNumbers.has(referenceNumber)) continue;
      const candidates = sectionNumbers.get(referenceNumber) || [];
      if (candidates.length === 1) {
        addReference(candidates[0], 'sectionNumber', referenceNumber);
      } else if (!candidates.length) {
        unresolvedReferences.push({ sectionId, referenceNumber, documentId });
      } else {
        ambiguousReferences.push({
          sectionId,
          reference: referenceNumber,
          kind: 'sectionNumber',
          matches: candidates.map(item => value(item.id)).sort()
        });
      }
    }
  }

  for (const [edge, count] of hierarchyEdgeCounts) {
    if (count > 1) duplicateHierarchyEdges.push({ edge, count });
  }

  const reverseReferences = explicitReferences.map(edge => ({
    id: `reverse:${edge.targetSectionId}:${edge.sourceSectionId}`,
    type: 'Reverse reference',
    from: edge.targetSectionId,
    to: edge.sourceSectionId,
    sourceSectionId: edge.targetSectionId,
    targetSectionId: edge.sourceSectionId,
    sourceDocumentId: edge.targetDocumentId,
    targetDocumentId: edge.sourceDocumentId,
    explicitReferenceId: edge.id
  }));
  const documentReferences = [];
  const documentReferenceKeys = new Set();
  for (const edge of explicitReferences) {
    if (
      edge.sourceDocumentId &&
      edge.targetDocumentId &&
      edge.sourceDocumentId !== edge.targetDocumentId
    ) {
      const key = `${edge.sourceDocumentId}->${edge.targetDocumentId}`;
      if (!documentReferenceKeys.has(key)) {
        documentReferenceKeys.add(key);
        documentReferences.push({
          id: `document-reference:${key}`,
          type: 'Explicit reference',
          from: edge.sourceDocumentId,
          to: edge.targetDocumentId,
          sourceSectionId: edge.sourceSectionId,
          targetSectionId: edge.targetSectionId
        });
      }
    }
  }

  const divisionsByDocument = new Map();
  for (const section of safeSections) {
    const documentId = value(section.documentId);
    const division = value(section.division || section.metadata?.division);
    if (!documentId || !division) continue;
    if (!divisionsByDocument.has(documentId)) divisionsByDocument.set(documentId, new Set());
    divisionsByDocument.get(documentId).add(division);
  }
  const sameDivision = [];
  const sameLibrary = [];
  for (let index = 0; index < safeDocuments.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < safeDocuments.length; otherIndex += 1) {
      const first = safeDocuments[index];
      const second = safeDocuments[otherIndex];
      const firstId = value(first.id);
      const secondId = value(second.id);
      const sharedDivisions = [...(divisionsByDocument.get(firstId) || [])]
        .filter(division => divisionsByDocument.get(secondId)?.has(division))
        .sort();
      if (sharedDivisions.length) {
        sameDivision.push({
          id: `same-division:${firstId}:${secondId}`,
          type: 'Same division',
          from: firstId,
          to: secondId,
          divisions: sharedDivisions
        });
      }
      const firstLibrary = value(first.libraryId);
      if (firstLibrary && firstLibrary === value(second.libraryId)) {
        sameLibrary.push({
          id: `same-library:${firstId}:${secondId}`,
          type: 'Same library',
          from: firstId,
          to: secondId,
          libraryId: firstLibrary
        });
      }
    }
  }

  const hierarchyAdjacency = new Map();
  for (const edge of hierarchy) {
    if (!hierarchyAdjacency.has(edge.from)) hierarchyAdjacency.set(edge.from, []);
    hierarchyAdjacency.get(edge.from).push(edge.to);
  }
  const referenceAdjacency = new Map();
  for (const edge of explicitReferences) {
    if (!referenceAdjacency.has(edge.from)) referenceAdjacency.set(edge.from, []);
    referenceAdjacency.get(edge.from).push(edge.to);
  }
  const circularParentChains = cycles(sectionById.keys(), hierarchyAdjacency);
  const circularReferences = cycles(sectionById.keys(), referenceAdjacency);
  const relatedDocumentIds = new Set();
  for (const edge of [...documentReferences, ...sameDivision, ...sameLibrary]) {
    relatedDocumentIds.add(edge.from);
    relatedDocumentIds.add(edge.to);
  }
  const documentsWithoutRelationships = safeDocuments
    .filter(document => !relatedDocumentIds.has(value(document.id)))
    .map(document => value(document.id))
    .sort();

  return {
    documents: safeDocuments,
    sections: safeSections,
    membership: stable(membership),
    hierarchy: stable(hierarchy),
    explicitReferences: stable(explicitReferences),
    reverseReferences: stable(reverseReferences),
    documentReferences: stable(documentReferences),
    sameDivision: stable(sameDivision),
    sameLibrary: stable(sameLibrary),
    validation: {
      ambiguousReferences: stable(ambiguousReferences),
      brokenReferences: stable(brokenReferences),
      circularParentChains,
      circularReferences,
      documentsWithoutRelationships,
      duplicateHierarchyEdges: stable(duplicateHierarchyEdges),
      duplicateReferences: stable(duplicateReferences),
      orphanedHierarchy: stable(orphanedHierarchy),
      unresolvedReferences: stable(unresolvedReferences)
    }
  };
}

export function relationshipContext(model, { documentId, sectionId } = {}) {
  const targetDocumentId = value(documentId);
  const targetSectionId = value(sectionId);
  const section = model.sections.find(item =>
    value(item.id) === targetSectionId &&
    (!targetDocumentId || value(item.documentId) === targetDocumentId)
  ) || null;
  const resolvedDocumentId = targetDocumentId || value(section?.documentId);
  const document = model.documents.find(item => value(item.id) === resolvedDocumentId) || null;
  const parentEdge = model.hierarchy.find(edge => edge.to === targetSectionId);

  return {
    document,
    section,
    parent: parentEdge
      ? model.sections.find(item => value(item.id) === parentEdge.from) || null
      : null,
    children: model.hierarchy.filter(edge => edge.from === targetSectionId)
      .map(edge => model.sections.find(item => value(item.id) === edge.to))
      .filter(Boolean),
    references: model.explicitReferences.filter(edge => edge.from === targetSectionId),
    referencedBy: model.reverseReferences.filter(edge => edge.from === targetSectionId),
    referencedDocuments: model.documentReferences.filter(edge => edge.from === resolvedDocumentId),
    relatedDocuments: model.documentReferences.filter(edge =>
      edge.from === resolvedDocumentId || edge.to === resolvedDocumentId
    ),
    sameDivision: model.sameDivision.filter(edge =>
      edge.from === resolvedDocumentId || edge.to === resolvedDocumentId
    ),
    sameLibrary: model.sameLibrary.filter(edge =>
      edge.from === resolvedDocumentId || edge.to === resolvedDocumentId
    )
  };
}

export function buildRelationshipGraph(model, context = {}) {
  const selected = relationshipContext(model, context);
  if (!selected.document) return { nodes: [], edges: [], textAlternative: [] };
  const documentId = value(selected.document.id);
  const relevantEdges = [
    ...model.membership.filter(edge => edge.from === documentId),
    ...model.hierarchy.filter(edge => {
      const child = model.sections.find(item => value(item.id) === edge.to);
      return value(child?.documentId) === documentId;
    }),
    ...model.explicitReferences.filter(edge =>
      edge.sourceDocumentId === documentId || edge.targetDocumentId === documentId
    ),
    ...model.sameDivision.filter(edge => edge.from === documentId || edge.to === documentId),
    ...model.sameLibrary.filter(edge => edge.from === documentId || edge.to === documentId)
  ];
  const nodeIds = new Set([documentId]);
  relevantEdges.forEach(edge => {
    nodeIds.add(edge.from);
    nodeIds.add(edge.to);
  });
  const nodes = [...nodeIds].map(id => {
    const document = model.documents.find(item => value(item.id) === id);
    const section = model.sections.find(item => value(item.id) === id);
    return {
      id,
      type: document ? 'Document' : 'Section',
      label: value(document?.title || document?.name || section?.heading || section?.title || id)
    };
  }).sort((a, b) => `${a.type}|${a.label}|${a.id}`.localeCompare(`${b.type}|${b.label}|${b.id}`));
  const edges = stable(relevantEdges);
  return {
    nodes,
    edges,
    textAlternative: edges.map(edge => `${edge.type}: ${edge.from} → ${edge.to}`)
  };
}

export function relationshipNavigationTarget({ documentId, sectionId, origin = 'relationships' } = {}) {
  const targetDocumentId = value(documentId);
  if (!targetDocumentId) return null;
  return {
    documentId: targetDocumentId,
    sectionId: value(sectionId),
    origin: value(origin),
    knowledgeView: 'knowledge',
    sourceView: 'sources',
    relationshipView: 'relationships'
  };
}
