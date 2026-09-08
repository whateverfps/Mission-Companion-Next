/**
 * ============================================================================
 * Mission Companion
 * Conflict Engine
 *
 * File:
 *     ConflictGraph.js
 *
 * Build:
 *     Commit 3
 *
 * Purpose:
 *     Directed weighted graph used by the reasoning engine.
 *
 * Commit 2 adds:
 *     - Breadth-first traversal
 *     - Depth-first traversal
 *     - Reachability checks
 *     - Ancestor and descendant lookup
 *     - Shortest-path search
 *     - Directed-cycle detection
 *     - Topological sorting
 *     - Weakly connected components
 *     - Subgraph extraction
 *     - Serialization and deserialization
 *
 * Commit 3 adds:
 *     - Advanced node and edge queries
 *     - Weighted shortest-path search
 *     - Simple-path enumeration
 *     - Strongly connected components
 *     - Condensation graph generation
 *     - Influence scoring
 *     - Critical-path analysis for acyclic graphs
 *     - Graph cloning and merging
 *     - Structural integrity validation
 * ============================================================================
 */

export const NodeType = Object.freeze({
    REQUIREMENT: "requirement",
    DOCUMENT: "document",
    SECTION: "section",
    PERSON: "person",
    ROLE: "role",
    SPECIFICATION: "specification",
    DRAWING: "drawing",
    DELIVERABLE: "deliverable",
    RISK: "risk",
    QUESTION: "question",
    DECISION: "decision",
    CONFLICT: "conflict"
});

export const EdgeType = Object.freeze({
    REFERENCES: "references",
    REQUIRES: "requires",
    DEPENDS_ON: "depends_on",
    SATISFIES: "satisfies",
    CONTRADICTS: "contradicts",
    DEFINES: "defines",
    IMPLEMENTS: "implements",
    RESPONSIBLE_FOR: "responsible_for",
    PRECEDES: "precedes",
    SUPPORTS: "supports"
});

function uuid(prefix = "ID") {
    return (
        `${prefix}-` +
        Math.random().toString(36).substring(2, 12) +
        "-" +
        Date.now().toString(36)
    );
}

function assertNonEmptyString(value, name) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new TypeError(`${name} must be a non-empty string.`);
    }
}

function clonePlainObject(value) {
    return value == null
        ? {}
        : JSON.parse(JSON.stringify(value));
}

function normalizeIndexValue(value) {
    if (value == null) {
        return null;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    return null;
}

export class ConflictNode {
    constructor(data = {}) {
        this.id = data.id || uuid("N");
        this.type = data.type || NodeType.REQUIREMENT;
        this.title = data.title || "";
        this.text = data.text || "";
        this.source = data.source || "";
        this.document = data.document || "";
        this.section = data.section || "";
        this.metadata = clonePlainObject(data.metadata);
        this.evidence = Array.isArray(data.evidence)
            ? data.evidence.map(clonePlainObject)
            : [];
    }

    addEvidence(evidence) {
        if (evidence == null || typeof evidence !== "object") {
            throw new TypeError("Evidence must be an object.");
        }

        this.evidence.push(clonePlainObject(evidence));
        return this;
    }


    findEdges(options = {}) {
        const {
            from = null,
            to = null,
            types = null,
            minimumWeight = null,
            maximumWeight = null,
            minimumConfidence = null,
            maximumConfidence = null,
            predicate = null
        } = options;

        const allowedTypes = types
            ? new Set(Array.isArray(types) ? types : [types])
            : null;

        return [...this.edges.values()].filter(edge => {
            if (from !== null && edge.from !== from) {
                return false;
            }

            if (to !== null && edge.to !== to) {
                return false;
            }

            if (allowedTypes && !allowedTypes.has(edge.type)) {
                return false;
            }

            if (
                minimumWeight !== null &&
                edge.weight < minimumWeight
            ) {
                return false;
            }

            if (
                maximumWeight !== null &&
                edge.weight > maximumWeight
            ) {
                return false;
            }

            if (
                minimumConfidence !== null &&
                edge.confidence < minimumConfidence
            ) {
                return false;
            }

            if (
                maximumConfidence !== null &&
                edge.confidence > maximumConfidence
            ) {
                return false;
            }

            if (
                typeof predicate === "function" &&
                !predicate(edge)
            ) {
                return false;
            }

            return true;
        });
    }

    findNodes(options = {}) {
        const {
            types = null,
            source = null,
            document = null,
            section = null,
            text = null,
            predicate = null
        } = options;

        const allowedTypes = types
            ? new Set(Array.isArray(types) ? types : [types])
            : null;

        const normalizedText =
            typeof text === "string"
                ? text.toLowerCase()
                : null;

        return [...this.nodes.values()].filter(node => {
            if (allowedTypes && !allowedTypes.has(node.type)) {
                return false;
            }

            if (source !== null && node.source !== source) {
                return false;
            }

            if (document !== null && node.document !== document) {
                return false;
            }

            if (section !== null && node.section !== section) {
                return false;
            }

            if (normalizedText !== null) {
                const haystack = [
                    node.title,
                    node.text,
                    node.source,
                    node.document,
                    node.section
                ]
                    .join(" ")
                    .toLowerCase();

                if (!haystack.includes(normalizedText)) {
                    return false;
                }
            }

            if (
                typeof predicate === "function" &&
                !predicate(node)
            ) {
                return false;
            }

            return true;
        });
    }

    degree(nodeId, options = {}) {
        const {
            direction = "both",
            edgeTypes = null,
            weighted = false,
            confidenceAdjusted = false
        } = options;

        if (!this.nodes.has(nodeId)) {
            return 0;
        }

        let edges;

        if (direction === "outgoing") {
            edges = this.getOutgoing(nodeId, { edgeTypes });
        } else if (direction === "incoming") {
            edges = this.getIncoming(nodeId, { edgeTypes });
        } else if (direction === "both") {
            const ids = new Set();
            edges = [];

            for (const edge of [
                ...this.getOutgoing(nodeId, { edgeTypes }),
                ...this.getIncoming(nodeId, { edgeTypes })
            ]) {
                if (!ids.has(edge.id)) {
                    ids.add(edge.id);
                    edges.push(edge);
                }
            }
        } else {
            throw new Error(`Unsupported direction: ${direction}`);
        }

        if (!weighted) {
            return edges.length;
        }

        return edges.reduce((sum, edge) => {
            const adjustment =
                confidenceAdjusted
                    ? edge.confidence
                    : 1;

            return sum + edge.weight * adjustment;
        }, 0);
    }

    weightedShortestPath(fromId, toId, options = {}) {
        const {
            direction = "outgoing",
            edgeTypes = null,
            cost = "weight",
            customCost = null
        } = options;

        if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
            return null;
        }

        if (fromId === toId) {
            return {
                nodes: [this.nodes.get(fromId)],
                edges: [],
                distance: 0,
                cost: 0
            };
        }

        const edgeCost = edge => {
            if (typeof customCost === "function") {
                const value = customCost(edge);

                if (!Number.isFinite(value) || value < 0) {
                    throw new TypeError(
                        "customCost must return a finite non-negative number."
                    );
                }

                return value;
            }

            if (cost === "weight") {
                return edge.weight;
            }

            if (cost === "inverse-confidence") {
                return 1 - edge.confidence;
            }

            if (cost === "risk") {
                return edge.weight * (1 - edge.confidence);
            }

            throw new Error(`Unsupported cost mode: ${cost}`);
        };

        const distance = new Map();
        const previous = new Map();
        const unvisited = new Set(this.nodes.keys());

        for (const nodeId of this.nodes.keys()) {
            distance.set(nodeId, Infinity);
        }

        distance.set(fromId, 0);

        while (unvisited.size > 0) {
            let currentId = null;
            let currentDistance = Infinity;

            for (const nodeId of unvisited) {
                const candidate = distance.get(nodeId);

                if (candidate < currentDistance) {
                    currentDistance = candidate;
                    currentId = nodeId;
                }
            }

            if (currentId === null || currentDistance === Infinity) {
                break;
            }

            unvisited.delete(currentId);

            if (currentId === toId) {
                break;
            }

            const neighbors = this.getNeighbors(currentId, {
                direction,
                edgeTypes,
                includeEdges: true
            });

            for (const { node, edge } of neighbors) {
                if (!unvisited.has(node.id)) {
                    continue;
                }

                const alternative =
                    currentDistance +
                    edgeCost(edge);

                if (alternative < distance.get(node.id)) {
                    distance.set(node.id, alternative);
                    previous.set(node.id, {
                        nodeId: currentId,
                        edge
                    });
                }
            }
        }

        if (!previous.has(toId)) {
            return null;
        }

        const nodeIds = [toId];
        const edges = [];
        let cursor = toId;

        while (cursor !== fromId) {
            const step = previous.get(cursor);

            if (!step) {
                return null;
            }

            edges.push(step.edge);
            cursor = step.nodeId;
            nodeIds.push(cursor);
        }

        nodeIds.reverse();
        edges.reverse();

        return {
            nodes: nodeIds.map(id => this.nodes.get(id)),
            edges,
            distance: edges.length,
            cost: distance.get(toId)
        };
    }

    allSimplePaths(fromId, toId, options = {}) {
        const {
            direction = "outgoing",
            edgeTypes = null,
            maxDepth = 12,
            maxPaths = 1000
        } = options;

        if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
            return [];
        }

        if (!Number.isInteger(maxDepth) || maxDepth < 0) {
            throw new TypeError("maxDepth must be a non-negative integer.");
        }

        if (!Number.isInteger(maxPaths) || maxPaths < 1) {
            throw new TypeError("maxPaths must be a positive integer.");
        }

        const paths = [];
        const visited = new Set([fromId]);
        const nodePath = [fromId];
        const edgePath = [];

        const walk = currentId => {
            if (paths.length >= maxPaths) {
                return;
            }

            if (currentId === toId) {
                paths.push({
                    nodes: nodePath.map(id => this.nodes.get(id)),
                    edges: [...edgePath],
                    distance: edgePath.length,
                    weight: edgePath.reduce(
                        (sum, edge) => sum + edge.weight,
                        0
                    ),
                    confidence: edgePath.length === 0
                        ? 1
                        : edgePath.reduce(
                            (product, edge) =>
                                product * edge.confidence,
                            1
                        )
                });

                return;
            }

            if (edgePath.length >= maxDepth) {
                return;
            }

            const neighbors = this.getNeighbors(currentId, {
                direction,
                edgeTypes,
                includeEdges: true
            });

            for (const { node, edge } of neighbors) {
                if (visited.has(node.id)) {
                    continue;
                }

                visited.add(node.id);
                nodePath.push(node.id);
                edgePath.push(edge);

                walk(node.id);

                edgePath.pop();
                nodePath.pop();
                visited.delete(node.id);

                if (paths.length >= maxPaths) {
                    return;
                }
            }
        };

        walk(fromId);

        return paths;
    }

    stronglyConnectedComponents(options = {}) {
        const { edgeTypes = null } = options;
        let index = 0;
        const indexes = new Map();
        const lowLinks = new Map();
        const stack = [];
        const onStack = new Set();
        const components = [];

        const strongConnect = nodeId => {
            indexes.set(nodeId, index);
            lowLinks.set(nodeId, index);
            index += 1;

            stack.push(nodeId);
            onStack.add(nodeId);

            for (const edge of this.getOutgoing(nodeId, { edgeTypes })) {
                const nextId = edge.to;

                if (!indexes.has(nextId)) {
                    strongConnect(nextId);
                    lowLinks.set(
                        nodeId,
                        Math.min(
                            lowLinks.get(nodeId),
                            lowLinks.get(nextId)
                        )
                    );
                } else if (onStack.has(nextId)) {
                    lowLinks.set(
                        nodeId,
                        Math.min(
                            lowLinks.get(nodeId),
                            indexes.get(nextId)
                        )
                    );
                }
            }

            if (lowLinks.get(nodeId) === indexes.get(nodeId)) {
                const component = [];
                let memberId;

                do {
                    memberId = stack.pop();
                    onStack.delete(memberId);
                    component.push(this.nodes.get(memberId));
                } while (memberId !== nodeId);

                components.push(component);
            }
        };

        for (const nodeId of this.nodes.keys()) {
            if (!indexes.has(nodeId)) {
                strongConnect(nodeId);
            }
        }

        return components;
    }

    condensationGraph(options = {}) {
        const components =
            this.stronglyConnectedComponents(options);

        const componentByNode = new Map();
        const graph = new ConflictGraph();

        components.forEach((members, index) => {
            const componentId = `SCC-${index + 1}`;

            graph.addNode({
                id: componentId,
                type: "component",
                title: `Strongly Connected Component ${index + 1}`,
                text: members
                    .map(node => node.title || node.id)
                    .join("; "),
                metadata: {
                    memberIds: members.map(node => node.id),
                    size: members.length
                }
            });

            for (const node of members) {
                componentByNode.set(node.id, componentId);
            }
        });

        const edgeSignatures = new Set();

        for (const edge of this.edges.values()) {
            const fromComponent =
                componentByNode.get(edge.from);

            const toComponent =
                componentByNode.get(edge.to);

            if (
                !fromComponent ||
                !toComponent ||
                fromComponent === toComponent
            ) {
                continue;
            }

            const signature =
                `${fromComponent}|${toComponent}|${edge.type}`;

            if (edgeSignatures.has(signature)) {
                continue;
            }

            edgeSignatures.add(signature);

            graph.addEdge({
                from: fromComponent,
                to: toComponent,
                type: edge.type,
                weight: edge.weight,
                confidence: edge.confidence,
                metadata: {
                    condensedFromEdgeId: edge.id
                }
            });
        }

        return {
            graph,
            components,
            componentByNode
        };
    }

    influenceScores(options = {}) {
        const {
            edgeTypes = null,
            damping = 0.85,
            iterations = 50,
            tolerance = 1e-8,
            useConfidence = true,
            useWeight = true
        } = options;

        if (
            !Number.isFinite(damping) ||
            damping <= 0 ||
            damping >= 1
        ) {
            throw new TypeError(
                "damping must be greater than 0 and less than 1."
            );
        }

        if (!Number.isInteger(iterations) || iterations < 1) {
            throw new TypeError(
                "iterations must be a positive integer."
            );
        }

        const nodeIds = [...this.nodes.keys()];
        const count = nodeIds.length;

        if (count === 0) {
            return [];
        }

        let scores = new Map(
            nodeIds.map(id => [id, 1 / count])
        );

        for (let iteration = 0; iteration < iterations; iteration += 1) {
            const next = new Map(
                nodeIds.map(id => [
                    id,
                    (1 - damping) / count
                ])
            );

            let danglingMass = 0;

            for (const nodeId of nodeIds) {
                const outgoing =
                    this.getOutgoing(nodeId, { edgeTypes });

                if (outgoing.length === 0) {
                    danglingMass += scores.get(nodeId);
                    continue;
                }

                const strengths = outgoing.map(edge => {
                    let value = 1;

                    if (useWeight) {
                        value *= edge.weight;
                    }

                    if (useConfidence) {
                        value *= edge.confidence;
                    }

                    return Math.max(value, Number.EPSILON);
                });

                const totalStrength = strengths.reduce(
                    (sum, value) => sum + value,
                    0
                );

                outgoing.forEach((edge, index) => {
                    const share =
                        scores.get(nodeId) *
                        (strengths[index] / totalStrength);

                    next.set(
                        edge.to,
                        next.get(edge.to) +
                        damping * share
                    );
                });
            }

            if (danglingMass > 0) {
                const share =
                    damping *
                    danglingMass /
                    count;

                for (const nodeId of nodeIds) {
                    next.set(
                        nodeId,
                        next.get(nodeId) + share
                    );
                }
            }

            let difference = 0;

            for (const nodeId of nodeIds) {
                difference += Math.abs(
                    next.get(nodeId) -
                    scores.get(nodeId)
                );
            }

            scores = next;

            if (difference <= tolerance) {
                break;
            }
        }

        return [...scores.entries()]
            .map(([nodeId, score]) => ({
                node: this.nodes.get(nodeId),
                score
            }))
            .sort((a, b) => b.score - a.score);
    }

    criticalPath(options = {}) {
        const {
            edgeTypes = null,
            duration = node => {
                const value =
                    Number(node.metadata?.duration);

                return Number.isFinite(value)
                    ? value
                    : 0;
            }
        } = options;

        if (typeof duration !== "function") {
            throw new TypeError("duration must be a function.");
        }

        const order = this.topologicalSort({ edgeTypes });
        const earliestFinish = new Map();
        const previous = new Map();

        for (const node of order) {
            const nodeDuration = duration(node);

            if (
                !Number.isFinite(nodeDuration) ||
                nodeDuration < 0
            ) {
                throw new TypeError(
                    `Duration for node ${node.id} must be a finite non-negative number.`
                );
            }

            const incoming =
                this.getIncoming(node.id, { edgeTypes });

            let bestStart = 0;
            let bestPredecessor = null;
            let bestEdge = null;

            for (const edge of incoming) {
                const predecessorFinish =
                    earliestFinish.get(edge.from) || 0;

                if (predecessorFinish > bestStart) {
                    bestStart = predecessorFinish;
                    bestPredecessor = edge.from;
                    bestEdge = edge;
                }
            }

            earliestFinish.set(
                node.id,
                bestStart + nodeDuration
            );

            if (bestPredecessor !== null) {
                previous.set(node.id, {
                    nodeId: bestPredecessor,
                    edge: bestEdge
                });
            }
        }

        let finishNodeId = null;
        let totalDuration = -Infinity;

        for (const [nodeId, finish] of earliestFinish.entries()) {
            if (finish > totalDuration) {
                totalDuration = finish;
                finishNodeId = nodeId;
            }
        }

        if (finishNodeId === null) {
            return {
                nodes: [],
                edges: [],
                duration: 0
            };
        }

        const nodeIds = [finishNodeId];
        const edges = [];
        let cursor = finishNodeId;

        while (previous.has(cursor)) {
            const step = previous.get(cursor);
            edges.push(step.edge);
            cursor = step.nodeId;
            nodeIds.push(cursor);
        }

        nodeIds.reverse();
        edges.reverse();

        return {
            nodes: nodeIds.map(id => this.nodes.get(id)),
            edges,
            duration: totalDuration,
            earliestFinish
        };
    }

    merge(otherGraph, options = {}) {
        const {
            overwriteNodes = false,
            overwriteEdges = false
        } = options;

        if (!(otherGraph instanceof ConflictGraph)) {
            throw new TypeError(
                "otherGraph must be a ConflictGraph."
            );
        }

        const result = {
            nodesAdded: 0,
            nodesSkipped: 0,
            nodesOverwritten: 0,
            edgesAdded: 0,
            edgesSkipped: 0,
            edgesOverwritten: 0
        };

        for (const node of otherGraph.nodes.values()) {
            const exists = this.nodes.has(node.id);

            if (exists && !overwriteNodes) {
                result.nodesSkipped += 1;
                continue;
            }

            this.addNode(
                new ConflictNode(node.toJSON())
            );

            if (exists) {
                result.nodesOverwritten += 1;
            } else {
                result.nodesAdded += 1;
            }
        }

        for (const edge of otherGraph.edges.values()) {
            const exists = this.edges.has(edge.id);

            if (exists && !overwriteEdges) {
                result.edgesSkipped += 1;
                continue;
            }

            if (
                !this.nodes.has(edge.from) ||
                !this.nodes.has(edge.to)
            ) {
                result.edgesSkipped += 1;
                continue;
            }

            this.addEdge(
                new ConflictEdge(edge.toJSON())
            );

            if (exists) {
                result.edgesOverwritten += 1;
            } else {
                result.edgesAdded += 1;
            }
        }

        return result;
    }

    clone() {
        return ConflictGraph.fromJSON(this.toJSON());
    }

    validateIntegrity() {
        const errors = [];
        const warnings = [];

        for (const [nodeId, node] of this.nodes.entries()) {
            if (node.id !== nodeId) {
                errors.push(
                    `Node map key ${nodeId} does not match node id ${node.id}.`
                );
            }

            if (!this.outgoing.has(nodeId)) {
                errors.push(
                    `Missing outgoing index for node ${nodeId}.`
                );
            }

            if (!this.incoming.has(nodeId)) {
                errors.push(
                    `Missing incoming index for node ${nodeId}.`
                );
            }

            if (!this.byType.get(node.type)?.has(nodeId)) {
                errors.push(
                    `Node ${nodeId} is missing from type index ${node.type}.`
                );
            }
        }

        for (const [edgeId, edge] of this.edges.entries()) {
            if (edge.id !== edgeId) {
                errors.push(
                    `Edge map key ${edgeId} does not match edge id ${edge.id}.`
                );
            }

            if (!this.nodes.has(edge.from)) {
                errors.push(
                    `Edge ${edgeId} references missing source node ${edge.from}.`
                );
            }

            if (!this.nodes.has(edge.to)) {
                errors.push(
                    `Edge ${edgeId} references missing destination node ${edge.to}.`
                );
            }

            if (!this.outgoing.get(edge.from)?.has(edgeId)) {
                errors.push(
                    `Edge ${edgeId} is missing from outgoing index for ${edge.from}.`
                );
            }

            if (!this.incoming.get(edge.to)?.has(edgeId)) {
                errors.push(
                    `Edge ${edgeId} is missing from incoming index for ${edge.to}.`
                );
            }
        }

        for (const [nodeId, edgeIds] of this.outgoing.entries()) {
            if (!this.nodes.has(nodeId)) {
                errors.push(
                    `Outgoing index exists for unknown node ${nodeId}.`
                );
            }

            for (const edgeId of edgeIds) {
                const edge = this.edges.get(edgeId);

                if (!edge) {
                    errors.push(
                        `Outgoing index for ${nodeId} references missing edge ${edgeId}.`
                    );
                } else if (edge.from !== nodeId) {
                    errors.push(
                        `Outgoing index for ${nodeId} contains edge ${edgeId} whose source is ${edge.from}.`
                    );
                }
            }
        }

        for (const [nodeId, edgeIds] of this.incoming.entries()) {
            if (!this.nodes.has(nodeId)) {
                errors.push(
                    `Incoming index exists for unknown node ${nodeId}.`
                );
            }

            for (const edgeId of edgeIds) {
                const edge = this.edges.get(edgeId);

                if (!edge) {
                    errors.push(
                        `Incoming index for ${nodeId} references missing edge ${edgeId}.`
                    );
                } else if (edge.to !== nodeId) {
                    errors.push(
                        `Incoming index for ${nodeId} contains edge ${edgeId} whose destination is ${edge.to}.`
                    );
                }
            }
        }

        for (const [type, nodeIds] of this.byType.entries()) {
            for (const nodeId of nodeIds) {
                const node = this.nodes.get(nodeId);

                if (!node) {
                    errors.push(
                        `Type index ${type} references missing node ${nodeId}.`
                    );
                } else if (node.type !== type) {
                    errors.push(
                        `Type index ${type} contains node ${nodeId} whose type is ${node.type}.`
                    );
                }
            }

            if (nodeIds.size === 0) {
                warnings.push(
                    `Type index ${type} is empty.`
                );
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            statistics: this.statistics()
        };
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            title: this.title,
            text: this.text,
            source: this.source,
            document: this.document,
            section: this.section,
            metadata: clonePlainObject(this.metadata),
            evidence: this.evidence.map(clonePlainObject)
        };
    }
}

export class ConflictEdge {
    constructor({
        id,
        from,
        to,
        type,
        weight = 1,
        confidence = 1,
        metadata = {}
    } = {}) {
        assertNonEmptyString(from, "from");
        assertNonEmptyString(to, "to");
        assertNonEmptyString(type, "type");

        if (!Number.isFinite(weight) || weight < 0) {
            throw new TypeError("weight must be a finite non-negative number.");
        }

        if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
            throw new TypeError("confidence must be between 0 and 1.");
        }

        this.id = id || uuid("E");
        this.from = from;
        this.to = to;
        this.type = type;
        this.weight = weight;
        this.confidence = confidence;
        this.metadata = clonePlainObject(metadata);
    }

    toJSON() {
        return {
            id: this.id,
            from: this.from,
            to: this.to,
            type: this.type,
            weight: this.weight,
            confidence: this.confidence,
            metadata: clonePlainObject(this.metadata)
        };
    }
}

export class ConflictGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.outgoing = new Map();
        this.incoming = new Map();
        this.byType = new Map();
        this.byDocument = new Map();
        this.bySection = new Map();
        this.bySource = new Map();
        this.bySpecification = new Map();
        this.byResponsibility = new Map();
        this.byEvidence = new Map();
    }

    indexNode(node) {
        if (!(node instanceof ConflictNode)) {
            node = new ConflictNode(node);
        }

        this.#addIndex(this.byDocument, node.document, node.id);
        this.#addIndex(this.bySection, node.section, node.id);
        this.#addIndex(this.bySource, node.source, node.id);
        this.#addIndex(this.bySpecification, node.metadata?.specification, node.id);
        this.#addIndex(this.byResponsibility, node.metadata?.responsibility, node.id);

        if (Array.isArray(node.evidence)) {
            for (const evidence of node.evidence) {
                if (!evidence || typeof evidence !== "object") {
                    continue;
                }

                for (const key of ["id", "reference", "title", "name"]) {
                    this.#addIndex(this.byEvidence, evidence[key], node.id);
                }
            }
        }

        return node;
    }

    removeIndexes(node) {
        if (!node) {
            return;
        }

        this.#removeIndex(this.byDocument, node.document, node.id);
        this.#removeIndex(this.bySection, node.section, node.id);
        this.#removeIndex(this.bySource, node.source, node.id);
        this.#removeIndex(this.bySpecification, node.metadata?.specification, node.id);
        this.#removeIndex(this.byResponsibility, node.metadata?.responsibility, node.id);

        if (Array.isArray(node.evidence)) {
            for (const evidence of node.evidence) {
                if (!evidence || typeof evidence !== "object") {
                    continue;
                }

                for (const key of ["id", "reference", "title", "name"]) {
                    this.#removeIndex(this.byEvidence, evidence[key], node.id);
                }
            }
        }
    }

    #addIndex(indexMap, value, id) {
        const normalized = normalizeIndexValue(value);

        if (normalized === null) {
            return;
        }

        if (!indexMap.has(normalized)) {
            indexMap.set(normalized, new Set());
        }

        indexMap.get(normalized).add(id);
    }

    #removeIndex(indexMap, value, id) {
        const normalized = normalizeIndexValue(value);

        if (normalized === null) {
            return;
        }

        const bucket = indexMap.get(normalized);

        if (!bucket) {
            return;
        }

        bucket.delete(id);

        if (bucket.size === 0) {
            indexMap.delete(normalized);
        }
    }

    clear() {
        this.nodes.clear();
        this.edges.clear();
        this.outgoing.clear();
        this.incoming.clear();
        this.byType.clear();
        this.byDocument.clear();
        this.bySection.clear();
        this.bySource.clear();
        this.bySpecification.clear();
        this.byResponsibility.clear();
        this.byEvidence.clear();
    }

    addNode(node) {
        if (!(node instanceof ConflictNode)) {
            node = new ConflictNode(node);
        }

        const existing = this.nodes.get(node.id);

        if (existing) {
            this.removeIndexes(existing);

            if (existing.type !== node.type) {
                this.byType.get(existing.type)?.delete(existing.id);
            }
        }

        this.nodes.set(node.id, node);

        if (!this.outgoing.has(node.id)) {
            this.outgoing.set(node.id, new Set());
        }

        if (!this.incoming.has(node.id)) {
            this.incoming.set(node.id, new Set());
        }

        if (!this.byType.has(node.type)) {
            this.byType.set(node.type, new Set());
        }

        this.byType.get(node.type).add(node.id);
        this.indexNode(node);

        return node;
    }

    getNode(id) {
        return this.nodes.get(id) || null;
    }

    hasNode(id) {
        return this.nodes.has(id);
    }

    removeNode(id) {
        if (!this.nodes.has(id)) {
            return false;
        }

        const outgoingIds = [...(this.outgoing.get(id) || [])];
        const incomingIds = [...(this.incoming.get(id) || [])];

        for (const edgeId of outgoingIds) {
            this.removeEdge(edgeId);
        }

        for (const edgeId of incomingIds) {
            this.removeEdge(edgeId);
        }

        const node = this.nodes.get(id);
        this.removeIndexes(node);
        this.byType.get(node.type)?.delete(id);

        if (this.byType.get(node.type)?.size === 0) {
            this.byType.delete(node.type);
        }

        this.nodes.delete(id);
        this.outgoing.delete(id);
        this.incoming.delete(id);

        return true;
    }

    addEdge(edge) {
        if (!(edge instanceof ConflictEdge)) {
            edge = new ConflictEdge(edge);
        }

        if (!this.nodes.has(edge.from)) {
            throw new Error(`Unknown source node: ${edge.from}`);
        }

        if (!this.nodes.has(edge.to)) {
            throw new Error(`Unknown destination node: ${edge.to}`);
        }

        const existing = this.edges.get(edge.id);

        if (existing) {
            this.outgoing.get(existing.from)?.delete(existing.id);
            this.incoming.get(existing.to)?.delete(existing.id);
        }

        this.edges.set(edge.id, edge);
        this.outgoing.get(edge.from).add(edge.id);
        this.incoming.get(edge.to).add(edge.id);

        return edge;
    }

    getEdge(id) {
        return this.edges.get(id) || null;
    }

    hasEdge(id) {
        return this.edges.has(id);
    }

    removeEdge(edgeId) {
        const edge = this.edges.get(edgeId);

        if (!edge) {
            return false;
        }

        this.outgoing.get(edge.from)?.delete(edgeId);
        this.incoming.get(edge.to)?.delete(edgeId);
        this.edges.delete(edgeId);

        return true;
    }

    getOutgoing(nodeId, options = {}) {
        const { edgeTypes = null } = options;

        const allowed = edgeTypes
            ? new Set(Array.isArray(edgeTypes) ? edgeTypes : [edgeTypes])
            : null;

        return [...(this.outgoing.get(nodeId) || [])]
            .map(id => this.edges.get(id))
            .filter(Boolean)
            .filter(edge => !allowed || allowed.has(edge.type));
    }

    getIncoming(nodeId, options = {}) {
        const { edgeTypes = null } = options;

        const allowed = edgeTypes
            ? new Set(Array.isArray(edgeTypes) ? edgeTypes : [edgeTypes])
            : null;

        return [...(this.incoming.get(nodeId) || [])]
            .map(id => this.edges.get(id))
            .filter(Boolean)
            .filter(edge => !allowed || allowed.has(edge.type));
    }

    getNeighbors(nodeId, options = {}) {
        const {
            direction = "outgoing",
            edgeTypes = null,
            includeEdges = false
        } = options;

        if (!this.nodes.has(nodeId)) {
            return [];
        }

        let edges = [];

        if (direction === "outgoing") {
            edges = this.getOutgoing(nodeId, { edgeTypes });
        } else if (direction === "incoming") {
            edges = this.getIncoming(nodeId, { edgeTypes });
        } else if (direction === "both") {
            edges = [
                ...this.getOutgoing(nodeId, { edgeTypes }),
                ...this.getIncoming(nodeId, { edgeTypes })
            ];
        } else {
            throw new Error(`Unsupported direction: ${direction}`);
        }

        const seen = new Set();
        const result = [];

        for (const edge of edges) {
            const neighborId =
                edge.from === nodeId
                    ? edge.to
                    : edge.from;

            if (seen.has(neighborId)) {
                continue;
            }

            seen.add(neighborId);

            const node = this.nodes.get(neighborId);

            if (!node) {
                continue;
            }

            result.push(
                includeEdges
                    ? { node, edge }
                    : node
            );
        }

        return result;
    }

    getNodesByType(type) {
        return [...(this.byType.get(type) || [])]
            .map(id => this.nodes.get(id))
            .filter(Boolean);
    }

    getNodesByDocument(document) {
        const normalized = normalizeIndexValue(document);

        if (normalized === null) {
            return [];
        }

        return [...(this.byDocument.get(normalized) || [])]
            .map(id => this.nodes.get(id))
            .filter(Boolean);
    }

    getNodesBySection(section) {
        const normalized = normalizeIndexValue(section);

        if (normalized === null) {
            return [];
        }

        return [...(this.bySection.get(normalized) || [])]
            .map(id => this.nodes.get(id))
            .filter(Boolean);
    }

    getNodesBySource(source) {
        const normalized = normalizeIndexValue(source);

        if (normalized === null) {
            return [];
        }

        return [...(this.bySource.get(normalized) || [])]
            .map(id => this.nodes.get(id))
            .filter(Boolean);
    }

    getNodesBySpecification(specification) {
        const normalized = normalizeIndexValue(specification);

        if (normalized === null) {
            return [];
        }

        return [...(this.bySpecification.get(normalized) || [])]
            .map(id => this.nodes.get(id))
            .filter(Boolean);
    }

    getNodesByResponsibility(responsibility) {
        const normalized = normalizeIndexValue(responsibility);

        if (normalized === null) {
            return [];
        }

        return [...(this.byResponsibility.get(normalized) || [])]
            .map(id => this.nodes.get(id))
            .filter(Boolean);
    }

    getEvidence(value) {
        const normalized = normalizeIndexValue(value);

        if (normalized === null) {
            return [];
        }

        return [...(this.byEvidence.get(normalized) || [])]
            .map(id => this.nodes.get(id))
            .filter(Boolean);
    }

    query(criteria = {}) {
        if (!criteria || typeof criteria !== "object") {
            throw new TypeError("criteria must be an object.");
        }

        const {
            document = null,
            section = null,
            source = null,
            specification = null,
            responsibility = null,
            evidence = null,
            type = null,
            id = null,
            title = null,
            text = null
        } = criteria;

        const indexedCriteria = [
            { value: document, index: this.byDocument },
            { value: section, index: this.bySection },
            { value: source, index: this.bySource },
            { value: specification, index: this.bySpecification },
            { value: responsibility, index: this.byResponsibility },
            { value: evidence, index: this.byEvidence }
        ];

        let candidates = null;

        for (const criterion of indexedCriteria) {
            if (criterion.value == null) {
                continue;
            }

            const normalized = normalizeIndexValue(criterion.value);

            if (normalized === null) {
                continue;
            }

            const matchingNodes = [...(criterion.index.get(normalized) || [])]
                .map(nodeId => this.nodes.get(nodeId))
                .filter(Boolean);

            if (candidates === null) {
                candidates = matchingNodes;
            } else {
                const candidateIds = new Set(candidates.map(node => node.id));
                candidates = matchingNodes.filter(node => candidateIds.has(node.id));
            }

            if (candidates.length === 0) {
                return [];
            }
        }

        const baseNodes = candidates === null
            ? [...this.nodes.values()]
            : candidates;

        return baseNodes.filter(node => {
            if (type !== null && node.type !== type) {
                return false;
            }

            if (id !== null && node.id !== id) {
                return false;
            }

            if (title !== null) {
                const searchText = String(title).toLowerCase();
                const haystack = [node.title, node.text, node.source, node.document, node.section]
                    .join(" ")
                    .toLowerCase();

                if (!haystack.includes(searchText)) {
                    return false;
                }
            }

            if (text !== null) {
                const searchText = String(text).toLowerCase();
                const haystack = [node.title, node.text, node.source, node.document, node.section]
                    .join(" ")
                    .toLowerCase();

                if (!haystack.includes(searchText)) {
                    return false;
                }
            }

            return true;
        });
    }

    rebuildIndexes() {
        for (const index of [
            this.byDocument,
            this.bySection,
            this.bySource,
            this.bySpecification,
            this.byResponsibility,
            this.byEvidence
        ]) {
            index.clear();
        }

        for (const node of this.nodes.values()) {
            this.indexNode(node);
        }

        return this;
    }

    nodeCount() {
        return this.nodes.size;
    }

    edgeCount() {
        return this.edges.size;
    }

    statistics() {
        const nodeTypes = {};

        for (const [type, ids] of this.byType.entries()) {
            nodeTypes[type] = ids.size;
        }

        return {
            nodes: this.nodeCount(),
            edges: this.edgeCount(),
            nodeTypes
        };
    }

    breadthFirst(startId, options = {}) {
        const {
            direction = "outgoing",
            edgeTypes = null,
            maxDepth = Infinity,
            includeStart = true,
            visitor = null
        } = options;

        if (!this.nodes.has(startId)) {
            return [];
        }

        const queue = [{ id: startId, depth: 0 }];
        const visited = new Set([startId]);
        const result = [];

        while (queue.length > 0) {
            const current = queue.shift();
            const node = this.nodes.get(current.id);

            if (includeStart || current.id !== startId) {
                const entry = {
                    node,
                    depth: current.depth
                };

                result.push(entry);

                if (typeof visitor === "function") {
                    const shouldContinue = visitor(entry);

                    if (shouldContinue === false) {
                        break;
                    }
                }
            }

            if (current.depth >= maxDepth) {
                continue;
            }

            const neighbors = this.getNeighbors(current.id, {
                direction,
                edgeTypes
            });

            for (const neighbor of neighbors) {
                if (visited.has(neighbor.id)) {
                    continue;
                }

                visited.add(neighbor.id);
                queue.push({
                    id: neighbor.id,
                    depth: current.depth + 1
                });
            }
        }

        return result;
    }

    depthFirst(startId, options = {}) {
        const {
            direction = "outgoing",
            edgeTypes = null,
            maxDepth = Infinity,
            includeStart = true,
            visitor = null
        } = options;

        if (!this.nodes.has(startId)) {
            return [];
        }

        const stack = [{ id: startId, depth: 0 }];
        const visited = new Set();
        const result = [];

        while (stack.length > 0) {
            const current = stack.pop();

            if (visited.has(current.id)) {
                continue;
            }

            visited.add(current.id);

            const node = this.nodes.get(current.id);

            if (includeStart || current.id !== startId) {
                const entry = {
                    node,
                    depth: current.depth
                };

                result.push(entry);

                if (typeof visitor === "function") {
                    const shouldContinue = visitor(entry);

                    if (shouldContinue === false) {
                        break;
                    }
                }
            }

            if (current.depth >= maxDepth) {
                continue;
            }

            const neighbors = this.getNeighbors(current.id, {
                direction,
                edgeTypes
            });

            for (let i = neighbors.length - 1; i >= 0; i -= 1) {
                const neighbor = neighbors[i];

                if (!visited.has(neighbor.id)) {
                    stack.push({
                        id: neighbor.id,
                        depth: current.depth + 1
                    });
                }
            }
        }

        return result;
    }

    isReachable(fromId, toId, options = {}) {
        if (fromId === toId) {
            return this.nodes.has(fromId);
        }

        const visited = this.breadthFirst(fromId, {
            ...options,
            includeStart: false
        });

        return visited.some(entry => entry.node.id === toId);
    }

    getDescendants(nodeId, options = {}) {
        return this.breadthFirst(nodeId, {
            ...options,
            direction: "outgoing",
            includeStart: false
        }).map(entry => entry.node);
    }

    getAncestors(nodeId, options = {}) {
        return this.breadthFirst(nodeId, {
            ...options,
            direction: "incoming",
            includeStart: false
        }).map(entry => entry.node);
    }

    shortestPath(fromId, toId, options = {}) {
        const {
            direction = "outgoing",
            edgeTypes = null
        } = options;

        if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
            return null;
        }

        if (fromId === toId) {
            return {
                nodes: [this.nodes.get(fromId)],
                edges: [],
                distance: 0
            };
        }

        const queue = [fromId];
        const visited = new Set([fromId]);
        const previous = new Map();

        while (queue.length > 0) {
            const currentId = queue.shift();

            const neighborEntries = this.getNeighbors(currentId, {
                direction,
                edgeTypes,
                includeEdges: true
            });

            for (const { node, edge } of neighborEntries) {
                if (visited.has(node.id)) {
                    continue;
                }

                visited.add(node.id);
                previous.set(node.id, {
                    nodeId: currentId,
                    edge
                });

                if (node.id === toId) {
                    const nodeIds = [toId];
                    const edges = [];
                    let cursor = toId;

                    while (cursor !== fromId) {
                        const step = previous.get(cursor);

                        if (!step) {
                            return null;
                        }

                        edges.push(step.edge);
                        cursor = step.nodeId;
                        nodeIds.push(cursor);
                    }

                    nodeIds.reverse();
                    edges.reverse();

                    return {
                        nodes: nodeIds.map(id => this.nodes.get(id)),
                        edges,
                        distance: edges.length
                    };
                }

                queue.push(node.id);
            }
        }

        return null;
    }

    findDirectedCycles(options = {}) {
        const { edgeTypes = null } = options;

        const state = new Map();
        const stack = [];
        const stackIndex = new Map();
        const cycles = [];
        const signatures = new Set();

        const visit = nodeId => {
            state.set(nodeId, 1);
            stackIndex.set(nodeId, stack.length);
            stack.push(nodeId);

            for (const edge of this.getOutgoing(nodeId, { edgeTypes })) {
                const nextId = edge.to;
                const nextState = state.get(nextId) || 0;

                if (nextState === 0) {
                    visit(nextId);
                } else if (nextState === 1) {
                    const start = stackIndex.get(nextId);
                    const cycleIds = stack.slice(start);
                    cycleIds.push(nextId);

                    const normalized = cycleIds
                        .slice(0, -1)
                        .sort()
                        .join("|");

                    if (!signatures.has(normalized)) {
                        signatures.add(normalized);
                        cycles.push(
                            cycleIds.map(id => this.nodes.get(id))
                        );
                    }
                }
            }

            stack.pop();
            stackIndex.delete(nodeId);
            state.set(nodeId, 2);
        };

        for (const nodeId of this.nodes.keys()) {
            if ((state.get(nodeId) || 0) === 0) {
                visit(nodeId);
            }
        }

        return cycles;
    }

    hasDirectedCycle(options = {}) {
        return this.findDirectedCycles(options).length > 0;
    }

    topologicalSort(options = {}) {
        const { edgeTypes = null } = options;
        const indegree = new Map();

        for (const nodeId of this.nodes.keys()) {
            indegree.set(nodeId, 0);
        }

        for (const edge of this.edges.values()) {
            if (
                edgeTypes &&
                !new Set(
                    Array.isArray(edgeTypes)
                        ? edgeTypes
                        : [edgeTypes]
                ).has(edge.type)
            ) {
                continue;
            }

            indegree.set(
                edge.to,
                (indegree.get(edge.to) || 0) + 1
            );
        }

        const queue = [];

        for (const [nodeId, degree] of indegree.entries()) {
            if (degree === 0) {
                queue.push(nodeId);
            }
        }

        const result = [];

        while (queue.length > 0) {
            const nodeId = queue.shift();
            result.push(this.nodes.get(nodeId));

            for (const edge of this.getOutgoing(nodeId, { edgeTypes })) {
                const nextDegree = indegree.get(edge.to) - 1;
                indegree.set(edge.to, nextDegree);

                if (nextDegree === 0) {
                    queue.push(edge.to);
                }
            }
        }

        if (result.length !== this.nodes.size) {
            const cycleNodes = [...indegree.entries()]
                .filter(([, degree]) => degree > 0)
                .map(([id]) => this.nodes.get(id));

            const error = new Error(
                "Topological sort failed because the graph contains a directed cycle."
            );

            error.cycleNodes = cycleNodes;
            throw error;
        }

        return result;
    }

    weaklyConnectedComponents(options = {}) {
        const { edgeTypes = null } = options;
        const visited = new Set();
        const components = [];

        for (const nodeId of this.nodes.keys()) {
            if (visited.has(nodeId)) {
                continue;
            }

            const component = [];
            const queue = [nodeId];
            visited.add(nodeId);

            while (queue.length > 0) {
                const currentId = queue.shift();
                component.push(this.nodes.get(currentId));

                const neighbors = this.getNeighbors(currentId, {
                    direction: "both",
                    edgeTypes
                });

                for (const neighbor of neighbors) {
                    if (visited.has(neighbor.id)) {
                        continue;
                    }

                    visited.add(neighbor.id);
                    queue.push(neighbor.id);
                }
            }

            components.push(component);
        }

        return components;
    }

    subgraph(nodeIds, options = {}) {
        const {
            includeConnectingEdges = true
        } = options;

        const selected = new Set(nodeIds);
        const graph = new ConflictGraph();

        for (const nodeId of selected) {
            const node = this.nodes.get(nodeId);

            if (node) {
                graph.addNode(new ConflictNode(node.toJSON()));
            }
        }

        if (includeConnectingEdges) {
            for (const edge of this.edges.values()) {
                if (
                    selected.has(edge.from) &&
                    selected.has(edge.to)
                ) {
                    graph.addEdge(new ConflictEdge(edge.toJSON()));
                }
            }
        }

        return graph;
    }

    toJSON() {
        return {
            version: 3,
            nodes: [...this.nodes.values()].map(node => node.toJSON()),
            edges: [...this.edges.values()].map(edge => edge.toJSON())
        };
    }

    static fromJSON(data) {
        if (!data || typeof data !== "object") {
            throw new TypeError("Graph data must be an object.");
        }

        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
            throw new TypeError("Graph data must include nodes and edges arrays.");
        }

        const graph = new ConflictGraph();

        for (const nodeData of data.nodes) {
            graph.addNode(new ConflictNode(nodeData));
        }

        for (const edgeData of data.edges) {
            graph.addEdge(new ConflictEdge(edgeData));
        }

        return graph;
    }
}

export default ConflictGraph;
