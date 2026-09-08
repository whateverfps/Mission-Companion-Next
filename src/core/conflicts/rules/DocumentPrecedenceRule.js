/**
 * Mission Companion - Document Precedence Rule
 * Determines the controlling project document, traces amendment chains,
 * and reports unresolved precedence conflicts.
 */

import { ReasoningRule } from "../ConflictReasoner.js";
import { normalizedText as normalize } from "../../../data-model.js";

export const DocumentType = Object.freeze({
  CONTRACT: "contract",
  MODIFICATION: "modification",
  CHANGE_ORDER: "change_order",
  ADDENDUM: "addendum",
  AMENDMENT: "amendment",
  SPECIFICATION: "specification",
  DRAWING: "drawing",
  FIELD_ORDER: "field_order",
  DIRECTIVE: "directive",
  ASI: "asi",
  BULLETIN: "bulletin",
  RFI: "rfi",
  APPROVED_SUBMITTAL: "approved_submittal",
  SUBMITTAL: "submittal",
  COMMISSIONING: "commissioning",
  SOP: "sop",
  REPORT: "report",
  MEETING_MINUTES: "meeting_minutes",
  EMAIL: "email",
  NOTE: "note",
  UNKNOWN: "unknown"
});

export const PrecedenceFindingType = Object.freeze({
  GOVERNING_DOCUMENT: "governing_document",
  SUPERSEDED_DOCUMENT: "superseded_document",
  AMENDMENT_CHAIN: "amendment_chain",
  EQUAL_PRECEDENCE_CONFLICT: "equal_precedence_conflict",
  REVISION_CONFLICT: "revision_conflict",
  SCOPE_CONFLICT: "scope_conflict",
  UNAUTHORIZED_OVERRIDE: "unauthorized_override",
  INCOMPLETE_REFERENCE: "incomplete_reference",
  CIRCULAR_SUPERSESSION: "circular_supersession",
  MISSING_BASE_DOCUMENT: "missing_base_document",
  AMBIGUOUS_GOVERNING_DOCUMENT: "ambiguous_governing_document"
});

export const PrecedenceSeverity = Object.freeze({
  INFO: "info",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical"
});

export const DEFAULT_PRECEDENCE = Object.freeze({
  [DocumentType.CONTRACT]: 1000,
  [DocumentType.MODIFICATION]: 990,
  [DocumentType.CHANGE_ORDER]: 980,
  [DocumentType.ADDENDUM]: 970,
  [DocumentType.AMENDMENT]: 965,
  [DocumentType.SPECIFICATION]: 900,
  [DocumentType.DRAWING]: 880,
  [DocumentType.FIELD_ORDER]: 850,
  [DocumentType.DIRECTIVE]: 840,
  [DocumentType.ASI]: 830,
  [DocumentType.BULLETIN]: 820,
  [DocumentType.RFI]: 780,
  [DocumentType.APPROVED_SUBMITTAL]: 760,
  [DocumentType.SUBMITTAL]: 700,
  [DocumentType.COMMISSIONING]: 650,
  [DocumentType.SOP]: 600,
  [DocumentType.REPORT]: 400,
  [DocumentType.MEETING_MINUTES]: 300,
  [DocumentType.EMAIL]: 200,
  [DocumentType.NOTE]: 100,
  [DocumentType.UNKNOWN]: 50
});

const TYPE_PATTERNS = [
  [DocumentType.MODIFICATION, /\b(?:contract\s+)?modification\b|\bmod(?:ification)?\s*#?\s*\d+/i],
  [DocumentType.CHANGE_ORDER, /\bchange\s+order\b|\bco\s*#?\s*\d+/i],
  [DocumentType.ADDENDUM, /\baddendum\b|\baddenda\b/i],
  [DocumentType.AMENDMENT, /\bamendment\b/i],
  [DocumentType.CONTRACT, /\bcontract\b|\bsolicitation\b/i],
  [DocumentType.SPECIFICATION, /\bspecification\b|\bspec\s+section\b|\bsection\s+\d{2}\s*\d{2}\s*\d{2}\b/i],
  [DocumentType.DRAWING, /\bdrawing\b|\bsheet\s+[a-z]{1,3}-?\d+/i],
  [DocumentType.FIELD_ORDER, /\bfield\s+order\b/i],
  [DocumentType.DIRECTIVE, /\bdirective\b|\bnotice\s+to\s+proceed\b/i],
  [DocumentType.ASI, /\basi\b|\barchitect'?s\s+supplemental\s+instruction\b/i],
  [DocumentType.BULLETIN, /\bbulletin\b/i],
  [DocumentType.RFI, /\brfi\b|\brequest\s+for\s+information\b/i],
  [DocumentType.APPROVED_SUBMITTAL, /\bapproved\s+submittal\b/i],
  [DocumentType.SUBMITTAL, /\bsubmittal\b|\bshop\s+drawing\b/i],
  [DocumentType.COMMISSIONING, /\bcommissioning\b|\bcx\b/i],
  [DocumentType.SOP, /\bstandard\s+operating\s+procedure\b|\bsop\b/i],
  [DocumentType.REPORT, /\breport\b/i],
  [DocumentType.MEETING_MINUTES, /\bmeeting\s+minutes\b/i],
  [DocumentType.EMAIL, /\be-?mail\b/i],
  [DocumentType.NOTE, /\bnote\b|\bmemorandum\b|\bmemo\b/i]
];

const SUPERSESSION_PATTERNS = [
  /\bsupersedes?\s+([^.;]+)/i,
  /\breplaces?\s+([^.;]+)/i,
  /\brevises?\s+([^.;]+)/i,
  /\bamends?\s+([^.;]+)/i,
  /\bmodifies?\s+([^.;]+)/i,
  /\bvoids?\s+([^.;]+)/i
];

const REFERENCE_PATTERNS = [
  /\b(?:see|refer\s+to|in\s+accordance\s+with|per)\s+([^.;]+)/gi,
  /\b(?:section|drawing|sheet|rfi|asi|addendum|amendment|modification|change\s+order)\s*[#:.-]?\s*[a-z0-9.-]+/gi
];

const AUTHORITY_BY_TYPE = Object.freeze({
  [DocumentType.MODIFICATION]: ["contracting_officer", "owner"],
  [DocumentType.CHANGE_ORDER]: ["contracting_officer", "owner"],
  [DocumentType.ADDENDUM]: ["contracting_officer", "designer", "owner"],
  [DocumentType.AMENDMENT]: ["contracting_officer", "owner"],
  [DocumentType.FIELD_ORDER]: ["contracting_officer", "cor", "owner"],
  [DocumentType.DIRECTIVE]: ["contracting_officer", "cor", "owner"],
  [DocumentType.ASI]: ["architect", "engineer", "designer"],
  [DocumentType.RFI]: ["architect", "engineer", "designer", "owner", "cor"]
});

function lower(value) {
  return normalize(value).toLowerCase();
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function nodeText(node) {
  return normalize([
    node?.title,
    node?.text,
    node?.description,
    node?.metadata?.text,
    node?.metadata?.description,
    node?.metadata?.notes,
    node?.metadata?.requirement
  ].filter(Boolean).join(" "));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRevision(value) {
  const raw = normalize(value);
  if (!raw) return { raw: "", numeric: 0, alpha: "" };
  const numeric = Number(raw.match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  const alpha = raw.match(/[a-z]+/i)?.[0]?.toUpperCase() ?? "";
  return { raw, numeric, alpha };
}

function compareRevision(left, right) {
  const a = parseRevision(left);
  const b = parseRevision(right);
  if (a.numeric !== b.numeric) return a.numeric - b.numeric;
  return a.alpha.localeCompare(b.alpha);
}

function canonicalType(value) {
  const raw = lower(value).replace(/[\s-]+/g, "_");
  const aliases = {
    specs: DocumentType.SPECIFICATION,
    spec: DocumentType.SPECIFICATION,
    plans: DocumentType.DRAWING,
    plan: DocumentType.DRAWING,
    shop_drawing: DocumentType.SUBMITTAL,
    approved_shop_drawing: DocumentType.APPROVED_SUBMITTAL,
    contract_modification: DocumentType.MODIFICATION,
    mod: DocumentType.MODIFICATION,
    co: DocumentType.CHANGE_ORDER,
    meeting_minute: DocumentType.MEETING_MINUTES,
    minutes: DocumentType.MEETING_MINUTES,
    memo: DocumentType.NOTE
  };
  if (aliases[raw]) return aliases[raw];
  return Object.values(DocumentType).includes(raw) ? raw : DocumentType.UNKNOWN;
}

export function inferDocumentType(node) {
  const explicit = node?.metadata?.documentType ?? node?.metadata?.sourceType ?? node?.documentType ?? node?.type;
  const normalized = canonicalType(explicit);
  if (normalized !== DocumentType.UNKNOWN) return normalized;
  const text = nodeText(node);
  return TYPE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? DocumentType.UNKNOWN;
}

function extractIdentifier(node, type) {
  const explicit = normalize(
    node?.metadata?.documentNumber ??
    node?.metadata?.number ??
    node?.metadata?.identifier ??
    node?.metadata?.reference ??
    node?.title
  );
  if (explicit) return explicit;
  const text = nodeText(node);
  const patterns = {
    [DocumentType.RFI]: /\brfi\s*[#:-]?\s*([a-z0-9.-]+)/i,
    [DocumentType.ASI]: /\basi\s*[#:-]?\s*([a-z0-9.-]+)/i,
    [DocumentType.ADDENDUM]: /\baddendum\s*[#:-]?\s*([a-z0-9.-]+)/i,
    [DocumentType.AMENDMENT]: /\bamendment\s*[#:-]?\s*([a-z0-9.-]+)/i,
    [DocumentType.MODIFICATION]: /\b(?:modification|mod)\s*[#:-]?\s*([a-z0-9.-]+)/i,
    [DocumentType.CHANGE_ORDER]: /\b(?:change\s+order|co)\s*[#:-]?\s*([a-z0-9.-]+)/i,
    [DocumentType.DRAWING]: /\b(?:drawing|sheet)\s*[#:-]?\s*([a-z0-9.-]+)/i,
    [DocumentType.SPECIFICATION]: /\bsection\s+([0-9]{2}\s*[0-9]{2}\s*[0-9]{2}(?:\.[0-9]+)?)/i
  };
  return normalize(text.match(patterns[type])?.[1] ?? node?.id ?? "");
}

function extractScope(node) {
  const metadata = node?.metadata || {};
  return {
    project: normalize(metadata.project ?? metadata.projectId),
    building: normalize(metadata.building ?? metadata.facility),
    area: normalize(metadata.area ?? metadata.location),
    discipline: normalize(metadata.discipline ?? metadata.trade),
    section: normalize(metadata.csiSection ?? metadata.specSection ?? metadata.section),
    drawing: normalize(metadata.drawing ?? metadata.sheet),
    system: normalize(metadata.system ?? metadata.assetSystem),
    subject: normalize(metadata.subject ?? metadata.topic)
  };
}

function extractReferences(text) {
  const references = [];
  for (const pattern of REFERENCE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) references.push(normalize(match[1] ?? match[0]));
  }
  return unique(references);
}

function extractSupersedes(text, metadata = {}) {
  const explicit = metadata.supersedes ?? metadata.replaces ?? metadata.amends ?? metadata.modifies;
  const values = Array.isArray(explicit) ? explicit : explicit ? [explicit] : [];
  for (const pattern of SUPERSESSION_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) values.push(normalize(match[1]));
  }
  return unique(values);
}

function normalizeAuthority(value) {
  return lower(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export class DocumentRecord {
  constructor(init = {}) {
    Object.assign(this, {
      id: init.id ?? "",
      nodeId: init.nodeId ?? null,
      type: init.type ?? DocumentType.UNKNOWN,
      identifier: init.identifier ?? "",
      title: init.title ?? "",
      revision: init.revision ?? "",
      date: init.date ?? null,
      effectiveDate: init.effectiveDate ?? null,
      status: init.status ?? "unknown",
      approved: Boolean(init.approved),
      issuedForConstruction: Boolean(init.issuedForConstruction),
      authority: init.authority ?? "",
      scope: init.scope ?? {},
      references: unique(init.references),
      supersedes: unique(init.supersedes),
      source: init.source ?? {},
      text: init.text ?? "",
      confidence: clamp(init.confidence ?? 0.5)
    });
  }
}

export function extractDocumentRecord(node) {
  const text = nodeText(node);
  const type = inferDocumentType(node);
  const metadata = node?.metadata || {};
  const status = lower(metadata.status ?? node?.status);
  const approved = Boolean(metadata.approved) || /\bapproved\b/i.test(text) || status === "approved";
  const issuedForConstruction = Boolean(metadata.issuedForConstruction) || /\bissued\s+for\s+construction\b|\bifc\b/i.test(text);
  return new DocumentRecord({
    id: `document:${node?.id ?? Math.random().toString(36).slice(2)}`,
    nodeId: node?.id ?? null,
    type,
    identifier: extractIdentifier(node, type),
    title: normalize(node?.title ?? metadata.title),
    revision: normalize(metadata.revision ?? metadata.version ?? metadata.rev),
    date: parseDate(metadata.date ?? metadata.issueDate)?.toISOString() ?? null,
    effectiveDate: parseDate(metadata.effectiveDate ?? metadata.approvedDate ?? metadata.date)?.toISOString() ?? null,
    status,
    approved,
    issuedForConstruction,
    authority: normalize(metadata.authority ?? metadata.issuedBy ?? metadata.approvedBy),
    scope: extractScope(node),
    references: extractReferences(text),
    supersedes: extractSupersedes(text, metadata),
    source: {
      nodeId: node?.id ?? null,
      document: normalize(metadata.document ?? metadata.sourceDocument ?? node?.title),
      section: normalize(metadata.section ?? metadata.specSection),
      page: metadata.page ?? metadata.pageNumber ?? null
    },
    text,
    confidence: type === DocumentType.UNKNOWN ? 0.55 : 0.92
  });
}

export function precedenceScore(document, precedence = DEFAULT_PRECEDENCE) {
  let score = precedence[document.type] ?? precedence[DocumentType.UNKNOWN];
  if (document.approved) score += 10;
  if (document.issuedForConstruction) score += 8;
  if (["draft", "void", "rejected", "superseded"].includes(document.status)) score -= 100;
  return score;
}

function valuesOverlap(left, right) {
  if (!left || !right) return true;
  const a = lower(left);
  const b = lower(right);
  return a === b || a.includes(b) || b.includes(a);
}

export function scopeOverlap(left, right) {
  const keys = ["project", "building", "area", "discipline", "section", "drawing", "system", "subject"];
  let compared = 0;
  let matched = 0;
  for (const key of keys) {
    const a = left.scope?.[key];
    const b = right.scope?.[key];
    if (!a || !b) continue;
    compared += 1;
    if (valuesOverlap(a, b)) matched += 1;
  }
  return compared === 0 || matched / compared >= 0.5;
}

function textSimilarity(left, right) {
  const tokenize = value => new Set(lower(value).split(/[^a-z0-9]+/).filter(token => token.length > 3));
  const a = tokenize(left.text);
  const b = tokenize(right.text);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter(token => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function directSupersession(left, right) {
  const candidates = [right.identifier, right.title, right.nodeId].map(lower).filter(Boolean);
  return left.supersedes.some(value => candidates.some(candidate => lower(value).includes(candidate) || candidate.includes(lower(value))));
}

function validAuthority(document) {
  const required = AUTHORITY_BY_TYPE[document.type];
  if (!required?.length || !document.authority) return true;
  const authority = normalizeAuthority(document.authority);
  return required.some(role => authority.includes(role));
}

function compareDates(left, right) {
  const a = parseDate(left.effectiveDate ?? left.date);
  const b = parseDate(right.effectiveDate ?? right.date);
  if (!a || !b) return 0;
  return a.getTime() - b.getTime();
}

export function compareDocuments(left, right, precedence = DEFAULT_PRECEDENCE) {
  const reasons = [];
  if (directSupersession(left, right)) return { governing: left, overridden: right, confidence: 0.99, reasons: ["Express supersession language."] };
  if (directSupersession(right, left)) return { governing: right, overridden: left, confidence: 0.99, reasons: ["Express supersession language."] };

  const leftScore = precedenceScore(left, precedence);
  const rightScore = precedenceScore(right, precedence);
  if (leftScore !== rightScore) {
    const governing = leftScore > rightScore ? left : right;
    const overridden = governing === left ? right : left;
    reasons.push(`Higher document precedence (${Math.max(leftScore, rightScore)} versus ${Math.min(leftScore, rightScore)}).`);
    return { governing, overridden, confidence: 0.94, reasons };
  }

  const revisionDifference = compareRevision(left.revision, right.revision);
  if (revisionDifference !== 0) {
    const governing = revisionDifference > 0 ? left : right;
    return { governing, overridden: governing === left ? right : left, confidence: 0.91, reasons: ["Later revision at equal document precedence."] };
  }

  const dateDifference = compareDates(left, right);
  if (dateDifference !== 0) {
    const governing = dateDifference > 0 ? left : right;
    return { governing, overridden: governing === left ? right : left, confidence: 0.86, reasons: ["Later effective date at equal precedence and revision."] };
  }

  if (left.approved !== right.approved) {
    const governing = left.approved ? left : right;
    return { governing, overridden: governing === left ? right : left, confidence: 0.88, reasons: ["Approved document governs an unapproved document of otherwise equal rank."] };
  }

  return { governing: null, overridden: null, confidence: 0.5, reasons: ["Documents have equal precedence and no reliable tie-breaker."] };
}

export function buildSupersessionGraph(documents) {
  const byId = new Map();
  for (const document of documents) {
    for (const key of [document.nodeId, document.identifier, document.title]) {
      if (key) byId.set(lower(key), document);
    }
  }
  const edges = [];
  for (const document of documents) {
    for (const reference of document.supersedes) {
      const normalized = lower(reference);
      let target = byId.get(normalized);
      if (!target) target = [...byId.entries()].find(([key]) => key.includes(normalized) || normalized.includes(key))?.[1];
      edges.push({ from: document.nodeId, to: target?.nodeId ?? null, reference, resolved: Boolean(target) });
    }
  }
  return { documents, edges };
}

function detectCircularSupersession(graph) {
  const adjacency = new Map();
  for (const edge of graph.edges.filter(edge => edge.resolved)) {
    const list = adjacency.get(edge.from) || [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  const visiting = new Set();
  const visited = new Set();
  const findings = [];
  function visit(node, path = []) {
    if (visiting.has(node)) {
      const start = path.indexOf(node);
      const cycle = (start >= 0 ? path.slice(start) : path).concat(node);
      findings.push({
        subtype: PrecedenceFindingType.CIRCULAR_SUPERSESSION,
        severity: PrecedenceSeverity.CRITICAL,
        confidence: 0.99,
        documentIds: cycle,
        title: "Circular document supersession",
        explanation: `The supersession chain is circular: ${cycle.join(" -> ")}.`
      });
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of adjacency.get(node) || []) visit(next, [...path, node]);
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of adjacency.keys()) visit(node);
  return findings;
}

function detectMissingReferences(graph) {
  return graph.edges.filter(edge => !edge.resolved).map(edge => ({
    subtype: PrecedenceFindingType.MISSING_BASE_DOCUMENT,
    severity: PrecedenceSeverity.HIGH,
    confidence: 0.91,
    documentIds: [edge.from],
    title: "Superseded document not found",
    explanation: `Document ${edge.from} states that it supersedes "${edge.reference}", but the referenced document is not present in the graph.`,
    reference: edge.reference
  }));
}

function detectUnauthorizedOverrides(documents) {
  return documents.filter(document => !validAuthority(document)).map(document => ({
    subtype: PrecedenceFindingType.UNAUTHORIZED_OVERRIDE,
    severity: PrecedenceSeverity.HIGH,
    confidence: 0.88,
    documentIds: [document.nodeId],
    title: "Document may lack authority to modify contract requirements",
    explanation: `${document.identifier || document.nodeId} is classified as ${document.type}, but its issuing authority is not recognized for that document type.`
  }));
}

function pairwiseFindings(documents, precedence, options) {
  const findings = [];
  for (let i = 0; i < documents.length; i += 1) {
    for (let j = i + 1; j < documents.length; j += 1) {
      const left = documents[i];
      const right = documents[j];
      if (!scopeOverlap(left, right)) continue;
      const similarity = textSimilarity(left, right);
      const sameIdentifier = left.identifier && right.identifier && lower(left.identifier) === lower(right.identifier);
      const sameSection = left.scope.section && right.scope.section && lower(left.scope.section) === lower(right.scope.section);
      if (!sameIdentifier && !sameSection && similarity < options.minimumSimilarity) continue;

      const comparison = compareDocuments(left, right, precedence);
      if (comparison.governing) {
        findings.push({
          subtype: directSupersession(comparison.governing, comparison.overridden)
            ? PrecedenceFindingType.SUPERSEDED_DOCUMENT
            : PrecedenceFindingType.GOVERNING_DOCUMENT,
          severity: PrecedenceSeverity.INFO,
          confidence: comparison.confidence,
          governingNodeId: comparison.governing.nodeId,
          overriddenNodeId: comparison.overridden.nodeId,
          documentIds: [comparison.governing.nodeId, comparison.overridden.nodeId],
          title: "Governing document identified",
          explanation: `${comparison.governing.identifier || comparison.governing.nodeId} governs ${comparison.overridden.identifier || comparison.overridden.nodeId}. ${comparison.reasons.join(" ")}`,
          evidence: [comparison.governing.source, comparison.overridden.source]
        });
      } else {
        findings.push({
          subtype: PrecedenceFindingType.EQUAL_PRECEDENCE_CONFLICT,
          severity: PrecedenceSeverity.HIGH,
          confidence: 0.86,
          governingNodeId: null,
          overriddenNodeId: null,
          documentIds: [left.nodeId, right.nodeId],
          title: "Equal-precedence document conflict",
          explanation: `${left.identifier || left.nodeId} and ${right.identifier || right.nodeId} address overlapping scope, but neither can be reliably identified as controlling.`,
          evidence: [left.source, right.source]
        });
      }
    }
  }
  return findings;
}

function recommendationFor(finding) {
  const actions = {
    [PrecedenceFindingType.GOVERNING_DOCUMENT]: `Use ${finding.governingNodeId} as the controlling source and preserve the overridden document as historical evidence.`,
    [PrecedenceFindingType.SUPERSEDED_DOCUMENT]: `Mark ${finding.overriddenNodeId} as superseded and direct users to ${finding.governingNodeId}.`,
    [PrecedenceFindingType.EQUAL_PRECEDENCE_CONFLICT]: "Obtain a written interpretation or formal contract modification before relying on either document.",
    [PrecedenceFindingType.UNAUTHORIZED_OVERRIDE]: "Verify the issuer's delegated authority and obtain a properly authorized directive before changing contract work.",
    [PrecedenceFindingType.CIRCULAR_SUPERSESSION]: "Correct the circular amendment chain and issue a consolidated controlling revision.",
    [PrecedenceFindingType.MISSING_BASE_DOCUMENT]: "Locate and index the referenced base document before applying the superseding document."
  };
  return {
    findingId: finding.id,
    priority: finding.severity === PrecedenceSeverity.CRITICAL ? "immediate" : finding.severity === PrecedenceSeverity.HIGH ? "high" : "normal",
    action: actions[finding.subtype] ?? "Review the document chain and establish the controlling requirement in writing.",
    verification: "Confirm document status, revision, authority, effective date, scope, and all subsequent modifications."
  };
}

function graphNodes(graph) {
  if (typeof graph.findNodes === "function") return graph.findNodes({});
  if (typeof graph.getNodes === "function") return graph.getNodes();
  if (graph.nodes instanceof Map) return [...graph.nodes.values()];
  return Array.isArray(graph.nodes) ? graph.nodes : [];
}

function summarize(documents, findings) {
  const byType = {};
  const bySeverity = {};
  for (const document of documents) byType[document.type] = (byType[document.type] || 0) + 1;
  for (const finding of findings) bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
  return {
    documentCount: documents.length,
    findingCount: findings.length,
    unresolvedCount: findings.filter(finding => [PrecedenceFindingType.EQUAL_PRECEDENCE_CONFLICT, PrecedenceFindingType.CIRCULAR_SUPERSESSION, PrecedenceFindingType.MISSING_BASE_DOCUMENT, PrecedenceFindingType.UNAUTHORIZED_OVERRIDE].includes(finding.subtype)).length,
    status: bySeverity.critical ? "critical" : bySeverity.high ? "attention_required" : "resolved",
    byType,
    bySeverity
  };
}

export class DocumentPrecedenceRule extends ReasoningRule {
  constructor(options = {}) {
    super(options.name || "Document Precedence Rule", options.priority ?? 40);
    this.options = {
      precedence: { ...DEFAULT_PRECEDENCE, ...(options.precedence || {}) },
      minimumSimilarity: options.minimumSimilarity ?? 0.12,
      includeUnknown: options.includeUnknown ?? false
    };
  }

  appliesTo(graph) {
    return Boolean(graph) && (typeof graph.findNodes === "function" || typeof graph.getNodes === "function" || graph.nodes instanceof Map || Array.isArray(graph.nodes));
  }

  execute(graph, result) {
    const documents = graphNodes(graph)
      .map(extractDocumentRecord)
      .filter(document => this.options.includeUnknown || document.type !== DocumentType.UNKNOWN);
    const supersessionGraph = buildSupersessionGraph(documents);
    const rawFindings = [
      ...pairwiseFindings(documents, this.options.precedence, this.options),
      ...detectCircularSupersession(supersessionGraph),
      ...detectMissingReferences(supersessionGraph),
      ...detectUnauthorizedOverrides(documents)
    ];
    const findings = rawFindings.map((finding, index) => ({
      id: `document-precedence-${index + 1}`,
      type: "document_precedence",
      ...finding
    }));
    const recommendations = findings.map(recommendationFor);
    result.documentPrecedence = {
      documents,
      supersessionGraph,
      findings,
      recommendations,
      summary: summarize(documents, findings)
    };
    for (const finding of findings) {
      result.addFinding(finding);
      result.addExplanation({ findingId: finding.id, title: finding.title, text: finding.explanation, evidence: finding.evidence || [] });
    }
    for (const recommendation of recommendations) result.addRecommendation(recommendation);
    result.metrics.documentPrecedenceDocuments = documents.length;
    result.metrics.documentPrecedenceFindings = findings.length;
    result.metrics.documentPrecedenceUnresolved = result.documentPrecedence.summary.unresolvedCount;
    return result.documentPrecedence;
  }
}

export function registerDocumentPrecedenceRule(reasoner, options = {}) {
  if (!reasoner || typeof reasoner.registerRule !== "function") throw new TypeError("reasoner must provide registerRule().");
  reasoner.registerRule(new DocumentPrecedenceRule(options));
  return reasoner;
}

export default DocumentPrecedenceRule;
