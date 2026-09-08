const text = value => String(value ?? '').trim();
const lower = value => text(value).toLowerCase();
const uniq = values => [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];

const SCHEDULE_INTENT = /\b(schedule|scheduling|notice to proceed|ntp|posting|baseline schedule|progress schedule|deadline|timing|after ntp|before ntp|within)\b/i;
const DIRECT_TIMING_EVIDENCE = /\b(\d+)\s*(?:day|days|calendar days?|work days?|week|weeks|month|months|hour|hours)\b|\bwithin\s+\d+\b|\bno later than\b|\bnot later than\b|\bby\s+\d+\b/i;

function normalizeHitKey(hit = {}) {
  return [
    text(hit.documentId || hit.document?.id || hit.documentName),
    text(hit.sectionNumber),
    text(hit.pageStart || hit.pageRange?.start || hit.metadata?.pageRange?.start || ''),
    text(hit.pageEnd || hit.pageRange?.end || hit.metadata?.pageRange?.end || '')
  ].join('::');
}

function excerpt(value, maxLength = 700, focusTerms = []) {
  const clean = text(value).replace(/\s+/g, ' ');
  const terms = uniq((Array.isArray(focusTerms) ? focusTerms : []).map(term => lower(term))).filter(Boolean);
  const focusIndex = terms
    .map(term => clean.toLowerCase().indexOf(term))
    .find(index => index >= 0);

  if (Number.isInteger(focusIndex) && focusIndex > 0) {
    const start = Math.max(0, focusIndex - Math.floor(maxLength * 0.35));
    const end = Math.min(clean.length, start + maxLength);
    const slice = clean.slice(start, end);
    return `${start > 0 ? '…' : ''}${slice}${end < clean.length ? '…' : ''}`;
  }

  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1)}…`;
}

function collectSectionHints(bridgeContext = {}, initialHits = []) {
  const specificationSections = Array.isArray(bridgeContext?.specificationAnswer?.specifications)
    ? bridgeContext.specificationAnswer.specifications
    : [];
  const drawingEntries = Array.isArray(bridgeContext?.specificationAnswer?.drawings)
    ? bridgeContext.specificationAnswer.drawings
    : [];

  return uniq([
    ...specificationSections.flatMap(item => [
      text(item.sectionNumber),
      text(item.sectionTitle)
    ]),
    ...drawingEntries.flatMap(item => [
      text(item.sheetNumber),
      text(item.sheetTitle)
    ]),
    ...initialHits.flatMap(item => [
      text(item.sectionNumber),
      text(item.sectionTitle || item.heading)
    ])
  ]);
}

export function buildAssistedSearchQueries({
  question = '',
  bridgeContext = null,
  initialHits = [],
  assessment = null
} = {}) {
  const assessed = assessment || assessAssistedEvidence({ question, bridgeContext, initialHits });
  const questionText = assessed.question || text(question);
  const sectionHints = assessed.sectionHints || collectSectionHints(bridgeContext, initialHits);
  const queries = [
    questionText,
    assessed.expansionQuery
  ];

  if (assessed.scheduleIntent) {
    queries.push(
      'notice to proceed initial schedule',
      'initial schedule after notice to proceed',
      'initial schedule within 7 calendar days after notice to proceed',
      'within 7 calendar days after notice to proceed',
      'submit an initial schedule within 7 calendar days after notice to proceed',
      'schedule after notice to proceed',
      'schedule review meeting after notice to proceed',
      'work schedule after ntp',
      'schedule of costs baseline schedule monthly schedule update',
      'pre-start meeting detailed work schedule',
      'construction commencement submittals coordination drawings'
    );
  }

  for (const hint of sectionHints) {
    const cleanHint = text(hint);
    if (!cleanHint) continue;
    if (/^\d{2}\s+\d{2}\s+\d{2}(?:\.\d+)?$/.test(cleanHint)) {
      queries.push(
        `${cleanHint} schedule`,
        `${cleanHint} notice to proceed`,
        `${cleanHint} NTP`
      );
    } else if (/schedule|notice to proceed|ntp|pre-start|commencement/i.test(cleanHint)) {
      queries.push(cleanHint);
    }
  }

  return uniq(queries.map(query => text(query)).filter(Boolean));
}

function mergeHitsByKey(hitGroups = []) {
  const seen = new Set();
  const merged = [];

  for (const group of hitGroups) {
    for (const hit of Array.isArray(group) ? group : []) {
      const key = normalizeHitKey(hit);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(hit);
    }
  }

  return merged;
}

function scoreScheduleHit(hit = {}) {
  const sectionNumber = text(hit.sectionNumber);
  const combined = lower([
    hit.sectionTitle,
    hit.heading,
    hit.text,
    hit.summary
  ].filter(Boolean).join(' '));

  let score = 0;
  if (sectionNumber.startsWith('01')) score += 5;
  if (/\b11\s+21\s+20\.24\b/.test(sectionNumber)) score += 20;
  if (/\b33\s+08\s+00\b/.test(sectionNumber)) score += 4;
  if (/(notice to proceed|ntp|after ntp|calendar days after notice to proceed|calendar days after ntp|initial schedule|baseline schedule|monthly schedule update|revised schedule|final schedule|schedule of costs|pre-start meeting|detailed work schedule|schedule review meeting|construction commencement)/i.test(combined)) {
    score += 12;
  }
  if (/(within\s+\d+\s+(calendar\s+)?days?|not later than|no later than)/i.test(combined)) {
    score += 10;
  }
  if (/schedule/.test(combined)) score += 2;
  return score;
}

export function selectAssistedPassages(hits = [], assessment = null) {
  const entries = Array.isArray(hits) ? hits : [];
  if (!entries.length) return [];
  const scheduleIntent = Boolean(assessment?.scheduleIntent);
  const sorted = scheduleIntent
    ? [...entries].sort((a, b) => scoreScheduleHit(b) - scoreScheduleHit(a) || text(a.sectionNumber).localeCompare(text(b.sectionNumber)))
    : [...entries];

  return sorted;
}

export function assessAssistedEvidence({
  question = '',
  bridgeContext = null,
  initialHits = []
} = {}) {
  const questionText = text(question);
  const scheduleIntent = SCHEDULE_INTENT.test(questionText);
  const evidenceStrings = [
    bridgeContext?.reasoningResult?.answer,
    bridgeContext?.specificationAnswer?.answer,
    ...(Array.isArray(bridgeContext?.specificationAnswer?.specifications)
      ? bridgeContext.specificationAnswer.specifications.flatMap(item => [
        item.answer,
        item.summary,
        item.sectionTitle,
        item.sectionNumber
      ])
      : []),
    ...(Array.isArray(initialHits)
      ? initialHits.flatMap(item => [
        item.text,
        item.summary,
        item.sectionTitle,
        item.sectionNumber,
        item.heading
      ])
      : [])
  ].map(text).filter(Boolean);

  const evidenceText = evidenceStrings.join('\n');
  const directTimingEvidence = DIRECT_TIMING_EVIDENCE.test(evidenceText);
  const initialEvidenceCount = evidenceStrings.length +
    (Array.isArray(bridgeContext?.facts) ? bridgeContext.facts.length : 0) +
    (Array.isArray(bridgeContext?.relationships) ? bridgeContext.relationships.length : 0);
  const hasProjectEvidence = initialEvidenceCount > 0;
  const sufficient = hasProjectEvidence && (!scheduleIntent || directTimingEvidence);
  const sectionHints = collectSectionHints(bridgeContext, initialHits);
  const expansionQuery = uniq([
    questionText,
    ...sectionHints,
    scheduleIntent ? ['notice to proceed', 'schedule posting', 'baseline schedule', 'progress schedule'] : []
  ]).join(' ').trim();

  return {
    question: questionText,
    scheduleIntent,
    initialEvidenceCount,
    hasProjectEvidence,
    directTimingEvidence,
    sufficient,
    needsExpansion: !sufficient,
    sectionHints,
    expansionQuery
  };
}

export function formatAssistedEvidenceContext(hits = []) {
  const entries = Array.isArray(hits) ? hits : [];
  if (!entries.length) return '';

  const lines = ['AUTHORITATIVE PROJECT PDF EVIDENCE:'];
  entries.forEach((hit, index) => {
    const sectionNumber = text(hit.sectionNumber);
    const sectionTitle = text(hit.sectionTitle || hit.heading);
    const documentName = text(hit.documentName || hit.document?.title || hit.documentId);
    const pageStart = Number(hit.pageStart || hit.pageRange?.start || hit.metadata?.pageRange?.start || 0) || null;
    const pageEnd = Number(hit.pageEnd || hit.pageRange?.end || hit.metadata?.pageRange?.end || pageStart || 0) || null;
    const pageRange = pageStart ? `${pageStart}${pageEnd && pageEnd !== pageStart ? `-${pageEnd}` : ''}` : '';
    const matchedTerms = uniq([
      ...(Array.isArray(hit.matchedTerms) ? hit.matchedTerms : []),
      ...(Array.isArray(hit.matchedPhrases) ? hit.matchedPhrases : []),
      ...(Array.isArray(hit.matchedReferences) ? hit.matchedReferences : [])
    ]).join(', ');
    const sourceExcerpt = excerpt(hit.text || hit.summary || '', 900, [
      matchedTerms,
      'notice to proceed',
      'initial schedule',
      'baseline schedule',
      'monthly schedule update',
      'revised schedule',
      'final schedule',
      'schedule of costs',
      'construction commencement'
    ]);

    lines.push(
      `${index + 1}. ${sectionNumber ? `${sectionNumber} — ${sectionTitle || 'Untitled section'}` : sectionTitle || 'Untitled section'}`
    );
    if (documentName) lines.push(`   Document: ${documentName}`);
    if (pageRange) lines.push(`   Pages: ${pageRange}`);
    if (matchedTerms) lines.push(`   Retrieval terms: ${matchedTerms}`);
    if (sourceExcerpt) lines.push(`   Excerpt: ${sourceExcerpt}`);
  });

  return lines.join('\n');
}

export function buildAssistedEvidenceExpansion({
  question = '',
  bridgeContext = null,
  initialHits = [],
  authoritativeSections = [],
  retrieve = null,
  limit = 8
} = {}) {
  const assessment = assessAssistedEvidence({ question, bridgeContext, initialHits });
  const queries = buildAssistedSearchQueries({
    question,
    bridgeContext,
    initialHits,
    assessment
  });
  const sections = Array.isArray(authoritativeSections) ? authoritativeSections : [];
  const corpusStats = {
    sectionCount: sections.length,
    documentCount: new Set(
      sections.map(section => text(section.documentId || section.document?.id || section.documentName)).filter(Boolean)
    ).size
  };
  if (!assessment.needsExpansion || !sections.length || typeof retrieve !== 'function') {
    return {
      assessment,
      query: assessment.expansionQuery,
      queries,
      corpusStats,
      hits: [],
      context: ''
    };
  }

  const perQueryLimit = Math.max(2, Math.min(6, Number(limit) || 8));
  const hitGroups = queries.map(query =>
    retrieve(
      query,
      sections,
      perQueryLimit
    )
  );
  const hits = mergeHitsByKey(hitGroups);

  const initialKeys = new Set(
    (Array.isArray(initialHits) ? initialHits : []).map(hit =>
      normalizeHitKey(hit)
    )
  );
  const distinctHits = hits.filter(hit =>
    !initialKeys.has(normalizeHitKey(hit))
  );
  const rankedHits = selectAssistedPassages(distinctHits, assessment);

  return {
    assessment,
    query: assessment.expansionQuery,
    queries,
    corpusStats,
    hits: rankedHits,
    context: formatAssistedEvidenceContext(rankedHits)
  };
}
