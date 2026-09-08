import test from 'node:test';
import assert from 'node:assert/strict';
import { activationIdentifierOrder, CONTEXT_ACTIVATION_SOURCES as S, contextActivationMetrics, createContextActivation, createContextClearedEvent } from '../src/context-activation.js';

const records = {
  projects: [{ id: 'p' }], libraries: [{ id: 'l' }],
  documents: [{ id: 'd', projectId: 'p', libraryId: 'l' }],
  sections: [{ id: 's', documentId: 'd' }],
  evidence: [{ id: 'e' }], relationships: [{ id: 'r' }],
  lineages: [{ lineageId: 'lin' }], revisions: [{ revisionId: 'old->new' }]
};
const request = (source, extra = {}) => ({ projectId: 'p', libraryId: 'l', documentId: 'd', source, activatedAt: '2026-01-01T00:00:00.000Z', ...extra });
const exact = (source, extra) => createContextActivation(request(source, extra), records);

test('activates exact Knowledge Object documents and sections', () => {
  assert.equal(exact(S.knowledgeObjectDocument).available, true);
  assert.equal(exact(S.knowledgeObjectSection, { sectionId: 's' }).activation.sectionId, 's');
});
test('activates exact evidence and Command Desk evidence', () => {
  assert.equal(exact(S.evidence, { sectionId: 's', evidenceId: 'e' }).activation.evidenceId, 'e');
  assert.equal(exact(S.commandDesk, { evidenceId: 'e' }).available, true);
});
test('activates exact Source Inspector documents and sections', () => {
  assert.equal(exact(S.sourceInspectorDocument).available, true);
  assert.equal(exact(S.sourceInspectorSection, { sectionId: 's' }).available, true);
});
test('activates exact relationship documents and sections', () => {
  assert.equal(exact(S.relationshipDocument, { relationshipId: 'r' }).available, true);
  assert.equal(exact(S.relationshipSection, { sectionId: 's', relationshipId: 'r' }).available, true);
});
test('activates exact versions, revision pairs, and revision sections', () => {
  assert.equal(exact(S.versionDocument, { lineageId: 'lin' }).available, true);
  assert.equal(exact(S.revisionPair, { revisionId: 'old->new' }).available, true);
  assert.equal(exact(S.revisionSection, { revisionId: 'old->new', sectionId: 's' }).available, true);
});
test('activates workflows, catalog documents, and Engineering Workspace launches', () => {
  assert.equal(exact(S.workflowOpen).available, true);
  assert.equal(exact(S.workflowReplace).available, true);
  assert.equal(exact(S.knowledgeCatalog).available, true);
  assert.equal(exact(S.engineeringWorkspace).available, true);
});
test('activates an Inspection Record through exact document and section identifiers', () => {
  const result = exact(S.inspectionRecord, { sectionId: 's' });
  assert.equal(result.available, true);
  assert.equal(result.activation.source, 'Inspection Record');
  assert.equal(result.activation.documentId, 'd');
  assert.equal(result.activation.sectionId, 's');
});
test('activates a Construction Work Package primary source without retaining the package', () => {
  const result = exact(S.constructionWorkPackage, { sectionId: 's' });
  assert.equal(result.available, true);
  assert.equal(result.activation.source, 'Construction Work Package');
  assert.equal(result.activation.documentId, 'd');
  assert.equal(result.activation.sectionId, 's');
  assert.equal('workPackage' in result.activation, false);
  assert.equal(createContextActivation(request(S.constructionWorkPackage, { documentId: 'missing' }), records).available, false);
  assert.match(createContextActivation(request(S.constructionWorkPackage), { ...records, documents: [...records.documents, { ...records.documents[0] }] }).reasons[0], /ambiguous/i);
});
test('rejects invalid optional and required identifiers', () => {
  for (const [field, value] of [['documentId','x'],['sectionId','x'],['evidenceId','x'],['relationshipId','x'],['lineageId','x'],['revisionId','x']]) {
    assert.equal(createContextActivation(request(S.evidence, { [field]: value }), records).available, false);
  }
});
test('duplicate exact records are ambiguous and never selected', () => {
  assert.match(createContextActivation(request(S.knowledgeObjectDocument), { ...records, documents: [...records.documents, { ...records.documents[0] }] }).reasons[0], /ambiguous/i);
  assert.match(createContextActivation(request(S.knowledgeObjectSection, { sectionId: 's' }), { ...records, sections: [...records.sections, { ...records.sections[0] }] }).reasons[0], /ambiguous/i);
});
test('rejects unsupported activation sources', () => assert.equal(exact('Unknown source').available, false));
test('project-only switching records a cleared transition', () => {
  const result = createContextActivation({ projectId: 'p', source: S.projectSwitch, activatedAt: 't' }, records);
  assert.equal(result.available, false); assert.equal(result.clearedEvent.transition, 'cleared');
});
test('requires caller-supplied activatedAt and preserves it exactly', () => {
  assert.equal(createContextActivation({ ...request(S.knowledgeCatalog), activatedAt: '' }, records).available, false);
  assert.equal(exact(S.knowledgeCatalog).activation.activatedAt, '2026-01-01T00:00:00.000Z');
});
test('clearing events cover Knowledge Object close, New conversation, and project lifecycle', () => {
  assert.equal(createContextClearedEvent({ source: S.knowledgeObjectClose, activatedAt: 't' }).transition, 'cleared');
  assert.equal(createContextClearedEvent({ source: S.newConversation, activatedAt: 't' }).transition, 'cleared');
  assert.equal(createContextClearedEvent({ source: S.projectRemoval, activatedAt: 't' }).transition, 'cleared');
});
test('current-state metrics contain no history', () => {
  const activation = exact(S.knowledgeCatalog).activation;
  assert.deepEqual(contextActivationMetrics(activation), { activeEngineeringContext: 1, activationSource: S.knowledgeCatalog, currentTransition: 'activated', contextCleared: 0 });
  assert.equal(contextActivationMetrics(null, createContextClearedEvent({ source: S.newConversation, activatedAt: 't' })).contextCleared, 1);
});
test('activation retains identifier fields in deterministic order', () => {
  const activation = exact(S.revisionSection, { sectionId: 's', evidenceId: 'e', relationshipId: 'r', lineageId: 'lin', revisionId: 'old->new' }).activation;
  assert.deepEqual(activationIdentifierOrder(activation), ['projectId','libraryId','documentId','sectionId','evidenceId','relationshipId','lineageId','revisionId','source','activatedAt']);
  assert.deepEqual(Object.keys(activation), ['projectId','libraryId','documentId','sectionId','evidenceId','relationshipId','lineageId','revisionId','source','activatedAt']);
});
