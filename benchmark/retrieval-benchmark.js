import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { invalidateRetrievalCaches, retrieve } from '../src/retrieval.js';

const WORDS = 'owner contractor quality control testing deficiencies submittal commissioning requirement inspection documentation schedule coordination materials installation acceptance warranty closeout approval report'.split(' ');

function paragraph(wordCount, offset) {
  return Array.from({ length: wordCount }, (_, index) => WORDS[(index + offset) % WORDS.length]).join(' ');
}

function workload(sectionCount, wordsPerSection) {
  const sections = [];
  const divisions = Math.max(1, Math.ceil(sectionCount / 250));
  for (let division = 0; division < divisions; division += 1) {
    const id = `division-${division}`;
    sections.push({
      id, documentId: 'benchmark-document', projectId: 'benchmark-project', libraryId: 'benchmark-library',
      heading: `Division ${String(division + 1).padStart(2, '0')}`, text: '', path: [], location: 'Page 1',
      hierarchyVersion: 1, hierarchyType: 'division', order: sections.length, level: 1,
      metadata: { keywords: ['division'] }
    });
  }
  while (sections.length < sectionCount) {
    const index = sections.length;
    const division = Math.min(divisions - 1, Math.floor(index / 250));
    const sectionNumber = `01 ${String(Math.floor(index / 100) % 100).padStart(2, '0')} ${String(index % 100).padStart(2, '0')}`;
    sections.push({
      id: `section-${index}`, parentId: `division-${division}`,
      documentId: 'benchmark-document', projectId: 'benchmark-project', libraryId: 'benchmark-library',
      heading: index % 41 === 0 ? `${sectionNumber} Owner Quality Control` : `${sectionNumber} Requirement ${index}`,
      sectionNumber, sectionTitle: index % 41 === 0 ? 'Owner Quality Control' : `Requirement ${index}`,
      text: paragraph(wordsPerSection, index), path: [`Division ${division + 1}`, sectionNumber],
      location: `Page ${Math.floor(index / 4) + 1}`, pageStart: Math.floor(index / 4) + 1,
      hierarchyVersion: 1, hierarchyType: 'spec-section', order: index, level: 2,
      crossReferences: index % 50 === 0 ? ['01 00 99'] : [],
      crossReferenceIds: index % 50 === 0 ? ['section-99'] : [],
      metadata: { keywords: ['quality', 'control', 'testing'], trade: 'general requirements', buildingSystems: ['quality control'] }
    });
  }
  return sections;
}

function measure(operation, samples = 1) {
  const values = [];
  let output;
  for (let sample = 0; sample < samples; sample += 1) {
    const started = performance.now();
    output = operation();
    values.push(performance.now() - started);
  }
  values.sort((left, right) => left - right);
  return { milliseconds: values[Math.floor(values.length / 2)], output };
}

function rankSignature(hits) {
  return hits.map(hit => `${hit.id}:${hit.score}`).join('|');
}

function runCase(sectionCount, wordsPerSection) {
  global.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const sections = workload(sectionCount, wordsPerSection);
  invalidateRetrievalCaches(sections);

  const cold = measure(() => retrieve('Owner quality control testing requirements', sections, 10));
  const heapAfterCold = process.memoryUsage().heapUsed;
  const warm = measure(() => retrieve('Owner quality control testing requirements', sections, 10), 5);
  const sectionLookup = measure(() => retrieve(sections.at(-1).sectionNumber, sections, 5), 5);
  const traversal = measure(() => retrieve('Owner Quality Control', sections, 10), 5);
  const crossReference = measure(() => retrieve('01 00 99', sections, 10), 5);

  invalidateRetrievalCaches(sections);
  const rebuild = measure(() => retrieve('Owner quality control testing requirements', sections, 10));

  return {
    sections: sectionCount,
    words: sections.reduce((total, section) => total + (section.text ? section.text.split(/\s+/).length : 0), 0),
    coldMs: Number(cold.milliseconds.toFixed(2)),
    warmMedianMs: Number(warm.milliseconds.toFixed(2)),
    warmSpeedup: Number((cold.milliseconds / Math.max(warm.milliseconds, 0.01)).toFixed(2)),
    hierarchyTraversalMedianMs: Number(traversal.milliseconds.toFixed(2)),
    sectionLookupMedianMs: Number(sectionLookup.milliseconds.toFixed(2)),
    crossReferenceMedianMs: Number(crossReference.milliseconds.toFixed(2)),
    invalidationRebuildMs: Number(rebuild.milliseconds.toFixed(2)),
    heapGrowthMiB: Number(((heapAfterCold - heapBefore) / 1048576).toFixed(2)),
    stableColdWarmResults: rankSignature(cold.output) === rankSignature(warm.output),
    hierarchyNarrowed: cold.output.meta.totalSectionsSearched < cold.output.meta.totalSectionsAvailable
  };
}

const results = [
  runCase(100, 120),
  runCase(1000, 120),
  runCase(2229, 449)
];

const report = {
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model || 'Unknown',
    logicalCpus: os.cpus().length,
    totalMemoryGiB: Number((os.totalmem() / 1073741824).toFixed(1)),
    exposedGc: typeof global.gc === 'function'
  },
  methodology: {
    warmSamples: 5,
    reportedWarmValue: 'median',
    timingThresholds: 'none',
    workload: 'deterministic in-memory production section records'
  },
  results
};

console.log(JSON.stringify(report, null, 2));

if (results.some(result => !result.stableColdWarmResults)) {
  process.exitCode = 1;
}
