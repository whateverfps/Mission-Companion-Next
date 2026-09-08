const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const ids = value => [...new Set(list(value).map(text).filter(Boolean))].sort();
const lower = value => text(value).toLowerCase();

export const WORK_PACKAGE_REASON_LABELS = Object.freeze({
  'exact-room-metadata': 'Included because this record has exact room metadata.',
  'exact-building-metadata': 'Included because this record has exact building metadata.',
  'exact-discipline-metadata': 'Included because this record has exact discipline metadata.',
  'drawing-room-observation': 'Included because an exact room text observation appears on this drawing.',
  'drawing-equipment-observation': 'Included because an exact equipment-tag observation appears on this drawing.',
  'drawing-discipline-classification': 'Included because the drawing has an exact discipline classification.',
  'drawing-index-entry': 'Included because the sheet has a deterministic drawing-index entry.',
  'explicit-section-reference': 'Included because an exact section identifier is referenced.',
  'explicit-document-reference': 'Included because an exact document identifier is referenced.',
  'inspection-related-drawing': 'Included because an Inspection Record explicitly references this drawing.',
  'inspection-related-specification': 'Included because an Inspection Record explicitly references this specification.',
  'inspection-related-rfi': 'Included because an Inspection Record explicitly references this RFI.',
  'inspection-related-submittal': 'Included because an Inspection Record explicitly references this submittal.',
  'inspection-related-deficiency': 'Included because an Inspection Record explicitly references this deficiency.',
  'active-session-evidence': 'Included because the active retrieval session references this exact source.',
  'explicit-lineage': 'Included because an exact lineage record references this source.',
  'explicit-revision-pair': 'Included because an exact revision pair references this source.',
  'exact-workflow-reference': 'Included because an exact workflow template is referenced.',
  'contextual-same-library': 'Context only: this source is in the same library.',
  'contextual-same-division': 'Context only: this source is in the same specification division.'
});

export const workPackageReason = code => WORK_PACKAGE_REASON_LABELS[code] || 'Included by an exact deterministic reference.';
export const workPackageConfidence = ({ exactIdentifier = false, explicitRelationship = false, verificationStatus = '', contextual = false, available = true } = {}) => !available ? 'Unavailable' : contextual ? 'Contextual' : exactIdentifier || explicitRelationship || verificationStatus === 'Confirmed' ? 'High' : 'Supported';

function category(document) {
  const value = lower([document.category, document.type, ...(list(document.tags))].join(' '));
  if (/\brfi\b/.test(value)) return 'rfis';
  if (/submittal/.test(value)) return 'submittals';
  if (/deficien|punch/.test(value)) return 'deficiencies';
  if (/specification|\bspec\b/.test(value)) return 'specifications';
  return 'documents';
}

function referenceItem(record, reasonCode, extra = {}) {
  const identifier = text(record.inspectionId || record.id || record.documentId || record.sectionId || record.revisionId || record.lineageId);
  return { id: identifier, reasonCode, reason: workPackageReason(reasonCode), confidence: workPackageConfidence({ exactIdentifier: true }), ...extra };
}

function exactMetadata(record, plan) {
  if (plan.room && text(record.room).toUpperCase() === plan.room) return 'exact-room-metadata';
  if (plan.building && text(record.building).toUpperCase().replace(/^BUILDING\s+/i, '') === plan.building.replace(/^BUILDING\s+/i, '')) return 'exact-building-metadata';
  if (plan.discipline && lower(record.discipline) === lower(plan.discipline)) return 'exact-discipline-metadata';
  return '';
}

function referencedIds(record) {
  return ids([
    ...list(record.sourceDocumentIds), ...list(record.sourceSectionIds), ...list(record.relatedDrawingIds),
    ...list(record.relatedSpecificationIds), ...list(record.relatedRfiIds), ...list(record.relatedSubmittalIds),
    ...list(record.relatedDeficiencyIds), ...list(record.relationshipIds), ...list(record.versionIds), ...list(record.revisionIds)
  ]);
}

function uniqueItems(items) {
  return [...new Map(items.map(item => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

function uniqueActions(actions) {
  const keyed = new Map();
  for (const action of list(actions)) {
    const target = action?.target || {};
    const key = [action.action, target.documentId, target.sheetId, target.pageNumber, target.observationId, target.sectionId].map(text).join(':');
    if (!keyed.has(key) && target.documentId) keyed.set(key, action);
  }
  return [...keyed.values()];
}

function evidenceQuality(item = {}) {
  const status = text(item.verification?.status || item.verificationStatus);
  if (status === 'Confirmed') return 'Confirmed';
  if (status && status !== 'Unreviewed') return status === 'Rejected' ? 'Unavailable' : 'Candidate';
  if (item.observationId) return 'Exact';
  if (item.contextual) return 'Contextual';
  return item.available === false ? 'Unavailable' : 'Exact';
}

function riskItems({ inspections, rfis, submittals, deficiencies, revisions }) {
  const risks = [];
  for (const item of inspections) {
    if (item.status === 'Follow-Up Required' || item.followUpRequired) risks.push({ kind: 'inspection-follow-up', id: item.id, label: 'Inspection follow-up is recorded.' });
    if (item.result === 'Deficient') risks.push({ kind: 'deficient-inspection', id: item.id, label: 'Inspection result is Deficient.' });
  }
  for (const item of rfis) if (/^(open|pending)$/i.test(item.status)) risks.push({ kind: 'open-rfi', id: item.id, label: `RFI status is ${item.status}.` });
  for (const item of submittals) if (/^(submitted|pending|revise and resubmit|returned)$/i.test(item.status)) risks.push({ kind: 'pending-submittal', id: item.id, label: `Submittal status is ${item.status}.` });
  for (const item of deficiencies) if (!/^(closed|corrected)$/i.test(item.status || '')) risks.push({ kind: 'unresolved-deficiency', id: item.id, label: `Deficiency status is ${item.status || 'recorded'}.` });
  for (const item of revisions) risks.push({ kind: 'explicit-revision', id: item.id, label: 'An explicit revision is associated with this work.' });
  return risks.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

export function currentWorkActivationTarget(workPackage, selectedDocumentId = '') {
  const candidates = ids(selectedDocumentId ? [selectedDocumentId] : list(workPackage?.drawings).map(item => item.documentId));
  if (candidates.length !== 1) return { available: false, reason: candidates.length ? 'Select one exact primary drawing.' : 'No exact primary drawing is available.', request: null };
  const drawing = list(workPackage.drawings).find(item => item.documentId === candidates[0]);
  return { available: true, reason: '', request: { projectId: text(workPackage.projectId), documentId: candidates[0], sectionId: text(drawing?.sectionId), source: 'Construction Work Package' } };
}

export function inspectionPrefillFromWorkPackage(workPackage = {}) {
  return {
    projectId: text(workPackage.projectId), building: text(workPackage.building), area: text(workPackage.floor), room: text(workPackage.room), discipline: text(workPackage.discipline),
    sourceDocumentIds: ids(list(workPackage.drawings).map(item => item.documentId)), sourceSectionIds: ids(list(workPackage.drawings).map(item => item.sectionId)),
    evidenceReferences: uniqueItems(list(workPackage.evidence).map(item => ({ id: `${item.documentId}:${item.sectionId}`, documentId: text(item.documentId), sectionId: text(item.sectionId) }))).map(({ documentId, sectionId }) => ({ documentId, sectionId })),
    relatedDrawingIds: ids(list(workPackage.drawings).map(item => item.documentId)), relatedSpecificationIds: ids(list(workPackage.specifications).map(item => item.id)),
    relatedRfiIds: ids(list(workPackage.rfis).map(item => item.id)), relatedSubmittalIds: ids(list(workPackage.submittals).map(item => item.id)), relatedDeficiencyIds: ids(list(workPackage.deficiencies).map(item => item.id)),
    workflowTemplateId: text(workPackage.workflowTemplateId)
  };
}

export function workPackageModePresentation(workPackage = {}, mode = 'offline') {
  const sourceOnly = mode === 'offline' || mode === 'source';
  return {
    sourceOnly,
    evidence: workPackage.presentation || {},
    expertInterpretation: sourceOnly ? [] : list(workPackage.coordination),
    recommendedActions: sourceOnly ? [] : list(workPackage.responseActions),
    risks: sourceOnly ? [] : list(workPackage.risks),
    inspectionPreparation: sourceOnly ? null : workPackage.inspectionPreparation || null,
    limitations: list(workPackage.limitations)
  };
}

export function buildConstructionWorkPackage({ planResult = {}, documents = [], sections = [], inspections = [], relationships = [], revisions = [], lineages = [], evidence = [], workflow = null } = {}) {
  const matchingSheets = new Set(list(planResult.matchingSheetIds));
  const drawingItems = list(planResult.actions).filter(item => item.target?.sheetId && matchingSheets.has(item.target.sheetId)).map(item => ({
    id: item.target.sheetId, drawingId: item.target.drawingId || '', documentId: item.target.documentId, sheetId: item.target.sheetId, pageNumber: item.target.pageNumber, observationId: item.target.observationId || '', region: item.target.region || null,
    reasonCode: item.target.observationId ? 'drawing-room-observation' : 'drawing-discipline-classification', reason: workPackageReason(item.target.observationId ? 'drawing-room-observation' : 'drawing-discipline-classification'), confidence: item.target.observationId ? 'Supported' : 'High', target: item.target
  }));
  const selectedIds = new Set(drawingItems.flatMap(item => [item.documentId, item.sheetId, item.observationId]).filter(Boolean));
  const relationshipIds = new Set(list(relationships).filter(rel => selectedIds.has(text(rel.fromId || rel.sourceId || rel.from)) || selectedIds.has(text(rel.toId || rel.targetId || rel.to))).flatMap(rel => [text(rel.fromId || rel.sourceId || rel.from), text(rel.toId || rel.targetId || rel.to)]).filter(Boolean));
  const matchedInspections = list(inspections).filter(record => exactMetadata(record, planResult) || referencedIds(record).some(id => selectedIds.has(id))).map(record => ({ ...referenceItem(record, exactMetadata(record, planResult) || 'inspection-related-drawing'), inspectionNumber: text(record.inspectionNumber), title: text(record.title), status: text(record.status), result: text(record.result), followUpRequired: Boolean(record.followUpRequired), followUpDate: text(record.followUpDate), sourceRecord: record }));
  const inspectionRefs = new Set(matchedInspections.flatMap(item => referencedIds(item.sourceRecord)));
  const groups = { specifications: [], rfis: [], submittals: [], deficiencies: [] };
  for (const document of list(documents)) {
    const kind = category(document);
    if (!(kind in groups)) continue;
    const reasonCode = relationshipIds.has(document.id) ? 'explicit-document-reference' : inspectionRefs.has(document.id) ? `inspection-related-${kind === 'specifications' ? 'specification' : kind.slice(0, -1)}` : exactMetadata(document, planResult);
    if (!reasonCode) continue;
    groups[kind].push({ ...referenceItem(document, reasonCode), title: text(document.title || document.name), status: text(document.status), documentId: document.id });
  }
  const documentById = new Map(list(documents).map(item => [item.id, item]));
  for (const section of list(sections).filter(item => relationshipIds.has(item.id) || inspectionRefs.has(item.id))) {
    const kind = category(documentById.get(section.documentId) || {});
    if (!(kind in groups)) continue;
    groups[kind].push({ ...referenceItem(section, 'explicit-section-reference'), title: text(section.heading || section.title), documentId: text(section.documentId), sectionId: text(section.id) });
  }
  const evidenceItems = uniqueItems(list(evidence).filter(item => item.documentId && (selectedIds.has(item.documentId) || selectedIds.has(item.sectionId) || relationshipIds.has(item.documentId) || relationshipIds.has(item.sectionId))).map(item => ({ id: `${item.documentId}:${item.sectionId || ''}`, documentId: text(item.documentId), sectionId: text(item.sectionId), reasonCode: 'active-session-evidence', reason: workPackageReason('active-session-evidence'), confidence: 'High' })));
  const revisionItems = uniqueItems(list(revisions).filter(item => list(item.documentIds).some(id => selectedIds.has(id)) || selectedIds.has(item.documentId) || relationshipIds.has(item.revisionId)).map(item => ({ ...referenceItem(item, 'explicit-revision-pair'), documentId: text(item.documentId), status: text(item.status) })));
  const lineageItems = list(lineages).filter(item => selectedIds.has(item.documentId) || list(item.documentIds).some(id => selectedIds.has(id))).map(item => ({ ...referenceItem(item, 'explicit-lineage') }));
  const schedules = drawingItems.filter(item => planResult.supportedWorkItems?.find(work => work.sheetId === item.sheetId)?.basis === 'Schedule entry');
  const details = drawingItems.filter(item => /\bdetail\b/i.test(list(planResult.supportedWorkItems).find(work => work.sheetId === item.sheetId)?.statement || ''));
  const workSummary = list(planResult.supportedWorkItems).map(item => ({ ...item, reasonCode: item.observationId ? 'drawing-room-observation' : 'drawing-discipline-classification', reason: workPackageReason(item.observationId ? 'drawing-room-observation' : 'drawing-discipline-classification'), confidence: item.observationId ? 'Supported' : 'High' }));
  const workflowTemplateId = text(workflow?.workflowType || workflow?.workflowTemplateId);
  const packageBase = {
    projectId: text(planResult.projectId), building: text(planResult.building), floor: text(planResult.floor), room: text(planResult.room), discipline: text(planResult.discipline),
    workSummary, drawings: uniqueItems(drawingItems), specifications: uniqueItems(groups.specifications), rfis: uniqueItems(groups.rfis), submittals: uniqueItems(groups.submittals), inspections: uniqueItems(matchedInspections), deficiencies: uniqueItems(groups.deficiencies), evidence: evidenceItems, schedules, details, revisions: revisionItems,
    relatedTrades: [], coordination: [], risks: [], inspectionPreparation: {}, viewerTargets: drawingItems.map(item => item.target), responseActions: uniqueActions(planResult.actions), limitations: [...list(planResult.limitations)], workflowTemplateId, lineage: lineageItems
  };
  const presentationSections = [
    { key: 'summary', title: 'Summary', items: packageBase.workSummary.slice(0, 3).map(item => ({ id: item.sheetId || item.observationId || 'summary', label: item.statement || text(item.basis) })) },
    { key: 'location', title: 'Location', items: [
      { id: 'building', label: packageBase.building ? `Building ${packageBase.building}` : 'Building not specified' },
      { id: 'floor', label: packageBase.floor ? `Floor ${packageBase.floor}` : 'Floor not specified' },
      { id: 'room', label: packageBase.room ? `Room ${packageBase.room}` : 'Room not specified' }
    ].filter(item => item.label && item.label !== 'Building not specified' && item.label !== 'Floor not specified' && item.label !== 'Room not specified') },
    { key: 'drawings', title: 'Drawings', items: packageBase.drawings.map(item => ({ id: item.id, label: text(item.sheetId) })) },
    { key: 'specifications', title: 'Specifications', items: packageBase.specifications.map(item => ({ id: item.id, label: item.title || item.id })) },
    { key: 'rfis', title: 'RFIs', items: packageBase.rfis.map(item => ({ id: item.id, label: item.title || item.id })) },
    { key: 'submittals', title: 'Submittals', items: packageBase.submittals.map(item => ({ id: item.id, label: item.title || item.id })) },
    { key: 'inspections', title: 'Inspections', items: packageBase.inspections.map(item => ({ id: item.id, label: item.title || item.id })) },
    { key: 'deficiencies', title: 'Deficiencies', items: packageBase.deficiencies.map(item => ({ id: item.id, label: item.title || item.id })) },
    { key: 'risks', title: 'Risks', items: packageBase.risks.map(item => ({ id: item.id, label: item.label })) },
    { key: 'actions', title: 'Recommended Actions', items: packageBase.responseActions.map(item => ({ id: item.target?.sheetId || item.target?.documentId || item.action, label: item.label })) }
  ].filter(section => section.items.length);
  packageBase.risks = riskItems(packageBase);
  packageBase.inspectionPreparation = {
    drawingIds: ids(packageBase.drawings.map(item => item.documentId)), specificationIds: ids(packageBase.specifications.map(item => item.id)), rfiIds: ids(packageBase.rfis.map(item => item.id)), submittalIds: ids(packageBase.submittals.map(item => item.id)), inspectionIds: ids(packageBase.inspections.map(item => item.id)), deficiencyIds: ids(packageBase.deficiencies.map(item => item.id)), evidenceReferences: packageBase.evidence.map(item => ({ documentId: item.documentId, sectionId: item.sectionId })), workflowTemplateId,
    nextInspection: packageBase.inspections.find(item => item.status === 'Follow-Up Required' || item.followUpDate) || null,
    nextInspectionStatement: packageBase.inspections.some(item => item.status === 'Follow-Up Required' || item.followUpDate) ? 'An exact follow-up inspection record is available.' : 'No deterministic next inspection is recorded.'
  };
  const scheduleDetailIds = new Set([...packageBase.schedules, ...packageBase.details].map(item => item.id));
  packageBase.presentation = {
    overview: workSummary,
    location: { building: packageBase.building, floor: packageBase.floor, room: packageBase.room },
    tradeSystem: packageBase.discipline,
    primaryDrawing: planResult.ambiguous ? null : packageBase.drawings.find(item => item.sheetId === planResult.viewerTarget?.sheetId) || packageBase.drawings[0] || null,
    relatedPlans: packageBase.drawings.filter(item => item.sheetId !== planResult.viewerTarget?.sheetId && !scheduleDetailIds.has(item.id)),
    schedulesDetails: uniqueItems([...packageBase.schedules, ...packageBase.details]),
    exactPlanEvidence: workSummary.map(item => ({ ...item, quality: evidenceQuality(item) })),
    supportingRequirements: packageBase.specifications,
    projectRecords: { rfis: packageBase.rfis, submittals: packageBase.submittals, inspections: packageBase.inspections, deficiencies: packageBase.deficiencies },
    inspectionPreparation: packageBase.inspectionPreparation,
    risks: packageBase.risks,
    limitations: packageBase.limitations,
    actions: packageBase.responseActions,
    evidenceConfidence: packageBase.evidence.length || packageBase.inspections.length || packageBase.drawings.length || packageBase.specifications.length || packageBase.rfis.length || packageBase.submittals.length || packageBase.deficiencies.length || packageBase.workSummary.length ? 'High' : 'Supported',
    sections: presentationSections
  };
  return packageBase;
}
