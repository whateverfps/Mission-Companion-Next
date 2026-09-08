/**
 * ============================================================================
 * Mission Companion
 * Conflict Engine
 *
 * File:
 *     ResponsibilityRule.js
 *
 * Commit:
 *     5
 *
 * Purpose:
 *     Detects, classifies, and explains responsibility conflicts between
 *     requirements, documents, roles, and parties represented in a
 *     ConflictGraph.
 * ============================================================================
 */

import { ReasoningRule } from "./ConflictReasoner.js";

export const ResponsibilityAction = Object.freeze({
    FURNISH: "furnish",
    INSTALL: "install",
    PROVIDE: "provide",
    SUPPLY: "supply",
    APPROVE: "approve",
    REVIEW: "review",
    INSPECT: "inspect",
    VERIFY: "verify",
    TEST: "test",
    SUBMIT: "submit",
    COORDINATE: "coordinate",
    SCHEDULE: "schedule",
    NOTIFY: "notify",
    MAINTAIN: "maintain",
    REMOVE: "remove",
    REPLACE: "replace",
    PROTECT: "protect",
    RESTORE: "restore",
    ACCEPT: "accept",
    AUTHORIZE: "authorize",
    DOCUMENT: "document",
    PERFORM: "perform",
    COMPLETE: "complete",
    CORRECT: "correct",
    OTHER: "other"
});

export const ResponsibilityParty = Object.freeze({
    CONTRACTOR: "contractor",
    OWNER: "owner",
    GOVERNMENT: "government",
    VA: "va",
    COR: "cor",
    CQC: "cqc",
    OWNER_QC: "owner_qc",
    DESIGNER: "designer",
    ARCHITECT: "architect",
    ENGINEER: "engineer",
    SUBCONTRACTOR: "subcontractor",
    MANUFACTURER: "manufacturer",
    VENDOR: "vendor",
    OIT: "oit",
    FACILITY: "facility",
    AHJ: "ahj",
    THIRD_PARTY: "third_party",
    UNKNOWN: "unknown"
});

export const ResponsibilityConflictType = Object.freeze({
    DOUBLE_ASSIGNMENT: "double_assignment",
    UNASSIGNED: "unassigned",
    EXCLUSIVE_CONTRADICTION: "exclusive_contradiction",
    ROLE_OVERLAP: "role_overlap",
    AUTHORITY_MISMATCH: "authority_mismatch",
    FURNISH_INSTALL_SPLIT: "furnish_install_split",
    REVIEW_APPROVAL_SPLIT: "review_approval_split",
    INSPECTION_ACCEPTANCE_SPLIT: "inspection_acceptance_split",
    TEST_VERIFICATION_SPLIT: "test_verification_split",
    NO_CONFLICT: "no_conflict"
});

const PARTY_PATTERNS = [
    [ResponsibilityParty.OWNER_QC, /\b(owner(?:'s)?\s+(?:qa|qc|quality\s+(?:assurance|control)|inspector))\b/i],
    [ResponsibilityParty.CQC, /\b(cqc|contractor(?:'s)?\s+quality\s+control|quality\s+control\s+manager)\b/i],
    [ResponsibilityParty.COR, /\b(contracting\s+officer(?:'s)?\s+representative|cor)\b/i],
    [ResponsibilityParty.OIT, /\b(oit|office\s+of\s+information\s+(?:and\s+)?technology)\b/i],
    [ResponsibilityParty.AHJ, /\b(authority\s+having\s+jurisdiction|ahj)\b/i],
    [ResponsibilityParty.SUBCONTRACTOR, /\b(subcontractor|sub-contractor|trade\s+contractor)\b/i],
    [ResponsibilityParty.CONTRACTOR, /\b(contractor|prime\s+contractor|general\s+contractor)\b/i],
    [ResponsibilityParty.GOVERNMENT, /\b(government|federal\s+government)\b/i],
    [ResponsibilityParty.VA, /\b(veterans\s+affairs|department\s+of\s+veterans\s+affairs|\bva\b)\b/i],
    [ResponsibilityParty.OWNER, /\b(owner|owner's\s+representative)\b/i],
    [ResponsibilityParty.ARCHITECT, /\b(architect|a\/e\s+architect)\b/i],
    [ResponsibilityParty.ENGINEER, /\b(engineer|a\/e\s+engineer|engineer\s+of\s+record)\b/i],
    [ResponsibilityParty.DESIGNER, /\b(designer|design\s+professional|a\/e)\b/i],
    [ResponsibilityParty.MANUFACTURER, /\b(manufacturer|fabricator)\b/i],
    [ResponsibilityParty.VENDOR, /\b(vendor|supplier)\b/i],
    [ResponsibilityParty.FACILITY, /\b(facility|medical\s+center|site\s+staff)\b/i],
    [ResponsibilityParty.THIRD_PARTY, /\b(third[-\s]party|independent\s+testing\s+agency)\b/i]
];

const ACTION_PATTERNS = [
    [ResponsibilityAction.FURNISH, /\b(furnish(?:es|ed|ing)?|owner[-\s]furnished)\b/i],
    [ResponsibilityAction.INSTALL, /\b(install(?:s|ed|ing|ation)?)\b/i],
    [ResponsibilityAction.PROVIDE, /\b(provide(?:s|d|ing)?)\b/i],
    [ResponsibilityAction.SUPPLY, /\b(supply|supplies|supplied|supplying)\b/i],
    [ResponsibilityAction.APPROVE, /\b(approve(?:s|d|ing|al)?)\b/i],
    [ResponsibilityAction.REVIEW, /\b(review(?:s|ed|ing)?)\b/i],
    [ResponsibilityAction.INSPECT, /\b(inspect(?:s|ed|ing|ion)?)\b/i],
    [ResponsibilityAction.VERIFY, /\b(verif(?:y|ies|ied|ication))\b/i],
    [ResponsibilityAction.TEST, /\b(test(?:s|ed|ing)?)\b/i],
    [ResponsibilityAction.SUBMIT, /\b(submit(?:s|ted|ting)?|submission)\b/i],
    [ResponsibilityAction.COORDINATE, /\b(coordinat(?:e|es|ed|ing|ion))\b/i],
    [ResponsibilityAction.SCHEDULE, /\b(schedul(?:e|es|ed|ing))\b/i],
    [ResponsibilityAction.NOTIFY, /\b(notif(?:y|ies|ied|ication))\b/i],
    [ResponsibilityAction.MAINTAIN, /\b(maintain(?:s|ed|ing)?|maintenance)\b/i],
    [ResponsibilityAction.REMOVE, /\b(remov(?:e|es|ed|ing|al))\b/i],
    [ResponsibilityAction.REPLACE, /\b(replac(?:e|es|ed|ing|ement))\b/i],
    [ResponsibilityAction.PROTECT, /\b(protect(?:s|ed|ing|ion)?)\b/i],
    [ResponsibilityAction.RESTORE, /\b(restor(?:e|es|ed|ing|ation))\b/i],
    [ResponsibilityAction.ACCEPT, /\b(accept(?:s|ed|ing|ance)?)\b/i],
    [ResponsibilityAction.AUTHORIZE, /\b(authoriz(?:e|es|ed|ing|ation))\b/i],
    [ResponsibilityAction.DOCUMENT, /\b(document(?:s|ed|ing|ation)?)\b/i],
    [ResponsibilityAction.PERFORM, /\b(perform(?:s|ed|ing|ance)?)\b/i],
    [ResponsibilityAction.COMPLETE, /\b(complet(?:e|es|ed|ing|ion))\b/i],
    [ResponsibilityAction.CORRECT, /\b(correct(?:s|ed|ing|ion)?)\b/i]
];

const EXCLUSIVE_PHRASES = [
    /\bsolely\s+responsible\b/i,
    /\bexclusive(?:ly)?\s+responsible\b/i,
    /\bshall\s+be\s+the\s+responsibility\s+of\b/i,
    /\bonly\s+the\b/i,
    /\bno\s+other\s+party\b/i
];

const NEGATION_PATTERNS = [
    /\bshall\s+not\b/i,
    /\bmust\s+not\b/i,
    /\bis\s+not\s+responsible\b/i,
    /\bnot\s+responsible\b/i,
    /\bexcluding\b/i,
    /\bexcept\s+for\b/i
];

const AUTHORITY_ACTIONS = new Set([
    ResponsibilityAction.APPROVE,
    ResponsibilityAction.ACCEPT,
    ResponsibilityAction.AUTHORIZE
]);

const EXECUTION_ACTIONS = new Set([
    ResponsibilityAction.FURNISH,
    ResponsibilityAction.INSTALL,
    ResponsibilityAction.PROVIDE,
    ResponsibilityAction.SUPPLY,
    ResponsibilityAction.TEST,
    ResponsibilityAction.SUBMIT,
    ResponsibilityAction.MAINTAIN,
    ResponsibilityAction.REMOVE,
    ResponsibilityAction.REPLACE,
    ResponsibilityAction.PROTECT,
    ResponsibilityAction.RESTORE,
    ResponsibilityAction.PERFORM,
    ResponsibilityAction.COMPLETE,
    ResponsibilityAction.CORRECT
]);

function normalizeText(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeNodeValue(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    return normalizeText(value).toLowerCase();
}

function lower(value) {
    return normalizeText(value).toLowerCase();
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, value));
}

function tokenSet(value) {
    return new Set(
        lower(value)
            .split(/[^a-z0-9]+/)
            .filter(token => token.length > 2)
    );
}

function jaccardSimilarity(left, right) {
    const a = tokenSet(left);
    const b = tokenSet(right);

    if (a.size === 0 && b.size === 0) {
        return 1;
    }

    const intersection = [...a].filter(token => b.has(token)).length;
    const union = new Set([...a, ...b]).size;

    return union === 0 ? 0 : intersection / union;
}

function extractObjectPhrase(text, actionMatch) {
    if (!actionMatch) {
        return "";
    }

    const start = actionMatch.index + actionMatch[0].length;
    const tail = text.slice(start);

    const stop = tail.search(/[.;:\n]|\b(?:provided|except|unless|subject\s+to|in\s+accordance\s+with)\b/i);
    const phrase = stop >= 0 ? tail.slice(0, stop) : tail;

    return normalizeText(
        phrase
            .replace(/^[\s,:-]+/, "")
            .replace(/\b(?:the|all|any)\b\s*/i, "")
    );
}

function inferPartyFromMetadata(node) {
    const candidates = [
        node.metadata?.responsibleParty,
        node.metadata?.responsible,
        node.metadata?.party,
        node.metadata?.role,
        node.metadata?.actor,
        node.metadata?.subject
    ];

    for (const candidate of candidates) {
        const inferred = identifyParties(candidate);

        if (inferred.length > 0) {
            return inferred;
        }
    }

    return [];
}

export function identifyParties(text) {
    const value = normalizeText(text);
    const parties = [];

    for (const [party, pattern] of PARTY_PATTERNS) {
        if (pattern.test(value)) {
            parties.push(party);
        }
    }

    return unique(parties);
}

export function identifyActions(text) {
    const value = normalizeText(text);
    const actions = [];

    for (const [action, pattern] of ACTION_PATTERNS) {
        if (pattern.test(value)) {
            actions.push(action);
        }
    }

    return unique(actions);
}

export function extractResponsibilityStatements(node) {
    const text = normalizeText(
        [
            node.title,
            node.text,
            node.metadata?.requirement,
            node.metadata?.statement
        ]
            .filter(Boolean)
            .join(". ")
    );

    if (!text) {
        return [];
    }

    const explicitParties = unique([
        ...identifyParties(text),
        ...inferPartyFromMetadata(node)
    ]);

    const statements = [];

    for (const [action, pattern] of ACTION_PATTERNS) {
        const flags = pattern.flags.includes("g")
            ? pattern.flags
            : `${pattern.flags}g`;

        const matcher = new RegExp(pattern.source, flags);
        let match;

        while ((match = matcher.exec(text)) !== null) {
            const before = text.slice(
                Math.max(0, match.index - 140),
                match.index
            );

            const nearbyParties = identifyParties(before);
            const parties =
                nearbyParties.length > 0
                    ? nearbyParties
                    : explicitParties;

            const object = extractObjectPhrase(text, match);

            statements.push({
                nodeId: node.id,
                node,
                parties:
                    parties.length > 0
                        ? parties
                        : [ResponsibilityParty.UNKNOWN],
                action,
                object,
                text,
                exclusive: EXCLUSIVE_PHRASES.some(p => p.test(text)),
                negated: NEGATION_PATTERNS.some(p => p.test(before)),
                confidence: calculateExtractionConfidence({
                    parties,
                    action,
                    object,
                    text
                })
            });
        }
    }

    if (statements.length === 0 && explicitParties.length > 0) {
        statements.push({
            nodeId: node.id,
            node,
            parties: explicitParties,
            action: ResponsibilityAction.OTHER,
            object: "",
            text,
            exclusive: EXCLUSIVE_PHRASES.some(p => p.test(text)),
            negated: NEGATION_PATTERNS.some(p => p.test(text)),
            confidence: 0.45
        });
    }

    return deduplicateStatements(statements);
}

function calculateExtractionConfidence(statement) {
    let confidence = 0.25;

    if (
        statement.parties &&
        statement.parties.length > 0 &&
        !statement.parties.includes(ResponsibilityParty.UNKNOWN)
    ) {
        confidence += 0.3;
    }

    if (statement.action && statement.action !== ResponsibilityAction.OTHER) {
        confidence += 0.25;
    }

    if (statement.object && statement.object.length > 2) {
        confidence += 0.15;
    }

    if (/\bshall\b|\bmust\b|\bis\s+responsible\b/i.test(statement.text)) {
        confidence += 0.05;
    }

    return clamp(confidence);
}

function deduplicateStatements(statements) {
    const seen = new Set();
    const result = [];

    for (const statement of statements) {
        const signature = [
            statement.nodeId,
            statement.parties.slice().sort().join(","),
            statement.action,
            lower(statement.object),
            statement.negated
        ].join("|");

        if (seen.has(signature)) {
            continue;
        }

        seen.add(signature);
        result.push(statement);
    }

    return result;
}

function stableNodeArray(nodes) {
    const result = [];
    const seen = new Set();

    for (const node of nodes || []) {
        if (!node) {
            continue;
        }

        const marker = node?.id != null
            ? `id:${node.id}`
            : `title:${normalizeText(node?.title || node?.name || "")}`;

        if (seen.has(marker)) {
            continue;
        }

        seen.add(marker);
        result.push(node);
    }

    return result;
}

function resolveCandidateNodes(graph, context = {}, nodeTypes = []) {
    const allowedTypes = (nodeTypes || [])
        .map(value => normalizeNodeValue(value))
        .filter(Boolean);

    const filterByType = nodes => {
        if (!allowedTypes.length) {
            return stableNodeArray(nodes);
        }

        return stableNodeArray(nodes.filter(node => allowedTypes.includes(normalizeNodeValue(node?.type))));
    };

    if (graph && Array.isArray(context?.nodes) && context.nodes.length > 0) {
        return filterByType(context.nodes);
    }

    const nodeIds = Array.isArray(context?.nodeIds)
        ? context.nodeIds
        : (context?.nodeId ? [context.nodeId] : []);

    if (nodeIds.length > 0 && graph) {
        const resolved = [];
        const seen = new Set();

        for (const nodeId of nodeIds) {
            if (!nodeId) {
                continue;
            }

            const node = typeof graph.getNode === "function"
                ? graph.getNode(nodeId)
                : null;
            const fallbackNode = graph.nodes instanceof Map
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
            return filterByType(resolved);
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

    if (Object.keys(criteria).length > 0 && graph) {
        if (typeof graph.query === "function") {
            try {
                const queryCriteria = { ...criteria };
                if (queryCriteria.nodeId !== undefined) {
                    queryCriteria.id = queryCriteria.nodeId;
                    delete queryCriteria.nodeId;
                }
                const matched = graph.query(queryCriteria);
                if (matched) {
                    return filterByType(Array.isArray(matched) ? matched : [...matched]);
                }
            } catch {
                // Fall through to the compatible fallback below.
            }
        }

        const indexedCriteria = [];

        if (criteria.document !== undefined && criteria.document !== null && criteria.document !== "") {
            indexedCriteria.push([criteria.document, graph.getNodesByDocument]);
        }

        if (criteria.section !== undefined && criteria.section !== null && criteria.section !== "") {
            indexedCriteria.push([criteria.section, graph.getNodesBySection]);
        }

        if (criteria.source !== undefined && criteria.source !== null && criteria.source !== "") {
            indexedCriteria.push([criteria.source, graph.getNodesBySource]);
        }

        if (criteria.specification !== undefined && criteria.specification !== null && criteria.specification !== "") {
            indexedCriteria.push([criteria.specification, graph.getNodesBySpecification]);
        }

        if (criteria.responsibility !== undefined && criteria.responsibility !== null && criteria.responsibility !== "") {
            indexedCriteria.push([criteria.responsibility, graph.getNodesByResponsibility]);
        }

        if (indexedCriteria.length > 0) {
            let matched = null;
            for (const [, lookup] of indexedCriteria) {
                if (typeof lookup !== "function") {
                    continue;
                }

                const current = lookup.call(graph, criteria.document ?? criteria.section ?? criteria.source ?? criteria.specification ?? criteria.responsibility);
                const nodes = Array.isArray(current) ? current : [...(current || [])];
                if (!matched) {
                    matched = nodes;
                } else {
                    const matchedIds = new Set(matched.map(node => node?.id).filter(Boolean));
                    matched = nodes.filter(node => matchedIds.has(node?.id));
                }
            }

            if (matched) {
                return filterByType(matched);
            }
        }
    }

    if (graph && typeof graph.findNodes === "function") {
        return filterByType(graph.findNodes({
            types: nodeTypes
        }));
    }

    return [];
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

    if (Array.isArray(context?.nodes) && context.nodes.length > 0) {
        filter.nodeIds = context.nodes.map(node => node?.id).filter(Boolean);
    } else if (Array.isArray(context?.nodeIds) && context.nodeIds.length > 0) {
        filter.nodeIds = context.nodeIds.filter(Boolean);
    }

    return filter;
}

function collectGraphEvidence(graph, node) {
    const evidenceIds = [];
    const seen = new Set();

    const pushValue = value => {
        if (value === undefined || value === null || value === "") {
            return;
        }

        const normalized = normalizeText(value).toLowerCase();
        if (seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        evidenceIds.push(normalizeText(value));
    };

    for (const entry of Array.isArray(node?.evidence) ? node.evidence : []) {
        if (!entry) {
            continue;
        }

        pushValue(entry.id || entry.reference || entry.title || entry.name || entry.type);
    }

    for (const value of [node?.id, node?.title, node?.text, node?.document, node?.section, node?.source]) {
        pushValue(value);
    }

    if (graph && typeof graph.getEvidence === "function") {
        for (const value of [node?.id, node?.title, node?.text, node?.document, node?.section, node?.source]) {
            if (!value) {
                continue;
            }

            try {
                const matches = graph.getEvidence(value) || [];
                for (const match of matches) {
                    pushValue(match?.id || match?.reference || match?.title || match?.name || match?.text);
                }
            } catch {
                // Ignore lookup failures.
            }
        }
    }

    return evidenceIds;
}

function applyFindingMetadata(finding, rule, context = {}, candidateNodes = []) {
    if (!finding) {
        return finding;
    }

    const ruleName = rule?.name || rule?.constructor?.name || "ResponsibilityRule";
    const candidateFilter = buildCandidateFilter(context);
    const isFiltered = Boolean(context?.filtered || context?.nodes || context?.nodeIds || Object.keys(candidateFilter).length > 0);

    finding.rule = finding.rule || ruleName;
    finding.ruleVersion = finding.ruleVersion || "5";
    finding.executionContext = {
        filtered: isFiltered,
        criteria: candidateFilter,
        candidateNodeCount: (candidateNodes || []).length,
        candidateNodeIds: (candidateNodes || []).map(node => node?.id).filter(Boolean)
    };
    finding.metadata = {
        ...(finding.metadata || {}),
        candidateFilter,
        graphEvidenceIds: finding.graphEvidenceIds || [],
        filtered: isFiltered,
        candidateNodeCount: (candidateNodes || []).length
    };
    finding.trace = Array.isArray(finding.trace) ? [...finding.trace] : [];
    finding.trace.push({
        rule: ruleName,
        filtered: isFiltered,
        candidateNodeCount: (candidateNodes || []).length,
        candidateFilter
    });

    return finding;
}

function normalizeFindingIdentity(finding) {
    const parties = unique((finding?.parties || []).map(value => lower(value))).sort();
    const actions = unique((finding?.actions || []).map(value => lower(value))).sort();
    const objectValue = lower(finding?.object);
    const nodeIds = unique((finding?.nodeIds || []).map(value => normalizeText(value))).sort();

    return [
        normalizeText(finding?.subtype),
        nodeIds.join("|"),
        parties.join(","),
        actions.join(","),
        objectValue,
        normalizeText(finding?.rule || finding?.ruleName)
    ].join("::");
}

export function compareResponsibilityStatements(left, right, options = {}) {
    const {
        minimumObjectSimilarity = 0.45
    } = options;

    const objectSimilarity = jaccardSimilarity(
        left.object || left.text,
        right.object || right.text
    );

    if (objectSimilarity < minimumObjectSimilarity) {
        return {
            conflict: false,
            type: ResponsibilityConflictType.NO_CONFLICT,
            confidence: 0,
            objectSimilarity,
            reason: "Statements concern different work objects."
        };
    }

    const leftParties = new Set(left.parties);
    const rightParties = new Set(right.parties);
    const sharedParties = [...leftParties].filter(p => rightParties.has(p));
    const differentParties =
        sharedParties.length === 0 &&
        !leftParties.has(ResponsibilityParty.UNKNOWN) &&
        !rightParties.has(ResponsibilityParty.UNKNOWN);

    if (
        left.negated !== right.negated &&
        left.action === right.action &&
        sharedParties.length > 0
    ) {
        return {
            conflict: true,
            type: ResponsibilityConflictType.EXCLUSIVE_CONTRADICTION,
            confidence: clamp(
                0.65 +
                0.2 * objectSimilarity +
                0.1 * Math.min(left.confidence, right.confidence)
            ),
            objectSimilarity,
            reason:
                "The same party is both assigned and denied the same responsibility."
        };
    }

    if (
        left.action === right.action &&
        differentParties &&
        (left.exclusive || right.exclusive)
    ) {
        return {
            conflict: true,
            type: ResponsibilityConflictType.EXCLUSIVE_CONTRADICTION,
            confidence: clamp(
                0.6 +
                0.2 * objectSimilarity +
                0.15 * Math.min(left.confidence, right.confidence)
            ),
            objectSimilarity,
            reason:
                "Exclusive responsibility is assigned to different parties."
        };
    }

    if (
        left.action === right.action &&
        differentParties
    ) {
        return {
            conflict: true,
            type: ResponsibilityConflictType.DOUBLE_ASSIGNMENT,
            confidence: clamp(
                0.45 +
                0.25 * objectSimilarity +
                0.15 * Math.min(left.confidence, right.confidence)
            ),
            objectSimilarity,
            reason:
                "The same work responsibility is assigned to different parties."
        };
    }

    if (
        new Set([left.action, right.action]).has(ResponsibilityAction.FURNISH) &&
        new Set([left.action, right.action]).has(ResponsibilityAction.INSTALL)
    ) {
        return {
            conflict: false,
            type: ResponsibilityConflictType.FURNISH_INSTALL_SPLIT,
            confidence: clamp(
                0.7 + 0.2 * objectSimilarity
            ),
            objectSimilarity,
            reason:
                "Furnishing and installation are distinct responsibilities."
        };
    }

    if (
        new Set([left.action, right.action]).has(ResponsibilityAction.REVIEW) &&
        new Set([left.action, right.action]).has(ResponsibilityAction.APPROVE)
    ) {
        return {
            conflict: false,
            type: ResponsibilityConflictType.REVIEW_APPROVAL_SPLIT,
            confidence: clamp(
                0.7 + 0.2 * objectSimilarity
            ),
            objectSimilarity,
            reason:
                "Review and approval are distinct levels of authority."
        };
    }

    if (
        new Set([left.action, right.action]).has(ResponsibilityAction.INSPECT) &&
        new Set([left.action, right.action]).has(ResponsibilityAction.ACCEPT)
    ) {
        return {
            conflict: false,
            type: ResponsibilityConflictType.INSPECTION_ACCEPTANCE_SPLIT,
            confidence: clamp(
                0.7 + 0.2 * objectSimilarity
            ),
            objectSimilarity,
            reason:
                "Inspection and acceptance are distinct responsibilities."
        };
    }

    if (
        new Set([left.action, right.action]).has(ResponsibilityAction.TEST) &&
        new Set([left.action, right.action]).has(ResponsibilityAction.VERIFY)
    ) {
        return {
            conflict: false,
            type: ResponsibilityConflictType.TEST_VERIFICATION_SPLIT,
            confidence: clamp(
                0.68 + 0.2 * objectSimilarity
            ),
            objectSimilarity,
            reason:
                "Performing a test and independently verifying its result are distinct."
        };
    }

    if (
        AUTHORITY_ACTIONS.has(left.action) &&
        AUTHORITY_ACTIONS.has(right.action) &&
        differentParties
    ) {
        return {
            conflict: true,
            type: ResponsibilityConflictType.AUTHORITY_MISMATCH,
            confidence: clamp(
                0.55 +
                0.25 * objectSimilarity +
                0.1 * Math.min(left.confidence, right.confidence)
            ),
            objectSimilarity,
            reason:
                "Final authority over the same subject is assigned to different parties."
        };
    }

    if (
        EXECUTION_ACTIONS.has(left.action) &&
        AUTHORITY_ACTIONS.has(right.action)
    ) {
        return {
            conflict: false,
            type: ResponsibilityConflictType.ROLE_OVERLAP,
            confidence: clamp(
                0.6 + 0.2 * objectSimilarity
            ),
            objectSimilarity,
            reason:
                "Execution and approval are complementary responsibilities."
        };
    }

    if (
        EXECUTION_ACTIONS.has(right.action) &&
        AUTHORITY_ACTIONS.has(left.action)
    ) {
        return {
            conflict: false,
            type: ResponsibilityConflictType.ROLE_OVERLAP,
            confidence: clamp(
                0.6 + 0.2 * objectSimilarity
            ),
            objectSimilarity,
            reason:
                "Execution and approval are complementary responsibilities."
        };
    }

    return {
        conflict: false,
        type: ResponsibilityConflictType.NO_CONFLICT,
        confidence: 0,
        objectSimilarity,
        reason:
            "No responsibility contradiction was identified."
    };
}

function sourceAuthority(node) {
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

function resolutionFor(left, right, comparison) {
    const leftAuthority = sourceAuthority(left.node);
    const rightAuthority = sourceAuthority(right.node);

    if (!comparison.conflict) {
        return {
            status: "no_resolution_required",
            governingNodeId: null,
            rationale: comparison.reason
        };
    }

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
                "The left responsibility statement has stronger extraction confidence."
        };
    }

    if (right.confidence > left.confidence) {
        return {
            status: "provisional",
            governingNodeId: right.nodeId,
            overriddenNodeId: left.nodeId,
            rationale:
                "The right responsibility statement has stronger extraction confidence."
        };
    }

    return {
        status: "unresolved",
        governingNodeId: null,
        rationale:
            "Both responsibility statements have equal authority and confidence."
    };
}

function findingSeverity(type, confidence) {
    if (
        type === ResponsibilityConflictType.EXCLUSIVE_CONTRADICTION ||
        type === ResponsibilityConflictType.AUTHORITY_MISMATCH
    ) {
        return confidence >= 0.8 ? "critical" : "high";
    }

    if (type === ResponsibilityConflictType.DOUBLE_ASSIGNMENT) {
        return confidence >= 0.75 ? "high" : "medium";
    }

    return "low";
}

function buildExplanation(left, right, comparison, resolution) {
    const leftParty = left.parties.join(", ");
    const rightParty = right.parties.join(", ");

    const lines = [
        comparison.reason,
        `Left assignment: ${leftParty} → ${left.action} → ${left.object || "unspecified object"}.`,
        `Right assignment: ${rightParty} → ${right.action} → ${right.object || "unspecified object"}.`,
        `Object similarity: ${(comparison.objectSimilarity * 100).toFixed(1)}%.`
    ];

    if (resolution.governingNodeId) {
        lines.push(
            `Provisional governing source: ${resolution.governingNodeId}.`
        );
    } else if (resolution.status === "unresolved") {
        lines.push(
            "The conflict requires human determination or a higher-authority source."
        );
    }

    return lines.join(" ");
}

export class ResponsibilityRule extends ReasoningRule {
    constructor(options = {}) {
        super(
            options.name || "Responsibility Arbitration",
            options.priority ?? 20
        );

        this.options = {
            nodeTypes:
                options.nodeTypes ||
                ["requirement", "specification", "drawing", "document"],
            minimumObjectSimilarity:
                options.minimumObjectSimilarity ?? 0.45,
            minimumFindingConfidence:
                options.minimumFindingConfidence ?? 0.55,
            includeNonConflictingSplits:
                options.includeNonConflictingSplits ?? false
        };
    }

    appliesTo(graph) {
        return Boolean(
            graph && (
                typeof graph.findNodes === "function" ||
                typeof graph.query === "function" ||
                typeof graph.getNodesByType === "function" ||
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

        const statements = candidateNodes.flatMap(
            node => extractResponsibilityStatements(node)
        );

        const seenPairs = new Set();

        for (let i = 0; i < statements.length; i += 1) {
            for (let j = i + 1; j < statements.length; j += 1) {
                const left = statements[i];
                const right = statements[j];

                if (left.nodeId === right.nodeId) {
                    continue;
                }

                const pairKey = [left.nodeId, right.nodeId]
                    .sort()
                    .join("|");

                const statementKey = [
                    pairKey,
                    left.action,
                    right.action,
                    lower(left.object),
                    lower(right.object)
                ].join("|");

                if (seenPairs.has(statementKey)) {
                    continue;
                }

                seenPairs.add(statementKey);

                const comparison = compareResponsibilityStatements(
                    left,
                    right,
                    {
                        minimumObjectSimilarity:
                            this.options.minimumObjectSimilarity
                    }
                );

                const shouldInclude =
                    comparison.conflict ||
                    (
                        this.options.includeNonConflictingSplits &&
                        comparison.type !== ResponsibilityConflictType.NO_CONFLICT
                    );

                if (!shouldInclude) {
                    continue;
                }

                if (
                    comparison.conflict &&
                    comparison.confidence <
                        this.options.minimumFindingConfidence
                ) {
                    continue;
                }

                const resolution = resolutionFor(
                    left,
                    right,
                    comparison
                );

                const evidence = [
                    {
                        nodeId: left.nodeId,
                        text: left.text,
                        parties: left.parties,
                        action: left.action,
                        object: left.object,
                        confidence: left.confidence
                    },
                    {
                        nodeId: right.nodeId,
                        text: right.text,
                        parties: right.parties,
                        action: right.action,
                        object: right.object,
                        confidence: right.confidence
                    }
                ];

                const finding = {
                    id:
                        `RESP-${left.nodeId}-${right.nodeId}-` +
                        `${left.action}-${right.action}`,
                    type: "responsibility",
                    subtype: comparison.type,
                    title:
                        comparison.conflict
                            ? "Responsibility conflict detected"
                            : "Responsibility split clarified",
                    severity:
                        comparison.conflict
                            ? findingSeverity(
                                comparison.type,
                                comparison.confidence
                            )
                            : "informational",
                    confidence: comparison.confidence,
                    nodeIds: [left.nodeId, right.nodeId],
                    document: left.node?.document || right.node?.document,
                    documents: unique([left.node?.document, right.node?.document].filter(Boolean)),
                    section: left.node?.section || right.node?.section,
                    sections: unique([left.node?.section, right.node?.section].filter(Boolean)),
                    source: left.node?.source || right.node?.source,
                    sources: unique([left.node?.source, right.node?.source].filter(Boolean)),
                    specification: left.node?.metadata?.specification || right.node?.metadata?.specification,
                    specifications: unique([left.node?.metadata?.specification, right.node?.metadata?.specification].filter(Boolean)),
                    responsibility: left.node?.metadata?.responsibility || right.node?.metadata?.responsibility,
                    responsibilities: unique([left.node?.metadata?.responsibility, right.node?.metadata?.responsibility].filter(Boolean)),
                    parties: unique([
                        ...left.parties,
                        ...right.parties
                    ]),
                    actions: unique([
                        left.action,
                        right.action
                    ]),
                    object:
                        left.object ||
                        right.object ||
                        "unspecified",
                    conflict: comparison.conflict,
                    evidence,
                    graphEvidenceIds: unique([
                        ...collectGraphEvidence(graph, left.node),
                        ...collectGraphEvidence(graph, right.node)
                    ]),
                    resolution,
                    explanation: buildExplanation(
                        left,
                        right,
                        comparison,
                        resolution
                    )
                };

                const duplicateIdentity = normalizeFindingIdentity(finding);
                const duplicate = result.findings.some(existing => normalizeFindingIdentity(existing) === duplicateIdentity);

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

                if (comparison.conflict) {
                    result.addRecommendation(
                        this.buildRecommendation(finding)
                    );
                }
            }
        }

        this.detectUnassignedResponsibilities(
            candidateNodes,
            statements,
            result,
            graph,
            context,
            candidateNodes
        );
    }

    detectUnassignedResponsibilities(nodes, statements, result, graph, context = {}, candidateNodes = []) {
        const statementsByNode = new Map();

        for (const statement of statements) {
            if (!statementsByNode.has(statement.nodeId)) {
                statementsByNode.set(statement.nodeId, []);
            }

            statementsByNode
                .get(statement.nodeId)
                .push(statement);
        }

        for (const node of nodes) {
            const text = normalizeText(
                [node.title, node.text].filter(Boolean).join(". ")
            );

            if (!text) {
                continue;
            }

            const containsObligation =
                /\bshall\b|\bmust\b|\brequired\s+to\b|\bis\s+responsible\b/i
                    .test(text);

            if (!containsObligation) {
                continue;
            }

            const nodeStatements =
                statementsByNode.get(node.id) || [];

            const assigned = nodeStatements.some(statement =>
                statement.parties.some(
                    party => party !== ResponsibilityParty.UNKNOWN
                )
            );

            if (assigned) {
                continue;
            }

            const finding = {
                id: `RESP-UNASSIGNED-${node.id}`,
                type: "responsibility",
                subtype: ResponsibilityConflictType.UNASSIGNED,
                title: "Required work has no identified responsible party",
                severity: "medium",
                confidence: 0.68,
                nodeIds: [node.id],
                document: node.document,
                documents: [node.document].filter(Boolean),
                section: node.section,
                sections: [node.section].filter(Boolean),
                source: node.source,
                sources: [node.source].filter(Boolean),
                specification: node.metadata?.specification,
                specifications: [node.metadata?.specification].filter(Boolean),
                responsibility: node.metadata?.responsibility,
                responsibilities: [node.metadata?.responsibility].filter(Boolean),
                parties: [ResponsibilityParty.UNKNOWN],
                actions: identifyActions(text),
                object: "",
                conflict: true,
                evidence: [
                    {
                        nodeId: node.id,
                        text
                    }
                ],
                graphEvidenceIds: collectGraphEvidence(graph, node),
                resolution: {
                    status: "unresolved",
                    governingNodeId: null,
                    rationale:
                        "A responsible party must be identified from controlling documents."
                },
                explanation:
                    "The text contains mandatory language, but no responsible party could be identified."
            };

            const duplicateIdentity = normalizeFindingIdentity(finding);
            const duplicate = result.findings.some(existing => normalizeFindingIdentity(existing) === duplicateIdentity);

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

    buildRecommendation(finding) {
        if (
            finding.subtype ===
            ResponsibilityConflictType.UNASSIGNED
        ) {
            return {
                findingId: finding.id,
                priority: "high",
                action:
                    "Identify and document the responsible party before the work proceeds.",
                verification:
                    "Confirm assignment against the contract, specification, drawing notes, and approved submittals."
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
                    `Apply the provision in ${finding.resolution.governingNodeId} provisionally and obtain formal clarification.`,
                verification:
                    "Document the decision in an RFI, meeting record, directive, or other controlled project record."
            };
        }

        return {
            findingId: finding.id,
            priority:
                finding.severity === "critical"
                    ? "immediate"
                    : "high",
            action:
                "Escalate the conflicting responsibility assignments for formal determination.",
            verification:
                "Do not rely on informal practice where controlling documents assign the same responsibility differently."
        };
    }
}

export function registerResponsibilityRule(reasoner, options = {}) {
    if (
        !reasoner ||
        typeof reasoner.registerRule !== "function"
    ) {
        throw new TypeError(
            "reasoner must provide registerRule()."
        );
    }

    reasoner.registerRule(
        new ResponsibilityRule(options)
    );

    return reasoner;
}

export default ResponsibilityRule;
