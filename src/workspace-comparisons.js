import { buildBedfordWorkspaceModel, listBedfordWorkspaceRecords } from './workspace-registry.js';
import { buildWorkspaceDocumentsModel } from './workspace-documents.js';
import { buildWorkspaceIssuesModel } from './workspace-issues.js';
import { buildWorkspaceChecklistModel } from './workspace-checklist.js';
import { buildWorkspaceTimelineModel } from './workspace-timeline.js';
import { buildBedfordProjectMilestoneContext } from './workspace-milestones.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

export const WORKSPACE_COMPARISON_MODES = Object.freeze({
  WORKSPACE: 'workspace-vs-workspace',
  REQUIREMENT: 'requirement-vs-evidence'
});

export function workspaceComparisonModeLabel(mode = '') {
  return text(mode) === WORKSPACE_COMPARISON_MODES.REQUIREMENT
    ? 'Requirement vs Evidence'
    : 'Workspace vs Workspace';
}

export function resolveWorkspaceComparisonRightWorkspaceId(leftWorkspaceId = '', preferredRightWorkspaceId = '') {
  const left = text(leftWorkspaceId);
  const preferred = text(preferredRightWorkspaceId);
  const records = listBedfordWorkspaceRecords();
  const options = records.map(record => text(record.id)).filter(Boolean).filter(id => id !== left);
  if (preferred && preferred !== left && options.includes(preferred)) return preferred;
  return options[0] || '';
}

function buildWorkspaceContext(workspaceId = '', pmisRuntime = null) {
  const workspaceModel = buildBedfordWorkspaceModel(workspaceId);
  const workspace = workspaceModel.activeWorkspace || null;
  const projectMilestoneContext = workspaceModel.projectMilestoneContext || buildBedfordProjectMilestoneContext({ workspace });
  const issuesModel = buildWorkspaceIssuesModel({ workspace, projectMilestoneContext, pmisRuntime });
  const checklistModel = buildWorkspaceChecklistModel({ workspace, projectMilestoneContext, issuesModel, pmisRuntime });
  const timelineModel = buildWorkspaceTimelineModel({ workspace, projectMilestoneContext, issuesModel, checklistModel });
  const documentsModel = buildWorkspaceDocumentsModel({ workspace, projectMilestoneContext });
  return {
    workspaceId: text(workspace?.id || workspaceId),
    workspace,
    workspaceModel,
    projectMilestoneContext,
    issuesModel,
    checklistModel,
    timelineModel,
    documentsModel
  };
}

function comparisonEntryLabel(entry = {}) {
  return text(entry.label || entry.title || entry.name || entry.id || '');
}

function comparisonEntryDetail(entry = {}) {
  return text(entry.detail || entry.description || entry.subtitle || entry.status || '');
}

function sortStrings(values = []) {
  return [...values].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function compareValue(left = '', right = '') {
  const leftValue = text(left);
  const rightValue = text(right);
  if (!leftValue && !rightValue) return 'not-available';
  if (leftValue === rightValue) return 'same';
  if (!leftValue) return 'right-only';
  if (!rightValue) return 'left-only';
  return 'different';
}

function compareFields(fields = []) {
  return fields.map(field => {
    const status = compareValue(field.left, field.right);
    return Object.freeze({
      id: text(field.id || field.label),
      label: text(field.label || field.id),
      left: text(field.left),
      right: text(field.right),
      status,
      notes: text(field.notes || '')
    });
  });
}

function compareListItems({ leftItems = [], rightItems = [], keyFn = item => comparisonEntryLabel(item), createEntry = item => item } = {}) {
  const leftMap = new Map();
  const rightMap = new Map();
  for (const item of list(leftItems)) {
    const key = text(keyFn(item));
    if (key) leftMap.set(key, createEntry(item));
  }
  for (const item of list(rightItems)) {
    const key = text(keyFn(item));
    if (key) rightMap.set(key, createEntry(item));
  }
  const rows = [];
  const keys = sortStrings([...leftMap.keys(), ...rightMap.keys()]);
  for (const key of keys) {
    const left = leftMap.get(key) || null;
    const right = rightMap.get(key) || null;
    const leftSignature = JSON.stringify(left || {});
    const rightSignature = JSON.stringify(right || {});
    const status = left && right
      ? leftSignature === rightSignature ? 'same' : 'different'
      : left
        ? 'left-only'
        : 'right-only';
    rows.push(Object.freeze({
      id: key,
      label: comparisonEntryLabel(left || right || { id: key }),
      left,
      right,
      status
    }));
  }
  const counts = Object.freeze({
    shared: rows.filter(row => row.status === 'same').length,
    different: rows.filter(row => row.status === 'different').length,
    leftOnly: rows.filter(row => row.status === 'left-only').length,
    rightOnly: rows.filter(row => row.status === 'right-only').length
  });
  const status = counts.leftOnly && !counts.rightOnly && !counts.different
    ? 'left-only'
    : counts.rightOnly && !counts.leftOnly && !counts.different
      ? 'right-only'
      : counts.different || counts.leftOnly || counts.rightOnly
        ? 'different'
        : rows.length
          ? 'same'
          : 'not-available';
  return Object.freeze({
    kind: 'list',
    rows,
    counts,
    status,
    shared: rows.filter(row => row.status === 'same'),
    different: rows.filter(row => row.status === 'different'),
    leftOnly: rows.filter(row => row.status === 'left-only'),
    rightOnly: rows.filter(row => row.status === 'right-only')
  });
}

function compareIdentity(leftWorkspace = null, rightWorkspace = null) {
  const fields = compareFields([
    { id: 'building', label: 'Building', left: leftWorkspace?.building, right: rightWorkspace?.building },
    { id: 'room', label: 'Room', left: leftWorkspace?.room, right: rightWorkspace?.room },
    { id: 'level', label: 'Level', left: leftWorkspace?.level, right: rightWorkspace?.level },
    { id: 'name', label: 'Workspace Type', left: leftWorkspace?.name, right: rightWorkspace?.name },
    { id: 'importance', label: 'Importance / Classification', left: leftWorkspace?.importance, right: rightWorkspace?.importance },
    { id: 'discipline', label: 'Discipline Focus', left: leftWorkspace?.disciplineFocus, right: rightWorkspace?.disciplineFocus }
  ]);
  const counts = Object.freeze({
    shared: fields.filter(field => field.status === 'same').length,
    different: fields.filter(field => field.status === 'different').length,
    leftOnly: fields.filter(field => field.status === 'left-only').length,
    rightOnly: fields.filter(field => field.status === 'right-only').length
  });
  const status = counts.different || counts.leftOnly || counts.rightOnly ? 'different' : fields.length ? 'same' : 'not-available';
  return Object.freeze({
    id: 'identity',
    label: 'Identity',
    kind: 'fields',
    status,
    counts,
    rows: fields,
    summary: counts.different || counts.leftOnly || counts.rightOnly
      ? `${counts.shared} shared · ${counts.different} different`
      : `${counts.shared} shared`
  });
}

function compareSourceSheets(leftWorkspace = null, rightWorkspace = null) {
  return Object.freeze({
    id: 'source-sheets',
    label: 'Source Drawings',
    kind: 'list',
    ...compareListItems({
      leftItems: list(leftWorkspace?.sourceSheets),
      rightItems: list(rightWorkspace?.sourceSheets),
      keyFn: item => text(item?.sheetNumber),
      createEntry: item => Object.freeze({
        label: text(item?.sheetNumber),
        detail: text(item?.sheetTitle || item?.discipline || 'Drawing'),
        notes: text(item?.pageId || ''),
        documentId: text(item?.documentId || ''),
        pageId: text(item?.pageId || ''),
        pageNumber: Number(item?.pdfPageNumber) || 0,
        discipline: text(item?.discipline || ''),
        level: text(item?.level || '')
      })
    }),
    summary: 'Primary and related source drawings'
  });
}

function compareSpecifications(leftWorkspace = null, rightWorkspace = null) {
  return Object.freeze({
    id: 'specifications',
    label: 'Specifications',
    kind: 'list',
    ...compareListItems({
      leftItems: list(leftWorkspace?.applicableSpecifications),
      rightItems: list(rightWorkspace?.applicableSpecifications),
      keyFn: item => text(item?.sectionNumber),
      createEntry: item => Object.freeze({
        label: text(item?.sectionNumber),
        detail: text(item?.sectionTitle || 'Applicable specification'),
        sourceLabel: text(item?.sourceLabel || 'Bedford IFC specification index')
      })
    }),
    summary: 'Applicable Bedford IFC specifications'
  });
}

function compareRelatedRooms(leftWorkspace = null, rightWorkspace = null) {
  return Object.freeze({
    id: 'related-rooms',
    label: 'Related Rooms',
    kind: 'list',
    ...compareListItems({
      leftItems: list(leftWorkspace?.relatedRooms).map(room => ({ id: room, label: room, detail: 'Related room' })),
      rightItems: list(rightWorkspace?.relatedRooms).map(room => ({ id: room, label: room, detail: 'Related room' })),
      keyFn: item => text(item?.id || item?.label),
      createEntry: item => Object.freeze({
        label: text(item?.label || item?.id),
        detail: text(item?.detail || 'Related room')
      })
    }),
    summary: 'Related room dependencies'
  });
}

function issueComparisonKey(issue = {}) {
  return [text(issue.scope), text(issue.type), text(issue.title)].join('|');
}

function compareIssues(leftWorkspace = null, rightWorkspace = null, leftIssuesModel = null, rightIssuesModel = null) {
  return Object.freeze({
    id: 'issues',
    label: 'Issues',
    kind: 'list',
    ...compareListItems({
      leftItems: list(leftIssuesModel?.issues),
      rightItems: list(rightIssuesModel?.issues),
      keyFn: issueComparisonKey,
      createEntry: issue => Object.freeze({
        label: text(issue?.title),
        detail: `${text(issue?.scope || 'PROJECT')} · ${text(issue?.severity || 'INFO')} · ${text(issue?.status || 'OPEN')}`,
        description: text(issue?.description || ''),
        impact: text(issue?.impact || ''),
        source: text(issue?.source || 'Workspace'),
        severity: text(issue?.severity || 'INFO'),
        scope: text(issue?.scope || 'PROJECT'),
        status: text(issue?.status || 'OPEN'),
        type: text(issue?.type || 'DEPENDENCY'),
        relatedRooms: list(issue?.relatedRooms).map(room => text(room)).filter(Boolean),
        relatedSpecifications: list(issue?.relatedSpecifications).map(spec => ({
          sectionNumber: text(spec?.sectionNumber),
          sectionTitle: text(spec?.sectionTitle)
        })).filter(spec => spec.sectionNumber || spec.sectionTitle),
        relatedSheets: list(issue?.relatedSheets).map(sheet => ({
          sheetNumber: text(sheet?.sheetNumber),
          sheetTitle: text(sheet?.sheetTitle),
          documentId: text(sheet?.documentId),
          pageId: text(sheet?.pageId)
        })).filter(sheet => sheet.sheetNumber || sheet.sheetTitle),
        relatedMilestones: list(issue?.relatedMilestones).map(milestone => ({
          id: text(milestone?.id),
          label: text(milestone?.label || milestone?.name || milestone?.id),
          dueDateLabel: text(milestone?.dueDateLabel || milestone?.status || ''),
          status: text(milestone?.status || ''),
          category: text(milestone?.category || '')
        })).filter(milestone => milestone.id || milestone.label),
        sourceDocument: issue?.sourceDocument ? {
          id: text(issue.sourceDocument.id),
          title: text(issue.sourceDocument.originalFilename || issue.sourceDocument.name || issue.sourceDocument.title || issue.sourceDocument.id)
        } : null
      })
    }),
    summary: 'Issue, blocker, question, and dependency context'
  });
}

function checklistComparisonKey(item = {}) {
  return [text(item.category), text(item.title)].join('|');
}

function compareChecklist(leftWorkspace = null, rightWorkspace = null, leftChecklistModel = null, rightChecklistModel = null) {
  return Object.freeze({
    id: 'checklist',
    label: 'Checklist',
    kind: 'list',
    ...compareListItems({
      leftItems: list(leftChecklistModel?.items),
      rightItems: list(rightChecklistModel?.items),
      keyFn: checklistComparisonKey,
      createEntry: item => Object.freeze({
        label: text(item?.title),
        detail: `${text(item?.category || 'CHECKLIST')} · ${text(item?.status || 'NOT_VERIFIED')}`,
        description: text(item?.description || ''),
        sourceType: text(item?.sourceType || ''),
        sourceRefs: list(item?.sourceRefs).map(ref => ({
          kind: text(ref?.kind || ''),
          label: text(ref?.label || ref?.title || ref?.sectionNumber || ref?.sheetNumber || ''),
          detail: text(ref?.detail || ''),
          sectionNumber: text(ref?.sectionNumber || ''),
          sectionTitle: text(ref?.sectionTitle || ''),
          sheetNumber: text(ref?.sheetNumber || ''),
          sheetTitle: text(ref?.sheetTitle || ''),
          documentId: text(ref?.documentId || ''),
          pageId: text(ref?.pageId || ''),
          id: text(ref?.id || ''),
          dueDateLabel: text(ref?.dueDateLabel || '')
        })),
        blockedBy: list(item?.blockedBy).map(value => text(value)).filter(Boolean),
        relatedIssues: list(item?.relatedIssues).map(issue => ({
          id: text(issue?.id || ''),
          title: text(issue?.title || issue?.label || ''),
          severity: text(issue?.severity || ''),
          status: text(issue?.status || '')
        })).filter(issue => issue.id || issue.title),
        relatedSpecifications: list(item?.relatedSpecifications).map(spec => ({
          sectionNumber: text(spec?.sectionNumber || ''),
          sectionTitle: text(spec?.sectionTitle || ''),
          relationship: text(spec?.relationship || '')
        })).filter(spec => spec.sectionNumber || spec.sectionTitle),
        relatedSheets: list(item?.relatedSheets).map(sheet => ({
          sheetNumber: text(sheet?.sheetNumber || ''),
          sheetTitle: text(sheet?.sheetTitle || ''),
          relationship: text(sheet?.relationship || '')
        })).filter(sheet => sheet.sheetNumber || sheet.sheetTitle),
        relatedMilestones: list(item?.relatedMilestones).map(milestone => ({
          id: text(milestone?.id || ''),
          label: text(milestone?.label || milestone?.name || milestone?.id || ''),
          dueDateLabel: text(milestone?.dueDateLabel || milestone?.status || ''),
          status: text(milestone?.status || '')
        })).filter(milestone => milestone.id || milestone.label),
        notes: text(item?.notes || ''),
        status: text(item?.status || ''),
        verificationState: text(item?.verificationState || '')
      })
    }),
    summary: 'Checklist requirements and verification state'
  });
}

function timelineComparisonKey(item = {}) {
  return [text(item.category), text(item.title)].join('|');
}

function compareTimeline(leftWorkspace = null, rightWorkspace = null, leftTimelineModel = null, rightTimelineModel = null) {
  return Object.freeze({
    id: 'timeline',
    label: 'Timeline',
    kind: 'list',
    ...compareListItems({
      leftItems: list(leftTimelineModel?.items),
      rightItems: list(rightTimelineModel?.items),
      keyFn: timelineComparisonKey,
      createEntry: item => Object.freeze({
        label: text(item?.title),
        detail: `${text(item?.dateLabel || item?.date || item?.status || 'Pending')}`,
        description: text(item?.description || item?.workspaceImpact || ''),
        status: text(item?.status || ''),
        category: text(item?.category || ''),
        sourceType: text(item?.sourceType || ''),
        dateLabel: text(item?.dateLabel || ''),
        sourceRefs: list(item?.sourceRefs).map(ref => ({
          kind: text(ref?.kind || ''),
          label: text(ref?.label || ref?.title || ref?.documentId || ref?.sectionNumber || ref?.sheetNumber || ''),
          detail: text(ref?.detail || ''),
          documentId: text(ref?.documentId || ''),
          sectionNumber: text(ref?.sectionNumber || ''),
          sectionTitle: text(ref?.sectionTitle || ''),
          sheetNumber: text(ref?.sheetNumber || ''),
          sheetTitle: text(ref?.sheetTitle || ''),
          id: text(ref?.id || ''),
          relationship: text(ref?.relationship || '')
        })),
        relatedIssues: list(item?.relatedIssues).map(issue => ({
          id: text(issue?.id || ''),
          title: text(issue?.title || issue?.label || ''),
          severity: text(issue?.severity || ''),
          status: text(issue?.status || '')
        })).filter(issue => issue.id || issue.title),
        relatedChecklistItems: list(item?.relatedChecklistItems).map(checklist => ({
          id: text(checklist?.id || ''),
          title: text(checklist?.title || checklist?.label || ''),
          status: text(checklist?.status || '')
        })).filter(checklist => checklist.id || checklist.title),
        nextStep: text(item?.nextStep || ''),
        workspaceImpact: text(item?.workspaceImpact || ''),
        authoritative: Boolean(item?.authoritative)
      })
    }),
    summary: 'Milestone chronology and dependency context'
  });
}

function comparePmisContext(leftWorkspace = null, rightWorkspace = null, leftMilestoneContext = null, rightMilestoneContext = null) {
  const rows = compareFields([
    { id: 'pmis-building', label: 'PMIS Building', left: leftWorkspace?.pmisBuilding, right: rightWorkspace?.pmisBuilding },
    { id: 'project-phase', label: 'Project Phase', left: leftMilestoneContext?.projectPhase, right: rightMilestoneContext?.projectPhase },
    { id: 'schedule-status', label: 'Schedule Status', left: leftMilestoneContext?.scheduleStatus, right: rightMilestoneContext?.scheduleStatus },
    { id: 'room-schedule-status', label: 'Room Schedule Status', left: leftMilestoneContext?.roomScheduleStatus, right: rightMilestoneContext?.roomScheduleStatus },
    { id: 'contract-completion', label: 'Contract Completion', left: leftMilestoneContext?.contractCompletionDateLabel, right: rightMilestoneContext?.contractCompletionDateLabel },
    { id: 'ntp', label: 'Notice to Proceed', left: leftMilestoneContext?.ntpDateLabel, right: rightMilestoneContext?.ntpDateLabel }
  ]);
  return Object.freeze({
    id: 'pmis-context',
    label: 'PMIS Context',
    kind: 'fields',
    status: rows.some(row => row.status !== 'same') ? 'different' : rows.length ? 'same' : 'not-available',
    counts: Object.freeze({
      shared: rows.filter(row => row.status === 'same').length,
      different: rows.filter(row => row.status === 'different').length,
      leftOnly: rows.filter(row => row.status === 'left-only').length,
      rightOnly: rows.filter(row => row.status === 'right-only').length
    }),
    rows,
    summary: 'Shared Bedford project chronology and PMIS context'
  });
}

function buildRequirementRows(checklistItems = []) {
  return checklistItems.map(item => {
    const sourceRefs = list(item?.sourceRefs).map(ref => ({
      kind: text(ref?.kind || ''),
      relationship: text(ref?.relationship || ''),
      label: text(ref?.label || ref?.title || ref?.sectionNumber || ref?.sheetNumber || ''),
      detail: text(ref?.detail || ''),
      documentId: text(ref?.documentId || ''),
      title: text(ref?.title || ''),
      sheetNumber: text(ref?.sheetNumber || ''),
      sheetTitle: text(ref?.sheetTitle || ''),
      sectionNumber: text(ref?.sectionNumber || ''),
      sectionTitle: text(ref?.sectionTitle || ''),
      roomId: text(ref?.roomId || ''),
      id: text(ref?.id || ''),
      dueDateLabel: text(ref?.dueDateLabel || '')
    })).filter(ref => ref.kind || ref.label || ref.detail || ref.documentId || ref.sheetNumber || ref.sectionNumber || ref.roomId || ref.id);
    const relatedDrawings = list(item?.relatedSheets).map(sheet => ({
      sheetNumber: text(sheet?.sheetNumber || ''),
      sheetTitle: text(sheet?.sheetTitle || ''),
      discipline: text(sheet?.discipline || ''),
      level: text(sheet?.level || ''),
      documentId: text(sheet?.documentId || ''),
      pageId: text(sheet?.pageId || ''),
      relationship: text(sheet?.relationship || '')
    })).filter(sheet => sheet.sheetNumber || sheet.sheetTitle);
    const relatedSpecifications = list(item?.relatedSpecifications).map(spec => ({
      sectionNumber: text(spec?.sectionNumber || ''),
      sectionTitle: text(spec?.sectionTitle || ''),
      sourceLabel: text(spec?.sourceLabel || ''),
      relationship: text(spec?.relationship || '')
    })).filter(spec => spec.sectionNumber || spec.sectionTitle);
    const relatedIssues = list(item?.relatedIssues).map(issue => ({
      id: text(issue?.id || ''),
      title: text(issue?.title || issue?.label || ''),
      severity: text(issue?.severity || ''),
      status: text(issue?.status || ''),
      scope: text(issue?.scope || ''),
      type: text(issue?.type || '')
    })).filter(issue => issue.id || issue.title);
    const relatedChecklistItems = list(item?.relatedMilestones).map(milestone => ({
      id: text(milestone?.id || ''),
      title: text(milestone?.label || milestone?.name || milestone?.id || ''),
      dueDateLabel: text(milestone?.dueDateLabel || ''),
      status: text(milestone?.status || ''),
      category: text(milestone?.category || '')
    })).filter(entry => entry.id || entry.title);
    const evidenceStatus = item.status === 'VERIFIED_SESSION'
      ? 'Evidence Available'
      : item.status === 'BLOCKED'
        ? 'Blocked'
        : item.status === 'UNKNOWN'
          ? 'Unknown'
          : 'Evidence Missing';
    return Object.freeze({
      id: text(item?.id || ''),
      title: text(item?.title || ''),
      category: text(item?.category || ''),
      scope: text(item?.scope || ''),
      required: Boolean(item?.required),
      sourceType: text(item?.sourceType || ''),
      sourceRefs,
      relatedDrawings,
      relatedSpecifications,
      relatedIssues,
      relatedChecklistItems,
      notes: text(item?.notes || ''),
      description: text(item?.description || ''),
      blockedBy: list(item?.blockedBy).map(value => text(value)).filter(Boolean),
      evidenceStatus,
      status: text(item?.status || ''),
      verificationState: text(item?.verificationState || ''),
      sourceLabel: sourceRefs[0]?.label || sourceRefs[0]?.title || sourceRefs[0]?.documentId || ''
    });
  });
}

function selectDefaultRequirementId(requirements = []) {
  return requirements.find(item => item.status === 'BLOCKED' && item.relatedSpecifications.length)?.id
    || requirements.find(item => item.relatedSpecifications.length)?.id
    || requirements[0]?.id
    || '';
}

function compareWorkspaceModels(leftContext = null, rightContext = null) {
  const dimensions = [
    compareIdentity(leftContext?.workspace, rightContext?.workspace),
    compareSourceSheets(leftContext?.workspace, rightContext?.workspace),
    compareSpecifications(leftContext?.workspace, rightContext?.workspace),
    compareRelatedRooms(leftContext?.workspace, rightContext?.workspace),
    compareIssues(leftContext?.workspace, rightContext?.workspace, leftContext?.issuesModel, rightContext?.issuesModel),
    compareChecklist(leftContext?.workspace, rightContext?.workspace, leftContext?.checklistModel, rightContext?.checklistModel),
    compareTimeline(leftContext?.workspace, rightContext?.workspace, leftContext?.timelineModel, rightContext?.timelineModel),
    comparePmisContext(leftContext?.workspace, rightContext?.workspace, leftContext?.projectMilestoneContext, rightContext?.projectMilestoneContext)
  ];
  const summary = Object.freeze({
    shared: dimensions.reduce((total, dimension) => total + Number(dimension.counts?.shared || 0), 0),
    different: dimensions.reduce((total, dimension) => total + Number(dimension.counts?.different || 0), 0),
    leftOnly: dimensions.reduce((total, dimension) => total + Number(dimension.counts?.leftOnly || 0), 0),
    rightOnly: dimensions.reduce((total, dimension) => total + Number(dimension.counts?.rightOnly || 0), 0),
    dimensions: dimensions.length
  });
  return Object.freeze({
    mode: WORKSPACE_COMPARISON_MODES.WORKSPACE,
    left: leftContext,
    right: rightContext,
    dimensions,
    summary,
    selectedDimensionId: dimensions[0]?.id || 'identity'
  });
}

function buildRequirementVsEvidenceModel(leftContext = null) {
  const requirements = buildRequirementRows(leftContext?.checklistModel?.items || []);
  const summary = Object.freeze({
    requirements: requirements.length,
    evidenceAvailable: requirements.filter(item => item.evidenceStatus === 'Evidence Available').length,
    evidenceMissing: requirements.filter(item => item.evidenceStatus === 'Evidence Missing').length,
    blocked: requirements.filter(item => item.evidenceStatus === 'Blocked').length,
    unknown: requirements.filter(item => item.evidenceStatus === 'Unknown').length,
    sessionVerified: requirements.filter(item => item.status === 'VERIFIED_SESSION').length
  });
  return Object.freeze({
    mode: WORKSPACE_COMPARISON_MODES.REQUIREMENT,
    left: leftContext,
    right: null,
    requirements,
    summary,
    selectedRequirementId: selectDefaultRequirementId(requirements)
  });
}

export function buildWorkspaceComparisonsModel({
  mode = WORKSPACE_COMPARISON_MODES.WORKSPACE,
  leftWorkspaceId = '',
  rightWorkspaceId = '',
  selectedDimensionId = '',
  selectedRequirementId = '',
  pmisRuntime = null
} = {}) {
  const leftContext = buildWorkspaceContext(leftWorkspaceId, pmisRuntime);
  const comparisonMode = text(mode) === WORKSPACE_COMPARISON_MODES.REQUIREMENT
    ? WORKSPACE_COMPARISON_MODES.REQUIREMENT
    : WORKSPACE_COMPARISON_MODES.WORKSPACE;
  if (comparisonMode === WORKSPACE_COMPARISON_MODES.REQUIREMENT) {
    const model = buildRequirementVsEvidenceModel(leftContext);
    const requirementId = model.requirements.some(item => item.id === text(selectedRequirementId))
      ? text(selectedRequirementId)
      : model.selectedRequirementId;
    return Object.freeze({
      ...model,
      leftWorkspaceId: leftContext.workspaceId,
      rightWorkspaceId: '',
      selectedRequirementId: requirementId,
      leftWorkspace: leftContext.workspace,
      leftContext
    });
  }

  const resolvedRightWorkspaceId = resolveWorkspaceComparisonRightWorkspaceId(leftContext.workspaceId, rightWorkspaceId);
  const rightContext = buildWorkspaceContext(resolvedRightWorkspaceId, pmisRuntime);
  const model = compareWorkspaceModels(leftContext, rightContext);
  const dimensionId = model.dimensions.some(item => item.id === text(selectedDimensionId))
    ? text(selectedDimensionId)
    : model.selectedDimensionId;
  return Object.freeze({
    ...model,
    leftWorkspaceId: leftContext.workspaceId,
    rightWorkspaceId: rightContext.workspaceId,
    selectedDimensionId: dimensionId,
    leftWorkspace: leftContext.workspace,
    rightWorkspace: rightContext.workspace,
    leftContext,
    rightContext
  });
}
