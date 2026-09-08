/**
 * Mission Companion
 * ComplianceRule.js
 * Phase A production implementation
 */
import { ReasoningRule } from "../ConflictReasoner.js";
import { normalizedText as normalize } from "../../../data-model.js";

export const RequirementLevel = Object.freeze({
  SHALL: "shall",
  MUST: "must",
  REQUIRED: "required",
  WILL: "will",
  SHOULD: "should",
  MAY: "may",
  OPTIONAL: "optional",
  PROHIBITED: "prohibited"
});

export const ComplianceStatus = Object.freeze({
  UNKNOWN: "unknown",
  PENDING: "pending",
  COMPLIANT: "compliant",
  PARTIAL: "partial",
  NON_COMPLIANT: "non_compliant",
  WAIVED: "waived",
  BLOCKED: "blocked",
  NOT_APPLICABLE: "not_applicable"
});

export const EvidenceType = Object.freeze({
  PHOTO: "photo",
  INSPECTION_REPORT: "inspection_report",
  TEST_REPORT: "test_report",
  SUBMITTAL: "submittal",
  APPROVAL: "approval",
  COMMISSIONING_REPORT: "commissioning_report",
  DAILY_REPORT: "daily_report",
  CHECKLIST: "checklist",
  CERTIFICATE: "certificate",
  PUNCHLIST: "punchlist",
  CLOSEOUT: "closeout",
  TRAINING: "training",
  RECORD_DRAWING: "record_drawing",
  O_AND_M_MANUAL: "o_and_m_manual",
  WARRANTY: "warranty",
  RFI: "rfi",
  ASI: "asi",
  CHANGE_ORDER: "change_order",
  PERMIT: "permit",
  SAFETY_PLAN: "safety_plan",
  OTHER: "other"
});

export const ComplianceFindingType = Object.freeze({
  MISSING_EVIDENCE: "missing_evidence",
  PARTIAL_COMPLIANCE: "partial_compliance",
  NON_COMPLIANT: "non_compliant",
  DUPLICATE_EVIDENCE: "duplicate_evidence",
  CONFLICTING_EVIDENCE: "conflicting_evidence",
  STALE_EVIDENCE: "stale_evidence",
  UNDATED_EVIDENCE: "undated_evidence",
  UNATTRIBUTED_EVIDENCE: "unattributed_evidence",
  ORPHAN_EVIDENCE: "orphan_evidence",
  MISSING_TEST: "missing_test",
  FAILED_TEST: "failed_test",
  MISSING_INSPECTION: "missing_inspection",
  FAILED_INSPECTION: "failed_inspection",
  MISSING_SUBMITTAL: "missing_submittal",
  MISSING_APPROVAL: "missing_approval",
  MISSING_CERTIFICATE: "missing_certificate",
  MISSING_CLOSEOUT: "missing_closeout",
  MISSING_TRAINING: "missing_training",
  MISSING_RESPONSIBLE_PARTY: "missing_responsible_party",
  MISSING_ACCEPTANCE_AUTHORITY: "missing_acceptance_authority",
  AMBIGUOUS_REQUIREMENT: "ambiguous_requirement",
  PROHIBITED_CONDITION: "prohibited_condition",
  WAIVER_NOT_DOCUMENTED: "waiver_not_documented",
  EVIDENCE_SCOPE_MISMATCH: "evidence_scope_mismatch"
});

export const ComplianceSeverity = Object.freeze({
  INFO: "info",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical"
});

const MANDATORY_PATTERNS = [
  { level: RequirementLevel.SHALL, pattern: /\bshall\b/i, weight: 0.98 },
  { level: RequirementLevel.MUST, pattern: /\bmust\b/i, weight: 0.98 },
  { level: RequirementLevel.REQUIRED, pattern: /\brequired\s+to\b|\bis\s+required\b/i, weight: 0.96 },
  { level: RequirementLevel.WILL, pattern: /\bwill\b/i, weight: 0.86 },
  { level: RequirementLevel.SHOULD, pattern: /\bshould\b/i, weight: 0.75 },
  { level: RequirementLevel.MAY, pattern: /\bmay\b/i, weight: 0.55 },
  { level: RequirementLevel.PROHIBITED, pattern: /\bshall\s+not\b|\bmust\s+not\b|\bprohibited\b|\bnot\s+permitted\b/i, weight: 0.99 }
];

const RESPONSIBILITY_PATTERNS = [
  ["contractor", /\b(?:contractor|prime contractor|general contractor)\b/i],
  ["cqc", /\b(?:cqc|contractor quality control|quality control manager)\b/i],
  ["owner_qc", /\b(?:owner(?:'s)? qc|owner quality assurance|va qc|government inspector)\b/i],
  ["cor", /\b(?:contracting officer'?s representative|cor)\b/i],
  ["contracting_officer", /\bcontracting officer\b/i],
  ["designer", /\b(?:architect|engineer|designer|a\/e)\b/i],
  ["commissioning_agent", /\b(?:commissioning agent|commissioning authority|cxa)\b/i],
  ["oit", /\b(?:oit|office of information and technology)\b/i],
  ["fire_marshal", /\b(?:fire marshal|fire protection engineer)\b/i],
  ["ahj", /\b(?:authority having jurisdiction|ahj)\b/i]
];

const EVIDENCE_PATTERNS = [
  [EvidenceType.PHOTO, /\bphoto(?:graph)?s?\b/i],
  [EvidenceType.INSPECTION_REPORT, /\binspection\s+(?:report|record|log)\b|\binspected\b/i],
  [EvidenceType.TEST_REPORT, /\btest\s+(?:report|record|result|data)\b|\btested\b/i],
  [EvidenceType.SUBMITTAL, /\bsubmittal\b|\bshop drawing\b|\bproduct data\b/i],
  [EvidenceType.APPROVAL, /\bwritten approval\b|\bapproved submittal\b|\bapproval letter\b/i],
  [EvidenceType.COMMISSIONING_REPORT, /\bcommissioning\s+(?:report|record)\b/i],
  [EvidenceType.DAILY_REPORT, /\bdaily\s+(?:report|log)\b/i],
  [EvidenceType.CHECKLIST, /\bchecklist\b/i],
  [EvidenceType.CERTIFICATE, /\bcertificate\b|\bcertification\b/i],
  [EvidenceType.PUNCHLIST, /\bpunch\s*list\b|\bdeficienc(?:y|ies)\b/i],
  [EvidenceType.CLOSEOUT, /\bclose[- ]?out\b|\bturnover package\b/i],
  [EvidenceType.TRAINING, /\btraining\s+(?:record|roster|certificate)\b/i],
  [EvidenceType.RECORD_DRAWING, /\b(?:record|as[- ]built)\s+drawing\b/i],
  [EvidenceType.O_AND_M_MANUAL, /\boperations?\s+and\s+maintenance\s+manual\b|\bo&m\s+manual\b/i],
  [EvidenceType.WARRANTY, /\bwarranty\s+(?:document|certificate|information)\b/i],
  [EvidenceType.RFI, /\brfi\b|\brequest for information\b/i],
  [EvidenceType.ASI, /\basi\b|\barchitect'?s supplemental instruction\b/i],
  [EvidenceType.CHANGE_ORDER, /\bchange order\b|\bmodification\b/i],
  [EvidenceType.PERMIT, /\bpermit\b/i],
  [EvidenceType.SAFETY_PLAN, /\bicra\b|\bpcra\b|\bsafety plan\b/i]
];

const REQUIREMENT_EVIDENCE_MAP = [
  { pattern: /\binspect(?:ion|ed)?\b/i, types: [EvidenceType.INSPECTION_REPORT, EvidenceType.CHECKLIST, EvidenceType.PHOTO] },
  { pattern: /\btest(?:ing|ed)?\b/i, types: [EvidenceType.TEST_REPORT, EvidenceType.CERTIFICATE] },
  { pattern: /\bsubmit(?:tal)?\b/i, types: [EvidenceType.SUBMITTAL] },
  { pattern: /\bapprove(?:d|al)?\b/i, types: [EvidenceType.APPROVAL, EvidenceType.SUBMITTAL] },
  { pattern: /\bcommission(?:ing|ed)?\b/i, types: [EvidenceType.COMMISSIONING_REPORT, EvidenceType.TEST_REPORT] },
  { pattern: /\btrain(?:ing)?\b/i, types: [EvidenceType.TRAINING] },
  { pattern: /\bclose[- ]?out\b|\bturnover\b/i, types: [EvidenceType.CLOSEOUT, EvidenceType.RECORD_DRAWING, EvidenceType.O_AND_M_MANUAL, EvidenceType.WARRANTY] },
  { pattern: /\bcertif(?:y|ied|ication)\b/i, types: [EvidenceType.CERTIFICATE] },
  { pattern: /\bphoto(?:graph)?\b|\bdocument\b/i, types: [EvidenceType.PHOTO, EvidenceType.DAILY_REPORT, EvidenceType.CHECKLIST] },
  { pattern: /\bpermit\b/i, types: [EvidenceType.PERMIT] },
  { pattern: /\bicra\b|\bpcra\b|\binfection control\b/i, types: [EvidenceType.SAFETY_PLAN, EvidenceType.APPROVAL] }
];

const PASS_PATTERNS = /\bpass(?:ed|ing)?\b|\bacceptable\b|\bcompliant\b|\bapproved\b|\bsatisfactory\b|\bcomplete(?:d)?\b/i;
const FAIL_PATTERNS = /\bfail(?:ed|ure)?\b|\breject(?:ed|ion)?\b|\bnon[- ]?compliant\b|\bdeficien(?:t|cy)\b|\bunsatisfactory\b/i;
const WAIVER_PATTERNS = /\bwaiv(?:e|ed|er)\b|\bexception approved\b|\bvariance\b/i;
const NA_PATTERNS = /\bnot applicable\b|\bn\/a\b/i;

export function normalizeRequirement(text) {
  return normalize(text).toLowerCase();
}

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

function source(node) {
  return {
    nodeId: node?.id ?? null,
    document: node?.metadata?.document ?? node?.metadata?.sourceDocument ?? "",
    section: node?.metadata?.section ?? node?.metadata?.specSection ?? "",
    paragraph: node?.metadata?.paragraph ?? "",
    page: node?.metadata?.page ?? node?.metadata?.pageNumber ?? null,
    title: node?.title ?? ""
  };
}

function splitSentences(text) {
  return normalize(text)
    .split(/(?<=[.!?;])\s+(?=[A-Z0-9])/)
    .map(normalize)
    .filter(Boolean);
}

function stableId(prefix, node, index, text) {
  const slug = lower(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `${prefix}-${node?.id ?? "node"}-${index + 1}${slug ? `-${slug}` : ""}`;
}

function inferRequirementLevel(text) {
  let best = { level: RequirementLevel.OPTIONAL, weight: 0.4 };
  for (const candidate of MANDATORY_PATTERNS) {
    if (candidate.pattern.test(text) && candidate.weight > best.weight) best = candidate;
  }
  return best;
}

function inferResponsibleParty(node, text) {
  const explicit = normalize(node?.metadata?.responsibleParty ?? node?.metadata?.responsibility ?? node?.metadata?.actor ?? node?.metadata?.assignedTo);
  if (explicit) return explicit;
  return RESPONSIBILITY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function inferAcceptingAuthority(node, text) {
  const explicit = normalize(node?.metadata?.acceptingAuthority ?? node?.metadata?.approver ?? node?.metadata?.approvalAuthority);
  if (explicit) return explicit;
  if (/\bcontracting officer\b/i.test(text)) return "contracting_officer";
  if (/\bcor\b|contracting officer'?s representative/i.test(text)) return "cor";
  if (/\bowner\b|\bgovernment\b|\bva\b/i.test(text)) return "owner";
  if (/\bahj\b|authority having jurisdiction/i.test(text)) return "ahj";
  return null;
}

function inferEvidenceTypes(text) {
  return unique(EVIDENCE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([type]) => type));
}

function inferRequiredEvidence(text) {
  const types = [];
  for (const mapping of REQUIREMENT_EVIDENCE_MAP) {
    if (mapping.pattern.test(text)) types.push(...mapping.types);
  }
  return unique(types);
}

function inferStatus(text, metadata = {}) {
  const explicit = lower(metadata?.status ?? metadata?.complianceStatus);
  if (Object.values(ComplianceStatus).includes(explicit)) return explicit;
  if (NA_PATTERNS.test(text)) return ComplianceStatus.NOT_APPLICABLE;
  if (WAIVER_PATTERNS.test(text)) return ComplianceStatus.WAIVED;
  if (FAIL_PATTERNS.test(text)) return ComplianceStatus.NON_COMPLIANT;
  if (PASS_PATTERNS.test(text)) return ComplianceStatus.COMPLIANT;
  if (/\bpending\b|\bawaiting\b|\bopen\b/i.test(text)) return ComplianceStatus.PENDING;
  if (/\bblocked\b|\bon hold\b/i.test(text)) return ComplianceStatus.BLOCKED;
  return ComplianceStatus.UNKNOWN;
}

function inferDate(node, text) {
  const explicit = node?.metadata?.date ?? node?.metadata?.createdAt ?? node?.metadata?.updatedAt;
  if (explicit) {
    const parsed = new Date(explicit);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  const match = text.match(/\b(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)\b|\b([01]?\d)[-\/]([0-3]?\d)[-\/](20\d{2})\b/);
  if (!match) return null;
  const parsed = new Date(match[0]);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function inferEvidenceOutcome(text) {
  if (PASS_PATTERNS.test(text) && FAIL_PATTERNS.test(text)) return "conflicting";
  if (FAIL_PATTERNS.test(text)) return "fail";
  if (PASS_PATTERNS.test(text)) return "pass";
  if (WAIVER_PATTERNS.test(text)) return "waived";
  return "unknown";
}

function tokenSet(text) {
  return new Set(lower(text).split(/[^a-z0-9]+/).filter(token => token.length >= 4));
}

function jaccard(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export class ComplianceRequirement {
  constructor(init = {}) {
    this.id = init.id ?? "";
    this.text = init.text ?? "";
    this.normalized = init.normalized ?? normalizeRequirement(init.text);
    this.document = init.document ?? "";
    this.section = init.section ?? "";
    this.paragraph = init.paragraph ?? "";
    this.page = init.page ?? null;
    this.level = init.level ?? RequirementLevel.SHALL;
    this.status = init.status ?? ComplianceStatus.UNKNOWN;
    this.responsibleParty = init.responsibleParty ?? null;
    this.acceptingAuthority = init.acceptingAuthority ?? null;
    this.requiredEvidence = unique(init.requiredEvidence);
    this.requiredTests = unique(init.requiredTests);
    this.requiredInspections = unique(init.requiredInspections);
    this.requiredDocuments = unique(init.requiredDocuments);
    this.references = unique(init.references);
    this.tags = unique(init.tags);
    this.sourceNode = init.sourceNode ?? null;
    this.confidence = clamp(init.confidence ?? 0);
  }
}

export class ComplianceEvidence {
  constructor(init = {}) {
    this.id = init.id ?? "";
    this.type = init.type ?? EvidenceType.OTHER;
    this.document = init.document ?? "";
    this.section = init.section ?? "";
    this.page = init.page ?? null;
    this.sourceNode = init.sourceNode ?? null;
    this.date = init.date ?? null;
    this.description = init.description ?? "";
    this.author = init.author ?? "";
    this.relatedRequirement = init.relatedRequirement ?? "";
    this.tags = unique(init.tags);
    this.outcome = init.outcome ?? "unknown";
    this.confidence = clamp(init.confidence ?? 0);
  }
}

export function extractComplianceRequirements(node) {
  const fullText = nodeText(node);
  if (!fullText) return [];
  const sentences = splitSentences(fullText);
  const requirements = [];

  for (const sentence of sentences) {
    const level = inferRequirementLevel(sentence);
    if (level.weight < 0.7) continue;

    const requiredEvidence = inferRequiredEvidence(sentence);
    const requirement = new ComplianceRequirement({
      id: stableId("REQ", node, requirements.length, sentence),
      text: sentence,
      normalized: normalizeRequirement(sentence),
      ...source(node),
      sourceNode: node?.id ?? null,
      level: level.level,
      status: inferStatus(sentence, node?.metadata),
      responsibleParty: inferResponsibleParty(node, sentence),
      acceptingAuthority: inferAcceptingAuthority(node, sentence),
      requiredEvidence,
      requiredTests: /\btest(?:ing|ed)?\b/i.test(sentence) ? [normalize(sentence)] : [],
      requiredInspections: /\binspect(?:ion|ed)?\b|\bverify\b/i.test(sentence) ? [normalize(sentence)] : [],
      requiredDocuments: requiredEvidence.filter(type => [EvidenceType.SUBMITTAL, EvidenceType.CERTIFICATE, EvidenceType.CLOSEOUT, EvidenceType.RECORD_DRAWING, EvidenceType.O_AND_M_MANUAL, EvidenceType.WARRANTY].includes(type)),
      confidence: clamp(level.weight + (requiredEvidence.length ? 0.01 : 0))
    });
    requirements.push(requirement);
  }

  return requirements;
}

export function extractEvidence(node) {
  const text = nodeText(node);
  if (!text) return [];
  const types = inferEvidenceTypes(text);
  const explicitType = lower(node?.metadata?.evidenceType ?? node?.metadata?.type);
  if (Object.values(EvidenceType).includes(explicitType) && !types.includes(explicitType)) types.push(explicitType);
  if (!types.length && !PASS_PATTERNS.test(text) && !FAIL_PATTERNS.test(text)) return [];

  const selected = types.length ? types : [EvidenceType.OTHER];
  return selected.map((type, index) => new ComplianceEvidence({
    id: stableId("EVD", node, index, `${type}-${text}`),
    type,
    document: node?.metadata?.document ?? node?.metadata?.sourceDocument ?? "",
    section: node?.metadata?.section ?? node?.metadata?.specSection ?? "",
    page: node?.metadata?.page ?? node?.metadata?.pageNumber ?? null,
    sourceNode: node?.id ?? null,
    date: inferDate(node, text),
    description: text,
    author: normalize(node?.metadata?.author ?? node?.metadata?.createdBy ?? node?.metadata?.inspector),
    relatedRequirement: normalize(node?.metadata?.relatedRequirement ?? node?.metadata?.requirementId),
    tags: unique(node?.metadata?.tags),
    outcome: inferEvidenceOutcome(text),
    confidence: type === EvidenceType.OTHER ? 0.7 : 0.9
  }));
}

export function matchEvidence(requirement, evidence) {
  let score = 0;
  const reasons = [];
  const semantic = jaccard(requirement.text, evidence.description);
  score += semantic * 0.45;
  if (semantic > 0) reasons.push(`token_overlap:${semantic.toFixed(2)}`);

  if (requirement.document && evidence.document && lower(requirement.document) === lower(evidence.document)) {
    score += 0.18;
    reasons.push("same_document");
  }
  if (requirement.section && evidence.section && lower(requirement.section) === lower(evidence.section)) {
    score += 0.17;
    reasons.push("same_section");
  }
  if (evidence.relatedRequirement && evidence.relatedRequirement === requirement.id) {
    score += 0.5;
    reasons.push("explicit_requirement_link");
  }
  if (requirement.requiredEvidence.includes(evidence.type)) {
    score += 0.25;
    reasons.push("required_evidence_type");
  }
  if (requirement.responsibleParty && evidence.author && lower(evidence.author).includes(lower(requirement.responsibleParty))) {
    score += 0.08;
    reasons.push("responsible_party_match");
  }

  return { value: clamp(score), reasons };
}

export function correlateRequirements(requirements, evidence, threshold = 0.32) {
  const links = [];
  for (const requirement of requirements) {
    for (const item of evidence) {
      const match = matchEvidence(requirement, item);
      if (match.value < threshold) continue;
      links.push({
        requirementId: requirement.id,
        evidenceId: item.id,
        score: match.value,
        reasons: match.reasons
      });
    }
  }
  return links.sort((a, b) => b.score - a.score);
}

function linkedEvidence(requirement, evidence, links) {
  const ids = new Set(links.filter(link => link.requirementId === requirement.id).map(link => link.evidenceId));
  return evidence.filter(item => ids.has(item.id));
}

function severityForRequirement(requirement) {
  if (requirement.level === RequirementLevel.PROHIBITED) return ComplianceSeverity.CRITICAL;
  if ([RequirementLevel.SHALL, RequirementLevel.MUST, RequirementLevel.REQUIRED].includes(requirement.level)) return ComplianceSeverity.HIGH;
  if ([RequirementLevel.WILL, RequirementLevel.SHOULD].includes(requirement.level)) return ComplianceSeverity.MEDIUM;
  return ComplianceSeverity.LOW;
}

function finding(type, requirement, options = {}) {
  return {
    type,
    subtype: type,
    severity: options.severity ?? severityForRequirement(requirement),
    confidence: clamp(options.confidence ?? 0.9),
    requirement: requirement?.id ?? null,
    evidence: options.evidence ?? [],
    title: options.title ?? type.replace(/_/g, " "),
    explanation: options.explanation ?? "Compliance review is required.",
    source: requirement ? [{ nodeId: requirement.sourceNode, document: requirement.document, section: requirement.section, page: requirement.page }] : [],
    details: options.details ?? {}
  };
}

export function detectDuplicateEvidence(evidence) {
  const findings = [];
  for (let i = 0; i < evidence.length; i += 1) {
    for (let j = i + 1; j < evidence.length; j += 1) {
      const a = evidence[i];
      const b = evidence[j];
      if (a.type !== b.type) continue;
      const similarity = jaccard(a.description, b.description);
      const sameLocation = lower(a.document) === lower(b.document) && lower(a.section) === lower(b.section);
      if (similarity < 0.9 || !sameLocation) continue;
      findings.push({
        type: ComplianceFindingType.DUPLICATE_EVIDENCE,
        subtype: ComplianceFindingType.DUPLICATE_EVIDENCE,
        severity: ComplianceSeverity.LOW,
        confidence: clamp(similarity),
        evidence: [a.id, b.id],
        title: "Duplicate compliance evidence",
        explanation: "Two evidence records appear to represent the same document or result.",
        source: []
      });
    }
  }
  return findings;
}

export function detectConflictingEvidence(evidence) {
  const findings = [];
  for (let i = 0; i < evidence.length; i += 1) {
    for (let j = i + 1; j < evidence.length; j += 1) {
      const a = evidence[i];
      const b = evidence[j];
      if (![["pass", "fail"], ["fail", "pass"]].some(pair => pair[0] === a.outcome && pair[1] === b.outcome)) continue;
      const similarity = jaccard(a.description, b.description);
      const sameScope = lower(a.document) === lower(b.document) || lower(a.section) === lower(b.section) || similarity >= 0.3;
      if (!sameScope) continue;
      findings.push({
        type: ComplianceFindingType.CONFLICTING_EVIDENCE,
        subtype: ComplianceFindingType.CONFLICTING_EVIDENCE,
        severity: ComplianceSeverity.CRITICAL,
        confidence: clamp(0.8 + similarity * 0.2),
        evidence: [a.id, b.id],
        title: "Conflicting compliance evidence",
        explanation: "Evidence records for the same or similar scope report contradictory pass and fail outcomes.",
        source: []
      });
    }
  }
  return findings;
}

function analyzeRequirement(requirement, evidence, links) {
  const matches = linkedEvidence(requirement, evidence, links);
  const findings = [];
  const matchedTypes = new Set(matches.map(item => item.type));
  const outcomes = new Set(matches.map(item => item.outcome));

  if (requirement.level === RequirementLevel.PROHIBITED && matches.some(item => item.outcome !== "waived")) {
    findings.push(finding(ComplianceFindingType.PROHIBITED_CONDITION, requirement, {
      severity: ComplianceSeverity.CRITICAL,
      confidence: 0.96,
      evidence: matches.map(item => item.id),
      title: "Evidence indicates a prohibited condition",
      explanation: "The requirement prohibits the identified condition, but related evidence indicates that the condition may exist."
    }));
  }

  if (!matches.length) {
    findings.push(finding(ComplianceFindingType.MISSING_EVIDENCE, requirement, {
      confidence: 0.96,
      title: "No supporting compliance evidence",
      explanation: "No evidence record could be correlated to this requirement."
    }));
  }

  if (outcomes.has("fail")) {
    findings.push(finding(ComplianceFindingType.NON_COMPLIANT, requirement, {
      severity: ComplianceSeverity.CRITICAL,
      confidence: 0.98,
      evidence: matches.filter(item => item.outcome === "fail").map(item => item.id),
      title: "Failed compliance evidence",
      explanation: "Related evidence records a failed, rejected, deficient, or non-compliant result."
    }));
  }

  for (const requiredType of requirement.requiredEvidence) {
    if (matchedTypes.has(requiredType)) continue;
    const typeMap = {
      [EvidenceType.TEST_REPORT]: ComplianceFindingType.MISSING_TEST,
      [EvidenceType.INSPECTION_REPORT]: ComplianceFindingType.MISSING_INSPECTION,
      [EvidenceType.SUBMITTAL]: ComplianceFindingType.MISSING_SUBMITTAL,
      [EvidenceType.APPROVAL]: ComplianceFindingType.MISSING_APPROVAL,
      [EvidenceType.CERTIFICATE]: ComplianceFindingType.MISSING_CERTIFICATE,
      [EvidenceType.CLOSEOUT]: ComplianceFindingType.MISSING_CLOSEOUT,
      [EvidenceType.TRAINING]: ComplianceFindingType.MISSING_TRAINING
    };
    const type = typeMap[requiredType] ?? ComplianceFindingType.MISSING_EVIDENCE;
    findings.push(finding(type, requirement, {
      confidence: 0.92,
      title: `Required ${requiredType.replace(/_/g, " ")} not found`,
      explanation: `The requirement calls for ${requiredType.replace(/_/g, " ")}, but no matching evidence was identified.`,
      details: { requiredEvidenceType: requiredType }
    }));
  }

  if (!requirement.responsibleParty && [RequirementLevel.SHALL, RequirementLevel.MUST, RequirementLevel.REQUIRED].includes(requirement.level)) {
    findings.push(finding(ComplianceFindingType.MISSING_RESPONSIBLE_PARTY, requirement, {
      severity: ComplianceSeverity.MEDIUM,
      confidence: 0.8,
      title: "Responsible party not identified",
      explanation: "The mandatory requirement does not clearly identify who is responsible for compliance."
    }));
  }

  if (/\bapprove(?:d|al)?\b|\baccept(?:ed|ance)?\b/i.test(requirement.text) && !requirement.acceptingAuthority) {
    findings.push(finding(ComplianceFindingType.MISSING_ACCEPTANCE_AUTHORITY, requirement, {
      severity: ComplianceSeverity.MEDIUM,
      confidence: 0.82,
      title: "Approval authority not identified",
      explanation: "The requirement calls for approval or acceptance but does not identify the approving authority."
    }));
  }

  if (requirement.status === ComplianceStatus.WAIVED && !matches.some(item => item.outcome === "waived" || item.type === EvidenceType.APPROVAL)) {
    findings.push(finding(ComplianceFindingType.WAIVER_NOT_DOCUMENTED, requirement, {
      severity: ComplianceSeverity.HIGH,
      confidence: 0.9,
      title: "Waiver is not documented",
      explanation: "The requirement is marked waived, but no waiver, variance, or approval record was found."
    }));
  }

  return findings;
}

function detectEvidenceQuality(evidence, links) {
  const linkedIds = new Set(links.map(link => link.evidenceId));
  const findings = [];
  for (const item of evidence) {
    if (!linkedIds.has(item.id)) {
      findings.push({
        type: ComplianceFindingType.ORPHAN_EVIDENCE,
        subtype: ComplianceFindingType.ORPHAN_EVIDENCE,
        severity: ComplianceSeverity.LOW,
        confidence: 0.78,
        evidence: [item.id],
        title: "Evidence is not linked to a requirement",
        explanation: "The evidence record could not be correlated to a compliance requirement.",
        source: []
      });
    }
    if (!item.date) {
      findings.push({
        type: ComplianceFindingType.UNDATED_EVIDENCE,
        subtype: ComplianceFindingType.UNDATED_EVIDENCE,
        severity: ComplianceSeverity.LOW,
        confidence: 0.8,
        evidence: [item.id],
        title: "Evidence record has no date",
        explanation: "The evidence record does not identify when the inspection, test, approval, or documentation occurred.",
        source: []
      });
    }
    if (!item.author) {
      findings.push({
        type: ComplianceFindingType.UNATTRIBUTED_EVIDENCE,
        subtype: ComplianceFindingType.UNATTRIBUTED_EVIDENCE,
        severity: ComplianceSeverity.LOW,
        confidence: 0.76,
        evidence: [item.id],
        title: "Evidence record has no author",
        explanation: "The evidence record does not identify the inspector, tester, preparer, or approving party.",
        source: []
      });
    }
  }
  return findings;
}

export function scoreCompliance(requirements, findings) {
  if (!requirements.length) return { score: 100, compliant: true, partial: false, nonCompliant: false };
  const weights = {
    [ComplianceSeverity.INFO]: 0.5,
    [ComplianceSeverity.LOW]: 1.5,
    [ComplianceSeverity.MEDIUM]: 4,
    [ComplianceSeverity.HIGH]: 9,
    [ComplianceSeverity.CRITICAL]: 18
  };
  const penalty = findings.reduce((sum, item) => sum + (weights[item.severity] ?? 4) * clamp(item.confidence, 0.25, 1), 0);
  const score = Math.max(0, Math.round(100 - penalty));
  return {
    score,
    compliant: score >= 95 && !findings.some(item => item.severity === ComplianceSeverity.CRITICAL),
    partial: score >= 70 && score < 95,
    nonCompliant: score < 70 || findings.some(item => item.severity === ComplianceSeverity.CRITICAL)
  };
}

function statusForRequirement(requirement, evidence, links, findings) {
  if (requirement.status === ComplianceStatus.NOT_APPLICABLE) return ComplianceStatus.NOT_APPLICABLE;
  if (requirement.status === ComplianceStatus.WAIVED) return ComplianceStatus.WAIVED;
  const relatedFindings = findings.filter(item => item.requirement === requirement.id);
  if (relatedFindings.some(item => item.severity === ComplianceSeverity.CRITICAL)) return ComplianceStatus.NON_COMPLIANT;
  if (relatedFindings.some(item => [ComplianceSeverity.HIGH, ComplianceSeverity.MEDIUM].includes(item.severity))) return ComplianceStatus.PARTIAL;
  return linkedEvidence(requirement, evidence, links).length ? ComplianceStatus.COMPLIANT : ComplianceStatus.PENDING;
}

export function buildComplianceMatrix(requirements, evidence, findings, links = []) {
  return requirements.map(requirement => ({
    requirement: requirement.id,
    text: requirement.text,
    document: requirement.document,
    section: requirement.section,
    level: requirement.level,
    responsibleParty: requirement.responsibleParty,
    acceptingAuthority: requirement.acceptingAuthority,
    requiredEvidence: requirement.requiredEvidence,
    status: statusForRequirement(requirement, evidence, links, findings),
    evidence: linkedEvidence(requirement, evidence, links).map(item => item.id),
    findings: findings.filter(item => item.requirement === requirement.id).map(item => item.type)
  }));
}

export function generateCorrectiveActions(findings) {
  const actions = {
    [ComplianceFindingType.MISSING_EVIDENCE]: "Obtain and attach traceable evidence demonstrating compliance.",
    [ComplianceFindingType.PARTIAL_COMPLIANCE]: "Strengthen the compliance record with complete and scope-specific evidence.",
    [ComplianceFindingType.NON_COMPLIANT]: "Correct the failed condition and obtain successful reinspection or retest evidence.",
    [ComplianceFindingType.CONFLICTING_EVIDENCE]: "Resolve contradictory evidence and identify the controlling final result.",
    [ComplianceFindingType.DUPLICATE_EVIDENCE]: "Consolidate duplicate records while preserving source history.",
    [ComplianceFindingType.MISSING_TEST]: "Perform the required test and attach the signed test report.",
    [ComplianceFindingType.MISSING_INSPECTION]: "Perform the required inspection and attach the inspection record.",
    [ComplianceFindingType.MISSING_SUBMITTAL]: "Provide the required submittal and approval status.",
    [ComplianceFindingType.MISSING_APPROVAL]: "Obtain written approval from the designated authority.",
    [ComplianceFindingType.MISSING_CERTIFICATE]: "Provide the required certificate or certification record.",
    [ComplianceFindingType.MISSING_CLOSEOUT]: "Complete the closeout package and link all turnover documents.",
    [ComplianceFindingType.MISSING_TRAINING]: "Complete required training and provide attendance or completion records.",
    [ComplianceFindingType.MISSING_RESPONSIBLE_PARTY]: "Assign the party responsible for satisfying the requirement.",
    [ComplianceFindingType.MISSING_ACCEPTANCE_AUTHORITY]: "Identify the party authorized to approve or accept the work.",
    [ComplianceFindingType.WAIVER_NOT_DOCUMENTED]: "Attach the signed waiver, variance, or exception approval.",
    [ComplianceFindingType.ORPHAN_EVIDENCE]: "Link the evidence to the applicable requirement or remove it from the compliance set.",
    [ComplianceFindingType.UNDATED_EVIDENCE]: "Add the date of inspection, test, approval, or record creation.",
    [ComplianceFindingType.UNATTRIBUTED_EVIDENCE]: "Identify the person or organization responsible for the evidence record."
  };
  return findings.map(item => ({
    findingId: item.id,
    requirement: item.requirement ?? null,
    priority: item.severity === ComplianceSeverity.CRITICAL ? "immediate" : item.severity === ComplianceSeverity.HIGH ? "high" : item.severity === ComplianceSeverity.MEDIUM ? "medium" : "low",
    action: actions[item.type] ?? "Review and resolve the compliance finding.",
    verification: "Re-run compliance reasoning and confirm the finding is cleared with traceable evidence."
  }));
}

export function executiveComplianceSummary(requirements, evidence, findings, links = []) {
  const scorecard = scoreCompliance(requirements, findings);
  const bySeverity = {};
  const byStatus = {};
  for (const item of findings) bySeverity[item.severity] = (bySeverity[item.severity] || 0) + 1;
  for (const row of buildComplianceMatrix(requirements, evidence, findings, links)) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  return {
    totals: { requirements: requirements.length, evidence: evidence.length, links: links.length, findings: findings.length },
    complianceScore: scorecard.score,
    compliant: scorecard.compliant,
    partial: scorecard.partial,
    nonCompliant: scorecard.nonCompliant,
    status: bySeverity[ComplianceSeverity.CRITICAL] ? "critical" : bySeverity[ComplianceSeverity.HIGH] ? "attention_required" : findings.length ? "review_required" : "compliant",
    bySeverity,
    byStatus
  };
}

export function finalizeComplianceResult(result, requirements, evidence, findings, links = []) {
  const summary = executiveComplianceSummary(requirements, evidence, findings, links);
  const matrix = buildComplianceMatrix(requirements, evidence, findings, links);
  const correctiveActions = generateCorrectiveActions(findings);
  result.metrics.complianceScore = summary.complianceScore;
  result.metrics.requirementCount = requirements.length;
  result.metrics.evidenceCount = evidence.length;
  result.metrics.complianceFindingCount = findings.length;
  result.compliance = { requirements, evidence, links, findings, matrix, correctiveActions, summary };
  result.complianceSummary = summary;
  result.complianceMatrix = matrix;
  result.correctiveActions = correctiveActions;
  return result.compliance;
}

function graphNodes(graph) {
  if (typeof graph.findNodes === "function") return graph.findNodes({});
  if (typeof graph.getNodes === "function") return graph.getNodes();
  if (graph.nodes instanceof Map) return [...graph.nodes.values()];
  if (Array.isArray(graph.nodes)) return graph.nodes;
  return [];
}

export class ComplianceRule extends ReasoningRule {
  constructor(options = {}) {
    super(options.name || "Compliance Rule", options.priority ?? 70);
    this.options = {
      minimumRequirementConfidence: options.minimumRequirementConfidence ?? 0.7,
      minimumEvidenceConfidence: options.minimumEvidenceConfidence ?? 0.65,
      correlationThreshold: options.correlationThreshold ?? 0.32,
      includeNodeTypes: options.includeNodeTypes ?? null
    };
  }

  appliesTo(graph) {
    return Boolean(graph) && (typeof graph.findNodes === "function" || typeof graph.getNodes === "function" || graph.nodes instanceof Map || Array.isArray(graph.nodes));
  }

  execute(graph, result) {
    const nodes = graphNodes(graph).filter(node => !this.options.includeNodeTypes || this.options.includeNodeTypes.includes(lower(node.type)));
    const requirements = [];
    const evidence = [];

    for (const node of nodes) {
      requirements.push(...extractComplianceRequirements(node).filter(item => item.confidence >= this.options.minimumRequirementConfidence));
      evidence.push(...extractEvidence(node).filter(item => item.confidence >= this.options.minimumEvidenceConfidence));
    }

    const links = correlateRequirements(requirements, evidence, this.options.correlationThreshold);
    const findings = [];
    for (const requirement of requirements) findings.push(...analyzeRequirement(requirement, evidence, links));
    findings.push(...detectDuplicateEvidence(evidence));
    findings.push(...detectConflictingEvidence(evidence));
    findings.push(...detectEvidenceQuality(evidence, links));

    const numbered = findings.map((item, index) => ({
      id: `compliance-finding-${index + 1}`,
      governingNodeId: requirements.find(requirement => requirement.id === item.requirement)?.sourceNode ?? null,
      ...item
    }));

    const compliance = finalizeComplianceResult(result, requirements, evidence, numbered, links);
    for (const item of numbered) {
      result.addFinding(item);
      result.addExplanation({
        findingId: item.id,
        title: item.title,
        text: item.explanation,
        evidence: item.evidence
      });
    }
    for (const action of compliance.correctiveActions) result.addRecommendation(action);
    return compliance;
  }
}

export function registerComplianceRule(reasoner, options = {}) {
  if (!reasoner || typeof reasoner.registerRule !== "function") throw new TypeError("reasoner must provide registerRule().");
  reasoner.registerRule(new ComplianceRule(options));
  return reasoner;
}

export default ComplianceRule;
