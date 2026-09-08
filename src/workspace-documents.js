const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

function workspaceDrawingDocumentId(pageId = '') {
  const match = text(pageId).match(/^drawing-page:([^:]+):\d+$/i);
  return match ? match[1] : '';
}

function drawingDocumentKey(item = {}) {
  return `drawing:${text(item.sheetNumber)}`;
}

function specificationDocumentKey(item = {}) {
  return `spec:${text(item.sectionNumber)}`;
}

function projectDocumentKey(item = {}) {
  return `project:${text(item.id)}`;
}

function relatedEvidenceKey(item = {}) {
  return `evidence:${text(item.kind)}:${text(item.sheetNumber || item.sectionNumber || item.id)}`;
}

function pushUnique(records, seen, record, key) {
  const uniqueKey = key(record);
  if (!uniqueKey || seen.has(uniqueKey)) return;
  seen.add(uniqueKey);
  records.push(record);
}

function buildDrawingRecord(sheet = {}, relationship = 'Primary Source') {
  const documentId = workspaceDrawingDocumentId(sheet.pageId);
  const sheetNumber = text(sheet.sheetNumber);
  return {
    kind: 'drawing',
    relationship,
    sheetNumber,
    sheetTitle: text(sheet.sheetTitle) || 'Untitled drawing',
    discipline: text(sheet.discipline) || 'Drawing',
    level: text(sheet.level) || '',
    pageId: text(sheet.pageId),
    pageNumber: Number(sheet.pdfPageNumber) || 0,
    documentId,
    actionLabel: 'Open Drawing',
    openTarget: documentId && sheetNumber ? {
      kind: 'drawing',
      documentId,
      sheetId: sheetNumber,
      pageId: text(sheet.pageId),
      pageNumber: Number(sheet.pdfPageNumber) || 0,
      sheetNumber
    } : null
  };
}

function buildSpecificationRecord(spec = {}) {
  return {
    kind: 'specification',
    relationship: 'Applicable',
    sectionNumber: text(spec.sectionNumber),
    sectionTitle: text(spec.sectionTitle) || 'Untitled specification',
    sourceLabel: 'Bedford IFC specification index',
    actionLabel: 'Open Specification',
    openTarget: text(spec.sectionNumber) ? {
      kind: 'specification',
      sectionNumber: text(spec.sectionNumber)
    } : null
  };
}

function buildProjectDocumentRecord(document = {}, milestoneContext = null) {
  const ntpDateLabel = milestoneContext?.ntpDateLabel || '';
  const contractCompletionDateLabel = milestoneContext?.contractCompletionDateLabel || '';
  return {
    kind: 'project-document',
    relationship: 'Project / Contractual',
    documentId: text(document.id),
    title: text(document.originalFilename || document.name || document.title || document.id),
    sourceLabel: text(document.sourceType || document.category || 'Project document'),
    actionLabel: 'Open Project Document',
    metadata: {
      ntpDateLabel,
      contractCompletionDateLabel
    },
    openTarget: text(document.id) ? {
      kind: 'source',
      documentId: text(document.id),
      destination: 'sources'
    } : null
  };
}

function buildRelatedEvidenceRecord(item = {}) {
  return {
    kind: 'related-evidence',
    relationship: text(item.relationship || item.label || 'Related Evidence'),
    label: text(item.label || item.sheetTitle || item.title || item.id || 'Related evidence'),
    detail: text(item.detail || item.notes || item.sheetNumber || ''),
    actionLabel: '',
    openTarget: null
  };
}

function primaryDrawingRecord(sheet = {}) {
  return buildDrawingRecord({
    ...sheet,
    relevance: 'PRIMARY',
    category: 'Primary Source Sheets'
  }, 'Primary Source');
}

function groupedDrawingRecord(sheet = {}, categoryLabel = 'Related Source') {
  return buildDrawingRecord({
    ...sheet,
    relevance: categoryLabel === 'Primary Source Sheets' ? 'PRIMARY' : categoryLabel === 'DETAILS / SCHEDULES' || categoryLabel === 'GENERAL / REFERENCE' ? 'SUPPORTING' : 'DIRECT',
    category: categoryLabel
  }, categoryLabel === 'Primary Source Sheets' ? 'Primary Source' : 'Related Source');
}

export function buildWorkspaceDocumentsModel({ workspace = null, projectMilestoneContext = null } = {}) {
  const sourceSheets = list(workspace?.sourceSheets);
  const relatedSheets = list(workspace?.relatedSheets);
  const applicableSpecifications = list(workspace?.applicableSpecifications);
  const sourceEvidence = list(workspace?.sourceEvidence);
  const projectedDocument = projectMilestoneContext?.sourceDocument || null;

  const drawings = [];
  const seenDrawings = new Set();
  for (const sheet of sourceSheets) pushUnique(drawings, seenDrawings, primaryDrawingRecord(sheet), drawingDocumentKey);
  for (const sheet of relatedSheets) pushUnique(drawings, seenDrawings, buildDrawingRecord(sheet, 'Related Source'), drawingDocumentKey);

  const specifications = [];
  const seenSpecifications = new Set();
  for (const spec of applicableSpecifications) pushUnique(specifications, seenSpecifications, buildSpecificationRecord(spec), specificationDocumentKey);

  const projectDocuments = [];
  const seenProjectDocuments = new Set();
  if (projectedDocument) pushUnique(projectDocuments, seenProjectDocuments, buildProjectDocumentRecord(projectedDocument, projectMilestoneContext), projectDocumentKey);

  const relatedEvidence = [];
  const seenRelatedEvidence = new Set();
  for (const evidence of sourceEvidence) {
    if (text(evidence.kind) === 'source-sheet') continue;
    pushUnique(relatedEvidence, seenRelatedEvidence, buildRelatedEvidenceRecord(evidence), relatedEvidenceKey);
  }

  const categories = [
    drawings.length ? {
      id: 'drawings',
      label: 'Drawings',
      summary: 'Primary source drawings and related trade categories.',
      groups: [
        {
          id: 'primary-drawings',
          label: 'PRIMARY SOURCE DRAWINGS',
          relationship: 'Primary Source',
          items: sourceSheets.map(sheet => primaryDrawingRecord(sheet)).filter(item => item.openTarget),
          emptyState: 'No primary source drawings have been linked to this Workspace.'
        },
        {
          id: 'related-drawings',
          label: 'RELATED DRAWINGS',
          relationship: 'Related Source',
          items: relatedSheets.map(sheet => buildDrawingRecord(sheet, 'Related Source')).filter(item => item.openTarget),
          emptyState: 'No related drawings have been linked to this Workspace.'
        }
      ].filter(group => group.items.length)
    } : null,
    specifications.length ? {
      id: 'specifications',
      label: 'Specifications',
      summary: 'Applicable Bedford IFC specification sections.',
      groups: [
        {
          id: 'applicable-specifications',
          label: 'APPLICABLE SPECIFICATIONS',
          relationship: 'Applicable',
          items: specifications,
          emptyState: 'No applicable specifications are currently recorded.'
        }
      ]
    } : null,
    projectDocuments.length ? {
      id: 'project-documents',
      label: 'Contract / Project Documents',
      summary: 'Project-level contractual records and milestone sources.',
      groups: [
        {
          id: 'contract-documents',
          label: 'PROJECT / CONTRACTUAL DOCUMENTS',
          relationship: 'Project / Contractual',
          items: projectDocuments,
          emptyState: 'No project documents are currently recorded.'
        }
      ]
    } : null,
    {
      id: 'related-evidence',
      label: 'Related Evidence',
      summary: 'Supporting project records linked to this Workspace.',
      groups: relatedEvidence.length ? [
        {
          id: 'supporting-evidence',
          label: 'RELATED EVIDENCE',
          relationship: 'Related Evidence',
          items: relatedEvidence,
          emptyState: 'No related evidence has been linked to this Workspace.'
        }
      ] : [],
      emptyState: 'No related evidence has been linked to this Workspace.'
    }
  ].filter(Boolean);

  return Object.freeze({
    workspaceId: text(workspace?.id || ''),
    workspaceRoom: text(workspace?.room || workspace?.id || ''),
    workspaceName: text(workspace?.name || ''),
    building: text(workspace?.building || ''),
    level: text(workspace?.level || ''),
    disciplineFocus: text(workspace?.disciplineFocus || ''),
    categories,
    counts: Object.freeze({
      drawings: drawings.length,
      specifications: specifications.length,
      projectDocuments: projectDocuments.length,
      relatedEvidence: relatedEvidence.length
    }),
    emptyState: categories.length ? '' : 'No Workspace documents are currently available for this record.'
  });
}

export function workspaceDrawingDocumentIdForPage(pageId = '') {
  return workspaceDrawingDocumentId(pageId);
}
