import { firstText, sectionTextValue, textValue } from './data-model.js';

function numericSourceNumbers(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(Number)
      .filter(value => Number.isInteger(value) && value > 0)
  )];
}

function evidenceCoverage(evidence, citationVerification) {
  if (!evidence.length) {
    return 'No Supporting Evidence';
  }

  const cited = evidence.filter(item => item.cited);
  const contributingDocuments = new Set(
    cited.map(item => item.documentId || item.documentName).filter(Boolean)
  ).size;
  const coverage = Number(citationVerification?.coverage);

  if (
    cited.length >= 3 &&
    contributingDocuments >= 2 &&
    Number.isFinite(coverage) &&
    coverage >= 80
  ) {
    return 'High Evidence';
  }

  if (
    cited.length >= 2 ||
    (
      cited.length >= 1 &&
      Number.isFinite(coverage) &&
      coverage >= 50
    )
  ) {
    return 'Moderate Evidence';
  }

  return 'Limited Evidence';
}

function navigationTarget(hit, document) {
  return {
    documentId: firstText(hit?.documentId, document?.id),
    knowledgeView: 'knowledge',
    sourceView: 'sources'
  };
}

export function createRetrievalSession({
  question,
  timestamp,
  project,
  library,
  mode,
  messageId,
  hits = [],
  citations = [],
  citationVerification = {},
  retrievalMeta = {},
  documents = [],
  libraries = [],
  sections = []
} = {}) {
  const safeHits = Array.isArray(hits) ? hits : [];
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const safeLibraries = Array.isArray(libraries) ? libraries : [];
  const safeSections = Array.isArray(sections) ? sections : [];
  const returnedCitations = numericSourceNumbers(citations);
  const verifiedCitations = numericSourceNumbers(
    citationVerification?.used
  );
  const citedSources = new Set([
    ...returnedCitations,
    ...verifiedCitations
  ]);
  const evidence = safeHits.map((hit, index) => {
    const document = safeDocuments.find(item =>
      item?.id && item.id === hit?.documentId
    );
    const sourceLibrary = safeLibraries.find(item =>
      item?.id && item.id === (hit?.libraryId || document?.libraryId)
    );
    const sourceNumber = Number(hit?.sourceNumber) || index + 1;
    const storedText = sectionTextValue(hit);
    const parent = safeSections.find(section =>
      section?.id && section.id === hit?.parentId
    );
    const excerptLimit = 360;
    const excerpt = storedText.length > excerptLimit
      ? `${storedText.slice(0, excerptLimit - 1)}…`
      : storedText;

    return {
      citationReference: `S${sourceNumber}`,
      cited: citedSources.has(sourceNumber),
      documentId: firstText(hit?.documentId, document?.id),
      documentName: firstText(
        hit?.documentName,
        document?.name,
        'Unknown document'
      ),
      documentMetadata: document
        ? {
            category: firstText(document.category),
            extension: firstText(document.extension),
            status: firstText(document.status),
            type: firstText(document.type)
          }
        : {},
      excerpt,
      fullText: storedText,
      heading: firstText(hit?.heading, hit?.title, 'Untitled section'),
      hierarchyLevel: Number.isFinite(Number(hit?.level))
        ? Number(hit.level)
        : null,
      hierarchyPath: Array.isArray(hit?.path)
        ? hit.path.map(textValue)
        : [],
      id: firstText(hit?.id, `evidence-${sourceNumber}`),
      libraryId: firstText(hit?.libraryId, document?.libraryId),
      libraryName: firstText(sourceLibrary?.name, 'Unavailable'),
      location: firstText(hit?.location),
      matchedIntents: Array.isArray(hit?.matchedIntents)
        ? hit.matchedIntents.map(textValue)
        : [],
      matchedPhrases: Array.isArray(hit?.matchedPhrases)
        ? hit.matchedPhrases.map(textValue)
        : [],
      matchedReferences: Array.isArray(hit?.matchedReferences)
        ? hit.matchedReferences.map(textValue)
        : [],
      matchedTerms: Array.isArray(hit?.matchedTerms)
        ? hit.matchedTerms.map(textValue)
        : [],
      navigation: navigationTarget(hit, document),
      order: index,
      parentId: firstText(hit?.parentId),
      parentHeading: firstText(
        parent?.heading,
        parent?.title,
        parent?.label
      ),
      retrievalComponents:
        hit?.components && typeof hit.components === 'object'
          ? { ...hit.components }
          : {},
      retrievalScore: Number.isFinite(Number(hit?.score))
        ? Number(hit.score)
        : null,
      retrievalStatus: citedSources.has(sourceNumber)
        ? 'Cited in answer'
        : 'Retrieved, not cited',
      sectionId: firstText(hit?.id),
      sectionNumber: firstText(
        hit?.sectionNumber,
        hit?.metadata?.sectionNumber
      ),
      sectionTitle: firstText(
        hit?.sectionTitle,
        hit?.metadata?.sectionTitle
      ),
      sourceNumber
    };
  });
  const citedEvidence = evidence.filter(item => item.cited);
  const representedDocuments = new Set(
    evidence.map(item => item.documentId || item.documentName).filter(Boolean)
  );

  return {
    candidateDocumentsRepresented: representedDocuments.size,
    candidateSections: Number.isFinite(Number(retrievalMeta?.totalSectionsSearched))
      ? Number(retrievalMeta.totalSectionsSearched)
      : safeHits.length,
    citationVerification: {
      coverage: Number.isFinite(Number(citationVerification?.coverage))
        ? Number(citationVerification.coverage)
        : null,
      invalid: numericSourceNumbers(citationVerification?.invalid),
      materialClaims: Number(citationVerification?.materialClaims) || 0,
      passed: citationVerification?.passed === true,
      uncited: Array.isArray(citationVerification?.uncited)
        ? citationVerification.uncited.map(textValue)
        : [],
      used: verifiedCitations
    },
    citationsReturned: returnedCitations,
    coverageClassification: evidenceCoverage(
      evidence,
      citationVerification
    ),
    evidence,
    evidenceUsed: citedEvidence.length,
    library: {
      id: firstText(library?.id),
      name: firstText(library?.name, 'Unavailable')
    },
    matchedSections: Number.isFinite(Number(retrievalMeta?.totalCandidates))
      ? Number(retrievalMeta.totalCandidates)
      : safeHits.length,
    messageId: firstText(messageId),
    mode: firstText(mode, 'Unavailable'),
    project: {
      id: firstText(project?.id),
      name: firstText(project?.name, 'Unavailable')
    },
    question: textValue(question).trim(),
    retrievalMeta: {
      hierarchyFirst: retrievalMeta?.hierarchyFirst === true,
      retrievalVersion: firstText(retrievalMeta?.retrievalVersion),
      totalCandidates: Number(retrievalMeta?.totalCandidates) || 0,
      totalSectionsAvailable:
        Number(retrievalMeta?.totalSectionsAvailable) || 0,
      totalSectionsSearched:
        Number(retrievalMeta?.totalSectionsSearched) || 0
    },
    selectedEvidence: citedEvidence,
    timestamp: firstText(timestamp, new Date().toISOString())
  };
}

export function evidenceNavigationTarget(session, evidenceId) {
  const evidence = session?.evidence?.find(item => item.id === evidenceId);
  return evidence ? { ...evidence.navigation } : null;
}
