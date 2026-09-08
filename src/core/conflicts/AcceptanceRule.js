/**
 * ============================================================================
 * Mission Companion
 * Conflict Engine
 *
 * File:
 *     AcceptanceRule.js
 *
 * Commit:
 *     6
 *
 * Purpose:
 *     Detects conflicting, incomplete, ambiguous, or improperly sequenced
 *     acceptance criteria across requirements and project documents.
 * ============================================================================
 */

import { ReasoningRule } from "./ConflictReasoner.js";
import { normalizedText as normalize } from "../../data-model.js";

export const AcceptanceAction = Object.freeze({
    ACCEPT: "accept",
    APPROVE: "approve",
    VERIFY: "verify",
    INSPECT: "inspect",
    TEST: "test",
    CERTIFY: "certify",
    WITNESS: "witness",
    SIGN_OFF: "sign_off",
    COMPLETE: "complete",
    CLOSE: "close",
    RELEASE: "release",
    COMMISSION: "commission",
    AUTHORIZE: "authorize",
    VALIDATE: "validate",
    DOCUMENT: "document",
    OTHER: "other"
});

export const AcceptanceStatus = Object.freeze({
    REQUIRED: "required",
    CONDITIONAL: "conditional",
    OPTIONAL: "optional",
    PROHIBITED: "prohibited",
    UNKNOWN: "unknown"
});

export const AcceptanceConflictType = Object.freeze({
    CONTRADICTORY_CRITERIA: "contradictory_criteria",
    DIFFERENT_ACCEPTOR: "different_acceptor",
    MISSING_EVIDENCE: "missing_evidence",
    MISSING_THRESHOLD: "missing_threshold",
    IMPOSSIBLE_SEQUENCE: "impossible_sequence",
    DUPLICATE_GATE: "duplicate_gate",
    UNSATISFIED_PREREQUISITE: "unsatisfied_prerequisite",
    AMBIGUOUS_GATE: "ambiguous_gate",
    CONDITIONAL_MISMATCH: "conditional_mismatch",
    NO_CONFLICT: "no_conflict"
});

const ACTION_PATTERNS = [
    [AcceptanceAction.ACCEPT, /\baccept(?:s|ed|ing|ance)?\b/i],
    [AcceptanceAction.APPROVE, /\bapprov(?:e|es|ed|ing|al)\b/i],
    [AcceptanceAction.VERIFY, /\bverif(?:y|ies|ied|ication)\b/i],
    [AcceptanceAction.INSPECT, /\binspect(?:s|ed|ing|ion)?\b/i],
    [AcceptanceAction.TEST, /\btest(?:s|ed|ing)?\b/i],
    [AcceptanceAction.CERTIFY, /\bcertif(?:y|ies|ied|ication)\b/i],
    [AcceptanceAction.WITNESS, /\bwitness(?:es|ed|ing)?\b/i],
    [AcceptanceAction.SIGN_OFF, /\bsign[-\s]?off\b|\bsigned\s+off\b/i],
    [AcceptanceAction.COMPLETE, /\bcomplet(?:e|es|ed|ing|ion)\b/i],
    [AcceptanceAction.CLOSE, /\bclos(?:e|es|ed|ing|ure)\b/i],
    [AcceptanceAction.RELEASE, /\breleas(?:e|es|ed|ing)\b/i],
    [AcceptanceAction.COMMISSION, /\bcommission(?:s|ed|ing)?\b/i],
    [AcceptanceAction.AUTHORIZE, /\bauthoriz(?:e|es|ed|ing|ation)\b/i],
    [AcceptanceAction.VALIDATE, /\bvalidat(?:e|es|ed|ing|ion)\b/i],
    [AcceptanceAction.DOCUMENT, /\bdocument(?:s|ed|ing|ation)?\b/i]
];

const STATUS_PATTERNS = [
    [AcceptanceStatus.PROHIBITED, /\bshall\s+not\b|\bmust\s+not\b|\bnot\s+acceptable\b/i],
    [AcceptanceStatus.CONDITIONAL, /\bif\b|\bwhen\b|\bprovided\s+that\b|\bsubject\s+to\b|\bafter\b|\bupon\b/i],
    [AcceptanceStatus.OPTIONAL, /\bmay\b|\boptional\b|\bat\s+the\s+discretion\b/i],
    [AcceptanceStatus.REQUIRED, /\bshall\b|\bmust\b|\brequired\b|\bis\s+to\s+be\b/i]
];

const EVIDENCE_PATTERNS = [
    /\btest\s+report\b/i,
    /\binspection\s+report\b/i,
    /\bcertificate\b/i,
    /\bcertification\b/i,
    /\bcommissioning\s+report\b/i,
    /\bphotograph(?:s|ic)?\b/i,
    /\bphoto\s+documentation\b/i,
    /\bwritten\s+approval\b/i,
    /\bwritten\s+acceptance\b/i,
    /\bsigned\s+record\b/i,
    /\bsign[-\s]?off\b/i,
    /\bas[-\s]?built\b/i,
    /\bsubmittal\b/i,
    /\bchecklist\b/i,
    /\bfield\s+report\b/i,
    /\bmanufacturer(?:'s)?\s+letter\b/i,
    /\bwarranty\b/i,
    /\bcloseout\s+document\b/i
];

const THRESHOLD_PATTERNS = [
    /\b\d+(?:\.\d+)?\s*(?:%|percent)\b/i,
    /\bnot\s+less\s+than\b/i,
    /\bnot\s+more\s+than\b/i,
    /\bminimum\b/i,
    /\bmaximum\b/i,
    /\bwithin\s+\d+\b/i,
    /\bzero\s+(?:defects|critical\s+punch|open\s+items)\b/i,
    /\bpass(?:ing)?\s+(?:score|result|criteria)\b/i,
    /\bmeets?\s+(?:the\s+)?requirements\b/i,
    /\bcomplies?\s+with\b/i
];

const PARTY_PATTERNS = [
    ["owner", /\bowner\b|\bowner's\s+representative\b/i],
    ["va", /\bveterans\s+affairs\b|\bdepartment\s+of\s+veterans\s+affairs\b|\bva\b/i],
    ["cor", /\bcontracting\s+officer(?:'s)?\s+representative\b|\bcor\b/i],
    ["contracting_officer", /\bcontracting\s+officer\b/i],
    ["owner_qc", /\bowner(?:'s)?\s+(?:qa|qc|quality\s+(?:assurance|control)|inspector)\b/i],
    ["cqc", /\bcqc\b|\bcontractor(?:'s)?\s+quality\s+control\b/i],
    ["oit", /\boit\b|\boffice\s+of\s+information\s+(?:and\s+)?technology\b/i],
    ["ahj", /\bauthority\s+having\s+jurisdiction\b|\bahj\b/i],
    ["architect", /\barchitect\b/i],
    ["engineer", /\bengineer\b|\bengineer\s+of\s+record\b/i],
    ["manufacturer", /\bmanufacturer\b/i],
    ["testing_agency", /\bindependent\s+testing\s+agency\b|\btesting\s+agency\b/i],
    ["contractor", /\bcontractor\b|\bprime\s+contractor\b|\bgeneral\s+contractor\b/i]
];

const NEGATION_PATTERNS = [
    /\bnot\s+required\b/i,
    /\bwithout\s+approval\b/i,
    /\bshall\s+not\s+be\s+accepted\b/i,
    /\bnot\s+acceptable\b/i,
    /\bdoes\s+not\s+constitute\s+acceptance\b/i
];

function lower(value) {
    return normalize(value).toLowerCase();
}

function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function tokenize(value) {
    return new Set(
        lower(value)
            .split(/[^a-z0-9]+/)
            .filter(token => token.length > 2)
    );
}

function similarity(left, right) {
    const a = tokenize(left);
    const b = tokenize(right);

    if (a.size === 0 && b.size === 0) {
        return 1;
    }

    const intersection = [...a].filter(token => b.has(token)).length;
    const union = new Set([...a, ...b]).size;

    return union === 0 ? 0 : intersection / union;
}

function normalizeNodeType(value) {
    return normalize(value).toLowerCase();
}

function stableNodeArray(nodes) {
    const result = [];
    const seen = new Set();

    for (const node of nodes || []) {
        if (!node) {
            continue;
        }

        const nodeId = node?.id ?? node?.nodeId ?? null;
        const marker = nodeId != null
            ? `id:${nodeId}`
            : `title:${normalize(node?.title || node?.name || "")}`;

        if (seen.has(marker)) {
            continue;
        }

        seen.add(marker);
        result.push(node);
    }

    return result;
}

function readNodeValue(node, key) {
    if (!node) {
        return undefined;
    }

    if (node[key] !== undefined && node[key] !== null && node[key] !== "") {
        return node[key];
    }

    if (node.metadata && node.metadata[key] !== undefined && node.metadata[key] !== null && node.metadata[key] !== "") {
        return node.metadata[key];
    }

    return undefined;
}

function buildCandidateFilter(context = {}) {
    const filter = {};
    const criteria = context?.criteria && typeof context.criteria === "object"
        ? context.criteria
        : {};

    for (const key of ["document", "section", "source", "specification", "responsibility", "type", "nodeId"]) {
        if (criteria[key] !== undefined && criteria[key] !== null && criteria[key] !== "") {
            filter[key] = criteria[key];
        }
    }

    if (context?.nodes && Array.isArray(context.nodes)) {
        filter.nodeIds = context.nodes
            .map(node => node?.id)
            .filter(Boolean)
            .slice(0, 10);
    } else if (context?.nodeIds && Array.isArray(context.nodeIds)) {
        filter.nodeIds = context.nodeIds.filter(Boolean).slice(0, 10);
    }

    return filter;
}

function resolveCandidateNodes(graph, context = {}, nodeTypes = []) {
    const allowedTypes = (nodeTypes || [])
        .map(value => normalizeNodeType(value))
        .filter(Boolean);

    const filterByTypes = nodes => {
        if (!allowedTypes.length) {
            return stableNodeArray(nodes);
        }

        return stableNodeArray(nodes.filter(node => allowedTypes.includes(normalizeNodeType(node?.type))));
    };

    if (graph && Array.isArray(context?.nodes) && context.nodes.length > 0) {
        return filterByTypes(context.nodes);
    }

    const nodeIds = Array.isArray(context?.nodeIds)
        ? context.nodeIds
        : (context?.nodeId ? [context.nodeId] : []);

    if (nodeIds.length > 0) {
        const resolved = [];
        const seen = new Set();

        for (const nodeId of nodeIds) {
            if (!nodeId) {
                continue;
            }

            const node = graph?.getNode
                ? graph.getNode(nodeId)
                : null;
            const fallbackNode = graph?.nodes instanceof Map
                ? graph.nodes.get(nodeId)
                : null;
            const candidate = node || fallbackNode || null;

            if (!candidate || seen.has(candidate.id)) {
                continue;
            }

            seen.add(candidate.id);
            resolved.push(candidate);
        }

        if (resolved.length > 0) {
            return filterByTypes(resolved);
        }
    }

    const criteria = context?.criteria && typeof context.criteria === "object"
        ? { ...context.criteria }
        : {};

    for (const key of ["document", "section", "source", "specification", "responsibility", "type", "nodeId"]) {
        if (context?.[key] !== undefined && context?.[key] !== null && context?.[key] !== "") {
            criteria[key] = context[key];
        }
    }

    if (Object.keys(criteria).length > 0) {
        if (graph && typeof graph.query === "function") {
            try {
                const queryCriteria = { ...criteria };

                if (queryCriteria.nodeId !== undefined) {
                    queryCriteria.id = queryCriteria.nodeId;
                    delete queryCriteria.nodeId;
                }

                const matched = graph.query(queryCriteria);
                if (matched) {
                    return filterByTypes(Array.isArray(matched) ? matched : [...matched]);
                }
            } catch {
                // Fall through to the compatible fallback below.
            }
        }

        const indexedCriteria = [];

        if (criteria.document !== undefined && criteria.document !== null && criteria.document !== "") {
            indexedCriteria.push(["document", graph?.getNodesByDocument]);
        }

        if (criteria.section !== undefined && criteria.section !== null && criteria.section !== "") {
            indexedCriteria.push(["section", graph?.getNodesBySection]);
        }

        if (criteria.source !== undefined && criteria.source !== null && criteria.source !== "") {
            indexedCriteria.push(["source", graph?.getNodesBySource]);
        }

        if (criteria.specification !== undefined && criteria.specification !== null && criteria.specification !== "") {
            indexedCriteria.push(["specification", graph?.getNodesBySpecification]);
        }

        if (criteria.responsibility !== undefined && criteria.responsibility !== null && criteria.responsibility !== "") {
            indexedCriteria.push(["responsibility", graph?.getNodesByResponsibility]);
        }

        if (indexedCriteria.length > 0) {
            let matched = null;

            for (const [, lookup] of indexedCriteria) {
                if (typeof lookup !== "function") {
                    continue;
                }

                const current = lookup.call(graph, criteria["document"] ?? criteria["section"] ?? criteria["source"] ?? criteria["specification"] ?? criteria["responsibility"]);
                const nodes = Array.isArray(current) ? current : [...(current || [])];

                if (!matched) {
                    matched = nodes;
                } else {
                    const matchedIds = new Set(matched.map(node => node?.id).filter(Boolean));
                    matched = nodes.filter(node => matchedIds.has(node?.id));
                }

            }

            if (matched) {
                return filterByTypes(matched);
            }
        }
    }

    if (graph && typeof graph.findNodes === "function") {
        return filterByTypes(graph.findNodes({
            types: nodeTypes
        }));
    }

    return [];
}

function collectGraphEvidence(graph, node) {
    const terms = [];
    const evidence = [];

    if (Array.isArray(node?.evidence)) {
        for (const entry of node.evidence) {
            if (!entry) {
                continue;
            }

            const evidenceValue = entry.id || entry.reference || entry.title || entry.name || entry.type;
            if (evidenceValue) {
                terms.push(String(evidenceValue));
            }
        }
    }

    for (const value of [node?.id, node?.title, node?.text, node?.document, node?.section, node?.source, node?.metadata?.evidence, node?.metadata?.evidenceId]) {
        if (value) {
            terms.push(String(value));
        }
    }

    const seen = new Set();

    for (const term of terms) {
        if (!term || seen.has(term.toLowerCase())) {
            continue;
        }

        seen.add(term.toLowerCase());

        if (graph && typeof graph.getEvidence === "function") {
            try {
                const matches = graph.getEvidence(term) || [];

                for (const match of matches) {
                    const matchValue = match?.id || match?.reference || match?.name || match?.title || match?.text;
                    if (!matchValue) {
                        continue;
                    }

                    const normalizedValue = normalize(matchValue);
                    if (!normalizedValue || seen.has(normalizedValue.toLowerCase())) {
                        continue;
                    }

                    seen.add(normalizedValue.toLowerCase());
                    evidence.push(normalizedValue);
                }
            } catch {
                // Ignore lookup failures and fall back below.
            }
        }
    }

    return unique(evidence);
}

function applyFindingMetadata(finding, rule, context = {}, candidateNodes = []) {
    if (!finding) {
        return finding;
    }

    const ruleName = rule?.name || rule?.constructor?.name || "AcceptanceRule";
    const criteria = context?.criteria && typeof context.criteria === "object"
        ? context.criteria
        : {};
    const candidateFilter = {};

    for (const key of ["document", "section", "source", "specification", "responsibility", "type", "nodeId"]) {
        if (criteria[key] !== undefined && criteria[key] !== null && criteria[key] !== "") {
            candidateFilter[key] = criteria[key];
        }
    }

    if (Array.isArray(context?.nodeIds) && context.nodeIds.length > 0) {
        candidateFilter.nodeIds = context.nodeIds.filter(Boolean).slice(0, 10);
    } else if (Array.isArray(context?.nodes) && context.nodes.length > 0) {
        candidateFilter.nodeIds = context.nodes.map(node => node?.id).filter(Boolean).slice(0, 10);
    }

    const isFiltered = Boolean(
        context?.filtered ||
        context?.nodes ||
        context?.nodeIds ||
        (criteria && Object.keys(criteria).length > 0)
    );

    const graphEvidenceIds = unique([
        ...(finding.graphEvidenceIds || []),
        ...(finding.evidence || [])
            .map(entry => entry?.id || entry?.reference || entry?.title || entry?.name || entry?.type)
            .filter(Boolean)
    ]);

    finding.rule = finding.rule || ruleName;
    finding.ruleVersion = finding.ruleVersion || "6";
    finding.executionContext = {
        filtered: isFiltered,
        criteria: candidateFilter,
        candidateNodeCount: (candidateNodes || []).length,
        candidateNodeIds: (candidateNodes || []).map(node => node?.id).filter(Boolean)
    };
    finding.metadata = {
        ...(finding.metadata || {}),
        candidateFilter,
        graphEvidenceIds,
        filtered: isFiltered,
        candidateNodeCount: (candidateNodes || []).length
    };
    finding.trace = Array.isArray(finding.trace)
        ? [...finding.trace]
        : [];
    finding.trace.push({
        rule: ruleName,
        filtered: isFiltered,
        candidateNodeCount: (candidateNodes || []).length,
        candidateFilter
    });

    return finding;
}

function findingIdentitySignature(finding) {
    const nodeIds = unique((finding?.nodeIds || [finding?.nodeId]).filter(Boolean))
        .map(value => normalize(String(value)))
        .sort();

    return [
        nodeIds.join("|"),
        normalize(finding?.subtype),
        normalize(finding?.subject),
        normalize(finding?.rule || finding?.ruleName)
    ].join("::");
}

function identifyActions(text) {
    const actions = [];

    for (const [action, pattern] of ACTION_PATTERNS) {
        if (pattern.test(text)) {
            actions.push(action);
        }
    }

    return unique(actions);
}

function identifyStatus(text) {
    for (const [status, pattern] of STATUS_PATTERNS) {
        if (pattern.test(text)) {
            return status;
        }
    }

    return AcceptanceStatus.UNKNOWN;
}

function identifyParties(text) {
    const parties = [];

    for (const [party, pattern] of PARTY_PATTERNS) {
        if (pattern.test(text)) {
            parties.push(party);
        }
    }

    return unique(parties);
}

function extractEvidenceTypes(text) {
    return unique(
        EVIDENCE_PATTERNS
            .filter(pattern => pattern.test(text))
            .map(pattern => pattern.source)
    );
}

function hasThreshold(text) {
    return THRESHOLD_PATTERNS.some(pattern => pattern.test(text));
}

function hasNegation(text) {
    return NEGATION_PATTERNS.some(pattern => pattern.test(text));
}

function extractSubject(text) {
    const stopWords = /\b(?:shall|must|required|approved|accepted|verified|tested|inspected|certified|completed|released|commissioned)\b/i;
    const match = stopWords.exec(text);

    if (!match) {
        return normalize(text).slice(0, 180);
    }

    const prefix = text.slice(0, match.index);
    const suffix = text.slice(match.index + match[0].length);

    const candidate = normalize(prefix || suffix);
    return candidate.slice(0, 180);
}

function extractPrerequisites(text) {
    const patterns = [
        /\bafter\s+([^.;]+)/ig,
        /\bupon\s+completion\s+of\s+([^.;]+)/ig,
        /\bsubject\s+to\s+([^.;]+)/ig,
        /\bprovided\s+that\s+([^.;]+)/ig,
        /\bwhen\s+([^.;]+)/ig,
        /\bonce\s+([^.;]+)/ig
    ];

    const prerequisites = [];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            prerequisites.push(normalize(match[1]));
        }
    }

    return unique(prerequisites);
}

function inferDocumentAuthority(node) {
    const value = lower(
        node.metadata?.documentType ||
        node.metadata?.sourceType ||
        node.type
    );

    const ranking = [
        ["contract", 100],
        ["specification", 90],
        ["drawing", 80],
        ["approved_submittal", 75],
        ["submittal", 70],
        ["directive", 65],
        ["sop", 60],
        ["field_report", 50],
        ["meeting_minute", 45],
        ["email", 40],
        ["note", 20]
    ];

    for (const [keyword, score] of ranking) {
        if (value.includes(keyword)) {
            return score;
        }
    }

    return Number(node.metadata?.authorityScore) || 30;
}

export function extractAcceptanceCriteria(node, graph = null) {
    const text = normalize(
        [
            node.title,
            node.text,
            node.metadata?.requirement,
            node.metadata?.statement,
            node.metadata?.acceptance
        ]
            .filter(Boolean)
            .join(". ")
    );

    if (!text) {
        return null;
    }

    const actions = identifyActions(text);

    if (actions.length === 0) {
        return null;
    }

    const status = identifyStatus(text);
    const graphEvidenceIds = collectGraphEvidence(graph, node);
    const evidence = graphEvidenceIds.length > 0
        ? graphEvidenceIds
        : extractEvidenceTypes(text);
    const parties = identifyParties(text);
    const prerequisites = extractPrerequisites(text);
    const subject = extractSubject(text);

    let confidence = 0.35;

    if (actions.length > 0) confidence += 0.2;
    if (parties.length > 0) confidence += 0.15;
    if (status !== AcceptanceStatus.UNKNOWN) confidence += 0.1;
    if (evidence.length > 0) confidence += 0.1;
    if (hasThreshold(text)) confidence += 0.1;

    return {
        nodeId: node.id,
        node,
        document: readNodeValue(node, "document"),
        section: readNodeValue(node, "section"),
        source: readNodeValue(node, "source"),
        specification: readNodeValue(node, "specification") || readNodeValue(node, "metadata")?.specification,
        responsibility: readNodeValue(node, "responsibility") || readNodeValue(node, "metadata")?.responsibility,
        text,
        subject,
        actions,
        status,
        parties,
        evidence,
        graphEvidenceIds,
        prerequisites,
        thresholdPresent: hasThreshold(text),
        negated: hasNegation(text),
        confidence: clamp(confidence)
    };
}

function criteriaPairKey(left, right) {
    return [left.nodeId, right.nodeId]
        .sort()
        .join("|");
}

function actionOverlap(left, right) {
    const a = new Set(left.actions);
    const b = new Set(right.actions);

    return [...a].some(action => b.has(action));
}

function differentAcceptors(left, right) {
    if (left.parties.length === 0 || right.parties.length === 0) {
        return false;
    }

    return !left.parties.some(party => right.parties.includes(party));
}

export function compareAcceptanceCriteria(left, right, options = {}) {
    const minimumSubjectSimilarity =
        options.minimumSubjectSimilarity ?? 0.4;

    const subjectSimilarity = similarity(
        left.subject || left.text,
        right.subject || right.text
    );

    if (subjectSimilarity < minimumSubjectSimilarity) {
        return {
            conflict: false,
            type: AcceptanceConflictType.NO_CONFLICT,
            confidence: 0,
            subjectSimilarity,
            reason: "Acceptance criteria address different subjects."
        };
    }

    if (
        left.negated !== right.negated &&
        actionOverlap(left, right)
    ) {
        return {
            conflict: true,
            type: AcceptanceConflictType.CONTRADICTORY_CRITERIA,
            confidence: clamp(
                0.65 +
                0.2 * subjectSimilarity +
                0.1 * Math.min(left.confidence, right.confidence)
            ),
            subjectSimilarity,
            reason:
                "One source requires or permits acceptance while another denies it."
        };
    }

    if (
        left.status === AcceptanceStatus.REQUIRED &&
        right.status === AcceptanceStatus.PROHIBITED
    ) {
        return {
            conflict: true,
            type: AcceptanceConflictType.CONTRADICTORY_CRITERIA,
            confidence: clamp(0.75 + 0.2 * subjectSimilarity),
            subjectSimilarity,
            reason:
                "One source requires the acceptance gate while another prohibits it."
        };
    }

    if (
        right.status === AcceptanceStatus.REQUIRED &&
        left.status === AcceptanceStatus.PROHIBITED
    ) {
        return {
            conflict: true,
            type: AcceptanceConflictType.CONTRADICTORY_CRITERIA,
            confidence: clamp(0.75 + 0.2 * subjectSimilarity),
            subjectSimilarity,
            reason:
                "One source requires the acceptance gate while another prohibits it."
        };
    }

    if (
        actionOverlap(left, right) &&
        differentAcceptors(left, right)
    ) {
        return {
            conflict: true,
            type: AcceptanceConflictType.DIFFERENT_ACCEPTOR,
            confidence: clamp(
                0.5 +
                0.25 * subjectSimilarity +
                0.1 * Math.min(left.confidence, right.confidence)
            ),
            subjectSimilarity,
            reason:
                "Different parties are assigned final acceptance authority for the same subject."
        };
    }

    if (
        left.status !== right.status &&
        (
            left.status === AcceptanceStatus.CONDITIONAL ||
            right.status === AcceptanceStatus.CONDITIONAL
        )
    ) {
        return {
            conflict: true,
            type: AcceptanceConflictType.CONDITIONAL_MISMATCH,
            confidence: clamp(
                0.45 +
                0.25 * subjectSimilarity +
                0.1 * Math.min(left.confidence, right.confidence)
            ),
            subjectSimilarity,
            reason:
                "One acceptance criterion is conditional while the other is unconditional."
        };
    }

    if (
        actionOverlap(left, right) &&
        left.evidence.length === 0 &&
        right.evidence.length > 0
    ) {
        return {
            conflict: true,
            type: AcceptanceConflictType.MISSING_EVIDENCE,
            confidence: clamp(0.5 + 0.2 * subjectSimilarity),
            subjectSimilarity,
            reason:
                "One criterion requires supporting evidence while the other does not identify evidence."
        };
    }

    if (
        actionOverlap(left, right) &&
        right.evidence.length === 0 &&
        left.evidence.length > 0
    ) {
        return {
            conflict: true,
            type: AcceptanceConflictType.MISSING_EVIDENCE,
            confidence: clamp(0.5 + 0.2 * subjectSimilarity),
            subjectSimilarity,
            reason:
                "One criterion requires supporting evidence while the other does not identify evidence."
        };
    }

    if (
        actionOverlap(left, right) &&
        left.thresholdPresent !== right.thresholdPresent
    ) {
        return {
            conflict: true,
            type: AcceptanceConflictType.MISSING_THRESHOLD,
            confidence: clamp(0.45 + 0.2 * subjectSimilarity),
            subjectSimilarity,
            reason:
                "One criterion defines a measurable threshold while the other does not."
        };
    }

    return {
        conflict: false,
        type: AcceptanceConflictType.NO_CONFLICT,
        confidence: 0,
        subjectSimilarity,
        reason:
            "No acceptance conflict was identified."
    };
}

function determineResolution(left, right, comparison) {
    if (!comparison.conflict) {
        return {
            status: "no_resolution_required",
            governingNodeId: null,
            rationale: comparison.reason
        };
    }

    const leftAuthority = inferDocumentAuthority(left.node);
    const rightAuthority = inferDocumentAuthority(right.node);

    if (leftAuthority > rightAuthority) {
        return {
            status: "provisional",
            governingNodeId: left.nodeId,
            overriddenNodeId: right.nodeId,
            rationale:
                "The left source has higher configured document authority."
        };
    }

    if (rightAuthority > leftAuthority) {
        return {
            status: "provisional",
            governingNodeId: right.nodeId,
            overriddenNodeId: left.nodeId,
            rationale:
                "The right source has higher configured document authority."
        };
    }

    if (left.confidence > right.confidence) {
        return {
            status: "provisional",
            governingNodeId: left.nodeId,
            overriddenNodeId: right.nodeId,
            rationale:
                "The left acceptance criterion has higher extraction confidence."
        };
    }

    if (right.confidence > left.confidence) {
        return {
            status: "provisional",
            governingNodeId: right.nodeId,
            overriddenNodeId: left.nodeId,
            rationale:
                "The right acceptance criterion has higher extraction confidence."
        };
    }

    return {
        status: "unresolved",
        governingNodeId: null,
        rationale:
            "Both criteria have equal document authority and extraction confidence."
    };
}

function severityFor(type, confidence) {
    if (
        type === AcceptanceConflictType.CONTRADICTORY_CRITERIA ||
        type === AcceptanceConflictType.IMPOSSIBLE_SEQUENCE
    ) {
        return confidence >= 0.8 ? "critical" : "high";
    }

    if (
        type === AcceptanceConflictType.DIFFERENT_ACCEPTOR ||
        type === AcceptanceConflictType.UNSATISFIED_PREREQUISITE
    ) {
        return confidence >= 0.75 ? "high" : "medium";
    }

    return confidence >= 0.7 ? "medium" : "low";
}

function buildExplanation(left, right, comparison, resolution) {
    const lines = [
        comparison.reason,
        `Left criterion: ${left.actions.join(", ")} by ${left.parties.join(", ") || "unspecified party"}.`,
        `Right criterion: ${right.actions.join(", ")} by ${right.parties.join(", ") || "unspecified party"}.`,
        `Subject similarity: ${(comparison.subjectSimilarity * 100).toFixed(1)}%.`
    ];

    if (resolution.governingNodeId) {
        lines.push(
            `Provisional governing source: ${resolution.governingNodeId}.`
        );
    } else if (resolution.status === "unresolved") {
        lines.push(
            "A formal clarification is required because no source clearly governs."
        );
    }

    return lines.join(" ");
}

export class AcceptanceRule extends ReasoningRule {
    constructor(options = {}) {
        super(
            options.name || "Acceptance Criteria Analysis",
            options.priority ?? 30
        );

        this.options = {
            nodeTypes:
                options.nodeTypes ||
                ["requirement", "specification", "drawing", "document"],
            minimumSubjectSimilarity:
                options.minimumSubjectSimilarity ?? 0.4,
            minimumFindingConfidence:
                options.minimumFindingConfidence ?? 0.55,
            detectPrerequisiteFailures:
                options.detectPrerequisiteFailures ?? true,
            detectAmbiguousCriteria:
                options.detectAmbiguousCriteria ?? true
        };
    }

    appliesTo(graph) {
        return Boolean(
            graph && (
                typeof graph.findNodes === "function" ||
                typeof graph.query === "function" ||
                typeof graph.getNodesByDocument === "function" ||
                typeof graph.getNodesBySection === "function" ||
                typeof graph.getNodesBySource === "function" ||
                typeof graph.getNodesBySpecification === "function" ||
                typeof graph.getNodesByResponsibility === "function"
            )
        );
    }

    execute(graph, result, context = {}) {
        const candidateNodes = resolveCandidateNodes(
            graph,
            context,
            this.options.nodeTypes
        );

        const criteria = candidateNodes
            .map(node => extractAcceptanceCriteria(node, graph))
            .filter(Boolean);

        const seen = new Set();

        for (let i = 0; i < criteria.length; i += 1) {
            for (let j = i + 1; j < criteria.length; j += 1) {
                const left = criteria[i];
                const right = criteria[j];

                if (left.nodeId === right.nodeId) {
                    continue;
                }

                const key = criteriaPairKey(left, right);

                if (seen.has(key)) {
                    continue;
                }

                seen.add(key);

                const comparison = compareAcceptanceCriteria(
                    left,
                    right,
                    {
                        minimumSubjectSimilarity:
                            this.options.minimumSubjectSimilarity
                    }
                );

                if (!comparison.conflict) {
                    continue;
                }

                if (
                    comparison.confidence <
                    this.options.minimumFindingConfidence
                ) {
                    continue;
                }

                const resolution = determineResolution(
                    left,
                    right,
                    comparison
                );

                const finding = {
                    id:
                        `ACC-${left.nodeId}-${right.nodeId}-` +
                        comparison.type,
                    type: "acceptance",
                    subtype: comparison.type,
                    title: "Acceptance criteria conflict detected",
                    severity: severityFor(
                        comparison.type,
                        comparison.confidence
                    ),
                    confidence: comparison.confidence,
                    nodeIds: [left.nodeId, right.nodeId],
                    document: readNodeValue(left.node, "document") || readNodeValue(right.node, "document"),
                    section: readNodeValue(left.node, "section") || readNodeValue(right.node, "section"),
                    source: readNodeValue(left.node, "source") || readNodeValue(right.node, "source"),
                    specification: readNodeValue(left.node, "specification") || readNodeValue(right.node, "specification") || readNodeValue(left.node, "metadata")?.specification || readNodeValue(right.node, "metadata")?.specification,
                    responsibility: readNodeValue(left.node, "responsibility") || readNodeValue(right.node, "responsibility") || readNodeValue(left.node, "metadata")?.responsibility || readNodeValue(right.node, "metadata")?.responsibility,
                    subject:
                        left.subject ||
                        right.subject ||
                        "unspecified",
                    actions: unique([
                        ...left.actions,
                        ...right.actions
                    ]),
                    acceptors: unique([
                        ...left.parties,
                        ...right.parties
                    ]),
                    evidence: [
                        {
                            nodeId: left.nodeId,
                            text: left.text,
                            actions: left.actions,
                            parties: left.parties,
                            evidenceTypes: left.evidence,
                            prerequisites: left.prerequisites,
                            confidence: left.confidence
                        },
                        {
                            nodeId: right.nodeId,
                            text: right.text,
                            actions: right.actions,
                            parties: right.parties,
                            evidenceTypes: right.evidence,
                            prerequisites: right.prerequisites,
                            confidence: right.confidence
                        }
                    ],
                    graphEvidenceIds: unique([
                        ...(left.graphEvidenceIds || []),
                        ...(right.graphEvidenceIds || [])
                    ]),
                    resolution,
                    explanation: buildExplanation(
                        left,
                        right,
                        comparison,
                        resolution
                    )
                };

                const duplicateKey = findingIdentitySignature(finding);
                const duplicate = result.findings.some(existing => findingIdentitySignature(existing) === duplicateKey);

                if (duplicate) {
                    result.metrics.duplicateFindingsRemoved += 1;
                    continue;
                }

                applyFindingMetadata(finding, this, context, candidateNodes);
                result.addFinding(finding);
                result.addExplanation({
                    findingId: finding.id,
                    text: finding.explanation
                });
                result.addRecommendation(
                    this.buildRecommendation(finding)
                );
            }
        }

        if (this.options.detectAmbiguousCriteria) {
            this.detectAmbiguousCriteria(criteria, result, context, candidateNodes);
        }

        if (this.options.detectPrerequisiteFailures) {
            this.detectPrerequisiteFailures(
                graph,
                criteria,
                result,
                context,
                candidateNodes
            );
        }
    }

    detectAmbiguousCriteria(criteria, result, context = {}, candidateNodes = []) {
        for (const criterion of criteria) {
            const missingAcceptor =
                criterion.parties.length === 0;

            const missingEvidence =
                criterion.evidence.length === 0;

            const missingThreshold =
                !criterion.thresholdPresent;

            const required =
                criterion.status === AcceptanceStatus.REQUIRED ||
                criterion.status === AcceptanceStatus.CONDITIONAL;

            if (
                !required ||
                (!missingAcceptor &&
                 !missingEvidence &&
                 !missingThreshold)
            ) {
                continue;
            }

            const ambiguity = [];

            if (missingAcceptor) {
                ambiguity.push("accepting authority");
            }

            if (missingEvidence) {
                ambiguity.push("required evidence");
            }

            if (missingThreshold) {
                ambiguity.push("measurable threshold");
            }

            const finding = {
                id: `ACC-AMBIGUOUS-${criterion.nodeId}`,
                type: "acceptance",
                subtype: AcceptanceConflictType.AMBIGUOUS_GATE,
                title: "Acceptance gate is incomplete or ambiguous",
                severity:
                    ambiguity.length >= 2
                        ? "medium"
                        : "low",
                confidence: clamp(
                    0.55 + ambiguity.length * 0.1
                ),
                nodeIds: [criterion.nodeId],
                document: criterion.document,
                section: criterion.section,
                source: criterion.source,
                specification: criterion.specification,
                responsibility: criterion.responsibility,
                subject: criterion.subject,
                actions: criterion.actions,
                acceptors: criterion.parties,
                evidence: [
                    {
                        nodeId: criterion.nodeId,
                        text: criterion.text,
                        missing: ambiguity
                    }
                ],
                graphEvidenceIds: criterion.graphEvidenceIds || [],
                resolution: {
                    status: "unresolved",
                    governingNodeId: null,
                    rationale:
                        "The criterion must be clarified before it can function as a reliable acceptance gate."
                },
                explanation:
                    `The acceptance criterion does not clearly identify ${ambiguity.join(", ")}.`
            };

            const duplicateKey = findingIdentitySignature(finding);
            const duplicate = result.findings.some(existing => findingIdentitySignature(existing) === duplicateKey);

            if (duplicate) {
                result.metrics.duplicateFindingsRemoved += 1;
                continue;
            }

            applyFindingMetadata(finding, this, context, candidateNodes);
            result.addFinding(finding);
            result.addExplanation({
                findingId: finding.id,
                text: finding.explanation
            });
            result.addRecommendation(
                this.buildRecommendation(finding)
            );
        }
    }

    detectPrerequisiteFailures(graph, criteria, result, context = {}, candidateNodes = []) {
        const byNode = new Map(
            criteria.map(criterion => [
                criterion.nodeId,
                criterion
            ])
        );

        for (const criterion of criteria) {
            if (criterion.prerequisites.length === 0) {
                continue;
            }

            const incoming = graph.getIncoming(
                criterion.nodeId,
                {
                    edgeTypes: [
                        "requires",
                        "depends_on",
                        "precedes"
                    ]
                }
            );

            if (incoming.length > 0) {
                continue;
            }

            const finding = {
                id: `ACC-PREREQ-${criterion.nodeId}`,
                type: "acceptance",
                subtype:
                    AcceptanceConflictType.UNSATISFIED_PREREQUISITE,
                title:
                    "Acceptance criterion references prerequisites that are not represented in the graph",
                severity: "medium",
                confidence: 0.72,
                nodeIds: [criterion.nodeId],
                document: criterion.document,
                section: criterion.section,
                source: criterion.source,
                specification: criterion.specification,
                responsibility: criterion.responsibility,
                subject: criterion.subject,
                actions: criterion.actions,
                acceptors: criterion.parties,
                evidence: [
                    {
                        nodeId: criterion.nodeId,
                        text: criterion.text,
                        prerequisites: criterion.prerequisites
                    }
                ],
                graphEvidenceIds: criterion.graphEvidenceIds || [],
                resolution: {
                    status: "unresolved",
                    governingNodeId: null,
                    rationale:
                        "Prerequisite nodes or dependency edges must be created before the acceptance sequence can be validated."
                },
                explanation:
                    `The criterion depends on ${criterion.prerequisites.join("; ")}, but no prerequisite relationship is represented in the graph.`
            };

            const duplicateKey = findingIdentitySignature(finding);
            const duplicate = result.findings.some(existing => findingIdentitySignature(existing) === duplicateKey);

            if (duplicate) {
                result.metrics.duplicateFindingsRemoved += 1;
                continue;
            }

            applyFindingMetadata(finding, this, context, candidateNodes);
            result.addFinding(finding);
            result.addExplanation({
                findingId: finding.id,
                text: finding.explanation
            });
            result.addRecommendation(
                this.buildRecommendation(finding)
            );
        }

        void byNode;
    }

    buildRecommendation(finding) {
        if (
            finding.subtype ===
            AcceptanceConflictType.DIFFERENT_ACCEPTOR
        ) {
            return {
                findingId: finding.id,
                priority: "high",
                action:
                    "Identify the party with final acceptance authority and distinguish review, witness, verification, and approval roles.",
                verification:
                    "Confirm the authority against the contract, specification, and delegated authority records."
            };
        }

        if (
            finding.subtype ===
            AcceptanceConflictType.MISSING_EVIDENCE
        ) {
            return {
                findingId: finding.id,
                priority: "medium",
                action:
                    "Define the documentary evidence required to demonstrate acceptance.",
                verification:
                    "Add the evidence requirement to the checklist, closeout register, or acceptance matrix."
            };
        }

        if (
            finding.subtype ===
            AcceptanceConflictType.MISSING_THRESHOLD
        ) {
            return {
                findingId: finding.id,
                priority: "medium",
                action:
                    "Define a measurable acceptance threshold.",
                verification:
                    "Use the governing specification, code, test standard, or approved submittal to establish the threshold."
            };
        }

        if (
            finding.subtype ===
            AcceptanceConflictType.UNSATISFIED_PREREQUISITE
        ) {
            return {
                findingId: finding.id,
                priority: "high",
                action:
                    "Create and verify prerequisite relationships before evaluating the acceptance gate.",
                verification:
                    "Confirm each prerequisite is complete and supported by evidence."
            };
        }

        if (
            finding.subtype ===
            AcceptanceConflictType.AMBIGUOUS_GATE
        ) {
            return {
                findingId: finding.id,
                priority: "medium",
                action:
                    "Clarify the accepting authority, evidence, and measurable pass/fail criteria.",
                verification:
                    "Record the clarified acceptance gate in a controlled project document."
            };
        }

        if (
            finding.resolution?.status === "provisional"
        ) {
            return {
                findingId: finding.id,
                priority:
                    finding.severity === "critical"
                        ? "immediate"
                        : "high",
                action:
                    `Apply ${finding.resolution.governingNodeId} provisionally and obtain formal clarification.`,
                verification:
                    "Document the decision through an RFI, directive, meeting record, or approved acceptance matrix."
            };
        }

        return {
            findingId: finding.id,
            priority:
                finding.severity === "critical"
                    ? "immediate"
                    : "high",
            action:
                "Escalate the conflicting acceptance criteria for formal determination.",
            verification:
                "Do not close or release the work until the controlling acceptance requirement is established."
        };
    }
}

export function registerAcceptanceRule(
    reasoner,
    options = {}
) {
    if (
        !reasoner ||
        typeof reasoner.registerRule !== "function"
    ) {
        throw new TypeError(
            "reasoner must provide registerRule()."
        );
    }

    reasoner.registerRule(
        new AcceptanceRule(options)
    );

    return reasoner;
}

export default AcceptanceRule;
