import {
  extractRequirements
} from "../retrieval.js";

import {
  buildDependencyGraph,
  buildWorkflowSequence
} from "./dependency.js";
import {
  normalizedKey as normalizeKey,
  normalizedText as normalize
} from "../data-model.js";

/* =====================================================================
   Constants
   ===================================================================== */

const DAY_MS =
  24 * 60 * 60 * 1000;

const WEEK_MS =
  7 * DAY_MS;

const MONTH_MS =
  30 * DAY_MS;

const YEAR_MS =
  365 * DAY_MS;

const TIME_UNIT_TO_DAYS = {
  minute:
    1 / 1440,
  minutes:
    1 / 1440,

  hour:
    1 / 24,
  hours:
    1 / 24,

  day:
    1,
  days:
    1,

  week:
    7,
  weeks:
    7,

  month:
    30,
  months:
    30,

  year:
    365,
  years:
    365
};

const TEMPORAL_MARKERS = [
  "prior to",
  "before",
  "after",
  "following",
  "within",
  "not later than",
  "no later than",
  "at least",
  "upon completion",
  "upon receipt",
  "upon approval",
  "until",
  "when",
  "during",
  "from the date of",
  "from receipt of",
  "after notice",
  "after approval",
  "before occupancy",
  "before acceptance",
  "before installation",
  "before testing",
  "before commissioning",
  "before final completion",
  "after completion",
  "after testing",
  "after installation"
];

const ABSOLUTE_DATE_PATTERNS = [
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?\b/gi,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\b\d{4}-\d{2}-\d{2}\b/g
];

const RELATIVE_DURATION_PATTERNS = [
  /\bwithin\s+(\d+(?:\.\d+)?)\s+(calendar\s+|business\s+|working\s+)?(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/gi,
  /\bno later than\s+(\d+(?:\.\d+)?)\s+(calendar\s+|business\s+|working\s+)?(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/gi,
  /\bnot later than\s+(\d+(?:\.\d+)?)\s+(calendar\s+|business\s+|working\s+)?(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/gi,
  /\bat least\s+(\d+(?:\.\d+)?)\s+(calendar\s+|business\s+|working\s+)?(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/gi,
  /\b(\d+(?:\.\d+)?)\s+(calendar\s+|business\s+|working\s+)?(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+(?:before|after|prior to|following)\b/gi
];

const MILESTONE_TERMS = {
  noticeToProceed: [
    "notice to proceed",
    "ntp"
  ],

  kickoff: [
    "kickoff meeting",
    "kick off meeting",
    "preconstruction meeting"
  ],

  submittalApproval: [
    "approved submittal",
    "submittal approval",
    "approval of submittal"
  ],

  delivery: [
    "delivery",
    "equipment received",
    "material receipt"
  ],

  installation: [
    "installation",
    "installed",
    "install work"
  ],

  inspection: [
    "inspection",
    "owner inspection",
    "qc inspection",
    "verification"
  ],

  testing: [
    "testing",
    "test completion",
    "successful test",
    "startup"
  ],

  commissioning: [
    "commissioning",
    "functional performance test",
    "integrated systems test"
  ],

  occupancy: [
    "occupancy",
    "beneficial occupancy"
  ],

  substantialCompletion: [
    "substantial completion"
  ],

  finalAcceptance: [
    "final acceptance",
    "acceptance by the owner",
    "government acceptance"
  ],

  finalCompletion: [
    "final completion"
  ],

  closeout: [
    "closeout",
    "turnover",
    "record drawings",
    "as-built drawings",
    "o&m manuals"
  ],

  warranty: [
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

function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime())
      ? null
      : value;
  }

  const parsed =
    new Date(value);

  return isNaN(parsed.getTime())
    ? null
    : parsed;
}

function toISODate(value) {
  const date =
    toDate(value);

  return date
    ? date.toISOString()
    : null;
}

function daysBetween(
  first,
  second
) {
  const firstDate =
    toDate(first);

  const secondDate =
    toDate(second);

  if (
    !firstDate ||
    !secondDate
  ) {
    return null;
  }

  return Math.round(
    (
      secondDate.getTime() -
      firstDate.getTime()
    ) /
    DAY_MS
  );
}

function addDays(
  date,
  days
) {
  const base =
    toDate(date);

  if (!base) {
    return null;
  }

  return new Date(
    base.getTime() +
    days * DAY_MS
  );
}

function requirementText(
  requirement
) {
  return normalize([
    requirement.statement,
    requirement.action,
    requirement.timing,
    requirement.heading,
    ...(requirement.path || []),
    ...(requirement.conditions || []),
    ...(requirement.exceptions || []),
    ...(requirement.deliverables || []),
    ...(requirement.references || [])
  ].join(" "));
}

function includesTerm(
  value,
  term
) {
  return normalizeKey(value).includes(
    normalizeKey(term)
  );
}

function includesAny(
  value,
  terms
) {
  return terms.some(term =>
    includesTerm(
      value,
      term
    )
  );
}

/* =====================================================================
   Duration Parsing
   ===================================================================== */

function durationToDays(
  amount,
  unit,
  modifier
) {
  const numeric =
    Number(amount);

  if (
    !Number.isFinite(numeric)
  ) {
    return null;
  }

  let days =
    numeric *
    (
      TIME_UNIT_TO_DAYS[
        String(unit || "")
          .toLowerCase()
      ] || 0
    );

  const modifierKey =
    normalizeKey(modifier);

  if (
    modifierKey === "business" ||
    modifierKey === "working"
  ) {
    days =
      convertBusinessDaysToCalendarDays(
        days
      );
  }

  return days;
}

function convertBusinessDaysToCalendarDays(
  businessDays
) {
  if (
    !Number.isFinite(
      businessDays
    )
  ) {
    return null;
  }

  const fullWeeks =
    Math.floor(
      businessDays / 5
    );

  const remainder =
    businessDays % 5;

  return (
    fullWeeks * 7 +
    remainder
  );
}

function extractDurations(
  text
) {
  const results = [];

  for (
    const pattern of
    RELATIVE_DURATION_PATTERNS
  ) {
    const copy =
      new RegExp(
        pattern.source,
        pattern.flags
      );

    let match;

    while (
      (
        match =
          copy.exec(
            String(text || "")
          )
      )
    ) {
      const full =
        normalize(
          match[0]
        );

      const amount =
        Number(match[1]);

      const modifier =
        normalize(
          match[2]
        );

      const unit =
        normalize(
          match[3]
        );

      const days =
        durationToDays(
          amount,
          unit,
          modifier
        );

      let relation =
        "within";

      if (
        /\bat least\b/i.test(
          full
        )
      ) {
        relation =
          "minimum";
      } else if (
        /\b(before|prior to)\b/i.test(
          full
        )
      ) {
        relation =
          "before";
      } else if (
        /\b(after|following)\b/i.test(
          full
        )
      ) {
        relation =
          "after";
      }

      results.push({
        text:
          full,

        amount,

        unit,

        modifier:
          modifier || null,

        days,

        relation,

        index:
          match.index
      });
    }
  }

  return results;
}

/* =====================================================================
   Absolute Date Parsing
   ===================================================================== */

function extractAbsoluteDates(
  text
) {
  const dates = [];

  for (
    const pattern of
    ABSOLUTE_DATE_PATTERNS
  ) {
    const copy =
      new RegExp(
        pattern.source,
        pattern.flags
      );

    let match;

    while (
      (
        match =
          copy.exec(
            String(text || "")
          )
      )
    ) {
      const parsed =
        toDate(match[0]);

      dates.push({
        text:
          match[0],

        date:
          parsed
            ? parsed.toISOString()
            : null,

        valid:
          Boolean(parsed),

        index:
          match.index
      });
    }
  }

  return dates;
}

/* =====================================================================
   Temporal Clause Extraction
   ===================================================================== */

function splitClauses(text) {
  return String(text || "")
    .replace(/\r/g, " ")
    .split(
      /(?<=[.;])\s+|,\s+(?=(?:before|after|within|prior to|following|upon|until|when|during|not later than|no later than|at least)\b)/i
    )
    .map(clause =>
      normalize(clause)
    )
    .filter(Boolean);
}

function classifyTemporalClause(
  clause
) {
  const key =
    normalizeKey(clause);

  if (
    /\bprior to\b|\bbefore\b|\bin advance of\b/.test(
      key
    )
  ) {
    return "before";
  }

  if (
    /\bafter\b|\bfollowing\b|\bupon completion\b|\bupon receipt\b|\bupon approval\b/.test(
      key
    )
  ) {
    return "after";
  }

  if (
    /\bwithin\b|\bno later than\b|\bnot later than\b/.test(
      key
    )
  ) {
    return "deadline";
  }

  if (
    /\bat least\b/.test(
      key
    )
  ) {
    return "minimum-lead-time";
  }

  if (
    /\buntil\b/.test(
      key
    )
  ) {
    return "blocking-until";
  }

  if (
    /\bduring\b/.test(
      key
    )
  ) {
    return "during";
  }

  if (
    /\bwhen\b/.test(
      key
    )
  ) {
    return "trigger";
  }

  return "temporal";
}

function extractTemporalClauses(
  text
) {
  return splitClauses(text)
    .filter(clause =>
      TEMPORAL_MARKERS.some(
        marker =>
          includesTerm(
            clause,
            marker
          )
      )
    )
    .map(
      (clause, index) => ({
        id:
          `TIME-CLAUSE-${index + 1}`,

        clause,

        type:
          classifyTemporalClause(
            clause
          ),

        durations:
          extractDurations(
            clause
          ),

        absoluteDates:
          extractAbsoluteDates(
            clause
          )
      })
    );
}

/* =====================================================================
   Milestone Inference
   ===================================================================== */

function inferMilestonesFromText(
  text
) {
  const milestones = [];

  for (
    const [
      key,
      terms
    ] of Object.entries(
      MILESTONE_TERMS
    )
  ) {
    if (
      includesAny(
        text,
        terms
      )
    ) {
      milestones.push({
        key,

        label:
          key
            .replace(
              /([A-Z])/g,
              " $1"
            )
            .replace(
              /^./,
              character =>
                character.toUpperCase()
            )
      });
    }
  }

  return milestones;
}

/* =====================================================================
   Requirement Timeline Records
   ===================================================================== */

function timelineRecordId(
  requirement,
  index
) {
  return (
    requirement.id ||
    `TIMELINE-${index + 1}`
  );
}

function inferAnchor(
  clause,
  requirement
) {
  const combined =
    normalize([
      clause,
      requirement.statement,
      requirement.timing
    ].join(" "));

  const milestones =
    inferMilestonesFromText(
      combined
    );

  if (milestones.length) {
    return milestones[0];
  }

  const genericPatterns = [
    {
      key:
        "notice",
      pattern:
        /\bnotice\b/i
    },
    {
      key:
        "receipt",
      pattern:
        /\breceipt\b/i
    },
    {
      key:
        "approval",
      pattern:
        /\bapproval\b/i
    },
    {
      key:
        "completion",
      pattern:
        /\bcompletion\b/i
    },
    {
      key:
        "submission",
      pattern:
        /\bsubmission\b/i
    }
  ];

  for (
    const item of
    genericPatterns
  ) {
    if (
      item.pattern.test(
        combined
      )
    ) {
      return {
        key:
          item.key,

        label:
          item.key
            .charAt(0)
            .toUpperCase() +
          item.key.slice(1)
      };
    }
  }

  return null;
}

export function extractTimelineRequirements(
  hits
) {
  const result =
    extractRequirements(hits);

  const records = [];

  result.requirements.forEach(
    (requirement, index) => {
      const text =
        requirementText(
          requirement
        );

      const clauses =
        extractTemporalClauses(
          text
        );

      const durations =
        extractDurations(
          text
        );

      const absoluteDates =
        extractAbsoluteDates(
          text
        );

      const milestones =
        inferMilestonesFromText(
          text
        );

      const hasTemporalData =
        clauses.length ||
        durations.length ||
        absoluteDates.length ||
        requirement.timing;

      if (!hasTemporalData) {
        return;
      }

      records.push({
        id:
          timelineRecordId(
            requirement,
            index
          ),

        requirementId:
          requirement.id,

        requirement:
          requirement.statement,

        timing:
          requirement.timing,

        clauses,

        durations,

        absoluteDates,

        milestones,

        anchors:
          unique(
            clauses
              .map(clause =>
                inferAnchor(
                  clause.clause,
                  requirement
                )
              )
              .filter(Boolean)
              .map(anchor =>
                anchor.key
              )
          ),

        responsibleParty:
          requirement.responsibleParty ||
          requirement.subject,

        deliverables:
          requirement.deliverables,

        references:
          requirement.references,

        requirementType:
          requirement.type,

        confidence:
          requirement.confidence,

        sourceNumber:
          requirement.sourceNumber,

        documentName:
          requirement.documentName,

        heading:
          requirement.heading,

        path:
          requirement.path,

        location:
          requirement.location
      });
    }
  );

  return {
    records,

    summary: {
      totalRequirements:
        result.requirements.length,

      timelineRequirements:
        records.length,

      withDurations:
        records.filter(
          record =>
            record.durations.length
        ).length,

      withAbsoluteDates:
        records.filter(
          record =>
            record.absoluteDates.length
        ).length,

      withMilestones:
        records.filter(
          record =>
            record.milestones.length
        ).length,

      withDeadlines:
        records.filter(record =>
          record.clauses.some(
            clause =>
              clause.type ===
              "deadline"
          )
        ).length,

      withLeadTimes:
        records.filter(record =>
          record.clauses.some(
            clause =>
              clause.type ===
              "minimum-lead-time"
          )
        ).length
    }
  };
}

/* =====================================================================
   Timeline Event Generation
   ===================================================================== */

function inferEventType(
  record
) {
  const clauseTypes =
    record.clauses.map(
      clause =>
        clause.type
    );

  if (
    clauseTypes.includes(
      "deadline"
    )
  ) {
    return "deadline";
  }

  if (
    clauseTypes.includes(
      "minimum-lead-time"
    )
  ) {
    return "lead-time";
  }

  if (
    clauseTypes.includes(
      "blocking-until"
    )
  ) {
    return "blocker";
  }

  if (
    clauseTypes.includes(
      "before"
    )
  ) {
    return "predecessor";
  }

  if (
    clauseTypes.includes(
      "after"
    )
  ) {
    return "successor";
  }

  if (
    record.absoluteDates.length
  ) {
    return "fixed-date";
  }

  return "timed-requirement";
}

function timelinePriority(
  record
) {
  let score =
    0;

  if (
    record.requirementType ===
    "mandatory"
  ) {
    score +=
      30;
  }

  if (
    record.requirementType ===
    "prohibited"
  ) {
    score +=
      35;
  }

  if (
    record.clauses.some(
      clause =>
        clause.type ===
        "deadline"
    )
  ) {
    score +=
      25;
  }

  if (
    record.clauses.some(
      clause =>
        clause.type ===
        "blocking-until"
    )
  ) {
    score +=
      20;
  }

  if (
    record.absoluteDates.length
  ) {
    score +=
      20;
  }

  if (
    record.milestones.some(
      milestone =>
        [
          "occupancy",
          "finalAcceptance",
          "finalCompletion",
          "commissioning"
        ].includes(
          milestone.key
        )
    )
  ) {
    score +=
      15;
  }

  return clamp(
    score,
    0,
    100
  );
}

export function buildTimelineEvents(
  hits
) {
  const timeline =
    extractTimelineRequirements(
      hits
    );

  const events =
    timeline.records.map(
      (record, index) => ({
        id:
          `EVENT-${index + 1}`,

        requirementId:
          record.requirementId,

        title:
          normalize(
            record.requirement
          ).slice(0, 180),

        description:
          record.requirement,

        eventType:
          inferEventType(
            record
          ),

        priority:
          timelinePriority(
            record
          ),

        timing:
          record.timing,

        clauses:
          record.clauses,

        durations:
          record.durations,

        absoluteDates:
          record.absoluteDates,

        milestones:
          record.milestones,

        anchors:
          record.anchors,

        responsibleParty:
          record.responsibleParty,

        deliverables:
          record.deliverables,

        references:
          record.references,

        confidence:
          record.confidence,

        sourceNumber:
          record.sourceNumber,

        documentName:
          record.documentName,

        heading:
          record.heading,

        location:
          record.location
      })
    );

  return {
    events,

    summary: {
      total:
        events.length,

      highPriority:
        events.filter(
          event =>
            event.priority >= 70
        ).length,

      deadlines:
        events.filter(
          event =>
            event.eventType ===
            "deadline"
        ).length,

      fixedDates:
        events.filter(
          event =>
            event.eventType ===
            "fixed-date"
        ).length,

      blockers:
        events.filter(
          event =>
            event.eventType ===
            "blocker"
        ).length
    }
  };
}

/* =====================================================================
   Date Resolution
   ===================================================================== */

function resolveDurationAgainstAnchor(
  duration,
  anchorDate
) {
  if (
    !duration ||
    duration.days == null ||
    !anchorDate
  ) {
    return null;
  }

  const direction =
    duration.relation === "before"
      ? -1
      : 1;

  return addDays(
    anchorDate,
    duration.days *
    direction
  );
}

function findAnchorDate(
  record,
  milestoneDates = {}
) {
  for (
    const anchorKey of
    record.anchors || []
  ) {
    const value =
      milestoneDates[
        anchorKey
      ];

    const date =
      toDate(value);

    if (date) {
      return {
        anchorKey,
        date
      };
    }
  }

  return null;
}

export function resolveTimelineDates(
  timelineData,
  milestoneDates = {},
  options = {}
) {
  const {
    defaultAnchorDate = null
  } = options || {};

  const records =
    timelineData.records ||
    timelineData.events ||
    [];

  return records.map(record => {
    const fixedDates =
      record.absoluteDates
        ?.filter(
          item =>
            item.valid &&
            item.date
        ) || [];

    if (fixedDates.length) {
      return {
        ...record,

        resolvedDate:
          fixedDates[0].date,

        resolutionType:
          "absolute-date",

        anchor:
          null
      };
    }

    const anchor =
      findAnchorDate(
        record,
        milestoneDates
      );

    const baseDate =
      anchor?.date ||
      toDate(
        defaultAnchorDate
      );

    const duration =
      record.durations?.[0];

    const resolved =
      resolveDurationAgainstAnchor(
        duration,
        baseDate
      );

    return {
      ...record,

      resolvedDate:
        toISODate(resolved),

      resolutionType:
        resolved
          ? "relative-duration"
          : "unresolved",

      anchor:
        anchor
          ? {
              key:
                anchor.anchorKey,
              date:
                toISODate(
                  anchor.date
                )
            }
          : null
    };
  });
}

/* =====================================================================
   Chronological Timeline
   ===================================================================== */

function eventSortValue(
  event
) {
  if (
    event.resolvedDate
  ) {
    const date =
      toDate(
        event.resolvedDate
      );

    if (date) {
      return date.getTime();
    }
  }

  const phaseOrder = {
    noticeToProceed:
      1,
    kickoff:
      2,
    submittalApproval:
      3,
    delivery:
      4,
    installation:
      5,
    inspection:
      6,
    testing:
      7,
    commissioning:
      8,
    occupancy:
      9,
    substantialCompletion:
      10,
    finalAcceptance:
      11,
    finalCompletion:
      12,
    closeout:
      13,
    warranty:
      14
  };

  const milestone =
    event.milestones?.[0]?.key;

  return (
    phaseOrder[milestone] ??
    999
  ) *
  YEAR_MS;
}

export function buildChronologicalTimeline(
  hits,
  milestoneDates = {},
  options = {}
) {
  const timeline =
    extractTimelineRequirements(
      hits
    );

  const resolved =
    resolveTimelineDates(
      timeline,
      milestoneDates,
      options
    );

  const events =
    resolved
      .map(
        (record, index) => ({
          ...record,

          eventId:
            `CHRON-${index + 1}`,

          eventType:
            inferEventType(
              record
            ),

          priority:
            timelinePriority(
              record
            )
        })
      )
      .sort(
        (first, second) =>
          eventSortValue(first) -
          eventSortValue(second) ||
          second.priority -
          first.priority
      );

  return {
    events,

    dated:
      events.filter(
        event =>
          Boolean(
            event.resolvedDate
          )
      ),

    unresolved:
      events.filter(
        event =>
          !event.resolvedDate
      ),

    summary: {
      total:
        events.length,

      resolved:
        events.filter(
          event =>
            Boolean(
              event.resolvedDate
            )
        ).length,

      unresolved:
        events.filter(
          event =>
            !event.resolvedDate
        ).length,

      highPriority:
        events.filter(
          event =>
            event.priority >= 70
        ).length
    }
  };
}

/* =====================================================================
   Schedule Risk
   ===================================================================== */

function eventStatus(
  event,
  currentDate
) {
  const now =
    toDate(currentDate) ||
    new Date();

  const due =
    toDate(
      event.resolvedDate
    );

  if (!due) {
    return "unresolved";
  }

  const days =
    daysBetween(
      now,
      due
    );

  if (days < 0) {
    return "overdue";
  }

  if (days <= 7) {
    return "due-soon";
  }

  if (days <= 30) {
    return "upcoming";
  }

  return "future";
}

export function assessTimelineRisk(
  chronologicalTimeline,
  options = {}
) {
  const {
    currentDate = new Date(),
    completionStatus = {}
  } = options || {};

  const assessments =
    chronologicalTimeline.events.map(
      event => {
        const completed =
          Boolean(
            completionStatus[
              event.requirementId
            ] ||
            completionStatus[
              event.eventId
            ]
          );

        const status =
          completed
            ? "complete"
            : eventStatus(
                event,
                currentDate
              );

        let riskScore =
          0;

        if (
          status ===
          "overdue"
        ) {
          riskScore +=
            60;
        }

        if (
          status ===
          "due-soon"
        ) {
          riskScore +=
            35;
        }

        if (
          status ===
          "upcoming"
        ) {
          riskScore +=
            15;
        }

        if (
          event.priority >=
          70
        ) {
          riskScore +=
            25;
        } else if (
          event.priority >=
          50
        ) {
          riskScore +=
            15;
        }

        if (
          event.eventType ===
          "blocker"
        ) {
          riskScore +=
            20;
        }

        if (
          event.resolutionType ===
          "unresolved"
        ) {
          riskScore +=
            10;
        }

        if (completed) {
          riskScore =
            0;
        }

        return {
          event,

          status,

          riskScore:
            clamp(
              riskScore,
              0,
              100
            ),

          daysUntilDue:
            event.resolvedDate
              ? daysBetween(
                  currentDate,
                  event.resolvedDate
                )
              : null
        };
      }
    );

  return {
    assessments:
      assessments.sort(
        (first, second) =>
          second.riskScore -
          first.riskScore
      ),

    overdue:
      assessments.filter(
        item =>
          item.status ===
          "overdue"
      ),

    dueSoon:
      assessments.filter(
        item =>
          item.status ===
          "due-soon"
      ),

    unresolved:
      assessments.filter(
        item =>
          item.status ===
          "unresolved"
      ),

    summary: {
      total:
        assessments.length,

      overdue:
        assessments.filter(
          item =>
            item.status ===
            "overdue"
        ).length,

      dueSoon:
        assessments.filter(
          item =>
            item.status ===
            "due-soon"
        ).length,

      unresolved:
        assessments.filter(
          item =>
            item.status ===
            "unresolved"
        ).length,

      highRisk:
        assessments.filter(
          item =>
            item.riskScore >= 70
        ).length
    }
  };
}

/* =====================================================================
   Timeline Conflicts
   ===================================================================== */

function sameRequirementTopic(
  first,
  second
) {
  const firstTerms =
    new Set(
      normalizeKey(
        first.requirement
      )
        .split(/\s+/)
        .filter(term =>
          term.length >= 4
        )
    );

  const secondTerms =
    new Set(
      normalizeKey(
        second.requirement
      )
        .split(/\s+/)
        .filter(term =>
          term.length >= 4
        )
    );

  if (
    !firstTerms.size ||
    !secondTerms.size
  ) {
    return false;
  }

  let overlap =
    0;

  for (const term of firstTerms) {
    if (
      secondTerms.has(term)
    ) {
      overlap +=
        1;
    }
  }

  return (
    overlap /
    Math.max(
      firstTerms.size,
      secondTerms.size
    )
  ) >= 0.35;
}

export function detectTimelineConflicts(
  chronologicalTimeline
) {
  const events =
    chronologicalTimeline.events || [];

  const conflicts = [];

  for (
    let firstIndex = 0;
    firstIndex < events.length;
    firstIndex += 1
  ) {
    const first =
      events[firstIndex];

    for (
      let secondIndex =
        firstIndex + 1;
      secondIndex <
        events.length;
      secondIndex += 1
    ) {
      const second =
        events[secondIndex];

      if (
        !sameRequirementTopic(
          first,
          second
        )
      ) {
        continue;
      }

      const firstDate =
        toDate(
          first.resolvedDate
        );

      const secondDate =
        toDate(
          second.resolvedDate
        );

      if (
        firstDate &&
        secondDate
      ) {
        const gap =
          Math.abs(
            daysBetween(
              firstDate,
              secondDate
            )
          );

        if (gap >= 1) {
          conflicts.push({
            type:
              "date-discrepancy",

            first,
            second,

            differenceDays:
              gap,

            severity:
              gap > 30
                ? "high"
                : gap > 7
                  ? "medium"
                  : "low"
          });
        }
      }

      const firstDurations =
        first.durations || [];

      const secondDurations =
        second.durations || [];

      if (
        firstDurations.length &&
        secondDurations.length
      ) {
        const firstDays =
          firstDurations[0].days;

        const secondDays =
          secondDurations[0].days;

        if (
          firstDays != null &&
          secondDays != null &&
          Math.abs(
            firstDays -
            secondDays
          ) >= 1
        ) {
          conflicts.push({
            type:
              "duration-discrepancy",

            first,
            second,

            differenceDays:
              Math.abs(
                firstDays -
                secondDays
              ),

            severity:
              Math.abs(
                firstDays -
                secondDays
              ) > 30
                ? "high"
                : "medium"
          });
        }
      }
    }
  }

  return {
    conflicts,

    summary: {
      total:
        conflicts.length,

      high:
        conflicts.filter(
          conflict =>
            conflict.severity ===
            "high"
        ).length,

      medium:
        conflicts.filter(
          conflict =>
            conflict.severity ===
            "medium"
        ).length,

      low:
        conflicts.filter(
          conflict =>
            conflict.severity ===
            "low"
        ).length
    }
  };
}

/* =====================================================================
   Dependency-Aware Timeline
   ===================================================================== */

export function buildDependencyAwareTimeline(
  hits,
  milestoneDates = {},
  options = {}
) {
  const dependencyGraph =
    buildDependencyGraph(
      hits,
      options
    );

  const workflow =
    buildWorkflowSequence(
      dependencyGraph
    );

  const chronological =
    buildChronologicalTimeline(
      hits,
      milestoneDates,
      options
    );

  const eventByRequirement =
    new Map(
      chronological.events.map(
        event => [
          event.requirementId,
          event
        ]
      )
    );

  const sequence =
    workflow.ordered.map(
      (node, index) => ({
        sequence:
          index + 1,

        requirementId:
          node.id,

        phase:
          node.phase,

        dependencyNode:
          node,

        timelineEvent:
          eventByRequirement.get(
            node.id
          ) || null
      })
    );

  return {
    sequence,

    dependencyGraph,

    workflow,

    chronological,

    summary: {
      requirements:
        dependencyGraph.summary.requirements,

      dependencyEdges:
        dependencyGraph.summary.edges,

      timelineEvents:
        chronological.summary.total,

      datedEvents:
        chronological.summary.resolved,

      unresolvedEvents:
        chronological.summary.unresolved,

      cycles:
        workflow.summary.cycles
    }
  };
}

/* =====================================================================
   Question Answering
   ===================================================================== */

function scoreEventForQuery(
  event,
  query
) {
  const queryTerms =
    normalizeKey(query)
      .split(/\s+/)
      .filter(term =>
        term.length >= 3
      );

  const eventText =
    normalizeKey([
      event.title,
      event.description,
      event.timing,
      event.responsibleParty,
      ...(event.anchors || []),
      ...(event.milestones || [])
        .map(
          milestone =>
            milestone.label
        )
    ].join(" "));

  if (!queryTerms.length) {
    return 0;
  }

  let matches =
    0;

  for (const term of queryTerms) {
    if (
      eventText.includes(
        term
      )
    ) {
      matches +=
        1;
    }
  }

  return matches /
    queryTerms.length;
}

export function findTimelineEvents(
  timeline,
  query,
  options = {}
) {
  const {
    limit = 20,
    minimumScore = 0.2
  } = options || {};

  return (
    timeline.events || []
  )
    .map(event => ({
      event,

      score:
        scoreEventForQuery(
          event,
          query
        )
    }))
    .filter(
      match =>
        match.score >=
        minimumScore
    )
    .sort(
      (first, second) =>
        second.score -
        first.score ||
        second.event.priority -
        first.event.priority
    )
    .slice(0, limit);
}

export function answerTimelineQuestion(
  timeline,
  question,
  options = {}
) {
  const key =
    normalizeKey(question);

  const matches =
    findTimelineEvents(
      timeline,
      question,
      options
    );

  let intent =
    "timeline-search";

  if (
    /\b(overdue|late|past due)\b/.test(
      key
    )
  ) {
    intent =
      "overdue";
  } else if (
    /\b(due soon|next 7 days|next week)\b/.test(
      key
    )
  ) {
    intent =
      "due-soon";
  } else if (
    /\b(before|prior to|prerequisite)\b/.test(
      key
    )
  ) {
    intent =
      "before";
  } else if (
    /\b(after|following|next)\b/.test(
      key
    )
  ) {
    intent =
      "after";
  } else if (
    /\b(within|deadline|due)\b/.test(
      key
    )
  ) {
    intent =
      "deadline";
  } else if (
    /\b(fixed date|calendar date|specific date)\b/.test(
      key
    )
  ) {
    intent =
      "fixed-date";
  }

  const filtered =
    matches.filter(match => {
      if (
        intent === "before"
      ) {
        return match.event.clauses
          ?.some(
            clause =>
              clause.type ===
              "before"
          );
      }

      if (
        intent === "after"
      ) {
        return match.event.clauses
          ?.some(
            clause =>
              clause.type ===
              "after"
          );
      }

      if (
        intent === "deadline"
      ) {
        return (
          match.event.eventType ===
          "deadline"
        );
      }

      if (
        intent === "fixed-date"
      ) {
        return (
          match.event.eventType ===
          "fixed-date"
        );
      }

      return true;
    });

  return {
    question,

    intent,

    matches:
      filtered.length
        ? filtered
        : matches,

    summary:
      (
        filtered.length ||
        matches.length
      )
        ? `Found ${
            (
              filtered.length
                ? filtered
                : matches
            ).length
          } relevant timeline item${
            (
              filtered.length
                ? filtered
                : matches
            ).length === 1
              ? ""
              : "s"
          }.`
        : "No relevant timeline items were found."
  };
}

/* =====================================================================
   Timeline Engine Class
   ===================================================================== */

export class TimelineEngine {

  constructor(
    hits = [],
    options = {}
  ) {
    this.hits =
      hits;

    this.options =
      options;

    this.timeline =
      null;

    this.chronological =
      null;

    this.dependencyAware =
      null;
  }

  extract() {
    this.timeline =
      extractTimelineRequirements(
        this.hits
      );

    return this.timeline;
  }

  events() {
    return buildTimelineEvents(
      this.hits
    );
  }

  build(
    milestoneDates = {},
    options = {}
  ) {
    this.chronological =
      buildChronologicalTimeline(
        this.hits,
        milestoneDates,
        {
          ...this.options,
          ...options
        }
      );

    return this.chronological;
  }

  buildDependencyAware(
    milestoneDates = {},
    options = {}
  ) {
    this.dependencyAware =
      buildDependencyAwareTimeline(
        this.hits,
        milestoneDates,
        {
          ...this.options,
          ...options
        }
      );

    return this.dependencyAware;
  }

  risk(
    options = {}
  ) {
    const timeline =
      this.chronological ||
      this.build();

    return assessTimelineRisk(
      timeline,
      options
    );
  }

  conflicts() {
    const timeline =
      this.chronological ||
      this.build();

    return detectTimelineConflicts(
      timeline
    );
  }

  ask(
    question,
    options = {}
  ) {
    const timeline =
      this.chronological ||
      this.build();

    return answerTimelineQuestion(
      timeline,
      question,
      options
    );
  }
}

/* =====================================================================
   Integration Helper
   ===================================================================== */

export function analyzeTimeline(
  hits,
  milestoneDates = {},
  options = {}
) {
  const timeline =
    extractTimelineRequirements(
      hits
    );

  const chronological =
    buildChronologicalTimeline(
      hits,
      milestoneDates,
      options
    );

  const dependencyAware =
    buildDependencyAwareTimeline(
      hits,
      milestoneDates,
      options
    );

  const risk =
    assessTimelineRisk(
      chronological,
      options
    );

  const conflicts =
    detectTimelineConflicts(
      chronological
    );

  return {
    timeline,

    chronological,

    dependencyAware,

    risk,

    conflicts,

    summary: {
      timelineRequirements:
        timeline.summary.timelineRequirements,

      datedEvents:
        chronological.summary.resolved,

      unresolvedEvents:
        chronological.summary.unresolved,

      overdue:
        risk.summary.overdue,

      dueSoon:
        risk.summary.dueSoon,

      conflicts:
        conflicts.summary.total
    }
  };
}
