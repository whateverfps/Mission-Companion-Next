import {
  arrayValue,
  normalizedKey,
  normalizedText,
  sectionNumberKey
} from './data-model.js';
import { getChiefIntelligenceBridge } from './chief-intelligence-bridge.js';

const STOP = new Set(
  [
    'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for',
    'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'this', 'that', 'these', 'those', 'it', 'its', 'as', 'at', 'into',
    'about', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'can',
    'could', 'should', 'would', 'may', 'might', 'do', 'does', 'did'
  ]
);

function canonicalHitPath(value) {
  if (Array.isArray(value)) {
    return value
      .map(part => String(part ?? '').trim())
      .filter(Boolean);
  }

  const legacyPath = String(value ?? '').trim();
  return legacyPath ? [legacyPath] : [];
}

const SYNONYMS = {
  definition: [
    'means',
    'defined',
    'definition',
    'refers',
    'interpretation'
  ],

  responsibility: [
    'responsible',
    'responsibility',
    'duties',
    'duty',
    'shall',
    'must',
    'obligation'
  ],

  requirement: [
    'required',
    'requirement',
    'shall',
    'must',
    'minimum',
    'mandatory'
  ],

  submit: [
    'submittal',
    'submit',
    'submission',
    'provide',
    'deliver'
  ],

  approve: [
    'approval',
    'approved',
    'acceptance',
    'accepted',
    'authorize',
    'authorized'
  ],

  inspect: [
    'inspection',
    'inspect',
    'verify',
    'verification',
    'review',
    'examine'
  ],

  schedule: [
    'scheduled',
    'scheduling',
    'timeline',
    'duration',
    'milestone',
    'completion'
  ],

  payment: [
    'pay',
    'paid',
    'compensation',
    'invoice',
    'billing',
    'reimbursement'
  ],

  contractor: [
    'vendor',
    'builder',
    'construction contractor',
    'prime contractor',
    'general contractor'
  ],

  owner: [
    'government',
    'va',
    'agency',
    'owner representative',
    'contracting officer',
    'cor'
  ],

  conflict: [
    'exception',
    'unless',
    'however',
    'notwithstanding',
    'supersede',
    'precedence',
    'discrepancy'
  ],

  closeout: [
    'turnover',
    'completion',
    'final acceptance',
    'punch list',
    'warranty',
    'record documents'
  ],

  safety: [
    'hazard',
    'protection',
    'unsafe',
    'incident',
    'osha',
    'life safety'
  ]
};

const NEGATION =
  /\b(no|not|never|shall not|must not|may not|prohibited|except|unless|without|neither)\b/i;

const REQUIREMENT =
  /\b(shall|must|required|prohibited|may not|is responsible for|will provide|will perform)\b/i;

const EXCEPTION =
  /\b(exception|except|unless|however|notwithstanding|subject to|provided that)\b/i;

const DEFINITION =
  /\b(means|defined as|definition|refers to|shall mean)\b/i;

const RESPONSIBILITY =
  /\b(responsible for|responsibility|duties include|shall provide|shall perform|must provide|must perform)\b/i;

const CROSS_REFERENCE_PATTERNS = [
  /\b(?:section|article|chapter|appendix|specification|paragraph|part)\s+[a-z0-9][a-z0-9 ._-]*/gi,
  /\b\d{2}\s+\d{2}\s+\d{2}(?:\.\d+)*\b/g,
  /\b\d+(?:\.\d+){1,5}\b/g
];

const tokens = value =>
  (
    String(value || '')
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9._/-]*/g) ||
    []
  ).filter(token =>
    token.length > 1 &&
    !STOP.has(token)
  );

const stem = token =>
  String(token || '')
    .toLowerCase()
    .replace(
      /(ingly|edly|ments|ment|ness|ations|ation|ions|ion|ities|ity|ies|ied|ing|ers|er|ed|es|s)$/,
      ''
    );

const uniq = values =>
  [...new Set(values.filter(Boolean))];

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, value));

function normalizeReference(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value || '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(text, term) {
  if (!text || !term) {
    return 0;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegex(term)}(?=$|[^a-z0-9])`,
    'gi'
  );

  return [...String(text).matchAll(pattern)].length;
}

const sectionAnalysisCache = new WeakMap();
const corpusStatsCache = new WeakMap();

function analyzeSection(section) {
  const cached = sectionAnalysisCache.get(section);
  if (cached) return cached;

  const heading = String(section.heading || '').toLowerCase();
  const path = (Array.isArray(section.path) ? section.path : []).join(' ').toLowerCase();
  const location = String(section.location || '').toLowerCase();
  const text = String(section.text || '').toLowerCase();
  const headingTerms = tokens(heading).map(stem);
  const pathTerms = tokens(path).map(stem);
  const textWords = tokens(text);
  const textTerms = textWords.map(stem);
  const bm25Terms = [
    ...headingTerms,
    ...headingTerms,
    ...pathTerms,
    ...textTerms
  ];
  const bm25Frequency = new Map();
  for (const term of bm25Terms) {
    bm25Frequency.set(term, (bm25Frequency.get(term) || 0) + 1);
  }

  const analysis = {
    heading,
    path,
    location,
    text,
    combined: `${heading} ${path} ${text}`,
    headingTokens: new Set(headingTerms),
    pathTokens: new Set(pathTerms),
    textTokens: new Set(textTerms),
    textLength: textWords.length,
    corpusTerms: new Set([...headingTerms, ...pathTerms, ...tokens(location).map(stem), ...textTerms]),
    bm25Frequency,
    bm25Length: Math.max(1, bm25Terms.length),
    crossReferences: extractReferences(`${heading} ${text}`)
  };
  sectionAnalysisCache.set(section, analysis);
  return analysis;
}

function classifyQueryIntent(rawQuery) {
  const query = String(rawQuery || '').toLowerCase();

  const intents = [];

  if (
    /\b(define|definition|meaning|what is|what does .* mean)\b/i.test(query)
  ) {
    intents.push('definition');
  }

  if (
    /\b(who|responsib|duty|duties|role|obligation)\b/i.test(query)
  ) {
    intents.push('responsibility');
  }

  if (
    /\b(require|required|requirement|shall|must|prohibit|mandatory)\b/i.test(query)
  ) {
    intents.push('requirement');
  }

  if (
    /\b(exception|unless|conflict|precedence|supersede|contradict)\b/i.test(query)
  ) {
    intents.push('conflict');
  }

  if (
    /\b(submit|submittal|provide for approval|submission)\b/i.test(query)
  ) {
    intents.push('submittal');
  }

  if (
    /\b(inspect|inspection|verify|verification|review)\b/i.test(query)
  ) {
    intents.push('inspection');
  }

  if (
    /\b(schedule|when|duration|timeline|milestone|completion date)\b/i.test(query)
  ) {
    intents.push('schedule');
  }

  if (
    /\b(payment|invoice|paid|compensation|billing)\b/i.test(query)
  ) {
    intents.push('payment');
  }

  if (
    /\b(closeout|turnover|final acceptance|warranty|punch list)\b/i.test(query)
  ) {
    intents.push('closeout');
  }

  if (
    /\b(prerequisites?|predecessor|successor|dependenc(?:y|ies)|downstream|handoffs?)\b/i.test(query) ||
    /\b(depends on|dependent on|required prior to|must (?:happen|occur) before|what must happen before|what is required before|what comes next|what follows|what happens after|blocked by|what is blocking|cannot proceed until|shall not proceed until|sequence of (?:work|activities)|order of operations|downstream impacts?)\b/i.test(query) ||
    /\baffected if\b[^.!?\n]{0,120}\bdelayed\b/i.test(query)
  ) {
    intents.push('dependency');
  }

  return intents.length
    ? intents
    : ['general'];
}

function extractReferences(value) {
  const found = [];

  for (const pattern of CROSS_REFERENCE_PATTERNS) {
    const matches = String(value || '').match(pattern) || [];

    for (const match of matches) {
      const normalized = normalizeReference(match);

      if (normalized.length >= 3) {
        found.push(normalized);
      }
    }
  }

  return uniq(found);
}

export function expandQuery(query) {
  const raw = String(query || '');
  const base = tokens(raw);
  const expanded = [];

  for (const token of base) {
    expanded.push(token, stem(token));

    for (const [root, terms] of Object.entries(SYNONYMS)) {
      const synonymTokens = terms.flatMap(tokens);

      const matchesRoot =
        token === root ||
        stem(token) === stem(root);

      const matchesSynonym = synonymTokens.some(synonym =>
        synonym === token ||
        stem(synonym) === stem(token) ||
        synonym.includes(token) ||
        token.includes(synonym)
      );

      if (matchesRoot || matchesSynonym) {
        expanded.push(
          root,
          stem(root),
          ...synonymTokens,
          ...synonymTokens.map(stem)
        );
      }
    }
  }

  const quotedPhrases = [
    ...raw.matchAll(/"([^"]+)"/g)
  ].map(match =>
    match[1].toLowerCase().trim()
  );

  const naturalPhrases = [];

  const normalizedWords = raw
    .toLowerCase()
    .replace(/[^\w./-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (let size = 2; size <= 4; size += 1) {
    for (
      let index = 0;
      index <= normalizedWords.length - size;
      index += 1
    ) {
      const phrase = normalizedWords
        .slice(index, index + size)
        .join(' ');

      const meaningfulTerms = tokens(phrase);

      if (meaningfulTerms.length >= 2) {
        naturalPhrases.push(phrase);
      }
    }
  }

  return {
    raw,
    base: uniq(base),
    stems: uniq(base.map(stem)),
    expanded: uniq(expanded),
    phrases: uniq([
      ...quotedPhrases,
      ...naturalPhrases
    ]),
    references: extractReferences(raw),
    intents: classifyQueryIntent(raw)
  };
}

function buildCorpusStats(sections) {
  const cached = corpusStatsCache.get(sections);
  if (cached) return cached;

  const documentFrequency = new Map();
  let totalLength = 0;

  for (const section of sections) {
    const analysis = analyzeSection(section);
    totalLength += analysis.textLength;

    for (const term of analysis.corpusTerms) {
      documentFrequency.set(
        term,
        (documentFrequency.get(term) || 0) + 1
      );
    }
  }

  const stats = {
    sectionCount: Math.max(1, sections.length),
    averageLength:
      sections.length
        ? totalLength / sections.length
        : 1,
    documentFrequency
  };
  corpusStatsCache.set(sections, stats);
  return stats;
}

function inverseDocumentFrequency(term, corpus) {
  const frequency =
    corpus.documentFrequency.get(stem(term)) ||
    0;

  return Math.log(
    1 +
    (
      corpus.sectionCount -
      frequency +
      0.5
    ) /
    (
      frequency +
      0.5
    )
  );
}

function bm25Score(analysis, queryTerms, corpus) {
  const frequency = analysis.bm25Frequency;
  const sectionLength = analysis.bm25Length;
  const k1 = 1.35;
  const b = 0.72;

  let score = 0;

  for (const queryTerm of uniq(queryTerms.map(stem))) {
    const termFrequency =
      frequency.get(queryTerm) ||
      0;

    if (!termFrequency) {
      continue;
    }

    const idf = inverseDocumentFrequency(
      queryTerm,
      corpus
    );

    const numerator =
      termFrequency *
      (k1 + 1);

    const denominator =
      termFrequency +
      k1 *
      (
        1 -
        b +
        b *
        (
          sectionLength /
          Math.max(1, corpus.averageLength)
        )
      );

    score += idf * numerator / denominator;
  }

  return score;
}

function calculateCoverage(query, matchedTerms) {
  if (!query.base.length) {
    return 0;
  }

  const matchedStems = new Set(
    matchedTerms
      .flatMap(tokens)
      .map(stem)
  );

  const covered = query.base.filter(term =>
    matchedStems.has(stem(term))
  ).length;

  return covered / query.base.length;
}

function intentScore(combinedText, query) {
  let score = 0;
  const matchedIntents = [];

  for (const intent of query.intents) {
    if (
      intent === 'definition' &&
      DEFINITION.test(combinedText)
    ) {
      score += 12;
      matchedIntents.push(intent);
    }

    if (
      intent === 'responsibility' &&
      RESPONSIBILITY.test(combinedText)
    ) {
      score += 12;
      matchedIntents.push(intent);
    }

    if (
      intent === 'requirement' &&
      REQUIREMENT.test(combinedText)
    ) {
      score += 10;
      matchedIntents.push(intent);
    }

    if (
      intent === 'conflict' &&
      EXCEPTION.test(combinedText)
    ) {
      score += 11;
      matchedIntents.push(intent);
    }

    if (
      intent === 'submittal' &&
      /\b(submit|submittal|submission|provide for approval)\b/i.test(
        combinedText
      )
    ) {
      score += 9;
      matchedIntents.push(intent);
    }

    if (
      intent === 'inspection' &&
      /\b(inspect|inspection|verify|verification|review)\b/i.test(
        combinedText
      )
    ) {
      score += 9;
      matchedIntents.push(intent);
    }

    if (
      intent === 'schedule' &&
      /\b(schedule|scheduled|duration|timeline|milestone|completion)\b/i.test(
        combinedText
      )
    ) {
      score += 8;
      matchedIntents.push(intent);
    }

    if (
      intent === 'payment' &&
      /\b(payment|invoice|billing|compensation|paid)\b/i.test(
        combinedText
      )
    ) {
      score += 8;
      matchedIntents.push(intent);
    }

    if (
      intent === 'closeout' &&
      /\b(closeout|turnover|final acceptance|warranty|punch list|record documents)\b/i.test(
        combinedText
      )
    ) {
      score += 8;
      matchedIntents.push(intent);
    }
  }

  return {
    score,
    matchedIntents: uniq(matchedIntents)
  };
}

function scoreSection(section, query, corpus) {
  const analysis = analyzeSection(section);
  const { heading, path, location, text, headingTokens, pathTokens, textTokens } = analysis;

  let lexical = 0;
  let headingScore = 0;
  let pathScore = 0;
  let phraseScore = 0;
  let referenceScore = 0;
  let exactTermScore = 0;

  const matchedTerms = [];
  const matchedReferences = [];
  const matchedPhrases = [];

  for (const term of query.expanded) {
    const normalizedTerm = term.toLowerCase();
    const termStem = stem(normalizedTerm);
    let matched = false;

    if (
      headingTokens.has(termStem) ||
      heading.includes(normalizedTerm)
    ) {
      headingScore += 15;
      matched = true;
    }

    if (
      pathTokens.has(termStem) ||
      path.includes(normalizedTerm)
    ) {
      pathScore += 9;
      matched = true;
    }

    if (
      textTokens.has(termStem)
    ) {
      const frequency = countOccurrences(
        text,
        normalizedTerm
      );

      lexical +=
        3.5 +
        Math.min(6, frequency * 1.25);

      matched = true;
    } else if (
      normalizedTerm.length >= 4 &&
      text.includes(normalizedTerm)
    ) {
      lexical += 1.5;
      matched = true;
    }

    if (
      query.base.includes(normalizedTerm) &&
      (
        heading.includes(normalizedTerm) ||
        path.includes(normalizedTerm) ||
        text.includes(normalizedTerm)
      )
    ) {
      exactTermScore += 2.5;
    }

    if (matched) {
      matchedTerms.push(normalizedTerm);
    }
  }

  for (const phrase of query.phrases) {
    if (phrase.length < 5) {
      continue;
    }

    if (heading.includes(phrase)) {
      phraseScore += 28;
      matchedPhrases.push(phrase);
      continue;
    }

    if (path.includes(phrase)) {
      phraseScore += 22;
      matchedPhrases.push(phrase);
      continue;
    }

    if (text.includes(phrase)) {
      phraseScore +=
        phrase.split(/\s+/).length >= 3
          ? 18
          : 11;

      matchedPhrases.push(phrase);
    }
  }

  for (const reference of query.references) {
    const normalizedReference =
      normalizeReference(reference);

    if (
      heading.includes(normalizedReference) ||
      path.includes(normalizedReference) ||
      location.includes(normalizedReference)
    ) {
      referenceScore += 40;
      matchedReferences.push(reference);
      continue;
    }

    if (text.includes(normalizedReference)) {
      referenceScore += 22;
      matchedReferences.push(reference);
    }
  }

  const coverage = calculateCoverage(
    query,
    matchedTerms
  );

  const combined = analysis.combined;

  const intent = intentScore(
    combined,
    query
  );

  const bm25 = bm25Score(
    analysis,
    [
      ...query.base,
      ...query.expanded
    ],
    corpus
  );

  const crossReferences = analysis.crossReferences;

  const hierarchyBonus =
    section.level === 1
      ? 4
      : section.level === 2
        ? 3
        : section.level === 3
          ? 1.5
          : 0;

  const requirementBonus =
    REQUIREMENT.test(text)
      ? 3
      : 0;

  const exceptionBonus =
    EXCEPTION.test(text) &&
    query.intents.includes('conflict')
      ? 4
      : 0;

  const length = Math.max(
    1,
    text.length
  );

  const specificity = clamp(
    1 -
    Math.log10(
      Math.max(100, length)
    ) / 18,
    0.68,
    0.95
  );

  const coverageMultiplier =
    0.48 +
    coverage * 0.52;

  const rawScore =
    lexical +
    headingScore +
    pathScore +
    phraseScore +
    referenceScore +
    exactTermScore +
    intent.score +
    bm25 * 6 +
    hierarchyBonus +
    requirementBonus +
    exceptionBonus;

  const score =
    rawScore *
    coverageMultiplier *
    specificity;

  return {
    score,

    components: {
      lexical: roundScore(lexical),
      bm25: roundScore(bm25 * 6),
      heading: roundScore(headingScore),
      path: roundScore(pathScore),
      phrase: roundScore(phraseScore),
      reference: roundScore(referenceScore),
      exactTerm: roundScore(exactTermScore),
      intent: roundScore(intent.score),
      hierarchy: roundScore(hierarchyBonus),
      coverage: Math.round(coverage * 100)
    },

    matchedTerms: uniq(
      matchedTerms
    ).slice(0, 15),

    matchedPhrases: uniq(
      matchedPhrases
    ).slice(0, 8),

    matchedReferences: uniq(
      matchedReferences
    ).slice(0, 8),

    matchedIntents: intent.matchedIntents,

    crossReferences
  };
}

function roundScore(value) {
  return Math.round(
    Number(value || 0) * 10
  ) / 10;
}

function rerank(rows, topK) {
  const selected = [];
  const remaining = [...rows];

  const documentCounts = new Map();
  const headingCounts = new Map();

  while (
    remaining.length &&
    selected.length < topK
  ) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (
      let index = 0;
      index < remaining.length;
      index += 1
    ) {
      const row = remaining[index];

      const documentCount =
        documentCounts.get(row.documentId) ||
        0;

      const normalizedHeading = String(
        row.heading ||
        ''
      )
        .toLowerCase()
        .trim();

      const headingCount =
        headingCounts.get(normalizedHeading) ||
        0;

      let rerankScore = row.score;

      if (
        row.components.coverage >= 80
      ) {
        rerankScore += 10;
      } else if (
        row.components.coverage >= 60
      ) {
        rerankScore += 6;
      }

      if (
        row.matchedReferences?.length
      ) {
        rerankScore += 5;
      }

      if (
        row.matchedPhrases?.length
      ) {
        rerankScore += 4;
      }

      if (
        row.matchedIntents?.length
      ) {
        rerankScore += 3;
      }

      if (
        row.level <= 2
      ) {
        rerankScore += 2;
      }

      if (
        documentCount >= 2
      ) {
        rerankScore -=
          Math.min(
            16,
            documentCount * 4
          );
      }

      if (
        headingCount >= 1 &&
        normalizedHeading
      ) {
        rerankScore -=
          Math.min(
            10,
            headingCount * 4
          );
      }

      const sameDocumentNearDuplicate =
        selected.some(existing =>
          existing.documentId === row.documentId &&
          textSimilarity(
            existing.text,
            row.text
          ) > 0.78
        );

      if (sameDocumentNearDuplicate) {
        rerankScore -= 14;
      }

      if (rerankScore > bestScore) {
        bestScore = rerankScore;
        bestIndex = index;
      }
    }

    const chosen = remaining.splice(
      bestIndex,
      1
    )[0];

    selected.push({
      ...chosen,
      rerankScore: bestScore
    });

    documentCounts.set(
      chosen.documentId,
      (
        documentCounts.get(chosen.documentId) ||
        0
      ) + 1
    );

    const normalizedHeading = String(
      chosen.heading ||
      ''
    )
      .toLowerCase()
      .trim();

    headingCounts.set(
      normalizedHeading,
      (
        headingCounts.get(normalizedHeading) ||
        0
      ) + 1
    );
  }

  return selected.sort((a, b) =>
    b.rerankScore - a.rerankScore ||
    b.score - a.score
  );
}

function textSimilarity(first, second) {
  const firstTerms = new Set(
    tokens(first).map(stem)
  );

  const secondTerms = new Set(
    tokens(second).map(stem)
  );

  if (
    !firstTerms.size ||
    !secondTerms.size
  ) {
    return 0;
  }

  const intersection = [
    ...firstTerms
  ].filter(term =>
    secondTerms.has(term)
  ).length;

  const union = new Set([
    ...firstTerms,
    ...secondTerms
  ]).size;

  return intersection / Math.max(1, union);
}

function requirementPolarity(text) {
  const value = String(text || '');

  if (
    /\b(shall not|must not|may not|is prohibited|are prohibited|not permitted)\b/i.test(
      value
    )
  ) {
    return 'negative';
  }

  if (
    /\b(shall|must|required|is responsible for|will provide|will perform)\b/i.test(
      value
    )
  ) {
    return 'positive';
  }

  return 'neutral';
}

function sharedRequirementTerms(first, second) {
  const firstTerms = new Set(
    tokens(first)
      .map(stem)
      .filter(term =>
        term.length >= 4
      )
  );

  const secondTerms = new Set(
    tokens(second)
      .map(stem)
      .filter(term =>
        term.length >= 4
      )
  );

  return [
    ...firstTerms
  ].filter(term =>
    secondTerms.has(term)
  );
}
const RESPONSIBLE_PARTIES = [
    "contractor",
    "government",
    "owner",
    "owner qc",
    "owner representative",
    "resident engineer",
    "contracting officer",
    "co",
    "cor",
    "designer",
    "architect",
    "engineer",
    "commissioning agent",
    "oit",
    "subcontractor",
    "manufacturer",
    "vendor",
    "supplier",
    "fire marshal",
    "authority having jurisdiction",
    "ahj"
];

const DELIVERABLE_KEYWORDS = [
    "submittal",
    "shop drawing",
    "product data",
    "sample",
    "inspection report",
    "test report",
    "commissioning report",
    "photograph",
    "certificate",
    "closeout",
    "record drawing",
    "as-built",
    "operation manual",
    "maintenance manual",
    "warranty",
    "training",
    "schedule",
    "mockup",
    "punch list"
];

const ACCEPTANCE_PATTERNS = [

    /\baccepted when\b/i,
    /\bapproved by\b/i,
    /\bsuccessful completion\b/i,
    /\bverified by\b/i,
    /\bpasses testing\b/i,
    /\bacceptable\b/i,
    /\bapproval required\b/i,
    /\bfinal acceptance\b/i

];

const REQUIREMENT_PATTERNS = [

    /\bshall\b/i,
    /\bshall not\b/i,
    /\bmust\b/i,
    /\bmust not\b/i,
    /\brequired\b/i,
    /\bprohibited\b/i,
    /\bmay\b/i,
    /\bmay not\b/i

];

const EXCEPTION_PATTERNS = [

    /\bunless\b/i,
    /\bexcept\b/i,
    /\bprovided that\b/i,
    /\bhowever\b/i,
    /\bsubject to\b/i,
    /\bnotwithstanding\b/i

];

function splitIntoSentences(text)
{
    return String(text || "")

        .replace(/\r/g," ")

        .split(/(?<=[.!?])\s+/)

        .map(x=>x.trim())

        .filter(Boolean);
}

function containsPattern(sentence, patterns)
{
    return patterns.some(pattern=>pattern.test(sentence));
}

function detectResponsibleParty(sentence)
{
    const lower = sentence.toLowerCase();

    for(const party of RESPONSIBLE_PARTIES)
    {
        if(lower.includes(party))
            return party;
    }

    return null;
}

function detectDeliverables(sentence)
{
    const found=[];

    const lower=sentence.toLowerCase();

    for(const item of DELIVERABLE_KEYWORDS)
    {
        if(lower.includes(item))
            found.push(item);
    }

    return uniq(found);
}

function sentenceConfidence(sentence)
{
    let score=0;

    if(REQUIREMENT.test(sentence))
        score+=25;

    if(RESPONSIBILITY.test(sentence))
        score+=20;

    if(DEFINITION.test(sentence))
        score+=15;

    if(EXCEPTION.test(sentence))
        score-=5;

    score+=Math.min(sentence.length/12,20);

    return clamp(Math.round(score),0,100);
}

function buildKnowledgeNode(hit,sentence)
{
    return {

        sourceNumber:hit.sourceNumber,

        documentId:hit.documentId,

        documentName:hit.documentName,

        heading:hit.heading,

        path:hit.path,

        level:hit.level,

        location:hit.location,

        sentence,

        confidence:sentenceConfidence(sentence),

        responsibleParty:detectResponsibleParty(sentence),

        deliverables:detectDeliverables(sentence),

        references:extractReferences(sentence)

    };
}

function buildKnowledgeNodes(hits)
{
    const nodes=[];

    for(const hit of hits)
    {
        const sentences=splitIntoSentences(hit.text);

        for(const sentence of sentences)
        {
            nodes.push(
                buildKnowledgeNode(hit,sentence)
            );
        }
    }

    return nodes;
}

function filterRequirementNodes(nodes)
{
    return nodes.filter(node=>

        containsPattern(
            node.sentence,
            REQUIREMENT_PATTERNS
        )

    );
}

function filterExceptionNodes(nodes)
{
    return nodes.filter(node=>

        containsPattern(
            node.sentence,
            EXCEPTION_PATTERNS
        )

    );
}

function filterAcceptanceNodes(nodes)
{
    return nodes.filter(node=>

        containsPattern(
            node.sentence,
            ACCEPTANCE_PATTERNS
        )

    );
}

function summarizeKnowledge(nodes)
{
    return {

        totalNodes:nodes.length,

        requirements:
            filterRequirementNodes(nodes).length,

        acceptance:
            filterAcceptanceNodes(nodes).length,

        exceptions:
            filterExceptionNodes(nodes).length,

        deliverables:
            nodes.filter(x=>x.deliverables.length).length,

        responsible:
            nodes.filter(x=>x.responsibleParty).length

    };
}
function complianceNormalize(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function complianceKey(value) {
  return complianceNormalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function complianceUnique(values) {
  return [
    ...new Set(
      (values || [])
        .filter(Boolean)
        .map(value =>
          typeof value === 'string'
            ? complianceNormalize(value)
            : value
        )
    )
  ];
}

function compliancePercent(numerator, denominator) {
  if (!denominator) {
    return 100;
  }

  return Math.round(
    numerator /
    denominator *
    100
  );
}

function inferRequirementPhase(requirement) {
  const value = complianceKey([
    requirement.statement,
    requirement.action,
    ...(requirement.deliverables || []),
    requirement.heading,
    ...(requirement.path || [])
  ].join(' '));

  if (
    /\b(preconstruction|pre construction|before work|prior to work|notice to proceed|kickoff|mobilization)\b/.test(
      value
    )
  ) {
    return 'preconstruction';
  }

  if (
    /\b(submittal|shop drawing|product data|sample|mockup|approval)\b/.test(
      value
    )
  ) {
    return 'submittal';
  }

  if (
    /\b(install|installation|construct|construction|execute work|perform work)\b/.test(
      value
    )
  ) {
    return 'installation';
  }

  if (
    /\b(inspect|inspection|verify|verification|quality control|quality assurance|qc|qa)\b/.test(
      value
    )
  ) {
    return 'inspection';
  }

  if (
    /\b(test|testing|commission|commissioning|functional performance|startup|start up|demonstration)\b/.test(
      value
    )
  ) {
    return 'testing';
  }

  if (
    /\b(acceptance|accepted|approve|approval|turnover|substantial completion)\b/.test(
      value
    )
  ) {
    return 'acceptance';
  }

  if (
    /\b(closeout|warranty|record drawing|as built|as-built|o&m|operation manual|maintenance manual|training|final completion)\b/.test(
      value
    )
  ) {
    return 'closeout';
  }

  return 'general';
}

function inferChecklistCategory(requirement) {
  const value = complianceKey([
    requirement.statement,
    requirement.action,
    ...(requirement.deliverables || [])
  ].join(' '));

  if (
    /\b(submittal|shop drawing|product data|sample|mockup)\b/.test(
      value
    )
  ) {
    return 'Submittals';
  }

  if (
    /\b(icra|pcra|infection control|safety plan|hazard|permit)\b/.test(
      value
    )
  ) {
    return 'Readiness and Safety';
  }

  if (
    /\b(inspect|inspection|verify|verification|qc|qa|quality control|quality assurance)\b/.test(
      value
    )
  ) {
    return 'Inspection';
  }

  if (
    /\b(test|testing|commission|commissioning|startup|functional performance)\b/.test(
      value
    )
  ) {
    return 'Testing and Commissioning';
  }

  if (
    /\b(photo|photograph|record|report|certificate|documentation)\b/.test(
      value
    )
  ) {
    return 'Documentation';
  }

  if (
    /\b(punch|deficien|corrective|nonconform|non-conform)\b/.test(
      value
    )
  ) {
    return 'Deficiencies';
  }

  if (
    /\b(closeout|warranty|training|record drawing|as built|as-built|o&m|operation manual|maintenance manual)\b/.test(
      value
    )
  ) {
    return 'Closeout';
  }

  if (
    /\b(accept|acceptance|approved|approval)\b/.test(
      value
    )
  ) {
    return 'Acceptance';
  }

  return 'General';
}

function inferEvidenceType(requirement) {
  const deliverables =
    requirement.deliverables || [];

  if (deliverables.length) {
    return complianceUnique(
      deliverables.map(deliverable => {
        const value =
          complianceKey(deliverable);

        if (
          /\b(report)\b/.test(value)
        ) {
          return 'Report';
        }

        if (
          /\b(photo|photograph)\b/.test(value)
        ) {
          return 'Photograph';
        }

        if (
          /\b(certificate|certification)\b/.test(value)
        ) {
          return 'Certificate';
        }

        if (
          /\b(schedule)\b/.test(value)
        ) {
          return 'Schedule';
        }

        if (
          /\b(submittal|shop drawing|product data|sample)\b/.test(value)
        ) {
          return 'Approved Submittal';
        }

        if (
          /\b(record drawing|as built|as-built)\b/.test(value)
        ) {
          return 'Record Drawing';
        }

        if (
          /\b(warranty)\b/.test(value)
        ) {
          return 'Warranty';
        }

        if (
          /\b(training)\b/.test(value)
        ) {
          return 'Training Record';
        }

        return deliverable;
      })
    );
  }

  const value =
    complianceKey(requirement.statement);

  const evidence = [];

  if (
    /\binspect|inspection|verify|verification\b/.test(value)
  ) {
    evidence.push('Inspection Record');
  }

  if (
    /\btest|testing|commission|commissioning\b/.test(value)
  ) {
    evidence.push('Test Record');
  }

  if (
    /\bapprove|approval|accepted|acceptance\b/.test(value)
  ) {
    evidence.push('Approval Record');
  }

  if (
    /\bnotify|notice\b/.test(value)
  ) {
    evidence.push('Written Notice');
  }

  if (
    /\bcoordinate|meeting\b/.test(value)
  ) {
    evidence.push('Meeting Record');
  }

  return evidence.length
    ? evidence
    : ['Supporting Documentation'];
}

function complianceStatusFromAssessment(
  requirement,
  assessment
) {
  if (
    requirement.type === 'prohibited'
  ) {
    return assessment?.supported
      ? 'controlled'
      : 'review-required';
  }

  if (!assessment) {
    return 'not-assessed';
  }

  return assessment.supported
    ? 'supported'
    : 'missing-evidence';
}

function complianceRiskLevel(
  requirement,
  assessment
) {
  if (
    requirement.type === 'prohibited'
  ) {
    return assessment?.supported
      ? 'medium'
      : 'high';
  }

  if (
    requirement.type === 'mandatory' &&
    !assessment?.supported
  ) {
    return 'high';
  }

  if (
    requirement.type === 'mandatory' &&
    assessment?.supported
  ) {
    return 'low';
  }

  if (
    requirement.type === 'advisory' &&
    !assessment?.supported
  ) {
    return 'medium';
  }

  return 'low';
}

export function buildComplianceMatrix(
  hits,
  evidenceSections = hits,
  options = {}
) {
  const requirementsResult =
    extractRequirements(hits);

  const evidenceResult =
    detectMissingEvidence(
      hits,
      evidenceSections,
      options
    );

  const assessmentById = new Map(
    evidenceResult.assessments.map(
      assessment => [
        assessment.requirementId,
        assessment
      ]
    )
  );

  const rows =
    requirementsResult.requirements.map(
      requirement => {
        const assessment =
          assessmentById.get(
            requirement.id
          );

        return {
          id:
            requirement.id,

          requirement:
            requirement.statement,

          type:
            requirement.type,

          phase:
            inferRequirementPhase(
              requirement
            ),

          category:
            inferChecklistCategory(
              requirement
            ),

          responsibleParty:
            requirement.responsibleParty ||
            requirement.subject ||
            'Unassigned',

          action:
            requirement.action,

          deliverables:
            requirement.deliverables,

          expectedEvidence:
            inferEvidenceType(
              requirement
            ),

          timing:
            requirement.timing,

          conditions:
            requirement.conditions,

          exceptions:
            requirement.exceptions,

          references:
            requirement.references,

          status:
            complianceStatusFromAssessment(
              requirement,
              assessment
            ),

          risk:
            complianceRiskLevel(
              requirement,
              assessment
            ),

          evidenceMatches:
            assessment?.evidenceMatches ||
            [],

          confidence:
            assessment?.confidence ??
            requirement.confidence,

          sourceNumber:
            requirement.sourceNumber,

          documentName:
            requirement.documentName,

          heading:
            requirement.heading,

          path:
            requirement.path,

          location:
            requirement.location
        };
      }
    );

  const supported =
    rows.filter(
      row =>
        row.status === 'supported' ||
        row.status === 'controlled'
    ).length;

  const missing =
    rows.filter(
      row =>
        row.status === 'missing-evidence' ||
        row.status === 'review-required'
    ).length;

  const highRisk =
    rows.filter(
      row =>
        row.risk === 'high'
    ).length;

  return {
    rows,

    summary: {
      totalRequirements:
        rows.length,

      supported,

      missingEvidence:
        missing,

      highRisk,

      compliancePercent:
        compliancePercent(
          supported,
          rows.length
        ),

      byType:
        rows.reduce(
          (summary, row) => {
            summary[row.type] =
              (summary[row.type] || 0) + 1;

            return summary;
          },
          {}
        ),

      byPhase:
        rows.reduce(
          (summary, row) => {
            summary[row.phase] =
              (summary[row.phase] || 0) + 1;

            return summary;
          },
          {}
        ),

      byStatus:
        rows.reduce(
          (summary, row) => {
            summary[row.status] =
              (summary[row.status] || 0) + 1;

            return summary;
          },
          {}
        )
    }
  };
}

function checklistItemFromMatrixRow(
  row,
  index,
  prefix = 'CHK'
) {
  return {
    id:
      `${prefix}-${index + 1}`,

    requirementId:
      row.id,

    label:
      complianceNormalize(
        row.action ||
        row.requirement
      ),

    fullRequirement:
      row.requirement,

    category:
      row.category,

    phase:
      row.phase,

    responsibleParty:
      row.responsibleParty,

    expectedEvidence:
      row.expectedEvidence,

    deliverables:
      row.deliverables,

    timing:
      row.timing,

    conditions:
      row.conditions,

    exceptions:
      row.exceptions,

    references:
      row.references,

    status:
      row.status,

    risk:
      row.risk,

    checked:
      row.status === 'supported' ||
      row.status === 'controlled',

    sourceNumber:
      row.sourceNumber,

    documentName:
      row.documentName,

    heading:
      row.heading,

    location:
      row.location
  };
}

function groupChecklistItems(items) {
  const groups = new Map();

  for (const item of items) {
    const category =
      item.category ||
      'General';

    if (!groups.has(category)) {
      groups.set(category, {
        category,
        items: [],
        complete: 0,
        incomplete: 0
      });
    }

    const group =
      groups.get(category);

    group.items.push(item);

    if (item.checked) {
      group.complete += 1;
    } else {
      group.incomplete += 1;
    }
  }

  return [
    ...groups.values()
  ].map(group => ({
    ...group,

    completionPercent:
      compliancePercent(
        group.complete,
        group.items.length
      )
  }));
}

export function buildInspectionChecklist(
  hits,
  evidenceSections = hits,
  options = {}
) {
  const matrix =
    buildComplianceMatrix(
      hits,
      evidenceSections,
      options
    );

  const inspectionRows =
    matrix.rows.filter(row =>
      [
        'inspection',
        'installation',
        'testing',
        'acceptance',
        'general'
      ].includes(row.phase) ||
      [
        'Inspection',
        'Testing and Commissioning',
        'Acceptance',
        'Documentation',
        'Deficiencies'
      ].includes(row.category)
    );

  const items =
    inspectionRows.map(
      (row, index) =>
        checklistItemFromMatrixRow(
          row,
          index,
          'INS'
        )
    );

  return {
    title:
      'Inspection Compliance Checklist',

    items,

    groups:
      groupChecklistItems(items),

    summary: {
      total:
        items.length,

      complete:
        items.filter(
          item =>
            item.checked
        ).length,

      incomplete:
        items.filter(
          item =>
            !item.checked
        ).length,

      highRisk:
        items.filter(
          item =>
            item.risk === 'high'
        ).length,

      completionPercent:
        compliancePercent(
          items.filter(
            item =>
              item.checked
          ).length,
          items.length
        )
    }
  };
}

function commissioningRelevant(row) {
  const value =
    complianceKey([
      row.requirement,
      row.action,
      row.phase,
      row.category,
      ...(row.deliverables || []),
      ...(row.references || [])
    ].join(' '));

  return (
    row.phase === 'testing' ||
    row.category ===
      'Testing and Commissioning' ||
    /\b(commission|commissioning|startup|start up|functional performance|test|testing|demonstration|training|balance|balancing|sequence of operation|controls verification)\b/.test(
      value
    )
  );
}

export function buildCommissioningChecklist(
  hits,
  evidenceSections = hits,
  options = {}
) {
  const matrix =
    buildComplianceMatrix(
      hits,
      evidenceSections,
      options
    );

  const rows =
    matrix.rows.filter(
      commissioningRelevant
    );

  const items =
    rows.map(
      (row, index) =>
        checklistItemFromMatrixRow(
          row,
          index,
          'CXM'
        )
    );

  return {
    title:
      'Commissioning and Testing Checklist',

    items,

    groups:
      groupChecklistItems(items),

    summary: {
      total:
        items.length,

      complete:
        items.filter(
          item =>
            item.checked
        ).length,

      incomplete:
        items.filter(
          item =>
            !item.checked
        ).length,

      highRisk:
        items.filter(
          item =>
            item.risk === 'high'
        ).length,

      completionPercent:
        compliancePercent(
          items.filter(
            item =>
              item.checked
          ).length,
          items.length
        )
    }
  };
}

function closeoutRelevant(row) {
  const value =
    complianceKey([
      row.requirement,
      row.action,
      row.phase,
      row.category,
      ...(row.deliverables || [])
    ].join(' '));

  return (
    row.phase === 'closeout' ||
    row.category === 'Closeout' ||
    /\b(closeout|turnover|warranty|record drawing|as built|as-built|o&m|operation manual|maintenance manual|training|final completion|final acceptance|punch list|certificate of completion)\b/.test(
      value
    )
  );
}

export function buildCloseoutChecklist(
  hits,
  evidenceSections = hits,
  options = {}
) {
  const matrix =
    buildComplianceMatrix(
      hits,
      evidenceSections,
      options
    );

  const rows =
    matrix.rows.filter(
      closeoutRelevant
    );

  const items =
    rows.map(
      (row, index) =>
        checklistItemFromMatrixRow(
          row,
          index,
          'CLO'
        )
    );

  return {
    title:
      'Closeout and Turnover Checklist',

    items,

    groups:
      groupChecklistItems(items),

    summary: {
      total:
        items.length,

      complete:
        items.filter(
          item =>
            item.checked
        ).length,

      incomplete:
        items.filter(
          item =>
            !item.checked
        ).length,

      highRisk:
        items.filter(
          item =>
            item.risk === 'high'
        ).length,

      completionPercent:
        compliancePercent(
          items.filter(
            item =>
              item.checked
          ).length,
          items.length
        )
    }
  };
}

function ownerQCRelevant(requirement) {
  const value =
    complianceKey([
      requirement.statement,
      requirement.action,
      requirement.responsibleParty,
      requirement.subject,
      requirement.heading,
      ...(requirement.path || [])
    ].join(' '));

  return (
    /\b(owner qc|owner quality|government qc|government quality|va qc|quality assurance|owner representative|resident engineer|cor|contracting officer representative)\b/.test(
      value
    ) ||
    (
      /\b(owner|government|va|cor)\b/.test(
        value
      ) &&
      /\b(verify|inspect|witness|review|accept|approve|document|observe)\b/.test(
        value
      )
    )
  );
}

function ownerQCActionType(requirement) {
  const value =
    complianceKey([
      requirement.statement,
      requirement.action
    ].join(' '));

  if (
    /\bverify|verification\b/.test(value)
  ) {
    return 'Verify';
  }

  if (
    /\bwitness|observe\b/.test(value)
  ) {
    return 'Witness';
  }

  if (
    /\binspect|inspection\b/.test(value)
  ) {
    return 'Inspect';
  }

  if (
    /\breview\b/.test(value)
  ) {
    return 'Review';
  }

  if (
    /\baccept|acceptance\b/.test(value)
  ) {
    return 'Accept';
  }

  if (
    /\bapprove|approval\b/.test(value)
  ) {
    return 'Approve';
  }

  if (
    /\bdocument|record|report\b/.test(value)
  ) {
    return 'Document';
  }

  if (
    /\bcoordinate|meeting\b/.test(value)
  ) {
    return 'Coordinate';
  }

  return 'Monitor';
}

export function buildOwnerQCMatrix(
  hits,
  evidenceSections = hits,
  options = {}
) {
  const requirementResult =
    extractRequirements(hits);

  const evidenceResult =
    detectMissingEvidence(
      hits,
      evidenceSections,
      options
    );

  const assessmentById = new Map(
    evidenceResult.assessments.map(
      assessment => [
        assessment.requirementId,
        assessment
      ]
    )
  );

  const requirements =
    requirementResult.requirements.filter(
      ownerQCRelevant
    );

  const rows =
    requirements.map(
      requirement => {
        const assessment =
          assessmentById.get(
            requirement.id
          );

        return {
          requirementId:
            requirement.id,

          ownerQCAction:
            ownerQCActionType(
              requirement
            ),

          requirement:
            requirement.statement,

          responsibleParty:
            requirement.responsibleParty ||
            requirement.subject ||
            'Owner QC',

          phase:
            inferRequirementPhase(
              requirement
            ),

          expectedEvidence:
            inferEvidenceType(
              requirement
            ),

          deliverables:
            requirement.deliverables,

          timing:
            requirement.timing,

          references:
            requirement.references,

          status:
            complianceStatusFromAssessment(
              requirement,
              assessment
            ),

          risk:
            complianceRiskLevel(
              requirement,
              assessment
            ),

          sourceNumber:
            requirement.sourceNumber,

          documentName:
            requirement.documentName,

          heading:
            requirement.heading,

          location:
            requirement.location
        };
      }
    );

  return {
    rows,

    workflow:
      complianceUnique(
        rows.map(
          row =>
            row.ownerQCAction
        )
      ),

    summary: {
      total:
        rows.length,

      supported:
        rows.filter(
          row =>
            row.status === 'supported' ||
            row.status === 'controlled'
        ).length,

      missingEvidence:
        rows.filter(
          row =>
            row.status === 'missing-evidence' ||
            row.status === 'review-required'
        ).length,

      highRisk:
        rows.filter(
          row =>
            row.risk === 'high'
        ).length,

      byAction:
        rows.reduce(
          (summary, row) => {
            summary[row.ownerQCAction] =
              (
                summary[
                  row.ownerQCAction
                ] ||
                0
              ) + 1;

            return summary;
          },
          {}
        )
    }
  };
}

function graphAddNode(
  nodeMap,
  node
) {
  if (
    !node ||
    !node.id
  ) {
    return;
  }

  if (!nodeMap.has(node.id)) {
    nodeMap.set(
      node.id,
      node
    );
  }
}

function graphAddEdge(
  edgeMap,
  edge
) {
  if (
    !edge ||
    !edge.from ||
    !edge.to
  ) {
    return;
  }

  const id =
    edge.id ||
    `${edge.from}->${edge.to}:${edge.type || 'related'}`;

  if (!edgeMap.has(id)) {
    edgeMap.set(id, {
      ...edge,
      id
    });
  }
}

function phaseNodeId(phase) {
  return `PHASE-${complianceKey(phase)
    .replace(/\s+/g, '-')}`;
}

function categoryNodeId(category) {
  return `CATEGORY-${complianceKey(category)
    .replace(/\s+/g, '-')}`;
}

export function buildKnowledgeGraph(
  hits,
  evidenceSections = hits,
  options = {}
) {
  const requirementGraph =
    buildRequirementGraph(hits);

  const crossReferenceGraph =
    extractCrossReferenceGraph(hits);

  const complianceMatrix =
    buildComplianceMatrix(
      hits,
      evidenceSections,
      options
    );

  const nodes = new Map();
  const edges = new Map();

  for (const node of requirementGraph.nodes) {
    graphAddNode(nodes, node);
  }

  for (const edge of requirementGraph.edges) {
    graphAddEdge(edges, edge);
  }

  for (const node of crossReferenceGraph.nodes) {
    graphAddNode(nodes, node);
  }

  for (const edge of crossReferenceGraph.edges) {
    graphAddEdge(edges, edge);
  }

  for (const row of complianceMatrix.rows) {
    const phaseId =
      phaseNodeId(row.phase);

    graphAddNode(nodes, {
      id:
        phaseId,

      type:
        'phase',

      label:
        row.phase
    });

    graphAddEdge(edges, {
      from:
        phaseId,

      to:
        row.id,

      type:
        'contains-requirement'
    });

    const categoryId =
      categoryNodeId(
        row.category
      );

    graphAddNode(nodes, {
      id:
        categoryId,

      type:
        'category',

      label:
        row.category
    });

    graphAddEdge(edges, {
      from:
        categoryId,

      to:
        row.id,

      type:
        'classifies'
    });

    for (
      const evidenceMatch of
      row.evidenceMatches || []
    ) {
      const evidenceId =
        `EVIDENCE-${complianceKey([
          evidenceMatch.documentId,
          evidenceMatch.documentName,
          evidenceMatch.heading,
          evidenceMatch.location
        ].join(' '))
          .replace(/\s+/g, '-')
          .slice(0, 100)}`;

      graphAddNode(nodes, {
        id:
          evidenceId,

        type:
          'evidence',

        label:
          evidenceMatch.heading ||
          evidenceMatch.documentName ||
          'Evidence',

        score:
          evidenceMatch.score,

        documentName:
          evidenceMatch.documentName,

        heading:
          evidenceMatch.heading,

        location:
          evidenceMatch.location
      });

      graphAddEdge(edges, {
        from:
          evidenceId,

        to:
          row.id,

        type:
          'supports'
      });
    }
  }

  return {
    nodes:
      [...nodes.values()],

    edges:
      [...edges.values()],

    compliance:
      complianceMatrix.summary,

    summary: {
      totalNodes:
        nodes.size,

      totalEdges:
        edges.size,

      requirements:
        [...nodes.values()].filter(
          node =>
            node.type === 'requirement'
        ).length,

      parties:
        [...nodes.values()].filter(
          node =>
            node.type === 'party'
        ).length,

      deliverables:
        [...nodes.values()].filter(
          node =>
            node.type === 'deliverable'
        ).length,

      references:
        [...nodes.values()].filter(
          node =>
            node.type === 'reference'
        ).length,

      evidence:
        [...nodes.values()].filter(
          node =>
            node.type === 'evidence'
        ).length,

      phases:
        [...nodes.values()].filter(
          node =>
            node.type === 'phase'
        ).length,

      categories:
        [...nodes.values()].filter(
          node =>
            node.type === 'category'
        ).length
    }
  };
}

export function summarizeRequirements(
  hits,
  evidenceSections = hits,
  options = {}
) {
  const requirements =
    extractRequirements(hits);

  const responsibilities =
    extractResponsibilities(hits);

  const deliverables =
    extractDeliverables(hits);

  const acceptance =
    extractAcceptanceCriteria(hits);

  const exceptions =
    extractExceptions(hits);

  const crossReferences =
    extractCrossReferenceGraph(hits);

  const compliance =
    buildComplianceMatrix(
      hits,
      evidenceSections,
      options
    );

  const ownerQC =
    buildOwnerQCMatrix(
      hits,
      evidenceSections,
      options
    );

  const mandatory =
    requirements.requirements.filter(
      requirement =>
        requirement.type === 'mandatory'
    );

  const prohibited =
    requirements.requirements.filter(
      requirement =>
        requirement.type === 'prohibited'
    );

  const highRisk =
    compliance.rows.filter(
      row =>
        row.risk === 'high'
    );

  const missingEvidence =
    compliance.rows.filter(
      row =>
        row.status === 'missing-evidence' ||
        row.status === 'review-required'
    );

  return {
    overview: {
      totalRequirements:
        requirements.summary.total,

      mandatory:
        requirements.summary.mandatory,

      prohibited:
        requirements.summary.prohibited,

      permitted:
        requirements.summary.permitted,

      advisory:
        requirements.summary.advisory,

      responsibleParties:
        responsibilities.summary.parties,

      deliverables:
        deliverables.summary.uniqueDeliverables,

      acceptanceCriteria:
        acceptance.summary.total,

      exceptions:
        exceptions.summary.total,

      crossReferences:
        crossReferences.summary.referenceNodes,

      compliancePercent:
        compliance.summary.compliancePercent,

      missingEvidence:
        compliance.summary.missingEvidence,

      highRisk:
        compliance.summary.highRisk,

      ownerQCRequirements:
        ownerQC.summary.total
    },

    keyMandatoryRequirements:
      mandatory
        .sort(
          (first, second) =>
            second.confidence -
            first.confidence
        )
        .slice(0, 20),

    keyProhibitions:
      prohibited
        .sort(
          (first, second) =>
            second.confidence -
            first.confidence
        )
        .slice(0, 20),

    highRiskRequirements:
      highRisk.slice(0, 20),

    evidenceGaps:
      missingEvidence.slice(0, 20),

    primaryResponsibilities:
      responsibilities.responsibilities.slice(
        0,
        15
      ),

    requiredDeliverables:
      deliverables.deliverables.slice(
        0,
        20
      ),

    ownerQC:
      ownerQC,

    compliance:
      compliance
  };
}
const normalizeKnowledgeValue = normalizedText;
const normalizeKnowledgeKey = normalizedKey;

function requirementType(sentence) {
  const value = String(sentence || '');

  if (
    /\b(shall not|must not|may not|is prohibited|are prohibited|not permitted)\b/i.test(
      value
    )
  ) {
    return 'prohibited';
  }

  if (
    /\b(shall|must|required|required to|is responsible for|will provide|will perform)\b/i.test(
      value
    )
  ) {
    return 'mandatory';
  }

  if (/\bmay\b/i.test(value)) {
    return 'permitted';
  }

  if (/\bshould\b/i.test(value)) {
    return 'advisory';
  }

  return 'informational';
}

function requirementStrength(type) {
  const strengths = {
    prohibited: 100,
    mandatory: 95,
    permitted: 60,
    advisory: 45,
    informational: 25
  };

  return strengths[type] || 25;
}

function extractRequirementAction(sentence) {
  const value = normalizeKnowledgeValue(sentence);

  const match = value.match(
    /\b(?:shall not|must not|may not|shall|must|required to|required|may|should|will)\b\s+(.+)/i
  );

  if (!match) {
    return value;
  }

  return normalizeKnowledgeValue(match[1])
    .replace(/[.;:]+$/, '')
    .trim();
}

function extractRequirementSubject(sentence, responsibleParty) {
  if (responsibleParty) {
    return responsibleParty;
  }

  const value = normalizeKnowledgeValue(sentence);

  const modalMatch = value.match(
    /^(.{2,100}?)\s+\b(?:shall not|must not|may not|shall|must|required to|may|should|will)\b/i
  );

  if (modalMatch) {
    return normalizeKnowledgeValue(modalMatch[1])
      .replace(/^(the|a|an)\s+/i, '')
      .trim();
  }

  return null;
}

function extractTiming(sentence) {
  const value = String(sentence || '');

  const patterns = [
    /\bprior to\b[^.;]*/i,
    /\bbefore\b[^.;]*/i,
    /\bafter\b[^.;]*/i,
    /\bwithin\s+\d+\s+(?:calendar\s+|business\s+|working\s+)?(?:day|days|hour|hours|week|weeks|month|months)\b[^.;]*/i,
    /\bnot later than\b[^.;]*/i,
    /\bno later than\b[^.;]*/i,
    /\bupon completion\b[^.;]*/i,
    /\buntil\b[^.;]*/i,
    /\bduring\b[^.;]*/i,
    /\bwhen\b[^.;]*/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match) {
      return normalizeKnowledgeValue(match[0]);
    }
  }

  return null;
}

function extractConditions(sentence) {
  const value = String(sentence || '');

  const matches = [
    ...value.matchAll(
      /\b(?:if|when|where|provided that|subject to|unless|except when|after|before|upon)\b[^.;]*/gi
    )
  ];

  return uniq(
    matches.map(match =>
      normalizeKnowledgeValue(match[0])
    )
  ).slice(0, 6);
}

function extractExceptionsFromSentence(sentence) {
  const value = String(sentence || '');

  const matches = [
    ...value.matchAll(
      /\b(?:unless|except(?: when)?|provided that|however|subject to|notwithstanding)\b[^.;]*/gi
    )
  ];

  return uniq(
    matches.map(match =>
      normalizeKnowledgeValue(match[0])
    )
  ).slice(0, 6);
}

function inferDeliverableType(deliverable) {
  const value = String(deliverable || '').toLowerCase();

  if (/\b(submittal|shop drawing|product data|sample|mockup)\b/.test(value)) {
    return 'submittal';
  }

  if (/\b(report|inspection report|test report|commissioning report)\b/.test(value)) {
    return 'report';
  }

  if (/\b(certificate|certification)\b/.test(value)) {
    return 'certificate';
  }

  if (/\b(schedule)\b/.test(value)) {
    return 'schedule';
  }

  if (/\b(photo|photograph)\b/.test(value)) {
    return 'photograph';
  }

  if (/\b(record drawing|as-built)\b/.test(value)) {
    return 'record-document';
  }

  if (/\b(operation manual|maintenance manual|manual)\b/.test(value)) {
    return 'manual';
  }

  if (/\b(warranty)\b/.test(value)) {
    return 'warranty';
  }

  if (/\b(training)\b/.test(value)) {
    return 'training';
  }

  if (/\b(punch list|closeout)\b/.test(value)) {
    return 'closeout';
  }

  return 'deliverable';
}

function requirementIdentifier(node, index) {
  const documentPart =
    normalizeKnowledgeKey(
      node.documentId ||
      node.documentName ||
      'document'
    )
      .replace(/\s+/g, '-')
      .slice(0, 40) || 'document';

  const headingPart =
    normalizeKnowledgeKey(node.heading || 'section')
      .replace(/\s+/g, '-')
      .slice(0, 40) || 'section';

  return `REQ-${documentPart}-${headingPart}-${index + 1}`;
}

function evidenceTermsForRequirement(requirement) {
  return uniq([
    ...(requirement.deliverables || []),
    ...(requirement.references || []),
    requirement.action,
    requirement.subject,
    requirement.responsibleParty
  ])
    .filter(Boolean)
    .flatMap(value =>
      normalizeKnowledgeKey(value)
        .split(/\s+/)
        .filter(term =>
          term.length >= 4
        )
    );
}

function buildRequirementRecord(node, index) {
  const type = requirementType(node.sentence);
  const responsibleParty =
    node.responsibleParty ||
    detectResponsibleParty(node.sentence);

  const deliverables =
    node.deliverables?.length
      ? node.deliverables
      : detectDeliverables(node.sentence);

  const exceptions =
    extractExceptionsFromSentence(node.sentence);

  const conditions =
    extractConditions(node.sentence);

  const record = {
    id: requirementIdentifier(node, index),

    statement:
      normalizeKnowledgeValue(node.sentence),

    type,

    strength:
      requirementStrength(type),

    subject:
      extractRequirementSubject(
        node.sentence,
        responsibleParty
      ),

    responsibleParty,

    action:
      extractRequirementAction(node.sentence),

    deliverables,

    timing:
      extractTiming(node.sentence),

    conditions,

    exceptions,

    references:
      node.references ||
      extractReferences(node.sentence),

    confidence:
      clamp(
        Math.round(
          Number(node.confidence || 0) +
          requirementStrength(type) * 0.15 +
          (responsibleParty ? 5 : 0) +
          (deliverables.length ? 5 : 0)
        ),
        0,
        100
      ),

    sourceNumber:
      node.sourceNumber,

    documentId:
      node.documentId,

    documentName:
      node.documentName,

    heading:
      node.heading,

    path:
      node.path || [],

    level:
      node.level,

    location:
      node.location
  };

  record.evidenceTerms =
    evidenceTermsForRequirement(record);

  return record;
}

function deduplicateRequirements(requirements) {
  const selected = [];

  for (const requirement of requirements) {
    const duplicate = selected.find(existing => {
      const sameDocument =
        existing.documentId === requirement.documentId;

      const sameHeading =
        normalizeKnowledgeKey(existing.heading) ===
        normalizeKnowledgeKey(requirement.heading);

      const similarity = textSimilarity(
        existing.statement,
        requirement.statement
      );

      return (
        similarity >= 0.88 ||
        (
          sameDocument &&
          sameHeading &&
          similarity >= 0.72
        )
      );
    });

    if (!duplicate) {
      selected.push(requirement);
      continue;
    }

    if (
      requirement.confidence >
      duplicate.confidence
    ) {
      Object.assign(
        duplicate,
        requirement
      );
    }
  }

  return selected;
}

export function extractRequirements(hits) {
  const safeHits = Array.isArray(hits)
    ? hits
    : [];

  const nodes =
    buildKnowledgeNodes(safeHits);

  const requirementNodes =
    filterRequirementNodes(nodes);

  const requirements =
    deduplicateRequirements(
      requirementNodes.map(
        buildRequirementRecord
      )
    );

  const summary = {
    total:
      requirements.length,

    mandatory:
      requirements.filter(
        requirement =>
          requirement.type === 'mandatory'
      ).length,

    prohibited:
      requirements.filter(
        requirement =>
          requirement.type === 'prohibited'
      ).length,

    permitted:
      requirements.filter(
        requirement =>
          requirement.type === 'permitted'
      ).length,

    advisory:
      requirements.filter(
        requirement =>
          requirement.type === 'advisory'
      ).length,

    informational:
      requirements.filter(
        requirement =>
          requirement.type === 'informational'
      ).length,

    withResponsibleParty:
      requirements.filter(
        requirement =>
          Boolean(requirement.responsibleParty)
      ).length,

    withDeliverables:
      requirements.filter(
        requirement =>
          requirement.deliverables.length > 0
      ).length,

    withTiming:
      requirements.filter(
        requirement =>
          Boolean(requirement.timing)
      ).length,

    withExceptions:
      requirements.filter(
        requirement =>
          requirement.exceptions.length > 0
      ).length
  };

  return {
    requirements,
    summary,
    knowledgeSummary:
      summarizeKnowledge(nodes)
  };
}

export function extractResponsibilities(hits) {
  const result =
    extractRequirements(hits);

  const grouped = new Map();

  for (const requirement of result.requirements) {
    const party =
      requirement.responsibleParty ||
      requirement.subject;

    if (!party) {
      continue;
    }

    const key =
      normalizeKnowledgeKey(party);

    if (!grouped.has(key)) {
      grouped.set(key, {
        party,
        requirementCount: 0,
        requirements: [],
        documents: [],
        deliverables: []
      });
    }

    const group =
      grouped.get(key);

    group.requirementCount += 1;

    group.requirements.push(
      requirement
    );

    group.documents.push(
      requirement.documentName
    );

    group.deliverables.push(
      ...requirement.deliverables
    );
  }

  const responsibilities = [
    ...grouped.values()
  ]
    .map(group => ({
      ...group,
      documents:
        uniq(group.documents),

      deliverables:
        uniq(group.deliverables),

      mandatoryCount:
        group.requirements.filter(
          requirement =>
            requirement.type === 'mandatory'
        ).length,

      prohibitedCount:
        group.requirements.filter(
          requirement =>
            requirement.type === 'prohibited'
        ).length
    }))
    .sort((first, second) =>
      second.requirementCount -
      first.requirementCount
    );

  return {
    responsibilities,

    summary: {
      parties:
        responsibilities.length,

      assignedRequirements:
        responsibilities.reduce(
          (sum, group) =>
            sum + group.requirementCount,
          0
        ),

      unassignedRequirements:
        result.requirements.filter(
          requirement =>
            !requirement.responsibleParty &&
            !requirement.subject
        ).length
    }
  };
}

export function extractDeliverables(hits) {
  const result =
    extractRequirements(hits);

  const grouped = new Map();

  for (const requirement of result.requirements) {
    for (const deliverable of requirement.deliverables) {
      const key =
        normalizeKnowledgeKey(deliverable);

      if (!grouped.has(key)) {
        grouped.set(key, {
          name: deliverable,
          type:
            inferDeliverableType(deliverable),

          requirementCount: 0,
          requirements: [],
          responsibleParties: [],
          documents: [],
          references: []
        });
      }

      const group =
        grouped.get(key);

      group.requirementCount += 1;

      group.requirements.push(
        requirement
      );

      group.responsibleParties.push(
        requirement.responsibleParty ||
        requirement.subject
      );

      group.documents.push(
        requirement.documentName
      );

      group.references.push(
        ...requirement.references
      );
    }
  }

  const deliverables = [
    ...grouped.values()
  ]
    .map(group => ({
      ...group,

      responsibleParties:
        uniq(
          group.responsibleParties
        ),

      documents:
        uniq(group.documents),

      references:
        uniq(group.references)
    }))
    .sort((first, second) =>
      second.requirementCount -
      first.requirementCount
    );

  return {
    deliverables,

    summary: {
      uniqueDeliverables:
        deliverables.length,

      totalRequirementLinks:
        deliverables.reduce(
          (sum, item) =>
            sum + item.requirementCount,
          0
        ),

      byType:
        deliverables.reduce(
          (summary, item) => {
            summary[item.type] =
              (summary[item.type] || 0) + 1;

            return summary;
          },
          {}
        )
    }
  };
}

export function extractAcceptanceCriteria(hits) {
  const safeHits = Array.isArray(hits)
    ? hits
    : [];

  const nodes =
    buildKnowledgeNodes(safeHits);

  const acceptanceNodes =
    filterAcceptanceNodes(nodes);

  const criteria =
    acceptanceNodes.map(
      (node, index) => ({
        id: `ACC-${index + 1}`,

        statement:
          normalizeKnowledgeValue(
            node.sentence
          ),

        responsibleParty:
          node.responsibleParty ||
          detectResponsibleParty(
            node.sentence
          ),

        deliverables:
          node.deliverables?.length
            ? node.deliverables
            : detectDeliverables(
                node.sentence
              ),

        timing:
          extractTiming(node.sentence),

        conditions:
          extractConditions(
            node.sentence
          ),

        references:
          node.references ||
          extractReferences(
            node.sentence
          ),

        confidence:
          node.confidence,

        sourceNumber:
          node.sourceNumber,

        documentId:
          node.documentId,

        documentName:
          node.documentName,

        heading:
          node.heading,

        path:
          node.path || [],

        location:
          node.location
      })
    );

  return {
    criteria,

    summary: {
      total:
        criteria.length,

      withResponsibleParty:
        criteria.filter(
          criterion =>
            Boolean(
              criterion.responsibleParty
            )
        ).length,

      withDeliverables:
        criteria.filter(
          criterion =>
            criterion.deliverables.length > 0
        ).length,

      withTiming:
        criteria.filter(
          criterion =>
            Boolean(criterion.timing)
        ).length
    }
  };
}

export function extractExceptions(hits) {
  const safeHits = Array.isArray(hits)
    ? hits
    : [];

  const nodes =
    buildKnowledgeNodes(safeHits);

  const exceptionNodes =
    filterExceptionNodes(nodes);

  const exceptions =
    exceptionNodes.map(
      (node, index) => ({
        id: `EXC-${index + 1}`,

        statement:
          normalizeKnowledgeValue(
            node.sentence
          ),

        clauses:
          extractExceptionsFromSentence(
            node.sentence
          ),

        responsibleParty:
          node.responsibleParty ||
          detectResponsibleParty(
            node.sentence
          ),

        references:
          node.references ||
          extractReferences(
            node.sentence
          ),

        confidence:
          node.confidence,

        sourceNumber:
          node.sourceNumber,

        documentId:
          node.documentId,

        documentName:
          node.documentName,

        heading:
          node.heading,

        path:
          node.path || [],

        location:
          node.location
      })
    );

  return {
    exceptions,

    summary: {
      total:
        exceptions.length,

      withReferences:
        exceptions.filter(
          exception =>
            exception.references.length > 0
        ).length,

      withResponsibleParty:
        exceptions.filter(
          exception =>
            Boolean(
              exception.responsibleParty
            )
        ).length
    }
  };
}

function sourceReferenceNode(reference) {
  return {
    id:
      `REF-${normalizeKnowledgeKey(reference)
        .replace(/\s+/g, '-')}`,

    type:
      'reference',

    label:
      reference,

    reference
  };
}

export function extractCrossReferenceGraph(hits) {
  const safeHits = Array.isArray(hits)
    ? hits
    : [];

  const nodes = new Map();
  const edges = [];

  for (const hit of safeHits) {
    const sourceId =
      `SRC-${normalizeKnowledgeKey(
        hit.documentId ||
        hit.documentName ||
        hit.sourceNumber
      ).replace(/\s+/g, '-')}-${hit.sourceNumber}`;

    if (!nodes.has(sourceId)) {
      nodes.set(sourceId, {
        id:
          sourceId,

        type:
          'source',

        label:
          hit.heading ||
          hit.documentName ||
          `Source ${hit.sourceNumber}`,

        sourceNumber:
          hit.sourceNumber,

        documentId:
          hit.documentId,

        documentName:
          hit.documentName,

        heading:
          hit.heading,

        path:
          hit.path || [],

        location:
          hit.location
      });
    }

    const references = uniq([
      ...(hit.crossReferences || []),
      ...extractReferences(
        `${hit.heading || ''} ${hit.text || ''}`
      )
    ]);

    for (const reference of references) {
      const referenceNode =
        sourceReferenceNode(reference);

      if (!nodes.has(referenceNode.id)) {
        nodes.set(
          referenceNode.id,
          referenceNode
        );
      }

      edges.push({
        id:
          `${sourceId}->${referenceNode.id}`,

        from:
          sourceId,

        to:
          referenceNode.id,

        type:
          'references',

        sourceNumber:
          hit.sourceNumber
      });
    }
  }

  const uniqueEdges = [
    ...new Map(
      edges.map(edge => [
        edge.id,
        edge
      ])
    ).values()
  ];

  return {
    nodes:
      [...nodes.values()],

    edges:
      uniqueEdges,

    summary: {
      sourceNodes:
        [...nodes.values()].filter(
          node =>
            node.type === 'source'
        ).length,

      referenceNodes:
        [...nodes.values()].filter(
          node =>
            node.type === 'reference'
        ).length,

      edges:
        uniqueEdges.length
    }
  };
}

function graphNodeId(prefix, value) {
  return `${prefix}-${normalizeKnowledgeKey(value)
    .replace(/\s+/g, '-')
    .slice(0, 80)}`;
}

export function buildRequirementGraph(hits) {
  const result =
    extractRequirements(hits);

  const nodes = new Map();
  const edges = [];

  for (const requirement of result.requirements) {
    nodes.set(requirement.id, {
      id:
        requirement.id,

      type:
        'requirement',

      label:
        requirement.statement,

      requirementType:
        requirement.type,

      confidence:
        requirement.confidence,

      sourceNumber:
        requirement.sourceNumber
    });

    const party =
      requirement.responsibleParty ||
      requirement.subject;

    if (party) {
      const partyId =
        graphNodeId('PARTY', party);

      if (!nodes.has(partyId)) {
        nodes.set(partyId, {
          id:
            partyId,

          type:
            'party',

          label:
            party
        });
      }

      edges.push({
        id:
          `${partyId}->${requirement.id}`,

        from:
          partyId,

        to:
          requirement.id,

        type:
          'responsible-for'
      });
    }

    for (const deliverable of requirement.deliverables) {
      const deliverableId =
        graphNodeId(
          'DELIVERABLE',
          deliverable
        );

      if (!nodes.has(deliverableId)) {
        nodes.set(deliverableId, {
          id:
            deliverableId,

          type:
            'deliverable',

          label:
            deliverable,

          deliverableType:
            inferDeliverableType(
              deliverable
            )
        });
      }

      edges.push({
        id:
          `${requirement.id}->${deliverableId}`,

        from:
          requirement.id,

        to:
          deliverableId,

        type:
          'requires'
      });
    }

    for (const reference of requirement.references) {
      const referenceId =
        graphNodeId(
          'REFERENCE',
          reference
        );

      if (!nodes.has(referenceId)) {
        nodes.set(referenceId, {
          id:
            referenceId,

          type:
            'reference',

          label:
            reference
        });
      }

      edges.push({
        id:
          `${requirement.id}->${referenceId}`,

        from:
          requirement.id,

        to:
          referenceId,

        type:
          'references'
      });
    }

    for (const exception of requirement.exceptions) {
      const exceptionId =
        graphNodeId(
          'EXCEPTION',
          `${requirement.id}-${exception}`
        );

      if (!nodes.has(exceptionId)) {
        nodes.set(exceptionId, {
          id:
            exceptionId,

          type:
            'exception',

          label:
            exception
        });
      }

      edges.push({
        id:
          `${exceptionId}->${requirement.id}`,

        from:
          exceptionId,

        to:
          requirement.id,

        type:
          'qualifies'
      });
    }
  }

  const uniqueEdges = [
    ...new Map(
      edges.map(edge => [
        edge.id,
        edge
      ])
    ).values()
  ];

  return {
    nodes:
      [...nodes.values()],

    edges:
      uniqueEdges,

    requirements:
      result.requirements,

    summary: {
      ...result.summary,

      graphNodes:
        nodes.size,

      graphEdges:
        uniqueEdges.length,

      partyNodes:
        [...nodes.values()].filter(
          node =>
            node.type === 'party'
        ).length,

      deliverableNodes:
        [...nodes.values()].filter(
          node =>
            node.type === 'deliverable'
        ).length,

      referenceNodes:
        [...nodes.values()].filter(
          node =>
            node.type === 'reference'
        ).length,

      exceptionNodes:
        [...nodes.values()].filter(
          node =>
            node.type === 'exception'
        ).length
    }
  };
}

function buildEvidenceIndex(evidenceSections) {
  const safeSections =
    Array.isArray(evidenceSections)
      ? evidenceSections
      : [];

  return safeSections.map(
    (section, index) => {
      const combined =
        normalizeKnowledgeValue(
          [
            section.documentName,
            section.heading,
            ...(section.path || []),
            section.location,
            section.text
          ].join(' ')
        );

      return {
        id:
          section.id ||
          `EVIDENCE-${index + 1}`,

        sourceNumber:
          section.sourceNumber,

        documentId:
          section.documentId,

        documentName:
          section.documentName,

        heading:
          section.heading,

        location:
          section.location,

        text:
          section.text,

        combined,

        normalized:
          normalizeKnowledgeKey(
            combined
          )
      };
    }
  );
}

function evidenceMatchScore(requirement, evidence) {
  const terms =
    requirement.evidenceTerms || [];

  if (!terms.length) {
    return 0;
  }

  const matched =
    terms.filter(term =>
      evidence.normalized.includes(term)
    );

  const coverage =
    matched.length /
    Math.max(1, terms.length);

  const statementSimilarity =
    textSimilarity(
      requirement.statement,
      evidence.combined
    );

  const referenceMatch =
    requirement.references.some(
      reference =>
        evidence.normalized.includes(
          normalizeKnowledgeKey(reference)
        )
    )
      ? 0.25
      : 0;

  const deliverableMatch =
    requirement.deliverables.some(
      deliverable =>
        evidence.normalized.includes(
          normalizeKnowledgeKey(deliverable)
        )
    )
      ? 0.25
      : 0;

  return clamp(
    coverage * 0.45 +
    statementSimilarity * 0.25 +
    referenceMatch +
    deliverableMatch,
    0,
    1
  );
}

export function detectMissingEvidence(
  hits,
  evidenceSections = hits,
  options = {}
) {
  const {
    minimumScore = 0.42,
    maximumMatches = 5
  } = options || {};

  const result =
    extractRequirements(hits);

  const evidenceIndex =
    buildEvidenceIndex(
      evidenceSections
    );

  const assessments =
    result.requirements.map(
      requirement => {
        const matches =
          evidenceIndex
            .map(evidence => ({
              evidence,
              score:
                evidenceMatchScore(
                  requirement,
                  evidence
                )
            }))
            .filter(match =>
              match.score > 0
            )
            .sort((first, second) =>
              second.score -
              first.score
            )
            .slice(
              0,
              maximumMatches
            );

        const bestMatch =
          matches[0] || null;

        const supported =
          Boolean(bestMatch) &&
          bestMatch.score >=
            minimumScore;

        return {
          requirementId:
            requirement.id,

          requirement,

          supported,

          status:
            supported
              ? 'supported'
              : 'missing-evidence',

          confidence:
            supported
              ? clamp(
                  Math.round(
                    bestMatch.score * 100
                  ),
                  0,
                  100
                )
              : clamp(
                  Math.round(
                    (
                      1 -
                      (bestMatch?.score || 0)
                    ) *
                    requirement.confidence
                  ),
                  0,
                  100
                ),

          evidenceMatches:
            matches.map(match => ({
              score:
                Math.round(
                  match.score * 100
                ),

              sourceNumber:
                match.evidence
                  .sourceNumber,

              documentId:
                match.evidence
                  .documentId,

              documentName:
                match.evidence
                  .documentName,

              heading:
                match.evidence
                  .heading,

              location:
                match.evidence
                  .location
            })),

          evidenceGap:
            supported
              ? null
              : {
                  required:
                    requirement.statement,

                  responsibleParty:
                    requirement.responsibleParty ||
                    requirement.subject,

                  expectedDeliverables:
                    requirement.deliverables,

                  expectedReferences:
                    requirement.references,

                  reason:
                    bestMatch
                      ? 'Potential evidence was found, but it did not meet the required confidence threshold.'
                      : 'No matching evidence was found.'
                }
        };
      }
    );

  const missing =
    assessments.filter(
      assessment =>
        !assessment.supported
    );

  const supported =
    assessments.filter(
      assessment =>
        assessment.supported
    );

  return {
    assessments,
    missing,
    supported,

    summary: {
      totalRequirements:
        assessments.length,

      supported:
        supported.length,

      missingEvidence:
        missing.length,

      compliancePercent:
        assessments.length
          ? Math.round(
              supported.length /
              assessments.length *
              100
            )
          : 100,

      minimumScore:
        Math.round(
          minimumScore * 100
        )
    }
  };
}
export function detectConflicts(hits) {
  const conflicts = [];

  for (
    let firstIndex = 0;
    firstIndex < hits.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < hits.length;
      secondIndex += 1
    ) {
      const first = hits[firstIndex];
      const second = hits[secondIndex];

      if (
        first.documentId === second.documentId
      ) {
        continue;
      }

      const firstCombined = `
        ${first.heading || ''}
        ${first.text || ''}
      `;

      const secondCombined = `
        ${second.heading || ''}
        ${second.text || ''}
      `;

      const firstPolarity =
        requirementPolarity(firstCombined);

      const secondPolarity =
        requirementPolarity(secondCombined);

      if (
        firstPolarity === 'neutral' ||
        secondPolarity === 'neutral'
      ) {
        continue;
      }

      const sharedTerms = sharedRequirementTerms(
        firstCombined,
        secondCombined
      );

      const similarity = textSimilarity(
        firstCombined,
        secondCombined
      );

      const opposingPolarity =
        firstPolarity !== secondPolarity;

      const exceptionDifference =
        EXCEPTION.test(firstCombined) !==
        EXCEPTION.test(secondCombined);

      const enoughSharedContext =
        sharedTerms.length >= 3 ||
        similarity >= 0.2;

      if (
        enoughSharedContext &&
        (
          opposingPolarity ||
          exceptionDifference
        )
      ) {
        const confidence = clamp(
          Math.round(
            45 +
            similarity * 100 +
            Math.min(
              20,
              sharedTerms.length * 3
            )
          ),
          50,
          95
        );

        conflicts.push({
          sourceA: first.sourceNumber,
          sourceB: second.sourceNumber,

          documents: [
            first.documentName,
            second.documentName
          ],

          reason: opposingPolarity
            ? 'Potentially opposing requirement language'
            : 'One source appears to contain an exception or qualification absent from the other',

          confidence,

          sharedTerms: sharedTerms.slice(0, 10)
        });
      }
    }
  }

  return conflicts
    .sort((a, b) =>
      b.confidence - a.confidence
    )
    .slice(0, 6);
}

function buildHierarchyNeighbors(
  selectedHits,
  hierarchyIndex
) {
  const selectedIds = new Set(
    selectedHits.map(hit => hit.id)
  );

  const neighbors = [];

  for (const hit of selectedHits) {
    const sameDocument = hierarchyIndex.byDocument.get(hit.documentId) || [];

    const index = hierarchyIndex.documentPosition.get(hit.id) ?? -1;

    if (index === -1) {
      continue;
    }

    const candidates = [
      sameDocument[index - 1],
      sameDocument[index + 1]
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (
        selectedIds.has(candidate.id)
      ) {
        continue;
      }

      const hitPath = (
        hit.path ||
        []
      ).join(' > ');

      const candidatePath = (
        candidate.path ||
        []
      ).join(' > ');

      const sameHierarchy =
        hitPath &&
        candidatePath &&
        (
          hitPath.startsWith(candidatePath) ||
          candidatePath.startsWith(hitPath) ||
          hitPath
            .split(' > ')
            .slice(0, -1)
            .join(' > ') ===
          candidatePath
            .split(' > ')
            .slice(0, -1)
            .join(' > ')
        );

      if (sameHierarchy) {
        neighbors.push({
          ...candidate,
          hierarchyNeighborOf: hit.id
        });
      }
    }
  }

  return neighbors;
}

const hierarchyIndexCache = new WeakMap();

export function invalidateRetrievalCaches(sections = []) {
  if (!Array.isArray(sections)) return;
  hierarchyIndexCache.delete(sections);
  corpusStatsCache.delete(sections);
  for (const section of sections) sectionAnalysisCache.delete(section);
}

function hierarchySearchIndex(sections) {
  if (hierarchyIndexCache.has(sections)) return hierarchyIndexCache.get(sections);

  const byTerm = new Map();
  const byId = new Map();
  const children = new Map();
  const bySectionNumber = new Map();
  const byDocument = new Map();
  const documentPosition = new Map();

  for (const section of sections) {
    byId.set(section.id, section);
    if (!byDocument.has(section.documentId)) byDocument.set(section.documentId, []);
    byDocument.get(section.documentId).push(section);
    if (section.parentId) {
      if (!children.has(section.parentId)) children.set(section.parentId, []);
      children.get(section.parentId).push(section);
    }
    const number = sectionNumberKey(section.sectionNumber || section.metadata?.sectionNumber);
    if (number) bySectionNumber.set(number, section);
    const hierarchyText = [
      section.heading,
      ...(Array.isArray(section.path) ? section.path : []),
      section.division,
      section.sectionNumber,
      section.sectionTitle,
      section.metadata?.trade,
      section.metadata?.discipline,
      ...(Array.isArray(section.metadata?.keywords) ? section.metadata.keywords : []),
      ...(Array.isArray(section.metadata?.buildingSystems) ? section.metadata.buildingSystems : [])
    ].filter(value => value != null).join(' ');
    for (const term of new Set(tokens(hierarchyText).map(stem))) {
      if (!byTerm.has(term)) byTerm.set(term, new Set());
      byTerm.get(term).add(section);
    }
  }

  for (const documentSections of byDocument.values()) {
    documentSections.sort((first, second) => first.order - second.order);
    documentSections.forEach((section, index) => documentPosition.set(section.id, index));
  }

  const index = { byTerm, byId, children, bySectionNumber, byDocument, documentPosition };
  hierarchyIndexCache.set(sections, index);
  return index;
}

function hierarchyCandidates(query, sections, limit) {
  if (!sections.some(section => section.hierarchyVersion || section.parentId || section.sectionNumber)) {
    return sections;
  }

  const index = hierarchySearchIndex(sections);
  const queryTerms = tokens(query).map(stem);
  const direct = new Map();
  for (const term of queryTerms) {
    for (const section of index.byTerm.get(term) || []) {
      direct.set(section.id, (direct.get(section.id) || 0) + 1);
    }
  }
  for (const reference of String(query || '').match(/\b\d{2}[\s.\-]*\d{2}[\s.\-]*\d{2}\b/g) || []) {
    const section = index.bySectionNumber.get(reference.replace(/\D/g, ''));
    if (section) direct.set(section.id, Number.MAX_SAFE_INTEGER);
  }

  const seeds = [...direct.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, Math.max(limit * 4, 24))
    .map(([id]) => index.byId.get(id));
  if (!seeds.length) return sections;

  const selected = new Map();
  const add = section => {
    if (section?.id) selected.set(section.id, section);
  };
  for (const seed of seeds) {
    add(seed);
    let parent = index.byId.get(seed.parentId);
    while (parent) {
      add(parent);
      parent = index.byId.get(parent.parentId);
    }
    const queue = [...(index.children.get(seed.id) || [])];
    while (queue.length && selected.size < Math.max(limit * 30, 300)) {
      const child = queue.shift();
      add(child);
      queue.push(...(index.children.get(child.id) || []));
    }
    for (const sibling of index.children.get(seed.parentId) || []) add(sibling);
    for (const referenceId of arrayValue(seed.crossReferenceIds)) add(index.byId.get(referenceId));
    for (const reference of arrayValue(seed.crossReferences)) {
      add(index.bySectionNumber.get(sectionNumberKey(reference)));
    }
  }
  return [...selected.values()];
}

export function retrieve(
  query,
  sections,
  topK = 10
) {
  const safeSections = Array.isArray(sections)
    ? sections
    : [];

  const safeTopK = clamp(
    Number(topK) || 10,
    1,
    50
  );

  const expandedQuery = expandQuery(query);
  const hierarchySections = hierarchyCandidates(query, safeSections, safeTopK);
  const corpus = buildCorpusStats(hierarchySections);

  let scored = hierarchySections
    .map(section => ({
      ...section,
      ...scoreSection(
        section,
        expandedQuery,
        corpus
      )
    }))
    .filter(section =>
      section.score > 0
    )
    .sort((first, second) =>
      second.score - first.score
    )
    .slice(
      0,
      Math.max(
        safeTopK * 8,
        50
      )
    );

  if (scored.length < safeTopK && hierarchySections.length < safeSections.length) {
    const existingIds = new Set(scored.map(section => section.id));
    const fallbackCorpus = buildCorpusStats(safeSections);
    scored = [
      ...scored,
      ...safeSections
        .filter(section => !existingIds.has(section.id))
        .map(section => ({ ...section, ...scoreSection(section, expandedQuery, fallbackCorpus) }))
        .filter(section => section.score > 0)
        .sort((first, second) => second.score - first.score)
        .slice(0, Math.max(safeTopK * 8, 50) - scored.length)
    ].sort((first, second) => second.score - first.score);
  }

  const ranked = rerank(
    scored,
    safeTopK
  );

  const hierarchyNeighbors =
    buildHierarchyNeighbors(
      ranked,
      hierarchySearchIndex(safeSections)
    );

  const finalized = ranked.map(
    (section, index) => ({
      ...section,
      path: canonicalHitPath(section.path),
      score: roundScore(
        section.rerankScore
      ),
      sourceNumber: index + 1
    })
  );

  const conflicts = detectConflicts(
    finalized
  );

  return Object.assign(
    finalized,
    {
      meta: {
        queryExpansion: expandedQuery,
        conflicts,
        totalCandidates: scored.length,
        totalSectionsSearched: hierarchySections.length,
        totalSectionsAvailable: safeSections.length,
        hierarchyFirst: hierarchySections.length < safeSections.length,
        hierarchyNeighbors,
        retrievalVersion: '3.0'
      }
    }
  );
}

export function buildContext(hits, question = '', drawingContext = null) {
  const safeHits = Array.isArray(hits)
    ? hits
    : [];

  // Add Mission Companion intelligence context if available
  let projectContext = '';
  try {
    const bridge = getChiefIntelligenceBridge();
    if (bridge && bridge.initialized) {
      const context = bridge.buildProjectContext(question, drawingContext);
      if (context.hasContext && bridge.hasSufficientEvidence(context)) {
        projectContext = bridge.buildContextString(context);
        if (projectContext) {
          projectContext = `MISSION COMPANION PROJECT INTELLIGENCE:\n${projectContext}\n\n`;
        }
      }
    }
  } catch (error) {
    // If bridge fails, continue without project context
    projectContext = '';
  }

  const conflictNote =
    hits?.meta?.conflicts?.length
      ? `
POTENTIAL SOURCE CONFLICTS:
${hits.meta.conflicts
  .map(conflict =>
    `[S${conflict.sourceA}] may conflict with [S${conflict.sourceB}]: ${conflict.reason} (${conflict.confidence}% confidence)`
  )
  .join('\n')}
`
      : '';

  const sourceContext = safeHits
    .map(hit => {
      const crossReferences =
        hit.crossReferences?.length
          ? hit.crossReferences.join(', ')
          : 'None detected';

      const matched =
        [
          ...(hit.matchedTerms || []),
          ...(hit.matchedPhrases || []),
          ...(hit.matchedReferences || [])
        ].join(', ') ||
        'general relevance';

      return `[S${hit.sourceNumber}]
DOCUMENT: ${hit.documentName || 'Unknown document'}
SECTION: ${hit.heading || 'Unheaded section'}
CSI DIVISION: ${hit.division || hit.metadata?.division || 'Not specified'}
CSI SECTION NUMBER: ${hit.sectionNumber || hit.metadata?.sectionNumber || 'Not specified'}
PATH: ${(hit.path || []).join(' > ') || 'Not specified'}
LOCATION: ${hit.location || 'Not specified'}
PAGE RANGE: ${hit.pageStart || hit.pageRange?.start || hit.metadata?.pageRange?.start || 'Not specified'}-${hit.pageEnd || hit.pageRange?.end || hit.metadata?.pageRange?.end || 'Not specified'}
TRADE/DISCIPLINE: ${hit.metadata?.trade || hit.metadata?.discipline || 'Not specified'}
BUILDING SYSTEMS: ${Array.isArray(hit.metadata?.buildingSystems) ? hit.metadata.buildingSystems.join(', ') || 'Not specified' : hit.metadata?.buildingSystems || 'Not specified'}
LEVEL: ${hit.level || 1}
MATCHED INTENT: ${(hit.matchedIntents || []).join(', ') || 'general'}
RETRIEVAL TERMS: ${matched}
CROSS-REFERENCES: ${crossReferences}
RETRIEVAL SCORE: ${hit.score}
COVERAGE: ${hit.components?.coverage ?? 0}%

${hit.text || ''}`;
    })
    .join('\n\n---\n\n');

  return `${projectContext}${sourceContext}${conflictNote}`;
}

function splitMaterialClaims(answer) {
  return String(answer || '')
    .split(
      /(?<=[.!?])\s+|\n(?=[A-Z0-9#*-])/
    )
    .map(sentence =>
      sentence.trim()
    )
    .filter(sentence =>
      sentence.length > 20
    );
}

function isMaterialClaim(sentence) {
  const value = String(sentence || '');

  if (
    /^#{1,6}\s/.test(value) ||
    /^evidence gaps:?$/i.test(value) ||
    /^question:/i.test(value) ||
    /^document:/i.test(value) ||
    /^location:/i.test(value)
  ) {
    return false;
  }

  return (
    REQUIREMENT.test(value) ||
    DEFINITION.test(value) ||
    RESPONSIBILITY.test(value) ||
    /\b(is|are|was|were|means|defined|requires|requires that|indicates|states|provides|permits|allows)\b/i.test(
      value
    )
  );
}

export function verifyCitations(
  answer,
  hits
) {
  const safeHits = Array.isArray(hits)
    ? hits
    : [];

  const validSources = new Set(
    safeHits.map(hit =>
      hit.sourceNumber
    )
  );

  const cited = [
    ...String(answer || '')
      .matchAll(/\[S(\d+)\]/g)
  ].map(match =>
    Number(match[1])
  );

  const invalid = uniq(
    cited.filter(sourceNumber =>
      !validSources.has(sourceNumber)
    )
  );

  const used = uniq(
    cited.filter(sourceNumber =>
      validSources.has(sourceNumber)
    )
  );

  const sentences = splitMaterialClaims(
    answer
  );

  const materialClaims = sentences.filter(
    isMaterialClaim
  );

  const uncited = materialClaims.filter(
    sentence =>
      !/\[S\d+\]/.test(sentence)
  );

  const citationSupport = used.map(
    sourceNumber => {
      const hit = safeHits.find(
        source =>
          source.sourceNumber === sourceNumber
      );

      return {
        sourceNumber,
        documentName:
          hit?.documentName ||
          null,
        heading:
          hit?.heading ||
          null
      };
    }
  );

  const coverage =
    materialClaims.length
      ? Math.round(
          (
            materialClaims.length -
            uncited.length
          ) /
          materialClaims.length *
          100
        )
      : 100;

  return {
    used,
    invalid,
    uncited,
    materialClaims:
      materialClaims.length,
    coverage,
    citationSupport,
    passed:
      invalid.length === 0 &&
      uncited.length === 0
  };
}

export function scoreAnswer(
  answer,
  evaluation,
  hits
) {
  const lowerAnswer = String(
    answer ||
    ''
  ).toLowerCase();

  const requiredFacts = String(
    evaluation.requiredFacts ||
    ''
  )
    .split('\n')
    .map(value =>
      value.trim()
    )
    .filter(Boolean);

  const prohibited = String(
    evaluation.prohibited ||
    ''
  )
    .split('\n')
    .map(value =>
      value.trim()
    )
    .filter(Boolean);

  const factHits = requiredFacts.filter(
    fact =>
      lowerAnswer.includes(
        fact.toLowerCase()
      )
  );

  const prohibitedHits = prohibited.filter(
    phrase =>
      lowerAnswer.includes(
        phrase.toLowerCase()
      )
  );

  const verification = verifyCitations(
    answer,
    hits
  );

  const expectedSource = String(
    evaluation.expectedSource ||
    ''
  )
    .toLowerCase()
    .trim();

  const sourceMatch = expectedSource
    ? hits.some(hit =>
        `
          ${hit.documentName || ''}
          ${hit.heading || ''}
          ${(hit.path || []).join(' ')}
          ${hit.location || ''}
        `
          .toLowerCase()
          .includes(expectedSource)
      )
    : true;

  const factScore = requiredFacts.length
    ? factHits.length /
      requiredFacts.length *
      50
    : 50;

  const citationScore =
    Math.min(
      verification.used.length,
      3
    ) * 7;

  const sourceScore =
    sourceMatch
      ? 12
      : 0;

  const verificationScore =
    verification.passed
      ? 12
      : Math.max(
          0,
          12 -
          verification.uncited.length * 3 -
          verification.invalid.length * 5
        );

  const conflictAwareness =
    hits.meta?.conflicts?.length
      ? /\b(conflict|exception|inconsisten|contradict|review)\b/i.test(
          answer
        )
        ? 5
        : 0
      : 5;

  const penalties =
    prohibitedHits.length * 20 +
    verification.invalid.length * 10;

  const score = clamp(
    Math.round(
      factScore +
      citationScore +
      sourceScore +
      verificationScore +
      conflictAwareness -
      penalties
    ),
    0,
    100
  );

  return {
    score,
    factHits,
    missingFacts: requiredFacts.filter(
      fact =>
        !factHits.includes(fact)
    ),
    prohibitedHits,
    citations:
      verification.used.length,
    sourceMatch,
    answer,
    hits,
    citationVerification:
      verification,
    conflicts:
      hits.meta?.conflicts ||
      []
  };
}
