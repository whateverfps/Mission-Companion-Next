import {
  sectionHeadingValue,
  sectionNumberKey,
  sectionTextValue,
  textValue
} from './data-model.js';
import { normalizeRegion } from './pdf-source.js';

const safeId = value => textValue(value).trim();
const safeList = value => Array.isArray(value) ? value.filter(item => item != null).map(item => textValue(item)) : [];

function normalizeSourceSectionRecord(section = null) {
  if (!section || typeof section !== 'object') return null;
  const sectionTitle = textValue(section.sectionTitle || section.heading || section.title || section.label);
  const sectionNumber = textValue(section.sectionNumber || section.metadata?.sectionNumber);
  const normalized = { ...section };
  normalized.sectionNumber = sectionNumber;
  normalized.sectionTitle = sectionTitle;
  normalized.heading = textValue(section.heading || sectionTitle || section.title || section.label);
  normalized.title = textValue(section.title || sectionTitle || section.heading || section.label);
  normalized.label = textValue(section.label || sectionTitle || section.heading || section.title);
  normalized.sentence = textValue(section.sentence);
  normalized.sentences = safeList(section.sentences);
  normalized.text = textValue(section.text);
  normalized.content = textValue(section.content);
  normalized.metadata = section.metadata && typeof section.metadata === 'object'
    ? { ...section.metadata }
    : {};
  return normalized;
}

export function createSpecificationSourceTarget(section = null, target = {}) {
  const normalizedSection = normalizeSourceSectionRecord(section);
  return {
    ...target,
    documentId: textValue(target.documentId || normalizedSection?.documentId),
    projectId: textValue(target.projectId || normalizedSection?.projectId),
    pageNumber: Number.isFinite(Number(target.pageNumber))
      ? Number(target.pageNumber)
      : Number(normalizedSection?.startPdfPage) || 0,
    sectionNumber: textValue(target.sectionNumber || normalizedSection?.sectionNumber),
    sectionTitle: textValue(target.sectionTitle || normalizedSection?.sectionTitle),
    articleReference: textValue(target.articleReference),
    returnTarget: textValue(target.returnTarget),
    section: normalizedSection ? structuredClone(normalizedSection) : null
  };
}

export function sourceAnchorId(scope, identifier) {
  const prefix = safeId(scope)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'source';
  const encoded = [...safeId(identifier)]
    .map(character => {
      if (/^[a-zA-Z0-9_-]$/.test(character)) return character;
      return `_${character.codePointAt(0).toString(16)}_`;
    })
    .join('') || 'unavailable';

  return `mc-${prefix}-${encoded}`;
}

export function createSourceTarget({
  projectId,
  libraryId,
  documentId,
  sectionId,
  evidenceId,
  evidenceIndex,
  originatingWorkspace = 'evidence',
  originatingMessageId,
  destination,
  returnTarget,
  pageNumber,
  sheetId,
  sheetNumber,
  region,
  observationId
} = {}) {
  const targetDocumentId = safeId(documentId);
  const targetSectionId = safeId(sectionId);

  if (!targetDocumentId) return null;

  return {
    projectId: safeId(projectId),
    libraryId: safeId(libraryId),
    documentId: targetDocumentId,
    sectionId: targetSectionId,
    evidenceId: safeId(evidenceId),
    evidenceIndex: Number.isInteger(Number(evidenceIndex))
      ? Number(evidenceIndex)
      : null,
    originatingWorkspace: safeId(originatingWorkspace),
    originatingMessageId: safeId(originatingMessageId),
    destination: safeId(destination),
    returnTarget: safeId(returnTarget),
    pageNumber: Number.isInteger(Number(pageNumber)) && Number(pageNumber) > 0 ? Number(pageNumber) : null,
    sheetId: safeId(sheetId),
    sheetNumber: safeId(sheetNumber),
    region: region ? normalizeRegion(region) : null,
    observationId: safeId(observationId)
  };
}

export function resolveSourceTarget(target, {
  projects = [],
  libraries = [],
  documents = [],
  sections = [],
  analyses = [],
  sourceFiles = []
} = {}) {
  if (!target?.documentId) {
    return { status: 'none', target: null, document: null, section: null };
  }

  const document = documents.find(item =>
    safeId(item?.id) === target.documentId
  );

  if (!document) {
    return { status: 'missing-document', target, document: null, section: null };
  }

  const project = target.projectId
    ? projects.find(item => safeId(item?.id) === target.projectId) || null
    : null;
  const documentLibraryId = safeId(document.libraryId);
  const library = target.libraryId
    ? libraries.find(item =>
        safeId(item?.id) === target.libraryId &&
        safeId(item?.id) === documentLibraryId
      ) || null
    : null;
  const section = target.sectionId
    ? sections.find(item =>
        safeId(item?.id) === target.sectionId &&
        safeId(item?.documentId) === target.documentId
      ) || null
    : null;
  const sourceFile = sourceFiles.find(item => safeId(item?.documentId) === target.documentId) || null;
  const analysis = analyses.find(item => safeId(item?.documentId) === target.documentId) || null;
  const sheet = target.sheetId
    ? analysis?.sheets?.find(item => safeId(item?.sheetId) === target.sheetId) || null
    : target.pageNumber
      ? analysis?.sheets?.find(item => Number(item?.pageNumber) === target.pageNumber) || null
      : null;
  const observation = target.observationId
    ? analysis?.observations?.find(item => safeId(item?.observationId) === target.observationId && (!sheet || item.sheetId === sheet.sheetId)) || null
    : null;

  let status = section ? 'section' : 'missing-section';
  if (target.sheetId || target.pageNumber) {
    status = !sourceFile ? 'missing-source' : !sheet ? 'missing-page' : target.observationId && !observation ? 'missing-observation' : observation || target.region ? 'drawing-region' : 'drawing-sheet';
  }

  return {
    status,
    target,
    document,
    section: normalizeSourceSectionRecord(section),
    project,
    library, sourceFile, analysis, sheet, observation,
    validProjectId: project ? target.projectId : '',
    validLibraryId: library ? target.libraryId : ''
  };
}

function normalizeActionTargetIdentity(target = {}) {
  if (!target || typeof target !== 'object') return '';
  const normalizedRegion = target.region ? normalizeRegion(target.region) : null;
  return JSON.stringify({
    kind: safeId(target.kind),
    projectId: safeId(target.projectId),
    libraryId: safeId(target.libraryId),
    documentId: safeId(target.documentId),
    sectionId: safeId(target.sectionId),
    sheetId: safeId(target.sheetId),
    sheetNumber: safeId(target.sheetNumber),
    drawingSetId: safeId(target.drawingSetId),
    observationId: safeId(target.observationId),
    inspectionId: safeId(target.inspectionId),
    pageNumber: Number.isInteger(Number(target.pageNumber)) && Number(target.pageNumber) > 0 ? Number(target.pageNumber) : null,
    region: normalizedRegion ? JSON.stringify(normalizedRegion) : '',
    origin: safeId(target.origin),
    messageId: safeId(target.messageId),
    destination: safeId(target.destination),
    returnTarget: safeId(target.returnTarget),
    actionType: safeId(target.actionType),
    recordNumber: safeId(target.recordNumber)
  });
}

export function normalizeActionTargetPayload(rawTarget = {}, activeProjectId = '') {
  if (!rawTarget) return null;
  const parsed = typeof rawTarget === 'string' ? JSON.parse(rawTarget) : rawTarget;
  if (!parsed || typeof parsed !== 'object') return null;
  return createActionTarget({
    kind: parsed.kind || 'view',
    projectId: parsed.projectId || activeProjectId || '',
    libraryId: parsed.libraryId || '',
    documentId: parsed.documentId || '',
    sectionId: parsed.sectionId || '',
    sheetId: parsed.sheetId || '',
    sheetNumber: parsed.sheetNumber || '',
    drawingSetId: parsed.drawingSetId || '',
    drawingId: parsed.drawingId || '',
    observationId: parsed.observationId || '',
    inspectionId: parsed.inspectionId || '',
    pageNumber: parsed.pageNumber || null,
    region: parsed.region || null,
    origin: parsed.origin || 'assistant',
    title: parsed.title || '',
    label: parsed.label || '',
    messageId: parsed.messageId || '',
    destination: parsed.destination || '',
    returnTarget: parsed.returnTarget || '',
    actionType: parsed.actionType || '',
    recordNumber: parsed.recordNumber || ''
  });
}

export function createActionTarget({
  kind = 'source',
  projectId,
  libraryId,
  documentId,
  sectionId,
  sheetId,
  sheetNumber,
  drawingSetId,
  drawingId,
  observationId,
  inspectionId,
  pageNumber,
  region,
  origin = 'assistant',
  title = '',
  label = '',
  messageId = '',
  destination = '',
  returnTarget = '',
  actionType = '',
  recordNumber = ''
} = {}) {
  const normalizedKind = safeId(kind) || 'source';
  const targetDocumentId = safeId(documentId);
  const targetInspectionId = safeId(inspectionId);
  const hasIdentity = Boolean(targetDocumentId || targetInspectionId || ['view', 'inspection', 'evidence'].includes(normalizedKind));
  if (!hasIdentity) return null;

  return {
    kind: normalizedKind,
    projectId: safeId(projectId),
    libraryId: safeId(libraryId),
    documentId: targetDocumentId,
    sectionId: safeId(sectionId),
    sheetId: safeId(sheetId),
    sheetNumber: safeId(sheetNumber),
    drawingSetId: safeId(drawingSetId),
    drawingId: safeId(drawingId),
    observationId: safeId(observationId),
    inspectionId: safeId(inspectionId),
    pageNumber: Number.isInteger(Number(pageNumber)) && Number(pageNumber) > 0 ? Number(pageNumber) : null,
    region: region ? normalizeRegion(region) : null,
    origin: safeId(origin) || 'assistant',
    title: safeId(title),
    label: safeId(label),
    messageId: safeId(messageId),
    destination: safeId(destination),
    returnTarget: safeId(returnTarget),
    actionType: safeId(actionType),
    recordNumber: safeId(recordNumber)
  };
}

export function sourceNavigationReturnAction(target = {}) {
  const normalized = normalizeActionTargetPayload(target);
  const rawValue = safeId(normalized?.returnTarget || '');
  if (!rawValue) return null;
  const lowered = rawValue.toLowerCase();
  if (['chief-answer', 'chiefanswer', 'chief', 'answer'].includes(lowered)) {
    return { kind: 'chief-answer', label: 'Return to Chief Answer' };
  }
  if (['work-package', 'workpackage', 'work package', 'package'].includes(lowered)) {
    return { kind: 'work-package', label: 'Return to Work Package' };
  }
  return { kind: lowered, label: `Return to ${rawValue}` };
}

function normalizeRfiMetadataValue(value) {
  return safeId(value);
}

function resolveRecordClassification(document = {}, expectedKinds = []) {
  const category = safeId(document?.category);
  const type = safeId(document?.type);
  const explicit = safeId(document?.metadata?.kind || document?.metadata?.documentType || document?.metadata?.classification || '');
  const normalizedCategory = category.toLowerCase();
  const normalizedType = type.toLowerCase();
  const normalizedExplicit = explicit.toLowerCase();
  const normalizedKinds = expectedKinds.map(item => safeId(item).toLowerCase());
  const isByCategory = normalizedKinds.includes(normalizedCategory);
  const isByType = normalizedKinds.includes(normalizedType);
  const isByExplicit = normalizedKinds.includes(normalizedExplicit);
  return isByCategory || isByType || isByExplicit;
}

function resolveRfiClassification(document = {}) {
  return resolveRecordClassification(document, ['rfi', 'rfis', 'request for information']);
}

function resolveSubmittalClassification(document = {}) {
  return resolveRecordClassification(document, ['submittal', 'submittals', 'shop drawing', 'approved submittal']);
}

export function resolveRfiNavigationTarget(target = {}, {
  projects = [],
  libraries = [],
  documents = [],
  sections = []
} = {}) {
  const normalized = normalizeActionTargetPayload(target);
  const sourceTarget = normalized ? createSourceTarget({
    projectId: normalized.projectId,
    libraryId: normalized.libraryId,
    documentId: normalized.documentId,
    sectionId: normalized.sectionId,
    originatingWorkspace: normalized.origin || 'assistant',
    originatingMessageId: normalized.messageId,
    destination: normalized.destination || 'knowledge',
    returnTarget: normalized.returnTarget
  }) : null;
  const projectAvailable = !normalized?.projectId || projects.some(item => safeId(item?.id) === normalized.projectId);
  const resolution = sourceTarget && normalized?.documentId
    ? resolveSourceTarget(sourceTarget, {
        projects,
        libraries,
        documents,
        sections
      })
    : { status: 'missing-document', target: sourceTarget, document: null, section: null };
  const document = resolution.document || null;
  const section = resolution.section || null;
  const isRfiDocument = document ? resolveRfiClassification(document) : false;
  const recordNumber = normalizeRfiMetadataValue(normalized?.recordNumber || document?.recordNumber || document?.metadata?.recordNumber || document?.identifier || document?.rfiNumber || document?.number);
  const explicitStatus = normalizeRfiMetadataValue(document?.metadata?.status || document?.status || '');
  const title = safeId(document?.title || document?.name || '');
  const category = safeId(document?.category || '');
  const type = safeId(document?.type || '');
  const tags = Array.isArray(document?.tags)
    ? document.tags.map(tag => safeId(tag)).filter(Boolean)
    : [];
  const hierarchy = Array.isArray(section?.path)
    ? section.path.map(item => safeId(item)).filter(Boolean)
    : Array.isArray(document?.path)
      ? document.path.map(item => safeId(item)).filter(Boolean)
      : Array.isArray(document?.metadata?.path)
        ? document.metadata.path.map(item => safeId(item)).filter(Boolean)
        : [];
  const provenance = safeId(document?.metadata?.provenance || document?.provenance || '');
  const sectionText = section ? sectionTextValue(section) : '';
  const focusTargetId = section ? sourceAnchorId('knowledge-section', section.id) : document ? sourceAnchorId('knowledge-document', document.id) : '';
  const returnAction = sourceNavigationReturnAction(normalized);
  const unavailable = !document
    ? 'RFI source unavailable'
    : !projectAvailable
      ? 'RFI belongs to another project'
      : !isRfiDocument
        ? 'This source is not classified as an RFI'
        : resolution.status === 'missing-section' && normalized?.sectionId
          ? 'RFI section unavailable'
          : '';
  return {
    status: unavailable ? 'unavailable' : 'ready',
    destination: 'rfi',
    projectId: safeId(normalized?.projectId || ''),
    libraryId: safeId(normalized?.libraryId || ''),
    documentId: safeId(normalized?.documentId || ''),
    sectionId: safeId(normalized?.sectionId || ''),
    recordNumber,
    document,
    section,
    title,
    category,
    type,
    explicitStatus,
    tags,
    hierarchy,
    provenance,
    returnTarget: safeId(normalized?.returnTarget || ''),
    returnAction,
    focusTargetId,
    sectionText,
    notice: unavailable || ''
  };
}

export function resolveSubmittalNavigationTarget(target = {}, {
  projects = [],
  libraries = [],
  documents = [],
  sections = []
} = {}) {
  const normalized = normalizeActionTargetPayload(target);
  const sourceTarget = normalized ? createSourceTarget({
    projectId: normalized.projectId,
    libraryId: normalized.libraryId,
    documentId: normalized.documentId,
    sectionId: normalized.sectionId,
    originatingWorkspace: normalized.origin || 'assistant',
    originatingMessageId: normalized.messageId,
    destination: normalized.destination || 'knowledge',
    returnTarget: normalized.returnTarget
  }) : null;
  const projectAvailable = !normalized?.projectId || projects.some(item => safeId(item?.id) === normalized.projectId);
  const resolution = sourceTarget && normalized?.documentId
    ? resolveSourceTarget(sourceTarget, {
        projects,
        libraries,
        documents,
        sections
      })
    : { status: 'missing-document', target: sourceTarget, document: null, section: null };
  const document = resolution.document || null;
  const section = resolution.section || null;
  const isSubmittalDocument = document ? resolveSubmittalClassification(document) : false;
  const recordNumber = normalizeRfiMetadataValue(normalized?.recordNumber || document?.recordNumber || document?.metadata?.recordNumber || document?.identifier || document?.rfiNumber || document?.number || document?.submittalNumber || document?.submittalId);
  const explicitStatus = normalizeRfiMetadataValue(document?.metadata?.status || document?.status || '');
  const title = safeId(document?.title || document?.name || '');
  const category = safeId(document?.category || '');
  const type = safeId(document?.type || '');
  const tags = Array.isArray(document?.tags)
    ? document.tags.map(tag => safeId(tag)).filter(Boolean)
    : [];
  const hierarchy = Array.isArray(section?.path)
    ? section.path.map(item => safeId(item)).filter(Boolean)
    : Array.isArray(document?.path)
      ? document.path.map(item => safeId(item)).filter(Boolean)
      : Array.isArray(document?.metadata?.path)
        ? document.metadata.path.map(item => safeId(item)).filter(Boolean)
        : [];
  const provenance = safeId(document?.metadata?.provenance || document?.provenance || '');
  const sectionText = section ? sectionTextValue(section) : '';
  const focusTargetId = section ? sourceAnchorId('knowledge-section', section.id) : document ? sourceAnchorId('knowledge-document', document.id) : '';
  const returnAction = sourceNavigationReturnAction(normalized);
  const unavailable = !document
    ? 'Submittal source unavailable'
    : !projectAvailable
      ? 'Submittal belongs to another project'
      : !isSubmittalDocument
        ? 'This source is not classified as a submittal'
        : resolution.status === 'missing-section' && normalized?.sectionId
          ? 'Submittal section unavailable'
          : '';
  return {
    status: unavailable ? 'unavailable' : 'ready',
    destination: 'submittal',
    projectId: safeId(normalized?.projectId || ''),
    libraryId: safeId(normalized?.libraryId || ''),
    documentId: safeId(normalized?.documentId || ''),
    sectionId: safeId(normalized?.sectionId || ''),
    recordNumber,
    document,
    section,
    title,
    category,
    type,
    explicitStatus,
    tags,
    hierarchy,
    provenance,
    returnTarget: safeId(normalized?.returnTarget || ''),
    returnAction,
    focusTargetId,
    sectionText,
    notice: unavailable || ''
  };
}

export function resolveSpecificationNavigationTarget(target = {}, {
  projects = [],
  libraries = [],
  documents = [],
  sections = []
} = {}) {
  const normalized = normalizeActionTargetPayload(target);
  const sourceTarget = normalized ? createSourceTarget({
    projectId: normalized.projectId,
    libraryId: normalized.libraryId,
    documentId: normalized.documentId,
    sectionId: normalized.sectionId,
    originatingWorkspace: normalized.origin || 'assistant',
    originatingMessageId: normalized.messageId,
    destination: normalized.destination || 'knowledge',
    returnTarget: normalized.returnTarget
  }) : null;
  const projectAvailable = !normalized?.projectId || projects.some(item => safeId(item?.id) === normalized.projectId);
  const resolution = sourceTarget && normalized?.documentId
    ? resolveSourceTarget(sourceTarget, {
        projects,
        libraries,
        documents,
        sections
      })
    : { status: 'missing-document', target: sourceTarget, document: null, section: null };
  const returnAction = sourceNavigationReturnAction(normalized);
  const focusTargetId = resolution?.section?.id
    ? sourceAnchorId('knowledge-section', resolution.section.id)
    : '';
  return {
    available: resolution.status === 'section',
    status: resolution.status,
    notice: resolution.status === 'missing-section'
      ? 'Specification section unavailable'
      : resolution.status === 'missing-document'
        ? 'Specification source unavailable'
        : '',
    target: normalized,
    sourceTarget,
    document: resolution.document,
    section: resolution.section ? { ...resolution.section } : null,
    projectId: safeId(normalized?.projectId || ''),
    projectAvailable,
    destination: normalized?.destination || 'knowledge',
    returnAction,
    focusTargetId,
    genericFallback: false,
    sectionNumber: resolution?.section ? sectionNumberKey(resolution.section) : '',
    sectionTitle: resolution?.section ? sectionHeadingValue(resolution.section) : '',
    sectionText: resolution?.section ? sectionTextValue(resolution.section) : '',
    sectionPath: Array.isArray(resolution?.section?.path)
      ? resolution.section.path.map(item => safeId(item)).filter(Boolean)
      : [],
    sectionProvenance: resolution?.section?.metadata?.provenance || resolution?.section?.provenance || ''
  };
}

export function deduplicateActionTargets(targets = []) {
  const uniqueTargets = [];
  const seen = new Set();
  for (const target of Array.isArray(targets) ? targets : []) {
    const identity = normalizeActionTargetIdentity(target);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    uniqueTargets.push(target);
  }
  return uniqueTargets;
}

export function prepareActionNavigationTarget(target = {}, {
  activeProjectId = '',
  projects = [],
  documents = [],
  sections = []
} = {}) {
  return prepareActionNavigationState(target, {
    activeProjectId,
    projects,
    documents,
    sections
  });
}

export function prepareActionNavigationState(target = {}, {
  activeProjectId = '',
  projects = [],
  documents = [],
  sections = []
} = {}) {
  const normalized = createActionTarget(target);
  if (!normalized) {
    return {
      target: null,
      projectId: '',
      valid: false,
      shouldSwitchProject: false,
      destination: 'sources',
      resolution: { projectAvailable: false, documentAvailable: false, sectionAvailable: false },
      reason: 'missing-document',
      sourceTarget: null
    };
  }

  const currentProjectId = safeId(activeProjectId);
  const projectId = safeId(normalized.projectId) || currentProjectId;
  const projectAvailable = !projectId || projects.some(item => safeId(item?.id) === projectId);
  const documentId = safeId(normalized.documentId);
  const documentAvailable = Boolean(documentId) && documents.some(item => safeId(item?.id) === documentId);
  const sectionAvailable = !normalized.sectionId || !documentId || sections.some(item => safeId(item?.id) === normalized.sectionId && safeId(item?.documentId) === documentId);
  const destination = normalized.destination || (normalized.kind === 'drawing' ? 'drawings' : normalized.kind === 'inspection' ? 'inspections' : normalized.kind === 'evidence' ? 'evidence' : normalized.sectionId ? 'knowledge' : 'sources');
  const valid = projectAvailable && documentAvailable;
  return {
    target: normalized,
    projectId,
    valid,
    shouldSwitchProject: Boolean(projectId && projectId !== currentProjectId && projectAvailable),
    destination,
    resolution: {
      projectAvailable,
      documentAvailable,
      sectionAvailable
    },
    reason: !documentId ? 'missing-document' : !projectAvailable ? 'missing-project' : normalized.sectionId && !sectionAvailable ? 'missing-section' : '',
    sourceTarget: normalized.kind === 'source' || normalized.kind === 'drawing' || normalized.kind === 'inspection' || normalized.kind === 'evidence' ? actionTargetToSourceTarget(normalized) : null
  };
}

export function actionTargetToSourceTarget(target = null) {
  if (!target?.documentId) return null;
  return createSourceTarget({
    projectId: target.projectId,
    libraryId: target.libraryId,
    documentId: target.documentId,
    sectionId: target.sectionId,
    evidenceId: target.evidenceId,
    evidenceIndex: target.evidenceIndex,
    originatingWorkspace: target.origin || 'assistant',
    originatingMessageId: target.messageId,
    destination: target.destination,
    returnTarget: target.returnTarget,
    pageNumber: target.pageNumber,
    sheetId: target.sheetId,
    sheetNumber: target.sheetNumber,
    drawingSetId: target.drawingSetId,
    region: target.region,
    observationId: target.observationId
  });
}

export function sourceNavigationActions(value = {}) {
  const documentId = safeId(value.documentId);
  const sectionId = safeId(value.sectionId);

  const result = {
    viewInDocument: Boolean(documentId && sectionId),
    openSourceInspector: Boolean(documentId && sectionId)
  };
  if (documentId && (safeId(value.sheetId) || Number(value.pageNumber) > 0)) result.openDrawing = true;
  return result;
}

export function sourceNavigationDestination(target, destination) {
  if (!target?.documentId || !['knowledge', 'sources'].includes(destination)) {
    return null;
  }

  return { ...target, destination };
}

export function sourceScrollOptions(reducedMotion = false) {
  return {
    behavior: reducedMotion ? 'auto' : 'smooth',
    block: 'center'
  };
}

export function answerAnchorId(messageId) {
  return sourceAnchorId('answer', messageId);
}
