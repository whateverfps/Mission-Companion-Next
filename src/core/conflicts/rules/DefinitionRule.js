/**
 * ============================================================================
 * Mission Companion
 * Conflict Engine
 *
 * File:
 *     DefinitionRule.js
 *
 * Commit:
 *     9
 *
 * Purpose:
 *     Extracts defined terms from project documents and detects inconsistent,
 *     circular, missing, ambiguous, duplicate, and scope-changing definitions.
 * ============================================================================
 */

import { ReasoningRule } from "../ConflictReasoner.js";

export const DefinitionConflictType = Object.freeze({
    CONTRADICTORY_DEFINITION: "contradictory_definition",
    SCOPE_EXPANSION: "scope_expansion",
    SCOPE_RESTRICTION: "scope_restriction",
    DIFFERENT_RESPONSIBLE_PARTY: "different_responsible_party",
    DIFFERENT_AUTHORITY: "different_authority",
    CIRCULAR_DEFINITION: "circular_definition",
    UNDEFINED_TERM: "undefined_term",
    DUPLICATE_DEFINITION: "duplicate_definition",
    AMBIGUOUS_DEFINITION: "ambiguous_definition",
    SELF_REFERENCE: "self_reference",
    DEFINITION_OVERRIDE: "definition_override",
    NO_CONFLICT: "no_conflict"
});

export const DefinitionSourceType = Object.freeze({
    CONTRACT: "contract",
    GENERAL_CONDITIONS: "general_conditions",
    SUPPLEMENTARY_CONDITIONS: "supplementary_conditions",
    SPECIFICATION: "specification",
    DRAWING: "drawing",
    ADDENDUM: "addendum",
    CHANGE_ORDER: "change_order",
    DIRECTIVE: "directive",
    RFI: "rfi",
    SUBMITTAL: "submittal",
    SOP: "sop",
    POLICY: "policy",
    EMAIL: "email",
    NOTE: "note",
    UNKNOWN: "unknown"
});

const SOURCE_AUTHORITY = new Map([
    [DefinitionSourceType.CONTRACT, 100],
    [DefinitionSourceType.CHANGE_ORDER, 98],
    [DefinitionSourceType.ADDENDUM, 96],
    [DefinitionSourceType.SUPPLEMENTARY_CONDITIONS, 94],
    [DefinitionSourceType.GENERAL_CONDITIONS, 92],
    [DefinitionSourceType.SPECIFICATION, 88],
    [DefinitionSourceType.DRAWING, 82],
    [DefinitionSourceType.DIRECTIVE, 78],
    [DefinitionSourceType.RFI, 72],
    [DefinitionSourceType.SUBMITTAL, 68],
    [DefinitionSourceType.SOP, 58],
    [DefinitionSourceType.POLICY, 55],
    [DefinitionSourceType.EMAIL, 25],
    [DefinitionSourceType.NOTE, 10],
    [DefinitionSourceType.UNKNOWN, 30]
]);

const DEFINITION_PATTERNS = [
    /(?:^|[.;]\s*)(["“']?[^.;:"”']{2,80}["”']?)\s+(?:means|shall mean|is defined as|refers to)\s+([^.;]+)/gi,
    /(?:^|[.;]\s*)(["“']?[^.;:"”']{2,80}["”']?)\s*:\s*([^.;]+)/gi,
    /\bdefinition\s+of\s+["“']?([^"”':.;]{2,80})["”']?\s*(?:is|means|:)\s*([^.;]+)/gi,
    /\bfor purposes of this (?:contract|section|specification|document),\s*["“']?([^"”',.;]{2,80})["”']?\s+(?:means|includes)\s+([^.;]+)/gi
];

const DEFINITION_NODE_TYPES = new Set([
    "definition",
    "term",
    "requirement",
    "specification",
    "contract",
    "document",
    "clause",
    "paragraph"
]);

const RESPONSIBLE_PARTIES = [
    ["contractor", /\bcontractor\b|\bgeneral contractor\b|\bprime contractor\b/i],
    ["owner", /\bowner\b|\bgovernment\b/i],
    ["va", /\bdepartment of veterans affairs\b|\bveterans affairs\b|\bVA\b/],
    ["cor", /\bcontracting officer(?:'s)? representative\b|\bCOR\b/],
    ["contracting_officer", /\bcontracting officer\b/i],
    ["cqc", /\bcontractor(?:'s)? quality control\b|\bCQC\b/],
    ["owner_qc", /\bowner(?:'s)? quality (?:assurance|control)\b|\bowner QC\b/i],
    ["architect", /\barchitect\b/i],
    ["engineer", /\bengineer\b|\bengineer of record\b/i],
    ["designer", /\bdesigner\b|\bdesign professional\b/i],
    ["manufacturer", /\bmanufacturer\b/i],
    ["vendor", /\bvendor\b|\bsupplier\b/i],
    ["ahj", /\bauthority having jurisdiction\b|\bAHJ\b/],
    ["oit", /\boffice of information and technology\b|\bOIT\b/]
];

const AUTHORITY_PHRASES = [
    ["approval", /\bapprov(?:e|es|ed|al|ing)\b/i],
    ["acceptance", /\baccept(?:s|ed|ance|ing)\b/i],
    ["direction", /\bdirect(?:s|ed|ion|ing)\b/i],
    ["interpretation", /\binterpret(?:s|ed|ation|ing)\b/i],
    ["verification", /\bverif(?:y|ies|ied|ication)\b/i],
    ["inspection", /\binspect(?:s|ed|ion|ing)\b/i],
    ["authorization", /\bauthoriz(?:e|es|ed|ation|ing)\b/i],
    ["certification", /\bcertif(?:y|ies|ied|ication)\b/i]
];

const EXPANSION_WORDS = [
    "includes",
    "including",
    "but not limited to",
    "all",
    "any",
    "every",
    "regardless of",
    "whether or not",
    "without limitation"
];

const RESTRICTION_WORDS = [
    "only",
    "solely",
    "limited to",
    "excluding",
    "except",
    "unless",
    "provided that",
    "specifically"
];

const DEFINITION_STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "of", "to", "for", "in", "on",
    "by", "with", "from", "as", "is", "are", "be", "means", "shall",
    "this", "that", "these", "those", "such", "including", "includes"
]);

function normalize(value) {
    return String(value ?? "")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function lower(value) {
    return normalize(value).toLowerCase();
}

function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function normalizeTerm(value) {
    return normalize(value)
        .replace(/^["']|["']$/g, "")
        .replace(/^(?:the|a|an)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

function canonicalTerm(value) {
    return lower(normalizeTerm(value))
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(value) {
    return lower(value)
        .split(/[^a-z0-9]+/)
        .filter(token => token.length > 1 && !DEFINITION_STOP_WORDS.has(token));
}

function tokenSet(value) {
    return new Set(tokenize(value));
}

function jaccardSimilarity(left, right) {
    const a = tokenSet(left);
    const b = tokenSet(right);

    if (a.size === 0 && b.size === 0) {
        return 1;
    }

    if (a.size === 0 || b.size === 0) {
        return 0;
    }

    const intersection = [...a].filter(token => b.has(token)).length;
    const union = new Set([...a, ...b]).size;

    return union === 0 ? 0 : intersection / union;
}

function containment(left, right) {
    const a = tokenSet(left);
    const b = tokenSet(right);

    if (a.size === 0 || b.size === 0) {
        return 0;
    }

    const intersection = [...a].filter(token => b.has(token)).length;
    return intersection / Math.min(a.size, b.size);
}

function sourceType(node) {
    const raw = lower(
        node.metadata?.documentType ??
        node.metadata?.sourceType ??
        node.type ??
        ""
    );

    const aliases = [
        [DefinitionSourceType.CHANGE_ORDER, /change[_\s-]?order|\bco\b/],
        [DefinitionSourceType.ADDENDUM, /addendum|addenda/],
        [DefinitionSourceType.SUPPLEMENTARY_CONDITIONS, /supplementary conditions/],
        [DefinitionSourceType.GENERAL_CONDITIONS, /general conditions/],
        [DefinitionSourceType.CONTRACT, /contract|agreement/],
        [DefinitionSourceType.SPECIFICATION, /specification|spec section/],
        [DefinitionSourceType.DRAWING, /drawing|plan|detail|sheet/],
        [DefinitionSourceType.DIRECTIVE, /directive|field order|asi/],
        [DefinitionSourceType.RFI, /\brfi\b|request for information/],
        [DefinitionSourceType.SUBMITTAL, /submittal|shop drawing/],
        [DefinitionSourceType.SOP, /\bsop\b|procedure/],
        [DefinitionSourceType.POLICY, /policy/],
        [DefinitionSourceType.EMAIL, /email|e-mail/],
        [DefinitionSourceType.NOTE, /note|memo/]
    ];

    for (const [type, pattern] of aliases) {
        if (pattern.test(raw)) {
            return type;
        }
    }

    return DefinitionSourceType.UNKNOWN;
}

function authorityScore(node) {
    const configured = Number(node.metadata?.authorityScore);

    if (Number.isFinite(configured)) {
        return configured;
    }

    return SOURCE_AUTHORITY.get(sourceType(node)) ?? 30;
}

function revisionNumber(node) {
    const candidates = [
        node.metadata?.revision,
        node.metadata?.revisionNumber,
        node.metadata?.version
    ];

    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined || candidate === "") {
            continue;
        }

        const numeric = Number(candidate);

        if (Number.isFinite(numeric)) {
            return numeric;
        }

        const match = String(candidate).match(/\d+(?:\.\d+)?/);

        if (match) {
            return Number(match[0]);
        }
    }

    return 0;
}

function effectiveDate(node) {
    const candidates = [
        node.metadata?.effectiveDate,
        node.metadata?.revisionDate,
        node.metadata?.issueDate,
        node.metadata?.date
    ];

    for (const candidate of candidates) {
        if (!candidate) {
            continue;
        }

        const date = new Date(candidate);

        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}

function extractParties(text) {
    const parties = [];

    for (const [party, pattern] of RESPONSIBLE_PARTIES) {
        if (pattern.test(text)) {
            parties.push(party);
        }
    }

    return unique(parties);
}

function extractAuthorities(text) {
    const authorities = [];

    for (const [authority, pattern] of AUTHORITY_PHRASES) {
        if (pattern.test(text)) {
            authorities.push(authority);
        }
    }

    return unique(authorities);
}

function hasExpansionLanguage(text) {
    const normalized = lower(text);
    return EXPANSION_WORDS.some(word => normalized.includes(word));
}

function hasRestrictionLanguage(text) {
    const normalized = lower(text);
    return RESTRICTION_WORDS.some(word => normalized.includes(word));
}

function definitionConfidence(term, definition, node) {
    let confidence = 0.35;

    if (term.length >= 2) confidence += 0.1;
    if (definition.length >= 8) confidence += 0.15;
    if (/\bmeans\b|\bdefined as\b|\brefers to\b/i.test(node.text || "")) confidence += 0.15;
    if (sourceType(node) !== DefinitionSourceType.UNKNOWN) confidence += 0.1;
    if (node.metadata?.section || node.metadata?.paragraph) confidence += 0.05;
    if (extractParties(definition).length > 0) confidence += 0.05;
    if (extractAuthorities(definition).length > 0) confidence += 0.05;

    return clamp(confidence);
}

function extractExplicitDefinitions(node) {
    const text = normalize([
        node.title,
        node.text,
        node.metadata?.definition,
        node.metadata?.statement
    ].filter(Boolean).join(". "));

    const definitions = [];

    for (const pattern of DEFINITION_PATTERNS) {
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            const term = normalizeTerm(match[1]);
            const definition = normalize(match[2]);

            if (
                !term ||
                !definition ||
                term.length > 100 ||
                definition.length < 3
            ) {
                continue;
            }

            definitions.push({
                term,
                canonical: canonicalTerm(term),
                definition,
                nodeId: node.id,
                node,
                sourceType: sourceType(node),
                authorityScore: authorityScore(node),
                revision: revisionNumber(node),
                effectiveDate: effectiveDate(node),
                parties: extractParties(definition),
                authorities: extractAuthorities(definition),
                expandsScope: hasExpansionLanguage(definition),
                restrictsScope: hasRestrictionLanguage(definition),
                confidence: definitionConfidence(term, definition, node)
            });
        }
    }

    return definitions;
}

function extractStructuredDefinition(node) {
    const term = normalizeTerm(
        node.metadata?.term ??
        node.metadata?.definedTerm ??
        (
            lower(node.type) === "definition"
                ? node.title
                : ""
        )
    );

    const definition = normalize(
        node.metadata?.definition ??
        node.metadata?.meaning ??
        (
            lower(node.type) === "definition"
                ? node.text
                : ""
        )
    );

    if (!term || !definition) {
        return null;
    }

    return {
        term,
        canonical: canonicalTerm(term),
        definition,
        nodeId: node.id,
        node,
        sourceType: sourceType(node),
        authorityScore: authorityScore(node),
        revision: revisionNumber(node),
        effectiveDate: effectiveDate(node),
        parties: extractParties(definition),
        authorities: extractAuthorities(definition),
        expandsScope: hasExpansionLanguage(definition),
        restrictsScope: hasRestrictionLanguage(definition),
        confidence: definitionConfidence(term, definition, node)
    };
}

export function extractDefinitions(node) {
    const structured = extractStructuredDefinition(node);
    const explicit = extractExplicitDefinitions(node);

    const combined = structured
        ? [structured, ...explicit]
        : explicit;

    const seen = new Set();
    const output = [];

    for (const definition of combined) {
        const key = `${definition.canonical}|${lower(definition.definition)}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        output.push(definition);
    }

    return output;
}

function comparePartyAssignments(left, right) {
    if (left.parties.length === 0 || right.parties.length === 0) {
        return false;
    }

    return !left.parties.some(party => right.parties.includes(party));
}

function compareAuthorityAssignments(left, right) {
    if (left.authorities.length === 0 || right.authorities.length === 0) {
        return false;
    }

    return !left.authorities.some(authority => right.authorities.includes(authority));
}

function classifyDefinitionConflict(left, right, options = {}) {
    const similarity = jaccardSimilarity(left.definition, right.definition);
    const contained = containment(left.definition, right.definition);
    const duplicateThreshold = options.duplicateThreshold ?? 0.88;
    const conflictThreshold = options.conflictThreshold ?? 0.35;

    if (similarity >= duplicateThreshold) {
        return {
            conflict: true,
            subtype: DefinitionConflictType.DUPLICATE_DEFINITION,
            confidence: clamp(0.7 + similarity * 0.25),
            similarity,
            reason: "The definitions are materially equivalent and may be redundant."
        };
    }

    if (comparePartyAssignments(left, right)) {
        return {
            conflict: true,
            subtype: DefinitionConflictType.DIFFERENT_RESPONSIBLE_PARTY,
            confidence: clamp(0.65 + (1 - similarity) * 0.2),
            similarity,
            reason: "The definitions assign the same term to different responsible parties."
        };
    }

    if (compareAuthorityAssignments(left, right)) {
        return {
            conflict: true,
            subtype: DefinitionConflictType.DIFFERENT_AUTHORITY,
            confidence: clamp(0.62 + (1 - similarity) * 0.2),
            similarity,
            reason: "The definitions grant different authority or decision rights."
        };
    }

    if (left.expandsScope && right.restrictsScope) {
        return {
            conflict: true,
            subtype: DefinitionConflictType.SCOPE_EXPANSION,
            confidence: clamp(0.68 + (1 - similarity) * 0.2),
            similarity,
            reason: "One definition expands the term while the other restricts it."
        };
    }

    if (right.expandsScope && left.restrictsScope) {
        return {
            conflict: true,
            subtype: DefinitionConflictType.SCOPE_RESTRICTION,
            confidence: clamp(0.68 + (1 - similarity) * 0.2),
            similarity,
            reason: "One definition restricts the term while the other expands it."
        };
    }

    if (similarity <= conflictThreshold && contained < 0.5) {
        return {
            conflict: true,
            subtype: DefinitionConflictType.CONTRADICTORY_DEFINITION,
            confidence: clamp(
                0.6 +
                (1 - similarity) * 0.25 +
                Math.min(left.confidence, right.confidence) * 0.1
            ),
            similarity,
            reason: "The same term is given materially different meanings."
        };
    }

    return {
        conflict: false,
        subtype: DefinitionConflictType.NO_CONFLICT,
        confidence: 0,
        similarity,
        reason: "No material definition conflict was identified."
    };
}

function chooseGoverningDefinition(left, right) {
    if (left.authorityScore > right.authorityScore) {
        return {
            status: "provisional",
            governingNodeId: left.nodeId,
            overriddenNodeId: right.nodeId,
            rationale: "The governing definition is from the higher-authority source."
        };
    }

    if (right.authorityScore > left.authorityScore) {
        return {
            status: "provisional",
            governingNodeId: right.nodeId,
            overriddenNodeId: left.nodeId,
            rationale: "The governing definition is from the higher-authority source."
        };
    }

    if (left.revision > right.revision) {
        return {
            status: "provisional",
            governingNodeId: left.nodeId,
            overriddenNodeId: right.nodeId,
            rationale: "The governing definition is from the later revision."
        };
    }

    if (right.revision > left.revision) {
        return {
            status: "provisional",
            governingNodeId: right.nodeId,
            overriddenNodeId: left.nodeId,
            rationale: "The governing definition is from the later revision."
        };
    }

    const leftDate = left.effectiveDate?.getTime() ?? 0;
    const rightDate = right.effectiveDate?.getTime() ?? 0;

    if (leftDate > rightDate) {
        return {
            status: "provisional",
            governingNodeId: left.nodeId,
            overriddenNodeId: right.nodeId,
            rationale: "The governing definition has the later effective date."
        };
    }

    if (rightDate > leftDate) {
        return {
            status: "provisional",
            governingNodeId: right.nodeId,
            overriddenNodeId: left.nodeId,
            rationale: "The governing definition has the later effective date."
        };
    }

    return {
        status: "unresolved",
        governingNodeId: null,
        overriddenNodeId: null,
        rationale: "The definitions have equal source authority and revision status."
    };
}

function severity(subtype, confidence) {
    if (
        subtype === DefinitionConflictType.CONTRADICTORY_DEFINITION ||
        subtype === DefinitionConflictType.DIFFERENT_AUTHORITY
    ) {
        return confidence >= 0.82 ? "high" : "medium";
    }

    if (
        subtype === DefinitionConflictType.CIRCULAR_DEFINITION ||
        subtype === DefinitionConflictType.SELF_REFERENCE
    ) {
        return confidence >= 0.8 ? "high" : "medium";
    }

    if (
        subtype === DefinitionConflictType.UNDEFINED_TERM ||
        subtype === DefinitionConflictType.AMBIGUOUS_DEFINITION
    ) {
        return "medium";
    }

    return confidence >= 0.75 ? "medium" : "low";
}

function evidence(definition) {
    return {
        nodeId: definition.nodeId,
        term: definition.term,
        definition: definition.definition,
        sourceType: definition.sourceType,
        authorityScore: definition.authorityScore,
        revision: definition.revision,
        effectiveDate: definition.effectiveDate?.toISOString() ?? null,
        parties: definition.parties,
        authorities: definition.authorities,
        confidence: definition.confidence
    };
}

function definitionReferences(definition, knownTerms) {
    const normalized = lower(definition.definition);
    const references = [];

    for (const term of knownTerms) {
        if (
            term !== definition.canonical &&
            normalized.includes(term)
        ) {
            references.push(term);
        }
    }

    return unique(references);
}

function findCycles(adjacency) {
    const cycles = [];
    const visiting = new Set();
    const visited = new Set();
    const stack = [];

    function visit(node) {
        if (visiting.has(node)) {
            const index = stack.indexOf(node);

            if (index >= 0) {
                cycles.push([...stack.slice(index), node]);
            }

            return;
        }

        if (visited.has(node)) {
            return;
        }

        visiting.add(node);
        stack.push(node);

        for (const next of adjacency.get(node) || []) {
            visit(next);
        }

        stack.pop();
        visiting.delete(node);
        visited.add(node);
    }

    for (const node of adjacency.keys()) {
        visit(node);
    }

    const seen = new Set();

    return cycles.filter(cycle => {
        const key = cycle.join("→");

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

export class DefinitionRule extends ReasoningRule {
    constructor(options = {}) {
        super(
            options.name || "Definition Analysis",
            options.priority ?? 60
        );

        this.options = {
            nodeTypes:
                options.nodeTypes ||
                [...DEFINITION_NODE_TYPES],
            duplicateThreshold:
                options.duplicateThreshold ?? 0.88,
            conflictThreshold:
                options.conflictThreshold ?? 0.35,
            minimumFindingConfidence:
                options.minimumFindingConfidence ?? 0.55,
            detectUndefinedTerms:
                options.detectUndefinedTerms ?? true,
            detectCircularDefinitions:
                options.detectCircularDefinitions ?? true,
            detectAmbiguousDefinitions:
                options.detectAmbiguousDefinitions ?? true
        };
    }

    appliesTo(graph) {
        return (
            graph &&
            typeof graph.findNodes === "function"
        );
    }

    execute(graph, result) {
        const nodes = graph.findNodes({
            types: this.options.nodeTypes
        });

        const definitions = nodes.flatMap(extractDefinitions);

        const byTerm = new Map();

        for (const definition of definitions) {
            if (!byTerm.has(definition.canonical)) {
                byTerm.set(definition.canonical, []);
            }

            byTerm.get(definition.canonical).push(definition);
        }

        this.compareDefinitions(byTerm, result);

        if (this.options.detectAmbiguousDefinitions) {
            this.detectAmbiguousDefinitions(definitions, result);
        }

        if (this.options.detectCircularDefinitions) {
            this.detectCircularDefinitions(byTerm, result);
        }

        if (this.options.detectUndefinedTerms) {
            this.detectUndefinedTerms(nodes, byTerm, result);
        }

        result.metrics.definitionCount = definitions.length;
        result.metrics.definedTermCount = byTerm.size;
    }

    compareDefinitions(byTerm, result) {
        for (const [term, definitions] of byTerm.entries()) {
            if (definitions.length < 2) {
                continue;
            }

            for (let i = 0; i < definitions.length; i += 1) {
                for (let j = i + 1; j < definitions.length; j += 1) {
                    const left = definitions[i];
                    const right = definitions[j];

                    if (left.nodeId === right.nodeId) {
                        continue;
                    }

                    const comparison = classifyDefinitionConflict(
                        left,
                        right,
                        this.options
                    );

                    if (
                        !comparison.conflict ||
                        comparison.confidence <
                            this.options.minimumFindingConfidence
                    ) {
                        continue;
                    }

                    const resolution = chooseGoverningDefinition(left, right);

                    const finding = {
                        id:
                            `DEF-${term.replace(/\s+/g, "-")}-` +
                            `${left.nodeId}-${right.nodeId}`,
                        type: "definition",
                        subtype: comparison.subtype,
                        title: `Definition conflict: ${left.term}`,
                        severity: severity(
                            comparison.subtype,
                            comparison.confidence
                        ),
                        confidence: comparison.confidence,
                        nodeIds: [left.nodeId, right.nodeId],
                        term: left.term,
                        canonicalTerm: term,
                        similarity: comparison.similarity,
                        evidence: [
                            evidence(left),
                            evidence(right)
                        ],
                        resolution,
                        explanation:
                            `${comparison.reason} ` +
                            `"${left.term}" is defined as "${left.definition}" ` +
                            `in ${left.nodeId}, and as "${right.definition}" ` +
                            `in ${right.nodeId}.`
                    };

                    this.emit(result, finding);
                }
            }
        }
    }

    detectAmbiguousDefinitions(definitions, result) {
        for (const definition of definitions) {
            const tokens = tokenize(definition.definition);
            const vaguePatterns = [
                /\bas appropriate\b/i,
                /\bas necessary\b/i,
                /\bas required\b/i,
                /\breasonable\b/i,
                /\bsatisfactory\b/i,
                /\bacceptable\b/i,
                /\betc\.\b/i,
                /\band\/or\b/i,
                /\bother\b/i
            ];

            const vague = vaguePatterns
                .filter(pattern => pattern.test(definition.definition))
                .map(pattern => pattern.source);

            const tooShort = tokens.length < 3;
            const selfReference =
                lower(definition.definition)
                    .includes(definition.canonical);

            if (!tooShort && vague.length === 0 && !selfReference) {
                continue;
            }

            const subtype = selfReference
                ? DefinitionConflictType.SELF_REFERENCE
                : DefinitionConflictType.AMBIGUOUS_DEFINITION;

            const reasons = [];

            if (tooShort) reasons.push("the definition is unusually short");
            if (vague.length > 0) reasons.push("it uses subjective or open-ended language");
            if (selfReference) reasons.push("it refers to the term being defined");

            const finding = {
                id: `DEF-AMBIGUOUS-${definition.nodeId}-${definition.canonical.replace(/\s+/g, "-")}`,
                type: "definition",
                subtype,
                title: `Ambiguous definition: ${definition.term}`,
                severity: severity(subtype, 0.72),
                confidence: selfReference ? 0.88 : 0.72,
                nodeIds: [definition.nodeId],
                term: definition.term,
                evidence: [evidence(definition)],
                resolution: {
                    status: "unresolved",
                    governingNodeId: null,
                    rationale: "The definition must be clarified before reliable rule application."
                },
                explanation:
                    `The definition of "${definition.term}" is ambiguous because ${reasons.join(" and ")}.`
            };

            this.emit(result, finding);
        }
    }

    detectCircularDefinitions(byTerm, result) {
        const knownTerms = [...byTerm.keys()];
        const adjacency = new Map();

        for (const term of knownTerms) {
            adjacency.set(term, new Set());
        }

        for (const [term, definitions] of byTerm.entries()) {
            for (const definition of definitions) {
                for (const reference of definitionReferences(definition, knownTerms)) {
                    adjacency.get(term).add(reference);
                }
            }
        }

        const cycles = findCycles(adjacency);

        for (let index = 0; index < cycles.length; index += 1) {
            const cycle = cycles[index];
            const nodeIds = unique(
                cycle.flatMap(term =>
                    (byTerm.get(term) || []).map(definition => definition.nodeId)
                )
            );

            const finding = {
                id: `DEF-CYCLE-${index + 1}`,
                type: "definition",
                subtype: DefinitionConflictType.CIRCULAR_DEFINITION,
                title: "Circular definition chain detected",
                severity: "high",
                confidence: 0.94,
                nodeIds,
                terms: cycle,
                evidence: cycle.map(term => ({
                    term,
                    definitions: (byTerm.get(term) || []).map(evidence)
                })),
                resolution: {
                    status: "unresolved",
                    governingNodeId: null,
                    rationale: "At least one definition must be rewritten using an independently defined concept."
                },
                explanation:
                    `The definition chain is circular: ${cycle.join(" → ")}.`
            };

            this.emit(result, finding);
        }
    }

    detectUndefinedTerms(nodes, byTerm, result) {
        const knownTerms = new Set(byTerm.keys());

        for (const node of nodes) {
            const text = normalize([
                node.title,
                node.text,
                node.metadata?.requirement,
                node.metadata?.statement
            ].filter(Boolean).join(" "));

            const references = [
                ...text.matchAll(/\b(?:as defined|defined term|meaning of)\s+["“']?([A-Z][A-Za-z0-9 _/-]{1,60})["”']?/g)
            ];

            for (const match of references) {
                const term = normalizeTerm(match[1]);
                const canonical = canonicalTerm(term);

                if (!canonical || knownTerms.has(canonical)) {
                    continue;
                }

                const finding = {
                    id: `DEF-UNDEFINED-${node.id}-${canonical.replace(/\s+/g, "-")}`,
                    type: "definition",
                    subtype: DefinitionConflictType.UNDEFINED_TERM,
                    title: `Undefined referenced term: ${term}`,
                    severity: "medium",
                    confidence: 0.82,
                    nodeIds: [node.id],
                    term,
                    evidence: [{
                        nodeId: node.id,
                        text,
                        matchedReference: match[0]
                    }],
                    resolution: {
                        status: "unresolved",
                        governingNodeId: null,
                        rationale: "The referenced definition was not found in the analyzed document graph."
                    },
                    explanation:
                        `${node.id} references "${term}" as a defined term, but no definition was found.`
                };

                this.emit(result, finding);
            }
        }
    }

    emit(result, finding) {
        result.addFinding(finding);

        result.addExplanation({
            findingId: finding.id,
            text: finding.explanation
        });

        result.addRecommendation(
            this.buildRecommendation(finding)
        );
    }

    buildRecommendation(finding) {
        const recommendations = {
            [DefinitionConflictType.CONTRADICTORY_DEFINITION]: {
                priority: "high",
                action:
                    "Determine the controlling definition using the contract hierarchy and issue a formal clarification.",
                verification:
                    "Confirm all affected requirements use the controlling definition consistently."
            },
            [DefinitionConflictType.DIFFERENT_RESPONSIBLE_PARTY]: {
                priority: "high",
                action:
                    "Clarify which party is included within the defined term and update responsibility assignments.",
                verification:
                    "Cross-check the corrected definition against the responsibility matrix and contract clauses."
            },
            [DefinitionConflictType.DIFFERENT_AUTHORITY]: {
                priority: "high",
                action:
                    "Clarify the authority granted by the defined term before relying on approvals or directives.",
                verification:
                    "Confirm delegated authority in the governing contract document."
            },
            [DefinitionConflictType.CIRCULAR_DEFINITION]: {
                priority: "high",
                action:
                    "Rewrite at least one definition using independently defined language.",
                verification:
                    "Re-run the definition graph and confirm the circular reference is removed."
            },
            [DefinitionConflictType.SELF_REFERENCE]: {
                priority: "medium",
                action:
                    "Replace the self-referential definition with objective descriptive language.",
                verification:
                    "Confirm the revised definition can be understood without referring back to itself."
            },
            [DefinitionConflictType.UNDEFINED_TERM]: {
                priority: "medium",
                action:
                    "Locate the missing definition or add a controlled definition to the governing document set.",
                verification:
                    "Confirm the definition is indexed and linked to every use of the term."
            },
            [DefinitionConflictType.AMBIGUOUS_DEFINITION]: {
                priority: "medium",
                action:
                    "Replace subjective or open-ended wording with objective scope and criteria.",
                verification:
                    "Confirm the revised definition supports consistent enforcement and acceptance decisions."
            },
            [DefinitionConflictType.DUPLICATE_DEFINITION]: {
                priority: "low",
                action:
                    "Consolidate duplicate definitions while preserving source traceability.",
                verification:
                    "Confirm the retained definition is the controlling and latest applicable version."
            },
            [DefinitionConflictType.SCOPE_EXPANSION]: {
                priority: "high",
                action:
                    "Determine whether the broader definition was intended to modify contractual scope.",
                verification:
                    "Confirm any scope expansion is supported by an authorized modification."
            },
            [DefinitionConflictType.SCOPE_RESTRICTION]: {
                priority: "high",
                action:
                    "Determine whether the narrower definition improperly excludes required scope.",
                verification:
                    "Compare the restricted definition against the base contract and later modifications."
            }
        };

        return {
            findingId: finding.id,
            ...(recommendations[finding.subtype] || {
                priority: "medium",
                action: "Review and clarify the definition.",
                verification: "Re-run definition analysis after correction."
            })
        };
    }
}

export function registerDefinitionRule(reasoner, options = {}) {
    if (
        !reasoner ||
        typeof reasoner.registerRule !== "function"
    ) {
        throw new TypeError(
            "reasoner must provide registerRule()."
        );
    }

    reasoner.registerRule(
        new DefinitionRule(options)
    );

    return reasoner;
}

export default DefinitionRule;
