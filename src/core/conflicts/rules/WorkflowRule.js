/**
 * ============================================================================
 * Mission Companion
 * Conflict Engine
 **
 * File:
 *     WorkflowRule.js
 *
 * Purpose:
 *     Extracts construction workflow activities from graph nodes, builds
 *     evidence-backed dependency relationships, detects incomplete or unsafe
 *     sequences, and produces actionable workflow findings.
 * ============================================================================
 */

import { ReasoningRule } from "../ConflictReasoner.js";
import { normalizedText as normalize } from "../../../data-model.js";

export const WorkflowStatus = Object.freeze({
    UNKNOWN: "unknown",
    NOT_STARTED: "not_started",
    READY: "ready",
    IN_PROGRESS: "in_progress",
    BLOCKED: "blocked",
    COMPLETE: "complete",
    FAILED: "failed",
    REJECTED: "rejected",
    DEFERRED: "deferred"
});

export const WorkflowPhase = Object.freeze({
    PLANNING: "planning",
    DESIGN: "design",
    SUBMITTAL: "submittal",
    PROCUREMENT: "procurement",
    PREINSTALLATION: "preinstallation",
    INSTALLATION: "installation",
    INSPECTION: "inspection",
    TESTING: "testing",
    COMMISSIONING: "commissioning",
    ACCEPTANCE: "acceptance",
    CLOSEOUT: "closeout",
    WARRANTY: "warranty",
    UNKNOWN: "unknown"
});

export const DependencyType = Object.freeze({
    FINISH_START: "finish_to_start",
    START_START: "start_to_start",
    FINISH_FINISH: "finish_to_finish",
    START_FINISH: "start_to_finish",
    APPROVAL: "approval",
    DOCUMENT: "document",
    INSPECTION: "inspection",
    TEST: "test",
    EVIDENCE: "evidence",
    ACCESS: "access",
    SHUTDOWN: "shutdown",
    SAFETY: "safety"
});

export const WorkflowFindingType = Object.freeze({
    MISSING_PREREQUISITE: "missing_prerequisite",
    MISSING_APPROVAL: "missing_approval",
    MISSING_INSPECTION: "missing_inspection",
    MISSING_TEST: "missing_test",
    MISSING_EVIDENCE: "missing_evidence",
    MISSING_CLOSEOUT: "missing_closeout",
    SKIPPED_GATE: "skipped_gate",
    CIRCULAR_DEPENDENCY: "circular_dependency",
    DEAD_END: "dead_end",
    ORPHAN_ACTIVITY: "orphan_activity",
    BLOCKED_ACTIVITY: "blocked_activity",
    DUPLICATE_ACTIVITY: "duplicate_activity",
    OUT_OF_SEQUENCE: "out_of_sequence",
    AMBIGUOUS_RESPONSIBILITY: "ambiguous_responsibility",
    UNRESOLVED_CONDITION: "unresolved_condition",
    INCOMPLETE_WORKFLOW: "incomplete_workflow"
});

export const WorkflowSeverity = Object.freeze({
    INFO: "info",
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical"
});

const ACTIVITY_PATTERNS = [
    { action: "submit", phase: WorkflowPhase.SUBMITTAL, weight: 0.96, patterns: [/\bshall\s+submit\b/i, /\bsubmit(?:tal)?\b/i, /\bprovide\s+for\s+review\b/i] },
    { action: "review", phase: WorkflowPhase.SUBMITTAL, weight: 0.90, patterns: [/\breview(?:ed)?\b/i, /\btechnical\s+review\b/i] },
    { action: "approve", phase: WorkflowPhase.SUBMITTAL, weight: 0.96, patterns: [/\bshall\s+be\s+approved\b/i, /\bapproval\s+required\b/i, /\bapproved\s+prior\s+to\b/i] },
    { action: "coordinate", phase: WorkflowPhase.PLANNING, weight: 0.88, patterns: [/\bcoordinate\b/i, /\bcoordination\s+required\b/i] },
    { action: "procure", phase: WorkflowPhase.PROCUREMENT, weight: 0.86, patterns: [/\bprocure\b/i, /\bpurchase\b/i, /\border\b/i] },
    { action: "deliver", phase: WorkflowPhase.PROCUREMENT, weight: 0.84, patterns: [/\bdeliver\b/i, /\breceive\b/i, /\bon[- ]site\s+delivery\b/i] },
    { action: "store", phase: WorkflowPhase.PROCUREMENT, weight: 0.82, patterns: [/\bstor(?:e|age)\b/i, /\bprotect\s+materials\b/i] },
    { action: "shutdown", phase: WorkflowPhase.PREINSTALLATION, weight: 0.95, patterns: [/\bshutdown\b/i, /\bservice\s+interruption\b/i, /\boutage\b/i] },
    { action: "permit", phase: WorkflowPhase.PREINSTALLATION, weight: 0.92, patterns: [/\bpermit\b/i, /\bwork\s+authorization\b/i] },
    { action: "protect", phase: WorkflowPhase.PREINSTALLATION, weight: 0.88, patterns: [/\bprotect\b/i, /\btemporary\s+protection\b/i] },
    { action: "remove", phase: WorkflowPhase.INSTALLATION, weight: 0.84, patterns: [/\bremove\b/i, /\bdemolish\b/i, /\bdisconnect\b/i] },
    { action: "install", phase: WorkflowPhase.INSTALLATION, weight: 0.96, patterns: [/\bshall\s+install\b/i, /\binstallation\b/i, /\bfurnish\s+and\s+install\b/i] },
    { action: "connect", phase: WorkflowPhase.INSTALLATION, weight: 0.90, patterns: [/\bconnect\b/i, /\bterminate\b/i, /\bsplice\b/i] },
    { action: "label", phase: WorkflowPhase.INSTALLATION, weight: 0.84, patterns: [/\blabel\b/i, /\bidentify\b/i, /\btag\b/i] },
    { action: "inspect", phase: WorkflowPhase.INSPECTION, weight: 0.96, patterns: [/\binspect(?:ion|ed)?\b/i, /\bverify\s+installation\b/i] },
    { action: "witness", phase: WorkflowPhase.INSPECTION, weight: 0.94, patterns: [/\bwitness\b/i, /\bin\s+the\s+presence\s+of\b/i] },
    { action: "test", phase: WorkflowPhase.TESTING, weight: 0.96, patterns: [/\btest(?:ing|ed)?\b/i, /\bfunctional\s+performance\b/i] },
    { action: "certify", phase: WorkflowPhase.TESTING, weight: 0.92, patterns: [/\bcertif(?:y|ied|ication)\b/i] },
    { action: "commission", phase: WorkflowPhase.COMMISSIONING, weight: 0.97, patterns: [/\bcommission(?:ing|ed)?\b/i, /\bstartup\b/i] },
    { action: "train", phase: WorkflowPhase.CLOSEOUT, weight: 0.90, patterns: [/\btrain(?:ing)?\b/i, /\binstruction\s+to\s+owner\b/i] },
    { action: "accept", phase: WorkflowPhase.ACCEPTANCE, weight: 0.97, patterns: [/\baccept(?:ance|ed)?\b/i, /\bowner\s+acceptance\b/i] },
    { action: "closeout", phase: WorkflowPhase.CLOSEOUT, weight: 0.96, patterns: [/\bclose[- ]?out\b/i, /\bfinal\s+completion\b/i, /\bturnover\b/i] },
    { action: "warranty", phase: WorkflowPhase.WARRANTY, weight: 0.90, patterns: [/\bwarranty\b/i, /\bguarantee\b/i] }
];

const STATUS_PATTERNS = [
    { status: WorkflowStatus.COMPLETE, patterns: [/\bcomplete(?:d)?\b/i, /\bclosed\b/i, /\bapproved\b/i, /\bpassed\b/i] },
    { status: WorkflowStatus.IN_PROGRESS, patterns: [/\bin\s+progress\b/i, /\bongoing\b/i, /\bstarted\b/i] },
    { status: WorkflowStatus.BLOCKED, patterns: [/\bblocked\b/i, /\bon\s+hold\b/i, /\bawaiting\b/i, /\bpending\b/i] },
    { status: WorkflowStatus.FAILED, patterns: [/\bfailed\b/i, /\bdeficient\b/i, /\bnon[- ]?conforming\b/i] },
    { status: WorkflowStatus.REJECTED, patterns: [/\brejected\b/i, /\bdisapproved\b/i] },
    { status: WorkflowStatus.DEFERRED, patterns: [/\bdeferred\b/i, /\bpostponed\b/i] }
];

const RESPONSIBILITY_PATTERNS = [
    { role: "contractor", pattern: /\b(?:contractor|prime contractor|general contractor)\b/i },
    { role: "cqc", pattern: /\b(?:cqc|contractor quality control|quality control manager)\b/i },
    { role: "owner_qc", pattern: /\b(?:owner(?:'s)? qc|owner quality assurance|va qc|government inspector)\b/i },
    { role: "cor", pattern: /\b(?:contracting officer'?s representative|cor)\b/i },
    { role: "co", pattern: /\b(?:contracting officer|co)\b/i },
    { role: "designer", pattern: /\b(?:architect|engineer|designer|a\/e)\b/i },
    { role: "commissioning_agent", pattern: /\b(?:commissioning agent|commissioning authority|cxa)\b/i },
    { role: "oit", pattern: /\b(?:oit|office of information and technology|information technology)\b/i },
    { role: "fire_marshal", pattern: /\b(?:fire marshal|fire protection engineer)\b/i },
    { role: "ahj", pattern: /\b(?:authority having jurisdiction|ahj)\b/i }
];

const PRECONDITION_PATTERNS = [
    { type: DependencyType.APPROVAL, pattern: /\b(?:after|upon|subject to)\s+(?:written\s+)?approval\b/i, label: "approval" },
    { type: DependencyType.APPROVAL, pattern: /\bprior\s+approval\b/i, label: "approval" },
    { type: DependencyType.INSPECTION, pattern: /\bafter\s+(?:inspection|verification)\b/i, label: "inspection" },
    { type: DependencyType.TEST, pattern: /\bafter\s+(?:successful\s+)?test(?:ing)?\b/i, label: "testing" },
    { type: DependencyType.DOCUMENT, pattern: /\bafter\s+(?:receipt|submission)\s+of\b/i, label: "document" },
    { type: DependencyType.SAFETY, pattern: /\b(?:after|upon)\s+(?:icra|pcra|safety)\s+approval\b/i, label: "safety approval" },
    { type: DependencyType.SHUTDOWN, pattern: /\bafter\s+(?:shutdown|outage)\s+approval\b/i, label: "shutdown approval" },
    { type: DependencyType.ACCESS, pattern: /\bafter\s+(?:access|area)\s+(?:is\s+)?available\b/i, label: "access" }
];

const EVIDENCE_PATTERNS = [
    { type: "photo", pattern: /\bphoto(?:graph)?s?\b/i },
    { type: "inspection_report", pattern: /\binspection\s+report\b/i },
    { type: "test_report", pattern: /\btest\s+report\b/i },
    { type: "certificate", pattern: /\bcertificate\b/i },
    { type: "record_drawing", pattern: /\b(?:record|as[- ]built)\s+drawing\b/i },
    { type: "om_manual", pattern: /\boperation(?:s)?\s+and\s+maintenance\s+manual\b|\bo&m\s+manual\b/i },
    { type: "training_record", pattern: /\btraining\s+record\b|\battendance\s+sheet\b/i },
    { type: "warranty", pattern: /\bwarranty\s+(?:document|certificate|information)\b/i },
    { type: "commissioning_report", pattern: /\bcommissioning\s+report\b/i },
    { type: "approval_record", pattern: /\bwritten\s+approval\b|\bapproval\s+letter\b/i }
];

const SEQUENCE = [
    "coordinate",
    "submit",
    "review",
    "approve",
    "procure",
    "deliver",
    "store",
    "permit",
    "shutdown",
    "protect",
    "remove",
    "install",
    "connect",
    "label",
    "inspect",
    "witness",
    "test",
    "certify",
    "commission",
    "train",
    "accept",
    "closeout",
    "warranty"
];

const TERMINAL_ACTIONS = new Set(["accept", "closeout", "warranty"]);
const GATED_ACTIONS = new Set(["procure", "install", "inspect", "test", "commission", "accept", "closeout"]);

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

function stableId(parts) {
    return parts.map(part => lower(part).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
        .filter(Boolean)
        .join(":");
}

function sourceReference(node) {
    return {
        nodeId: node?.id ?? null,
        title: node?.title ?? "",
        document: node?.metadata?.document ?? node?.metadata?.sourceDocument ?? "",
        section: node?.metadata?.section ?? node?.metadata?.specSection ?? "",
        page: node?.metadata?.page ?? node?.metadata?.pageNumber ?? null
    };
}

function inferStatus(node, text) {
    const explicit = lower(node?.metadata?.status ?? node?.status);
    if (Object.values(WorkflowStatus).includes(explicit)) {
        return explicit;
    }

    for (const entry of STATUS_PATTERNS) {
        if (entry.patterns.some(pattern => pattern.test(text))) {
            return entry.status;
        }
    }

    return WorkflowStatus.UNKNOWN;
}

function inferResponsibleParty(node, text) {
    const explicit = normalize(
        node?.metadata?.responsibleParty ??
        node?.metadata?.responsibility ??
        node?.metadata?.actor ??
        node?.metadata?.assignedTo
    );

    if (explicit) {
        return explicit;
    }

    const match = RESPONSIBILITY_PATTERNS.find(item => item.pattern.test(text));
    return match?.role ?? null;
}

function inferEvidence(text) {
    return EVIDENCE_PATTERNS
        .filter(entry => entry.pattern.test(text))
        .map(entry => entry.type);
}

function inferPreconditions(text) {
    return PRECONDITION_PATTERNS
        .filter(entry => entry.pattern.test(text))
        .map(entry => ({
            type: entry.type,
            label: entry.label,
            explicit: true
        }));
}

function inferObject(text, action) {
    const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
        new RegExp(`\\b${escaped}(?:ed|ing|s)?\\s+(?:the\\s+)?([^.;:]{3,100})`, "i"),
        new RegExp(`\\b${escaped}\\s+of\\s+([^.;:]{3,100})`, "i")
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            return normalize(match[1])
                .replace(/\b(?:before|after|prior to|upon|unless|when|where)\b.*$/i, "")
                .trim();
        }
    }

    return "";
}

export class WorkflowActivity {
    constructor(init = {}) {
        this.id = init.id ?? "";
        this.nodeId = init.nodeId ?? null;
        this.action = init.action ?? "";
        this.object = init.object ?? "";
        this.phase = init.phase ?? WorkflowPhase.UNKNOWN;
        this.status = init.status ?? WorkflowStatus.UNKNOWN;
        this.responsibleParty = init.responsibleParty ?? null;
        this.acceptingAuthority = init.acceptingAuthority ?? null;
        this.predecessors = unique(init.predecessors);
        this.successors = unique(init.successors);
        this.dependencies = [...(init.dependencies || [])];
        this.requiredEvidence = unique(init.requiredEvidence);
        this.source = init.source ?? {};
        this.text = init.text ?? "";
        this.confidence = clamp(init.confidence ?? 0);
    }
}

export function extractWorkflowActivities(node) {
    const text = nodeText(node);
    if (!text) {
        return [];
    }

    const matches = [];

    for (const definition of ACTIVITY_PATTERNS) {
        const hitCount = definition.patterns.reduce(
            (count, pattern) => count + (pattern.test(text) ? 1 : 0),
            0
        );

        if (!hitCount) {
            continue;
        }

        const object = inferObject(text, definition.action);
        const confidence = clamp(
            definition.weight +
            Math.min(0.03, (hitCount - 1) * 0.015) +
            (object ? 0.02 : 0)
        );

        matches.push(new WorkflowActivity({
            id: stableId(["workflow", node.id, definition.action, object || matches.length + 1]),
            nodeId: node.id,
            action: definition.action,
            object,
            phase: definition.phase,
            status: inferStatus(node, text),
            responsibleParty: inferResponsibleParty(node, text),
            acceptingAuthority: normalize(
                node?.metadata?.acceptingAuthority ??
                node?.metadata?.approver ??
                node?.metadata?.approvalAuthority
            ) || null,
            dependencies: inferPreconditions(text),
            requiredEvidence: inferEvidence(text),
            source: sourceReference(node),
            text,
            confidence
        }));
    }

    return matches;
}

function activityKey(activity) {
    return [
        lower(activity.action),
        lower(activity.object),
        lower(activity.source?.document),
        lower(activity.source?.section)
    ].join("|");
}

export function mergeDuplicateActivities(activities) {
    const index = new Map();

    for (const activity of activities) {
        const key = activityKey(activity);
        const existing = index.get(key);

        if (!existing) {
            index.set(key, activity);
            continue;
        }

        existing.confidence = Math.max(existing.confidence, activity.confidence);
        existing.requiredEvidence = unique([
            ...existing.requiredEvidence,
            ...activity.requiredEvidence
        ]);
        existing.dependencies.push(...activity.dependencies);

        if (!existing.responsibleParty && activity.responsibleParty) {
            existing.responsibleParty = activity.responsibleParty;
        }
    }

    return [...index.values()];
}

function sameWorkflowContext(left, right) {
    const leftDocument = lower(left.source?.document);
    const rightDocument = lower(right.source?.document);
    const leftObject = lower(left.object);
    const rightObject = lower(right.object);

    if (leftDocument && rightDocument && leftDocument !== rightDocument) {
        return false;
    }

    if (leftObject && rightObject) {
        return leftObject === rightObject ||
            leftObject.includes(rightObject) ||
            rightObject.includes(leftObject);
    }

    return true;
}

export function buildWorkflowGraph(activities) {
    const ordered = [...activities].sort((left, right) => {
        const leftIndex = SEQUENCE.indexOf(left.action);
        const rightIndex = SEQUENCE.indexOf(right.action);
        return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
    });

    for (let i = 0; i < ordered.length; i += 1) {
        const current = ordered[i];

        for (let j = i + 1; j < ordered.length; j += 1) {
            const next = ordered[j];

            if (!sameWorkflowContext(current, next)) {
                continue;
            }

            if (SEQUENCE.indexOf(next.action) <= SEQUENCE.indexOf(current.action)) {
                continue;
            }

            current.successors = unique([...current.successors, next.id]);
            next.predecessors = unique([...next.predecessors, current.id]);

            current.dependencies.push({
                type: DependencyType.FINISH_START,
                target: next.id,
                inferred: true,
                confidence: 0.72
            });

            break;
        }
    }

    return ordered;
}

function detectDuplicates(activities) {
    const groups = new Map();

    for (const activity of activities) {
        const key = activityKey(activity);
        const group = groups.get(key) || [];
        group.push(activity);
        groups.set(key, group);
    }

    return [...groups.values()]
        .filter(group => group.length > 1)
        .map(group => ({
            subtype: WorkflowFindingType.DUPLICATE_ACTIVITY,
            severity: WorkflowSeverity.LOW,
            confidence: 0.90,
            activityIds: group.map(activity => activity.id),
            title: `Duplicate workflow activity: ${group[0].action}`,
            explanation:
                "Multiple graph nodes describe the same workflow action in the same document and section.",
            evidence: group.map(activity => activity.source)
        }));
}

function detectMissingPrerequisites(activities) {
    const availableActions = new Set(activities.map(activity => activity.action));
    const required = {
        review: ["submit"],
        approve: ["submit", "review"],
        procure: ["approve"],
        install: ["approve"],
        inspect: ["install"],
        witness: ["test"],
        test: ["install"],
        commission: ["test"],
        accept: ["inspect", "test"],
        closeout: ["accept"]
    };

    const findings = [];

    for (const activity of activities) {
        const alternatives = required[activity.action];
        if (!alternatives?.length) {
            continue;
        }

        const satisfied = alternatives.some(action => availableActions.has(action));
        if (satisfied) {
            continue;
        }

        findings.push({
            subtype: WorkflowFindingType.MISSING_PREREQUISITE,
            severity: GATED_ACTIONS.has(activity.action)
                ? WorkflowSeverity.HIGH
                : WorkflowSeverity.MEDIUM,
            confidence: 0.88,
            activityIds: [activity.id],
            title: `Missing prerequisite for ${activity.action}`,
            explanation:
                `The workflow contains "${activity.action}" without a recognized prerequisite ` +
                `(${alternatives.join(" or ")}).`,
            evidence: [activity.source],
            missing: alternatives
        });
    }

    return findings;
}

function detectMissingApproval(activities) {
    const approvals = activities.filter(activity => activity.action === "approve");
    const findings = [];

    for (const activity of activities) {
        if (!["procure", "install", "commission", "accept"].includes(activity.action)) {
            continue;
        }

        const approval = approvals.find(candidate => sameWorkflowContext(candidate, activity));
        const explicitApproval = activity.dependencies.some(
            dependency => dependency.type === DependencyType.APPROVAL
        );

        if (!approval && !explicitApproval) {
            findings.push({
                subtype: WorkflowFindingType.MISSING_APPROVAL,
                severity: WorkflowSeverity.HIGH,
                confidence: 0.90,
                activityIds: [activity.id],
                title: `Approval gate not established before ${activity.action}`,
                explanation:
                    `No approval activity or explicit approval dependency was found for "${activity.action}".`,
                evidence: [activity.source]
            });
        }
    }

    return findings;
}

function detectMissingInspectionAndTesting(activities) {
    const findings = [];
    const actions = new Set(activities.map(activity => activity.action));

    if (actions.has("accept") && !actions.has("inspect")) {
        findings.push({
            subtype: WorkflowFindingType.MISSING_INSPECTION,
            severity: WorkflowSeverity.HIGH,
            confidence: 0.93,
            activityIds: activities.filter(activity => activity.action === "accept").map(activity => activity.id),
            title: "Acceptance workflow lacks inspection",
            explanation:
                "Owner acceptance is present, but no inspection activity was identified.",
            evidence: activities.filter(activity => activity.action === "accept").map(activity => activity.source)
        });
    }

    if ((actions.has("commission") || actions.has("accept")) && !actions.has("test")) {
        findings.push({
            subtype: WorkflowFindingType.MISSING_TEST,
            severity: WorkflowSeverity.HIGH,
            confidence: 0.93,
            activityIds: activities
                .filter(activity => ["commission", "accept"].includes(activity.action))
                .map(activity => activity.id),
            title: "Commissioning or acceptance workflow lacks testing",
            explanation:
                "Commissioning or acceptance is present, but no testing activity was identified.",
            evidence: activities
                .filter(activity => ["commission", "accept"].includes(activity.action))
                .map(activity => activity.source)
        });
    }

    return findings;
}

function detectMissingEvidence(activities) {
    return activities
        .filter(activity =>
            ["inspect", "test", "commission", "accept", "closeout"].includes(activity.action) &&
            activity.requiredEvidence.length === 0
        )
        .map(activity => ({
            subtype: WorkflowFindingType.MISSING_EVIDENCE,
            severity: activity.action === "accept"
                ? WorkflowSeverity.HIGH
                : WorkflowSeverity.MEDIUM,
            confidence: 0.80,
            activityIds: [activity.id],
            title: `Evidence requirement not identified for ${activity.action}`,
            explanation:
                `The "${activity.action}" activity does not identify a required report, record, certificate, or other evidence.`,
            evidence: [activity.source]
        }));
}

function detectAmbiguousResponsibility(activities) {
    return activities
        .filter(activity =>
            GATED_ACTIONS.has(activity.action) &&
            !activity.responsibleParty
        )
        .map(activity => ({
            subtype: WorkflowFindingType.AMBIGUOUS_RESPONSIBILITY,
            severity: WorkflowSeverity.MEDIUM,
            confidence: 0.78,
            activityIds: [activity.id],
            title: `Responsible party not identified for ${activity.action}`,
            explanation:
                `The workflow requires "${activity.action}", but no responsible party was identified.`,
            evidence: [activity.source]
        }));
}

function detectBlockedActivities(activities) {
    return activities
        .filter(activity => activity.status === WorkflowStatus.BLOCKED)
        .map(activity => ({
            subtype: WorkflowFindingType.BLOCKED_ACTIVITY,
            severity: WorkflowSeverity.HIGH,
            confidence: 0.96,
            activityIds: [activity.id],
            title: `Workflow activity is blocked: ${activity.action}`,
            explanation:
                `The "${activity.action}" activity is blocked or awaiting an unresolved condition.`,
            evidence: [activity.source]
        }));
}

function detectDeadEnds(activities) {
    if (activities.length < 2) {
        return [];
    }

    return activities
        .filter(activity =>
            activity.successors.length === 0 &&
            !TERMINAL_ACTIONS.has(activity.action)
        )
        .map(activity => ({
            subtype: WorkflowFindingType.DEAD_END,
            severity: WorkflowSeverity.MEDIUM,
            confidence: 0.84,
            activityIds: [activity.id],
            title: `Workflow ends prematurely at ${activity.action}`,
            explanation:
                `The "${activity.action}" activity has no recognized successor and is not a terminal workflow action.`,
            evidence: [activity.source]
        }));
}

function detectOrphans(activities) {
    if (activities.length < 3) {
        return [];
    }

    return activities
        .filter(activity =>
            activity.predecessors.length === 0 &&
            activity.successors.length === 0 &&
            !["coordinate", "submit"].includes(activity.action)
        )
        .map(activity => ({
            subtype: WorkflowFindingType.ORPHAN_ACTIVITY,
            severity: WorkflowSeverity.LOW,
            confidence: 0.76,
            activityIds: [activity.id],
            title: `Unlinked workflow activity: ${activity.action}`,
            explanation:
                `The "${activity.action}" activity could not be linked to another workflow activity.`,
            evidence: [activity.source]
        }));
}

function detectCircularDependencies(activities) {
    const map = new Map(activities.map(activity => [activity.id, activity]));
    const visiting = new Set();
    const visited = new Set();
    const findings = [];
    const emitted = new Set();

    function visit(activityId, path = []) {
        if (visiting.has(activityId)) {
            const cycleStart = path.indexOf(activityId);
            const cycle = cycleStart >= 0 ? path.slice(cycleStart).concat(activityId) : [...path, activityId];
            const key = [...cycle].sort().join("|");

            if (!emitted.has(key)) {
                emitted.add(key);
                findings.push({
                    subtype: WorkflowFindingType.CIRCULAR_DEPENDENCY,
                    severity: WorkflowSeverity.CRITICAL,
                    confidence: 0.99,
                    activityIds: cycle,
                    title: "Circular workflow dependency",
                    explanation:
                        "The workflow contains a dependency cycle that prevents a valid execution order.",
                    evidence: cycle
                        .map(id => map.get(id)?.source)
                        .filter(Boolean)
                });
            }

            return;
        }

        if (visited.has(activityId)) {
            return;
        }

        visiting.add(activityId);
        const activity = map.get(activityId);

        for (const successorId of activity?.successors || []) {
            visit(successorId, [...path, activityId]);
        }

        visiting.delete(activityId);
        visited.add(activityId);
    }

    for (const activity of activities) {
        visit(activity.id);
    }

    return findings;
}

function detectIncompleteWorkflow(activities) {
    const actions = new Set(activities.map(activity => activity.action));
    const starts = ["coordinate", "submit", "approve", "install"].some(action => actions.has(action));
    const terminates = ["accept", "closeout", "warranty"].some(action => actions.has(action));

    if (!starts || terminates || activities.length < 3) {
        return [];
    }

    return [{
        subtype: WorkflowFindingType.INCOMPLETE_WORKFLOW,
        severity: WorkflowSeverity.MEDIUM,
        confidence: 0.86,
        activityIds: activities.map(activity => activity.id),
        title: "Workflow lacks an acceptance or closeout endpoint",
        explanation:
            "The identified workflow begins and progresses through work activities but does not establish acceptance, closeout, or warranty completion.",
        evidence: activities.map(activity => activity.source)
    }];
}

export function analyzeWorkflow(activities) {
    return [
        ...detectDuplicates(activities),
        ...detectMissingPrerequisites(activities),
        ...detectMissingApproval(activities),
        ...detectMissingInspectionAndTesting(activities),
        ...detectMissingEvidence(activities),
        ...detectAmbiguousResponsibility(activities),
        ...detectBlockedActivities(activities),
        ...detectDeadEnds(activities),
        ...detectOrphans(activities),
        ...detectCircularDependencies(activities),
        ...detectIncompleteWorkflow(activities)
    ];
}

function severityWeight(severity) {
    return {
        [WorkflowSeverity.INFO]: 1,
        [WorkflowSeverity.LOW]: 3,
        [WorkflowSeverity.MEDIUM]: 7,
        [WorkflowSeverity.HIGH]: 14,
        [WorkflowSeverity.CRITICAL]: 25
    }[severity] ?? 5;
}

export function scoreWorkflow(findings) {
    const penalty = findings.reduce(
        (total, finding) => total + severityWeight(finding.severity) * clamp(finding.confidence, 0.25, 1),
        0
    );

    return Math.max(0, Math.round(100 - penalty));
}

function recommendationFor(finding) {
    const recommendations = {
        [WorkflowFindingType.MISSING_PREREQUISITE]:
            "Add the missing predecessor activity and link it to the affected workflow step.",
        [WorkflowFindingType.MISSING_APPROVAL]:
            "Establish the required approval gate, approving authority, and approval evidence before work proceeds.",
        [WorkflowFindingType.MISSING_INSPECTION]:
            "Add an inspection activity before acceptance and identify the inspector and acceptance criteria.",
        [WorkflowFindingType.MISSING_TEST]:
            "Add the required testing activity, test standard, witness requirements, and report deliverable.",
        [WorkflowFindingType.MISSING_EVIDENCE]:
            "Define the evidence required to demonstrate completion, including report, certificate, photo, or signed record.",
        [WorkflowFindingType.CIRCULAR_DEPENDENCY]:
            "Break the circular dependency and revalidate the workflow sequence.",
        [WorkflowFindingType.DEAD_END]:
            "Define the successor activity or explicitly designate the activity as a terminal step.",
        [WorkflowFindingType.ORPHAN_ACTIVITY]:
            "Link the activity to its prerequisite and successor, or remove it from the workflow if it is unrelated.",
        [WorkflowFindingType.BLOCKED_ACTIVITY]:
            "Identify the blocking condition, assign an owner, and establish the action required to release the activity.",
        [WorkflowFindingType.DUPLICATE_ACTIVITY]:
            "Consolidate duplicate activities while preserving all source references.",
        [WorkflowFindingType.AMBIGUOUS_RESPONSIBILITY]:
            "Assign the responsible party and identify the authority that verifies completion.",
        [WorkflowFindingType.INCOMPLETE_WORKFLOW]:
            "Add acceptance, turnover, closeout, and warranty steps as applicable."
    };

    return {
        findingId: finding.id,
        priority:
            finding.severity === WorkflowSeverity.CRITICAL ? "immediate" :
            finding.severity === WorkflowSeverity.HIGH ? "high" :
            finding.severity === WorkflowSeverity.MEDIUM ? "medium" : "low",
        action:
            recommendations[finding.subtype] ??
            "Review and correct the identified workflow condition.",
        verification:
            "Re-run workflow reasoning and confirm the finding is resolved with traceable source evidence."
    };
}

function buildSummary(activities, findings) {
    const countsByPhase = {};
    const countsByStatus = {};
    const countsBySeverity = {};

    for (const activity of activities) {
        countsByPhase[activity.phase] = (countsByPhase[activity.phase] || 0) + 1;
        countsByStatus[activity.status] = (countsByStatus[activity.status] || 0) + 1;
    }

    for (const finding of findings) {
        countsBySeverity[finding.severity] =
            (countsBySeverity[finding.severity] || 0) + 1;
    }

    const score = scoreWorkflow(findings);

    return {
        activityCount: activities.length,
        findingCount: findings.length,
        workflowScore: score,
        status:
            countsBySeverity[WorkflowSeverity.CRITICAL] ? "critical" :
            countsBySeverity[WorkflowSeverity.HIGH] ? "attention_required" :
            findings.length ? "review_required" : "healthy",
        countsByPhase,
        countsByStatus,
        countsBySeverity
    };
}

function graphNodes(graph) {
    if (typeof graph.findNodes === "function") {
        return graph.findNodes({});
    }

    if (typeof graph.getNodes === "function") {
        return graph.getNodes();
    }

    if (graph.nodes instanceof Map) {
        return [...graph.nodes.values()];
    }

    if (Array.isArray(graph.nodes)) {
        return graph.nodes;
    }

    return [];
}

export class WorkflowRule extends ReasoningRule {
    constructor(options = {}) {
        super(options.name || "Workflow Rule", options.priority ?? 65);
        this.options = {
            includeNodeTypes: options.includeNodeTypes ?? null,
            minimumConfidence: options.minimumConfidence ?? 0.70
        };
    }

    appliesTo(graph) {
        return Boolean(graph) && (
            typeof graph.findNodes === "function" ||
            typeof graph.getNodes === "function" ||
            graph.nodes instanceof Map ||
            Array.isArray(graph.nodes)
        );
    }

    execute(graph, result) {
        const nodes = graphNodes(graph).filter(node => {
            if (!this.options.includeNodeTypes) {
                return true;
            }

            return this.options.includeNodeTypes.includes(lower(node.type));
        });

        const extracted = [];

        for (const node of nodes) {
            extracted.push(
                ...extractWorkflowActivities(node)
                    .filter(activity => activity.confidence >= this.options.minimumConfidence)
            );
        }

        const activities = buildWorkflowGraph(
            mergeDuplicateActivities(extracted)
        );

        const rawFindings = analyzeWorkflow(activities);
        const findings = rawFindings.map((finding, index) => ({
            id: `workflow-finding-${index + 1}`,
            type: "workflow",
            governingNodeId: finding.activityIds?.[0] ?? null,
            ...finding
        }));

        result.workflow = {
            activities,
            findings,
            recommendations: findings.map(recommendationFor),
            summary: buildSummary(activities, findings)
        };

        for (const finding of findings) {
            result.addFinding(finding);
            result.addExplanation({
                findingId: finding.id,
                title: finding.title,
                text: finding.explanation,
                evidence: finding.evidence
            });
            result.addRecommendation(recommendationFor(finding));
        }

        result.metrics.workflowActivities = activities.length;
        result.metrics.workflowFindings = findings.length;
        result.metrics.workflowScore = result.workflow.summary.workflowScore;

        return result.workflow;
    }
}

export function registerWorkflowRule(reasoner, options = {}) {
    if (!reasoner || typeof reasoner.registerRule !== "function") {
        throw new TypeError("reasoner must provide registerRule().");
    }

    reasoner.registerRule(new WorkflowRule(options));
    return reasoner;
}

export default WorkflowRule;
