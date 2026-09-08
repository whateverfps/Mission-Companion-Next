import test from 'node:test';import assert from 'node:assert/strict';import { graphFixture } from './construction-graph.test.js';import { validateConstructionGraph } from '../src/construction-graph-validation.js';
test('valid fixture has no broken or cross-project edges',()=>{const{graph}=graphFixture();assert.deepEqual(validateConstructionGraph(graph,'p'),[]);});
