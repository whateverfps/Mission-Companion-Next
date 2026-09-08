import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionTargetToSourceTarget,
  answerAnchorId,
  createActionTarget,
  createSpecificationSourceTarget,
  createSourceTarget,
  deduplicateActionTargets,
  normalizeActionTargetPayload,
  prepareActionNavigationState,
  prepareActionNavigationTarget,
  resolveSourceTarget,
  resolveSpecificationNavigationTarget,
  resolveRfiNavigationTarget,
  resolveSubmittalNavigationTarget,
  sourceAnchorId,
  sourceNavigationActions,
  sourceNavigationDestination,
  sourceScrollOptions
} from '../src/source-navigation.js';

const project = { id: 'project-1' };
const library = { id: 'library-1', enabled: true };
const document = { id: 'document-1', libraryId: library.id };
const section = { id: 'section-1', documentId: document.id, heading: 'Duplicate' };
const context = {
  projects: [project],
  libraries: [library],
  documents: [document],
  sections: [section]
};
const target = createSourceTarget({
  projectId: project.id,
  libraryId: library.id,
  documentId: document.id,
  sectionId: section.id,
  originatingMessageId: 'answer-1'
});

test('resolves an exact section ID within the exact document', () => {
  const result = resolveSourceTarget(target, context);
  assert.equal(result.status, 'section');
  assert.equal(result.section.id, section.id);
  assert.equal(result.section.documentId, section.documentId);
  assert.equal(result.section.heading, section.heading);
  assert.equal(result.section.sentence, '');
  assert.deepEqual(result.section.sentences, []);
});

test('selects the exact document', () => {
  assert.equal(resolveSourceTarget(target, context).document, document);
});

test('generates a Knowledge Object destination', () => {
  assert.equal(sourceNavigationDestination(target, 'knowledge').destination, 'knowledge');
});

test('generates a Source Inspector destination', () => {
  assert.equal(sourceNavigationDestination(target, 'sources').destination, 'sources');
});

test('reports a missing section without losing the exact document', () => {
  const result = resolveSourceTarget({ ...target, sectionId: 'removed' }, context);
  assert.equal(result.status, 'missing-section');
  assert.equal(result.document, document);
});

test('normalizes specification sections even when sentence metadata is absent', () => {
  const sparseSection = {
    id: section.id,
    documentId: document.id,
    sectionNumber: '09 05 16',
    sectionTitle: 'Subsurface Preparation for Floor Finishes',
    startPdfPage: 1320,
    endPdfPage: 1325,
    sentence: null,
    sentences: null,
    text: null,
    content: null
  };
  const result = resolveSpecificationNavigationTarget(createActionTarget({
    kind: 'source',
    projectId: project.id,
    documentId: document.id,
    sectionId: sparseSection.id,
    destination: 'knowledge',
    returnTarget: 'chief-answer'
  }), {
    projects: [project],
    libraries: [library],
    documents: [document],
    sections: [sparseSection]
  });

  assert.equal(result.status, 'section');
  assert.equal(result.sectionNumber, '090516');
  assert.equal(result.sectionTitle, 'Subsurface Preparation for Floor Finishes');
  assert.equal(result.section?.sentence, '');
  assert.deepEqual(result.section?.sentences, []);
  assert.equal(result.section?.text, '');
  assert.equal(result.section?.content, '');
  assert.equal(result.section?.startPdfPage, 1320);
  assert.equal(result.section?.endPdfPage, 1325);
});

test('creates isolated specification source targets for successive selections', () => {
  const sourceSection = {
    id: 'section-a',
    documentId: document.id,
    projectId: project.id,
    sectionNumber: '09 91 00',
    sectionTitle: 'Interior Finishes',
    startPdfPage: 1320,
    sentence: null,
    sentences: null,
    text: null,
    content: null
  };
  const first = createSpecificationSourceTarget(sourceSection, {
    projectId: project.id,
    documentId: document.id,
    pageNumber: 1320,
    returnTarget: 'knowledge'
  });
  const second = createSpecificationSourceTarget(
    {
      ...sourceSection,
      id: 'section-b',
      sectionTitle: 'Interior Finishes - Recheck',
      startPdfPage: 1321
    },
    {
      projectId: project.id,
      documentId: document.id,
      pageNumber: 1321,
      returnTarget: 'knowledge'
    }
  );
  const third = createSpecificationSourceTarget(
    {
      ...sourceSection,
      id: 'section-c',
      sectionTitle: 'Interior Finishes - Final',
      startPdfPage: 1322
    },
    {
      projectId: project.id,
      documentId: document.id,
      pageNumber: 1322,
      returnTarget: 'knowledge'
    }
  );

  assert.equal(first.sectionNumber, '09 91 00');
  assert.equal(first.section?.sentence, '');
  assert.deepEqual(first.section?.sentences, []);
  assert.equal(first.section?.text, '');
  assert.equal(first.section?.content, '');
  assert.equal(second.sectionNumber, '09 91 00');
  assert.equal(second.section?.sectionTitle, 'Interior Finishes - Recheck');
  assert.equal(third.section?.sectionTitle, 'Interior Finishes - Final');
  assert.notEqual(first.section, second.section);
  assert.notEqual(second.section, third.section);
  assert.notEqual(first.sectionTitle, second.sectionTitle);
});

test('reports a missing document and does not select another document', () => {
  const result = resolveSourceTarget({ ...target, documentId: 'removed' }, context);
  assert.equal(result.status, 'missing-document');
  assert.equal(result.document, null);
});

test('retains evidence origin for return navigation', () => {
  assert.equal(target.originatingWorkspace, 'evidence');
  assert.equal(target.originatingMessageId, 'answer-1');
});

test('creates a deterministic originating-answer anchor', () => {
  assert.equal(answerAnchorId('answer-1'), answerAnchorId('answer-1'));
  assert.notEqual(answerAnchorId('answer-1'), answerAnchorId('answer-2'));
});

test('a target can be cleared without retained state', () => {
  let currentTarget = target;
  currentTarget = null;
  assert.equal(resolveSourceTarget(currentTarget, context).status, 'none');
});

test('duplicate headings do not affect exact ID navigation', () => {
  const duplicate = { id: 'section-2', documentId: document.id, heading: 'Duplicate' };
  const result = resolveSourceTarget(target, {
    ...context,
    sections: [duplicate, section]
  });
  assert.equal(result.section.id, 'section-1');
});

test('normalizes unsafe identifiers into safe deterministic anchors', () => {
  const anchor = sourceAnchorId('section', 'a" b/c][#é');
  assert.match(anchor, /^[a-zA-Z][a-zA-Z0-9_-]*$/);
  assert.equal(anchor, sourceAnchorId('section', 'a" b/c][#é'));
});

test('uses non-smooth scrolling when reduced motion is requested', () => {
  assert.equal(sourceScrollOptions(true).behavior, 'auto');
  assert.equal(sourceScrollOptions(false).behavior, 'smooth');
});

test('creates a shared action target for chat, plans, and records', () => {
  const target = createActionTarget({
    kind: 'drawing',
    projectId: project.id,
    documentId: document.id,
    sheetId: 'sheet-1',
    observationId: 'obs-1',
    origin: 'work-package'
  });
  assert.equal(target.kind, 'drawing');
  assert.equal(target.projectId, project.id);
  assert.equal(target.documentId, document.id);
  assert.equal(target.sheetId, 'sheet-1');
  assert.equal(target.observationId, 'obs-1');
  assert.equal(target.origin, 'work-package');
});

test('hides navigation actions when required IDs are absent', () => {
  assert.deepEqual(sourceNavigationActions({ documentId: document.id }), {
    viewInDocument: false,
    openSourceInspector: false
  });
});

test('preserves originating message and destination when converting a shared action target to a source target', () => {
  const actionTarget = createActionTarget({
    kind: 'source',
    projectId: project.id,
    documentId: document.id,
    sectionId: section.id,
    messageId: 'answer-1',
    destination: 'knowledge',
    origin: 'work-package'
  });
  const sourceTarget = actionTargetToSourceTarget(actionTarget);
  assert.equal(sourceTarget?.originatingWorkspace, 'work-package');
  assert.equal(sourceTarget?.originatingMessageId, 'answer-1');
  assert.equal(sourceTarget?.destination, 'knowledge');
});

test('prepares navigation for exact source and drawing actions using the active project as fallback', () => {
  const sourceTarget = createActionTarget({ kind: 'source', projectId: project.id, documentId: document.id, sectionId: section.id, destination: 'knowledge', origin: 'work-package' });
  const preparation = prepareActionNavigationTarget(sourceTarget, { activeProjectId: 'other-project', projects: [project], documents: [document], sections: [section] });
  assert.equal(preparation.shouldSwitchProject, true);
  assert.equal(preparation.destination, 'knowledge');
  assert.equal(preparation.reason, '');

  const drawingTarget = createActionTarget({ kind: 'drawing', projectId: 'other-project', documentId: document.id, sheetId: 'sheet-1', origin: 'work-package' });
  const drawingPreparation = prepareActionNavigationTarget(drawingTarget, { activeProjectId: project.id, projects: [project, { id: 'other-project' }], documents: [document], sections: [section] });
  assert.equal(drawingPreparation.shouldSwitchProject, true);
  assert.equal(drawingPreparation.destination, 'drawings');
  assert.equal(drawingPreparation.projectId, 'other-project');
});

test('resolves a source action target to the knowledge view with a source target for return navigation', () => {
  const actionTarget = createActionTarget({ kind: 'source', projectId: project.id, documentId: document.id, sectionId: section.id, destination: 'knowledge', origin: 'work-package' });
  const state = prepareActionNavigationState(actionTarget, { activeProjectId: 'other-project', projects: [project], documents: [document], sections: [section] });
  assert.equal(state.destination, 'knowledge');
  assert.equal(state.shouldSwitchProject, true);
  assert.equal(state.sourceTarget?.documentId, document.id);
  assert.equal(state.sourceTarget?.sectionId, section.id);
});

test('resolves drawing and inspection actions to their destination views', () => {
  const drawing = createActionTarget({ kind: 'drawing', projectId: project.id, documentId: document.id, sheetId: 'sheet-1', origin: 'work-package' });
  const inspection = createActionTarget({ kind: 'inspection', projectId: project.id, inspectionId: 'inspection-1', origin: 'work-package' });
  assert.equal(prepareActionNavigationState(drawing, { activeProjectId: project.id, projects: [project], documents: [document], sections: [section] }).destination, 'drawings');
  assert.equal(prepareActionNavigationState(inspection, { activeProjectId: project.id, projects: [project], documents: [document], sections: [section] }).destination, 'inspections');
});

test('preserves drawing set context for exact drawing actions', () => {
  const target = createActionTarget({ kind: 'drawing', projectId: project.id, documentId: document.id, drawingSetId: 'set-1', drawingId: 'drawing-1', sheetId: 'sheet-1', sheetNumber: 'A101', origin: 'work-package' });
  const state = prepareActionNavigationState(target, { activeProjectId: project.id, projects: [project], documents: [document], sections: [section] });
  assert.equal(state.target?.drawingSetId, 'set-1');
  assert.equal(state.target?.drawingId, 'drawing-1');
  assert.equal(state.target?.sheetNumber, 'A101');
  assert.equal(state.destination, 'drawings');
});

test('preserves inspection and drawing metadata when normalizing shared action payloads', () => {
  const inspectionTarget = normalizeActionTargetPayload(JSON.stringify({ kind: 'inspection', projectId: project.id, documentId: document.id, inspectionId: 'inspection-1', origin: 'work-package' }));
  assert.equal(inspectionTarget?.kind, 'inspection');
  assert.equal(inspectionTarget?.inspectionId, 'inspection-1');

  const drawingTarget = normalizeActionTargetPayload({ kind: 'drawing', projectId: project.id, documentId: document.id, drawingSetId: 'set-1', sheetId: 'sheet-1', sheetNumber: 'A101', pageNumber: 7, observationId: 'obs-1', origin: 'work-package' });
  assert.equal(drawingTarget?.drawingSetId, 'set-1');
  assert.equal(drawingTarget?.sheetNumber, 'A101');
  assert.equal(drawingTarget?.pageNumber, 7);
  assert.equal(drawingTarget?.observationId, 'obs-1');
});

test('preserves only valid matching project and library context', () => {
  const valid = resolveSourceTarget(target, context);
  assert.equal(valid.validProjectId, project.id);
  assert.equal(valid.validLibraryId, library.id);

  const invalid = resolveSourceTarget({
    ...target,
    projectId: 'unrelated-project',
    libraryId: 'unrelated-library'
  }, context);
  assert.equal(invalid.validProjectId, '');
  assert.equal(invalid.validLibraryId, '');
});

test('preserves library context when normalizing shared action payloads and converting them to source targets', () => {
  const actionTarget = normalizeActionTargetPayload({
    kind: 'source',
    projectId: project.id,
    libraryId: 'library-2',
    documentId: document.id,
    sectionId: section.id,
    origin: 'work-package'
  });
  assert.equal(actionTarget?.libraryId, 'library-2');
  assert.equal(actionTargetToSourceTarget(actionTarget)?.libraryId, 'library-2');
});

test('resolves an exact RFI action into the exact RFI destination contract', () => {
  const rfiDocument = {
    id: 'rfi-100',
    projectId: project.id,
    libraryId: library.id,
    category: 'RFIs',
    type: 'rfi',
    title: 'RFI-100 - Ceiling conflict',
    name: 'RFI-100.txt',
    metadata: { provenance: 'Project RFI Register', status: 'Open' },
    tags: ['coordination', 'ceiling']
  };
  const rfiSection = {
    id: 'section-rfi-100',
    documentId: rfiDocument.id,
    sectionNumber: '1.1',
    heading: 'Question',
    text: 'Existing duct conflicts with proposed cable tray.',
    path: ['Project', 'RFIs', 'RFI-100'],
    metadata: { provenance: 'Indexed RFI section' }
  };
  const target = createActionTarget({
    kind: 'rfi',
    actionType: 'open-rfi',
    projectId: project.id,
    libraryId: library.id,
    documentId: rfiDocument.id,
    sectionId: rfiSection.id,
    recordNumber: 'RFI-100',
    returnTarget: 'chief-answer',
    origin: 'work-package',
    messageId: 'answer-1'
  });

  const resolution = resolveRfiNavigationTarget(target, {
    projects: [project],
    libraries: [library],
    documents: [rfiDocument],
    sections: [rfiSection]
  });

  assert.equal(resolution.status, 'ready');
  assert.equal(resolution.destination, 'rfi');
  assert.equal(resolution.projectId, project.id);
  assert.equal(resolution.document.id, rfiDocument.id);
  assert.equal(resolution.section.id, rfiSection.id);
  assert.equal(resolution.recordNumber, 'RFI-100');
  assert.equal(resolution.title, 'RFI-100 - Ceiling conflict');
  assert.equal(resolution.explicitStatus, 'Open');
  assert.equal(resolution.category, 'RFIs');
  assert.equal(resolution.type, 'rfi');
  assert.ok(resolution.tags.includes('coordination'));
  assert.deepEqual(resolution.hierarchy, ['Project', 'RFIs', 'RFI-100']);
  assert.equal(resolution.provenance, 'Project RFI Register');
  assert.equal(resolution.returnAction?.kind, 'chief-answer');
  assert.match(resolution.focusTargetId, /^mc-/);
  assert.equal(resolution.sectionText, 'Existing duct conflicts with proposed cable tray.');
});

test('resolves an exact submittal action into the exact submittal destination contract', () => {
  const submittalDocument = {
    id: 'sub-100',
    projectId: project.id,
    libraryId: library.id,
    category: 'Submittals',
    type: 'submittal',
    title: 'SUB-100 - Firestopping system',
    name: 'SUB-100.txt',
    metadata: { provenance: 'Project Submittal Register', status: 'Approved as Noted' },
    tags: ['firestopping', 'coordination']
  };
  const submittalSection = {
    id: 'section-sub-100',
    documentId: submittalDocument.id,
    sectionNumber: '1.1',
    heading: 'Product data',
    text: 'Provide listed firestop system matching each penetrant and rated assembly.',
    path: ['Project', 'Submittals', 'SUB-100'],
    metadata: { provenance: 'Indexed submittal section' }
  };
  const target = createActionTarget({
    kind: 'submittal',
    actionType: 'open-submittal',
    projectId: project.id,
    libraryId: library.id,
    documentId: submittalDocument.id,
    sectionId: submittalSection.id,
    recordNumber: 'SUB-100',
    returnTarget: 'chief-answer',
    origin: 'work-package',
    messageId: 'answer-1'
  });

  const resolution = resolveSubmittalNavigationTarget(target, {
    projects: [project],
    libraries: [library],
    documents: [submittalDocument],
    sections: [submittalSection]
  });

  assert.equal(resolution.status, 'ready');
  assert.equal(resolution.destination, 'submittal');
  assert.equal(resolution.projectId, project.id);
  assert.equal(resolution.document.id, submittalDocument.id);
  assert.equal(resolution.section.id, submittalSection.id);
  assert.equal(resolution.recordNumber, 'SUB-100');
  assert.equal(resolution.title, 'SUB-100 - Firestopping system');
  assert.equal(resolution.explicitStatus, 'Approved as Noted');
  assert.equal(resolution.category, 'Submittals');
  assert.equal(resolution.type, 'submittal');
  assert.ok(resolution.tags.includes('coordination'));
  assert.deepEqual(resolution.hierarchy, ['Project', 'Submittals', 'SUB-100']);
  assert.equal(resolution.provenance, 'Project Submittal Register');
  assert.equal(resolution.returnAction?.kind, 'chief-answer');
  assert.match(resolution.focusTargetId, /^mc-/);
  assert.equal(resolution.sectionText, 'Provide listed firestop system matching each penetrant and rated assembly.');
});

test('deduplicates action targets by normalized identity and preserves exact actions', () => {
  const first = createActionTarget({ kind: 'source', projectId: project.id, documentId: document.id, sectionId: section.id, origin: 'work-package' });
  const duplicate = createActionTarget({ kind: 'source', projectId: project.id, documentId: document.id, sectionId: section.id, origin: 'work-package' });
  const different = createActionTarget({ kind: 'drawing', projectId: project.id, documentId: document.id, sheetId: 'sheet-1', origin: 'work-package' });
  const deduped = deduplicateActionTargets([first, duplicate, different]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].kind, 'source');
  assert.equal(deduped[1].kind, 'drawing');
});

test('resolves specification sections into visible rendering metadata', () => {
  const sectionWithMetadata = {
    ...section,
    heading: 'Section 101 - General Requirements',
    sectionNumber: '101',
    path: ['Division 01', 'Section 101'],
    metadata: { provenance: 'Project Specification Manual' }
  };
  const resolution = resolveSpecificationNavigationTarget(createActionTarget({
    kind: 'source',
    projectId: project.id,
    documentId: document.id,
    sectionId: sectionWithMetadata.id,
    destination: 'knowledge',
    returnTarget: 'work-package'
  }), {
    projects: [project],
    libraries: [library],
    documents: [document],
    sections: [sectionWithMetadata]
  });

  assert.equal(resolution.available, true);
  assert.equal(resolution.sectionNumber, '101');
  assert.equal(resolution.sectionTitle, 'Section 101 - General Requirements');
  assert.deepEqual(resolution.sectionPath, ['Division 01', 'Section 101']);
  assert.equal(resolution.sectionProvenance, 'Project Specification Manual');
  assert.equal(resolution.returnAction?.kind, 'work-package');
});
