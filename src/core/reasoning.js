import {
  retrieve,
  buildContext,
  extractRequirements,
  extractResponsibilities,
  extractDeliverables,
  extractAcceptanceCriteria,
  extractExceptions,
  buildComplianceMatrix,
  buildKnowledgeGraph,
  detectMissingEvidence,
  summarizeRequirements
} from "../retrieval.js";
import { normalizedKey as normalizeKey } from "../data-model.js";

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function inferDeliverableType(deliverable) {
  const value = String(deliverable || "").toLowerCase();

  if (/\b(submittal|shop drawing|product data|sample|mockup)\b/.test(value)) return "submittal";
  if (/\b(report|inspection report|test report|commissioning report)\b/.test(value)) return "report";
  if (/\b(certificate|certification)\b/.test(value)) return "certificate";
  if (/\b(schedule)\b/.test(value)) return "schedule";
  if (/\b(photo|photograph)\b/.test(value)) return "photograph";
  if (/\b(record drawing|as-built)\b/.test(value)) return "record-document";
  if (/\b(operation manual|maintenance manual|manual)\b/.test(value)) return "manual";
  if (/\b(warranty)\b/.test(value)) return "warranty";
  if (/\b(training)\b/.test(value)) return "training";
  if (/\b(punch list|closeout)\b/.test(value)) return "closeout";

  return "deliverable";
}

function responsibilitiesFromRequirements(result) {
  const grouped = new Map();

  for (const requirement of result.requirements) {
    const party = requirement.responsibleParty || requirement.subject;

    if (!party) continue;

    const key = normalizeKey(party);

    if (!grouped.has(key)) {
      grouped.set(key, {
        party,
        requirementCount: 0,
        requirements: [],
        documents: [],
        deliverables: []
      });
    }

    const group = grouped.get(key);
    group.requirementCount += 1;
    group.requirements.push(requirement);
    group.documents.push(requirement.documentName);
    group.deliverables.push(...requirement.deliverables);
  }

  const responsibilities = [...grouped.values()]
    .map(group => ({
      ...group,
      documents: unique(group.documents),
      deliverables: unique(group.deliverables),
      mandatoryCount: group.requirements.filter(requirement => requirement.type === "mandatory").length,
      prohibitedCount: group.requirements.filter(requirement => requirement.type === "prohibited").length
    }))
    .sort((first, second) => second.requirementCount - first.requirementCount);

  return {
    responsibilities,
    summary: {
      parties: responsibilities.length,
      assignedRequirements: responsibilities.reduce(
        (sum, group) => sum + group.requirementCount,
        0
      ),
      unassignedRequirements: result.requirements.filter(
        requirement => !requirement.responsibleParty && !requirement.subject
      ).length
    }
  };
}

function deliverablesFromRequirements(result) {
  const grouped = new Map();

  for (const requirement of result.requirements) {
    for (const deliverable of requirement.deliverables) {
      const key = normalizeKey(deliverable);

      if (!grouped.has(key)) {
        grouped.set(key, {
          name: deliverable,
          type: inferDeliverableType(deliverable),
          requirementCount: 0,
          requirements: [],
          responsibleParties: [],
          documents: [],
          references: []
        });
      }

      const group = grouped.get(key);
      group.requirementCount += 1;
      group.requirements.push(requirement);
      group.responsibleParties.push(
        requirement.responsibleParty || requirement.subject
      );
      group.documents.push(requirement.documentName);
      group.references.push(...requirement.references);
    }
  }

  const deliverables = [...grouped.values()]
    .map(group => ({
      ...group,
      responsibleParties: unique(group.responsibleParties),
      documents: unique(group.documents),
      references: unique(group.references)
    }))
    .sort((first, second) => second.requirementCount - first.requirementCount);

  return {
    deliverables,
    summary: {
      uniqueDeliverables: deliverables.length,
      totalRequirementLinks: deliverables.reduce(
        (sum, item) => sum + item.requirementCount,
        0
      ),
      byType: deliverables.reduce((summary, item) => {
        summary[item.type] = (summary[item.type] || 0) + 1;
        return summary;
      }, {})
    }
  };
}

function normalizeCorpus(corpus) {
  if (!Array.isArray(corpus)) return [];

  const normalized = corpus
    .filter(record => record && typeof record === "object" && !Array.isArray(record))
    .map(record => ({ ...record }));

  if (corpus.meta && typeof corpus.meta === "object") {
    normalized.meta = { ...corpus.meta };
  }

  return normalized;
}

export function analyzeCorpus(
  query,
  corpus,
  options = {}
) {
  const safeOptions = options && typeof options === "object"
    ? options
    : {};

  const preset = safeOptions.preset === "answer"
    ? "answer"
    : "full";

  const defaults = preset === "answer"
    ? {
        includeContext: true,
        includeRequirements: true,
        includeResponsibilities: true,
        includeDeliverables: true,
        includeAcceptance: true,
        includeExceptions: true,
        includeCompliance: false,
        includeEvidence: false,
        includeGraph: false,
        includeSummary: false,
        includeCorpus: false
      }
    : {
        includeContext: true,
        includeRequirements: true,
        includeResponsibilities: true,
        includeDeliverables: true,
        includeAcceptance: true,
        includeExceptions: true,
        includeCompliance: true,
        includeEvidence: true,
        includeGraph: true,
        includeSummary: true,
        includeCorpus: true
      };

  const includes = Object.fromEntries(
    Object.entries(defaults).map(([name, fallback]) => [
      name,
      typeof safeOptions[name] === "boolean"
        ? safeOptions[name]
        : fallback
    ])
  );

  const hits = normalizeCorpus(corpus);
  const evidenceCorpus = Array.isArray(safeOptions.evidenceCorpus)
    ? normalizeCorpus(safeOptions.evidenceCorpus)
    : hits;

  const result = { query };

  if (includes.includeCorpus) result.corpus = hits;
  if (includes.includeContext) result.context = buildContext(hits);

  const needsRequirements =
    includes.includeRequirements ||
    includes.includeResponsibilities ||
    includes.includeDeliverables;

  const requirements = needsRequirements
    ? extractRequirements(hits)
    : null;

  if (includes.includeRequirements) result.requirements = requirements;
  if (includes.includeResponsibilities) {
    result.responsibilities = responsibilitiesFromRequirements(requirements);
  }
  if (includes.includeDeliverables) {
    result.deliverables = deliverablesFromRequirements(requirements);
  }
  if (includes.includeAcceptance) {
    result.acceptance = extractAcceptanceCriteria(hits);
  }
  if (includes.includeExceptions) {
    result.exceptions = extractExceptions(hits);
  }
  if (includes.includeCompliance) {
    result.compliance = buildComplianceMatrix(hits, evidenceCorpus, safeOptions);
  }
  if (includes.includeEvidence) {
    result.evidence = detectMissingEvidence(hits, evidenceCorpus, safeOptions);
  }
  if (includes.includeGraph) {
    result.graph = buildKnowledgeGraph(hits, evidenceCorpus, safeOptions);
  }
  if (includes.includeSummary) {
    result.summary = summarizeRequirements(hits, evidenceCorpus, safeOptions);
  }

  return result;
}

/* ===========================================================
   Reasoning Session
   =========================================================== */

export class ReasoningSession {

  constructor(library = []) {
    this.library = library;
  }

  async search(query, options = {}) {
    return retrieve(query, this.library, options);
  }

  async analyze(query, options = {}) {

    const hits = await this.search(query, options);

    return {
      query,
      hits,

      context: buildContext(hits),

      requirements:
        extractRequirements(hits),

      responsibilities:
        extractResponsibilities(hits),

      deliverables:
        extractDeliverables(hits),

      acceptance:
        extractAcceptanceCriteria(hits),

      exceptions:
        extractExceptions(hits),

      compliance:
        buildComplianceMatrix(hits),

      evidence:
        detectMissingEvidence(hits),

      graph:
        buildKnowledgeGraph(hits),

      summary:
        summarizeRequirements(hits)
    };
  }

  async answer(question, options = {}) {

    const analysis =
      await this.analyze(question, options);

    return {
      question,

      answer:
        buildNarrativeAnswer(
          question,
          analysis
        ),

      analysis
    };
  }
}

/* ===========================================================
   Narrative Builder
   =========================================================== */

export function buildNarrativeAnswer(
  question,
  analysis
) {

  const lines = [];

  lines.push(
    `Question: ${question}`
  );

  lines.push("");

  lines.push(
    `Relevant requirements: ${analysis.summary.overview.totalRequirements}`
  );

  lines.push(
    `Compliance: ${analysis.summary.overview.compliancePercent}%`
  );

  lines.push("");

  for (
    const req of analysis.requirements.requirements.slice(0,10)
  ) {

    lines.push(
      "• " + req.statement
    );

    if(req.responsibleParty)
      lines.push(
        "  Responsible: " +
        req.responsibleParty
      );

    if(req.deliverables.length)
      lines.push(
        "  Deliverables: " +
        req.deliverables.join(", ")
      );

    if(req.references.length)
      lines.push(
        "  References: " +
        req.references.join(", ")
      );

    lines.push("");
  }

  return lines.join("\n");
}

/* ===========================================================
   Specialized Queries
   =========================================================== */

export async function answerResponsibilityQuestion(
  session,
  party
){

  const analysis =
    await session.analyze(party);

  return analysis.responsibilities;
}

export async function answerComplianceQuestion(
  session,
  topic
){

  const analysis =
    await session.analyze(topic);

  return analysis.compliance;
}

export async function answerEvidenceQuestion(
  session,
  topic
){

  const analysis =
    await session.analyze(topic);

  return analysis.evidence;
}

export async function answerOwnerQCQuestion(
  session,
  topic
){

  const analysis =
    await session.analyze(topic);

  return analysis.summary.ownerQC;
}

/* ===========================================================
   Future Expansion Hooks
   =========================================================== */

/*
Upcoming Build 9 commits:

- Dependency reasoning
- Timeline reasoning
- Conflict arbitration
- Executive briefing
- Spec comparison
- Cross-document inference
- Workflow planning
- Construction sequencing
- Commissioning advisor
- Owner QC assistant
*/
