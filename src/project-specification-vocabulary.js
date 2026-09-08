import { normalizeSpecificationNumber } from './specification-index.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const clean = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const BEDFORD_PROJECT_SPECIFICATION_VOCABULARY = Object.freeze([
  { sectionNumber: '01 45 00', pageTerms: ['quality control', 'quality assurance', 'field verification'], objectTerms: ['quality control', 'quality assurance', 'inspection', 'testing'] },
  { sectionNumber: '01 91 00', pageTerms: ['commissioning requirements', 'general commissioning', 'startup and testing'], objectTerms: ['commissioning', 'startup', 'testing'] },
  { sectionNumber: '09 65 13', pageTerms: ['resilient base', 'base type', 'rubber base', 'vinyl base'], objectTerms: ['resilient base', 'base type', 'rubber base', 'vinyl base', 'rb'] },
  { sectionNumber: '09 65 19', pageTerms: ['resilient tile', 'resilient flooring', 'floor tile'], objectTerms: ['resilient tile', 'resilient flooring', 'floor tile', 'lvt', 'vct'] },
  { sectionNumber: '09 91 00', pageTerms: ['interior finish plan', 'finish plan', 'finish schedule', 'painted finish', 'wall finish', 'coating'], objectTerms: ['finish p 1', 'finish p 2', 'painted finish', 'wall finish', 'painted', 'paint', 'coating', 'p 1', 'p 2'] },
  { sectionNumber: '10 14 00', pageTerms: ['signage schedules', 'signage schedule', 'signage reference', 'sign type', 'sign legends'], objectTerms: ['signage schedule', 'signage reference', 'sign type', 'signage', 'sign'] },
  { sectionNumber: '10 26 00', pageTerms: ['wall protection', 'corner guard', 'wall guard', 'door protection'], objectTerms: ['resilient wall protection', 'wall protection', 'corner guard', 'wall guard', 'door protection'] },
  { sectionNumber: '10 44 13', pageTerms: ['fire extinguisher cabinet', 'extinguisher cabinet', 'recessed cabinet'], objectTerms: ['fire extinguisher cabinet', 'extinguisher cabinet', 'recessed cabinet', 'fec'] },
  { sectionNumber: '21 13 13', pageTerms: ['fire protection plan', 'sprinkler plan', 'sprinkler system', 'fire protection'], objectTerms: ['sprinkler', 'sprinkler head', 'sprinkler heads', 'sprinkler riser', 'fire sprinkler', 'pipe', 'piping'] },
  { sectionNumber: '22 05 00', pageTerms: ['plumbing plan', 'plumbing system', 'plumbing notes', 'plumbing'], objectTerms: ['plumbing', 'plumbing plan', 'piping', 'pipe', 'valve', 'fixture', 'fixtures', 'sanitary', 'domestic water'] },
  { sectionNumber: '23 05 11', pageTerms: ['hvac common work', 'common work results for hvac', 'hvac work'], objectTerms: ['hvac', 'mechanical'] },
  { sectionNumber: '23 05 93', pageTerms: ['testing and balancing', 'tab', 'balance report'], objectTerms: ['testing and balancing', 'tab', 'balance report'] },
  { sectionNumber: '23 08 00', pageTerms: ['commissioning', 'commissioning of hvac systems', 'hvac commissioning', 'startup and testing'], objectTerms: ['commissioning', 'startup', 'startup and testing'] },
  { sectionNumber: '23 31 00', pageTerms: ['hvac ducts and casings', 'ductwork', 'air duct', 'mechanical duct'], objectTerms: ['hvac ducts and casings', 'ductwork', 'air duct', 'duct', 'vav', 'ahu', 'rtu', 'fcu'] },
  { sectionNumber: '23 37 00', pageTerms: ['air outlets and inlets', 'air outlet', 'air inlet', 'diffuser', 'grille'], objectTerms: ['air outlets and inlets', 'air outlet', 'air inlet', 'diffuser', 'grille'] },
  { sectionNumber: '26 05 00', pageTerms: ['electrical plan', 'electrical work', 'electrical common work', 'wiring methods'], objectTerms: ['electrical', 'wiring', 'conduit', 'raceway'] },
  { sectionNumber: '26 05 26', pageTerms: ['grounding and bonding', 'grounding and bonding for electrical systems', 'equipment grounding', 'grounding bus'], objectTerms: ['grounding and bonding for electrical systems', 'equipment grounding', 'grounding bus', 'grounding', 'bonding'] },
  { sectionNumber: '26 05 33', pageTerms: ['raceways and boxes for electrical systems', 'raceways and boxes', 'conduit and boxes'], objectTerms: ['raceways and boxes for electrical systems', 'raceways and boxes', 'conduit and boxes', 'raceway', 'conduit', 'box'] },
  { sectionNumber: '26 24 16', pageTerms: ['panelboard', 'panelboards', 'panelboard schedule', 'branch circuiting'], objectTerms: ['panelboard', 'panelboard schedule', 'branch circuit', 'panel', 'breaker'] },
  { sectionNumber: '27 05 00', pageTerms: ['common work results for communications', 'communications equipment', 'telecommunications room', 'telecom room'], objectTerms: ['common work results for communications', 'communications equipment', 'telecommunications room', 'telecom room', 'telecom symbols', 'telecom keyed notes'] },
  { sectionNumber: '27 05 26', pageTerms: ['grounding and bonding for telecommunications', 'telecommunications grounding', 'telecom grounding'], objectTerms: ['grounding and bonding for telecommunications', 'telecommunications grounding', 'telecom grounding', 'grounding busbar'] },
  { sectionNumber: '27 05 33', pageTerms: ['raceways and boxes for communications', 'communications pathways', 'telecom pathways'], objectTerms: ['raceways and boxes for communications', 'communications pathways', 'telecom pathways', 'raceways and boxes'] },
  { sectionNumber: '27 05 36', pageTerms: ['cable tray', 'cable trays for communications systems', 'communications cable tray', 'telecom cable tray'], objectTerms: ['cable trays for communications systems', 'communications cable tray', 'telecom cable tray', 'cable tray'] },
  { sectionNumber: '27 05 53', pageTerms: ['identification for communications systems', 'communications labeling', 'telecom labeling'], objectTerms: ['identification for communications systems', 'communications labeling', 'telecom labeling', 'cable labels'] },
  { sectionNumber: '27 10 00', pageTerms: ['structured cabling', 'telecom outlet', 'telecommunications outlet', 'data outlet'], objectTerms: ['structured cabling', 'telecom outlet', 'telecommunications outlet', 'data outlet', 'data jack', 'telecom schedule'] },
  { sectionNumber: '27 11 16', pageTerms: ['communications cabinets racks frames and enclosures', 'equipment rack', 'telecom rack'], objectTerms: ['communications cabinets racks frames and enclosures', 'equipment rack', 'telecom rack', 'patch panel'] },
  { sectionNumber: '27 13 23', pageTerms: ['optical fiber backbone cabling', 'fiber backbone', 'backbone cabling'], objectTerms: ['optical fiber backbone cabling', 'fiber backbone', 'backbone cabling', 'fiber cabling'] },
  { sectionNumber: '27 15 13', pageTerms: ['communications copper horizontal cabling', 'copper horizontal cabling', 'horizontal cabling'], objectTerms: ['communications copper horizontal cabling', 'copper horizontal cabling', 'horizontal cabling', 'copper cabling'] }
]);

function termPattern(term) {
  const words = clean(term).split(/\s+/).filter(Boolean);
  return new RegExp(`(?:^|\\b)${words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*[-/]?\\s*')}(?:\\b|$)`, 'i');
}

function definitionTerms(definition, applicabilityScope) {
  const sourceTerms = applicabilityScope === 'object-specific'
    ? list(definition.objectTerms?.length ? definition.objectTerms : definition.terms)
    : list(definition.pageTerms?.length ? definition.pageTerms : definition.terms);
  return sourceTerms.map(text).filter(Boolean).map(term => ({ term, pattern: termPattern(term) }));
}

function evidenceRecords(input = {}) {
  return list(input?.evidence).map((item, order) => typeof item === 'string' ? { text: item, source: 'drawing-text', region: null, order } : {
    text: text(item?.text || item?.value || item?.label || item?.title), source: text(item?.source || item?.kind || 'drawing-evidence'), region: item?.region || null, observationId: text(item?.observationId), order
  }).filter(item => item.text && !/^(?:518[-\s]?22[-\s]?700|61IN101|page\s+\d+|room\s+\d+)$/i.test(item.text));
}

function explicitSectionReferences(records = []) {
  const references = [];
  for (const record of records) {
    for (const match of record.text.matchAll(/\b(?:\d{2}\s*[-./ ]?\s*){2}\d{2}\b/g)) {
      const sectionNumber = normalizeSpecificationNumber(match[0]);
      if (sectionNumber) references.push({ sectionNumber, record: structuredClone(record) });
    }
  }
  return [...new Map(references.map(item => [item.sectionNumber, item])).values()];
}

export function createProjectSpecificationVocabulary({ specificationIndex, definitions = BEDFORD_PROJECT_SPECIFICATION_VOCABULARY, onDiagnostic = () => {} } = {}) {
  const compiled = list(definitions).filter(definition => definition && text(definition.sectionNumber)).map(definition => ({ ...definition, normalizedSectionNumber: normalizeSpecificationNumber(definition.sectionNumber).replace(/\s/g, '') }));
  const match = (rawInput, applicabilityScope) => {
    const input = rawInput && typeof rawInput === 'object' ? rawInput : {};
    const started = globalThis.performance?.now?.() ?? Date.now();
    const evidence = evidenceRecords(input); const matches = [];
    const matchedSections = new Set();
    for (const reference of explicitSectionReferences(evidence)) {
      const section = specificationIndex?.get?.(input.specificationDocumentId, reference.sectionNumber);
      if (!section || section.projectId !== text(input.projectId) || matchedSections.has(section.sectionNumber)) continue;
      matchedSections.add(section.sectionNumber);
      matches.push({ projectId: section.projectId, specificationDocumentId: section.documentId, sectionNumber: section.sectionNumber, sectionTitle: section.sectionTitle,
        status: 'confirmed', origin: 'explicit', confidence: .99, applicabilityScope, evidenceSource: 'explicit-section-reference', evidenceText: reference.record.text,
        sourcePageId: text(input.pageId), sourceObjectId: text(input.objectId) || null, graphicalRegion: reference.record.region || null,
        reason: `${applicabilityScope === 'object-specific' ? 'Selected object' : 'Active drawing page'} contains explicit Section ${section.sectionNumber} reference.`, matches: [reference.record] });
    }
    for (const definition of compiled) {
      const section = specificationIndex?.get?.(input.specificationDocumentId, definition.sectionNumber);
      if (!section || section.projectId !== text(input.projectId) || matchedSections.has(section.sectionNumber)) continue;
      const patterns = definitionTerms(definition, applicabilityScope);
      const supporting = [];
      for (const record of evidence) {
        const terms = patterns.filter(candidate => candidate.pattern.test(clean(record.text))).map(candidate => candidate.term);
        const explicitSection = record.text.replace(/\D/g, '').includes(definition.normalizedSectionNumber);
        if (terms.length || explicitSection) supporting.push({ ...record, terms, explicitSection });
      }
      if (!supporting.length) continue;
      const explicit = supporting.some(item => item.explicitSection);
      const evidenceText = [...new Set(supporting.map(item => item.text))].slice(0, 6).join(' · ');
      matches.push({ projectId: section.projectId, specificationDocumentId: section.documentId, sectionNumber: section.sectionNumber, sectionTitle: section.sectionTitle,
        status: explicit ? 'confirmed' : 'suggested', origin: explicit ? 'explicit' : 'rule', confidence: explicit ? .98 : Math.min(.85, .5 + supporting.length * .08),
        applicabilityScope, evidenceSource: explicit ? 'explicit-specification-reference' : 'bedford-project-vocabulary', evidenceText,
        sourcePageId: text(input.pageId), sourceObjectId: text(input.objectId) || null, graphicalRegion: supporting.find(item => item.region)?.region || null,
        reason: `${applicabilityScope === 'object-specific' ? 'Selected object' : 'Active drawing page'} contains project vocabulary for ${section.sectionNumber}.`, matches: supporting });
    }
    onDiagnostic({ operation: 'project-specification-vocabulary', pageEvidenceCount: evidence.length, objectEvidenceCount: applicabilityScope === 'object-specific' ? evidence.length : 0,
      vocabularyMatches: matches.length, indexedSectionMatches: matches.length, durationMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - started) });
    return matches;
  };
  return {
    matchPage(input = {}) { return match(input, 'page-wide'); },
    matchObject(input = {}) { return match(input, 'object-specific'); },
    definitions() { return compiled.map(({ patterns, ...item }) => structuredClone(item)); }
  };
}
