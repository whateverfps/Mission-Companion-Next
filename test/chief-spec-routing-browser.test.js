import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

const authoritativeSections = readJson('project-data/bedford/specifications/authoritative-spec-index.json');
const relationshipData = readJson('project-data/bedford/relationships/building-61-spec-links.json');
const drawingCatalog = readJson('project-data/bedford/drawing-catalogs/building-61.json');
const textSections = readJson('project-data/bedford/specifications/bedford-spec-index.json');

const drawingLinks = {
  forProject() {
    const sheets = relationshipData.results || {};
    return Object.entries(sheets).flatMap(([sheetNumber, sheetData]) =>
      (sheetData.links || []).map(link => ({
        ...link,
        sheetNumber,
        projectId: 'bedford'
      }))
    );
  }
};

const drawingCatalogService = {
  recordsForDocument() {
    return drawingCatalog.sheets || [];
  }
};

const { createChiefSpecificationSME } = await import('../src/chief-specification-sme.js');
const { createChiefIntelligenceBridge } = await import('../src/chief-intelligence-bridge.js');
const { createSpecificationReverseIndex } = await import('../src/specification-reverse-index.js');
const { engine } = await import('../src/engine.js');

const reverseIndex = createSpecificationReverseIndex({ drawingSpecificationLinks: drawingLinks });
globalThis.__specificationReverseIndex = reverseIndex;

const specificationSME = createChiefSpecificationSME({
  projectId: 'bedford',
  getAuthoritativeSections: () => authoritativeSections,
  getSectionTextSections: () => textSections,
  getDrawingLinks: () => drawingLinks.forProject(),
  getDrawingCatalog: () => drawingCatalogService.recordsForDocument('bedford-specification-manual'),
  reverseIndex
});
specificationSME.setTextSections(textSections);

const bridge = createChiefIntelligenceBridge();
bridge.initialize({ specificationSME });

async function withMockOpenAI(fn) {
  const originalFetch = globalThis.fetch;
  const originalSearch = engine.search;
  const originalSettings = structuredClone(engine.state().settings);
  const calls = [];
  const responseContent = 'PROVIDER_SYNTHESIS_SENTINEL with [S1] citations.';
  const retrievalHits = [
    {
      sourceNumber: 1,
      documentName: 'Bedford Specification Manual',
      heading: 'Indexed evidence',
      sectionNumber: '21 13 13',
      path: ['Bedford', '21 13 13'],
      location: 'Project index',
      pageStart: 1438,
      pageEnd: 1438,
      text: 'Indexed evidence for 61FX100 and Bedford specifications.',
      matchedTerms: ['61FX100', '21 13 13'],
      score: 99,
      components: { coverage: 100 },
      metadata: {
        trade: 'Fire Protection',
        discipline: 'Fire Protection',
        buildingSystems: ['Fire Protection']
      }
    }
  ];

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({
      url,
      body: init?.body ? JSON.parse(init.body) : null
    });
    if (!url.includes('/chat/completions')) {
      throw new Error(`Unexpected fetch: ${url}`);
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: responseContent
            }
          }
        ]
      })
    };
  };
  engine.search = async () => retrievalHits;

  try {
    await fn(calls, responseContent);
  } finally {
    globalThis.fetch = originalFetch;
    engine.search = originalSearch;
    engine.saveSettings({
      openaiUrl: originalSettings.openaiUrl,
      openaiModel: originalSettings.openaiModel,
      openaiKey: originalSettings.openaiKey,
      timeout: originalSettings.timeout,
      mode: originalSettings.mode,
      topK: originalSettings.topK,
      startupExperience: originalSettings.startupExperience
    });
  }
}

test('Command Desk routing answers Bedford spec questions through the SME before generic retrieval', async () => {
  engine.createConversation({ projectId: engine.state().activeProject });
  const answer = await engine.ask('What specs apply to 61FX100?', 'offline');
  assert.ok(answer.specificationAnswer, 'expected structured specificationAnswer');
  const sectionNumbers = answer.specificationAnswer.specifications.map(item => item.sectionNumber);
  assert.ok(sectionNumbers.includes('21 13 13'));
  assert.ok(sectionNumbers.includes('28 31 00'));
  assert.match(answer.content, /21 13 13/);
  assert.match(answer.content, /28 31 00/);
  assert.doesNotMatch(answer.content, /No relevant project evidence was retrieved/);
});

test('Question parsing resolves explicit sheet identifiers in the browser routing path', () => {
  const parsedSheet = specificationSME.getSheetFromQuestion('What specs apply to 61FX100?');
  assert.equal(parsedSheet?.sheetNumber, '61FX100');

  const context = bridge.buildProjectContext('What specs apply to 61FX100?');
  assert.equal(context.specificationAnswer?.queryType, 'drawing');
  assert.equal(context.specificationAnswer?.answer.includes('61FX100'), true);
  const sectionNumbers = context.specificationAnswer?.specifications?.map(item => item.sectionNumber) || [];
  assert.deepEqual(sectionNumbers, ['21 13 13', '28 31 00', '01 33 23', '07 84 00', '09 91 00', '21 08 00']);
  assert.equal(context.specificationAnswer?.drawings?.some(item => item.sheetNumber === '61FX100'), true);
});

test('Spec routing also answers drawing/spec cross-reference questions and discipline queries', async () => {
  const drawings = await engine.ask('What drawings relate to 28 31 00?', 'offline');
  assert.ok(drawings.specificationAnswer);
  assert.ok(drawings.specificationAnswer.drawings.some(item => item.sheetNumber === '61FX501'));

  const hvac = await engine.ask('What specs cover HVAC and what drawings relate?', 'offline');
  assert.ok(hvac.specificationAnswer);
  assert.ok(hvac.specificationAnswer.specifications.length > 0);
  assert.match(hvac.content, /HVAC/i);
});

test('Offline, source-only, and expert-assisted Chief responses route through the correct provider behavior', async () => {
  const originalSettings = structuredClone(engine.state().settings);
  const originalSearch = engine.search;
  engine.search = async () => [];

  engine.saveSettings({
    openaiUrl: originalSettings.openaiUrl,
    openaiModel: originalSettings.openaiModel,
    openaiKey: '',
    timeout: originalSettings.timeout,
    mode: 'offline',
    topK: originalSettings.topK,
    startupExperience: originalSettings.startupExperience
  });

  const originalFetch = globalThis.fetch;
  let offlineFetchCalls = 0;
  globalThis.fetch = async (...args) => {
    offlineFetchCalls += 1;
    return originalFetch(...args);
  };

  try {
    const offline = await engine.ask('What specs apply to 61FX100?', 'offline');
    assert.equal(offlineFetchCalls, 0);
    assert.ok(offline.specificationAnswer);
    assert.deepEqual(
      offline.specificationAnswer.specifications.map(item => item.sectionNumber),
      ['21 13 13', '28 31 00', '01 33 23', '07 84 00', '09 91 00', '21 08 00']
    );
  } finally {
    globalThis.fetch = originalFetch;
    engine.search = originalSearch;
  }

  await withMockOpenAI(async (calls) => {
    engine.saveSettings({
      openaiUrl: originalSettings.openaiUrl,
      openaiModel: originalSettings.openaiModel,
      openaiKey: 'test-key',
      timeout: originalSettings.timeout,
      mode: 'source',
      topK: originalSettings.topK,
      startupExperience: originalSettings.startupExperience
    });

    const source = await engine.ask('What specs apply to 61FX100?', 'source');

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/chat\/completions$/);
    assert.match(calls[0].body.messages[0].content, /Answer directly in the first 1-3 sentences/);
    assert.doesNotMatch(calls[0].body.messages[0].content, /\[S1\]/);
    assert.match(calls[0].body.messages[1].content, /61FX100/);
    assert.match(calls[0].body.messages[1].content, /21 13 13/);
    assert.match(calls[0].body.messages[1].content, /28 31 00/);
    assert.ok(source.specificationAnswer);
    assert.deepEqual(
      source.specificationAnswer.specifications.map(item => item.sectionNumber),
      ['21 13 13', '28 31 00', '01 33 23', '07 84 00', '09 91 00', '21 08 00']
    );
    assert.match(source.content, /PROVIDER_SYNTHESIS_SENTINEL/);
  });

  await withMockOpenAI(async (calls) => {
    engine.saveSettings({
      openaiUrl: originalSettings.openaiUrl,
      openaiModel: originalSettings.openaiModel,
      openaiKey: 'test-key',
      timeout: originalSettings.timeout,
      mode: 'assisted',
      topK: originalSettings.topK,
      startupExperience: originalSettings.startupExperience
    });

    const assisted = await engine.ask('What specs apply to 61FX100?', 'assisted');

    assert.equal(calls.length, 1);
    assert.match(calls[0].body.messages[0].content, /Act as a senior owner-side construction and engineering advisor/);
    assert.match(calls[0].body.messages[0].content, /General SME context/);
    assert.match(calls[0].body.messages[0].content, /For project-specific questions, do not invent deadlines, durations, quantities, tolerances, acceptance criteria, responsibilities, or contractual obligations from general knowledge/);
    assert.match(calls[0].body.messages[0].content, /Treat retrieved hits as candidate evidence only; evaluate section titles and content for relevance before treating them as controlling/);
    assert.match(calls[0].body.messages[1].content, /AUTHORITATIVE PROJECT SME CONTEXT/);
    assert.match(calls[0].body.messages[1].content, /INDEXED PROJECT EVIDENCE/);
    assert.ok(assisted.specificationAnswer);
    assert.deepEqual(
      assisted.specificationAnswer.specifications.map(item => item.sectionNumber),
      ['21 13 13', '28 31 00', '01 33 23', '07 84 00', '09 91 00', '21 08 00']
    );
    assert.match(assisted.content, /PROVIDER_SYNTHESIS_SENTINEL/);
  });

  await withMockOpenAI(async (calls) => {
    engine.saveSettings({
      openaiUrl: originalSettings.openaiUrl,
      openaiModel: originalSettings.openaiModel,
      openaiKey: 'test-key',
      timeout: originalSettings.timeout,
      mode: 'general',
      topK: originalSettings.topK,
      startupExperience: originalSettings.startupExperience
    });

    const general = await engine.ask('What specs apply to 61FX100?', 'general');

    assert.equal(calls.length, 1);
    assert.match(calls[0].body.messages[0].content, /Answer as a general professional assistant/);
    assert.doesNotMatch(calls[0].body.messages[0].content, /7[-–]14/);
    assert.ok(general.specificationAnswer);
    assert.match(general.content, /PROVIDER_SYNTHESIS_SENTINEL/);
  });

  engine.saveSettings(originalSettings);
  globalThis.fetch = originalFetch;
});
