import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window ??= { dispatchEvent() {} };
globalThis.CustomEvent ??= class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.localStorage ??= {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
  clear() {}
};

const { createChiefIntelligenceBridge } = await import('../src/chief-intelligence-bridge.js');
const { createChiefPmisSME } = await import('../src/chief-pmis-sme.js');

const runtime = {
  buildings: [
    {
      Building: '61',
      readinessPct: 0.72,
      'Overall Status': 'Watch',
      'Construction Ready': 'No',
      'OIT Status': 'Monitor',
      'QA / Material Status': 'Review',
      'Acceptance Status': 'Blocked',
      'Open Risks': 4,
      'Open Questions': 3,
      Shutdowns: 2,
      'Room Count': 31,
      Fire: 'Ready',
      HVAC: 'Watch',
      Electrical: 'Watch',
      Telecom: 'Ready',
      Security: 'Monitor',
      'Major Blocker': 'Awaiting turnover coordination',
      'Next Action': 'Continue PMIS review and verify outstanding turnover items.'
    },
    {
      Building: '62',
      readinessPct: 0.41,
      'Overall Status': 'Critical',
      'Construction Ready': 'No',
      'OIT Status': 'Blocked',
      'QA / Material Status': 'Review',
      'Acceptance Status': 'Blocked',
      'Open Risks': 8,
      'Open Questions': 6,
      Shutdowns: 1,
      'Room Count': 18,
      Fire: 'Critical',
      HVAC: 'Critical',
      Electrical: 'Monitor',
      Telecom: 'Monitor',
      Security: 'Monitor',
      'Major Blocker': 'Coordination unresolved',
      'Next Action': 'Escalate the highest-risk systems.'
    }
  ],
  focus: [],
  stats: { total: 2, avgReadiness: 0.565, ready: 0, notReady: 2, risks: 12, questions: 9 },
  shutdowns: [
    { ShutdownID: 'SH-1', Building: '61', Status: 'Open', Title: 'Evening shutdown' },
    { ShutdownID: 'SH-2', Building: '62', Status: 'Open', Title: 'Weekend shutdown' }
  ],
  projectRegister: [],
  assessmentIndex: [],
  loadedAt: '2026-08-11 09:00'
};

const pmisSME = createChiefPmisSME({
  projectId: 'bedford',
  getRuntimeData: () => runtime,
  getSelectedBuilding: () => runtime.buildings[0]
});

test('PMIS SME answers building-scoped status questions from runtime workbook data', () => {
  assert.equal(pmisSME.isPmisQuestion('What is the status of Building 61?'), true);

  const answer = pmisSME.answerQuestion('What is the status of Building 61?');

  assert.equal(answer.queryType, 'pmis');
  assert.equal(answer.scope, 'building');
  assert.equal(answer.building.label, 'Building 61');
  assert.equal(answer.building.readinessPct, 72);
  assert.match(answer.answer, /Building 61/);
  assert.match(answer.answer, /Readiness: 72%/);
  assert.match(answer.answer, /Open Risks: 4/i);
  assert.match(answer.answer, /Continue PMIS review/);
});

test('PMIS SME answers campus summary questions from the same runtime workbook data', () => {
  assert.equal(pmisSME.isPmisQuestion('Give me a PMIS project summary.'), true);

  const answer = pmisSME.answerQuestion('Give me a PMIS project summary.');

  assert.equal(answer.scope, 'campus');
  assert.equal(answer.campus.total, 2);
  assert.equal(answer.building, null);
  assert.equal(answer.focusBuildings.length > 0, true);
  assert.match(answer.answer, /PMIS campus summary/i);
  assert.match(answer.answer, /Campus readiness: 56% across 2 buildings\./i);
});

test('Chief bridge includes PMIS answers in the browser-facing context and offline answer', () => {
  const bridge = createChiefIntelligenceBridge();
  bridge.initialize({ pmisSME });

  const context = bridge.buildProjectContext('What is the status of Building 61?');

  assert.ok(context.pmisAnswer);
  assert.equal(context.pmisAnswer.building.label, 'Building 61');
  assert.equal(bridge.hasSufficientEvidence(context), true);

  const answer = bridge.generateMissionCompanionAnswer('What is the status of Building 61?', context, 'offline');

  assert.ok(answer);
  assert.match(answer.answer, /Building 61/);
  assert.match(answer.answer, /Readiness: 72%/);
  assert.equal(answer.pmisAnswer?.building?.label, 'Building 61');
});
