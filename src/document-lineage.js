import { firstText, textValue } from './data-model.js';
import { verifyExtraction } from './extraction-verification.js';
import { buildKnowledgeRelationships } from './knowledge-relationships.js';

const value = input => textValue(input).trim();
const list = input => Array.isArray(input) ? input : [];
const recognizedStatuses = new Set(['current', 'superseded', 'duplicate']);

function explicitLineage(document) {
  return {
    duplicateOfDocumentId: firstText(
      document?.duplicateOfDocumentId,
      document?.metadata?.duplicateOfDocumentId
    ),
    lineageId: firstText(document?.lineageId, document?.metadata?.lineageId),
    previousDocumentId: firstText(
      document?.previousDocumentId,
      document?.metadata?.previousDocumentId
    ),
    status: firstText(
      document?.lineageStatus,
      document?.metadata?.lineageStatus
    ).toLowerCase(),
    supersededByDocumentId: firstText(
      document?.supersededByDocumentId,
      document?.metadata?.supersededByDocumentId
    )
  };
}

function fingerprint(document) {
  const hash = value(document?.contentHash);
  if (hash) return `hash:${hash}`;
  const name = value(document?.name);
  const size = Number(document?.size);
  const modified = Number(document?.lastModified);
  return name && Number.isFinite(size) && Number.isFinite(modified)
    ? `legacy:${name}|${size}|${modified}`
    : '';
}

function findCycles(documents, nextId) {
  const ids = new Set(documents.map(document => value(document.id)));
  const cycles = new Map();
  for (const document of documents) {
    const path = [];
    const seen = new Map();
    let current = document;
    while (current) {
      const id = value(current.id);
      if (seen.has(id)) {
        const cycle = [...path.slice(seen.get(id)), id];
        cycles.set(cycle.slice(0, -1).sort().join('|'), cycle);
        break;
      }
      seen.set(id, path.length);
      path.push(id);
      const next = value(nextId(current));
      current = next && ids.has(next)
        ? documents.find(item => value(item.id) === next)
        : null;
    }
  }
  return [...cycles.values()].sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

export function compareDocumentVersions(
  previous,
  current,
  { documents = [], sections = [], relationshipModel = null } = {}
) {
  if (!previous || !current) return null;
  const allDocuments = list(documents);
  const allSections = list(sections);
  const relationships = relationshipModel || buildKnowledgeRelationships({
    documents: allDocuments,
    sections: allSections
  });
  const extraction = document => verifyExtraction(
    document,
    allSections,
    allDocuments
  );
  const relationCounts = document => ({
    outgoing: relationships.explicitReferences.filter(edge =>
      edge.sourceDocumentId === document.id
    ).length,
    incoming: relationships.reverseReferences.filter(edge =>
      edge.sourceDocumentId === document.id
    ).length,
    divisions: [...new Set(allSections
      .filter(section => section.documentId === document.id)
      .map(section => value(section.division || section.metadata?.division))
      .filter(Boolean))].sort()
  });
  const previousExtraction = extraction(previous);
  const currentExtraction = extraction(current);
  const previousRelationships = relationCounts(previous);
  const currentRelationships = relationCounts(current);
  const fields = [
    ['Section count', Number(previous.sectionCount) || 0, Number(current.sectionCount) || 0, 'Extraction'],
    ['Character count', Number(previous.characterCount) || 0, Number(current.characterCount) || 0, 'Extraction'],
    ['Hierarchy version', previous.hierarchyVersion ?? null, current.hierarchyVersion ?? null, 'Extraction'],
    ['Extraction warnings', previousExtraction.warningCount, currentExtraction.warningCount, 'Extraction'],
    ['Parser', firstText(previousExtraction.parser), firstText(currentExtraction.parser), 'Extraction'],
    ['Outgoing references', previousRelationships.outgoing, currentRelationships.outgoing, 'Relationships'],
    ['Incoming references', previousRelationships.incoming, currentRelationships.incoming, 'Relationships'],
    ['Divisions', previousRelationships.divisions.join(', '), currentRelationships.divisions.join(', '), 'Relationships'],
    ['Library', firstText(previous.libraryId), firstText(current.libraryId), 'Classification']
  ];
  return {
    previousDocumentId: value(previous.id),
    currentDocumentId: value(current.id),
    changes: fields.map(([field, before, after, category]) => ({
      field,
      before,
      after,
      category,
      changed: before !== after
    })),
    extractionChanged: fields.some(item => item[3] === 'Extraction' && item[1] !== item[2]),
    relationshipsChanged: fields.some(item => item[3] === 'Relationships' && item[1] !== item[2])
  };
}

export function buildDocumentLineage({ documents = [], sections = [] } = {}) {
  const safeDocuments = list(documents).filter(document => value(document?.id));
  const byId = new Map(safeDocuments.map(document => [value(document.id), document]));
  const relationshipModel = buildKnowledgeRelationships({
    documents: safeDocuments,
    sections: list(sections)
  });
  const records = safeDocuments.map(document => {
    const explicit = explicitLineage(document);
    const status = explicit.lineageId && recognizedStatuses.has(explicit.status)
      ? explicit.status
      : 'unknown';
    return {
      document,
      documentId: value(document.id),
      lineageId: explicit.lineageId,
      ...explicit,
      status
    };
  });
  const families = new Map();
  for (const record of records) {
    const key = record.lineageId || `unknown:${record.documentId}`;
    if (!families.has(key)) families.set(key, []);
    families.get(key).push(record);
  }
  const duplicateGroups = new Map();
  for (const document of safeDocuments) {
    const key = fingerprint(document);
    if (!key) continue;
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
    duplicateGroups.get(key).push(value(document.id));
  }
  const detectedDuplicates = [...duplicateGroups]
    .filter(([, ids]) => ids.length > 1)
    .map(([fingerprint, ids]) => ({ fingerprint, documentIds: [...ids].sort() }))
    .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  const brokenLineage = [];
  for (const record of records) {
    for (const [field, targetId] of [
      ['previousDocumentId', record.previousDocumentId],
      ['supersededByDocumentId', record.supersededByDocumentId],
      ['duplicateOfDocumentId', record.duplicateOfDocumentId]
    ]) {
      if (targetId && !byId.has(targetId)) {
        brokenLineage.push({ documentId: record.documentId, field, targetId });
      }
    }
  }
  const chains = [...families].map(([lineageId, familyRecords]) => {
    const currentCandidates = familyRecords.filter(record => record.status === 'current');
    const current = currentCandidates.length === 1 ? currentCandidates[0] : null;
    const previous = [];
    const linkedPreviousIds = new Set();
    let cursor = current;
    while (cursor?.previousDocumentId && !linkedPreviousIds.has(cursor.previousDocumentId)) {
      const prior = familyRecords.find(record =>
        record.documentId === cursor.previousDocumentId
      );
      if (!prior) break;
      previous.push(prior);
      linkedPreviousIds.add(prior.documentId);
      cursor = prior;
    }
    previous.push(...familyRecords
      .filter(record =>
        record.status === 'superseded' &&
        !linkedPreviousIds.has(record.documentId)
      )
      .sort((a, b) => a.documentId.localeCompare(b.documentId)));
    const duplicates = familyRecords.filter(record => record.status === 'duplicate');
    const comparisons = [];
    for (const record of familyRecords) {
      if (!record.previousDocumentId) continue;
      const prior = byId.get(record.previousDocumentId);
      if (prior) comparisons.push(compareDocumentVersions(prior, record.document, {
        documents: safeDocuments,
        sections,
        relationshipModel
      }));
    }
    return {
      lineageId,
      current,
      previous,
      duplicates,
      unknown: familyRecords.filter(record => record.status === 'unknown'),
      records: [...familyRecords].sort((a, b) => a.documentId.localeCompare(b.documentId)),
      comparisons,
      currentCandidates: currentCandidates.map(record => record.documentId).sort()
    };
  }).sort((a, b) => a.lineageId.localeCompare(b.lineageId));

  return {
    records,
    chains,
    detectedDuplicates,
    validation: {
      brokenLineage: brokenLineage.sort((a, b) =>
        `${a.documentId}|${a.field}`.localeCompare(`${b.documentId}|${b.field}`)
      ),
      circularPreviousLinks: findCycles(safeDocuments, document =>
        explicitLineage(document).previousDocumentId
      ),
      ambiguousCurrentFamilies: chains
        .filter(chain => chain.currentCandidates.length > 1)
        .map(chain => ({
          lineageId: chain.lineageId,
          documentIds: chain.currentCandidates
        })),
      duplicateImports: records.filter(record => record.status === 'duplicate').length,
      supersededDocuments: records.filter(record => record.status === 'superseded').length,
      unknownVersions: records.filter(record => record.status === 'unknown').length
    }
  };
}

export function lineageForDocument(model, documentId) {
  const record = model.records.find(item => item.documentId === value(documentId)) || null;
  if (!record) return { record: null, chain: null, current: null };
  const chain = model.chains.find(item =>
    item.records.some(candidate => candidate.documentId === record.documentId)
  ) || null;
  return { record, chain, current: chain?.current || null };
}

export function lineageNavigationTarget(documentId) {
  const id = value(documentId);
  return id ? { documentId: id, view: 'versions' } : null;
}
