const list = value => Array.isArray(value) ? value : [];
const text = value => value === null || value === undefined ? '' : String(value).trim();
const compact = value => text(value).replace(/\s+/g, ' ');
const id = value => text(value);
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : null;
const matchRuleLabels = Object.freeze({
  'exact-section-id': 'Matched by exact section ID',
  'unique-section-number': 'Matched by section number',
  'unique-hierarchy-path': 'Matched by hierarchy path',
  'unique-content-fingerprint': 'Matched by exact content fingerprint'
});

export function revisionMatchRuleLabel(rule) {
  return matchRuleLabels[text(rule)] || '';
}

function sectionDocumentId(section) {
  return id(section?.documentId || section?.docId || section?.metadata?.documentId);
}

function sectionTitle(section) {
  return text(section?.sectionTitle || section?.title || section?.heading);
}

function sectionPath(section) {
  const path = section?.path || section?.hierarchyPath || section?.metadata?.path;
  if (Array.isArray(path)) return path.map(compact).filter(Boolean).join(' / ');
  return compact(path);
}

function sectionNumber(section) {
  return compact(section?.sectionNumber || section?.number || section?.metadata?.sectionNumber).toLowerCase();
}

function sectionText(section) {
  return String(section?.text || section?.content || section?.body || '');
}

export function normalizedContentFingerprint(section) {
  const normalized = compact(sectionText(section));
  return normalized ? `${normalized.length}:${normalized}` : '';
}

function exactSet(value) {
  return [...new Set(list(value).map(text).filter(Boolean))].sort();
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function warnings(value) {
  return exactSet(value?.extractionWarnings || value?.parserWarnings || value?.warnings || value?.metadata?.warnings);
}

function parserMetadata(document, section) {
  return text(
    section?.parser || section?.parserType || section?.metadata?.parser ||
    document?.parser || document?.parserType || document?.metadata?.parser || document?.metadata?.parserType
  );
}

function sectionOrder(section) {
  return numeric(section?.order ?? section?.sequence ?? section?.index ?? section?.metadata?.order);
}

function sectionLevel(section) {
  return numeric(section?.level ?? section?.hierarchyLevel ?? section?.metadata?.level);
}

function sectionType(section) {
  return text(section?.hierarchyType || section?.kind || section?.type || section?.metadata?.hierarchyType);
}

function compareSets(before, after) {
  return {
    added: after.filter(value => !before.includes(value)),
    removed: before.filter(value => !after.includes(value)),
    changed: !arraysEqual(before, after)
  };
}

function difference(field, before, after) {
  return before === after ? null : { field, before, after };
}

function compareMatch(earlier, later, earlierDocument, laterDocument, matchRule) {
  const earlierReferences = exactSet(earlier.crossReferences || earlier.metadata?.crossReferences);
  const laterReferences = exactSet(later.crossReferences || later.metadata?.crossReferences);
  const earlierReferenceIds = exactSet(earlier.crossReferenceIds || earlier.metadata?.crossReferenceIds);
  const laterReferenceIds = exactSet(later.crossReferenceIds || later.metadata?.crossReferenceIds);
  const referenceText = compareSets(earlierReferences, laterReferences);
  const referenceIds = compareSets(earlierReferenceIds, laterReferenceIds);
  const earlierWarnings = exactSet([...warnings(earlier), ...warnings(earlierDocument)]);
  const laterWarnings = exactSet([...warnings(later), ...warnings(laterDocument)]);
  const extractionWarningChanges = compareSets(earlierWarnings, laterWarnings);
  const earlierParser = parserMetadata(earlierDocument, earlier);
  const laterParser = parserMetadata(laterDocument, later);
  const earlierStoredText = sectionText(earlier);
  const laterStoredText = sectionText(later);
  const earlierFingerprint = normalizedContentFingerprint(earlier);
  const laterFingerprint = normalizedContentFingerprint(later);
  const earlierCharacters = numeric(earlier.characters ?? earlier.characterCount) ?? earlierStoredText.length;
  const laterCharacters = numeric(later.characters ?? later.characterCount) ?? laterStoredText.length;

  const structuralDifferences = [
    difference('Title', sectionTitle(earlier), sectionTitle(later)),
    difference('Parent ID', id(earlier.parentId), id(later.parentId)),
    difference('Hierarchy path', sectionPath(earlier), sectionPath(later)),
    difference('Hierarchy level', sectionLevel(earlier), sectionLevel(later)),
    difference('Hierarchy type', sectionType(earlier), sectionType(later)),
    difference('Order', sectionOrder(earlier), sectionOrder(later)),
    difference('Division', text(earlier.division || earlier.metadata?.division), text(later.division || later.metadata?.division)),
    difference('Library ID', text(earlier.libraryId || earlierDocument?.libraryId), text(later.libraryId || laterDocument?.libraryId))
  ].filter(Boolean);
  const extractionDifferences = [
    difference('Character count', earlierCharacters, laterCharacters),
    difference('Parser', earlierParser, laterParser)
  ].filter(Boolean);
  if (extractionWarningChanges.changed) {
    extractionDifferences.push({ field: 'Extraction warnings', before: earlierWarnings, after: laterWarnings });
  }

  const flags = [];
  if (earlierStoredText !== laterStoredText || earlierFingerprint !== laterFingerprint) flags.push('content-changed');
  if (structuralDifferences.length) flags.push('structurally-changed');
  if (referenceText.changed || referenceIds.changed) flags.push('reference-changed');
  if (extractionDifferences.length) flags.push('extraction-changed');
  if (!flags.length) flags.push('unchanged');

  return {
    earlierSectionId: id(earlier.id),
    laterSectionId: id(later.id),
    earlier,
    later,
    matchRule,
    flags,
    content: {
      changed: flags.includes('content-changed'),
      earlierCharacters,
      laterCharacters,
      earlierFingerprint,
      laterFingerprint,
      earlierText: earlierStoredText,
      laterText: laterStoredText
    },
    structuralDifferences,
    referenceDifferences: {
      crossReferences: referenceText,
      crossReferenceIds: referenceIds
    },
    extractionDifferences
  };
}

const matchingRules = [
  { name: 'exact-section-id', key: section => id(section.id) },
  { name: 'unique-section-number', key: sectionNumber },
  { name: 'unique-hierarchy-path', key: sectionPath },
  { name: 'unique-content-fingerprint', key: normalizedContentFingerprint }
];

function groups(sections, keyFor) {
  const result = new Map();
  for (const section of sections) {
    const key = keyFor(section);
    if (!key) continue;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(section);
  }
  return result;
}

function stableSectionSort(left, right) {
  return (sectionOrder(left) ?? Number.MAX_SAFE_INTEGER) - (sectionOrder(right) ?? Number.MAX_SAFE_INTEGER) ||
    sectionNumber(left).localeCompare(sectionNumber(right)) ||
    sectionPath(left).localeCompare(sectionPath(right)) ||
    id(left.id).localeCompare(id(right.id));
}

export function revisionPairStatus(earlierDocument, laterDocument, documents = []) {
  const available = new Set(list(documents).map(document => id(document?.id)).filter(Boolean));
  const earlierId = id(earlierDocument?.id);
  const laterId = id(laterDocument?.id);
  const earlierLineage = id(earlierDocument?.lineageId || earlierDocument?.metadata?.lineageId);
  const laterLineage = id(laterDocument?.lineageId || laterDocument?.metadata?.lineageId);
  const previousId = id(laterDocument?.previousDocumentId || laterDocument?.metadata?.previousDocumentId);
  const reasons = [];
  if (!earlierDocument || !earlierId || !available.has(earlierId)) reasons.push('Earlier document is unavailable.');
  if (!laterDocument || !laterId || !available.has(laterId)) reasons.push('Later document is unavailable.');
  if (!earlierLineage || !laterLineage) reasons.push('Both documents require explicit lineage IDs.');
  else if (earlierLineage !== laterLineage) reasons.push('The documents belong to different explicit lineages.');
  if (!earlierId || previousId !== earlierId) reasons.push('The later document does not link to the earlier document through previousDocumentId.');
  return { comparable: reasons.length === 0, reasons, lineageId: reasons.length ? '' : earlierLineage };
}

export function compareRevisions({ earlierDocument, laterDocument, documents = [], sections = [] } = {}) {
  const pair = revisionPairStatus(earlierDocument, laterDocument, documents);
  const result = {
    comparable: pair.comparable,
    reasons: pair.reasons,
    lineageId: pair.lineageId,
    earlierDocument,
    laterDocument,
    matches: [],
    added: [],
    removed: [],
    ambiguous: [],
    unmatched: [],
    integrityWarnings: [],
    summary: {
      unchanged: 0, added: 0, removed: 0, contentChanged: 0,
      structurallyChanged: 0, referenceChanged: 0, extractionChanged: 0,
      ambiguous: 0, unmatched: 0
    }
  };
  if (!pair.comparable) return result;

  let earlierRemaining = list(sections).filter(section => sectionDocumentId(section) === id(earlierDocument.id)).sort(stableSectionSort);
  let laterRemaining = list(sections).filter(section => sectionDocumentId(section) === id(laterDocument.id)).sort(stableSectionSort);

  for (const rule of matchingRules) {
    const earlierGroups = groups(earlierRemaining, rule.key);
    const laterGroups = groups(laterRemaining, rule.key);
    const matchedEarlier = new Set();
    const matchedLater = new Set();
    const sharedKeys = [...earlierGroups.keys()].filter(key => laterGroups.has(key)).sort();
    for (const key of sharedKeys) {
      const earlierCandidates = earlierGroups.get(key);
      const laterCandidates = laterGroups.get(key);
      if (earlierCandidates.length > 1 || laterCandidates.length > 1) {
        const ambiguity = {
          rule: rule.name,
          key,
          earlierSectionIds: earlierCandidates.map(item => id(item.id)).sort(),
          laterSectionIds: laterCandidates.map(item => id(item.id)).sort()
        };
        result.ambiguous.push(ambiguity);
        earlierCandidates.forEach(item => matchedEarlier.add(item));
        laterCandidates.forEach(item => matchedLater.add(item));
        continue;
      }
      const earlier = earlierCandidates[0];
      const later = laterCandidates[0];
      result.matches.push(compareMatch(earlier, later, earlierDocument, laterDocument, rule.name));
      matchedEarlier.add(earlier);
      matchedLater.add(later);
    }
    earlierRemaining = earlierRemaining.filter(section => !matchedEarlier.has(section));
    laterRemaining = laterRemaining.filter(section => !matchedLater.has(section));
  }

  result.removed = earlierRemaining.map(section => ({ section, sectionId: id(section.id), flags: ['removed', 'unmatched'] }));
  result.added = laterRemaining.map(section => ({ section, sectionId: id(section.id), flags: ['added', 'unmatched'] }));
  result.unmatched = [
    ...result.removed.map(item => ({ ...item, revision: 'earlier' })),
    ...result.added.map(item => ({ ...item, revision: 'later' }))
  ];
  result.matches.sort((left, right) => stableSectionSort(left.earlier, right.earlier));
  result.ambiguous.sort((left, right) => `${left.rule}|${left.key}`.localeCompare(`${right.rule}|${right.key}`));
  result.summary = {
    unchanged: result.matches.filter(match => match.flags.includes('unchanged')).length,
    added: result.added.length,
    removed: result.removed.length,
    contentChanged: result.matches.filter(match => match.flags.includes('content-changed')).length,
    structurallyChanged: result.matches.filter(match => match.flags.includes('structurally-changed')).length,
    referenceChanged: result.matches.filter(match => match.flags.includes('reference-changed')).length,
    extractionChanged: result.matches.filter(match => match.flags.includes('extraction-changed')).length,
    ambiguous: result.ambiguous.length,
    unmatched: result.unmatched.length
  };
  result.integrityWarnings = [
    ...result.ambiguous.map(item => `${item.rule} produced multiple exact candidates for ${item.key}.`),
    ...(result.unmatched.length ? [`${result.unmatched.length} section record(s) could not be deterministically paired.`] : [])
  ];
  return result;
}

export function buildRevisionMetrics({ documents = [], sections = [] } = {}) {
  const safeDocuments = list(documents);
  const byId = new Map(safeDocuments.map(document => [id(document?.id), document]));
  const comparisons = [];
  let brokenLineageLinks = 0;
  for (const later of [...safeDocuments].sort((a, b) => id(a.id).localeCompare(id(b.id)))) {
    const previousId = id(later?.previousDocumentId || later?.metadata?.previousDocumentId);
    if (!previousId) continue;
    const earlier = byId.get(previousId);
    if (!earlier) {
      brokenLineageLinks += 1;
      continue;
    }
    const comparison = compareRevisions({ earlierDocument: earlier, laterDocument: later, documents: safeDocuments, sections });
    if (comparison.comparable) comparisons.push(comparison);
    else brokenLineageLinks += 1;
  }
  return {
    comparableRevisionPairs: comparisons.length,
    ambiguousRevisionPairs: comparisons.filter(item => item.ambiguous.length).length,
    brokenLineageLinks,
    addedSections: comparisons.reduce((sum, item) => sum + item.summary.added, 0),
    removedSections: comparisons.reduce((sum, item) => sum + item.summary.removed, 0),
    changedSections: comparisons.reduce((sum, item) => sum + item.matches.filter(match => !match.flags.includes('unchanged')).length, 0),
    unmatchedSections: comparisons.reduce((sum, item) => sum + item.summary.unmatched, 0),
    comparisons
  };
}

export function revisionNavigationTarget(earlierDocumentId, laterDocumentId, options = {}) {
  const earlierId = id(earlierDocumentId);
  const laterId = id(laterDocumentId);
  if (!earlierId || !laterId) return null;
  return {
    view: 'revisions',
    earlierDocumentId: earlierId,
    laterDocumentId: laterId,
    originatingWorkspace: text(options.originatingWorkspace || 'versions')
  };
}
