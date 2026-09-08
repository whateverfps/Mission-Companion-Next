import {
  extractRequirements,
  buildRequirementGraph
} from "../retrieval.js";
import {
  normalizedKey as normalizeKey,
  normalizedText as normalize
} from "../data-model.js";

/* =====================================================================
   Constants
   ===================================================================== */

const PHASE_ORDER = [
  "preconstruction",
  "submittal",
  "procurement",
  "installation",
  "inspection",
  "testing",
  "commissioning",
  "acceptance",
  "closeout",
  "warranty",
  "general"
];

const PHASE_RANK = new Map(
  PHASE_ORDER.map((phase, index) => [
    phase,
    index
  ])
);

const PREDECESSOR_PATTERNS = [
  /\bprior to\b/i,
  /\bbefore\b/i,
  /\bin advance of\b/i,
  /\bpreceding\b/i,
  /\bprerequisite\b/i,
  /\bcondition precedent\b/i,
  /\bnot until\b/i,
  /\bshall not begin until\b/i,
  /\bshall not proceed until\b/i,
  /\bmay not begin until\b/i,
  /\bmust be completed before\b/i
];

const SUCCESSOR_PATTERNS = [
  /\bafter\b/i,
  /\bfollowing\b/i,
  /\bupon completion of\b/i,
  /\bsubsequent to\b/i,
  /\bthereafter\b/i,
  /\bonce\b/i,
  /\bwhen complete\b/i
];

const BLOCKING_PATTERNS = [
  /\bshall not proceed\b/i,
  /\bshall not begin\b/i,
  /\bshall not continue\b/i,
  /\bmay not proceed\b/i,
  /\bmay not begin\b/i,
  /\buntil approved\b/i,
  /\buntil accepted\b/i,
  /\buntil completed\b/i,
  /\bpending approval\b/i,
  /\bsubject to approval\b/i
];

const DEPENDENCY_TERMS = {
  preconstruction: [
    "notice to proceed",
    "ntp",
    "kickoff",
    "preconstruction meeting",
    "coordination meeting",
    "site access",
    "mobilization",
    "permit",
    "work plan",
    "safety plan",
    "icra",
    "pcra"
  ],

  submittal: [
    "submittal",
    "shop drawing",
    "product data",
    "sample",
    "mockup",
    "approval",
    "approved submittal"
  ],

  procurement: [
    "procure",
    "procurement",
    "purchase",
    "fabrication",
    "manufacture",
    "delivery",
    "material receipt",
    "equipment received"
  ],

  installation: [
    "install",
    "installation",
    "construct",
    "erect",
    "place",
    "apply",
    "execute work",
    "perform work"
  ],

  inspection: [
    "inspect",
    "inspection",
    "verify",
    "verification",
    "quality control",
    "quality assurance",
    "qc inspection",
    "owner inspection"
  ],

  testing: [
    "test",
    "testing",
    "functional test",
    "pressure test",
    "cable test",
    "performance test",
    "startup"
  ],

  commissioning: [
    "commission",
    "commissioning",
    "functional performance",
    "systems verification",
    "integrated systems test",
    "demonstration"
  ],

  acceptance: [
    "accept",
    "accepted",
    "acceptance",
    "approve",
    "approval",
    "substantial completion",
    "beneficial occupancy"
  ],

  closeout: [
    "closeout",
    "turnover",
    "record drawing",
    "as-built",
    "as built",
    "o&m manual",
    "operation manual",
    "maintenance manual",
    "training",
    "punch list",
    "final completion"
  ],

  warranty: [
    "warranty",
    "warranty period",
    "correction period"
  ]
};

/* =====================================================================
   Utilities
   ===================================================================== */

function unique(values) {
  return [
    ...new Set(
      (values || [])
        .filter(Boolean)
        .map(value =>
          typeof value === "string"
            ? normalize(value)
            : value
        )
    )
  ];
}

function clamp(value, min, max) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function includesAny(value, terms) {
  const source =
    normalizeKey(value);

  return terms.some(term =>
    source.includes(
      normalizeKey(term)
    )
  );
}

function containsAnyPattern(
  value,
  patterns
) {
  return patterns.some(pattern =>
    pattern.test(
      String(value || "")
    )
  );
}

function graphId(prefix, value) {
  return `${prefix}-${normalizeKey(value)
    .replace(/\s+/g, "-")
    .slice(0, 100)}`;
}

function requirementText(requirement) {
  return normalize([
    requirement.statement,
    requirement.action,
    requirement.heading,
    ...(requirement.path || []),
    ...(requirement.deliverables || []),
    ...(requirement.references || [])
  ].join(" "));
}

function sourceLabel(requirement) {
  return (
    requirement.heading ||
    requirement.documentName ||
    requirement.location ||
    requirement.id
  );
}

/* =====================================================================
   Phase Inference
   ===================================================================== */

export function inferDependencyPhase(
  requirement
) {
  const value =
    requirementText(requirement);

  let bestPhase =
    "general";

  let bestScore =
    0;

  for (
    const [
      phase,
      terms
    ] of Object.entries(
      DEPENDENCY_TERMS
    )
  ) {
    let score =
      0;

    for (const term of terms) {
      if (
        normalizeKey(value).includes(
          normalizeKey(term)
        )
      ) {
        score +=
          term.split(/\s+/).length > 1
            ? 3
            : 1;
      }
    }

    if (score > bestScore) {
      bestScore =
        score;

      bestPhase =
        phase;
    }
  }

  return {
    phase:
      bestPhase,

    score:
      bestScore,

    rank:
      PHASE_RANK.get(bestPhase) ??
      PHASE_ORDER.length
  };
}

/* =====================================================================
   Relationship Detection
   ===================================================================== */

function extractClauseAfterMarker(
  sentence,
  markerPattern
) {
  const match =
    String(sentence || "").match(
      markerPattern
    );

  if (!match) {
    return null;
  }

  const index =
    match.index +
    match[0].length;

  return normalize(
    sentence.slice(index)
  )
    .replace(/^[,;:\-\s]+/, "")
    .replace(/[.;]+$/, "")
    .trim();
}

function extractPredecessorClauses(
  sentence
) {
  const clauses = [];

  const patterns = [
    /\bprior to\b/i,
    /\bbefore\b/i,
    /\bin advance of\b/i,
    /\bnot until\b/i,
    /\bshall not begin until\b/i,
    /\bshall not proceed until\b/i,
    /\bmay not begin until\b/i,
    /\bmust be completed before\b/i
  ];

  for (const pattern of patterns) {
    const clause =
      extractClauseAfterMarker(
        sentence,
        pattern
      );

    if (clause) {
      clauses.push(clause);
    }
  }

  return unique(clauses);
}

function extractSuccessorClauses(
  sentence
) {
  const clauses = [];

  const patterns = [
    /\bafter\b/i,
    /\bfollowing\b/i,
    /\bupon completion of\b/i,
    /\bsubsequent to\b/i,
    /\bthereafter\b/i,
    /\bonce\b/i
  ];

  for (const pattern of patterns) {
    const clause =
      extractClauseAfterMarker(
        sentence,
        pattern
      );

    if (clause) {
      clauses.push(clause);
    }
  }

  return unique(clauses);
}

function keywordOverlapScore(
  first,
  second
) {
  const firstTerms =
    new Set(
      normalizeKey(first)
        .split(/\s+/)
        .filter(term =>
          term.length >= 4
        )
    );

  const secondTerms =
    new Set(
      normalizeKey(second)
        .split(/\s+/)
        .filter(term =>
          term.length >= 4
        )
    );

  if (
    !firstTerms.size ||
    !secondTerms.size
  ) {
    return 0;
  }

  let overlap =
    0;

  for (const term of firstTerms) {
    if (secondTerms.has(term)) {
      overlap += 1;
    }
  }

  return overlap /
    Math.max(
      firstTerms.size,
      secondTerms.size
    );
}

function clauseRequirementScore(
  clause,
  requirement
) {
  const text =
    requirementText(requirement);

  let score =
    keywordOverlapScore(
      clause,
      text
    );

  const phase =
    inferDependencyPhase(
      requirement
    );

  if (
    includesAny(
      clause,
      DEPENDENCY_TERMS[
        phase.phase
      ] || []
    )
  ) {
    score +=
      0.25;
  }

  if (
    requirement.heading &&
    normalizeKey(clause).includes(
      normalizeKey(
        requirement.heading
      )
    )
  ) {
    score +=
      0.25;
  }

  return clamp(
    score,
    0,
    1
  );
}

function findClauseMatches(
  clause,
  requirements,
  excludedId,
  threshold = 0.28
) {
  return requirements
    .filter(requirement =>
      requirement.id !==
      excludedId
    )
    .map(requirement => ({
      requirement,
      score:
        clauseRequirementScore(
          clause,
          requirement
        )
    }))
    .filter(match =>
      match.score >= threshold
    )
    .sort(
      (first, second) =>
        second.score -
        first.score
    )
    .slice(0, 5);
}

function inferPhaseEdges(
  requirements
) {
  const edges = [];

  for (const first of requirements) {
    const firstPhase =
      inferDependencyPhase(first);

    if (
      firstPhase.phase === "general"
    ) {
      continue;
    }

    for (const second of requirements) {
      if (
        first.id === second.id
      ) {
        continue;
      }

      const secondPhase =
        inferDependencyPhase(second);

      if (
        secondPhase.phase === "general"
      ) {
        continue;
      }

      const difference =
        secondPhase.rank -
        firstPhase.rank;

      if (difference !== 1) {
        continue;
      }

      const sameDocument =
        first.documentId &&
        second.documentId &&
        first.documentId ===
        second.documentId;

      const sameHeading =
        normalizeKey(first.heading) ===
        normalizeKey(second.heading);

      const overlap =
        keywordOverlapScore(
          requirementText(first),
          requirementText(second)
        );

      if (
        sameHeading ||
        (
          sameDocument &&
          overlap >= 0.12
        ) ||
        overlap >= 0.28
      ) {
        edges.push({
          from:
            first.id,

          to:
            second.id,

          type:
            "phase-sequence",

          confidence:
            clamp(
              Math.round(
                (
                  0.45 +
                  overlap +
                  (sameHeading ? 0.2 : 0) +
                  (sameDocument ? 0.1 : 0)
                ) *
                100
              ),
              0,
              100
            ),

          reason:
            `${firstPhase.phase} normally precedes ${secondPhase.phase}.`
        });
      }
    }
  }

  return edges;
}

/* =====================================================================
   Dependency Graph
   ===================================================================== */

export function buildDependencyGraph(
  hits,
  options = {}
) {
  const {
    includePhaseInference = true,
    clauseMatchThreshold = 0.28
  } = options || {};

  const result =
    extractRequirements(hits);

  const requirements =
    result.requirements;

  const nodeMap =
    new Map();

  const edgeMap =
    new Map();

  for (const requirement of requirements) {
    const phase =
      inferDependencyPhase(
        requirement
      );

    nodeMap.set(
      requirement.id,
      {
        id:
          requirement.id,

        type:
          "requirement",

        label:
          requirement.statement,

        phase:
          phase.phase,

        phaseRank:
          phase.rank,

        requirementType:
          requirement.type,

        responsibleParty:
          requirement.responsibleParty ||
          requirement.subject,

        confidence:
          requirement.confidence,

        sourceNumber:
          requirement.sourceNumber,

        documentName:
          requirement.documentName,

        heading:
          requirement.heading,

        location:
          requirement.location
      }
    );

    const predecessorClauses =
      extractPredecessorClauses(
        requirement.statement
      );

    for (
      const clause of
      predecessorClauses
    ) {
      const matches =
        findClauseMatches(
          clause,
          requirements,
          requirement.id,
          clauseMatchThreshold
        );

      for (const match of matches) {
        const id =
          `${match.requirement.id}->${requirement.id}:explicit-predecessor`;

        edgeMap.set(id, {
          id,

          from:
            match.requirement.id,

          to:
            requirement.id,

          type:
            "explicit-predecessor",

          confidence:
            Math.round(
              match.score * 100
            ),

          reason:
            clause,

          sourceRequirementId:
            requirement.id
        });
      }
    }

    const successorClauses =
      extractSuccessorClauses(
        requirement.statement
      );

    for (
      const clause of
      successorClauses
    ) {
      const matches =
        findClauseMatches(
          clause,
          requirements,
          requirement.id,
          clauseMatchThreshold
        );

      for (const match of matches) {
        const id =
          `${match.requirement.id}->${requirement.id}:explicit-successor`;

        edgeMap.set(id, {
          id,

          from:
            match.requirement.id,

          to:
            requirement.id,

          type:
            "explicit-successor",

          confidence:
            Math.round(
              match.score * 100
            ),

          reason:
            clause,

          sourceRequirementId:
            requirement.id
        });
      }
    }
  }

  if (includePhaseInference) {
    const phaseEdges =
      inferPhaseEdges(requirements);

    for (const edge of phaseEdges) {
      const id =
        `${edge.from}->${edge.to}:${edge.type}`;

      if (!edgeMap.has(id)) {
        edgeMap.set(id, {
          ...edge,
          id
        });
      }
    }
  }

  const edges =
    [...edgeMap.values()];

  const predecessors =
    new Map();

  const successors =
    new Map();

  for (const edge of edges) {
    if (!predecessors.has(edge.to)) {
      predecessors.set(
        edge.to,
        []
      );
    }

    predecessors
      .get(edge.to)
      .push(edge);

    if (!successors.has(edge.from)) {
      successors.set(
        edge.from,
        []
      );
    }

    successors
      .get(edge.from)
      .push(edge);
  }

  return {
    nodes:
      [...nodeMap.values()],

    edges,

    requirements,

    indexes: {
      predecessors,
      successors
    },

    summary: {
      requirements:
        requirements.length,

      edges:
        edges.length,

      explicitDependencies:
        edges.filter(edge =>
          edge.type.startsWith(
            "explicit"
          )
        ).length,

      inferredDependencies:
        edges.filter(edge =>
          edge.type ===
          "phase-sequence"
        ).length,

      rootRequirements:
        requirements.filter(
          requirement =>
            !predecessors.has(
              requirement.id
            )
        ).length,

      terminalRequirements:
        requirements.filter(
          requirement =>
            !successors.has(
              requirement.id
            )
        ).length
    }
  };
}

/* =====================================================================
   Traversal
   ===================================================================== */

function traverseGraph(
  graph,
  startId,
  direction,
  options = {}
) {
  const {
    maxDepth = 10,
    includeStart = false
  } = options || {};

  const index =
    direction === "predecessors"
      ? graph.indexes.predecessors
      : graph.indexes.successors;

  const visited =
    new Set();

  const queue = [
    {
      id:
        startId,
      depth:
        0,
      path:
        [startId]
    }
  ];

  const results = [];

  while (queue.length) {
    const current =
      queue.shift();

    if (
      current.depth > maxDepth
    ) {
      continue;
    }

    if (
      visited.has(current.id)
    ) {
      continue;
    }

    visited.add(current.id);

    if (
      includeStart ||
      current.id !== startId
    ) {
      results.push(current);
    }

    const edges =
      index.get(current.id) || [];

    for (const edge of edges) {
      const nextId =
        direction === "predecessors"
          ? edge.from
          : edge.to;

      if (
        current.path.includes(
          nextId
        )
      ) {
        continue;
      }

      queue.push({
        id:
          nextId,

        depth:
          current.depth + 1,

        via:
          edge,

        path:
          [
            ...current.path,
            nextId
          ]
      });
    }
  }

  return results;
}

export function findPrerequisites(
  graph,
  requirementId,
  options = {}
) {
  const traversed =
    traverseGraph(
      graph,
      requirementId,
      "predecessors",
      options
    );

  const nodeMap =
    new Map(
      graph.nodes.map(node => [
        node.id,
        node
      ])
    );

  return traversed.map(
    result => ({
      ...result,
      requirement:
        nodeMap.get(
          result.id
        )
    })
  );
}

export function findSuccessors(
  graph,
  requirementId,
  options = {}
) {
  const traversed =
    traverseGraph(
      graph,
      requirementId,
      "successors",
      options
    );

  const nodeMap =
    new Map(
      graph.nodes.map(node => [
        node.id,
        node
      ])
    );

  return traversed.map(
    result => ({
      ...result,
      requirement:
        nodeMap.get(
          result.id
        )
    })
  );
}

export function traceRequirementDependencies(
  graph,
  requirementId,
  options = {}
) {
  return {
    requirement:
      graph.nodes.find(
        node =>
          node.id ===
          requirementId
      ) || null,

    prerequisites:
      findPrerequisites(
        graph,
        requirementId,
        options
      ),

    successors:
      findSuccessors(
        graph,
        requirementId,
        options
      )
  };
}

/* =====================================================================
   Workflow Path
   ===================================================================== */

export function findWorkflowPath(
  graph,
  startId,
  endId,
  options = {}
) {
  const {
    maxDepth = 20
  } = options || {};

  const queue = [
    {
      id:
        startId,
      path:
        [startId],
      edges:
        []
    }
  ];

  const visited =
    new Set();

  while (queue.length) {
    const current =
      queue.shift();

    if (
      current.id === endId
    ) {
      const nodeMap =
        new Map(
          graph.nodes.map(node => [
            node.id,
            node
          ])
        );

      return {
        found:
          true,

        nodeIds:
          current.path,

        nodes:
          current.path.map(
            id =>
              nodeMap.get(id)
          ),

        edges:
          current.edges,

        length:
          current.edges.length
      };
    }

    if (
      current.edges.length >=
      maxDepth
    ) {
      continue;
    }

    if (
      visited.has(current.id)
    ) {
      continue;
    }

    visited.add(current.id);

    const successors =
      graph.indexes.successors.get(
        current.id
      ) || [];

    for (const edge of successors) {
      if (
        current.path.includes(
          edge.to
        )
      ) {
        continue;
      }

      queue.push({
        id:
          edge.to,

        path:
          [
            ...current.path,
            edge.to
          ],

        edges:
          [
            ...current.edges,
            edge
          ]
      });
    }
  }

  return {
    found:
      false,

    nodeIds:
      [],

    nodes:
      [],

    edges:
      [],

    length:
      0
  };
}

/* =====================================================================
   Criticality
   ===================================================================== */

function dependencyDegree(
  graph,
  requirementId
) {
  const predecessorCount =
    (
      graph.indexes.predecessors.get(
        requirementId
      ) || []
    ).length;

  const successorCount =
    (
      graph.indexes.successors.get(
        requirementId
      ) || []
    ).length;

  return {
    predecessorCount,
    successorCount,
    total:
      predecessorCount +
      successorCount
  };
}

function criticalityScore(
  graph,
  requirement
) {
  const degree =
    dependencyDegree(
      graph,
      requirement.id
    );

  const phase =
    inferDependencyPhase(
      requirement
    );

  let score =
    0;

  score +=
    degree.successorCount * 12;

  score +=
    degree.predecessorCount * 5;

  if (
    requirement.type ===
    "mandatory"
  ) {
    score +=
      20;
  }

  if (
    requirement.type ===
    "prohibited"
  ) {
    score +=
      25;
  }

  if (
    containsAnyPattern(
      requirement.statement,
      BLOCKING_PATTERNS
    )
  ) {
    score +=
      25;
  }

  if (
    [
      "submittal",
      "inspection",
      "testing",
      "commissioning",
      "acceptance"
    ].includes(phase.phase)
  ) {
    score +=
      10;
  }

  if (
    requirement.references?.length
  ) {
    score +=
      Math.min(
        requirement.references.length *
        3,
        12
      );
  }

  return clamp(
    score,
    0,
    100
  );
}

export function findCriticalRequirements(
  graph,
  options = {}
) {
  const {
    minimumScore = 35,
    limit = 50
  } = options || {};

  return graph.requirements
    .map(requirement => {
      const degree =
        dependencyDegree(
          graph,
          requirement.id
        );

      return {
        requirement,
        score:
          criticalityScore(
            graph,
            requirement
          ),

        predecessorCount:
          degree.predecessorCount,

        successorCount:
          degree.successorCount,

        phase:
          inferDependencyPhase(
            requirement
          ).phase,

        blockingLanguage:
          containsAnyPattern(
            requirement.statement,
            BLOCKING_PATTERNS
          )
      };
    })
    .filter(item =>
      item.score >=
      minimumScore
    )
    .sort(
      (first, second) =>
        second.score -
        first.score
    )
    .slice(0, limit);
}

/* =====================================================================
   Blocked Work
   ===================================================================== */

function requirementStatusMap(
  complianceMatrix
) {
  const map =
    new Map();

  for (
    const row of
    complianceMatrix?.rows || []
  ) {
    map.set(
      row.id,
      row.status
    );
  }

  return map;
}

function statusComplete(status) {
  return [
    "supported",
    "controlled",
    "complete",
    "approved",
    "accepted",
    "closed"
  ].includes(
    normalizeKey(status)
  );
}

export function findBlockedRequirements(
  graph,
  complianceMatrix
) {
  const statusMap =
    requirementStatusMap(
      complianceMatrix
    );

  const blocked = [];

  for (
    const requirement of
    graph.requirements
  ) {
    const predecessorEdges =
      graph.indexes.predecessors.get(
        requirement.id
      ) || [];

    if (!predecessorEdges.length) {
      continue;
    }

    const incompletePredecessors =
      predecessorEdges
        .map(edge => ({
          edge,
          requirement:
            graph.requirements.find(
              item =>
                item.id ===
                edge.from
            ),

          status:
            statusMap.get(
              edge.from
            ) ||
            "not-assessed"
        }))
        .filter(item =>
          !statusComplete(
            item.status
          )
        );

    if (
      !incompletePredecessors.length
    ) {
      continue;
    }

    blocked.push({
      requirement,

      status:
        statusMap.get(
          requirement.id
        ) ||
        "not-assessed",

      blockedBy:
        incompletePredecessors,

      blockerCount:
        incompletePredecessors.length,

      criticality:
        criticalityScore(
          graph,
          requirement
        )
    });
  }

  return blocked.sort(
    (first, second) =>
      second.criticality -
      first.criticality ||
      second.blockerCount -
      first.blockerCount
  );
}

/* =====================================================================
   Workflow Sequence
   ===================================================================== */

function topologicalSort(
  graph
) {
  const indegree =
    new Map();

  const adjacency =
    new Map();

  for (const node of graph.nodes) {
    indegree.set(
      node.id,
      0
    );

    adjacency.set(
      node.id,
      []
    );
  }

  for (const edge of graph.edges) {
    if (
      !indegree.has(edge.from) ||
      !indegree.has(edge.to)
    ) {
      continue;
    }

    adjacency
      .get(edge.from)
      .push(edge.to);

    indegree.set(
      edge.to,
      (
        indegree.get(edge.to) ||
        0
      ) + 1
    );
  }

  const queue =
    [...graph.nodes]
      .filter(node =>
        indegree.get(node.id) ===
        0
      )
      .sort(
        (first, second) =>
          (
            first.phaseRank ??
            999
          ) -
          (
            second.phaseRank ??
            999
          )
      )
      .map(node =>
        node.id
      );

  const ordered =
    [];

  while (queue.length) {
    const id =
      queue.shift();

    ordered.push(id);

    for (
      const successor of
      adjacency.get(id) || []
    ) {
      indegree.set(
        successor,
        indegree.get(successor) -
        1
      );

      if (
        indegree.get(successor) ===
        0
      ) {
        queue.push(successor);
      }
    }

    queue.sort(
      (firstId, secondId) => {
        const first =
          graph.nodes.find(
            node =>
              node.id ===
              firstId
          );

        const second =
          graph.nodes.find(
            node =>
              node.id ===
              secondId
          );

        return (
          (
            first?.phaseRank ??
            999
          ) -
          (
            second?.phaseRank ??
            999
          )
        );
      }
    );
  }

  const cyclic =
    graph.nodes
      .filter(
        node =>
          !ordered.includes(
            node.id
          )
      )
      .map(node =>
        node.id
      );

  return {
    ordered,
    cyclic
  };
}

export function buildWorkflowSequence(
  graph
) {
  const nodeMap =
    new Map(
      graph.nodes.map(node => [
        node.id,
        node
      ])
    );

  const sorted =
    topologicalSort(graph);

  const orderedNodes =
    sorted.ordered.map(
      id =>
        nodeMap.get(id)
    );

  const byPhase =
    PHASE_ORDER.reduce(
      (groups, phase) => {
        groups[phase] =
          orderedNodes.filter(
            node =>
              node.phase === phase
          );

        return groups;
      },
      {}
    );

  return {
    ordered:
      orderedNodes,

    byPhase,

    cyclicRequirements:
      sorted.cyclic.map(
        id =>
          nodeMap.get(id)
      ),

    summary: {
      total:
        orderedNodes.length,

      cycles:
        sorted.cyclic.length,

      phasesUsed:
        Object.entries(byPhase)
          .filter(
            ([, items]) =>
              items.length
          )
          .map(
            ([phase]) =>
              phase
          )
    }
  };
}

/* =====================================================================
   Question Helpers
   ===================================================================== */

function scoreRequirementForQuery(
  requirement,
  query
) {
  const queryKey =
    normalizeKey(query);

  const text =
    normalizeKey(
      requirementText(
        requirement
      )
    );

  const queryTerms =
    queryKey
      .split(/\s+/)
      .filter(term =>
        term.length >= 3
      );

  if (!queryTerms.length) {
    return 0;
  }

  let matches =
    0;

  for (const term of queryTerms) {
    if (text.includes(term)) {
      matches +=
        1;
    }
  }

  let score =
    matches /
    queryTerms.length;

  if (
    requirement.heading &&
    queryKey.includes(
      normalizeKey(
        requirement.heading
      )
    )
  ) {
    score +=
      0.2;
  }

  if (
    requirement.responsibleParty &&
    queryKey.includes(
      normalizeKey(
        requirement.responsibleParty
      )
    )
  ) {
    score +=
      0.15;
  }

  return clamp(
    score,
    0,
    1
  );
}

export function findRequirementByQuery(
  graph,
  query,
  options = {}
) {
  const {
    limit = 10,
    minimumScore = 0.2
  } = options || {};

  return graph.requirements
    .map(requirement => ({
      requirement,
      score:
        scoreRequirementForQuery(
          requirement,
          query
        )
    }))
    .filter(match =>
      match.score >=
      minimumScore
    )
    .sort(
      (first, second) =>
        second.score -
        first.score
    )
    .slice(0, limit);
}

export function answerDependencyQuestion(
  graph,
  question,
  options = {}
) {
  const matches =
    findRequirementByQuery(
      graph,
      question,
      {
        limit:
          options.limit || 5,

        minimumScore:
          options.minimumScore ||
          0.2
      }
    );

  const lower =
    normalizeKey(question);

  const asksBefore =
    /\b(before|prerequisite|required first|must happen first|what blocks|blocking)\b/.test(
      lower
    );

  const asksAfter =
    /\b(after|next|successor|what follows|then what)\b/.test(
      lower
    );

  const results =
    matches.map(match => {
      const trace =
        traceRequirementDependencies(
          graph,
          match.requirement.id,
          options
        );

      return {
        matchScore:
          Math.round(
            match.score * 100
          ),

        requirement:
          match.requirement,

        prerequisites:
          asksAfter
            ? []
            : trace.prerequisites,

        successors:
          asksBefore
            ? []
            : trace.successors
      };
    });

  return {
    question,

    intent:
      asksBefore
        ? "prerequisites"
        : asksAfter
          ? "successors"
          : "dependency-trace",

    matches:
      results,

    summary:
      results.length
        ? `Found ${results.length} matching requirement dependency trace${results.length === 1 ? "" : "s"}.`
        : "No matching requirement dependency trace was found."
  };
}

/* =====================================================================
   Dependency Engine Class
   ===================================================================== */

export class DependencyEngine {

  constructor(
    hits = [],
    options = {}
  ) {
    this.hits =
      hits;

    this.options =
      options;

    this.graph =
      null;
  }

  build() {
    this.graph =
      buildDependencyGraph(
        this.hits,
        this.options
      );

    return this.graph;
  }

  ensureGraph() {
    return (
      this.graph ||
      this.build()
    );
  }

  prerequisites(
    requirementId,
    options = {}
  ) {
    return findPrerequisites(
      this.ensureGraph(),
      requirementId,
      options
    );
  }

  successors(
    requirementId,
    options = {}
  ) {
    return findSuccessors(
      this.ensureGraph(),
      requirementId,
      options
    );
  }

  trace(
    requirementId,
    options = {}
  ) {
    return traceRequirementDependencies(
      this.ensureGraph(),
      requirementId,
      options
    );
  }

  path(
    startId,
    endId,
    options = {}
  ) {
    return findWorkflowPath(
      this.ensureGraph(),
      startId,
      endId,
      options
    );
  }

  critical(
    options = {}
  ) {
    return findCriticalRequirements(
      this.ensureGraph(),
      options
    );
  }

  blocked(
    complianceMatrix
  ) {
    return findBlockedRequirements(
      this.ensureGraph(),
      complianceMatrix
    );
  }

  sequence() {
    return buildWorkflowSequence(
      this.ensureGraph()
    );
  }

  ask(
    question,
    options = {}
  ) {
    return answerDependencyQuestion(
      this.ensureGraph(),
      question,
      options
    );
  }
}

/* =====================================================================
   Integration Helper
   ===================================================================== */

export function analyzeDependencies(
  hits,
  complianceMatrix = null,
  options = {}
) {
  const graph =
    buildDependencyGraph(
      hits,
      options
    );

  return {
    graph,

    sequence:
      buildWorkflowSequence(
        graph
      ),

    critical:
      findCriticalRequirements(
        graph,
        options
      ),

    blocked:
      complianceMatrix
        ? findBlockedRequirements(
            graph,
            complianceMatrix
          )
        : [],

    requirementGraph:
      buildRequirementGraph(
        hits
      )
  };
}
