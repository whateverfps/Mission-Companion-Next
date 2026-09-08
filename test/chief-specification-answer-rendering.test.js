import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChiefSpecificationAnswerPresentation } from '../src/chief-specification-answer-rendering.js';

const baseMessage = {
  content: 'PROVIDER_SYNTHESIS_SENTINEL',
  specificationAnswer: {
    answer: 'DETERMINISTIC_SME_SENTINEL',
    specifications: [{ sectionNumber: '21 13 13' }],
    drawings: [{ sheetNumber: '61FX100' }]
  }
};

test('offline uses deterministic SME prose while AI modes use provider prose', () => {
  const offline = resolveChiefSpecificationAnswerPresentation({ ...baseMessage, mode: 'offline' });
  const source = resolveChiefSpecificationAnswerPresentation({ ...baseMessage, mode: 'source' });
  const assisted = resolveChiefSpecificationAnswerPresentation({ ...baseMessage, mode: 'assisted' });
  const general = resolveChiefSpecificationAnswerPresentation({ ...baseMessage, mode: 'general' });

  assert.equal(offline.source, 'deterministic-sme');
  assert.equal(offline.text, 'DETERMINISTIC_SME_SENTINEL');
  assert.equal(source.source, 'provider');
  assert.equal(source.text, 'PROVIDER_SYNTHESIS_SENTINEL');
  assert.equal(assisted.source, 'provider');
  assert.equal(assisted.text, 'PROVIDER_SYNTHESIS_SENTINEL');
  assert.equal(general.source, 'provider');
  assert.equal(general.text, 'PROVIDER_SYNTHESIS_SENTINEL');
});
