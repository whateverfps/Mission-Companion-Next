import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingTradeContext, suggestDrawingTrade, tradeChannel } from '../src/drawing-trade-context.js';

const memory = () => { const map = new Map(); return { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }; };
const requirements = [{ id: 'm', sectionNumber: '23 31 00' }, { id: 'e', sectionNumber: '26 05 00' }, { id: 't', sectionNumber: '27 10 00' }, { id: 'general', applicabilityScope: 'project-wide' }];
test('all explicit trade channels have stable labels and bounded vocabulary', () => {
  for (const key of ['general','architectural','interiors','hazardous-materials','fire-protection','plumbing','mechanical','electrical','communications','electronic-safety-security','site','all-trades']) assert.equal(tradeChannel(key).key, key);
});
test('explicit trade persists and suggestions never override it', () => {
  const storage = memory(); const context = createDrawingTradeContext({ storage }); context.select('mechanical');
  assert.equal(context.current({ discipline: 'Electrical' }).key, 'mechanical');
  assert.equal(createDrawingTradeContext({ storage }).current().key, 'mechanical');
  assert.equal(suggestDrawingTrade({ discipline: 'Telecommunications' }).key, 'communications');
});
test('trade filters exclude unrelated divisions without creating applicability', () => {
  const context = createDrawingTradeContext({ storage: memory() });
  assert.deepEqual(context.filterRequirements(requirements, 'mechanical').map(item => item.id), ['m', 'general']);
  assert.deepEqual(context.filterRequirements(requirements, 'electrical').map(item => item.id), ['e', 'general']);
  assert.deepEqual(context.filterRequirements(requirements, 'communications').map(item => item.id), ['t', 'general']);
  assert.equal(context.filterRequirements(requirements, 'all-trades').length, 4);
});
