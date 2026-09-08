const list = value => Array.isArray(value) ? value : [];
const text = value => value === null || value === undefined ? '' : String(value).trim();
export const CONSTRUCTION_INTELLIGENCE_PANEL_STATE_KEY = 'mission-companion:construction-intelligence-panel:v1';
export const CONSTRUCTION_INTELLIGENCE_DEFAULT_EXPANDED = Object.freeze(['construction-summary', 'chief-recommendation', 'specifications', 'field-requirements']);
const FIELD_PHASES = Object.freeze({
  'Before Installation': ['submittals', 'quality assurance', 'quality', 'examination/preparation', 'products/materials'],
  Installation: ['execution', 'installation'],
  'Inspection and Testing': ['testing', 'inspection', 'commissioning'],
  'Protection and Closeout': ['protection', 'closeout']
});

export function loadConstructionIntelligencePanelState(storage = globalThis.localStorage) {
  try {
    const stored = JSON.parse(storage?.getItem?.(CONSTRUCTION_INTELLIGENCE_PANEL_STATE_KEY) || '{}');
    return { expanded: [...new Set(Array.isArray(stored.expanded) ? stored.expanded.filter(text) : CONSTRUCTION_INTELLIGENCE_DEFAULT_EXPANDED)] };
  } catch { return { expanded: [...CONSTRUCTION_INTELLIGENCE_DEFAULT_EXPANDED] }; }
}

export function saveConstructionIntelligencePanelState(expanded, storage = globalThis.localStorage) {
  const state = { expanded: [...new Set(list(expanded).map(text).filter(Boolean))].slice(0, 20) };
  try { storage?.setItem?.(CONSTRUCTION_INTELLIGENCE_PANEL_STATE_KEY, JSON.stringify(state)); } catch { /* UI preference persistence is optional. */ }
  return state;
}

function unique(items, key) {
  const seen = new Set();
  return list(items).filter(item => {
    const identity = key(item);
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function relationshipRecords(groups, names) {
  return unique(names.flatMap(name => list(groups?.[name])).filter(item => item?.relationship?.verificationState !== 'rejected'), item => item.entity?.entityId || item.relationship?.relationshipId)
    .map(item => ({ ...item, label: text(item.entity?.label || item.entity?.title), target: item.entity?.metadata?.navigationTarget || null }));
}

function specificationRecords(requirements, links, { mode = 'page', objectId = '' } = {}) {
  // Prioritize drawing-spec-links over requirements resolver data
  const linkRecords = list(links).filter(item => item.status !== 'rejected');
  const records = linkRecords.length > 0
    ? linkRecords
    : [
        ...list(requirements?.confirmedSpecifications),
        ...list(requirements?.suggestedSpecifications)
      ].filter(item => item.status !== 'rejected');
  
  const filteredRecords = records.filter(item => mode === 'object'
    ? text(item.objectId || item.sourceObjectId) === text(objectId) || text(item.applicabilityScope) === 'object-specific' || (!text(item.objectId || item.sourceObjectId) && !text(item.applicabilityScope))
    : text(item.applicabilityScope || 'page-wide') === 'page-wide' || text(item.objectId || item.sourceObjectId) || text(item.applicabilityScope) === 'object-specific' || !text(item.applicabilityScope));
  
  return unique(filteredRecords, item => `${text(item.specificationDocumentId)}:${text(item.sectionNumber).replace(/\D/g, '')}:${text(item.article?.id || item.articleReference)}`)
    .map(item => ({
      ...item,
      label: `${text(item.sectionNumber)}${text(item.sectionTitle) ? ` — ${text(item.sectionTitle)}` : ''}`,
      status: item.status || 'suggested',
      displayStatus: item.origin === 'manual' ? 'manual' : item.status || 'suggested',
      evidenceText: text(item.evidenceText || item.reason),
      evidenceSource: text(item.evidenceSource || item.evidenceType || item.origin),
      canOpen: Boolean(text(item.specificationDocumentId) && text(item.sectionNumber)),
      canShowSource: Boolean(item.startPdfPage || item.sourcePageNumber),
      sourcePageNumber: Number(item.startPdfPage || item.sourcePageNumber) || null,
      evidenceCount: Math.max(1, list(item.evidence).length, list(item.evidenceObservations).length),
      drawingSpecLinkId: item.linkId || item.drawingSpecLinkId || null
    }));
}

function normalizeSpecificationRecords(records, { mode = 'page', objectId = '' } = {}) {
  return unique(list(records).filter(item => mode === 'object'
    ? text(item.objectId || item.sourceObjectId) === text(objectId) || text(item.applicabilityScope) === 'object-specific' || (!text(item.objectId || item.sourceObjectId) && !text(item.applicabilityScope))
    : text(item.applicabilityScope || 'page-wide') === 'page-wide' || text(item.objectId || item.sourceObjectId) || text(item.applicabilityScope) === 'object-specific' || !text(item.applicabilityScope)), item => `${text(item.specificationDocumentId)}:${text(item.sectionNumber).replace(/\D/g, '')}:${text(item.article?.id || item.articleReference)}`)
    .map(item => ({
      ...item,
      label: `${text(item.sectionNumber)}${text(item.sectionTitle) ? ` — ${text(item.sectionTitle)}` : ''}`,
      status: item.status || 'suggested',
      displayStatus: item.origin === 'manual' ? 'manual' : item.status || 'suggested',
      evidenceText: text(item.evidenceText || item.reason),
      evidenceSource: text(item.evidenceSource || item.evidenceType || item.origin),
      canOpen: Boolean(text(item.specificationDocumentId) && text(item.sectionNumber)),
      canShowSource: Boolean(item.startPdfPage || item.sourcePageNumber),
      sourcePageNumber: Number(item.startPdfPage || item.sourcePageNumber) || null,
      evidenceCount: Math.max(1, list(item.evidence).length, list(item.evidenceObservations).length)
    }));
}

function resolvedSpecificationRecords(input, { mode = 'page', objectId = '' } = {}) {
  const resolved = [
    ...list(input.requirements?.confirmedSpecifications),
    ...list(input.requirements?.suggestedSpecifications)
  ];
  if (resolved.length) return normalizeSpecificationRecords(resolved, { mode, objectId });
  return specificationRecords(input.requirements, input.specificationLinks, { mode, objectId });
}

function historyRecords(object, history, specificationLinks) {
  const entries = [
    object?.createdAt ? { label: 'Created', value: object.createdAt } : null,
    object?.updatedAt ? { label: 'Modified', value: object.updatedAt } : null,
    object?.sourceObservationIds?.length ? { label: 'Parser observations', value: String(object.sourceObservationIds.length) } : null,
    ...list(history).map(item => ({ label: text(item.action || item.source || 'Object history'), value: text(item.timestamp || item.createdAt), note: text(item.note) })),
    ...list(specificationLinks).filter(item => item.status === 'confirmed').map(item => ({ label: 'Specification confirmation', value: text(item.updatedAt || item.createdAt), note: text(item.sectionNumber) }))
  ].filter(Boolean);
  return unique(entries, item => `${item.label}:${item.value}:${item.note || ''}`);
}

function fieldWork(requirements) {
  const source = requirements?.fieldRequirements || {};
  return Object.entries(FIELD_PHASES).map(([phase, categories]) => ({
    phase,
    items: unique(categories.flatMap(category => list(source[category]).map(item => ({ ...item, category, label: text(item.article?.heading || item.article?.title || item.sectionTitle) }))).filter(item => item.label), item => `${item.requirementId || item.sectionNumber}:${item.article?.id || item.label}`)
  })).filter(group => group.items.length);
}

function chiefRecommendation(object, specifications, insights) {
  const explicit = list(insights)[0];
  if (explicit?.label) return { text: explicit.label, source: 'verified-project-record' };
  const confirmed = specifications.find(item => item.status === 'confirmed');
  if (confirmed) return { text: `${text(object?.label || object?.tag || 'This work item')} is governed by Section ${confirmed.sectionNumber} — ${confirmed.sectionTitle}.`, source: 'confirmed-specification' };
  const suggested = specifications.find(item => item.status === 'suggested');
  if (suggested) return { text: `Review whether Section ${suggested.sectionNumber} — ${suggested.sectionTitle} governs ${text(object?.label || object?.tag || 'this work item')}.`, source: 'suggested-specification' };
  return null;
}

function normalizedRegionSummary(region) {
  if (!region || typeof region !== 'object') return '';
  const values = ['x', 'y', 'width', 'height'].map(key => Number(region[key]));
  if (!values.every(Number.isFinite)) return '';
  return `x ${Math.round(values[0] * 100)}%, y ${Math.round(values[1] * 100)}%, w ${Math.round(values[2] * 100)}%, h ${Math.round(values[3] * 100)}%`;
}

export function buildConstructionIntelligencePanelModel(input = {}) {
  const sheet = input.sheet || {};
  const object = input.selectedObject || null;
  const specLinksDiagnostic = input.specLinksDiagnostic || null;
  const graphRequirements = {
    confirmedSpecifications: list(input.graphSummary?.requirements?.confirmed).map(item => ({ sectionNumber: text(item.node?.metadata?.sectionNumber || item.node?.normalizedKey), sectionTitle: text(item.node?.title || item.node?.label).replace(/^\S+\s+[—-]\s+/, ''), specificationDocumentId: text(item.node?.sourceDocumentId), status: 'confirmed', applicabilityScope: item.edge?.scope === 'object' ? 'object-specific' : 'page-wide', evidence: item.edge?.evidence, reason: text(item.edge?.evidence?.[0]?.sourceText), objectId: text(item.edge?.sourceObjectId) })),
    suggestedSpecifications: list(input.graphSummary?.requirements?.suggested).map(item => ({ sectionNumber: text(item.node?.metadata?.sectionNumber || item.node?.normalizedKey), sectionTitle: text(item.node?.title || item.node?.label).replace(/^\S+\s+[—-]\s+/, ''), specificationDocumentId: text(item.node?.sourceDocumentId), status: 'suggested', applicabilityScope: item.edge?.scope === 'object' ? 'object-specific' : 'page-wide', evidence: item.edge?.evidence, reason: text(item.edge?.evidence?.[0]?.sourceText), objectId: text(item.edge?.sourceObjectId) }))
  };
  input = { ...input, requirements: { ...input.requirements, confirmedSpecifications: [...list(input.requirements?.confirmedSpecifications), ...graphRequirements.confirmedSpecifications], suggestedSpecifications: [...list(input.requirements?.suggestedSpecifications), ...graphRequirements.suggestedSpecifications] } };
  const intelligenceStatus = ['complete', 'partial', 'unavailable'].includes(input.requirements?.status) ? input.requirements.status : 'complete';
  if (!object) {
    const counts = list(input.pageObjects).filter(item => item.verificationState !== 'rejected').reduce((result, item) => {
      const key = text(item.type || item.objectType || 'object').replace(/-/g, ' ');
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    const specifications = resolvedSpecificationRecords(input, { mode: 'page' });
    const fieldRequirements = unique(Object.entries(input.requirements?.fieldRequirements || {}).flatMap(([category, items]) => list(items).map(item => ({ ...item, category }))), item => `${item.category}:${item.requirementId || item.sectionNumber}:${item.article?.id || ''}`);
    const pageInsights = relationshipRecords(input.relationshipGroups, ['chiefInsights', 'insights']);
    const warnings = unique([...list(input.requirements?.warnings), ...list(input.requirements?.providerFailures)].map(item => ({ label: text(item?.message || item?.warning || item), detail: text(item?.code || item?.provider || '') })), item => `${item.label}:${item.detail}`);
    const unresolvedEvidence = unique([...specifications.filter(item => item.status === 'suggested').map(item => ({ label: item.sectionNumber, detail: item.sectionTitle || item.evidenceText || '' })), ...list(input.unresolvedEvidence)], item => `${item.label}:${item.detail}`);
    const rejectedSpecifications = specifications.filter(item => item.status === 'rejected');
    return {
      mode: 'page',
      status: intelligenceStatus,
      specLinksDiagnostic,
      page: {
        drawing: text(input.document?.title || input.document?.name),
        drawingSet: text(input.document?.title || input.document?.name || input.document?.id),
        sheet: text(sheet.sheetNumber) || `Page ${Number(sheet.pageNumber) || 1}`,
        sheetTitle: text(sheet.sheetTitle),
        building: text(sheet.building),
        discipline: text(sheet.discipline) || 'Unknown',
        drawingType: text(sheet.primarySheetType || list(sheet.sheetTypes)[0] || 'Unknown'),
        pdfPage: Number(sheet.pageNumber) || null,
        revision: text(sheet.revision || sheet.issue || sheet.issueDate || input.document?.revision || input.document?.issueDate),
        issue: text(sheet.issueNumber || sheet.issue || sheet.issueDate || input.document?.issueNumber || input.document?.issueDate),
        activeTrade: text(input.trade?.label) || 'All Trades',
        pageStatus: text(input.pageStatus || sheet.identityStatus || (sheet.metadataAvailable ? 'Partial metadata' : 'Fallback')),
        drawingNotes: unique(list(input.pageNotes).map(item => text(item.label || item.value || item.text)).filter(Boolean), item => item),
        objectCounts: counts,
        schedules: unique(list(input.schedules), item => `${text(item.sheetId)}:${text(item.scheduleId || item.scheduleOccurrenceId || item.identifier || item.sectionNumber || item.label || item.value)}`),
        legends: unique(list(input.legends), item => `${text(item.sheetId)}:${text(item.legendId || item.legendOccurrenceId || item.identifier || item.label || item.title || item.value)}`),
        keyedNotes: unique(list(input.keyedNotes), item => `${text(item.sheetId)}:${text(item.keyedNoteOccurrenceId || item.keyedNoteId || item.identifier || item.label)}`),
        references: unique(list(input.references), item => `${text(item.referenceId || item.sheetId)}:${text(item.label || item.title || item.referenceNumber || item.value)}`),
        relatedDrawings: relationshipRecords(input.relationshipGroups, ['relatedDrawings']),
        relatedDetails: unique(list(input.relatedDetails), item => `${text(item.detailId || item.observationId || item.label || item.title)}`),
        warnings,
        unresolvedEvidence
      },
      specifications: { confirmed: specifications.filter(item => item.status === 'confirmed'), suggested: specifications.filter(item => item.status === 'suggested'), rejected: rejectedSpecifications },
      fieldRequirements,
      fieldWork: fieldWork(input.requirements),
      drawingContent: counts,
      constructionSummary: {
        governedWork: unique(specifications.map(item => text(item.sectionTitle)).filter(Boolean), item => item),
        referencedContent: Object.entries(counts).map(([label, count]) => ({ label, count })),
        inspectionFocus: fieldWork(input.requirements).filter(group => ['Before Installation', 'Inspection and Testing'].includes(group.phase))
      },
      projectInformation: {
        inspections: relationshipRecords(input.relationshipGroups, ['inspections']), rfis: relationshipRecords(input.relationshipGroups, ['rfis']), submittals: relationshipRecords(input.relationshipGroups, ['submittals']),
        photos: relationshipRecords(input.relationshipGroups, ['photos']), documents: relationshipRecords(input.relationshipGroups, ['documents', 'reports']), risks: relationshipRecords(input.relationshipGroups, ['risks']),
        procurement: relationshipRecords(input.relationshipGroups, ['procurement', 'procurementItems']), shutdowns: relationshipRecords(input.relationshipGroups, ['shutdowns']), commissioning: relationshipRecords(input.relationshipGroups, ['commissioning']),
        progress: relationshipRecords(input.relationshipGroups, ['progress']), pmis: relationshipRecords(input.relationshipGroups, ['pmis'])
      },
      relatedDrawings: relationshipRecords(input.relationshipGroups, ['relatedDrawings']),
      chiefInsights: pageInsights,
      chiefRecommendation: chiefRecommendation(null, specifications, pageInsights),
      projectWideRequirements: list(input.requirements?.projectWideRequirements),
      diagnostics: list(input.developerDiagnostics),
      specLinksDiagnostic
    };
  }

  const groups = input.relationshipGroups || {};
  let specifications = resolvedSpecificationRecords(input, { mode: 'object', objectId: object.objectId });
  if (Number(input.multiSelection?.selectionCount) > 1) {
    const sharedKeys = new Set(list(input.multiSelection?.sharedSpecifications).map(item=>`${text(item.specificationDocumentId)}:${text(item.sectionNumber).replace(/\D/g,'')}`));
    specifications = specifications.filter(item=>sharedKeys.has(`${text(item.specificationDocumentId)}:${text(item.sectionNumber).replace(/\D/g,'')}`));
  }
  const fields = Object.entries(input.requirements?.fieldRequirements || {}).flatMap(([category, items]) => list(items).map(item => ({ ...item, category })));
  const objectInsights = relationshipRecords(groups, ['chiefInsights', 'insights', 'recommendations']);
  const relatedDrawings = relationshipRecords(groups, ['relatedDrawings']);
  const relatedObjects = relationshipRecords(groups, ['relatedObjects', 'equipment', 'rooms']);
  const warnings = unique([...list(input.requirements?.warnings), ...list(input.requirements?.providerFailures)].map(item => ({ label: text(item?.message || item?.warning || item), detail: text(item?.code || item?.provider || '') })), item => `${item.label}:${item.detail}`);
  const unresolvedRelationships = unique([...relatedDrawings, ...relatedObjects, ...relationshipRecords(groups, ['scheduleActivities', 'activities', 'photos', 'documents', 'issues', 'risks', 'rfis', 'submittals'])].filter(item => item.relationship?.verificationState !== 'confirmed'), item => item.relationship?.relationshipId || item.entity?.entityId || item.label);
  return {
    mode: 'object',
    status: intelligenceStatus,
    object: {
      name: text(object.label || object.tag), type: text(object.type || object.objectType), objectId: text(object.objectId),
      sourceSheet: text(sheet.sheetNumber) || `Page ${Number(sheet.pageNumber) || 1}`,
      location: text(sheet.sheetNumber) || `Page ${Number(sheet.pageNumber) || 1}`,
      building: text(object.buildingId || sheet.building), room: text(object.roomId || object.roomNumber), trade: text(object.trade), system: text(object.system),
      confidence: Number(object.confidence) || 0, revision: text(object.revision || object.metadata?.revision), verificationState: text(object.verificationState),
      statusLabel: object.verificationState === 'candidate' ? 'Suggested' : object.verificationState === 'confirmed' ? 'Confirmed' : object.verificationState === 'rejected' ? 'Rejected' : text(object.verificationState || 'Unverified'), selectionCount: Math.max(1, Number(input.multiSelection?.selectionCount) || 1),
      hasLocation: Boolean(object.region || object.graphicalRegion), regionSummary: normalizedRegionSummary(object.region || object.graphicalRegion), hasPossibleDuplicates: Boolean(input.hasPossibleDuplicates), hasMergedObjects: Boolean(object.mergedObjectIds?.length), canLinkSpecification: Boolean(input.canLinkSpecification),
      evidenceSource: text(object.evidenceText || object.sourceText || object.acceptanceReason || object.sourceObservationIds?.[0]),
      schedules: unique(list(input.schedules), item => `${text(item.sheetId)}:${text(item.scheduleId || item.scheduleOccurrenceId || item.identifier || item.sectionNumber || item.label || item.value)}`),
      legends: unique(list(input.legends), item => `${text(item.sheetId)}:${text(item.legendId || item.legendOccurrenceId || item.identifier || item.label || item.title || item.value)}`),
      keyedNotes: unique(list(input.keyedNotes), item => `${text(item.sheetId)}:${text(item.keyedNoteOccurrenceId || item.keyedNoteId || item.identifier || item.label)}`),
      references: unique(list(input.references), item => `${text(item.referenceId || item.sheetId)}:${text(item.label || item.title || item.referenceNumber || item.value)}`),
      relatedDetails: unique(list(input.relatedDetails), item => `${text(item.detailId || item.observationId || item.label || item.title)}`),
      warnings,
      unresolvedRelationships
    },
    specifications: {
      confirmed: specifications.filter(item => item.status === 'confirmed'),
      suggested: specifications.filter(item => item.status === 'suggested'),
      articles: unique(specifications.map(item => item.article).filter(Boolean), item => item.id || `${item.heading}:${item.pageNumber}`)
    },
    fieldRequirements: unique(fields, item => `${item.category}:${item.requirementId || item.sectionNumber}`),
    fieldWork: fieldWork(input.requirements),
    pmis: {
      inspections: relationshipRecords(groups, ['inspections']), risks: relationshipRecords(groups, ['risks']), issues: relationshipRecords(groups, ['issues']),
      rfis: relationshipRecords(groups, ['rfis']), submittals: relationshipRecords(groups, ['submittals']), shutdowns: relationshipRecords(groups, ['shutdowns']), commissioning: relationshipRecords(groups, ['commissioning']),
      punchItems: relationshipRecords(groups, ['punchItems', 'deficiencies']), progress: relationshipRecords(groups, ['progress']), questions: relationshipRecords(groups, ['questions']), workPackages: relationshipRecords(groups, ['workPackages'])
    },
    schedule: relationshipRecords(groups, ['scheduleActivities', 'activities']),
    procurement: relationshipRecords(groups, ['procurement', 'procurementItems']),
    relatedDrawings,
    relatedObjects,
    documents: {
      photos: relationshipRecords(groups, ['photos']), reports: relationshipRecords(groups, ['reports', 'inspectionReports', 'dailyReports']),
      notes: relationshipRecords(groups, ['fieldNotes', 'constructionNotes']), correspondence: relationshipRecords(groups, ['correspondence']), existingConditions: relationshipRecords(groups, ['existingConditions']), meetingMinutes: relationshipRecords(groups, ['meetingMinutes'])
    },
    history: historyRecords(object, input.objectHistory, input.specificationLinks),
    chiefInsights: objectInsights,
    chiefRecommendation: chiefRecommendation(object, specifications, objectInsights),
    diagnostics: list(input.developerDiagnostics),
    chiefContext: {
      objectId: text(object.objectId), viewport: input.viewportContext || null, roomId: text(object.roomId) || null, trade: text(input.trade?.key || object.trade),
      specifications: specifications.filter(item => item.status === 'confirmed'), pmis: groups, schedule: relationshipRecords(groups, ['scheduleActivities', 'activities']),
      inspections: relationshipRecords(groups, ['inspections']), history: historyRecords(object, input.objectHistory, input.specificationLinks)
    },
    sourceEntityId: text(input.sourceEntityId),
    relatedDrawings,
    relatedObjects
  };
}
