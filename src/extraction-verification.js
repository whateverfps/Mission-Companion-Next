import {
  firstText,
  normalizedText,
  sectionTextValue,
  textValue
} from './data-model.js';

const INDEXED_STATUSES = new Set([
  'verified',
  'indexed',
  'complete',
  'ready'
]);
const PENDING_STATUSES = new Set([
  'waiting',
  'processing',
  'pending'
]);
const FAILED_STATUSES = new Set([
  'error',
  'failed',
  'unavailable'
]);

function rawSectionTitle(section) {
  return firstText(
    section?.heading,
    section?.label,
    section?.title,
    section?.metadata?.heading,
    section?.metadata?.title
  ).trim();
}

function sectionCharacters(section) {
  const text = sectionTextValue(section);
  const recorded = Number(section?.characters);

  return Number.isFinite(recorded) && recorded >= 0
    ? recorded
    : text.length;
}

function optionalNumber(...values) {
  const value = values.find(item =>
    item !== null &&
    item !== undefined &&
    item !== '' &&
    Number.isFinite(Number(item))
  );

  return value === undefined ? null : Number(value);
}

function documentStatus(document) {
  return textValue(document?.status).trim().toLowerCase();
}

function documentWarnings(document) {
  const values = [
    ...(Array.isArray(document?.warnings) ? document.warnings : []),
    ...(Array.isArray(document?.parserWarnings)
      ? document.parserWarnings
      : []),
    ...(Array.isArray(document?.metadata?.warnings)
      ? document.metadata.warnings
      : []),
    ...(Array.isArray(document?.metadata?.parserWarnings)
      ? document.metadata.parserWarnings
      : [])
  ]
    .map(value => textValue(value).trim())
    .filter(Boolean);

  if (
    textValue(document?.health).toLowerCase() === 'warning' &&
    textValue(document?.healthDetail).trim()
  ) {
    values.push(textValue(document.healthDetail).trim());
  }

  return [...new Set(values)];
}

function hasHierarchyMetadata(section) {
  return Boolean(
    Number(section?.hierarchyVersion) > 0 ||
    textValue(section?.hierarchyType).trim() ||
    textValue(section?.kind).trim() ||
    textValue(section?.parentId).trim() ||
    (Array.isArray(section?.path) && section.path.length) ||
    Number(section?.level) > 0
  );
}

function pageMetadataAvailable(document, sections) {
  return optionalNumber(
    document?.pageCount,
    document?.pages,
    document?.metadata?.pageCount,
    document?.metadata?.pages,
    ...sections.flatMap(section => [
      section?.page,
      section?.pageStart,
      section?.pageEnd
    ])
  ) !== null;
}

function invalidLink(section, document) {
  if (textValue(section?.documentId) !== textValue(document?.id)) {
    return true;
  }

  if (
    section?.projectId &&
    document?.projectId &&
    section.projectId !== document.projectId
  ) {
    return true;
  }

  if (
    section?.libraryId &&
    document?.libraryId &&
    section.libraryId !== document.libraryId
  ) {
    return true;
  }

  return Boolean(
    section?.documentName &&
    document?.name &&
    section.documentName !== document.name
  );
}

function check(status, label, detail) {
  return { detail, label, status };
}

export function buildSectionPreview(
  section,
  index = 0,
  maxLength = 240,
  sections = []
) {
  const text = sectionTextValue(section);
  const normalized = normalizedText(text);
  const limit = Math.max(40, Number(maxLength) || 240);
  const excerpt = normalized.length > limit
    ? `${normalized.slice(0, limit - 1)}…`
    : normalized;
  const parent = sections.find(candidate =>
    candidate?.id && candidate.id === section?.parentId
  );
  const title = rawSectionTitle(section);

  return {
    characters: sectionCharacters(section),
    empty: normalized.length === 0,
    excerpt,
    hierarchyLevel: optionalNumber(
      section?.level,
      section?.hierarchyLevel
    ),
    id: textValue(section?.id),
    order: Number.isFinite(Number(section?.order))
      ? Number(section.order)
      : index,
    parentTitle: parent ? rawSectionTitle(parent) : '',
    title: title || 'Untitled section',
    untitled: !title
  };
}

export function verifyExtraction(
  document,
  allSections = [],
  allDocuments = []
) {
  const safeDocument = document && typeof document === 'object'
    ? document
    : {};
  const safeSections = Array.isArray(allSections) ? allSections : [];
  const safeDocuments = Array.isArray(allDocuments)
    ? allDocuments
    : [];
  const id = textValue(safeDocument.id);
  const sections = safeSections
    .filter(section => textValue(section?.documentId) === id)
    .sort((first, second) =>
      (Number(first?.order) || 0) - (Number(second?.order) || 0) ||
      textValue(first?.id).localeCompare(textValue(second?.id))
    );
  const usableSections = sections.filter(section =>
    normalizedText(sectionTextValue(section)).length > 0
  );
  const emptySections = sections.filter(section =>
    normalizedText(sectionTextValue(section)).length === 0
  );
  const untitledSections = sections.filter(section =>
    !rawSectionTitle(section)
  );
  const sectionIdCounts = sections.reduce((counts, section) => {
    const sectionId = textValue(section?.id);
    if (sectionId) counts.set(sectionId, (counts.get(sectionId) || 0) + 1);
    return counts;
  }, new Map());
  const duplicateSectionIds = [...sectionIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([sectionId]) => sectionId);
  const invalidDocumentLinks = sections.filter(section =>
    invalidLink(section, safeDocument)
  );
  const knownDocumentIds = new Set(
    safeDocuments.map(item => textValue(item?.id)).filter(Boolean)
  );
  const orphanedSections = safeSections.filter(section =>
    !textValue(section?.documentId) ||
    (
      safeDocuments.length > 0 &&
      !knownDocumentIds.has(textValue(section.documentId))
    )
  );
  const status = documentStatus(safeDocument);
  const indexed = INDEXED_STATUSES.has(status);
  const pending = PENDING_STATUSES.has(status);
  const failed = FAILED_STATUSES.has(status) ||
    Boolean(safeDocument.error);
  const recordedCharacters = optionalNumber(
    safeDocument.characterCount
  );
  const storedCharacters = usableSections.reduce(
    (total, section) => total + sectionCharacters(section),
    0
  );
  const usableText = (
    (recordedCharacters !== null && recordedCharacters > 0) ||
    storedCharacters > 0
  );
  const recordedSectionCount = optionalNumber(
    safeDocument.sectionCount
  );
  const sectionCountMismatch =
    recordedSectionCount !== null &&
    recordedSectionCount !== sections.length;
  const hierarchyDetected = sections.some(hasHierarchyMetadata);
  const warnings = documentWarnings(safeDocument);
  const littleText =
    usableText &&
    Math.max(recordedCharacters || 0, storedCharacters) < 100;
  const noHeadings =
    optionalNumber(safeDocument.headingCount) === 0;
  const readyWithoutContent = indexed && (
    !usableText ||
    usableSections.length === 0
  );
  const emptyRatio = sections.length
    ? emptySections.length / sections.length
    : 0;
  const checks = [];

  if (failed) {
    checks.push(check(
      'FAIL',
      'Extraction completed without errors',
      textValue(
        safeDocument.error ||
        safeDocument.healthDetail ||
        'Production state marks this document unavailable.'
      )
    ));
  } else if (indexed) {
    checks.push(check(
      'PASS',
      'Extraction completed',
      'Production state marks the document as indexed or verified.'
    ));
  } else if (pending) {
    checks.push(check(
      'INFO',
      'Extraction pending',
      'The document has not reached an indexed state.'
    ));
  } else {
    checks.push(check(
      'INFO',
      'Extraction status unavailable',
      'Production state does not expose a recognized extraction status.'
    ));
  }

  checks.push(usableText
    ? check(
        'PASS',
        'Text extracted',
        `${Math.max(recordedCharacters || 0, storedCharacters)} usable character(s) are reported or stored.`
      )
    : check(
        indexed ? 'FAIL' : 'INFO',
        'Usable text',
        indexed
          ? 'No usable extracted text is available for this indexed document.'
          : 'Usable extracted text is not currently available.'
      ));

  checks.push(sections.length
    ? check(
        'PASS',
        'Indexed sections stored',
        `${sections.length} stored section record(s) reference this document.`
      )
    : check(
        usableText ? 'WARNING' : indexed ? 'FAIL' : 'INFO',
        'Indexed sections stored',
        usableText
          ? 'Extracted text exists, but no stored sections reference this document.'
          : 'No stored sections reference this document.'
      ));

  checks.push(invalidDocumentLinks.length
    ? check(
        'FAIL',
        'Section links valid',
        `${invalidDocumentLinks.length} section record(s) conflict with the document project, library, or filename.`
      )
    : check(
        'PASS',
        'Section links valid',
        'Stored sections use the selected document, project, and library identifiers consistently.'
      ));

  checks.push(duplicateSectionIds.length
    ? check(
        'FAIL',
        'Section identifiers unique',
        `${duplicateSectionIds.length} duplicate section identifier(s) were detected.`
      )
    : check(
        'PASS',
        'Section identifiers unique',
        'No duplicate section identifiers were detected for this document.'
      ));

  if (recordedSectionCount === null) {
    checks.push(check(
      'INFO',
      'Recorded section count',
      'The document does not expose a recorded section count.'
    ));
  } else {
    checks.push(sectionCountMismatch
      ? check(
          'WARNING',
          'Document and section counts agree',
          `The document reports ${recordedSectionCount} section(s), while ${sections.length} are stored.`
        )
      : check(
          'PASS',
          'Document and section counts agree',
          `The recorded and stored counts both equal ${sections.length}.`
        ));
  }

  checks.push(usableSections.length
    ? check(
        'PASS',
        'Searchable content detected',
        `${usableSections.length} section(s) contain usable plain text.`
      )
    : check(
        indexed ? 'FAIL' : 'INFO',
        'Searchable content detected',
        indexed
          ? 'No stored section contains usable searchable text.'
          : 'Searchable section content is not currently available.'
      ));

  checks.push(hierarchyDetected
    ? check(
        'PASS',
        'Hierarchy detected',
        'At least one stored section exposes hierarchy metadata.'
      )
    : check(
        'INFO',
        'Hierarchy metadata',
        'Hierarchy metadata is unavailable.'
      ));

  if (littleText) {
    checks.push(check(
      'WARNING',
      'Very little text extracted',
      'Fewer than 100 usable characters are reported or stored.'
    ));
  }

  if (noHeadings) {
    checks.push(check(
      'WARNING',
      'Section headings',
      'The document reports no detected section headings.'
    ));
  }

  if (emptySections.length) {
    checks.push(check(
      'WARNING',
      'Empty sections present',
      `${emptySections.length} stored section(s) contain no usable text.`
    ));
  }

  if (untitledSections.length) {
    checks.push(check(
      'WARNING',
      'Untitled sections present',
      `${untitledSections.length} stored section(s) expose no title.`
    ));
  }

  if (warnings.length) {
    checks.push(check(
      'WARNING',
      'Parser warnings reported',
      `${warnings.length} production warning${warnings.length === 1 ? ' is' : 's are'} available.`
    ));
  }

  if (!pageMetadataAvailable(safeDocument, sections)) {
    checks.push(check(
      'INFO',
      'Page metadata',
      'Page metadata is unavailable; this does not prevent retrieval.'
    ));
  }

  const parser = firstText(
    safeDocument.parser,
    safeDocument.parserType,
    safeDocument.metadata?.parser,
    safeDocument.metadata?.parserType
  );

  if (!parser) {
    checks.push(check(
      'INFO',
      'Parser metadata',
      'The parser used for this stored document is unavailable.'
    ));
  }

  if (readyWithoutContent) {
    checks.push(check(
      'FAIL',
      'Ready document contains usable content',
      'The document is marked ready or indexed without usable stored content.'
    ));
  }

  const failCount = checks.filter(item => item.status === 'FAIL').length;
  const warningCount = checks.filter(item =>
    item.status === 'WARNING'
  ).length;
  let verificationStatus = 'Verification unavailable';

  if (failed || failCount) {
    verificationStatus = 'Failed';
  } else if (pending) {
    verificationStatus = 'Not indexed';
  } else if (indexed && usableText && usableSections.length) {
    verificationStatus = warningCount
      ? 'Ready with warnings'
      : 'Ready';
  } else if (usableText || sections.length) {
    verificationStatus = 'Limited extraction';
  }

  let retrievalReadiness = 'Readiness unavailable';

  if (
    failed ||
    readyWithoutContent ||
    duplicateSectionIds.length ||
    invalidDocumentLinks.length
  ) {
    retrievalReadiness = 'Not retrieval ready';
  } else if (
    indexed &&
    usableSections.length &&
    usableText
  ) {
    retrievalReadiness = warningCount
      ? 'Retrieval limited'
      : 'Retrieval ready';
  } else if (usableSections.length || usableText) {
    retrievalReadiness = 'Retrieval limited';
  } else if (indexed) {
    retrievalReadiness = 'Not retrieval ready';
  }

  return {
    checks,
    duplicateSectionIds,
    emptyRatio,
    emptySections,
    failCount,
    hierarchyDetected,
    indexed,
    invalidDocumentLinks,
    littleText,
    orphanedSections,
    pageMetadataAvailable: pageMetadataAvailable(
      safeDocument,
      sections
    ),
    parser,
    previews: sections.map((section, index) =>
      buildSectionPreview(section, index, 240, sections)
    ),
    recordedCharacters,
    recordedSectionCount,
    retrievalReadiness,
    sectionCountMismatch,
    sections,
    storedCharacters,
    untitledSections,
    usableSections,
    usableText,
    verificationStatus,
    warningCount,
    warnings
  };
}

export function aggregateExtractionVerification(
  documents = [],
  sections = []
) {
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const safeSections = Array.isArray(sections) ? sections : [];
  const reports = safeDocuments.map(document =>
    verifyExtraction(document, safeSections, safeDocuments)
  );
  const knownDocumentIds = new Set(
    safeDocuments.map(document => textValue(document?.id)).filter(Boolean)
  );
  const orphanedSections = safeSections.filter(section =>
    !textValue(section?.documentId) ||
    !knownDocumentIds.has(textValue(section.documentId))
  );
  const sectionIdCounts = safeSections.reduce((counts, section) => {
    const id = textValue(section?.id);
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map());
  const duplicateSectionIds = [...sectionIdCounts.values()]
    .filter(count => count > 1).length;
  const invalidDocumentLinks = safeSections.filter(section => {
    const document = safeDocuments.find(item =>
      textValue(item?.id) === textValue(section?.documentId)
    );
    return document ? invalidLink(section, document) : false;
  });

  return {
    documentSectionMismatches: reports.filter(report =>
      report.sectionCountMismatch
    ).length,
    documentsFailed: reports.filter(report =>
      report.verificationStatus === 'Failed'
    ).length,
    documentsReadyForRetrieval: reports.filter(report =>
      report.retrievalReadiness === 'Retrieval ready'
    ).length,
    documentsWithWarnings: reports.filter(report =>
      report.warningCount > 0
    ).length,
    documentsWithoutUsableText: reports.filter(report =>
      !report.usableText
    ).length,
    duplicateSectionIds,
    emptySections: reports.reduce(
      (total, report) => total + report.emptySections.length,
      0
    ),
    indexedDocumentsWithZeroSections: reports.filter(report =>
      report.indexed && report.sections.length === 0
    ).length,
    invalidDocumentLinks: invalidDocumentLinks.length,
    orphanedSections: orphanedSections.length,
    reports,
    untitledSections: reports.reduce(
      (total, report) => total + report.untitledSections.length,
      0
    )
  };
}
