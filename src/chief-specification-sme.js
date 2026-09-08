const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const normalizeSectionNumber = value => text(value).replace(/\s+/g, ' ').replace(/[^\d. ]+/g, '').trim();
const normalizeSheetNumber = value => text(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizeQuery = value => text(value).toLowerCase().replace(/\s+/g, ' ').trim();
const splitTerms = value => normalizeQuery(value).match(/[a-z0-9]+/g) || [];
const sectionKey = (documentId, sectionNumber) => `${text(documentId)}:${normalizeSectionNumber(sectionNumber).replace(/\s/g, '')}`;

const DISCIPLINE_KEYWORDS = [
  { label: 'HVAC', terms: ['hvac', 'mechanical', 'duct', 'ductwork', 'air', 'ventilation', 'heating', 'cooling', 'controls', 'air conditioning'] },
  { label: 'Fire Protection', terms: ['fire protection', 'sprinkler', 'suppression', 'wet-pipe', 'fire alarm', 'notification', 'smoke detector', 'waterflow', 'tamper'] },
  { label: 'Telecommunications', terms: ['telecom', 'telecommunication', 'communications', 'structured cabling', 'fiber', 'data', 'network', 'rack', 'cable tray', 'grounding'] },
  { label: 'Electrical', terms: ['electrical', 'lighting', 'panelboard', 'receptacle', 'conductor', 'raceway', 'grounding', 'power distribution'] },
  { label: 'Plumbing', terms: ['plumbing', 'domestic water', 'sanitary', 'fixture', 'valve', 'pipe insulation', 'testing', 'commissioning'] },
  { label: 'Architectural', terms: ['gypsum', 'drywall', 'door', 'frame', 'glazing', 'ceiling', 'finish', 'wall protection', 'firestopping', 'signage'] },
  { label: 'Hazmat', terms: ['abatement', 'asbestos', 'lead', 'icra', 'infection control', 'containment', 'negative pressure', 'dust'] }
];
const QUERY_SYNONYMS = {
  ntp: ['notice to proceed', 'notice', 'proceed']
};

function scoreSection(section, queryTerms) {
  const title = normalizeQuery(section.sectionTitle || section.title);
  const number = normalizeQuery(section.sectionNumber);
  const textBlob = normalizeQuery(section.text || '');
  let score = 0;
  let matchedTerms = 0;
  for (const term of queryTerms) {
    if (!term) continue;
    const compact = term.replace(/\s/g, '');
    let matched = false;
    if (number.includes(compact)) { score += 10; matched = true; }
    if (title.includes(term)) { score += 5; matched = true; }
    if (textBlob.includes(term)) { score += 2; matched = true; }
    if (matched) matchedTerms += 1;
  }
  return { score, matchedTerms };
}

function excerpt(value, maxLength = 280) {
  const clean = text(value).replace(/\s+/g, ' ');
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1)}…`;
}

function relationshipType(link) {
  return text(link.relationshipType || link.status || 'RELATED');
}

function buildingLabelForSheet(sheetNumber = '') {
  const match = String(sheetNumber || '').trim().match(/^(\d{2})/);
  return match ? `Building ${match[1]}` : 'Bedford';
}

function buildingIdForQuestion(questionText = '', activeSheet = null, drawingContext = null) {
  const explicit = text(questionText).match(/\bbuilding\s*(\d{2})\b/i)?.[1] || '';
  if (explicit) return explicit;
  const activeSheetNumber = normalizeSheetNumber(activeSheet?.sheetNumber || drawingContext?.identity?.sheetNumber || drawingContext?.sheetNumber);
  return activeSheetNumber.match(/^(\d{2})/)?.[1] || text(drawingContext?.identity?.building || drawingContext?.building).match(/\b(\d{2})\b/)?.[1] || '';
}

export function createChiefSpecificationSME({
  projectId = 'bedford',
  getAuthoritativeSections = () => [],
  getSectionTextSections = () => [],
  getDrawingLinks = () => [],
  getDrawingCatalog = () => [],
  reverseIndex = null
} = {}) {
  let cachedTextSections = [];
  let cachedTextSectionMap = new Map();

  function refreshTextSections() {
    const source = list(typeof getSectionTextSections === 'function' ? getSectionTextSections() : getSectionTextSections);
    if (!source.length) return;
    cachedTextSections = source.map(item => ({ ...item }));
    cachedTextSectionMap = new Map(cachedTextSections.map(item => [normalizeSectionNumber(item.sectionNumber), { ...item }]));
  }

  function authoritativeSections() {
    return list(typeof getAuthoritativeSections === 'function' ? getAuthoritativeSections() : getAuthoritativeSections);
  }

  function projectDrawingLinks() {
    return list(typeof getDrawingLinks === 'function' ? getDrawingLinks() : getDrawingLinks)
      .filter(item => text(item.projectId || projectId) === text(projectId) || !text(item.projectId));
  }

  function catalogRecords() {
    return list(typeof getDrawingCatalog === 'function' ? getDrawingCatalog() : getDrawingCatalog);
  }

  function sectionRecord(sectionNumber) {
    const number = normalizeSectionNumber(sectionNumber);
    const found = authoritativeSections().find(item => normalizeSectionNumber(item.sectionNumber) === number);
    return found ? { ...found, sectionNumber: normalizeSectionNumber(found.sectionNumber) } : null;
  }

  function sectionTextRecord(sectionNumber) {
    refreshTextSections();
    return cachedTextSectionMap.get(normalizeSectionNumber(sectionNumber)) || null;
  }

  function sheetForPageId(pageId) {
    const record = catalogRecords().find(item => text(item.pageId) === text(pageId));
    return record ? { ...record } : null;
  }

  function sheetForSheetNumber(sheetNumber) {
    const number = normalizeSheetNumber(sheetNumber);
    const record = catalogRecords().find(item => normalizeSheetNumber(item.sheetNumber) === number);
    return record ? { ...record } : null;
  }

  function sheetFromQuestion(questionText) {
    const match = text(questionText).match(/\b(\d{2}[A-Z]{0,3}-?\d{3})\b/i);
    if (!match) return null;
    return sheetForSheetNumber(match[1]);
  }

  function sectionUsage(sectionNumber) {
    const number = normalizeSectionNumber(sectionNumber);
    if (reverseIndex?.getSpecificationUsage) return reverseIndex.getSpecificationUsage(projectId, number);
    return { objects: [], pages: [], buildings: [], rooms: [] };
  }

  function drawingsForSection(sectionNumber, drawingLinksOverride = null) {
    const number = normalizeSectionNumber(sectionNumber);
    const sheets = new Map();
    for (const link of list(drawingLinksOverride).length ? list(drawingLinksOverride) : projectDrawingLinks()) {
      if (!link || typeof link !== 'object') continue;
      if (normalizeSectionNumber(link.sectionNumber) !== number) continue;
      const sheet = sheetForPageId(link.drawingPageId);
      const sheetNumber = text(sheet?.sheetNumber) || text(link.sheetNumber) || text(link.drawingPageId);
      const existing = sheets.get(sheetNumber) || {
        sheetNumber,
        sheetTitle: text(sheet?.sheetTitle),
        discipline: text(sheet?.discipline),
        pageId: text(link.drawingPageId),
        relationshipTypes: [],
        confidence: 0,
        evidence: []
      };
      existing.relationshipTypes.push(relationshipType(link));
      existing.confidence = Math.max(existing.confidence, Number(link.confidence) || 0);
      existing.evidence.push({
        relationshipType: relationshipType(link),
        evidenceText: text(link.evidenceText || link.reason),
        sectionNumber: text(link.sectionNumber),
        sectionTitle: text(link.sectionTitle)
      });
      sheets.set(sheetNumber, existing);
    }
    return [...sheets.values()].map(item => ({
      ...item,
      relationshipTypes: [...new Set(item.relationshipTypes)],
      evidence: [...item.evidence]
    }));
  }

  function sectionsForSheet(sheetNumber, drawingLinksOverride = null) {
    const sheet = normalizeSheetNumber(sheetNumber);
    const result = [];
    for (const link of list(drawingLinksOverride).length ? list(drawingLinksOverride) : projectDrawingLinks()) {
      if (!link || typeof link !== 'object') continue;
      const page = sheetForPageId(link.drawingPageId);
      if (normalizeSheetNumber(page?.sheetNumber || link.sheetNumber) !== sheet) continue;
      result.push({
        sectionNumber: text(link.sectionNumber),
        sectionTitle: text(link.sectionTitle),
        relationshipType: relationshipType(link),
        confidence: Number(link.confidence) || 0,
        drawingPageId: text(link.drawingPageId),
        evidenceText: text(link.evidenceText || link.reason)
      });
    }
    return result;
  }

  function summarizeSection(section) {
    const textSection = sectionTextRecord(section.sectionNumber);
    if (textSection?.text) return excerpt(textSection.text);
    return `Bedford Section ${section.sectionNumber} — ${section.sectionTitle}.`;
  }

  function findSectionsForQuery(query, { limit = 10 } = {}) {
    const queryTerms = [...new Set(splitTerms(query).flatMap(term => [term, ...(QUERY_SYNONYMS[term] || [])]))];
    const minimumMatches = queryTerms.length > 3 ? 2 : 1;
    const scheduleIntent = queryTerms.some(term => ['schedule', 'submittal', 'submittals', 'notice', 'proceed', 'turnover', 'closeout', 'posting'].includes(term));
    const ranked = authoritativeSections()
      .map(section => {
        const textSection = sectionTextRecord(section.sectionNumber);
        const scored = scoreSection({ ...section, text: textSection?.text || '' }, queryTerms);
        let confidence = scored.score;
        if (scheduleIntent) {
          if (String(section.sectionNumber || '').startsWith('01')) confidence += 12;
          else confidence -= 4;
        }
        return {
          ...section,
          confidence,
          matchedTerms: scored.matchedTerms,
          summary: textSection?.text ? excerpt(textSection.text) : '',
          drawings: drawingsForSection(section.sectionNumber),
          usage: sectionUsage(section.sectionNumber)
        };
      })
      .filter(section => section.confidence > 0 && section.matchedTerms >= minimumMatches)
      .sort((a, b) => b.confidence - a.confidence || b.matchedTerms - a.matchedTerms || a.sectionNumber.localeCompare(b.sectionNumber))
      .slice(0, Math.max(1, Number(limit) || 10));
    if (scheduleIntent) {
      const divisionOne = ranked.filter(section => String(section.sectionNumber || '').startsWith('01'));
      if (divisionOne.length) return divisionOne.slice(0, Math.max(1, Number(limit) || 10));
    }
    return ranked;
  }

  function findSectionsByDiscipline(query, drawingLinksOverride = null) {
    const needle = normalizeQuery(query);
    const rules = DISCIPLINE_KEYWORDS.filter(rule => rule.terms.some(term => needle.includes(term)));
    if (!rules.length) return [];
    const seen = new Set();
    const matches = [];
    for (const rule of rules) {
      for (const section of authoritativeSections()) {
        const textSection = sectionTextRecord(section.sectionNumber);
        const title = normalizeQuery(section.sectionTitle);
        const body = normalizeQuery(textSection?.text || '');
        if (!rule.terms.some(term => title.includes(term) || body.includes(term))) continue;
        const drawings = drawingsForSection(section.sectionNumber, drawingLinksOverride);
        const usage = sectionUsage(section.sectionNumber);
        if (!drawings.length && !usage.pages.length) continue;
        const key = sectionKey(section.documentId, section.sectionNumber);
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({
          ...section,
          confidence: Math.min(0.95, 0.55 + drawings.length * 0.08 + (textSection?.text ? 0.15 : 0)),
          summary: textSection?.text ? excerpt(textSection.text) : '',
          drawings,
          usage,
          discipline: rule.label
        });
      }
    }
    return matches.sort((a, b) => b.confidence - a.confidence || a.sectionNumber.localeCompare(b.sectionNumber)).slice(0, 12);
  }

  function answerQuestion(question = '', { activeSheet = null, drawingContext = null, limit = 8, drawingLinks = null, buildingId = '' } = {}) {
    const questionText = normalizeQuery(question);
    const questionSheet = sheetFromQuestion(questionText);
    const resolvedActiveSheet = activeSheet || questionSheet;
    const sheetNumber = normalizeSheetNumber(resolvedActiveSheet?.sheetNumber || drawingContext?.identity?.sheetNumber || drawingContext?.sheetNumber);
    const pageId = text(resolvedActiveSheet?.pageId || drawingContext?.identity?.pageId || drawingContext?.pageId);
    const resolvedBuildingId = text(buildingId) || buildingIdForQuestion(questionText, resolvedActiveSheet, drawingContext);
    const explicitSection = questionText.match(/\b(\d{2}\s?\d{2}\s?\d{2}(?:\.\d+)?)\b/);
    const scheduleIntent = questionText.includes('schedule') || questionText.includes('notice to proceed') || questionText.includes('ntp') || questionText.includes('posting');
    const asksSheet = /what specs apply to this drawing|what specifications apply to this drawing|what specs affect this drawing|what specs are on this drawing|what specifications are on this drawing|what specs apply to this sheet|what specifications apply to this sheet|what should i inspect in the field for this specification/i.test(questionText) || (sheetNumber && /what specs apply|what specs cover|what specifications apply|what requirements affect/i.test(questionText));
    const asksDrawings = /what drawings relate to|where is .* used|show me the drawings associated with this specification|what drawings should i review/i.test(questionText);
    const asksDiscipline = DISCIPLINE_KEYWORDS.some(rule => rule.terms.some(term => questionText.includes(term)));
    const resolvedDrawingLinks = list(drawingLinks).length ? list(drawingLinks) : null;
    const allDrawingLinks = resolvedDrawingLinks || projectDrawingLinks();
    const scopedDrawingLinks = resolvedBuildingId
      ? allDrawingLinks.filter(link => String(link.sheetNumber || '').trim().startsWith(resolvedBuildingId))
      : resolvedDrawingLinks;
    let specifications = [];
    let drawings = [];
    let answer = '';
    let queryType = 'general';

    if (asksSheet && (sheetNumber || pageId)) {
      queryType = 'drawing';
      specifications = sectionsForSheet(sheetNumber || activeSheet?.sheetNumber || '', scopedDrawingLinks);
      drawings = specifications.flatMap(item => drawingsForSection(item.sectionNumber, scopedDrawingLinks));
      const header = sheetNumber ? `${buildingLabelForSheet(sheetNumber)} Drawing ${sheetNumber}` : 'Current drawing';
      answer = [header, ...specifications.slice(0, Math.max(1, limit)).map(item => `- ${item.sectionNumber} — ${item.sectionTitle} (${item.relationshipType})`)].join('\n');
    } else if ((asksDrawings || explicitSection) && explicitSection?.[1]) {
      queryType = 'specification';
      const sectionNumber = normalizeSectionNumber(explicitSection[1]);
      const section = sectionRecord(sectionNumber);
      if (section) {
        drawings = drawingsForSection(sectionNumber, scopedDrawingLinks);
        const usage = sectionUsage(sectionNumber);
        specifications = [{ ...section, usage, drawings, summary: summarizeSection(section) }];
        answer = [
          `${section.sectionNumber} — ${section.sectionTitle}`,
          summarizeSection(section),
          drawings.length ? `Related ${buildingLabelForSheet(sheetNumber || pageId)} drawings:` : `No related ${buildingLabelForSheet(sheetNumber || pageId)} drawings were found in the validated relationship graph.`,
          ...drawings.slice(0, Math.max(1, limit)).map(item => `- ${item.sheetNumber || item.pageId}${item.sheetTitle ? ` — ${item.sheetTitle}` : ''} (${item.relationshipTypes.join(', ')})`)
        ].join('\n');
      }
    } else if (asksDiscipline) {
      queryType = 'discipline';
      specifications = findSectionsByDiscipline(questionText, scopedDrawingLinks);
      drawings = [...new Map(specifications.flatMap(item => item.drawings || []).map(item => [item.sheetNumber || item.pageId, item])).values()];
      const disciplineLabel = DISCIPLINE_KEYWORDS.find(rule => rule.terms.some(term => questionText.includes(term)))?.label || 'this discipline';
      answer = [`Bedford sections related to ${disciplineLabel}:`, ...specifications.slice(0, Math.max(1, limit)).map(item => `- ${item.sectionNumber} — ${item.sectionTitle}`)].join('\n');
    } else if (sheetNumber || pageId) {
      queryType = 'drawing';
      specifications = sectionsForSheet(sheetNumber || activeSheet?.sheetNumber || '', scopedDrawingLinks);
      drawings = specifications.flatMap(item => drawingsForSection(item.sectionNumber, scopedDrawingLinks));
      answer = [`${buildingLabelForSheet(sheetNumber || pageId)} drawing ${sheetNumber || pageId} is associated with ${specifications.length} specification section${specifications.length === 1 ? '' : 's'}.`, ...specifications.slice(0, Math.max(1, limit)).map(item => `- ${item.sectionNumber} — ${item.sectionTitle} (${item.relationshipType})`)].join('\n');
    } else {
      specifications = findSectionsForQuery(questionText, { limit });
      drawings = [...new Map(specifications.flatMap(item => item.drawings || []).map(item => [item.sheetNumber || item.pageId, item])).values()];
      answer = specifications.length
        ? scheduleIntent
          ? `I found ${specifications.length} Bedford general requirement section${specifications.length === 1 ? '' : 's'} that address schedule posting and Notice to Proceed timing.`
          : `I found ${specifications.length} Bedford specification section${specifications.length === 1 ? '' : 's'} that match your question.`
        : scheduleIntent
          ? 'No Bedford general requirement sections were identified for schedule posting or Notice to Proceed timing.'
          : 'No Bedford specification sections were identified for that question.';
    }

    const relatedDrawings = [...new Map(drawings.map(item => [item.sheetNumber || item.pageId, item])).values()];
    return {
      queryType,
      question: text(question),
      answer,
      specifications,
      drawings: relatedDrawings,
      sectionCount: specifications.length,
      drawingCount: relatedDrawings.length
    };
  }

  function buildContextString(result) {
    if (!result) return '';
    const parts = ['SPECIFICATION SME:', `Question: ${result.question || ''}`, `Answer: ${result.answer || ''}`];
    if (result.specifications?.length) {
      parts.push('Related Specifications:');
      for (const item of result.specifications.slice(0, 12)) {
        parts.push(`  - ${item.sectionNumber} — ${item.sectionTitle}${item.relationshipType ? ` (${item.relationshipType})` : ''}`);
        if (item.summary) parts.push(`    Evidence: ${item.summary}`);
      }
    }
    if (result.drawings?.length) {
      parts.push('Related Drawings:');
      for (const item of result.drawings.slice(0, 12)) {
        parts.push(`  - ${item.sheetNumber || item.pageId}${item.sheetTitle ? ` — ${item.sheetTitle}` : ''}${item.relationshipTypes?.length ? ` (${[...new Set(item.relationshipTypes)].join(', ')})` : ''}`);
      }
    }
    return parts.join('\n');
  }

  return {
    setTextSections(sections = []) {
      cachedTextSections = list(sections).map(item => ({ ...item }));
      cachedTextSectionMap = new Map(cachedTextSections.map(item => [normalizeSectionNumber(item.sectionNumber), { ...item }]));
    },
    refreshTextSections,
    getSpecificationUsage: sectionUsage,
    getDrawingsForSection: drawingsForSection,
    getSectionsForSheet: sectionsForSheet,
    findSectionsByDiscipline,
    findSectionsForQuery,
    answerQuestion,
    buildContextString,
    summarizeSection,
    getSheetForPageId: sheetForPageId,
    getSheetForSheetNumber: sheetForSheetNumber,
    getSheetFromQuestion: sheetFromQuestion,
    getSection: sectionRecord
  };
}
