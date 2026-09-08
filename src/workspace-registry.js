import { BUILDING_61_DRAWING_CATALOG } from './building-61-drawing-catalog.js';
import { BUILDING_MCR_DRAWING_CATALOG } from './building-MCR-drawing-catalog.js';
import { buildBedfordProjectMilestoneContext } from './workspace-milestones.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

const BEDFORD_DRAWING_CATALOG_BY_BUILDING_ID = Object.freeze({
  '61': BUILDING_61_DRAWING_CATALOG,
  MCR: BUILDING_MCR_DRAWING_CATALOG
});
const BUILDING_61_SHEET_INDEX = new Map(BUILDING_61_DRAWING_CATALOG.map(sheet => [sheet.sheetNumber, sheet]));
const BUILDING_MCR_SHEET_INDEX = new Map(BUILDING_MCR_DRAWING_CATALOG.map(sheet => [sheet.sheetNumber, sheet]));
const MCR_DISCIPLINE_ORDER = [
  'General',
  'Civil',
  'Structural',
  'Architectural',
  'Interiors',
  'Equipment',
  'Fire Protection',
  'Plumbing',
  'Mechanical',
  'Electrical',
  'Telecommunication'
];

const DRAWING_CATEGORY_ORDER = [
  'PRIMARY SOURCE SHEETS',
  'EXISTING / TRANSITION',
  'TELECOMMUNICATIONS / OIT',
  'ELECTRICAL / POWER',
  'MECHANICAL / PLUMBING',
  'FIRE PROTECTION',
  'ARCHITECTURAL / INTERIORS',
  'DETAILS / SCHEDULES',
  'GENERAL / REFERENCE'
];

const specificationMap = new Map([
  ['MCRG-000', [
    ['01 32 16.15', 'PROJECT SCHEDULES'],
    ['01 91 00', 'GENERAL COMMISSIONING REQUIREMENTS'],
    ['07 08 00', 'FACILITY EXTERIOR CLOSURE COMMISSIONING'],
    ['21 08 00', 'COMMISSIONING OF FIRE SUPPRESSION SYSTEMS'],
    ['22 08 00', 'COMMISSIONING OF PLUMBING SYSTEMS'],
    ['23 08 00', 'COMMISSIONING OF HVAC SYSTEMS'],
    ['26 08 00', 'COMMISSIONING OF ELECTRICAL SYSTEMS'],
    ['27 08 00', 'COMMISSIONING OF COMMUNICATIONS SYSTEMS'],
    ['28 08 00', 'COMMISSIONING OF SECURITY SYSTEMS'],
    ['33 08 00', 'COMMISSIONING OF SITE UTILITY SYSTEMS']
  ]],
  ['MCRG-001', [
    ['01 32 16.15', 'PROJECT SCHEDULES'],
    ['01 91 00', 'GENERAL COMMISSIONING REQUIREMENTS'],
    ['07 08 00', 'FACILITY EXTERIOR CLOSURE COMMISSIONING'],
    ['21 08 00', 'COMMISSIONING OF FIRE SUPPRESSION SYSTEMS'],
    ['22 08 00', 'COMMISSIONING OF PLUMBING SYSTEMS'],
    ['23 08 00', 'COMMISSIONING OF HVAC SYSTEMS'],
    ['26 08 00', 'COMMISSIONING OF ELECTRICAL SYSTEMS'],
    ['27 08 00', 'COMMISSIONING OF COMMUNICATIONS SYSTEMS'],
    ['28 08 00', 'COMMISSIONING OF SECURITY SYSTEMS'],
    ['33 08 00', 'COMMISSIONING OF SITE UTILITY SYSTEMS']
  ]],
  ['61T-100', [
    ['27 10 00', 'INFORMATION TRANSPORT INFRASTRUCTURE'],
    ['27 05 11', 'COMMON WORK RESULTS FOR COMMUNICATIONS'],
    ['27 05 26', 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS'],
    ['27 05 33', 'WIRE MESH CABLE TRAY FOR COMMUNICATIONS SYSTEMS'],
    ['27 15 00', 'COMMUNICATIONS HORIZONTAL CABLING'],
    ['28 23 00', 'VIDEO SURVEILLANCE']
  ]],
  ['61T-101', [
    ['27 10 00', 'INFORMATION TRANSPORT INFRASTRUCTURE'],
    ['27 05 11', 'COMMON WORK RESULTS FOR COMMUNICATIONS'],
    ['27 05 26', 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS'],
    ['27 05 33', 'WIRE MESH CABLE TRAY FOR COMMUNICATIONS SYSTEMS'],
    ['27 15 00', 'COMMUNICATIONS HORIZONTAL CABLING'],
    ['28 23 00', 'VIDEO SURVEILLANCE']
  ]],
  ['61T-102', [
    ['27 10 00', 'INFORMATION TRANSPORT INFRASTRUCTURE'],
    ['27 05 11', 'COMMON WORK RESULTS FOR COMMUNICATIONS'],
    ['27 05 26', 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS'],
    ['27 05 33', 'WIRE MESH CABLE TRAY FOR COMMUNICATIONS SYSTEMS'],
    ['27 15 00', 'COMMUNICATIONS HORIZONTAL CABLING'],
    ['28 23 00', 'VIDEO SURVEILLANCE']
  ]],
  ['61T-402', [
    ['27 15 00', 'COMMUNICATIONS HORIZONTAL CABLING']
  ]],
  ['61T-501', [
    ['27 05 11', 'COMMON WORK RESULTS FOR COMMUNICATIONS'],
    ['27 05 26', 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS'],
    ['27 05 33', 'WIRE MESH CABLE TRAY FOR COMMUNICATIONS SYSTEMS'],
    ['27 15 00', 'COMMUNICATIONS HORIZONTAL CABLING']
  ]],
  ['61T-502', [
    ['27 05 11', 'COMMON WORK RESULTS FOR COMMUNICATIONS'],
    ['27 05 26', 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS'],
    ['27 05 33', 'WIRE MESH CABLE TRAY FOR COMMUNICATIONS SYSTEMS'],
    ['27 15 00', 'COMMUNICATIONS HORIZONTAL CABLING']
  ]],
  ['61T-503', [
    ['27 05 11', 'COMMON WORK RESULTS FOR COMMUNICATIONS'],
    ['27 05 26', 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS'],
    ['27 05 33', 'WIRE MESH CABLE TRAY FOR COMMUNICATIONS SYSTEMS'],
    ['27 15 00', 'COMMUNICATIONS HORIZONTAL CABLING']
  ]],
  ['61T-504', [
    ['27 05 11', 'COMMON WORK RESULTS FOR COMMUNICATIONS'],
    ['27 05 26', 'GROUNDING AND BONDING FOR COMMUNICATIONS SYSTEMS'],
    ['27 05 33', 'WIRE MESH CABLE TRAY FOR COMMUNICATIONS SYSTEMS'],
    ['27 15 00', 'COMMUNICATIONS HORIZONTAL CABLING']
  ]]
]);

function catalogForBuilding(buildingId = '61') {
  return BEDFORD_DRAWING_CATALOG_BY_BUILDING_ID[text(buildingId).toUpperCase()] || BUILDING_61_DRAWING_CATALOG;
}

function sheetIndexForBuilding(buildingId = '61') {
  return text(buildingId).toUpperCase() === 'MCR' ? BUILDING_MCR_SHEET_INDEX : BUILDING_61_SHEET_INDEX;
}

function drawingSetSlugForBuildingId(buildingId = '61') {
  return text(buildingId).toUpperCase() === 'MCR'
    ? 'bedford-mcr-drawings'
    : text(buildingId).toUpperCase() === '62'
      ? 'bedford-b62-drawings'
      : 'bedford-b61-drawings';
}

function sheetRecord(sheetNumber, { buildingId = '61', drawingCatalog = catalogForBuilding(buildingId) } = {}) {
  const sheet = sheetIndexForBuilding(buildingId).get(text(sheetNumber)) || list(drawingCatalog).find(item => text(item.sheetNumber) === text(sheetNumber)) || null;
  return sheet ? {
    sheetNumber: sheet.sheetNumber,
    sheetTitle: sheet.sheetTitle,
    discipline: sheet.discipline,
    drawingType: sheet.drawingType,
    pdfPageNumber: Number(sheet.pdfPageNumber) || 0,
    pageId: sheet.pageId || `drawing-page:${drawingSetSlugForBuildingId(buildingId)}:${Number(sheet.pdfPageNumber) || 0}`
  } : {
    sheetNumber: text(sheetNumber),
    sheetTitle: 'Not available',
    discipline: 'Not available',
    drawingType: 'Not available',
    pdfPageNumber: 0,
    pageId: ''
  };
}

function sheetCategoryLabel(sheet = {}, type = '', primarySheetNumbers = new Set()) {
  const discipline = text(sheet.discipline).toUpperCase();
  const title = text(sheet.sheetTitle).toUpperCase();
  const drawingType = text(sheet.drawingType).toUpperCase();
  const roomType = text(type).toUpperCase();

  if (primarySheetNumbers.has(text(sheet.sheetNumber))) return 'PRIMARY SOURCE SHEETS';

  if (roomType === 'EXISTING_TRANSITION' && (
    discipline === 'HAZARDOUS' ||
    /EXISTING|DEMOLITION|INVENTORY|ABATEMENT/.test(title)
  )) return 'EXISTING / TRANSITION';

  if (drawingType === 'DETAILS / BASIS OF DESIGN' || drawingType === 'DETAILS / SCHEDULES' || drawingType === 'DETAILS' || drawingType === 'SCHEDULE' || /DETAIL|SCHEDULE|DIAGRAM|CUTSHEET|BASIS OF DESIGN/.test(title)) return 'DETAILS / SCHEDULES';
  if (discipline === 'TELECOMMUNICATION') return 'TELECOMMUNICATIONS / OIT';
  if (discipline === 'ELECTRICAL') return 'ELECTRICAL / POWER';
  if (discipline === 'MECHANICAL' || discipline === 'PLUMBING') return 'MECHANICAL / PLUMBING';
  if (discipline === 'FIRE PROTECTION') return 'FIRE PROTECTION';
  if (discipline === 'ARCHITECTURAL' || discipline === 'INTERIORS') return 'ARCHITECTURAL / INTERIORS';
  return 'GENERAL / REFERENCE';
}

function workspaceLevelTokens(level = '') {
  const value = text(level).toUpperCase();
  if (!value) return [];
  if (value.includes('BASEMENT')) return ['BASEMENT LEVEL', 'BASEMENT AND FIRST LEVEL', 'BASEMENT'];
  if (value.includes('FIRST LEVEL')) return ['FIRST LEVEL', 'BASEMENT AND FIRST LEVEL', 'FIRST LEVEL - OVERALL'];
  if (value.includes('SECOND LEVEL')) return ['SECOND LEVEL', 'SECOND LEVEL - OVERALL'];
  return [value];
}

function sheetMatchesWorkspaceContext(sheet = {}, { type = '', level = '', room = '', buildingId = '61' } = {}) {
  if (text(buildingId).toUpperCase() === 'MCR') return true;
  const sheetNumber = text(sheet.sheetNumber).toUpperCase();
  const title = text(sheet.sheetTitle).toUpperCase();
  const drawingType = text(sheet.drawingType).toUpperCase();
  const roomType = text(type).toUpperCase();
  const levelTokens = workspaceLevelTokens(level);

  if (roomType === 'EXISTING_TRANSITION' && (
    /^61H-/.test(sheetNumber) ||
    /EXISTING|TRANSITION|DEMOLITION|INVENTORY|ABATEMENT/.test(title)
  )) return true;

  if (/GENERAL|DETAIL|SCHEDULE|CUTSHEET|BASIS OF DESIGN|REFERENCE|DIAGRAM|ELEVATION/.test(title)) return true;
  if (/GENERAL INFORMATION|DETAILS|SCHEDULE|CUTSHEETS \/ BASIS OF DESIGN|COVER SHEET|DRAWING INDEX|REFERENCE/.test(drawingType)) return true;

  if (levelTokens.some(token => title.includes(token))) return true;

  if (roomType !== 'EXISTING_TRANSITION' && room && /^61T-(100|101|102|402|501)$/.test(sheetNumber)) {
    return title.includes(levelTokens[0] || '') || sheetNumber === `61T-${room === 'B13' ? '100' : room === '124' ? '101' : room === '226' ? '102' : '402'}`;
  }

  return false;
}

function buildDrawingCategories({ sourceSheets = [], type = '', level = '', room = '', buildingId = '61', drawingCatalog = catalogForBuilding(buildingId) } = {}) {
  const primarySheetNumbers = new Set(list(sourceSheets).map(sheetNumber => text(sheetNumber)));
  const categories = new Map();
  const sourceRecords = list(sourceSheets).map(sheetNumber => ({
    ...sheetRecord(sheetNumber, { buildingId, drawingCatalog }),
    relevance: 'PRIMARY',
    category: 'PRIMARY SOURCE SHEETS'
  }));

  for (const record of sourceRecords) {
    if (!categories.has('PRIMARY SOURCE SHEETS')) {
      categories.set('PRIMARY SOURCE SHEETS', {
        id: 'primary-source-sheets',
        label: 'Primary Source Sheets',
        relationship: 'Primary Source',
        items: []
      });
    }
    categories.get('PRIMARY SOURCE SHEETS').items.push(record);
  }

  const catalog = list(drawingCatalog);
  for (const sheet of catalog) {
    const sheetNumber = text(sheet.sheetNumber);
    if (!sheetNumber || primarySheetNumbers.has(sheetNumber)) continue;
    if (!sheetMatchesWorkspaceContext(sheet, { type, level, room, buildingId })) continue;
    const categoryLabel = text(buildingId).toUpperCase() === 'MCR'
      ? (text(sheet.discipline) || 'General')
      : sheetCategoryLabel(sheet, type, primarySheetNumbers);
    if (!categories.has(categoryLabel)) {
      categories.set(categoryLabel, {
        id: categoryLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        label: categoryLabel.split(' / ').join(' / '),
        relationship: text(buildingId).toUpperCase() === 'MCR'
          ? 'Building Package'
          : categoryLabel === 'EXISTING / TRANSITION'
          ? 'Existing / Transition'
          : categoryLabel === 'PRIMARY SOURCE SHEETS'
            ? 'Primary Source'
            : 'Related Evidence',
        items: []
      });
    }
    categories.get(categoryLabel).items.push({
      ...sheet,
      relevance: categoryLabel === 'DETAILS / SCHEDULES' || categoryLabel === 'GENERAL / REFERENCE'
        ? 'SUPPORTING'
        : 'DIRECT',
      category: categoryLabel
    });
  }

  const orderedCategories = DRAWING_CATEGORY_ORDER
    .map(label => categories.get(label))
    .filter(category => category && category.items.length);
  if (text(buildingId).toUpperCase() === 'MCR') {
    const primaryCategory = categories.get('PRIMARY SOURCE SHEETS') || null;
    const orderedMcrCategories = MCR_DISCIPLINE_ORDER
      .map(label => categories.get(label))
      .filter(category => category && category.items.length);
    return [primaryCategory, ...orderedMcrCategories].filter(Boolean).map(category => ({
      ...category,
      sheets: category.items,
      items: category.items
        .slice()
        .sort((left, right) => String(left.sheetNumber).localeCompare(String(right.sheetNumber), undefined, { numeric: true }))
        .map(item => ({
          sheetNumber: item.sheetNumber,
          sheetTitle: item.sheetTitle,
          discipline: item.discipline,
          drawingType: item.drawingType,
          pdfPageNumber: Number(item.pdfPageNumber) || 0,
          pageId: item.pageId || `drawing-page:bedford-mcr-drawings:${Number(item.pdfPageNumber) || 0}`,
          relevance: item.relevance || 'DIRECT',
          category: item.category || category.label
        }))
    }));
  }

  return orderedCategories.map(category => ({
    ...category,
    sheets: category.items,
    items: category.items
      .slice()
      .sort((left, right) => String(left.sheetNumber).localeCompare(String(right.sheetNumber), undefined, { numeric: true }))
      .map(item => ({
        sheetNumber: item.sheetNumber,
        sheetTitle: item.sheetTitle,
        discipline: item.discipline,
        drawingType: item.drawingType,
        pdfPageNumber: Number(item.pdfPageNumber) || 0,
        pageId: item.pageId || `drawing-page:bedford-b61-drawings:${Number(item.pdfPageNumber) || 0}`,
        relevance: item.relevance || 'DIRECT',
        category: item.category || category.label
      }))
  }));
}

function specRecord(sectionNumber, sectionTitle) {
  return { sectionNumber, sectionTitle };
}

function buildSourceEvidence(sourceSheets, label) {
  return list(sourceSheets).map(sheetNumber => {
    const sheet = sheetRecord(sheetNumber);
    return {
      kind: 'source-sheet',
      label,
      sheetNumber: sheet.sheetNumber,
      sheetTitle: sheet.sheetTitle,
      pageId: sheet.pageId,
      pdfPageNumber: sheet.pdfPageNumber
    };
  });
}

function buildApplicableSpecifications(sourceSheets) {
  const seen = new Set();
  const records = [];
  for (const sheetNumber of list(sourceSheets)) {
    for (const [sectionNumber, sectionTitle] of list(specificationMap.get(text(sheetNumber)))) {
      if (seen.has(sectionNumber)) continue;
      seen.add(sectionNumber);
      records.push(specRecord(sectionNumber, sectionTitle));
    }
  }
  return records;
}

function normalizeDrawingLinkRecords(drawingLinks = []) {
  return list(drawingLinks).filter(link => link && typeof link === 'object');
}

function buildApplicableSpecificationsForSheet(sourceSheets, selectedSheetNumber = '', drawingLinks = []) {
  const sheet = text(selectedSheetNumber).toUpperCase();
  if (sheet) {
    const selectedLinks = normalizeDrawingLinkRecords(drawingLinks).filter(link => text(link.sheetNumber).toUpperCase() === sheet);
    if (selectedLinks.length) {
      const seen = new Set();
      const records = [];
      for (const link of selectedLinks) {
        const sectionNumber = text(link.sectionNumber);
        if (!sectionNumber || seen.has(sectionNumber)) continue;
        seen.add(sectionNumber);
        records.push({
          sectionNumber,
          sectionTitle: text(link.sectionTitle),
          relationshipType: text(link.relationshipType || link.status || 'RELATED'),
          status: text(link.status || link.relationshipType || 'RELATED'),
          origin: text(link.origin || ''),
          drawingPageId: text(link.drawingPageId || ''),
          sheetNumber: sheet,
          evidenceText: text(link.evidenceText || link.reason),
          confidence: Number(link.confidence) || 0
        });
      }
      return records;
    }
    return [];
  }
  return buildApplicableSpecifications(sourceSheets);
}

function buildIssues({ room, name, type }) {
  if (text(type) === 'EXISTING_TRANSITION') {
    return [
      { label: 'Existing condition inventory', detail: `${room} is documented as an existing / transition telecom-computer room and should be verified against the current inventory list.` }
    ];
  }
  return [
    { label: 'No room-specific issues recorded', detail: `${room || name || 'This workspace'} does not have separate issue data yet.` }
  ];
}

function buildTraceabilityMap({ sourceSheets, applicableSpecifications, name, level, disciplineFocus }) {
  const primarySheet = list(sourceSheets)[0] ? sheetRecord(list(sourceSheets)[0]) : null;
  const primarySpec = list(applicableSpecifications)[0] || null;
  return [
    {
      from: primarySheet?.sheetNumber || 'Source Sheet',
      requirement: primarySpec?.sectionTitle || disciplineFocus || 'Workspace requirement',
      impact: `${name || 'Workspace'} readiness`
    },
    {
      from: primarySpec?.sectionNumber || 'Governing Spec',
      requirement: primarySpec?.sectionTitle || 'Shared Bedford specification',
      impact: `${level || 'Workspace'} traceability`
    },
    {
      from: primarySheet?.sheetNumber || 'Source Sheet',
      requirement: disciplineFocus || 'Bedford source evidence',
      impact: 'Workspace'
    }
  ];
}

function buildChecklist({ sourceSheets, disciplineFocus, level, room }) {
  const items = [
    `Verify ${room || 'the workspace'} source sheet geometry and room boundaries`,
    'Confirm rack / cabinet placement against the source drawing',
    'Verify power, grounding, and bonding conditions',
    'Inspect firestopping and pathway coordination',
    `Review governing specifications for ${disciplineFocus || 'this workspace'}`
  ];
  if (list(sourceSheets).some(sheet => text(sheet) === '61T-402')) {
    items.unshift('Compare the transition inventory list against current field conditions');
  }
  return items.map(label => ({ label, done: false, detail: `${level || 'Workspace'} checklist item` }));
}

function buildNextSteps({ sourceSheets, applicableSpecifications, relatedRooms, pmisBuilding, room, name }) {
  const steps = [
    { label: `Review ${list(sourceSheets)[0] || 'source sheet'}`, detail: 'Use the embedded drawing evidence to confirm the current room state.' },
    { label: `Compare ${list(applicableSpecifications)[0]?.sectionNumber || 'governing spec'}`, detail: 'Trace the source sheet back to the Bedford IFC specifications.' },
    { label: `Ask Chief about ${room || name || 'this workspace'}`, detail: 'Use Chief analysis for project context and implications.' },
    { label: `${pmisBuilding || 'Building 61'} readiness context`, detail: 'Check PMIS for building-level status and cross-workspace context.' }
  ];
  if (list(relatedRooms).length) {
    steps.push({ label: `Related rooms: ${list(relatedRooms).join(', ')}`, detail: 'Switch to another approved workspace when needed.' });
  }
  return steps;
}

function buildChiefInsight({
  id,
  room,
  name,
  type,
  level,
  disciplineFocus,
  sourceSheets,
  relatedSheets,
  applicableSpecifications,
  relatedRooms,
  pmisBuilding,
  projectMilestoneContext = null
}) {
  const sheetCount = list(sourceSheets).length;
  const relatedSheetCount = list(relatedSheets).length;
  const specCount = list(applicableSpecifications).length;
  const relatedRoomCount = list(relatedRooms).length;
  if (text(id).toUpperCase() === 'MCR') {
    const sourceSheetSummary = `${sheetCount} source sheet${sheetCount === 1 ? '' : 's'}`;
    const relatedSheetSummary = relatedSheetCount ? ` and ${relatedSheetCount} related sheet${relatedSheetCount === 1 ? '' : 's'}` : '';
    const parts = [
      'MCR is the New Main Computer Room building for Bedford EHRM.',
      `It is supported by ${sourceSheetSummary}${relatedSheetSummary}.`,
      specCount ? `It currently maps to ${specCount} applicable specification section${specCount === 1 ? '' : 's'}.` : 'Applicable specification relationships are still being established for the broader package.',
      'Use the source sheets and PMIS context to track the migration, redundancy, and activation sequence.'
    ];
    if (projectMilestoneContext) {
      parts.push(`The project remains in ${projectMilestoneContext.projectPhase || 'Preconstruction'} under Notice to Proceed on ${projectMilestoneContext.ntpDateLabel || projectMilestoneContext.ntpDate || 'the NTP date'}.`);
    }
    return parts.slice(0, 4).join(' ');
  }
  const parts = [
    `${room || id || 'This workspace'} is the ${name || 'Bedford workspace'} for ${disciplineFocus || 'project evidence review'} at ${level || 'the recorded level'} in ${pmisBuilding || 'Bedford'}.`,
    `It is supported by ${sheetCount} source sheet${sheetCount === 1 ? '' : 's'}${relatedSheetCount ? ` and ${relatedSheetCount} related sheet${relatedSheetCount === 1 ? '' : 's'}` : ''}.`,
    specCount ? `The workspace maps to ${specCount} applicable specification section${specCount === 1 ? '' : 's'}${relatedRoomCount ? ` and ${relatedRoomCount} related room${relatedRoomCount === 1 ? '' : 's'}` : ''}.` : 'No applicable specification sections are currently recorded.',
    type === 'EXISTING_TRANSITION'
      ? 'This is an existing-transition room; compare it against current inventory conditions.'
      : 'Use the source sheets and specification links to verify the current room condition.'
  ];
  if (projectMilestoneContext) {
    parts.push(`The project is in ${projectMilestoneContext.projectPhase || 'Preconstruction'} phase under Notice to Proceed on ${projectMilestoneContext.ntpDateLabel || projectMilestoneContext.ntpDate || 'the NTP date'}.`);
    parts.push(`The interim contractor schedule is ${projectMilestoneContext.scheduleStatus ? projectMilestoneContext.scheduleStatus.toLowerCase() : 'awaiting submission'}, while room-level construction dates remain ${projectMilestoneContext.roomScheduleStatus ? projectMilestoneContext.roomScheduleStatus.toLowerCase() : 'awaiting contractor schedule'}.`);
  }
  return parts.slice(0, 4).join(' ');
}

function buildWorkspaceRecord({
  id,
  building,
  room,
  name,
  type,
  importance,
  level,
  disciplineFocus,
  sourceSheets,
  relatedSheets,
  relatedRooms = [],
  pmisBuilding,
  chiefInsight,
  sourceEvidence,
  drawingCatalog = BUILDING_61_DRAWING_CATALOG
}) {
  const buildingId = text(building).toUpperCase();
  const resolvedSourceSheets = list(sourceSheets).map(sheetNumber => sheetRecord(sheetNumber, { buildingId, drawingCatalog }));
  const drawingCategories = buildDrawingCategories({ sourceSheets, type, level, room, buildingId, drawingCatalog });
  const resolvedRelatedSheets = (() => {
    const seen = new Set(resolvedSourceSheets.map(item => item.sheetNumber));
    const records = [];
    for (const entry of list(relatedSheets).map(sheetNumber => sheetRecord(sheetNumber, { buildingId, drawingCatalog }))) {
      if (!entry.sheetNumber || seen.has(entry.sheetNumber)) continue;
      seen.add(entry.sheetNumber);
      records.push(entry);
    }
    return records;
  })();
  const applicableSpecifications = buildApplicableSpecifications(sourceSheets);
  return Object.freeze({
    id: text(id),
    building: text(building),
    room: text(room),
    name: text(name),
    type: text(type),
    importance: text(importance),
    level: text(level),
    disciplineFocus: text(disciplineFocus),
    sourceSheets: resolvedSourceSheets,
    relatedSheets: resolvedRelatedSheets,
    drawingCategories,
    relatedRooms: list(relatedRooms).map(item => text(item)).filter(Boolean),
    applicableSpecifications,
    pmisBuilding: text(pmisBuilding),
    sourceEvidence: list(sourceEvidence).length ? list(sourceEvidence) : buildSourceEvidence(sourceSheets, name),
    chiefInsight: buildChiefInsight({ id, room, name, type, level, disciplineFocus, sourceSheets, relatedSheets, applicableSpecifications, relatedRooms, pmisBuilding }) || text(chiefInsight),
    issues: buildIssues({ room, name, type }),
    traceabilityMap: buildTraceabilityMap({ sourceSheets, applicableSpecifications, name, level, disciplineFocus }),
    checklist: buildChecklist({ sourceSheets, disciplineFocus, level, room }),
    nextSteps: buildNextSteps({ sourceSheets, applicableSpecifications, relatedRooms, pmisBuilding, room, name })
  });
}

const WORKSPACE_REGISTRY = Object.freeze([
  buildWorkspaceRecord({
    id: 'B13',
    building: '61',
    room: 'B13',
    name: 'Primary Telecommunications Room',
    type: 'PRIMARY',
    importance: 'Primary',
    level: 'Basement',
    disciplineFocus: 'Telecommunication / OIT',
    sourceSheets: ['61T-100', '61T-501'],
    relatedSheets: ['61T-601', '61T-701'],
    relatedRooms: ['124', '226', '137'],
    pmisBuilding: 'Building 61',
    chiefInsight: 'The basement telecommunications room is the base point for the building telecom backbone and cabinet distribution.'
  }),
  buildWorkspaceRecord({
    id: '124',
    building: '61',
    room: '124',
    name: 'Primary Telecommunications Room',
    type: 'PRIMARY',
    importance: 'Primary',
    level: 'First Level',
    disciplineFocus: 'Telecommunication / OIT',
    sourceSheets: ['61T-101', '61T-501'],
    relatedSheets: ['61T-601', '61T-701'],
    relatedRooms: ['B13', '226', '137'],
    pmisBuilding: 'Building 61',
    chiefInsight: 'The first-level telecommunications room anchors the main distribution path for first-floor support and downstream risers.'
  }),
  buildWorkspaceRecord({
    id: '226',
    building: '61',
    room: '226',
    name: 'Primary Telecommunications Room',
    type: 'PRIMARY',
    importance: 'Primary',
    level: 'Second Level',
    disciplineFocus: 'Telecommunication / OIT',
    sourceSheets: ['61T-102', '61T-501'],
    relatedSheets: ['61T-601', '61T-701'],
    relatedRooms: ['B13', '124', '137'],
    pmisBuilding: 'Building 61',
    chiefInsight: 'The second-level telecommunications room is the top-level distribution point for upper-floor telecom work and risers.'
  }),
  buildWorkspaceRecord({
    id: '137',
    building: '61',
    room: '137',
    name: 'Existing / Transition Telecom-Computer Room',
    type: 'EXISTING_TRANSITION',
    importance: 'Existing Transition',
    level: 'First Level',
    disciplineFocus: 'Telecommunication / OIT',
    sourceSheets: ['61T-402', '61T-501'],
    relatedSheets: ['61T-100', '61T-101', '61T-102', '61T-601', '61T-701'],
    relatedRooms: ['B13', '124', '226'],
    pmisBuilding: 'Building 61',
    chiefInsight: 'The room 137 inventory list and telecom details make it the clearest existing-transition workspace in the current B61 set.'
  }),
  buildWorkspaceRecord({
    id: 'MCR',
    building: 'MCR',
    room: 'MCR',
    name: 'New Main Computer Room Building',
    type: 'PRIMARY',
    importance: 'Primary',
    level: 'Building',
    disciplineFocus: 'MCR / Infrastructure',
    sourceSheets: ['MCRG-000', 'MCRG-001'],
    relatedSheets: BUILDING_MCR_DRAWING_CATALOG.map(item => item.sheetNumber).filter(sheet => !['MCRG-000', 'MCRG-001'].includes(sheet)),
    relatedRooms: [],
    pmisBuilding: 'MCR',
    drawingCatalog: BUILDING_MCR_DRAWING_CATALOG
  })
]);

export function listBedfordWorkspaceRecords() {
  return WORKSPACE_REGISTRY.map(record => ({
    ...record,
    sourceSheets: [...record.sourceSheets],
    relatedSheets: [...record.relatedSheets],
    relatedRooms: [...record.relatedRooms],
    applicableSpecifications: record.applicableSpecifications.map(item => ({ ...item })),
    sourceEvidence: record.sourceEvidence.map(item => ({ ...item })),
    issues: record.issues.map(item => ({ ...item })),
    traceabilityMap: record.traceabilityMap.map(item => ({ ...item })),
    checklist: record.checklist.map(item => ({ ...item })),
    nextSteps: record.nextSteps.map(item => ({ ...item }))
  }));
}

export function getBedfordWorkspaceRecord(id = '') {
  const needle = text(id);
  return WORKSPACE_REGISTRY.find(record => record.id === needle) || null;
}

export function getBedfordWorkspaceDefaultId() {
  return WORKSPACE_REGISTRY[0]?.id || '';
}

export function buildBedfordWorkspaceModel(id = '', { selectedSheetNumber = '', drawingLinks = [] } = {}) {
  const activeRecord = getBedfordWorkspaceRecord(id) || WORKSPACE_REGISTRY[0] || null;
  const applicableSpecifications = activeRecord
    ? (text(selectedSheetNumber)
      ? buildApplicableSpecificationsForSheet(activeRecord.sourceSheets, selectedSheetNumber, drawingLinks)
      : list(activeRecord.applicableSpecifications).map(item => ({ ...item })))
    : [];
  return {
    activeWorkspaceId: activeRecord?.id || '',
    activeWorkspace: activeRecord ? {
      ...activeRecord,
      applicableSpecifications,
      chiefInsight: buildChiefInsight({
        id: activeRecord.id,
        room: activeRecord.room,
        name: activeRecord.name,
        type: activeRecord.type,
        level: activeRecord.level,
        disciplineFocus: activeRecord.disciplineFocus,
        sourceSheets: activeRecord.sourceSheets,
        relatedSheets: activeRecord.relatedSheets,
        applicableSpecifications,
        relatedRooms: activeRecord.relatedRooms,
        pmisBuilding: activeRecord.pmisBuilding
      }) || activeRecord.chiefInsight,
      traceabilityMap: buildTraceabilityMap({
        sourceSheets: activeRecord.sourceSheets,
        applicableSpecifications,
        name: activeRecord.name,
        level: activeRecord.level,
        disciplineFocus: activeRecord.disciplineFocus
      }),
      nextSteps: buildNextSteps({
        sourceSheets: activeRecord.sourceSheets,
        applicableSpecifications,
        relatedRooms: activeRecord.relatedRooms,
        pmisBuilding: activeRecord.pmisBuilding,
        room: activeRecord.room,
        name: activeRecord.name
      })
    } : null,
    workspaces: listBedfordWorkspaceRecords(),
    projectMilestoneContext: buildBedfordProjectMilestoneContext({ workspace: activeRecord ? {
      ...activeRecord,
      applicableSpecifications
    } : null })
  };
}

export { buildChiefInsight };
