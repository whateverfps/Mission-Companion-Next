/**
 * ============================================================================
 * Mission Companion
 * Conflict Engine
 *
 * File:
 *     ScheduleRule.js
 *
 * Commit:
 *     8
 *
 * Purpose:
 *     Detects schedule contradictions, invalid sequencing, missing dependencies,
 *     date conflicts, milestone risk, and impossible activity relationships
 *     represented in a ConflictGraph.
 * ============================================================================
 */

import { ReasoningRule } from "../ConflictReasoner.js";
import { normalizedText as normalize } from "../../../data-model.js";

export const ScheduleConflictType = Object.freeze({
    DATE_CONTRADICTION: "date_contradiction",
    IMPOSSIBLE_SEQUENCE: "impossible_sequence",
    MISSING_PREDECESSOR: "missing_predecessor",
    MISSING_SUCCESSOR: "missing_successor",
    CIRCULAR_DEPENDENCY: "circular_dependency",
    NEGATIVE_FLOAT: "negative_float",
    MILESTONE_CONFLICT: "milestone_conflict",
    DUPLICATE_ACTIVITY: "duplicate_activity",
    DURATION_CONFLICT: "duration_conflict",
    CONSTRAINT_CONFLICT: "constraint_conflict",
    OUT_OF_SEQUENCE: "out_of_sequence",
    OPEN_ENDED_ACTIVITY: "open_ended_activity",
    UNLINKED_MILESTONE: "unlinked_milestone",
    NO_CONFLICT: "no_conflict"
});

export const ScheduleConstraint = Object.freeze({
    AS_SOON_AS_POSSIBLE: "as_soon_as_possible",
    AS_LATE_AS_POSSIBLE: "as_late_as_possible",
    MUST_START_ON: "must_start_on",
    MUST_FINISH_ON: "must_finish_on",
    START_NO_EARLIER_THAN: "start_no_earlier_than",
    START_NO_LATER_THAN: "start_no_later_than",
    FINISH_NO_EARLIER_THAN: "finish_no_earlier_than",
    FINISH_NO_LATER_THAN: "finish_no_later_than",
    NONE: "none"
});

const DATE_FIELDS = [
    "start",
    "finish",
    "plannedStart",
    "plannedFinish",
    "actualStart",
    "actualFinish",
    "baselineStart",
    "baselineFinish",
    "requiredStart",
    "requiredFinish",
    "constraintDate",
    "milestoneDate"
];

const SCHEDULE_NODE_TYPES = new Set([
    "activity",
    "milestone",
    "schedule",
    "task",
    "work_package",
    "requirement"
]);

const DEPENDENCY_EDGE_TYPES = new Set([
    "depends_on",
    "requires",
    "precedes",
    "successor",
    "finish_to_start",
    "start_to_start",
    "finish_to_finish",
    "start_to_finish"
]);

const MILESTONE_PATTERNS = [
    /\bmilestone\b/i,
    /\bnotice\s+to\s+proceed\b/i,
    /\bntp\b/i,
    /\bsubstantial\s+completion\b/i,
    /\bfinal\s+completion\b/i,
    /\bbeneficial\s+occupancy\b/i,
    /\bactivation\b/i,
    /\bturnover\b/i,
    /\bcommissioning\s+complete\b/i,
    /\bowner\s+acceptance\b/i
];

function lower(value) {
    return normalize(value).toLowerCase();
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}

function toDate(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(value.getTime());
    }

    if (typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const normalized = normalize(value);

    if (!normalized) {
        return null;
    }

    const date = new Date(normalized);

    return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(left, right) {
    if (!left || !right) {
        return null;
    }

    const milliseconds = right.getTime() - left.getTime();
    return milliseconds / 86400000;
}

function isMilestone(node) {
    if (lower(node.type) === "milestone") {
        return true;
    }

    const text = normalize([
        node.title,
        node.text,
        node.metadata?.activityType,
        node.metadata?.category
    ].filter(Boolean).join(" "));

    return MILESTONE_PATTERNS.some(pattern => pattern.test(text));
}

function numeric(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function inferDuration(node, start, finish) {
    const explicit = numeric(
        node.metadata?.duration ??
        node.metadata?.plannedDuration ??
        node.metadata?.calendarDuration
    );

    if (explicit !== null) {
        return explicit;
    }

    const computed = daysBetween(start, finish);
    return computed === null ? null : computed;
}

function normalizeConstraint(value) {
    const text = lower(value).replace(/[\s-]+/g, "_");

    const aliases = new Map([
        ["asap", ScheduleConstraint.AS_SOON_AS_POSSIBLE],
        ["alap", ScheduleConstraint.AS_LATE_AS_POSSIBLE],
        ["mso", ScheduleConstraint.MUST_START_ON],
        ["mfo", ScheduleConstraint.MUST_FINISH_ON],
        ["snet", ScheduleConstraint.START_NO_EARLIER_THAN],
        ["snlt", ScheduleConstraint.START_NO_LATER_THAN],
        ["fnet", ScheduleConstraint.FINISH_NO_EARLIER_THAN],
        ["fnlt", ScheduleConstraint.FINISH_NO_LATER_THAN]
    ]);

    if (aliases.has(text)) {
        return aliases.get(text);
    }

    return Object.values(ScheduleConstraint).includes(text)
        ? text
        : ScheduleConstraint.NONE;
}

export function extractScheduleActivity(node) {
    const metadata = node.metadata || {};

    const plannedStart = toDate(
        metadata.plannedStart ??
        metadata.start ??
        metadata.baselineStart
    );

    const plannedFinish = toDate(
        metadata.plannedFinish ??
        metadata.finish ??
        metadata.baselineFinish
    );

    const actualStart = toDate(metadata.actualStart);
    const actualFinish = toDate(metadata.actualFinish);
    const requiredStart = toDate(metadata.requiredStart);
    const requiredFinish = toDate(metadata.requiredFinish);
    const constraintDate = toDate(metadata.constraintDate);

    const duration = inferDuration(
        node,
        plannedStart,
        plannedFinish
    );

    const totalFloat = numeric(
        metadata.totalFloat ??
        metadata.float
    );

    const percentComplete = numeric(
        metadata.percentComplete ??
        metadata.progress
    );

    const constraint = normalizeConstraint(
        metadata.constraint ??
        metadata.constraintType
    );

    return {
        nodeId: node.id,
        node,
        title: normalize(node.title || node.text || node.id),
        milestone: isMilestone(node),
        plannedStart,
        plannedFinish,
        actualStart,
        actualFinish,
        requiredStart,
        requiredFinish,
        constraintDate,
        constraint,
        duration,
        totalFloat,
        percentComplete,
        status: lower(metadata.status || "unknown"),
        calendar: normalize(metadata.calendar || ""),
        workArea: normalize(
            metadata.workArea ??
            metadata.location ??
            metadata.building ??
            ""
        ),
        source: normalize(
            node.source ??
            metadata.source ??
            node.document ??
            ""
        )
    };
}

function dateValue(date) {
    return date ? date.getTime() : null;
}

function sameDate(left, right) {
    if (!left || !right) {
        return false;
    }

    return left.getTime() === right.getTime();
}

function overlap(left, right) {
    if (
        !left.plannedStart ||
        !left.plannedFinish ||
        !right.plannedStart ||
        !right.plannedFinish
    ) {
        return false;
    }

    return (
        left.plannedStart <= right.plannedFinish &&
        right.plannedStart <= left.plannedFinish
    );
}

function titleSimilarity(left, right) {
    const tokenize = value => new Set(
        lower(value)
            .split(/[^a-z0-9]+/)
            .filter(token => token.length > 2)
    );

    const a = tokenize(left);
    const b = tokenize(right);

    if (a.size === 0 || b.size === 0) {
        return 0;
    }

    const intersection = [...a].filter(token => b.has(token)).length;
    const union = new Set([...a, ...b]).size;

    return union === 0 ? 0 : intersection / union;
}

function activityConfidence(activity) {
    let confidence = 0.35;

    if (activity.plannedStart) confidence += 0.15;
    if (activity.plannedFinish) confidence += 0.15;
    if (activity.duration !== null) confidence += 0.1;
    if (activity.source) confidence += 0.1;
    if (activity.title) confidence += 0.1;
    if (activity.constraint !== ScheduleConstraint.NONE) confidence += 0.05;

    return clamp(confidence);
}

function makeEvidence(activity) {
    return {
        nodeId: activity.nodeId,
        title: activity.title,
        plannedStart:
            activity.plannedStart?.toISOString() ?? null,
        plannedFinish:
            activity.plannedFinish?.toISOString() ?? null,
        actualStart:
            activity.actualStart?.toISOString() ?? null,
        actualFinish:
            activity.actualFinish?.toISOString() ?? null,
        duration: activity.duration,
        totalFloat: activity.totalFloat,
        percentComplete: activity.percentComplete,
        constraint: activity.constraint,
        confidence: activityConfidence(activity)
    };
}

function severity(type, confidence) {
    if (
        type === ScheduleConflictType.CIRCULAR_DEPENDENCY ||
        type === ScheduleConflictType.IMPOSSIBLE_SEQUENCE
    ) {
        return confidence >= 0.8 ? "critical" : "high";
    }

    if (
        type === ScheduleConflictType.NEGATIVE_FLOAT ||
        type === ScheduleConflictType.MILESTONE_CONFLICT ||
        type === ScheduleConflictType.CONSTRAINT_CONFLICT
    ) {
        return confidence >= 0.75 ? "high" : "medium";
    }

    return confidence >= 0.7 ? "medium" : "low";
}

function relationshipType(edge) {
    return lower(edge.type || edge.metadata?.relationship || "depends_on");
}

function dependencyDirection(edge, graph) {
    const type = relationshipType(edge);

    if (
        type === "precedes" ||
        type === "successor" ||
        type === "finish_to_start" ||
        type === "start_to_start" ||
        type === "finish_to_finish" ||
        type === "start_to_finish"
    ) {
        return {
            predecessorId: edge.from,
            successorId: edge.to,
            type
        };
    }

    if (type === "depends_on" || type === "requires") {
        return {
            predecessorId: edge.to,
            successorId: edge.from,
            type
        };
    }

    if (
        graph.nodes.has(edge.from) &&
        graph.nodes.has(edge.to)
    ) {
        return {
            predecessorId: edge.from,
            successorId: edge.to,
            type
        };
    }

    return null;
}

function violatesRelationship(predecessor, successor, type) {
    const pStart =
        predecessor.actualStart ||
        predecessor.plannedStart;

    const pFinish =
        predecessor.actualFinish ||
        predecessor.plannedFinish;

    const sStart =
        successor.actualStart ||
        successor.plannedStart;

    const sFinish =
        successor.actualFinish ||
        successor.plannedFinish;

    if (type === "start_to_start") {
        return pStart && sStart && sStart < pStart;
    }

    if (type === "finish_to_finish") {
        return pFinish && sFinish && sFinish < pFinish;
    }

    if (type === "start_to_finish") {
        return pStart && sFinish && sFinish < pStart;
    }

    return pFinish && sStart && sStart < pFinish;
}

function formatDate(date) {
    return date
        ? date.toISOString().slice(0, 10)
        : "unspecified";
}

export class ScheduleRule extends ReasoningRule {
    constructor(options = {}) {
        super(
            options.name || "Schedule Analysis",
            options.priority ?? 50
        );

        this.options = {
            nodeTypes:
                options.nodeTypes ||
                [...SCHEDULE_NODE_TYPES],
            minimumDuplicateSimilarity:
                options.minimumDuplicateSimilarity ?? 0.82,
            detectOpenEndedActivities:
                options.detectOpenEndedActivities ?? true,
            detectDuplicateActivities:
                options.detectDuplicateActivities ?? true,
            detectUnlinkedMilestones:
                options.detectUnlinkedMilestones ?? true,
            detectMissingRelationships:
                options.detectMissingRelationships ?? true
        };
    }

    appliesTo(graph) {
        return (
            graph &&
            typeof graph.findNodes === "function" &&
            typeof graph.getIncoming === "function" &&
            typeof graph.getOutgoing === "function" &&
            typeof graph.detectCycles === "function"
        );
    }

    execute(graph, result) {
        const nodes = graph.findNodes({
            types: this.options.nodeTypes
        });

        const activities = nodes.map(
            extractScheduleActivity
        );

        const byId = new Map(
            activities.map(activity => [
                activity.nodeId,
                activity
            ])
        );

        this.detectInternalDateConflicts(
            activities,
            result
        );

        this.detectDependencyConflicts(
            graph,
            byId,
            result
        );

        this.detectCircularDependencies(
            graph,
            result
        );

        this.detectNegativeFloat(
            activities,
            result
        );

        this.detectConstraintConflicts(
            activities,
            result
        );

        this.detectMilestoneConflicts(
            activities,
            result
        );

        if (this.options.detectOpenEndedActivities) {
            this.detectOpenEndedActivities(
                activities,
                result
            );
        }

        if (this.options.detectDuplicateActivities) {
            this.detectDuplicateActivities(
                activities,
                result
            );
        }

        if (this.options.detectUnlinkedMilestones) {
            this.detectUnlinkedMilestones(
                graph,
                activities,
                result
            );
        }

        if (this.options.detectMissingRelationships) {
            this.detectMissingRelationships(
                graph,
                activities,
                result
            );
        }
    }

    detectInternalDateConflicts(activities, result) {
        for (const activity of activities) {
            if (
                activity.plannedStart &&
                activity.plannedFinish &&
                activity.plannedFinish < activity.plannedStart
            ) {
                this.emit(result, {
                    id: `SCH-DATE-${activity.nodeId}`,
                    subtype:
                        ScheduleConflictType.DATE_CONTRADICTION,
                    title:
                        "Activity finish occurs before activity start",
                    confidence: 0.98,
                    nodeIds: [activity.nodeId],
                    explanation:
                        `${activity.title} starts ${formatDate(activity.plannedStart)} but finishes ${formatDate(activity.plannedFinish)}.`,
                    evidence: [makeEvidence(activity)]
                });
            }

            if (
                activity.actualStart &&
                activity.actualFinish &&
                activity.actualFinish < activity.actualStart
            ) {
                this.emit(result, {
                    id: `SCH-ACTUAL-DATE-${activity.nodeId}`,
                    subtype:
                        ScheduleConflictType.DATE_CONTRADICTION,
                    title:
                        "Actual finish occurs before actual start",
                    confidence: 0.99,
                    nodeIds: [activity.nodeId],
                    explanation:
                        `${activity.title} has inconsistent actual dates.`,
                    evidence: [makeEvidence(activity)]
                });
            }

            if (
                activity.duration !== null &&
                activity.duration < 0
            ) {
                this.emit(result, {
                    id: `SCH-DURATION-${activity.nodeId}`,
                    subtype:
                        ScheduleConflictType.DURATION_CONFLICT,
                    title:
                        "Activity has a negative duration",
                    confidence: 0.99,
                    nodeIds: [activity.nodeId],
                    explanation:
                        `${activity.title} has a duration of ${activity.duration}.`,
                    evidence: [makeEvidence(activity)]
                });
            }

            if (
                activity.milestone &&
                activity.duration !== null &&
                activity.duration > 0
            ) {
                this.emit(result, {
                    id: `SCH-MILESTONE-DURATION-${activity.nodeId}`,
                    subtype:
                        ScheduleConflictType.DURATION_CONFLICT,
                    title:
                        "Milestone has a nonzero duration",
                    confidence: 0.88,
                    nodeIds: [activity.nodeId],
                    explanation:
                        `${activity.title} is classified as a milestone but has a duration of ${activity.duration} days.`,
                    evidence: [makeEvidence(activity)]
                });
            }
        }
    }

    detectDependencyConflicts(graph, byId, result) {
        for (const edge of graph.edges.values()) {
            if (
                !DEPENDENCY_EDGE_TYPES.has(
                    relationshipType(edge)
                )
            ) {
                continue;
            }

            const relation =
                dependencyDirection(edge, graph);

            if (!relation) {
                continue;
            }

            const predecessor =
                byId.get(relation.predecessorId);

            const successor =
                byId.get(relation.successorId);

            if (!predecessor || !successor) {
                continue;
            }

            if (
                violatesRelationship(
                    predecessor,
                    successor,
                    relation.type
                )
            ) {
                this.emit(result, {
                    id:
                        `SCH-SEQUENCE-${edge.id}`,
                    subtype:
                        ScheduleConflictType.IMPOSSIBLE_SEQUENCE,
                    title:
                        "Dependency sequence is violated",
                    confidence: 0.93,
                    nodeIds: [
                        predecessor.nodeId,
                        successor.nodeId
                    ],
                    edgeIds: [edge.id],
                    explanation:
                        `${successor.title} is scheduled before its predecessor ${predecessor.title} satisfies the ${relation.type} relationship.`,
                    evidence: [
                        makeEvidence(predecessor),
                        makeEvidence(successor),
                        {
                            edgeId: edge.id,
                            relationship: relation.type
                        }
                    ]
                });
            }

            if (
                successor.actualStart &&
                !predecessor.actualFinish &&
                relation.type === "finish_to_start"
            ) {
                this.emit(result, {
                    id:
                        `SCH-OUT-OF-SEQUENCE-${edge.id}`,
                    subtype:
                        ScheduleConflictType.OUT_OF_SEQUENCE,
                    title:
                        "Successor started before predecessor completion was recorded",
                    confidence: 0.82,
                    nodeIds: [
                        predecessor.nodeId,
                        successor.nodeId
                    ],
                    edgeIds: [edge.id],
                    explanation:
                        `${successor.title} has an actual start, but ${predecessor.title} has no actual finish.`,
                    evidence: [
                        makeEvidence(predecessor),
                        makeEvidence(successor)
                    ]
                });
            }
        }
    }

    detectCircularDependencies(graph, result) {
        const cycles = graph.detectCycles({
            edgeTypes: [...DEPENDENCY_EDGE_TYPES]
        });

        for (let index = 0; index < cycles.length; index += 1) {
            const cycle = cycles[index];
            const nodeIds = cycle.map(node => node.id);

            this.emit(result, {
                id: `SCH-CYCLE-${index + 1}`,
                subtype:
                    ScheduleConflictType.CIRCULAR_DEPENDENCY,
                title:
                    "Circular schedule dependency detected",
                confidence: 0.99,
                nodeIds,
                explanation:
                    `The dependency chain returns to its starting activity: ${nodeIds.join(" → ")}.`,
                evidence:
                    cycle.map(node => ({
                        nodeId: node.id,
                        title: node.title
                    }))
            });
        }
    }

    detectNegativeFloat(activities, result) {
        for (const activity of activities) {
            if (
                activity.totalFloat !== null &&
                activity.totalFloat < 0
            ) {
                const confidence = clamp(
                    0.75 +
                    Math.min(
                        Math.abs(activity.totalFloat) / 30,
                        0.2
                    )
                );

                this.emit(result, {
                    id:
                        `SCH-NEGATIVE-FLOAT-${activity.nodeId}`,
                    subtype:
                        ScheduleConflictType.NEGATIVE_FLOAT,
                    title:
                        "Activity has negative total float",
                    confidence,
                    nodeIds: [activity.nodeId],
                    explanation:
                        `${activity.title} has ${activity.totalFloat} days of total float and threatens a required completion date.`,
                    evidence: [makeEvidence(activity)]
                });
            }
        }
    }

    detectConstraintConflicts(activities, result) {
        for (const activity of activities) {
            if (
                activity.constraint ===
                    ScheduleConstraint.NONE ||
                !activity.constraintDate
            ) {
                continue;
            }

            let violated = false;
            let explanation = "";

            if (
                activity.constraint ===
                    ScheduleConstraint.MUST_START_ON &&
                activity.plannedStart &&
                !sameDate(
                    activity.plannedStart,
                    activity.constraintDate
                )
            ) {
                violated = true;
                explanation =
                    `${activity.title} must start on ${formatDate(activity.constraintDate)} but is planned for ${formatDate(activity.plannedStart)}.`;
            }

            if (
                activity.constraint ===
                    ScheduleConstraint.MUST_FINISH_ON &&
                activity.plannedFinish &&
                !sameDate(
                    activity.plannedFinish,
                    activity.constraintDate
                )
            ) {
                violated = true;
                explanation =
                    `${activity.title} must finish on ${formatDate(activity.constraintDate)} but is planned for ${formatDate(activity.plannedFinish)}.`;
            }

            if (
                activity.constraint ===
                    ScheduleConstraint.START_NO_EARLIER_THAN &&
                activity.plannedStart &&
                activity.plannedStart <
                    activity.constraintDate
            ) {
                violated = true;
                explanation =
                    `${activity.title} starts earlier than its constraint date.`;
            }

            if (
                activity.constraint ===
                    ScheduleConstraint.START_NO_LATER_THAN &&
                activity.plannedStart &&
                activity.plannedStart >
                    activity.constraintDate
            ) {
                violated = true;
                explanation =
                    `${activity.title} starts later than its constraint date.`;
            }

            if (
                activity.constraint ===
                    ScheduleConstraint.FINISH_NO_EARLIER_THAN &&
                activity.plannedFinish &&
                activity.plannedFinish <
                    activity.constraintDate
            ) {
                violated = true;
                explanation =
                    `${activity.title} finishes earlier than its constraint date.`;
            }

            if (
                activity.constraint ===
                    ScheduleConstraint.FINISH_NO_LATER_THAN &&
                activity.plannedFinish &&
                activity.plannedFinish >
                    activity.constraintDate
            ) {
                violated = true;
                explanation =
                    `${activity.title} finishes later than its constraint date.`;
            }

            if (!violated) {
                continue;
            }

            this.emit(result, {
                id:
                    `SCH-CONSTRAINT-${activity.nodeId}`,
                subtype:
                    ScheduleConflictType.CONSTRAINT_CONFLICT,
                title:
                    "Activity violates a schedule constraint",
                confidence: 0.94,
                nodeIds: [activity.nodeId],
                explanation,
                evidence: [makeEvidence(activity)]
            });
        }
    }

    detectMilestoneConflicts(activities, result) {
        const milestones =
            activities.filter(activity => activity.milestone);

        for (let i = 0; i < milestones.length; i += 1) {
            for (let j = i + 1; j < milestones.length; j += 1) {
                const left = milestones[i];
                const right = milestones[j];

                const similarity =
                    titleSimilarity(
                        left.title,
                        right.title
                    );

                if (similarity < 0.7) {
                    continue;
                }

                const leftDate =
                    left.plannedFinish ||
                    left.plannedStart;

                const rightDate =
                    right.plannedFinish ||
                    right.plannedStart;

                if (
                    !leftDate ||
                    !rightDate ||
                    sameDate(leftDate, rightDate)
                ) {
                    continue;
                }

                const variance =
                    Math.abs(
                        daysBetween(leftDate, rightDate)
                    );

                this.emit(result, {
                    id:
                        `SCH-MILESTONE-${left.nodeId}-${right.nodeId}`,
                    subtype:
                        ScheduleConflictType.MILESTONE_CONFLICT,
                    title:
                        "Conflicting dates exist for the same milestone",
                    confidence: clamp(
                        0.7 +
                        similarity * 0.15 +
                        Math.min(variance / 60, 0.14)
                    ),
                    nodeIds: [
                        left.nodeId,
                        right.nodeId
                    ],
                    explanation:
                        `${left.title} is dated ${formatDate(leftDate)} in one source and ${formatDate(rightDate)} in another.`,
                    evidence: [
                        makeEvidence(left),
                        makeEvidence(right)
                    ]
                });
            }
        }
    }

    detectOpenEndedActivities(activities, result) {
        for (const activity of activities) {
            if (activity.milestone) {
                continue;
            }

            const missingStart =
                !activity.plannedStart &&
                !activity.actualStart;

            const missingFinish =
                !activity.plannedFinish &&
                !activity.actualFinish;

            if (!missingStart && !missingFinish) {
                continue;
            }

            this.emit(result, {
                id:
                    `SCH-OPEN-${activity.nodeId}`,
                subtype:
                    ScheduleConflictType.OPEN_ENDED_ACTIVITY,
                title:
                    "Activity is missing a start or finish date",
                confidence: 0.66,
                nodeIds: [activity.nodeId],
                explanation:
                    `${activity.title} is missing ${missingStart ? "a start date" : "a finish date"}.`,
                evidence: [makeEvidence(activity)]
            });
        }
    }

    detectDuplicateActivities(activities, result) {
        for (let i = 0; i < activities.length; i += 1) {
            for (let j = i + 1; j < activities.length; j += 1) {
                const left = activities[i];
                const right = activities[j];

                const similarity =
                    titleSimilarity(
                        left.title,
                        right.title
                    );

                if (
                    similarity <
                    this.options.minimumDuplicateSimilarity
                ) {
                    continue;
                }

                const datesMatch =
                    (
                        sameDate(
                            left.plannedStart,
                            right.plannedStart
                        ) ||
                        (!left.plannedStart &&
                         !right.plannedStart)
                    ) &&
                    (
                        sameDate(
                            left.plannedFinish,
                            right.plannedFinish
                        ) ||
                        (!left.plannedFinish &&
                         !right.plannedFinish)
                    );

                if (!datesMatch) {
                    continue;
                }

                this.emit(result, {
                    id:
                        `SCH-DUPLICATE-${left.nodeId}-${right.nodeId}`,
                    subtype:
                        ScheduleConflictType.DUPLICATE_ACTIVITY,
                    title:
                        "Potential duplicate schedule activity",
                    confidence: clamp(
                        0.6 + similarity * 0.35
                    ),
                    nodeIds: [
                        left.nodeId,
                        right.nodeId
                    ],
                    explanation:
                        `${left.title} and ${right.title} appear to represent the same scheduled work.`,
                    evidence: [
                        makeEvidence(left),
                        makeEvidence(right)
                    ]
                });
            }
        }
    }

    detectUnlinkedMilestones(graph, activities, result) {
        for (const activity of activities) {
            if (!activity.milestone) {
                continue;
            }

            const incoming =
                graph.getIncoming(activity.nodeId, {
                    edgeTypes: [...DEPENDENCY_EDGE_TYPES]
                });

            const outgoing =
                graph.getOutgoing(activity.nodeId, {
                    edgeTypes: [...DEPENDENCY_EDGE_TYPES]
                });

            if (
                incoming.length > 0 ||
                outgoing.length > 0
            ) {
                continue;
            }

            this.emit(result, {
                id:
                    `SCH-UNLINKED-MILESTONE-${activity.nodeId}`,
                subtype:
                    ScheduleConflictType.UNLINKED_MILESTONE,
                title:
                    "Milestone has no schedule relationships",
                confidence: 0.78,
                nodeIds: [activity.nodeId],
                explanation:
                    `${activity.title} is not connected to predecessor or successor activities.`,
                evidence: [makeEvidence(activity)]
            });
        }
    }

    detectMissingRelationships(graph, activities, result) {
        for (const activity of activities) {
            if (activity.milestone) {
                continue;
            }

            const incoming =
                graph.getIncoming(activity.nodeId, {
                    edgeTypes: [...DEPENDENCY_EDGE_TYPES]
                });

            const outgoing =
                graph.getOutgoing(activity.nodeId, {
                    edgeTypes: [...DEPENDENCY_EDGE_TYPES]
                });

            if (
                incoming.length === 0 &&
                activity.plannedStart
            ) {
                this.emit(result, {
                    id:
                        `SCH-MISSING-PREDECESSOR-${activity.nodeId}`,
                    subtype:
                        ScheduleConflictType.MISSING_PREDECESSOR,
                    title:
                        "Scheduled activity has no predecessor",
                    confidence: 0.62,
                    nodeIds: [activity.nodeId],
                    explanation:
                        `${activity.title} has a planned start but no predecessor relationship.`,
                    evidence: [makeEvidence(activity)]
                });
            }

            if (
                outgoing.length === 0 &&
                activity.plannedFinish
            ) {
                this.emit(result, {
                    id:
                        `SCH-MISSING-SUCCESSOR-${activity.nodeId}`,
                    subtype:
                        ScheduleConflictType.MISSING_SUCCESSOR,
                    title:
                        "Scheduled activity has no successor",
                    confidence: 0.58,
                    nodeIds: [activity.nodeId],
                    explanation:
                        `${activity.title} has a planned finish but no successor relationship.`,
                    evidence: [makeEvidence(activity)]
                });
            }
        }
    }

    emit(result, finding) {
        const completeFinding = {
            type: "schedule",
            severity: severity(
                finding.subtype,
                finding.confidence
            ),
            resolution: {
                status: "unresolved",
                governingNodeId: null,
                rationale:
                    "Schedule logic must be corrected or formally accepted by the responsible scheduling authority."
            },
            ...finding
        };

        result.addFinding(completeFinding);

        result.addExplanation({
            findingId: completeFinding.id,
            text: completeFinding.explanation
        });

        result.addRecommendation(
            this.buildRecommendation(completeFinding)
        );
    }

    buildRecommendation(finding) {
        const map = {
            [ScheduleConflictType.CIRCULAR_DEPENDENCY]: {
                priority: "immediate",
                action:
                    "Break the circular dependency and revalidate the schedule network.",
                verification:
                    "Run a logic check and confirm the revised network is acyclic."
            },
            [ScheduleConflictType.IMPOSSIBLE_SEQUENCE]: {
                priority: "immediate",
                action:
                    "Correct the predecessor-successor dates or relationship type.",
                verification:
                    "Confirm the successor no longer starts or finishes before its governing predecessor."
            },
            [ScheduleConflictType.NEGATIVE_FLOAT]: {
                priority: "high",
                action:
                    "Develop a recovery action for the negative-float activity.",
                verification:
                    "Confirm the recovery plan restores nonnegative float or formally revises the required date."
            },
            [ScheduleConflictType.MILESTONE_CONFLICT]: {
                priority: "high",
                action:
                    "Establish one controlling milestone date.",
                verification:
                    "Confirm the date against the latest approved schedule, contract modification, and directive."
            },
            [ScheduleConflictType.CONSTRAINT_CONFLICT]: {
                priority: "high",
                action:
                    "Resolve the activity date against the imposed schedule constraint.",
                verification:
                    "Verify the corrected date satisfies the constraint and downstream logic."
            },
            [ScheduleConflictType.OUT_OF_SEQUENCE]: {
                priority: "high",
                action:
                    "Record and correct the out-of-sequence progress condition.",
                verification:
                    "Update actual dates, remaining logic, and contemporaneous schedule narrative."
            },
            [ScheduleConflictType.UNLINKED_MILESTONE]: {
                priority: "medium",
                action:
                    "Link the milestone to the activities that create and consume it.",
                verification:
                    "Confirm the milestone participates in the schedule network."
            },
            [ScheduleConflictType.DUPLICATE_ACTIVITY]: {
                priority: "medium",
                action:
                    "Confirm whether the activities are duplicates and consolidate them if appropriate.",
                verification:
                    "Preserve source traceability before removing a duplicate activity."
            },
            [ScheduleConflictType.OPEN_ENDED_ACTIVITY]: {
                priority: "medium",
                action:
                    "Add the missing planned or actual date.",
                verification:
                    "Confirm the activity has a complete and logically consistent date range."
            }
        };

        return {
            findingId: finding.id,
            ...(map[finding.subtype] || {
                priority: "medium",
                action:
                    "Review and correct the schedule condition.",
                verification:
                    "Re-run schedule validation after correction."
            })
        };
    }
}

export function registerScheduleRule(
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
        new ScheduleRule(options)
    );

    return reasoner;
}

export default ScheduleRule;
