const text = value => String(value ?? '').trim();
const lower = value => text(value).toLowerCase();
const num = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = text(value);
  if (!raw) return 0;
  if (/^[-+]?\d+(?:\.\d+)?%$/.test(raw)) return Number(raw.replace('%', '')) / 100 || 0;
  if (/^[-+]?\d+(?:\.\d+)?$/.test(raw)) return Number(raw) || 0;
  return 0;
};
const pct = value => Math.round(Math.max(0, Math.min(1, num(value))) * 100);
const clone = value => {
  if (value == null) return null;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const BUILDING_PATTERN = /\b(?:building\s*)?(?:b\s*)?(\d{1,3}|bch|mcr|site)\b/i;

const BUILT_IN_FOCUS_TERMS = [
  'what is the status',
  'what is holding',
  'what is the readiness',
  'what trades are unhealthy',
  'what risks are open',
  'what are the highest risks',
  'what open questions',
  'are there any shutdowns',
  'ready for pilot completion',
  'what is missing for pilot completion',
  'oit readiness',
  'which buildings need the most attention',
  'give me a pmis project summary',
  'what should i focus on today',
  'pmis project summary',
  'focus on today',
  'campus summary'
];

const TRADE_FIELDS = [
  ['Fire', ['Fire', 'Fire Protection', 'Fire Alarm', 'Fire / Life Safety', 'Fire Status']],
  ['HVAC', ['HVAC', 'Mechanical', 'HVAC / Cooling', 'Mechanical Status']],
  ['Electrical', ['Electrical', 'Electrical / UPS', 'Electrical Status', 'UPS']],
  ['Telecom', ['Telecom', 'Telecom / Fiber', 'Fiber', 'OIT', 'OIT Status']],
  ['Security', ['Security', 'Security / PACS / CCTV', 'PACS', 'CCTV', 'Security Status']]
];

const PILOT_GATES = [
  ['Construction Ready', ['Construction Ready', 'Overall Status', 'Ready']],
  ['OIT Readiness', ['OIT Status', 'OIT Readiness']],
  ['QA / Material', ['QA / Material Status', 'Material Compliance']],
  ['Owner Acceptance', ['Acceptance Status', 'Acceptance Readiness']]
];

const healthPct = value => {
  const raw = text(value);
  if (!raw || raw === 'N/A' || raw === 'NA') return 0;
  if (/^[-+]?\d+(?:\.\d+)?%$/.test(raw)) return Math.max(0, Math.min(100, Math.round(Number(raw.replace('%', '')) || 0)));
  if (/^[-+]?\d+(?:\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return Math.max(0, Math.min(100, Math.round(n <= 1 ? n * 100 : n)));
  }
  const s = raw.toUpperCase();
  if (['PASS', 'READY', 'COMPLETE', 'COMPLETED', 'YES', 'GREEN', 'OK'].includes(s)) return 100;
  return 0;
};

function normalizeBuildingKey(value) {
  const raw = text(value).replace(/^B/i, '').trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return raw.padStart(2, '0');
  return raw.toUpperCase();
}

function buildingLabel(value) {
  const key = normalizeBuildingKey(value);
  return key ? `Building ${key}` : 'Campus';
}

function firstValue(row, names, fallback = '') {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null && String(row[name]).trim() !== '') return row[name];
  }
  return fallback;
}

function statusText(value, fallback = 'Monitor') {
  const raw = text(value);
  if (!raw) return fallback;
  return raw;
}

function normalizeRuntime(data = {}) {
  const buildings = Array.isArray(data.buildings) ? data.buildings : [];
  const focus = Array.isArray(data.focus) ? data.focus : [];
  const stats = data.stats && typeof data.stats === 'object' ? data.stats : {};
  const shutdowns = Array.isArray(data.shutdowns) ? data.shutdowns : [];
  const projectRegister = Array.isArray(data.projectRegister) ? data.projectRegister : [];
  const assessmentIndex = Array.isArray(data.assessmentIndex) ? data.assessmentIndex : [];

  const normalizedBuildings = buildings.map(item => {
    const building = normalizeBuildingKey(item?.Building);
    return {
      ...clone(item),
      Building: building,
      readinessPct: Number(item?.readinessPct ?? item?.['Sheet Readiness'] ?? item?.['Avg Readiness'] ?? item?.Readiness ?? 0) || 0,
      'Open Risks': Math.max(0, Math.round(num(item?.['Open Risks'] ?? item?.Risks))),
      'Open Questions': Math.max(0, Math.round(num(item?.['Open Questions'] ?? item?.Questions))),
      'Open Photos': Math.max(0, Math.round(num(item?.['Open Photos'] ?? item?.Photos))),
      'Room Count': Math.max(0, Math.round(num(item?.['Room Count'] ?? item?.Rooms))),
      tradeNotes: item?.tradeNotes && typeof item.tradeNotes === 'object' ? clone(item.tradeNotes) : {},
      action: item?.action && typeof item.action === 'object' ? clone(item.action) : {}
    };
  }).filter(item => item.Building);

  return {
    buildings: normalizedBuildings,
    focus: focus.map(item => ({ ...clone(item), Building: normalizeBuildingKey(item?.Building) })).filter(item => item.Building),
    stats: {
      total: Number(stats.total ?? normalizedBuildings.length) || 0,
      avgReadiness: Number(stats.avgReadiness ?? 0) || 0,
      ready: Number(stats.ready ?? 0) || 0,
      notReady: Number(stats.notReady ?? 0) || 0,
      risks: Number(stats.risks ?? 0) || 0,
      questions: Number(stats.questions ?? 0) || 0
    },
    shutdowns: shutdowns.map(item => clone(item)),
    projectRegister: projectRegister.map(item => clone(item)),
    assessmentIndex: assessmentIndex.map(item => clone(item)),
    loadedAt: text(data.loadedAt),
    sourceFileName: text(data.sourceFileName)
  };
}

function scoreAttention(building = {}) {
  return (Number(building['Open Risks']) || 0) * 3 + (Number(building['Open Questions']) || 0) * 2 + (100 - Math.round(pct(building.readinessPct)));
}

function resolveQuestionBuilding(question = '', runtime = {}, getSelectedBuilding = null) {
  const match = text(question).match(BUILDING_PATTERN);
  if (match) return normalizeBuildingKey(match[1]);
  const selected = typeof getSelectedBuilding === 'function' ? getSelectedBuilding() : null;
  const selectedBuilding = normalizeBuildingKey(selected?.Building);
  if (selectedBuilding) return selectedBuilding;
  const first = Array.isArray(runtime.buildings) ? runtime.buildings[0] : null;
  return normalizeBuildingKey(first?.Building);
}

function isCampusQuestion(question = '') {
  const q = lower(question);
  if (!q) return false;
  return [
    'campus summary',
    'project summary',
    'pmis project summary',
    'give me a pmis project summary',
    'which buildings need the most attention',
    'what should i focus on today',
    'focus on today',
    'campus posture',
    'campus readiness'
  ].some(term => q.includes(term));
}

function formatTradeHealth(building = {}) {
  return TRADE_FIELDS.map(([label, fields]) => {
    const value = statusText(firstValue(building, fields, 'N/A'), 'N/A');
    return {
      label,
      value,
      percent: healthPct(value)
    };
  });
}

function formatPilotCompletion(building = {}) {
  const gates = PILOT_GATES.map(([label, fields]) => {
    const value = statusText(firstValue(building, fields, 'N/A'), 'N/A');
    return {
      label,
      value,
      percent: healthPct(value),
      complete: healthPct(value) >= 100
    };
  });
  const missing = gates.filter(gate => !gate.complete).map(gate => gate.label);
  return {
    gates,
    missing,
    completeCount: gates.filter(gate => gate.complete).length,
    total: gates.length
  };
}

function getBuildingRecord(runtime = {}, buildingKey = '') {
  const key = normalizeBuildingKey(buildingKey);
  return (Array.isArray(runtime.buildings) ? runtime.buildings : []).find(item => normalizeBuildingKey(item.Building) === key) || null;
}

function getCampusSummary(runtime = {}) {
  const data = normalizeRuntime(runtime);
  const buildings = data.buildings;
  const topAttention = [...buildings]
    .sort((a, b) => scoreAttention(b) - scoreAttention(a))
    .slice(0, 5);
  const topRiskLeader = [...buildings].sort((a, b) => (Number(b['Open Risks']) || 0) - (Number(a['Open Risks']) || 0) || pct(a.readinessPct) - pct(b.readinessPct))[0] || null;
  const mostQuestions = [...buildings].sort((a, b) => (Number(b['Open Questions']) || 0) - (Number(a['Open Questions']) || 0))[0] || null;
  const activeShutdowns = data.shutdowns.filter(item => !['closed', 'complete', 'completed', 'cancelled', 'canceled'].includes(lower(item?.Status)));
  return {
    ...data.stats,
    topAttention,
    topRiskLeader,
    mostQuestions,
    activeShutdowns,
    posture: data.stats.avgReadiness >= 0.8 ? 'Mission Ready' : data.stats.avgReadiness >= 0.55 ? 'Watch Conditions' : 'Critical Review'
  };
}

function getBuildingDigest(runtime = {}, buildingKey = '', { getSelectedBuilding = null } = {}) {
  const data = normalizeRuntime(runtime);
  const key = normalizeBuildingKey(buildingKey) || resolveQuestionBuilding('', data, getSelectedBuilding);
  const building = getBuildingRecord(data, key) || getBuildingRecord(data, getSelectedBuilding?.());
  if (!building) return null;
  const tradeHealth = formatTradeHealth(building);
  const pilotCompletion = formatPilotCompletion(building);
  const shutdowns = data.shutdowns.filter(item => {
    const itemBuilding = normalizeBuildingKey(item?.Building || item?.['Affected Building'] || item?.['Building / Area']);
    return !key || itemBuilding === key;
  });
  return {
    buildingKey: normalizeBuildingKey(building.Building),
    label: buildingLabel(building.Building),
    readinessPct: pct(building.readinessPct),
    overallStatus: text(building['Overall Status'] || building['Dashboard Signal'] || 'Monitor'),
    constructionReady: statusText(firstValue(building, ['Construction Ready', 'Ready'], 'No')),
    acceptanceStatus: statusText(firstValue(building, ['Acceptance Status', 'Pilot Status', 'Execution Gate'], 'Monitor')),
    oitReadiness: statusText(firstValue(building, ['OIT Status', 'OIT Readiness'], 'Monitor')),
    openRisks: Math.round(num(building['Open Risks'])),
    openQuestions: Math.round(num(building['Open Questions'])),
    shutdownCount: Math.round(num(building.Shutdowns)),
    roomCount: Math.round(num(building['Room Count'])),
    tradeHealth,
    pilotCompletion,
    blocker: text(building['Major Blocker'] || building.action?.['Why Summary'] || building.tradeNotes?.['Owner Risks'] || 'No major exception detected.'),
    nextAction: text(building.action?.['Next Action'] || building['Next Action'] || 'Maintain monitoring and verify during the next building walk.'),
    openQuestionsText: text(building.tradeNotes?.['Open Questions'] || ''),
    riskText: text(building.tradeNotes?.['Owner Risks'] || ''),
    shutdowns
  };
}

function buildBuildingAnswer(digest) {
  const lines = [];
  lines.push(`${digest.label}`);
  lines.push(`Readiness: ${digest.readinessPct}%`);
  lines.push('');
  lines.push('Trade Health:');
  for (const item of digest.tradeHealth) {
    lines.push(`- ${item.label}: ${item.percent}%`);
  }
  lines.push('');
  lines.push(`Open Risks: ${digest.openRisks}`);
  lines.push(`Open Questions: ${digest.openQuestions}`);
  lines.push(`Shutdowns: ${digest.shutdownCount}`);
  lines.push('');
  lines.push('Pilot Completion:');
  lines.push(`${digest.pilotCompletion.completeCount} of ${digest.pilotCompletion.total} gates complete`);
  lines.push(digest.pilotCompletion.missing.length ? `Missing: ${digest.pilotCompletion.missing.join(', ')}` : 'Missing: None');
  lines.push('');
  lines.push(`OIT Readiness: ${digest.oitReadiness}`);
  lines.push('');
  lines.push('Practical takeaway:');
  lines.push(digest.nextAction);
  if (digest.blocker && digest.blocker !== digest.nextAction) {
    lines.push(digest.blocker);
  }
  return lines.join('\n');
}

function buildCampusAnswer(summary) {
  const lines = [];
  lines.push('PMIS campus summary');
  lines.push(`Campus readiness: ${Math.round(pct(summary.avgReadiness))}% across ${summary.total} buildings.`);
  lines.push(`Ready buildings: ${summary.ready}. Buildings needing attention: ${summary.notReady}.`);
  lines.push(`Open risks: ${Math.round(summary.risks)}. Open questions: ${Math.round(summary.questions)}.`);
  lines.push(`Active shutdowns: ${summary.activeShutdowns.length}.`);
  lines.push('');
  if (summary.topRiskLeader) {
    lines.push(`Highest open risks: ${buildingLabel(summary.topRiskLeader.Building)} (${summary.topRiskLeader['Open Risks'] || 0}).`);
  }
  if (summary.mostQuestions) {
    lines.push(`Most open questions: ${buildingLabel(summary.mostQuestions.Building)} (${summary.mostQuestions['Open Questions'] || 0}).`);
  }
  if (summary.topAttention.length) {
    lines.push(`Top attention buildings: ${summary.topAttention.map(item => item.Building).join(', ')}.`);
  }
  lines.push('');
  lines.push('Practical takeaway:');
  lines.push(summary.topAttention.length
    ? `${buildingLabel(summary.topAttention[0].Building)} is the first place to focus, followed by the highest-risk and highest-question buildings.`
    : 'PMIS data is unavailable for this item.');
  return lines.join('\n');
}

export function createChiefPmisSME({
  projectId = 'bedford',
  getRuntimeData = () => null,
  getSelectedBuilding = () => null
} = {}) {
  function runtime() {
    return normalizeRuntime(typeof getRuntimeData === 'function' ? getRuntimeData() : getRuntimeData || {});
  }

  function isPmisQuestion(question = '') {
    const q = lower(question);
    if (!q) return false;
    if (q.includes('pmis')) return true;
    if (q.includes('readiness') || q.includes('status of building') || q.includes('what is the status')) return true;
    if (q.includes('what is holding') || q.includes('holding back') || q.includes('what trades are unhealthy')) return true;
    if (q.includes('open risks') || q.includes('highest risks') || q.includes('open questions')) return true;
    if (q.includes('shutdown') || q.includes('pilot completion') || q.includes('oit readiness')) return true;
    if (q.includes('needs the most attention') || q.includes('most attention') || q.includes('what should i focus on today')) return true;
    if (q.includes('project summary') || q.includes('campus summary')) return true;
    if (q.includes('focus on') && q.includes('today')) return true;
    return BUILT_IN_FOCUS_TERMS.some(term => q.includes(term));
  }

  function answerQuestion(question = '') {
    const data = runtime();
    const pmisQuestion = isPmisQuestion(question);
    const hasBuildings = Array.isArray(data.buildings) && data.buildings.length > 0;
    const campusQuestion = isCampusQuestion(question);
    const buildingKey = campusQuestion ? '' : resolveQuestionBuilding(question, data, getSelectedBuilding);
    const digest = buildingKey ? getBuildingDigest(data, buildingKey, { getSelectedBuilding }) : null;
    const campus = getCampusSummary(data);
    const scope = digest ? 'building' : 'campus';

    if (!hasBuildings) {
      return {
        projectId,
        queryType: 'pmis',
        scope,
        question: text(question),
        answer: 'PMIS data is unavailable for this item. The bundled Bedford workbook has not loaded yet.',
        summary: 'PMIS data is unavailable for this item.',
        available: false,
        building: null,
        campus,
        buildings: [],
        focusBuildings: [],
        tradeHealth: [],
        pilotCompletion: { completeCount: 0, total: 0, missing: [], gates: [] },
        shutdowns: [],
        confidence: 0
      };
    }

    if (digest) {
      return {
        projectId,
        queryType: 'pmis',
        scope: 'building',
        question: text(question),
        answer: buildBuildingAnswer(digest),
        summary: `${digest.label} is at ${digest.readinessPct}% readiness with ${digest.openRisks} open risk(s) and ${digest.openQuestions} open question(s).`,
        available: true,
        building: digest,
        campus,
        buildings: [digest],
        focusBuildings: campus.topAttention,
        tradeHealth: digest.tradeHealth,
        pilotCompletion: digest.pilotCompletion,
        shutdowns: digest.shutdowns,
        confidence: Math.max(0.5, Math.min(0.95, (digest.readinessPct / 100) * 0.7 + (digest.openRisks + digest.openQuestions > 0 ? 0.15 : 0.25)))
      };
    }

    return {
      projectId,
      queryType: 'pmis',
      scope: campusQuestion ? 'campus' : pmisQuestion ? 'campus' : scope,
      question: text(question),
      answer: buildCampusAnswer(campus),
      summary: `Campus readiness is ${Math.round(pct(campus.avgReadiness))}% across ${campus.total} buildings.`,
      available: true,
      building: null,
      campus,
      buildings: campus.topAttention,
      focusBuildings: campus.topAttention,
      tradeHealth: [],
      pilotCompletion: { completeCount: 0, total: 0, missing: [], gates: [] },
      shutdowns: campus.activeShutdowns,
      confidence: 0.78
    };
  }

  function buildContextString(result) {
    if (!result) return '';
    const parts = ['PMIS SME:'];
    parts.push(`Question: ${result.question || ''}`);
    parts.push(`Scope: ${result.scope || 'campus'}`);
    parts.push(`Answer: ${result.answer || ''}`);
    if (result.summary) {
      parts.push(`Summary: ${result.summary}`);
    }
    if (result.building) {
      parts.push('');
      parts.push('Selected Building Facts:');
      parts.push(`  - ${result.building.label} readiness ${result.building.readinessPct}%`);
      parts.push(`  - Overall status: ${result.building.overallStatus}`);
      parts.push(`  - Construction ready: ${result.building.constructionReady}`);
      parts.push(`  - OIT readiness: ${result.building.oitReadiness}`);
      parts.push(`  - Open risks: ${result.building.openRisks}`);
      parts.push(`  - Open questions: ${result.building.openQuestions}`);
      parts.push(`  - Shutdowns: ${result.building.shutdownCount}`);
      if (result.building.tradeHealth?.length) {
        parts.push('  - Trade health:');
        for (const item of result.building.tradeHealth) {
          parts.push(`    · ${item.label}: ${item.value} (${item.percent}%)`);
        }
      }
      if (result.building.pilotCompletion?.gates?.length) {
        parts.push('  - Pilot completion:');
        for (const gate of result.building.pilotCompletion.gates) {
          parts.push(`    · ${gate.label}: ${gate.value}`);
        }
        if (result.building.pilotCompletion.missing.length) {
          parts.push(`    · Missing: ${result.building.pilotCompletion.missing.join(', ')}`);
        }
      }
      if (result.building.shutdowns?.length) {
        parts.push('  - Active shutdowns:');
        for (const item of result.building.shutdowns.slice(0, 8)) {
          parts.push(`    · ${text(item.ShutdownID || item['Shutdown ID'] || item.Title || item.System || 'Shutdown')} — ${text(item.Status || 'Open')}`);
        }
      }
    }
    if (result.campus) {
      parts.push('');
      parts.push('Campus Summary:');
      parts.push(`  - Buildings tracked: ${result.campus.total}`);
      parts.push(`  - Ready: ${result.campus.ready}`);
      parts.push(`  - Not ready: ${result.campus.notReady}`);
      parts.push(`  - Open risks: ${Math.round(result.campus.risks)}`);
      parts.push(`  - Open questions: ${Math.round(result.campus.questions)}`);
      parts.push(`  - Active shutdowns: ${result.campus.activeShutdowns.length}`);
      if (result.campus.topAttention?.length) {
        parts.push(`  - Top attention buildings: ${result.campus.topAttention.map(item => item.Building).join(', ')}`);
      }
    }
    return parts.join('\n');
  }

  return {
    projectId,
    isPmisQuestion,
    getBuildingStatus(buildingKey) {
      const data = runtime();
      const building = getBuildingRecord(data, buildingKey);
      return building ? building.overallStatus || statusText(building['Overall Status']) : 'PMIS data is unavailable for this item.';
    },
    getBuildingReadiness(buildingKey) {
      const data = runtime();
      const building = getBuildingRecord(data, buildingKey);
      return building ? building.readinessPct : null;
    },
    getTradeHealth(buildingKey) {
      const data = runtime();
      const building = getBuildingRecord(data, buildingKey);
      return building ? formatTradeHealth(building) : [];
    },
    getOpenRisks(buildingKey) {
      const data = runtime();
      const building = getBuildingRecord(data, buildingKey);
      return building ? building.openRisks : 0;
    },
    getOpenQuestions(buildingKey) {
      const data = runtime();
      const building = getBuildingRecord(data, buildingKey);
      return building ? building.openQuestions : 0;
    },
    getShutdowns(buildingKey = '') {
      const data = runtime();
      const key = normalizeBuildingKey(buildingKey);
      return data.shutdowns.filter(item => {
        const itemBuilding = normalizeBuildingKey(item?.Building || item?.['Affected Building'] || item?.['Building / Area']);
        return !key || itemBuilding === key;
      });
    },
    getPilotCompletion(buildingKey) {
      const data = runtime();
      const building = getBuildingRecord(data, buildingKey);
      return building ? formatPilotCompletion(building) : { completeCount: 0, total: 0, missing: [], gates: [] };
    },
    getOitReadiness(buildingKey) {
      const data = runtime();
      const building = getBuildingRecord(data, buildingKey);
      return building ? statusText(firstValue(building, ['OIT Status', 'OIT Readiness'], 'Monitor')) : 'PMIS data is unavailable for this item.';
    },
    getIncompleteRequirements(buildingKey) {
      const data = runtime();
      const building = getBuildingRecord(data, buildingKey);
      return building ? formatPilotCompletion(building).missing : [];
    },
    getBuildingsNeedingAttention(limit = 5) {
      const data = runtime();
      return [...data.buildings].sort((a, b) => scoreAttention(b) - scoreAttention(a)).slice(0, Math.max(1, Number(limit) || 5));
    },
    summarizeCurrentCampusProjectHealth() {
      return getCampusSummary(runtime());
    },
    answerQuestion,
    buildContextString,
    getRuntimeSnapshot() {
      return runtime();
    }
  };
}
