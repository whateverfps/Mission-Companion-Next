const normalize = value => String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const BEDFORD_DRAWING_ROWS = Object.freeze([
  ['General', 'G-000', 'COVER SHEET'],
  ['General', 'G-001', 'DRAWING INDEX'],
  ['General', 'G-010', 'GENERAL PROJECT NOTES'],
  ['General', 'G-011', 'GENERAL INFECTION CONTROL NOTES AND SYMBOLS'],
  ['General', 'G-012', 'GENERAL INDOOR AIR QUALITY NOTES'],
  ['Hazardous', 'H-101', 'HAZARDOUS MATERIAL ABATEMENT PLAN - FIRST LEVEL'],
  ['Hazardous', 'H-102', 'HAZARDOUS MATERIAL ABATEMENT PLAN - SECOND LEVEL'],
  ['Architectural', 'A-001', 'ARCHITECTURAL SYMBOLS, & GENERAL NOTES'],
  ['Architectural', 'A-400', 'ARCHITECTURAL ENLARGED VIEWS - BASEMENT AND FIRST LEVEL'],
  ['Architectural', 'A-401', 'ARCHITECTURAL ENLARGED VIEWS - SECOND LEVEL'],
  ['Architectural', 'A-511', 'ARCHITECTURAL PARTITION AND FRAMING DETAILS'],
  ['Architectural', 'A-512', 'ARCHITECTURAL PARTITION HEAD DETAILS'],
  ['Architectural', 'A-531', 'ARCHITECTURAL CEILING DETAILS'],
  ['Interiors', 'IN101', 'INTERIOR FINISH PLAN, SIGNAGE & SCHEDULES'],
  ['Fire Protection', 'FX001', 'FIRE PROTECTION ABBREVIATIONS, SYMBOLS, AND DETAILS'],
  ['Fire Protection', 'FX100', 'FIREPROTECTION PLAN - BASEMENT LEVEL'],
  ['Fire Protection', 'FX101', 'FIREPROTECTION PLAN - FIRST LEVEL - OVERALL'],
  ['Fire Protection', 'FX102', 'FIREPROTECTION PLAN - SECOND LEVEL - OVERALL'],
  ['Fire Protection', 'FX401', 'FIREPROTECTION PLAN ENLARGED PLANS'],
  ['Fire Protection', 'FX501', 'FIRE PROTECTION DETAILS AND SCHEDULES'],
  ['Fire Protection', 'FX901', 'FIRE PROTECTION CUTSHEETS & BASIS OF DESIGN'],
  ['Plumbing', 'P-001', 'PLUMBING ABBREVIATIONS AND SYMBOLS'],
  ['Plumbing', 'P-100', 'PLUMBING PLAN - BASEMENT LEVEL'],
  ['Mechanical', 'M-001', 'MECHANICAL ABBREVIATIONS AND SYMBOLS'],
  ['Mechanical', 'M-100', 'MECHANICAL PLAN - BASEMENT LEVEL'],
  ['Mechanical', 'M-101', 'MECHANICAL PLAN - FIRST LEVEL - OVERALL'],
  ['Mechanical', 'M-102', 'MECHANICAL PLAN - SECOND LEVEL - OVERALL'],
  ['Mechanical', 'M-401', 'MECHANICAL ENLARGED PLANS'],
  ['Mechanical', 'M-501', 'MECHANICAL DETAILS'],
  ['Mechanical', 'M-701', 'MECHANICAL SCHEDULES'],
  ['Mechanical', 'M-801', 'MECHANICAL CONTROL SYMBOL LEGEND AND ABBREVIATIONS'],
  ['Mechanical', 'M-802', 'MECHANICAL CONTROL DIAGRAMS'],
  ['Mechanical', 'M-901', 'MECHANICAL CUTSHEETS & BASIS OF DESIGN'],
  ['Mechanical', 'M-902', 'MECHANICAL CUTSHEETS & BASIS OF DESIGN'],
  ['Electrical', 'E-001', 'ELECTRICAL ABBREVIATIONS AND SYMBOLS'],
  ['Electrical', 'E-100', 'ELECTRICAL PLAN - BASEMENT LEVEL'],
  ['Electrical', 'E-101', 'ELECTRICAL PLAN - FIRST LEVEL'],
  ['Electrical', 'E-102', 'ELECTRICAL PLAN - SECOND LEVEL'],
  ['Electrical', 'E-401', 'ELECTRICAL ENLARGED PLANS'],
  ['Electrical', 'E-402', 'ELECTRICAL ENLARGED PLANS'],
  ['Electrical', 'E-501', 'ELECTRICAL DETAILS'],
  ['Electrical', 'E-601', 'ELECTRICAL ONE-LINE DIAGRAMS'],
  ['Electrical', 'E-701', 'ELECTRICAL SCHEDULES'],
  ['Electrical', 'E-702', 'ELECTRICAL SCHEDULES'],
  ['Electrical', 'E-703', 'ELECTRICAL SCHEDULES'],
  ['Electrical', 'E-901', 'ELECTRICAL CUTSHEETS & BASIS OF DESIGN'],
  ['Telecommunication', 'T-001', 'TELECOMMUNICATION ABBREVIATIONS AND SYMBOLS'],
  ['Telecommunication', 'T-100', 'TELECOMMUNICATION PLAN - BASEMENT LEVEL'],
  ['Telecommunication', 'T-101', 'TELECOMMUNICATION PLAN - FIRST LEVEL'],
  ['Telecommunication', 'T-102', 'TELECOMMUNICATION PLAN - SECOND LEVEL'],
  ['Telecommunication', 'T-401', 'TELECOMMUNICATION ENLARGED PLANS'],
  ['Telecommunication', 'T-402', 'TELECOMMUNICATION ROOM 137- INVENTORY LIST'],
  ['Telecommunication', 'T-501', 'TELECOMMUNICATION DETAILS'],
  ['Telecommunication', 'T-502', 'TELECOMMUNICATION ROOM OIT TEMPLATE DETAILS'],
  ['Telecommunication', 'T-503', 'TELECOMMUNICATION ROOM OIT TEMPLATE DETAILS'],
  ['Telecommunication', 'T-504', 'TELECOMMUNICATION ROOM OIT TEMPLATE DETAILS'],
  ['Telecommunication', 'T-601', 'TELECOMMUNICATIONS RISER DIAGRAMS'],
  ['Telecommunication', 'T-602', 'TELECOMMUNICATIONS FIBER RISER DIAGRAM - EXISTING'],
  ['Telecommunication', 'T-603A', 'TELECOMMUNICATIONS FIBER RISER DIAGRAM - NEW'],
  ['Telecommunication', 'T-603B', 'TELECOMMUNICATIONS FIBER RISER DIAGRAM - NEW'],
  ['Telecommunication', 'T-604', 'TELECOMMUNICATIONS RACK ELEVATIONS A'],
  ['Telecommunication', 'T-605', 'TELECOMMUNICATIONS RACK ELEVATIONS B'],
  ['Telecommunication', 'T-606', 'SERVER RACK ELEVATIONS DEMARC A'],
  ['Telecommunication', 'T-607', 'SERVER RACK ELEVATIONS DEMARC B'],
  ['Telecommunication', 'T-701', 'TELECOMMUNICATION SCHEDULES'],
  ['Telecommunication', 'T-702', 'TELECOMMUNICATION SCHEDULES'],
  ['Telecommunication', 'T-901', 'TELECOMMUNICATION CUTSHEETS & BASIS OF DESIGN'],
  ['Telecommunication', 'T-902', 'TELECOMMUNICATION CUTSHEETS & BASIS OF DESIGN'],
  ['Telecommunication', 'T-903', 'TELECOMMUNICATION CUTSHEETS & BASIS OF DESIGN'],
  ['Reference', 'R-900', 'PHOTO REFERENCES']
]);

const BEDFORD_DRAWING_PROFILES = Object.freeze({
  '61': Object.freeze({
    buildingId: '61',
    expectedFile: '518-22-700.Bedford.EHRM.IFC.B61.20260316.pdf',
    pageCount: 70
  }),
  '62': Object.freeze({
    buildingId: '62',
    expectedFile: '518-22-700.Bedford.EHRM.IFC.B62.20260316.pdf',
    pageCount: 68
  })
});

const drawingType = title => /COVER SHEET/.test(title) ? 'Cover Sheet'
  : /DRAWING INDEX/.test(title) ? 'Drawing Index'
  : /CUTSHEETS|BASIS OF DESIGN/.test(title) ? 'Cutsheets / Basis of Design'
  : /SCHEDULE/.test(title) ? 'Schedule'
  : /DETAIL/.test(title) ? 'Details'
  : /RISER|ONE-LINE|DIAGRAM/.test(title) ? 'Diagram'
  : /ELEVATION/.test(title) ? 'Elevation'
  : /PLAN|ENLARGED VIEW/.test(title) ? 'Plan'
  : /NOTE|SYMBOL|ABBREVIATION|LEGEND/.test(title) ? 'General Information'
  : 'Reference';

const rowsForBuilding = buildingId => BEDFORD_DRAWING_ROWS.map(([discipline, sheetNumber, sheetTitle], index) => ({
  pdfPageNumber: index + 1,
  sheetNumber: `${buildingId}${sheetNumber}`,
  sheetTitle,
  discipline,
  drawingType: drawingType(sheetTitle),
  identityState: 'authoritative'
}));

export const BUILDING_61_DRAWING_CATALOG = Object.freeze(rowsForBuilding('61').map(item => Object.freeze(item)));
export const BUILDING_62_DRAWING_CATALOG = Object.freeze(rowsForBuilding('62').map(item => Object.freeze(item)));

export function matchesBedfordDrawingDocument(document = {}, pageCount = 0, expectedFile = '', expectedPageCount = 0) {
  const identities = [document.fileName, document.filename, document.name, document.title, document.sourceIdentity, document.metadata?.fileName, document.metadata?.sourceIdentity]
    .map(normalize)
    .filter(Boolean);
  if (!identities.length || !expectedFile) return false;
  if (Number(expectedPageCount) && Number(pageCount) !== Number(expectedPageCount)) return false;
  return identities.includes(normalize(expectedFile));
}

export function matchesBuilding61DrawingDocument(document = {}, pageCount = 0) {
  return matchesBedfordDrawingDocument(document, pageCount, BEDFORD_DRAWING_PROFILES['61'].expectedFile, BEDFORD_DRAWING_PROFILES['61'].pageCount);
}

export function matchesBuilding62DrawingDocument(document = {}, pageCount = 0) {
  return matchesBedfordDrawingDocument(document, pageCount, BEDFORD_DRAWING_PROFILES['62'].expectedFile, BEDFORD_DRAWING_PROFILES['62'].pageCount);
}

export function bedfordDrawingCatalogFor(document = {}, pageCount = 0) {
  if (matchesBuilding61DrawingDocument(document, pageCount)) return BUILDING_61_DRAWING_CATALOG;
  if (matchesBuilding62DrawingDocument(document, pageCount)) return BUILDING_62_DRAWING_CATALOG;
  return [];
}

export function building61DrawingCatalogFor(document = {}, pageCount = 0) {
  return matchesBuilding61DrawingDocument(document, pageCount) ? BUILDING_61_DRAWING_CATALOG : [];
}

export function building62DrawingCatalogFor(document = {}, pageCount = 0) {
  return matchesBuilding62DrawingDocument(document, pageCount) ? BUILDING_62_DRAWING_CATALOG : [];
}
