/**
 * ============================================================================
 * Mission Companion
 * Conflict Engine
 *
 * File:
 *     ConflictReasoner.js
 *
 * Purpose:
 *     Executes reasoning rules against a ConflictGraph and produces
 *     evidence-backed findings, explanations, recommendations, correlations,
 *     execution traces, and summary metrics.
 *
 * Compatibility:
 *     Preserves the existing public API:
 *       - new ConflictReasoner(graph)
 *       - registerRule(rule)
 *       - run(options)
 *       - clearCache()
 *       - explainFinding(indexOrId)
 *       - rootCause(nodeId)
 *       - recommend(nodeId)
 *       - ReasoningResult
 *       - ReasoningRule
 *       - RuleRegistry
 *       - OrphanRequirementRule
 * ============================================================================
 */
import { normalizedText as normalizeText } from "../../data-model.js";

const DEFAULT_SEVERITY_ORDER = Object.freeze({
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
    unknown: 0
});

function normalizeKey(value) {
    return normalizeText(value).toLowerCase();
}

function unique(values) {
    return [...new Set((values || []).filter(value => value !== undefined && value !== null))];
}

function nowIso() {
    return new Date().toISOString();
}

function cloneSafe(value) {
    if (value === undefined) {
        return undefined;
    }

    try {
        return structuredClone(value);
    } catch {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }
}

function durationMs(startTime) {
    return Math.max(0, Date.now() - startTime);
}

function normalizeSeverity(value) {
    const severity = normalizeKey(value);
    return Object.prototype.hasOwnProperty.call(DEFAULT_SEVERITY_ORDER, severity)
        ? severity
        : "unknown";
}

function confidenceFrom(value, fallback = 0) {
    return normalizeConfidence(value, fallback);
}

function findingIdentity(finding) {
    const evidenceSignature = (finding?.evidence || [])
        .map(entry => [
            normalizeKey(entry?.id ?? entry?.reference ?? entry?.title ?? entry?.name),
            normalizeKey(entry?.type)
        ].join("::"))
        .join("||");

    const nodeSignature = [...new Set([
        finding?.nodeId,
        finding?.governingNodeId,
        ...(finding?.nodeIds || []),
        ...(finding?.relatedNodeIds || []),
        ...(finding?.activityIds || [])
    ].filter(value => value !== undefined && value !== null && value !== ""))]
        .map(value => normalizeKey(value))
        .join("|");

    return [
        normalizeKey(finding?.rule ?? finding?.ruleName),
        normalizeKey(finding?.type),
        normalizeKey(finding?.subtype),
        nodeSignature,
        normalizeKey(finding?.title),
        normalizeKey(finding?.explanation),
        evidenceSignature
    ].join("|");
}

function recommendationIdentity(recommendation) {
    if (typeof recommendation === "string") {
        return normalizeKey(recommendation);
    }

    return [
        normalizeKey(recommendation?.findingId),
        normalizeKey(recommendation?.target ?? recommendation?.nodeId),
        normalizeKey(recommendation?.action ?? recommendation?.recommendation),
        normalizeKey(recommendation?.verification)
    ].join("|");
}

function explanationIdentity(explanation) {
    if (typeof explanation === "string") {
        return normalizeKey(explanation);
    }

    return [
        normalizeKey(explanation?.findingId),
        normalizeKey(explanation?.title),
        normalizeKey(explanation?.text ?? explanation?.explanation)
    ].join("|");
}

function ruleName(rule) {
    return normalizeText(rule?.name || rule?.constructor?.name || "Unnamed Rule");
}

function graphNodes(graph) {
    if (!graph) {
        return [];
    }

    if (typeof graph.getNodes === "function") {
        const nodes = graph.getNodes();
        return Array.isArray(nodes) ? nodes : [...(nodes || [])];
    }

    if (typeof graph.findNodes === "function") {
        const nodes = graph.findNodes({});
        return Array.isArray(nodes) ? nodes : [...(nodes || [])];
    }

    if (graph.nodes instanceof Map) {
        return [...graph.nodes.values()];
    }

    if (Array.isArray(graph.nodes)) {
        return graph.nodes;
    }

    return [];
}

function graphNode(graph, nodeId) {
    if (!graph || nodeId === undefined || nodeId === null) {
        return null;
    }

    if (typeof graph.getNode === "function") {
        return graph.getNode(nodeId) || null;
    }

    if (graph.nodes instanceof Map) {
        return graph.nodes.get(nodeId) || null;
    }

    return graphNodes(graph).find(node => node?.id === nodeId) || null;
}

function incomingEdges(graph, nodeId) {
    if (!graph) {
        return [];
    }

    if (typeof graph.getIncoming === "function") {
        return graph.getIncoming(nodeId) || [];
    }

    if (typeof graph.getIncomingEdges === "function") {
        return graph.getIncomingEdges(nodeId) || [];
    }

    return [];
}

function outgoingEdges(graph, nodeId) {
    if (!graph) {
        return [];
    }

    if (typeof graph.getOutgoing === "function") {
        return graph.getOutgoing(nodeId) || [];
    }

    if (typeof graph.getOutgoingEdges === "function") {
        return graph.getOutgoingEdges(nodeId) || [];
    }

    return [];
}

function ancestorsOf(graph, nodeId) {
    if (!graph || typeof graph.getAncestors !== "function") {
        return [];
    }

    return graph.getAncestors(nodeId) || [];
}

function normalizeFilterValue(value) {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed.toLowerCase();
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value).toLowerCase();
    }

    return null;
}

function normalizeFilterCriteria(criteria = {}) {
    if (!criteria || typeof criteria !== "object") {
        return {};
    }

    const normalized = {};

    for (const key of [
        "document",
        "section",
        "source",
        "specification",
        "responsibility",
        "type",
        "nodeId"
    ]) {
        const value = criteria[key];
        const normalizedValue = normalizeFilterValue(value);

        if (normalizedValue !== null) {
            normalized[key] = value;
        }
    }

    return normalized;
}

function mergeFilterCriteria(options = {}) {
    const directOptions = [
        "document",
        "section",
        "source",
        "specification",
        "responsibility",
        "type",
        "nodeId"
    ];
    const merged = {};
    const criteria = options.criteria && typeof options.criteria === "object"
        ? options.criteria
        : {};

    for (const key of directOptions) {
        if (options[key] !== undefined && options[key] !== null && options[key] !== "") {
            merged[key] = options[key];
        } else if (criteria[key] !== undefined && criteria[key] !== null && criteria[key] !== "") {
            merged[key] = criteria[key];
        }
    }

    return merged;
}

function stableSerialize(value) {
    if (Array.isArray(value)) {
        return JSON.stringify(value.map(item => stableSerialize(item)));
    }

    if (value && typeof value === "object") {
        const entries = Object.keys(value)
            .sort()
            .map(key => [key, stableSerialize(value[key])]);
        return JSON.stringify(Object.fromEntries(entries));
    }

    return JSON.stringify(value);
}

function stableNodeArray(nodes) {
    const stable = [];
    const seen = new Set();

    for (const node of nodes || []) {
        if (!node) {
            continue;
        }

        const nodeId = node?.id ?? node?.nodeId ?? null;
        const marker = nodeId != null ? `id:${nodeId}` : `title:${normalizeText(node?.title || node?.name || "")}`;

        if (seen.has(marker)) {
            continue;
        }

        seen.add(marker);
        stable.push(node);
    }

    return stable;
}

function resolveGraphNodes(graph, criteria = {}) {
    const effectiveCriteria = normalizeFilterCriteria(criteria || {});

    if (!graph) {
        return [];
    }

    if (typeof graph.query === "function") {
        try {
            const queryCriteria = { ...effectiveCriteria };

            if (queryCriteria.nodeId !== undefined) {
                queryCriteria.id = queryCriteria.nodeId;
                delete queryCriteria.nodeId;
            }

            const matched = graph.query(queryCriteria);
            return stableNodeArray(Array.isArray(matched) ? matched : [...(matched || [])]);
        } catch {
            // Fall through to the graph-agnostic fallback below.
        }
    }

    return stableNodeArray(graphNodes(graph).filter(node => {
        if (effectiveCriteria.type !== undefined) {
            const typeValue = normalizeFilterValue(node?.type);
            const expectedType = normalizeFilterValue(effectiveCriteria.type);

            if (typeValue !== expectedType) {
                return false;
            }
        }

        if (effectiveCriteria.nodeId !== undefined) {
            const nodeIdValue = normalizeFilterValue(node?.id);
            const expectedNodeId = normalizeFilterValue(effectiveCriteria.nodeId);

            if (nodeIdValue !== expectedNodeId) {
                return false;
            }
        }

        if (effectiveCriteria.document !== undefined) {
            const documentValue = normalizeFilterValue(node?.document ?? node?.metadata?.document);
            const expectedDocument = normalizeFilterValue(effectiveCriteria.document);

            if (documentValue !== expectedDocument) {
                return false;
            }
        }

        if (effectiveCriteria.section !== undefined) {
            const sectionValue = normalizeFilterValue(node?.section ?? node?.metadata?.section);
            const expectedSection = normalizeFilterValue(effectiveCriteria.section);

            if (sectionValue !== expectedSection) {
                return false;
            }
        }

        if (effectiveCriteria.source !== undefined) {
            const sourceValue = normalizeFilterValue(node?.source ?? node?.metadata?.source);
            const expectedSource = normalizeFilterValue(effectiveCriteria.source);

            if (sourceValue !== expectedSource) {
                return false;
            }
        }

        if (effectiveCriteria.specification !== undefined) {
            const specificationValue = normalizeFilterValue(node?.specification ?? node?.metadata?.specification);
            const expectedSpecification = normalizeFilterValue(effectiveCriteria.specification);

            if (specificationValue !== expectedSpecification) {
                return false;
            }
        }

        if (effectiveCriteria.responsibility !== undefined) {
            const responsibilityValue = normalizeFilterValue(node?.responsibility ?? node?.metadata?.responsibility);
            const expectedResponsibility = normalizeFilterValue(effectiveCriteria.responsibility);

            if (responsibilityValue !== expectedResponsibility) {
                return false;
            }
        }

        return true;
    }));
}

function appendTraceabilityValue(values, value) {
    if (value === undefined || value === null || value === "") {
        return values;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
        const exists = values.some(item => item === value || (
            typeof item === "object" && item !== null && item !== undefined &&
            (item.id != null && item.id === value.id) ||
            (item.reference != null && item.reference === value.reference) ||
            (item.title != null && item.title === value.title) ||
            (item.name != null && item.name === value.name)
        ));

        if (!exists) {
            values.push(value);
        }

        return values;
    }

    const normalized = normalizeText(value);

    if (normalized === "") {
        return values;
    }

    if (!values.some(item => normalizeText(item) === normalized)) {
        values.push(normalized);
    }

    return values;
}

function normalizeTraceabilityList(values) {
    const normalized = [];

    for (const value of values || []) {
        appendTraceabilityValue(normalized, value);
    }

    return normalized;
}

function normalizeEvidenceValues(values) {
    const normalized = [];

    for (const value of values || []) {
        appendTraceabilityValue(normalized, value);
    }

    return normalized;
}

function normalizeFindingTraceability(finding) {
    const normalized = typeof finding === "string"
        ? {
            type: "finding",
            title: finding,
            explanation: finding,
            confidence: 0.5,
            severity: "unknown"
        }
        : { ...finding };

    const nodeIds = normalizeTraceabilityList([
        normalized.nodeId,
        normalized.governingNodeId,
        ...(normalized.nodeIds || []),
        ...(normalized.relatedNodeIds || []),
        ...(normalized.activityIds || [])
    ]);

    const documents = normalizeTraceabilityList([
        ...(normalized.documents || []),
        normalized.document
    ]);

    const sections = normalizeTraceabilityList([
        ...(normalized.sections || []),
        normalized.section
    ]);

    const sources = normalizeTraceabilityList([
        ...(normalized.sources || []),
        normalized.source
    ]);

    const specifications = normalizeTraceabilityList([
        ...(normalized.specifications || []),
        normalized.specification
    ]);

    const responsibilities = normalizeTraceabilityList([
        ...(normalized.responsibilities || []),
        normalized.responsibility
    ]);

    const evidence = normalizeEvidenceValues(normalized.evidence || []);

    normalized.nodeIds = nodeIds;
    normalized.edgeIds = normalizeTraceabilityList(normalized.edgeIds || []);
    normalized.evidence = evidence;
    normalized.documents = documents;
    normalized.sections = sections;
    normalized.sources = sources;
    normalized.specifications = specifications;
    normalized.responsibilities = responsibilities;

    if (normalized.nodeId === undefined && nodeIds.length) {
        normalized.nodeId = nodeIds[0];
    }

    if (normalized.governingNodeId === undefined && normalized.nodeId) {
        normalized.governingNodeId = normalized.nodeId;
    }

    return normalized;
}

export function normalizeConfidence(value, fallback = 0) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return Math.max(0, Math.min(1, Number(fallback) || 0));
    }

    return Math.max(0, Math.min(1, numeric));
}

export class ReasoningResult {
    constructor(metadata = {}) {
        this.findings = [];
        this.explanations = [];
        this.recommendations = [];
        this.correlation = [];
        this.trace = [];
        this.errors = [];
        this.warnings = [];
        this.summary = null;
        this._findingOrder = new Map();
        this.metadata = {
            createdAt: nowIso(),
            completedAt: null,
            ...metadata
        };
        this.metrics = {
            rulesRegistered: 0,
            rulesConsidered: 0,
            rulesExecuted: 0,
            rulesSkipped: 0,
            ruleFailures: 0,
            findingsGenerated: 0,
            explanationsGenerated: 0,
            recommendationsGenerated: 0,
            duplicateFindingsRemoved: 0,
            duplicateExplanationsRemoved: 0,
            duplicateRecommendationsRemoved: 0,
            executionTimeMs: 0,
            ...metadata.metrics
        };
    }

    addFinding(finding) {
        if (!finding) {
            return null;
        }

        const normalized = normalizeFindingTraceability(finding);
        normalized.confidence = confidenceFrom(normalized.confidence, 0.5);
        normalized.severity = normalizeSeverity(normalized.severity);

        if (!normalized.id) {
            normalized.id = `finding-${this.findings.length + 1}`;
        }

        this.findings.push(normalized);
        this._findingOrder.set(normalized.id, this.findings.length - 1);
        this.metrics.findingsGenerated = this.findings.length;
        return normalized;
    }

    addExplanation(explanation) {
        if (!explanation) {
            return null;
        }

        const normalized = typeof explanation === "string"
            ? { text: explanation }
            : { ...explanation };

        if (!normalized.id) {
            normalized.id = `explanation-${this.explanations.length + 1}`;
        }

        this.explanations.push(normalized);
        this.metrics.explanationsGenerated = this.explanations.length;
        return normalized;
    }

    addRecommendation(recommendation) {
        if (!recommendation) {
            return null;
        }

        const normalized = typeof recommendation === "string"
            ? {
                action: recommendation,
                recommendation
            }
            : { ...recommendation };

        if (!normalized.id) {
            normalized.id = `recommendation-${this.recommendations.length + 1}`;
        }

        this.recommendations.push(normalized);
        this.metrics.recommendationsGenerated = this.recommendations.length;
        return normalized;
    }

    addError(error) {
        const normalized = error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
            : {
                message: normalizeText(error)
            };

        this.errors.push(normalized);
        return normalized;
    }

    addWarning(warning) {
        const normalized = typeof warning === "string"
            ? { message: warning }
            : { ...warning };

        this.warnings.push(normalized);
        return normalized;
    }

    getFinding(indexOrId) {
        if (typeof indexOrId === "number") {
            return this.findings[indexOrId] || null;
        }

        return this.findings.find(finding => finding.id === indexOrId) || null;
    }

    deduplicate() {
        const beforeFindings = this.findings.length;
        const beforeExplanations = this.explanations.length;
        const beforeRecommendations = this.recommendations.length;

        const findings = new Map();
        for (const finding of this.findings) {
            const key = findingIdentity(finding);
            const current = findings.get(key);

            if (!current || confidenceFrom(finding.confidence) > confidenceFrom(current.confidence)) {
                findings.set(key, finding);
            }
        }

        const explanations = new Map();
        for (const explanation of this.explanations) {
            const key = explanationIdentity(explanation);
            if (!explanations.has(key)) {
                explanations.set(key, explanation);
            }
        }

        const recommendations = new Map();
        for (const recommendation of this.recommendations) {
            const key = recommendationIdentity(recommendation);
            if (!recommendations.has(key)) {
                recommendations.set(key, recommendation);
            }
        }

        this.findings = [...findings.values()];
        this.explanations = [...explanations.values()];
        this.recommendations = [...recommendations.values()];

        this.metrics.duplicateFindingsRemoved += beforeFindings - this.findings.length;
        this.metrics.duplicateExplanationsRemoved += beforeExplanations - this.explanations.length;
        this.metrics.duplicateRecommendationsRemoved += beforeRecommendations - this.recommendations.length;
        this.metrics.findingsGenerated = this.findings.length;
        this.metrics.explanationsGenerated = this.explanations.length;
        this.metrics.recommendationsGenerated = this.recommendations.length;

        return this;
    }

    filterFindings(criteria = {}) {
        const normalizedCriteria = criteria && typeof criteria === "object" ? criteria : {};

        return this.findings.filter(finding => {
            const normalized = normalizeFindingTraceability(finding);

            if (normalizedCriteria.id !== undefined && normalized.id !== normalizedCriteria.id) {
                return false;
            }

            if (normalizedCriteria.rule !== undefined) {
                const expectedRule = normalizeFilterValue(normalizedCriteria.rule);
                const actualRule = normalizeFilterValue(normalized.rule ?? normalized.ruleName ?? "");
                if (actualRule !== expectedRule) {
                    return false;
                }
            }

            if (normalizedCriteria.type !== undefined) {
                const expectedType = normalizeFilterValue(normalizedCriteria.type);
                const actualType = normalizeFilterValue(normalized.type);
                if (actualType !== expectedType) {
                    return false;
                }
            }

            if (normalizedCriteria.subtype !== undefined) {
                const expectedSubtype = normalizeFilterValue(normalizedCriteria.subtype);
                const actualSubtype = normalizeFilterValue(normalized.subtype);
                if (actualSubtype !== expectedSubtype) {
                    return false;
                }
            }

            if (normalizedCriteria.severity !== undefined) {
                const expectedSeverity = normalizeFilterValue(normalizedCriteria.severity);
                const actualSeverity = normalizeFilterValue(normalized.severity);
                if (actualSeverity !== expectedSeverity) {
                    return false;
                }
            }

            if (normalizedCriteria.nodeId !== undefined) {
                const expectedNodeId = normalizeFilterValue(normalizedCriteria.nodeId);
                const actualNodeId = normalizeFilterValue(normalized.nodeId ?? normalized.governingNodeId);
                if (actualNodeId !== expectedNodeId) {
                    return false;
                }
            }

            if (normalizedCriteria.document !== undefined) {
                const expectedDocument = normalizeFilterValue(normalizedCriteria.document);
                const actualDocument = normalizeFilterValue((normalized.documents || [normalized.document]).find(Boolean));
                if (actualDocument !== expectedDocument) {
                    return false;
                }
            }

            if (normalizedCriteria.section !== undefined) {
                const expectedSection = normalizeFilterValue(normalizedCriteria.section);
                const actualSection = normalizeFilterValue((normalized.sections || [normalized.section]).find(Boolean));
                if (actualSection !== expectedSection) {
                    return false;
                }
            }

            if (normalizedCriteria.source !== undefined) {
                const expectedSource = normalizeFilterValue(normalizedCriteria.source);
                const actualSource = normalizeFilterValue((normalized.sources || [normalized.source]).find(Boolean));
                if (actualSource !== expectedSource) {
                    return false;
                }
            }

            if (normalizedCriteria.specification !== undefined) {
                const expectedSpecification = normalizeFilterValue(normalizedCriteria.specification);
                const actualSpecification = normalizeFilterValue((normalized.specifications || [normalized.specification]).find(Boolean));
                if (actualSpecification !== expectedSpecification) {
                    return false;
                }
            }

            if (normalizedCriteria.responsibility !== undefined) {
                const expectedResponsibility = normalizeFilterValue(normalizedCriteria.responsibility);
                const actualResponsibility = normalizeFilterValue((normalized.responsibilities || [normalized.responsibility]).find(Boolean));
                if (actualResponsibility !== expectedResponsibility) {
                    return false;
                }
            }

            if (normalizedCriteria.minimumConfidence !== undefined) {
                const minimum = normalizeConfidence(normalizedCriteria.minimumConfidence, 0);
                const actual = confidenceFrom(normalized.confidence, 0);
                if (actual < minimum) {
                    return false;
                }
            }

            return true;
        });
    }

    sortFindings(sortBy = "severity", direction = "desc") {
        const normalizedDirection = normalizeKey(direction) === "asc" ? "asc" : "desc";
        const sortField = normalizeText(sortBy || "severity").toLowerCase();

        this.findings.sort((left, right) => {
            const leftFinding = normalizeFindingTraceability(left);
            const rightFinding = normalizeFindingTraceability(right);

            if (sortField === "rule") {
                const ruleDelta = normalizeText(leftFinding.rule ?? leftFinding.ruleName ?? "")
                    .localeCompare(normalizeText(rightFinding.rule ?? rightFinding.ruleName ?? ""));
                return normalizedDirection === "asc" ? ruleDelta : -ruleDelta;
            }

            if (sortField === "confidence") {
                const confidenceDelta = confidenceFrom(rightFinding.confidence) - confidenceFrom(leftFinding.confidence);
                if (confidenceDelta !== 0) {
                    return normalizedDirection === "asc" ? -confidenceDelta : confidenceDelta;
                }
            } else if (sortField === "severity") {
                const severityDelta = DEFAULT_SEVERITY_ORDER[normalizeSeverity(rightFinding.severity)] - DEFAULT_SEVERITY_ORDER[normalizeSeverity(leftFinding.severity)];
                if (severityDelta !== 0) {
                    return normalizedDirection === "asc" ? -severityDelta : severityDelta;
                }
            } else if (sortField === "sourceorder") {
                const leftOrder = this._findingOrder.get(leftFinding.id) ?? 0;
                const rightOrder = this._findingOrder.get(rightFinding.id) ?? 0;
                const orderDelta = leftOrder - rightOrder;
                return normalizedDirection === "asc" ? orderDelta : -orderDelta;
            }

            const leftId = normalizeText(leftFinding.id || "");
            const rightId = normalizeText(rightFinding.id || "");
            return normalizedDirection === "asc"
                ? leftId.localeCompare(rightId)
                : rightId.localeCompare(leftId);
        });

        return this;
    }

    toJSON() {
        return {
            findings: cloneSafe(this.findings),
            explanations: cloneSafe(this.explanations),
            recommendations: cloneSafe(this.recommendations),
            correlation: cloneSafe(this.correlation),
            trace: cloneSafe(this.trace),
            errors: cloneSafe(this.errors),
            warnings: cloneSafe(this.warnings),
            summary: cloneSafe(this.summary),
            metadata: cloneSafe(this.metadata),
            metrics: cloneSafe(this.metrics)
        };
    }
}

export class ReasoningRule {
    constructor(name, priority = 100, options = {}) {
        this.name = normalizeText(name || this.constructor.name);
        this.priority = Number.isFinite(Number(priority)) ? Number(priority) : 100;
        this.enabled = options.enabled !== false;
        this.dependencies = unique(options.dependencies || []);
        this.tags = unique(options.tags || []);
    }

    appliesTo(_graph, _context = {}) {
        return true;
    }

    execute(_graph, _result, _context = {}) {
        throw new Error("execute() must be implemented.");
    }
}

export class RuleRegistry {
    constructor() {
        this.rules = [];
    }

    register(rule) {
        if (!rule || typeof rule.execute !== "function") {
            throw new TypeError("A reasoning rule must provide execute(graph, result, context).");
        }

        const name = ruleName(rule);
        const existingIndex = this.rules.findIndex(candidate => ruleName(candidate) === name);

        if (existingIndex >= 0) {
            this.rules[existingIndex] = rule;
        } else {
            this.rules.push(rule);
        }

        this.rules.sort((left, right) => {
            const priorityDelta = Number(left.priority ?? 100) - Number(right.priority ?? 100);
            return priorityDelta || ruleName(left).localeCompare(ruleName(right));
        });

        return this;
    }

    unregister(nameOrRule) {
        const targetName = typeof nameOrRule === "string"
            ? normalizeText(nameOrRule)
            : ruleName(nameOrRule);

        const before = this.rules.length;
        this.rules = this.rules.filter(rule => ruleName(rule) !== targetName);
        return before !== this.rules.length;
    }

    clear() {
        this.rules = [];
        return this;
    }

    get(name) {
        const target = normalizeText(name);
        return this.rules.find(rule => ruleName(rule) === target) || null;
    }

    has(name) {
        return Boolean(this.get(name));
    }

    getRules(options = {}) {
        const {
            enabledOnly = false,
            tags = null
        } = options;

        return this.rules.filter(rule => {
            if (enabledOnly && rule.enabled === false) {
                return false;
            }

            if (Array.isArray(tags) && tags.length) {
                return tags.some(tag => rule.tags?.includes(tag));
            }

            return true;
        });
    }

    size() {
        return this.rules.length;
    }
}

export class ConflictReasoner {
    constructor(graph, options = {}) {
        this.graph = graph;
        this.registry = new RuleRegistry();
        this.cache = new Map();
        this.options = {
            continueOnRuleError: options.continueOnRuleError !== false,
            deduplicate: options.deduplicate !== false,
            correlate: options.correlate !== false,
            rankRecommendations: options.rankRecommendations !== false,
            buildSummary: options.buildSummary !== false
        };
        this.lastResult = null;
    }

    registerRule(rule) {
        this.registry.register(rule);
        this.clearCache();
        return this;
    }

    unregisterRule(nameOrRule) {
        const removed = this.registry.unregister(nameOrRule);
        if (removed) {
            this.clearCache();
        }
        return removed;
    }

    hasRule(name) {
        return this.registry.has(name);
    }

    getRule(name) {
        return this.registry.get(name);
    }

    listRules(options = {}) {
        return this.registry.getRules(options);
    }

    clearRules() {
        this.registry.clear();
        this.clearCache();
        return this;
    }

    setGraph(graph) {
        this.graph = graph;
        this.clearCache();
        return this;
    }

    run(options = {}) {
        const startedAt = Date.now();
        const {
            useCache = true,
            cacheKey = undefined,
            force = false,
            ruleNames = null,
            tags = null,
            context = {},
            continueOnRuleError = this.options.continueOnRuleError,
            deduplicate = this.options.deduplicate,
            correlate = this.options.correlate,
            rankRecommendations = this.options.rankRecommendations,
            buildSummary = this.options.buildSummary,
            document = undefined,
            section = undefined,
            source = undefined,
            specification = undefined,
            responsibility = undefined,
            type = undefined,
            nodeId = undefined,
            criteria = {}
        } = options;

        const effectiveCriteria = mergeFilterCriteria({
            criteria,
            document,
            section,
            source,
            specification,
            responsibility,
            type,
            nodeId
        });
        const hasEffectiveFilters = Object.keys(effectiveCriteria).length > 0;
        const candidateNodes = resolveGraphNodes(this.graph, effectiveCriteria);
        const candidateNodeIds = candidateNodes.map(node => node?.id).filter(Boolean);

        const requestedNames = Array.isArray(ruleNames)
            ? new Set(ruleNames.map(normalizeText))
            : null;
        const requestedTags = Array.isArray(tags)
            ? new Set(tags.map(normalizeText))
            : null;
        const baseCacheKey = cacheKey === undefined || cacheKey === null ? "default" : normalizeText(cacheKey);
        const cacheKeyParts = [
            baseCacheKey,
            requestedNames ? [...requestedNames].sort().join(",") : "",
            requestedTags ? [...requestedTags].sort().join(",") : "",
            stableSerialize(effectiveCriteria)
        ];
        const resolvedCacheKey = hasEffectiveFilters || requestedNames || requestedTags || (cacheKey !== undefined && cacheKey !== null)
            ? cacheKeyParts.join("::")
            : baseCacheKey;

        if (!force && useCache && this.cache.has(resolvedCacheKey)) {
            return this.cache.get(resolvedCacheKey);
        }

        const result = new ReasoningResult({
            cacheKey: resolvedCacheKey,
            graphNodeCount: graphNodes(this.graph).length
        });

        const registeredRules = this.registry.getRules({ enabledOnly: false, tags });
        result.metrics.rulesRegistered = registeredRules.length;

        const availableNames = new Set(registeredRules.map(ruleName));

        for (const rule of registeredRules) {
            result.metrics.rulesConsidered += 1;

            const name = ruleName(rule);
            const ruleStartedAt = Date.now();

            if (rule.enabled === false) {
                result.metrics.rulesSkipped += 1;
                result.trace.push({
                    rule: name,
                    status: "disabled",
                    durationMs: 0
                });
                continue;
            }

            if (requestedNames && !requestedNames.has(name)) {
                result.metrics.rulesSkipped += 1;
                result.trace.push({
                    rule: name,
                    status: "not_requested",
                    durationMs: 0
                });
                continue;
            }

            const missingDependencies = (rule.dependencies || [])
                .filter(dependency => !availableNames.has(dependency));

            if (missingDependencies.length) {
                result.metrics.rulesSkipped += 1;
                result.addWarning({
                    rule: name,
                    message: `Rule skipped because dependencies are not registered: ${missingDependencies.join(", ")}.`,
                    missingDependencies
                });
                result.trace.push({
                    rule: name,
                    status: "missing_dependencies",
                    durationMs: 0,
                    missingDependencies
                });
                continue;
            }

            let applies = false;

            try {
                applies = rule.appliesTo(this.graph, context) !== false;
            } catch (error) {
                result.metrics.ruleFailures += 1;
                result.addError({
                    rule: name,
                    phase: "appliesTo",
                    message: error.message,
                    stack: error.stack
                });
                result.trace.push({
                    rule: name,
                    status: "failed",
                    phase: "appliesTo",
                    durationMs: durationMs(ruleStartedAt),
                    error: error.message
                });

                if (!continueOnRuleError) {
                    throw error;
                }

                continue;
            }

            if (!applies) {
                result.metrics.rulesSkipped += 1;
                result.trace.push({
                    rule: name,
                    status: "not_applicable",
                    durationMs: durationMs(ruleStartedAt)
                });
                continue;
            }

            const before = {
                findings: result.findings.length,
                explanations: result.explanations.length,
                recommendations: result.recommendations.length
            };

            const ruleContext = {
                ...context,
                reasoner: this,
                rule,
                result,
                criteria: effectiveCriteria,
                nodes: candidateNodes,
                nodeIds: candidateNodeIds,
                filtered: hasEffectiveFilters
            };

            const originalAddFinding = result.addFinding.bind(result);

            try {
                result.addFinding = finding => {
                    const normalizedFinding = originalAddFinding(finding);
                    if (normalizedFinding && !normalizedFinding.rule) {
                        normalizedFinding.rule = rule.name || ruleName(rule);
                    }
                    return normalizedFinding;
                };

                rule.execute(this.graph, result, ruleContext);

                result.metrics.rulesExecuted += 1;
                result.trace.push({
                    rule: name,
                    status: "executed",
                    durationMs: durationMs(ruleStartedAt),
                    produced: {
                        findings: result.findings.length - before.findings,
                        explanations: result.explanations.length - before.explanations,
                        recommendations: result.recommendations.length - before.recommendations
                    }
                });
            } catch (error) {
                result.metrics.ruleFailures += 1;
                result.addError({
                    rule: name,
                    phase: "execute",
                    message: error.message,
                    stack: error.stack
                });
                result.trace.push({
                    rule: name,
                    status: "failed",
                    phase: "execute",
                    durationMs: durationMs(ruleStartedAt),
                    error: error.message
                });

                if (!continueOnRuleError) {
                    throw error;
                }
            } finally {
                result.addFinding = originalAddFinding;
            }
        }

        if (deduplicate) {
            result.deduplicate();
        }

        if (correlate) {
            this.correlate(result);
        }

        if (rankRecommendations) {
            this.rankRecommendations(result);
        }

        this.linkExplanationsAndRecommendations(result);

        if (buildSummary) {
            result.summary = this.buildSummary(result);
        }

        result.metrics.executionTimeMs = durationMs(startedAt);
        result.metadata.completedAt = nowIso();
        result.metadata.criteria = cloneSafe(effectiveCriteria);
        result.metadata.filtered = hasEffectiveFilters;
        result.metadata.candidateNodeCount = candidateNodes.length;
        result.metadata.candidateNodeIds = candidateNodeIds;
        this.lastResult = result;

        if (useCache) {
            this.cache.set(resolvedCacheKey, result);
        }

        return result;
    }

    clearCache(cacheKey = null) {
        if (cacheKey === null || cacheKey === undefined) {
            this.cache.clear();
        } else {
            this.cache.delete(cacheKey);
        }

        return this;
    }

    analyze(options = {}) {
        return this.run(options);
    }

    analyzeNode(nodeId, options = {}) {
        return this.analyze({
            ...options,
            nodeId: nodeId ?? options.nodeId
        });
    }

    analyzeDocument(document, options = {}) {
        return this.analyze({
            ...options,
            document: document ?? options.document
        });
    }

    analyzeSection(section, options = {}) {
        return this.analyze({
            ...options,
            section: section ?? options.section
        });
    }

    analyzeSpecification(specification, options = {}) {
        return this.analyze({
            ...options,
            specification: specification ?? options.specification
        });
    }

    analyzeResponsibility(responsibility, options = {}) {
        return this.analyze({
            ...options,
            responsibility: responsibility ?? options.responsibility
        });
    }

    explainFinding(indexOrId, options = {}) {
        const result = options.result || this.lastResult || this.run();
        const finding = result.getFinding(indexOrId);

        if (!finding) {
            return null;
        }

        const explanations = result.explanations.filter(explanation =>
            explanation.findingId === finding.id ||
            explanation.nodeId === finding.nodeId ||
            explanation.governingNodeId === finding.governingNodeId
        );

        const recommendations = result.recommendations.filter(recommendation =>
            recommendation.findingId === finding.id ||
            recommendation.target === finding.nodeId ||
            recommendation.nodeId === finding.nodeId
        );

        return {
            id: finding.id,
            title: finding.title || "Finding",
            type: finding.type || "unknown",
            subtype: finding.subtype || null,
            severity: normalizeSeverity(finding.severity),
            confidence: confidenceFrom(finding.confidence, 0.5),
            evidence: finding.evidence || [],
            explanation:
                finding.explanation ||
                explanations[0]?.text ||
                explanations[0]?.explanation ||
                "",
            explanations,
            recommendations,
            source: finding.source || null
        };
    }

    rootCause(nodeId, options = {}) {
        const {
            maximumDepth = 20,
            includeTarget = false
        } = options;

        const target = graphNode(this.graph, nodeId);
        const directAncestors = ancestorsOf(this.graph, nodeId);
        const candidates = [];
        const seen = new Set();

        const addCandidate = (node, depth, basis) => {
            if (!node || seen.has(node.id) || depth > maximumDepth) {
                return;
            }

            seen.add(node.id);
            candidates.push({
                id: node.id,
                title: node.title || node.name || String(node.id),
                type: node.type || "unknown",
                depth,
                basis,
                confidence: normalizeConfidence(1 / Math.max(1, depth), 0.5)
            });
        };

        if (includeTarget && target) {
            addCandidate(target, 0, "target");
        }

        for (const ancestor of directAncestors) {
            addCandidate(ancestor, 1, "graph_ancestor");
        }

        if (!directAncestors.length) {
            for (const edge of incomingEdges(this.graph, nodeId)) {
                const sourceId = edge?.from ?? edge?.source ?? edge?.sourceId;
                const source = graphNode(this.graph, sourceId);
                addCandidate(source, 1, "incoming_edge");
            }
        }

        candidates.sort((left, right) =>
            left.depth - right.depth ||
            right.confidence - left.confidence ||
            left.title.localeCompare(right.title)
        );

        return {
            target: nodeId,
            targetNode: target
                ? {
                    id: target.id,
                    title: target.title || target.name || String(target.id),
                    type: target.type || "unknown"
                }
                : null,
            probableRootCauses: candidates
        };
    }

    recommend(nodeId, options = {}) {
        const root = this.rootCause(nodeId, options);

        if (!root.probableRootCauses.length) {
            return [{
                target: nodeId,
                priority: "medium",
                action:
                    `Review node "${nodeId}" and establish its governing requirement, prerequisite, and evidence path.`,
                verification:
                    "Confirm the node is connected to at least one governing or prerequisite graph node."
            }];
        }

        return root.probableRootCauses.map((item, index) => ({
            target: nodeId,
            sourceNodeId: item.id,
            priority: index === 0 ? "high" : "medium",
            confidence: item.confidence,
            action:
                `Review "${item.title}" before resolving "${nodeId}" and confirm its requirements are satisfied.`,
            recommendation:
                `Review "${item.title}" before resolving "${nodeId}".`,
            verification:
                `Document how "${item.title}" governs or contributes to resolution of "${nodeId}".`
        }));
    }

    correlate(result) {
        const groups = new Map();

        for (const finding of result.findings) {
            const references = unique([
                finding.governingNodeId,
                finding.nodeId,
                ...(finding.activityIds || []),
                ...(finding.relatedNodeIds || [])
            ]);

            const key = references.length
                ? references.sort().join("|")
                : normalizeKey(finding.title || finding.type || finding.id);

            if (!groups.has(key)) {
                groups.set(key, {
                    id: `correlation-${groups.size + 1}`,
                    key,
                    nodeIds: references,
                    findingIds: [],
                    types: [],
                    highestSeverity: "unknown",
                    maximumConfidence: 0
                });
            }

            const group = groups.get(key);
            group.findingIds.push(finding.id);
            group.types = unique([...group.types, finding.type, finding.subtype]);
            group.maximumConfidence = Math.max(
                group.maximumConfidence,
                confidenceFrom(finding.confidence)
            );

            if (
                DEFAULT_SEVERITY_ORDER[normalizeSeverity(finding.severity)] >
                DEFAULT_SEVERITY_ORDER[group.highestSeverity]
            ) {
                group.highestSeverity = normalizeSeverity(finding.severity);
            }
        }

        result.correlation = [...groups.values()]
            .sort((left, right) =>
                DEFAULT_SEVERITY_ORDER[right.highestSeverity] -
                DEFAULT_SEVERITY_ORDER[left.highestSeverity] ||
                right.maximumConfidence - left.maximumConfidence
            );

        result.metrics.correlatedGroups = result.correlation.length;
        return result.correlation;
    }

    rankRecommendations(result) {
        const findingById = new Map(result.findings.map(finding => [finding.id, finding]));

        result.recommendations.sort((left, right) => {
            const leftFinding = findingById.get(left.findingId);
            const rightFinding = findingById.get(right.findingId);

            const leftSeverity = normalizeSeverity(
                left.priority || left.severity || leftFinding?.severity
            );
            const rightSeverity = normalizeSeverity(
                right.priority || right.severity || rightFinding?.severity
            );

            const severityDelta =
                DEFAULT_SEVERITY_ORDER[rightSeverity] -
                DEFAULT_SEVERITY_ORDER[leftSeverity];

            if (severityDelta) {
                return severityDelta;
            }

            const confidenceDelta =
                confidenceFrom(right.confidence ?? rightFinding?.confidence) -
                confidenceFrom(left.confidence ?? leftFinding?.confidence);

            if (confidenceDelta) {
                return confidenceDelta;
            }

            return normalizeText(left.action ?? left.recommendation)
                .localeCompare(normalizeText(right.action ?? right.recommendation));
        });

        result.recommendations.forEach((recommendation, index) => {
            recommendation.rank = index + 1;
        });

        return result.recommendations;
    }

    linkExplanationsAndRecommendations(result) {
        const findingByNode = new Map();

        for (const finding of result.findings) {
            for (const nodeId of unique([
                finding.nodeId,
                finding.governingNodeId,
                ...(finding.activityIds || [])
            ])) {
                if (!findingByNode.has(nodeId)) {
                    findingByNode.set(nodeId, []);
                }
                findingByNode.get(nodeId).push(finding);
            }
        }

        for (const explanation of result.explanations) {
            if (explanation.findingId) {
                continue;
            }

            const nodeId = explanation.nodeId ?? explanation.governingNodeId;
            const matches = findingByNode.get(nodeId) || [];

            if (matches.length === 1) {
                explanation.findingId = matches[0].id;
            }
        }

        for (const recommendation of result.recommendations) {
            if (recommendation.findingId) {
                continue;
            }

            const nodeId = recommendation.target ?? recommendation.nodeId;
            const matches = findingByNode.get(nodeId) || [];

            if (matches.length === 1) {
                recommendation.findingId = matches[0].id;
            }
        }

        return result;
    }

    buildSummary(result) {
        const bySeverity = {};
        const byType = {};
        const findingsByRule = {};

        for (const finding of result.findings) {
            const severity = normalizeSeverity(finding.severity);
            const type = normalizeText(finding.type || "unknown");
            const ruleNameValue = normalizeText(finding.rule || finding.ruleName || "unknown");

            bySeverity[severity] = (bySeverity[severity] || 0) + 1;
            byType[type] = (byType[type] || 0) + 1;
            findingsByRule[ruleNameValue] = (findingsByRule[ruleNameValue] || 0) + 1;
        }

        const criticalCount = bySeverity.critical || 0;
        const highCount = bySeverity.high || 0;
        const mediumCount = bySeverity.medium || 0;

        return {
            status:
                criticalCount > 0 ? "critical" :
                highCount > 0 ? "attention_required" :
                mediumCount > 0 ? "review_required" :
                result.findings.length > 0 ? "minor_findings" :
                result.errors.length > 0 ? "execution_error" :
                "clear",
            findings: result.findings.length,
            explanations: result.explanations.length,
            recommendations: result.recommendations.length,
            correlatedGroups: result.correlation.length,
            errors: result.errors.length,
            warnings: result.warnings.length,
            filtered: Boolean(result.metadata.filtered),
            candidateNodeCount: result.metadata.candidateNodeCount ?? 0,
            criteria: cloneSafe(result.metadata.criteria || {}),
            findingsByRule,
            bySeverity,
            byType,
            rules: {
                registered: result.metrics.rulesRegistered,
                considered: result.metrics.rulesConsidered,
                executed: result.metrics.rulesExecuted,
                skipped: result.metrics.rulesSkipped,
                failed: result.metrics.ruleFailures
            },
            executionTimeMs: result.metrics.executionTimeMs,
            workflowScore: result.metrics.workflowScore ?? null
        };
    }
}

/* --------------------------------------------------------------------------
   Built-in production rule
--------------------------------------------------------------------------- */

export class OrphanRequirementRule extends ReasoningRule {
    constructor(options = {}) {
        super("Orphan Requirement", options.priority ?? 10, options);
    }

    appliesTo(graph) {
        return Boolean(graph) && (
            typeof graph.getNodesByType === "function" ||
            graphNodes(graph).some(node => normalizeKey(node?.type) === "requirement")
        );
    }

    execute(graph, result, context = {}) {
        const requirements = context.filtered
            ? (context.nodes || []).filter(node => normalizeKey(node?.type) === "requirement")
            : typeof graph.getNodesByType === "function"
                ? graph.getNodesByType("requirement") || []
                : graphNodes(graph).filter(node => normalizeKey(node?.type) === "requirement");

        for (const node of requirements) {
            const incoming = incomingEdges(graph, node.id);
            const outgoing = outgoingEdges(graph, node.id);

            if (incoming.length !== 0 || outgoing.length !== 0) {
                continue;
            }

            const finding = result.addFinding({
                type: "orphan",
                subtype: "orphan_requirement",
                title: node.title || node.name || `Requirement ${node.id}`,
                nodeId: node.id,
                governingNodeId: node.id,
                severity: "medium",
                confidence: 0.90,
                explanation:
                    "Requirement has no incoming or outgoing graph relationships.",
                evidence: [{
                    nodeId: node.id,
                    title: node.title || node.name || "",
                    type: node.type || "requirement"
                }]
            });

            result.addExplanation({
                findingId: finding.id,
                nodeId: node.id,
                title: "Unlinked requirement",
                text:
                    "The requirement is isolated from the graph, so the engine cannot determine what governs it, what depends on it, or what evidence satisfies it.",
                evidence: finding.evidence
            });

            result.addRecommendation({
                findingId: finding.id,
                target: node.id,
                priority: "medium",
                action:
                    `Review requirement "${finding.title}" and establish its governing, dependency, responsibility, and evidence relationships.`,
                verification:
                    "Confirm the requirement has at least one valid incoming or outgoing graph relationship."
            });
        }
    }
}

export default ConflictReasoner;
