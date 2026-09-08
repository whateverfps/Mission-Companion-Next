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
const textSections = readJson('project-data/bedford/specifications/bedford-spec-index.json');

const { createChiefIntelligenceBridge } = await import('../src/chief-intelligence-bridge.js');
const { createChiefSpecificationSME } = await import('../src/chief-specification-sme.js');
const { createSpecificationReverseIndex } = await import('../src/specification-reverse-index.js');
const {
  assessAssistedEvidence,
  buildAssistedEvidenceExpansion,
  buildAssistedSearchQueries,
  formatAssistedEvidenceContext
} = await import('../src/chief-assisted-evidence.js');

const drawingLinks = {
  forProject() {
    return [];
  }
};

const reverseIndex = createSpecificationReverseIndex({ drawingSpecificationLinks: drawingLinks });
globalThis.__specificationReverseIndex = reverseIndex;

const specificationSME = createChiefSpecificationSME({
  projectId: 'bedford',
  getAuthoritativeSections: () => authoritativeSections,
  getSectionTextSections: () => textSections,
  getDrawingLinks: () => [],
  getDrawingCatalog: () => [],
  reverseIndex
});
specificationSME.setTextSections(textSections);

const bridge = createChiefIntelligenceBridge();
bridge.initialize({ specificationSME });

test('assisted evidence sufficiency avoids second-stage search when the initial evidence is already specific', () => {
  const bridgeContext = bridge.buildProjectContext('What specs apply to 61FX100?');
  const assessment = assessAssistedEvidence({
    question: 'What specs apply to 61FX100?',
    bridgeContext,
    initialHits: []
  });

  assert.equal(assessment.scheduleIntent, false);
  assert.equal(assessment.sufficient, true);
  assert.equal(assessment.needsExpansion, false);
  assert.match(assessment.expansionQuery, /61FX100/);
});

test('assisted evidence expands when schedule timing evidence is still thin', () => {
  const bridgeContext = {
    hasContext: true,
    reasoningResult: {
      answer: 'General schedule evidence is available.',
      evidence: [{ type: 'general', title: 'Schedule' }]
    },
    specificationAnswer: {
      answer: 'The project references schedules and submittals, but no time after NTP is stated.',
      specifications: [
        {
          sectionNumber: '01 33 23',
          sectionTitle: 'Shop Drawings Product Data and Samples',
          summary: 'Initial Schedule. Baseline Schedule. Monthly Schedule Update.'
        }
      ],
      drawings: []
    },
    facts: [],
    relationships: []
  };

  const assessment = assessAssistedEvidence({
    question: 'How long after NTP until a schedule is required according to the specifications?',
    bridgeContext,
    initialHits: []
  });

  assert.equal(assessment.scheduleIntent, true);
  assert.equal(assessment.sufficient, false);
  assert.equal(assessment.needsExpansion, true);
  assert.match(assessment.expansionQuery, /notice to proceed/i);
  assert.match(assessment.expansionQuery, /baseline schedule/i);

  const queries = buildAssistedSearchQueries({
    question: 'How long after NTP until a schedule is required according to the specifications?',
    bridgeContext,
    initialHits: [],
    assessment
  });

  assert.ok(queries.length > 4);
  assert.match(queries.join(' | '), /notice to proceed initial schedule/i);
  assert.match(queries.join(' | '), /work schedule after ntp/i);
  assert.match(queries.join(' | '), /pre-start meeting detailed work schedule/i);
});

test('authoritative evidence expansion includes real PDF-derived section text and page metadata', () => {
  const authoritativeTexts = textSections.map(section => {
    const authoritative = authoritativeSections.find(item =>
      item.sectionNumber === section.sectionNumber
    ) || {};
    return {
      ...section,
      documentName: 'Bedford Specification Manual',
      pageStart: authoritative.startPdfPage || section.pageStart || null,
      pageEnd: authoritative.endPdfPage || section.pageEnd || null
    };
  });
  const bridgeContext = {
    hasContext: true,
    reasoningResult: { answer: 'Schedule timing needs explicit project evidence.', evidence: [] },
    specificationAnswer: {
      answer: 'Project schedule submittals are relevant.',
      specifications: [
        {
          sectionNumber: '01 33 23',
          sectionTitle: 'Shop Drawings Product Data and Samples',
          summary: 'Initial Schedule. Baseline Schedule. Monthly Schedule Update. Final Schedule.'
        }
      ],
      drawings: []
    },
    facts: [],
    relationships: []
  };

  const expansion = buildAssistedEvidenceExpansion({
    question: 'How long after NTP until a schedule is required according to the specifications?',
    bridgeContext,
    initialHits: [],
    authoritativeSections: authoritativeTexts,
    retrieve: (query, sections, limit) => {
      assert.ok(Array.isArray(sections));
      const matches = sections.filter(section =>
        /schedule|notice to proceed|ntp/i.test(`${section.sectionNumber} ${section.sectionTitle} ${section.text}`)
      );
      const prioritized = [...matches].sort((a, b) => {
        const score = section => {
          if (section.sectionNumber === '11 21 20.24') return 100;
          if (section.sectionNumber === '01 33 23') return 50;
          if (section.sectionNumber === '33 08 00') return 40;
          if (section.sectionNumber === '02 82 13.13') return 30;
          return 0;
        };
        return score(b) - score(a);
      });
      return prioritized.slice(0, limit).map(section => ({
        ...section,
        documentName: 'Bedford Specification Manual',
        pageStart: section.pageStart,
        pageEnd: section.pageEnd
      }));
    },
    limit: 4
  });

  assert.equal(expansion.hits.length > 0, true);
  assert.match(expansion.context, /AUTHORITATIVE PROJECT PDF EVIDENCE/);
  assert.match(expansion.context, /01 33 23/);
  assert.match(expansion.context, /Initial Schedule/i);
  assert.match(expansion.context, /Schedule of Costs/i);
  assert.match(expansion.context, /Notice to Proceed/i);
  assert.match(expansion.context, /Pages: 688-697/);
  assert.match(expansion.context, /Pages: 2292-2295/);
  assert.match(expansion.context, /11 21 20\.24/);
  assert.match(expansion.context, /7 calendar days after Notice to Proceed/i);
});

test('assisted evidence performs a multi-query corpus pass for schedule questions', () => {
  const bridgeContext = {
    hasContext: true,
    reasoningResult: { answer: 'Schedule timing needs project evidence.', evidence: [] },
    specificationAnswer: {
      answer: 'Schedule language is distributed across multiple Bedford sections.',
      specifications: [
        {
          sectionNumber: '01 33 23',
          sectionTitle: 'Shop Drawings Product Data and Samples',
          summary: 'Initial Schedule. Baseline Schedule.'
        }
      ],
      drawings: []
    },
    facts: [],
    relationships: []
  };

  const queryCalls = [];
  const expansion = buildAssistedEvidenceExpansion({
    question: 'How long after NTP until a schedule is required according to the specifications?',
    bridgeContext,
    initialHits: [],
    authoritativeSections: [
      {
        sectionNumber: '01 33 23',
        sectionTitle: 'Shop Drawings Product Data and Samples',
        text: 'Initial Schedule. Baseline Schedule. Monthly Schedule Update. Final Schedule.'
      },
      {
        sectionNumber: '11 21 20.24',
        sectionTitle: 'Scheduling',
        text: 'Submit an initial schedule within 7 calendar days after Notice to Proceed (NTP).'
      }
    ],
    retrieve: (query, sections, limit) => {
      queryCalls.push(query);
      const matches = sections.filter(section =>
        /schedule|notice to proceed|ntp/i.test(`${section.sectionNumber} ${section.sectionTitle} ${section.text}`)
      );
      return matches.slice(0, limit).map(section => ({
        ...section,
        documentName: 'Bedford Specification Manual'
      }));
    },
    limit: 4
  });

  assert.ok(queryCalls.length > 1);
  assert.match(queryCalls.join(' | '), /How long after NTP until a schedule is required according to the specifications\?/i);
  assert.match(queryCalls.join(' | '), /notice to proceed initial schedule/i);
  assert.match(queryCalls.join(' | '), /work schedule after ntp/i);
  assert.match(expansion.context, /11 21 20\.24/);
  assert.match(expansion.context, /7 calendar days after Notice to Proceed/i);
});
