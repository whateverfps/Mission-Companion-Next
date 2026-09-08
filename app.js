import { engine } from './engine.js';
import { conversationPreview } from './conversations.js';
import { logger, setLifecycle, registerModule, captureError, verifyButtons, runHealthChecks, diagnosticSnapshot, installGlobalHandlers } from './diagnostics.js';
import {
  completeImportQueueItem,
  createImportQueueItem,
  failImportQueueItem
} from './import-queue.js';
import {
  aggregateExtractionVerification,
  verifyExtraction
} from './extraction-verification.js';
import {
  createRetrievalSession
} from './retrieval-session.js';
import {
  actionTargetToSourceTarget,
  answerAnchorId,
  createActionTarget,
  createSourceTarget,
  normalizeActionTargetPayload,
  prepareActionNavigationState,
  resolveRfiNavigationTarget,
  resolveSourceTarget,
  resolveSpecificationNavigationTarget,
  resolveSubmittalNavigationTarget,
  sourceAnchorId,
  sourceNavigationActions,
  sourceNavigationDestination,
  sourceScrollOptions
} from './source-navigation.js';
import {
  buildKnowledgeRelationships,
  buildRelationshipGraph,
  relationshipContext,
  relationshipNavigationTarget
} from './knowledge-relationships.js';
import {
  buildDocumentLineage,
  lineageForDocument,
  lineageNavigationTarget
} from './document-lineage.js';
import {
  buildRevisionMetrics,
  compareRevisions,
  revisionMatchRuleLabel,
  revisionNavigationTarget,
  revisionPairStatus
} from './revision-comparison.js';
import {
  clearInspectionSession,
  createEngineeringContext,
  engineeringContextMetrics,
  engineeringNavigationTarget,
  getInspectionSession,
  startInspectionSession,
  updateInspectionNotes
} from './engineering-context.js';
import {
  clearWorkflowSession,
  createWorkflow,
  getWorkflowSession,
  startWorkflowSession,
  updateWorkflowNotes,
  workflowMetrics,
  workflowNavigationTarget,
  WORKFLOW_TYPES
} from './workflow-engine.js';
import {
  CONTEXT_ACTIVATION_SOURCES,
  contextActivationMetrics,
  createContextActivation,
  createContextClearedEvent
} from './context-activation.js';
import {
  contextBusMetrics,
  createContextBusSnapshot
} from './context-bus.js';
import {
  INSPECTION_RESULTS,
  INSPECTION_STATUSES,
  inspectionContextSeed
} from './inspection-records.js';
import {
  createDemonstrationProjectFixture,
  DEMO_INITIAL_DOCUMENT_ID,
  DEMO_INITIAL_SECTION_ID,
  DEMO_PROJECT_ID,
  DEMO_QUESTIONS,
  validateDemonstrationProject
} from './demo-project.js';
import {
  buildMissionControlModel,
  missionControlResponseModeLabel,
  normalizeStartupExperience,
  resolvePreviousProject,
  separateMissionControlProjects
} from './mission-control.js';
import { drawingSafeMode as configuredDrawingSafeMode } from './drawing-safe-mode.js';

// Plans V2 safe mode is now the permanent drawing runtime.
// Keep the imported value available for diagnostics, but do not route through legacy Plans.
const drawingSafeMode = true;
void configuredDrawingSafeMode;
import { pdfTraceEnabled, tracePdfError, tracePdfStage } from './pdf-trace.js';
import {
  firstText,
  sectionHeadingValue,
  sectionLocationValue,
  sectionNumberKey,
  sectionSourceLabelValue,
  sectionTextValue,
  textValue
} from './data-model.js';
import { openPdfBlob, readPdfPageGraphics, renderPdfPage } from './pdf-source.js';
import { createSpecificationSourceViewer } from './specification-source-viewer.js';
import { openSpecificationDocument, openSpecificationSection } from './authoritative-spec-resolver.js';
import { extractLegendCandidates, matchLegendOccurrences } from './drawing-legends.js';
import { applyObservationVerification, drawingAnalysisRequiresUpgrade, drawingWarningPresentation, DRAWING_ANALYSIS_VERSION, groupDrawingObservations, observationKindLabel, reanalyzeDrawingAnalysis, upgradeDrawingAnalysis } from './drawing-intelligence.js';
import { assertDrawingPageConsistency, calculateDrawingFit, createDrawingRenderIdentity, createDrawingTarget, createPdfPageViewerAnalysis, defaultDrawingViewport, drawingAnnouncementText, drawingFocusTarget, drawingMatchingSetTarget, drawingRenderDecision, drawingResultKeyTarget, drawingReturnAction, drawingWheelZoom, drawingWorkspaceLayout, reconcileDrawingMatchingSheetIds, reconcileDrawingSelection, resolveDrawingTarget } from './drawing-navigation.js';
import { buildPlanQuery, buildPlanQueryScope, createChiefConstructionContext, drawingSearchSummary, planQuerySectionScope, searchDrawingSheets, validateChiefConstructionContext } from './plan-query.js';
import { buildConstructionWorkPackage, currentWorkActivationTarget, inspectionPrefillFromWorkPackage } from './work-package.js';
import { drawingUpgradeKey, loadAuthoritativeDrawingRegistry, reduceStaleDrawingTarget } from './drawing-lifecycle.js';
import { buildChiefDrawingEvidence } from './chief-drawing-evidence.js';
import { buildChiefLocationPresentation, classifyEngineeringNavigationIntent, navigateExactDrawingCommand } from './engineering-locator.js';
import { inspectDrawingRegistryRuntime } from './drawing-registry-diagnostics.js';
import { createDrawingRenderCache, createDrawingViewerEngine, drawingResizeRenderIsCurrent } from './drawing-viewer-engine.js';
import { createDrawingInteractionSession } from './drawing-interaction-session.js';
import { createDrawingContextService } from './drawing-context.js';
import { createDrawingWorkspace } from './drawing-workspace.js';
import { createDrawingCatalog } from './drawing-catalog.js';
import { createDrawingObject, createDrawingObjectDecisionStore, createRoomObject, screenToNormalizedPoint, selectDrawingObject, validNormalizedRegion } from './drawing-object-model.js';
import { hitTestDrawingObjects, nextDrawingObject, objectTypeForObservation, searchDrawingObjects, sharedDrawingObjectContext, updateDrawingObjectSelection } from './drawing-object-interaction.js';
import { applyPageObjectEnrichment, enrichPageConstructionObjects, relatedObjectIdsForSelection } from './drawing-object-enrichment.js';
import { applyDrawingCoverageCorrection, buildDrawingCoverageReview, drawingCoverageCategory, DRAWING_COVERAGE_CATEGORIES } from './drawing-coverage-review.js';
import { createDrawingOverlay, overlayStyle, visibleDrawingOverlays } from './drawing-overlays.js';
import { collectPageSpecificationEvidence } from './drawing-specification-evidence.js';
import { createSpecificationIndex } from './specification-index.js';
import { createDrawingSpecificationLinkService } from './drawing-spec-links.js';
import { adaptDrawingSpecificationLinks, createProjectRelationshipEngine, relationshipContextGroups } from './project-relationship-engine.js';
import { createDrawingViewportContextService, normalizedViewportBounds } from './drawing-viewport-context.js';
import { createDrawingTradeContext, DRAWING_TRADE_CHANNELS } from './drawing-trade-context.js';
import { createDrawingRequirementsResolver } from './drawing-requirements-resolver.js';
import { createProjectObjectRegistry } from './project-object-registry.js';
import { buildConstructionIntelligencePanelModel, loadConstructionIntelligencePanelState, saveConstructionIntelligencePanelState } from './construction-intelligence-panel.js';
import { createPlansController } from './plans-v2/plans-controller.js';
import { BEDFORD_SPECIFICATION_MANUAL_FILE_NAME, BEDFORD_SPECIFICATION_MANUAL_PATH, createSpecificationExplorer, ensureSpecificationKnowledge, indexSpecificationDocuments, populateBedfordDrawingSpecLinks } from './specification-knowledge.js';
import { acquireTrackedResource, clearTrackedResources, markTrackedResourceReused, releaseTrackedResource, replaceTrackedResource, reportTrackedResources, snapshotTrackedResources } from './resource-lifecycle.js';
import { BEDFORD_PROJECT_SPECIFICATION_VOCABULARY, createProjectSpecificationVocabulary } from './project-specification-vocabulary.js';
import { createProjectRelationshipGraph } from './project-relationship-graph.js';
import { preserveProjectObjectMerge, registerProjectObjectRelationships } from './project-object-operations.js';
import { loadDrawingWorkspaceProviders } from './drawing-workspace-providers.js';
import { documentIndexCounts, isDrawingDocument as isDrawingDocumentRole, isSpecificationDocument } from './document-routing.js';
import { createConstructionGraph } from './construction-graph.js';
import { createDrawingActionRouter } from './drawing-action-router.js';
import { auditDrawingActions, controlsFromDrawingRoot } from './drawing-action-audit.js';
import { createChiefDrawingDock } from './chief-drawing-dock.js';
import { answerChiefDrawingContextQuestion, buildChiefDrawingContext, createChiefDrawingContextSynchronizer } from './chief-drawing-context.js';
import { classifyChiefDrawingCommand, resolveChiefDrawingCommand } from './chief-drawing-command-router.js';
import { buildChiefDrawingCards } from './chief-drawing-cards.js';
import { building61DrawingCatalogFor } from './building-61-drawing-catalog.js';
import { generatedDrawingCatalogFor, normalizeGeneratedDrawingCatalog } from './generated-drawing-catalogs.js';
import { getPerformanceDiagnosticsState, markFirstPaint, markHydrated, performanceDiagnosticsEnabled } from './performance-diagnostics.js';
import { createChiefIntelligenceBridge } from './src/chief-intelligence-bridge.js';
import { ProjectStateService } from './src/project-state-service.js';
import { ConstructionReasoningEngine } from './src/construction-reasoning-engine.js';
import { ProjectFactEngine } from './src/project-fact-engine.js';
import { createSpecificationReverseIndex } from './src/specification-reverse-index.js';

installGlobalHandlers();
setLifecycle('loading-ui');

const app = document.querySelector('#app');
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const safeText = textValue;
const preferredText = firstText;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));
const fmt = n => new Intl.NumberFormat().format(n || 0);
const missionPmisDashboardUrl = 'https://whateverfps.github.io/Mission-PMIS/';
const chiefAssets = {
  idle: './src/assets/chief/chief-idle.png',
  busy: './src/assets/chief/chief-concept.png',
  success: './src/assets/chief/chief-smile.png',
  error: './src/assets/chief/chief-idle.png'
};
const chiefStateCopy = {
  idle: {
    label: 'Idle',
    detail: 'Ready to assist'
  },
  busy: {
    label: 'Thinking',
    detail: 'Searching project knowledge…'
  },
  success: {
    label: 'Complete',
    detail: 'Evidence prepared'
  },
  error: {
    label: 'Attention',
    detail: 'Action required'
  }
};

let view = 'chat';
let experience = 'mission-control';
let lastProfessionalView = '';
let missionControlView = 'home';
let missionControlAttachments = [];
let chiefHistoryVisible = false;
let previousUserProjectId = null;
let selectedDoc = null;
let selectedKnowledgeSection = 'all';
let knowledgeCatalogContext = null;
let busy = false;
let importQueue = [];
let activeRetrievalSession = null;
let selectedEvidenceId = null;
let sourceNavigationTarget = null;
let answerNavigationTarget = null;
let sourceNavigationNotice = '';
let relationshipTarget = null;
let lineageTarget = null;
let revisionTarget = null;
let revisionFilter = 'all';
let selectedRevisionMatch = 0;
let engineeringTarget = null;
let workflowTarget = null;
let activeContextActivation = null;
let contextClearedEvent = null;
let contextBusSnapshot = createContextBusSnapshot();
let demoGuideDismissed = false;
let selectedInspectionId = null;
let modalCloseGuard = null;
let drawingTarget = null;
let drawingFilter = '';
let drawingDiscipline = 'all';
let drawingType = 'all';
let drawingSearchActiveIndex = -1;
let drawingZoom = null;
let drawingRotation = 0;
const drawingViewportBySet = new Map();
const drawingViewerEngine = createDrawingViewerEngine({ viewportStore: drawingViewportBySet, onMetric: metric => logger.debug('Drawing viewer performance', metric) });
const drawingRenderCache = createDrawingRenderCache({ maxEntries: 2, onMetric: metric => logger.debug('Drawing viewer performance', metric), onEvict: (canvas, cacheKey) => { if (canvas) { canvas.width = 0; canvas.height = 0; } releaseTrackedResource('canvas', canvas, { cacheKey, reason: 'render-cache-evict' }); } });
const currentDrawingAnalysesCache = new Map();
const drawingPerfNow = () => globalThis.performance?.now?.() ?? Date.now();
const drawingDiagnosticsEnabled = globalThis.__MC_DRAWING_DIAGNOSTICS_ENABLED === true;
const drawingResourceSnapshot = (options = {}) => snapshotTrackedResources({ workspaceRoot: $('#professionalWorkspaceShell') || null, drawingRenderCacheSize: drawingRenderCache.size(), drawingCanvas: $('#mcDrawingCanvas') || null, renderQueueDepth: drawingViewerEngine.renderLifecycle().activeRenderPromiseCount, activeResizeObserverCount: activeDrawingResizeObserver ? 1 : 0, ...drawingViewerEngine.renderLifecycle(), ...options });
const reportDrawingResourceSnapshot = (label, detail = {}, options = {}) => {
  if (!drawingDiagnosticsEnabled) return null;
  return reportTrackedResources(label, detail, { workspaceRoot: $('#professionalWorkspaceShell') || null, drawingRenderCacheSize: drawingRenderCache.size(), drawingCanvas: $('#mcDrawingCanvas') || null, renderQueueDepth: drawingViewerEngine.renderLifecycle().activeRenderPromiseCount, activeResizeObserverCount: activeDrawingResizeObserver ? 1 : 0, ...drawingViewerEngine.renderLifecycle(), ...options });
};
globalThis.__mcDrawingResourceSnapshot = drawingResourceSnapshot;
globalThis.__mcDrawingResourceReport = reportDrawingResourceSnapshot;
const reportDrawingMemorySnapshot = (label, detail = {}, options = {}) => {
  const memory = globalThis.performance?.memory || null;
  const snapshot = {
    ...options,
    usedJSHeapSize: memory?.usedJSHeapSize ?? null,
    totalJSHeapSize: memory?.totalJSHeapSize ?? null,
    jsHeapSizeLimit: memory?.jsHeapSizeLimit ?? null
  };
  logger.debug(label, { ...detail, ...snapshot });
  return reportDrawingResourceSnapshot(label, detail, snapshot);
};
const getOverlayDiagnosticsSnapshot = () => {
  const perfState = getPerformanceDiagnosticsState();
  const resources = drawingResourceSnapshot();
  return {
    enabled: performanceDiagnosticsEnabled(),
    heapUsed: globalThis.performance?.memory?.usedJSHeapSize ?? null,
    heapTotal: globalThis.performance?.memory?.totalJSHeapSize ?? null,
    pdfDocuments: resources.counts.activePdfDocuments,
    pdfPages: resources.counts.activePdfPages,
    renderTasks: resources.counts.activeRenderTasks || resources.renderLifecycle?.activeRenderTaskCount || 0,
    renderPromises: resources.counts.renderQueueDepth,
    canvases: resources.counts.canvasCount,
    imageBitmaps: resources.counts.imageBitmapCount,
    drawingAnalysisCache: currentDrawingAnalysesCache.size,
    specificationCache: typeof specificationIndex?.sections === 'function' ? specificationIndex.sections({ projectId: state().activeProject }).length : 0,
    overlayCache: drawingOverlayNodeCacheCount,
    renderQueueDepth: resources.counts.renderQueueDepth,
    currentSheet: drawingTarget?.pageNumber || 0,
    firstPaintAt: perfState.firstPaintAt,
    hydratedAt: perfState.hydratedAt,
    stageCount: perfState.stages.length,
    heapHistory: perfState.heap,
    timingHistory: perfState.stages
  };
};
globalThis.__mcPerformanceDiagnostics = globalThis.__mcPerformanceDiagnostics || {};
globalThis.__mcPerformanceDiagnostics.snapshot = getOverlayDiagnosticsSnapshot;
globalThis.__mcPerformanceDiagnostics.export = () => {
  const perfState = getPerformanceDiagnosticsState();
  return {
    heapHistory: perfState.heap,
    timingHistory: perfState.stages,
    cacheSizes: {
      drawingAnalysisCache: currentDrawingAnalysesCache.size,
      specificationCache: typeof specificationIndex?.sections === 'function' ? specificationIndex.sections({ projectId: state().activeProject }).length : 0,
      overlayCache: drawingOverlayNodeCacheCount,
      drawingRenderCache: drawingRenderCache.size(),
      drawingRequirementsResultCache: drawingRequirementsResultCache.size
    },
    currentCounters: drawingResourceSnapshot().counts,
    browser: {
      userAgent: navigator.userAgent,
      platform: navigator.platform || '',
      language: navigator.language || '',
      url: location.href,
      time: new Date().toISOString()
    }
  };
};
const drawingTraceSlowOperation = (name, startedAt, details = {}) => {
  if (!drawingDiagnosticsEnabled) return Math.max(0, drawingPerfNow() - startedAt);
  const elapsed = Math.max(0, drawingPerfNow() - startedAt);
  if (elapsed > 10) console.warn(name, elapsed, { ...details, stack: new Error().stack });
  return elapsed;
};
if (drawingDiagnosticsEnabled && globalThis.PerformanceObserver && globalThis.PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
  const drawingLongTaskObserver = new PerformanceObserver(entries => {
    if (!drawingDiagnosticsEnabled) return;
    const stack = new Error().stack;
    for (const entry of entries.getEntries()) console.warn('long-task', Math.max(0, entry.duration), { startTime: Math.max(0, entry.startTime), stack });
  });
  drawingLongTaskObserver.observe({ entryTypes: ['longtask'] });
}
const specificationSourceViewer = createSpecificationSourceViewer({ openPdf: openPdfBlob, renderPage: renderPdfPage, onDiagnostic: metric => logger.debug('Specification source viewer lifecycle', metric) });
const drawingCatalog = createDrawingCatalog({ onDifference: difference => logger.warning('Drawing catalog parser difference', difference), onDiagnostics: diagnostics => logger.debug('Drawing catalog diagnostics', diagnostics) });
const drawingContextService = createDrawingContextService();
const drawingWorkspace = createDrawingWorkspace({ viewerEngine: drawingViewerEngine, contextService: drawingContextService });
const drawingObjectDecisions = createDrawingObjectDecisionStore();
const specificationIndex = createSpecificationIndex();
const drawingSpecificationLinks = createDrawingSpecificationLinkService({ index: specificationIndex, persistence: engine.drawingSpecificationLinkPersistence(), onDiagnostic: metric => logger.debug('Drawing specification link persistence', metric) });
const projectRelationshipEngine = createProjectRelationshipEngine();
const projectObjectRegistry = createProjectObjectRegistry({ persistence: engine.projectObjectPersistence(), onDiagnostic: metric => logger.debug('Project object registry performance', metric) });
const specificationReverseIndex = createSpecificationReverseIndex({ drawingSpecificationLinks, projectObjectRegistry });
const bedfordRelationshipGraph = createProjectRelationshipGraph({
  projectId: state().activeProject,
  specificationIndex,
  drawingSpecificationLinks,
  projectRelationshipEngine,
  projectObjectRegistry,
  onDiagnostic: metric => logger.debug('Bedford relationship graph performance', metric)
});
globalThis.__bedfordGraph = bedfordRelationshipGraph;
const specificationExplorer = createSpecificationExplorer({
  specificationIndex,
  relationshipGraph: bedfordRelationshipGraph
});
globalThis.__specificationExplorer = specificationExplorer;
const constructionGraph = createConstructionGraph({ persistence: engine.constructionGraphPersistence(), relationshipEngine: projectRelationshipEngine, objectRegistry: projectObjectRegistry, onDiagnostic: metric => logger.debug('Construction graph performance', metric) });

// Initialize Mission Companion intelligence engines
const projectStateService = new ProjectStateService();
projectStateService.initializeDefaultStates();

const factEngine = new ProjectFactEngine();
factEngine.initialize(constructionGraph, projectRelationshipEngine);

const reasoningEngine = new ConstructionReasoningEngine();
reasoningEngine.initialize(constructionGraph, factEngine, projectRelationshipEngine, null);

const chiefIntelligenceBridge = createChiefIntelligenceBridge();
chiefIntelligenceBridge.initialize(constructionGraph, factEngine, projectRelationshipEngine, reasoningEngine, projectStateService);

globalThis.__projectStateService = projectStateService;
globalThis.__factEngine = factEngine;
globalThis.__reasoningEngine = reasoningEngine;
globalThis.__chiefIntelligenceBridge = chiefIntelligenceBridge;
globalThis.__specificationReverseIndex = specificationReverseIndex;

const scheduleIdleWork = callback => {
  if (typeof globalThis.requestIdleCallback === 'function') return globalThis.requestIdleCallback(callback, { timeout: 1000 });
  return setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 0);
};
const cancelIdleWork = handle => {
  if (!handle) return;
  if (typeof globalThis.cancelIdleCallback === 'function') globalThis.cancelIdleCallback(handle);
  else clearTimeout(handle);
};
let drawingRelationshipGraphSyncHandle = 0;
let drawingRelationshipGraphSyncKey = '';
const drawingRelationshipGraphSummaryCache = new Map();
const chiefDrawingDock=createChiefDrawingDock({storage:globalThis.localStorage,onChange:value=>logger.debug('Chief drawing dock',value)});
let activeChiefDrawingContext=null;
const chiefDrawingContextSynchronizer=createChiefDrawingContextSynchronizer({onCommit:(context,diagnostics)=>{activeChiefDrawingContext=context;logger.debug('Chief drawing context',{...diagnostics,pageId:context.identity.pageId,generation:context.freshness.generation});}});
const drawingActionRouter=createDrawingActionRouter({handlers:{
  'ask-chief':()=>{chiefDrawingDock.open();return true;},
  'open-object':target=>{const stored=projectObjectRegistry.getObject(target.objectId),object=activeDrawingObjects.find(item=>item.objectId===target.objectId)||stored&&projectObjectPresentation(stored);if(!object)throw Error('Drawing item is unavailable.');const owningSheet=activeDrawingViewerAnalysis?.sheets?.find(item=>item.pageId===(object.pageId||object.drawingPageId));selectedDrawingObject=object;selectedDrawingObjectIds=[object.objectId];drawingTarget=createDrawingTarget({...drawingTarget,pageNumber:owningSheet?.pageNumber||drawingTarget?.pageNumber,region:object.region,observationId:object.sourceObservationIds?.[0]||''});return renderDrawingWorkspace(experience==='mission-control'?'mission-control':'professional');},
  'clear-selection':()=>{selectedDrawingObject=null;selectedDrawingObjectIds=[];return renderDrawingWorkspace(experience==='mission-control'?'mission-control':'professional');},
  'previous-page':()=>document.querySelector('[data-drawing-previous]')?.click(),'next-page':()=>document.querySelector('[data-drawing-next]')?.click(),
  'previous-object':()=>document.querySelector('[data-drawing-object-nav="previous"]')?.click(),'next-object':()=>document.querySelector('[data-drawing-object-nav="next"]')?.click(),'next-room':()=>document.querySelector('[data-drawing-object-nav="room"]')?.click(),'next-equipment':()=>document.querySelector('[data-drawing-object-nav="equipment"]')?.click(),'next-finish':()=>document.querySelector('[data-drawing-object-nav="finish"]')?.click(),
  'center-object':()=>document.querySelector('[data-drawing-object-center]')?.click(),'zoom-object':()=>document.querySelector('[data-drawing-object-location]')?.click(),
  'highlight-related':target=>{selectedDrawingObjectIds=target.objectIds.filter(id=>activeDrawingObjects.some(item=>item.objectId===id));selectedDrawingObject=activeDrawingObjects.find(item=>item.objectId===selectedDrawingObjectIds.at(-1))||null;return renderDrawingWorkspace(experience==='mission-control'?'mission-control':'professional');},
  'fit-page':()=>document.querySelector('[data-drawing-fit="page"]')?.click(),'fit-width':()=>document.querySelector('[data-drawing-fit="width"]')?.click(),'rotate-clockwise':()=>document.querySelector('[data-drawing-rotate]')?.click(),'reset-view':()=>document.querySelector('[data-drawing-reset-view]')?.click(),
  'open-drawing-page':target=>{drawingTarget=createDrawingTarget({...drawingTarget,documentId:target.documentId,pageNumber:target.pageNumber,sheetNumber:target.sheetNumber});return renderDrawingWorkspace(experience==='mission-control'?'mission-control':'professional');},
  'open-specification-section':target=>{specificationDrawingReturnTarget=captureDrawingSupportReturnState();return openProfessionalDestination({view:'knowledge',documentId:target.documentId,sectionNumber:target.sectionNumber});},
  'open-specification-explorer':target=>{const currentSheetNumber=drawingTarget?.sheetNumber||activeDrawingViewerAnalysis?.sheets?.find(item=>item.pageId===drawingTarget?.pageId)?.sheetNumber;if(!currentSheetNumber){alert('No active sheet');return true;}const currentSheet=activeDrawingViewerAnalysis?.sheets?.find(item=>item.sheetNumber===currentSheetNumber)||{sheetNumber:currentSheetNumber,sheetTitle:'Unknown',discipline:'Unknown'};openSpecificationExplorer();return true;},
  'return-to-drawing':()=>restoreDrawingSupportReturnState(),
  'open-coverage-review':()=>{drawingCoverageReviewMode=true;return renderDrawingWorkspace(experience==='mission-control'?'mission-control':'professional');},
  'close-coverage-review':()=>{drawingCoverageReviewMode=false;return renderDrawingWorkspace(experience==='mission-control'?'mission-control':'professional');}
},getContext:()=>({pageId:activeDrawingViewerAnalysis?.sheets?.find(item=>Number(item.pageNumber)===Number(drawingTarget?.pageNumber))?.pageId||'',objectIds:activeDrawingObjects.map(item=>item.objectId)}),onDiagnostic:metric=>logger.debug('Drawing action',metric)});
const projectSpecificationVocabulary = createProjectSpecificationVocabulary({ specificationIndex, onDiagnostic: metric => logger.debug('Drawing requirement vocabulary', metric) });
const hydratedDrawingSpecificationDocuments = new Set();
const drawingViewportContextService = createDrawingViewportContextService({ onChange: context => logger.debug('Drawing viewport context updated', { pageId: context.pageId, source: context.source }) });
const drawingTradeContext = createDrawingTradeContext();
const drawingRequirementsResolver = createDrawingRequirementsResolver({ specificationIndex, relationshipEngine: projectRelationshipEngine, onMetric: metric => logger.debug('Drawing requirements performance', metric) });
const drawingInteractionSession = createDrawingInteractionSession({
  settleMs: 200,
  onSettle: () => {
    captureDrawingViewport({ contextSource: 'interaction-settle' });
    const { stage, sheet, observation, overlayRecords } = drawingInteractionSession.context() || {};
    if (stage && sheet) {
      updateDrawingOverlays(stage, sheet, observation || null, overlayRecords || []);
    }
  }
});

function applyDrawingInteractionViewport(stage, zoom, rotation = drawingRotation) {
  if (!stage) return;
  const canvas = stage.querySelector('#mcDrawingCanvas');
  const layer = stage.querySelector('.mc-drawing-overlay-layer');
  const scale = Number(zoom) || 1;
  const transform = `scale(${scale}) rotate(${Number(rotation) || 0}deg)`;
  for (const element of [canvas, layer]) {
    if (!element) continue;
    element.style.transformOrigin = '0 0';
    element.style.transform = transform;
    element.style.willChange = 'transform';
  }
}

let activeDrawingObjects = [];
let activeDrawingTransientRequirementCount = 0;
let selectedDrawingObject = null;
let selectedDrawingObjectIds = [];
let hoveredDrawingObjectId = '';
let drawingObjectSearchActiveIndex = -1;
let drawingObjectChoices = [];
let drawingLocationReturnViewport = null;
let drawingRegionSelectionMode = false;
let drawingObjectRegionAdjustmentId = '';
let drawingCoverageReviewMode = false;
let drawingCoverageReviewFilter = 'all';
let drawingCoverageRegionItemId = '';
let activeDrawingCoverageReview = null;
let drawingCoverageReviewGeneration = 0;
let drawingViewportDocumentId = '';
let activeDrawingPdf = null;
let activeDrawingDocumentId = '';
let activeDrawingSourceRecord = null;
let activeDrawingRenderIdentity = null;
let drawingWorkspaceRenderRequest = 0;
let drawingWorkspaceRenderCount = 0;
let drawingInspectorRenderCount = 0;
let drawingPdfRenderCount = 0;
let drawingOverlayRenderCount = 0;
let drawingSpecificationResolveCount = 0;
let drawingPageSelectionRequest = 0;
let drawingPagePaintRequest = 0;
let drawingPageRenderFailureKeys = new Set();
let drawingRequirementsRequestGeneration = 0;
let drawingRequirementsRequestKey = '';
let drawingRequirementsRefreshTimer = null;
let drawingBackgroundPipelineGeneration = 0;
let drawingBackgroundPipelineTimer = 0;
const drawingRequirementsResultCache = new Map();
const drawingRequirementsResultCacheMaxEntries = 8;
let drawingWheelPaintFrame = 0;
let drawingPanelRefreshRequest = 0;
let drawingDeferredWorkspaceRefresh = null;
let drawingSearchRefreshTimer = 0;
let drawingSelectionActiveSheetId = '';
let drawingRecentSheets = [];
let activeDrawingInspectorPanel = null;
let activeDrawingInspectorPanelSheetId = '';
let activePlansInspectorPanel = null;
let activePlansInspectorSheetId = '';
let activePlansInspectorGeneration = 0;
let activePlansInspectorContext = null;
let plansV2Controller = null;
const drawingOverlayNodeCache = new WeakMap();
let drawingOverlayNodeCacheCount = 0;
const drawingInteractionTrace = globalThis.__mcDrawingInteractionTrace || (globalThis.__mcDrawingInteractionTrace = { id: 0, kind: '', counts: Object.create(null) });

function startDrawingInteractionTrace(kind, detail = {}) {
  if (!drawingDiagnosticsEnabled) return 0;
  drawingInteractionTrace.id += 1;
  drawingInteractionTrace.kind = kind;
  drawingInteractionTrace.counts = Object.create(null);
  console.warn('drawing interaction start', { interactionId: drawingInteractionTrace.id, kind, ...detail, stack: new Error().stack });
  return drawingInteractionTrace.id;
}

function traceDrawingInteractionStep(step, detail = {}) {
  if (!drawingDiagnosticsEnabled || !drawingInteractionTrace.id) return 0;
  const counts = drawingInteractionTrace.counts;
  const nextCount = (counts[step] || 0) + 1;
  counts[step] = nextCount;
  console.warn('drawing interaction step', { interactionId: drawingInteractionTrace.id, kind: drawingInteractionTrace.kind, step, count: nextCount, ...detail, stack: new Error().stack });
  return nextCount;
}

function cancelDrawingBackgroundPipeline() {
  drawingBackgroundPipelineGeneration += 1;
  if (drawingBackgroundPipelineTimer) {
    clearTimeout(drawingBackgroundPipelineTimer);
    drawingBackgroundPipelineTimer = 0;
  }
}

function scheduleDrawingHydration({ generationId, sheetId, projectId, shell, workspaceRenderRequest, selected, sheet, analysis, source, documentId, requestToken, effectiveObservation, effectiveRegion, overlayRecords, preservedBrowserScroll, preservedViewport, preservedCanvas, preservedStage, preservedIntelligenceScroll, viewState, sheetLegends, sheetSchedules, sheetKeyedNotes, sheetOccurrences, pageSpecificationLinks, selectedSpecificationLinks, requirementInput, activeRequirements, rightPanelSignature, inspectorContext = null, renderAfterPaint = true, activeTrade = null, pageContext = null, observations = [], activeDrawingObjects = [], selectedDrawingObject = null, selectedDrawingObjectIds = [], activeRelationshipContext = null } = {}) {
  const generation = drawingBackgroundPipelineGeneration;
  const plansSpecOnly = shouldHydratePlansSpecifications({ drawingSafeMode, workspaceMode: shell });
  const plansV2Active = shell === 'mission-control' && isPlansV2Enabled();
  const plansContext = inspectorContext || (shell === 'mission-control' ? getActivePlansSheetContext({ analysis, sheet, generationId, shell, panel: activePlansInspectorPanel }) : null);
  
  // Local helper to build intelligence panel model
  const buildIntelligencePanel = (requirements, selectedDoc, currentSheetObj, activeTradeValue, activeDrawingObjects, pageContext, sheetSchedules, sheetLegends, sheetKeyedNotes, observations, sheetSpecificationLinks, selectedSpecificationLinks, selectedDrawingObject, selectedDrawingObjectIds, activeRelationshipContext) => {
    const relationshipContext = activeRelationshipContext || {
      groups: [],
      sourceEntityId: null,
      graphSummary: null
    };
    return buildConstructionIntelligencePanelModel({
      document: selectedDoc, sheet: currentSheetObj, trade: activeTradeValue, selectedObject: selectedDrawingObject, pageObjects: activeDrawingObjects,
      pageStatus: analysis?.viewerFallback && !analysis?.metadataAvailable ? 'Manual PDF page viewing remains available.' : currentSheetObj?.identityStatus,
      pageNotes: pageContext?.drawingNotes || [], schedules: sheetSchedules, legends: sheetLegends, keyedNotes: sheetKeyedNotes, references: analysis?.references || [], relatedDetails: observations.filter(item => /detail|callout/i.test(item.kind)), unresolvedEvidence: sheetSpecificationLinks.filter(item => item.status !== 'confirmed'), relationshipGroups: relationshipContext.groups,
      requirements: requirements || { status: 'unresolved', requirements: [], confirmedSpecifications: [], suggestedSpecifications: [], projectWideRequirements: [], fieldRequirements: {}, warnings: [], providerFailures: [] },
      specifications: sheetSpecificationLinks.filter(item => item.status !== 'rejected'),
      objectSpecifications: selectedDrawingObject ? selectedSpecificationLinks.filter(item => item.objectId === selectedDrawingObject.objectId) : [],
      multiSelection: sharedDrawingObjectContext(activeDrawingObjects.filter(item=>selectedDrawingObjectIds.includes(item.objectId)), { specificationLinks:selectedSpecificationLinks })
    });
  };
  if (drawingBackgroundPipelineTimer) clearTimeout(drawingBackgroundPipelineTimer);
  drawingBackgroundPipelineTimer = setTimeout(() => {
    drawingBackgroundPipelineTimer = 0;
    if (generation !== drawingBackgroundPipelineGeneration) return;
    if (generationId !== drawingBackgroundPipelineGeneration) return;
    if (workspaceRenderRequest !== drawingWorkspaceRenderRequest) return;
    const expectedSheetId = plansContext?.sheetId || sheetId || sheet?.sheetId || '';
    const expectedGenerationId = plansContext?.generationId || generationId || activePlansInspectorGeneration;
    const expectedDocumentId = plansContext?.documentId || documentId || selected?.id || '';
    if (sheet?.sheetId && expectedSheetId && sheet.sheetId !== expectedSheetId) return;
    if (projectId && analysis?.projectId && analysis.projectId !== projectId) return;
    if (plansContext && !plansInspectorOwnershipValid({ panel: plansContext.panel || activePlansInspectorPanel, sheetId: expectedSheetId, generationId: expectedGenerationId, shell })) return;
    const stage = $('#mcDrawingStage');
    if (!stage || !stage.isConnected) return;
    if (!plansSpecOnly) {
      const overlayStartedAt = drawingPerfNow();
      updateDrawingOverlays(stage, sheet, effectiveObservation || null, overlayRecords || []);
      reportDrawingMemorySnapshot('stage', { phase: 'overlay-generation', pageNumber: sheet.pageNumber, overlayCount: overlayRecords.length, elapsedMs: Math.max(0, drawingPerfNow() - overlayStartedAt) });
    }
    const requirementsRequestKey = drawingRequirementsCacheKey({ projectId: plansContext?.projectId || analysis?.projectId || selected.projectId || state().activeProject, documentId: plansContext?.documentId || selected.id, drawingSetId: plansContext?.drawingSetId || analysis?.drawingSetId || '', pageId: plansContext?.pageId || drawingTarget?.pageId || sheet?.pageId || '', selectedObjectId: selectedDrawingObject?.objectId || '', evidenceVersion: [sheetLegends.length, sheetSchedules.length, sheetKeyedNotes.length, sheetOccurrences.length, pageSpecificationLinks.length, selectedSpecificationLinks.length].join('|') });
    const requirementsRequestGeneration = ++drawingRequirementsRequestGeneration;
    drawingRequirementsRequestKey = requirementsRequestKey;
    const finish = resolvedRequirements => {
      if (generation !== drawingBackgroundPipelineGeneration) return;
      if (workspaceRenderRequest !== drawingWorkspaceRenderRequest) return;
      if (expectedDocumentId && plansContext?.documentId && expectedDocumentId !== plansContext.documentId) return;
      if (plansContext?.sheetId && expectedSheetId && plansContext.sheetId !== expectedSheetId) return;
      const livePlansPanel = shell === 'mission-control' ? document.querySelector('#missionPlansSheetInspector') : null;
      const panel = shell === 'mission-control'
        ? (livePlansPanel && livePlansPanel.isConnected ? livePlansPanel : activePlansInspectorPanel)
        : activeDrawingInspectorPanel;
      const ownershipValid = shell === 'mission-control'
        ? plansInspectorOwnershipValid({ panel, sheetId: expectedSheetId, generationId: expectedGenerationId, shell })
        : Boolean(panel && panel.isConnected && activeDrawingInspectorPanelSheetId === (sheet?.sheetId || sheetId || ''));
      if (!ownershipValid) return;
      if (resolvedRequirements) {
        replaceTrackedResource('requirement-model', resolvedRequirements, { pageId: sheet?.pageId || '', status: resolvedRequirements.status });
        
        // Store specification results by pageId for preservation across navigation
        if (sheet?.pageId && (resolvedRequirements.confirmedSpecifications?.length > 0 || resolvedRequirements.suggestedSpecifications?.length > 0)) {
          pageRequirementState.set(sheet.pageId, {
            confirmedSpecifications: resolvedRequirements.confirmedSpecifications,
            suggestedSpecifications: resolvedRequirements.suggestedSpecifications,
            requirements: resolvedRequirements.requirements,
            status: resolvedRequirements.status,
            timestamp: Date.now()
          });
        }
        
        const panelModel = buildIntelligencePanel(resolvedRequirements, selected, sheet, activeTrade, activeDrawingObjects, pageContext, sheetSchedules, sheetLegends, sheetKeyedNotes, observations, pageSpecificationLinks, selectedSpecificationLinks, selectedDrawingObject, selectedDrawingObjectIds, activeRelationshipContext);
        replaceTrackedResource('inspector-model', panelModel, { pageId: sheet?.pageId || '', mode: panelModel.mode, phase: 'updated' });
        if (!plansV2Active) {
          if (panel !== activePlansInspectorPanel) activePlansInspectorPanel = panel;
          panel.dataset.panelSignature = constructionIntelligencePanelSignature(panelModel);
          panel.innerHTML = constructionIntelligencePanelMarkup(panelModel);
        }
      }
      if (renderAfterPaint) markHydrated();
    };
    const cached = drawingRequirementsResultCache.get(requirementsRequestKey);
    if (cached) { finish(cached); return; }
    void drawingRequirementsResolver.resolveLatest(requirementInput).then(outcome => {
      if (!outcome.committed || requirementsRequestGeneration !== drawingRequirementsRequestGeneration || drawingRequirementsRequestKey !== requirementsRequestKey) return;
      const resolved = outcome.result;
      drawingRequirementsResultCache.set(requirementsRequestKey, structuredClone(resolved));
      while (drawingRequirementsResultCache.size > drawingRequirementsResultCacheMaxEntries) {
        const oldestKey = drawingRequirementsResultCache.keys().next().value;
        drawingRequirementsResultCache.delete(oldestKey);
      }
      finish(resolved);
    }).catch(error => logger.warning('Drawing requirements resolver failure', { message: error?.message || String(error), pageId: sheet?.pageId || '', contained: true }));
  }, 0);
}
let drawingRenderGeneration = 0;
let portableDrawingCanvas = null;
let activeDrawingViewerAnalysis = null;
let activeDrawingResizeObserver = null;
let activeDrawingResizeStage = null;
let activePlanQuery = null;
let activeWorkPackage = null;
let activeWorkPackageMessageId = '';
let chiefConstructionContext = null;
let drawingMatchingSheetIds = [];
let selectedWorkPackageItem = '';
let pendingDrawingContext = null;
let drawingSearchRevision = 0;
const drawingUpgradeWork = new Map();
const drawingUpgradeFailures = new Set();
let drawingLifecycleUnavailable = [];
let drawingWorkspacePanels = drawingWorkspaceLayout();
let drawingWorkspaceBeforeExpand = null;
let activeChiefLocationPresentation = null;
let loadedProjectObjectRegistryId = '';
const drawingIntelligenceHydration = new Map();
let specificationDrawingReturnTarget = null;
let pendingDrawingPanelScroll = null;
let constructionIntelligenceExpanded = new Set(loadConstructionIntelligencePanelState().expanded);

// Store specification results by pageId to preserve across navigation
const pageRequirementState = new Map();
const constructionIntelligenceScroll = { page: 0, object: 0 };
let specificationSourceRequestId = 0;
const RenderState = Object.freeze({
  IDLE: 'IDLE',
  LOADING_DOCUMENT: 'LOADING_DOCUMENT',
  LOADING_PAGE: 'LOADING_PAGE',
  VIEWPORT_READY: 'VIEWPORT_READY',
  CANVAS_CREATED: 'CANVAS_CREATED',
  RENDER_STARTED: 'RENDER_STARTED',
  RENDER_COMPLETED: 'RENDER_COMPLETED',
  CANVAS_PRESENTED: 'CANVAS_PRESENTED',
  FAILED: 'FAILED'
});
const DrawingRenderedEvent = 'DrawingRendered';
const MAX_RENDER_PIXELS = 4194304;
const MAX_CANVAS_WIDTH = 4096;
const MAX_CANVAS_HEIGHT = 4096;
const MAX_OUTPUT_SCALE = 2;
const drawingRenderedEventTarget = new EventTarget();
const drawingDebugPanelEnabled = (() => {
  try {
    return new URL(globalThis.location?.href || 'http://localhost/').searchParams.get('drawingDebug') === '1';
  } catch {
    return false;
  }
})();
let drawingBackgroundSubscriberDepth = 0;

function assertDrawingRendererOwnership(operation) {
  if (globalThis.__MC_DEV_ASSERTIONS__ && drawingBackgroundSubscriberDepth > 0) {
    throw new Error(`Background drawing subscriber cannot ${operation}.`);
  }
}

function emitDrawingRendered(detail = {}) {
  drawingRenderedEventTarget.dispatchEvent(new CustomEvent(DrawingRenderedEvent, { detail }));
}

function plansInspectorHost() {
  return $('#missionPlansSheetInspector');
}

function normalizePlansInspectorContext(detail = {}) {
  return Object.freeze({
    projectId: detail.projectId || '',
    drawingSetId: detail.drawingSetId || '',
    documentId: detail.documentId || '',
    drawingId: detail.drawingId || '',
    pageId: detail.pageId || '',
    sheetId: detail.sheetId || '',
    sheetNumber: detail.sheet?.sheetNumber || detail.sheetNumber || '',
    sheetTitle: detail.sheet?.sheetTitle || detail.sheetTitle || '',
    discipline: detail.sheet?.discipline || detail.discipline || '',
    drawingType: detail.sheet?.drawingType || detail.drawingType || detail.sheet?.primarySheetType || detail.primarySheetType || '',
    pageNumber: Number(detail.sheet?.pageNumber || detail.pageNumber || detail.pdfPage) || 0,
    pdfPage: Number(detail.sheet?.pageNumber || detail.pdfPage || detail.pageNumber) || 0,
    generationId: Number(detail.generationId) || 0,
    shell: detail.shell || '',
    panel: detail.panel || null
  });
}

function getActivePlansSheetContext(overrides = {}) {
  const analysis = overrides.analysis || activeDrawingViewerAnalysis || null;
  const target = overrides.target || drawingTarget || {};
  const sheet = overrides.sheet
    || analysis?.sheets?.find(item => item.sheetId === target.sheetId)
    || analysis?.sheets?.find(item => Number(item.pageNumber) === Number(target.pageNumber))
    || null;
  return normalizePlansInspectorContext({
    ...overrides,
    projectId: overrides.projectId || analysis?.projectId || state().activeProject || '',
    drawingSetId: overrides.drawingSetId || analysis?.drawingSetId || '',
    documentId: overrides.documentId || target.documentId || analysis?.documentId || '',
    drawingId: overrides.drawingId || target.drawingId || sheet?.drawingId || '',
    pageId: overrides.pageId || target.pageId || sheet?.pageId || '',
    sheetId: overrides.sheetId || sheet?.sheetId || target.sheetId || '',
    sheetNumber: overrides.sheetNumber || sheet?.sheetNumber || '',
    sheetTitle: overrides.sheetTitle || sheet?.sheetTitle || '',
    discipline: overrides.discipline || sheet?.discipline || '',
    drawingType: overrides.drawingType || sheet?.drawingType || sheet?.primarySheetType || '',
    pageNumber: overrides.pageNumber || sheet?.pageNumber || target.pageNumber || 0,
    pdfPage: overrides.pdfPage || sheet?.pageNumber || target.pageNumber || 0,
    sheet,
    generationId: overrides.generationId ?? drawingWorkspaceRenderRequest,
    shell: overrides.shell || 'mission-control',
    panel: overrides.panel || null
  });
}

function updatePlansInspectorOwnership(context = {}) {
  const nextContext = getActivePlansSheetContext(context);
  activePlansInspectorContext = nextContext;
  activePlansInspectorGeneration = nextContext.generationId;
  activePlansInspectorSheetId = nextContext.sheetId;
  activePlansInspectorPanel = nextContext.panel;
  return nextContext;
}

function plansInspectorOwnershipValid({ panel, sheetId, generationId, shell } = {}) {
  return Boolean(
    shell === 'mission-control' &&
    panel === activePlansInspectorPanel &&
    panel?.isConnected &&
    sheetId === activePlansInspectorSheetId &&
    Number(generationId) === Number(activePlansInspectorGeneration)
  );
}

function renderPlansInspectorModel(sheetContext = {}) {
  const plansContext = getActivePlansSheetContext(sheetContext);
  const sheet = plansContext.sheet || {};
  const loadingModel = buildConstructionIntelligencePanelModel({
    ...plansContext,
    sheet,
    requirements: { status: 'loading', requirements: [], confirmedSpecifications: [], suggestedSpecifications: [], projectWideRequirements: [], fieldRequirements: {}, warnings: [], providerFailures: [] },
    specificationLinks: [],
    unresolvedEvidence: []
  });
  loadingModel.specifications = { confirmed: [], suggested: [] };
  return loadingModel;
}

function plansSheetHeaderHost() {
  return $('#mc-drawing-sheet-title') || $('#mc-drawing-selected-evidence');
}

function plansSheetHeaderMarkup(snapshot = {}, analysis = null) {
  const sheetNumber = snapshot.sheetNumber || `Page ${snapshot.pageNumber || snapshot.pdfPage || ''}`;
  const sheetTitle = snapshot.sheetTitle || `Page ${snapshot.pageNumber || snapshot.pdfPage || ''}`;
  const discipline = snapshot.discipline || 'Unknown';
  const drawingType = snapshot.drawingType || 'Unknown';
  const pdfPage = Number(snapshot.pdfPage || snapshot.pageNumber || 0);
  const sheetTotal = analysis?.sheets?.length || 0;
  return `<div><span>${esc(sheetNumber)}</span><h3>${esc(sheetTitle)}</h3><p>${esc(`${discipline} · ${drawingType}`)}</p></div><dl><div><dt>Discipline</dt><dd>${esc(discipline)}</dd></div><div><dt>Type</dt><dd>${esc(drawingType)}</dd></div><div><dt>Position</dt><dd>${analysis?.viewerFallback ? 'Page' : 'Sheet'} ${pdfPage}${sheetTotal ? ` of ${sheetTotal}` : ''}</dd></div><div><dt>Identity</dt><dd>${esc(snapshot.identityStatus || snapshot.status || 'Selected')}</dd></div></dl>`;
}

function updatePlansHeader(snapshot = {}, analysis = null) {
  const header = plansSheetHeaderHost();
  if (!header) return;
  header.setAttribute('aria-label', snapshot.sheetTitle || snapshot.sheetNumber || 'Selected drawing sheet');
  header.innerHTML = plansSheetHeaderMarkup(snapshot, analysis);
}

function updatePlansSheetSelection(snapshot = {}) {
  updateDrawingSelectionCards(snapshot.sheetId || '', { scroll: false });
  for (const button of document.querySelectorAll('[data-drawing-sheet]')) {
    const active = button.dataset.drawingSheet === (snapshot.sheetId || '');
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

function updatePlansInspectorLoading(snapshot = {}, analysis = null) {
  const panel = activePlansInspectorPanel || plansInspectorHost();
  if (!panel || !panel.isConnected) return panel || null;
  const loadingContext = getActivePlansSheetContext({ ...snapshot, analysis, panel });
  activePlansInspectorPanel = panel;
  activePlansInspectorSheetId = loadingContext.sheetId;
  activePlansInspectorGeneration = loadingContext.generationId;
  activePlansInspectorContext = loadingContext;
  panel.dataset.panelSignature = constructionIntelligencePanelSignature(renderPlansInspectorModel(loadingContext));
  panel.innerHTML = constructionIntelligencePanelMarkup(renderPlansInspectorModel(loadingContext));
  return panel;
}

async function selectPlansSheet({ analysis, sheet, observation = null, shell = 'mission-control', navigationStartedAt = 0, requestToken = 0, scrollActiveCard = true } = {}) {
  if (!analysis || !sheet) return false;
  const paintRequest = requestToken || ++drawingPagePaintRequest;
  const plansPanel = activePlansInspectorPanel || plansInspectorHost();
  const snapshot = getActivePlansSheetContext({
    analysis,
    sheet,
    projectId: analysis.projectId,
    drawingSetId: analysis.drawingSetId,
    documentId: analysis.documentId,
    drawingId: sheet.drawingId || '',
    pageId: sheet.pageId,
    sheetId: sheet.sheetId,
    sheetNumber: sheet.sheetNumber,
    sheetTitle: sheet.sheetTitle,
    pageNumber: sheet.pageNumber,
    pdfPage: sheet.pageNumber,
    generationId: paintRequest,
    shell,
    panel: plansPanel
  });
  updatePlansInspectorOwnership(snapshot);
  updatePlansHeader(snapshot, analysis);
  updatePlansSheetSelection(snapshot);
  updatePlansInspectorLoading(snapshot, analysis);
  drawingViewerEngine.selectPage(sheet.pageNumber);
  drawingTarget = createDrawingTarget({ projectId: analysis.projectId, documentId: analysis.documentId, drawingSetId: analysis.drawingSetId, pageId: sheet.pageId, drawingId: sheet.drawingId || '', sheetId: sheet.sheetId, pageNumber: sheet.pageNumber, observationId: observation?.observationId, region: observation?.region });
  const source = activeDrawingSourceRecord?.documentId === analysis.documentId && activeDrawingSourceRecord?.projectId === state().activeProject ? activeDrawingSourceRecord : await engine.sourceFile(analysis.documentId);
  const painted = await paintDrawingSelectionFast({ shell, analysis, sheet, observation, navigationStartedAt, requestToken: paintRequest, scrollActiveCard });
  if (!painted || requestToken && requestToken !== drawingPagePaintRequest) return painted;
  if (shell === 'mission-control') {
    emitDrawingRendered({
      generationId: snapshot.generationId,
      sheetId: snapshot.sheetId,
      pageId: sheet.pageId || '',
      projectId: snapshot.projectId,
      shell,
      workspaceRenderRequest: drawingWorkspaceRenderRequest,
      selected: { id: snapshot.documentId, title: snapshot.sheetTitle || snapshot.sheetNumber || '' },
      sheet,
      analysis,
      source,
      documentId: snapshot.documentId,
      requestToken: paintRequest,
      effectiveObservation: observation || null,
      effectiveRegion: observation?.region || null,
      overlayRecords: [],
      preservedBrowserScroll: 0,
      preservedViewport: defaultDrawingViewport(),
      preservedCanvas: null,
      preservedStage: null,
      preservedIntelligenceScroll: 0,
      viewState: null,
      sheetLegends: [],
      sheetSchedules: [],
      sheetKeyedNotes: [],
      sheetOccurrences: [],
      pageSpecificationLinks: [],
      selectedSpecificationLinks: [],
      requirementInput: {
        projectId: snapshot.projectId,
        pageEntityId: `drawing-page:${snapshot.pageId || ''}`,
        selectedObjectEntityId: '',
        selectedRoomEntityId: '',
        selectedObjectId: '',
        viewportContext: drawingViewportContextService.get(snapshot.documentId, snapshot.pageId) || null,
        tradeChannel: drawingTradeContext.current({ discipline: snapshot.discipline, title: snapshot.sheetTitle }),
        drawingSpecLinks: drawingSpecificationLinks.forPage(snapshot.pageId || ''),
        projectWideRequirements: []
      },
      activeRequirements: { status: 'loading', requirements: [], confirmedSpecifications: [], suggestedSpecifications: [], projectWideRequirements: [], fieldRequirements: {}, warnings: [], providerFailures: [] },
      rightPanelSignature: '',
      inspectorContext: snapshot,
      renderAfterPaint: true,
      currentSheet: sheet,
      activeTrade: drawingTradeContext.current({ discipline: snapshot.discipline, title: snapshot.sheetTitle }),
      pageContext: drawingWorkspace.getContext(sheet ? { ...sheet, documentId: sheet.documentId || snapshot.documentId, drawingSetId: sheet.drawingSetId || snapshot.drawingSetId, projectId: sheet.projectId || snapshot.projectId, pdfPageNumber: sheet.pdfPageNumber || sheet.pageNumber } : 1),
      observations: [],
      activeDrawingObjects: [],
      selectedDrawingObject: null,
      selectedDrawingObjectIds: [],
      activeRelationshipContext: null
    });
  }
  return painted;
}

drawingRenderedEventTarget.addEventListener(DrawingRenderedEvent, event => {
  const detail = event.detail || {};
  if (detail.renderAfterPaint === false) return;
  if (drawingSafeMode && detail.shell !== 'mission-control') return;
  drawingBackgroundSubscriberDepth += 1;
  try {
    // Populate Bedford drawing spec links for the current page
    const sheet = detail.sheet || (activeDrawingViewerAnalysis?.sheets?.find(item => Number(item.pageNumber) === Number(detail.sheet?.pageNumber)));
    const pageId = sheet?.pageId || detail.pageId || '';
    if (pageId && detail.projectId) {
      const sheetObservations = (activeDrawingViewerAnalysis?.observations || []).filter(item => item.sheetId === sheet?.sheetId);
      
      // Clear existing auto-generated links for this page
      const existingLinks = drawingSpecificationLinks.forPage(pageId);
      existingLinks.forEach(link => {
        if (link.origin === 'bedford-import' || link.origin === 'explicit-reference' || link.origin === 'object-recognition' || link.origin === 'drawing-metadata') {
          drawingSpecificationLinks.remove(link.linkId);
        }
      });
      
      populateBedfordDrawingSpecLinks({
        drawingSpecificationLinks,
        specificationIndex,
        projectId: detail.projectId,
        drawingPageId: pageId,
        sheetDiscipline: sheet?.discipline || '',
        sheet,
        observations: sheetObservations,
        schedules: [], // Would need to extract from analysis
        legends: [], // Would need to extract from analysis
        occurrences: [], // Would need to extract from analysis
        keyedNotes: [], // Would need to extract from analysis
        activeDrawingObjects,
        references: [], // Would need to extract from analysis
        projectSpecificationVocabulary
      });
      
      // Rebuild reverse index after populating links
      specificationReverseIndex.buildIndex();
    }
    
    // Add activeTrade and render-scope variables to detail for scheduleDrawingHydration
    const activeTrade = drawingTradeContext.current({ discipline: sheet?.discipline, objectType: selectedDrawingObject?.subtype || selectedDrawingObject?.type, title: sheet?.sheetTitle });
    scheduleDrawingHydration({ ...detail, activeTrade });
  } finally {
    drawingBackgroundSubscriberDepth = Math.max(0, drawingBackgroundSubscriberDepth - 1);
  }
});

function shouldHydratePlansSpecifications({ drawingSafeMode = false, workspaceMode = '' } = {}) {
  return Boolean(drawingSafeMode && workspaceMode === 'mission-control');
}

function isPlansV2Enabled() {
  return true;
}

function updateMissionRenderState(state, detail = {}) {
  const next = {
    state,
    sheet: detail.sheet || null,
    canvasWidth: Number(detail.canvasWidth) || 0,
    canvasHeight: Number(detail.canvasHeight) || 0,
    viewportWidth: Number(detail.viewportWidth) || 0,
    viewportHeight: Number(detail.viewportHeight) || 0,
    timestamp: globalThis.performance?.now?.() ?? Date.now()
  };
  if (detail.lastError) next.lastError = String(detail.lastError);
  if (detail.lastCleanupReason) next.lastCleanupReason = String(detail.lastCleanupReason);
  globalThis.MISSION_RENDER_STATE = next;
  const panel = $('#missionRenderStatePanel');
  if (panel) {
    panel.innerHTML = `
      <strong>Render State</strong><span>${esc(next.state)}</span>
      <strong>Current Sheet</strong><span>${esc(next.sheet?.sheetNumber || next.sheet?.sheetId || '—')}</span>
      <strong>Canvas Size</strong><span>${next.canvasWidth} × ${next.canvasHeight}</span>
      <strong>Viewport Size</strong><span>${next.viewportWidth} × ${next.viewportHeight}</span>
      <strong>Last Error</strong><span>${esc(next.lastError || '—')}</span>
      <strong>Cleanup Reason</strong><span>${esc(next.lastCleanupReason || '—')}</span>`;
  }
  return next;
}

if (drawingDebugPanelEnabled) {
  document.body.insertAdjacentHTML('beforeend', `
    <aside id="missionRenderStatePanel" style="position:fixed;top:8px;right:8px;z-index:9999;max-width:220px;padding:8px 10px;border:1px solid #38555a;border-radius:8px;background:#07171de6;color:#d7e6ea;font:11px/1.35 system-ui,sans-serif;display:grid;grid-template-columns:auto 1fr;gap:2px 8px;pointer-events:none"></aside>
  `);
}

updateMissionRenderState(RenderState.IDLE);

app.innerHTML = `
<a id="skipLink" class="mc-skip-link" href="#missionControlMain">Skip to workspace</a>
<section id="missionControlShell" class="mc-control-shell" aria-labelledby="missionControlTitle">
  <header class="mc-control-global-header">
    <div class="mc-control-identity">
      <span class="mc-control-mark" aria-hidden="true">M</span>
      <div><strong>MISSION COMPANION</strong><span>Mission Control</span></div>
    </div>
    <button id="openProfessionalWorkspace" class="mc-control-experience-switch">Open Professional Workspace</button>
  </header>
  <nav class="mc-control-nav" aria-label="Mission Control navigation">
    <button data-control-view="dashboard">Dashboard</button>
    <button data-control-home aria-current="page">Chief</button>
    <button data-control-view="plans">Drawings</button>
    <button data-control-experience="professional-workspace">Professional Workspace</button>
    <span style="position:absolute;left:-9999px;clip:rect(0 0 0 0);"><button data-control-view="plans">Open Plans</button></span>
  </nav>
  <main id="missionControlMain" tabindex="-1">
    <div id="missionControlContent" aria-live="polite"></div>
  </main>
</section>
<div id="professionalWorkspaceShell" class="shell" hidden>
  <aside class="rail">
    <div class="brand">
      <div class="mark">M</div>
      <div>
        <strong>MISSION COMPANION</strong>
        <span>Professional Workspace</span>
      </div>
    </div>

    <nav aria-label="Primary navigation">
      <button type="button" class="mc-workspace-tools-toggle" aria-expanded="false" aria-controls="professionalWorkspaceTools" data-workspace-tools-toggle>Workspace Tools</button>
      <div id="professionalWorkspaceTools" class="mc-workspace-tools-panel" hidden>
        <div class="mc-workspace-tools-group">
          <h3>Project content</h3>
          <div class="mc-workspace-tools-list">
            <button type="button" data-view="project">Project Workspace</button>
            <button type="button" data-view="chat">Command Desk</button>
            <button type="button" data-view="knowledge">Knowledge Workspace</button>
            <button type="button" data-view="inspections">Inspection Records</button>
            <button type="button" data-view="sources">Source Inspector</button>
            <button type="button" data-view="evidence">Evidence Explorer</button>
          </div>
        </div>
        <div class="mc-workspace-tools-group">
          <h3>Drawing / Engineering</h3>
          <div class="mc-workspace-tools-list">
            <button type="button" data-view="engineering">Engineering Workspace</button>
            <button type="button" data-view="workflow">Workflow Workspace</button>
            <button type="button" data-view="relationships">Relationship Explorer</button>
            <button type="button" data-view="versions">Version Explorer</button>
            <button type="button" data-view="evaluate">Knowledge Validation</button>
          </div>
        </div>
        <div class="mc-workspace-tools-group">
          <h3>Administration</h3>
          <div class="mc-workspace-tools-list">
            <button type="button" data-view="settings">Settings</button>
            <button type="button" data-view="diagnostics">Diagnostics</button>
          </div>
        </div>
      </div>
    </nav>

    <div class="project-block">
      <label>ACTIVE PROJECT</label>
      <select id="projectSelect"></select>
      <button id="newProject" class="subtle">＋ New project</button>
    </div>

    <div class="rail-foot">
      <span class="dot" id="healthDot"></span>
      <span id="healthText">Starting…</span>
    </div>
  </aside>

  <main id="workspaceMain" tabindex="-1">
    <header class="topbar">
      <div>
        <div class="eyebrow">MISSION COMPANION</div>
        <h1 id="pageTitle" tabindex="-1">Command Desk</h1>
        <p id="pageSub">Ask project-specific questions and receive source-grounded answers.</p>
      </div>

      <div class="mode-wrap">
        <button id="returnMissionControl" class="subtle mc-control-return">Return to Chief</button>
        <label>ANSWER MODE</label>
        <select id="mode">
          <option value="offline">Offline evidence</option>
          <option value="source">Source-only AI</option>
          <option value="assisted">Expert-assisted AI</option>
          <option value="general">General assistant AI</option>
        </select>
      </div>
    </header>

    <section id="project" class="view">
      <header id="projectWorkspaceHeader" class="mc-project-header"></header>

      <section aria-labelledby="projectHealthTitle">
        <div class="mc-project-section-heading">
          <div>
            <span>KNOWLEDGE READINESS</span>
            <h2 id="projectHealthTitle">Knowledge Health</h2>
          </div>
        </div>
        <div id="projectHealth" class="mc-project-health"></div>
      </section>

      <section
        class="panel mc-project-section"
        aria-labelledby="projectLibrariesTitle"
      >
        <div class="mc-project-section-heading">
          <div>
            <span>PROJECT STRUCTURE</span>
            <h2 id="projectLibrariesTitle">Library Overview</h2>
          </div>
        </div>
        <div id="projectLibraries" class="mc-project-libraries"></div>
      </section>

      <div class="mc-project-workspace-grid">
        <section
          class="panel mc-project-section mc-project-readiness"
          aria-labelledby="projectReadinessTitle"
        >
          <div class="mc-project-section-heading">
            <div>
              <span>DOCUMENT STATUS</span>
              <h2 id="projectReadinessTitle">Document Readiness</h2>
            </div>
            <div
              id="projectReadinessFilters"
              class="mc-project-filters"
              aria-label="Filter documents by readiness"
            ></div>
          </div>
          <div id="projectReadinessTable"></div>
        </section>

        <aside class="mc-project-side">
          <section
            class="panel mc-project-section"
            aria-labelledby="projectAttentionTitle"
          >
            <div class="mc-project-section-heading">
              <div>
                <span>OBSERVED CONDITIONS</span>
                <h2 id="projectAttentionTitle">Attention Items</h2>
              </div>
            </div>
            <div id="projectAttention"></div>
          </section>

          <section
            class="panel mc-project-section"
            aria-labelledby="projectActionsTitle"
          >
            <div class="mc-project-section-heading">
              <div>
                <span>INTERFACE GUIDANCE</span>
                <h2 id="projectActionsTitle">Suggested Next Actions</h2>
              </div>
            </div>
            <div id="projectActions" class="mc-project-actions"></div>
          </section>
        </aside>
      </div>
    </section>

    <section id="chat" class="view active">
      <div class="kpis">
        <article>
          <span>DOCUMENTS</span>
          <strong id="kDocs">0</strong>
        </article>
        <article>
          <span>INDEXED SECTIONS</span>
          <strong id="kSections">0</strong>
        </article>
        <article>
          <span>ANSWER STANDARD</span>
          <strong id="kMode">Offline evidence</strong>
        </article>
        <article>
          <span>AI</span>
          <strong id="kAI">Not configured</strong>
        </article>
      </div>

      <div class="chat-layout">
        <section class="panel conversation">
          <div class="panel-head">
            <div>
              <span>PROJECT ANALYSIS</span>
              <h2>Ask Chief</h2>
            </div>
            <div class="mc-chief-panel-actions">
              <div
                id="chiefStatus"
                class="mc-chief-status"
                data-chief-state="idle"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <img
                  id="chiefStatusImage"
                  src="./src/assets/chief/chief-idle.png"
                  alt=""
                  aria-hidden="true"
                >
                <span class="mc-chief-status-copy">
                  <strong id="chiefStatusLabel">Idle</strong>
                  <small id="chiefStatusDetail">Ready to assist</small>
                </span>
              </div>
              <button id="clearChat" class="subtle">New conversation</button>
            </div>
          </div>

          <div id="messages" class="messages"></div>

          <div class="composer">
            <textarea id="prompt" placeholder="Ask a question about the selected project knowledge…"></textarea>
            <button id="send">Analyze</button>
          </div>

          <div class="hint">Enter sends · Shift+Enter adds a line</div>
        </section>

        <aside class="panel evidence">
          <div class="panel-head">
            <div>
              <span>RETRIEVAL</span>
              <h2>Evidence used</h2>
            </div>
          </div>

          <div id="evidenceList" class="evidence-list">
            <div class="empty">
              Evidence will appear here after Chief answers a question using
              your project documents.
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section id="knowledge" class="view">
      <header class="mc-knowledge-heading">
        <div>
          <span>PROJECT KNOWLEDGE</span>
          <h2>Knowledge Workspace</h2>
        </div>
        <p>Browse libraries, inspect documents, and review indexed structure.</p>
      </header>

      <div
        id="knowledgeCatalogSummary"
        class="mc-library-summary"
        aria-label="Knowledge catalog summary"
      ></div>

      <div class="knowledge-grid">
        <aside class="panel library-panel">
          <div class="panel-head">
            <div>
              <span>KNOWLEDGE ORGANIZATION</span>
              <h2>Knowledge Catalog</h2>
            </div>
            <button id="newLibrary" class="subtle">＋ New</button>
          </div>

          <nav
            id="knowledgeCatalog"
            class="mc-library-catalog"
            aria-label="Knowledge catalog sections"
          ></nav>

          <section
            class="mc-library-types"
            aria-labelledby="knowledgeTypesTitle"
          >
            <div class="mc-library-subhead">
              <span>LIBRARY COVERAGE</span>
              <h3 id="knowledgeTypesTitle">Knowledge Types</h3>
            </div>
            <div id="knowledgeTypeCoverage"></div>
          </section>

          <div class="mc-library-subhead mc-library-subhead-libraries">
            <span>UPLOAD DESTINATIONS</span>
            <h3>Libraries</h3>
          </div>
          <div id="libraries" class="library-list"></div>
        </aside>

        <section class="panel knowledge-main">
          <div class="panel-head">
            <div>
              <span id="activeLibraryTitle">ACTIVE UPLOAD LIBRARY</span>
              <h2 id="knowledgeBrowserTitle">All Knowledge</h2>
              <small id="knowledgeBrowserCount"></small>
            </div>
            <div>
              <input
                id="fileInput"
                type="file"
                multiple
                hidden
                accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.json,.html,.xml,.log"
              >
              <button id="upload">＋ Add documents</button>
            </div>
          </div>

          <div class="pipeline">
            <span>Upload</span>
            <b>→</b>
            <span>Extract</span>
            <b>→</b>
            <span>Detect sections</span>
            <b>→</b>
            <span>Index</span>
            <b>→</b>
            <span>Verify</span>
          </div>

          <div id="ingestStatus"></div>

          <div class="knowledge-toolbar">
            <label class="mc-knowledge-search">
              <span>Knowledge Search</span>
              <input
                id="documentFilter"
                type="search"
                placeholder="Search documents and metadata…"
              >
            </label>
            <button
              id="clearKnowledgeFilters"
              type="button"
              class="subtle"
            >
              All Knowledge
            </button>
          </div>

          <div
            id="documents"
            class="document-list"
            aria-live="polite"
          ></div>
        </section>

        <aside class="panel metadata-panel">
          <div class="panel-head">
            <div>
              <span id="documentDetailsEyebrow">CATALOG COVERAGE</span>
              <h2 id="documentDetailsTitle">Document Details</h2>
            </div>
          </div>

          <div id="documentMetadata" class="document-metadata">
            <div class="empty">
              Select a document to review its metadata and indexed structure.
            </div>
          </div>

          <div class="queue-head">
            <span>IMPORT ACTIVITY</span>
            <strong>Queue</strong>
          </div>

          <div id="importQueue" class="import-queue">
            <div class="empty">No imports in this session. Use Add documents to begin an import.</div>
          </div>
        </aside>
      </div>
    </section>

    <section id="sources" class="view">
      <div class="split source-split">
        <section class="panel">
          <div class="panel-head">
            <div>
              <span>DOCUMENT STRUCTURE</span>
              <h2>Source inspector</h2>
            </div>
          </div>
          <div id="sourceDocs" class="source-docs"></div>
        </section>

        <section class="panel">
          <div id="sourceDetail" class="source-detail">
            <div class="empty"><strong>No source selected.</strong><br>Choose a document from the list to inspect its extraction checks and indexed sections.</div>
          </div>
        </section>
      </div>
    </section>

    <section id="specification-source" class="view">
      <div id="specificationSourceEvidence" class="panel source-detail"></div>
    </section>

    <section id="drawings" class="view">
      <div id="drawingInspector" class="mc-drawing-workspace"></div>
    </section>

    <section id="evidence" class="view">
      <header id="evidenceSessionHeader" class="mc-evidence-header"></header>
      <div id="evidencePipeline" class="mc-evidence-pipeline"></div>
      <div class="mc-evidence-workspace">
        <section class="panel mc-evidence-list-panel" aria-labelledby="evidenceListTitle">
          <div class="mc-evidence-panel-heading">
            <div>
              <span>ENGINE ORDER</span>
              <h2 id="evidenceListTitle">Ranked Evidence</h2>
            </div>
          </div>
          <div id="evidenceExplorerList" class="mc-evidence-list"></div>
        </section>
        <aside class="panel mc-evidence-detail-panel" aria-labelledby="evidenceDetailTitle">
          <div class="mc-evidence-panel-heading">
            <div>
              <span>STORED SECTION</span>
              <h2 id="evidenceDetailTitle">Evidence Details</h2>
            </div>
          </div>
          <div id="evidenceExplorerDetail"></div>
        </aside>
      </div>
    </section>

    <section id="relationships" class="view">
      <header id="relationshipHeader" class="mc-relationship-header"></header>
      <div class="mc-relationship-workspace">
        <section class="panel mc-relationship-context-panel" aria-labelledby="relationshipContextTitle">
          <div class="mc-relationship-heading">
            <span>EXACT PRODUCTION LINKS</span>
            <h2 id="relationshipContextTitle">Relationship Context</h2>
          </div>
          <div id="relationshipContext"></div>
        </section>
        <section class="panel mc-relationship-graph-panel" aria-labelledby="relationshipGraphTitle">
          <div class="mc-relationship-heading">
            <span>DETERMINISTIC LAYOUT</span>
            <h2 id="relationshipGraphTitle">Relationship Graph</h2>
          </div>
          <div id="relationshipGraph"></div>
        </section>
        <aside class="panel mc-relationship-detail-panel" aria-labelledby="relationshipDetailTitle">
          <div class="mc-relationship-heading">
            <span>LINKED KNOWLEDGE</span>
            <h2 id="relationshipDetailTitle">Relationships</h2>
          </div>
          <div id="relationshipDetail"></div>
        </aside>
      </div>
    </section>

    <section id="versions" class="view">
      <header id="lineageHeader" class="mc-lineage-header"></header>
      <div class="mc-lineage-workspace">
        <section class="panel mc-lineage-current" aria-labelledby="lineageCurrentTitle">
          <div class="mc-lineage-heading"><span>DOCUMENT FAMILY</span><h2 id="lineageCurrentTitle">Current Version</h2></div>
          <div id="lineageCurrent"></div>
        </section>
        <section class="panel mc-lineage-history" aria-labelledby="lineageHistoryTitle">
          <div class="mc-lineage-heading"><span>EXPLICIT HISTORY</span><h2 id="lineageHistoryTitle">Version Chain</h2></div>
          <div id="lineageHistory"></div>
        </section>
        <aside class="panel mc-lineage-changes" aria-labelledby="lineageChangesTitle">
          <div class="mc-lineage-heading"><span>FIELD COMPARISON</span><h2 id="lineageChangesTitle">Changes and Warnings</h2></div>
          <div id="lineageChanges"></div>
        </aside>
      </div>
    </section>

    <section id="engineering" class="view">
      <header id="engineeringHeader" class="mc-engineering-header"></header>
      <div class="mc-engineering-workspace">
        <section class="panel mc-engineering-context-panel" aria-labelledby="engineeringContextTitle"><div class="mc-engineering-heading"><span>ACTIVE CONTEXT</span><h2 id="engineeringContextTitle">Engineering Context</h2></div><div id="engineeringContext"></div></section>
        <section class="panel mc-engineering-knowledge-panel" aria-labelledby="engineeringKnowledgeTitle"><div class="mc-engineering-heading"><span>PROJECT KNOWLEDGE</span><h2 id="engineeringKnowledgeTitle">Related Knowledge</h2></div><div id="engineeringKnowledge"></div></section>
        <aside class="panel mc-engineering-session-panel" aria-labelledby="engineeringSessionTitle"><div class="mc-engineering-heading"><span>TEMPORARY · UNSAVED</span><h2 id="engineeringSessionTitle">Inspection Session</h2></div><div id="engineeringSession"></div></aside>
      </div>
    </section>

    <section id="workflow" class="view">
      <header id="workflowHeader" class="mc-workflow-header"></header>
      <div class="mc-workflow-workspace">
        <section class="panel mc-workflow-overview" aria-labelledby="workflowOverviewTitle"><div class="mc-workflow-heading"><span>CURRENT WORKFLOW</span><h2 id="workflowOverviewTitle">Workflow</h2></div><div id="workflowOverview"></div></section>
        <section class="panel mc-workflow-resources" aria-labelledby="workflowResourcesTitle"><div class="mc-workflow-heading"><span>AVAILABLE SOURCES</span><h2 id="workflowResourcesTitle">Workflow Resources</h2></div><div id="workflowResources"></div></section>
        <aside class="panel mc-workflow-session" aria-labelledby="workflowSessionTitle"><div class="mc-workflow-heading"><span>TEMPORARY · UNSAVED</span><h2 id="workflowSessionTitle">Workflow Session</h2></div><div id="workflowSession"></div></aside>
      </div>
    </section>

    <section id="inspections" class="view">
      <header class="mc-inspection-header">
        <div><span>PROJECT OPERATIONS</span><h2>Inspection Records</h2><p>Persistent, source-linked construction inspection records for the active project.</p></div>
        <button id="createInspectionRecord">Create Inspection Record</button>
      </header>
      <div class="mc-inspection-toolbar">
        <label><span>Search</span><input id="inspectionSearch" type="search" placeholder="Search number, title, location, or trade"></label>
        <label><span>Status</span><select id="inspectionStatusFilter"><option value="">All active statuses</option>${INSPECTION_STATUSES.map(status => `<option>${status}</option>`).join('')}</select></label>
        <label><span>Location</span><input id="inspectionLocationFilter" type="search" placeholder="Building, area, or room"></label>
        <label><span>Sort</span><select id="inspectionSort"><option value="number">Inspection number</option><option value="date">Inspection date</option></select></label>
        <label class="mc-inspection-archive-toggle"><input id="inspectionShowArchived" type="checkbox"> Show archived</label>
      </div>
      <div class="mc-inspection-workspace">
        <section class="panel" aria-labelledby="inspectionListTitle"><div class="mc-inspection-heading"><span>ACTIVE PROJECT</span><h2 id="inspectionListTitle">Inspection Register</h2></div><div id="inspectionList"></div></section>
        <aside class="panel" aria-labelledby="inspectionDetailTitle"><div class="mc-inspection-heading"><span>RECORD DETAIL</span><h2 id="inspectionDetailTitle">Inspection Detail</h2></div><div id="inspectionDetail"></div></aside>
      </div>
    </section>

    <section id="revisions" class="view">
      <header id="revisionHeader" class="mc-revision-header"></header>
      <div id="revisionSummary" class="mc-revision-summary"></div>
      <nav id="revisionFilters" class="mc-revision-filters" aria-label="Revision change filters"></nav>
      <div class="mc-revision-workspace">
        <section class="panel mc-revision-list-panel" aria-labelledby="revisionListTitle">
          <div class="mc-revision-heading"><span>DETERMINISTIC MATCHES</span><h2 id="revisionListTitle">Section Changes</h2></div>
          <div id="revisionList"></div>
        </section>
        <section class="panel mc-revision-detail-panel" aria-labelledby="revisionDetailTitle">
          <div class="mc-revision-heading"><span>STORED SECTION DATA</span><h2 id="revisionDetailTitle">Side-by-Side Review</h2></div>
          <div id="revisionDetail"></div>
        </section>
        <aside class="panel mc-revision-warning-panel" aria-labelledby="revisionWarningsTitle">
          <div class="mc-revision-heading"><span>INTEGRITY</span><h2 id="revisionWarningsTitle">Comparison Warnings</h2></div>
          <div id="revisionWarnings"></div>
        </aside>
      </div>
    </section>

    <section id="evaluate" class="view">
      <header class="mc-validation-header">
        <div>
          <span>KNOWLEDGE BASE READINESS</span>
          <h2>Knowledge Validation</h2>
          <p>
            Deterministic checks of loaded knowledge, indexing state,
            metadata, and coverage.
          </p>
        </div>
      </header>

      <div id="validationHealth" class="mc-validation-health"></div>

      <div class="mc-validation-grid">
        <section
          class="panel mc-validation-panel"
          aria-labelledby="validationChecksTitle"
        >
          <div class="mc-validation-heading">
            <div>
              <span>DETERMINISTIC REVIEW</span>
              <h2 id="validationChecksTitle">Validation Checks</h2>
            </div>
          </div>
          <div id="validationChecks"></div>
        </section>

        <section
          class="panel mc-validation-panel"
          aria-labelledby="validationAttentionTitle"
        >
          <div class="mc-validation-heading">
            <div>
              <span>OBSERVED CONDITIONS</span>
              <h2 id="validationAttentionTitle">Attention Items</h2>
            </div>
          </div>
          <div id="validationAttention"></div>
        </section>

        <section
          class="panel mc-validation-panel mc-validation-coverage-panel"
          aria-labelledby="validationCoverageTitle"
        >
          <div class="mc-validation-heading">
            <div>
              <span>PRODUCTION COUNTS</span>
              <h2 id="validationCoverageTitle">Coverage</h2>
            </div>
          </div>
          <div id="validationCoverage" class="mc-validation-coverage"></div>
        </section>

        <section
          class="panel mc-validation-panel"
          aria-labelledby="validationActionsTitle"
        >
          <div class="mc-validation-heading">
            <div>
              <span>INTERFACE GUIDANCE</span>
              <h2 id="validationActionsTitle">Recommended Actions</h2>
            </div>
          </div>
          <div id="validationActions" class="mc-validation-actions"></div>
        </section>
      </div>

      <details class="panel mc-validation-advanced">
        <summary>
          <span>
            <strong>Advanced AI Evaluation</strong>
            <small>Used for controlled benchmark testing of Chief.</small>
          </span>
        </summary>

        <div class="mc-validation-advanced-body">
          <section>
            <div class="mc-validation-heading">
              <div>
                <span>CONTROLLED BENCHMARKS</span>
                <h2>Advanced AI Evaluation Cases</h2>
              </div>
              <button id="addEval">＋ Add case</button>
            </div>
            <div id="evalList"></div>
          </section>

          <aside>
            <h3>Evaluation standard</h3>
            <p><strong>Required facts</strong> are phrases the answer must contain.</p>
            <p><strong>Expected source</strong> is a document or section the retrieval should find.</p>
            <p><strong>Prohibited assumptions</strong> are statements that must not appear.</p>
            <div id="evalResult"></div>
          </aside>
        </div>
      </details>
    </section>

    <section id="settings" class="view">
      <section class="panel settings">
        <div class="panel-head">
          <div>
            <span>APPLICATION SETTINGS</span>
            <h2>Settings</h2>
          </div>
        </div>

        <div class="settings-tabs">
          <button data-settings-tab="experience">Experience</button>
          <button class="active" data-settings-tab="ai">AI</button>
          <button data-settings-tab="knowledge">Knowledge</button>
          <button data-settings-tab="developer">Developer</button>
          <button data-settings-tab="about">About</button>
        </div>

        <div class="settings-pane" data-settings-pane="experience">
          <fieldset class="mc-control-startup-setting">
            <legend>Startup Experience</legend>
            <label><input type="radio" name="startupExperience" value="mission-control"> Mission Control</label>
            <label><input type="radio" name="startupExperience" value="professional-workspace"> Professional Workspace</label>
            <p>You can switch experiences at any time without resetting your current project or work.</p>
          </fieldset>
        </div>

        <div class="settings-pane active" data-settings-pane="ai">
          <label>
            OpenAI API URL
            <input id="apiUrl">
          </label>

          <label>
            Model
            <input id="model">
          </label>

          <label>
            API key
            <input id="apiKey" type="password" autocomplete="off">
          </label>

          <label>
            Request timeout (seconds)
            <input id="timeout" type="number" min="30" max="600">
          </label>

          <button id="testConnection" class="subtle">Test connection</button>
        </div>

        <div class="settings-pane" data-settings-pane="knowledge">
          <label>
            Retrieved sections per question
            <input id="topK" type="number" min="3" max="20">
          </label>

          <div class="settings-actions">
            <button id="exportProject" class="subtle">Export project</button>

            <label class="button subtle">
              Import project
              <input id="importProject" type="file" accept=".json" hidden>
            </label>
          </div>
        </div>

        <div class="settings-pane" data-settings-pane="developer">
          <p class="notice">
            Reset removes all projects, settings, indexed documents,
            and browser history for this application.
          </p>

          <button id="openDiagnostics" class="subtle">Open diagnostics</button>
          <button id="resetApplication" class="danger">Reset application data</button>
        </div>

        <div class="settings-pane" data-settings-pane="about">
          <h3>Mission Companion Master</h3>
          <p>Version <strong>2.8.0 — Build 8, Commit 1</strong></p>
          <p class="notice">
            Evidence-first engineering workspace with local document retrieval,
            deterministic offline evidence reports, citation verification,
            conflict detection, and optional AI-assisted analysis.
          </p>
        </div>

        <div class="settings-actions">
          <button id="saveSettings">Save settings</button>
        </div>

        <p class="notice">
          The API key is stored only in this browser.
          A public static website cannot safely share one central key.
        </p>
      </section>
    </section>

    <section id="diagnostics" class="view">
      <div class="diagnostic-grid">
        <section class="panel">
          <div class="panel-head">
            <div>
              <span>SYSTEM HEALTH</span>
              <h2>Diagnostics</h2>
            </div>

            <div>
              <button id="runDiagnostics">Run checks</button>
              <button id="exportDiagnostics" class="subtle">Export</button>
            </div>
          </div>

          <div id="healthSummary" class="health-summary"></div>
          <div id="healthChecks" class="health-checks"></div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <span>DEVELOPER CONSOLE</span>
              <h2>Application log</h2>
            </div>
            <button id="clearLogs" class="subtle">Clear log</button>
          </div>

          <div id="diagnosticLog" class="diagnostic-log"></div>
        </section>

        <section class="panel roadmap-panel">
          <div class="panel-head">
            <div>
              <span>MASTER ROADMAP</span>
              <h2>Build sequence</h2>
            </div>
          </div>

          <ol class="roadmap">
            <li class="done">
              <strong>Build 1</strong>
              <span>Stabilization and diagnostics</span>
            </li>
            <li class="done">
              <strong>Build 2</strong>
              <span>Libraries, ingestion management, metadata, and document health</span>
            </li>
            <li class="done">
              <strong>Build 3</strong>
              <span>Source Inspector and extraction verification</span>
            </li>
            <li class="done">
              <strong>Build 4</strong>
              <span>Retrieval and reranking</span>
            </li>
            <li>
              <strong>Build 5</strong>
              <span>Evidence-controlled answer engine</span>
            </li>
            <li>
              <strong>Build 6</strong>
              <span>Citation accuracy</span>
            </li>
            <li>
              <strong>Build 7</strong>
              <span>Knowledge validation and advanced AI evaluation</span>
            </li>
            <li>
              <strong>Build 8–10</strong>
              <span>Knowledge packs, security, and production release</span>
            </li>
          </ol>
        </section>
      </div>
    </section>
  </main>
</div>

<aside id="demoGuide" class="mc-demo-guide" aria-labelledby="demoGuideTitle" hidden></aside>

<div id="modal" class="modal" hidden>
  <div class="modal-card">
    <button id="closeModal" class="modal-x">×</button>
    <div id="modalBody"></div>
  </div>
</div>
`;

function setChiefState(name = 'idle') {
  const stateName = chiefStateCopy[name] ? name : 'idle';
  const copy = chiefStateCopy[stateName];
  const status = $('#chiefStatus');
  const images = $$('.mc-chief-status-image');

  status.dataset.chiefState = stateName;
  images.forEach(image => {
    image.src = chiefAssets[stateName];
    image.alt = 'Chief, the Mission Companion engineer';
  });
  $('#chiefStatusLabel').textContent = copy.label;
  $('#chiefStatusDetail').textContent = copy.detail;
}

const titles = {
  project: [
    'Project Workspace',
    'Review active-project knowledge readiness and operational status.'
  ],
  diagnostics: [
    'Diagnostics',
    'Inspect application health, startup checks, logs, and roadmap.'
  ],
  chat: [
    'Command Desk',
    'Ask project-specific questions and receive source-grounded answers.'
  ],
  knowledge: [
    'Knowledge Workspace',
    'Browse project documents, metadata, and indexed structure.'
  ],
  sources: [
    'Source Inspector',
    'Review exactly what Mission Companion indexed.'
  ],
  evidence: [
    'Evidence Explorer',
    'Inspect the retrieval results and citations behind the latest answer.'
  ],
  relationships: [
    'Relationship Explorer',
    'Inspect explicit hierarchy, references, and document relationships.'
  ],
  versions: [
    'Version Explorer',
    'Inspect explicit document lineage, duplicates, and deterministic revision changes.'
  ],
  revisions: [
    'Revision Review',
    'Inspect objective structural and stored-content changes between explicitly linked revisions.'
  ],
  engineering: [
    'Engineering Workspace',
    'Assemble exact project knowledge for an inspection or construction activity.'
  ],
  workflow: [
    'Workflow Workspace',
    'Orchestrate exact construction knowledge through deterministic workflow templates.'
  ],
  inspections: [
    'Inspection Records',
    'Create and manage persistent, source-linked project inspection records.'
  ],
  evaluate: [
    'Knowledge Validation',
    'Validate knowledge-base readiness, metadata, indexing, and coverage.'
  ],
  settings: [
    'Settings',
    'Configure the model and move project libraries between browsers.'
  ]
};

function show(name) {
  const preserveDrawingForSpecification = Boolean(specificationDrawingReturnTarget) && name === 'knowledge';
  if (name !== 'drawings' && !preserveDrawingForSpecification) releaseDrawingSource();
  if (name !== 'knowledge') {
    void specificationSourceViewer.close('workspace-changed');
  }
  if (name !== 'knowledge') specificationDrawingReturnTarget = null;
  view = name;
  if (experience === 'professional-workspace') lastProfessionalView = name;

  $$('.view').forEach(element => {
    element.classList.toggle('active', element.id === name);
  });

  $$('.rail nav button[data-view]').forEach(button => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  $('#pageTitle').textContent = titles[name][0];
  $('#pageSub').textContent = titles[name][1];
  void renderContextBusBanner(name);

  if (name === 'knowledge') {
    if (selectedDoc) void activateSelectedWorkspaceDocument(CONTEXT_ACTIVATION_SOURCES.knowledgeObjectDocument);
    renderKnowledgeWorkspace();
  }

  if (name === 'project') {
    renderProjectWorkspace();
  }

  if (name === 'sources') {
    if (selectedDoc) void activateSelectedWorkspaceDocument(
      sourceNavigationTarget?.documentId === selectedDoc && sourceNavigationTarget?.sectionId
        ? CONTEXT_ACTIVATION_SOURCES.sourceInspectorSection
        : CONTEXT_ACTIVATION_SOURCES.sourceInspectorDocument,
      selectedDoc,
      sourceNavigationTarget?.documentId === selectedDoc ? sourceNavigationTarget?.sectionId || '' : ''
    );
    renderSources();
  }

  if (name === 'evidence') {
    renderEvidenceExplorer();
  }

  if (name === 'relationships') {
    if (relationshipTarget?.documentId || selectedDoc) void activateSelectedWorkspaceDocument(
      relationshipTarget?.sectionId ? CONTEXT_ACTIVATION_SOURCES.relationshipSection : CONTEXT_ACTIVATION_SOURCES.relationshipDocument,
      relationshipTarget?.documentId || selectedDoc,
      relationshipTarget?.sectionId || '',
      relationshipTarget?.relationshipId || ''
    );
    renderRelationshipExplorer();
  }

  if (name === 'versions') {
    if (lineageTarget?.documentId || selectedDoc) void activateSelectedWorkspaceDocument(CONTEXT_ACTIVATION_SOURCES.versionDocument, lineageTarget?.documentId || selectedDoc);
    renderVersionExplorer();
  }

  if (name === 'revisions') {
    renderRevisionReview();
  }
  if (name === 'engineering') {
    renderEngineeringWorkspace();
  }
  if (name === 'workflow') {
    renderWorkflowWorkspace();
  }
  if (name === 'inspections') {
    renderInspectionRecords();
  }

  if (name === 'evaluate') {
    renderEvals();
  }

  if (name === 'diagnostics') {
    renderDiagnostics();
  }
}

$$('.rail nav button[data-view]').forEach(button => {
  button.onclick = () => {
    if (button.dataset.view === 'engineering' && activeContextActivation) {
      void openEngineeringWorkspace({ source: CONTEXT_ACTIVATION_SOURCES.engineeringWorkspace });
      return;
    }
    const panel = $('#professionalWorkspaceTools');
    if (panel) {
      panel.hidden = true;
      $('[data-workspace-tools-toggle]')?.setAttribute('aria-expanded', 'false');
    }
    show(button.dataset.view);
  };
  button.dataset.bound = 'true';
});

$('[data-workspace-tools-toggle]')?.addEventListener('click', () => {
  const panel = $('#professionalWorkspaceTools');
  const trigger = $('[data-workspace-tools-toggle]');
  if (!panel || !trigger) return;
  const expanded = panel.hidden;
  panel.hidden = !expanded;
  trigger.setAttribute('aria-expanded', String(expanded));
});

registerModule('Navigation', 'ready', {
  summary: `${$$('.rail nav button[data-view]').length} views registered`
});

function state() {
  return engine.state();
}

async function switchExperience(nextExperience, { destination = '', focus = true, force = false } = {}) {
  const next = normalizeStartupExperience(nextExperience);
  if (!force && !$('#modal').hidden) {
    alert('Finish or cancel the open form before switching experiences.');
    return false;
  }
  experience = next;
  const missionControl = next === 'mission-control';
  $('#missionControlShell').hidden = !missionControl;
  $('#professionalWorkspaceShell').hidden = missionControl;
  $('#missionControlShell').classList.toggle('mc-shell-inactive', !missionControl);
  $('#professionalWorkspaceShell').classList.toggle('mc-shell-inactive', missionControl);
  $('#missionControlShell').setAttribute('aria-hidden', String(!missionControl));
  $('#professionalWorkspaceShell').setAttribute('aria-hidden', String(missionControl));
  $('#missionControlShell').inert = !missionControl;
  $('#professionalWorkspaceShell').inert = missionControl;
  $('#skipLink').href = missionControl ? '#missionControlMain' : '#workspaceMain';
  if (missionControl) {
    await renderMissionControl();
    if (focus) $('#missionControlTitle')?.focus();
  } else {
    lastProfessionalView = destination || view;
    if (destination) show(destination);
    if (focus) $('#pageTitle')?.focus();
  }
  return true;
}

async function applyActionTargetState(target = {}, navigationTarget = null) {
  const actionTarget = resolveSharedActionTarget(target);
  if (!actionTarget) return;

  if (actionTarget.kind === 'source') {
    selectedDoc = actionTarget.documentId || selectedDoc;
    selectedKnowledgeSection = 'all';
    sourceNavigationTarget = actionTarget.sectionId
      ? createSourceTarget({
          projectId: actionTarget.projectId || state().activeProject || '',
          documentId: actionTarget.documentId || '',
          sectionId: actionTarget.sectionId || '',
          originatingWorkspace: actionTarget.origin || 'assistant',
          originatingMessageId: actionTarget.messageId || '',
          destination: actionTarget.destination || 'knowledge'
        })
      : null;
    sourceNavigationNotice = actionTarget.sectionId && navigationTarget?.reason === 'missing-section' ? 'Specification section unavailable' : '';
    return;
  }

  if (actionTarget.kind === 'rfi') {
    selectedDoc = actionTarget.documentId || selectedDoc;
    selectedKnowledgeSection = 'all';
    sourceNavigationTarget = createSourceTarget({
      projectId: actionTarget.projectId || state().activeProject || '',
      documentId: actionTarget.documentId || '',
      sectionId: actionTarget.sectionId || '',
      originatingWorkspace: actionTarget.origin || 'assistant',
      originatingMessageId: actionTarget.messageId || '',
      destination: actionTarget.destination || 'rfi'
    });
    sourceNavigationNotice = actionTarget.sectionId && navigationTarget?.reason === 'missing-section' ? 'RFI section unavailable' : '';
    return;
  }

  if (actionTarget.kind === 'submittal') {
    selectedDoc = actionTarget.documentId || selectedDoc;
    selectedKnowledgeSection = 'all';
    sourceNavigationTarget = createSourceTarget({
      projectId: actionTarget.projectId || state().activeProject || '',
      documentId: actionTarget.documentId || '',
      sectionId: actionTarget.sectionId || '',
      originatingWorkspace: actionTarget.origin || 'assistant',
      originatingMessageId: actionTarget.messageId || '',
      destination: actionTarget.destination || 'submittal'
    });
    sourceNavigationNotice = actionTarget.sectionId && navigationTarget?.reason === 'missing-section' ? 'Submittal section unavailable' : '';
    return;
  }

  if (actionTarget.kind === 'drawing') {
    selectedDoc = actionTarget.documentId || selectedDoc;
    drawingTarget = createDrawingTarget({
      projectId: actionTarget.projectId || state().activeProject || '',
      documentId: actionTarget.documentId || '',
      drawingSetId: actionTarget.drawingSetId || '',
      drawingId: actionTarget.drawingId || '',
      sheetId: actionTarget.sheetId || '',
      pageNumber: actionTarget.pageNumber || null,
      observationId: actionTarget.observationId || '',
      region: actionTarget.region || null,
      origin: actionTarget.origin || 'assistant',
      returnTarget: actionTarget.returnTarget || ''
    });
    selectedWorkPackageItem = drawingTarget?.observationId || drawingTarget?.sheetId || '';
    return;
  }

  if (actionTarget.kind === 'inspection') {
    selectedInspectionId = actionTarget.inspectionId || '';
  }
}

async function openProfessionalDestination(target = {}) {
  const actionTarget = resolveSharedActionTarget(target);
  const navigationTarget = prepareActionNavigationState(actionTarget || target, {
    activeProjectId: state().activeProject,
    projects: state().projects,
    documents: await engine.documents(),
    sections: await engine.sections()
  });
  if (navigationTarget.shouldSwitchProject) {
    await selectProjectThroughProductionPath(navigationTarget.projectId);
  }
  if (actionTarget) {
    await applyActionTargetState(actionTarget, navigationTarget);
  } else {
    if (target.inspectionId) selectedInspectionId = target.inspectionId;
    if (target.documentId) selectedDoc = target.documentId;
  }
  const destination = target.view || navigationTarget.destination || 'project';
  await switchExperience('professional-workspace', { destination });
}

function missionControlActionLabel(priority) {
  return priority.kind === 'in-progress' ? 'Continue inspection'
    : priority.kind === 'recent-revision' ? 'Review revision'
      : priority.kind === 'informational' ? 'Review document'
        : 'Review inspection';
}

function resolveSharedActionTarget(rawTarget = {}) {
  return normalizeActionTargetPayload(rawTarget, state().activeProject || '');
}

function missionControlEmpty(title, detail, action = '') {
  return `<div class="mc-control-empty"><strong>${esc(title)}</strong><p>${esc(detail)}</p>${action}</div>`;
}

function renderMyProjects() {
  const currentState = state();
  const { userProjects } = separateMissionControlProjects(currentState.projects, DEMO_PROJECT_ID);
  $('#missionControlContent').innerHTML = `
    <section class="mc-control-projects" aria-labelledby="missionControlTitle">
      <header class="mc-control-projects-header"><div><span>MISSION COMPANION</span><h1 id="missionControlTitle" tabindex="-1">My Projects</h1><p>Open existing work, create a project, or import a project package.</p></div><div><button data-control-action="create-project">Create New Project</button><button class="subtle" data-control-action="import-project">Import Project</button></div></header>
      <section class="mc-control-project-group" aria-labelledby="mcUserProjectsTitle"><header><span>YOUR WORK</span><h2 id="mcUserProjectsTitle">User Projects</h2></header>
        ${userProjects.length ? `<div class="mc-control-project-list">${userProjects.map(project => `<article class="mc-control-project-tile ${project.id === currentState.activeProject ? 'active' : ''}"><div><span>${project.id === currentState.activeProject ? 'CURRENT PROJECT' : 'PROJECT'}</span><h3>${esc(project.name)}</h3><p>${esc(project.description || 'Project details are available after opening.')}</p></div><button data-control-project-id="${esc(project.id)}">${project.id === currentState.activeProject ? 'Open Project' : 'Open'}</button></article>`).join('')}</div>` : missionControlEmpty('No user projects yet', 'Create a project or import an existing Mission Companion project package.', '<button data-control-action="create-project">Create your first project</button>')}
      </section>
    </section>`;
}

function missionControlProject() {
  const current = state();
  if (!current.activeProject || current.activeProject === 'general') return null;
  return current.projects.find(project => project.id === current.activeProject) || null;
}

function chiefDrawingEvidenceMarkup(message, projectDocuments = [], analyses = []) {
  const evidence = buildChiefDrawingEvidence(message, { documents: projectDocuments, analyses });
  if (!evidence) return '';
  const detail = [evidence.sheetNumber, evidence.sheetTitle].filter(Boolean).join(' · ');
  const sheetMeta = [evidence.discipline, evidence.sheetType].filter(Boolean).join(' · ');
  return `<section class="mc-chief-drawing-evidence" aria-label="Drawing evidence preview">
    <header>
      <span>DRAWING EVIDENCE</span>
      <strong>${esc(evidence.title || 'Drawing evidence')}</strong>
    </header>
    <div class="mc-chief-drawing-evidence-body">
      <div>
        <strong>${esc(detail || 'Exact drawing evidence')}</strong>
        <p>${esc(evidence.reason)}</p>
      </div>
      <dl>
        ${evidence.pageNumber ? `<div><dt>Page</dt><dd>${esc(evidence.pageNumber)}</dd></div>` : ''}
        ${evidence.sheetNumber ? `<div><dt>Sheet</dt><dd>${esc(evidence.sheetNumber)}</dd></div>` : ''}
        ${sheetMeta ? `<div><dt>Details</dt><dd>${esc(sheetMeta)}</dd></div>` : ''}
      </dl>
    </div>
    <button type="button" class="subtle" data-action-target='${esc(JSON.stringify(createActionTarget({ kind: 'drawing', projectId: state().activeProject || '', documentId: evidence.documentId, drawingSetId: evidence.drawingSetId, sheetId: evidence.sheetId, sheetNumber: evidence.sheetNumber, pageNumber: evidence.pageNumber, observationId: evidence.observationId, region: evidence.region, origin: 'chief-preview', messageId: message.id, returnTarget: 'chief-answer' })))}'>Open exact drawing</button>
  </section>`;
}

function chiefLocationPresentationMarkup(presentation = null) {
  if (!presentation) return '';
  const actions = presentation.actionTarget ? `<button type="button" class="subtle" data-action-target='${esc(JSON.stringify(presentation.actionTarget))}'>${esc(presentation.actionLabel)}</button>` : '';
  const candidates = presentation.candidates?.length ? `<ul>${presentation.candidates.slice(0, 4).map(item => `<li>${esc(item.label || item.kind || 'Location')}</li>`).join('')}</ul>` : '';
  return `<section class="mc-chief-location-card" aria-label="Chief location result">
    <header>
      <span>LOCATION</span>
      <strong>${esc(presentation.title || 'Location result')}</strong>
    </header>
    <div class="mc-chief-location-card-body">
      <p>${esc(presentation.summary || '')}</p>
      ${presentation.detail ? `<p>${esc(presentation.detail)}</p>` : ''}
      ${candidates}
    </div>
    ${actions}
  </section>`;
}

function missionControlMessageActions(message, drawingSourceIds = new Set()) {
  if (message.role !== 'assistant' || !Array.isArray(message.hits) || !message.hits.length) return '';
  if (message.workPackageReferences) return '';
  const exact = message.hits.filter(hit => hit?.documentId);
  if (!exact.length) return '';
  const first = exact[0];
  const label = first.sectionNumber || first.heading || first.documentName || first.source || 'source';
  const drawingHit = exact.find(hit => drawingSourceIds.has(hit.documentId) && Number(hit.pageStart || hit.pageNumber || hit.page) > 0);
  const sourceTarget = createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: first.documentId, sectionId: first.id || first.sectionId || '', destination: first.id || first.sectionId ? 'knowledge' : 'sources', origin: 'chat' });
  const drawingTarget = drawingHit ? createActionTarget({ kind: 'drawing', projectId: state().activeProject || '', documentId: drawingHit.documentId, pageNumber: Number(drawingHit.pageStart || drawingHit.pageNumber || drawingHit.page), origin: 'chat' }) : null;
  const evidenceTarget = createActionTarget({ kind: 'evidence', projectId: state().activeProject || '', documentId: first.documentId, messageId: message.id, origin: 'chat' });
  return `<div class="mc-control-message-actions"><button data-action-target='${esc(JSON.stringify(sourceTarget))}' data-control-source-document="${esc(first.documentId)}" data-control-source-section="${esc(first.id || first.sectionId || '')}">Open ${esc(label)}</button>${drawingTarget ? `<button data-action-target='${esc(JSON.stringify(drawingTarget))}' data-control-drawing-document="${esc(drawingHit.documentId)}" data-control-drawing-page="${Number(drawingHit.pageStart || drawingHit.pageNumber || drawingHit.page)}">Open drawing page ${Number(drawingHit.pageStart || drawingHit.pageNumber || drawingHit.page)}</button>` : ''}<button data-action-target='${esc(JSON.stringify(evidenceTarget))}' data-control-evidence-message="${esc(message.id)}">Review ${fmt(exact.length)} Supporting Reference${exact.length === 1 ? '' : 's'}</button></div>`;
}

function renderChiefEvidence() {
  const evidence = activeRetrievalSession?.evidence || [];
  if (!evidence.length) return '';
  const primary = evidence.find(item => item.id === selectedEvidenceId) || evidence[0];
  return `
    <section class="mc-chief-evidence" aria-labelledby="mcChiefEvidenceTitle">
      <div class="mc-chief-evidence-header">
        <div>
          <span>COMMAND DESK ANALYSIS</span>
          <h3 id="mcChiefEvidenceTitle">Evidence and results</h3>
        </div>
        <strong>${fmt(evidence.length)} result${evidence.length === 1 ? '' : 's'}</strong>
      </div>
      <div class="mc-chief-evidence-list">
        ${evidence.map(item => `<article class="mc-chief-evidence-item ${item.id === primary?.id ? 'active' : ''}">
          <strong>${esc(item.title || item.documentName || item.source || 'Evidence')}</strong>
          <p>${esc(item.summary || item.content || 'Stored source details are available for review.')}</p>
        </article>`).join('')}
      </div>
    </section>
  `;
}

async function renderChiefWorkspace({ historyVisible = false } = {}) {
  const existingInlineCanvas = $('#missionControlContent #mcDrawingCanvas');
  if (existingInlineCanvas) {
    captureDrawingViewport();
    portableDrawingCanvas = existingInlineCanvas;
  }
  const conversation = engine.activeConversation();
  const project = missionControlProject();
  const messages = conversation?.messages || [];
  const historyItems = engine.conversations();
  const projectDocuments = project ? await engine.documents() : [];
  const attachmentNames = new Map(projectDocuments.map(document => [document.id, document.name || document.title || document.id]));
  const drawingSourceIds = new Set((await Promise.all(projectDocuments.filter(isDrawingDocumentRole).map(async document => [document.id, Boolean(await engine.sourceFile(document.id))]))).filter(([, available]) => available).map(([id]) => id));
  const drawingAnalyses = await currentDrawingAnalyses();
  if (!activeWorkPackage) {
    let packageMessageIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) if (messages[index].role === 'assistant' && messages[index].workPackageReferences) { packageMessageIndex = index; break; }
    const promptMessage = packageMessageIndex > 0 ? [...messages.slice(0, packageMessageIndex)].reverse().find(message => message.role === 'user') : null;
    if (promptMessage && project) {
      const reconstructed = await buildActiveConstructionPackage(promptMessage.content);
      if (reconstructed) {
        const expected = new Set(messages[packageMessageIndex].workPackageReferences.matchingSheetIds || []);
        if (reconstructed.planResult.matchingSheetIds.every(id => expected.has(id)) && expected.size === reconstructed.planResult.matchingSheetIds.length) {
          activePlanQuery = reconstructed.planResult; activeWorkPackage = reconstructed.workPackage; activeWorkPackageMessageId = messages[packageMessageIndex].id; drawingMatchingSheetIds = [...reconstructed.planResult.matchingSheetIds];
          chiefConstructionContext = createChiefConstructionContext({ conversationId: conversation.conversationId, projectId: project.id, planResult: activePlanQuery, drawingTarget: activePlanQuery.viewerTarget, workPackageReferences: messages[packageMessageIndex].workPackageReferences, updatedFrom: 'conversation-reconstruction' });
        }
      }
    }
  }
  $('#missionControlContent').innerHTML = `
    <section class="mc-chief-workspace" aria-labelledby="missionControlTitle">
      <header class="mc-chief-workspace-header">
        <div class="mc-chief-workspace-intro">
          <div class="mc-chief-workspace-portrait">
            <img class="mc-chief-status-image" data-chief-image src="${chiefAssets.idle}" alt="Chief, the Mission Companion engineer" />
          </div>
          <div class="mc-chief-workspace-copy">
            <span>CHIEF · ENGINEERING ADVISOR</span>
            <h1 id="missionControlTitle" tabindex="-1">${project ? `Ask Chief about ${esc(project.name)}` : 'Mission Companion'}</h1>
            <p>${project ? `Use the active project context and the latest construction evidence in one persistent workspace.` : 'Create or import a project to begin working with Chief in a single continuous workspace.'}</p>
          </div>
        </div>
        <div class="mc-chief-workspace-questions" aria-label="Suggested construction questions">
          <span>Suggested questions</span>
          <div class="mc-chief-question-list">
            <button type="button" class="mc-chief-question-chip" data-control-prompt="Where is the planned work?">Where is the planned work?</button>
            <button type="button" class="mc-chief-question-chip" data-control-prompt="What drawings apply to this room?">What drawings apply to this room?</button>
            <button type="button" class="mc-chief-question-chip" data-control-prompt="What specifications govern this work?">What specifications govern this work?</button>
            <button type="button" class="mc-chief-question-chip" data-control-prompt="Are there related RFIs or submittals?">Are there related RFIs or submittals?</button>
          </div>
        </div>
      </header>
      <div class="mc-chief-workspace-grid">
        <section class="mc-chief-conversation-panel" aria-label="Chief conversation workspace">
          <div class="mc-chief-conversation-toolbar">
            <div id="chiefStatus" class="mc-chief-status" data-chief-state="idle" role="status" aria-live="polite" aria-atomic="true">
              <img class="mc-chief-status-image" data-chief-image src="${chiefAssets.idle}" alt="Chief, the Mission Companion engineer">
              <span class="mc-chief-status-copy">
                <strong id="chiefStatusLabel">Idle</strong>
                <small id="chiefStatusDetail">Ready to assist</small>
              </span>
            </div>
            <div class="mc-chief-toolbar-actions">
              <button type="button" data-control-action="new-conversation">New Conversation</button>
              <button type="button" class="subtle" data-control-action="show-history">Conversation History</button>
            </div>
          </div>
          <div class="mc-control-messages" role="log" aria-live="polite" aria-label="Chief conversation messages">
            ${chiefLocationPresentationMarkup(activeChiefLocationPresentation)}
            ${messages.length ? (await Promise.all(messages.map(async message => `<article class="mc-control-message ${message.role}" id="mc-message-${esc(message.id)}"><header><strong>${message.role === 'assistant' ? 'Chief' : 'You'}</strong>${message.role === 'assistant' ? `<span>${esc(missionControlResponseModeLabel(message.mode))}</span>` : ''}</header>${constructionWorkPackageMarkup(message)}${message.role === 'assistant' ? chiefDrawingEvidenceMarkup(message, projectDocuments, drawingAnalyses) : ''}<div class="mc-control-message-content">${esc(message.content).replace(/\n/g, '<br>')}</div>${missionControlMessageActions(message, drawingSourceIds)}</article>`))).join('') : `<div class="mc-control-chat-empty"><strong>Start a conversation</strong><p>Ask about the active project or attach supported documents. Answers remain linked to exact source records.</p></div>`}
          </div>
          ${historyVisible ? `<section class="mc-chief-history" aria-labelledby="mcChiefHistoryTitle"><div class="mc-chief-history-header"><div><span>CONVERSATION HISTORY</span><h2 id="mcChiefHistoryTitle">Recent threads</h2></div></div><div class="mc-chief-history-list">${historyItems.length ? historyItems.map(item => `<button type="button" class="mc-chief-history-item" data-conversation-id="${esc(item.conversationId)}"><strong>${esc(item.title || 'Conversation')}</strong><span>${esc(item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Not updated')}</span></button>`).join('') : '<p class="mc-chief-history-empty">No history yet.</p>'}</div></section>` : ''}
          <form id="missionControlComposer" class="mc-control-composer">
            <div class="mc-control-attachments" aria-live="polite">${(conversation?.attachmentDocumentIds || []).map(id => `<span data-attached-document="${esc(id)}">${esc(attachmentNames.get(id) || 'Attached document unavailable')} <button type="button" data-remove-attachment="${esc(id)}" aria-label="Remove attached document">×</button></span>`).join('')}${missionControlAttachments.map(item => `<span class="${esc(item.status)}">${esc(item.name)} · ${esc(item.status)}${item.error ? ` — ${esc(item.error)}` : ''}</span>`).join('')}</div>
            <label for="missionControlPrompt">Your question</label>
            <textarea id="missionControlPrompt" rows="3" placeholder="Ask Chief about your project…"></textarea>
            <div class="mc-chief-composer-actions">
              <div class="mc-chief-composer-tools">
                <label class="mc-control-attach"><input id="missionControlFiles" type="file" multiple accept=".pdf,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.html,.htm,.xml,.log">Attach documents</label>
                <label class="mc-control-mode">Response mode <select id="missionControlMode"><option value="offline">Source-only evidence</option><option value="source">Source-only AI</option><option value="assisted">Expert-assisted AI</option><option value="general">General assistant AI</option></select></label>
              </div>
              <button id="missionControlSend" type="submit">Ask Chief</button>
            </div>
          </form>
        </section>
        <aside class="mc-chief-side-panel" aria-label="Chief project context">
          ${project ? `<section class="mc-chief-context-card"><div><span>ACTIVE PROJECT</span><h2>${esc(project.name)}</h2><p>${esc(project.description || 'Project details and analysis stay available here while you work.')}</p></div><div class="mc-chief-context-actions"><button type="button" data-control-view="plans">Open Drawings</button><button type="button" data-control-view="library">Project Library</button></div></section>` : `<section class="mc-chief-context-card mc-chief-context-card-empty"><div><span>MISSION COMPANION</span><h2>Start with a project</h2><p>Select or create a project to begin construction analysis.</p></div><div class="mc-chief-context-actions"><button type="button" data-control-action="create-project">Create Project</button><button type="button" class="subtle" data-control-action="import-project">Import Project</button></div></section>`}
          ${activeWorkPackage ? `<section class="mc-chief-analysis-card"><div><span>COMMAND DESK ANALYSIS</span><h3>Construction work package</h3><p>${esc(activeWorkPackage.summary || 'A work package is available for review.')}</p></div></section>` : ''}
          ${renderChiefEvidence()}
        </aside>
      </div>
    </section>`;
  $('#missionControlMode').value = state().settings.mode;
  if ($('#chiefStatusImage')) setChiefState($('#chiefStatus')?.dataset.chiefState || 'idle');
  if ($('#missionInlineDrawingViewer') && activeWorkPackage?.presentation?.primaryDrawing) await renderDrawingWorkspace('mission-control');
}

async function renderMissionControlChat() {
  return renderChiefWorkspace({ historyVisible: chiefHistoryVisible });
}

function renderConversationHistory() {
  const projects = new Map(state().projects.map(project => [project.id, project.name]));
  const conversations = engine.conversations();
  $('#missionControlContent').innerHTML = `<section class="mc-control-history" aria-labelledby="missionControlTitle"><header><div><span>CONVERSATION HISTORY</span><h1 id="missionControlTitle" tabindex="-1">Your conversations</h1><p>Open a previous thread or begin a new one. History remains in this browser.</p></div><button data-control-action="new-conversation">New Conversation</button></header>${conversations.length ? `<ol>${conversations.map(conversation => `<li><article><button class="mc-control-history-open" data-conversation-id="${esc(conversation.conversationId)}"><strong>${esc(conversation.title)}</strong><span>${esc(projects.get(conversation.projectId) || 'No project associated')}</span><small>${esc(conversationPreview(conversation))}</small><time datetime="${esc(conversation.updatedAt)}">${conversation.updatedAt ? esc(new Date(conversation.updatedAt).toLocaleString()) : 'Not yet updated'}</time></button><button class="subtle" data-rename-conversation="${esc(conversation.conversationId)}">Rename</button></article></li>`).join('')}</ol>` : missionControlEmpty('No conversation history', 'Start a conversation and it will appear here.')}</section>`;
}

async function renderMissionControlLibrary() {
  const project = missionControlProject();
  const documents = project ? await engine.documents() : [];
  $('#missionControlContent').innerHTML = `<section class="mc-control-library" aria-labelledby="missionControlTitle"><header><div><span>PROJECT LIBRARY</span><h1 id="missionControlTitle" tabindex="-1">Project Library</h1><p>${project ? `Recent source documents for ${esc(project.name)}.` : 'Select a project to browse source documents.'}</p></div><label class="mc-control-attach"><input id="missionControlLibraryFiles" type="file" multiple accept=".pdf,.docx,.xls,.xlsx,.txt,.md,.csv,.json,.html,.htm,.xml,.log">Import documents</label></header>${documents.length ? `<ol>${documents.slice().sort((a,b) => String(b.importedAt || '').localeCompare(String(a.importedAt || ''))).map(document => { const counts = documentIndexCounts(document, []); return `<li><button data-control-source-document="${esc(document.id)}"><strong>${esc(document.title || document.name || document.id)}</strong><span>${esc(documentType(document))} · ${isSpecificationDocument(document) ? `${fmt(counts.sourcePageCount)} pages · ${fmt(counts.specificationSectionCount)} CSI sections · ${fmt(counts.retrievalChunkCount)} retrieval chunks` : `${fmt(document.sectionCount)} indexed records`}</span></button></li>`; }).join('')}</ol>` : missionControlEmpty(project ? 'No documents yet' : 'No project open', project ? 'Import a supported document to populate this project.' : 'Open a project from My Projects first.')}</section>`;
}

async function renderMissionControlInspections() {
  const project = missionControlProject();
  const records = project ? await engine.inspectionRecords({ includeArchived: false }) : [];
  $('#missionControlContent').innerHTML = `<section class="mc-control-library mc-control-inspections" aria-labelledby="missionControlTitle"><header><div><span>INSPECTIONS</span><h1 id="missionControlTitle" tabindex="-1">Inspection Records</h1><p>${project ? `Recorded field work for ${esc(project.name)}.` : 'Select a project to create or review inspections.'}</p></div>${project ? '<button data-control-action="create-inspection">Create Inspection Record</button>' : '<button data-control-view="projects">Open My Projects</button>'}</header>${records.length ? `<ol>${records.map(record => `<li><button data-control-inspection-id="${esc(record.inspectionId)}"><strong>${esc(record.inspectionNumber)} · ${esc(record.title)}</strong><span>${esc(record.status)} · ${esc(record.result)}${record.followUpRequired ? ' · Follow-up required' : ''}</span></button></li>`).join('')}</ol>` : missionControlEmpty(project ? 'No inspections yet' : 'No project open', project ? 'Create the first Inspection Record for this project.' : 'Open a project from My Projects first.')}</section>`;
}

function isPdfDocument(document) {
  return String(document?.mimeType || '').toLowerCase() === 'application/pdf' || String(document?.extension || document?.type || '').toLowerCase().replace(/^\./, '') === 'pdf' || /\.pdf$/i.test(document?.name || '');
}

function drawingStatusCopy(document, source, analysis) {
  if (!source) return { label: 'Original PDF unavailable', detail: 'Reattach the exact original PDF to view its sheets. Extracted text remains available.' };
  if (!analysis) return { label: 'Analysis unavailable', detail: 'The authoritative PDF is stored, but deterministic sheet analysis is unavailable.' };
  return { label: analysis.status || 'Ready for review', detail: `${analysis.sheets.length} sheet${analysis.sheets.length === 1 ? '' : 's'} organized as construction evidence.` };
}

async function currentDrawingAnalyses() {
  const workspaceProjectId = state().activeProject;
  const cachedDrawingAnalyses = currentDrawingAnalysesCache.get(workspaceProjectId);
  if (cachedDrawingAnalyses?.analyses) return cachedDrawingAnalyses.analyses;
  if (cachedDrawingAnalyses?.promise) return cachedDrawingAnalyses.promise;
  reportDrawingMemorySnapshot('alloc-stage', { phase: 'currentDrawingAnalyses:start' });
  const promise = (async () => {
    const analyses = await engine.drawingAnalyses();
    const outcomes = [];
    for (const analysis of analyses) {
      if (!drawingAnalysisRequiresUpgrade(analysis)) {
        const ownership = await engine.drawingLifecycle(analysis.documentId, analysis.drawingSetId);
        outcomes.push(ownership.ok ? { ok: true, analysis } : ownership);
        continue;
      }
      const key = drawingUpgradeKey(analysis, DRAWING_ANALYSIS_VERSION);
      if (drawingUpgradeFailures.has(key)) {
        outcomes.push({ ok: false, status: 'unavailable', errorCode: 'drawing-upgrade-failed', analysis, owningProjectId: analysis.projectId, activeProjectId: workspaceProjectId, warning: 'Analysis upgrade is waiting for a lifecycle issue to be corrected.', recoverable: true, actions: [] });
        continue;
      }
      if (!drawingUpgradeWork.has(key)) drawingUpgradeWork.set(key, (async () => {
        const ownership = await engine.drawingLifecycle(analysis.documentId, analysis.drawingSetId);
        if (!ownership.ok) return ownership;
        const upgraded = upgradeDrawingAnalysis(analysis);
        const saved = await engine.saveDrawingAnalysis(upgraded);
        return saved.ok ? { ...saved, analysis: upgraded } : saved;
      })().catch(error => ({ ok: false, status: 'failed', errorCode: 'drawing-upgrade-failed', analysis, owningProjectId: analysis.projectId, activeProjectId: workspaceProjectId, warning: error.message || 'Drawing analysis upgrade failed.', recoverable: true, actions: [] })).finally(() => drawingUpgradeWork.delete(key)));
      const result = await drawingUpgradeWork.get(key);
      if (!result.ok) drawingUpgradeFailures.add(key);
      outcomes.push(result);
    }
    drawingLifecycleUnavailable = outcomes.filter(item => !item.ok);
    const resolved = outcomes.filter(item => item.ok && item.analysis).map(item => item.analysis);
    reportDrawingMemorySnapshot('alloc-stage', { phase: 'currentDrawingAnalyses:end', analyses: outcomes.length });
    currentDrawingAnalysesCache.set(workspaceProjectId, { analyses: resolved });
    return resolved;
  })();
  currentDrawingAnalysesCache.set(workspaceProjectId, { promise });
  try {
    return await promise;
  } finally {
    if (currentDrawingAnalysesCache.get(workspaceProjectId)?.promise === promise) currentDrawingAnalysesCache.delete(workspaceProjectId);
  }
}

let latestDrawingRegistryInspection = null;

async function currentGlobalDrawingRegistryAnalyses(query = '') {
  const currentState = state();
  const [activeAnalyses, activeDocuments] = await Promise.all([engine.drawingAnalyses(), engine.documents()]);
  const rebuildResults = [];
  const shouldUpgradeForCommand = analysis => analysis.projectId === currentState.activeProject && drawingAnalysisRequiresUpgrade(analysis);
  const refreshed = await loadAuthoritativeDrawingRegistry({
    loadAnalyses: () => engine.drawingRegistryAnalyses(),
    requiresUpgrade: shouldUpgradeForCommand,
    validateOwnership: analysis => engine.drawingLifecycle(analysis.documentId, analysis.drawingSetId),
    rebuild: analysis => upgradeDrawingAnalysis(analysis),
    save: analysis => engine.saveDrawingAnalysis(analysis),
    reloadSaved: async analysis => (await engine.drawingLifecycle(analysis.documentId, analysis.drawingSetId)).analysis,
    upgradeWork: drawingUpgradeWork
  });
  refreshed.results.forEach((result, index) => {
    const analysis = refreshed.initial.filter(shouldUpgradeForCommand)[index];
    if (!analysis) return;
    const key = drawingUpgradeKey(analysis, DRAWING_ANALYSIS_VERSION);
    if (result?.ok) drawingUpgradeFailures.delete(key);
    else drawingUpgradeFailures.add(key);
    const beforeNumbers = new Set((analysis.drawingRegistry || []).map(item => item.normalizedSheetNumber).filter(Boolean));
    const afterNumbers = (result.analysis?.drawingRegistry || []).map(item => item.normalizedSheetNumber).filter(Boolean);
    rebuildResults.push({ drawingSetId: analysis.drawingSetId, documentId: analysis.documentId, projectId: analysis.projectId, ok: Boolean(result.ok), status: result.status || '', errorCode: result.errorCode || '', profileRevisionBefore: analysis.profile?.profileVersion || 0, profileRevisionAfter: result.analysis?.profile?.profileVersion || 0, savedRegistryCount: result.analysis?.drawingRegistry?.length || 0, recoveredRows: afterNumbers.filter(item => !beforeNumbers.has(item)) });
  });
  const available = refreshed.analyses.filter(analysis => !drawingAnalysisRequiresUpgrade(analysis));
  const intent = classifyEngineeringNavigationIntent(query);
  const activeExactMatch = intent.kind === 'exact-drawing-navigation' && available.some(analysis => analysis.projectId === currentState.activeProject && (analysis.drawingRegistry || []).some(item => item.normalizedSheetNumber === intent.value));
  const commandAnalyses = activeExactMatch ? available.filter(analysis => analysis.projectId === currentState.activeProject) : available;
  try {
    latestDrawingRegistryInspection = inspectDrawingRegistryRuntime({ activeProject: currentState.projects.find(project => project.id === currentState.activeProject) || { id: currentState.activeProject, name: currentState.activeProject }, documents: activeDocuments, analyses: commandAnalyses, persistedAnalyses: refreshed.analyses, activeAnalyses, query, rebuild: { attempted: rebuildResults.length > 0, results: rebuildResults } });
  } catch (error) {
    latestDrawingRegistryInspection = { activeProjectId: currentState.activeProject, query, diagnosticError: error.message || 'Runtime registry inspection could not be constructed.', globalAnalysisCount: refreshed.analyses.length, availableAnalysisCount: available.length };
  }
  return commandAnalyses;
}

async function buildActiveConstructionPackage(query, evidence = []) {
  const projectId = state().activeProject;
  if (!projectId || projectId === 'general') return null;
  reportDrawingMemorySnapshot('alloc-stage', { phase: 'buildActiveConstructionPackage:start' });
  const [analyses, documents, sections, inspections] = await Promise.all([
    currentDrawingAnalyses(), engine.documents(), engine.sections(), engine.inspectionRecords({ includeArchived: true })
  ]);
  const conversationId = engine.activeConversation()?.conversationId || '';
  chiefConstructionContext = validateChiefConstructionContext(chiefConstructionContext, { conversationId, projectId, analyses });
  const planResult = buildPlanQuery({ query, projectId, analyses, context: chiefConstructionContext });
  if (!planResult.matchingSheetIds.length) return null;
  const relationshipModel = buildKnowledgeRelationships({ documents, sections });
  const relationships = [...relationshipModel.membership, ...relationshipModel.hierarchy, ...relationshipModel.explicitReferences, ...relationshipModel.reverseReferences, ...relationshipModel.documentReferences];
  const revisions = buildRevisionMetrics({ documents, sections }).comparisons.map(comparison => ({ revisionId: `${comparison.earlierDocument.id}->${comparison.laterDocument.id}`, documentIds: [comparison.earlierDocument.id, comparison.laterDocument.id], status: comparison.status || '' }));
  const workPackage = buildConstructionWorkPackage({ planResult, documents, sections, inspections, relationships, revisions, evidence, workflow: getWorkflowSession()?.workflow });
  reportDrawingMemorySnapshot('alloc-stage', { phase: 'buildActiveConstructionPackage:end', analysisCount: analyses.length, documentCount: documents.length, sectionCount: sections.length, inspectionCount: inspections.length });
  return { planResult, workPackage, analyses, sections };
}

function workPackageGroup(title, items, formatter) {
  if (!items?.length) return '';
  return `<section><h4>${esc(title)}</h4><ol>${items.map(item => `<li>${formatter(item)}${item.reason ? `<small>${esc(item.reason)}</small>` : ''}</li>`).join('')}</ol></section>`;
}

function constructionWorkPackageMarkup(message) {
  const workPackage = activeWorkPackage;
  if (!workPackage || message.role !== 'assistant' || !message.workPackageReferences || message.id !== activeWorkPackageMessageId) return '';
  const sourceOnly = ['offline', 'source'].includes(message.mode);
  const sheetActions = workPackage.responseActions.filter(action => action?.target?.sheetId);
  const currentWorkTarget = currentWorkActivationTarget(workPackage);
  const beforeWork = workPackage.submittals.filter(item => /approved/i.test(item.status || ''));
  const afterWork = workPackage.inspections.filter(item => item.status === 'Follow-Up Required' || item.followUpRequired);
  const primary = workPackage.presentation?.primaryDrawing;
  return `<section class="mc-work-package" aria-labelledby="mcWorkPackage-${esc(message.id)}">
    <header><div><span>CONSTRUCTION WORK PACKAGE</span><h3 id="mcWorkPackage-${esc(message.id)}">${esc([workPackage.discipline, workPackage.room ? `Room ${workPackage.room}` : '', workPackage.building ? `Building ${workPackage.building}` : ''].filter(Boolean).join(' · ') || 'Supported project work')}</h3></div><strong>${sourceOnly ? 'Evidence only' : 'Evidence with separate expert guidance'}</strong></header>
    <section class="mc-work-package-overview"><h4>Work and location</h4><dl><div><dt>Work</dt><dd>${esc(workPackage.workSummary[0]?.statement || 'Exact construction evidence selected')}</dd></div><div><dt>Location</dt><dd>${esc([workPackage.building ? `Building ${workPackage.building}` : '', workPackage.floor, workPackage.room ? `Room ${workPackage.room}` : ''].filter(Boolean).join(' · ') || 'Not resolved')}</dd></div><div><dt>Trade / system</dt><dd>${esc(workPackage.discipline || 'Not resolved')}</dd></div></dl></section>
    ${primary ? `<section class="mc-work-package-primary"><h4>Primary plan</h4><button data-work-package-sheet="${esc(primary.sheetId)}">${esc(sheetActions.find(action => action.target.sheetId === primary.sheetId)?.label || 'Show primary plan')}</button></section>` : ''}
    ${workPackageGroup('Work shown or referenced', workPackage.presentation?.exactPlanEvidence || workPackage.workSummary, item => `<strong>${esc(item.statement)}</strong><span>${esc(item.basis)}${item.quality ? ` · ${esc(item.quality)}` : ''}</span>`)}
    ${workPackageGroup('Related plans', workPackage.presentation?.relatedPlans || [], item => `<button data-work-package-sheet="${esc(item.sheetId)}">${esc(sheetActions.find(action => action.target.sheetId === item.sheetId)?.label || 'Open exact sheet')}</button>`)}
    ${workPackageGroup('Schedules and details', workPackage.presentation?.schedulesDetails || [], item => `<button data-work-package-sheet="${esc(item.sheetId)}">${esc(sheetActions.find(action => action.target.sheetId === item.sheetId)?.label || 'Open exact supporting sheet')}</button>`)}
    ${workPackage.discipline === 'Mechanical' ? `<section class="mc-work-package-mechanical"><h4>Mechanical Work</h4><dl><div><dt>Plans</dt><dd>${fmt(workPackage.drawings.length)}</dd></div><div><dt>Schedules</dt><dd>${fmt(workPackage.schedules.length)}</dd></div><div><dt>Details</dt><dd>${fmt(workPackage.details.length)}</dd></div><div><dt>Observed identifiers</dt><dd>${fmt(activePlanQuery?.matchingObservationIds?.length || 0)}</dd></div></dl><small>Potential coordination is shown only when exact project relationships support it. No routing, quantity, placement, connectivity, room boundary, or clash is asserted.</small></section>` : ''}
    ${workPackageGroup('Supporting requirements', workPackage.specifications, item => `<button data-action-target='${esc(JSON.stringify(createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: item.documentId, sectionId: item.sectionId || '', destination: item.sectionId ? 'knowledge' : 'sources', origin: 'work-package' })))}' data-work-package-target='${esc(JSON.stringify(createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: item.documentId, sectionId: item.sectionId || '', destination: item.sectionId ? 'knowledge' : 'sources', origin: 'work-package' })))}' data-control-source-document="${esc(item.documentId)}" data-control-source-section="${esc(item.sectionId || '')}">Open ${esc(item.title || item.id)}</button>`)}
    ${workPackageGroup('RFIs', workPackage.rfis, item => `<button data-action-target='${esc(JSON.stringify(createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: item.documentId, destination: 'sources', origin: 'work-package' })))}' data-work-package-target='${esc(JSON.stringify(createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: item.documentId, destination: 'sources', origin: 'work-package' })))}' data-control-source-document="${esc(item.documentId)}">Review ${esc(item.title || item.id)}</button><span>${esc(item.status || '')}</span>`)}
    ${workPackageGroup('Submittals', workPackage.submittals, item => `<button data-action-target='${esc(JSON.stringify(createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: item.documentId, destination: 'sources', origin: 'work-package' })))}' data-work-package-target='${esc(JSON.stringify(createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: item.documentId, destination: 'sources', origin: 'work-package' })))}' data-control-source-document="${esc(item.documentId)}">Review ${esc(item.title || item.id)}</button><span>${esc(item.status || '')}</span>`)}
    ${workPackageGroup('Current inspections', workPackage.inspections, item => `<button data-action-target='${esc(JSON.stringify(createActionTarget({ kind: 'inspection', projectId: state().activeProject || '', documentId: item.documentId || '', inspectionId: item.id, origin: 'work-package' })))}' data-work-package-target='${esc(JSON.stringify(createActionTarget({ kind: 'inspection', projectId: state().activeProject || '', documentId: item.documentId || '', inspectionId: item.id, origin: 'work-package' })))}' data-control-inspection-id="${esc(item.id)}">Open ${esc(item.inspectionNumber || item.id)} · ${esc(item.title || '')}</button><span>${esc(item.status)} · ${esc(item.result)}</span>`)}
    ${workPackageGroup('Open issues', workPackage.deficiencies, item => `<button data-action-target='${esc(JSON.stringify(createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: item.documentId, destination: 'sources', origin: 'work-package' })))}' data-work-package-target='${esc(JSON.stringify(createActionTarget({ kind: 'source', projectId: state().activeProject || '', documentId: item.documentId, destination: 'sources', origin: 'work-package' })))}' data-control-source-document="${esc(item.documentId)}">Open ${esc(item.title || item.id)}</button><span>${esc(item.status || '')}</span>`)}
    ${!sourceOnly ? `<section class="mc-work-package-interpretation"><h4>Expert interpretation</h4><p>Review the exact evidence and unresolved candidates before using this package for inspection or coordination decisions.</p></section>${workPackageGroup('Current risks', workPackage.risks, item => `<strong>${esc(item.label)}</strong>`)}` : ''}
    ${!sourceOnly && (beforeWork.length || afterWork.length) ? `<section class="mc-construction-timeline"><h4>Construction Timeline</h4><div>${beforeWork.length ? `<article><span>Before this work</span><ul>${beforeWork.map(item => `<li>Approved submittal: ${esc(item.title || item.id)}</li>`).join('')}</ul></article>` : ''}${afterWork.length ? `<article><span>After this work</span><ul>${afterWork.map(item => `<li>Inspection follow-up: ${esc(item.inspectionNumber || item.id)}</li>`).join('')}</ul></article>` : ''}</div></section>` : ''}
    ${!sourceOnly ? `<section><h4>Inspection preparation</h4><p>${esc(workPackage.inspectionPreparation.nextInspectionStatement)}</p></section>` : ''}
    <section class="mc-work-package-limitations"><h4>Limitations</h4><ul>${workPackage.limitations.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>
    <div class="mc-work-package-actions">${sheetActions.slice(0, 8).map(action => `<button data-action-target='${esc(JSON.stringify(createActionTarget({ kind: 'drawing', projectId: action.target?.projectId || workPackage.projectId || '', documentId: action.target?.documentId || '', drawingSetId: action.target?.drawingSetId || '', drawingId: action.target?.drawingId || '', sheetId: action.target?.sheetId || '', observationId: action.target?.observationId || '', pageNumber: action.target?.pageNumber || null, region: action.target?.region || null, origin: 'work-package' })))}' data-work-package-target='${esc(JSON.stringify(action.target || {}))}'>${esc(action.label)}</button>`).join('')}${!sourceOnly && currentWorkTarget.available ? '<button data-work-package-current>Add to Current Work</button>' : ''}${!sourceOnly && workPackage.projectId ? '<button data-work-package-inspection>Create Inspection</button>' : ''}</div>
    ${primary ? `<section class="mc-inline-plan ${sourceOnly ? 'source-only' : 'expert-assisted'}"><header><div><span>SUPPORTING DRAWING</span><strong>Exact plan evidence</strong></div><button data-inline-full-drawing>Open Full Drawing Workspace</button></header><div id="missionInlineDrawingViewer" class="mc-drawing-workspace" aria-label="Synchronized construction drawing"></div></section>` : ''}
  </section>`;
}

function groupedRoomEvidenceMarkup(roomObservations, sheet) {
  const groups = new Map();
  for (const observation of roomObservations) {
    if (!groups.has(observation.value)) groups.set(observation.value, []);
    groups.get(observation.value).push(observation);
  }
  return [...groups].map(([room, items]) => `<article><strong>Room ${esc(room)}</strong><span>${esc(sheet.discipline)} · ${esc(sheet.sheetNumber || `Page ${sheet.pageNumber}`)}</span><small>${fmt(items.length)} exact text observation${items.length === 1 ? '' : 's'} · ${esc(items[0].verification.status)}</small></article>`).join('');
}

function releaseDrawingSource() {
  drawingViewerEngine.cancelRender();
  if (drawingDeferredWorkspaceRefresh) {
    clearTimeout(drawingDeferredWorkspaceRefresh);
    drawingDeferredWorkspaceRefresh = null;
  }
  if (drawingSearchRefreshTimer) {
    clearTimeout(drawingSearchRefreshTimer);
    drawingSearchRefreshTimer = 0;
  }
  drawingRenderCache.clear();
  drawingRequirementsResultCache.clear();
  drawingRelationshipGraphSummaryCache.clear();
  cancelIdleWork(drawingRelationshipGraphSyncHandle);
  drawingRelationshipGraphSyncHandle = 0;
  drawingRelationshipGraphSyncKey = '';
  clearTrackedResources(['overlay', 'requirement-model', 'relationship-model', 'inspector-model']);
  activeDrawingPdf?.cleanup?.();
  activeDrawingPdf?.destroy?.();
  releaseTrackedResource('pdf-document', activeDrawingPdf, { reason: 'workspace-release' });
  activeDrawingPdf = null;
  activeDrawingDocumentId = '';
  activeDrawingSourceRecord = null;
  activeDrawingResizeObserver?.disconnect();
  activeDrawingResizeObserver = null;
  activeDrawingResizeStage = null;
  activeDrawingRenderIdentity = null;
  portableDrawingCanvas = null;
  activeDrawingViewerAnalysis = null;
  drawingViewerEngine.openDocument('', 0);
  drawingSelectionActiveSheetId = '';
}

function updateDrawingSelectionCards(sheetId = '', { scroll = true } = {}) {
  traceDrawingInteractionStep('updateDrawingSelectionCards', { sheetId, scroll });
  const safeSheetId = String(sheetId || '');
  const previousSheetId = drawingSelectionActiveSheetId;
  drawingSelectionActiveSheetId = safeSheetId;
  const resultsHost = $('#mcDrawingResults');
  const sheetNodes = resultsHost?.__drawingSearchNodesBySheetId || new Map();
  const previousCards = previousSheetId && previousSheetId !== safeSheetId ? sheetNodes.get(previousSheetId) || [] : [];
  const activeCards = safeSheetId ? sheetNodes.get(safeSheetId) || [] : [];
  for (const card of previousCards) {
    card.classList.remove('active', 'keyboard-active');
    card.removeAttribute('aria-current');
  }
  for (const card of activeCards) {
    card.classList.add('active', 'keyboard-active');
    card.setAttribute('aria-current', 'true');
  }
  if (scroll) activeCards[0]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
}

function drawingSearchResultKey(result, index) {
  return `${String(result?.sheetId || '')}:${String(result?.observationId || result?.pageNumber || index)}`;
}

function syncDrawingSearchResultNode(node, result, selectedSheetId, index) {
  if (!node) return null;
  node.innerHTML = drawingSearchResultMarkup(result, selectedSheetId, index);
  node.dataset.drawingResultKey = drawingSearchResultKey(result, index);
  return node;
}

function scheduleDrawingSearchResultsUpdate({ immediate = false } = {}) {
  if (drawingSearchRefreshTimer) {
    clearTimeout(drawingSearchRefreshTimer);
    drawingSearchRefreshTimer = 0;
  }
  if (immediate) {
    void updateDrawingSearchResults();
    return;
  }
  drawingSearchRefreshTimer = setTimeout(() => {
    drawingSearchRefreshTimer = 0;
    void updateDrawingSearchResults();
  }, 80);
}

function updateDrawingNavigationButtons(analysis, sheetId = '') {
  const previous = $('[data-drawing-previous]');
  const next = $('[data-drawing-next]');
  if (!previous || !next || !analysis?.sheets?.length) return;
  const navigationSheetIds = drawingMatchingSheetIds.length ? drawingMatchingSheetIds : analysis.sheets.map(item => item.sheetId);
  const index = navigationSheetIds.indexOf(sheetId);
  previous.disabled = index <= 0;
  next.disabled = index < 0 || index >= navigationSheetIds.length - 1;
}

function scheduleDeferredDrawingWorkspaceRefresh(shell, requestToken) {
  if (drawingSafeMode) return;
  if (drawingDeferredWorkspaceRefresh) clearTimeout(drawingDeferredWorkspaceRefresh);
  drawingDeferredWorkspaceRefresh = setTimeout(() => {
    drawingDeferredWorkspaceRefresh = null;
    if (requestToken !== drawingPagePaintRequest) return;
  }, 80);
}

function syncDrawingOverlaySelectionState(stage = $('#mcDrawingStage')) {
  if (!stage) return;
  for (const item of stage.querySelectorAll('.mc-drawing-object-overlay')) {
    const overlayId = item.dataset.overlayId || '';
    const selectedIndex = selectedDrawingObjectIds.indexOf(overlayId);
    const selected = selectedIndex >= 0;
    item.classList.toggle('selected', selected);
    item.classList.toggle('multi-selected', selectedDrawingObjectIds.length > 1 && selected);
    if (selected) item.dataset.selectionNumber = String(selectedIndex + 1);
    else delete item.dataset.selectionNumber;
  }
}

const HOSTED_BUILDING_61_PDF_PATH = 'project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf';
let hostedDrawingSourcePromise = null;

async function resolveDrawingPdfSource({ analysis, sheet } = {}) {
  const documentId = sheet?.documentId || analysis?.documentId || drawingTarget?.documentId || '';
  const projectId = sheet?.projectId || analysis?.projectId || state().activeProject || '';

  if (!documentId) return null;

  if (
    activeDrawingSourceRecord?.documentId === documentId &&
    activeDrawingSourceRecord?.projectId === projectId &&
    activeDrawingSourceRecord?.sourceBlob
  ) {
    return activeDrawingSourceRecord;
  }

  const storedSource = await engine.sourceFile(documentId);
  if (storedSource?.sourceBlob) {
    activeDrawingSourceRecord = storedSource;
    return storedSource;
  }

  const sourceFilePath =
    sheet?.sourceFilePath ||
    analysis?.sourceFilePath ||
    storedSource?.sourceFilePath ||
    HOSTED_BUILDING_61_PDF_PATH;

  const sourceUrl = new URL(
    sourceFilePath,
    globalThis.document?.baseURI || globalThis.location?.href || 'http://localhost/'
  ).href;

  if (!hostedDrawingSourcePromise) {
    hostedDrawingSourcePromise = globalThis.fetch(sourceUrl)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Hosted drawing PDF could not be loaded (${response.status}).`);
        }

        const sourceBlob = await response.blob();
        if (!sourceBlob.size) {
          throw new Error('Hosted drawing PDF was empty.');
        }

        return {
          ...(storedSource || {}),
          documentId,
          projectId,
          sourceFilePath,
          sourceUrl,
          sourceBlob:
            sourceBlob.type === 'application/pdf'
              ? sourceBlob
              : new Blob([sourceBlob], { type: 'application/pdf' }),
          mimeType: 'application/pdf',
          byteLength: sourceBlob.size
        };
      })
      .catch(error => {
        hostedDrawingSourcePromise = null;
        throw error;
      });
  }

  const hostedSource = await hostedDrawingSourcePromise;
  activeDrawingSourceRecord = hostedSource;
  return hostedSource;
}

async function paintDrawingSelectionFast({ shell, analysis, sheet, observation = null, navigationStartedAt = 0, requestToken = 0, scrollActiveCard = true } = {}) {
  if (!analysis || !sheet) return false;
  tracePdfStage('Stage 1 user selected sheet', { sheetId: sheet.sheetId, pageNumber: sheet.pageNumber });
  traceDrawingInteractionStep('paintDrawingSelectionFast', { pageId: sheet.pageId, pageNumber: sheet.pageNumber, requestToken });
  const selectionStartedAt = drawingPerfNow();
  updateDrawingSelectionCards(sheet.sheetId, { scroll: scrollActiveCard });
  drawingTraceSlowOperation('sheet selection', selectionStartedAt, { stage: 'active-card', pageNumber: sheet.pageNumber });
  const navigationButtonsStartedAt = drawingPerfNow();
  updateDrawingNavigationButtons(analysis, sheet.sheetId);
  drawingTraceSlowOperation('sheet selection', navigationButtonsStartedAt, { stage: 'navigation-buttons', pageNumber: sheet.pageNumber });
  if (navigationStartedAt) logger.debug('Drawing viewer performance', { operation: 'click-to-active-card', durationMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - navigationStartedAt), pageNumber: sheet.pageNumber });
  if (selectedDrawingObject && selectedDrawingObject.pageId !== sheet.pageId) {
    selectedDrawingObject = null;
    selectedDrawingObjectIds = [];
  }
  activeDrawingObjects = [];
  const sourceLookupStartedAt = drawingPerfNow();
  const source = await resolveDrawingPdfSource({ analysis, sheet });
  tracePdfStage('Stage 2 catalog lookup complete', { documentId: analysis.documentId, sheetId: sheet.sheetId, found: Boolean(source) });
  drawingTraceSlowOperation('pdf lookup', sourceLookupStartedAt, { documentId: analysis.documentId, pageNumber: sheet.pageNumber });
  if (requestToken !== drawingPagePaintRequest) return false;
  if (!source) {
    return false;
  }
  tracePdfStage('Stage 3 pdf url resolved', { documentId: source.documentId, hasBlob: Boolean(source.sourceBlob), href: globalThis.location?.href || '' });
  const bitmapStartedAt = drawingPerfNow();
  await paintDrawingPage(source, sheet, observation || null, [], { preserveSidebarScroll: !scrollActiveCard, shell, requestToken });
  drawingTraceSlowOperation('page bitmap creation', bitmapStartedAt, { documentId: source.documentId, pageNumber: sheet.pageNumber });
  if (requestToken !== drawingPagePaintRequest) return false;
  tracePdfStage('Stage 14 requestAnimationFrame completed', { sheetId: sheet.sheetId, pageNumber: sheet.pageNumber });
  if (navigationStartedAt) logger.debug('Drawing viewer performance', { operation: 'click-to-visible-bitmap', durationMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - navigationStartedAt), pageNumber: sheet.pageNumber });
  logger.debug('Drawing viewer performance', { operation: 'navigation', durationMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - navigationStartedAt), pageNumber: sheet.pageNumber });
  return true;
}

async function createRetainedPdfViewerAnalysis(documentRecord, source, requestedPage = 1, metadataAnalysis = null) {
  if (!source?.sourceBlob || !documentRecord?.id || !isDrawingDocumentRole(documentRecord)) return null;
  const pageLoadStartedAt = drawingPerfNow();
  if (!activeDrawingPdf || activeDrawingDocumentId !== source.documentId) {
    activeDrawingPdf?.cleanup?.();
    activeDrawingPdf?.destroy?.();
    activeDrawingPdf = await openPdfBlob(source.sourceBlob);
    activeDrawingDocumentId = source.documentId;
    activeDrawingSourceRecord = source;
    drawingRenderGeneration += 1;
  }
  const pageCount = Math.max(0, Number(activeDrawingPdf.numPages) || 0);
  if (!pageCount) return null;
  const pageNumber = Math.max(1, Math.min(pageCount, Math.trunc(Number(requestedPage) || 1)));
  drawingViewerEngine.openDocument(documentRecord.id, pageCount, pageNumber);
  const page = await activeDrawingPdf.getPage(pageNumber);
  drawingTraceSlowOperation('PDF page load', pageLoadStartedAt, { documentId: documentRecord.id, pageNumber, pageCount });
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  const generatedCatalog = await generatedDrawingCatalogFor(documentRecord,pageCount);
  const catalogRecords = drawingCatalog.reconcile({ documentId: documentRecord.id, documentType: documentRecord.documentType, projectId: documentRecord.projectId || state().activeProject, drawingSetId: metadataAnalysis?.drawingSetId || '', pageCount, parserRecords: [...(metadataAnalysis?.sheets || []), ...(metadataAnalysis?.drawingRegistry || [])], storedMetadata: metadataAnalysis?.pageMetadata || [], authoritativeRecords:generatedCatalog.length?generatedCatalog:building61DrawingCatalogFor(documentRecord,pageCount) });
  const analysis = createPdfPageViewerAnalysis({ documentId: documentRecord.id, documentType: documentRecord.documentType, projectId: documentRecord.projectId || state().activeProject, pageCount, selectedPage: pageNumber, pageWidth: viewport.width, pageHeight: viewport.height, rotation: page.rotate || viewport.rotation || 0, metadataAnalysis, catalogRecords });
  page.cleanup?.();
  return analysis;
}

function captureDrawingViewport(overrides = {}) {
  if (!drawingTarget?.documentId || !drawingTarget?.pageNumber) return;
  const { contextSource = 'viewport-inference', ...viewportOverrides } = overrides;
  traceDrawingInteractionStep('captureDrawingViewport', { contextSource, pageNumber: drawingTarget.pageNumber, documentId: drawingTarget.documentId });
  const current = { ...defaultDrawingViewport(), ...drawingViewerEngine.getViewport(drawingTarget.pageNumber) };
  const stage = $('#mcDrawingStage');
  const canvas = stage?.querySelector('#mcDrawingCanvas');
  const next = { ...current, zoom: drawingZoom, rotation: drawingRotation, scrollLeft: stage?.scrollLeft || current.scrollLeft || 0, scrollTop: stage?.scrollTop || current.scrollTop || 0, selectedObservationId: drawingTarget.observationId || current.selectedObservationId, selectedObjectId: selectedDrawingObject?.objectId || null, selectedObjectIds: [...selectedDrawingObjectIds], highlightedRegion: drawingTarget.region || current.highlightedRegion, ...viewportOverrides, overlays: { ...current.overlays, ...(viewportOverrides.overlays || {}) } };
  drawingViewerEngine.restoreViewport(drawingTarget.pageNumber, next);
  const sheet = activeDrawingViewerAnalysis?.sheets?.find(item => Number(item.pageNumber) === Number(drawingTarget.pageNumber));
  if (sheet?.pageId && stage && canvas) {
    const trade = drawingTradeContext.current({ discipline: sheet.discipline, objectType: selectedDrawingObject?.subtype || selectedDrawingObject?.type, title: sheet.sheetTitle });
    drawingViewportContextService.update({ projectId: drawingTarget.projectId || activeDrawingViewerAnalysis?.projectId, documentId: drawingTarget.documentId, pageId: sheet.pageId, pdfPageNumber: sheet.pageNumber,
      bounds: normalizedViewportBounds({ scrollLeft: Math.max(0, next.scrollLeft - canvas.offsetLeft), scrollTop: Math.max(0, next.scrollTop - canvas.offsetTop), viewportWidth: stage.clientWidth, viewportHeight: stage.clientHeight, contentWidth: canvas.clientWidth || canvas.width, contentHeight: canvas.clientHeight || canvas.height, rotation: drawingRotation }),
      zoom: drawingZoom, rotation: drawingRotation, selectedRegion: next.highlightedRegion || null, selectedRoomId: selectedDrawingObject?.type === 'room' ? selectedDrawingObject.roomId : null, selectedObjectId: selectedDrawingObject?.objectId || null, activeTradeChannel: trade.key, source: contextSource });
  }
}

function captureDrawingSupportReturnState(){
  if(!drawingTarget) return null;
  const currentSheet = activeDrawingViewerAnalysis?.sheets?.find(item => item.pageId === drawingTarget.pageId);
  return{
    target:structuredClone(drawingTarget),
    viewport:drawingViewerEngine.getViewport(drawingTarget.pageNumber),
    selectedObjectId:selectedDrawingObject?.objectId||null,
    selectedObjectIds:[...selectedDrawingObjectIds],
    activeTrade:drawingTradeContext.current()?.key||'',
    coverageReview:{open:drawingCoverageReviewMode,filter:drawingCoverageReviewFilter},
    chiefDock:chiefDrawingDock.state(),
    conversationId:engine.activeConversation()?.conversationId||'',
    panelScroll:$('.mc-drawing-evidence')?.scrollTop||0,
    // Preserve full sheet metadata
    currentSheet: currentSheet ? {
      pageId: currentSheet.pageId,
      sheetId: currentSheet.sheetId,
      sheetNumber: currentSheet.sheetNumber,
      sheetTitle: currentSheet.sheetTitle,
      discipline: currentSheet.discipline,
      primarySheetType: currentSheet.primarySheetType,
      sheetTypes: currentSheet.sheetTypes,
      pageNumber: currentSheet.pageNumber,
      identityStatus: currentSheet.identityStatus
    } : null
  };
}
function restoreDrawingSupportReturnState(){
  if(!specificationDrawingReturnTarget?.target) return false;
  const returnState=specificationDrawingReturnTarget;
  drawingTarget=structuredClone(returnState.target);
  drawingViewerEngine.restoreViewport(drawingTarget.pageNumber,returnState.viewport||{});
  selectedDrawingObjectIds=[...(returnState.selectedObjectIds||[])];
  selectedDrawingObject=returnState.selectedObjectId?projectObjectPresentation(projectObjectRegistry.getObject(returnState.selectedObjectId)):null;
  drawingCoverageReviewMode=Boolean(returnState.coverageReview?.open);
  drawingCoverageReviewFilter=returnState.coverageReview?.filter||'all';
  pendingDrawingPanelScroll=Number(returnState.panelScroll)||0;
  if(returnState.chiefDock?.open)chiefDrawingDock.open();
  else chiefDrawingDock.close();
  chiefDrawingDock.resize(returnState.chiefDock?.width||360);
  if(returnState.chiefDock?.collapsed)chiefDrawingDock.collapse();
  
  // Restore saved sheet metadata if available
  if(returnState.currentSheet && activeDrawingViewerAnalysis) {
    const restoredSheet = activeDrawingViewerAnalysis.sheets?.find(item => item.pageId === returnState.currentSheet.pageId);
    if(restoredSheet) {
      // Ensure drawingTarget points to the correct sheet
      drawingTarget = createDrawingTarget({
        ...drawingTarget,
        sheetId: restoredSheet.sheetId,
        pageNumber: restoredSheet.pageNumber
      });
    }
  }
  
  specificationDrawingReturnTarget=null;
  void showMissionControlView('plans');
  return true;
}

function updateDrawingOverlays(stage, sheet, observation, overlayRecords = []) {
  const overlayStartedAt = drawingPerfNow();
  reportDrawingMemorySnapshot('alloc-stage', { phase: 'updateDrawingOverlays:start', pageNumber: sheet.pageNumber, overlayCount: overlayRecords.length });
  traceDrawingInteractionStep('updateDrawingOverlays', { pageId: sheet.pageId, overlayCount: overlayRecords.length });
  const canvas = stage.querySelector('#mcDrawingCanvas');
  const layer = stage.querySelector('.mc-drawing-overlay-layer');
  if (!canvas || !layer) return;
  const stageWidth = canvas.clientWidth || canvas.width || 1;
  const stageHeight = canvas.clientHeight || canvas.height || 1;
  const viewportRegion = { x: Math.max(0, (stage.scrollLeft || 0) / stageWidth), y: Math.max(0, (stage.scrollTop || 0) / stageHeight), width: Math.min(1, stage.clientWidth / stageWidth), height: Math.min(1, stage.clientHeight / stageHeight) };
  const overlayCache = drawingOverlayNodeCache.get(layer) || new Map();
  drawingOverlayNodeCache.set(layer, overlayCache);
  Object.assign(layer.style, { left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`, width: `${stageWidth}px`, height: `${stageHeight}px` });
  const nextNodes = [];
  const nextKeys = new Set();
  const highlightNode = observation?.region && drawingRotation % 360 === 0 && sheet.rotation % 360 === 0 ? (() => {
    const existing = layer.querySelector('.mc-drawing-highlight');
    const overlay = existing || document.createElement('div');
    overlay.className = 'mc-drawing-highlight';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', `Highlighted ${observationKindLabel(observation.kind)}: ${observation.value}`);
    Object.assign(overlay.style, { left: `${observation.region.x * 100}%`, top: `${observation.region.y * 100}%`, width: `${observation.region.width * 100}%`, height: `${observation.region.height * 100}%` });
    nextNodes.push(overlay);
    return overlay;
  })() : null;
  const current = { ...defaultDrawingViewport(), ...drawingViewerEngine.getViewport(sheet.pageNumber) };
  const records = visibleDrawingOverlays(overlayRecords, { projectId: drawingTarget?.projectId, documentId: drawingTarget?.documentId, pageId: sheet.pageId, visibility: current.overlays, viewportRegion, viewportBuffer: .12, rotation: (sheet.rotation + drawingRotation) % 360, reviewMode: drawingCoverageReviewMode, onDiagnostic: diagnostics => logger.debug('Drawing overlay sanity', { pageId: sheet.pageId, ...diagnostics }) });
  for (const record of records) {
    const key = record.overlayId;
    nextKeys.add(key);
    let overlay = overlayCache.get(key);
    if (!overlay) {
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlayCache.set(key, overlay);
      acquireTrackedResource('overlay', overlay, { pageId: sheet.pageId, overlayId: key, type: record.type });
    } else {
      markTrackedResourceReused('overlay', overlay, { pageId: sheet.pageId, overlayId: key, type: record.type });
    }
    overlay.className = `mc-drawing-object-overlay ${record.verificationState === 'confirmed' ? 'confirmed' : 'candidate'} ${record.type === 'selected' ? 'selected' : ''}`;
    if (record.styleToken) {
      record.styleToken
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .forEach(cls => overlay.classList.add(cls));
    }
    overlay.dataset.overlayLayer = record.type;
    overlay.dataset.overlayId = record.overlayId;
    if (record.metadata?.selected) overlay.dataset.selectionNumber = String(selectedDrawingObjectIds.indexOf(record.overlayId)+1);
    else delete overlay.dataset.selectionNumber;
    overlay.classList.toggle('search-match', Boolean(record.metadata?.searchMatch));
    overlay.classList.toggle('multi-selected', Boolean(record.metadata?.selected));
    overlay.setAttribute('aria-label', `${record.verificationState === 'confirmed' ? 'Confirmed' : 'Candidate'} ${record.label}`);
    overlay.title = record.label;
    Object.assign(overlay.style, overlayStyle(record));
    overlay.onpointerenter = drawingDiagnosticsEnabled ? () => { hoveredDrawingObjectId = record.overlayId; overlay.classList.add('hovered'); logger.debug('Drawing object interaction', { operation:'hover', objectId:record.overlayId }); } : null;
    overlay.onpointerleave = () => { if (hoveredDrawingObjectId === record.overlayId) hoveredDrawingObjectId = ''; overlay.classList.remove('hovered'); };
    nextNodes.push(overlay);
  }
  for (const [key, node] of overlayCache.entries()) {
    if (nextKeys.has(key)) continue;
    if (node.isConnected) node.remove();
    releaseTrackedResource('overlay', node, { pageId: sheet.pageId, overlayId: key, reason: 'overlay-cache-pruned' });
    overlayCache.delete(key);
  }
  layer.replaceChildren(...nextNodes);
  drawingOverlayRenderCount += 1;
  drawingTraceSlowOperation('overlay generation', overlayStartedAt, { renderCount: drawingOverlayRenderCount, pageId: sheet.pageId, totalCount: overlayRecords.length, visibleCount: records.length });
  reportDrawingMemorySnapshot('alloc-stage', { phase: 'updateDrawingOverlays:end', pageNumber: sheet.pageNumber, visibleCount: records.length, overlayCount: overlayRecords.length });
}

async function paintDrawingPage(source, sheet, observation, overlayRecords = [], { preserveSidebarScroll = false, shell = 'professional', requestToken = 0 } = {}) {
  assertDrawingRendererOwnership('invoke first paint');
  const deferEnhancements = Boolean(arguments[4]?.deferEnhancements);
  const paintStartedAt = drawingPerfNow();
  reportDrawingMemorySnapshot('alloc-stage', { phase: 'paintDrawingPage:start', pageNumber: sheet?.pageNumber || 0, overlayCount: overlayRecords.length });
  traceDrawingInteractionStep('paintDrawingPage', { documentId: source?.documentId || '', pageNumber: sheet?.pageNumber || 0, overlayCount: overlayRecords.length });
  const canvas = $('#mcDrawingCanvas');
  const stage = $('#mcDrawingStage');
  if (!canvas || !stage || !source || !sheet) return;
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', 'Interactive drawing canvas. Use arrow keys to change pages, plus or minus to zoom, and zero to reset view.');
  let loadingKey = '';
  const clearCurrentLoading = () => { if (loadingKey && stage.dataset.renderLoadingKey === loadingKey) { stage.classList.remove('is-loading'); delete stage.dataset.renderLoadingKey; } };
  const renderFailureKey = () => [source.documentId, sheet.pageNumber, drawingRenderGeneration, requestToken || 0].join(':');
  try {
    if (requestToken && requestToken !== drawingPagePaintRequest) return;
    updateMissionRenderState(RenderState.LOADING_DOCUMENT, { sheet });
    const pdfLookupStartedAt = drawingPerfNow();
    drawingViewportDocumentId = source.documentId;
    tracePdfStage('Stage 4 pdf.js worker initialized', { workerSrc: globalThis.pdfjsLib?.GlobalWorkerOptions?.workerSrc || '', pdfTraceEnabled, userAgent: navigator.userAgent, baseURI: document.baseURI });
    if (!activeDrawingPdf || activeDrawingDocumentId !== source.documentId) {
      activeDrawingPdf?.cleanup?.();
      updateMissionRenderState(RenderState.LOADING_DOCUMENT, { sheet, lastCleanupReason: 'previous PDF document released' });
      activeDrawingPdf?.destroy?.();
      if (!source.sourceBlob) {
        throw new Error('Drawing PDF source bytes are unavailable.');
      }
      activeDrawingPdf = await openPdfBlob(source.sourceBlob);
      activeDrawingDocumentId = source.documentId;
      activeDrawingSourceRecord = source;
      drawingRenderGeneration += 1;
    }
    drawingTraceSlowOperation('PDF lookup', pdfLookupStartedAt, { documentId: source.documentId, pageNumber: sheet.pageNumber, loaded: Boolean(activeDrawingPdf) });
    tracePdfStage('Stage 5 PDF document loaded', { documentId: source.documentId, numPages: activeDrawingPdf?.numPages || 0 });
    drawingViewerEngine.openDocument(source.documentId, activeDrawingPdf.numPages, sheet.pageNumber);
    updateMissionRenderState(RenderState.LOADING_PAGE, { sheet });
    const viewportRestoreStartedAt = globalThis.performance?.now?.() ?? Date.now();
    const restored = { ...defaultDrawingViewport(), ...drawingViewerEngine.getViewport(sheet.pageNumber) };
    drawingZoom = restored.zoom;
    drawingRotation = restored.rotation;
    const renderPage = await activeDrawingPdf.getPage(sheet.pageNumber);
    const baseViewport = renderPage.getViewport({ scale: 1, rotation: (sheet.rotation + drawingRotation) % 360 });
    renderPage.cleanup?.();
    releaseTrackedResource('pdf-page', renderPage, { pageNumber: sheet.pageNumber, reason: 'layout-measurement' });
    const baseWidth = Number(baseViewport.width) || 0;
    const baseHeight = Number(baseViewport.height) || 0;
    const devicePixelRatio = Math.max(1, Math.min(2, Number(globalThis.devicePixelRatio) || 1));
    const safeScaleCap = Math.min(
      MAX_OUTPUT_SCALE,
      baseWidth > 0 ? MAX_CANVAS_WIDTH / baseWidth : MAX_OUTPUT_SCALE,
      baseHeight > 0 ? MAX_CANVAS_HEIGHT / baseHeight : MAX_OUTPUT_SCALE,
      baseWidth > 0 && baseHeight > 0
        ? Math.sqrt(MAX_RENDER_PIXELS / (baseWidth * baseHeight)) / devicePixelRatio
        : MAX_OUTPUT_SCALE
    );
    const preferredScale = Number.isFinite(drawingZoom) && drawingZoom > 0 ? drawingZoom : 1;
    const intrinsicScale = Math.max(.1, Math.min(Number.isFinite(safeScaleCap) && safeScaleCap > 0 ? safeScaleCap : 1, preferredScale));
    drawingZoom = intrinsicScale;
    tracePdfStage('Stage 7 viewport created', { width: baseWidth * intrinsicScale, height: baseHeight * intrinsicScale, scale: intrinsicScale });
    updateMissionRenderState(RenderState.VIEWPORT_READY, { sheet, viewportWidth: baseWidth * intrinsicScale, viewportHeight: baseHeight * intrinsicScale });
    const viewOutput = stage.closest('.mc-drawing-viewer')?.querySelector('.mc-drawing-toolbar output');
    if (viewOutput) viewOutput.textContent = `${Math.round(intrinsicScale * 100)}% · ${drawingRotation}°`;
    const nextIdentity = createDrawingRenderIdentity({ documentId: source.documentId, drawingSetId: drawingTarget?.drawingSetId, pageNumber: sheet.pageNumber, scale: intrinsicScale, rotation: (sheet.rotation + drawingRotation) % 360, sourceAvailable: true, generation: drawingRenderGeneration });
    const decision = drawingRenderDecision({ previousIdentity: activeDrawingRenderIdentity, nextIdentity, canvas });
    if (decision.repaint) {
      const renderStartedAt = drawingPerfNow();
      const cacheKey = [nextIdentity.documentId, nextIdentity.drawingSetId, nextIdentity.pageNumber, nextIdentity.scale, nextIdentity.rotation, nextIdentity.generation].join(':');
      let renderCanvas = drawingRenderCache.get(cacheKey);
      let renderCanvasCreated = false;
      if (!renderCanvas) {
        renderCanvas = document.createElement('canvas');
        renderCanvasCreated = true;
        acquireTrackedResource('canvas', renderCanvas, { cacheKey, reason: 'render-cache-entry' });
      } else {
        markTrackedResourceReused('canvas', renderCanvas, { cacheKey, reason: 'render-cache-hit' });
      }
      tracePdfStage('Stage 8 canvas created', { width: renderCanvas.width || 0, height: renderCanvas.height || 0 });
      updateMissionRenderState(RenderState.CANVAS_CREATED, { sheet, canvasWidth: renderCanvas.width || 0, canvasHeight: renderCanvas.height || 0, viewportWidth: baseWidth * intrinsicScale, viewportHeight: baseHeight * intrinsicScale });
      loadingKey = cacheKey;
      stage.dataset.renderLoadingKey = loadingKey;
      stage.classList.add('is-loading');
      updateMissionRenderState(RenderState.RENDER_STARTED, { sheet, canvasWidth: renderCanvas.width || 0, canvasHeight: renderCanvas.height || 0, viewportWidth: baseWidth * intrinsicScale, viewportHeight: baseHeight * intrinsicScale });
      const renderOutcome = await drawingViewerEngine.renderSelectedPage(async pageNumber => {
        const renderTarget = await renderPdfPage(activeDrawingPdf, pageNumber, renderCanvas, { scale: intrinsicScale, rotation: nextIdentity.rotation });
        console.info('[pdf-trace]', 'paintDrawingPage render task returned', {
          file: 'src/app.js',
          function: 'paintDrawingPage',
          line: 2458,
          pageNumber,
          hasTask: Boolean(renderTarget?.task),
          hasPromise: Boolean(renderTarget?.promise),
          taskPromiseType: typeof renderTarget?.promise,
          taskPromiseState: renderTarget?.promise ? 'pending-or-settled' : 'missing',
          renderCanvasWidth: renderCanvas.width || 0,
          renderCanvasHeight: renderCanvas.height || 0,
          displayCanvasWidth: canvas.width || 0,
          displayCanvasHeight: canvas.height || 0,
          sameCanvasObject: renderCanvas === canvas
        });
        tracePdfStage('Stage 9 canvas context acquired', { width: renderCanvas.width, height: renderCanvas.height });
        tracePdfStage('Stage 10 renderTask created', { pageNumber });
        return renderTarget;
      });
      console.info('[pdf-trace]', 'paintDrawingPage render outcome before commit', {
        file: 'src/app.js',
        function: 'paintDrawingPage',
        line: 2471,
        pageNumber: sheet.pageNumber,
        committed: Boolean(renderOutcome?.committed),
        cancelled: Boolean(renderOutcome?.cancelled),
        hasTask: Boolean(renderOutcome?.task),
        hasPromise: Boolean(renderOutcome?.task?.promise),
        renderCanvasWidth: renderCanvas.width || 0,
        renderCanvasHeight: renderCanvas.height || 0,
        displayCanvasWidth: canvas.width || 0,
        displayCanvasHeight: canvas.height || 0,
        sameCanvasObject: renderCanvas === canvas
      });
      if (requestToken && requestToken !== drawingPagePaintRequest) {
        if (renderCanvasCreated) releaseTrackedResource('canvas', renderCanvas, { cacheKey, reason: 'render-superseded' });
        renderOutcome.task?.release?.();
        clearCurrentLoading();
        reportDrawingResourceSnapshot('sheet-change', { pageId: sheet.pageId, pageNumber: sheet.pageNumber, phase: 'render-cancelled', renderCount: drawingPdfRenderCount, interactionId: drawingInteractionTrace.id });
        return;
      }
      if (!renderOutcome.committed || !canvas.isConnected || drawingTarget?.pageNumber !== sheet.pageNumber) {
        if (renderCanvasCreated) releaseTrackedResource('canvas', renderCanvas, { cacheKey, reason: 'render-superseded' });
        renderOutcome.task?.release?.();
        clearCurrentLoading();
        reportDrawingResourceSnapshot('sheet-change', { pageId: sheet.pageId, pageNumber: sheet.pageNumber, phase: 'render-cancelled', renderCount: drawingPdfRenderCount, interactionId: drawingInteractionTrace.id });
        return;
      }
      drawingRenderCache.set(cacheKey, renderCanvas);
      tracePdfStage('Stage 12 renderTask.promise resolves', { pageNumber: sheet.pageNumber });
      updateMissionRenderState(RenderState.RENDER_COMPLETED, { sheet, canvasWidth: renderCanvas.width || 0, canvasHeight: renderCanvas.height || 0, viewportWidth: baseWidth * intrinsicScale, viewportHeight: baseHeight * intrinsicScale });
      const bitmapStartedAt = drawingPerfNow();
      canvas.width = renderCanvas.width;
      canvas.height = renderCanvas.height;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(renderCanvas, 0, 0);
      let sampledPixel = null;
      try {
        sampledPixel = Array.from(context.getImageData(10, 10, 1, 1).data);
      } catch (error) {
        sampledPixel = { error: error?.message || String(error) };
      }
      console.info('[pdf-trace]', 'paintDrawingPage canvas sample after render', {
        file: 'src/app.js',
        function: 'paintDrawingPage',
        line: 2484,
        pageNumber: sheet.pageNumber,
        rgba: sampledPixel,
        displayCanvasWidth: canvas.width || 0,
        displayCanvasHeight: canvas.height || 0,
        renderCanvasWidth: renderCanvas.width || 0,
        renderCanvasHeight: renderCanvas.height || 0,
        sameCanvasObject: renderCanvas === canvas,
        canvasConnected: canvas.isConnected,
        renderCanvasConnected: renderCanvas?.isConnected ?? false
      });
      tracePdfStage('Stage 13 canvas inserted into DOM', { width: canvas.width, height: canvas.height, pageNumber: sheet.pageNumber });
      canvas.dataset.drawingDocument = source.documentId;
      canvas.dataset.drawingSet = drawingTarget?.drawingSetId || '';
      canvas.dataset.drawingPage = String(sheet.pageNumber);
      canvas.dataset.renderReason = decision.reason;
      activeDrawingRenderIdentity = nextIdentity;
      clearCurrentLoading();
      stage.querySelector('.mc-drawing-render-error')?.remove();
      updateMissionRenderState(RenderState.CANVAS_PRESENTED, { sheet, canvasWidth: canvas.width, canvasHeight: canvas.height, viewportWidth: baseWidth * intrinsicScale, viewportHeight: baseHeight * intrinsicScale });
      drawingPdfRenderCount += 1;
      drawingTraceSlowOperation('PDF render', renderStartedAt, { renderCount: drawingPdfRenderCount, documentId: source.documentId, pageNumber: sheet.pageNumber, cacheKey });
      drawingTraceSlowOperation('page bitmap creation', bitmapStartedAt, { documentId: source.documentId, pageNumber: sheet.pageNumber, width: canvas.width, height: canvas.height });
      reportDrawingMemorySnapshot('alloc-stage', { phase: 'paintDrawingPage:post-render', pageNumber: sheet.pageNumber, width: canvas.width, height: canvas.height, cacheKey });
      reportDrawingResourceSnapshot('sheet-change', { pageId: sheet.pageId, pageNumber: sheet.pageNumber, phase: 'page-render', renderCount: drawingPdfRenderCount, interactionId: drawingInteractionTrace.id });
    }
    stage.scrollLeft = restored.scrollLeft || 0;
    stage.scrollTop = restored.scrollTop || 0;
    drawingViewerEngine.restoreViewport(sheet.pageNumber, { ...restored, zoom: drawingZoom, rotation: drawingRotation, selectedObservationId: observation?.observationId || restored.selectedObservationId, highlightedRegion: observation?.region || restored.highlightedRegion });
    logger.debug('Drawing viewer performance', { operation: 'viewport-restore', durationMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - viewportRestoreStartedAt), pageNumber: sheet.pageNumber, mode: restored.mode });
    if (!deferEnhancements && !drawingSafeMode) {
      let scrollFrame = 0;
      if (!drawingInteractionTrace.id) startDrawingInteractionTrace('stage-scroll', { pageNumber: sheet.pageNumber });
      drawingInteractionSession.updateContext({ stage, sheet, observation, overlayRecords, shell });
      stage.onscroll = () => {
        drawingInteractionSession.begin('scroll', { stage, sheet, observation, overlayRecords, shell });
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          drawingInteractionSession.settleSoon();
        });
      };
      stage.onwheel = event => {
        if (!drawingInteractionTrace.id) startDrawingInteractionTrace('stage-wheel', { pageNumber: sheet.pageNumber });
        const bounds = stage.getBoundingClientRect();
        const next = drawingWheelZoom({
          deltaY: event.deltaY,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          zoom: drawingZoom,
          scrollLeft: stage.scrollLeft,
          scrollTop: stage.scrollTop,
          pointerX: event.clientX - bounds.left,
          pointerY: event.clientY - bounds.top
        });
        if (!next.recognized) return;
        event.preventDefault();
        drawingZoom = next.zoom;
        stage.scrollLeft = next.scrollLeft;
        stage.scrollTop = next.scrollTop;
        drawingInteractionSession.begin('zoom', { stage, sheet, observation, overlayRecords, shell });
        drawingInteractionSession.updateViewport({ zoom: next.zoom, scrollLeft: next.scrollLeft, scrollTop: next.scrollTop });
        drawingInteractionSession.scheduleFrame(() => applyDrawingInteractionViewport(stage, next.zoom, drawingRotation));
        drawingInteractionSession.settleSoon();
      };
      stage.ondblclick = event => {
        if (!drawingInteractionTrace.id) startDrawingInteractionTrace('stage-doubleclick', { pageNumber: sheet.pageNumber });
        if (event.target.closest('.mc-drawing-object-overlay')) return;
        event.preventDefault();
        const bounds = stage.getBoundingClientRect();
        const next = drawingViewerEngine.zoomAtPoint({ deltaY: -140, pointerX: event.clientX - bounds.left, pointerY: event.clientY - bounds.top, pageNumber: sheet.pageNumber });
        drawingZoom = next.zoom;
        stage.scrollLeft = next.scrollLeft;
        stage.scrollTop = next.scrollTop;
        applyDrawingInteractionViewport(stage, next.zoom, drawingRotation);
        drawingInteractionSession.begin('zoom', { stage, sheet, observation, overlayRecords, shell });
        drawingInteractionSession.updateViewport({ zoom: next.zoom, scrollLeft: next.scrollLeft, scrollTop: next.scrollTop });
        drawingInteractionSession.settleSoon();
      };
      stage.onpointerdown = event => { if (event.button !== 0 || event.target.closest('button')) return; stage.setPointerCapture?.(event.pointerId); };
      stage.onpointermove = event => { if (!event.buttons) return; stage.scrollLeft = stage.scrollLeft; stage.scrollTop = stage.scrollTop; };
      stage.onpointerup = () => {};
      stage.onpointercancel = () => {};
      stage.onkeydown = event => {
        if (event.key === '0') { event.preventDefault(); stage.closest('.mc-drawing-viewer')?.querySelector('[data-drawing-reset-view]')?.click(); }
      };
      if (!drawingSafeMode) updateDrawingOverlays(stage, sheet, observation, overlayRecords);
    }
    drawingTraceSlowOperation('workspace render', paintStartedAt, { documentId: source.documentId, pageNumber: sheet.pageNumber });
    if (!deferEnhancements && !drawingSafeMode) {
      const activeCard = stage.closest('.mc-drawing-workspace')?.querySelector(`[data-drawing-page-id="${CSS.escape(sheet.pageId || '')}"]`);
      if (!preserveSidebarScroll) activeCard?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      if (globalThis.__MC_DEV_ASSERTIONS__) assertDrawingPageConsistency({ selectedPage: drawingViewerEngine.snapshot().selectedPage, renderedPage: Number(canvas.dataset.drawingPage), targetPage: drawingTarget?.pageNumber, toolbarPage: sheet.pageNumber, activePage: Number(activeCard?.dataset.drawingPageNumber) });
      if (!drawingSafeMode && globalThis.ResizeObserver && activeDrawingResizeStage !== stage) {
        activeDrawingResizeObserver?.disconnect();
        activeDrawingResizeObserver = new ResizeObserver(() => {
          console.info('[pdf-trace]', 'ResizeObserver fired', { file: 'src/app.js', function: 'paintDrawingPage', line: 2504, pageNumber: sheet.pageNumber });
          if (!drawingResizeRenderIsCurrent({ observedStage: stage, activeStage: activeDrawingResizeStage, observedPage: sheet.pageNumber, selectedPage: drawingTarget?.pageNumber })) return;
          const current = { ...defaultDrawingViewport(), ...drawingViewerEngine.getViewport(sheet.pageNumber) };
          if (current.mode === 'fit-page' || current.mode === 'fit-width') applyDrawingInteractionViewport(stage, drawingZoom, drawingRotation);
        });
        activeDrawingResizeObserver.observe(stage);
        activeDrawingResizeStage = stage;
      }
    }
    markFirstPaint();
    reportDrawingMemorySnapshot('alloc-stage', { phase: 'paintDrawingPage:end', pageNumber: sheet?.pageNumber || 0 });
  } catch (error) {
    const cancellationMessage = String(error?.message || error || '');
    const cancelledRender = error?.name === 'RenderingCancelledException' || error?.name === 'AbortError' || /cancel/i.test(cancellationMessage);
    if (cancelledRender || (requestToken && requestToken !== drawingPagePaintRequest)) {
      clearCurrentLoading();
      reportDrawingResourceSnapshot('sheet-change', { pageId: sheet.pageId, pageNumber: sheet.pageNumber, phase: 'render-cancelled', renderCount: drawingPdfRenderCount, interactionId: drawingInteractionTrace.id });
      return;
    }
    console.error('[pdf-trace]', 'paintDrawingPage failed', {
      file: 'src/app.js',
      function: 'paintDrawingPage',
      line: 2541,
      pageNumber: sheet?.pageNumber || 0,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    clearCurrentLoading();
    if (requestToken && requestToken !== drawingPagePaintRequest) return;
    if (drawingTarget?.documentId !== source.documentId || drawingTarget?.pageNumber !== sheet.pageNumber) return;
    const failureKey = renderFailureKey();
    if (drawingPageRenderFailureKeys.has(failureKey)) return;
    drawingPageRenderFailureKeys.add(failureKey);
    stage.classList.remove('is-loading');
    stage.querySelector('.mc-drawing-render-error')?.remove();
    updateMissionRenderState(RenderState.FAILED, { sheet, lastError: error?.message || String(error), lastCleanupReason: 'render failure' });
    canvas.insertAdjacentHTML('afterend', `<div class="mc-drawing-render-error" role="status"><strong>Drawing page could not be updated.</strong><p>${esc(error.message)}</p><small>The previously rendered sheet remains available when possible.</small></div>`);
  }
}

async function renderDrawingFirstPaint(source, sheet, observation, { preserveSidebarScroll = false, shell = 'professional', requestToken = 0 } = {}) {
  return globalThis.__mcDrawingFirstPaint(source, sheet, observation, [], { preserveSidebarScroll, shell, requestToken, deferEnhancements: true });
}
globalThis.__mcDrawingFirstPaint = paintDrawingPage;

function drawingSearchResultMarkup(result, selectedSheetId, index) {
  if (result.sheet.viewerFallback) return `<li><button data-drawing-page-id="${esc(result.sheet.pageId)}" data-drawing-page-number="${result.pageNumber}" data-drawing-sheet="${esc(result.sheetId)}" data-drawing-result-index="${index}" class="${result.sheetId === selectedSheetId ? 'active' : ''} ${index === drawingSearchActiveIndex ? 'keyboard-active' : ''}" ${index === drawingSearchActiveIndex ? 'aria-current="true"' : ''}><strong>${esc(result.sheet.sheetNumber || `Page ${result.pageNumber}`)}</strong><span>${esc(result.sheet.sheetTitle || 'Retained PDF page')}</span><small><i data-discipline="${esc(result.sheet.discipline || 'Unknown')}"></i>${esc(result.sheet.discipline || 'Unknown')} · PDF page ${result.pageNumber}</small>${result.matchedReason ? `<em>${esc(result.matchedReason)}</em>` : ''}</button></li>`;
  const warnings = result.sheet.warnings?.length ? `${result.sheet.warnings.length} identity warning${result.sheet.warnings.length === 1 ? '' : 's'}` : 'Identity supported';
  return `<li><button data-drawing-page-id="${esc(result.sheet.pageId)}" data-drawing-page-number="${result.pageNumber}" data-drawing-sheet="${esc(result.sheetId)}" data-drawing-search-observation="${esc(result.observationId)}" data-drawing-result-index="${index}" class="${result.sheetId === selectedSheetId ? 'active' : ''} ${index === drawingSearchActiveIndex ? 'keyboard-active' : ''}" ${index === drawingSearchActiveIndex ? 'aria-current="true"' : ''}><strong>${esc(result.sheet.sheetNumber || 'Identity requires review')}</strong><span>${esc(result.sheet.sheetTitle || 'Title requires review')}</span><small><i data-discipline="${esc(result.sheet.discipline)}"></i>${esc(result.sheet.discipline)} · ${esc(result.primarySheetType)} · ${result.sheet.building ? `Building ${esc(result.sheet.building)} · ` : ''}Page ${result.pageNumber}</small><small>${Math.round((result.sheet.confidence || 0) * 100)}% identity confidence · ${esc(warnings)}</small>${result.matchedReason ? `<em>${esc(result.matchedReason)}</em>` : ''}</button></li>`;
}

async function updateDrawingSearchResults() {
  const startedAt = globalThis.performance?.now?.() ?? Date.now();
  traceDrawingInteractionStep('updateDrawingSearchResults', { pageId: drawingTarget?.pageId || '', documentId: drawingTarget?.documentId || '' });
  const revision = ++drawingSearchRevision;
  const activeAnalysis = activeDrawingViewerAnalysis?.documentId === drawingTarget?.documentId ? activeDrawingViewerAnalysis : null;
  const analysis = activeAnalysis || (drawingTarget?.documentId ? await engine.drawingAnalysis(drawingTarget.documentId) : null);
  const resultsHost = $('#mcDrawingResults');
  const status = $('#mcDrawingResultStatus');
  if (revision !== drawingSearchRevision || !analysis || !resultsHost || !status) return;
  const results = searchDrawingSheets({ query: drawingFilter, discipline: drawingDiscipline, sheetType: drawingType, analysis });
  drawingMatchingSheetIds = results.map(item => item.sheetId);
  const selection = reconcileDrawingSelection(drawingMatchingSheetIds, drawingTarget?.sheetId);
  drawingSearchActiveIndex = selection.index;
  status.textContent = drawingSearchSummary(drawingFilter, results.length);
  const nodeCache = resultsHost.__drawingSearchNodeCache || (resultsHost.__drawingSearchNodeCache = new Map());
  const nodesBySheetId = new Map();
  const nextNodes = [];
  if (results.length) {
    for (const [index, result] of results.entries()) {
      const key = drawingSearchResultKey(result, index);
      let node = nodeCache.get(key);
      if (!node) {
        node = document.createElement('li');
        node.innerHTML = drawingSearchResultMarkup(result, drawingTarget?.sheetId, index);
        nodeCache.set(key, node);
      } else {
        syncDrawingSearchResultNode(node, result, drawingTarget?.sheetId, index);
      }
      nextNodes.push(node);
      if (!nodesBySheetId.has(result.sheetId)) nodesBySheetId.set(result.sheetId, []);
      nodesBySheetId.get(result.sheetId).push(node.firstElementChild || node.querySelector('button'));
    }
    resultsHost.replaceChildren(...nextNodes);
  } else {
    resultsHost.replaceChildren(Object.assign(document.createElement('li'), { className: 'mc-drawing-no-results', innerHTML: '<strong>No drawing evidence found.</strong><span>Try a sheet number, room, trade, equipment tag, or clear the active filters.</span>' }));
  }
  resultsHost.__drawingSearchNodesBySheetId = nodesBySheetId;
  $('[data-drawing-clear-search]')?.toggleAttribute('hidden', !drawingFilter);
  updateDrawingSelectionCards(drawingTarget?.sheetId || '', { scroll: false });
  logger.debug('Drawing viewer performance', { operation: 'search', durationMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - startedAt), resultCount: results.length });
}

function observationButtons(items, sheet) {
  return items.slice(0, 30).map(item => `<li><button data-drawing-observation="${esc(item.observationId)}"><strong>${esc(observationKindLabel(item.kind))}</strong><span>${esc(item.value)}</span><small>${esc(sheet.sheetNumber || `Page ${sheet.pageNumber}`)} · ${esc(item.verification.status)}</small><em>Show on Plan</em></button></li>`).join('');
}

function sheetAnalysisMarkup({ shell, analysis, sheet, observation, groups, warnings }) {
  if (!sheet) return '<p>Select a supported sheet to review its construction evidence.</p>';
  const related = (analysis?.sheets || []).filter(item => item.sheetId !== sheet.sheetId && item.discipline === sheet.discipline).slice(0, 8);
  return `<h3>Construction Evidence</h3>
    <p class="mc-drawing-limitation">Graphical association has not been verified. These findings are exact drawing text and metadata evidence.</p>
    ${groups.rooms.length ? `<section><h4>Rooms</h4><ol>${groups.rooms.map(group => `<li><button data-drawing-observation="${esc(group.observationIds[0])}"><strong>Room ${esc(group.roomNumber)}</strong><span>Appears ${fmt(group.count)} time${group.count === 1 ? '' : 's'} on this sheet</span><small>${esc(group.verificationStates.join(', '))}</small><em>Show locations</em></button></li>`).join('')}</ol></section>` : '<section class="mc-drawing-quiet"><h4>Rooms</h4><p>No exact room labels were classified on this sheet.</p></section>'}
    ${groups.equipment.length ? `<section><h4>Equipment and tags</h4><ol>${observationButtons(groups.equipment, sheet)}</ol></section>` : ''}
    ${groups.schedulesAndDetails.filter(item => /schedule/i.test(item.value)).length ? `<section><h4>Schedules</h4><ol>${observationButtons(groups.schedulesAndDetails.filter(item => /schedule/i.test(item.value)), sheet)}</ol></section>` : ''}
    ${groups.schedulesAndDetails.filter(item => /detail/i.test(item.value)).length ? `<section><h4>Details</h4><ol>${observationButtons(groups.schedulesAndDetails.filter(item => /detail/i.test(item.value)), sheet)}</ol></section>` : ''}
    ${groups.references.length ? `<section><h4>Callouts</h4><ol>${observationButtons(groups.references, sheet)}</ol></section>` : ''}
    ${related.length ? `<section><h4>Related sheets</h4><ol>${related.map(item => `<li><button data-drawing-sheet="${esc(item.sheetId)}"><strong>${esc(item.sheetNumber || 'Number unavailable')}</strong><span>${esc(item.sheetTitle || 'Title unavailable')}</span><small>${esc(item.primarySheetType || item.sheetTypes?.[0] || 'Unknown')}</small></button></li>`).join('')}</ol></section>` : ''}
    ${warnings.userFacing.length ? `<section class="mc-drawing-warning-list"><h4>Needs attention</h4><ul>${warnings.userFacing.slice(0, 12).map(item => `<li><span aria-hidden="true">!</span>${esc(item.message)}</li>`).join('')}</ul></section>` : ''}
    ${observation ? `<section class="mc-drawing-selected-observation"><h4>Selected observation</h4><strong>${esc(observationKindLabel(observation.kind))}: ${esc(observation.value)}</strong><span>${esc(observation.verification.status)}</span>${shell === 'professional' ? `<div aria-label="Verify selected observation"><button class="subtle" data-drawing-verify="Confirmed" data-observation-id="${esc(observation.observationId)}">Confirm ${esc(observationKindLabel(observation.kind))}</button><button class="subtle" data-drawing-verify="Corrected" data-observation-id="${esc(observation.observationId)}">Correct observed value</button><button class="subtle" data-drawing-verify="Uncertain" data-observation-id="${esc(observation.observationId)}">Mark uncertain</button><button class="subtle" data-drawing-verify="Rejected" data-observation-id="${esc(observation.observationId)}">Reject observation</button></div>` : ''}</section>` : ''}
    <details class="mc-drawing-analysis-details"><summary>Analysis details</summary><dl><div><dt>Identity method</dt><dd>${esc(sheet.sheetNumberResolutionMethod || 'Unavailable')}</dd></div><div><dt>Title method</dt><dd>${esc(sheet.sheetTitleResolutionMethod || 'Unavailable')}</dd></div><div><dt>Discipline reason</dt><dd>${esc(sheet.disciplineEvidence || 'Unavailable')}</dd></div><div><dt>Evidence confidence</dt><dd>${Math.round(sheet.confidence * 100)}%</dd></div></dl>${sheet.rejectedSheetNumberCandidates?.length ? `<h5>Identity candidates requiring review</h5><ul>${sheet.rejectedSheetNumberCandidates.slice(0, 20).map(item => `<li>${esc(item.value)} — ${esc(item.reason)}</li>`).join('')}</ul>` : ''}${warnings.technical.length ? `<h5>Technical warnings</h5><ul>${warnings.technical.slice(0, 20).map(item => `<li>${esc(item.message)}</li>`).join('')}</ul>` : ''}${shell === 'professional' ? '<button data-drawing-analyze-page>Analyze Page Objects</button>' : ''}</details>`;
}

function drawingContextMarkup(context, selectedObject = null, choices = [], specificationLinks = []) {
  const records = (items, empty = 'No linked data.') => items?.length
    ? `<ul>${items.map(item => `<li>${esc(item.label || item.title || item.name || item.id || 'Linked record')}</li>`).join('')}</ul>`
    : `<p>${esc(empty)}</p>`;
  const page = context?.page || {};
  const issues = [...(context?.issues || []), ...(context?.risks || []), ...(context?.questions || [])];
  const duplicateObjects = selectedObject ? projectObjectRegistry.possibleDuplicates(selectedObject.objectId) : [];
  return `<div class="mc-drawing-page-context" aria-label="Selected drawing page context">
    <section><h3>Summary</h3><dl><div><dt>Sheet</dt><dd>${esc(page.sheetNumber || `Page ${page.pdfPageNumber || ''}`)}</dd></div><div><dt>Discipline</dt><dd>${esc(page.discipline || 'Unknown')}</dd></div><div><dt>Drawing type</dt><dd>${esc(page.drawingType || 'Unknown')}</dd></div></dl></section>
    <section><h3>Selected Object</h3>${selectedObject ? `<strong>${esc(selectedObject.label)}</strong><dl><div><dt>Permanent ID</dt><dd>${esc(selectedObject.objectId)}</dd></div><div><dt>Tag</dt><dd>${esc(selectedObject.tag || 'Unavailable')}</dd></div><div><dt>Type</dt><dd>${esc(selectedObject.type)}</dd></div><div><dt>Trade</dt><dd>${esc(selectedObject.trade || 'Unknown')}</dd></div><div><dt>System</dt><dd>${esc(selectedObject.system || 'Unavailable')}</dd></div><div><dt>Room</dt><dd>${esc(selectedObject.roomId || 'Unavailable')}</dd></div><div><dt>State</dt><dd>${esc(selectedObject.verificationState)}</dd></div><div><dt>Confidence</dt><dd>${Math.round((selectedObject.confidence || 0) * 100)}%</dd></div></dl><p>${esc(selectedObject.evidenceText || 'No additional evidence text.')}</p>${validNormalizedRegion(selectedObject.region) ? '<button data-drawing-object-location>Show Location</button>' : '<p>Location not verified.</p>'}<div><button data-project-object-confirm>Confirm Object</button>${selectedObject.verificationState === 'candidate' ? '<button data-project-object-reject>Reject Candidate</button>' : ''}<button data-project-object-edit>Edit Object</button><button data-project-object-adjust-region>Adjust Region</button><button data-project-object-alias>Add Alias</button>${duplicateObjects.length ? '<button data-project-object-merge>Merge Objects</button><button data-project-object-keep-separate>Keep Separate</button>' : ''}${selectedObject.mergedObjectIds?.length ? '<button data-project-object-split>Split Incorrect Merge</button>' : ''}<button data-project-object-history>View History</button><button class="subtle" data-drawing-clear-object>Clear Selection</button></div>` : choices.length ? `<p>Multiple drawing objects overlap this location.</p><ol>${choices.map(item => `<li><button data-drawing-select-object="${esc(item.objectId)}">${esc(item.label)}</button></li>`).join('')}</ol>` : `<p>No verified object identified.</p>${validNormalizedRegion(drawingTarget?.region) ? '<button data-project-object-create>Create Project Object</button>' : ''}`}${drawingLocationReturnViewport ? '<button class="subtle" data-drawing-return-location>Return to Previous View</button>' : ''}</section>
    <section><h3>Specifications</h3>${specificationLinks.length ? `<ul>${specificationLinks.filter(item => item.status !== 'rejected').map(item => `<li><strong>${esc(item.sectionNumber)} — ${esc(item.sectionTitle)}</strong><span>${esc(item.status)}</span><button data-drawing-open-spec="${esc(item.linkId)}">Open Section</button>${item.status === 'suggested' ? `<button data-drawing-confirm-spec="${esc(item.linkId)}">Confirm Link</button><button data-drawing-reject-spec="${esc(item.linkId)}">Reject Suggestion</button>` : ''}</li>`).join('')}</ul>` : records(context?.specifications, 'No linked specifications.')}${selectedObject ? '<button class="subtle" data-drawing-link-spec>Link Specification</button>' : ''}</section>
    <section><h3>Related Drawings</h3>${records(context?.relatedDrawings, 'No related drawings.')}</section>
    <section><h3>Inspection Items</h3>${records(context?.inspectionItems)}</section>
    <section><h3>Equipment</h3>${records(context?.equipment)}</section>
    <section><h3>Rooms</h3>${records(context?.rooms)}</section>
    <section><h3>Photos</h3>${records(context?.photos)}</section>
    <section><h3>Documents</h3>${records(context?.documents)}</section>
    <section><h3>Issues</h3>${records(issues)}</section>
    <section><h3>History</h3>${records(context?.history)}</section>
  </div>`;
}

function projectObjectPresentation(item) {
  return item ? { ...item, documentId: item.drawingDocumentId, pageId: item.drawingPageId, type: item.objectType, subtype: item.objectSubtype, region: item.graphicalRegion, evidenceText: item.sourceText } : null;
}

function constructionIntelligencePanelMarkup(model) {
  const degraded = model.status === 'partial' ? '<p class="mc-ci-warning" role="status">Some construction intelligence is temporarily unavailable.</p>' : model.status === 'unavailable' ? '<p class="mc-ci-warning" role="status">Construction intelligence is unavailable for this page.</p>' : '';
  const loading = model.status === 'loading' ? '<p class="mc-ci-loading" role="status">Loading governing requirements…</p>' : '';
  const group = (key, title, content, { force = false } = {}) => !force && !content ? '' : `<details class="mc-ci-group" data-ci-group="${esc(key)}" ${constructionIntelligenceExpanded.has(key) ? 'open' : ''}><summary><span>${esc(title)}</span><span aria-hidden="true">⌄</span></summary><div class="mc-ci-group-body">${content || ''}</div></details>`;
  const recordList = items => `<ul class="mc-ci-record-list">${items.map(item => `<li><strong>${esc(item.label)}</strong>${item.relationship ? `<span class="mc-ci-badge">${esc(item.relationship.verificationState)}</span>` : ''}${item.target ? `<button data-project-relationship-open="${esc(item.relationship.relationshipId)}">Open</button>` : ''}</li>`).join('')}</ul>`;
  const relationshipGroups = groups => Object.entries(groups || {}).filter(([, items]) => items?.length).map(([title, items]) => `<div class="mc-ci-subgroup"><h5>${esc(title.replace(/([A-Z])/g, ' $1'))}</h5>${recordList(items)}</div>`).join('');
  const specificationCards = items => `<ol class="mc-ci-specifications">${items.map(item => `<li><div><strong>${esc(item.sectionNumber)}</strong><span>${esc(item.sectionTitle)}</span></div><div class="mc-ci-spec-meta"><span class="mc-ci-badge ${esc(item.displayStatus)}">${esc(item.displayStatus)}</span><span>${Math.round((Number(item.confidence) || 0) * 100)}% confidence</span><span>Origin: ${esc(item.evidenceSource || item.origin || 'Unknown')}</span></div>${item.reason ? `<p class="mc-ci-spec-reason">Reason: ${esc(item.reason)}</p>` : ''}${item.evidence?.length ? `<details class="mc-ci-evidence"><summary>Supporting evidence (${fmt(item.evidence.length)})</summary><ul>${item.evidence.map(evidence => `<li><strong>${esc(evidence.evidenceType || evidence.source || 'Drawing evidence')}</strong><span>${esc(evidence.evidenceText || evidence.text || '')}</span></li>`).join('')}</ul></details>` : item.evidenceText ? `<div class="mc-ci-evidence"><strong>${esc(item.evidenceSource || 'Drawing evidence')}</strong><p>${esc(item.evidenceText)}</p></div>` : ''}<div class="mc-ci-actions">${item.canShowSource ? `<button data-object-spec-source="${esc(item.specificationDocumentId)}" data-object-spec-page="${item.sourcePageNumber}" data-object-spec-section="${esc(item.sectionNumber)}">View Source</button>` : ''}${item.status === 'suggested' && item.relationshipId ? `<button data-project-relationship-confirm="${esc(item.relationshipId)}">Confirm</button><button data-project-relationship-reject="${esc(item.relationshipId)}">Reject</button>` : item.status === 'suggested' && item.drawingSpecLinkId ? `<button data-drawing-confirm-spec="${esc(item.drawingSpecLinkId)}">Confirm</button><button data-drawing-reject-spec="${esc(item.drawingSpecLinkId)}">Reject</button>` : ''}</div></li>`).join('')}</ol>`;
  const fieldWork = groups => groups.map(group => `<div class="mc-ci-work-phase"><h5>${esc(group.phase)}</h5><ul>${group.items.map(item => `<li><span aria-hidden="true">□</span><div><strong>${esc(item.label)}</strong><small>${esc(item.sectionNumber)} · ${esc(item.sectionTitle)}</small></div></li>`).join('')}</ul></div>`).join('');
  const compactFacts = items => `<dl class="mc-ci-facts">${items.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>`;
  const compactList = (items, { empty = '', title = '', detail = item => item.detail || item.reason || item.evidenceText || item.verificationState || '', label = item => item.label || item.title || item.sectionNumber || item.value || item.name || item.identifier || item.referenceNumber || item.reference || 'Item' } = {}) => items?.length ? `${title ? `<h5>${esc(title)}</h5>` : ''}<ul class="mc-ci-record-list">${items.map(item => `<li><strong>${esc(label(item))}</strong>${detail(item) ? `<span>${esc(detail(item))}</span>` : ''}${item.relationship ? `<span class="mc-ci-badge">${esc(item.relationship.verificationState)}</span>` : ''}${item.target ? `<button data-project-relationship-open="${esc(item.relationship.relationshipId)}">Open</button>` : ''}</li>`).join('')}</ul>` : empty;
  const countGrid = items => items?.length ? `<div class="mc-ci-counts">${items.map(([label, count]) => `<div><strong>${fmt(count)}</strong><span>${esc(label)}</span></div>`).join('')}</div>` : '';
  if (model.status === 'loading') {
    const page = model.page || {};
    const object = model.object || {};
    const label = model.mode === 'object' ? esc(object.name || 'Selected object') : esc(page.sheet || 'Selected drawing page');
    const detail = model.mode === 'object' ? esc(object.location || '') : `${esc(page.sheet || '')}${page.sheetTitle ? ` · ${esc(page.sheetTitle)}` : ''}`;
    return `<div class="mc-construction-intelligence" data-panel-mode="${esc(model.mode || 'page')}" data-intelligence-status="loading"><header><span>CONSTRUCTION WORKSPACE</span><h3>${model.mode === 'object' ? 'Object Inspector' : 'Sheet Inspector'}</h3><p>${detail || label}</p>${loading}</header></div>`;
  }
  if (model.mode === 'page') {
    const page = model.page;
    const counts = Object.entries(page.objectCounts || {});
    const confirmed = Array.isArray(model?.specifications?.confirmed) ? model.specifications.confirmed : [];
    const suggested = Array.isArray(model?.specifications?.suggested) ? model.specifications.suggested : [];
    const rejected = Array.isArray(model?.specifications?.rejected) ? model.specifications.rejected : [];
    const specs = [...confirmed, ...suggested];
    
    // Diagnostic display for specification links lookup
    const specLinksDiagnostic = model.specLinksDiagnostic;
    let diagnosticContent = '';
    if (specLinksDiagnostic) {
      if (specLinksDiagnostic.linksFound === 0) {
        diagnosticContent = `<div class="mc-ci-spec-diagnostic"><h5>Specification Links Lookup Diagnostic</h5><dl class="mc-ci-facts">
          <dt>Page ID</dt><dd>${esc(specLinksDiagnostic.pageId || 'NULL')}</dd>
          <dt>Specification Links Found</dt><dd>${specLinksDiagnostic.linksFound}</dd>
        </dl><h6>Lookup Result</h6><ul class="mc-ci-record-list">
          <li><span aria-hidden="true">${!specLinksDiagnostic.drawingSpecLinksAvailable ? '✓' : '□'}</span>No links exist for this page (drawingSpecificationLinks not available)</li>
          <li><span aria-hidden="true">${!specLinksDiagnostic.hasPageId ? '✓' : '□'}</span>PageId mismatch (pageId is NULL or empty)</li>
          <li><span aria-hidden="true">${specLinksDiagnostic.drawingSpecLinksAvailable && specLinksDiagnostic.hasPageId && specLinksDiagnostic.linksFound === 0 ? '✓' : '□'}</span>No links exist for this pageId in database</li>
          <li><span aria-hidden="true">${specLinksDiagnostic.confirmedCount === 0 && specLinksDiagnostic.suggestedCount === 0 ? '✓' : '□'}</span>Requirements resolver returned empty</li>
        </ul></div>`;
      } else {
        diagnosticContent = `<div class="mc-ci-spec-diagnostic"><h5>Specification Links Lookup Diagnostic</h5><dl class="mc-ci-facts">
          <dt>Page ID</dt><dd>${esc(specLinksDiagnostic.pageId)}</dd>
          <dt>Number of links</dt><dd>${specLinksDiagnostic.linksFound}</dd>
          <dt>Number of confirmed requirements</dt><dd>${specLinksDiagnostic.confirmedCount}</dd>
          <dt>Number of suggested requirements</dt><dd>${specLinksDiagnostic.suggestedCount}</dd>
        </dl></div>`;
      }
    }
    
    const governedRequirements = confirmed.length || suggested.length
      ? `${confirmed.length ? `<section class="mc-ci-specification-set"><h4>Confirmed Specifications</h4>${specificationCards(confirmed)}</section>` : ''}${suggested.length ? `<section class="mc-ci-specification-set"><h4>Suggested Specifications</h4>${specificationCards(suggested)}</section>` : ''}`
      : '<p>No governing specifications were found for this sheet.</p>';
    const metadata = compactFacts([
      ['Building', page.building || 'Not identified'],
      ['Drawing set', page.drawingSet || page.drawing || 'Not identified'],
      ['Sheet number', page.sheet],
      ['Sheet title', page.sheetTitle],
      ['Discipline', page.discipline],
      ['Drawing type', page.drawingType],
      ['PDF page', page.pdfPage ? `Page ${page.pdfPage}` : 'Not available'],
      ['Revision / issue', page.revision || page.issue || 'Not identified']
    ]);
    const evidence = `${countGrid([['Identified rooms', page.objectCounts?.room || 0], ...counts.filter(([label]) => label !== 'room')])}${compactList(page.schedules, { title: 'Schedules found' })}${compactList(page.legends, { title: 'Legends found' })}${compactList(page.keyedNotes, { title: 'Keyed notes found' })}${compactList(page.references, { title: 'Explicit references found' })}`;
    const related = `${compactList(page.relatedDrawings, { title: 'Related drawings' })}${compactList(page.relatedDetails, { title: 'Related details' })}`;
    const warnings = `${compactList(page.warnings, { title: 'Warnings' })}${compactList(page.unresolvedEvidence, { title: 'Unresolved evidence' })}`;
    const specCounts = `<div class="mc-ci-spec-counts"><small>Confirmed Specifications: ${confirmed.length} · Suggested Specifications: ${suggested.length} · Rejected Specifications: ${rejected.length}</small></div>`;
    const sourceFooter = `<div class="mc-ci-source-footer"><small>Source: Drawing Specification Relationship Engine</small></div>`;
    return `<div class="mc-construction-intelligence" data-panel-mode="page" data-intelligence-status="${esc(model.status)}"><header><span>CONSTRUCTION WORKSPACE</span><h3>Sheet Inspector</h3><p>${esc(page.sheet)} · ${esc(page.sheetTitle || page.discipline)}</p>${degraded}</header>
      ${group('sheet-metadata', 'Sheet Metadata', metadata, { force: true })}
      ${group('sheet-evidence', 'Sheet Evidence', evidence, { force: true })}
      ${group('specifications', 'Governing Requirements', governedRequirements + diagnosticContent + specCounts, { force: true })}
      ${group('related-drawings', 'Related Drawings and Details', related)}
      ${group('warnings', 'Warnings and Unresolved Evidence', warnings)}
      ${sourceFooter}
      ${model.diagnostics.length ? `<details class="mc-ci-developer" data-ci-group="developer-diagnostics" hidden><summary>Developer Diagnostics</summary></details>` : ''}</div>`;
  }
  const object = model.object;
  const confirmed = Array.isArray(model?.specifications?.confirmed) ? model.specifications.confirmed : [];
  const suggested = Array.isArray(model?.specifications?.suggested) ? model.specifications.suggested : [];
  const specs = [...confirmed, ...suggested];
  const governedRequirements = confirmed.length || suggested.length
    ? `${confirmed.length ? `<section class="mc-ci-specification-set"><h4>Confirmed Specifications</h4>${specificationCards(confirmed)}</section>` : ''}${suggested.length ? `<section class="mc-ci-specification-set"><h4>Suggested Specifications</h4>${specificationCards(suggested)}</section>` : ''}`
    : '<p>No governing specifications were identified for this sheet.</p>';
  const objectHeader = compactFacts([
    ['Object type', object.type],
    ['Name', object.name],
    ['Room / location', object.room || object.location],
    ['Source sheet', object.sourceSheet],
    ['Verification state', object.statusLabel],
    ['Evidence source', object.evidenceSource],
    ['Bounding region', object.regionSummary],
    ['Selection count', object.selectionCount > 1 ? `${fmt(object.selectionCount)} selected` : '']
  ]);
  const evidence = `${compactList(object.schedules, { title: 'Related schedules' })}${compactList(object.legends, { title: 'Related legends' })}${compactList(object.keyedNotes, { title: 'Related keyed notes' })}${compactList(object.references, { title: 'Related details / callouts' })}${compactList(object.relatedDetails, { title: 'Related details / callouts' })}`;
  const related = `${compactList(model.relatedDrawings, { title: 'Related drawings' })}${compactList(model.relatedObjects, { title: 'Related objects' })}${compactList(object.unresolvedRelationships, { title: 'Unresolved relationships' })}`;
  const warnings = `${compactList(object.warnings, { title: 'Warnings' })}${compactList(object.unresolvedRelationships, { title: 'Unresolved relationships' })}`;
  return `<div class="mc-construction-intelligence" data-panel-mode="object" data-intelligence-status="${esc(model.status)}" data-project-object-id="${esc(object.objectId)}" data-project-relationship-source="${esc(model.sourceEntityId)}"><header><span>CONSTRUCTION WORKSPACE</span><h3>Object Inspector</h3><p>${object.room ? `Room ${esc(object.room)} · ` : ''}${esc(object.sourceSheet)}</p>${degraded}</header>
    ${group('object-metadata', 'Object Metadata', objectHeader, { force: true })}
    ${group('object-evidence', 'Object Evidence', evidence)}
    ${group('specifications', 'Governing Requirements', governedRequirements, { force: true })}
    ${group('object-relationships', 'Related Objects and Relationships', related)}
    ${group('warnings', 'Warnings and Unresolved Relationships', warnings)}
    ${model.diagnostics.length ? `<details class="mc-ci-developer" data-ci-group="developer-diagnostics" hidden><summary>Developer Diagnostics</summary></details>` : ''}</div>`;
}

function constructionIntelligencePanelSignature(model = {}) {
  const summary = model.mode === 'page'
    ? {
      mode: model.mode,
      status: model.status,
      drawingSet: model.page?.drawingSet || '',
      sheet: model.page?.sheet || '',
      sheetTitle: model.page?.sheetTitle || '',
      drawingType: model.page?.drawingType || '',
      pdfPage: model.page?.pdfPage || 0,
      revision: model.page?.revision || '',
      issue: model.page?.issue || '',
      pageStatus: model.page?.pageStatus || '',
      drawingNotes: model.page?.drawingNotes?.length || 0,
      objectCounts: model.page?.objectCounts || {},
      schedules: model.page?.schedules?.length || 0,
      legends: model.page?.legends?.length || 0,
      keyedNotes: model.page?.keyedNotes?.length || 0,
      references: model.page?.references?.length || 0,
      relatedDrawings: model.page?.relatedDrawings?.length || 0,
      relatedDetails: model.page?.relatedDetails?.length || 0,
      warnings: model.page?.warnings?.length || 0,
      unresolvedEvidence: model.page?.unresolvedEvidence?.length || 0,
      governedWork: model.constructionSummary?.governedWork || [],
      specCounts: [model.specifications?.confirmed?.length || 0, model.specifications?.suggested?.length || 0],
      fieldRequirements: model.fieldRequirements?.length || 0,
      fieldWork: model.fieldWork?.map(group => `${group.phase}:${group.items.length}`) || [],
      relatedDrawings: model.relatedDrawings?.length || 0,
      projectInformation: Object.fromEntries(Object.entries(model.projectInformation || {}).map(([key, value]) => [key, value?.length || 0])),
      chief: model.chiefRecommendation?.text || '',
      diagnostics: model.diagnostics?.length || 0
    }
    : {
      mode: model.mode,
      status: model.status,
      objectId: model.object?.objectId || '',
      objectName: model.object?.name || '',
      verificationState: model.object?.verificationState || '',
      statusLabel: model.object?.statusLabel || '',
      location: model.object?.location || '',
      sourceSheet: model.object?.sourceSheet || '',
      evidenceSource: model.object?.evidenceSource || '',
      regionSummary: model.object?.regionSummary || '',
      confidence: model.object?.confidence || 0,
      selectionCount: model.object?.selectionCount || 1,
      hasLocation: Boolean(model.object?.hasLocation),
      hasPossibleDuplicates: Boolean(model.object?.hasPossibleDuplicates),
      hasMergedObjects: Boolean(model.object?.hasMergedObjects),
      canLinkSpecification: Boolean(model.object?.canLinkSpecification),
      schedules: model.object?.schedules?.length || 0,
      legends: model.object?.legends?.length || 0,
      keyedNotes: model.object?.keyedNotes?.length || 0,
      references: model.object?.references?.length || 0,
      relatedDetails: model.object?.relatedDetails?.length || 0,
      warnings: model.object?.warnings?.length || 0,
      unresolvedRelationships: model.object?.unresolvedRelationships?.length || 0,
      specCounts: [model.specifications?.confirmed?.length || 0, model.specifications?.suggested?.length || 0],
      fieldRequirements: model.fieldRequirements?.length || 0,
      fieldWork: model.fieldWork?.map(group => `${group.phase}:${group.items.length}`) || [],
      history: model.history?.length || 0,
      relatedDrawings: model.relatedDrawings?.length || 0,
      relatedObjects: model.relatedObjects?.length || 0,
      pmis: Object.fromEntries(Object.entries(model.pmis || {}).map(([key, value]) => [key, value?.length || 0])),
      documents: Object.fromEntries(Object.entries(model.documents || {}).map(([key, value]) => [key, value?.length || 0])),
      projectStatus: Object.fromEntries(Object.entries(model.projectStatus || {}).map(([key, value]) => [key, value?.length || 0])),
      chief: model.chiefRecommendation?.text || '',
      diagnostics: model.diagnostics?.length || 0,
      sourceEntityId: model.sourceEntityId || ''
    };
  return JSON.stringify(summary);
}

function drawingRequirementsIndexVersion() {
  try {
    return (specificationIndex?.documents?.() || []).map(item => `${item.documentId}:${item.indexedAt || ''}`).sort().join('|');
  } catch {
    return '';
  }
}

function drawingRequirementsCacheKey({ projectId = '', documentId = '', drawingSetId = '', pageId = '', selectedObjectId = '', evidenceVersion = '' } = {}) {
  return [projectId, drawingRequirementsIndexVersion(), documentId, drawingSetId, pageId, selectedObjectId, evidenceVersion].map(value => String(value || '')).join('::');
}

function relationshipGroupsMarkup(groups, sourceEntityId = '') {
  const render = (title, items, empty, actionKind = '') => `<section><h3>${title}</h3>${items?.length ? `<ol>${items.map(item => {
    const entity = item.entity; const relationship = item.relationship;
    const navigation = actionKind === 'specification' && entity.metadata?.navigationTarget ? `<button data-project-relationship-open="${esc(relationship.relationshipId)}">Open Specification</button>` : actionKind === 'drawing' && entity.metadata?.navigationTarget ? `<button data-project-relationship-open="${esc(relationship.relationshipId)}">Open Drawing</button>` : '';
    return `<li><strong>${esc(entity.label)}</strong><span>${esc(relationship.verificationState)} · ${esc(relationship.relationshipType)}</span>${navigation}${relationship.verificationState === 'suggested' ? `<button data-project-relationship-confirm="${esc(relationship.relationshipId)}">Confirm Relationship</button><button data-project-relationship-reject="${esc(relationship.relationshipId)}">Reject Suggestion</button>` : ''}${relationship.evidence?.length ? `<details><summary>Review Evidence</summary><ul>${relationship.evidence.map(evidence => `<li>${esc(evidence.sourceText || evidence.confidenceReason || evidence.evidenceType)}</li>`).join('')}</ul></details>` : ''}</li>`;
  }).join('')}</ol>` : `<p>${esc(empty)}</p>`}</section>`;
  return `<div class="mc-project-relationship-context" data-project-relationship-source="${esc(sourceEntityId)}">
    <h3>Project Relationships</h3>
    ${render('Confirmed Specifications', groups?.confirmedSpecifications, 'No confirmed specification relationships.', 'specification')}
    ${render('Suggested Specifications', groups?.suggestedSpecifications, 'No suggested specification relationships.', 'specification')}
    ${render('Related Drawings', groups?.relatedDrawings, 'No related drawings.', 'drawing')}
    ${render('Rooms', groups?.rooms, 'No related rooms.')}${render('Equipment', groups?.equipment, 'No related equipment.')}
    ${render('Inspections', groups?.inspections, 'No related inspections.')}${render('Photos', groups?.photos, 'No related photos.')}
    ${render('Issues', groups?.issues, 'No related issues.')}${render('Risks', groups?.risks, 'No related risks.')}
    ${render('RFIs', groups?.rfis, 'No related RFIs.')}${render('Submittals', groups?.submittals, 'No related submittals.')}
    ${render('Shutdowns', groups?.shutdowns, 'No related shutdowns.')}${render('Commissioning', groups?.commissioning, 'No related commissioning records.')}
    ${render('History', groups?.history, 'No relationship history records.')}
    ${groups?.providerErrors?.length ? '<p>Some relationship providers are unavailable. Available relationships remain shown.</p>' : ''}
    ${sourceEntityId ? '<button class="subtle" data-project-relationship-link>Link Related Record</button>' : ''}
  </div>`;
}

function chiefDrawingDockMarkup(cards=[]){const dock=chiefDrawingDock.state(),conversation=engine.activeConversation(),messages=conversation?.messages||[];return`<aside class="mc-chief-drawing-dock ${dock.open?'open':''} ${dock.collapsed?'collapsed':''}" style="--chief-dock-width:${dock.width}px" aria-label="Chief drawing copilot" ${dock.open?'':'hidden'}><header><div><span>CHIEF · CURRENT DRAWING</span><strong>${esc(activeChiefDrawingContext?.identity?.sheetNumber||'Drawing context')}</strong></div><div><button class="subtle" data-chief-dock-collapse>${dock.collapsed?'Expand':'Collapse'}</button><button class="subtle" data-chief-dock-close aria-label="Close Chief">×</button></div></header>${dock.collapsed?'':`<div class="mc-chief-dock-messages" role="log" aria-live="polite">${messages.slice(-30).map(message=>`<article class="${message.role}"><strong>${message.role==='assistant'?'Chief':'You'}</strong><p>${esc(message.content).replace(/\n/g,'<br>')}</p></article>`).join('')||'<p>Ask Chief about the visible drawing, selected item, or governing requirements.</p>'}${cards.length?`<div class="mc-chief-drawing-cards">${cards.map(card=>`<article><span>${esc(card.cardType)}</span><strong>${esc(card.title)}</strong><small>${esc(card.subtitle)}</small>${card.actions.map(action=>`<button data-chief-card-action="${esc(action.actionId)}" data-chief-card-target='${esc(JSON.stringify(action.target))}'>${esc(drawingActionRouter.definition(action.actionId)?.label||'Open')}</button>`).join('')}</article>`).join('')}</div>`:''}</div><form id="chiefDrawingDockComposer"><label for="chiefDrawingDockPrompt">Ask about this drawing</label><textarea id="chiefDrawingDockPrompt" rows="3" placeholder="What governs this?"></textarea><div><button type="submit" id="chiefDrawingDockSend">Ask Chief</button></div></form><label class="mc-chief-dock-resize">Dock width<input type="range" min="280" max="620" value="${dock.width}" data-chief-dock-width></label><p class="mc-chief-dock-context-status">${activeChiefDrawingContext?.status==='partial'?'Some drawing context is temporarily unavailable.':'Using the active drawing, viewport, selection, graph, and indexed requirements.'}</p>`}</aside>`;}
function refreshChiefDrawingDockMessages(){const container=$('.mc-chief-drawing-dock:not([hidden]) .mc-chief-dock-messages'),conversation=engine.activeConversation();if(!container)return;container.innerHTML=(conversation?.messages||[]).slice(-30).map(message=>`<article class="${message.role}"><strong>${message.role==='assistant'?'Chief':'You'}</strong><p>${esc(message.content).replace(/\n/g,'<br>')}</p></article>`).join('');container.scrollTop=container.scrollHeight;}

function drawingRequirementsMarkup({ sheet, viewportContext, trade, visibleRooms = [], selectedObject, result } = {}) {
  const requirementCards = items => items?.length ? `<ol>${items.map(item => `<li><strong>${esc(item.sectionNumber)} — ${esc(item.sectionTitle)}</strong><span>${esc(item.applicabilityScope)} · ${esc(item.status)}</span><p>${esc(item.reason)}</p><button data-requirement-open="${esc(item.specificationDocumentId)}" data-requirement-section="${esc(item.sectionNumber)}">Open Source</button>${item.status === 'suggested' && item.relationshipId ? `<button data-project-relationship-confirm="${esc(item.relationshipId)}">Confirm Link</button><button data-project-relationship-reject="${esc(item.relationshipId)}">Reject Suggestion</button>` : item.status === 'suggested' && item.drawingSpecLinkId ? `<button data-drawing-confirm-spec="${esc(item.drawingSpecLinkId)}">Confirm Link</button><button data-drawing-reject-spec="${esc(item.drawingSpecLinkId)}">Reject Suggestion</button>` : ''}</li>`).join('')}</ol>` : '<p>No supported requirements in this context.</p>';
  const field = Object.entries(result?.fieldRequirements || {}).filter(([, items]) => items.length);
  return `<div class="mc-drawing-requirements" aria-label="Drawing-centered requirements">
    <section><h3>Current Context</h3><dl><div><dt>Building</dt><dd>${esc(sheet?.building || 'Unavailable')}</dd></div><div><dt>Sheet</dt><dd>${esc(sheet?.sheetNumber || `Page ${sheet?.pageNumber || ''}`)}</dd></div><div><dt>Room or region</dt><dd>${viewportContext?.selectedRoomId ? esc(viewportContext.selectedRoomId) : viewportContext?.selectedRegion ? 'Selected drawing region' : 'Page context'}</dd></div><div><dt>Selected object</dt><dd>${esc(selectedObject?.label || 'None')}</dd></div><div><dt>Active trade</dt><dd>${esc(trade?.label || 'All Trades')} · ${esc(trade?.status || 'default')}</dd></div><div><dt>Context confidence</dt><dd>${selectedObject?.verificationState === 'confirmed' || viewportContext?.selectedRoomId ? 'Confirmed selection' : viewportContext?.selectedRegion ? 'Selected region candidate' : 'Page context'}</dd></div></dl>
      <label>Trade channel<select data-drawing-trade>${DRAWING_TRADE_CHANNELS.map(item => `<option value="${esc(item.key)}" ${item.key === trade?.key ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select></label>
      ${visibleRooms.length ? `<p>${esc(visibleRooms[0].label || visibleRooms[0].roomNumber)} is visible in the current view.</p><button data-drawing-use-visible-room="${esc(visibleRooms[0].objectId)}">Use Visible Room</button>` : ''}
      <button class="subtle" data-drawing-select-region>${drawingRegionSelectionMode ? 'Click the drawing to place region' : 'Select Region'}</button>${viewportContext?.selectedRegion ? '<button class="subtle" data-drawing-clear-region>Clear Region</button>' : ''}<button class="subtle" data-requirement-return>Return to Drawing View</button>
    </section>
    <section><h3>Governing Drawings</h3>${result?.governingDrawings?.length ? `<ol>${result.governingDrawings.map(item => `<li><strong>${esc(item.entity.label)}</strong><span>${esc(item.reason)}</span>${item.entity.metadata?.navigationTarget ? `<button data-requirement-open-drawing="${esc(item.entity.entityId)}">Open Drawing</button>` : ''}</li>`).join('')}</ol>` : '<p>No related governing drawings.</p>'}</section>
    <section><h3>Applicable Specifications — Confirmed</h3>${requirementCards(result?.confirmedSpecifications)}</section>
    <section><h3>Applicable Specifications — Suggested</h3>${requirementCards(result?.suggestedSpecifications)}</section>
    <section><h3>Field Requirements</h3>${field.length ? `<ul>${field.map(([key, items]) => `<li><strong>${esc(key)}</strong><span>${fmt(items.length)} exact indexed requirement${items.length === 1 ? '' : 's'}</span></li>`).join('')}</ul>` : '<p>No linked field-requirement articles.</p>'}</section>
    <section><h3>Project-Wide Requirements</h3>${requirementCards(result?.projectWideRequirements)}</section>
    ${result?.warnings?.length ? `<section><h3>Context Limitations</h3><ul>${result.warnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>` : ''}
  </div>`;
}

function synchronizeActiveDrawingRelationships({ projectId, document, analysis, sheet, objects = [], specificationLinks = [] } = {}) {
  if (!projectId || !document?.id || !sheet?.pageId) return { sourceEntityId: '', groups: relationshipContextGroups(projectRelationshipEngine, '') };
  const projectEntityId = `project:${projectId}`;
  const documentEntityId = `document:${document.id}`;
  const drawingSetEntityId = `drawing-set:${analysis?.drawingSetId || document.id}`;
  const pageEntityId = `drawing-page:${sheet.pageId}`;
  projectRelationshipEngine.registerEntities([
    { entityId: projectEntityId, projectId, entityType: 'project', label: state().projects.find(item => item.id === projectId)?.name || projectId, verificationState: 'confirmed', origin: 'system' },
    { entityId: documentEntityId, projectId, entityType: 'document', sourceDocumentId: document.id, label: document.title || document.name || document.id, verificationState: 'confirmed', origin: 'imported', metadata: { documentType: 'drawing-set' } },
    { entityId: drawingSetEntityId, projectId, entityType: 'drawing-set', sourceDocumentId: document.id, label: document.title || document.name || analysis?.drawingSetId, verificationState: 'confirmed', origin: 'imported' },
    { entityId: pageEntityId, projectId, entityType: 'drawing-page', sourceDocumentId: document.id, sourcePageId: sheet.pageId, normalizedKey: sheet.normalizedSheetNumber || sheet.sheetNumber, label: sheet.sheetNumber ? `${sheet.sheetNumber} — ${sheet.sheetTitle || 'Title unavailable'}` : `Page ${sheet.pageNumber}`, verificationState: sheet.identityStatus === 'authoritative' ? 'confirmed' : 'suggested', origin: sheet.identityStatus === 'manual' ? 'manual' : 'parser', metadata: { navigationTarget: createDrawingTarget({ projectId, documentId: document.id, drawingSetId: analysis?.drawingSetId, drawingId: sheet.drawingId, sheetId: sheet.sheetId, pageId: sheet.pageId, pageNumber: sheet.pageNumber }) } },
    ...objects.map(object => ({ entityId: `drawing-object:${object.objectId}`, projectId, entityType: object.type === 'room' ? 'room' : object.type === 'equipment' ? 'equipment' : 'drawing-object', sourceDocumentId: document.id, sourcePageId: sheet.pageId, sourceObjectId: object.objectId, normalizedKey: object.tag || object.label, label: object.label, verificationState: object.verificationState === 'confirmed' ? 'confirmed' : object.verificationState === 'rejected' ? 'rejected' : 'suggested', origin: object.identitySource === 'manual' ? 'manual' : 'parser', metadata: { region: object.region, objectType: object.type, subtype: object.subtype } }))
  ]);
  const importedLink = (sourceEntityId, targetEntityId, relationshipType) => projectRelationshipEngine.registerRelationship({ projectId, sourceEntityId, targetEntityId, relationshipType, verificationState: 'confirmed', origin: 'imported' });
  importedLink(documentEntityId, projectEntityId, 'belongs-to');
  importedLink(drawingSetEntityId, documentEntityId, 'belongs-to');
  importedLink(drawingSetEntityId, pageEntityId, 'contains');
  const objectEntityIds = new Map();
  for (const object of objects) {
    const objectEntityId = `drawing-object:${object.objectId}`;
    objectEntityIds.set(object.objectId, objectEntityId);
    projectRelationshipEngine.registerRelationship({ projectId, sourceEntityId: pageEntityId, targetEntityId: objectEntityId, relationshipType: 'contains', verificationState: object.verificationState === 'confirmed' ? 'confirmed' : 'suggested', origin: object.identitySource === 'manual' ? 'manual' : 'parser', sourceDocumentId: document.id, sourcePageId: sheet.pageId, sourceObjectId: object.objectId,
      evidence: object.identitySource === 'manual' ? [] : [{ evidenceType: 'drawing-observation', sourceText: object.evidenceText, sourceObservationId: object.sourceObservationIds?.[0], graphicalRegion: object.region, sourceDocumentId: document.id, sourcePageId: sheet.pageId, confidenceReason: object.acceptanceReason || 'Deterministic drawing-object evidence.' }] });
  }
  for (const link of specificationLinks) {
    const section = specificationIndex.get(link.specificationDocumentId, link.sectionNumber);
    if (!section || section.projectId !== projectId) continue;
    projectRelationshipEngine.registerEntity({ entityId: `specification-section:${section.documentId}:${section.normalizedSectionNumber}`, projectId, entityType: 'specification-section', sourceDocumentId: section.documentId, normalizedKey: section.normalizedSectionNumber, label: `${section.sectionNumber} — ${section.sectionTitle}`, verificationState: 'confirmed', origin: 'imported', metadata: { navigationTarget: drawingSpecificationLinks.openTarget(link), startPdfPage: section.startPdfPage, endPdfPage: section.endPdfPage } });
  }
  adaptDrawingSpecificationLinks(projectRelationshipEngine, specificationLinks, { pageEntityId, objectEntityIds });
  const sourceEntityId = selectedDrawingObject ? objectEntityIds.get(selectedDrawingObject.objectId) : pageEntityId;
  const graphNodeId = selectedDrawingObject?.objectId || pageEntityId;
  const syncKey = [projectId, document.id, sheet.pageId, sourceEntityId, objects.length, specificationLinks.length].join(':');
  if (drawingRelationshipGraphSyncKey !== syncKey) {
    drawingRelationshipGraphSyncKey = syncKey;
    cancelIdleWork(drawingRelationshipGraphSyncHandle);
    drawingRelationshipGraphSyncHandle = scheduleIdleWork(() => {
      drawingRelationshipGraphSyncHandle = 0;
      if (drawingRelationshipGraphSyncKey !== syncKey) return;
      try {
        constructionGraph.adaptRelationshipEngine(projectId);
        constructionGraph.adaptObjectRegistry(projectId);
        const summary = constructionGraph.getConstructionSummary(graphNodeId);
        if (summary) drawingRelationshipGraphSummaryCache.set(graphNodeId, summary);
      } catch (error) {
        logger.warning('Construction intelligence provider failure', { provider: 'relationships', code: 'construction-intelligence-provider-failure', pageId: sheet?.pageId || '', message: error?.message || String(error), contained: true, timestamp: new Date().toISOString() });
      }
    });
  }
  return { sourceEntityId, groups: relationshipContextGroups(projectRelationshipEngine, sourceEntityId), graphSummary: drawingRelationshipGraphSummaryCache.get(graphNodeId) || null };
}

function drawingRecoveryMarkup(record = {}) {
  const projectName = state().projects.find(item => item.id === record.owningProjectId)?.name || record.owningProjectId || 'Unavailable';
  const activeName = state().projects.find(item => item.id === state().activeProject)?.name || state().activeProject || 'Unavailable';
  const availableActions = [
    ...(record.actions || []),
    record.owningProjectId && record.owningProjectId !== state().activeProject ? { id: 'open-owning-project', label: 'Open Owning Project' } : null,
    { id: 'return-to-drawing-sets', label: 'Return to Drawing Sets' },
    record.document && !record.sourceFile ? { id: 'reattach-original-pdf', label: 'Reattach Original PDF' } : null,
    record.analysis ? { id: 'retry-analysis-upgrade', label: 'Retry Analysis Upgrade' } : null,
    record.analysis && ['drawing-document-missing', 'drawing-analysis-orphan', 'drawing-project-mismatch'].includes(record.errorCode) ? { id: 'remove-stale-analysis', label: 'Remove Stale Analysis' } : null,
    { id: 'view-technical-details', label: 'View Details' }
  ].filter(Boolean);
  const actions = [...new Map(availableActions.map(item => [item.id, item])).values()];
  return `<article class="mc-drawing-recovery" data-recovery-code="${esc(record.errorCode || 'drawing-analysis-invalid')}"><span>DRAWING LIFECYCLE</span><h3>Drawing source unavailable</h3><p>${esc(record.warning || 'Mission Companion found drawing information, but its exact source could not be resolved.')}</p><dl><div><dt>Expected project</dt><dd>${esc(projectName)}</dd></div><div><dt>Active project</dt><dd>${esc(activeName)}</dd></div></dl><div>${actions.map(item => `<button ${item.id === 'view-technical-details' ? 'class="subtle"' : ''} data-drawing-recovery-action="${esc(item.id)}" data-drawing-set-id="${esc(record.analysis?.drawingSetId || record.diagnostics?.drawingSetId || '')}" data-drawing-document-id="${esc(record.analysis?.documentId || record.document?.id || '')}" data-owning-project-id="${esc(record.owningProjectId || '')}">${esc(item.label)}</button>`).join('')}</div><details><summary>Technical details</summary><dl><div><dt>Error code</dt><dd>${esc(record.errorCode || 'drawing-analysis-invalid')}</dd></div><div><dt>Document ID</dt><dd>${esc(record.analysis?.documentId || record.document?.id || 'Unavailable')}</dd></div><div><dt>Drawing-set ID</dt><dd>${esc(record.analysis?.drawingSetId || 'Unavailable')}</dd></div><div><dt>Expected project ID</dt><dd>${esc(record.owningProjectId || 'Unavailable')}</dd></div><div><dt>Active project ID</dt><dd>${esc(state().activeProject)}</dd></div><div><dt>Source file</dt><dd>${record.sourceFile ? 'Available' : 'Unavailable'}</dd></div><div><dt>Analysis</dt><dd>${record.analysis ? 'Available' : 'Unavailable'}</dd></div><div><dt>Analysis version</dt><dd>${esc(record.analysis?.analysisVersion ?? 'Unavailable')}</dd></div><div><dt>Target sheet</dt><dd>${esc(drawingTarget?.sheetId || 'None')}</dd></div><div><dt>Target observation</dt><dd>${esc(drawingTarget?.observationId || 'None')}</dd></div></dl></details></article>`;
}

async function renderDrawingWorkspace(shell = 'professional') {
  assertDrawingRendererOwnership('invoke workspace render');
  const providers = await loadDrawingWorkspaceProviders({ loadDocuments: () => engine.documents(), loadSections: documents => engine.specificationSections(documents.filter(isSpecificationDocument).map(item => item.id).filter(id => !hydratedDrawingSpecificationDocuments.has(id)), BEDFORD_PROJECT_SPECIFICATION_VOCABULARY.map(item => item.sectionNumber)), onFailure: failure => logger.warning('Drawing workspace provider unavailable', failure) });
  return renderDrawingWorkspaceWithProviders(shell, providers);
}

function containedConstructionIntelligence(provider, fallback, operation, context = {}) {
  try { return operation(); }
  catch (error) { logger.warning('Construction intelligence provider failure', { provider, code: 'construction-intelligence-provider-failure', message: error?.message || String(error), contained: true, timestamp: new Date().toISOString(), ...context }); return fallback; }
}

async function renderDrawingWorkspaceWithProviders(shell = 'professional', { documents: providerDocuments, warnings: providerWarnings = [] } = {}) {
  assertDrawingRendererOwnership('re-enter first paint');
  const workspaceRenderStartedAt = drawingPerfNow();
  traceDrawingInteractionStep('renderDrawingWorkspaceWithProviders', { shell, documents: Array.isArray(providerDocuments) ? providerDocuments.length : 0, warnings: providerWarnings.length });
  const providerSections = Array.isArray(arguments[1]?.sections) ? arguments[1].sections : [];
  const workspaceProviderFailures = Array.isArray(arguments[1]?.providerFailures) ? arguments[1].providerFailures : [];
  const workspaceRenderRequest = ++drawingWorkspaceRenderRequest;
  const host = shell === 'mission-control' ? ($('#missionInlineDrawingViewer') || $('#missionDrawingViewer')) : $('#drawingInspector');
  if (!host) return;
  const preservedCanvas = host.querySelector('#mcDrawingCanvas') || portableDrawingCanvas;
  const preservedStage = host.querySelector('#mcDrawingStage');
  const preservedViewport = { scrollLeft: preservedStage?.scrollLeft || 0, scrollTop: preservedStage?.scrollTop || 0 };
  const preservedBrowserScroll = host.querySelector('.mc-drawing-index')?.scrollTop || 0;
  const priorIntelligence = host.querySelector('.mc-drawing-evidence');
  const preservedIntelligenceScroll = priorIntelligence?.scrollTop || 0;
  if (priorIntelligence?.querySelector('[data-panel-mode]')) constructionIntelligenceScroll[priorIntelligence.querySelector('[data-panel-mode]').dataset.panelMode] = priorIntelligence.scrollTop;
  const focusedElement = host.contains(document.activeElement) ? document.activeElement : null;
  const preservedFocusSelector = focusedElement?.id ? `#${CSS.escape(focusedElement.id)}` : focusedElement?.dataset?.drawingSheet ? `[data-drawing-sheet="${CSS.escape(focusedElement.dataset.drawingSheet)}"]` : focusedElement?.dataset?.drawingZoom ? `[data-drawing-zoom="${CSS.escape(focusedElement.dataset.drawingZoom)}"]` : focusedElement?.dataset?.drawingFit ? `[data-drawing-fit="${CSS.escape(focusedElement.dataset.drawingFit)}"]` : '';
  let targetLifecycleUnavailable = null;
  let activeReturnTarget = null;
  if (drawingTarget?.documentId) {
    const exact = await engine.drawingLifecycle(drawingTarget.documentId, drawingTarget.drawingSetId);
    if (exact.document && exact.owningProjectId && exact.owningProjectId !== state().activeProject && state().projects.some(item => item.id === exact.owningProjectId)) {
      await selectProjectThroughProductionPath(exact.owningProjectId);
      if ($('#projectSelect')) $('#projectSelect').value = exact.owningProjectId;
    }
    if (exact.errorCode === 'invalid-document-role') drawingTarget = null;
    if (!exact.document) { targetLifecycleUnavailable = { ...exact, errorCode: 'drawing-target-stale', warning: 'The selected drawing document is no longer available.' }; drawingTarget = null; }
  }
  const allDocuments = providerDocuments;
  for (const document of allDocuments.filter(isSpecificationDocument)) {
    const sourceSections = providerSections.filter(item => item.documentId === document.id);
    if (sourceSections.length) { specificationIndex.index({ document, sourceSections }); hydratedDrawingSpecificationDocuments.add(document.id); }
  }
  const documents = allDocuments.filter(isDrawingDocumentRole);
  const retainedAnalyses = await engine.drawingAnalyses();
  const analyses = await currentDrawingAnalyses();
  const orphanDiagnostics = await engine.drawingLifecycleDiagnostics();
  const lifecycleRecords = [...drawingLifecycleUnavailable, ...orphanDiagnostics];
  drawingLifecycleUnavailable = [...new Map(lifecycleRecords.map(item => [`${item.errorCode}:${item.analysis?.drawingSetId || item.sourceFile?.documentId || item.document?.id || ''}`, item])).values()];
  if (targetLifecycleUnavailable) drawingLifecycleUnavailable = [targetLifecycleUnavailable, ...drawingLifecycleUnavailable];
  const analysesByDocument = new Map(analyses.map(item => [item.documentId, item]));
  const retainedAnalysesByDocument = new Map(retainedAnalyses.map(item => [item.documentId, item]));
  if (!documents.length) {
    releaseDrawingSource();
    host.innerHTML = drawingLifecycleUnavailable.length ? `<section class="mc-drawing-recovery-list"><h2>Drawing Sets</h2>${drawingLifecycleUnavailable.map(drawingRecoveryMarkup).join('')}</section>` : `<div class="mc-drawing-empty"><strong>No drawing set is available for this project.</strong><p>Import a drawing package or return to Chief to continue the project review.</p><div class="mc-drawing-empty-actions"><button type="button" data-drawing-empty-action="import">Import Drawing</button><button type="button" class="subtle" data-drawing-empty-action="chief">Return to Chief</button></div></div>`;
    return;
  }
  const requestedDocument = drawingTarget?.documentId;
  const selected = documents.find(item => item.id === requestedDocument) || documents.find(item => item.id === activeDrawingDocumentId) || documents.find(item => analysesByDocument.has(item.id) || retainedAnalysesByDocument.has(item.id)) || documents[0];
  const persistedAnalysis = retainedAnalysesByDocument.get(selected.id) || analysesByDocument.get(selected.id) || null;
  let analysis = analysesByDocument.get(selected.id) || null;
  const source = activeDrawingSourceRecord?.documentId === selected.id && activeDrawingSourceRecord.projectId === state().activeProject
    ? activeDrawingSourceRecord
    : await engine.sourceFile(selected.id);
  activeDrawingSourceRecord = source;
  if (source) {
    const catalogAnalysis = await createRetainedPdfViewerAnalysis(selected, source, drawingTarget?.pageNumber || 1, persistedAnalysis || analysis);
    if (catalogAnalysis) analysis = { ...catalogAnalysis, viewerFallback: !analysis || Boolean(analysis.viewerFallback) };
  }
  if (workspaceRenderRequest !== drawingWorkspaceRenderRequest) return;
  activeDrawingViewerAnalysis = analysis || null;
  if (analysis?.viewerFallback && drawingTarget?.documentId === selected.id) {
    const page = Math.max(1, Math.min(analysis.sheets.length, Number(drawingTarget.pageNumber) || 1));
    drawingTarget = createDrawingTarget({ ...drawingTarget, projectId: analysis.projectId, documentId: selected.id, drawingSetId: analysis.drawingSetId, sheetId: analysis.sheets[page - 1]?.sheetId, pageNumber: page });
  }
  if (drawingTarget) {
    const reduced = reduceStaleDrawingTarget(drawingTarget, { document: selected, analysis });
    if (reduced.target) drawingTarget = reduced.target;
    else if (reduced.status === 'drawing-target-stale') drawingTarget = null;
  }
  const viewerAnalyses = analysis && !analyses.includes(analysis) ? [analysis, ...analyses] : analyses;
  const resolvedAfterReduction = drawingTarget && analysis ? resolveDrawingTarget(drawingTarget, { documents, analyses: viewerAnalyses }) : null;
  const sheet = resolvedAfterReduction?.sheet || analysis?.sheets?.find(item => item.sheetId === drawingTarget?.sheetId) || analysis?.sheets?.[0] || null;
  const observation = resolvedAfterReduction?.observation || null;
  const planObject = resolvedAfterReduction?.planObject || null;
  const highlightedRegion = resolvedAfterReduction?.region || observation?.region || drawingTarget?.region || null;
  const currentMatchingSheetIds = drawingTarget?.matchingSheetIds && drawingTarget.matchingSheetIds.length ? drawingTarget.matchingSheetIds : drawingMatchingSheetIds;
  const matchingSet = analysis ? reconcileDrawingMatchingSheetIds({ target: { ...drawingTarget, matchingSheetIds: currentMatchingSheetIds, sheetId: sheet?.sheetId || drawingTarget?.sheetId }, analysis, previousMatchingSheetIds: drawingMatchingSheetIds }) : { matchingSheetIds: [], activeSheetId: sheet?.sheetId || '', activeIndex: -1 };
  drawingMatchingSheetIds = analysis?.viewerFallback || sheet?.viewerFallback
    ? analysis.sheets.map(item => item.sheetId)
    : matchingSet.matchingSheetIds;
  if (sheet) drawingTarget = createDrawingTarget({ projectId: analysis.projectId, documentId: selected.id, drawingSetId: analysis.drawingSetId, pageId: sheet.pageId, drawingId: sheet.drawingId, sheetId: sheet.sheetId, pageNumber: sheet.pageNumber, observationId: observation?.observationId || '', planObjectId: planObject?.occurrenceId || '', region: highlightedRegion, origin: drawingTarget?.origin || '', matchingSheetIds: drawingMatchingSheetIds, returnTarget: drawingTarget?.returnTarget || '' });
  const resolvedTarget = drawingTarget && analysis ? resolveDrawingTarget(drawingTarget, { documents, analyses: viewerAnalyses }) : null;
  const effectiveObservation = resolvedTarget?.observation || observation || null;
  const effectivePlanObject = resolvedTarget?.planObject || planObject || null;
  const effectiveRegion = resolvedTarget?.region || highlightedRegion || null;
  const status = drawingStatusCopy(selected, source, persistedAnalysis);
  const disciplines = [...new Set((analysis?.sheets || []).map(item => item.discipline).filter(Boolean))].sort();
  const sheetTypes = [...new Set((analysis?.sheets || []).flatMap(item => item.sheetTypes || []).filter(Boolean))].sort();
  const searchResults = analysis ? searchDrawingSheets({ query: drawingFilter, discipline: drawingDiscipline, sheetType: drawingType, analysis }) : [];
  const shownSheets = searchResults.map(item => item.sheet);
  const navigationSheetIds = drawingMatchingSheetIds.length ? drawingMatchingSheetIds : searchResults.map(item => item.sheetId);
  const navigationIndex = navigationSheetIds.indexOf(sheet?.sheetId);
  const observations = sheet ? (analysis?.observations || []).filter(item => item.sheetId === sheet.sheetId) : [];
  const activeProjectObjectId = analysis?.projectId || state().activeProject;
  if (loadedProjectObjectRegistryId !== activeProjectObjectId) {
    loadedProjectObjectRegistryId = activeProjectObjectId;
    if (!drawingIntelligenceHydration.has(activeProjectObjectId)) {
      const hydration = Promise.allSettled([projectObjectRegistry.load(activeProjectObjectId), drawingSpecificationLinks.load(activeProjectObjectId), constructionGraph.load(activeProjectObjectId)]).then(results => {
        drawingIntelligenceHydration.delete(activeProjectObjectId);
        results.forEach((result, index) => { if (result.status === 'rejected') logger.warning('Construction intelligence provider failure', { provider: ['project-objects', 'drawing-spec-links', 'construction-graph'][index], code: 'construction-intelligence-provider-failure', message: result.reason?.message || String(result.reason), contained: true, projectId: activeProjectObjectId, timestamp: new Date().toISOString() }); });
      });
      drawingIntelligenceHydration.set(activeProjectObjectId, hydration);
    }
  }
  const objectBase = { projectId: analysis?.projectId || state().activeProject, documentId: selected.id, pageId: sheet?.pageId || '' };
  const roomObjects = observations.filter(item => item.kind === 'room-number-text').map(item => drawingObjectDecisions.apply(createRoomObject({ ...objectBase, objectId: item.observationId, observationId: item.observationId, roomNumber: item.value, sourceText: item.value, region: item.region, confidence: item.confidence, verificationState: item.verification?.status === 'Confirmed' ? 'confirmed' : item.verification?.status === 'Rejected' ? 'rejected' : 'candidate' })));
  const exactRooms = roomObjects.filter(item => item.accepted && item.verificationState !== 'rejected');
  const observationGroups = groupDrawingObservations(observations.filter(item => item.kind !== 'room-number-text' || exactRooms.some(room => room.objectId === item.observationId)));
  const warningGroups = drawingWarningPresentation([...(sheet?.warnings || []).map(message => ({ type: 'sheet-warning', message })), ...(analysis?.warnings || [])]);
  const selectedResult = searchResults.find(result => result.sheetId === sheet?.sheetId);
  const selectionExplanation = analysis?.viewerFallback ? (sheet?.metadataAvailable ? 'Showing the retained PDF page with available drawing metadata.' : 'Showing the retained PDF page without drawing-analysis metadata.') : selectedResult?.matchedReason || (drawingTarget?.origin === 'plan-query' ? 'Chief selected this as the highest-ranked exact plan evidence.' : drawingTarget?.observationId ? 'Opened from an exact drawing observation.' : 'Selected from this drawing set.');
  if (sheet?.sheetId) {
    drawingRecentSheets = [sheet.sheetId, ...drawingRecentSheets.filter(item => item !== sheet.sheetId)].slice(0, 10);
  }
  const sheetLegends = (analysis?.legends || []).filter(item => item.sheetId === sheet?.sheetId);
  const sheetSchedules = (analysis?.schedules || []).filter(item => item.sheetId === sheet?.sheetId);
  const sheetKeyedNotes = (analysis?.keyedNoteOccurrences || []).filter(item => item.sheetId === sheet?.sheetId);
  const sheetOccurrences = (analysis?.candidateOccurrences || []).filter(item => item.sheetId === sheet?.sheetId);
  if (sheetOccurrences.length) logger.debug('Candidate occurrence diagnostics', { pageId: sheet?.pageId || '', count: sheetOccurrences.length });
  const pageEnrichmentCacheKey = [
    objectBase.projectId,
    objectBase.documentId,
    objectBase.pageId,
    observations.map(item => item.observationId).join(','),
    sheetSchedules.map(item => `${item.scheduleId || item.scheduleOccurrenceId || item.identifier || ''}:${item.updatedAt || item.verification?.updatedAt || ''}`).join(','),
    sheetLegends.map(item => `${item.legendId || item.legendOccurrenceId || item.identifier || ''}:${item.updatedAt || item.verification?.updatedAt || ''}`).join(','),
    sheetOccurrences.map(item => `${item.occurrenceId || item.objectId || ''}:${item.updatedAt || item.verification?.updatedAt || ''}`).join(','),
    sheetKeyedNotes.map(item => `${item.keyedNoteOccurrenceId || item.keyedNoteId || ''}:${item.updatedAt || item.verification?.updatedAt || ''}`).join(',')
  ].join('|');
  const observationObjects = observations.filter(item => item.kind !== 'room-number-text').map(item => drawingObjectDecisions.apply(createDrawingObject({ ...objectBase, objectId: item.observationId, observationId: item.observationId,
    type: objectTypeForObservation(item.kind, 'generic-drawing-object'),
    label: `${observationKindLabel(item.kind)} ${item.value}`, evidenceText: item.value, region: item.region, confidence: item.confidence, verificationState: item.verification?.status === 'Confirmed' ? 'confirmed' : item.verification?.status === 'Rejected' ? 'rejected' : 'candidate' })));
  const occurrenceObjects = sheetOccurrences.map(item => drawingObjectDecisions.apply(createDrawingObject({ ...objectBase, objectId: item.occurrenceId, type: item.type || 'generic-candidate-object', subtype: item.subtype, label: item.label || 'Plan object occurrence', evidenceText: item.evidenceText, region: item.region, confidence: item.confidence, verificationState: item.verification?.status === 'Confirmed' ? 'confirmed' : item.verification?.status === 'Rejected' ? 'rejected' : 'candidate' })));
  for (const item of [...roomObjects, ...observationObjects, ...occurrenceObjects]) containedConstructionIntelligence('object-observations', null, () => projectObjectRegistry.mergeObservation({ observationId: item.sourceObservationIds?.[0] || item.objectId, projectId: objectBase.projectId, documentId: objectBase.documentId, pageId: objectBase.pageId, source: 'drawing-analysis', text: item.evidenceText || item.label, region: item.region, detectedType: item.type === 'equipment-tag' ? 'equipment' : item.type === 'generic-candidate-object' ? 'generic-drawing-object' : item.type, detectedTag: item.tag || item.roomNumber || String(item.label || '').split(' ').at(-1), confidence: item.confidence, parserVersion: String(analysis?.analysisVersion || '') }), { pageId: objectBase.pageId });
  const enrichmentStartedAt = drawingPerfNow();
  const enrichment = containedConstructionIntelligence('object-enrichment', { objects:[], diagnostics:{} }, () => enrichPageConstructionObjects({ ...objectBase, observations, schedules:sheetSchedules, legends:sheetLegends, occurrences:sheetOccurrences, keyedNotes:sheetKeyedNotes, cacheKey: pageEnrichmentCacheKey }), { pageId:objectBase.pageId });
  drawingTraceSlowOperation('object enrichment', enrichmentStartedAt, { pageId: objectBase.pageId, objectCount: enrichment.objects.length, evidenceCount: enrichment.diagnostics.evidenceCount });
  const enrichmentResult = containedConstructionIntelligence('object-enrichment-persistence', { objects:[], diagnostics:enrichment.diagnostics }, () => applyPageObjectEnrichment(projectObjectRegistry,enrichment), { pageId:objectBase.pageId });
  logger.debug('Drawing object coverage', { pageId:objectBase.pageId, ...enrichmentResult.diagnostics });
  activeDrawingObjects = containedConstructionIntelligence('project-objects', [], () => projectObjectRegistry.getObjectsForPage(sheet?.pageId || '', { projectId: objectBase.projectId })).map(item => ({ ...item, documentId: item.drawingDocumentId, pageId: item.drawingPageId, type: item.objectType, subtype: item.objectSubtype, region: item.graphicalRegion, evidenceText: item.sourceText }));
  const coverageGeneration=++drawingCoverageReviewGeneration;
  const coverageObjects=containedConstructionIntelligence('drawing-coverage-review-objects',activeDrawingObjects,()=>projectObjectRegistry.getObjectsForPage(sheet?.pageId||'',{projectId:objectBase.projectId,includeRejected:true,limit:1000}),{pageId:objectBase.pageId});
  const coverageReview=containedConstructionIntelligence('drawing-coverage-review',null,()=>buildDrawingCoverageReview({...objectBase,revision:selected.revision||selected.issueDate||'current',evidence:enrichment.evidence||[],objects:coverageObjects,maxItems:250}),{pageId:objectBase.pageId});
  if(coverageGeneration===drawingCoverageReviewGeneration)activeDrawingCoverageReview=coverageReview;
  if(coverageReview)logger.debug('Drawing coverage review performance',{pageId:objectBase.pageId,...coverageReview.diagnostics,coverageRecalculationTimeMs:coverageReview.diagnostics.reviewQueueGenerationTimeMs});
  const restoredObjectIds = drawingViewerEngine.getViewport(sheet?.pageNumber)?.selectedObjectIds || [];
  selectedDrawingObjectIds = selectedDrawingObjectIds.filter(id=>activeDrawingObjects.some(item=>item.objectId===id));
  if (!selectedDrawingObjectIds.length && restoredObjectIds.length) selectedDrawingObjectIds = restoredObjectIds.filter(id=>activeDrawingObjects.some(item=>item.objectId===id));
  if (selectedDrawingObject && !activeDrawingObjects.some(item => item.objectId === selectedDrawingObject.objectId && item.pageId === sheet?.pageId)) { selectedDrawingObject = null; selectedDrawingObjectIds = []; drawingObjectRegionAdjustmentId = ''; drawingRegionSelectionMode = false; }
  if (!selectedDrawingObject && selectedDrawingObjectIds.length) selectedDrawingObject = activeDrawingObjects.find(item=>item.objectId===selectedDrawingObjectIds.at(-1)) || null;
  if (selectedDrawingObject) selectedDrawingObject = activeDrawingObjects.find(item => item.objectId === selectedDrawingObject.objectId) || selectedDrawingObject;
  const buildObjectSpecificationEvidence = drawingObject => {
    const observationIds = new Set(drawingObject?.sourceObservationIds || []);
    return [
      { text: drawingObject?.label, source: 'project-object-label', region: drawingObject?.region || drawingObject?.graphicalRegion || null },
      { text: drawingObject?.tag, source: 'project-object-tag', region: drawingObject?.region || drawingObject?.graphicalRegion || null },
      { text: drawingObject?.type, source: 'project-object-type', region: drawingObject?.region || drawingObject?.graphicalRegion || null },
      { text: drawingObject?.subtype, source: 'project-object-subtype', region: drawingObject?.region || drawingObject?.graphicalRegion || null },
      { text: drawingObject?.evidenceText, source: 'project-object-evidence', region: drawingObject?.region || drawingObject?.graphicalRegion || null },
      ...(drawingObject?.aliases || []).map(alias => ({ text: alias, source: 'project-object-alias', region: drawingObject?.region || drawingObject?.graphicalRegion || null })),
      ...observations.filter(item => observationIds.has(item.observationId)).map(item => ({ text: item.value, source: item.kind, region: item.region, observationId: item.observationId }))
    ].filter(item => item.text);
  };
  const specificationDocument = allDocuments.find(isSpecificationDocument);
  let vocabularyCandidateCount = 0; let relationshipWriteCount = 0;
  try { if (sheet && specificationDocument) {
    const existingLinkIds = new Set(drawingSpecificationLinks.forPage(sheet.pageId).map(item => item.linkId));
    const pageEvidence = collectPageSpecificationEvidence({
      sheet,
      observations,
      legends: sheetLegends,
      schedules: sheetSchedules,
      keyedNotes: sheetKeyedNotes,
      occurrences: sheetOccurrences,
      activeDrawingObjects,
      references: analysis?.references || []
    });
    const pageCandidates = projectSpecificationVocabulary.matchPage({ projectId: objectBase.projectId, specificationDocumentId: specificationDocument.id, pageId: sheet.pageId, evidence: pageEvidence });
    vocabularyCandidateCount += pageCandidates.length;
    const pageCandidatesStartedAt = drawingPerfNow();
    let pageCandidateCount = 0;
    for (const candidate of pageCandidates) { pageCandidateCount += 1; const link = drawingSpecificationLinks.link({ ...candidate, drawingDocumentId: selected.id, drawingPageId: sheet.pageId, objectId: null }); if (link && !existingLinkIds.has(link.linkId)) { relationshipWriteCount += 1; existingLinkIds.add(link.linkId); } }
    drawingTraceSlowOperation('specification matching', pageCandidatesStartedAt, { iterationCount: pageCandidateCount, scope: 'page', pageId: sheet.pageId, candidateCount: pageCandidates.length });
    for (const drawingObject of activeDrawingObjects) {
      const objectEvidence = buildObjectSpecificationEvidence(drawingObject);
      if (!objectEvidence.length) continue;
      const objectCandidates = projectSpecificationVocabulary.matchObject({ projectId: objectBase.projectId, specificationDocumentId: specificationDocument.id, pageId: sheet.pageId, objectId: drawingObject.objectId, evidence: objectEvidence });
      vocabularyCandidateCount += objectCandidates.length;
      const objectCandidatesStartedAt = drawingPerfNow();
      let objectCandidateCount = 0;
      for (const candidate of objectCandidates) { objectCandidateCount += 1; const link = drawingSpecificationLinks.link({ ...candidate, drawingDocumentId: selected.id, drawingPageId: sheet.pageId, objectId: drawingObject.objectId }); if (link && !existingLinkIds.has(link.linkId)) { relationshipWriteCount += 1; existingLinkIds.add(link.linkId); } }
      drawingTraceSlowOperation('specification matching', objectCandidatesStartedAt, { iterationCount: objectCandidateCount, scope: 'object', objectId: drawingObject.objectId, candidateCount: objectCandidates.length });
    }
  } } catch (error) { logger.warning('Construction intelligence provider failure', { provider: 'specification-vocabulary', code: 'construction-intelligence-provider-failure', pageId: sheet?.pageId || '', message: error?.message || String(error), contained: true, timestamp: new Date().toISOString() }); }
  const sheetSpecificationLinks = sheet ? drawingSpecificationLinks.forPage(sheet.pageId) : [];
  const pageSpecificationLinks = sheetSpecificationLinks.filter(item => !item.objectId);
  const selectedSpecificationLinks = sheet && selectedDrawingObjectIds.length > 1 ? selectedDrawingObjectIds.flatMap(objectId=>sheetSpecificationLinks.filter(item => item.objectId === objectId || !item.objectId)) : selectedDrawingObject ? sheetSpecificationLinks.filter(item => item.objectId === selectedDrawingObject.objectId || !item.objectId) : pageSpecificationLinks;
  if (sheet) logger.debug('Drawing requirement evidence resolution', { pageId: sheet.pageId, selectedObjectId: selectedDrawingObject?.objectId || null, vocabularyMatches: vocabularyCandidateCount, relationshipWrites: relationshipWriteCount, rejectedOrSuppressedCandidates: sheetSpecificationLinks.filter(item => item.status === 'rejected').length });
  let activeRelationshipContext;
  const relationshipGraphStartedAt = drawingPerfNow();
  try { activeRelationshipContext = synchronizeActiveDrawingRelationships({ projectId: analysis?.projectId || selected.projectId || state().activeProject, document: selected, analysis, sheet, objects: activeDrawingObjects, specificationLinks: sheetSpecificationLinks }); }
  catch (error) { logger.warning('Construction intelligence provider failure', { provider: 'relationships', code: 'construction-intelligence-provider-failure', pageId: sheet?.pageId || '', message: error?.message || String(error), contained: true, timestamp: new Date().toISOString() }); activeRelationshipContext = { sourceEntityId: '', groups: {} }; }
  drawingTraceSlowOperation('relationship graph generation', relationshipGraphStartedAt, { pageId: sheet?.pageId || '', relationshipGroupCount: Object.keys(activeRelationshipContext.groups || {}).length });
  replaceTrackedResource('relationship-model', activeRelationshipContext, { pageId: sheet?.pageId || '', sourceEntityId: activeRelationshipContext.sourceEntityId || '' });
  drawingWorkspace.setPages((analysis?.sheets || []).map(item => ({ ...item, documentId: item.documentId || selected.id, drawingSetId: item.drawingSetId || analysis?.drawingSetId, projectId: item.projectId || analysis?.projectId, pdfPageNumber: item.pdfPageNumber || item.pageNumber })));
  const pageContext = containedConstructionIntelligence('page-context', null, () => drawingWorkspace.getContext(sheet ? { ...sheet, documentId: sheet.documentId || selected.id, drawingSetId: sheet.drawingSetId || analysis?.drawingSetId, projectId: sheet.projectId || analysis?.projectId, pdfPageNumber: sheet.pdfPageNumber || sheet.pageNumber } : drawingTarget?.pageNumber || 1), { pageId: sheet?.pageId || '' });
  if (pageContext) pageContext.rooms = exactRooms.map(item => ({ id: item.roomId, label: `Room ${item.roomNumber}`, verificationState: item.verificationState, region: item.region }));
  if (sheet) logger.debug('Drawing viewer metadata source', { documentId: selected.id, pageId: sheet.pageId || '', pageNumber: sheet.pageNumber, identityState: sheet.identityStatus || 'fallback' });
  if (sheet) drawingViewerEngine.openDocument(selected.id, Math.max(sheet.pageNumber, ...(analysis?.sheets || []).map(item => Number(item.pageNumber) || 0)), sheet.pageNumber);
  const viewport = sheet ? { ...defaultDrawingViewport(), ...drawingViewerEngine.getViewport(sheet.pageNumber) } : defaultDrawingViewport();
  const activeTrade = drawingTradeContext.current({ discipline: sheet?.discipline, objectType: selectedDrawingObject?.subtype || selectedDrawingObject?.type, title: sheet?.sheetTitle });
  let activeViewportContext = sheet ? drawingViewportContextService.get(selected.id, sheet.pageId) : null;
  if (sheet && !activeViewportContext) activeViewportContext = drawingViewportContextService.update({ projectId: analysis?.projectId || selected.projectId || state().activeProject, documentId: selected.id, pageId: sheet.pageId, pdfPageNumber: sheet.pageNumber, bounds: { x: 0, y: 0, width: 1, height: 1 }, zoom: viewport.zoom, rotation: viewport.rotation, selectedRegion: effectiveRegion, selectedRoomId: selectedDrawingObject?.type === 'room' ? selectedDrawingObject.roomId : null, selectedObjectId: selectedDrawingObject?.objectId || null, activeTradeChannel: activeTrade.key, source: selectedDrawingObject ? 'object-selection' : effectiveRegion ? 'manual-selection' : 'page-context' }, { immediate: true });
  else if (sheet && activeViewportContext && (activeViewportContext.selectedObjectId !== (selectedDrawingObject?.objectId || null) || activeViewportContext.activeTradeChannel !== activeTrade.key)) activeViewportContext = drawingViewportContextService.update({ ...activeViewportContext, selectedObjectId: selectedDrawingObject?.objectId || null, selectedRoomId: selectedDrawingObject?.type === 'room' ? selectedDrawingObject.roomId : null, activeTradeChannel: activeTrade.key, source: selectedDrawingObject ? (selectedDrawingObject.type === 'room' ? 'room-selection' : 'object-selection') : activeViewportContext.selectedRegion ? 'manual-selection' : 'page-context' }, { immediate: true });
  const visibleRooms = activeViewportContext ? containedConstructionIntelligence('rooms', [], () => drawingViewportContextService.visibleRooms(activeViewportContext, exactRooms), { pageId: sheet?.pageId || '' }) : [];
  const requirementInput = { projectId: analysis?.projectId || selected.projectId || state().activeProject, pageEntityId: activeRelationshipContext.sourceEntityId && !selectedDrawingObject ? activeRelationshipContext.sourceEntityId : `drawing-page:${sheet?.pageId || ''}`, selectedObjectEntityId: selectedDrawingObject ? `drawing-object:${selectedDrawingObject.objectId}` : '', selectedRoomEntityId: selectedDrawingObject?.type === 'room' ? `drawing-object:${selectedDrawingObject.objectId}` : '', selectedObjectId: selectedDrawingObject?.objectId || '', viewportContext: activeViewportContext, tradeChannel: activeTrade, drawingSpecLinks: sheetSpecificationLinks, projectWideRequirements: [] };
  const pendingRequirements = { status: 'loading', requirements: [], confirmedSpecifications: [], suggestedSpecifications: [], projectWideRequirements: [], fieldRequirements: {}, warnings: providerWarnings, providerFailures: workspaceProviderFailures };
  replaceTrackedResource('requirement-model', pendingRequirements, { pageId: sheet?.pageId || '', status: 'loading' });
  const returnAction = drawingReturnAction(drawingTarget?.returnTarget || '');
  const returnLabel = shell === 'professional' && returnAction?.kind === 'mission-control' ? 'Return to Chief' : returnAction?.label;
  const focusTarget = drawingFocusTarget({ sheet, observation: effectiveObservation, planObject: effectivePlanObject, region: effectiveRegion });
  const announcementText = sheet ? drawingAnnouncementText({ sheet, observation: effectiveObservation, planObject: effectivePlanObject, region: effectiveRegion }) : 'No drawing selected';
  const objectSearchMatchIds = new Set(drawingFilter ? searchDrawingObjects(activeDrawingObjects,drawingFilter).map(item=>item.objectId) : []);
  const relatedDrawingObjectIds = new Set(relatedObjectIdsForSelection(selectedDrawingObject,activeDrawingObjects));
  const visibleReviewItems=drawingCoverageReviewMode&&coverageReview?coverageReview.items.filter(item=>drawingCoverageReviewFilter==='all'||item.detectedCategory===drawingCoverageReviewFilter):[];
  const overlayRecords = [
    ...activeDrawingObjects.filter(item => item.verificationState !== 'rejected').flatMap(item => (item.graphicalRegions?.length ? item.graphicalRegions : [item.region]).map((region,regionIndex) => createDrawingOverlay({ overlayId: item.objectId, ...objectBase, type: selectedDrawingObjectIds.includes(item.objectId) ? 'selected' : item.type === 'room' ? 'rooms' : item.verificationState === 'confirmed' ? 'confirmed' : ['equipment','diffuser','telecom-outlet','fire-protection-device'].includes(item.type) ? 'equipment' : item.type === 'keynote' ? 'keyedNotes' : ['callout','detail-reference'].includes(item.type) ? 'callouts' : item.type === 'schedule-entry' ? 'scheduleLinks' : 'candidates', label: item.label, region, geometry:item.geometry, confidence: item.confidence, verificationState: item.verificationState, styleToken:relatedDrawingObjectIds.has(item.objectId)?'related':item.status==='blocked'?'blocked':item.status==='completed'?'completed':item.type==='room'?'room':undefined, metadata: { objectId: item.objectId, objectType:item.type, regionIndex, selected:selectedDrawingObjectIds.includes(item.objectId), selectionIndex:selectedDrawingObjectIds.indexOf(item.objectId)+1, related:relatedDrawingObjectIds.has(item.objectId), searchMatch:objectSearchMatchIds.has(item.objectId) } }))),
    ...sheetKeyedNotes.map(item => createDrawingOverlay({ overlayId: item.keyedNoteOccurrenceId, ...objectBase, type: 'keyedNotes', label: `Keyed note ${item.identifier}`, region: item.region, verificationState: item.verification?.status === 'Confirmed' ? 'confirmed' : 'candidate' })),
    ...visibleReviewItems.filter(item=>validNormalizedRegion(item.proposedGraphicalRegion)).map(item=>createDrawingOverlay({overlayId:item.reviewItemId,...objectBase,type:'candidates',label:item.proposedLabel,region:item.proposedGraphicalRegion,confidence:item.confidence,verificationState:'candidate',selectable:false,styleToken:`coverage-review ${item.issueType}`,metadata:{reviewItemId:item.reviewItemId}})),
    ...(drawingCoverageReviewMode?coverageObjects.filter(item=>item.verificationState==='rejected'&&(drawingCoverageReviewFilter==='all'||drawingCoverageReviewFilter===drawingCoverageCategory(item))).flatMap(item=>(item.graphicalRegions?.length?item.graphicalRegions:[item.graphicalRegion]).filter(validNormalizedRegion).map((region,index)=>createDrawingOverlay({overlayId:`rejected:${item.objectId}:${index}`,...objectBase,type:'candidates',label:`Rejected evidence: ${item.label}`,region,confidence:item.confidence,verificationState:'rejected',selectable:false,styleToken:'coverage-review rejected-evidence'}))):[])
  ].filter(Boolean);
  const enrichSpecification = item => {
    let section = null; try { section = specificationIndex.get(item.specificationDocumentId, item.sectionNumber); } catch { section = null; }
    return { ...item, startPdfPage: section?.startPdfPage || null };
  };
  
  // Local helper to build intelligence panel model
  const buildIntelligencePanel = (requirements) => buildConstructionIntelligencePanelModel({
    document: selected, sheet, trade: activeTrade, selectedObject: selectedDrawingObject, pageObjects: activeDrawingObjects,
    pageStatus: analysis.viewerFallback && !analysis.metadataAvailable ? 'Manual PDF page viewing remains available.' : sheet?.identityStatus,
    pageNotes: pageContext?.drawingNotes || [], schedules: sheetSchedules, legends: sheetLegends, keyedNotes: sheetKeyedNotes, references: analysis?.references || [], relatedDetails: observations.filter(item => /detail|callout/i.test(item.kind)), unresolvedEvidence: sheetSpecificationLinks.filter(item => item.status !== 'confirmed'), relationshipGroups: activeRelationshipContext.groups,
    requirements: { ...requirements, confirmedSpecifications: (requirements.confirmedSpecifications || []).map(enrichSpecification), suggestedSpecifications: (requirements.suggestedSpecifications || []).map(enrichSpecification) }, specificationLinks: sheetSpecificationLinks.map(enrichSpecification),
    objectHistory: selectedDrawingObject ? containedConstructionIntelligence('object-history', [], () => projectObjectRegistry.getObjectHistory(selectedDrawingObject.objectId), { pageId: sheet?.pageId || '', objectId: selectedDrawingObject.objectId }) : [], viewportContext: activeViewportContext,
    sourceEntityId: activeRelationshipContext.sourceEntityId, hasPossibleDuplicates: selectedDrawingObject ? containedConstructionIntelligence('object-duplicates', [], () => projectObjectRegistry.possibleDuplicates(selectedDrawingObject.objectId), { pageId: sheet?.pageId || '', objectId: selectedDrawingObject.objectId }).length > 0 : false,
    canLinkSpecification: Boolean(selectedDrawingObject && specificationDocument), graphSummary: activeRelationshipContext.graphSummary || null,
    multiSelection: sharedDrawingObjectContext(activeDrawingObjects.filter(item=>selectedDrawingObjectIds.includes(item.objectId)), { specificationLinks:selectedSpecificationLinks })
  });
  
  const inspectorModelStartedAt = drawingPerfNow();
  const constructionIntelligencePanel = buildIntelligencePanel(pendingRequirements);
  replaceTrackedResource('inspector-model', constructionIntelligencePanel, { pageId: sheet?.pageId || '', mode: constructionIntelligencePanel.mode, phase: 'initial' });
  drawingTraceSlowOperation('inspector model creation', inspectorModelStartedAt, { pageId: sheet?.pageId || '', mode: constructionIntelligencePanel.mode });
  const plansInspectorContext = shell === 'mission-control'
    ? getActivePlansSheetContext({
      analysis,
      sheet,
      generationId: drawingWorkspaceRenderRequest,
      shell,
      panel: null
    })
    : null;
  const visibleChiefObjects=activeViewportContext?containedConstructionIntelligence('chief-visible-objects',activeDrawingObjects,()=>projectObjectRegistry.getObjectsForViewport(activeViewportContext,{limit:100}),{pageId:sheet?.pageId||''}):activeDrawingObjects.slice(0,100);
  const chiefSnapshot=buildChiefDrawingContext({project:state().projects.find(item=>item.id===state().activeProject),documentId:selected.id,drawingSetId:analysis?.drawingSetId,page:sheet,viewport:{...viewport,bounds:activeViewportContext?.bounds},selectedObject:selectedDrawingObject,selectedObjectIds:selectedDrawingObjectIds,activeTrade,visibleObjects:visibleChiefObjects,visibleRooms,pageSpecifications:pageSpecificationLinks,objectSpecifications:selectedDrawingObject?selectedSpecificationLinks.filter(item=>item.objectId===selectedDrawingObject.objectId):[],fieldRequirements:[],relatedDrawings:activeRelationshipContext.groups?.relatedDrawings,drawingNotes:pageContext?.drawingNotes,keynotes:sheetKeyedNotes,schedules:sheetSchedules,details:observations.filter(item=>/detail|callout/i.test(item.kind)),graphSummary:activeRelationshipContext.graphSummary,evidencePaths:[],providerWarnings:[...providerWarnings,...workspaceProviderFailures]});
  activeChiefDrawingContext=chiefSnapshot.context;void chiefDrawingContextSynchronizer.update({project:state().projects.find(item=>item.id===state().activeProject),documentId:selected.id,drawingSetId:analysis?.drawingSetId,page:sheet,viewport:{...viewport,bounds:activeViewportContext?.bounds},selectedObject:selectedDrawingObject,selectedObjectIds:selectedDrawingObjectIds,activeTrade,visibleObjects:visibleChiefObjects,visibleRooms,pageSpecifications:pageSpecificationLinks,objectSpecifications:selectedDrawingObject?selectedSpecificationLinks.filter(item=>item.objectId===selectedDrawingObject.objectId):[],relatedDrawings:activeRelationshipContext.groups?.relatedDrawings,graphSummary:activeRelationshipContext.graphSummary,providerWarnings:[...providerWarnings,...workspaceProviderFailures]});
  const chiefCards=buildChiefDrawingCards([{cardType:'Drawing Page',id:sheet?.pageId,title:sheet?.sheetNumber||`Page ${sheet?.pageNumber}`,subtitle:sheet?.sheetTitle,actions:[{actionId:'open-drawing-page',target:{documentId:selected.id,pageId:sheet?.pageId,pageNumber:sheet?.pageNumber,sheetNumber:sheet?.sheetNumber}}]},...(selectedDrawingObject?[{cardType:'Construction Item',id:selectedDrawingObject.objectId,title:selectedDrawingObject.label,subtitle:selectedDrawingObject.type,actions:[{actionId:'open-object',target:{objectId:selectedDrawingObject.objectId,pageId:sheet?.pageId}}]}]:[]),...sheetSpecificationLinks.filter(item=>item.status!=='rejected').slice(0,8).map(item=>({cardType:'Specification Section',id:item.linkId,title:item.sectionNumber,subtitle:item.sectionTitle,actions:[{actionId:'open-specification-section',target:{documentId:item.specificationDocumentId,sectionNumber:item.sectionNumber}}]}))],drawingActionRouter,{pageId:sheet?.pageId,objectIds:activeDrawingObjects.map(item=>item.objectId)});
  const coverageMetricMarkup=coverageReview?`<div class="mc-coverage-metrics"><span><strong>${coverageReview.metrics.overallPageCoveragePercentage}%</strong> overall</span><span><strong>${coverageReview.metrics.selectableObjectCount}</strong> selectable</span><span><strong>${coverageReview.metrics.confirmedObjectCount}</strong> confirmed</span><span><strong>${coverageReview.metrics.candidateObjectCount}</strong> candidates</span><span><strong>${coverageReview.metrics.unsupportedEvidenceCount}</strong> unsupported</span><span><strong>${coverageReview.metrics.objectsWithoutRegions}</strong> without regions</span></div>`:'';
  const coverageReviewMarkup=drawingCoverageReviewMode?`<section class="mc-drawing-coverage-review" aria-label="Drawing coverage review"><header><div><strong>Drawing Coverage Review</strong><span>Page-specific review work · ${coverageReview?.items.length||0} unresolved</span></div><button class="subtle" data-coverage-review-close>Close Review</button></header>${coverageReview?`${coverageMetricMarkup}<label>Review category<select data-coverage-review-filter><option value="all">All categories</option>${DRAWING_COVERAGE_CATEGORIES.map(category=>`<option value="${category}" ${drawingCoverageReviewFilter===category?'selected':''}>${category[0].toUpperCase()+category.slice(1)}</option>`).join('')}</select></label><div class="mc-coverage-gates">${Object.values(coverageReview.metrics.categoryCoverage).filter(item=>item.evidenceRecords||item.unresolvedReviewItems).map(item=>`<span><strong>${esc(item.category)}</strong> ${item.coveragePercentage??'—'}% · ${item.unresolvedReviewItems} open</span>`).join('')}</div><ol>${visibleReviewItems.map(item=>`<li data-review-item="${esc(item.reviewItemId)}"><div><span class="mc-ci-badge ${item.issueType}">${esc(item.issueType.replaceAll('-',' '))}</span><strong>${esc(item.proposedLabel)}</strong><small>${esc(item.reason)}</small></div><div>${item.currentRegistryMatch?'<button data-coverage-confirm>Confirm Object</button><button data-coverage-edit>Edit Identity</button>':'<button data-coverage-create>Create Object</button>'}<button data-coverage-assign>Assign Existing</button>${item.currentRegistryMatch?'<button data-coverage-draw-region>Draw / Adjust Region</button><button data-coverage-link-spec>Link Specification</button>':''}${item.issueType==='possible-duplicate'&&item.duplicateObject?'<button data-coverage-merge>Merge Duplicate</button><button data-coverage-keep>Keep Separate</button>':''}<button class="subtle" data-coverage-reject>Reject Evidence</button><button class="subtle" data-coverage-ignore>Ignore This Revision</button></div></li>`).join('')||'<li><strong>No unresolved review work in this category.</strong></li>'}</ol>`:'<p>Drawing coverage review is temporarily unavailable. Manual drawing use is unaffected.</p>'}</section>`:'';
  host.innerHTML = `
    <header class="mc-drawing-header" id="mc-drawing-header"><div><span>${shell === 'mission-control' ? 'CONSTRUCTION INTELLIGENCE · PLANS' : 'PROFESSIONAL WORKSPACE · DRAWING EVIDENCE'}</span><h2 title="${esc(selected.title || selected.name || 'Drawing set')}">${esc(selected.title || selected.name || 'Drawing set')}</h2><p><strong>${esc(status.label)}</strong> — ${esc(status.detail)}</p></div><div>${shell === 'professional' && persistedAnalysis ? '<button class="subtle" data-drawing-reanalyze>Reanalyze Drawing Set</button>' : ''}${returnAction ? `<button class="subtle" data-drawing-return="${esc(returnAction.kind)}">${esc(returnLabel)}</button>` : ''}</div></header>
    <div class="mc-drawing-layout ${drawingWorkspacePanels.finderHidden ? 'finder-hidden' : ''} ${drawingWorkspacePanels.evidenceHidden ? 'evidence-hidden' : ''} ${drawingWorkspacePanels.expanded ? 'drawing-expanded' : ''}">
      <aside class="mc-drawing-index" aria-label="Find construction drawing evidence"><label>Drawing set<select id="mcDrawingDocument">${documents.map(item => `<option value="${esc(item.id)}" ${item.id === selected.id ? 'selected' : ''}>${esc(item.title || item.name || item.id)}</option>`).join('')}</select></label>${analysis ? `<label>Find a sheet, room, trade, or tag<input id="mcDrawingSearch" value="${esc(drawingFilter)}" autocomplete="off" aria-controls="mcDrawingResults" aria-describedby="mcDrawingResultStatus"></label><button class="subtle" data-drawing-clear-search ${drawingFilter ? '' : 'hidden'}>Clear search</button><div class="mc-drawing-filters"><label>Discipline<select id="mcDrawingDiscipline"><option value="all">All disciplines</option>${disciplines.map(item => `<option ${item === drawingDiscipline ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label><label>Drawing type<select id="mcDrawingType"><option value="all">All types</option>${sheetTypes.map(item => `<option ${item === drawingType ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label></div><p id="mcDrawingResultStatus" role="status" aria-live="polite">${esc(drawingSearchSummary(drawingFilter, shownSheets.length))}</p><ol id="mcDrawingResults" aria-label="Drawing search results">${searchResults.map((result, index) => drawingSearchResultMarkup(result, sheet?.sheetId, index)).join('') || '<li class="mc-drawing-no-results"><strong>No drawing evidence found.</strong><span>Try a sheet number, room, trade, equipment tag, or clear the active filters.</span></li>'}</ol>` : ''}</aside>
      <main class="mc-drawing-viewer"><details class="mc-construction-orientation"><summary>Work and selection context</summary><div><strong>${esc(activeWorkPackage?.workSummary?.[0]?.label || sheet?.sheetTitle || 'Select construction evidence')}</strong><span>${sheet?.building ? `Building ${esc(sheet.building)} · ` : ''}${esc(activeWorkPackage?.discipline || sheet?.discipline || 'Unknown')} · ${esc(selectionExplanation)}</span></div></details>${coverageReviewMarkup}
        ${!source ? `<div class="mc-drawing-unavailable"><strong>Original drawing unavailable — reattach PDF to view sheet.</strong><p>Reattach the exact source PDF to inspect the drawing. Indexed project text remains available.</p><label class="mc-drawing-reattach"><input id="mcDrawingReattach" type="file" accept="application/pdf,.pdf">Reattach Original PDF</label></div>` : !sheet ? `<div class="mc-drawing-unavailable"><strong>Drawing page unavailable.</strong><p>The retained PDF does not expose a viewable page.</p></div>` : `<header id="${focusTarget === 'mc-drawing-selected-evidence' ? 'mc-drawing-selected-evidence' : 'mc-drawing-sheet-title'}" class="mc-drawing-sheet-title" tabindex="-1" aria-live="polite" aria-label="${esc(announcementText)}"><div><span>${esc(sheet.sheetNumber || `Page ${sheet.pageNumber}`)}</span><h3>${esc(sheet.sheetTitle || `Page ${sheet.pageNumber}`)}</h3><p>${esc(selectionExplanation)}</p></div><dl><div><dt>Discipline</dt><dd>${esc(sheet.discipline)}</dd></div><div><dt>Type</dt><dd>${esc(sheet.primarySheetType || sheet.sheetTypes[0] || 'Unknown')}</dd></div><div><dt>Position</dt><dd>${analysis.viewerFallback ? 'Page' : 'Sheet'} ${sheet.pageNumber} of ${analysis.sheets.length}</dd></div><div><dt>Identity</dt><dd>${esc(sheet.identityStatus)}</dd></div></dl></header><div class="mc-drawing-toolbar"><div role="group" aria-label="Drawing navigation"><button data-drawing-previous ${navigationIndex <= 0 ? 'disabled' : ''}>Previous</button><button data-drawing-next ${navigationIndex < 0 || navigationIndex >= navigationSheetIds.length - 1 ? 'disabled' : ''}>Next</button><button data-drawing-layout="toggle-finder">${drawingWorkspacePanels.finderHidden ? 'Show' : 'Hide'} Sheet Finder</button></div><div role="group" aria-label="Drawing view controls"><button data-drawing-fit="page">Fit Page</button><button data-drawing-fit="width">Fit Width</button><button data-drawing-spec-explorer>View Governing Specifications</button><button data-drawing-zoom="out">Zoom Out</button><button data-drawing-zoom="in">Zoom In</button><button data-drawing-rotate>Rotate</button><button data-drawing-reset-view>Reset View</button><button data-drawing-layout="${drawingWorkspacePanels.expanded ? 'restore' : 'expand'}">${drawingWorkspacePanels.expanded ? 'Restore Workspace' : 'Expand Drawing'}</button></div><div role="group" aria-label="Construction context actions">${analysis.viewerFallback ? '' : '<button data-drawing-ask>Ask Chief</button><button data-drawing-current-work>Add to Current Work</button><button data-drawing-inspection>Create Inspection</button>'}<button data-drawing-edit-metadata>Edit Page Metadata</button><button data-coverage-review-open>Review Drawing Coverage</button><button class="subtle" data-drawing-source>Open Source Details</button><button data-drawing-layout="toggle-evidence">${drawingWorkspacePanels.evidenceHidden ? 'Show' : 'Hide'} Construction Evidence</button></div><output aria-label="Current drawing view">${Number.isFinite(drawingZoom) ? Math.round(drawingZoom * 100) : 'Fit'}% · ${drawingRotation}°</output></div>${analysis.viewerFallback && !analysis.metadataAvailable ? '' : `<fieldset class="mc-drawing-overlay-controls"><legend>Drawing overlays</legend>${Object.entries({ rooms: 'Room Labels', confirmed: 'Confirmed Objects', candidates: 'Candidate Objects', equipment: 'Equipment Tags', keyedNotes: 'Keyed Notes', callouts: 'Callouts', scheduleLinks: 'Schedule Links', warnings: 'Warnings' }).map(([key,label]) => `<label><input type="checkbox" data-drawing-overlay="${key}" ${viewport.overlays?.[key] === false ? '' : 'checked'}>${label}</label>`).join('')}</fieldset>`}<div id="mcDrawingStage" class="mc-drawing-stage ${drawingCoverageRegionItemId?'is-drawing-review-region':''}"><canvas id="mcDrawingCanvas" aria-label="${esc(sheet.sheetNumber || `PDF page ${sheet.pageNumber}`)} ${esc(sheet.sheetTitle || 'drawing')}"></canvas><div class="mc-drawing-overlay-layer" aria-label="Drawing evidence overlays"></div></div>${drawingRotation || sheet.rotation ? '<p class="mc-drawing-note">Location highlights are synchronized with the rotated drawing view.</p>' : ''}`}
      </main>
      <aside id="${shell === 'mission-control' ? 'missionPlansSheetInspector' : 'drawingSheetInspector'}" class="mc-drawing-evidence" aria-label="Construction Intelligence">${constructionIntelligencePanelMarkup(constructionIntelligencePanel)}</aside>${chiefDrawingDockMarkup(chiefCards)}
    </div>${drawingLifecycleUnavailable.length ? `<section class="mc-drawing-recovery-list" aria-label="Unavailable drawing lifecycle records"><h2>Drawing records requiring attention</h2>${drawingLifecycleUnavailable.map(drawingRecoveryMarkup).join('')}</section>` : ''}`;
  drawingWorkspaceRenderCount += 1;
  drawingTraceSlowOperation('workspace render', workspaceRenderStartedAt, { renderCount: drawingWorkspaceRenderCount, pageId: sheet?.pageId || '', documentId: selected.id, leftPanel: Boolean(host.querySelector('.mc-drawing-index')) });
  const placeholderCanvas = host.querySelector('#mcDrawingCanvas');
  const drawingStageForObjectTools = host.querySelector('#mcDrawingStage');
  if (drawingStageForObjectTools && activeDrawingObjects.length) {
    const tools = document.createElement('nav');
    tools.className = 'mc-drawing-object-tools';
    tools.setAttribute('aria-label', 'Drawing object navigation');
    tools.innerHTML = `<button data-drawing-object-nav="previous">Previous Object</button><button data-drawing-object-nav="next">Next Object</button><button data-drawing-object-nav="room">Next Room</button><button data-drawing-object-nav="equipment">Next Equipment</button><button data-drawing-object-nav="finish">Next Finish</button>${validNormalizedRegion(selectedDrawingObject?.region) ? '<button data-drawing-object-center>Center on Item</button><button data-drawing-object-location>Zoom to Item</button>' : ''}`;
    drawingStageForObjectTools.before(tools);
  }
  const actionBindings=[['[data-drawing-previous]','previous-page',{}],['[data-drawing-next]','next-page',{}],['[data-drawing-fit="page"]','fit-page',{}],['[data-drawing-fit="width"]','fit-width',{}],['[data-drawing-spec-explorer]','open-specification-explorer',{}],['[data-drawing-rotate]','rotate-clockwise',{}],['[data-drawing-reset-view]','reset-view',{}],['[data-drawing-ask]','ask-chief',{}],['[data-coverage-review-open]','open-coverage-review',{}],['[data-coverage-review-close]','close-coverage-review',{}],['[data-drawing-clear-object]','clear-selection',{}],['[data-drawing-object-nav="previous"]','previous-object',{}],['[data-drawing-object-nav="next"]','next-object',{}],['[data-drawing-object-nav="room"]','next-room',{}],['[data-drawing-object-nav="equipment"]','next-equipment',{}],['[data-drawing-object-nav="finish"]','next-finish',{}],['[data-drawing-object-center]','center-object',{objectId:selectedDrawingObject?.objectId,region:selectedDrawingObject?.region}],['[data-drawing-object-location]','zoom-object',{objectId:selectedDrawingObject?.objectId,region:selectedDrawingObject?.region}]];
  for(const[selector,actionId,target]of actionBindings)for(const control of host.querySelectorAll(selector)){control.dataset.drawingAction=actionId;control.dataset.drawingActionTarget=JSON.stringify(target);}
  logger.debug('Drawing action audit',auditDrawingActions(controlsFromDrawingRoot(host),{pageId:sheet?.pageId}));
  const preserveCanvas = Boolean(preservedCanvas && placeholderCanvas && preservedCanvas.dataset.drawingDocument === selected.id);
  if (preserveCanvas) placeholderCanvas.replaceWith(preservedCanvas);
  if (preserveCanvas) portableDrawingCanvas = null;
  const nextStage = host.querySelector('#mcDrawingStage');
  if (nextStage && preserveCanvas) { nextStage.scrollLeft = preservedViewport.scrollLeft; nextStage.scrollTop = preservedViewport.scrollTop; }
  const nextBrowser = host.querySelector('.mc-drawing-index');
  if (nextBrowser) nextBrowser.scrollTop = preservedBrowserScroll;
  const nextIntelligence = shell === 'mission-control' ? host.querySelector('#missionPlansSheetInspector') : host.querySelector('.mc-drawing-evidence');
  if (nextIntelligence) {
    activeDrawingInspectorPanel = nextIntelligence;
    activeDrawingInspectorPanelSheetId = sheet?.sheetId || '';
    if (shell === 'mission-control') updatePlansInspectorOwnership({ ...(plansInspectorContext || {}), panel: nextIntelligence });
    nextIntelligence.scrollTop = pendingDrawingPanelScroll ?? preservedIntelligenceScroll ?? constructionIntelligenceScroll[constructionIntelligencePanel.mode] ?? 0;
    pendingDrawingPanelScroll = null;
  }
  if (drawingSafeMode && shell !== 'mission-control') return;
  const inspectorContext = shell === 'mission-control'
    ? getActivePlansSheetContext({ analysis, sheet, generationId: drawingWorkspaceRenderRequest, shell, panel: nextIntelligence })
    : null;
  emitDrawingRendered({
    generationId: drawingWorkspaceRenderRequest,
    sheetId: sheet?.sheetId || '',
    pageId: sheet?.pageId || '',
    projectId: analysis?.projectId || state().activeProject,
    shell,
    workspaceRenderRequest,
    selected,
    sheet,
    analysis,
    source,
    documentId: selected.id,
    requestToken: workspaceRenderRequest,
    effectiveObservation,
    effectiveRegion,
    overlayRecords,
    preservedBrowserScroll,
    preservedViewport,
    preservedCanvas,
    preservedStage,
    preservedIntelligenceScroll,
    viewState: null,
    sheetLegends: [],
    sheetSchedules: [],
    sheetKeyedNotes: [],
    sheetOccurrences: [],
    pageSpecificationLinks: [],
    selectedSpecificationLinks: [],
    requirementInput: {},
    activeRequirements: { status: 'loading', requirements: [], confirmedSpecifications: [], suggestedSpecifications: [], projectWideRequirements: [], fieldRequirements: {}, warnings: providerWarnings, providerFailures: workspaceProviderFailures },
    rightPanelSignature: '',
    inspectorContext,
    renderAfterPaint: true,
    currentSheet: sheet,
    pageContext,
    observations,
    activeDrawingObjects,
    selectedDrawingObject,
    selectedDrawingObjectIds,
    activeRelationshipContext
  });
  return;
  const requirementsPageKey = drawingTarget?.pageId || sheet?.pageId || '';
  const requirementsObjectKey = selectedDrawingObject?.objectId || '';
  const requirementsEvidenceVersion = [
    sheetSpecificationLinks.map(item => `${item.linkId}:${item.status}:${item.updatedAt || item.createdAt || ''}`).join(','),
    activeDrawingObjects.map(item => `${item.objectId}:${item.verificationState}:${item.updatedAt || ''}`).join(','),
    sheetLegends.length,
    sheetSchedules.length,
    sheetKeyedNotes.length,
    sheetOccurrences.length,
    pageSpecificationLinks.length,
    selectedSpecificationLinks.length
  ].join('|');
  const requirementsRequestKey = drawingRequirementsCacheKey({ projectId: analysis?.projectId || selected.projectId || state().activeProject, documentId: selected.id, drawingSetId: analysis?.drawingSetId || '', pageId: requirementsPageKey, selectedObjectId: requirementsObjectKey, evidenceVersion: requirementsEvidenceVersion });
  const requirementsRequestGeneration = ++drawingRequirementsRequestGeneration;
  drawingRequirementsRequestKey = requirementsRequestKey;
  if (drawingRequirementsRefreshTimer) clearTimeout(drawingRequirementsRefreshTimer);
  drawingRequirementsRefreshTimer = setTimeout(() => {
    drawingRequirementsRefreshTimer = null;
    if (requirementsRequestGeneration !== drawingRequirementsRequestGeneration || drawingRequirementsRequestKey !== requirementsRequestKey || workspaceRenderRequest !== drawingWorkspaceRenderRequest || drawingTarget?.documentId !== selected.id || Number(drawingTarget?.pageNumber) !== Number(sheet?.pageNumber)) return;
    const intelligenceStartedAt = globalThis.performance?.now?.() ?? Date.now();
    drawingSpecificationResolveCount += 1;
    console.warn('specification resolve count', drawingSpecificationResolveCount, { pageId: sheet?.pageId || '', pageNumber: sheet?.pageNumber, stack: new Error().stack });
    const commitRequirements = activeRequirements => {
      if (requirementsRequestGeneration !== drawingRequirementsRequestGeneration || drawingRequirementsRequestKey !== requirementsRequestKey || workspaceRenderRequest !== drawingWorkspaceRenderRequest || drawingTarget?.documentId !== selected.id || Number(drawingTarget?.pageNumber) !== Number(sheet?.pageNumber)) return;
      const panel = host.querySelector('.mc-drawing-evidence'); if (!panel) return;
      const panelRequest = ++drawingPanelRefreshRequest;
      requestAnimationFrame(() => {
        if (panelRequest !== drawingPanelRefreshRequest || !panel.isConnected || workspaceRenderRequest !== drawingWorkspaceRenderRequest || drawingTarget?.documentId !== selected.id || Number(drawingTarget?.pageNumber) !== Number(sheet?.pageNumber)) return;
        const panelStartedAt = globalThis.performance?.now?.() ?? Date.now(); const scrollTop = panel.scrollTop; const panelModel = buildIntelligencePanel(activeRequirements); const panelSignature = constructionIntelligencePanelSignature(panelModel); const panelNodeCountBefore = panel.querySelectorAll('*').length; const rightPanelCardCountBefore = panel.querySelectorAll('.mc-ci-group, .mc-ci-specifications li, .mc-ci-record-list li, .mc-ci-work-phase li').length;
        const panelUpdated = panel.dataset.panelSignature !== panelSignature;
        replaceTrackedResource('inspector-model', panelModel, { pageId: sheet?.pageId || '', mode: panelModel.mode, phase: panelUpdated ? 'updated' : 'cached' });
        if (panelUpdated) { const rightPanelStartedAt = drawingPerfNow(); panel.innerHTML = constructionIntelligencePanelMarkup(panelModel); panel.dataset.panelSignature = panelSignature; drawingInspectorRenderCount += 1; drawingTraceSlowOperation('right panel update', rightPanelStartedAt, { renderCount: drawingInspectorRenderCount, pageId: sheet?.pageId || '', mode: panelModel.mode }); }
        panel.scrollTop = scrollTop;
        const panelNodeCountAfter = panel.querySelectorAll('*').length;
        const rightPanelCardCountAfter = panel.querySelectorAll('.mc-ci-group, .mc-ci-specifications li, .mc-ci-record-list li, .mc-ci-work-phase li').length;
        logger.debug('Drawing workspace DOM', { region: 'right-panel', pageId: sheet?.pageId || '', panelUpdated, panelNodeCountBefore, panelNodeCountAfter, rightPanelCardCountBefore, rightPanelCardCountAfter, domUpdateMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - panelStartedAt), resolutionMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - intelligenceStartedAt), providerFailureCount: activeRequirements.providerFailures.length, contained: true });
        reportDrawingResourceSnapshot('sheet-change', { pageId: sheet?.pageId || '', pageNumber: sheet?.pageNumber || 0, phase: 'inspector-update', panelUpdated, interactionId: drawingInteractionTrace.id });
      });
    };
    const cached = drawingRequirementsResultCache.get(requirementsRequestKey);
    if (cached) {
      commitRequirements(cached);
      return;
    }
    void drawingRequirementsResolver.resolveLatest(requirementInput).then(outcome => {
      if (!outcome.committed || requirementsRequestGeneration !== drawingRequirementsRequestGeneration || drawingRequirementsRequestKey !== requirementsRequestKey || workspaceRenderRequest !== drawingWorkspaceRenderRequest || drawingTarget?.documentId !== selected.id || Number(drawingTarget?.pageNumber) !== Number(sheet?.pageNumber)) return;
      const resolved = outcome.result;
      const activeRequirements = { ...resolved, status: providerWarnings.length && resolved.status === 'complete' ? 'partial' : resolved.status, warnings: [...(resolved.warnings || []), ...providerWarnings], providerFailures: [...(resolved.providerFailures || []), ...workspaceProviderFailures] };
      replaceTrackedResource('requirement-model', activeRequirements, { pageId: sheet?.pageId || '', status: activeRequirements.status });
      
      // Store specification results by pageId for preservation across navigation
      if (sheet?.pageId && (activeRequirements.confirmedSpecifications?.length > 0 || activeRequirements.suggestedSpecifications?.length > 0)) {
        pageRequirementState.set(sheet.pageId, {
          confirmedSpecifications: activeRequirements.confirmedSpecifications,
          suggestedSpecifications: activeRequirements.suggestedSpecifications,
          requirements: activeRequirements.requirements,
          status: activeRequirements.status,
          timestamp: Date.now()
        });
      }
      
      drawingRequirementsResultCache.delete(requirementsRequestKey);
      drawingRequirementsResultCache.set(requirementsRequestKey, structuredClone(activeRequirements));
      while (drawingRequirementsResultCache.size > drawingRequirementsResultCacheMaxEntries) {
        const oldestKey = drawingRequirementsResultCache.keys().next().value;
        drawingRequirementsResultCache.delete(oldestKey);
      }
      for (const failure of activeRequirements.providerFailures) logger.warning('Construction intelligence provider failure', { ...failure, pageId: sheet?.pageId || '', objectId: selectedDrawingObject?.objectId || '', timestamp: new Date().toISOString(), contained: true });
      activeDrawingTransientRequirementCount = activeRequirements.requirements?.length || 0;
      commitRequirements(activeRequirements);
    }).catch(error => logger.warning('Construction intelligence provider failure', { provider: 'requirements-resolver', code: 'construction-intelligence-provider-failure', pageId: sheet?.pageId || '', message: error?.message || String(error), contained: true, timestamp: new Date().toISOString() }));
  }, 0);
  const restoredFocus = preservedFocusSelector ? host.querySelector(preservedFocusSelector) : null;
  if (restoredFocus) restoredFocus.focus({ preventScroll: true });
  else if (focusTarget && host.querySelector(`#${focusTarget}`)) {
    const focusTargetElement = host.querySelector(`#${focusTarget}`) || host.querySelector('.mc-drawing-sheet-title');
    if (focusTargetElement && !host.querySelector('.mc-drawing-sheet-title')?.matches(':focus')) {
      focusTargetElement.focus({ preventScroll: true });
    }
  }
}

async function renderMissionControlDashboard() {
  $('#missionControlContent').innerHTML = `
    <section class="mc-dashboard-shell" aria-labelledby="missionControlTitle">
      <header class="mc-dashboard-toolbar">
        <div>
          <span class="mc-dashboard-eyebrow">MISSION PMIS</span>
          <h1 id="missionControlTitle" tabindex="-1">Dashboard</h1>
        </div>
        <div class="mc-dashboard-actions">
          <button type="button" data-control-action="refresh-dashboard">Refresh Dashboard</button>
          <button type="button" data-control-action="open-dashboard-window">Open in New Window</button>
        </div>
      </header>
      <section class="mc-dashboard-surface" aria-label="Mission PMIS Dashboard">
        <div id="missionDashboardStatus" class="mc-dashboard-status" role="status" aria-live="polite">Loading Mission PMIS…</div>
        <iframe id="missionPmisDashboardFrame" class="mc-dashboard-frame" title="Mission PMIS Dashboard" src="${missionPmisDashboardUrl}" sandbox="allow-forms allow-popups allow-scripts allow-same-origin"></iframe>
      </section>
    </section>`;
  const frame = $('#missionPmisDashboardFrame');
  const status = $('#missionDashboardStatus');
  if (!frame || !status) return;
  let settled = false;
  const markReady = () => {
    if (settled) return;
    settled = true;
    status.classList.add('ready');
    status.textContent = 'Mission PMIS ready';
    frame.hidden = false;
  };
  const markUnavailable = () => {
    if (settled) return;
    settled = true;
    status.classList.remove('ready');
    status.classList.add('error');
    status.textContent = 'Mission PMIS is currently unavailable. Open in New Window to continue in the hosted app.';
    frame.hidden = true;
  };
  frame.addEventListener('load', () => markReady(), { once: true });
  frame.addEventListener('error', () => markUnavailable(), { once: true });
  window.setTimeout(() => {
    if (!settled) markUnavailable();
  }, 9000);
  frame.hidden = true;
}

async function renderMissionControlPlans() {
  const usePlansV2 = isPlansV2Enabled();
  if (!usePlansV2) {
    plansV2Controller?.destroy?.();
    plansV2Controller = null;
    $('#missionControlContent').innerHTML = '<div id="missionDrawingViewer" class="mc-drawing-workspace"></div>';
    await renderDrawingWorkspace('mission-control');
    return;
  }
  const project = state().projects.find(item => item.id === state().activeProject) || null;
  const documents = await engine.documents();
  const allAnalyses = await currentDrawingAnalyses();
  const analysis = activeDrawingViewerAnalysis?.documentId
    ? (allAnalyses.find(item => item.documentId === activeDrawingViewerAnalysis.documentId) || activeDrawingViewerAnalysis)
    : allAnalyses[0] || null;
  const documentRecord = documents.find(item => item.id === analysis?.documentId) || null;
  const shouldBootstrapBedfordSpecificationKnowledge = /bedford/i.test([
    project?.id,
    project?.name,
    analysis?.documentId,
    documentRecord?.name,
    documentRecord?.title
  ].join(' '));
  if (shouldBootstrapBedfordSpecificationKnowledge) {
    await ensureSpecificationKnowledge({
      engine,
      projectId: project?.id || analysis?.projectId || state().activeProject || '',
      libraryId: state().activeLibrary || '',
      manualFileName: BEDFORD_SPECIFICATION_MANUAL_FILE_NAME,
      manualPath: BEDFORD_SPECIFICATION_MANUAL_PATH,
      fetcher: globalThis.fetch?.bind(globalThis),
      onDiagnostic: metric => logger.debug('Bedford specification knowledge bootstrap', metric)
    });
    indexSpecificationDocuments({
      specificationIndex,
      documents: await engine.documents(),
      sections: await engine.sections(),
      projectId: project?.id || analysis?.projectId || state().activeProject || ''
    });
    // Populate drawing-spec-links for the current drawing
    if (analysis?.documentId && analysis?.sheets?.length) {
      for (const sheet of analysis.sheets) {
        // Clear existing auto-generated links for this page first
        const existingLinks = drawingSpecificationLinks.forPage(sheet.pageId);
        existingLinks.forEach(link => {
          if (link.origin === 'bedford-import' || link.origin === 'explicit-reference' || link.origin === 'object-recognition' || link.origin === 'drawing-metadata') {
            drawingSpecificationLinks.remove(link.linkId);
          }
        });
        
        const sheetObservations = (analysis?.observations || []).filter(item => item.sheetId === sheet.sheetId);
        const pageId = sheet.pageId || '';
        if (pageId) {
          populateBedfordDrawingSpecLinks({
            drawingSpecificationLinks,
            specificationIndex,
            projectId: project?.id || analysis?.projectId || state().activeProject || '',
            drawingPageId: pageId,
            sheetDiscipline: sheet.discipline || '',
            sheet,
            observations: sheetObservations,
            schedules: [], // Would need to extract from analysis
            legends: [], // Would need to extract from analysis
            occurrences: [], // Would need to extract from analysis
            keyedNotes: [], // Would need to extract from analysis
            activeDrawingObjects: [], // Will be populated when drawing is rendered
            references: [], // Would need to extract from analysis
            projectSpecificationVocabulary
          });
        }
      }
    }
    
    // Rebuild reverse index after populating links
    specificationReverseIndex.buildIndex();
  }
  const pageCount = Math.max(0, Number(analysis?.sheets?.length) || 0);
  const generatedCatalog = normalizeGeneratedDrawingCatalog(await generatedDrawingCatalogFor(documentRecord || {}, pageCount));
  const authoritativeRecords = [...generatedCatalog, ...(building61DrawingCatalogFor(documentRecord || {}, pageCount) || [])];
  const authoritativeByPage = new Map(authoritativeRecords.map(record => [Number(record.pdfPageNumber || record.pageNumber) || 0, record]));
  const buildingId = documentRecord?.buildingId || documentRecord?.metadata?.buildingId || '61';
  const sheets = (analysis?.sheets || []).map(sheet => {
    const authoritative = authoritativeByPage.get(Number(sheet.pageNumber) || Number(sheet.pdfPage) || 0) || {};
    return {
      ...sheet,
      sheetNumber: sheet.sheetNumber || authoritative.sheetNumber || '',
      sheetTitle: sheet.sheetTitle || authoritative.sheetTitle || '',
      discipline: sheet.discipline || authoritative.discipline || '',
      drawingType: sheet.drawingType || sheet.primarySheetType || authoritative.drawingType || authoritative.primarySheetType || '',
      pageId: sheet.pageId || authoritative.pageId || '',
      drawingId: sheet.drawingId || authoritative.drawingId || '',
      documentId: sheet.documentId || analysis?.documentId || '',
      drawingSetId: sheet.drawingSetId || analysis?.drawingSetId || '',
      projectId: sheet.projectId || analysis?.projectId || state().activeProject || '',
      building: sheet.building || authoritative.building || buildingId || '',
      pdfPage: sheet.pdfPage || sheet.pageNumber || authoritative.pdfPageNumber || authoritative.pageNumber || 0
    };
  });
  const currentSheet = sheets.find(item => item.sheetId === drawingTarget?.sheetId || Number(item.pageNumber) === Number(drawingTarget?.pageNumber)) || sheets[0] || null;
  await bedfordRelationshipGraph.build({
    projectId: state().activeProject,
    analysis: analysis ? { ...analysis, sheets } : analysis,
    documents,
    sheets,
    specificationIndex,
    drawingSpecificationLinks,
    projectRelationshipEngine,
    projectObjectRegistry
  });
  plansV2Controller?.destroy?.();
  $('#missionControlContent').innerHTML = '<div id="missionDrawingViewer" class="mc-drawing-workspace"></div>';
  const stage = $('#missionDrawingViewer');
  plansV2Controller = createPlansController({
    root: stage,
    requirementsResolver: drawingRequirementsResolver,
    buildPanelModel: buildConstructionIntelligencePanelModel,
    panelMarkup: constructionIntelligencePanelMarkup,
    initialAnalysis: analysis ? { ...analysis, sheets } : { projectId: state().activeProject, drawingSetId: drawingTarget?.drawingSetId || '', sheets: [] },
    initialSheetId: currentSheet?.sheetId || '',
    relationshipGraph: bedfordRelationshipGraph,
    drawingSpecificationLinks,
    sourceResolver: async sheet => {
      const documentId = sheet?.documentId || analysis?.documentId || drawingTarget?.documentId || '';
      if (!documentId) return null;
      const storedSource = await engine.sourceFile(documentId);
      if (storedSource?.sourceBlob) return storedSource;
      const sourceFilePath = sheet?.sourceFilePath || analysis?.sourceFilePath ||
        'project-documents/bedford/drawings/518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf';
      return {
        ...(storedSource || {}),
        documentId,
        projectId: sheet?.projectId || analysis?.projectId || state().activeProject || '',
        sourceFilePath,
        sourceUrl: new URL(sourceFilePath, globalThis.document?.baseURI || globalThis.location?.href || 'http://localhost/').href,
        mimeType: 'application/pdf'
      };
    },
    onViewSource: async target => {
      const documentRecord = (await engine.documents()).find(item => item.id === target.documentId);
      if (!documentRecord) return;
      const source = await engine.sourceFile(documentRecord.id);
      if (!source?.sourceBlob) return;
      await specificationSourceViewer.open({
        document: documentRecord,
        sourceBlob: source.sourceBlob,
        pageNumber: target.pageNumber,
        sectionNumber: target.sectionNumber,
        sectionTitle: target.sectionTitle,
        articleReference: target.articleReference,
        returnTarget: specificationDrawingReturnTarget,
        canvas: $('#specificationSourceCanvas') || undefined
      });
    }
  });
  const initializeResult = await plansV2Controller.initialize({
    project,
    analysis,
    drawingSet: analysis,
    sheets
  });
  if (!initializeResult?.committed && initializeResult?.error) {
    const status = stage.querySelector('[data-plans-status]');
    if (status) status.textContent = `Failed to load drawings: ${initializeResult.error.message || String(initializeResult.error)}`;
  }
}

async function renderMissionControl(prefetchedDocuments = null, prefetchedSections = null) {
  if (missionControlView === 'projects') {
    renderMyProjects();
    return;
  }
  if (missionControlView === 'chat' || missionControlView === 'history') {
    await renderChiefWorkspace({ historyVisible: missionControlView === 'history' });
    return;
  }
  if (missionControlView === 'library') { await renderMissionControlLibrary(); return; }
  if (missionControlView === 'inspections') { await renderMissionControlInspections(); return; }
  if (missionControlView === 'plans') { await renderMissionControlPlans(); return; }
  if (missionControlView === 'dashboard') { await renderMissionControlDashboard(); return; }
  await renderChiefWorkspace();
}

$('#openProfessionalWorkspace').onclick = () => switchExperience('professional-workspace', { destination: view });
$('[data-control-experience]')?.addEventListener('click', () => {
  void switchExperience('professional-workspace', { destination: view });
});
$('#returnMissionControl').onclick = () => switchExperience('mission-control');

function showMissionControlView(name = 'home') {
  if (!['plans', 'dashboard', 'home', 'history'].includes(name)) releaseDrawingSource();
  missionControlView = ['projects', 'chat', 'history', 'library', 'inspections', 'plans', 'dashboard', 'home'].includes(name) ? name : 'home';
  const homeButton = $('[data-control-home]');
  homeButton?.toggleAttribute('aria-current', missionControlView === 'home');
  $$('.mc-control-nav button[data-control-view]').forEach(button => {
    const active = button.dataset.controlView === missionControlView;
    button.toggleAttribute('aria-current', active);
  });
  return renderMissionControl().then(() => $('#missionControlTitle')?.focus());
}
$('[data-control-home]').onclick = () => showMissionControlView('home');
$$('[data-control-view]').forEach(button => button.onclick = () => showMissionControlView(button.dataset.controlView));
$('#missionControlContent').onclick = async event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.actionTarget) {
    const actionTarget = resolveSharedActionTarget(button.dataset.actionTarget);
    if (!actionTarget) return;
    if (actionTarget.kind === 'drawing') {
      chiefConstructionContext = createChiefConstructionContext({ conversationId: engine.activeConversation()?.conversationId, projectId: actionTarget.projectId, planResult: activePlanQuery || {}, drawingTarget: createDrawingTarget({ projectId: actionTarget.projectId, documentId: actionTarget.documentId, drawingSetId: actionTarget.drawingSetId, drawingId: actionTarget.drawingId, sheetId: actionTarget.sheetId, pageNumber: actionTarget.pageNumber, observationId: actionTarget.observationId, region: actionTarget.region, origin: actionTarget.origin || 'assistant' }), workPackageReferences: { matchingSheetIds: drawingMatchingSheetIds, matchingObservationIds: activePlanQuery?.matchingObservationIds || [] }, updatedFrom: actionTarget.origin || 'shared-action' });
      await openProfessionalDestination({ view: 'drawings', documentId: actionTarget.documentId, projectId: actionTarget.projectId, sheetId: actionTarget.sheetId, pageNumber: actionTarget.pageNumber, observationId: actionTarget.observationId, region: actionTarget.region, origin: actionTarget.origin || 'assistant' });
      return;
    }
    if (actionTarget.kind === 'source') {
      await openProfessionalDestination({ view: actionTarget.destination || (actionTarget.sectionId ? 'knowledge' : 'sources'), documentId: actionTarget.documentId, projectId: actionTarget.projectId, sectionId: actionTarget.sectionId, messageId: actionTarget.messageId, origin: actionTarget.origin || 'assistant' });
      return;
    }
    if (actionTarget.kind === 'inspection') {
      selectedInspectionId = actionTarget.inspectionId || '';
      await openProfessionalDestination({ view: 'inspections', inspectionId: actionTarget.inspectionId || '' });
      return;
    }
    if (actionTarget.kind === 'evidence') {
      const message = engine.activeConversation()?.messages.find(item => item.id === actionTarget.messageId);
      if (message?.hits?.length) {
        const current = state();
        const documents = await engine.documents();
        const sections = await engine.sections();
        activeRetrievalSession = createRetrievalSession({ question: '', timestamp: message.createdAt, project: current.projects.find(item => item.id === current.activeProject), library: engine.libraries().find(item => item.id === current.activeLibrary), mode: message.mode, messageId: message.id, hits: message.hits, citations: message.citations || [], citationVerification: message.citationVerification, retrievalMeta: message.retrievalMeta, documents, libraries: engine.libraries(), sections });
        await openProfessionalDestination({ view: 'evidence' });
      }
      return;
    }
    if (actionTarget.kind === 'view') {
      await openProfessionalDestination({ view: actionTarget.destination || 'project' });
      return;
    }
  }
  if (button.dataset.workPackageSheet && activeWorkPackage) {
    const target = activeWorkPackage.viewerTargets.find(item => item.sheetId === button.dataset.workPackageSheet);
    if (target) { drawingTarget = createDrawingTarget(target); selectedWorkPackageItem = target.observationId || target.sheetId; if (missionControlView === 'chat') { await renderMissionControlChat(); $('#missionInlineDrawingViewer .mc-drawing-sheet-title')?.focus(); } else await showMissionControlView('plans'); }
    return;
  }
  if (button.hasAttribute('data-inline-full-drawing')) {
    await showMissionControlView('plans');
    $('#missionDrawingViewer .mc-drawing-sheet-title')?.focus();
    return;
  }
  if (button.dataset.drawingEmptyAction === 'chief') {
    await showMissionControlView('home');
    return;
  }
  if (button.dataset.drawingEmptyAction === 'import') {
    await openProfessionalDestination({ view: 'project' });
    return;
  }
  if (button.hasAttribute('data-work-package-current') && activeWorkPackage) {
    const target = currentWorkActivationTarget(activeWorkPackage);
    if (!target.available) { alert(target.reason); return; }
    const result = await activateEngineeringContext({ ...target.request, source: CONTEXT_ACTIVATION_SOURCES.constructionWorkPackage });
    if (!result.available) alert(result.reasons.join(' '));
    else await showMissionControlView('home');
    return;
  }
  if (button.hasAttribute('data-work-package-inspection') && activeWorkPackage) {
    await openProfessionalDestination({ view: 'inspections' });
    await openInspectionForm(null, inspectionPrefillFromWorkPackage(activeWorkPackage));
    return;
  }
  if (button.dataset.controlView) return showMissionControlView(button.dataset.controlView);
  if (button.dataset.controlAction === 'show-history') {
    chiefHistoryVisible = !chiefHistoryVisible;
    await renderChiefWorkspace({ historyVisible: chiefHistoryVisible });
    return;
  }
  if (button.dataset.controlAction === 'refresh-dashboard') {
    await showMissionControlView('dashboard');
    return;
  }
  if (button.dataset.controlAction === 'open-dashboard-window') {
    window.open(missionPmisDashboardUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  if (button.dataset.controlTarget) {
    const target = JSON.parse(button.dataset.controlTarget);
    if (target.view === 'chat') return showMissionControlView('chat');
    if (target.view === 'knowledge') return showMissionControlView('library');
    if (target.view === 'plans') return showMissionControlView('plans');
    return openProfessionalDestination(target);
  }
  if (button.dataset.controlDestination) return openProfessionalDestination({ view: button.dataset.controlDestination });
  if (button.dataset.controlProjectId) {
    await selectProjectThroughProductionPath(button.dataset.controlProjectId);
    missionControlView = 'home';
    await switchExperience('mission-control');
    return;
  }
  if (button.dataset.controlInspectionId) {
    selectedInspectionId = button.dataset.controlInspectionId;
    await openProfessionalDestination({ view: 'inspections', inspectionId: selectedInspectionId });
    return;
  }
  if (button.dataset.controlPrompt) {
    await showMissionControlView('home');
    $('#missionControlPrompt').value = button.dataset.controlPrompt;
    $('#missionControlPrompt').focus();
    return;
  }
  if (button.dataset.conversationId) {
    const conversation = engine.activateConversation(button.dataset.conversationId);
    if (conversation.projectId && conversation.projectId !== state().activeProject && state().projects.some(project => project.id === conversation.projectId)) {
      await selectProjectThroughProductionPath(conversation.projectId);
    }
    activeRetrievalSession = null;
    missionControlAttachments = [];
    chiefConstructionContext = null; activePlanQuery = null; activeWorkPackage = null; activeWorkPackageMessageId = ''; activeChiefLocationPresentation = null;
    await showMissionControlView('chat');
    $('#missionControlTitle')?.focus();
    return;
  }
  if (button.dataset.renameConversation) {
    const current = engine.conversations().find(item => item.conversationId === button.dataset.renameConversation);
    const title = prompt('Conversation name', current?.title || '');
    if (title !== null) { engine.renameConversation(button.dataset.renameConversation, title); renderConversationHistory(); }
    return;
  }
  if (button.dataset.removeAttachment) {
    engine.removeConversationAttachment(button.dataset.removeAttachment);
    await renderMissionControlChat();
    return;
  }
  if (button.dataset.controlSourceDocument) {
    selectedDoc = button.dataset.controlSourceDocument;
    sourceNavigationTarget = button.dataset.controlSourceSection ? createSourceTarget({ projectId: state().activeProject, documentId: selectedDoc, sectionId: button.dataset.controlSourceSection, originatingWorkspace: 'chat' }) : null;
    await openProfessionalDestination({ view: button.dataset.controlSourceSection ? 'knowledge' : 'sources', documentId: selectedDoc });
    return;
  }
  if (button.dataset.controlDrawingDocument) {
    drawingTarget = createDrawingTarget({ projectId: state().activeProject, documentId: button.dataset.controlDrawingDocument, pageNumber: Number(button.dataset.controlDrawingPage) });
    await showMissionControlView('plans');
    return;
  }
  if (button.dataset.controlEvidenceMessage) {
    const message = engine.activeConversation()?.messages.find(item => item.id === button.dataset.controlEvidenceMessage);
    if (message?.hits?.length) {
      const current = state();
      const documents = await engine.documents();
      const sections = await engine.sections();
      activeRetrievalSession = createRetrievalSession({ question: '', timestamp: message.createdAt, project: current.projects.find(item => item.id === current.activeProject), library: engine.libraries().find(item => item.id === current.activeLibrary), mode: message.mode, messageId: message.id, hits: message.hits, citations: message.citations || [], citationVerification: message.citationVerification, retrievalMeta: message.retrievalMeta, documents, libraries: engine.libraries(), sections });
      await openProfessionalDestination({ view: 'evidence' });
    }
    return;
  }
  const action = button.dataset.controlAction;
  if (action === 'new-conversation') {
    engine.createConversation({ projectId: missionControlProject()?.id || '' });
    activeRetrievalSession = null;
    chiefHistoryVisible = false;
    missionControlAttachments = [];
    activePlanQuery = null; activeWorkPackage = null; activeWorkPackageMessageId = ''; chiefConstructionContext = null; drawingMatchingSheetIds = []; selectedWorkPackageItem = ''; activeChiefLocationPresentation = null;
    await showMissionControlView('home');
    $('#missionControlPrompt')?.focus();
    return;
  }
  if (action === 'create-inspection') {
    await openProfessionalDestination({ view: 'inspections' });
    await openInspectionForm();
  } else if (action === 'demo-guide') {
    demoGuideDismissed = false;
    renderDemonstrationControls();
  } else if (action === 'load-demo') {
    $('#loadDemoProject').click();
  } else if (action === 'create-project') {
    $('#newProject').click();
  } else if (action === 'my-projects') {
    await showMissionControlView('projects');
  } else if (action === 'import-project') {
    $('#importProject').click();
  } else if (action === 'return-projects') {
    await returnFromDemonstrationProject();
  } else if (action === 'reset-demo') {
    $('#resetDemoProject').click();
  } else if (action?.startsWith('browse-')) {
    await openProfessionalDestination({ view: 'knowledge' });
    const query = ({ 'browse-drawings': 'Drawings', 'browse-specifications': 'Specifications', 'browse-rfis': 'RFIs', 'browse-submittals': 'Submittals' })[action];
    $('#documentFilter').value = query;
    renderKnowledgeWorkspace();
  }
};

app.addEventListener('input',event=>{if(!event.target.matches('[data-chief-dock-width]'))return;const started=globalThis.performance?.now?.()??Date.now(),next=chiefDrawingDock.resize(event.target.value),dock=event.target.closest('.mc-chief-drawing-dock');if(dock)dock.style.setProperty('--chief-dock-width',`${next.width}px`);logger.debug('Chief drawing dock performance',{operation:'resize',durationMs:(globalThis.performance?.now?.()??Date.now())-started,drawingRerenderCount:0});});

app.addEventListener('submit',async event=>{if(event.target.id!=='chiefDrawingDockComposer')return;event.preventDefault();const prompt=$('#chiefDrawingDockPrompt'),button=$('#chiefDrawingDockSend'),value=prompt?.value.trim();if(!value||button?.disabled)return;const started=globalThis.performance?.now?.()??Date.now();button.disabled=true;button.textContent='Thinking…';try{const classification=classifyChiefDrawingCommand(value),analysis=activeDrawingViewerAnalysis,objects=projectObjectRegistry.findObjects({projectId:state().activeProject,limit:1000}),sections=specificationIndex.sections({projectId:state().activeProject}),activeLink=drawingSpecificationLinks.forPage(activeChiefDrawingContext?.identity?.pageId||'',selectedDrawingObject?.objectId).find(item=>item.status!=='rejected')||drawingSpecificationLinks.forPage(activeChiefDrawingContext?.identity?.pageId||'').find(item=>item.status!=='rejected'),activeSection=activeLink&&specificationIndex.get(activeLink.specificationDocumentId,activeLink.sectionNumber),resolution=resolveChiefDrawingCommand(classification,{pages:analysis?.sheets||[],objects,sections,context:{returnState:specificationDrawingReturnTarget,selectedObject:selectedDrawingObject,sourceTarget:activeSection?{documentId:activeSection.documentId,pageNumber:activeSection.startPdfPage,sectionNumber:activeSection.sectionNumber,sectionTitle:activeSection.sectionTitle}:null}}),contextAnswer=answerChiefDrawingContextQuestion(value,activeChiefDrawingContext||{});if(classification.exact){if(!engine.activeConversation())engine.createConversation({projectId:state().activeProject});engine.appendConversationMessage({role:'user',content:value});if(resolution.status==='resolved'){const action=await drawingActionRouter.execute(resolution.actionId,resolution.target,{executionToken:`chief:${Date.now()}`});engine.appendConversationMessage({role:'assistant',content:action.ok?resolution.summary:`Could not complete that exact drawing action. ${action.message||''}`.trim()});}else if(resolution.status==='ambiguous')engine.appendConversationMessage({role:'assistant',content:`More than one exact item matched: ${resolution.choices.map(item=>item.sheetNumber||item.label||item.sectionNumber).join(', ')}.`});else engine.appendConversationMessage({role:'assistant',content:'No exact registered drawing item matched that command. The current drawing was unchanged.'});refreshChiefDrawingDockMessages();}else if(contextAnswer){if(!engine.activeConversation())engine.createConversation({projectId:state().activeProject});engine.appendConversationMessage({role:'user',content:value});engine.appendConversationMessage({role:'assistant',content:contextAnswer});refreshChiefDrawingDockMessages();}else{await engine.ask(value,state().settings.mode,{drawingContext:activeChiefDrawingContext,documentIds:[]});refreshChiefDrawingDockMessages();}prompt.value='';logger.debug('Chief drawing interaction performance',{commandClassificationMs:classification.durationMs,answerDurationMs:(globalThis.performance?.now?.()??Date.now())-started,answerContextBytes:new TextEncoder().encode(JSON.stringify(activeChiefDrawingContext||{})).byteLength,drawingRerenderCount:0});}catch(error){logger.warning('Chief drawing provider failure',{message:error?.message||String(error),contained:true});const status=event.target.closest('.mc-chief-drawing-dock')?.querySelector('.mc-chief-dock-context-status');if(status)status.textContent='Chief is temporarily unavailable. The drawing remains usable.';}finally{button.disabled=false;button.textContent='Ask Chief';}});

$('#missionControlContent').addEventListener('submit', async event => {
  if (event.target.id !== 'missionControlComposer') return;
  event.preventDefault();
  const promptValue = $('#missionControlPrompt').value.trim();
  if (!promptValue || busy) return;
  const button = $('#missionControlSend');
  busy = true; button.disabled = true; button.textContent = 'Thinking…';
  setChiefState('busy');
  try {
    const current = state();
    const conversation = engine.activeConversation();
    const navigationIntent = classifyEngineeringNavigationIntent(promptValue);
    const [analyses, documents, sections] = await Promise.all([navigationIntent.kind === 'exact-drawing-navigation' ? currentGlobalDrawingRegistryAnalyses(promptValue) : currentDrawingAnalyses(), engine.documents(), engine.sections()]);
    const locationPresentation = buildChiefLocationPresentation(promptValue, { analyses, documents, sections, returnTarget: 'chief-answer', projectId: current.activeProject });
    activeChiefLocationPresentation = locationPresentation && locationPresentation.status !== 'none' ? locationPresentation : null;
    const resolvedLocationTarget = locationPresentation.status === 'resolved' && locationPresentation.target?.kind === 'drawing'
      ? createDrawingTarget({ projectId: locationPresentation.target.projectId, documentId: locationPresentation.target.documentId, drawingSetId: locationPresentation.target.drawingSetId, drawingId: locationPresentation.target.drawingId, sheetId: locationPresentation.target.sheetId, pageNumber: locationPresentation.target.pageNumber, observationId: locationPresentation.target.observationId, region: locationPresentation.target.region, origin: 'engineering-locator', returnTarget: 'chief-answer' })
      : null;
    if (navigationIntent.exact) {
      logger.info('Drawing registry runtime inspection', latestDrawingRegistryInspection || { activeProjectId: current.activeProject, query: promptValue, commandIntent: navigationIntent, diagnosticStatus: navigationIntent.kind === 'exact-drawing-navigation' ? 'registry-inspection-unavailable' : 'not-a-drawing-command' });
      latestDrawingRegistryInspection = null;
      if (!engine.activeConversation()) engine.createConversation({ projectId: resolvedLocationTarget?.projectId || current.activeProject });
      engine.appendConversationMessage({ role: 'user', content: promptValue });
      engine.appendConversationMessage({ role: 'assistant', content: locationPresentation.status === 'resolved' ? `Located ${locationPresentation.summary.replace(/^Located\s+/i, '')}` : locationPresentation.status === 'ambiguous' ? locationPresentation.summary : `No exact registered ${navigationIntent.kind === 'exact-drawing-navigation' ? 'drawing' : 'specification'} matched that command.`, navigationTarget: locationPresentation.target || null });
      if (resolvedLocationTarget) {
        if (resolvedLocationTarget.projectId && resolvedLocationTarget.projectId !== current.activeProject) await selectProjectThroughProductionPath(resolvedLocationTarget.projectId);
        const targetAnalysis = analyses.find(item => item.drawingSetId === resolvedLocationTarget.drawingSetId || item.documentId === resolvedLocationTarget.documentId);
        drawingWorkspace.setPages(targetAnalysis?.sheets || []);
        const workspaceResolution = drawingWorkspace.open(resolvedLocationTarget, drawingTarget?.pageNumber);
        drawingTarget = createDrawingTarget({ ...resolvedLocationTarget, pageNumber: workspaceResolution.pageNumber || resolvedLocationTarget.pageNumber });
        pendingDrawingContext = resolvedLocationTarget;
        drawingMatchingSheetIds = [resolvedLocationTarget.sheetId];
        setChiefState('success');
        await showMissionControlView('plans');
      } else if (locationPresentation.status === 'resolved' && locationPresentation.mode === 'specification') {
        setChiefState('success');
        await openProfessionalDestination({ ...locationPresentation.target, view: 'knowledge' });
      } else {
        setChiefState(locationPresentation.status === 'ambiguous' ? 'success' : 'error');
        await renderChiefWorkspace({ historyVisible: chiefHistoryVisible });
      }
      return;
    }
    if (resolvedLocationTarget) pendingDrawingContext = resolvedLocationTarget;
    const construction = await buildActiveConstructionPackage(promptValue);
    const drawingScope = construction ? buildPlanQueryScope(construction.planResult, construction.sections, construction.analyses) : null;
    const exactDrawingContext = construction?.planResult.viewerTarget || pendingDrawingContext || resolvedLocationTarget;
    let pendingScope = null;
    if (!construction && exactDrawingContext) {
      const sections = await engine.sections();
      const analyses = await currentDrawingAnalyses();
      pendingScope = buildPlanQueryScope({ viewerTarget: exactDrawingContext, matchingSheetIds: [exactDrawingContext.sheetId] }, sections, analyses);
    }
    const message = await engine.ask(promptValue, $('#missionControlMode')?.value || current.settings.mode, exactDrawingContext ? {
      ...(drawingScope || pendingScope),
      routingDocumentIds: construction?.planResult?.routingProfile?.documentIds || [],
      drawingContext: exactDrawingContext,
      workPackageReferences: { matchingSheetIds: construction?.planResult.matchingSheetIds || [exactDrawingContext.sheetId], matchingObservationIds: construction?.planResult.matchingObservationIds || [exactDrawingContext.observationId].filter(Boolean) }
    } : { documentIds: conversation?.attachmentDocumentIds || [] });
    const project = current.projects.find(item => item.id === current.activeProject);
    const libraries = engine.libraries();
    activeRetrievalSession = createRetrievalSession({ question: promptValue, timestamp: message.createdAt, project, library: libraries.find(item => item.id === current.activeLibrary), mode: message.mode, messageId: message.id, hits: message.hits, citations: message.citations, citationVerification: message.citationVerification, retrievalMeta: message.retrievalMeta, documents, libraries, sections });
    if (construction) {
      const completed = await buildActiveConstructionPackage(promptValue, activeRetrievalSession.evidence);
      activePlanQuery = completed.planResult;
      activeWorkPackage = completed.workPackage;
      activeWorkPackageMessageId = message.id;
      drawingMatchingSheetIds = [...activePlanQuery.matchingSheetIds];
      drawingTarget = activePlanQuery.viewerTarget;
      chiefConstructionContext = createChiefConstructionContext({ conversationId: conversation?.conversationId, projectId: current.activeProject, planResult: activePlanQuery, drawingTarget, workPackageReferences: message.workPackageReferences, updatedFrom: 'chief-response' });
    }
    pendingDrawingContext = null;
    setChiefState('success');
    await renderChiefWorkspace({ historyVisible: chiefHistoryVisible });
    $('.mc-control-messages')?.scrollTo({ top: $('.mc-control-messages').scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } catch (error) { setChiefState('error'); alert(error.message); }
  finally { busy = false; if ($('#missionControlSend')) { $('#missionControlSend').disabled = false; $('#missionControlSend').textContent = 'Ask Chief'; } }
});

async function ingestMissionControlFiles(files) {
  if (!files.length) return;
  if (!missionControlProject()) { alert('Open a project before attaching documents.'); return; }
  const unsupported = files.filter(file => /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name));
  if (unsupported.length) { alert('Image review is not supported yet. Attach PDF, DOCX, spreadsheet, text, or supported structured-text files.'); return; }
  missionControlAttachments = files.map(file => ({ name: file.name, status: 'processing' }));
  await renderMissionControlChat();
  try {
    const result = await engine.ingest(files, () => {}, state().activeLibrary);
    for (const document of result.documents.filter(item => item.status === 'verified')) engine.addConversationAttachment(document.id);
    missionControlAttachments = result.documents.filter(item => item.status !== 'verified').map(item => ({ name: item.name, status: 'failed', error: item.error || 'Import failed' }));
  } catch (error) { missionControlAttachments = files.map(file => ({ name: file.name, status: 'failed', error: error.message })); }
  await renderMissionControlChat();
}

$('#missionControlContent').addEventListener('change', event => {
  if (event.target.id === 'missionControlFiles') void ingestMissionControlFiles([...event.target.files]);
  if (event.target.id === 'missionControlLibraryFiles') void ingestMissionControlFiles([...event.target.files]).then(() => renderMissionControlLibrary());
});

app.addEventListener('input', event => {
  if (event.target.id !== 'mcDrawingSearch') return;
  drawingFilter = event.target.value;
  drawingObjectSearchActiveIndex = -1;
  const matches = new Set(searchDrawingObjects(activeDrawingObjects, drawingFilter).map(item=>item.objectId));
  $$('.mc-drawing-object-overlay').forEach(item=>item.classList.toggle('search-match',matches.has(item.dataset.overlayId)));
  scheduleDrawingSearchResultsUpdate();
});

app.addEventListener('toggle', event => {
  const group = event.target.closest?.('.mc-construction-intelligence details[data-ci-group]');
  if (!group || group.hidden) return;
  if (group.open) constructionIntelligenceExpanded.add(group.dataset.ciGroup);
  else constructionIntelligenceExpanded.delete(group.dataset.ciGroup);
  saveConstructionIntelligencePanelState([...constructionIntelligenceExpanded]);
}, true);

app.addEventListener('keydown', event => {
  if (event.target.id !== 'mcDrawingSearch' || !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', 'Enter', 'Escape'].includes(event.key)) return;
  event.preventDefault();
  const objectMatches = searchDrawingObjects(activeDrawingObjects, drawingFilter);
  if (event.key === 'Enter' && objectMatches.length) {
    drawingObjectSearchActiveIndex = (drawingObjectSearchActiveIndex + 1) % objectMatches.length;
    selectedDrawingObject = objectMatches[drawingObjectSearchActiveIndex]; selectedDrawingObjectIds = [selectedDrawingObject.objectId]; drawingObjectChoices = []; captureDrawingViewport({selectedObjectId:selectedDrawingObject.objectId,selectedObjectIds:[selectedDrawingObject.objectId],highlightedRegion:selectedDrawingObject.region,contextSource:'object-selection'});
    void renderDrawingWorkspace(experience === 'mission-control' ? 'mission-control' : 'professional'); return;
  }
  const buttons = $$('#mcDrawingResults button');
  const action = drawingResultKeyTarget(event.key, { sheetIds: drawingMatchingSheetIds, activeIndex: drawingSearchActiveIndex });
  if (action.clear) {
    if (drawingFilter) { drawingFilter = ''; event.target.value = ''; scheduleDrawingSearchResultsUpdate({ immediate: true }); }
    else event.target.blur();
    return;
  }
  drawingSearchActiveIndex = action.index;
  buttons.forEach((button, index) => { button.classList.toggle('keyboard-active', index === action.index); button.toggleAttribute('aria-current', index === action.index); });
  buttons[action.index]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  if (action.activate) buttons[action.index]?.click();
});

app.addEventListener('change', async event => {
  const shell = experience === 'mission-control' ? 'mission-control' : 'professional';
  if(event.target.matches('[data-coverage-review-filter]')){const started=globalThis.performance?.now?.()??Date.now();drawingCoverageReviewFilter=event.target.value;await renderDrawingWorkspace(shell);logger.debug('Drawing coverage review performance',{operation:'filter',durationMs:Math.max(0,(globalThis.performance?.now?.()??Date.now())-started)});return;}
  if (event.target.id === 'mcDrawingDocument') {
    drawingTarget = createDrawingTarget({ projectId: state().activeProject, documentId: event.target.value });
    drawingFilter = ''; drawingDiscipline = 'all'; drawingType = 'all'; drawingSearchActiveIndex = -1; drawingZoom = null; drawingRotation = 0;
    await renderDrawingWorkspace(shell);
  }
  if (event.target.id === 'mcDrawingDiscipline') {
    drawingDiscipline = event.target.value;
    scheduleDrawingSearchResultsUpdate();
  }
  if (event.target.id === 'mcDrawingType') {
    drawingType = event.target.value;
    scheduleDrawingSearchResultsUpdate();
  }
  if (event.target.dataset.drawingOverlay) {
    const layer = event.target.dataset.drawingOverlay;
    const current = { ...defaultDrawingViewport(), ...drawingViewerEngine.getViewport(drawingTarget?.pageNumber) };
    captureDrawingViewport({ overlays: { ...current.overlays, [layer]: event.target.checked } });
    $$(`[data-overlay-layer="${layer}"]`).forEach(item => { item.hidden = !event.target.checked; });
  }
  if (event.target.hasAttribute('data-drawing-trade')) {
    drawingTradeContext.select(event.target.value);
    const sheet = activeDrawingViewerAnalysis?.sheets?.find(item => Number(item.pageNumber) === Number(drawingTarget?.pageNumber));
    if (sheet) drawingViewportContextService.update({ projectId: drawingTarget?.projectId || activeDrawingViewerAnalysis?.projectId, documentId: drawingTarget?.documentId, pageId: sheet.pageId, pdfPageNumber: sheet.pageNumber, activeTradeChannel: event.target.value, source: selectedDrawingObject ? 'object-selection' : drawingTarget?.region ? 'manual-selection' : 'page-context' }, { immediate: true });
    await renderDrawingWorkspace(shell);
  }
  if (event.target.id === 'mcDrawingReattach' && event.target.files?.[0]) {
    const documentId = drawingTarget?.documentId || (await engine.documents()).find(isDrawingDocumentRole)?.id;
    try {
      const result = await engine.reattachPdfSource(documentId, event.target.files[0]);
      if (!result.ok) { drawingLifecycleUnavailable = [result]; await renderDrawingWorkspace(shell); return; }
      releaseDrawingSource();
      drawingTarget = createDrawingTarget({ projectId: state().activeProject, documentId, drawingSetId: result.drawingSetId, pageNumber: 1 });
      await renderDrawingWorkspace(shell);
    } catch (error) { alert(error.message); }
  }
});

app.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || !button.closest('.mc-drawing-workspace')) return;
  if (!drawingInteractionTrace.id) {
    const traceKind = button.dataset.drawingSheet ? 'sheet-card click'
      : button.hasAttribute('data-drawing-previous') ? 'previous'
      : button.hasAttribute('data-drawing-next') ? 'next'
      : button.hasAttribute('data-drawing-zoom') ? `zoom-${button.dataset.drawingZoom}`
      : button.hasAttribute('data-drawing-fit') ? `fit-${button.dataset.drawingFit}`
      : button.hasAttribute('data-drawing-rotate') ? 'rotate'
      : button.hasAttribute('data-drawing-reset-view') ? 'reset-view'
      : button.hasAttribute('data-drawing-object-center') ? 'object-center'
      : button.dataset.overlayId ? 'overlay-click'
      : button.hasAttribute('data-drawing-clear-object') ? 'clear-object'
      : button.dataset.drawingSelectObject ? 'select-object'
      : button.dataset.drawingObjectNav ? `object-nav-${button.dataset.drawingObjectNav}`
      : button.hasAttribute('data-drawing-clear-search') ? 'clear-search'
      : 'drawing-button';
    startDrawingInteractionTrace(traceKind, { buttonText: (button.textContent || '').trim().slice(0, 120) });
  }
  const shell = experience === 'mission-control' ? 'mission-control' : 'professional';
  if (drawingSafeMode && (
    button.hasAttribute('data-coverage-review-open') ||
    button.hasAttribute('data-coverage-review-close') ||
    button.hasAttribute('data-drawing-ask') ||
    button.hasAttribute('data-drawing-current-work') ||
    button.hasAttribute('data-drawing-inspection') ||
    button.hasAttribute('data-drawing-edit-metadata') ||
    button.hasAttribute('data-drawing-source') ||
    button.hasAttribute('data-drawing-reanalyze') ||
    button.hasAttribute('data-drawing-analyze-page') ||
    button.hasAttribute('data-project-object-create') ||
    button.hasAttribute('data-project-object-confirm') ||
    button.hasAttribute('data-project-object-reject') ||
    button.hasAttribute('data-project-object-edit') ||
    button.hasAttribute('data-project-object-alias') ||
    button.hasAttribute('data-project-object-adjust-region') ||
    button.hasAttribute('data-project-object-history') ||
    button.hasAttribute('data-project-object-merge') ||
    button.hasAttribute('data-project-object-keep-separate') ||
    button.hasAttribute('data-project-object-split') ||
    button.hasAttribute('data-drawing-open-spec') ||
    button.hasAttribute('data-drawing-confirm-spec') ||
    button.hasAttribute('data-drawing-reject-spec') ||
    button.dataset.drawingRecoveryAction ||
    button.dataset.projectRelationshipConfirm ||
    button.dataset.projectRelationshipReject ||
    button.dataset.projectRelationshipOpen ||
    button.dataset.projectRelationshipLink ||
    button.dataset.drawingObservation ||
    button.dataset.drawingVerify ||
    button.dataset.drawingOccurrence ||
    button.dataset.drawingVerifyOccurrence
  )) return;
  if(button.hasAttribute('data-chief-dock-close')){chiefDrawingDock.close();const dock=button.closest('.mc-chief-drawing-dock');if(dock)dock.hidden=true;return;}
  if(button.hasAttribute('data-chief-dock-collapse')){const next=chiefDrawingDock.state().collapsed?chiefDrawingDock.expand():chiefDrawingDock.collapse();const dock=button.closest('.mc-chief-drawing-dock');if(dock){dock.classList.toggle('collapsed',next.collapsed);button.textContent=next.collapsed?'Expand':'Collapse';for(const child of [...dock.children].slice(1))child.hidden=next.collapsed;}return;}
  if(button.dataset.chiefCardAction){let target={};try{target=JSON.parse(button.dataset.chiefCardTarget||'{}');}catch{}const result=await drawingActionRouter.execute(button.dataset.chiefCardAction,target,{executionToken:`card:${event.timeStamp}`});if(!result.ok){button.insertAdjacentHTML('afterend','<small class="mc-chief-action-error">That drawing action is no longer available.</small>');}return;}
  const navigationStartedAt = globalThis.performance?.now?.() ?? Date.now();
  const pageSelectionRequest = button.dataset.drawingSheet || button.hasAttribute('data-drawing-previous') || button.hasAttribute('data-drawing-next') ? ++drawingPageSelectionRequest : 0;
  const persistedAnalysis = activeDrawingViewerAnalysis?.documentId === drawingTarget?.documentId
    ? activeDrawingViewerAnalysis
    : drawingTarget?.documentId
      ? await engine.drawingAnalysis(drawingTarget.documentId)
      : null;
  if (pageSelectionRequest && pageSelectionRequest !== drawingPageSelectionRequest) return;
  const analysis = activeDrawingViewerAnalysis?.documentId === drawingTarget?.documentId ? activeDrawingViewerAnalysis : persistedAnalysis;
  const currentSheet = analysis?.sheets.find(item => item.sheetId === drawingTarget?.sheetId) || analysis?.sheets.find(item => Number(item.pageNumber) === Number(drawingTarget?.pageNumber)) || null;
  const currentObservation = drawingTarget?.observationId ? analysis?.observations.find(item => item.observationId === drawingTarget.observationId) || null : null;
  const repaintCurrentSheet = async ({ preserveSidebarScroll = true } = {}) => {
    if (!analysis || !currentSheet) return false;
    const paintRequest = ++drawingPagePaintRequest;
    return paintDrawingSelectionFast({ shell, analysis, sheet: currentSheet, observation: currentObservation, navigationStartedAt, requestToken: paintRequest, scrollActiveCard: !preserveSidebarScroll });
  };
  if(button.hasAttribute('data-coverage-review-open')){drawingCoverageReviewMode=true;await renderDrawingWorkspace(shell);return;}
  if(button.hasAttribute('data-coverage-review-close')){drawingCoverageReviewMode=false;drawingCoverageRegionItemId='';await renderDrawingWorkspace(shell);return;}
  const reviewItemElement=button.closest('[data-review-item]');const reviewItemId=reviewItemElement?.dataset.reviewItem||'';const reviewItem=activeDrawingCoverageReview?.items?.find(item=>item.reviewItemId===reviewItemId);
  if(reviewItem&&button.hasAttribute('data-coverage-confirm')){const result=applyDrawingCoverageCorrection({registry:projectObjectRegistry,review:activeDrawingCoverageReview,itemId:reviewItemId,action:'confirm-object'});logger.debug('Drawing coverage correction',{operation:'confirm',durationMs:result.durationMs});await renderDrawingWorkspace(shell);return;}
  if(reviewItem&&button.hasAttribute('data-coverage-reject')){applyDrawingCoverageCorrection({registry:projectObjectRegistry,review:activeDrawingCoverageReview,itemId:reviewItemId,action:'reject-evidence'});await renderDrawingWorkspace(shell);return;}
  if(reviewItem&&button.hasAttribute('data-coverage-ignore')){applyDrawingCoverageCorrection({registry:projectObjectRegistry,review:activeDrawingCoverageReview,itemId:reviewItemId,action:'ignore-revision'});await renderDrawingWorkspace(shell);return;}
  if(reviewItem&&button.hasAttribute('data-coverage-create')){const objectType=prompt('Object type',reviewItem.proposedObjectType)?.trim();if(!objectType)return;const tag=prompt('Tag',reviewItem.proposedTag||'')?.trim()||'';const label=prompt('Label',reviewItem.proposedLabel)?.trim();if(!label)return;const trade=prompt('Trade','Unknown')?.trim()||'Unknown';const result=applyDrawingCoverageCorrection({registry:projectObjectRegistry,review:activeDrawingCoverageReview,itemId:reviewItemId,action:'create-object',patch:{objectType,tag,label,trade}});if(result.object){selectedDrawingObject=projectObjectPresentation(result.object);registerProjectObjectRelationships(result.object,projectRelationshipEngine,{pageEntityId:`drawing-page:${reviewItem.pageId}`});}await renderDrawingWorkspace(shell);return;}
  if(reviewItem&&button.hasAttribute('data-coverage-edit')){const current=reviewItem.currentRegistryMatch;const objectType=prompt('Object type',current.objectType)?.trim();if(!objectType)return;const tag=prompt('Tag',current.tag||'')?.trim();if(tag===undefined)return;const label=prompt('Label',current.label)?.trim();if(!label)return;const roomId=prompt('Room ID',current.roomId||'')?.trim();if(roomId===undefined)return;projectObjectRegistry.updateObject(current.objectId,{objectType,tag,label,roomId},{source:'manual',note:'Identity corrected in drawing coverage review.'});await renderDrawingWorkspace(shell);return;}
  if(reviewItem&&button.hasAttribute('data-coverage-assign')){const query=prompt('Assign to existing object by tag, label, alias, or permanent ID',reviewItem.proposedTag||'')?.trim();if(!query)return;const candidates=projectObjectRegistry.getObjectsForPage(reviewItem.pageId,{projectId:reviewItem.projectId,limit:500}).filter(item=>item.objectId===query||item.tag?.toLowerCase()===query.toLowerCase()||item.label?.toLowerCase().includes(query.toLowerCase())||item.aliases?.some(alias=>alias.toLowerCase()===query.toLowerCase()));if(candidates.length!==1){alert(candidates.length?'More than one object matches. Use the exact permanent ID.':'No page-owned object matched.');return;}const result=applyDrawingCoverageCorrection({registry:projectObjectRegistry,review:activeDrawingCoverageReview,itemId:reviewItemId,action:reviewItem.issueType==='schedule-unlinked'?'link-schedule-occurrence':'assign-existing',objectId:candidates[0].objectId});logger.debug('Drawing coverage correction',{operation:'assignment',durationMs:result.durationMs});await renderDrawingWorkspace(shell);return;}
  if(reviewItem&&button.hasAttribute('data-coverage-draw-region')){drawingCoverageRegionItemId=reviewItemId;$('#mcDrawingStage')?.focus({preventScroll:true});return;}
  if(reviewItem&&button.hasAttribute('data-coverage-link-spec')){const query=prompt('Indexed specification section number', '')?.trim();if(!query)return;const result=applyDrawingCoverageCorrection({registry:projectObjectRegistry,specificationLinks:drawingSpecificationLinks,index:specificationIndex,review:activeDrawingCoverageReview,itemId:reviewItemId,action:'link-specification',patch:{sectionNumber:query}});if(result.status!=='complete')alert('No exact indexed project specification section matched.');else drawingRequirementsResolver.invalidate();await renderDrawingWorkspace(shell);return;}
  if(reviewItem&&button.hasAttribute('data-coverage-merge')){if(reviewItem.currentRegistryMatch&&reviewItem.duplicateObject&&confirm(`Merge ${reviewItem.duplicateObject.label} into ${reviewItem.currentRegistryMatch.label}?`)){applyDrawingCoverageCorrection({registry:projectObjectRegistry,review:activeDrawingCoverageReview,itemId:reviewItemId,action:'merge-duplicate',patch:{secondaryObjectId:reviewItem.duplicateObject.objectId}});preserveProjectObjectMerge({primary:projectObjectRegistry.getObject(reviewItem.currentRegistryMatch.objectId),secondary:reviewItem.duplicateObject,relationshipEngine:projectRelationshipEngine,specificationLinks:drawingSpecificationLinks});await renderDrawingWorkspace(shell);}return;}
  if(reviewItem&&button.hasAttribute('data-coverage-keep')){applyDrawingCoverageCorrection({registry:projectObjectRegistry,review:activeDrawingCoverageReview,itemId:reviewItemId,action:'keep-separate'});await renderDrawingWorkspace(shell);return;}
  if (button.hasAttribute('data-project-object-create') && validNormalizedRegion(drawingTarget?.region)) {
    const sheet = analysis?.sheets?.find(item => Number(item.pageNumber) === Number(drawingTarget?.pageNumber));
    const objectType = prompt('Object type', 'generic-drawing-object')?.trim(); if (!objectType) return;
    const tag = prompt('Tag (optional)', '')?.trim() || '';
    const label = prompt('Object label', tag || 'Project object')?.trim(); if (!label) return;
    const trade = prompt('Trade', sheet?.discipline || 'General')?.trim(); if (!trade) return;
    const system = prompt('System (optional)', '')?.trim() || '';
    const roomId = prompt('Room ID (optional)', '')?.trim() || '';
    const note = prompt('Note (optional)', '') || '';
    const created = projectObjectRegistry.registerObject({ projectId: analysis?.projectId || state().activeProject, drawingDocumentId: drawingTarget.documentId, drawingPageId: sheet?.pageId, objectType, tag, label, trade, system, roomId, graphicalRegion: drawingTarget.region, verificationState: 'confirmed', identitySource: 'manual', confidence: 1, sourceText: note, evidence: [] }, { source: 'manual', note });
    if (created) { selectedDrawingObject = projectObjectPresentation(created); registerProjectObjectRelationships(created, projectRelationshipEngine, { pageEntityId: `drawing-page:${sheet?.pageId || ''}`, roomEntityId: roomId ? `drawing-object:${roomId}` : '' }); await renderDrawingWorkspace(shell); }
    return;
  }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-confirm')) { selectedDrawingObject = projectObjectPresentation(projectObjectRegistry.confirmObject(selectedDrawingObject.objectId, { source: 'manual' })); await renderDrawingWorkspace(shell); return; }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-reject')) { projectObjectRegistry.rejectObject(selectedDrawingObject.objectId, { source: 'manual' }); selectedDrawingObject = null; await renderDrawingWorkspace(shell); return; }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-edit')) {
    const objectType = prompt('Object type', selectedDrawingObject.type)?.trim(); if (!objectType) return;
    const tag = prompt('Tag', selectedDrawingObject.tag || '')?.trim(); if (tag === undefined) return;
    const label = prompt('Label', selectedDrawingObject.label)?.trim(); if (!label) return;
    const trade = prompt('Trade', selectedDrawingObject.trade || 'Unknown')?.trim(); if (!trade) return;
    const system = prompt('System', selectedDrawingObject.system || '')?.trim(); if (system === undefined) return;
    const roomId = prompt('Room ID', selectedDrawingObject.roomId || '')?.trim(); if (roomId === undefined) return;
    selectedDrawingObject = projectObjectPresentation(projectObjectRegistry.updateObject(selectedDrawingObject.objectId, { objectType, tag, label, trade, system, roomId }, { source: 'manual' })); await renderDrawingWorkspace(shell); return;
  }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-alias')) { const alias = prompt('Alias')?.trim(); if (alias) selectedDrawingObject = projectObjectPresentation(projectObjectRegistry.linkAlias(selectedDrawingObject.objectId, alias, { source: 'manual' })); await renderDrawingWorkspace(shell); return; }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-adjust-region')) { drawingObjectRegionAdjustmentId = selectedDrawingObject.objectId; drawingRegionSelectionMode = true; button.textContent = 'Click drawing to set region'; $('#mcDrawingStage')?.focus({ preventScroll: true }); return; }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-history')) { alert(JSON.stringify(projectObjectRegistry.getObjectHistory(selectedDrawingObject.objectId), null, 2)); return; }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-merge')) { const primary = projectObjectRegistry.getObject(selectedDrawingObject.objectId); const duplicate = projectObjectRegistry.possibleDuplicates(selectedDrawingObject.objectId)[0]; if (primary && duplicate && confirm(`Merge ${duplicate.label} into ${selectedDrawingObject.label}?`)) { selectedDrawingObject = projectObjectPresentation(projectObjectRegistry.mergeObjects(primary.objectId, duplicate.objectId, { source: 'manual' })); preserveProjectObjectMerge({ primary: projectObjectRegistry.getObject(primary.objectId), secondary: duplicate, relationshipEngine: projectRelationshipEngine, specificationLinks: drawingSpecificationLinks }); } await renderDrawingWorkspace(shell); return; }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-keep-separate')) { projectObjectRegistry.updateObject(selectedDrawingObject.objectId, {}, { source: 'manual', note: 'Possible duplicate reviewed and kept separate.' }); await renderDrawingWorkspace(shell); return; }
  if (selectedDrawingObject && button.hasAttribute('data-project-object-split')) { const secondaryId = selectedDrawingObject.mergedObjectIds?.[0]; if (secondaryId) projectObjectRegistry.splitObject(selectedDrawingObject.objectId, secondaryId, { source: 'manual' }); selectedDrawingObject = projectObjectPresentation(projectObjectRegistry.getObject(selectedDrawingObject.objectId)); await renderDrawingWorkspace(shell); return; }
  if (button.dataset.projectRelationshipConfirm || button.dataset.projectRelationshipReject) {
    const relationshipId = button.dataset.projectRelationshipConfirm || button.dataset.projectRelationshipReject;
    if (button.dataset.projectRelationshipConfirm) projectRelationshipEngine.confirmRelationship(relationshipId, { origin: 'manual', source: 'drawing-workspace' });
    else projectRelationshipEngine.rejectRelationship(relationshipId, { origin: 'manual', source: 'drawing-workspace' });
    drawingRequirementsResolver.invalidate(); await renderDrawingWorkspace(shell); return;
  }
  if (button.dataset.projectRelationshipOpen) {
    const relationship = projectRelationshipEngine.getRelationships('', { projectId: state().activeProject, includeRejected: false, limit: 500 }).find(item => item.relationshipId === button.dataset.projectRelationshipOpen)
      || projectRelationshipEngine.getRelationships(button.closest('[data-project-relationship-source]')?.dataset.projectRelationshipSource || '', { includeRejected: false, limit: 500 }).find(item => item.relationshipId === button.dataset.projectRelationshipOpen);
    const relatedId = relationship ? (relationship.sourceEntityId === button.closest('[data-project-relationship-source]')?.dataset.projectRelationshipSource ? relationship.targetEntityId : relationship.sourceEntityId) : '';
    const entity = projectRelationshipEngine.getEntity(relatedId);
    const target = entity?.metadata?.navigationTarget;
    if (target?.destination === 'knowledge') await openProfessionalDestination(target);
    else if (entity?.entityType === 'drawing-page' && target) { drawingWorkspace.open(target); drawingTarget = createDrawingTarget(target); await renderDrawingWorkspace(shell); }
    return;
  }
  if (button.hasAttribute('data-project-relationship-link')) {
    const sourceEntityId = button.closest('[data-project-relationship-source]')?.dataset.projectRelationshipSource || '';
    const sourceEntity = projectRelationshipEngine.getEntity(sourceEntityId);
    if (!sourceEntity) return;
    const relationshipType = prompt('Relationship type (for example: related-to, located-in, inspected-by, documented-by):')?.trim();
    if (!relationshipType) return;
    const targetType = prompt('Target entity type (for example: specification-section, room, inspection, photo, issue):')?.trim();
    if (!targetType) return;
    const query = prompt('Find an existing related record by exact label or identifier:')?.trim();
    if (!query) return;
    const candidates = projectRelationshipEngine.entities({ projectId: sourceEntity.projectId, entityTypes: [targetType] }).filter(item => item.entityId === query || item.normalizedKey === query || item.label.toLowerCase().includes(query.toLowerCase()));
    const targetEntity = candidates.length === 1 ? candidates[0] : candidates.find(item => item.entityId === query || item.normalizedKey === query);
    if (!targetEntity) { alert(candidates.length ? 'More than one related record matches. Enter its exact identifier.' : 'No existing related record matched.'); return; }
    const note = prompt('Optional relationship note:') || '';
    const result = projectRelationshipEngine.registerRelationship({ projectId: sourceEntity.projectId, sourceEntityId, targetEntityId: targetEntity.entityId, relationshipType, verificationState: 'confirmed', origin: 'manual', confidence: 1, metadata: { note, createdBy: 'drawing-workspace-user' } });
    if (!result) { alert('That relationship could not be created with the selected owned records and relationship type.'); return; }
    drawingRequirementsResolver.invalidate(); await renderDrawingWorkspace(shell); return;
  }
  if (button.hasAttribute('data-drawing-select-region')) { drawingRegionSelectionMode = true; button.textContent = 'Click the drawing to place region'; $('#mcDrawingStage')?.focus({ preventScroll: true }); return; }
  if (button.hasAttribute('data-drawing-clear-region')) {
    const sheet = activeDrawingViewerAnalysis?.sheets?.find(item => Number(item.pageNumber) === Number(drawingTarget?.pageNumber));
    drawingTarget = createDrawingTarget({ ...drawingTarget, region: null });
    if (sheet) drawingViewportContextService.selectRegion({ projectId: drawingTarget?.projectId || activeDrawingViewerAnalysis?.projectId, documentId: drawingTarget?.documentId, pageId: sheet.pageId, pdfPageNumber: sheet.pageNumber, zoom: drawingZoom, rotation: drawingRotation, activeTradeChannel: drawingTradeContext.current().key }, null);
    await renderDrawingWorkspace(shell); return;
  }
  if (button.dataset.drawingUseVisibleRoom) {
    const room = activeDrawingObjects.find(item => item.objectId === button.dataset.drawingUseVisibleRoom && item.type === 'room' && item.verificationState === 'confirmed');
    const sheet = activeDrawingViewerAnalysis?.sheets?.find(item => Number(item.pageNumber) === Number(drawingTarget?.pageNumber));
    if (room && sheet && drawingViewportContextService.useRoom({ projectId: drawingTarget?.projectId || activeDrawingViewerAnalysis?.projectId, documentId: drawingTarget?.documentId, pageId: sheet.pageId, pdfPageNumber: sheet.pageNumber, zoom: drawingZoom, rotation: drawingRotation, activeTradeChannel: drawingTradeContext.current().key }, room)) { selectedDrawingObject = room; drawingTarget = createDrawingTarget({ ...drawingTarget, region: room.region, observationId: room.sourceObservationIds?.[0] || '' }); await renderDrawingWorkspace(shell); }
    return;
  }
  if (button.hasAttribute('data-requirement-return')) { $('#mcDrawingStage')?.focus({ preventScroll: true }); return; }
  if (button.dataset.objectSpecSource) {
    const sectionNumber = button.dataset.objectSpecSource;
    const result = await openSpecificationDocument(sectionNumber, engine);
    if (!result) return;
    const { source, section } = result;
    specificationDrawingReturnTarget = captureDrawingSupportReturnState();
    
    // Create canvas
    const specContainer = document.createElement('div');
    specContainer.className = 'mc-specification-viewer-container';
    specContainer.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 10000; display: flex; flex-direction: column;';
    
    const specHeader = document.createElement('div');
    specHeader.style.cssText = 'padding: 16px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;';
    specHeader.innerHTML = `
      <h2 style="margin: 0;">${esc(section.sectionTitle)}</h2>
      <span style="color: #666;">Section ${esc(section.sectionNumber)} · Page ${esc(section.startPdfPage)}</span>
      <button style="padding: 8px 16px; cursor: pointer;">Close</button>
    `;
    
    const specCanvasContainer = document.createElement('div');
    specCanvasContainer.style.cssText = 'flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 20px;';
    
    const specCanvas = document.createElement('canvas');
    specCanvas.style.cssText = 'max-width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
    
    specCanvasContainer.appendChild(specCanvas);
    specContainer.appendChild(specHeader);
    specContainer.appendChild(specCanvasContainer);
    document.body.appendChild(specContainer);
    
    specHeader.querySelector('button').addEventListener('click', () => {
      specContainer.remove();
    });
    
    await specificationSourceViewer.open({
      document: { id: section.documentId, name: 'Bedford Specifications' },
      sourceBlob: source.sourceBlob,
      pageNumber: section.startPdfPage,
      canvas: specCanvas
    });
    return;
  }
  if (button.dataset.requirementOpen) {
    const sectionNumber = button.dataset.requirementOpen;
    const result = await openSpecificationDocument(sectionNumber, engine);
    if (!result) return;
    const { source, section } = result;
    specificationDrawingReturnTarget = captureDrawingSupportReturnState();
    
    // Create canvas
    const specContainer = document.createElement('div');
    specContainer.className = 'mc-specification-viewer-container';
    specContainer.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 10000; display: flex; flex-direction: column;';
    
    const specHeader = document.createElement('div');
    specHeader.style.cssText = 'padding: 16px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;';
    specHeader.innerHTML = `
      <h2 style="margin: 0;">${esc(section.sectionTitle)}</h2>
      <span style="color: #666;">Section ${esc(section.sectionNumber)} · Page ${esc(section.startPdfPage)}</span>
      <button style="padding: 8px 16px; cursor: pointer;">Close</button>
    `;
    
    const specCanvasContainer = document.createElement('div');
    specCanvasContainer.style.cssText = 'flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 20px;';
    
    const specCanvas = document.createElement('canvas');
    specCanvas.style.cssText = 'max-width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
    
    specCanvasContainer.appendChild(specCanvas);
    specContainer.appendChild(specHeader);
    specContainer.appendChild(specCanvasContainer);
    document.body.appendChild(specContainer);
    
    specHeader.querySelector('button').addEventListener('click', () => {
      specContainer.remove();
    });
    
    await specificationSourceViewer.open({
      document: { id: section.documentId, name: 'Bedford Specifications' },
      sourceBlob: source.sourceBlob,
      pageNumber: section.startPdfPage,
      canvas: specCanvas
    });
    return;
  }
  if (button.dataset.requirementOpenDrawing) {
    const entity = projectRelationshipEngine.getEntity(button.dataset.requirementOpenDrawing); const target = entity?.metadata?.navigationTarget;
    if (target) { drawingWorkspace.open(target); drawingTarget = createDrawingTarget(target); await renderDrawingWorkspace(shell); }
    return;
  }
  if (button.dataset.drawingObjectNav) { const type={room:'room',equipment:'equipment',finish:'finish'}[button.dataset.drawingObjectNav]||''; const next=nextDrawingObject(activeDrawingObjects,selectedDrawingObject?.objectId||'',{direction:button.dataset.drawingObjectNav==='previous'?-1:1,type}); if(next){selectedDrawingObject=next;selectedDrawingObjectIds=[next.objectId];drawingObjectChoices=[];captureDrawingViewport({selectedObjectId:next.objectId,selectedObjectIds:[next.objectId],highlightedRegion:next.region,contextSource:'object-selection'});syncDrawingOverlaySelectionState();drawingInteractionSession.settleSoon();} return; }
  if (button.hasAttribute('data-drawing-object-center') && validNormalizedRegion(selectedDrawingObject?.region)) { const stage=$('#mcDrawingStage'),canvas=stage?.querySelector('#mcDrawingCanvas'),region=selectedDrawingObject.region;if(stage&&canvas){stage.scrollLeft=Math.max(0,region.x*(canvas.clientWidth||canvas.width)-(stage.clientWidth/2));stage.scrollTop=Math.max(0,region.y*(canvas.clientHeight||canvas.height)-(stage.clientHeight/2));captureDrawingViewport({highlightedRegion:region,contextSource:'object-selection'});} return; }
  if (button.dataset.overlayId) { const object=activeDrawingObjects.find(item => item.objectId === button.dataset.overlayId) || null; selectedDrawingObjectIds=object?updateDrawingObjectSelection(selectedDrawingObjectIds,object.objectId,{additive:event.shiftKey}):[];selectedDrawingObject=activeDrawingObjects.find(item=>item.objectId===selectedDrawingObjectIds.at(-1))||null; drawingObjectChoices = []; captureDrawingViewport({selectedObjectId:selectedDrawingObject?.objectId||null,selectedObjectIds:[...selectedDrawingObjectIds],highlightedRegion:selectedDrawingObject?.region||null,contextSource:selectedDrawingObject?'object-selection':'page-context'});syncDrawingOverlaySelectionState();drawingInteractionSession.settleSoon(); return; }
  if (button.dataset.drawingSelectObject) { selectedDrawingObject = activeDrawingObjects.find(item => item.objectId === button.dataset.drawingSelectObject) || null; selectedDrawingObjectIds=selectedDrawingObject?[selectedDrawingObject.objectId]:[];drawingObjectChoices = []; captureDrawingViewport({selectedObjectId:selectedDrawingObject?.objectId||null,selectedObjectIds:[...selectedDrawingObjectIds],highlightedRegion:selectedDrawingObject?.region||null,contextSource:selectedDrawingObject?'object-selection':'page-context'});syncDrawingOverlaySelectionState();drawingInteractionSession.settleSoon(); return; }
  if (button.hasAttribute('data-drawing-clear-object')) { selectedDrawingObject = null; selectedDrawingObjectIds=[]; drawingObjectChoices = []; const sheet = activeDrawingViewerAnalysis?.sheets?.find(item => Number(item.pageNumber) === Number(drawingTarget?.pageNumber)); if (sheet) drawingViewportContextService.update({ projectId: drawingTarget?.projectId || activeDrawingViewerAnalysis?.projectId, documentId: drawingTarget?.documentId, pageId: sheet.pageId, pdfPageNumber: sheet.pageNumber, selectedObjectId: null, selectedObjectIds:[], selectedRoomId: null, activeTradeChannel: drawingTradeContext.current().key, source: drawingTarget?.region ? 'manual-selection' : 'page-context' }, { immediate: true }); captureDrawingViewport({selectedObjectId:null,selectedObjectIds:[]});syncDrawingOverlaySelectionState();drawingInteractionSession.settleSoon(); return; }
  if (button.hasAttribute('data-drawing-object-location') && validNormalizedRegion(selectedDrawingObject?.region)) {
    const stage = $('#mcDrawingStage');
    const selectedSheet = activeDrawingViewerAnalysis?.sheets.find(item => item.pageNumber === drawingTarget?.pageNumber);
    drawingLocationReturnViewport = { ...defaultDrawingViewport(), ...drawingViewerEngine.getViewport(drawingTarget?.pageNumber), scrollLeft: stage?.scrollLeft || 0, scrollTop: stage?.scrollTop || 0 };
    const region = selectedDrawingObject.region;
    const targetZoom = Math.max(.35, Math.min(3, Math.min((stage?.clientWidth || 1) / Math.max(1, (selectedSheet?.pageWidth || 1) * region.width * 1.8), (stage?.clientHeight || 1) / Math.max(1, (selectedSheet?.pageHeight || 1) * region.height * 1.8))));
    drawingZoom = targetZoom;
    captureDrawingViewport({ mode: 'custom', zoom: targetZoom, scrollLeft: Math.max(0, region.x * (selectedSheet?.pageWidth || 0) * targetZoom - (stage?.clientWidth || 0) / 2), scrollTop: Math.max(0, region.y * (selectedSheet?.pageHeight || 0) * targetZoom - (stage?.clientHeight || 0) / 2), highlightedRegion: region, contextSource: selectedDrawingObject.type === 'room' ? 'room-selection' : 'object-selection' });
    await repaintCurrentSheet({ preserveSidebarScroll: true }); return;
  }
  if (button.hasAttribute('data-drawing-return-location') && drawingLocationReturnViewport) { drawingZoom = drawingLocationReturnViewport.zoom; drawingRotation = drawingLocationReturnViewport.rotation; drawingViewerEngine.restoreViewport(drawingTarget?.pageNumber, drawingLocationReturnViewport); drawingLocationReturnViewport = null; await repaintCurrentSheet({ preserveSidebarScroll: true }); return; }
  if (button.dataset.drawingConfirmSpec || button.dataset.drawingRejectSpec) { const linkId = button.dataset.drawingConfirmSpec || button.dataset.drawingRejectSpec; if (button.dataset.drawingConfirmSpec) drawingSpecificationLinks.confirm(linkId); else drawingSpecificationLinks.reject(linkId); drawingRequirementsResolver.invalidate(); await renderDrawingWorkspace(shell); return; }
  if (button.hasAttribute('data-drawing-link-spec') && selectedDrawingObject) {
    const query = prompt('Enter an exact specification section number or title:')?.trim();
    if (!query) return;
    const matches = specificationIndex.find(query, { projectId: state().activeProject });
    const section = matches.length === 1 ? matches[0] : matches.find(item => item.normalizedSectionNumber === query.replace(/\D/g, ''));
    if (!section) { alert(matches.length ? 'More than one exact specification section matches. Enter the section number.' : 'No indexed specification section matched.'); return; }
    const note = prompt('Optional link note:') || '';
    drawingSpecificationLinks.link({ projectId: state().activeProject, drawingDocumentId: drawingTarget?.documentId, drawingPageId: selectedDrawingObject.pageId, objectId: selectedDrawingObject.objectId, specificationDocumentId: section.documentId, sectionNumber: section.sectionNumber, evidenceSource: 'manual-selection', evidenceText: selectedDrawingObject.evidenceText, confidence: 1, status: 'confirmed', origin: 'manual', note });
    drawingRequirementsResolver.invalidate(); await renderDrawingWorkspace(shell); return;
  }
  if (button.dataset.drawingOpenSpec) { const pageId = drawingTarget?.pageId || activeDrawingViewerAnalysis?.sheets.find(item => item.pageNumber === drawingTarget?.pageNumber)?.pageId; const link = drawingSpecificationLinks.forPage(pageId).find(item => item.linkId === button.dataset.drawingOpenSpec); const target = drawingSpecificationLinks.openTarget(link); if (target) { specificationDrawingReturnTarget = captureDrawingSupportReturnState(); await openProfessionalDestination(target); } return; }
  if (button.dataset.projectObjectAskChief && selectedDrawingObject?.objectId === button.dataset.projectObjectAskChief) {
    pendingDrawingContext = { ...createDrawingTarget({ ...drawingTarget, projectId: state().activeProject, origin: 'selected-project-object' }), projectObjectId: selectedDrawingObject.objectId };
    chiefDrawingDock.open();const dock=$('.mc-chief-drawing-dock');if(dock){dock.hidden=false;dock.classList.add('open');const prompt=$('#chiefDrawingDockPrompt');if(prompt){prompt.value=`What governs ${selectedDrawingObject.label}?`;prompt.focus();}}
    return;
  }
  if (button.dataset.drawingRecoveryAction) {
    const recoveryAction = button.dataset.drawingRecoveryAction;
    if (recoveryAction === 'open-owning-project' && button.dataset.owningProjectId && state().projects.some(item => item.id === button.dataset.owningProjectId)) {
      engine.setProject(button.dataset.owningProjectId);
      drawingTarget = button.dataset.drawingDocumentId ? createDrawingTarget({ projectId: button.dataset.owningProjectId, documentId: button.dataset.drawingDocumentId, drawingSetId: button.dataset.drawingSetId }) : null;
      await renderDrawingWorkspace(shell); return;
    }
    if (recoveryAction === 'return-to-drawing-sets') { drawingTarget = null; drawingFilter = ''; drawingDiscipline = 'all'; drawingType = 'all'; await renderDrawingWorkspace(shell); return; }
    if (recoveryAction === 'retry-analysis-upgrade') {
      drawingUpgradeFailures.delete(drawingUpgradeKey({ drawingSetId: button.dataset.drawingSetId, documentId: button.dataset.drawingDocumentId }, DRAWING_ANALYSIS_VERSION));
      await renderDrawingWorkspace(shell); return;
    }
    if (recoveryAction === 'remove-stale-analysis') {
      if (!confirm('Remove this stale drawing analysis? The source document and other project records will not be deleted.')) return;
      await engine.removeDrawingAnalysis(button.dataset.drawingSetId); drawingTarget = null; await renderDrawingWorkspace(shell); return;
    }
    if (recoveryAction === 'reattach-original-pdf') {
      const picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'application/pdf,.pdf';
      picker.onchange = async () => { const result = await engine.reattachPdfSource(button.dataset.drawingDocumentId, picker.files?.[0]); if (!result.ok) alert(result.warning); else { drawingUpgradeFailures.clear(); drawingTarget = createDrawingTarget({ projectId: result.projectId, documentId: result.documentId, drawingSetId: result.drawingSetId, pageNumber: 1 }); await renderDrawingWorkspace(shell); } };
      picker.click(); return;
    }
    if (recoveryAction === 'reimport-drawing') { $('#files')?.click(); return; }
    if (recoveryAction === 'view-technical-details') { const details = button.closest('.mc-drawing-recovery')?.querySelector('details'); if (details) details.open = true; return; }
  }
  if (button.hasAttribute('data-drawing-return')) {
    await showMissionControlView('home');
    return;
  }
  if (button.hasAttribute('data-drawing-edit-metadata') && analysis && drawingTarget?.pageNumber) {
    const sheet = analysis.sheets.find(item => item.pageNumber === drawingTarget.pageNumber);
    if (!sheet) return;
    const action = prompt('Catalog action: Apply, Reset to Parser, Compare, or Restore Defaults', 'Apply')?.trim().toLowerCase();
    if (!action) return;
    if (action.startsWith('compare')) {
      const rows = drawingCatalog.compare(analysis.documentId, sheet.pageNumber);
      alert(rows.map(item => `${item.field}\nParser: ${item.parserValue}\nCatalog: ${item.catalogValue}\nChosen: ${item.chosenValue}\nReason: ${item.reason}`).join('\n\n') || 'No catalog comparison is available.');
      return;
    }
    if (action.startsWith('reset')) { drawingCatalog.resetToParser(analysis.documentId, sheet.pageNumber); await renderDrawingWorkspace(shell); return; }
    if (action.startsWith('restore')) { drawingCatalog.restoreDefaults(analysis.documentId, sheet.pageNumber); await renderDrawingWorkspace(shell); return; }
    if (!action.startsWith('apply')) return;
    const sheetNumber = prompt('Sheet number', sheet.sheetNumber || '')?.trim();
    if (sheetNumber === undefined) return;
    const sheetTitle = prompt('Sheet title', sheet.sheetTitle || '')?.trim();
    if (sheetTitle === undefined) return;
    const discipline = prompt('Discipline', sheet.discipline || 'Unknown')?.trim();
    if (discipline === undefined) return;
    const drawingType = prompt('Drawing type', sheet.primarySheetType || sheet.sheetTypes?.[0] || 'Unknown')?.trim();
    if (drawingType === undefined) return;
    drawingCatalog.applyToCatalog(analysis.documentId, sheet.pageNumber, { sheetNumber, sheetTitle, discipline, drawingType }, { projectId: analysis.projectId, drawingSetId: analysis.drawingSetId }, 'manual');
    await renderDrawingWorkspace(shell); return;
  }
  if (button.dataset.drawingSheet && analysis) {
    const sheetClickStartedAt = drawingPerfNow();
    captureDrawingViewport();
    const sheet = analysis.sheets.find(item => button.dataset.drawingPageId && item.pageId === button.dataset.drawingPageId) || analysis.sheets.find(item => item.sheetId === button.dataset.drawingSheet);
    if (!sheet) return;
    const observation = button.dataset.drawingSearchObservation ? analysis.observations.find(item => item.observationId === button.dataset.drawingSearchObservation) : null;
    const painted = await selectPlansSheet({ shell, analysis, sheet, observation, navigationStartedAt, scrollActiveCard: true });
    drawingTraceSlowOperation('sheet click handler', sheetClickStartedAt, { pageId: sheet.pageId, pageNumber: sheet.pageNumber, requestToken: drawingPagePaintRequest });
    return painted;
  }
  if (button.hasAttribute('data-drawing-reanalyze') && analysis && shell === 'professional') {
    if (!confirm('Reanalyze this drawing set from its retained positioned text? Source PDF bytes and exact page identities will be preserved.')) return;
    const rebuilt = reanalyzeDrawingAnalysis(analysis);
    const saved = await engine.saveDrawingAnalysis(rebuilt);
    if (!saved.ok) { drawingLifecycleUnavailable = [saved]; await renderDrawingWorkspace(shell); return; }
    drawingTarget = createDrawingTarget({ ...drawingTarget, projectId: rebuilt.projectId, documentId: rebuilt.documentId, drawingSetId: rebuilt.drawingSetId });
    await renderDrawingWorkspace(shell); return;
  }
  if (button.dataset.drawingObservation && analysis) {
    captureDrawingViewport();
    const observation = analysis.observations.find(item => item.observationId === button.dataset.drawingObservation);
    const sheet = analysis.sheets.find(item => item.sheetId === observation?.sheetId);
    if (observation && sheet) drawingTarget = createDrawingTarget({ projectId: analysis.projectId, documentId: analysis.documentId, drawingSetId: analysis.drawingSetId, drawingId: sheet.drawingId, sheetId: sheet.sheetId, pageNumber: sheet.pageNumber, observationId: observation.observationId, region: observation.region });
    if (observation && sheet) {
      drawingViewerEngine.selectPage(sheet.pageNumber);
      const paintRequest = ++drawingPagePaintRequest;
      await paintDrawingSelectionFast({ shell, analysis, sheet, observation, navigationStartedAt, requestToken: paintRequest });
    }
    else await renderDrawingWorkspace(shell);
    return;
  }
  if (button.dataset.drawingVerify && analysis) {
    const selectedObservation = analysis.observations.find(item => item.observationId === button.dataset.observationId);
    let correctedValue = '';
    if (button.dataset.drawingVerify === 'Corrected') {
      correctedValue = prompt('Corrected observed value', selectedObservation?.verification?.correctedValue || selectedObservation?.originalValue || '')?.trim() || '';
      if (!correctedValue) return;
    }
    const observations = analysis.observations.map(item => item.observationId === button.dataset.observationId ? applyObservationVerification(item, { status: button.dataset.drawingVerify, correctedValue, verifiedAt: new Date().toISOString() }) : item);
    const saved = await engine.saveDrawingAnalysis({ ...analysis, observations });
    if (!saved.ok) { drawingLifecycleUnavailable = [saved]; await renderDrawingWorkspace(shell); return; }
    await renderDrawingWorkspace(shell); return;
  }
  if (button.dataset.drawingOccurrence && analysis) {
    const occurrence = (analysis.candidateOccurrences || []).find(item => item.occurrenceId === button.dataset.drawingOccurrence);
    if (occurrence) {
      const occurrenceSheet = analysis.sheets.find(item => item.sheetId === occurrence.sheetId);
      drawingTarget = createDrawingTarget({ projectId: analysis.projectId, documentId: analysis.documentId, drawingSetId: analysis.drawingSetId, drawingId: occurrenceSheet?.drawingId, sheetId: occurrence.sheetId, pageNumber: occurrence.pageNumber, region: occurrence.region });
      await renderDrawingWorkspace(shell);
    }
    return;
  }
  if (button.dataset.drawingVerifyOccurrence && analysis && shell === 'professional') {
    const state = button.dataset.drawingVerifyOccurrence;
    const candidateOccurrences = (analysis.candidateOccurrences || []).map(item => item.occurrenceId === button.dataset.occurrenceId ? { ...item, verification: { status: state, correctedValue: '', verifiedAt: new Date().toISOString() } } : item);
    const saved = await engine.saveDrawingAnalysis({ ...analysis, candidateOccurrences });
    if (!saved.ok) drawingLifecycleUnavailable = [saved];
    await renderDrawingWorkspace(shell); return;
  }
  if (button.hasAttribute('data-drawing-analyze-page') && analysis && shell === 'professional') {
    const sheet = analysis.sheets.find(item => item.sheetId === drawingTarget?.sheetId);
    const source = await engine.sourceFile(analysis.documentId);
    if (!sheet || !source) { alert('The authoritative PDF is unavailable for selected-page analysis.'); return; }
    if (!activeDrawingPdf || activeDrawingDocumentId !== source.documentId) { releaseDrawingSource(); activeDrawingPdf = await openPdfBlob(source.sourceBlob); activeDrawingDocumentId = source.documentId; activeDrawingSourceRecord = source; }
    const graphics = await readPdfPageGraphics(activeDrawingPdf, sheet.pageNumber, { maxOperations: 12000 });
    if (!graphics.supported || graphics.status === 'cancelled') { alert(graphics.warnings?.[0] || 'This page does not expose supported deterministic graphics.'); return; }
    let legends = analysis.legends || [];
    let candidateOccurrences = analysis.candidateOccurrences || [];
    if (sheet.sheetTypes.includes('Symbols and Abbreviations') || sheet.sheetTypes.includes('General Notes')) {
      const replacements = extractLegendCandidates({ documentId: analysis.documentId, drawingSetId: analysis.drawingSetId, sheet: { ...sheet, drawingSetId: analysis.drawingSetId }, primitives: graphics.primitives });
      legends = [...legends.filter(item => item.sheetId !== sheet.sheetId), ...replacements];
    } else {
      const target = { ...sheet, drawingSetId: analysis.drawingSetId };
      const replacements = legends.flatMap(legend => matchLegendOccurrences({ legend, targetSheet: target, primitives: graphics.primitives }));
      candidateOccurrences = [...candidateOccurrences.filter(item => item.sheetId !== sheet.sheetId), ...replacements];
    }
    const saved = await engine.saveDrawingAnalysis({ ...analysis, legends, candidateOccurrences, graphicsDiagnostics: { ...(analysis.graphicsDiagnostics || {}), [sheet.sheetId]: { status: graphics.status, operationCount: graphics.operationCount, primitiveCount: graphics.primitives.length, warnings: graphics.warnings } } });
    if (!saved.ok) { drawingLifecycleUnavailable = [saved]; await renderDrawingWorkspace(shell); return; }
    await renderDrawingWorkspace(shell); return;
  }
  const currentIndex = analysis?.sheets.findIndex(item => item.sheetId === drawingTarget?.sheetId) ?? -1;
  if ((button.hasAttribute('data-drawing-previous') || button.hasAttribute('data-drawing-next')) && analysis) {
    captureDrawingViewport();
    const offset = button.hasAttribute('data-drawing-next') ? 1 : -1;
    const matchingTarget = drawingMatchingSheetIds.length ? drawingMatchingSetTarget(drawingMatchingSheetIds, drawingTarget?.sheetId, offset, analysis) : null;
    const next = analysis.sheets[currentIndex + offset];
    const targetSheet = matchingTarget
      ? analysis.sheets.find(item => item.sheetId === matchingTarget.sheetId) || null
      : next || null;
    if (targetSheet) {
      const targetObservation = drawingTarget?.observationId ? analysis.observations.find(item => item.observationId === drawingTarget.observationId) : null;
      await selectPlansSheet({ shell, analysis, sheet: targetSheet, observation: targetObservation, navigationStartedAt, scrollActiveCard: false });
    } else await renderDrawingWorkspace(shell);
    return;
  }
  if (button.dataset.drawingZoom) {
    drawingZoom = Math.max(.35, Math.min(3, drawingZoom + (button.dataset.drawingZoom === 'in' ? .2 : -.2)));
    captureDrawingViewport({ mode: 'custom', zoom: drawingZoom });
    await repaintCurrentSheet({ preserveSidebarScroll: true }); return;
  }
  if (button.dataset.drawingFit && analysis) {
    drawingZoom = null;
    captureDrawingViewport({ mode: button.dataset.drawingFit === 'width' ? 'fit-width' : 'fit-page', zoom: null, scrollLeft: 0, scrollTop: 0 });
    await repaintCurrentSheet({ preserveSidebarScroll: true }); return;
  }
  if (button.hasAttribute('data-drawing-rotate')) { drawingRotation = (drawingRotation + 90) % 360; captureDrawingViewport({ rotation: drawingRotation, mode: 'custom' }); await repaintCurrentSheet({ preserveSidebarScroll: true }); return; }
  if (button.hasAttribute('data-drawing-reset-view')) { drawingZoom = null; drawingRotation = 0; captureDrawingViewport({ ...defaultDrawingViewport() }); await repaintCurrentSheet({ preserveSidebarScroll: true }); return; }
  if (button.dataset.drawingLayout) {
    if (button.dataset.drawingLayout === 'expand') drawingWorkspaceBeforeExpand = { ...drawingWorkspacePanels };
    drawingWorkspacePanels = button.dataset.drawingLayout === 'restore' && drawingWorkspaceBeforeExpand
      ? { ...drawingWorkspaceBeforeExpand, expanded: false }
      : drawingWorkspaceLayout(drawingWorkspacePanels, button.dataset.drawingLayout);
    if (button.dataset.drawingLayout === 'restore') drawingWorkspaceBeforeExpand = null;
    const layout = button.closest('.mc-drawing-layout');
    layout?.classList.toggle('finder-hidden', drawingWorkspacePanels.finderHidden);
    layout?.classList.toggle('evidence-hidden', drawingWorkspacePanels.evidenceHidden);
    layout?.classList.toggle('drawing-expanded', drawingWorkspacePanels.expanded);
    button.textContent = button.dataset.drawingLayout === 'expand' ? 'Restore Workspace' : button.dataset.drawingLayout === 'restore' ? 'Expand Drawing' : button.dataset.drawingLayout === 'toggle-finder' ? `${drawingWorkspacePanels.finderHidden ? 'Show' : 'Hide'} Sheet Finder` : `${drawingWorkspacePanels.evidenceHidden ? 'Show' : 'Hide'} Construction Evidence`;
    button.dataset.drawingLayout = button.dataset.drawingLayout === 'expand' ? 'restore' : button.dataset.drawingLayout === 'restore' ? 'expand' : button.dataset.drawingLayout;
    return;
  }
  if (button.hasAttribute('data-drawing-clear-search')) { drawingFilter = ''; const input = $('#mcDrawingSearch'); if (input) { input.value = ''; input.focus(); } scheduleDrawingSearchResultsUpdate({ immediate: true }); return; }
  if (button.hasAttribute('data-drawing-source')) { selectedDoc = drawingTarget?.documentId; sourceNavigationTarget = createSourceTarget({ projectId: state().activeProject, documentId: selectedDoc, pageNumber: drawingTarget?.pageNumber, sheetId: drawingTarget?.sheetId, region: drawingTarget?.region, observationId: drawingTarget?.observationId, originatingWorkspace: 'drawings' }); await openProfessionalDestination({ view: 'sources', documentId: selectedDoc }); return; }
  if (button.hasAttribute('data-drawing-current-work')) { const result = await activateSelectedWorkspaceDocument(CONTEXT_ACTIVATION_SOURCES.constructionWorkPackage, drawingTarget?.documentId); if (!result?.available) alert(result?.reasons?.join(' ') || 'This drawing cannot establish exact Current Work.'); else if (shell === 'professional') show('engineering'); else await showMissionControlView('home'); return; }
  if (button.hasAttribute('data-drawing-inspection')) { const sheet = analysis?.sheets.find(item => item.sheetId === drawingTarget?.sheetId); selectedDoc = drawingTarget?.documentId || selectedDoc; await openInspectionForm(null, { projectId: state().activeProject, discipline: sheet?.discipline || '', sourceDocumentIds: [drawingTarget?.documentId].filter(Boolean), relatedDrawingIds: [drawingTarget?.documentId].filter(Boolean), sourceSectionIds: [], evidenceReferences: [] }); return; }
  if (button.hasAttribute('data-drawing-ask')) { const sheet = analysis?.sheets.find(item => item.sheetId === drawingTarget?.sheetId); pendingDrawingContext = createDrawingTarget({ ...drawingTarget, projectId: state().activeProject, documentId: analysis?.documentId, drawingSetId: analysis?.drawingSetId, sheetNumber: sheet?.sheetNumber, origin: 'ask-about-sheet' });chiefDrawingDock.open();const dock=$('.mc-chief-drawing-dock');if(dock){dock.hidden=false;dock.classList.add('open');const prompt=$('#chiefDrawingDockPrompt');if(prompt){prompt.value=`What governs ${sheet?.sheetNumber||`page ${drawingTarget?.pageNumber}`}?`;prompt.focus();}}return; }
});

const activationTimestamp = () => new Date().toISOString();

function activationOrigin(source) {
  if (source.includes('Evidence')) return 'evidence';
  if (source.includes('Relationship')) return 'relationships';
  if (source.includes('Version')) return 'versions';
  if (source.includes('Revision')) return 'revisions';
  if (source.includes('Source Inspector')) return 'sources';
  if (source.includes('Workflow')) return 'workflow';
  if (source.includes('Command Desk')) return 'chat';
  if (source.includes('Inspection Record')) return 'inspections';
  if (source.includes('Construction Work Package')) return 'engineering';
  return 'knowledge';
}

async function contextActivationRecords() {
  const currentState = state();
  const documents = await engine.documents();
  const sections = await engine.sections();
  const relationships = buildKnowledgeRelationships({ documents, sections });
  const lineage = buildDocumentLineage({ documents, sections });
  const revisions = buildRevisionMetrics({ documents, sections }).comparisons.map(comparison => ({
    revisionId: `${comparison.earlierDocument.id}->${comparison.laterDocument.id}`,
    comparison
  }));
  return {
    currentState,
    documents,
    sections,
    records: {
      projects: currentState.projects,
      libraries: currentState.libraries,
      documents,
      sections,
      evidence: activeRetrievalSession?.evidence || [],
      relationships: [
        ...relationships.membership,
        ...relationships.hierarchy,
        ...relationships.explicitReferences,
        ...relationships.reverseReferences,
        ...relationships.documentReferences,
        ...relationships.sameDivision,
        ...relationships.sameLibrary
      ],
      lineages: lineage.chains.map(chain => ({ lineageId: chain.lineageId })),
      revisions
    }
  };
}

async function activateSelectedWorkspaceDocument(source, documentId = selectedDoc, sectionId = '', relationshipId = '') {
  const documents = await engine.documents();
  const document = documents.find(item => item.id === documentId);
  if (!document) return null;
  return activateEngineeringContext({
    projectId: state().activeProject,
    libraryId: document.libraryId,
    documentId: document.id,
    sectionId,
    relationshipId,
    lineageId: source === CONTEXT_ACTIVATION_SOURCES.versionDocument ? document.lineageId : '',
    source
  });
}

async function activateEngineeringContext(request) {
  const snapshot = await contextActivationRecords();
  const result = createContextActivation({
    ...request,
    activatedAt: request.activatedAt || activationTimestamp()
  }, snapshot.records);
  if (!result.available) {
    if (Object.values(CONTEXT_ACTIVATION_SOURCES).includes(request.source)) clearActiveContext(request.source, request.projectId || state().activeProject);
    return result;
  }
  const previousKey = activeContextActivation
    ? `${activeContextActivation.projectId}:${activeContextActivation.documentId}:${activeContextActivation.sectionId}`
    : '';
  const next = result.activation;
  const nextKey = `${next.projectId}:${next.documentId}:${next.sectionId}`;
  const context = createEngineeringContext({
    ...next,
    projects: snapshot.currentState.projects,
    documents: snapshot.documents,
    sections: snapshot.sections,
    retrievalSession: activeRetrievalSession
  });
  if (!context) {
    clearActiveContext(request.source, request.projectId);
    return { ...result, available: false, activation: null, transition: 'cleared', reasons: ['Validated activation could not seed Engineering Context.'] };
  }
  if (previousKey && previousKey !== nextKey) clearWorkflowWorkspace();
  activeContextActivation = next;
  contextClearedEvent = null;
  engineeringTarget = { ...next, origin: activationOrigin(next.source) };
  startInspectionSession(context, { source: next.source });
  publishContextSynchronization(context, snapshot.documents, snapshot.sections);
  return result;
}

function clearActiveContext(source, projectId = state().activeProject) {
  activeContextActivation = null;
  contextClearedEvent = createContextClearedEvent({ projectId, source, activatedAt: activationTimestamp() });
  engineeringTarget = null;
  clearInspectionSession();
  clearWorkflowWorkspace();
  contextBusSnapshot = createContextBusSnapshot();
  void renderContextBusBanner(view);
}

function publishContextSynchronization(context, documents, sections) {
  const revisionIds = buildRevisionMetrics({ documents, sections }).comparisons
    .filter(comparison => comparison.comparable && [comparison.earlierDocument.id, comparison.laterDocument.id].some(id => context.versionIds.includes(id)))
    .map(comparison => `${comparison.earlierDocument.id}->${comparison.laterDocument.id}`);
  contextBusSnapshot = createContextBusSnapshot({ engineeringContext: context, activation: activeContextActivation, documents, revisionIds });
  const reference = contextBusSnapshot.context;
  if (!reference) return;
  selectedDoc = reference.documentId;
  if (reference.evidenceId) selectedEvidenceId = reference.evidenceId;
  sourceNavigationTarget = createSourceTarget({
    projectId: reference.projectId, libraryId: reference.libraryId,
    documentId: reference.documentId, sectionId: reference.sectionId,
    evidenceId: reference.evidenceId, originatingWorkspace: activationOrigin(reference.activationSource),
    originatingMessageId: activeRetrievalSession?.messageId || '', destination: 'sources'
  });
  relationshipTarget = {
    ...relationshipNavigationTarget({ documentId: reference.documentId, sectionId: reference.sectionId }),
    projectId: reference.projectId, libraryId: reference.libraryId,
    originatingWorkspace: activationOrigin(reference.activationSource)
  };
  lineageTarget = { ...lineageNavigationTarget(reference.documentId), originatingWorkspace: activationOrigin(reference.activationSource) };
  if (reference.revisionIds.length) {
    const [earlierDocumentId, laterDocumentId] = reference.revisionIds[0].split('->');
    revisionTarget = revisionNavigationTarget(earlierDocumentId, laterDocumentId, { originatingWorkspace: activationOrigin(reference.activationSource) });
  } else revisionTarget = null;
  if (contextBusSnapshot.workflow.status === 'selected') {
    workflowTarget = workflowNavigationTarget({ workflowType: contextBusSnapshot.workflow.workflowType, origin: activationOrigin(reference.activationSource) });
  } else {
    workflowTarget = null;
    clearWorkflowSession();
  }
  void renderContextBusBanner(view);
}

async function renderContextBusBanner(workspace) {
  const synchronizedViews = new Set(['chat','engineering','workflow','sources','drawings','relationships','versions','revisions','evidence','evaluate']);
  if (!synchronizedViews.has(workspace)) return;
  const container = document.getElementById(workspace);
  container?.querySelector('[data-context-bus-banner]')?.remove();
  if (!container) return;
  const reference = contextBusSnapshot.context;
  if (!reference) {
    container.insertAdjacentHTML('afterbegin', '<div class="mc-context-bus-banner unavailable" data-context-bus-banner role="status"><strong>No construction context selected</strong><span>Ask Chief a construction question or open an exact drawing, specification, or project record to synchronize this workspace.</span></div>');
    return;
  }
  const documents = await engine.documents();
  const sections = await engine.sections();
  if (contextBusSnapshot.context !== reference || !container.isConnected) return;
  const project = state().projects.find(item => item.id === reference.projectId);
  const library = engine.libraries().find(item => item.id === reference.libraryId);
  const documentRecord = documents.find(item => item.id === reference.documentId);
  const section = sections.find(item => item.id === reference.sectionId && item.documentId === reference.documentId);
  const workflow = contextBusSnapshot.workflow.status === 'ambiguous' ? 'Select Workflow' : contextBusSnapshot.workflow.workflowType || 'Unavailable';
  container.querySelector('[data-context-bus-banner]')?.remove();
  container.insertAdjacentHTML('afterbegin', `<div class="mc-context-bus-banner synchronized" data-context-bus-banner role="status" aria-label="Synchronized Engineering Context"><dl><div><dt>Project</dt><dd>${esc(project?.name || reference.projectId)}</dd></div><div><dt>Library</dt><dd>${esc(library?.name || reference.libraryId || 'Unavailable')}</dd></div><div><dt>Document</dt><dd>${esc(documentRecord?.title || documentRecord?.name || reference.documentId)}</dd></div><div><dt>Section</dt><dd>${esc(section ? sectionHeadingValue(section) || reference.sectionId : reference.sectionId || 'Unavailable')}</dd></div><div><dt>Activation Source</dt><dd>${esc(reference.activationSource)}</dd></div><div><dt>Current Workflow</dt><dd>${esc(workflow)}</dd></div></dl></div>`);
}

function reducedMotionPreferred() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function revealNavigationTarget(element) {
  if (!element) return;

  requestAnimationFrame(() => {
    element.scrollIntoView(sourceScrollOptions(reducedMotionPreferred()));
    element.focus({ preventScroll: true });
  });
}

function showTransientNavigationNotice(message) {
  sourceNavigationNotice = message;
  const messages = $('#messages');

  if (!messages || !message) return;

  messages.querySelector('[data-source-navigation-notice]')?.remove();
  messages.insertAdjacentHTML('afterbegin', `
    <div class="mc-source-target-notice" data-source-navigation-notice role="status">
      ${esc(message)}
    </div>
  `);
}

function returnToEvidenceExplorer() {
  const originatingMessageId = sourceNavigationTarget?.originatingMessageId ||
    relationshipTarget?.originatingMessageId;
  if (
    activeRetrievalSession &&
    originatingMessageId === activeRetrievalSession.messageId
  ) {
    selectedEvidenceId = sourceNavigationTarget?.evidenceId ||
      relationshipTarget?.evidenceId ||
      selectedEvidenceId;
    show('evidence');
    return;
  }

  show('chat');
  showTransientNavigationNotice(
    'The retrieval session is no longer available. Ask Chief a new question to inspect evidence.'
  );
}

function openRelationshipExplorerFromEvidence(evidence) {
  if (!evidence?.documentId || !activeRetrievalSession) return;
  relationshipTarget = {
    ...relationshipNavigationTarget({
      documentId: evidence.documentId,
      sectionId: evidence.sectionId,
      origin: 'evidence'
    }),
    projectId: activeRetrievalSession.project.id,
    libraryId: evidence.libraryId || activeRetrievalSession.library.id,
    evidenceId: evidence.id,
    originatingMessageId: activeRetrievalSession.messageId
  };
  selectedDoc = evidence.documentId;
  show('relationships');
}

function openRelationshipSource(destination) {
  if (!relationshipTarget?.documentId) return;
  sourceNavigationTarget = createSourceTarget({
    projectId: relationshipTarget.projectId || state().activeProject,
    libraryId: relationshipTarget.libraryId,
    documentId: relationshipTarget.documentId,
    sectionId: relationshipTarget.sectionId,
    evidenceId: relationshipTarget.evidenceId,
    originatingWorkspace: 'relationships',
    originatingMessageId: relationshipTarget.originatingMessageId,
    destination
  });
  selectedDoc = relationshipTarget.documentId;
  if (destination === 'knowledge') selectedKnowledgeSection = 'all';
  show(destination);
}

function returnToRelationshipExplorer() {
  if (!relationshipTarget?.documentId) {
    show('relationships');
    return;
  }
  selectedDoc = relationshipTarget.documentId;
  show('relationships');
}

function openVersionExplorer(documentId, originatingMessageId = '') {
  const target = lineageNavigationTarget(documentId);
  if (!target) return;
  lineageTarget = {
    ...target,
    originatingMessageId,
    originatingWorkspace: originatingMessageId ? 'chat' : view
  };
  selectedDoc = documentId;
  show('versions');
}

function openRevisionReview(earlierDocumentId, laterDocumentId) {
  const target = revisionNavigationTarget(earlierDocumentId, laterDocumentId, {
    originatingWorkspace: view
  });
  if (!target) return;
  revisionTarget = target;
  revisionFilter = 'all';
  selectedRevisionMatch = 0;
  selectedInspectionId = null;
  void engine.documents().then(documents => {
    const later = documents.find(document => document.id === laterDocumentId);
    if (!later) return;
    return activateEngineeringContext({
      projectId: state().activeProject,
      libraryId: later.libraryId,
      documentId: later.id,
      lineageId: later.lineageId,
      revisionId: `${earlierDocumentId}->${laterDocumentId}`,
      source: CONTEXT_ACTIVATION_SOURCES.revisionPair
    });
  });
  show('revisions');
}

async function openEngineeringWorkspace({ documentId, sectionId = '', evidenceId = '', libraryId = '', origin = view, source = '' } = {}) {
  const seed = documentId ? { projectId: state().activeProject, documentId, sectionId, evidenceId, libraryId } : activeContextActivation;
  if (!seed?.documentId) {
    show('engineering');
    return;
  }
  const activationSource = source || ({
    chat: CONTEXT_ACTIVATION_SOURCES.commandDesk,
    evidence: CONTEXT_ACTIVATION_SOURCES.evidence,
    relationships: CONTEXT_ACTIVATION_SOURCES.relationshipDocument,
    versions: CONTEXT_ACTIVATION_SOURCES.versionDocument,
    revisions: CONTEXT_ACTIVATION_SOURCES.revisionSection,
    sources: CONTEXT_ACTIVATION_SOURCES.sourceInspectorDocument,
    knowledge: CONTEXT_ACTIVATION_SOURCES.knowledgeObjectDocument,
    workflow: CONTEXT_ACTIVATION_SOURCES.workflowOpen
  }[origin] || CONTEXT_ACTIVATION_SOURCES.engineeringWorkspace);
  await activateEngineeringContext({ ...seed, source: activationSource });
  show('engineering');
}

function clearEngineeringWorkspace() {
  engineeringTarget = null;
  clearInspectionSession();
  clearWorkflowWorkspace();
}

function clearWorkflowWorkspace() {
  workflowTarget = null;
  clearWorkflowSession();
}

async function openWorkflowWorkspace(workflowType = 'Inspection Preparation', origin = view) {
  if (!getInspectionSession()?.context) return;
  const replacing = Boolean(workflowTarget && workflowTarget.workflowType !== workflowType);
  const target = workflowNavigationTarget({ workflowType, origin });
  if (!target) return;
  workflowTarget = target;
  clearWorkflowSession();
  if (activeContextActivation) {
    await activateEngineeringContext({
      ...activeContextActivation,
      source: replacing ? CONTEXT_ACTIVATION_SOURCES.workflowReplace : CONTEXT_ACTIVATION_SOURCES.workflowOpen
    });
  }
  show('workflow');
}

async function seedWorkflowFromDocument(documentId, sectionId = '', origin = view) {
  const currentState = state();
  const documents = await engine.documents();
  const sections = await engine.sections();
  const document = documents.find(item => item.id === documentId);
  if (!document) return;
  const context = createEngineeringContext({
    projectId: currentState.activeProject,
    documentId,
    sectionId,
    libraryId: document.libraryId,
    projects: currentState.projects,
    documents,
    sections,
    retrievalSession: activeRetrievalSession
  });
  if (!context) return;
  engineeringTarget = engineeringNavigationTarget({ projectId: context.projectId, documentId, sectionId, libraryId: context.libraryId, origin });
  startInspectionSession(context, { origin });
  openWorkflowWorkspace('Inspection Preparation', origin);
}

function returnToRevisionReview() {
  if (revisionTarget) show('revisions');
  else show('versions');
}

function returnToOriginatingAnswer() {
  const messageId = sourceNavigationTarget?.originatingMessageId ||
    activeRetrievalSession?.messageId;
  const messageExists = state().chat.some(message =>
    message.role === 'assistant' && message.id === messageId
  );

  if (!messageId || !messageExists) {
    show('chat');
    showTransientNavigationNotice('The originating answer is no longer available.');
    return;
  }

  answerNavigationTarget = messageId;
  show('chat');
  const answer = document.getElementById(answerAnchorId(messageId));
  answer?.classList.add('mc-section-highlight-answer');
  revealNavigationTarget(answer);
}

async function openEvidenceSource(evidence, destination) {
  if (!activeRetrievalSession || !evidence) return;

  const actions = sourceNavigationActions(evidence);
  const actionSupported = destination === 'knowledge'
    ? actions.viewInDocument
    : actions.openSourceInspector;

  if (!actionSupported) return;

  const proposedTarget = createSourceTarget({
    projectId: activeRetrievalSession.project.id,
    libraryId: evidence.libraryId || activeRetrievalSession.library.id,
    documentId: evidence.documentId,
    sectionId: evidence.sectionId,
    evidenceId: evidence.id,
    evidenceIndex: evidence.order,
    originatingWorkspace: 'evidence',
    originatingMessageId: activeRetrievalSession.messageId,
    destination
  });
  const projects = state().projects;
  const projectIsValid = proposedTarget.projectId && projects.some(project =>
    project.id === proposedTarget.projectId
  );

  if (proposedTarget.projectId && !projectIsValid) {
    sourceNavigationNotice = 'The source project is no longer available.';
    renderEvidenceExplorer();
    return;
  }

  if (projectIsValid && state().activeProject !== proposedTarget.projectId) {
    engine.setProject(proposedTarget.projectId);
    $('#projectSelect').value = proposedTarget.projectId;
    selectedKnowledgeSection = 'all';
    knowledgeCatalogContext = null;
  }

  const documents = await engine.documents();
  const sections = await engine.sections();
  const libraries = engine.libraries();
  const resolution = resolveSourceTarget(proposedTarget, {
    projects: state().projects,
    libraries,
    documents,
    sections
  });

  if (resolution.status === 'missing-document') {
    sourceNavigationNotice = 'The source document is no longer available.';
    renderEvidenceExplorer();
    return;
  }

  if (resolution.status === 'none') return;

  sourceNavigationTarget = sourceNavigationDestination(
    proposedTarget,
    destination
  );
  sourceNavigationNotice = resolution.status === 'missing-section'
    ? 'Source section unavailable'
    : '';
  selectedDoc = resolution.document.id;

  if (resolution.library?.enabled && state().activeLibrary !== resolution.library.id) {
    engine.setLibrary(resolution.library.id);
  }

  if (destination === 'knowledge') {
    selectedKnowledgeSection = 'all';
  }

  show(destination);
}

function modeLabel(mode) {
  return {
    offline: 'Offline evidence',
    source: 'Source-only AI',
    assisted: 'Expert-assisted AI',
    general: 'General assistant AI'
  }[mode] || 'Offline evidence';
}

async function refresh() {
  const currentState = state();
  const selectedMode = currentState.settings.mode || 'offline';

  $('#mode').value = selectedMode;
  $('#kMode').textContent = modeLabel(selectedMode);

  $('#kAI').textContent = selectedMode === 'offline'
    ? 'Not required'
    : currentState.settings.openaiKey
      ? 'Configured'
      : 'Not configured';

  const projectGroups = separateMissionControlProjects(currentState.projects, DEMO_PROJECT_ID);
  const projectOptions = projects => projects.map(project => `
      <option
        value="${project.id}"
        ${project.id === currentState.activeProject ? 'selected' : ''}
      >
        ${esc(project.name)}
      </option>
    `).join('');
  $('#projectSelect').innerHTML = `
    <optgroup label="My Projects">${projectOptions(projectGroups.userProjects)}</optgroup>
  `;

  const documents = await engine.documents();
  const sections = experience === 'professional-workspace' ? await engine.sections() : [];

  $('#kDocs').textContent = fmt(documents.length);
  $('#kSections').textContent = fmt(sections.length);

  renderMessages(documents, sections);
  renderProjectWorkspace(documents, sections);
  await renderKnowledgeWorkspace(documents, sections);
  renderDemonstrationControls();
  if (experience === 'mission-control') await renderMissionControl(documents, sections);
}

function renderDemonstrationControls() {
  const guide = $('#demoGuide');
  if (guide) guide.hidden = true;
}

async function selectProjectThroughProductionPath(projectId) {
  const currentProjectId = state().activeProject;
  if (projectId === DEMO_PROJECT_ID && currentProjectId && currentProjectId !== DEMO_PROJECT_ID) {
    previousUserProjectId = currentProjectId;
  } else if (projectId !== DEMO_PROJECT_ID) {
    previousUserProjectId = projectId;
  }
  engine.setProject(projectId);
  selectedDoc = null;
  selectedKnowledgeSection = 'all';
  knowledgeCatalogContext = null;
  sourceNavigationTarget = null;
  answerNavigationTarget = null;
  sourceNavigationNotice = '';
  relationshipTarget = null;
  lineageTarget = null;
  revisionTarget = null;
  revisionFilter = 'all';
  selectedRevisionMatch = 0;
  drawingTarget = null;
  drawingFilter = '';
  drawingDiscipline = 'all';
  drawingType = 'all'; drawingSearchActiveIndex = -1;
  drawingZoom = null;
  drawingRotation = 0;
  activePlanQuery = null; activeWorkPackage = null; activeWorkPackageMessageId = ''; chiefConstructionContext = null; drawingMatchingSheetIds = []; selectedWorkPackageItem = ''; pendingDrawingContext = null;
  releaseDrawingSource();
  clearActiveContext(CONTEXT_ACTIVATION_SOURCES.projectSwitch, projectId);
  await refresh();
}

function clearDemonstrationTransientState() {
  activeRetrievalSession = null;
  selectedEvidenceId = null;
  selectedInspectionId = null;
  selectedDoc = null;
  selectedKnowledgeSection = 'all';
  knowledgeCatalogContext = null;
  sourceNavigationTarget = null;
  answerNavigationTarget = null;
  sourceNavigationNotice = '';
  relationshipTarget = null;
  lineageTarget = null;
  revisionTarget = null;
  revisionFilter = 'all';
  selectedRevisionMatch = 0;
  drawingTarget = null;
  drawingFilter = '';
  drawingDiscipline = 'all';
  drawingType = 'all'; drawingSearchActiveIndex = -1;
  drawingZoom = null;
  drawingRotation = 0;
  activePlanQuery = null; activeWorkPackage = null; activeWorkPackageMessageId = ''; chiefConstructionContext = null; drawingMatchingSheetIds = []; selectedWorkPackageItem = ''; pendingDrawingContext = null; activeChiefLocationPresentation = null;
  releaseDrawingSource();
  engineeringTarget = null;
  workflowTarget = null;
  clearActiveContext(CONTEXT_ACTIVATION_SOURCES.projectSwitch, DEMO_PROJECT_ID);
}

async function returnFromDemonstrationProject() {
  clearDemonstrationTransientState();
  demoGuideDismissed = true;
  engine.setProject('general');
  engine.createConversation();
  missionControlAttachments = [];
  chiefHistoryVisible = false;
  missionControlView = 'home';
  await refresh();
  await switchExperience('mission-control');
  $('#missionControlPrompt')?.focus();
}

async function openDemonstrationProject({ reset = false } = {}) {
  const existing = state().projects.some(project => project.id === DEMO_PROJECT_ID);
  if (reset && existing) await engine.deleteProject(DEMO_PROJECT_ID);
  if (!existing || reset) {
    const fixture = createDemonstrationProjectFixture();
    const validation = validateDemonstrationProject(fixture);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    await engine.importProject(fixture, { preserveIdentifiers: true });
  }
  await selectProjectThroughProductionPath(DEMO_PROJECT_ID);
  missionControlView = 'home';
  selectedDoc = DEMO_INITIAL_DOCUMENT_ID;
  demoGuideDismissed = false;
  const demoDocument = (await engine.documents()).find(document => document.id === DEMO_INITIAL_DOCUMENT_ID);
  await activateEngineeringContext({
    projectId: DEMO_PROJECT_ID,
    libraryId: demoDocument?.libraryId || '',
    documentId: DEMO_INITIAL_DOCUMENT_ID,
    sectionId: DEMO_INITIAL_SECTION_ID,
    source: CONTEXT_ACTIVATION_SOURCES.knowledgeCatalog
  });
  await refresh();
  await switchExperience('mission-control');
  renderDemonstrationControls();
}

$('#mode').onchange = () => {
  engine.saveSettings({
    mode: $('#mode').value
  });

  refresh();
};

$('#projectSelect').onchange = async () => {
  await selectProjectThroughProductionPath($('#projectSelect').value);
};

$('#newProject').onclick = () => openModal(
  `
    <h2>Create project</h2>
    <label>
      Project name
      <input id="projectName" autofocus>
    </label>
    <button id="createProject">Create</button>
  `,
  () => {
    $('#createProject').onclick = () => {
      const name = $('#projectName').value.trim();

      if (name) {
        const project = engine.addProject(name);
        previousUserProjectId = project.id;
        missionControlView = 'home';
        closeModal();
        refresh();
      }
    };
  }
);

function promptSuggestions(documents = [], sections = []) {
  const indexingIncomplete = documents.some(document =>
    document.status !== 'verified' ||
    Number(document.sectionCount || 0) <= 0
  );

  if (!documents.length) {
    return [
      { label: 'Add project documents', view: 'knowledge' },
      { label: 'Open the Knowledge Workspace', view: 'knowledge' },
      { label: 'Configure this project', view: 'settings' }
    ];
  }

  if (!sections.length || indexingIncomplete) {
    return [
      { label: 'Inspect document extraction', view: 'sources' },
      { label: 'Review the Knowledge Workspace', view: 'knowledge' },
      { label: 'Check diagnostics', view: 'diagnostics' }
    ];
  }

  return [
    { label: 'Summarize the key requirements in this project' },
    { label: 'Identify open risks or conflicts in the indexed documents' },
    { label: 'Compare related requirements across sources' },
    { label: 'Show the strongest evidence for a project question' }
  ];
}

function renderPromptSuggestions(documents, sections) {
  const suggestions = promptSuggestions(documents, sections);
  const heading = suggestions.every(suggestion => !suggestion.view)
    ? 'Ask a source-grounded question'
    : 'Recommended next steps';

  return `
    <div class="mc-prompt-suggestions">
      <p class="mc-prompt-heading">${heading}</p>
      <div class="mc-prompt-list">
        ${suggestions.map(suggestion => `
          <button
            type="button"
            class="mc-prompt-button"
            ${suggestion.view
              ? `data-prompt-view="${suggestion.view}"`
              : `data-prompt-question="${esc(suggestion.label)}"`}
          >
            ${esc(suggestion.label)}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function formatInlineMessage(value) {
  return String(value || '')
    .split(/(`[^`\n]+`)/g)
    .map(part => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return `<code>${esc(part.slice(1, -1))}</code>`;
      }

      return esc(part)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[S(\d+)\]/g, '<span class="mc-citation-ref">[S$1]</span>');
    })
    .join('');
}

function formatMessageContent(content) {
  const lines = String(content || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const code = [];
      index += 1;

      while (index < lines.length && !lines[index].trimStart().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }

      index += index < lines.length ? 1 : 0;
      blocks.push(`
        <pre class="mc-message-code"><code${language
          ? ` data-language="${esc(language)}"`
          : ''}>${esc(code.join('\n'))}</code></pre>
      `);
      continue;
    }

    if (
      line.includes('|') &&
      index + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])
    ) {
      const tableLines = [line];
      index += 2;

      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        tableLines.push(lines[index]);
        index += 1;
      }

      const cells = tableLines.map(row =>
        row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
      );

      blocks.push(`
        <div class="mc-message-table-wrap">
          <table>
            <thead>
              <tr>${cells[0].map(cell => `<th>${formatInlineMessage(cell)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${cells.slice(1).map(row => `
                <tr>${row.map(cell => `<td>${formatInlineMessage(cell)}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];

      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }

      blocks.push(`<blockquote>${formatInlineMessage(quote.join('\n')).replace(/\n/g, '<br>')}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const matcher = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      const items = [];

      while (index < lines.length && matcher.test(lines[index])) {
        items.push(lines[index].replace(matcher, ''));
        index += 1;
      }

      const tag = ordered ? 'ol' : 'ul';
      blocks.push(`<${tag}>${items.map(item => `<li>${formatInlineMessage(item)}</li>`).join('')}</${tag}>`);
      continue;
    }

    if (/^\s*#{1,4}\s+/.test(line)) {
      const match = line.match(/^\s*(#{1,4})\s+(.+)$/);
      const level = Math.min(match[1].length + 2, 6);
      blocks.push(`<h${level}>${formatInlineMessage(match[2])}</h${level}>`);
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trimStart().startsWith('```') &&
      !/^\s*(>|[-*]\s+|\d+\.\s+|#{1,4}\s+)/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }

    blocks.push(`<p>${formatInlineMessage(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }

  return blocks.join('');
}

function renderAssistantCitations(message, messageIndex) {
  const hits = Array.isArray(message.hits) ? message.hits : [];

  if (!hits.length) {
    return '';
  }

  return `
    <details class="mc-message-citations" id="mc-citations-${messageIndex}" open>
      <summary>
        <span>Evidence sources</span>
        <span class="mc-message-source-count">${hits.length}</span>
      </summary>
      <div class="mc-message-citation-list">
        ${hits.map(hit => `
          <div>
            <strong>[S${hit.sourceNumber}] ${esc(hit.heading)}</strong>
            <span>${esc(hit.documentName)} · ${esc(hit.location)}</span>
          </div>
        `).join('')}
      </div>
    </details>
  `;
}

function renderAssistantToolbar(message, messageIndex) {
  const hasCitations = Array.isArray(message.hits) && message.hits.length > 0;
  const canExploreEvidence = hasCitations &&
    activeRetrievalSession?.messageId === message.id;
  const canCopy = Boolean(navigator.clipboard?.writeText);
  const activeEngineeringContext = getInspectionSession()?.context;
  const canOpenWorkflow = canExploreEvidence && activeEngineeringContext?.documentIds?.includes(message.hits[0]?.documentId);

  return `
    <div class="mc-message-toolbar" role="toolbar" aria-label="Response actions">
      <button
        type="button"
        data-copy-message="${esc(message.id)}"
        ${canCopy ? '' : 'disabled'}
      >
        Copy
      </button>
      <button
        type="button"
        disabled
        title="Regenerate is not available in the current conversation workflow"
      >
        Regenerate
      </button>
      <button
        type="button"
        data-collapse-citations="mc-citations-${messageIndex}"
        aria-expanded="true"
        ${hasCitations ? '' : 'disabled'}
      >
        Collapse citations
      </button>
      ${canExploreEvidence
        ? `
          <button type="button" data-view-evidence="${esc(message.id)}">
            View Evidence
          </button>
          <button type="button" data-explore-relationships="${esc(message.id)}">
            Explore Relationships
          </button>
          ${message.hits[0]?.documentId
            ? `<button type="button" data-open-source-shortcut="${esc(message.hits[0].documentId)}">Open Source</button>`
            : ''}
          ${message.hits[0]?.documentId
            ? `<button type="button" data-open-version-explorer="${esc(message.hits[0].documentId)}">Explore Versions</button>`
            : ''}
          ${canOpenWorkflow
            ? `<button type="button" data-open-workflow="${esc(message.id)}">Open Workflow</button>`
            : ''}
        `
        : ''}
    </div>
  `;
}

function renderEvidenceVersionNotice(message, lineageModel) {
  const hits = Array.isArray(message.hits) ? message.hits : [];
  const previousEvidence = hits.map(hit => ({
    hit,
    lineage: lineageForDocument(lineageModel, hit.documentId)
  })).filter(item =>
    ['superseded', 'duplicate'].includes(item.lineage.record?.status)
  );

  if (!previousEvidence.length) return '';
  const first = previousEvidence[0];
  const currentId = first.lineage.current?.documentId || '';
  return `
    <div class="mc-lineage-evidence-warning" role="note">
      <div>
        <strong>Evidence from previous revision</strong>
        <span>${fmt(previousEvidence.length)} retrieved source${previousEvidence.length === 1 ? '' : 's'} came from a superseded or duplicate record.</span>
      </div>
      <div>
        <button type="button" data-open-version-explorer="${esc(first.hit.documentId)}">Review Version</button>
        ${currentId
          ? `<button type="button" class="subtle" data-open-current-version="${esc(currentId)}">Open Current Version</button>`
          : ''}
      </div>
    </div>
  `;
}

function isMessagesNearBottom() {
  const messages = $('#messages');
  return messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120;
}

function revealLatestMessage(smooth = false) {
  const messages = $('#messages');
  const reduceMotion = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  )?.matches;

  messages.scrollTo({
    top: messages.scrollHeight,
    behavior: smooth && !reduceMotion ? 'smooth' : 'auto'
  });
}

function renderMessages(
  documents = [],
  sections = [],
  { revealLatest = true, smooth = false } = {}
) {
  const chat = state().chat;
  const lineageModel = buildDocumentLineage({ documents, sections });
  const previousScrollTop = $('#messages').scrollTop;

  $('#messages').innerHTML = chat.length
      ? chat.map((message, messageIndex) => `
        <article
          class="message ${message.role} ${message.id === answerNavigationTarget ? 'mc-section-highlight-answer' : ''}"
          ${message.role === 'assistant'
            ? `id="${answerAnchorId(message.id)}" tabindex="-1"`
            : ''}
        >
          ${message.role === 'user'
            ? '<div class="avatar">YOU</div>'
            : `
              <div class="mc-chief-message-avatar">
                <img
                  src="${chiefAssets.idle}"
                  alt=""
                  aria-hidden="true"
                >
              </div>
            `}
          <div>
            <div class="message-meta">
              ${message.role === 'user' ? 'You' : 'Chief · Mission Companion'}
              ${message.mode ? ` · ${modeLabel(message.mode)}` : ''}
            </div>
            <div class="message-text ${message.role === 'assistant' ? 'mc-message-card' : ''}">
              <div class="mc-message-content">
                ${message.role === 'assistant'
                  ? formatMessageContent(message.content)
                  : esc(message.content).replace(/\n/g, '<br>')}
              </div>
              ${message.role === 'assistant'
                ? `
                  ${renderAssistantCitations(message, messageIndex)}
                  ${renderEvidenceVersionNotice(message, lineageModel)}
                  ${renderAssistantToolbar(message, messageIndex)}
                `
                : ''}
            </div>
          </div>
        </article>
      `).join('')
    : `
      <div class="welcome mc-chief-welcome">
        <div class="mc-chief-welcome-portrait">
          <img
            src="${chiefAssets.idle}"
            alt="Chief, the Mission Companion assistant"
          >
        </div>
        <div class="mc-chief-welcome-copy">
        <span>CHIEF · ENGINEERING ADVISOR</span>
        <h3>Chief is ready.</h3>
        <p>
          Ask a question about your project documents.
        </p>
        <ol class="mc-chief-onboarding" aria-label="Getting started">
          <li class="mc-chief-onboarding-step">
            <span>Step 1</span>
            <strong>Add project documents</strong>
          </li>
          <li class="mc-chief-onboarding-step">
            <span>Step 2</span>
            <strong>Inspect extraction</strong>
          </li>
          <li class="mc-chief-onboarding-step">
            <span>Step 3</span>
            <strong>Ask evidence-based questions</strong>
          </li>
        </ol>
        ${renderPromptSuggestions(documents, sections)}
        </div>
      </div>
    `;

  if (revealLatest) {
    revealLatestMessage(smooth);
  } else {
    $('#messages').scrollTop = previousScrollTop;
  }
}

function renderPreparingAnswer(revealLatest) {
  $('#messages').insertAdjacentHTML('beforeend', `
    <article
      class="message assistant mc-message-pending"
      data-pending-answer
      aria-live="polite"
    >
      <div class="mc-chief-message-avatar">
        <img
          src="${chiefAssets.busy}"
          alt=""
          aria-hidden="true"
        >
      </div>
      <div>
        <div class="message-meta">Chief · Mission Companion</div>
        <div class="message-text mc-message-card">
          <div class="mc-message-preparing">
            <span aria-hidden="true"></span>
            <strong>Chief is preparing an answer…</strong>
          </div>
        </div>
      </div>
    </article>
  `);

  if (revealLatest) {
    revealLatestMessage(true);
  }
}

$('#messages').onclick = event => {
  const suggestion = event.target.closest('.mc-prompt-button');

  if (suggestion) {
    if (suggestion.dataset.promptView) {
      show(suggestion.dataset.promptView);
      return;
    }

    if (suggestion.dataset.promptQuestion) {
      $('#prompt').value = suggestion.dataset.promptQuestion;
      resizeComposer();
      $('#prompt').focus();
    }

    return;
  }

  const copyButton = event.target.closest('[data-copy-message]');

  if (copyButton) {
    const message = state().chat.find(item =>
      item.id === copyButton.dataset.copyMessage
    );

    if (message) {
      void copyText(message.content).then(copied => {
        if (!copied) {
          return;
        }

        copyButton.textContent = 'Copied';

        setTimeout(() => {
          if (copyButton.isConnected) {
            copyButton.textContent = 'Copy';
          }
        }, 1400);
      });
    }

    return;
  }

  const collapseButton = event.target.closest('[data-collapse-citations]');

  if (collapseButton) {
    const citations = document.getElementById(
      collapseButton.dataset.collapseCitations
    );

    if (citations) {
      citations.open = !citations.open;
      collapseButton.setAttribute('aria-expanded', String(citations.open));
      collapseButton.textContent = citations.open
        ? 'Collapse citations'
        : 'Expand citations';
    }
    return;
  }

  const evidenceButton = event.target.closest('[data-view-evidence]');

  if (
    evidenceButton &&
    activeRetrievalSession?.messageId === evidenceButton.dataset.viewEvidence
  ) {
    selectedEvidenceId = activeRetrievalSession.evidence[0]?.id || null;
    const evidence = activeRetrievalSession.evidence[0];
    if (evidence?.documentId) void activateEngineeringContext({
      projectId: activeRetrievalSession.project.id,
      libraryId: evidence.libraryId || activeRetrievalSession.library.id,
      documentId: evidence.documentId,
      sectionId: evidence.sectionId,
      evidenceId: evidence.id,
      source: CONTEXT_ACTIVATION_SOURCES.commandDesk
    });
    show('evidence');
  }

  const relationshipButton = event.target.closest('[data-explore-relationships]');

  if (
    relationshipButton &&
    activeRetrievalSession?.messageId === relationshipButton.dataset.exploreRelationships
  ) {
    openRelationshipExplorerFromEvidence(activeRetrievalSession.evidence[0]);
  }

  const versionButton = event.target.closest('[data-open-version-explorer]');
  if (versionButton) {
    openVersionExplorer(versionButton.dataset.openVersionExplorer, activeRetrievalSession?.messageId || '');
    return;
  }

  const engineeringButton = event.target.closest('[data-open-engineering]');
  if (engineeringButton && activeRetrievalSession) {
    const evidence = activeRetrievalSession.evidence[0];
    openEngineeringWorkspace({
      documentId: engineeringButton.dataset.openEngineering,
      sectionId: evidence?.sectionId || '',
      evidenceId: evidence?.id || '',
      libraryId: evidence?.libraryId || '',
      origin: 'chat'
    });
    return;
  }

  const sourceShortcut = event.target.closest('[data-open-source-shortcut]');
  if (sourceShortcut && activeRetrievalSession) {
    selectedDoc = sourceShortcut.dataset.openSourceShortcut;
    show('sources');
    return;
  }

  const workflowButton = event.target.closest('[data-open-workflow]');
  if (workflowButton && activeRetrievalSession?.messageId === workflowButton.dataset.openWorkflow) {
    if (contextBusSnapshot.workflow.status === 'ambiguous') show('workflow');
    else openWorkflowWorkspace(contextBusSnapshot.workflow.workflowType || 'Inspection Preparation', 'chat');
    return;
  }

  const currentVersionButton = event.target.closest('[data-open-current-version]');
  if (currentVersionButton) {
    selectedDoc = currentVersionButton.dataset.openCurrentVersion;
    selectedKnowledgeSection = 'all';
    show('knowledge');
  }
};

$('#messages').addEventListener('toggle', event => {
  const citations = event.target;

  if (!citations.classList?.contains('mc-message-citations')) {
    return;
  }

  const collapseButton = $$('[data-collapse-citations]').find(button =>
    button.dataset.collapseCitations === citations.id
  );

  if (collapseButton) {
    collapseButton.setAttribute('aria-expanded', String(citations.open));
    collapseButton.textContent = citations.open
      ? 'Collapse citations'
      : 'Expand citations';
  }
}, true);

$('#clearChat').onclick = () => {
  engine.createConversation({ projectId: state().activeProject });
  activeRetrievalSession = null;
  selectedEvidenceId = null;
  sourceNavigationTarget = null;
  answerNavigationTarget = null;
  sourceNavigationNotice = '';
  relationshipTarget = null;
  lineageTarget = null;
  revisionTarget = null;
  revisionFilter = 'all';
  selectedRevisionMatch = 0;
  clearActiveContext(CONTEXT_ACTIVATION_SOURCES.newConversation);
  setChiefState('idle');
  refresh();
};

async function ask() {
  const prompt = $('#prompt').value.trim();

  if (!prompt || busy) {
    return;
  }

  busy = true;
  const revealResponse = isMessagesNearBottom();
  setChiefState('busy');
  $('#send').disabled = true;
  $('#send').textContent = 'Analyzing…';
  $('#prompt').disabled = true;
  renderPreparingAnswer(revealResponse);

  try {
    const navigationIntent = classifyEngineeringNavigationIntent(prompt);
    if (navigationIntent.kind === 'exact-drawing-navigation') {
      const [analyses, documents, sections] = await Promise.all([currentGlobalDrawingRegistryAnalyses(prompt), engine.documents(), engine.sections()]);
      const navigation = await navigateExactDrawingCommand(prompt, { analyses, documents, sections, returnTarget: 'chief-answer', projectId: state().activeProject }, async target => {
        const exactTarget = createDrawingTarget({ ...target, origin: 'engineering-locator', returnTarget: 'chief-answer' });
        if (exactTarget.projectId && exactTarget.projectId !== state().activeProject) await selectProjectThroughProductionPath(exactTarget.projectId);
        const targetAnalysis = analyses.find(item => item.drawingSetId === exactTarget.drawingSetId || item.documentId === exactTarget.documentId);
        drawingWorkspace.setPages(targetAnalysis?.sheets || []);
        const workspaceResolution = drawingWorkspace.open(exactTarget, drawingTarget?.pageNumber);
        drawingTarget = createDrawingTarget({ ...exactTarget, pageNumber: workspaceResolution.pageNumber || exactTarget.pageNumber });
        pendingDrawingContext = exactTarget;
        drawingMatchingSheetIds = [exactTarget.sheetId];
        await showMissionControlView('plans');
      });
      logger.info('Drawing registry runtime inspection', latestDrawingRegistryInspection || { activeProjectId: state().activeProject, query: prompt, commandIntent: navigationIntent, diagnosticStatus: 'registry-inspection-unavailable' });
      latestDrawingRegistryInspection = null;
      if (navigation.handled) {
        $('#prompt').value = '';
        resizeComposer();
        setChiefState('success');
        return;
      }
    }
    const retrievalContext = state();
    const project = retrievalContext.projects.find(item =>
      item.id === retrievalContext.activeProject
    );
    const libraries = engine.libraries();
    const library = libraries.find(item =>
      item.id === retrievalContext.activeLibrary
    );
    const message = await engine.ask(
      prompt,
      $('#mode').value
    );
    const documents = await engine.documents();
    const sections = await engine.sections();

    activeRetrievalSession = createRetrievalSession({
      question: prompt,
      timestamp: message.createdAt,
      project,
      library,
      mode: message.mode,
      messageId: message.id,
      hits: message.hits,
      citations: message.citations,
      citationVerification: message.citationVerification,
      retrievalMeta: message.retrievalMeta,
      documents,
      libraries,
      sections
    });
    selectedEvidenceId = activeRetrievalSession.evidence[0]?.id || null;
    const primaryEvidence = activeRetrievalSession.evidence[0];
    if (primaryEvidence?.documentId) {
      await activateEngineeringContext({
        projectId: activeRetrievalSession.project.id,
        libraryId: primaryEvidence.libraryId || activeRetrievalSession.library.id,
        documentId: primaryEvidence.documentId,
        sectionId: primaryEvidence.sectionId,
        evidenceId: primaryEvidence.id,
        source: CONTEXT_ACTIVATION_SOURCES.commandDesk
      });
    } else {
      clearActiveContext(CONTEXT_ACTIVATION_SOURCES.commandDesk, activeRetrievalSession.project.id);
    }

    $('#prompt').value = '';
    resizeComposer();

    renderMessages(documents, sections, {
      revealLatest: revealResponse,
      smooth: revealResponse
    });

    renderEvidence(
      message.hits,
      message.citations,
      message.citationVerification,
      message.retrievalMeta
    );
    setChiefState('success');
  } catch (error) {
    setChiefState('error');
    $('[data-pending-answer]')?.remove();

    captureError(error, {
      module: 'Conversation',
      action: 'ask'
    });

    alert(error.message);
  } finally {
    busy = false;
    $('#send').disabled = false;
    $('#send').textContent = 'Analyze';
    $('#prompt').disabled = false;
  }
}

$('#send').onclick = ask;

$('#prompt').onkeydown = event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    ask();
  }
};

function resizeComposer() {
  const prompt = $('#prompt');

  prompt.style.height = 'auto';
  prompt.style.height = `${Math.min(prompt.scrollHeight, 200)}px`;
}

$('#prompt').oninput = resizeComposer;
resizeComposer();

function renderEvidence(
  hits = [],
  used = [],
  verification = null,
  meta = {}
) {
  const summary = hits.length
    ? `
      <div class="retrieval-summary">
        <span>${hits.length} sources</span>
        <span>${meta?.totalCandidates || hits.length} candidates</span>
        <span>citation coverage ${verification?.coverage ?? '—'}%</span>
        <span class="${verification?.passed ? 'good-text' : 'warn-text'}">
          ${verification?.passed ? 'citations verified' : 'review citations'}
        </span>
      </div>

      ${(meta?.conflicts || []).length
        ? `
          <div class="conflict-alert">
            <strong>Potential source conflict</strong>
            ${meta.conflicts.map(conflict => `
              <span>
                [S${conflict.sourceA}] ↔ [S${conflict.sourceB}]
                · ${esc(conflict.reason)}
              </span>
            `).join('')}
          </div>
        `
        : ''}
    `
    : '';

  $('#evidenceList').innerHTML = summary + (
    hits.length
      ? hits.map(hit => `
          <article class="evidence-item ${used.includes(hit.sourceNumber) ? 'used' : ''}">
            <div>
              <strong>[S${hit.sourceNumber}] ${esc(hit.heading)}</strong>
              <span>
                ${esc(hit.documentName)}
                · ${esc(hit.location)}
                · score ${hit.score.toFixed(1)}
              </span>
            </div>

            <div class="match-tags">
              ${(hit.matchedTerms || [])
                .slice(0, 6)
                .map(term => `<em>${esc(term)}</em>`)
                .join('')}
            </div>

            <p>
              ${esc(hit.text.slice(0, 320))}
              ${hit.text.length > 320 ? '…' : ''}
            </p>
          </article>
        `).join('')
      : '<div class="empty">No project evidence was retrieved.</div>'
  );
}

function renderEvidenceExplorer() {
  const session = activeRetrievalSession;

  if (!session) {
    $('#evidenceSessionHeader').innerHTML = `
      <div>
        <span>RETRIEVAL TRANSPARENCY</span>
        <h2>No active retrieval session</h2>
        <p>
          Ask Chief a question to inspect the retrieval results for the
          latest successful answer. Retrieval sessions are not persisted.
        </p>
      </div>
    `;
    $('#evidencePipeline').innerHTML = '';
    $('#evidenceExplorerList').innerHTML = `
      <div class="mc-evidence-empty"><strong>No ranked evidence.</strong><span>Ask an evidence-backed question in Command Desk to populate this list.</span></div>
    `;
    $('#evidenceExplorerDetail').innerHTML = `
      <div class="mc-evidence-empty"><strong>No evidence selected.</strong><span>Select a ranked evidence item to inspect its stored source text.</span></div>
    `;
    return;
  }

  const timestamp = new Date(session.timestamp);
  const timestampLabel = Number.isNaN(timestamp.getTime())
    ? session.timestamp
    : timestamp.toLocaleString();
  const verification = session.citationVerification;
  const missingCitations = verification.uncited.length;

  $('#evidenceSessionHeader').innerHTML = `
    <div>
      <span>ACTIVE RETRIEVAL SESSION</span>
      <h2>${esc(session.coverageClassification)}</h2>
      <p>
        Evidence availability only. This classification does not establish
        answer correctness.
      </p>
    </div>
    <dl class="mc-evidence-session-facts">
      <div><dt>Question</dt><dd>${esc(session.question)}</dd></div>
      <div><dt>Retrieved</dt><dd>${esc(timestampLabel)}</dd></div>
      <div><dt>Project</dt><dd>${esc(session.project.name)}</dd></div>
      <div><dt>Library context</dt><dd>${esc(session.library.name)}</dd></div>
      <div><dt>Mode</dt><dd>${esc(modeLabel(session.mode))}</dd></div>
      <div><dt>Retrieval version</dt><dd>${session.retrievalMeta.retrievalVersion ? esc(session.retrievalMeta.retrievalVersion) : 'Unavailable'}</dd></div>
      <div><dt>Citations returned</dt><dd>${session.citationsReturned.length ? session.citationsReturned.map(item => `[S${fmt(item)}]`).join(', ') : 'None'}</dd></div>
    </dl>
    <section class="mc-evidence-citation-health" aria-label="Citation verification">
      <div>
        <span>CITATION COVERAGE</span>
        <strong>${verification.coverage === null ? 'Unavailable' : `${fmt(verification.coverage)}%`}</strong>
      </div>
      <div>
        <span>CITED EVIDENCE</span>
        <strong>${fmt(session.evidenceUsed)}</strong>
      </div>
      <div>
        <span>UNCITED CLAIMS</span>
        <strong>${fmt(missingCitations)}</strong>
      </div>
      <div>
        <span>INVALID CITATIONS</span>
        <strong>${fmt(verification.invalid.length)}</strong>
      </div>
    </section>
    ${missingCitations || verification.invalid.length
      ? `
        <details class="mc-evidence-citation-details">
          <summary>Review citation verification details</summary>
          ${missingCitations
            ? `
              <h3>Material claims without citations</h3>
              <ul>${verification.uncited.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
            `
            : ''}
          ${verification.invalid.length
            ? `
              <h3>Invalid citation references</h3>
              <p>${verification.invalid.map(item => `[S${fmt(item)}]`).join(', ')}</p>
            `
            : ''}
        </details>
      `
      : ''}
  `;

  const pipeline = [
    ['Question', 1, 'Submitted prompt'],
    [
      'Candidate Documents',
      session.candidateDocumentsRepresented,
      'Represented in returned hits'
    ],
    [
      'Candidate Sections',
      session.candidateSections,
      session.retrievalMeta.hierarchyFirst
        ? 'Hierarchy-filtered search scope'
        : 'Search scope'
    ],
    ['Matched Sections', session.matchedSections, 'Positive-scoring candidates'],
    ['Evidence Used', session.evidenceUsed, 'Cited in the answer'],
    ['Final Response', 1, 'Answer returned']
  ];

  $('#evidencePipeline').innerHTML = pipeline.map(([label, count, note], index) => `
    <article>
      <span>${esc(label)}</span>
      <strong>${fmt(count)}</strong>
      <small>${esc(note)}</small>
      ${index < pipeline.length - 1 ? '<b aria-hidden="true">↓</b>' : ''}
    </article>
  `).join('');

  if (
    selectedEvidenceId &&
    !session.evidence.some(item => item.id === selectedEvidenceId)
  ) {
    selectedEvidenceId = null;
  }

  if (!selectedEvidenceId) {
    selectedEvidenceId = session.evidence[0]?.id || null;
  }

  $('#evidenceExplorerList').innerHTML = session.evidence.length
    ? session.evidence.map(item => {
      const actions = sourceNavigationActions(item);
      return `
      <article class="mc-evidence-navigation-item">
        <button
          type="button"
          class="mc-evidence-item ${item.id === selectedEvidenceId ? 'active' : ''}"
          data-evidence-id="${esc(item.id)}"
          ${item.id === selectedEvidenceId ? 'aria-current="true"' : ''}
        >
          <span class="mc-evidence-rank">${fmt(item.order + 1)}</span>
          <span class="mc-evidence-item-copy">
            <strong>[${esc(item.citationReference)}] ${esc(item.heading)}</strong>
            <small>${esc(item.documentName)} · ${esc(item.libraryName)}</small>
            <em>${esc(item.retrievalStatus)}</em>
            <p>${item.excerpt ? esc(item.excerpt) : 'No stored section text is available.'}</p>
          </span>
          <span class="mc-evidence-score">
            ${item.retrievalScore === null ? 'Score unavailable' : `Score ${item.retrievalScore.toFixed(1)}`}
          </span>
        </button>
        ${actions.viewInDocument || actions.openSourceInspector
          ? `
            <div class="mc-evidence-navigation-actions">
              ${actions.viewInDocument
                ? `<button type="button" data-evidence-source="knowledge" data-source-evidence-id="${esc(item.id)}">View in Document</button>`
                : ''}
              ${actions.openSourceInspector
                ? `<button type="button" class="subtle" data-evidence-source="sources" data-source-evidence-id="${esc(item.id)}">Open in Source Inspector</button>`
                : ''}
            </div>
          `
          : ''}
      </article>
    `;
    }).join('')
    : `
      <div class="mc-evidence-empty">
        No supporting evidence was retrieved for the latest question.
      </div>
    `;

  const selected = session.evidence.find(item =>
    item.id === selectedEvidenceId
  );
  const selectedActions = sourceNavigationActions(selected || {});

  $('#evidenceExplorerDetail').innerHTML = selected
    ? `
      <article class="mc-evidence-detail">
        <header>
          <span>${esc(selected.retrievalStatus)}</span>
          <h3>[${esc(selected.citationReference)}] ${esc(selected.heading)}</h3>
          <p>${esc(selected.documentName)} · ${esc(selected.libraryName)}</p>
        </header>
        <dl>
          <div><dt>Section number</dt><dd>${selected.sectionNumber ? esc(selected.sectionNumber) : 'Unavailable'}</dd></div>
          <div><dt>Section title</dt><dd>${selected.sectionTitle ? esc(selected.sectionTitle) : 'Unavailable'}</dd></div>
          <div><dt>Parent heading</dt><dd>${selected.parentHeading ? esc(selected.parentHeading) : 'Unavailable'}</dd></div>
          <div><dt>Hierarchy level</dt><dd>${selected.hierarchyLevel === null ? 'Unavailable' : fmt(selected.hierarchyLevel)}</dd></div>
          <div><dt>Hierarchy path</dt><dd>${selected.hierarchyPath.length ? esc(selected.hierarchyPath.join(' › ')) : 'Unavailable'}</dd></div>
          <div><dt>Location</dt><dd>${selected.location ? esc(selected.location) : 'Unavailable'}</dd></div>
          <div><dt>Document type</dt><dd>${selected.documentMetadata.type ? esc(selected.documentMetadata.type) : 'Unavailable'}</dd></div>
          <div><dt>Document status</dt><dd>${selected.documentMetadata.status ? esc(selected.documentMetadata.status) : 'Unavailable'}</dd></div>
          <div><dt>Retrieval score</dt><dd>${selected.retrievalScore === null ? 'Unavailable' : selected.retrievalScore.toFixed(1)}</dd></div>
          <div><dt>Matched terms</dt><dd>${selected.matchedTerms.length ? esc(selected.matchedTerms.join(', ')) : 'Unavailable'}</dd></div>
          <div><dt>Matched phrases</dt><dd>${selected.matchedPhrases.length ? esc(selected.matchedPhrases.join(', ')) : 'Unavailable'}</dd></div>
          <div><dt>Matched intents</dt><dd>${selected.matchedIntents.length ? esc(selected.matchedIntents.join(', ')) : 'Unavailable'}</dd></div>
          <div><dt>Matched references</dt><dd>${selected.matchedReferences.length ? esc(selected.matchedReferences.join(', ')) : 'Unavailable'}</dd></div>
          <div><dt>Score components</dt><dd>${Object.keys(selected.retrievalComponents).length ? esc(Object.entries(selected.retrievalComponents).map(([name, value]) => `${name}: ${value}`).join(' · ')) : 'Unavailable'}</dd></div>
        </dl>
        <section>
          <h4>Complete stored section text</h4>
          ${selected.fullText
            ? `<pre>${esc(selected.fullText)}</pre>`
            : '<div class="mc-evidence-empty">No stored section text is available.</div>'}
        </section>
        <div class="mc-evidence-detail-actions">
          ${selectedActions.viewInDocument
            ? '<button type="button" data-evidence-navigation="knowledge">View in Document</button>'
            : ''}
          ${selectedActions.openSourceInspector
            ? '<button type="button" data-evidence-navigation="sources" class="subtle">Open in Source Inspector</button>'
            : ''}
          ${selected?.documentId
            ? '<button type="button" data-evidence-relationships class="subtle">Explore Relationships</button>'
            : ''}
          ${selected?.documentId
            ? '<button type="button" data-evidence-engineering class="subtle">Open Engineering Workspace</button>'
            : ''}
          ${session.messageId && state().chat.some(message => message.id === session.messageId)
            ? '<button type="button" data-evidence-back-answer class="subtle">Back to Answer</button>'
            : ''}
        </div>
        ${sourceNavigationNotice
          ? `<div class="mc-source-target-unavailable" role="status">${esc(sourceNavigationNotice)}</div>`
          : ''}
      </article>
    `
    : '<div class="mc-evidence-empty">Select an evidence item to inspect its stored section.</div>';

  $$('[data-evidence-id]').forEach(button => {
    button.onclick = async () => {
      selectedEvidenceId = button.dataset.evidenceId;
      const evidence = session.evidence.find(item => item.id === selectedEvidenceId);
      if (evidence?.documentId) await activateEngineeringContext({
        projectId: session.project.id,
        libraryId: evidence.libraryId || session.library.id,
        documentId: evidence.documentId,
        sectionId: evidence.sectionId,
        evidenceId: evidence.id,
        source: CONTEXT_ACTIVATION_SOURCES.evidence
      });
      renderEvidenceExplorer();
    };
  });

  $$('[data-evidence-navigation]').forEach(button => {
    button.onclick = () => void openEvidenceSource(
      selected,
      button.dataset.evidenceNavigation
    );
  });

  $$('[data-evidence-source]').forEach(button => {
    button.onclick = () => {
      const evidence = session.evidence.find(item =>
        item.id === button.dataset.sourceEvidenceId
      );
      selectedEvidenceId = evidence?.id || selectedEvidenceId;
      void openEvidenceSource(evidence, button.dataset.evidenceSource);
    };
  });

  $('[data-evidence-back-answer]')?.addEventListener(
    'click',
    returnToOriginatingAnswer
  );
  $('[data-evidence-relationships]')?.addEventListener('click', () =>
    openRelationshipExplorerFromEvidence(selected)
  );
  $('[data-evidence-engineering]')?.addEventListener('click', () =>
    openEngineeringWorkspace({ documentId: selected.documentId, sectionId: selected.sectionId, evidenceId: selected.id, libraryId: selected.libraryId, origin: 'evidence' })
  );
}

async function renderRelationshipExplorer() {
  const documents = await engine.documents();
  const sections = await engine.sections();
  const model = buildKnowledgeRelationships({ documents, sections });
  const requestedDocumentId = relationshipTarget?.documentId || selectedDoc;
  const requestedDocument = requestedDocumentId
    ? documents.find(item => item.id === requestedDocumentId) || null
    : null;
  const selectedDocument = requestedDocumentId
    ? requestedDocument
    : documents[0] || null;

  if (!selectedDocument) {
    if (!requestedDocumentId) relationshipTarget = null;
    $('#relationshipHeader').innerHTML = `
      <div><span>CONNECTED KNOWLEDGE</span><h2>No relationship context</h2></div>
      <p>${requestedDocumentId ? 'The selected relationship document is no longer available.' : 'Add and index project documents to inspect explicit relationships.'}</p>
    `;
    $('#relationshipContext').innerHTML = `<div class="mc-relationship-empty">${requestedDocumentId ? 'The exact selected document could not be resolved.' : 'No documents are available.'}</div>`;
    $('#relationshipGraph').innerHTML = '<div class="mc-relationship-empty">A graph appears after an exact document or section establishes Engineering Context.</div>';
    $('#relationshipDetail').innerHTML = '<div class="mc-relationship-empty">Open a Knowledge Object or select evidence to inspect its explicit relationships.</div>';
    return;
  }

  if (!relationshipTarget || relationshipTarget.documentId !== selectedDocument.id) {
    relationshipTarget = {
      ...relationshipNavigationTarget({ documentId: selectedDocument.id }),
      projectId: state().activeProject,
      libraryId: selectedDocument.libraryId,
      originatingMessageId: activeRetrievalSession?.messageId || '',
      evidenceId: selectedEvidenceId || ''
    };
  }

  const context = relationshipContext(model, relationshipTarget);
  if (relationshipTarget.sectionId && !context.section) {
    relationshipTarget = { ...relationshipTarget, sectionId: '' };
  }
  const activeContext = relationshipContext(model, relationshipTarget);
  const graph = buildRelationshipGraph(model, relationshipTarget);
  const documentName = selectedDocument.title || selectedDocument.name;
  const sectionName = activeContext.section
    ? sectionHeadingValue(activeContext.section, sections.indexOf(activeContext.section))
    : 'Document context';
  const libraries = engine.libraries();
  const library = libraries.find(item => item.id === selectedDocument.libraryId);
  const documentById = id => documents.find(item => item.id === id);
  const sectionById = id => sections.find(item => item.id === id);
  const relatedDocumentId = (edge, currentId) => edge.from === currentId ? edge.to : edge.from;
  const selectedDocumentId = selectedDocument.id;
  const references = activeContext.section
    ? activeContext.references
    : model.explicitReferences.filter(edge => edge.sourceDocumentId === selectedDocumentId);
  const referencedBy = activeContext.section
    ? activeContext.referencedBy
    : model.reverseReferences.filter(edge => edge.sourceDocumentId === selectedDocumentId);
  const validation = model.validation;
  const warningItems = [
    ...validation.brokenReferences.map(item => `Broken exact reference ID from section ${item.sectionId}: ${item.referenceId}`),
    ...validation.unresolvedReferences.map(item => `Unresolved section-number reference from ${item.sectionId}: ${item.referenceNumber}`),
    ...validation.ambiguousReferences.map(item => `Ambiguous ${item.kind} reference from ${item.sectionId}: ${item.reference}`),
    ...validation.orphanedHierarchy.map(item => `Orphaned parent link from ${item.sectionId}: ${item.parentId}`),
    ...validation.duplicateReferences.map(item => `Duplicate reference entry on ${item.sectionId}: ${item.reference}`),
    ...validation.duplicateHierarchyEdges.map(item => `Duplicate hierarchy edge: ${item.edge}`),
    ...validation.circularParentChains.map(items => `Circular parent chain: ${items.join(' → ')}`),
    ...validation.circularReferences.map(items => `Circular explicit references: ${items.join(' → ')}`)
  ];
  const relationList = (title, type, edges, labelFor) => `
    <section class="mc-relationship-group">
      <h3>${esc(title)} <span>${fmt(edges.length)}</span></h3>
      ${edges.length
        ? `<ul>${edges.map(edge => {
            const item = labelFor(edge);
            return `<li>
              <button type="button" data-relationship-document="${esc(item.documentId || '')}" data-relationship-section="${esc(item.sectionId || '')}">
                <strong>${esc(item.label)}</strong>
                <small>${esc(type)}${item.detail ? ` · ${esc(item.detail)}` : ''}</small>
              </button>
            </li>`;
          }).join('')}</ul>`
        : '<p>No explicit relationships in this category.</p>'}
    </section>
  `;

  $('#relationshipHeader').innerHTML = `
    <div>
      <span>CONNECTED KNOWLEDGE · READ ONLY</span>
      <h2>${esc(documentName)}</h2>
      <p>${esc(sectionName)} · ${library ? esc(library.name) : 'Library unavailable'}</p>
    </div>
    <nav class="mc-relationship-return" aria-label="Relationship navigation">
      ${activeRetrievalSession && relationshipTarget.originatingMessageId === activeRetrievalSession.messageId
        ? '<button type="button" data-relationship-return-evidence>Back to Evidence Explorer</button>'
        : ''}
      ${relationshipTarget.originatingWorkspace === 'revisions' && revisionTarget
        ? '<button type="button" data-relationship-return-revisions>Back to Revision Review</button>'
        : ''}
      <button type="button" class="subtle" data-relationship-knowledge>Open Knowledge Object</button>
      <button type="button" class="subtle" data-relationship-source>Open Source Inspector</button>
      <button type="button" class="subtle" data-relationship-engineering>Open Engineering Workspace</button>
    </nav>
  `;

  $('#relationshipContext').innerHTML = `
    <dl class="mc-relationship-facts">
      <div><dt>Selected document</dt><dd>${esc(documentName)}</dd></div>
      <div><dt>Selected section</dt><dd>${esc(sectionName)}</dd></div>
      <div><dt>Project</dt><dd>${esc(state().projects.find(item => item.id === state().activeProject)?.name || 'Unavailable')}</dd></div>
      <div><dt>Library</dt><dd>${library ? esc(library.name) : 'Unavailable'}</dd></div>
    </dl>
    ${activeContext.section
      ? `<div class="mc-relationship-selected-section">
          <span>SELECTED SECTION</span>
          <strong>${esc(sectionName)}</strong>
          <small>${Array.isArray(activeContext.section.path) && activeContext.section.path.length ? esc(activeContext.section.path.join(' › ')) : 'Hierarchy path unavailable'}</small>
        </div>`
      : '<div class="mc-relationship-empty">Select a section relationship to center the explorer.</div>'}
    ${warningItems.length
      ? `<div class="mc-relationship-warnings"><strong>Validation warnings</strong><ul>${warningItems.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>`
      : '<div class="mc-relationship-clear">No relationship-integrity warnings were detected.</div>'}
  `;

  const shownNodes = graph.nodes.slice(0, 28);
  const shownIds = new Set(shownNodes.map(node => node.id));
  const shownEdges = graph.edges.filter(edge => shownIds.has(edge.from) && shownIds.has(edge.to));
  const nodePositions = new Map(shownNodes.map((node, index) => {
    const column = node.type === 'Document' ? 0 : 1;
    const peers = shownNodes.filter(item => item.type === node.type);
    const peerIndex = peers.findIndex(item => item.id === node.id);
    return [node.id, {
      x: column ? 430 : 90,
      y: 45 + peerIndex * Math.max(42, Math.min(72, 460 / Math.max(1, peers.length)))
    }];
  }));
  const graphHeight = Math.max(230, ...[...nodePositions.values()].map(point => point.y + 45));
  $('#relationshipGraph').innerHTML = graph.nodes.length
    ? `
      <p class="mc-relationship-graph-note">Position shows document and section type only. It does not represent semantic similarity.</p>
      <svg viewBox="0 0 720 ${graphHeight}" role="img" aria-labelledby="relationshipGraphSvgTitle relationshipGraphSvgDesc">
        <title id="relationshipGraphSvgTitle">Explicit relationship graph for ${esc(documentName)}</title>
        <desc id="relationshipGraphSvgDesc">${esc(shownEdges.map(edge => `${edge.type}: ${edge.from} to ${edge.to}`).join('. '))}</desc>
        ${shownEdges.map(edge => {
          const from = nodePositions.get(edge.from);
          const to = nodePositions.get(edge.to);
          return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="mc-relationship-edge ${esc(edge.type.toLowerCase().replace(/\s+/g, '-'))}"><title>${esc(edge.type)}</title></line>`;
        }).join('')}
        ${shownNodes.map(node => {
          const point = nodePositions.get(node.id);
          return `<g class="mc-relationship-node ${node.type.toLowerCase()}" transform="translate(${point.x} ${point.y})"><rect x="-72" y="-17" width="144" height="34" rx="7"></rect><text text-anchor="middle" y="3">${esc(node.label.slice(0, 24))}</text><title>${esc(node.type)}: ${esc(node.label)}</title></g>`;
        }).join('')}
      </svg>
      ${graph.nodes.length > shownNodes.length ? `<p class="mc-relationship-graph-note">Showing ${fmt(shownNodes.length)} of ${fmt(graph.nodes.length)} nodes for readability.</p>` : ''}
      <details class="mc-relationship-text-alternative"><summary>Relationship list</summary><ul>${graph.textAlternative.map(item => `<li>${esc(item)}</li>`).join('')}</ul></details>
    `
    : '<div class="mc-relationship-empty">No graph relationships are available for this document.</div>';

  const parentEdges = activeContext.parent ? [{ item: activeContext.parent }] : [];
  const childEdges = activeContext.children.map(item => ({ item }));
  $('#relationshipDetail').innerHTML = [
    relationList('Parent', 'Hierarchy', parentEdges, edge => ({
      label: sectionHeadingValue(edge.item), documentId: edge.item.documentId, sectionId: edge.item.id
    })),
    relationList('Children', 'Hierarchy', childEdges, edge => ({
      label: sectionHeadingValue(edge.item), documentId: edge.item.documentId, sectionId: edge.item.id
    })),
    relationList('Explicit references', 'Explicit reference', references, edge => {
      const target = sectionById(edge.targetSectionId);
      return { label: target ? sectionHeadingValue(target) : edge.targetSectionId, documentId: edge.targetDocumentId, sectionId: edge.targetSectionId, detail: edge.sourceKind };
    }),
    relationList('Referenced by', 'Reverse reference', referencedBy, edge => {
      const target = sectionById(edge.targetSectionId);
      return { label: target ? sectionHeadingValue(target) : edge.targetSectionId, documentId: edge.targetDocumentId, sectionId: edge.targetSectionId };
    }),
    relationList('Referenced documents', 'Explicit reference', activeContext.referencedDocuments, edge => {
      const target = documentById(edge.to);
      return { label: target?.title || target?.name || edge.to, documentId: edge.to, sectionId: edge.targetSectionId };
    }),
    relationList('Related documents', 'Explicit reference', activeContext.relatedDocuments, edge => {
      const id = relatedDocumentId(edge, selectedDocumentId);
      const target = documentById(id);
      return { label: target?.title || target?.name || id, documentId: id };
    }),
    relationList('Same division', 'Same division', activeContext.sameDivision, edge => {
      const id = relatedDocumentId(edge, selectedDocumentId);
      const target = documentById(id);
      return { label: target?.title || target?.name || id, documentId: id, detail: edge.divisions.join(', ') };
    }),
    relationList('Same library', 'Same library', activeContext.sameLibrary, edge => {
      const id = relatedDocumentId(edge, selectedDocumentId);
      const target = documentById(id);
      return { label: target?.title || target?.name || id, documentId: id };
    })
  ].join('');

  $$('[data-relationship-document]').forEach(button => {
    button.onclick = () => {
      const documentId = button.dataset.relationshipDocument;
      if (!documents.some(item => item.id === documentId)) return;
      relationshipTarget = {
        ...relationshipTarget,
        documentId,
        sectionId: button.dataset.relationshipSection || '',
        libraryId: documentById(documentId)?.libraryId || ''
      };
      selectedDoc = documentId;
      renderRelationshipExplorer();
    };
  });
  $('[data-relationship-return-evidence]')?.addEventListener('click', returnToEvidenceExplorer);
  $('[data-relationship-return-revisions]')?.addEventListener('click', returnToRevisionReview);
  $('[data-relationship-knowledge]')?.addEventListener('click', () => openRelationshipSource('knowledge'));
  $('[data-relationship-source]')?.addEventListener('click', () => openRelationshipSource('sources'));
  $('[data-relationship-engineering]')?.addEventListener('click', () =>
    openEngineeringWorkspace({ documentId: selectedDocument.id, sectionId: activeContext.section?.id || '', libraryId: selectedDocument.libraryId, origin: 'relationships' })
  );
}

async function renderVersionExplorer() {
  const documents = await engine.documents();
  const sections = await engine.sections();
  const model = buildDocumentLineage({ documents, sections });
  const requestedId = lineageTarget?.documentId || selectedDoc;
  const selected = requestedId
    ? documents.find(document => document.id === requestedId) || null
    : documents[0] || null;

  if (!selected) {
    $('#lineageHeader').innerHTML = `
      <div><span>DOCUMENT HISTORY · READ ONLY</span><h2>${requestedId ? 'Selected version unavailable' : 'No document versions available'}</h2></div>
      <p>${requestedId ? 'The exact document record no longer exists.' : 'Add and index a document to begin recording explicit lineage.'}</p>
    `;
    $('#lineageCurrent').innerHTML = '<div class="mc-lineage-empty">Select a Knowledge Object to inspect its current-version status.</div>';
    $('#lineageHistory').innerHTML = '<div class="mc-lineage-empty">An explicit version chain appears when the selected document contains lineage records.</div>';
    $('#lineageChanges').innerHTML = '<div class="mc-lineage-empty">Select a document with an explicit previous version to compare revisions.</div>';
    return;
  }

  if (!lineageTarget || lineageTarget.documentId !== selected.id) {
    lineageTarget = {
      ...lineageNavigationTarget(selected.id),
      originatingMessageId: '',
      originatingWorkspace: view
    };
  }
  const selectedLineage = lineageForDocument(model, selected.id);
  const chain = selectedLineage.chain;
  const record = selectedLineage.record;
  const currentRecord = selectedLineage.current;
  const selectedName = selected.title || selected.name;
  const currentDocument = currentRecord?.document || null;
  const selectedComparison = chain?.comparisons.find(comparison =>
    comparison.currentDocumentId === selected.id ||
    comparison.previousDocumentId === selected.id
  ) || null;
  const exactDuplicateGroups = model.detectedDuplicates.filter(group =>
    group.documentIds.includes(selected.id)
  );
  const relevantBroken = model.validation.brokenLineage.filter(item =>
    item.documentId === selected.id || item.targetId === selected.id
  );
  const exactPrevious = documents.find(document =>
    document.id === (selected.previousDocumentId || selected.metadata?.previousDocumentId)
  ) || null;
  const comparablePrevious = exactPrevious && revisionPairStatus(
    exactPrevious,
    selected,
    documents
  ).comparable;
  const dateLabel = value => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Unavailable';
  };
  const comparisonValue = value =>
    value === null || value === undefined || value === ''
      ? 'Unavailable'
      : String(value);
  const versionCard = (item, label) => {
    const document = item.document;
    return `
      <button type="button" class="mc-lineage-version ${document.id === selected.id ? 'active' : ''}" data-lineage-document="${esc(document.id)}" ${document.id === selected.id ? 'aria-current="true"' : ''}>
        <span>${esc(label)}</span>
        <strong>${esc(document.title || document.name)}</strong>
        <small>${esc(item.status)} · ${esc(dateLabel(document.importedAt || document.indexedAt))}</small>
      </button>
    `;
  };

  $('#lineageHeader').innerHTML = `
    <div>
      <span>DOCUMENT HISTORY · READ ONLY</span>
      <h2>${esc(selectedName)}</h2>
      <p>Lineage status: ${esc(record?.status || 'unknown')} · Document ID: ${esc(selected.id)}</p>
    </div>
    <nav class="mc-lineage-actions" aria-label="Version navigation">
      ${comparablePrevious
        ? '<button type="button" data-lineage-compare>Compare with Previous Version</button>'
        : ''}
      <button type="button" data-lineage-knowledge>Open Knowledge Object</button>
      <button type="button" class="subtle" data-lineage-engineering>Open Engineering Workspace</button>
      <button type="button" class="subtle" data-lineage-source>Open Source Inspector</button>
      ${lineageTarget.originatingMessageId && state().chat.some(message => message.id === lineageTarget.originatingMessageId)
        ? '<button type="button" class="subtle" data-lineage-answer>Back to Answer</button>'
        : ''}
    </nav>
  `;

  $('#lineageCurrent').innerHTML = currentRecord
    ? `
      <article class="mc-lineage-current-card">
        <span>CURRENT</span>
        <h3>${esc(currentDocument.title || currentDocument.name)}</h3>
        <dl>
          <div><dt>Document ID</dt><dd>${esc(currentDocument.id)}</dd></div>
          <div><dt>Lineage ID</dt><dd>${esc(currentRecord.lineageId)}</dd></div>
          <div><dt>Imported</dt><dd>${esc(dateLabel(currentDocument.importedAt))}</dd></div>
          <div><dt>Indexed</dt><dd>${esc(dateLabel(currentDocument.indexedAt))}</dd></div>
          <div><dt>Sections</dt><dd>${fmt(currentDocument.sectionCount)}</dd></div>
          <div><dt>Characters</dt><dd>${fmt(currentDocument.characterCount)}</dd></div>
        </dl>
        ${currentDocument.id !== selected.id ? `<button type="button" data-lineage-document="${esc(currentDocument.id)}">Select Current Version</button>` : ''}
      </article>
    `
    : `
      <div class="mc-lineage-unknown">
        <strong>Current version unknown</strong>
        <p>No explicit current lineage record is available. Mission Companion will not infer one from dates or filenames.</p>
      </div>
    `;

  const previousRecords = chain?.previous || [];
  const duplicateRecords = chain?.duplicates || [];
  const unknownRecords = chain?.unknown || [];
  $('#lineageHistory').innerHTML = `
    <section class="mc-lineage-group">
      <h3>Previous Versions <span>${fmt(previousRecords.length)}</span></h3>
      ${previousRecords.length ? previousRecords.map(item => versionCard(item, 'SUPERSEDED')).join('') : '<p>No explicit previous versions.</p>'}
    </section>
    <section class="mc-lineage-group">
      <h3>Duplicates <span>${fmt(duplicateRecords.length)}</span></h3>
      ${duplicateRecords.length ? duplicateRecords.map(item => versionCard(item, 'DUPLICATE')).join('') : '<p>No explicitly linked duplicate imports.</p>'}
      ${exactDuplicateGroups.length ? `<div class="mc-lineage-fingerprint"><strong>Exact stored fingerprint matches</strong><ul>${exactDuplicateGroups.map(group => `<li>${group.documentIds.map(esc).join(' · ')}</li>`).join('')}</ul></div>` : ''}
    </section>
    <section class="mc-lineage-group">
      <h3>Unknown <span>${fmt(unknownRecords.length)}</span></h3>
      ${unknownRecords.length ? unknownRecords.map(item => versionCard(item, 'UNKNOWN')).join('') : '<p>No unknown records in this explicit family.</p>'}
    </section>
  `;

  $('#lineageChanges').innerHTML = `
    <section class="mc-lineage-comparison">
      <h3>Extraction Changes</h3>
      ${selectedComparison
        ? `<ul>${selectedComparison.changes.filter(item => item.category === 'Extraction').map(item => `<li class="${item.changed ? 'changed' : ''}"><strong>${esc(item.field)}</strong><span>${esc(comparisonValue(item.before))} → ${esc(comparisonValue(item.after))}</span></li>`).join('')}</ul>`
        : '<p>No explicit adjacent version is available for comparison.</p>'}
    </section>
    <section class="mc-lineage-comparison">
      <h3>Relationship Changes</h3>
      ${selectedComparison
        ? `<ul>${selectedComparison.changes.filter(item => item.category === 'Relationships').map(item => `<li class="${item.changed ? 'changed' : ''}"><strong>${esc(item.field)}</strong><span>${esc(comparisonValue(item.before))} → ${esc(comparisonValue(item.after))}</span></li>`).join('')}</ul>`
        : '<p>No explicit adjacent version is available for comparison.</p>'}
    </section>
    <section class="mc-lineage-warnings">
      <h3>Warnings</h3>
      ${relevantBroken.length || model.validation.circularPreviousLinks.length || model.validation.ambiguousCurrentFamilies.some(item => item.lineageId === record?.lineageId)
        ? `<ul>
            ${relevantBroken.map(item => `<li>Broken ${esc(item.field)} link from ${esc(item.documentId)} to ${esc(item.targetId)}.</li>`).join('')}
            ${model.validation.circularPreviousLinks.map(cycle => `<li>Circular previous-version chain: ${esc(cycle.join(' → '))}</li>`).join('')}
            ${model.validation.ambiguousCurrentFamilies.filter(item => item.lineageId === record?.lineageId).map(item => `<li>Multiple records are explicitly marked current: ${esc(item.documentIds.join(', '))}. No current version was selected.</li>`).join('')}
          </ul>`
        : '<p>No deterministic lineage warnings were detected for this document.</p>'}
    </section>
  `;

  $$('[data-lineage-document]').forEach(button => {
    button.onclick = async () => {
      const documentId = button.dataset.lineageDocument;
      const document = documents.find(item => item.id === documentId);
      if (!document) return;
      lineageTarget = { ...lineageTarget, documentId };
      selectedDoc = documentId;
      await activateEngineeringContext({ projectId: state().activeProject, libraryId: document.libraryId, documentId, lineageId: document.lineageId, source: CONTEXT_ACTIVATION_SOURCES.versionDocument });
      renderVersionExplorer();
    };
  });
  $('[data-lineage-knowledge]')?.addEventListener('click', () => {
    selectedDoc = selected.id;
    selectedKnowledgeSection = 'all';
    show('knowledge');
  });
  $('[data-lineage-source]')?.addEventListener('click', () => {
    selectedDoc = selected.id;
    show('sources');
  });
  $('[data-lineage-answer]')?.addEventListener('click', returnToOriginatingAnswer);
  $('[data-lineage-engineering]')?.addEventListener('click', () =>
    openEngineeringWorkspace({ documentId: selected.id, libraryId: selected.libraryId, origin: 'versions' })
  );
  $('[data-lineage-compare]')?.addEventListener('click', () =>
    openRevisionReview(exactPrevious.id, selected.id)
  );
}

async function renderRevisionReview() {
  const documents = await engine.documents();
  const sections = await engine.sections();
  const earlier = documents.find(document => document.id === revisionTarget?.earlierDocumentId) || null;
  const later = documents.find(document => document.id === revisionTarget?.laterDocumentId) || null;
  const comparison = compareRevisions({
    earlierDocument: earlier,
    laterDocument: later,
    documents,
    sections
  });
  const documentName = document => document?.title || document?.name || document?.id || 'Unavailable';
  const filterOptions = [
    ['all', 'All'], ['unchanged', 'Unchanged'], ['added', 'Added'], ['removed', 'Removed'],
    ['content-changed', 'Content'], ['structurally-changed', 'Structure'],
    ['reference-changed', 'References'], ['extraction-changed', 'Extraction'],
    ['ambiguous', 'Ambiguous'], ['unmatched', 'Unmatched']
  ];

  $('#revisionHeader').innerHTML = `
    <div>
      <span>EXPLICIT LINEAGE · READ ONLY</span>
      <h2>${comparison.comparable ? `${esc(documentName(earlier))} → ${esc(documentName(later))}` : 'Revision pair not comparable'}</h2>
      <p>${comparison.comparable
        ? `Lineage ${esc(comparison.lineageId)} · Exact previousDocumentId relationship`
        : esc(comparison.reasons.join(' '))}</p>
    </div>
    <nav class="mc-revision-actions" aria-label="Revision review navigation">
      <button type="button" data-revision-version>Back to Version Explorer</button>
      ${comparison.comparable ? `
        <button type="button" class="subtle" data-revision-object="earlier">Earlier Knowledge Object</button>
        <button type="button" class="subtle" data-revision-object="later">Later Knowledge Object</button>
        <button type="button" class="subtle" data-revision-relationships>Relationship Explorer</button>
        <button type="button" class="subtle" data-revision-engineering>Engineering Workspace</button>
      ` : ''}
    </nav>
  `;

  if (!comparison.comparable) {
    $('#revisionSummary').innerHTML = '';
    $('#revisionFilters').innerHTML = '';
    $('#revisionList').innerHTML = '<div class="mc-revision-empty">Mission Companion compares only exact adjacent records in one explicit lineage.</div>';
    $('#revisionDetail').innerHTML = '<div class="mc-revision-empty">No section comparison is available.</div>';
    $('#revisionWarnings').innerHTML = `<ul class="mc-revision-warning-list">${comparison.reasons.map(reason => `<li>${esc(reason)}</li>`).join('')}</ul>`;
    $('[data-revision-version]')?.addEventListener('click', () => {
      if (later?.id) openVersionExplorer(later.id);
      else show('versions');
    });
    return;
  }

  const summaryItems = [
    ['Unchanged', comparison.summary.unchanged], ['Added', comparison.summary.added],
    ['Removed', comparison.summary.removed], ['Content', comparison.summary.contentChanged],
    ['Structure', comparison.summary.structurallyChanged], ['References', comparison.summary.referenceChanged],
    ['Extraction', comparison.summary.extractionChanged], ['Ambiguous', comparison.summary.ambiguous],
    ['Unmatched', comparison.summary.unmatched]
  ];
  $('#revisionSummary').innerHTML = summaryItems.map(([label, count]) => `
    <article><span>${esc(label)}</span><strong>${fmt(count)}</strong></article>
  `).join('');
  $('#revisionFilters').innerHTML = filterOptions.map(([key, label]) => `
    <button type="button" data-revision-filter="${key}" class="${revisionFilter === key ? 'active' : ''}" aria-pressed="${revisionFilter === key}">${esc(label)}</button>
  `).join('');

  const visibleMatch = match => revisionFilter === 'all' || match.flags.includes(revisionFilter);
  const visibleSingle = flags => revisionFilter === 'all' || flags.includes(revisionFilter);
  const matchRows = comparison.matches.map((match, index) => ({ match, index })).filter(({ match }) => visibleMatch(match));
  const addedRows = comparison.added.filter(item => visibleSingle(item.flags));
  const removedRows = comparison.removed.filter(item => visibleSingle(item.flags));
  const ambiguousRows = comparison.ambiguous.filter(() => revisionFilter === 'all' || revisionFilter === 'ambiguous');
  const selected = comparison.matches[selectedRevisionMatch] || comparison.matches[0] || null;
  if (!comparison.matches[selectedRevisionMatch] && comparison.matches.length) selectedRevisionMatch = 0;
  const sectionLabel = (section, index = 0) => sectionHeadingValue(section, index) || section.sectionNumber || section.id || 'Untitled section';
  const flagLabel = flag => ({
    unchanged: 'Unchanged', 'content-changed': 'Content changed', 'structurally-changed': 'Structure changed',
    'reference-changed': 'References changed', 'extraction-changed': 'Extraction changed'
  }[flag] || flag);
  $('#revisionList').innerHTML = `
    <div class="mc-revision-list">
      ${matchRows.map(({ match, index }) => `
        <button type="button" data-revision-match="${index}" class="${index === selectedRevisionMatch ? 'active' : ''}" ${index === selectedRevisionMatch ? 'aria-current="true"' : ''}>
          <span>${match.flags.map(flag => `<em>${esc(flagLabel(flag))}</em>`).join('')}</span>
          <strong>${esc(sectionLabel(match.earlier, index))}</strong>
          <small class="mc-revision-match-rule">${esc(revisionMatchRuleLabel(match.matchRule))}</small>
        </button>
      `).join('')}
      ${addedRows.map((item, index) => `<article class="mc-revision-single added"><span>ADDED · UNMATCHED</span><strong>${esc(sectionLabel(item.section, index))}</strong><small>${esc(item.sectionId || 'No section ID')}</small></article>`).join('')}
      ${removedRows.map((item, index) => `<article class="mc-revision-single removed"><span>REMOVED · UNMATCHED</span><strong>${esc(sectionLabel(item.section, index))}</strong><small>${esc(item.sectionId || 'No section ID')}</small></article>`).join('')}
      ${ambiguousRows.map(item => `<article class="mc-revision-single ambiguous"><span>AMBIGUOUS · ${esc(item.rule)}</span><strong>${esc(item.key)}</strong><small>Earlier: ${esc(item.earlierSectionIds.join(', '))} · Later: ${esc(item.laterSectionIds.join(', '))}</small></article>`).join('')}
      ${!matchRows.length && !addedRows.length && !removedRows.length && !ambiguousRows.length ? '<div class="mc-revision-empty">No section records match this filter.</div>' : ''}
    </div>
  `;

  const differences = (items, empty) => items.length
    ? `<ul class="mc-revision-differences">${items.map(item => `<li><strong>${esc(item.field)}</strong><span>${esc(Array.isArray(item.before) ? item.before.join(', ') : item.before ?? 'Unavailable')} → ${esc(Array.isArray(item.after) ? item.after.join(', ') : item.after ?? 'Unavailable')}</span></li>`).join('')}</ul>`
    : `<p class="mc-revision-no-change">${esc(empty)}</p>`;
  if (!selected) {
    $('#revisionDetail').innerHTML = '<div class="mc-revision-empty">No deterministically matched section is available for side-by-side review.</div>';
  } else {
    const referenceItems = [
      ...(selected.referenceDifferences.crossReferences.changed ? [{ field: 'Cross references', before: selected.referenceDifferences.crossReferences.removed, after: selected.referenceDifferences.crossReferences.added }] : []),
      ...(selected.referenceDifferences.crossReferenceIds.changed ? [{ field: 'Cross-reference IDs', before: selected.referenceDifferences.crossReferenceIds.removed, after: selected.referenceDifferences.crossReferenceIds.added }] : [])
    ];
    $('#revisionDetail').innerHTML = `
      <div class="mc-revision-basis"><strong>Comparison basis</strong><span><b class="mc-revision-match-rule">${esc(revisionMatchRuleLabel(selected.matchRule))}</b> · Earlier ID ${esc(selected.earlierSectionId || 'Unavailable')} · Later ID ${esc(selected.laterSectionId || 'Unavailable')}</span></div>
      <div class="mc-revision-side-by-side">
        <article><header><span>EARLIER REVISION</span><h3>${esc(sectionLabel(selected.earlier))}</h3></header><pre>${esc(selected.content.earlierText)}</pre><button type="button" data-revision-source="earlier">Open in Source Inspector</button></article>
        <article><header><span>LATER REVISION</span><h3>${esc(sectionLabel(selected.later))}</h3></header><pre>${esc(selected.content.laterText)}</pre><button type="button" data-revision-source="later">Open in Source Inspector</button></article>
      </div>
      <section class="mc-revision-difference-group"><h3>Metadata and Structure</h3>${differences(selected.structuralDifferences, 'No objective structural differences.')}</section>
      <section class="mc-revision-difference-group"><h3>References</h3>${differences(referenceItems, 'No exact reference differences.')}</section>
      <section class="mc-revision-difference-group"><h3>Extraction</h3>${differences(selected.extractionDifferences, 'No extraction-field differences.')}</section>
    `;
  }
  $('#revisionWarnings').innerHTML = comparison.integrityWarnings.length
    ? `<ul class="mc-revision-warning-list">${comparison.integrityWarnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
    : '<div class="mc-revision-clear"><strong>No comparison integrity warnings</strong><span>All displayed pairs were resolved by exact deterministic rules.</span></div>';

  $$('[data-revision-filter]').forEach(button => button.onclick = () => {
    revisionFilter = button.dataset.revisionFilter;
    renderRevisionReview();
  });
  $$('[data-revision-match]').forEach(button => button.onclick = () => {
    selectedRevisionMatch = Number(button.dataset.revisionMatch);
    renderRevisionReview();
  });
  const openObject = side => {
    const document = side === 'earlier' ? earlier : later;
    const matchSection = comparison.matches[selectedRevisionMatch]?.[side];
    selectedDoc = document.id;
    selectedKnowledgeSection = 'all';
    sourceNavigationTarget = createSourceTarget({
      projectId: state().activeProject,
      libraryId: document.libraryId,
      documentId: document.id,
      sectionId: matchSection?.id || '',
      originatingWorkspace: 'revisions',
      destination: 'knowledge'
    });
    show('knowledge');
  };
  $$('[data-revision-object]').forEach(button => button.onclick = () => openObject(button.dataset.revisionObject));
  $$('[data-revision-source]').forEach(button => button.onclick = () => {
    const side = button.dataset.revisionSource;
    const document = side === 'earlier' ? earlier : later;
    const matchSection = comparison.matches[selectedRevisionMatch]?.[side];
    if (!matchSection?.id) return;
    selectedDoc = document.id;
    sourceNavigationTarget = createSourceTarget({
      projectId: state().activeProject,
      libraryId: document.libraryId,
      documentId: document.id,
      sectionId: matchSection.id,
      originatingWorkspace: 'revisions',
      destination: 'sources'
    });
    show('sources');
  });
  $('[data-revision-relationships]')?.addEventListener('click', () => {
    relationshipTarget = {
      ...relationshipNavigationTarget({ documentId: later.id, sectionId: selected?.later?.id || '' }),
      projectId: state().activeProject,
      libraryId: later.libraryId,
      originatingWorkspace: 'revisions'
    };
    selectedDoc = later.id;
    show('relationships');
  });
  $('[data-revision-engineering]')?.addEventListener('click', () =>
    openEngineeringWorkspace({ documentId: later.id, sectionId: selected?.later?.id || '', libraryId: later.libraryId, origin: 'revisions' })
  );
  $('[data-revision-version]')?.addEventListener('click', () => {
    lineageTarget = { ...lineageNavigationTarget(later.id), originatingWorkspace: 'revisions' };
    selectedDoc = later.id;
    show('versions');
  });
}

async function renderEngineeringWorkspace() {
  const currentState = state();
  const documents = await engine.documents();
  const sections = await engine.sections();
  const target = activeContextActivation;
  const context = target ? createEngineeringContext({
    ...target,
    projects: currentState.projects,
    documents,
    sections,
    retrievalSession: activeRetrievalSession
  }) : null;
  const documentById = id => documents.find(item => item.id === id);
  const sectionById = id => sections.find(item => item.id === id);
  const labelDocument = id => documentById(id)?.title || documentById(id)?.name || id;
  const labelSection = id => sectionHeadingValue(sectionById(id)) || id;
  const targetOrigin = target ? activationOrigin(target.source) : '';
  const originValid = target && ({
    chat: Boolean(activeRetrievalSession?.messageId && activeRetrievalSession.evidence.some(item => item.documentId === target.documentId)),
    evidence: Boolean(activeRetrievalSession?.evidence.some(item => item.documentId === target.documentId)),
    relationships: relationshipTarget?.documentId === target.documentId,
    knowledge: selectedDoc === target.documentId,
    versions: lineageTarget?.documentId === target.documentId,
    revisions: Boolean(revisionTarget && [revisionTarget.earlierDocumentId, revisionTarget.laterDocumentId].includes(target.documentId)),
    inspections: Boolean(selectedInspectionId)
  }[targetOrigin]);

  if (!context) {
    $('#engineeringHeader').innerHTML = '<div><span>ENGINEERING CONTEXT</span><h2>Engineering Context unavailable</h2><p>Open a Knowledge Object or ask an evidence-backed question to synchronize this workbench.</p></div>';
    $('#engineeringContext').innerHTML = `<div class="mc-context-activation-unavailable" role="status"><strong>No construction context selected.</strong><span>${contextClearedEvent ? `Current transition: cleared from ${esc(contextClearedEvent.source)}.` : 'Ask Chief a construction question or open an exact drawing, specification, or project record to synchronize this workspace.'}</span></div>`;
    $('#engineeringKnowledge').innerHTML = '<div class="mc-engineering-empty">Related project knowledge appears after an exact document establishes Engineering Context.</div>';
    $('#engineeringSession').innerHTML = '<div class="mc-engineering-empty">The temporary Inspection Session becomes available with an active Engineering Context.</div>';
    return;
  }
  let session = getInspectionSession();
  if (!session || session.context.projectId !== context.projectId || session.context.documentId !== context.documentId || session.context.sectionId !== context.sectionId) {
    session = startInspectionSession(context, { origin: activationOrigin(target.source) });
  }
  const seedDocument = documentById(context.documentId);
  const seedSection = sectionById(context.sectionId);
  const renderDocuments = (items, empty) => items.length
    ? `<ul>${items.map(item => `<li><strong>${esc(labelDocument(item.documentId))}</strong><span>${item.basis ? `Exact classification: ${esc(item.basis)}` : esc(item.documentId)}</span></li>`).join('')}</ul>`
    : `<div class="mc-engineering-empty">${esc(empty)}</div>`;
  const returnLabel = ({ chat: 'Back to Command Desk', evidence: 'Back to Evidence Explorer', relationships: 'Back to Relationship Explorer', knowledge: 'Back to Knowledge Object', versions: 'Back to Version Explorer', revisions: 'Back to Revision Review', inspections: 'Back to Inspection Records' })[targetOrigin] || '';

  $('#engineeringHeader').innerHTML = `
    <div><span>ENGINEERING CONTEXT</span><h2>${esc(seedDocument.title || seedDocument.name)}</h2><p>Project knowledge synchronized from ${esc(target.source)}.</p></div>
    <nav class="mc-engineering-actions" aria-label="Engineering workspace navigation">
      ${originValid ? `<button type="button" data-engineering-return>${esc(returnLabel)}</button>` : ''}
      <button type="button" class="subtle" data-engineering-object>Open Knowledge Object</button>
      <button type="button" class="subtle" data-engineering-source>Open Source Inspector</button>
      <button type="button" class="subtle" data-engineering-relationships>Relationship Explorer</button>
      <button type="button" class="subtle" data-engineering-versions>Version Explorer</button>
      <button type="button" class="subtle" data-engineering-inspection>Create Inspection Record</button>
      <button type="button" data-engineering-workflow>Open Workflow</button>
    </nav>
  `;
  $('#engineeringContext').innerHTML = `
    <dl class="mc-engineering-facts">
      <div><dt>Active document</dt><dd>${esc(seedDocument.title || seedDocument.name)}</dd></div><div><dt>Active section</dt><dd>${seedSection ? esc(labelSection(seedSection.id)) : 'Unavailable'}</dd></div>
      <div><dt>Related documents</dt><dd>${fmt(context.documentIds.length)}</dd></div><div><dt>Related sections</dt><dd>${fmt(context.sectionIds.length)}</dd></div>
      <div><dt>Building</dt><dd>${context.buildingId ? esc(context.buildingId) : 'Unavailable'}</dd></div><div><dt>Room</dt><dd>${context.roomId ? esc(context.roomId) : 'Unavailable'}</dd></div>
      <div><dt>Discipline</dt><dd>${context.discipline ? esc(context.discipline) : 'Unavailable'}</dd></div><div><dt>Trade</dt><dd>${context.trade ? esc(context.trade) : 'Unavailable'}</dd></div>
    </dl>
    <div class="mc-engineering-status ${context.incomplete ? 'incomplete' : 'complete'}"><strong>${context.incomplete ? 'Engineering Context incomplete' : 'Engineering Context ready'}</strong><span>${context.incomplete ? 'Some related evidence or relationship identifiers are unavailable.' : 'Available project knowledge has been synchronized.'}</span></div>
    ${context.unavailableFields.length ? `<div class="mc-engineering-unavailable"><strong>Unavailable context fields</strong><span>${esc(context.unavailableFields.join(', '))}</span></div>` : ''}
  `;
  const evidence = context.evidence.map(item => activeRetrievalSession?.evidence.find(candidate => candidate.id === item.id)).filter(Boolean);
  const referenced = context.referencedDocumentIds.map(documentId => ({ documentId, basis: '' }));
  const contextualList = items => items.length ? `<ul>${items.map(item => `<li><strong>${esc(labelDocument(item.documentId))}</strong><span>Contextual association only</span></li>`).join('')}</ul>` : '<div class="mc-engineering-empty">None available.</div>';
  $('#engineeringKnowledge').innerHTML = `
    <div class="mc-engineering-groups">
      <section><h3>Explicit Specifications <span>${context.classification.specifications.length}</span></h3>${renderDocuments(context.classification.specifications, 'No exactly classified specifications.')}</section>
      <section><h3>Exact Drawings <span>${context.classification.drawings.length}</span></h3>${renderDocuments(context.classification.drawings, 'No exactly classified drawings.')}</section>
      <section><h3>Exact Procedures <span>${context.classification.procedures.length}</span></h3>${renderDocuments(context.classification.procedures, 'No exactly classified procedures.')}</section>
      <section><h3>Unclassified <span>${context.classification.unclassified.length}</span></h3>${renderDocuments(context.classification.unclassified, 'No unclassified context documents.')}</section>
      <section><h3>Referenced Documents <span>${referenced.length}</span></h3>${renderDocuments(referenced, 'No resolved cross-document references.')}</section>
      <section><h3>Explicit Relationships <span>${context.relationshipIds.length}</span></h3>${context.relationshipIds.length ? `<ul>${context.relationshipIds.map(id => `<li><strong>${esc(id)}</strong></li>`).join('')}</ul>` : '<div class="mc-engineering-empty">No exact hierarchy or reference relationships.</div>'}</section>
      <section><h3>Contextual Same Division <span>${context.contextualSameDivision.length}</span></h3>${contextualList(context.contextualSameDivision)}</section>
      <section><h3>Contextual Same Library <span>${context.contextualSameLibrary.length}</span></h3>${contextualList(context.contextualSameLibrary)}</section>
      <section><h3>Active-Session Evidence <span>${evidence.length}</span></h3>${evidence.length ? `<ul>${evidence.map(item => `<li><strong>${esc(item.citationReference)} · ${esc(item.heading)}</strong><span>${esc(item.documentName)}</span></li>`).join('')}</ul>` : '<div class="mc-engineering-empty">No exact evidence from the active retrieval session.</div>'}</section>
      <section><h3>Version Status</h3><dl class="mc-engineering-mini-facts"><div><dt>Status</dt><dd>${esc(context.lineage.status)}</dd></div><div><dt>Current</dt><dd>${esc(context.lineage.currentDocumentId || 'Unavailable')}</dd></div><div><dt>Previous</dt><dd>${esc(context.lineage.previousDocumentId || 'Unavailable')}</dd></div><div><dt>Duplicates</dt><dd>${context.lineage.duplicateDocumentIds.length}</dd></div></dl></section>
    </div>
  `;
  const requirementItems = [
    ...context.classification.specifications.map(item => `Specification: ${labelDocument(item.documentId)}`),
    ...context.classification.procedures.map(item => `Procedure: ${labelDocument(item.documentId)}`),
    ...context.referencedDocumentIds.map(id => `Referenced document: ${labelDocument(id)}`),
    `Version status: ${context.lineage.status}`,
    ...context.warnings,
    ...context.unavailableFields.map(field => `Unavailable: ${field}`)
  ];
  $('#engineeringSession').innerHTML = `
    <section class="mc-engineering-summary"><h3>Requirements Summary</h3>${requirementItems.length ? `<ul>${requirementItems.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<div class="mc-engineering-empty">No objective requirements summary items are available.</div>'}</section>
    <section class="mc-engineering-notes"><label for="engineeringNotes"><strong>Temporary Inspection Notes</strong><span>Unsaved. Cleared when this context closes or is replaced.</span></label><textarea id="engineeringNotes" rows="8" placeholder="Temporary session notes">${esc(session.notes)}</textarea></section>
    <section class="mc-engineering-warnings"><h3>Context Warnings</h3>${context.warnings.length ? `<ul>${context.warnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<div class="mc-engineering-clear">No explicit context warnings.</div>'}</section>
  `;
  $('#engineeringNotes')?.addEventListener('input', event => updateInspectionNotes(event.target.value));
  $('[data-engineering-return]')?.addEventListener('click', () => show(targetOrigin === 'knowledge' ? 'knowledge' : targetOrigin));
  $('[data-engineering-object]')?.addEventListener('click', () => { selectedDoc = context.documentId; selectedKnowledgeSection = 'all'; show('knowledge'); });
  $('[data-engineering-source]')?.addEventListener('click', () => { selectedDoc = context.documentId; show('sources'); });
  $('[data-engineering-relationships]')?.addEventListener('click', () => { relationshipTarget = { ...relationshipNavigationTarget({ documentId: context.documentId, sectionId: context.sectionId }), projectId: context.projectId, libraryId: context.libraryId, originatingWorkspace: 'engineering' }; show('relationships'); });
  $('[data-engineering-versions]')?.addEventListener('click', () => openVersionExplorer(context.documentId));
  $('[data-engineering-workflow]')?.addEventListener('click', () => {
    if (contextBusSnapshot.workflow.status === 'ambiguous') show('workflow');
    else openWorkflowWorkspace(contextBusSnapshot.workflow.workflowType || 'Inspection Preparation', 'engineering');
  });
  $('[data-engineering-inspection]')?.addEventListener('click', () => openInspectionForm());
}

async function renderWorkflowWorkspace() {
  const inspection = getInspectionSession();
  const context = inspection?.context || null;
  const documents = await engine.documents();
  const sections = await engine.sections();
  const revisions = buildRevisionMetrics({ documents, sections }).comparisons;
  if (contextBusSnapshot.workflow.status === 'ambiguous' && !workflowTarget) {
    $('#workflowHeader').innerHTML = '<div><span>SYNCHRONIZED ORCHESTRATION</span><h2>Select Workflow</h2><p>Multiple deterministic workflow templates qualify. Mission Companion will not guess.</p></div>';
    $('#workflowOverview').innerHTML = `<div class="mc-context-bus-workflow-choice" role="status"><strong>Select Workflow</strong><span>${esc(contextBusSnapshot.workflow.candidates.join(' · '))}</span><label>Workflow Type<select id="workflowType">${contextBusSnapshot.workflow.candidates.map(type => `<option>${esc(type)}</option>`).join('')}</select></label><button type="button" id="selectSynchronizedWorkflow">Load selected workflow</button></div>`;
    $('#workflowResources').innerHTML = '<div class="mc-workflow-empty">Workflow resources will appear after an explicit selection.</div>';
    $('#workflowSession').innerHTML = '<div class="mc-workflow-empty">Temporary notes begin after a workflow is selected.</div>';
    $('#selectSynchronizedWorkflow')?.addEventListener('click', () => {
      workflowTarget = workflowNavigationTarget({ workflowType: $('#workflowType').value, origin: activationOrigin(activeContextActivation.source) });
      renderWorkflowWorkspace();
    });
    return;
  }
  const workflow = createWorkflow({
    workflowType: workflowTarget?.workflowType,
    engineeringContext: context,
    documents,
    sections,
    revisionComparisons: revisions
  });
  const documentLabel = id => documents.find(item => item.id === id)?.title || documents.find(item => item.id === id)?.name || id;
  const sectionLabel = id => sectionHeadingValue(sections.find(item => item.id === id)) || id;
  const evidenceLabel = id => activeRetrievalSession?.evidence.find(item => item.id === id)?.citationReference || id;
  const originValid = workflowTarget && ({
    chat: Boolean(activeRetrievalSession?.messageId),
    engineering: Boolean(engineeringTarget && context),
    knowledge: selectedDoc === context?.documentId
  }[workflowTarget.origin]);

  $('#workflowHeader').innerHTML = `
    <div><span>WORKFLOW</span><h2>${esc(workflow.workflowType || 'Workflow unavailable')}</h2><p>Workflow status describes source availability only; it does not indicate compliance, acceptance, approval, or readiness to build.</p></div>
    <nav class="mc-workflow-actions" aria-label="Workflow navigation">
      ${originValid ? `<button type="button" data-workflow-return>Back to ${esc(workflowTarget.origin === 'chat' ? 'Command Desk' : workflowTarget.origin === 'knowledge' ? 'Knowledge Object' : 'Engineering Workspace')}</button>` : ''}
      ${context ? '<button type="button" class="subtle" data-workflow-engineering>Engineering Workspace</button>' : ''}
      ${workflow.workflowType === 'Inspection Preparation' ? '<button type="button" data-workflow-inspection>Create Inspection Record</button>' : ''}
    </nav>
  `;
  if (workflow.status === 'Unavailable') {
    clearWorkflowSession();
    $('#workflowOverview').innerHTML = '<div class="mc-workflow-empty"><strong>Workflow unavailable.</strong><span>Open a Knowledge Object or ask an evidence-backed question to establish Engineering Context.</span></div>';
    $('#workflowResources').innerHTML = '<div class="mc-workflow-empty">Workflow resources appear after a valid Engineering Context and Workflow are selected.</div>';
    $('#workflowSession').innerHTML = '<div class="mc-workflow-empty">Temporary Workflow Session notes become available when a Workflow loads.</div>';
    return;
  }
  let session = getWorkflowSession();
  if (session?.workflow.workflowId !== workflow.workflowId) session = startWorkflowSession(workflow, { origin: workflowTarget.origin });
  const renderIds = (ids, label, empty) => ids.length
    ? `<ul>${ids.map(id => `<li><strong>${esc(label(id))}</strong><span>${esc(id)}</span></li>`).join('')}</ul>`
    : `<div class="mc-workflow-empty">${esc(empty)}</div>`;
  $('#workflowOverview').innerHTML = `
    <label class="mc-workflow-selector">Workflow Type<select id="workflowType">${WORKFLOW_TYPES.map(type => `<option ${type === workflow.workflowType ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></label>
    <div class="mc-workflow-status ${workflow.status.toLowerCase()}" role="status"><strong>${esc(workflow.status)}</strong><span>${workflow.missingGroups.length ? `${workflow.missingGroups.length} required identifier group(s) unavailable` : 'All template-required identifier groups are available'}</span></div>
    <dl class="mc-workflow-facts"><div><dt>Workflow ID</dt><dd>${esc(workflow.workflowId)}</dd></div><div><dt>Context ID</dt><dd>${esc(workflow.engineeringContextId)}</dd></div><div><dt>Project ID</dt><dd>${esc(workflow.projectId)}</dd></div><div><dt>Seed document</dt><dd>${esc(workflow.seedDocumentId)}</dd></div></dl>
    ${workflow.missingGroups.length ? `<div class="mc-workflow-missing"><strong>Unavailable groups</strong><span>${esc(workflow.missingGroups.join(', '))}</span></div>` : ''}
  `;
  $('#workflowResources').innerHTML = `
    <div class="mc-workflow-groups">
      <section><h3>Required Documents <span>${workflow.requiredDocumentIds.length}</span></h3>${renderIds(workflow.requiredDocumentIds, documentLabel, 'No required document identifiers.')}</section>
      <section><h3>Required Sections <span>${workflow.requiredSectionIds.length}</span></h3>${renderIds(workflow.requiredSectionIds, sectionLabel, 'No required section identifiers.')}</section>
      <section><h3>Evidence <span>${workflow.evidenceIds.length}</span></h3>${renderIds(workflow.evidenceIds, evidenceLabel, 'No exact active-session evidence identifiers.')}</section>
      <section><h3>Relationships <span>${workflow.relationshipIds.length}</span></h3>${renderIds(workflow.relationshipIds, id => id, 'No explicit relationship identifiers.')}</section>
      <section><h3>Version Status <span>${workflow.lineageIds.length}</span></h3>${renderIds(workflow.lineageIds, id => id, 'No explicit lineage identifiers.')}</section>
      <section><h3>Revision Status <span>${workflow.revisionIds.length}</span></h3>${renderIds(workflow.revisionIds, id => id, 'No comparable revision-pair identifiers.')}</section>
    </div>
  `;
  $('#workflowSession').innerHTML = `
    <section class="mc-workflow-warnings"><h3>Warnings</h3>${workflow.warnings.length ? `<ul>${workflow.warnings.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<div class="mc-workflow-clear">No workflow availability warnings.</div>'}</section>
    <section class="mc-workflow-notes"><label for="workflowNotes"><strong>Temporary Workflow Notes</strong><span>Unsaved. Cleared when the workflow or Engineering Context changes.</span></label><textarea id="workflowNotes" rows="9" placeholder="Temporary workflow notes">${esc(session.notes)}</textarea></section>
  `;
  $('#workflowType')?.addEventListener('change', event => {
    workflowTarget = workflowNavigationTarget({ workflowType: event.target.value, origin: workflowTarget.origin });
    clearWorkflowSession();
    renderWorkflowWorkspace();
  });
  $('#workflowNotes')?.addEventListener('input', event => updateWorkflowNotes(event.target.value));
  $('[data-workflow-return]')?.addEventListener('click', () => show(workflowTarget.origin === 'knowledge' ? 'knowledge' : workflowTarget.origin));
  $('[data-workflow-engineering]')?.addEventListener('click', () => show('engineering'));
  $('[data-workflow-inspection]')?.addEventListener('click', () => openInspectionForm());
}

function inspectionLocation(record) {
  return [record.building, record.area, record.room].filter(Boolean).join(' · ') || 'Location unavailable';
}

function inspectionPrefill() {
  const context = getInspectionSession()?.context;
  if (!context || context.projectId !== state().activeProject) return {};
  return {
    projectId: context.projectId,
    building: context.buildingId,
    room: context.roomId,
    trade: context.trade,
    discipline: context.discipline,
    sourceDocumentIds: context.documentIds,
    sourceSectionIds: context.sectionIds,
    relatedDrawingIds: context.classification.drawings.map(item => item.documentId),
    relatedSpecificationIds: context.classification.specifications.map(item => item.documentId),
    relationshipIds: context.relationshipIds,
    versionIds: context.versionIds,
    workflowTemplateId: workflowTarget?.workflowType === 'Inspection Preparation' ? 'Inspection Preparation' : '',
    evidenceReferences: []
  };
}

async function openSpecificationExplorer() {
  console.log("=== SPEC EXPLORER ENTRY ===");
  
  // Always rebuild from the currently selected drawing
  const currentSheetNumber = drawingTarget?.sheetNumber || activeDrawingViewerAnalysis?.sheets?.find(item => item.pageId === drawingTarget?.pageId)?.sheetNumber;
  
  if (!currentSheetNumber) {
    alert('Specification Explorer not available - no active sheet');
    return;
  }
  
  // Get the current sheet from the active drawing analysis
  const currentSheet = activeDrawingViewerAnalysis?.sheets?.find(item => item.sheetNumber === currentSheetNumber);
  
  if (!currentSheet) {
    alert(`Sheet ${currentSheetNumber} not found in current drawing`);
    return;
  }

  // Load the Building 61 spec links mapping
  let specLinks = {};
  try {
    const response = await fetch('project-data/bedford/relationships/building-61-spec-links.json');
    if (response.ok) {
      const data = await response.json();
      specLinks = data.results || {};
    }
  } catch (error) {
    console.warn('Failed to load spec links mapping:', error);
  }

  // Look up specs for the current sheet
  const sheetSpecs = specLinks[currentSheet.sheetNumber];
  
  if (!sheetSpecs || !sheetSpecs.links || sheetSpecs.links.length === 0) {
    alert(`No specification mappings found for sheet ${currentSheet.sheetNumber}`);
    return;
  }

  // Filter to only include sections that exist in the authoritative index
  const validLinks = [];
  for (const link of sheetSpecs.links) {
    const resolveResult = await openSpecificationSection(link.sectionNumber);
    if (resolveResult && resolveResult.ok) {
      validLinks.push(link);
    }
  }

  if (validLinks.length === 0) {
    alert(`No valid specification sections found for sheet ${currentSheet.sheetNumber}. All mapped sections are not in the Bedford specification manual.`);
    return;
  }

  // Create specification explorer modal
  const modal = document.createElement('dialog');
  modal.className = 'mc-specification-explorer-dialog';
  modal.innerHTML = `
    <header>
      <div>
        <span>SPECIFICATION EXPLORER</span>
        <strong>${esc(currentSheet.sheetNumber)}</strong>
      </div>
      <button class="subtle" data-spec-explorer-close aria-label="Close">×</button>
    </header>
    <div class="mc-specification-explorer-content">
      <div class="mc-specification-explorer-info">
        <p><strong>Sheet:</strong> ${esc(currentSheet.sheetNumber)}</p>
        <p><strong>Title:</strong> ${esc(currentSheet.sheetTitle || 'Unknown')}</p>
        <p><strong>Discipline:</strong> ${esc(currentSheet.discipline || 'Unknown')}</p>
        <p><strong>Found:</strong> ${validLinks.length} specification sections</p>
      </div>
      <div class="mc-specification-explorer-results">
        <h3>Governing Specifications</h3>
        <ol>
          ${validLinks.map(link => `
            <li data-spec-section="${esc(link.sectionNumber)}" data-spec-document="${esc(link.specificationDocumentId)}">
              <article>
                <span class="mc-spec-section-number">${esc(link.sectionNumber)}</span>
                <div>
                  <strong>${esc(link.sectionTitle)}</strong>
                  <small>${esc(link.status || 'Unknown status')}</small>
                </div>
                <button data-spec-open>View Source</button>
              </article>
            </li>
          `).join('')}
        </ol>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.showModal();

  // Handle close button
  modal.querySelector('[data-spec-explorer-close]').addEventListener('click', () => {
    modal.close();
    modal.remove();
  });

  // Handle section click
  modal.querySelectorAll('[data-spec-open]').forEach(button => {
    button.addEventListener('click', async () => {
      console.log("=== VIEW SOURCE CLICK ===");
      
      const li = button.closest('li[data-spec-section]');
      const sectionNumber = li.dataset.specSection;
      console.log("sectionNumber:", sectionNumber);

      // Use the authoritative specification resolver
      console.log("Calling openSpecificationDocument...");
      const docResult = await openSpecificationDocument(sectionNumber, engine);
      console.log("docResult:", docResult);
      
      if (!docResult) {
        console.log("docResult is null - returning");
        return; // Error already shown by openSpecificationDocument
      }

      const { source, section } = docResult;
      console.log("source:", Boolean(source));
      console.log("section:", section);
      
      // Close modal
      console.log("Closing modal...");
      modal.close();
      modal.remove();
      console.log("Modal removed");
      
      // Create full-screen viewer FIRST - must always be visible
      console.log("Creating viewer...");
      const viewer = document.createElement('div');
      viewer.className = 'mc-native-spec-viewer';
      viewer.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2147483647;
        background: #111;
        display: flex;
        flex-direction: column;
      `;

      const header = document.createElement('div');
      header.style.cssText = `
        height: 48px;
        flex: 0 0 48px;
        background: #222;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
      `;

      const title = document.createElement('div');
      title.textContent = `Bedford Specifications — ${section.sectionNumber || sectionNumber}`;

      const closeButton = document.createElement('button');
      closeButton.textContent = 'Close';
      closeButton.style.cssText = 'padding: 6px 16px; cursor: pointer; background: #444; color: white; border: 1px solid #555; border-radius: 4px; font-size: 13px;';

      header.appendChild(title);
      header.appendChild(closeButton);

      const iframe = document.createElement('iframe');
      iframe.style.cssText = `
        flex: 1;
        width: 100%;
        min-height: 0;
        border: 0;
        background: white;
      `;

      viewer.appendChild(header);
      viewer.appendChild(iframe);

      console.log("Appending viewer to document.body...");
      document.body.appendChild(viewer);
      console.log("Viewer appended. viewer in DOM:", document.body.contains(viewer));

      // Handle close button
      let blobUrl = null;
      closeButton.addEventListener('click', () => {
        console.log("Close button clicked");
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        viewer.remove();
      });

      // Also close on Escape key
      const escapeHandler = (event) => {
        if (event.key === 'Escape') {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          viewer.remove();
          document.removeEventListener('keydown', escapeHandler);
        }
      };
      document.addEventListener('keydown', escapeHandler);

      // Now load the PDF - if this fails, show error in iframe
      console.log("Loading PDF...");
      if (!source?.sourceBlob) {
        console.log("source.sourceBlob is missing");
        iframe.srcdoc = '<h2 style="font-family:sans-serif;padding:30px">Specification PDF source is unavailable.</h2>';
        return;
      }

      try {
        blobUrl = URL.createObjectURL(source.sourceBlob);
        console.log("blobUrl created:", blobUrl);
        const pdfUrl = `${blobUrl}#page=${Number(section.startPdfPage) || 1}`;
        console.log("Setting iframe.src to:", pdfUrl);
        iframe.src = pdfUrl;
        console.log("iframe.src set");
      } catch (error) {
        console.error("Failed to create blob URL:", error);
        iframe.srcdoc = `<pre style="padding:30px">Failed to load specification PDF: ${String(error.message || error)}</pre>`;
      }
      
      console.log("=== VIEW SOURCE HANDLER COMPLETE ===");
    });
  });

  // Close on backdrop click
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.close();
      modal.remove();
    }
  });
}

async function openInspectionForm(record = null, requestedPrefill = null) {
  const prefill = record || requestedPrefill || inspectionPrefill();
  const context = getInspectionSession()?.context;
  const evidenceCandidates = record ? [] : requestedPrefill?.evidenceReferences?.length ? requestedPrefill.evidenceReferences : (activeRetrievalSession?.evidence || []).filter(item =>
    context && (context.documentIds.includes(item.documentId) || context.sectionIds.includes(item.sectionId))
  ).map(item => ({ documentId: item.documentId, sectionId: item.sectionId }));
  const number = record?.inspectionNumber || await engine.nextInspectionNumber();
  openModal(`
    <form id="inspectionRecordForm" class="mc-inspection-form">
      <h2>${record ? `Edit ${esc(record.inspectionNumber)}` : 'Create Inspection Record'}</h2>
      <p>Conclusions, observations, results, and follow-up decisions are entered deliberately by the inspector.</p>
      <div class="mc-inspection-form-grid">
        <label>Inspection number<input value="${esc(number)}" disabled></label>
        <label>Inspection date<input id="inspectionDate" type="date" value="${esc(record?.inspectionDate || '')}" required></label>
        <label class="wide">Title<input id="inspectionTitle" value="${esc(record?.title || '')}" required></label>
        <label>Inspection type<input id="inspectionType" value="${esc(record?.inspectionType || '')}"></label>
        <label>Inspector name<input id="inspectionInspector" value="${esc(record?.inspectorName || '')}"></label>
        <label>Status<select id="inspectionStatus">${INSPECTION_STATUSES.map(value => `<option ${value === (record?.status || 'Draft') ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        <label>Result<select id="inspectionResult">${INSPECTION_RESULTS.map(value => `<option ${value === (record?.result || 'Not Evaluated') ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
        ${['building','area','room','trade','discipline'].map(field => `<label>${field[0].toUpperCase() + field.slice(1)}<input id="inspection${field[0].toUpperCase() + field.slice(1)}" value="${esc(record?.[field] || prefill[field] || '')}"></label>`).join('')}
        <label class="wide">Description<textarea id="inspectionDescription">${esc(record?.description || '')}</textarea></label>
        <label class="wide">Scope<textarea id="inspectionScope">${esc(record?.scope || '')}</textarea></label>
        <label class="wide">Observed conditions<textarea id="inspectionObserved">${esc(record?.observedConditions || '')}</textarea></label>
        <label class="wide">Notes<textarea id="inspectionNotes">${esc(record?.notes || '')}</textarea></label>
        <label class="check"><input id="inspectionCorrective" type="checkbox" ${record?.correctiveActionRequired ? 'checked' : ''}> Corrective action required</label>
        <label class="check"><input id="inspectionFollowUp" type="checkbox" ${record?.followUpRequired ? 'checked' : ''}> Follow-up required</label>
        ${evidenceCandidates.length ? `<label class="check wide"><input id="inspectionAttachEvidence" type="checkbox"> Attach ${evidenceCandidates.length} exact source reference(s) from the active retrieval session</label>` : ''}
        <label>Follow-up date<input id="inspectionFollowUpDate" type="date" value="${esc(record?.followUpDate || '')}"></label>
      </div>
      <div class="mc-inspection-reference-note"><strong>Exact source references</strong><span>${(record?.sourceDocumentIds || prefill.sourceDocumentIds || []).length} documents · ${(record?.sourceSectionIds || prefill.sourceSectionIds || []).length} sections · ${(record?.evidenceReferences || prefill.evidenceReferences || []).length} saved evidence source references</span></div>
      <div class="mc-inspection-form-actions"><button type="button" class="subtle" data-inspection-cancel>Cancel</button><button type="submit">Save Inspection Record</button></div>
    </form>`, () => {
      let dirty = false;
      modalCloseGuard = () => !dirty || confirm('Discard unsaved Inspection Record changes?');
      $('#inspectionRecordForm').addEventListener('input', () => { dirty = true; });
      $('[data-inspection-cancel]').onclick = () => closeModal();
      $('#inspectionRecordForm').onsubmit = async event => {
        event.preventDefault();
        const base = record || prefill;
        const input = {
          ...base,
          inspectionNumber: number,
          title: $('#inspectionTitle').value,
          inspectionType: $('#inspectionType').value,
          status: $('#inspectionStatus').value,
          result: $('#inspectionResult').value,
          inspectionDate: $('#inspectionDate').value,
          inspectorName: $('#inspectionInspector').value,
          building: $('#inspectionBuilding').value,
          area: $('#inspectionArea').value,
          room: $('#inspectionRoom').value,
          trade: $('#inspectionTrade').value,
          discipline: $('#inspectionDiscipline').value,
          description: $('#inspectionDescription').value,
          scope: $('#inspectionScope').value,
          observedConditions: $('#inspectionObserved').value,
          notes: $('#inspectionNotes').value,
          correctiveActionRequired: $('#inspectionCorrective').checked,
          followUpRequired: $('#inspectionFollowUp').checked,
          followUpDate: $('#inspectionFollowUpDate').value,
          evidenceReferences: record?.evidenceReferences || requestedPrefill?.evidenceReferences || ($('#inspectionAttachEvidence')?.checked ? evidenceCandidates : [])
        };
        try {
          const saved = record
            ? await engine.updateInspectionRecord(record.inspectionId, input)
            : await engine.createInspectionRecord(input);
          selectedInspectionId = saved.inspectionId;
          closeModal(true);
          await renderInspectionRecords();
        } catch (error) { alert(error.message); }
      };
    });
}

async function activateInspectionRecord(record) {
  const [documents, sections] = await Promise.all([engine.documents(), engine.sections()]);
  const seed = inspectionContextSeed(record, { documents, sections });
  if (!seed) return false;
  const result = await activateEngineeringContext({ ...seed, source: CONTEXT_ACTIVATION_SOURCES.inspectionRecord });
  return result.available;
}

async function renderInspectionRecords() {
  const includeArchived = $('#inspectionShowArchived')?.checked === true;
  const [records, documents, sections] = await Promise.all([
    engine.inspectionRecords({ includeArchived }), engine.documents(), engine.sections()
  ]);
  const query = ($('#inspectionSearch')?.value || '').trim().toLowerCase();
  const locationQuery = ($('#inspectionLocationFilter')?.value || '').trim().toLowerCase();
  const status = $('#inspectionStatusFilter')?.value || '';
  const sort = $('#inspectionSort')?.value || 'number';
  const visible = records.filter(record =>
    (!status || record.status === status) &&
    (!query || [record.inspectionNumber, record.title, inspectionLocation(record), record.trade].join(' ').toLowerCase().includes(query)) &&
    (!locationQuery || inspectionLocation(record).toLowerCase().includes(locationQuery))
  ).sort((a, b) => sort === 'date'
    ? b.inspectionDate.localeCompare(a.inspectionDate) || a.inspectionNumber.localeCompare(b.inspectionNumber)
    : a.inspectionNumber.localeCompare(b.inspectionNumber));
  if (selectedInspectionId && !records.some(record => record.inspectionId === selectedInspectionId)) selectedInspectionId = null;
  $('#inspectionList').innerHTML = visible.length ? `<div class="mc-inspection-list">${visible.map(record => `
    <button class="mc-inspection-card ${record.inspectionId === selectedInspectionId ? 'active' : ''}" data-inspection-id="${esc(record.inspectionId)}" ${record.inspectionId === selectedInspectionId ? 'aria-current="true"' : ''}>
      <span><strong>${esc(record.inspectionNumber)}</strong><small>${esc(record.status)}${record.archivedAt ? ' · Archived' : ''}</small></span>
      <h3>${esc(record.title)}</h3><p>${esc(record.inspectionDate)} · ${esc(inspectionLocation(record))}</p>
      <footer><span>${esc(record.trade || 'Trade unavailable')}</span><span>${esc(record.result)}</span>${record.followUpRequired ? '<b>Follow-up</b>' : ''}</footer>
    </button>`).join('')}</div>` : '<div class="mc-inspection-empty"><strong>No matching Inspection Records.</strong><span>Create a record or adjust the active filters.</span></div>';
  $$('[data-inspection-id]').forEach(button => button.onclick = async () => {
    selectedInspectionId = button.dataset.inspectionId;
    const record = records.find(item => item.inspectionId === selectedInspectionId);
    await activateInspectionRecord(record);
    renderInspectionRecords();
  });
  const record = records.find(item => item.inspectionId === selectedInspectionId);
  if (!record) {
    $('#inspectionDetail').innerHTML = '<div class="mc-inspection-empty"><strong>No Inspection Record selected.</strong><span>Select a record to review its user-authored observations and exact source links.</span></div>';
    return;
  }
  const documentLink = id => documents.find(item => item.id === id);
  const sectionLink = id => sections.find(item => item.id === id);
  const links = (ids, resolver) => ids.length ? `<ul>${ids.map(id => { const item = resolver(id); const label = item ? item.title || item.name || sectionHeadingValue(item) : id; return `<li class="${item ? '' : 'unavailable'}"><strong>${esc(label)}</strong><span>${item ? esc(id) : `Unavailable reference: ${esc(id)}`}</span></li>`; }).join('')}</ul>` : '<p>None linked.</p>';
  $('#inspectionDetail').innerHTML = `
    <article class="mc-inspection-detail">
      <header><span>${esc(record.inspectionNumber)}</span><h2>${esc(record.title)}</h2><p>${esc(record.status)} · ${esc(record.result)}</p></header>
      <div class="mc-inspection-actions"><button data-inspection-edit>Edit</button>${record.archivedAt ? '' : '<button class="danger" data-inspection-archive>Archive</button>'}${['Closed','Cancelled'].includes(record.status) ? '<button class="subtle" data-inspection-reopen>Explicitly reopen</button>' : ''}</div>
      <dl><div><dt>Date</dt><dd>${esc(record.inspectionDate)}</dd></div><div><dt>Inspector</dt><dd>${esc(record.inspectorName || 'Unavailable')}</dd></div><div><dt>Location</dt><dd>${esc(inspectionLocation(record))}</dd></div><div><dt>Trade / discipline</dt><dd>${esc([record.trade, record.discipline].filter(Boolean).join(' · ') || 'Unavailable')}</dd></div><div><dt>Workflow</dt><dd>${esc(record.workflowTemplateId || 'Unavailable')}</dd></div><div><dt>Updated</dt><dd>${esc(record.updatedAt || 'Unavailable')}</dd></div></dl>
      ${[['Scope',record.scope],['Observed Conditions',record.observedConditions],['Notes',record.notes]].map(([label,value]) => `<section><h3>${label}</h3><p>${esc(value || 'Not recorded.')}</p></section>`).join('')}
      <section><h3>Corrective Action and Follow-Up</h3><p>${record.correctiveActionRequired ? 'Corrective action required.' : 'No corrective action marked.'} ${record.followUpRequired ? `Follow-up required${record.followUpDate ? ` on ${esc(record.followUpDate)}` : ''}.` : 'No follow-up marked.'}</p></section>
      <section><h3>Source Documents</h3>${links(record.sourceDocumentIds, documentLink)}</section>
      <section><h3>Source Sections</h3>${links(record.sourceSectionIds, sectionLink)}</section>
      <section><h3>Evidence References</h3>${record.evidenceReferences.length ? links(record.evidenceReferences.map(item => item.sectionId), sectionLink) : '<p>None linked from the active retrieval session.</p>'}</section>
      <section><h3>Related Records</h3>${links([...record.relatedDrawingIds,...record.relatedSpecificationIds,...record.relatedRfiIds,...record.relatedSubmittalIds,...record.relatedDeficiencyIds], documentLink)}</section>
      <nav class="mc-inspection-navigation" aria-label="Inspection source navigation"><button data-inspection-engineering>Engineering Workspace</button><button data-inspection-source>Source Inspector</button><button data-inspection-evidence>Evidence Explorer</button><button data-inspection-relationships>Relationship Explorer</button><button data-inspection-workflow>Workflow Workspace</button></nav>
    </article>`;
  $('[data-inspection-edit]').onclick = () => openInspectionForm(record);
  $('[data-inspection-archive]')?.addEventListener('click', async () => { if (confirm(`Archive ${record.inspectionNumber}? Its number will not be reused.`)) { await engine.archiveInspectionRecord(record.inspectionId); selectedInspectionId = null; await renderInspectionRecords(); } });
  $('[data-inspection-reopen]')?.addEventListener('click', async () => { if (confirm(`Explicitly reopen ${record.inspectionNumber} as In Progress?`)) { await engine.updateInspectionRecord(record.inspectionId, { status: 'In Progress' }, { reopen: true }); await renderInspectionRecords(); } });
  $('[data-inspection-engineering]').onclick = async () => { if (await activateInspectionRecord(record)) show('engineering'); else alert('No exact source reference is available to establish Engineering Context.'); };
  $('[data-inspection-source]').onclick = async () => { if (!(await activateInspectionRecord(record))) return alert('No exact source reference is available.'); selectedDoc = activeContextActivation.documentId; sourceNavigationTarget = createSourceTarget({ ...activeContextActivation, originatingWorkspace: 'inspections', destination: 'sources' }); show('sources'); };
  $('[data-inspection-evidence]').onclick = () => show('evidence');
  $('[data-inspection-relationships]').onclick = async () => { if (!(await activateInspectionRecord(record))) return; relationshipTarget = { ...relationshipNavigationTarget({ documentId: activeContextActivation.documentId, sectionId: activeContextActivation.sectionId }), originatingWorkspace: 'inspections' }; show('relationships'); };
  $('[data-inspection-workflow]').onclick = async () => { if (await activateInspectionRecord(record)) openWorkflowWorkspace(record.workflowTemplateId || 'Inspection Preparation', 'inspections'); };
}

$('#createInspectionRecord').onclick = () => openInspectionForm();
for (const id of ['inspectionSearch','inspectionStatusFilter','inspectionLocationFilter','inspectionSort','inspectionShowArchived']) {
  $(`#${id}`).addEventListener(id.includes('Search') || id.includes('Location') ? 'input' : 'change', renderInspectionRecords);
}

$('#upload').onclick = () => $('#fileInput').click();

const importStageCopy = {
  queued: 'Queued',
  extracting: 'Extracting',
  detecting: 'Detecting sections',
  indexing: 'Indexing',
  verifying: 'Verifying',
  ready: 'Ready',
  failed: 'Failed',
  skipped: 'Duplicate detected'
};

function importFailureMessage(stage) {
  return {
    extracting: 'Mission Companion could not read or extract this document.',
    detecting: 'Mission Companion could not detect document sections.',
    indexing: 'Mission Companion could not save the document and its sections.',
    verifying: 'Mission Companion could not verify the imported document.',
    queued: 'Mission Companion could not start the document import.'
  }[stage] || 'Mission Companion could not complete this document import.';
}

function updateQueueProgress(progress) {
  const stage = importStageCopy[progress.stage]
    ? progress.stage
    : 'extracting';

  importQueue = importQueue.map((queueItem, index) =>
    index === progress.current - 1
      ? {
          ...queueItem,
          status: 'processing',
          stage,
          detail: importStageCopy[stage],
          technicalDetail: ''
        }
      : queueItem
  );

  renderImportQueue();

  $('#ingestStatus').innerHTML = `
    <div class="progress">
      ${esc(importStageCopy[stage])}: ${esc(progress.name)}
      (${progress.current}/${progress.total})
    </div>
  `;
}

async function refreshAfterImport() {
  await refresh();
  await renderSources();
  await renderEvals();
}

$('#fileInput').onchange = async () => {
  const files = [...$('#fileInput').files];

  if (!files.length) {
    return;
  }

  const libraryId = state().activeLibrary;

  importQueue = files.map(file =>
    createImportQueueItem(file, libraryId)
  );

  renderImportQueue();

  $('#ingestStatus').innerHTML = '<div class="progress">Preparing files…</div>';

  try {
    const result = await engine.ingest(
      files,
      updateQueueProgress,
      libraryId
    );

    importQueue = importQueue.map(queueItem => {
      const failed = result.documents.find(document =>
        document.name === queueItem.name &&
        document.size === queueItem.size &&
        document.status === 'error'
      );

      const skipped = result.skipped?.find(document =>
        document.name === queueItem.name &&
        document.size === queueItem.size
      );

      if (failed) {
        return failImportQueueItem(
          queueItem,
          importFailureMessage(queueItem.stage),
          [
            failed.error || failed.healthDetail || 'Document extraction failed.',
            failed.errorStack || ''
          ].filter(Boolean).join('\n\n')
        );
      }

      if (skipped) {
        return {
          ...queueItem,
          status: 'skipped',
          stage: 'skipped',
          detail: duplicateDetail(skipped),
          duplicate: skipped.duplicate,
          technicalDetail: ''
        };
      }

      return completeImportQueueItem(queueItem);
    });

    renderImportQueue();

    $('#ingestStatus').innerHTML = `
      <div class="success">
        Indexed ${result.sections.length} sections from
        ${result.documents.filter(document => document.status === 'verified').length}
        document(s).
        ${result.skipped?.length
          ? ` Skipped ${result.skipped.length} duplicate(s).`
          : ''}
      </div>
    `;
  } catch (error) {
    importQueue = importQueue.map(queueItem =>
      queueItem.status === 'complete'
        ? queueItem
        : failImportQueueItem(
            queueItem,
            importFailureMessage(queueItem.stage),
            error.message
          )
    );

    logger.error('Document import failed', {
      files: files.map(file => file.name),
      message: error.message,
      stack: error.stack || ''
    });

    renderImportQueue();

    $('#ingestStatus').innerHTML = `
      <div class="error">
        Import failed. Review the queue item for available actions.
      </div>
    `;
  } finally {
    $('#fileInput').value = '';
    await refreshAfterImport();
  }
};

$('#documentFilter').oninput = () => renderKnowledgeWorkspace();
$('#clearKnowledgeFilters').onclick = () => {
  selectedKnowledgeSection = 'all';
  selectedDoc = null;
  renderKnowledgeWorkspace();
};

$('#newLibrary').onclick = () => openModal(
  `
    <h2>Create knowledge library</h2>
    <label>
      Library name
      <input id="libraryName" autofocus>
    </label>
    <label>
      Description
      <textarea id="libraryDescription"></textarea>
    </label>
    <button id="createLibrary">Create library</button>
  `,
  () => {
    $('#createLibrary').onclick = async () => {
      const name = $('#libraryName').value.trim();

      if (!name) {
        return;
      }

      engine.addLibrary(
        name,
        $('#libraryDescription').value
      );

      closeModal();
      await refresh();
    };
  }
);

function duplicateDetail(skipped) {
  const duplicate = skipped?.duplicate;

  if (!duplicate) {
    return skipped?.reason || 'Duplicate document';
  }

  return `${skipped.reason} Project: ${duplicate.projectName}; Library: ${duplicate.libraryName}; Document ID: ${duplicate.documentId}; Status: ${duplicate.status}.`;
}

async function retryImport(queueId, duplicateAction) {
  const queueItem = importQueue.find(item => item.id === queueId);

  if (!queueItem || queueItem.status === 'processing') {
    return;
  }

  if (!queueItem.file) {
    importQueue = importQueue.map(item => item.id === queueId
      ? {
          ...item,
          status: 'error',
          stage: 'failed',
          detail: 'Select this document again to retry the import.',
          technicalDetail: 'The browser no longer provides access to the original File object.'
        }
      : item
    );
    renderImportQueue();
    return;
  }

  importQueue = importQueue.map(item => item.id === queueId
    ? {
        ...item,
        status: 'processing',
        stage: 'extracting',
        detail: duplicateAction === 'replace'
          ? 'Replacing existing document'
          : 'Extracting',
        technicalDetail: ''
      }
    : item
  );
  renderImportQueue();

  try {
    const result = await engine.ingest(
      [queueItem.file],
      progress => {
        importQueue = importQueue.map(item => item.id === queueId
          ? {
              ...item,
              status: 'processing',
              stage: progress.stage || 'extracting',
              detail:
                importStageCopy[progress.stage] ||
                'Extracting'
            }
          : item
        );
        renderImportQueue();
      },
      queueItem.libraryId,
      {
        duplicateAction,
        duplicateDocumentId: queueItem.duplicate?.documentId
      }
    );
    const document = result.documents.find(item =>
      item.name === queueItem.name && item.size === queueItem.size
    );

    if (!document || document.status !== 'verified' || document.sectionCount <= 0) {
      throw new Error(document?.error || 'No usable indexed document was created.');
    }

    importQueue = importQueue.map(item => item.id === queueId
      ? completeImportQueueItem(
          item,
          `Indexed and verified (${document.sectionCount} sections)`
        )
      : item
    );
    $('#ingestStatus').innerHTML = `
      <div class="success">
        Indexed ${result.sections.length} sections from 1 document.
      </div>
    `;
  } catch (error) {
    const failedQueueItem = importQueue.find(item => item.id === queueId);

    importQueue = importQueue.map(item => item.id === queueId
      ? failImportQueueItem(
          item,
          importFailureMessage(failedQueueItem?.stage),
          error.message
        )
      : item
    );

    logger.error('Document import retry failed', {
      file: queueItem.name,
      message: error.message,
      stack: error.stack || ''
    });

    $('#ingestStatus').innerHTML = `
      <div class="error">
        Import failed. Review the queue item for available actions.
      </div>
    `;
  } finally {
    renderImportQueue();
    await refreshAfterImport();
  }
}

function renderImportQueue() {
  $('#importQueue').innerHTML = importQueue.length
    ? importQueue.map(queueItem => `
        <article class="queue-item ${queueItem.status}">
          <span class="queue-state">
            ${queueItem.status === 'complete'
              ? '✓'
              : queueItem.status === 'error'
                ? '×'
                : queueItem.status === 'processing'
                  ? '↻'
                  : queueItem.status === 'skipped'
                    ? '—'
                    : '…'}
          </span>

          <div>
            <strong>${esc(queueItem.name)}</strong>
            <span class="mc-import-stage">
              ${esc(importStageCopy[queueItem.stage] || queueItem.detail)}
            </span>
            <small>${esc(queueItem.detail)}</small>
            ${queueItem.status === 'error' && queueItem.technicalDetail
              ? `
                <details class="mc-import-technical">
                  <summary>View technical details</summary>
                  <pre>${esc(queueItem.technicalDetail)}</pre>
                </details>
              `
              : ''}
            ${queueItem.status === 'skipped'
              ? `
                <div class="queue-actions">
                  <button data-queue-id="${esc(queueItem.id)}" data-import-action="reimport">Re-import anyway</button>
                  <button data-queue-id="${esc(queueItem.id)}" data-import-action="replace">Replace existing document</button>
                  <button class="subtle" data-queue-id="${esc(queueItem.id)}" data-import-action="dismiss">Dismiss</button>
                </div>
              `
              : queueItem.status === 'error'
                ? `
                  <div class="queue-actions">
                    <button data-queue-id="${esc(queueItem.id)}" data-import-action="reimport">Retry</button>
                    <button class="subtle" data-queue-id="${esc(queueItem.id)}" data-import-action="dismiss">Dismiss</button>
                  </div>
                `
                : queueItem.status === 'complete'
                  ? `
                    <div class="queue-actions">
                      <button class="subtle" data-queue-id="${esc(queueItem.id)}" data-import-action="dismiss">Dismiss</button>
                    </div>
                  `
                  : ''}
          </div>
        </article>
      `).join('')
    : '<div class="empty">No imports in this session. Use Add documents to begin an import.</div>';

  $('#importQueue').querySelectorAll('[data-import-action]').forEach(button => {
    button.onclick = () => {
      const queueId = button.dataset.queueId;
      const action = button.dataset.importAction;

      if (action === 'dismiss') {
        importQueue = importQueue.filter(item => item.id !== queueId);
        renderImportQueue();
        return;
      }

      retryImport(queueId, action);
    };
  });
}

function knowledgeTypeGroup(document) {
  const extension = safeText(document.extension).toLowerCase();
  const type = safeText(document.type).toLowerCase();

  if (extension === 'pdf' || type.includes('pdf')) {
    return 'PDF';
  }

  if (
    ['doc', 'docx', 'odt', 'rtf'].includes(extension) ||
    type.includes('word') ||
    type.includes('document')
  ) {
    return 'Word';
  }

  if (
    ['xls', 'xlsx', 'csv', 'ods'].includes(extension) ||
    type.includes('sheet') ||
    type.includes('excel') ||
    type.includes('csv')
  ) {
    return 'Excel';
  }

  if (
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'tif', 'tiff', 'bmp'].includes(extension) ||
    type.startsWith('image/')
  ) {
    return 'Images';
  }

  if (
    ['html', 'htm', 'xml'].includes(extension) ||
    type.includes('html') ||
    type.includes('xml')
  ) {
    return 'Web/HTML';
  }

  if (
    ['txt', 'md', 'log', 'json'].includes(extension) ||
    type.startsWith('text/') ||
    type.includes('json')
  ) {
    return 'Text';
  }

  return 'Other';
}

function fallbackCatalogSection(document) {
  return {
    PDF: 'PDF Documents',
    Word: 'Word Documents',
    Excel: 'Spreadsheets',
    Images: 'Photos and Media',
    Text: 'Text Documents',
    'Web/HTML': 'Web Documents',
    Other: 'Uncategorized'
  }[knowledgeTypeGroup(document)];
}

function documentCatalogSection(document) {
  const metadataCategory = preferredText(
    document.metadata?.category,
    document.metadata?.documentCategory,
    document.metadata?.knowledgeSection
  ).trim();
  const documentCategory = safeText(document.category).trim();

  if (metadataCategory) {
    return metadataCategory;
  }

  if (documentCategory) {
    return documentCategory;
  }

  const tags = [
    ...(Array.isArray(document.tags) ? document.tags : []),
    ...(Array.isArray(document.metadata?.tags)
      ? document.metadata.tags
      : [])
  ]
    .map(tag => safeText(tag).trim())
    .filter(Boolean);

  if (tags.length) {
    return tags[0];
  }

  return fallbackCatalogSection(document);
}

function knowledgeCatalogData(documents, sections, libraries) {
  const sectionCounts = new Map();

  sections.forEach(section => {
    sectionCounts.set(
      section.documentId,
      (sectionCounts.get(section.documentId) || 0) + 1
    );
  });

  const buildEntry = (name, matchingDocuments) => {
    const indexed = matchingDocuments.filter(document =>
      documentStatus(document).className === 'indexed'
    );
    const pending = matchingDocuments.filter(document =>
      documentStatus(document).className === 'pending'
    );
    const unavailable = matchingDocuments.filter(document =>
      documentStatus(document).className === 'unavailable'
    );
    const unknown = matchingDocuments.filter(document =>
      documentStatus(document).className === 'unknown'
    );
    const exposedSections = matchingDocuments.reduce(
      (total, document) =>
        total + Number(sectionCounts.get(document.id) || 0),
      0
    );
    const indexedWithoutSections = indexed.filter(document =>
      Number(sectionCounts.get(document.id) || 0) <= 0
    );

    let attention = '';

    if (!matchingDocuments.length) {
      attention = 'No content loaded';
    } else if (unavailable.length) {
      attention = 'Document unavailable';
    } else if (pending.length || indexedWithoutSections.length) {
      attention = 'Indexing incomplete';
    } else if (unknown.length || name === 'Uncategorized') {
      attention = 'Metadata incomplete';
    }

    return {
      attention,
      documents: matchingDocuments,
      exposedSections,
      indexed,
      indexedWithoutSections,
      libraries: libraries.filter(library =>
        matchingDocuments.some(document =>
          document.libraryId === library.id
        )
      ),
      name,
      pending,
      unavailable,
      unknown
    };
  };

  const grouped = new Map();

  documents.forEach(document => {
    const name = documentCatalogSection(document);

    if (!grouped.has(name)) {
      grouped.set(name, []);
    }

    grouped.get(name).push(document);
  });

  const entries = [...grouped.entries()]
    .map(([name, matchingDocuments]) =>
      buildEntry(name, matchingDocuments)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const all = buildEntry('All Knowledge', documents);
  const types = ['PDF', 'Word', 'Excel', 'Images', 'Text', 'Web/HTML', 'Other']
    .map(name => {
      const matchingDocuments = documents.filter(document =>
        knowledgeTypeGroup(document) === name
      );

      return {
        documents: matchingDocuments,
        indexed: matchingDocuments.filter(document =>
          documentStatus(document).className === 'indexed'
        ).length,
        name,
        percentage: documents.length
          ? Math.round((matchingDocuments.length / documents.length) * 100)
          : 0
      };
    })
    .filter(type => type.documents.length > 0);

  return {
    all,
    entries,
    sectionCounts,
    types
  };
}

async function renderKnowledgeWorkspace(prefetched = null, prefetchedSections = null) {
  const currentState = state();
  const libraries = engine.libraries();
  const allDocuments = prefetched || await engine.documents();
  const allSections = prefetchedSections ?? await engine.sections();
  indexSpecificationDocuments({ specificationIndex, documents: allDocuments, sections: allSections, projectId: currentState.activeProject });
  const catalog = knowledgeCatalogData(
    allDocuments,
    allSections,
    libraries
  );

  const activeLibrary =
    libraries.find(library => library.id === currentState.activeLibrary) ||
    libraries[0];

  if (
    activeLibrary &&
    activeLibrary.id !== currentState.activeLibrary
  ) {
    engine.setLibrary(activeLibrary.id);
  }

  if (
    selectedKnowledgeSection !== 'all' &&
    !catalog.entries.some(entry =>
      entry.name === selectedKnowledgeSection
    )
  ) {
    selectedKnowledgeSection = 'all';
    selectedDoc = null;
  }

  const selectedEntry = selectedKnowledgeSection === 'all'
    ? catalog.all
    : catalog.entries.find(entry =>
        entry.name === selectedKnowledgeSection
      ) || catalog.all;

  knowledgeCatalogContext = {
    catalog,
    libraries,
    selectedEntry
  };

  const summaryItems = [
    ['Total documents', allDocuments.length],
    ['Categories represented', catalog.entries.length],
    ['Indexed documents', catalog.all.indexed.length],
    ['Indexed sections', allSections.length],
    ['File types represented', catalog.types.length],
    ['Libraries enabled', libraries.filter(library => library.enabled).length]
  ];

  $('#knowledgeCatalogSummary').innerHTML = summaryItems.map(item => `
    <article>
      <span>${esc(item[0])}</span>
      <strong>${fmt(item[1])}</strong>
    </article>
  `).join('');

  const catalogEntries = [catalog.all, ...catalog.entries];

  $('#knowledgeCatalog').innerHTML = catalogEntries.length
    ? `
      <ul>
        ${catalogEntries.map((entry, index) => {
          const selected = index === 0
            ? selectedKnowledgeSection === 'all'
            : entry.name === selectedKnowledgeSection;

          return `
            <li>
              <button
                type="button"
                class="mc-library-section ${selected ? 'active' : ''}"
                data-catalog-section="${index === 0 ? 'all' : esc(entry.name)}"
                aria-pressed="${selected}"
              >
                <span class="mc-library-section-heading">
                  <strong>${esc(entry.name)}</strong>
                  <span>${fmt(entry.documents.length)}</span>
                </span>
                <span class="mc-library-section-counts">
                  ${fmt(entry.indexed.length)} indexed
                  · ${fmt(entry.pending.length)} pending
                  · ${fmt(entry.unavailable.length)} unavailable
                </span>
                <span class="mc-library-section-sections">
                  ${fmt(entry.exposedSections)} sections
                </span>
                ${entry.attention
                  ? `
                    <span class="mc-library-attention">
                      ${esc(entry.attention)}
                    </span>
                  `
                  : ''}
              </button>
            </li>
          `;
        }).join('')}
      </ul>
    `
    : `
      <div class="mc-library-empty">
        <strong>No knowledge loaded</strong>
        <span>Add documents to begin building the catalog.</span>
      </div>
    `;

  $('#knowledgeTypeCoverage').innerHTML = catalog.types.length
    ? `
      <ul>
        ${catalog.types.map(type => `
          <li>
            <span class="mc-library-type-name">${esc(type.name)}</span>
            <strong>${fmt(type.documents.length)}</strong>
            <span>${fmt(type.percentage)}%</span>
            <small>${fmt(type.indexed)} indexed</small>
          </li>
        `).join('')}
      </ul>
      <p>
        Distribution reflects file types, not project completion or content
        quality.
      </p>
    `
    : `
      <div class="mc-library-empty">
        No file-type coverage is available.
      </div>
    `;

  $('#libraries').innerHTML = libraries.length
    ? libraries.map(library => {
        const count = allDocuments.filter(document =>
          document.libraryId === library.id
        ).length;

        return `
          <article
            class="library-card
              ${library.id === activeLibrary?.id ? 'active' : ''}
              ${library.enabled ? '' : 'disabled'}"
            data-library="${library.id}"
          >
            <button
              class="library-select"
              data-library-select="${library.id}"
            >
              <strong>${esc(library.name)}</strong>
              <span>
                ${count} document${count === 1 ? '' : 's'}
                · ${library.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </button>

            <div class="library-actions">
              <button
                class="subtle"
                data-library-edit="${library.id}"
              >
                Edit
              </button>

              <button
                class="subtle"
                data-library-toggle="${library.id}"
              >
                ${library.enabled ? 'Disable' : 'Enable'}
              </button>

              <button
                class="danger"
                data-library-delete="${library.id}"
              >
                ×
              </button>
            </div>
          </article>
        `;
      }).join('')
    : '<div class="empty">No libraries.</div>';

  $('#activeLibraryTitle').textContent =
    activeLibrary
      ? `ACTIVE UPLOAD LIBRARY · ${activeLibrary.name}`
      : 'ACTIVE UPLOAD LIBRARY UNAVAILABLE';

  let documents = [...selectedEntry.documents];

  const query = $('#documentFilter').value
    .trim()
    .toLowerCase();

  if (query) {
    documents = documents.filter(document =>
      `
        ${document.name}
        ${document.title || ''}
        ${document.category || ''}
        ${document.extension || ''}
        ${document.type || ''}
        ${Array.isArray(document.tags)
          ? document.tags.join(' ')
          : document.tags || ''}
        ${document.metadata
          ? JSON.stringify(document.metadata)
          : ''}
      `
        .toLowerCase()
        .includes(query)
    );
  }

  if (
    selectedDoc &&
    !documents.some(document => document.id === selectedDoc)
  ) {
    selectedDoc = null;
  }

  $('#knowledgeBrowserTitle').textContent = selectedEntry.name;
  $('#knowledgeBrowserCount').textContent = query
    ? `${fmt(documents.length)} of ${fmt(selectedEntry.documents.length)} matching documents`
    : `${fmt(selectedEntry.documents.length)} document${selectedEntry.documents.length === 1 ? '' : 's'}`;
  $('#clearKnowledgeFilters').disabled =
    selectedKnowledgeSection === 'all';

  renderDocuments(
    documents,
    allSections,
    libraries,
    selectedEntry
  );
  renderImportQueue();

  $$('[data-catalog-section]').forEach(button => {
    button.onclick = () => {
      selectedKnowledgeSection = button.dataset.catalogSection;
      selectedDoc = null;
      renderKnowledgeWorkspace();
    };
  });

  $$('[data-library-select]').forEach(button => {
    button.onclick = async () => {
      engine.setLibrary(button.dataset.librarySelect);
      selectedDoc = null;
      await refresh();
    };
  });

  $$('[data-library-toggle]').forEach(button => {
    button.onclick = async () => {
      const library = libraries.find(item =>
        item.id === button.dataset.libraryToggle
      );

      engine.updateLibrary(library.id, {
        enabled: !library.enabled
      });

      await refresh();
    };
  });

  $$('[data-library-edit]').forEach(button => {
    button.onclick = () => {
      const library = libraries.find(item =>
        item.id === button.dataset.libraryEdit
      );

      openModal(
        `
          <h2>Edit library</h2>
          <label>
            Name
            <input
              id="editLibraryName"
              value="${esc(library.name)}"
            >
          </label>
          <label>
            Description
            <textarea id="editLibraryDescription">${esc(library.description || '')}</textarea>
          </label>
          <button id="saveLibrary">Save</button>
        `,
        () => {
          $('#saveLibrary').onclick = async () => {
            engine.updateLibrary(library.id, {
              name:
                $('#editLibraryName').value.trim() ||
                library.name,
              description:
                $('#editLibraryDescription').value.trim()
            });

            closeModal();
            await refresh();
          };
        }
      );
    };
  });

  $$('[data-library-delete]').forEach(button => {
    button.onclick = async () => {
      if (
        confirm(
          'Delete this library and every document indexed inside it?'
        )
      ) {
        try {
          await engine.deleteLibrary(
            button.dataset.libraryDelete
          );

          await refresh();
        } catch (error) {
          alert(error.message);
        }
      }
    };
  });
}

function documentStatus(document) {
  const status = safeText(document.status).toLowerCase();

  if (['verified', 'indexed', 'complete', 'ready'].includes(status)) {
    return {
      className: 'indexed',
      label: 'Indexed'
    };
  }

  if (['waiting', 'processing', 'pending'].includes(status)) {
    return {
      className: 'pending',
      label: 'Pending'
    };
  }

  if (['error', 'failed', 'unavailable'].includes(status)) {
    return {
      className: 'unavailable',
      label: 'Unavailable'
    };
  }

  return {
    className: 'unknown',
    label: status
      ? status.charAt(0).toUpperCase() + status.slice(1)
      : 'Status unavailable'
  };
}

function documentType(document) {
  if (document?.documentType) return document.documentType === 'drawing-set' ? 'Drawing Set' : document.documentType === 'specifications' ? 'Specifications' : document.documentType;
  return preferredText(
    document.extension?.toUpperCase(),
    document.type,
    'Type unavailable'
  );
}

function documentPageCount(document) {
  const value = preferredText(
    document.pageCount,
    document.pages,
    document.metadata?.pageCount,
    document.metadata?.pages
  );
  const count = Number(value);

  return Number.isFinite(count) && count > 0 ? count : null;
}

function documentModifiedAt(document) {
  const value =
    document.lastModified ??
    document.modifiedAt ??
    document.updatedAt ??
    document.metadata?.lastModified;
  const date = value ? new Date(value) : null;

  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString()
    : '';
}

function projectKnowledgeSnapshot(
  currentState,
  libraries,
  documents,
  sections
) {
  const sectionCounts = new Map();

  sections.forEach(section => {
    sectionCounts.set(
      section.documentId,
      (sectionCounts.get(section.documentId) || 0) + 1
    );
  });

  const indexed = documents.filter(document =>
    documentStatus(document).className === 'indexed'
  );
  const pending = documents.filter(document =>
    documentStatus(document).className === 'pending'
  );
  const unavailable = documents.filter(document =>
    documentStatus(document).className === 'unavailable'
  );
  const unknown = documents.filter(document =>
    documentStatus(document).className === 'unknown'
  );
  const indexedWithoutSections = indexed.filter(document =>
    Number(document.sectionCount || 0) <= 0 ||
    Number(sectionCounts.get(document.id) || 0) <= 0
  );
  const disabledLibrariesWithDocuments = libraries.filter(library =>
    !library.enabled &&
    documents.some(document => document.libraryId === library.id)
  );
  const activeLibrary = libraries.find(
    library => library.id === currentState.activeLibrary
  ) || null;

  let readiness = 'Knowledge indexed';

  if (!currentState.activeProject) {
    readiness = 'No active project';
  } else if (!libraries.length) {
    readiness = 'No libraries';
  } else if (!documents.length) {
    readiness = 'No documents';
  } else if (
    unavailable.length ||
    unknown.length ||
    disabledLibrariesWithDocuments.length
  ) {
    readiness = 'Attention needed';
  } else if (pending.length || indexedWithoutSections.length) {
    readiness = 'Indexing incomplete';
  }

  return {
    activeLibrary,
    disabledLibrariesWithDocuments,
    enabledLibraries: libraries.filter(library => library.enabled),
    indexed,
    indexedWithoutSections,
    pending,
    readiness,
    sectionCounts,
    unavailable,
    unknown
  };
}

function projectKnowledgeUpdatedAt(project, libraries, documents) {
  const timestamps = [
    project?.updatedAt,
    ...libraries.map(library => library.updatedAt),
    ...documents.map(document => document.indexedAt)
  ]
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.getTime()));

  if (!timestamps.length) {
    return '';
  }

  return new Date(
    Math.max(...timestamps.map(date => date.getTime()))
  ).toLocaleString();
}

function projectAttentionItems(snapshot, libraries, documents) {
  const items = [];

  if (!libraries.length) {
    items.push({
      text: 'No knowledge libraries are available for the active project.',
      view: 'knowledge',
      action: 'Open Knowledge Workspace'
    });
  }

  if (!documents.length) {
    items.push({
      text: 'No documents are loaded for the active project.',
      view: 'knowledge',
      action: 'Add project documents'
    });
  }

  snapshot.disabledLibrariesWithDocuments.forEach(library => {
    const count = documents.filter(document =>
      document.libraryId === library.id
    ).length;

    items.push({
      text: `${library.name} is disabled and contains ${count} document${count === 1 ? '' : 's'}.`,
      view: 'knowledge',
      libraryId: library.id,
      action: 'Review library'
    });
  });

  if (snapshot.pending.length) {
    items.push({
      text: `${snapshot.pending.length} document${snapshot.pending.length === 1 ? ' is' : 's are'} pending indexing.`,
      view: 'knowledge',
      action: 'Review indexing status'
    });
  }

  if (snapshot.unavailable.length) {
    items.push({
      text: `${snapshot.unavailable.length} document${snapshot.unavailable.length === 1 ? ' is' : 's are'} marked unavailable or failed by production state.`,
      view: 'sources',
      action: 'Inspect documents'
    });
  }

  if (snapshot.indexedWithoutSections.length) {
    items.push({
      text: `${snapshot.indexedWithoutSections.length} indexed document${snapshot.indexedWithoutSections.length === 1 ? ' exposes' : 's expose'} zero available sections.`,
      view: 'sources',
      action: 'Inspect extraction'
    });
  }

  if (snapshot.unknown.length) {
    items.push({
      text: `${snapshot.unknown.length} document${snapshot.unknown.length === 1 ? ' has' : 's have'} no recognized indexing status.`,
      view: 'knowledge',
      action: 'Review metadata'
    });
  }

  return items;
}

function projectNextActions(snapshot, libraries, documents) {
  const actions = [];

  if (!libraries.length || !documents.length) {
    actions.push({
      label: 'Add project documents',
      detail: 'Open the Knowledge Workspace to add source material.',
      view: 'knowledge'
    });
  }

  if (snapshot.pending.length || snapshot.indexedWithoutSections.length) {
    actions.push({
      label: 'Review indexing status',
      detail: 'Inspect document readiness and available sections.',
      view: 'knowledge'
    });
    actions.push({
      label: 'Open diagnostics',
      detail: 'Review the application’s existing operational checks.',
      view: 'diagnostics'
    });
  }

  if (snapshot.unavailable.length || snapshot.unknown.length) {
    actions.push({
      label: 'Inspect document extraction',
      detail: 'Open the existing Source Inspector for document details.',
      view: 'sources'
    });
    actions.push({
      label: 'Open diagnostics',
      detail: 'Review the application’s existing operational checks.',
      view: 'diagnostics'
    });
  }

  if (snapshot.disabledLibrariesWithDocuments.length) {
    actions.push({
      label: 'Review library availability',
      detail: 'Inspect enabled and disabled production libraries.',
      view: 'knowledge'
    });
  }

  if (
    documents.length &&
    !snapshot.pending.length &&
    !snapshot.unavailable.length &&
    !snapshot.unknown.length &&
    !snapshot.indexedWithoutSections.length
  ) {
    actions.push({
      label: 'Explore the Knowledge Workspace',
      detail: 'Browse indexed documents and their available sections.',
      view: 'knowledge'
    });
    actions.push({
      label: 'Ask an evidence-based project question',
      detail: 'Continue to the Command Desk without submitting automatically.',
      view: 'chat'
    });
  }

  return actions
    .filter((action, index, all) =>
      all.findIndex(item => item.label === action.label) === index
    )
    .slice(0, 3);
}

async function renderProjectWorkspace(
  prefetchedDocuments = null,
  prefetchedSections = null
) {
  const currentState = state();
  const project = currentState.projects.find(item =>
    item.id === currentState.activeProject
  );
  const libraries = engine.libraries();
  const documents = prefetchedDocuments || await engine.documents();
  const sections = prefetchedSections || await engine.sections();
  const snapshot = projectKnowledgeSnapshot(
    currentState,
    libraries,
    documents,
    sections
  );
  const lastUpdated = projectKnowledgeUpdatedAt(
    project,
    libraries,
    documents
  );
  const coverage = documents.length
    ? Math.round((snapshot.indexed.length / documents.length) * 100)
    : null;

  $('#projectWorkspaceHeader').innerHTML = project
    ? `
      <div class="mc-project-header-copy">
        <span>ACTIVE PROJECT</span>
        ${project.isDemonstration ? '<div class="mc-demo-project-label"><strong>Demonstration Project</strong><small>Fictional Sample Data</small></div>' : ''}
        <h2>${esc(project.name)}</h2>
        <p>
          ${project.description
            ? esc(project.description)
            : 'Project description unavailable.'}
        </p>
      </div>
      <dl class="mc-project-header-facts">
        <div>
          <dt>Active library</dt>
          <dd>
            ${snapshot.activeLibrary
              ? esc(snapshot.activeLibrary.name)
              : 'Unavailable'}
          </dd>
        </div>
        <div>
          <dt>Documents</dt>
          <dd>${fmt(documents.length)}</dd>
        </div>
        <div>
          <dt>Indexed sections</dt>
          <dd>${fmt(sections.length)}</dd>
        </div>
        <div>
          <dt>Knowledge last updated</dt>
          <dd>${lastUpdated ? esc(lastUpdated) : 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Readiness state</dt>
          <dd>${esc(snapshot.readiness)}</dd>
        </div>
      </dl>
    `
    : `
      <div class="mc-project-empty">
        <h2>No active project</h2>
        <p>Select or create a project to review knowledge readiness.</p>
      </div>
    `;

  const healthCards = [
    ['Total documents', documents.length, 'Loaded for the active project'],
    ['Indexed documents', snapshot.indexed.length, 'Production status is indexed'],
    ['Pending documents', snapshot.pending.length, 'Production status is pending'],
    ['Unavailable documents', snapshot.unavailable.length, 'Unavailable or failed status'],
    ['Indexed sections', sections.length, 'Available production sections'],
    ['Enabled libraries', snapshot.enabledLibraries.length, `${libraries.length} total libraries`],
    [
      'Index coverage',
      coverage === null ? '—' : `${coverage}%`,
      documents.length
        ? `${snapshot.indexed.length}/${documents.length} loaded documents`
        : 'No loaded documents'
    ]
  ];

  $('#projectHealth').innerHTML = healthCards.map(card => `
    <article class="mc-project-health-card">
      <span>${esc(card[0])}</span>
      <strong>${esc(card[1])}</strong>
      <small>${esc(card[2])}</small>
    </article>
  `).join('');

  $('#projectLibraries').innerHTML = libraries.length
    ? libraries.map(library => {
        const libraryDocuments = documents.filter(document =>
          document.libraryId === library.id
        );
        const indexed = libraryDocuments.filter(document =>
          documentStatus(document).className === 'indexed'
        ).length;
        const pending = libraryDocuments.filter(document =>
          documentStatus(document).className === 'pending'
        ).length;
        const unavailable = libraryDocuments.filter(document =>
          documentStatus(document).className === 'unavailable'
        ).length;

        return `
          <article class="mc-project-library">
            <div class="mc-project-library-heading">
              <div>
                <h3>${esc(library.name)}</h3>
                <span>${library.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <button
                type="button"
                data-project-library="${esc(library.id)}"
              >
                Open workspace
              </button>
            </div>
            <dl>
              <div><dt>Documents</dt><dd>${fmt(libraryDocuments.length)}</dd></div>
              <div><dt>Indexed</dt><dd>${fmt(indexed)}</dd></div>
              <div><dt>Pending</dt><dd>${fmt(pending)}</dd></div>
              <div><dt>Unavailable</dt><dd>${fmt(unavailable)}</dd></div>
            </dl>
          </article>
        `;
      }).join('')
    : `
      <div class="mc-project-empty">
        <strong>No libraries</strong>
        <p>No knowledge libraries are available for this project.</p>
      </div>
    `;

  $('#projectReadinessFilters').innerHTML = [
    ['all', 'All'],
    ['indexed', 'Indexed'],
    ['pending', 'Pending'],
    ['unavailable', 'Unavailable']
  ].map(([filter, label], index) => `
    <button
      type="button"
      data-project-filter="${filter}"
      class="${index === 0 ? 'active' : ''}"
      aria-pressed="${index === 0}"
    >
      ${label}
    </button>
  `).join('');

  $('#projectReadinessTable').innerHTML = documents.length
    ? `
      <div class="mc-project-table-wrap">
        <table class="mc-project-table">
          <thead>
            <tr>
              <th scope="col">Document</th>
              <th scope="col">Type</th>
              <th scope="col">Library</th>
              <th scope="col">Status</th>
              <th scope="col">Sections</th>
              <th scope="col">Modified</th>
            </tr>
          </thead>
          <tbody>
            ${documents.map(document => {
              const status = documentStatus(document);
              const library = libraries.find(item =>
                item.id === document.libraryId
              );
              const modifiedAt = documentModifiedAt(document);

              return `
                <tr data-project-readiness="${status.className}">
                  <th scope="row">${esc(document.title || document.name)}</th>
                  <td>${esc(documentType(document))}</td>
                  <td>${library ? esc(library.name) : 'Unavailable'}</td>
                  <td>
                    <span class="mc-project-status ${status.className}">
                      ${esc(status.label)}
                    </span>
                  </td>
                  <td>${fmt(document.sectionCount)}</td>
                  <td>${modifiedAt ? esc(modifiedAt) : 'Unavailable'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div id="projectReadinessEmpty" class="mc-project-empty" hidden>
        No documents match this readiness filter.
      </div>
    `
    : `
      <div class="mc-project-empty">
        <strong>No documents</strong>
        <p>Add project documents to begin evaluating knowledge readiness.</p>
      </div>
    `;

  const attentionItems = projectAttentionItems(
    snapshot,
    libraries,
    documents
  );

  $('#projectAttention').innerHTML = attentionItems.length
    ? `
      <ul class="mc-project-attention-list">
        ${attentionItems.map((item, index) => `
          <li>
            <p>${esc(item.text)}</p>
            <button
              type="button"
              data-project-attention="${index}"
            >
              ${esc(item.action)}
            </button>
          </li>
        `).join('')}
      </ul>
      <p class="mc-project-scope-note">
        These items reflect application state, not a substantive review of
        project content.
      </p>
    `
    : `
      <div class="mc-project-clear">
        <strong>No immediate knowledge-readiness issues were detected.</strong>
        <p>
          This reflects system state, not a substantive review of project
          content.
        </p>
      </div>
    `;

  const nextActions = projectNextActions(
    snapshot,
    libraries,
    documents
  );

  $('#projectActions').innerHTML = nextActions.length
    ? nextActions.map((action, index) => `
      <button type="button" data-project-action="${index}">
        <strong>${esc(action.label)}</strong>
        <span>${esc(action.detail)}</span>
      </button>
    `).join('')
    : `
      <div class="mc-project-empty">
        No interface guidance is available for the current state.
      </div>
    `;

  $$('[data-project-library]').forEach(button => {
    button.onclick = () => {
      engine.setLibrary(button.dataset.projectLibrary);
      selectedDoc = null;
      show('knowledge');
    };
  });

  $$('[data-project-filter]').forEach(button => {
    button.onclick = () => {
      const filter = button.dataset.projectFilter;
      let visibleRows = 0;

      $$('[data-project-filter]').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });

      $$('[data-project-readiness]').forEach(row => {
        const visible =
          filter === 'all' ||
          row.dataset.projectReadiness === filter;

        row.hidden = !visible;
        visibleRows += visible ? 1 : 0;
      });

      if ($('#projectReadinessEmpty')) {
        $('#projectReadinessEmpty').hidden = visibleRows > 0;
      }
    };
  });

  $$('[data-project-attention]').forEach(button => {
    button.onclick = () => {
      const item = attentionItems[Number(button.dataset.projectAttention)];

      if (item.libraryId) {
        engine.setLibrary(item.libraryId);
        selectedDoc = null;
      }

      show(item.view);
    };
  });

  $$('[data-project-action]').forEach(button => {
    button.onclick = () => {
      const action = nextActions[Number(button.dataset.projectAction)];
      show(action.view);
    };
  });
}

function renderDocuments(
  documents,
  allSections = [],
  libraries = [],
  selectedEntry = null
) {
  const query = $('#documentFilter').value.trim();

  $('#documents').innerHTML = documents.length
    ? documents.map(document => {
        const status = documentStatus(document);
        const pageCount = documentPageCount(document);
        const modifiedAt = documentModifiedAt(document);
        const catalogSection = documentCatalogSection(document);
        const library = libraries.find(item =>
          item.id === document.libraryId
        );
        const extractedSections = allSections.filter(section =>
          section.documentId === document.id
        ).length;

        return `
        <article
          class="doc mc-knowledge-document
            ${document.id === selectedDoc ? 'selected' : ''}"
          data-document-row="${document.id}"
        >
          <button
            type="button"
            class="mc-knowledge-document-select"
            data-document-select="${document.id}"
            aria-pressed="${document.id === selectedDoc}"
          >
            <span class="file-icon">
              ${(
                document.extension ||
                document.name.split('.').pop() ||
                'DOC'
              )
                .toUpperCase()
                .slice(0, 4)}
            </span>

            <span class="doc-main">
              <span class="mc-knowledge-document-title">
                ${esc(document.title || document.name)}
              </span>
              <span class="mc-knowledge-document-chips">
                <span>${esc(documentType(document))}</span>
                <span>${esc(catalogSection)}</span>
                ${library
                  ? `<span>${esc(library.name)}</span>`
                  : ''}
                ${pageCount
                  ? `<span>${fmt(pageCount)} page${pageCount === 1 ? '' : 's'}</span>`
                  : ''}
                <span>${fmt(extractedSections)} sections</span>
                ${Number(document.size) > 0
                  ? `<span>${formatBytes(document.size)}</span>`
                  : ''}
              </span>
              ${modifiedAt
                ? `<small>Last modified ${esc(modifiedAt)}</small>`
                : ''}
            </span>

            <span class="mc-knowledge-status ${status.className}">
              ${esc(status.label)}
            </span>
          </button>

          <div class="mc-knowledge-document-actions">
            <button
              type="button"
              class="subtle"
              data-inspect="${document.id}"
            >
              Inspect source
            </button>

            <button
              type="button"
              class="danger"
              data-remove="${document.id}"
            >
              Remove
            </button>
          </div>
        </article>
      `;
      }).join('')
    : `
      <div class="mc-library-browser-empty">
        <strong>
          ${query
            ? 'No matching documents'
            : selectedEntry?.name === 'Uncategorized'
              ? 'No uncategorized documents'
              : selectedEntry?.name === 'All Knowledge'
                ? 'No documents loaded'
                : 'This catalog section is empty'}
        </strong>
        <span>
          ${query
            ? 'No documents in the selected section match the local search.'
            : selectedEntry?.name === 'All Knowledge'
              ? 'Use Add documents to begin building project knowledge.'
              : 'Choose All Knowledge or another catalog section.'}
        </span>
      </div>
    `;

  $$('[data-document-select]').forEach(button => {
    button.onclick = async () => {
      selectedDoc = button.dataset.documentSelect;
      if (sourceNavigationTarget?.documentId !== selectedDoc) {
        sourceNavigationTarget = null;
        sourceNavigationNotice = '';
      }

      const document = documents.find(item => item.id === selectedDoc);
      if (document) await activateEngineeringContext({
        projectId: state().activeProject,
        libraryId: document.libraryId,
        documentId: document.id,
        source: CONTEXT_ACTIVATION_SOURCES.knowledgeCatalog
      });

      renderDocumentMetadata(
        document,
        allSections
      );

      renderDocuments(
        documents,
        allSections,
        libraries,
        selectedEntry
      );
    };
  });

  $$('[data-remove]').forEach(button => {
    button.onclick = async () => {
      if (
        confirm(
          'Remove this document and all indexed sections?'
        )
      ) {
        await engine.removeDocument(
          button.dataset.remove
        );

        if (selectedDoc === button.dataset.remove) {
          selectedDoc = null;
        }

        refresh();
      }
    };
  });

  $$('[data-inspect]').forEach(button => {
    button.onclick = () => {
      selectedDoc = button.dataset.inspect;
      show('sources');
    };
  });

  renderDocumentMetadata(
    documents.find(document =>
      document.id === selectedDoc
    ),
    allSections
  );
}

function renderCatalogCoverage() {
  const context = knowledgeCatalogContext;

  $('#documentDetailsEyebrow').textContent = 'CATALOG COVERAGE';
  $('#documentDetailsTitle').textContent = 'Section Coverage';

  if (!context?.selectedEntry) {
    $('#documentMetadata').innerHTML = `
      <div class="mc-library-browser-empty">
        <strong>Catalog coverage unavailable</strong>
        <span>No current catalog section is available.</span>
      </div>
    `;
    return;
  }

  const entry = context.selectedEntry;
  const typeRows = ['PDF', 'Word', 'Excel', 'Images', 'Text', 'Web/HTML', 'Other']
    .map(name => ({
      count: entry.documents.filter(document =>
        knowledgeTypeGroup(document) === name
      ).length,
      name
    }))
    .filter(type => type.count > 0);
  const missingCategory = entry.documents.filter(document =>
    !safeText(document.category).trim() &&
    !preferredText(
      document.metadata?.category,
      document.metadata?.documentCategory,
      document.metadata?.knowledgeSection
    ).trim() &&
    !(Array.isArray(document.tags) && document.tags.length) &&
    !(Array.isArray(document.metadata?.tags) && document.metadata.tags.length)
  ).length;
  const enabledEmptyLibraries = context.libraries.filter(library =>
    library.enabled &&
    !context.catalog.all.documents.some(document =>
      document.libraryId === library.id
    )
  );
  const disabledWithDocuments = context.libraries.filter(library =>
    !library.enabled &&
    entry.documents.some(document =>
      document.libraryId === library.id
    )
  );
  const attention = [
    entry.pending.length
      ? `${entry.pending.length} pending document${entry.pending.length === 1 ? '' : 's'}`
      : '',
    entry.unavailable.length
      ? `${entry.unavailable.length} unavailable document${entry.unavailable.length === 1 ? '' : 's'}`
      : '',
    entry.unknown.length
      ? `${entry.unknown.length} unrecognized document status${entry.unknown.length === 1 ? '' : 'es'}`
      : '',
    entry.indexedWithoutSections.length
      ? `${entry.indexedWithoutSections.length} indexed document${entry.indexedWithoutSections.length === 1 ? '' : 's'} with zero exposed sections`
      : '',
    entry.documents.length && entry.exposedSections === 0
      ? 'No indexed sections are exposed for this catalog section'
      : '',
    missingCategory
      ? `${missingCategory} document${missingCategory === 1 ? '' : 's'} without category metadata`
      : '',
    ...enabledEmptyLibraries.map(library =>
      `${library.name} is enabled with no documents`
    ),
    ...disabledWithDocuments.map(library =>
      `${library.name} is disabled and contributes documents`
    )
  ].filter(Boolean);

  $('#documentMetadata').innerHTML = `
    <header class="mc-library-coverage-header">
      <span>SELECTED CATALOG SECTION</span>
      <h3>${esc(entry.name)}</h3>
      <p>
        ${fmt(entry.documents.length)} document${entry.documents.length === 1 ? '' : 's'}
        across ${fmt(entry.libraries.length)} contributing
        ${entry.libraries.length === 1 ? 'library' : 'libraries'}.
      </p>
    </header>

    <section class="mc-library-coverage-metrics">
      <article><span>Documents</span><strong>${fmt(entry.documents.length)}</strong></article>
      <article><span>Indexed</span><strong>${fmt(entry.indexed.length)}</strong></article>
      <article><span>Pending</span><strong>${fmt(entry.pending.length)}</strong></article>
      <article><span>Unavailable</span><strong>${fmt(entry.unavailable.length)}</strong></article>
      <article><span>Sections</span><strong>${fmt(entry.exposedSections)}</strong></article>
    </section>

    <section class="mc-library-coverage-section">
      <h4>File-type breakdown</h4>
      ${typeRows.length
        ? `
          <ul class="mc-library-coverage-types">
            ${typeRows.map(type => `
              <li>
                <span>${esc(type.name)}</span>
                <strong>${fmt(type.count)}</strong>
              </li>
            `).join('')}
          </ul>
        `
        : `
          <div class="mc-library-empty">
            File-type coverage unavailable.
          </div>
        `}
    </section>

    <section class="mc-library-coverage-section">
      <h4>Contributing libraries</h4>
      ${entry.libraries.length
        ? `
          <ul class="mc-library-contributors">
            ${entry.libraries.map(library => `
              <li>
                <span>${esc(library.name)}</span>
                <strong>${library.enabled ? 'Enabled' : 'Disabled'}</strong>
              </li>
            `).join('')}
          </ul>
        `
        : `
          <div class="mc-library-empty">No contributing libraries.</div>
        `}
    </section>

    <section class="mc-library-coverage-section">
      <h4>Attention</h4>
      ${attention.length
        ? `
          <ul class="mc-library-coverage-attention">
            ${attention.map(item => `<li>${esc(item)}</li>`).join('')}
          </ul>
        `
        : `
          <p class="mc-library-clear">
            No immediate catalog-tracking items were detected.
          </p>
        `}
    </section>
  `;
}

function renderDocumentMetadata(document, allSections = []) {
  if (!document) {
    renderCatalogCoverage();
    return;
  }

  const sections = allSections
    .filter(section => section.documentId === document.id)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const status = documentStatus(document);
  const pageCount = documentPageCount(document);
  const modifiedAt = documentModifiedAt(document);
  const summary = preferredText(
    document.summary,
    document.metadata?.summary,
    document.description,
    document.metadata?.description
  );
  const tags = Array.isArray(document.tags)
    ? [...document.tags]
    : [];
  const metadataTags = Array.isArray(document.metadata?.tags)
    ? document.metadata.tags
    : [];
  const allTags = [...new Set(
    [...tags, ...metadataTags]
      .map(tag => safeText(tag).trim())
      .filter(Boolean)
  )];
  const library = engine.libraries().find(
    item => item.id === document.libraryId
  );
  const allDocuments =
    knowledgeCatalogContext?.catalog?.all?.documents || [];
  const extraction = verifyExtraction(
    document,
    allSections,
    allDocuments
  );
  const objectSourceResolution = sourceNavigationTarget?.destination === 'knowledge' &&
    sourceNavigationTarget.documentId === document.id
    ? resolveSourceTarget(sourceNavigationTarget, {
        projects: state().projects,
        libraries: engine.libraries(),
        documents: allDocuments,
        sections: allSections
      })
    : null;
  const specificationResolution = sourceNavigationTarget?.destination === 'knowledge' &&
    sourceNavigationTarget.documentId === document.id
    ? resolveSpecificationNavigationTarget(sourceNavigationTarget, {
        projects: state().projects,
        libraries: engine.libraries(),
        documents: allDocuments,
        sections: allSections
      })
    : null;
  const rfiResolution = sourceNavigationTarget?.destination === 'rfi' &&
    sourceNavigationTarget.documentId === document.id
    ? resolveRfiNavigationTarget(sourceNavigationTarget, {
        projects: state().projects,
        libraries: engine.libraries(),
        documents: allDocuments,
        sections: allSections
      })
    : null;
  const submittalResolution = sourceNavigationTarget?.destination === 'submittal' &&
    sourceNavigationTarget.documentId === document.id
    ? resolveSubmittalNavigationTarget(sourceNavigationTarget, {
        projects: state().projects,
        libraries: engine.libraries(),
        documents: allDocuments,
        sections: allSections
      })
    : null;
  const objectTargetSection = submittalResolution?.section || rfiResolution?.section || specificationResolution?.section || (objectSourceResolution?.status === 'section'
    ? objectSourceResolution.section
    : null);
  const objectRelationshipModel = buildKnowledgeRelationships({
    documents: allDocuments,
    sections: allSections
  });
  const objectRelationshipContext = relationshipContext(
    objectRelationshipModel,
    {
      documentId: document.id,
      sectionId: objectTargetSection?.id || ''
    }
  );
  const objectLineageModel = buildDocumentLineage({
    documents: allDocuments,
    sections: allSections
  });
  const objectLineage = lineageForDocument(objectLineageModel, document.id);
  const objectExplicitReferences = objectTargetSection
    ? objectRelationshipContext.references.length
    : objectRelationshipModel.explicitReferences.filter(edge =>
        edge.sourceDocumentId === document.id
      ).length;
  const objectReverseReferences = objectTargetSection
    ? objectRelationshipContext.referencedBy.length
    : objectRelationshipModel.reverseReferences.filter(edge =>
        edge.sourceDocumentId === document.id
      ).length;
  const normalizedTags = new Set(
    allTags.map(tag => tag.toLowerCase())
  );
  const category = safeText(document.category).trim();
  const relationships = allDocuments
    .filter(candidate => candidate.id !== document.id)
    .map(candidate => {
      const reasons = [];
      const candidateTags = [
        ...(Array.isArray(candidate.tags) ? candidate.tags : []),
        ...(Array.isArray(candidate.metadata?.tags)
          ? candidate.metadata.tags
          : [])
      ].map(tag => safeText(tag).trim()).filter(Boolean);
      const sharedTags = candidateTags.filter(tag =>
        normalizedTags.has(tag.toLowerCase())
      );

      if (
        document.libraryId &&
        candidate.libraryId === document.libraryId
      ) {
        reasons.push('Same library');
      }

      if (
        category &&
        safeText(candidate.category).trim() === category
      ) {
        reasons.push('Same category');
      }

      if (sharedTags.length) {
        reasons.push(`Shared ${sharedTags.length === 1 ? 'tag' : 'tags'}: ${sharedTags.join(', ')}`);
      }

      return {
        document: candidate,
        reasons
      };
    })
    .filter(relationship => relationship.reasons.length);
  const optionalCount = (...values) => {
    const value = values.find(item =>
      item !== null &&
      item !== undefined &&
      item !== '' &&
      Number.isFinite(Number(item)) && Number(item) >= 0
    );

    return value === undefined ? null : Number(value);
  };
  const tableCount = optionalCount(
    document.tableCount,
    document.metadata?.tableCount,
    Array.isArray(document.tables) ? document.tables.length : undefined
  );
  const imageCount = optionalCount(
    document.imageCount,
    document.metadata?.imageCount,
    Array.isArray(document.images) ? document.images.length : undefined
  );
  const attachmentCount = optionalCount(
    document.attachmentCount,
    document.metadata?.attachmentCount,
    Array.isArray(document.attachments)
      ? document.attachments.length
      : undefined
  );
  const createdAt = preferredText(
    document.createdAt,
    document.metadata?.createdAt
  );
  const updatedAt = preferredText(
    document.updatedAt,
    document.metadata?.updatedAt
  );
  const indexedAt = preferredText(document.indexedAt);
  const formatTimestamp = value => {
    const date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleString()
      : 'Unavailable';
  };
  const metadataIncomplete = !(
    document.id &&
    document.name &&
    documentType(document) !== 'Type unavailable' &&
    category &&
    library
  );
  const healthIndicators = [
    {
      className: status.className,
      label: status.label
    },
    ...(metadataIncomplete
      ? [{
          className: 'attention',
          label: 'Metadata incomplete'
        }]
      : []),
    ...(!sections.length
      ? [{
          className: 'attention',
          label: 'Sections unavailable'
        }]
      : [])
  ];
  const availability = status.className === 'unavailable'
    ? 'Document unavailable'
    : !library
      ? 'Source library unavailable'
      : !library.enabled
        ? 'Source library disabled'
        : 'Available in Knowledge Workspace';

  $('#documentDetailsEyebrow').textContent = 'KNOWLEDGE OBJECT';
  $('#documentDetailsTitle').textContent = 'Knowledge Object';
  $('#documentMetadata').innerHTML = `
    <div class="mc-object-inspector">
    ${(objectSourceResolution || rfiResolution || submittalResolution)
      ? `
        <nav class="mc-source-target-return" aria-label="Source navigation">
          <strong>Evidence source context</strong>
          <div>
            <button type="button" data-source-return-evidence>Back to Evidence Explorer</button>
            ${sourceNavigationTarget.originatingWorkspace === 'relationships'
              ? '<button type="button" data-source-return-relationships>Back to Relationship Explorer</button>'
              : ''}
            ${sourceNavigationTarget.originatingWorkspace === 'revisions'
              ? '<button type="button" data-source-return-revisions>Back to Revision Review</button>'
              : ''}
            ${sourceNavigationTarget.originatingMessageId && state().chat.some(message => message.id === sourceNavigationTarget.originatingMessageId)
              ? '<button type="button" class="subtle" data-source-return-answer>Back to Answer</button>'
              : ''}
            <button type="button" class="subtle" data-source-open-inspector>Open in Source Inspector</button>
          </div>
        </nav>
      `
      : ''}
    <header class="mc-object-header">
      <div class="mc-object-header-actions">
        <span>READ-ONLY KNOWLEDGE OBJECT</span>
        <button
          type="button"
          id="backToCatalogCoverage"
          class="subtle"
        >
          Back to Catalog
        </button>
      </div>
      <h3>${esc(document.title || document.name)}</h3>
      <div class="mc-object-health" aria-label="Knowledge health">
        ${healthIndicators.map(indicator => `
          <span class="${esc(indicator.className)}">
            ${esc(indicator.label)}
          </span>
        `).join('')}
      </div>
    </header>

    ${rfiResolution ? `
      <section class="mc-object-section" aria-labelledby="objectRfiTitle">
        <h4 id="objectRfiTitle">Exact RFI</h4>
        <div class="mc-object-structure">
          <article><span>Record</span><strong>${esc(rfiResolution.recordNumber || 'Unavailable')}</strong></article>
          <article><span>Status</span><strong>${esc(rfiResolution.explicitStatus || 'Unavailable')}</strong></article>
          <article><span>Category</span><strong>${esc(rfiResolution.category || 'Unavailable')}</strong></article>
          <article><span>Type</span><strong>${esc(rfiResolution.type || 'Unavailable')}</strong></article>
        </div>
        <dl class="mc-object-facts mc-object-facts-compact">
          <div><dt>Title</dt><dd>${esc(rfiResolution.title || document.title || document.name)}</dd></div>
          <div><dt>Hierarchy</dt><dd>${esc(rfiResolution.hierarchy.join(' › ') || 'Unavailable')}</dd></div>
          <div><dt>Provenance</dt><dd>${esc(rfiResolution.provenance || 'Unavailable')}</dd></div>
          <div><dt>Tags</dt><dd>${rfiResolution.tags.length ? esc(rfiResolution.tags.join(', ')) : 'Unavailable'}</dd></div>
        </dl>
        ${rfiResolution.section ? `
          <div class="mc-object-structure">
            <article><span>Section number</span><strong>${esc(sectionNumberKey(rfiResolution.section) || 'Unavailable')}</strong></article>
            <article><span>Section title</span><strong>${esc(sectionHeadingValue(rfiResolution.section) || 'Unavailable')}</strong></article>
          </div>
          <pre>${esc(rfiResolution.sectionText || sectionTextValue(rfiResolution.section))}</pre>
        ` : ''}
        ${rfiResolution.notice ? `
          <div class="mc-source-target-unavailable" role="status">
            <strong>RFI unavailable</strong>
            <span>${esc(rfiResolution.notice)}</span>
          </div>
        ` : ''}
      </section>
    ` : ''}

    ${submittalResolution ? `
      <section class="mc-object-section" aria-labelledby="objectSubmittalTitle">
        <h4 id="objectSubmittalTitle">Exact Submittal</h4>
        <div class="mc-object-structure">
          <article><span>Record</span><strong>${esc(submittalResolution.recordNumber || 'Unavailable')}</strong></article>
          <article><span>Status</span><strong>${esc(submittalResolution.explicitStatus || 'Unavailable')}</strong></article>
          <article><span>Category</span><strong>${esc(submittalResolution.category || 'Unavailable')}</strong></article>
          <article><span>Type</span><strong>${esc(submittalResolution.type || 'Unavailable')}</strong></article>
        </div>
        <dl class="mc-object-facts mc-object-facts-compact">
          <div><dt>Title</dt><dd>${esc(submittalResolution.title || document.title || document.name)}</dd></div>
          <div><dt>Hierarchy</dt><dd>${esc(submittalResolution.hierarchy.join(' › ') || 'Unavailable')}</dd></div>
          <div><dt>Provenance</dt><dd>${esc(submittalResolution.provenance || 'Unavailable')}</dd></div>
          <div><dt>Tags</dt><dd>${submittalResolution.tags.length ? esc(submittalResolution.tags.join(', ')) : 'Unavailable'}</dd></div>
        </dl>
        ${submittalResolution.section ? `
          <div class="mc-object-structure">
            <article><span>Section number</span><strong>${esc(sectionNumberKey(submittalResolution.section) || 'Unavailable')}</strong></article>
            <article><span>Section title</span><strong>${esc(sectionHeadingValue(submittalResolution.section) || 'Unavailable')}</strong></article>
          </div>
          <pre>${esc(submittalResolution.sectionText || sectionTextValue(submittalResolution.section))}</pre>
        ` : ''}
        ${submittalResolution.notice ? `
          <div class="mc-source-target-unavailable" role="status">
            <strong>Submittal unavailable</strong>
            <span>${esc(submittalResolution.notice)}</span>
          </div>
        ` : ''}
      </section>
    ` : ''}

    <section class="mc-object-section" aria-labelledby="objectIdentityTitle">
      <h4 id="objectIdentityTitle">Identity</h4>
      <dl class="mc-object-facts">
        <div><dt>Title</dt><dd>${esc(document.title || document.name)}</dd></div>
        <div><dt>Original filename</dt><dd>${esc(document.name)}</dd></div>
        <div><dt>Document type</dt><dd>${esc(documentType(document))}</dd></div>
        <div><dt>Category</dt><dd>${category ? esc(category) : 'Unavailable'}</dd></div>
        <div><dt>Library</dt><dd>${library ? esc(library.name) : 'Unavailable'}</dd></div>
        <div><dt>Unique identifier</dt><dd>${document.id ? esc(document.id) : 'Unavailable'}</dd></div>
      </dl>
    </section>

    <section class="mc-object-section" aria-labelledby="objectClassificationTitle">
      <h4 id="objectClassificationTitle">Classification</h4>
      <div class="mc-object-chips">
        <span>${esc(documentCatalogSection(document))}</span>
        <span>${esc(knowledgeTypeGroup(document))}</span>
        <span>${esc(status.label)}</span>
        ${allTags.map(tag => `<span>${esc(tag)}</span>`).join('')}
      </div>
      <dl class="mc-object-facts mc-object-facts-compact">
        <div><dt>Knowledge section</dt><dd>${esc(documentCatalogSection(document))}</dd></div>
        <div><dt>File type</dt><dd>${esc(documentType(document))}</dd></div>
        <div><dt>Tags</dt><dd>${allTags.length ? esc(allTags.join(', ')) : 'Unavailable'}</dd></div>
      </dl>
    </section>

    <section class="mc-object-section" aria-labelledby="objectSourceTitle">
      <h4 id="objectSourceTitle">Source</h4>
      <dl class="mc-object-facts mc-object-facts-compact">
        <div><dt>Source library</dt><dd>${library ? esc(library.name) : 'Unavailable'}</dd></div>
        <div><dt>Filename</dt><dd>${esc(document.name)}</dd></div>
        <div><dt>MIME/type</dt><dd>${document.type ? esc(document.type) : 'Unavailable'}</dd></div>
        <div><dt>File size</dt><dd>${Number(document.size) > 0 ? formatBytes(document.size) : 'Unavailable'}</dd></div>
        ${document.path
          ? `<div><dt>Source path</dt><dd>${esc(document.path)}</dd></div>`
          : ''}
      </dl>
    </section>

    <section class="mc-object-section" aria-labelledby="objectIndexTitle">
      <h4 id="objectIndexTitle">Index Status</h4>
      <dl class="mc-object-facts mc-object-facts-compact">
        <div><dt>Status</dt><dd>${esc(status.label)}</dd></div>
        <div><dt>Exposed sections</dt><dd>${fmt(sections.length)}</dd></div>
        <div><dt>Recorded section count</dt><dd>${fmt(document.sectionCount)}</dd></div>
        <div><dt>Characters</dt><dd>${Number(document.characterCount) > 0 ? fmt(document.characterCount) : 'Unavailable'}</dd></div>
        <div><dt>Hierarchy version</dt><dd>${esc(document.hierarchyVersion ?? 'Unavailable')}</dd></div>
        ${document.healthDetail
          ? `<div class="mc-object-fact-wide"><dt>Production detail</dt><dd>${esc(document.healthDetail)}</dd></div>`
          : ''}
      </dl>
    </section>

    <section class="mc-object-section mc-extraction-object-summary" aria-labelledby="objectExtractionTitle">
      <div class="mc-extraction-object-heading">
        <h4 id="objectExtractionTitle">Extraction Health</h4>
        <button type="button" id="openObjectSourceInspector" class="subtle">
          Open Source Inspector
        </button>
      </div>
      <div class="mc-source-health-status ${esc(extraction.verificationStatus.toLowerCase().replace(/\s+/g, '-'))}">
        <strong>${esc(extraction.verificationStatus)}</strong>
        <span>${esc(extraction.retrievalReadiness)}</span>
      </div>
      <dl class="mc-object-facts mc-object-facts-compact">
        <div><dt>Usable text</dt><dd>${extraction.usableText ? 'Available' : 'Unavailable'}</dd></div>
        <div><dt>Actual indexed sections</dt><dd>${fmt(extraction.sections.length)}</dd></div>
        <div><dt>Warnings</dt><dd>${fmt(extraction.warningCount)}</dd></div>
        <div><dt>Failed checks</dt><dd>${fmt(extraction.failCount)}</dd></div>
      </dl>
    </section>

    <section class="mc-object-section mc-lineage-object-summary" aria-labelledby="objectLineageTitle">
      <div class="mc-lineage-object-heading">
        <h4 id="objectLineageTitle">Version Information</h4>
        <button type="button" class="subtle" data-object-lineage>Open Version Explorer</button>
      </div>
      <div class="mc-lineage-status ${esc(objectLineage.record?.status || 'unknown')}">
        <strong>${esc((objectLineage.record?.status || 'unknown').toUpperCase())}</strong>
        <span>${objectLineage.record?.lineageId ? `Lineage ${esc(objectLineage.record.lineageId)}` : 'No explicit lineage metadata'}</span>
      </div>
      <dl class="mc-object-facts mc-object-facts-compact">
        <div><dt>Current document</dt><dd>${objectLineage.current?.documentId ? esc(objectLineage.current.documentId) : 'Unknown'}</dd></div>
        <div><dt>Previous versions</dt><dd>${fmt(objectLineage.chain?.previous.length || 0)}</dd></div>
        <div><dt>Duplicates</dt><dd>${fmt(objectLineage.chain?.duplicates.length || 0)}</dd></div>
      </dl>
    </section>

    <section class="mc-object-section" aria-labelledby="objectSummaryTitle">
      <h4 id="objectSummaryTitle">Content Summary</h4>
      ${summary
        ? `<p>${esc(summary)}</p>`
        : `
          <div class="mc-object-empty">
            No content summary is available in production state.
          </div>
        `}
    </section>

    ${objectTargetSection && (specificationResolution?.section || rfiResolution?.section || submittalResolution?.section) ? `
      <section class="mc-object-section mc-object-section-wide" aria-labelledby="objectSectionTitle">
        <h4 id="objectSectionTitle">${submittalResolution ? 'Exact Submittal Section' : rfiResolution ? 'Exact RFI Section' : 'Exact Specification Section'}</h4>
        <div class="mc-object-structure">
          <article><span>Section number</span><strong>${esc(submittalResolution ? sectionNumberKey(submittalResolution.section) || 'Unavailable' : rfiResolution ? sectionNumberKey(rfiResolution.section) || 'Unavailable' : specificationResolution.sectionNumber || 'Unavailable')}</strong></article>
          <article><span>Title</span><strong>${esc(submittalResolution ? sectionHeadingValue(submittalResolution.section) || 'Unavailable' : rfiResolution ? sectionHeadingValue(rfiResolution.section) || 'Unavailable' : specificationResolution.sectionTitle || 'Unavailable')}</strong></article>
          <article><span>Path</span><strong>${esc(submittalResolution ? submittalResolution.hierarchy.join(' › ') || 'Unavailable' : rfiResolution ? rfiResolution.hierarchy.join(' › ') || 'Unavailable' : specificationResolution.sectionPath.join(' › ') || 'Unavailable')}</strong></article>
          <article><span>Provenance</span><strong>${esc(submittalResolution ? submittalResolution.provenance || 'Unavailable' : rfiResolution ? rfiResolution.provenance || 'Unavailable' : specificationResolution.sectionProvenance || 'Unavailable')}</strong></article>
        </div>
        <pre>${esc(submittalResolution ? submittalResolution.sectionText || sectionTextValue(objectTargetSection) : rfiResolution ? rfiResolution.sectionText || sectionTextValue(objectTargetSection) : specificationResolution.sectionText || sectionTextValue(objectTargetSection))}</pre>
        ${specificationResolution?.available && isSpecificationDocument(document) && Number(specificationResolution.target?.pageNumber) > 0 ? `<button type="button" data-specification-view-source-page="${fmt(specificationResolution.target.pageNumber)}">View Source Page</button>` : ''}
      </section>
    ` : ''}

    <section class="mc-object-section mc-object-section-wide" aria-labelledby="objectStructureTitle">
      <h4 id="objectStructureTitle">Structure</h4>
      <div class="mc-object-structure">
        <article><span>Pages</span><strong>${pageCount === null ? 'Unavailable' : fmt(pageCount)}</strong></article>
        <article><span>Sections</span><strong>${fmt(sections.length)}</strong></article>
        <article><span>Tables</span><strong>${tableCount === null ? 'Unavailable' : fmt(tableCount)}</strong></article>
        <article><span>Images</span><strong>${imageCount === null ? 'Unavailable' : fmt(imageCount)}</strong></article>
        <article><span>Attachments</span><strong>${attachmentCount === null ? 'Unavailable' : fmt(attachmentCount)}</strong></article>
      </div>
      ${sections.length
        ? `
          <ol class="mc-object-outline">
            ${sections.map((section, index) => `
              <li
                id="${sourceAnchorId('knowledge-section', section.id)}"
                class="${objectTargetSection?.id === section.id ? 'mc-section-highlight-active' : ''}"
                ${objectTargetSection?.id === section.id ? 'tabindex="-1" aria-current="true"' : ''}
              >
                ${objectTargetSection?.id === section.id
                  ? '<em class="mc-source-target-indicator">Evidence source</em>'
                  : ''}
                <strong>${esc(sectionHeadingValue(section, index))}</strong>
                ${Array.isArray(section.path) && section.path.length
                  ? `<small>${esc(section.path.map(safeText).join(' › '))}</small>`
                  : ''}
                ${sectionLocationValue(section)
                  ? `<span>${esc(sectionLocationValue(section))}</span>`
                  : ''}
                ${objectTargetSection?.id === section.id
                  ? `<pre>${esc(sectionTextValue(section))}</pre>`
                  : ''}
              </li>
            `).join('')}
          </ol>
        `
        : `
          <div class="mc-object-empty">
            No indexed sections are currently available.
          </div>
        `}
      ${objectSourceResolution?.status === 'missing-section' && sourceNavigationTarget?.sectionId
        ? `
          <div class="mc-source-target-unavailable" role="status">
            <strong>Source section unavailable</strong>
            <span>The document is available, but the exact stored section no longer exists.</span>
          </div>
        `
        : ''}
    </section>

    <section class="mc-object-section mc-object-section-wide mc-relationship-object-summary" aria-labelledby="objectRelationshipsTitle">
      <h4 id="objectRelationshipsTitle">Relationships</h4>
      <div class="mc-relationship-summary-grid">
        <article><span>Parent</span><strong>${objectRelationshipContext.parent ? '1' : '0'}</strong></article>
        <article><span>Children</span><strong>${fmt(objectRelationshipContext.children.length)}</strong></article>
        <article><span>References</span><strong>${fmt(objectExplicitReferences)}</strong></article>
        <article><span>Referenced by</span><strong>${fmt(objectReverseReferences)}</strong></article>
        <article><span>Related documents</span><strong>${fmt(objectRelationshipContext.relatedDocuments.length)}</strong></article>
        <article><span>Same division</span><strong>${fmt(objectRelationshipContext.sameDivision.length)}</strong></article>
        <article><span>Same library</span><strong>${fmt(objectRelationshipContext.sameLibrary.length)}</strong></article>
      </div>
      <button type="button" class="subtle mc-relationship-open" data-object-relationships>
        Open Relationship Explorer
      </button>
      <button type="button" class="subtle mc-engineering-open" data-object-engineering>
        Open Engineering Workspace
      </button>
      <button type="button" class="subtle mc-workflow-open" data-object-workflow>
        Open Workflow
      </button>
    </section>

    <section class="mc-object-section mc-object-section-wide" aria-labelledby="objectMetadataRelationshipsTitle">
      <h4 id="objectMetadataRelationshipsTitle">Existing Metadata Relationships</h4>
      ${relationships.length
        ? `
          <ul class="mc-object-relationships">
            ${relationships.map(relationship => `
              <li>
                <button
                  type="button"
                  data-related-object="${esc(relationship.document.id)}"
                >
                  <strong>${esc(relationship.document.title || relationship.document.name)}</strong>
                  <span>${esc(relationship.reasons.join(' · '))}</span>
                </button>
              </li>
            `).join('')}
          </ul>
        `
        : `
          <div class="mc-object-empty">
            No related knowledge objects are currently available.
          </div>
        `}
    </section>

    <section class="mc-object-section" aria-labelledby="objectTimelineTitle">
      <h4 id="objectTimelineTitle">Timeline</h4>
      <dl class="mc-object-timeline">
        <div><dt>Created</dt><dd>${esc(formatTimestamp(createdAt))}</dd></div>
        <div><dt>Modified</dt><dd>${modifiedAt ? esc(modifiedAt) : 'Unavailable'}</dd></div>
        <div><dt>Indexed</dt><dd>${esc(formatTimestamp(indexedAt))}</dd></div>
        <div><dt>Updated</dt><dd>${esc(formatTimestamp(updatedAt))}</dd></div>
      </dl>
    </section>

    <section class="mc-object-section" aria-labelledby="objectAvailabilityTitle">
      <h4 id="objectAvailabilityTitle">Availability</h4>
      <div class="mc-object-availability ${esc(status.className)}">
        <strong>${esc(availability)}</strong>
        <span>
          ${document.error
            ? esc(document.error)
            : library
              ? `Library is ${library.enabled ? 'enabled' : 'disabled'}.`
              : 'No matching production library is available.'}
        </span>
      </div>
    </section>
    </div>
  `;

  $('#backToCatalogCoverage').onclick = () => {
    if ([CONTEXT_ACTIVATION_SOURCES.knowledgeObjectDocument, CONTEXT_ACTIVATION_SOURCES.knowledgeObjectSection].includes(activeContextActivation?.source)) {
      clearActiveContext(CONTEXT_ACTIVATION_SOURCES.knowledgeObjectClose);
    }
    selectedDoc = null;
    renderKnowledgeWorkspace();
  };

  $('#openObjectSourceInspector').onclick = () => {
    selectedDoc = document.id;
    if (sourceNavigationTarget?.documentId === document.id) {
      sourceNavigationTarget = sourceNavigationDestination(
        sourceNavigationTarget,
        'sources'
      );
    }
    show('sources');
  };

  $('[data-source-return-evidence]')?.addEventListener(
    'click',
    returnToEvidenceExplorer
  );
  $('[data-source-return-answer]')?.addEventListener(
    'click',
    returnToOriginatingAnswer
  );
  $('[data-source-return-relationships]')?.addEventListener(
    'click',
    returnToRelationshipExplorer
  );
  $('[data-source-return-revisions]')?.addEventListener(
    'click',
    returnToRevisionReview
  );
  $('[data-source-open-inspector]')?.addEventListener('click', () => {
    sourceNavigationTarget = sourceNavigationDestination(
      sourceNavigationTarget,
      'sources'
    );
    show('sources');
  });
  $('[data-object-relationships]')?.addEventListener('click', () => {
    relationshipTarget = {
      ...relationshipNavigationTarget({
        documentId: document.id,
        sectionId: objectTargetSection?.id || ''
      }),
      projectId: state().activeProject,
      libraryId: document.libraryId,
      originatingMessageId: activeRetrievalSession?.messageId || '',
      evidenceId: selectedEvidenceId || ''
    };
    show('relationships');
  });
  $('[data-object-lineage]')?.addEventListener('click', () =>
    openVersionExplorer(document.id, activeRetrievalSession?.messageId || '')
  );
  $('[data-object-engineering]')?.addEventListener('click', () =>
    openEngineeringWorkspace({ documentId: document.id, sectionId: objectTargetSection?.id || '', libraryId: document.libraryId, origin: 'knowledge' })
  );
  $('[data-object-workflow]')?.addEventListener('click', () =>
    void seedWorkflowFromDocument(document.id, objectTargetSection?.id || '', 'knowledge')
  );
  $('[data-specification-view-source-page]')?.addEventListener('click', async event => {
    const exactPage = Number(event.currentTarget.dataset.specificationViewSourcePage) || 0;
    if (!exactPage || !specificationResolution?.available || !isSpecificationDocument(document)) return;
    const sectionNumber = specificationResolution.sectionNumber;
    const result = await openSpecificationDocument(sectionNumber, engine);
    if (!result) return;
    const { source, section } = result;
    specificationDrawingReturnTarget = captureDrawingSupportReturnState();
    
    // Create canvas
    const specContainer = document.createElement('div');
    specContainer.className = 'mc-specification-viewer-container';
    specContainer.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: white; z-index: 10000; display: flex; flex-direction: column;';
    
    const specHeader = document.createElement('div');
    specHeader.style.cssText = 'padding: 16px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;';
    specHeader.innerHTML = `
      <h2 style="margin: 0;">${esc(section.sectionTitle)}</h2>
      <span style="color: #666;">Section ${esc(section.sectionNumber)} · Page ${esc(exactPage)}</span>
      <button style="padding: 8px 16px; cursor: pointer;">Close</button>
    `;
    
    const specCanvasContainer = document.createElement('div');
    specCanvasContainer.style.cssText = 'flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 20px;';
    
    const specCanvas = document.createElement('canvas');
    specCanvas.style.cssText = 'max-width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.1);';
    
    specCanvasContainer.appendChild(specCanvas);
    specContainer.appendChild(specHeader);
    specContainer.appendChild(specCanvasContainer);
    document.body.appendChild(specContainer);
    
    specHeader.querySelector('button').addEventListener('click', () => {
      specContainer.remove();
    });
    
    await specificationSourceViewer.open({
      document: { id: section.documentId, name: 'Bedford Specifications' },
      sourceBlob: source.sourceBlob,
      pageNumber: exactPage,
      canvas: specCanvas
    });
  });

  if (objectTargetSection) {
    revealNavigationTarget(
      globalThis.document.getElementById(
        sourceAnchorId('knowledge-section', objectTargetSection.id)
      )
    );
  }

  $$('[data-related-object]').forEach(button => {
    button.onclick = () => {
      selectedKnowledgeSection = 'all';
      selectedDoc = button.dataset.relatedObject;
      renderKnowledgeWorkspace();
    };
  });
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1048576) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1048576).toFixed(1)} MB`;
}

async function renderSpecificationSourceEvidence() {
  const host = $('#specificationSourceEvidence');
  if (!host) return;
  host.innerHTML = '<div class="empty">Specification source evidence viewer removed. Use authoritative resolver instead.</div>';
}

async function renderSources() {
  const documents = await engine.documents();
  const sections = await engine.sections();

  $('#sourceDocs').innerHTML = `
    <div class="source-filter">
      <input
        id="sourceDocumentFilter"
        placeholder="Filter source documents…"
      >
    </div>
    <div id="sourceDocumentList"></div>
  `;

  const drawDocuments = () => {
    const query = (
      $('#sourceDocumentFilter')?.value ||
      ''
    )
      .trim()
      .toLowerCase();

    const shown = documents.filter(document =>
      `
        ${document.name}
        ${document.title || ''}
        ${document.category || ''}
      `
        .toLowerCase()
        .includes(query)
    );

    $('#sourceDocumentList').innerHTML = shown.length
      ? shown.map(document => {
          const extraction = verifyExtraction(
            document,
            sections,
            documents
          );

          return `
          <button
            class="source-doc
              ${document.id === selectedDoc ? 'active' : ''}"
            data-doc="${document.id}"
          >
            <span>
              <strong>
                ${esc(document.title || document.name)}
              </strong>
              <small>
                ${esc(document.category || 'General')}
                · ${esc(extraction.verificationStatus)}
              </small>
            </span>
            <b>${fmt(extraction.sections.length)}</b>
          </button>
        `;
        }).join('')
      : '<div class="empty">No documents match this filter. Clear or revise the filter to continue.</div>';

    $$('[data-doc]').forEach(button => {
      button.onclick = async () => {
        selectedDoc = button.dataset.doc;
        if (sourceNavigationTarget?.documentId !== selectedDoc) {
          sourceNavigationTarget = null;
          sourceNavigationNotice = '';
        }
        const document = documents.find(item => item.id === selectedDoc);
        if (document) await activateEngineeringContext({
          projectId: state().activeProject,
          libraryId: document.libraryId,
          documentId: document.id,
          source: CONTEXT_ACTIVATION_SOURCES.sourceInspectorDocument
        });
        renderSources();
      };
    });
  };

  $('#sourceDocumentFilter').oninput = drawDocuments;
  drawDocuments();

  const requestedDocument = selectedDoc
    ? documents.find(document => document.id === selectedDoc)
    : null;
  const selected = selectedDoc
    ? requestedDocument
    : documents[0];

  if (!selected) {
    $('#sourceDetail').innerHTML = selectedDoc
      ? `
        <div class="mc-section-preview-empty">
          The selected document is no longer available. Choose another
          source document to continue.
        </div>
      `
      : '<div class="empty">No indexed documents. Add documents in Knowledge Workspace, then return here to inspect extraction.</div>';
    selectedDoc = null;

    return;
  }

  selectedDoc = selected.id;

  const documentLabel = preferredText(
    selected.title,
    selected.name,
    'Untitled document'
  );

  const verification = verifyExtraction(
    selected,
    sections,
    documents
  );
  const selectedSections = verification.sections;
  const sourceLibraries = engine.libraries();
  const library = sourceLibraries.find(item =>
    item.id === selected.libraryId
  );
  const [sourceDrawingAnalysis, sourcePdfRecord] = isPdfDocument(selected)
    ? await Promise.all([isDrawingDocumentRole(selected) ? engine.drawingAnalysis(selected.id) : null, engine.sourceFile(selected.id)])
    : [null, null];
  const sourceTargetResolution = sourceNavigationTarget?.destination === 'sources' &&
    sourceNavigationTarget.documentId === selected.id
    ? resolveSourceTarget(sourceNavigationTarget, {
        projects: state().projects,
        libraries: sourceLibraries,
        documents,
        sections,
        analyses: sourceDrawingAnalysis ? [sourceDrawingAnalysis] : [],
        sourceFiles: sourcePdfRecord ? [sourcePdfRecord] : []
      })
    : null;
  const sourceRelationshipModel = buildKnowledgeRelationships({
    documents,
    sections
  });
  const sourceRelationshipContext = relationshipContext(
    sourceRelationshipModel,
    {
      documentId: selected.id,
      sectionId: sourceTargetResolution?.section?.id || ''
    }
  );
  const sourceDocumentReferences = sourceRelationshipModel.explicitReferences.filter(edge =>
    edge.sourceDocumentId === selected.id
  ).length;
  const sourceDocumentReferencedBy = sourceRelationshipModel.reverseReferences.filter(edge =>
    edge.sourceDocumentId === selected.id
  ).length;

  const sectionText = sectionTextValue;
  const sectionHeading = sectionHeadingValue;
  const sectionLocation = sectionLocationValue;
  const sectionSourceLabel = sectionSourceLabelValue;

  const totalWords = selectedSections.reduce(
    (total, section) =>
      total +
      (
        section.wordCount ??
        (sectionText(section).trim()
          ? sectionText(section).trim().split(/\s+/).length
          : 0)
      ),
    0
  );

  const emptySections = verification.emptySections.length;

  const shortSections = selectedSections.filter(section =>
    (section.characters || 0) < 120
  ).length;

  const duplicateHeadings = Object.entries(
    selectedSections.reduce(
      (map, section, index) => {
        const heading = sectionHeading(section, index);
        map[heading] =
          (map[heading] || 0) + 1;

        return map;
      },
      {}
    )
  ).filter(([, count]) =>
    count > 1
  ).length;

  const report = {
    document: selected.name,
    health: selected.health || 'warning',
    sections: selectedSections.length,
    characters: selected.characterCount || 0,
    words: totalWords,
    emptySections,
    untitledSections: verification.untitledSections.length,
    shortSections,
    duplicateHeadings,
    verificationStatus: verification.verificationStatus,
    retrievalReadiness: verification.retrievalReadiness,
    sectionCountMismatch: verification.sectionCountMismatch,
    generatedAt: new Date().toISOString()
  };
  const verificationClass = verification.verificationStatus
    .toLowerCase()
    .replace(/\s+/g, '-');
  const technicalDetails = [
    selected.error,
    selected.errorStack
  ].map(safeText).filter(Boolean).join('\n\n');

  $('#sourceDetail').innerHTML = `
    ${sourceTargetResolution
      ? `
        <nav class="mc-source-target-return" aria-label="Source navigation">
          <strong>Evidence source context</strong>
          <div>
            <button type="button" data-source-return-evidence>Back to Evidence Explorer</button>
            ${sourceNavigationTarget.originatingWorkspace === 'relationships'
              ? '<button type="button" data-source-return-relationships>Back to Relationship Explorer</button>'
              : ''}
            ${sourceNavigationTarget.originatingWorkspace === 'revisions'
              ? '<button type="button" data-source-return-revisions>Back to Revision Review</button>'
              : ''}
            ${sourceNavigationTarget.originatingMessageId && state().chat.some(message => message.id === sourceNavigationTarget.originatingMessageId)
              ? '<button type="button" class="subtle" data-source-return-answer>Back to Answer</button>'
              : ''}
            <button type="button" class="subtle" data-source-open-object>Back to Knowledge Object</button>
          </div>
        </nav>
      `
      : ''}
    <div class="source-title">
      <span>EXTRACTION VERIFICATION</span>
      <h2>${esc(documentLabel)}</h2>
      <p>
        ${esc(selected.name)}
        · ${esc(selected.category || 'General')}
      </p>
    </div>

    ${isDrawingDocumentRole(selected) ? `<section class="mc-drawing-source-status"><div><span>AUTHORITATIVE DRAWING SOURCE</span><h3>${sourcePdfRecord ? 'Original PDF available' : 'Original PDF unavailable'}</h3><p>${sourcePdfRecord ? `${fmt(sourceDrawingAnalysis?.sheets?.length || 0)} deterministic sheet records are available.` : 'Reattach the exact original PDF to enable visual sheet review. Extracted text remains available.'}</p></div>${sourcePdfRecord ? '<button data-source-open-drawing>Open Drawing</button>' : '<label class="mc-drawing-reattach"><input id="sourcePdfReattach" type="file" accept="application/pdf,.pdf">Reattach Original PDF</label>'}</section>` : isSpecificationDocument(selected) ? `<section class="mc-drawing-source-status"><div><span>AUTHORITATIVE SPECIFICATION SOURCE</span><h3>${sourcePdfRecord ? 'Source PDF available on demand' : 'Source PDF unavailable'}</h3><p>Specification sections and articles are the primary interface. Source pages load only through exact evidence navigation.</p></div></section>` : ''}

    <section class="mc-relationship-source-summary" aria-labelledby="sourceRelationshipTitle">
      <div>
        <span>EXPLICIT RELATIONSHIPS</span>
        <h3 id="sourceRelationshipTitle">Relationship Summary</h3>
      </div>
      <dl>
        <div><dt>Parent</dt><dd>${sourceRelationshipContext.parent ? '1' : '0'}</dd></div>
        <div><dt>Children</dt><dd>${fmt(sourceRelationshipContext.children.length)}</dd></div>
        <div><dt>References</dt><dd>${fmt(sourceTargetResolution?.section ? sourceRelationshipContext.references.length : sourceDocumentReferences)}</dd></div>
        <div><dt>Referenced by</dt><dd>${fmt(sourceTargetResolution?.section ? sourceRelationshipContext.referencedBy.length : sourceDocumentReferencedBy)}</dd></div>
      </dl>
      <button type="button" class="subtle" data-source-relationships>Open Relationship Explorer</button>
    </section>

    <section class="mc-extraction-overview" aria-labelledby="extractionOverviewTitle">
      <div class="mc-source-health-summary">
        <div>
          <span>EXTRACTION VERIFICATION</span>
          <h3 id="extractionOverviewTitle">${esc(verification.verificationStatus)}</h3>
          <p>${esc(verification.retrievalReadiness)}</p>
        </div>
        <div class="mc-source-health-actions">
          <button type="button" id="openSourceKnowledgeObject">
            Open Knowledge Object
          </button>
          <button type="button" id="reviewSourceValidation" class="subtle">
            Review Knowledge Validation
          </button>
        </div>
      </div>

      <div class="mc-source-health-status ${esc(verificationClass)}">
        <strong>${esc(verification.verificationStatus)}</strong>
        <span>
          ${verification.failCount
            ? `${fmt(verification.failCount)} failed check${verification.failCount === 1 ? '' : 's'}`
            : verification.warningCount
              ? `${fmt(verification.warningCount)} warning${verification.warningCount === 1 ? '' : 's'}`
              : 'No extraction issues detected'}
        </span>
      </div>

      <dl class="mc-extraction-facts">
        <div><dt>Filename</dt><dd>${esc(selected.name)}</dd></div>
        <div><dt>Library</dt><dd>${library ? esc(library.name) : 'Unavailable'}</dd></div>
        <div><dt>File type</dt><dd>${esc(documentType(selected))}</dd></div>
        <div><dt>Parser used</dt><dd>${verification.parser ? esc(verification.parser) : 'Unavailable'}</dd></div>
        <div><dt>Import status</dt><dd>${esc(documentStatus(selected).label)}</dd></div>
        <div><dt>Retrieval readiness</dt><dd>${esc(verification.retrievalReadiness)}</dd></div>
        <div><dt>Character count</dt><dd>${verification.recordedCharacters === null ? 'Unavailable' : fmt(verification.recordedCharacters)}</dd></div>
        <div><dt>Recorded sections</dt><dd>${verification.recordedSectionCount === null ? 'Unavailable' : fmt(verification.recordedSectionCount)}</dd></div>
        <div><dt>Stored sections</dt><dd>${fmt(verification.sections.length)}</dd></div>
        <div><dt>Non-empty sections</dt><dd>${fmt(verification.usableSections.length)}</dd></div>
        <div><dt>Empty sections</dt><dd>${fmt(verification.emptySections.length)}</dd></div>
        <div><dt>Untitled sections</dt><dd>${fmt(verification.untitledSections.length)}</dd></div>
        <div><dt>Hierarchy version</dt><dd>${selected.hierarchyVersion ?? 'Unavailable'}</dd></div>
        <div><dt>Page metadata</dt><dd>${verification.pageMetadataAvailable ? 'Available' : 'Unavailable'}</dd></div>
        ${isSpecificationDocument(selected) ? (() => { const counts = documentIndexCounts(selected, sections); return `<div><dt>Source pages</dt><dd>${fmt(counts.sourcePageCount)}</dd></div><div><dt>Retrieval chunks</dt><dd>${fmt(counts.retrievalChunkCount)}</dd></div><div><dt>CSI specification sections</dt><dd>${fmt(counts.specificationSectionCount)}</dd></div>`; })() : ''}
      </dl>

      ${verification.warnings.length
        ? `
          <div class="mc-extraction-warnings">
            <strong>Parser warnings</strong>
            <ul>
              ${verification.warnings.map(warning =>
                `<li>${esc(warning)}</li>`
              ).join('')}
            </ul>
          </div>
        `
        : ''}

      ${technicalDetails
        ? `
          <details class="mc-extraction-technical">
            <summary>View technical details</summary>
            <pre>${esc(technicalDetails)}</pre>
          </details>
        `
        : ''}
    </section>

    <section class="mc-extraction-check-section" aria-labelledby="extractionChecksTitle">
      <div class="mc-extraction-section-heading">
        <div>
          <span>EXPLICIT CONDITIONS</span>
          <h3 id="extractionChecksTitle">Extraction Checks</h3>
        </div>
      </div>
      <ul class="mc-extraction-checks">
        ${verification.checks.map(item => `
          <li>
            <span class="mc-extraction-badge ${item.status.toLowerCase()}">
              ${esc(item.status)}
            </span>
            <div>
              <strong>${esc(item.label)}</strong>
              <p>${esc(item.detail)}</p>
            </div>
          </li>
        `).join('')}
      </ul>
    </section>

    <div class="inspection-kpis">
      <article>
        <span>SECTIONS</span>
        <strong>${fmt(selectedSections.length)}</strong>
      </article>

      <article>
        <span>WORDS</span>
        <strong>${fmt(totalWords)}</strong>
      </article>

      <article>
        <span>CHARACTERS</span>
        <strong>${fmt(selected.characterCount)}</strong>
      </article>

      <article>
        <span>HEALTH</span>
        <strong class="health ${esc(selected.health || 'warning')}">
          ${esc((selected.health || 'warning').toUpperCase())}
        </strong>
      </article>
    </div>

    <section class="mc-section-preview" aria-labelledby="sectionPreviewTitle">
      <div class="mc-extraction-section-heading">
        <div>
          <span>STORED PLAIN TEXT</span>
          <h3 id="sectionPreviewTitle">Section Preview</h3>
        </div>
        <small>
          ${fmt(Math.min(verification.previews.length, 12))}
          of ${fmt(verification.previews.length)} shown
        </small>
      </div>
      ${verification.previews.length
        ? `
          <ol class="mc-section-preview-list">
            ${verification.previews.slice(0, 12).map(preview => `
              <li class="${preview.empty ? 'empty' : ''}">
                <div class="mc-section-preview-heading">
                  <strong>${esc(preview.title)}</strong>
                  <span>
                    ${preview.hierarchyLevel === null
                      ? 'Level unavailable'
                      : `Level ${fmt(preview.hierarchyLevel)}`}
                    · Order ${fmt(preview.order + 1)}
                    · ${fmt(preview.characters)} characters
                  </span>
                </div>
                ${preview.parentTitle
                  ? `<small>Parent: ${esc(preview.parentTitle)}</small>`
                  : ''}
                <p>
                  ${preview.empty
                    ? 'No usable text is stored for this section.'
                    : esc(preview.excerpt)}
                </p>
                ${preview.empty
                  ? '<em>EMPTY CONTENT</em>'
                  : ''}
              </li>
            `).join('')}
          </ol>
        `
        : `
          <div class="mc-section-preview-empty">
            No stored sections are available for this document.
          </div>
        `}
    </section>

    ${sourceTargetResolution?.status === 'missing-section' && sourceNavigationTarget?.sectionId
      ? `
        <div class="mc-source-target-unavailable" role="status">
          <strong>Source section unavailable</strong>
          <span>The document is available, but the exact stored section no longer exists.</span>
        </div>
      `
      : ''}

    <div class="inspection-toolbar">
      <input
        id="sectionFilter"
        placeholder="Search headings or extracted text…"
      >

      <select id="sectionLevel">
        <option value="">All levels</option>
        ${[1, 2, 3, 4, 5, 6]
          .map(level =>
            `<option value="${level}">Level ${level}</option>`
          )
          .join('')}
      </select>

      <button id="expandSections" class="subtle">Expand all</button>
      <button id="collapseSections" class="subtle">Collapse all</button>
      <button id="exportExtraction" class="subtle">Export selected branch</button>
    </div>

    <div class="extraction-report
      ${emptySections || shortSections ? 'attention' : 'healthy'}"
    >
      <strong>
        ${emptySections
          ? 'Extraction needs attention'
          : shortSections
            ? 'Review short sections'
            : 'Extraction verified'}
      </strong>

      <span>
        ${emptySections} empty
        · ${shortSections} short
        · ${duplicateHeadings} duplicate heading${duplicateHeadings === 1 ? '' : 's'}
      </span>
    </div>

    <div id="sectionResults"></div>
  `;

  $('#openSourceKnowledgeObject').onclick = () => {
    selectedKnowledgeSection = 'all';
    selectedDoc = selected.id;
    show('knowledge');
  };

  $('#reviewSourceValidation').onclick = () => {
    show('evaluate');
  };
  $('[data-source-open-drawing]')?.addEventListener('click', () => {
    drawingTarget = createDrawingTarget({ projectId: sourceDrawingAnalysis?.projectId || state().activeProject, documentId: selected.id, drawingSetId: sourceDrawingAnalysis?.drawingSetId, drawingId: sourceTargetResolution?.sheet?.drawingId, sheetId: sourceTargetResolution?.sheet?.sheetId, pageNumber: sourceTargetResolution?.sheet?.pageNumber || 1, observationId: sourceTargetResolution?.observation?.observationId, region: sourceTargetResolution?.observation?.region || sourceNavigationTarget?.region });
    void showMissionControlView('plans');
  });
  $('#sourcePdfReattach')?.addEventListener('change', async event => {
    if (!event.target.files?.[0]) return;
    try { const result = await engine.reattachPdfSource(selected.id, event.target.files[0]); if (!result.ok) alert(result.warning); else await renderSources(); }
    catch (error) { alert(error.message); }
  });

  $('[data-source-return-evidence]')?.addEventListener(
    'click',
    returnToEvidenceExplorer
  );
  $('[data-source-return-answer]')?.addEventListener(
    'click',
    returnToOriginatingAnswer
  );
  $('[data-source-return-relationships]')?.addEventListener(
    'click',
    returnToRelationshipExplorer
  );
  $('[data-source-return-revisions]')?.addEventListener(
    'click',
    returnToRevisionReview
  );
  $('[data-source-open-object]')?.addEventListener('click', () => {
    sourceNavigationTarget = sourceNavigationDestination(
      sourceNavigationTarget,
      'knowledge'
    );
    selectedKnowledgeSection = 'all';
    show('knowledge');
  });
  $('[data-source-relationships]')?.addEventListener('click', () => {
    relationshipTarget = {
      ...relationshipNavigationTarget({
        documentId: selected.id,
        sectionId: sourceTargetResolution?.section?.id || ''
      }),
      projectId: state().activeProject,
      libraryId: selected.libraryId,
      originatingMessageId: activeRetrievalSession?.messageId || '',
      evidenceId: selectedEvidenceId || ''
    };
    show('relationships');
  });

  let activeSectionId = sourceTargetResolution?.section?.id || null;
  let treeToggleHandler = null;
  const sectionsById = new Map(selectedSections.map(section => [section.id, section]));
  const sectionIndexById = new Map(selectedSections.map((section, index) => [section.id, index]));
  const sectionsByNumber = new Map(selectedSections
    .filter(section => section.sectionNumber)
    .map(section => [sectionNumberKey(section.sectionNumber), section]));
  const sectionSearchText = new Map(selectedSections.map((section, index) => [
    section.id,
    `${sectionHeading(section, index)} ${sectionText(section)} ${Array.isArray(section.metadata?.keywords) ? section.metadata.keywords.join(' ') : safeText(section.metadata?.keywords)}`.toLowerCase()
  ]));
  const childrenByParent = new Map();
  for (const section of selectedSections) {
    const parentId = sectionsById.has(section.parentId) ? section.parentId : null;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(section);
  }
  const targetedBranchIds = new Set();
  let targetedBranchSection = activeSectionId
    ? sectionsById.get(activeSectionId)
    : null;
  while (targetedBranchSection) {
    targetedBranchIds.add(targetedBranchSection.id);
    targetedBranchSection = sectionsById.get(targetedBranchSection.parentId);
  }

  const branchSections = sectionId => {
    if (!sectionId || !sectionsById.has(sectionId)) return selectedSections;
    const output = [];
    const queue = [sectionsById.get(sectionId)];
    while (queue.length) {
      const section = queue.shift();
      output.push(section);
      queue.push(...(childrenByParent.get(section.id) || []));
    }
    return output;
  };

  const drawSections = () => {
    const query = (
      $('#sectionFilter').value ||
      ''
    )
      .trim()
      .toLowerCase();

    const level = $('#sectionLevel').value;

    const matches = selectedSections.filter((section, index) =>
      (
        !query ||
        safeText(sectionSearchText.get(section.id)).includes(query)
      ) &&
      (
        !level ||
        String(section.level || 1) === level
      )
    );

    const visibleIds = new Set(matches.map(section => section.id));
    if (query || level) {
      for (const section of matches) {
        let parent = sectionsById.get(section.parentId);
        while (parent) {
          visibleIds.add(parent.id);
          parent = sectionsById.get(parent.parentId);
        }
      }
    }

    const roots = (childrenByParent.get(null) || []).filter(section =>
      (!query && !level) || visibleIds.has(section.id)
    );

    const renderNode = section => {
          const sectionIndex = sectionIndexById.get(section.id);
          const heading = sectionHeading(section, sectionIndex);
          const location = sectionLocation(section);
          const text = sectionText(section);
          const children = (childrenByParent.get(section.id) || []).filter(child =>
            (!query && !level) || visibleIds.has(child.id)
          );
          const references = (section.crossReferences || []).map(reference => {
            const target = sectionsByNumber.get(sectionNumberKey(reference));
            return target
              ? `<button class="cross-reference" data-jump-section="${esc(target.id)}">${esc(reference)}</button>`
              : `<span>${esc(reference)}</span>`;
          }).join(' ');

          return `
          <details
            id="${sourceAnchorId('source-section', section.id)}"
            class="source-section ${section.id === activeSectionId ? 'active mc-section-highlight-active' : ''}"
            data-section-node="${esc(section.id)}"
            ${section.id === activeSectionId ? 'tabindex="-1" aria-current="true"' : ''}
            ${query || targetedBranchIds.has(section.id) ? 'open' : ''}
          >
            <summary data-activate-section="${esc(section.id)}">
              <b>${section.order + 1}</b>

              <span style="--level:${Math.max(0, (section.level || 1) - 1)}">
                <strong>${esc(heading)}</strong>
                ${section.id === activeSectionId
                  ? '<i class="mc-source-target-indicator">Evidence source</i>'
                  : ''}
                <small>
                  ${esc(
                    (Array.isArray(section.path)
                      ? section.path.map(safeText).join(' › ')
                      : safeText(section.path)) ||
                    location
                  )}
                  · ${fmt(section.characters)} chars
                  · ${fmt(section.wordCount || 0)} words
                </small>
              </span>

              <em>L${section.level || 1}</em>
            </summary>

            <div class="section-actions">
              <button
                class="subtle"
                data-jump-section="${esc(section.id)}"
              >
                Jump to section
              </button>

              <button
                class="subtle"
                data-select-branch="${esc(section.id)}"
              >
                Select branch
              </button>

              <button
                class="subtle"
                data-copy-section="${esc(section.id)}"
              >
                Copy text
              </button>

              <button
                class="subtle"
                data-copy-citation="${esc(section.id)}"
              >
                Copy source label
              </button>
            </div>

            <pre>${esc(text)}</pre>
            ${references ? `<div class="section-references"><b>References:</b> ${references}</div>` : ''}
            ${children.length ? `<div class="source-tree-children" data-tree-children="${esc(section.id)}"></div>` : ''}
          </details>
        `;
    };

    $('#sectionResults').innerHTML = roots.length
      ? roots.map(renderNode).join('')
      : '<div class="empty">No sections match this filter.</div>';

    const populateChildren = details => {
      const container = details.querySelector(':scope > [data-tree-children]');
      if (!container || container.dataset.loaded) return;
      const children = childrenByParent.get(details.dataset.sectionNode) || [];
      const shownChildren = children.filter(child => (!query && !level) || visibleIds.has(child.id));
      container.innerHTML = shownChildren.map(renderNode).join('');
      container.dataset.loaded = 'true';
      container.querySelectorAll(':scope > details[open]').forEach(populateChildren);
    };

    const activate = sectionId => {
      activeSectionId = sectionId;
      $$('[data-section-node]').forEach(node =>
        node.classList.toggle('active', node.dataset.sectionNode === sectionId)
      );
    };

    const tree = $('#sectionResults');
    if (treeToggleHandler) tree.removeEventListener('toggle', treeToggleHandler, true);
    treeToggleHandler = event => {
      const details = event.target.closest('[data-section-node]');
      if (details?.open) populateChildren(details);
    };
    tree.addEventListener('toggle', treeToggleHandler, true);
    tree.querySelectorAll(':scope > details[open]').forEach(populateChildren);
    tree.onclick = event => {
      const action = event.target.closest('button, summary');
      if (!action) return;
      if (action.dataset.activateSection) activate(action.dataset.activateSection);
      if (action.dataset.selectBranch) {
        event.preventDefault();
        activate(action.dataset.selectBranch);
      }
      if (action.dataset.jumpSection) {
        const targetId = action.dataset.jumpSection;
        const target = sectionsById.get(targetId);
        activeSectionId = targetId;
        $('#sectionFilter').value = sectionHeading(target, sectionIndexById.get(target.id));
        drawSections();
        document.querySelector(`[data-section-node="${CSS.escape(targetId)}"]`)?.scrollIntoView({ block: 'center' });
      }
      if (action.dataset.copySection) {
        void copyText(sectionText(sectionsById.get(action.dataset.copySection)));
      }
      if (action.dataset.copyCitation) {
        const section = sectionsById.get(action.dataset.copyCitation);
        const sectionIndex = sectionIndexById.get(section.id);
        const sourceLabel = sectionSourceLabel(section, sectionIndex);
        const location = sectionLocation(section);
        void copyText([
          `${documentLabel} — ${sourceLabel}`,
          location ? `(${location})` : ''
        ].filter(Boolean).join(' '));
      }
    };

    if (activeSectionId) {
      revealNavigationTarget(
        globalThis.document.getElementById(
          sourceAnchorId('source-section', activeSectionId)
        )
      );
    }
  };

  let filterTimer;
  $('#sectionFilter').oninput = () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(drawSections, 120);
  };
  $('#sectionLevel').onchange = drawSections;

  $('#expandSections').onclick = () => {
    const expand = () => {
      const closed = [...$('#sectionResults').querySelectorAll('details:not([open])')];
      closed.forEach(details => { details.open = true; });
      if (closed.length) requestAnimationFrame(expand);
    };
    expand();
  };

  $('#collapseSections').onclick = () => {
    $$('#sectionResults details').forEach(details => {
      details.open = false;
    });
  };

  $('#exportExtraction').onclick = () => {
    const exportedSections = branchSections(activeSectionId);
    download(
      `${documentLabel.replace(/[^a-z0-9]+/gi, '-') || 'document'}-extraction-report.json`,
      JSON.stringify(
        {
          ...report,
          selectedRoot: activeSectionId,
          sections: exportedSections.map(
            ({
              id,
              projectId,
              libraryId,
              documentId,
              ...section
            }) => section
          )
        },
        null,
        2
      ),
      'application/json'
    );
  };

  drawSections();
}

function renderAdvancedEvaluations() {
  const evaluations = state().evaluations;

  $('#evalList').innerHTML = evaluations.length
    ? evaluations.map(evaluation => `
        <article class="eval">
          <div>
            <strong>${esc(evaluation.question)}</strong>
            <span>
              Expected source:
              ${esc(evaluation.expectedSource || 'Any supporting source')}
            </span>
          </div>

          <button data-run="${evaluation.id}">Run</button>

          <button
            class="danger"
            data-del-eval="${evaluation.id}"
          >
            ×
          </button>
        </article>
      `).join('')
    : '<div class="empty">No evaluation cases yet.</div>';

  $$('[data-del-eval]').forEach(button => {
    button.onclick = () => {
      engine.removeEvaluation(
        button.dataset.delEval
      );

      renderAdvancedEvaluations();
    };
  });

  $$('[data-run]').forEach(button => {
    button.onclick = async () => {
      const evaluation = state().evaluations.find(item =>
        item.id === button.dataset.run
      );

      button.disabled = true;
      button.textContent = 'Running…';

      try {
        const result = await engine.runEvaluation(
          evaluation
        );

        $('#evalResult').innerHTML = `
          <div class="score
            ${result.score >= 80
              ? 'good'
              : result.score >= 60
                ? 'warn'
                : 'bad'}"
          >
            ${result.score}
            <small>/100</small>
          </div>

          <h3>Result</h3>

          <p>
            ${result.citations} citation(s)
            · source match ${result.sourceMatch ? 'yes' : 'no'}
          </p>

          <h4>Missing facts</h4>

          <p>
            ${result.missingFacts.map(esc).join('<br>') || 'None'}
          </p>

          <h4>Prohibited statements found</h4>

          <p>
            ${result.prohibitedHits.map(esc).join('<br>') || 'None'}
          </p>

          <details>
            <summary>Answer</summary>
            <pre>${esc(result.answer)}</pre>
          </details>
        `;
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Run';
      }
    };
  });
}

async function renderEvals() {
  const libraries = engine.libraries();
  const documents = await engine.documents();
  const sections = await engine.sections();
  const catalog = knowledgeCatalogData(documents, sections, libraries);
  const extractionCoverage = aggregateExtractionVerification(
    documents,
    sections
  );
  const relationshipModel = buildKnowledgeRelationships({
    documents,
    sections
  });
  const relationshipValidation = relationshipModel.validation;
  const lineageModel = buildDocumentLineage({ documents, sections });
  const lineageValidation = lineageModel.validation;
  const revisionMetrics = buildRevisionMetrics({ documents, sections });
  const engineeringMetrics = engineeringContextMetrics(getInspectionSession()?.context || null);
  const activationMetrics = contextActivationMetrics(activeContextActivation, contextClearedEvent);
  const synchronizationMetrics = contextBusMetrics(contextBusSnapshot);
  const validationWorkflow = workflowTarget
    ? createWorkflow({
        workflowType: workflowTarget.workflowType,
        engineeringContext: getInspectionSession()?.context || null,
        documents,
        sections,
        revisionComparisons: revisionMetrics.comparisons
      })
    : null;
  const activeWorkflowMetrics = workflowMetrics(validationWorkflow);
  const lineageIssueCount =
    lineageValidation.brokenLineage.length +
    lineageValidation.circularPreviousLinks.length +
    lineageValidation.ambiguousCurrentFamilies.length;
  const documentsWithoutRelationships = relationshipValidation.documentsWithoutRelationships.length;
  const documentsWithRelationships = Math.max(
    0,
    documents.length - documentsWithoutRelationships
  );
  const brokenRelationshipReferences =
    relationshipValidation.brokenReferences.length +
    relationshipValidation.unresolvedReferences.length +
    relationshipValidation.ambiguousReferences.length;
  const sessionEvidenceDocumentIds = new Set(
    (activeRetrievalSession?.evidence || [])
      .map(item => item.documentId)
      .filter(Boolean)
  );
  const sessionEvidenceSectionIds = new Set(
    (activeRetrievalSession?.evidence || [])
      .map(item => item.sectionId)
      .filter(Boolean)
  );
  const documentsNotRetrieved = activeRetrievalSession
    ? documents.filter(document =>
        !sessionEvidenceDocumentIds.has(document.id)
      ).length
    : null;
  const sectionsNotRetrieved = activeRetrievalSession
    ? sections.filter(section =>
        !sessionEvidenceSectionIds.has(section.id)
      ).length
    : null;
  const enabledLibraries = libraries.filter(library => library.enabled);
  const indexed = documents.filter(document =>
    documentStatus(document).className === 'indexed'
  );
  const pending = documents.filter(document =>
    documentStatus(document).className === 'pending'
  );
  const unavailable = documents.filter(document =>
    documentStatus(document).className === 'unavailable'
  );
  const unknown = documents.filter(document =>
    documentStatus(document).className === 'unknown'
  );
  const uncategorized = documents.filter(document =>
    documentCatalogSection(document) === 'Uncategorized'
  );
  const indexedWithoutSections = indexed.filter(document =>
    Number(catalog.sectionCounts.get(document.id) || 0) <= 0
  );
  const missingMetadata = documents.filter(document => {
    const library = libraries.find(item =>
      item.id === document.libraryId
    );

    return !(
      document.id &&
      document.name &&
      documentType(document) !== 'Type unavailable' &&
      safeText(document.category || document.metadata?.category).trim() &&
      library
    );
  });
  const emptyEnabledLibraries = enabledLibraries.filter(library =>
    !documents.some(document => document.libraryId === library.id)
  );
  const disabledLibrariesWithDocuments = libraries.filter(library =>
    !library.enabled &&
    documents.some(document => document.libraryId === library.id)
  );

  const healthCards = [
    ['Libraries', libraries.length, `${enabledLibraries.length} enabled`],
    ['Documents', documents.length, 'Loaded production documents'],
    ['Indexed Documents', indexed.length, 'Recognized indexed status'],
    ['Pending Documents', pending.length, 'Awaiting or processing'],
    ['Indexed Sections', sections.length, 'Exposed production sections'],
    ['Retrieval Ready', extractionCoverage.documentsReadyForRetrieval, 'Documents with searchable stored content'],
    ['Extraction Warnings', extractionCoverage.documentsWithWarnings, 'Documents with objective warnings'],
    ['No Usable Text', extractionCoverage.documentsWithoutUsableText, 'Documents without searchable content'],
    ['Categories', catalog.entries.length, 'Represented knowledge categories'],
    ['File Types', catalog.types.length, 'Represented file-type groups'],
    ['Documents with Relationships', documentsWithRelationships, 'Explicit or exact shared-state links'],
    ['Documents without Relationships', documentsWithoutRelationships, 'No derived relationship edges'],
    ['Broken References', brokenRelationshipReferences, 'Broken, unresolved, or ambiguous explicit references'],
    ['Duplicate Imports', lineageValidation.duplicateImports, 'Explicit duplicate lineage records'],
    ['Superseded Documents', lineageValidation.supersededDocuments, 'Preserved previous versions'],
    ['Broken Lineage', lineageIssueCount, 'Missing, circular, or ambiguous lineage'],
    ['Unknown Versions', lineageValidation.unknownVersions, 'No explicit lineage metadata'],
    ['Comparable Revision Pairs', revisionMetrics.comparableRevisionPairs, 'Exact adjacent lineage records'],
    ['Ambiguous Revision Pairs', revisionMetrics.ambiguousRevisionPairs, 'Pairs with duplicate deterministic keys'],
    ['Broken Revision Links', revisionMetrics.brokenLineageLinks, 'Unavailable or invalid explicit previous links'],
    ['Added Revision Sections', revisionMetrics.addedSections, 'Unmatched later-revision sections'],
    ['Removed Revision Sections', revisionMetrics.removedSections, 'Unmatched earlier-revision sections'],
    ['Changed Revision Sections', revisionMetrics.changedSections, 'Matched sections with objective changes'],
    ['Unmatched Revision Sections', revisionMetrics.unmatchedSections, 'Sections without a deterministic pair'],
    ['Active Engineering Context', activationMetrics.activeEngineeringContext, activationMetrics.activationSource || 'No activation source'],
    ['Context Activated', activationMetrics.currentTransition === 'activated' ? 1 : 0, `Current transition: ${activationMetrics.currentTransition}`],
    ['Context Cleared', activationMetrics.contextCleared, activationMetrics.contextCleared ? `Cleared from ${activationMetrics.activationSource}` : 'Current transient state'],
    ['Active Synchronization', synchronizationMetrics.activeSynchronization, synchronizationMetrics.activationSource || 'No synchronized context'],
    ['Synchronized Workspaces', synchronizationMetrics.synchronizedModules, 'Workspaces using the active Engineering Context'],
    ['Unsynchronized Workspaces', synchronizationMetrics.unsynchronizedModules, 'Workspaces awaiting Engineering Context'],
    ['Context Has Evidence', engineeringMetrics.contextHasEvidence, 'Exact active-session evidence'],
    ['Context Has Relationships', engineeringMetrics.contextHasExplicitRelationships, 'Exact hierarchy or explicit references'],
    ['Context Has Version History', engineeringMetrics.contextHasVersionHistory, 'Explicit lineage records'],
    ['Context Has Specifications', engineeringMetrics.contextHasSpecifications, 'Exact metadata classification'],
    ['Context Has Drawings', engineeringMetrics.contextHasDrawings, 'Exact metadata classification'],
    ['Context Has Procedures', engineeringMetrics.contextHasProcedures, 'Exact metadata classification'],
    ['Incomplete Context', engineeringMetrics.incompleteContext, 'Current transient context only'],
    ['Active Workflow', activeWorkflowMetrics.activeWorkflow, 'Current transient workflow only'],
    ['Workflow Ready', activeWorkflowMetrics.workflowReady, 'Required identifiers available'],
    ['Workflow Incomplete', activeWorkflowMetrics.workflowIncomplete, 'Required identifiers unavailable'],
    ['Workflow Unavailable', activeWorkflowMetrics.workflowUnavailable, 'Invalid context or unsupported type'],
    ['Workflow Evidence', activeWorkflowMetrics.workflowEvidence, 'Exact active-session identifiers'],
    ['Workflow Relationships', activeWorkflowMetrics.workflowRelationships, 'Exact relationship identifiers'],
    ['Workflow Lineage', activeWorkflowMetrics.workflowLineage, 'Explicit lineage identifiers'],
    ['Workflow Revisions', activeWorkflowMetrics.workflowRevisions, 'Comparable revision identifiers']
  ];

  if (activeRetrievalSession) {
    healthCards.push(
      [
        'Recent Evidence',
        activeRetrievalSession.evidence.length,
        activeRetrievalSession.coverageClassification
      ],
      [
        'Citations Used',
        activeRetrievalSession.evidenceUsed,
        'Latest active retrieval session'
      ]
    );
  }

  $('#validationHealth').innerHTML = healthCards.map(([label, value, note]) => `
    <article class="mc-validation-health-card">
      <span>${esc(label)}</span>
      <strong>${fmt(value)}</strong>
      <small>${esc(note)}</small>
    </article>
  `).join('');

  const checks = [
    {
      label: 'Documents loaded',
      status: documents.length ? 'PASS' : 'INFO',
      detail: documents.length
        ? `${fmt(documents.length)} document${documents.length === 1 ? ' is' : 's are'} available.`
        : 'No documents are currently loaded.'
    },
    {
      label: 'Libraries enabled',
      status: enabledLibraries.length
        ? 'PASS'
        : libraries.length ? 'WARNING' : 'INFO',
      detail: enabledLibraries.length
        ? `${fmt(enabledLibraries.length)} of ${fmt(libraries.length)} ${libraries.length === 1 ? 'library is' : 'libraries are'} enabled.`
        : libraries.length
          ? 'Libraries exist, but none are enabled.'
          : 'No libraries are currently available.'
    },
    {
      label: 'Indexed sections detected',
      status: sections.length ? 'PASS' : documents.length ? 'WARNING' : 'INFO',
      detail: sections.length
        ? `${fmt(sections.length)} indexed section${sections.length === 1 ? ' is' : 's are'} exposed.`
        : documents.length
          ? 'Loaded documents expose no indexed sections.'
          : 'Sections can be detected after documents are loaded and indexed.'
    },
    {
      label: 'Categories assigned',
      status: !documents.length
        ? 'INFO'
        : uncategorized.length ? 'WARNING' : 'PASS',
      detail: !documents.length
        ? 'Category coverage is unavailable without documents.'
        : uncategorized.length
          ? `${fmt(uncategorized.length)} document${uncategorized.length === 1 ? ' is' : 's are'} uncategorized.`
          : `All ${fmt(documents.length)} loaded document${documents.length === 1 ? ' has' : 's have'} a category or deterministic type grouping.`
    },
    {
      label: 'Pending indexing',
      status: pending.length ? 'WARNING' : 'PASS',
      detail: pending.length
        ? `${fmt(pending.length)} document${pending.length === 1 ? ' is' : 's are'} pending indexing.`
        : 'No documents have a pending indexing status.'
    },
    {
      label: 'Metadata completeness',
      status: missingMetadata.length ? 'WARNING' : documents.length ? 'PASS' : 'INFO',
      detail: missingMetadata.length
        ? `${fmt(missingMetadata.length)} document${missingMetadata.length === 1 ? ' is' : 's are'} missing identity, type, category, or library metadata.`
        : documents.length
          ? 'Required display metadata is available for all documents.'
          : 'Metadata can be validated after documents are loaded.'
    },
    {
      label: 'Unavailable documents',
      status: unavailable.length ? 'WARNING' : 'PASS',
      detail: unavailable.length
        ? `${fmt(unavailable.length)} document${unavailable.length === 1 ? ' is' : 's are'} marked unavailable or failed by production state.`
        : 'No documents are marked unavailable.'
    },
    {
      label: 'Enabled library content',
      status: emptyEnabledLibraries.length ? 'WARNING' : enabledLibraries.length ? 'PASS' : 'INFO',
      detail: emptyEnabledLibraries.length
        ? `${fmt(emptyEnabledLibraries.length)} enabled ${emptyEnabledLibraries.length === 1 ? 'library contains' : 'libraries contain'} no documents.`
        : enabledLibraries.length
          ? 'Every enabled library contains at least one document.'
          : 'No enabled libraries are available to validate.'
    },
    {
      label: 'Indexed document structure',
      status: indexedWithoutSections.length ? 'WARNING' : indexed.length ? 'PASS' : 'INFO',
      detail: indexedWithoutSections.length
        ? `${fmt(indexedWithoutSections.length)} indexed document${indexedWithoutSections.length === 1 ? ' exposes' : 's expose'} zero sections.`
        : indexed.length
          ? 'Every indexed document exposes at least one section.'
          : 'No indexed documents are available to validate.'
    },
    {
      label: 'Recognized index status',
      status: unknown.length ? 'WARNING' : documents.length ? 'PASS' : 'INFO',
      detail: unknown.length
        ? `${fmt(unknown.length)} document${unknown.length === 1 ? ' has' : 's have'} an unrecognized or unavailable status.`
        : documents.length
          ? 'All document statuses are recognized.'
          : 'No document statuses are available.'
    },
    {
      label: 'Documents ready for retrieval',
      status: !documents.length
        ? 'INFO'
        : extractionCoverage.documentsReadyForRetrieval === documents.length
          ? 'PASS'
          : 'WARNING',
      detail: !documents.length
        ? 'Retrieval readiness can be checked after documents are loaded.'
        : `${fmt(extractionCoverage.documentsReadyForRetrieval)} of ${fmt(documents.length)} document${documents.length === 1 ? ' is' : 's are'} retrieval ready.`
    },
    {
      label: 'Usable extracted text',
      status: extractionCoverage.documentsWithoutUsableText
        ? 'FAIL'
        : documents.length ? 'PASS' : 'INFO',
      detail: extractionCoverage.documentsWithoutUsableText
        ? `${fmt(extractionCoverage.documentsWithoutUsableText)} document${extractionCoverage.documentsWithoutUsableText === 1 ? ' contains' : 's contain'} no usable extracted text.`
        : documents.length
          ? 'Every loaded document exposes usable text.'
          : 'No documents are available to inspect.'
    },
    {
      label: 'Document and stored section counts',
      status: extractionCoverage.documentSectionMismatches
        ? 'WARNING'
        : documents.length ? 'PASS' : 'INFO',
      detail: extractionCoverage.documentSectionMismatches
        ? `${fmt(extractionCoverage.documentSectionMismatches)} document${extractionCoverage.documentSectionMismatches === 1 ? ' reports' : 's report'} a different section count than storage.`
        : documents.length
          ? 'Recorded and stored section counts agree.'
          : 'No section counts are available to compare.'
    },
    {
      label: 'Section record integrity',
      status:
        extractionCoverage.duplicateSectionIds ||
        extractionCoverage.orphanedSections ||
        extractionCoverage.invalidDocumentLinks
          ? 'FAIL'
          : sections.length ? 'PASS' : 'INFO',
      detail:
        extractionCoverage.duplicateSectionIds ||
        extractionCoverage.orphanedSections ||
        extractionCoverage.invalidDocumentLinks
          ? `${fmt(extractionCoverage.duplicateSectionIds)} duplicate ID(s), ${fmt(extractionCoverage.orphanedSections)} orphaned section(s), and ${fmt(extractionCoverage.invalidDocumentLinks)} invalid document link(s) were detected.`
          : sections.length
            ? 'Stored section identifiers and document links are consistent.'
            : 'No stored sections are available to inspect.'
    },
    {
      label: 'Section content',
      status:
        extractionCoverage.emptySections ||
        extractionCoverage.untitledSections
          ? 'WARNING'
          : sections.length ? 'PASS' : 'INFO',
      detail:
        extractionCoverage.emptySections ||
        extractionCoverage.untitledSections
          ? `${fmt(extractionCoverage.emptySections)} empty and ${fmt(extractionCoverage.untitledSections)} untitled section(s) were detected.`
          : sections.length
            ? 'Stored sections contain usable text and titles.'
            : 'No stored section content is available.'
    }
  ];

  checks.push(
    {
      label: 'Explicit relationship references',
      status: brokenRelationshipReferences ? 'WARNING' : sections.length ? 'PASS' : 'INFO',
      detail: brokenRelationshipReferences
        ? `${fmt(relationshipValidation.brokenReferences.length)} broken ID, ${fmt(relationshipValidation.unresolvedReferences.length)} unresolved number, and ${fmt(relationshipValidation.ambiguousReferences.length)} ambiguous reference condition(s) were detected.`
        : sections.length
          ? 'No broken, unresolved, or ambiguous explicit references were detected.'
          : 'No sections are available for relationship validation.'
    },
    {
      label: 'Hierarchy relationships',
      status:
        relationshipValidation.orphanedHierarchy.length ||
        relationshipValidation.duplicateHierarchyEdges.length ||
        relationshipValidation.circularParentChains.length
          ? 'WARNING'
          : sections.length ? 'PASS' : 'INFO',
      detail: `${fmt(relationshipValidation.orphanedHierarchy.length)} orphaned parent link(s), ${fmt(relationshipValidation.duplicateHierarchyEdges.length)} duplicate edge(s), and ${fmt(relationshipValidation.circularParentChains.length)} circular parent chain(s).`
    },
    {
      label: 'Circular explicit references',
      status: relationshipValidation.circularReferences.length ? 'WARNING' : sections.length ? 'PASS' : 'INFO',
      detail: relationshipValidation.circularReferences.length
        ? `${fmt(relationshipValidation.circularReferences.length)} circular explicit reference path(s) were detected.`
        : sections.length
          ? 'No circular explicit reference paths were detected.'
          : 'No explicit references are available to validate.'
    }
    ,{
      label: 'Document lineage integrity',
      status: lineageIssueCount
        ? 'WARNING'
        : documents.length ? 'PASS' : 'INFO',
      detail: `${fmt(lineageValidation.brokenLineage.length)} broken link(s), ${fmt(lineageValidation.circularPreviousLinks.length)} circular chain(s), and ${fmt(lineageValidation.ambiguousCurrentFamilies.length)} family or families with multiple current records were detected.`
    },
    {
      label: 'Known document versions',
      status: lineageValidation.unknownVersions ? 'INFO' : documents.length ? 'PASS' : 'INFO',
      detail: lineageValidation.unknownVersions
        ? `${fmt(lineageValidation.unknownVersions)} existing document${lineageValidation.unknownVersions === 1 ? ' has' : 's have'} no explicit lineage metadata and remain unknown.`
        : documents.length
          ? 'All loaded documents expose explicit lineage metadata.'
          : 'No documents are available for lineage validation.'
    }
  );

  if (activeRetrievalSession) {
    const evidenceClassification =
      activeRetrievalSession.coverageClassification;
    const verification = activeRetrievalSession.citationVerification;
    const missingCitationCount = verification.uncited.length;

    checks.push(
      {
        label: 'Evidence coverage',
        status: evidenceClassification === 'High Evidence' ||
          evidenceClassification === 'Moderate Evidence'
          ? 'PASS'
          : 'WARNING',
        detail: `${evidenceClassification}. This describes available support, not answer correctness.`
      },
      {
        label: 'Recent retrieval health',
        status:
          activeRetrievalSession.evidence.length &&
          activeRetrievalSession.evidenceUsed
            ? 'PASS'
            : 'WARNING',
        detail: `${fmt(activeRetrievalSession.evidence.length)} section(s) retrieved and ${fmt(activeRetrievalSession.evidenceUsed)} cited in the latest answer.`
      },
      {
        label: 'Missing citation detection',
        status: missingCitationCount || verification.invalid.length
          ? 'WARNING'
          : 'PASS',
        detail: missingCitationCount || verification.invalid.length
          ? `${fmt(missingCitationCount)} uncited material claim(s) and ${fmt(verification.invalid.length)} invalid citation reference(s) were detected.`
          : 'No missing or invalid citations were detected in the latest answer.'
      }
    );
  }

  const statusSymbol = {
    PASS: '✓',
    WARNING: '!',
    INFO: 'i',
    FAIL: '×'
  };

  $('#validationChecks').innerHTML = `
    <ul class="mc-validation-checks">
      ${checks.map(check => `
        <li>
          <span
            class="mc-validation-check-icon ${check.status.toLowerCase()}"
            aria-hidden="true"
          >${statusSymbol[check.status]}</span>
          <div>
            <strong>${esc(check.label)}</strong>
            <p>${esc(check.detail)}</p>
          </div>
          <span class="mc-validation-badge ${check.status.toLowerCase()}">
            ${check.status}
          </span>
        </li>
      `).join('')}
    </ul>
  `;

  const attention = [
    ...(!libraries.length
      ? ['No libraries are available in production state.']
      : []),
    ...(!documents.length
      ? ['No content is loaded in the knowledge base.']
      : []),
    ...(documents.length && !sections.length
      ? ['Loaded documents currently expose no indexed sections.']
      : []),
    ...(pending.length
      ? [`${fmt(pending.length)} document${pending.length === 1 ? ' is' : 's are'} pending indexing.`]
      : []),
    ...(unavailable.length
      ? [`${fmt(unavailable.length)} document${unavailable.length === 1 ? ' is' : 's are'} marked unavailable or failed by production state.`]
      : []),
    ...(missingMetadata.length
      ? [`${fmt(missingMetadata.length)} document${missingMetadata.length === 1 ? ' is' : 's are'} missing identity, type, category, or library metadata.`]
      : []),
    ...(uncategorized.length
      ? [`${fmt(uncategorized.length)} document${uncategorized.length === 1 ? ' is' : 's are'} assigned to Uncategorized.`]
      : []),
    ...(indexedWithoutSections.length
      ? [`${fmt(indexedWithoutSections.length)} indexed document${indexedWithoutSections.length === 1 ? ' exposes' : 's expose'} zero available sections.`]
      : []),
    ...(extractionCoverage.documentsWithoutUsableText
      ? [`${fmt(extractionCoverage.documentsWithoutUsableText)} document${extractionCoverage.documentsWithoutUsableText === 1 ? ' contains' : 's contain'} no usable extracted text.`]
      : []),
    ...(extractionCoverage.emptySections
      ? [`${fmt(extractionCoverage.emptySections)} stored section${extractionCoverage.emptySections === 1 ? ' contains' : 's contain'} no usable text.`]
      : []),
    ...(extractionCoverage.untitledSections
      ? [`${fmt(extractionCoverage.untitledSections)} stored section${extractionCoverage.untitledSections === 1 ? ' has' : 's have'} no exposed title.`]
      : []),
    ...(extractionCoverage.documentSectionMismatches
      ? [`${fmt(extractionCoverage.documentSectionMismatches)} document${extractionCoverage.documentSectionMismatches === 1 ? ' reports' : 's report'} a different section count than IndexedDB contains.`]
      : []),
    ...(extractionCoverage.duplicateSectionIds
      ? [`${fmt(extractionCoverage.duplicateSectionIds)} duplicate stored section identifier${extractionCoverage.duplicateSectionIds === 1 ? ' was' : 's were'} detected.`]
      : []),
    ...(extractionCoverage.orphanedSections
      ? [`${fmt(extractionCoverage.orphanedSections)} stored section${extractionCoverage.orphanedSections === 1 ? ' references' : 's reference'} no existing document.`]
      : []),
    ...(extractionCoverage.invalidDocumentLinks
      ? [`${fmt(extractionCoverage.invalidDocumentLinks)} stored section${extractionCoverage.invalidDocumentLinks === 1 ? ' has' : 's have'} conflicting project, library, or filename links.`]
      : []),
    ...(unknown.length
      ? [`${fmt(unknown.length)} document${unknown.length === 1 ? ' has' : 's have'} an unrecognized or unavailable indexing status.`]
      : []),
    ...emptyEnabledLibraries.map(library =>
      `${library.name} is enabled but contains no documents.`
    ),
    ...disabledLibrariesWithDocuments.map(library => {
      const count = documents.filter(document =>
        document.libraryId === library.id
      ).length;

      return `${library.name} is disabled and contains ${fmt(count)} document${count === 1 ? '' : 's'}.`;
    }),
    ...(activeRetrievalSession?.coverageClassification === 'No Supporting Evidence'
      ? ['The latest retrieval returned no supporting evidence.']
      : []),
    ...((activeRetrievalSession?.citationVerification?.uncited?.length || 0)
      ? [`${fmt(activeRetrievalSession.citationVerification.uncited.length)} material claim${activeRetrievalSession.citationVerification.uncited.length === 1 ? ' lacks' : 's lack'} a citation in the latest answer.`]
      : []),
    ...((activeRetrievalSession?.citationVerification?.invalid?.length || 0)
      ? [`${fmt(activeRetrievalSession.citationVerification.invalid.length)} invalid citation reference${activeRetrievalSession.citationVerification.invalid.length === 1 ? ' was' : 's were'} detected in the latest answer.`]
      : []),
    ...(relationshipValidation.brokenReferences.length
      ? [`${fmt(relationshipValidation.brokenReferences.length)} exact cross-reference ID${relationshipValidation.brokenReferences.length === 1 ? ' does' : 's do'} not resolve to a stored section.`]
      : []),
    ...(relationshipValidation.unresolvedReferences.length
      ? [`${fmt(relationshipValidation.unresolvedReferences.length)} exact section-number reference${relationshipValidation.unresolvedReferences.length === 1 ? ' has' : 's have'} no stored match.`]
      : []),
    ...(relationshipValidation.ambiguousReferences.length
      ? [`${fmt(relationshipValidation.ambiguousReferences.length)} explicit reference${relationshipValidation.ambiguousReferences.length === 1 ? ' has' : 's have'} multiple exact matches and was not resolved.`]
      : []),
    ...(relationshipValidation.orphanedHierarchy.length
      ? [`${fmt(relationshipValidation.orphanedHierarchy.length)} section parent link${relationshipValidation.orphanedHierarchy.length === 1 ? ' points' : 's point'} to a missing section.`]
      : []),
    ...(relationshipValidation.duplicateReferences.length
      ? [`${fmt(relationshipValidation.duplicateReferences.length)} duplicate explicit reference entr${relationshipValidation.duplicateReferences.length === 1 ? 'y was' : 'ies were'} detected.`]
      : []),
    ...(relationshipValidation.duplicateHierarchyEdges.length
      ? [`${fmt(relationshipValidation.duplicateHierarchyEdges.length)} duplicate hierarchy edge${relationshipValidation.duplicateHierarchyEdges.length === 1 ? ' was' : 's were'} detected.`]
      : []),
    ...(relationshipValidation.circularParentChains.length
      ? [`${fmt(relationshipValidation.circularParentChains.length)} circular parent chain${relationshipValidation.circularParentChains.length === 1 ? ' was' : 's were'} detected.`]
      : []),
    ...(relationshipValidation.circularReferences.length
      ? [`${fmt(relationshipValidation.circularReferences.length)} circular explicit reference path${relationshipValidation.circularReferences.length === 1 ? ' was' : 's were'} detected.`]
      : []),
    ...(lineageValidation.brokenLineage.length
      ? [`${fmt(lineageValidation.brokenLineage.length)} exact document lineage link${lineageValidation.brokenLineage.length === 1 ? ' points' : 's point'} to a missing record.`]
      : []),
    ...(lineageValidation.circularPreviousLinks.length
      ? [`${fmt(lineageValidation.circularPreviousLinks.length)} circular previous-version chain${lineageValidation.circularPreviousLinks.length === 1 ? ' was' : 's were'} detected.`]
      : []),
    ...(lineageValidation.ambiguousCurrentFamilies.length
      ? [`${fmt(lineageValidation.ambiguousCurrentFamilies.length)} lineage ${lineageValidation.ambiguousCurrentFamilies.length === 1 ? 'family contains' : 'families contain'} multiple explicit current records; no current version was selected.`]
      : []),
    ...(lineageValidation.unknownVersions
      ? [`${fmt(lineageValidation.unknownVersions)} existing document${lineageValidation.unknownVersions === 1 ? ' has' : 's have'} unknown version status because explicit lineage metadata is unavailable.`]
      : []),
    ...(revisionMetrics.ambiguousRevisionPairs
      ? [`${fmt(revisionMetrics.ambiguousRevisionPairs)} comparable revision pair${revisionMetrics.ambiguousRevisionPairs === 1 ? ' contains' : 's contain'} ambiguous exact section keys.`]
      : []),
    ...(revisionMetrics.brokenLineageLinks
      ? [`${fmt(revisionMetrics.brokenLineageLinks)} revision link${revisionMetrics.brokenLineageLinks === 1 ? ' is' : 's are'} unavailable or not valid for deterministic comparison.`]
      : []),
    ...(revisionMetrics.unmatchedSections
      ? [`${fmt(revisionMetrics.unmatchedSections)} revision section${revisionMetrics.unmatchedSections === 1 ? ' has' : 's have'} no deterministic counterpart.`]
      : [])
  ];

  $('#validationAttention').innerHTML = attention.length
    ? `
      <ul class="mc-validation-attention">
        ${attention.map(item => `<li>${esc(item)}</li>`).join('')}
      </ul>
    `
    : `
      <div class="mc-validation-healthy">
        <strong>Knowledge base ready</strong>
        <p>No immediate knowledge-readiness issues were detected from system state.</p>
      </div>
    `;

  const statusCoverage = [
    ['Indexed', indexed.length],
    ['Pending', pending.length],
    ['Unavailable', unavailable.length],
    ['Unknown', unknown.length]
  ].filter(([, count]) => count || documents.length === 0);
  const coverageGroups = [
    {
      title: 'Libraries',
      empty: 'No libraries are available.',
      items: libraries.map(library => {
        const count = documents.filter(document =>
          document.libraryId === library.id
        ).length;

        return [
          library.name,
          `${fmt(count)} document${count === 1 ? '' : 's'} · ${library.enabled ? 'Enabled' : 'Disabled'}`
        ];
      })
    },
    {
      title: 'Knowledge Categories',
      empty: 'No categories are represented.',
      items: catalog.entries.map(entry => [
        entry.name,
        `${fmt(entry.documents.length)} document${entry.documents.length === 1 ? '' : 's'} · ${fmt(entry.exposedSections)} sections`
      ])
    },
    {
      title: 'File Types',
      empty: 'No file types are represented.',
      items: catalog.types.map(type => [
        type.name,
        `${fmt(type.documents.length)} · ${type.percentage}% of documents · ${fmt(type.indexed)} indexed`
      ])
    },
    {
      title: 'Indexed Status',
      empty: 'No document statuses are available.',
      items: statusCoverage.map(([label, count]) => [
        label,
        `${fmt(count)} document${count === 1 ? '' : 's'}`
      ])
    },
    {
      title: 'Extraction Status',
      empty: 'No extraction verification results are available.',
      items: [
        ['Retrieval ready', extractionCoverage.documentsReadyForRetrieval],
        ['With warnings', extractionCoverage.documentsWithWarnings],
        ['No usable text', extractionCoverage.documentsWithoutUsableText],
        ['Count mismatch', extractionCoverage.documentSectionMismatches]
      ].map(([label, count]) => [
        label,
        `${fmt(count)} document${count === 1 ? '' : 's'}`
      ])
    }
  ];

  if (activeRetrievalSession) {
    coverageGroups.push({
      title: 'Active Retrieval Session',
      empty: 'No active retrieval session is available.',
      items: [
        [
          'Evidence coverage',
          activeRetrievalSession.coverageClassification
        ],
        [
          'Evidence returned',
          `${fmt(activeRetrievalSession.evidence.length)} sections`
        ],
        [
          'Evidence cited',
          `${fmt(activeRetrievalSession.evidenceUsed)} sections`
        ],
        [
          'Documents not retrieved',
          `${fmt(documentsNotRetrieved)} in current session`
        ],
        [
          'Sections not retrieved',
          `${fmt(sectionsNotRetrieved)} in current session`
        ]
      ]
    });
  }

  $('#validationCoverage').innerHTML = coverageGroups.map(group => `
    <section class="mc-validation-coverage-group">
      <h3>${esc(group.title)}</h3>
      ${group.items.length
        ? `
          <ul>
            ${group.items.map(([label, value]) => `
              <li>
                <strong>${esc(label)}</strong>
                <span>${esc(value)}</span>
              </li>
            `).join('')}
          </ul>
        `
        : `<p>${esc(group.empty)}</p>`
      }
    </section>
  `).join('');

  const actions = [];
  const addAction = (label, description, targetView) => {
    if (!actions.some(action => action.label === label)) {
      actions.push({ description, label, targetView });
    }
  };

  if (!documents.length) {
    addAction(
      'Import Documents',
      'Open the existing Knowledge Workspace document workflow.',
      'knowledge'
    );
  } else {
    addAction(
      'Open Knowledge Workspace',
      'Browse the catalog, documents, and knowledge objects.',
      'knowledge'
    );
  }

  if (unavailable.length || indexedWithoutSections.length || !sections.length) {
    addAction(
      'Inspect Source Extraction',
      'Review the production sections exposed for loaded documents.',
      'sources'
    );
  }

  if (
    pending.length ||
    unavailable.length ||
    unknown.length ||
    missingMetadata.length ||
    emptyEnabledLibraries.length ||
    disabledLibrariesWithDocuments.length
  ) {
    addAction(
      'Review Diagnostics',
      'Inspect existing application and indexing diagnostics.',
      'diagnostics'
    );
  }

  if (indexed.length && sections.length) {
    addAction(
      'Ask Chief a Question',
      'Return to the Command Desk and ask an evidence-based question.',
      'chat'
    );
  }

  $('#validationActions').innerHTML = actions.length
    ? actions.slice(0, 4).map(action => `
      <button
        type="button"
        data-validation-action="${esc(action.targetView)}"
      >
        <strong>${esc(action.label)}</strong>
        <span>${esc(action.description)}</span>
      </button>
    `).join('')
    : '<div class="mc-validation-empty">No action is required from the current system state.</div>';

  $$('[data-validation-action]').forEach(button => {
    button.onclick = () => show(button.dataset.validationAction);
  });

  renderAdvancedEvaluations();
}

$('#addEval').onclick = () => openModal(
  `
    <h2>Add advanced AI evaluation</h2>

    <label>
      Question
      <textarea id="eQuestion"></textarea>
    </label>

    <label>
      Expected source or section
      <input id="eSource">
    </label>

    <label>
      Required facts — one per line
      <textarea id="eFacts"></textarea>
    </label>

    <label>
      Prohibited assumptions — one per line
      <textarea id="eProhibited"></textarea>
    </label>

    <button id="saveEval">Save case</button>
  `,
  () => {
    $('#saveEval').onclick = () => {
      const question = $('#eQuestion').value.trim();

      if (!question) {
        return;
      }

      engine.addEvaluation({
        question,
        expectedSource: $('#eSource').value.trim(),
        requiredFacts: $('#eFacts').value.trim(),
        prohibited: $('#eProhibited').value.trim()
      });

      closeModal();
      renderAdvancedEvaluations();
    };
  }
);

function loadSettings() {
  const settings = state().settings;

  $('#apiUrl').value = settings.openaiUrl;
  $('#model').value = settings.openaiModel;
  $('#apiKey').value = settings.openaiKey;
  $('#timeout').value = settings.timeout / 1000;
  $('#topK').value = settings.topK;
  const startupExperience = normalizeStartupExperience(settings.startupExperience);
  $$('input[name="startupExperience"]').forEach(input => {
    input.checked = input.value === startupExperience;
  });
}

$('#saveSettings').onclick = () => {
  engine.saveSettings({
    openaiUrl: $('#apiUrl').value.trim(),
    openaiModel: $('#model').value.trim(),
    openaiKey: $('#apiKey').value.trim(),
    timeout: Number($('#timeout').value) * 1000,
    topK: Number($('#topK').value),
    startupExperience: $('input[name="startupExperience"]:checked')?.value || 'mission-control'
  });

  alert('Settings saved in this browser.');
  refresh();
};

$('#exportProject').onclick = async () => {
  const data = await engine.exportProject();

  download(
    `${data.manifest.project.name.replace(/[^a-z0-9]+/gi, '-')}-mission-companion.json`,
    JSON.stringify(data, null, 2),
    'application/json'
  );
};

$('#importProject').onchange = async () => {
  try {
    const file = $('#importProject').files[0];

    if (!file) {
      return;
    }

    const importedProject = await engine.importProject(
      JSON.parse(await file.text())
    );

    if (importedProject.id !== DEMO_PROJECT_ID) previousUserProjectId = importedProject.id;
    missionControlView = 'home';

    await refresh();
    alert('Project imported.');
  } catch (error) {
    alert(error.message);
  } finally {
    $('#importProject').value = '';
  }
};

function download(name, data, type) {
  const anchor = document.createElement('a');

  anchor.href = URL.createObjectURL(
    new Blob([data], {
      type
    })
  );

  anchor.download = name;
  anchor.click();

  setTimeout(() => {
    URL.revokeObjectURL(anchor.href);
  }, 1000);
}

async function copyText(value) {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard access is unavailable in this environment.');
    }
    await navigator.clipboard.writeText(textValue(value));
    return true;
  } catch (error) {
    captureError(error, {
      action: 'clipboard-copy'
    });
    return false;
  }
}

function openModal(html, ready) {
  modalCloseGuard = null;
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
  ready?.();
}

function closeModal(force = false) {
  if (!force && modalCloseGuard && !modalCloseGuard()) return;
  $('#modal').hidden = true;
  modalCloseGuard = null;
}

$('#closeModal').onclick = () => closeModal();

$('#modal').onclick = event => {
  if (event.target === $('#modal')) {
    closeModal();
  }
};

$$('[data-settings-tab]').forEach(button => {
  button.onclick = () => {
    $$('[data-settings-tab]').forEach(tab => {
      tab.classList.toggle(
        'active',
        tab === button
      );
    });

    $$('[data-settings-pane]').forEach(pane => {
      pane.classList.toggle(
        'active',
        pane.dataset.settingsPane === button.dataset.settingsTab
      );
    });
  };

  button.dataset.bound = 'true';
});

$('#testConnection').onclick = async () => {
  const button = $('#testConnection');

  button.disabled = true;
  button.textContent = 'Testing…';

  try {
    engine.saveSettings({
      openaiUrl: $('#apiUrl').value.trim(),
      openaiModel: $('#model').value.trim(),
      openaiKey: $('#apiKey').value.trim()
    });

    await engine.testConnection();

    alert('OpenAI connection succeeded.');

    registerModule('AI Engine', 'ready', {
      summary: 'Connection test passed'
    });
  } catch (error) {
    captureError(error, {
      module: 'AI Engine',
      action: 'connection-test'
    });

    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Test connection';
  }
};

$('#openDiagnostics').onclick = () => show('diagnostics');

$('#resetApplication').onclick = async () => {
  if (
    !confirm(
      'This permanently removes all Mission Companion projects, documents, settings, and history stored in this browser. Continue?'
    )
  ) {
    return;
  }

  await engine.resetApplication();
  location.reload();
};

$('#runDiagnostics').onclick = () => renderDiagnostics();

$('#clearLogs').onclick = () => {
  logger.clear();
  renderDiagnostics();
};

$('#exportDiagnostics').onclick = () => {
  download(
    `mission-companion-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(
      diagnosticSnapshot(),
      null,
      2
    ),
    'application/json'
  );
};

window.addEventListener(
  'mc:open-diagnostics',
  () => show('diagnostics')
);

window.addEventListener(
  'mc:diagnostics',
  () => {
    if (view === 'diagnostics') {
      renderDiagnosticLog();
    }
  }
);

async function renderDiagnostics() {
  const [data, storage] = await Promise.all([runHealthChecks(engine), engine.storageDiagnostics()]);
  const specificationResources = specificationSourceViewer.diagnostics();
  const drawingResources = drawingViewerEngine.snapshot();
  const objectResources = projectObjectRegistry.diagnostics();
  const drawingSpecResources = drawingSpecificationLinks.diagnostics();
  storage.relationshipCount = new Set(projectRelationshipEngine.entities({ projectId: state().activeProject, verificationStates: ['confirmed', 'suggested', 'rejected', 'historical'] }).flatMap(entity => projectRelationshipEngine.getRelationships(entity.entityId, { projectId: state().activeProject, includeRejected: true, limit: 500 }).map(item => item.relationshipId))).size;

  const healthy = data.checks.filter(check =>
    check.status === 'healthy' ||
    check.status === 'configured'
  ).length;

  const failures = data.checks.filter(check =>
    check.status === 'failed'
  ).length;

  $('#healthSummary').innerHTML = `
    <article>
      <span>STATUS</span>
      <strong class="${failures ? 'bad-text' : 'good-text'}">
        ${failures ? 'Attention required' : 'Operational'}
      </strong>
    </article>

    <article>
      <span>CHECKS PASSED</span>
      <strong>${healthy}/${data.checks.length}</strong>
    </article>

    <article>
      <span>LIFECYCLE</span>
      <strong>${esc(data.lifecycle)}</strong>
    </article>

    <article>
      <span>VERSION</span>
      <strong>2.8.0</strong>
    </article>
    <article><span>COMPACT STATE</span><strong>${fmt(storage.compactStateBytes)} bytes</strong></article>
    <article><span>INDEXEDDB RECORDS</span><strong>${fmt(storage.indexedDbDocumentCount)} documents · ${fmt(storage.indexedDbKnowledgeChunkCount)} chunks</strong></article>
    <article><span>DRAWING / RELATIONSHIPS</span><strong>${fmt(storage.drawingAnalysisCount)} analyses · ${fmt(storage.relationshipCount)} links</strong></article>
    <article><span>SPECIFICATION SOURCE PDF</span><strong>${specificationResources.specificationPdfProxyActive ? `Page ${fmt(specificationResources.specificationSourcePage)} active` : 'Inactive'} · ${fmt(specificationResources.sourceViewCacheEntryCount)} cached</strong></article>
    <article><span>SPECIFICATION SOURCE MEMORY</span><strong>${fmt(specificationResources.retainedSpecificationPageRecordsInMemory)} page record · ${specificationResources.sourceViewCanvasPixels.width}×${specificationResources.sourceViewCanvasPixels.height}px</strong></article>
    <article><span>ACTIVE DRAWING PDF</span><strong>${esc(drawingResources.documentId || 'Inactive')} · ${fmt(drawingRenderCache.size())} cached bitmaps</strong></article>
    <article><span>PROJECT OBJECTS</span><strong>${fmt(objectResources.activePageObjectCount || 0)} active-page · ${fmt(objectResources.viewportCandidateCount || 0)} viewport candidates</strong></article>
    <article><span>OBJECT QUERY</span><strong>${Number(objectResources.objectQueryDurationMs || 0).toFixed(2)} ms · ${fmt(objectResources.duplicateCandidateCount || 0)} duplicate candidates</strong></article>
    <article><span>OBJECT WRITE / MERGE</span><strong>${Number(objectResources.persistenceDurationMs || 0).toFixed(2)} ms · ${Number(objectResources.objectMergeDurationMs || 0).toFixed(2)} ms</strong></article>
    <article><span>DRAWING-SPEC PERSISTENCE</span><strong>${esc(drawingSpecResources.backend)} · ${fmt(drawingSpecResources.recordCount)} records · ${fmt(drawingSpecResources.localStorageDrawingSpecBytes)} local bytes</strong></article>
    <article><span>DRAWING-SPEC MIGRATION</span><strong>${fmt(drawingSpecResources.migratedLegacyRecordCount)} migrated · ${fmt(drawingSpecResources.duplicateRecordsRemoved)} duplicates removed</strong></article>
    <article><span>DRAWING-SPEC WRITES</span><strong>${Number(drawingSpecResources.lastWriteDurationMs || 0).toFixed(2)} ms · ${fmt(drawingSpecResources.pendingRetryCount)} pending · history limit ${fmt(drawingSpecResources.auditHistoryLimit)}</strong></article>
    <article><span>ACTIVE REQUIREMENTS</span><strong>${fmt(activeDrawingTransientRequirementCount)} transient · ${fmt(drawingSpecResources.rejectedOrSuppressedRecordCount)} rejected/suppressed</strong></article>
    ${drawingSpecResources.lastWriteFailure ? `<article><span>LAST DRAWING-SPEC FAILURE</span><strong>${esc(drawingSpecResources.lastWriteFailure.message)}</strong></article>` : ''}
    <article><span>STATE MIGRATION</span><strong>${esc(storage.compactStateMigrationStatus)}</strong></article>
    ${storage.lastPersistenceFailure ? `<article><span>LAST PERSISTENCE FAILURE</span><strong>${esc(storage.lastPersistenceFailure.reason || storage.lastPersistenceFailure.message || 'Unavailable')}</strong></article>` : ''}
  `;

  $('#healthChecks').innerHTML = data.checks
    .map(check => `
      <article class="health-row ${check.status}">
        <span class="health-icon">
          ${check.status === 'healthy' || check.status === 'configured'
            ? '✓'
            : check.status === 'failed'
              ? '×'
              : '!'}
        </span>

        <div>
          <strong>${esc(check.name)}</strong>
          <small>${esc(check.detail)}</small>
        </div>
      </article>
    `)
    .join('');

  renderDiagnosticLog();
}

function renderDiagnosticLog() {
  const rows = logger.list().slice().reverse();

  $('#diagnosticLog').innerHTML = rows.length
    ? rows.map(row => `
        <article class="log-row ${row.level}">
          <time>
            ${new Date(row.time).toLocaleTimeString()}
          </time>

          <strong>
            ${esc(row.level.toUpperCase())}
          </strong>

          <span>
            ${esc(row.message)}
          </span>

          ${Object.keys(row.details || {}).length
            ? `
              <details>
                <summary>Details</summary>
                <pre>${esc(JSON.stringify(row.details, null, 2))}</pre>
              </details>
            `
            : ''}
        </article>
      `).join('')
    : '<div class="empty">No diagnostic events recorded.</div>';
}

function verifyStartup() {
  const result = verifyButtons([
    '[data-view="project"]',
    '[data-view="chat"]',
    '[data-view="knowledge"]',
    '[data-view="sources"]',
    '[data-view="evaluate"]',
    '[data-view="settings"]',
    '[data-view="diagnostics"]',
    '#send',
    '#upload',
    '#saveSettings',
    '#runDiagnostics'
  ]);

  registerModule(
    'Button Verification',
    result.missing.length || result.unattached.length
      ? 'warning'
      : 'ready',
    {
      summary: `${result.attached}/${result.total} attached`,
      ...result
    }
  );

  registerModule('UI', 'ready', {
    summary: 'Application shell rendered'
  });

  registerModule('Storage', 'ready', {
    summary: 'Browser storage initialized'
  });

  $('#healthText').textContent = result.missing.length
    ? 'Startup warning'
    : 'System ready';

  $('#healthDot').classList.toggle(
    'warning',
    Boolean(result.missing.length)
  );
}

engine.initialize()
  .then(() => {
    loadSettings();
    if (normalizeStartupExperience(state().settings.startupExperience) === 'mission-control') {
      if (!engine.activeConversation()) engine.createConversation();
    }
    return refresh();
  })
  .then(() => {
    return switchExperience(state().settings.startupExperience, { force: true, focus: false });
  })
  .then(() => {
    verifyStartup();

    setLifecycle('ready', {
      startupMs:
        Date.now() -
        (
          window.__MC_BOOT_TIME__ ||
          Date.now()
        )
    });

    logger.info('Mission Companion ready', {
      version: '2.8.0'
    });
  })
  .catch(error => {
    setLifecycle('error');

    captureError(error, {
      module: 'Startup'
    });
  });
