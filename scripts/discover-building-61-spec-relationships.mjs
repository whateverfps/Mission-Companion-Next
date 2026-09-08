#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Drawing type to specification sections mapping
// This is more granular than pure discipline-based mapping
const drawingTypeSpecs = {
  'Cover Sheet': [],
  'Drawing Index': [],
  'General Information': [], // General notes typically don't reference specific spec sections
  'Plan': {
    'Architectural': ['06 10 00', '06 20 00', '08 11 00', '08 20 00', '08 40 00', '08 50 00', '08 80 00'],
    'Interiors': ['06 10 00', '06 20 00', '09 05 16', '09 22 16', '09 29 00', '09 30 13', '09 35 00', '09 40 00', '09 50 00', '09 91 00', '10 14 00'],
    'Fire Protection': ['10 11 00', '10 13 00', '10 14 00', '10 21 00', '10 22 00', '10 23 00', '10 24 00', '10 25 00', '10 26 00', '10 27 00', '10 28 00'],
    'Plumbing': ['22 10 00', '22 13 00', '22 20 00', '22 30 00', '22 40 00', '22 50 00', '22 60 00'],
    'Mechanical': ['23 10 00', '23 20 00', '23 30 00', '23 40 00', '23 50 00', '23 60 00', '23 70 00', '23 73 00', '23 74 00', '23 80 00', '23 90 00'],
    'Electrical': ['26 10 00', '26 20 00', '26 24 00', '26 25 00', '26 26 00', '26 28 00', '26 30 00', '26 40 00', '26 50 00', '26 51 00', '26 52 00', '26 53 00', '26 54 00', '26 55 00', '26 56 00'],
    'Telecommunication': ['27 10 00', '27 20 00', '27 30 00', '27 40 00', '27 50 00', '27 51 00', '27 52 00', '27 53 00', '27 54 00', '27 55 00', '27 56 00']
  },
  'Details': {
    'Architectural': ['06 10 00', '06 20 00', '08 11 00', '08 20 00', '08 40 00', '08 50 00'],
    'Interiors': ['06 10 00', '06 20 00', '09 22 16', '09 29 00', '09 30 13', '09 35 00', '09 40 00', '09 91 00'],
    'Fire Protection': ['10 13 00', '10 14 00', '10 21 00', '10 22 00', '10 23 00', '10 24 00', '10 25 00'],
    'Plumbing': ['22 10 00', '22 20 00', '22 30 00', '22 40 00'],
    'Mechanical': ['23 30 00', '23 40 00', '23 50 00', '23 60 00', '23 70 00', '23 73 00', '23 74 00'],
    'Electrical': ['26 20 00', '26 24 00', '26 25 00', '26 26 00', '26 30 00', '26 40 00', '26 50 00', '26 51 00', '26 52 00'],
    'Telecommunication': ['27 30 00', '27 40 00', '27 50 00', '27 51 00', '27 52 00', '27 53 00', '27 54 00']
  },
  'Schedule': {
    'Architectural': ['06 10 00', '06 20 00', '08 11 00', '08 20 00'],
    'Interiors': ['06 20 00', '09 35 00', '09 40 00', '09 50 00', '09 91 00', '10 14 00'],
    'Fire Protection': ['10 13 00', '10 21 00', '10 22 00', '10 26 00', '10 27 00'],
    'Plumbing': ['22 10 00', '22 20 00', '22 30 00'],
    'Mechanical': ['23 20 00', '23 30 00', '23 50 00', '23 60 00', '23 70 00', '23 80 00'],
    'Electrical': ['26 20 00', '26 30 00', '26 40 00', '26 50 00', '26 51 00', '26 52 00'],
    'Telecommunication': ['27 20 00', '27 30 00', '27 50 00', '27 51 00', '27 52 00', '27 55 00', '27 56 00']
  },
  'Diagram': {
    'Mechanical': ['23 20 00', '23 30 00', '23 50 00', '23 60 00', '23 80 00'],
    'Electrical': ['26 20 00', '26 30 00', '26 40 00', '26 50 00', '26 51 00', '26 52 00'],
    'Telecommunication': ['27 20 00', '27 30 00', '27 50 00', '27 51 00', '27 52 00', '27 53 00']
  },
  'Elevation': {
    'Telecommunication': ['27 30 00', '27 50 00', '27 51 00', '27 52 00']
  },
  'Cutsheets / Basis of Design': {
    'Fire Protection': ['10 13 00', '10 21 00', '10 22 00', '10 23 00', '10 24 00', '10 25 00', '10 26 00', '10 27 00', '10 28 00'],
    'Mechanical': ['23 10 00', '23 20 00', '23 30 00', '23 40 00', '23 50 00', '23 60 00', '23 70 00', '23 73 00', '23 74 00', '23 80 00', '23 90 00'],
    'Electrical': ['26 10 00', '26 20 00', '26 24 00', '26 25 00', '26 26 00', '26 28 00', '26 30 00', '26 40 00', '26 50 00', '26 51 00', '26 52 00', '26 53 00', '26 54 00', '26 55 00', '26 56 00'],
    'Telecommunication': ['27 10 00', '27 20 00', '27 30 00', '27 40 00', '27 50 00', '27 51 00', '27 52 00', '27 53 00', '27 54 00', '27 55 00', '27 56 00']
  },
  'Reference': [],
  'Hazardous': ['07 17 00', '07 18 00', '07 19 00']
};

// Specification section titles
const specTitles = {
  '06 10 00': 'ROUGH CARPENTRY',
  '06 20 00': 'FINISH CARPENTRY',
  '07 17 00': 'THERMAL INSULATION',
  '07 18 00': 'MOISTURE PROTECTION',
  '07 19 00': 'WATERPROOFING',
  '08 11 00': 'METAL DOORS AND FRAMES',
  '08 20 00': 'WOOD AND PLASTIC DOORS',
  '08 40 00': 'ENTRANCE AND STOREFRONT DOORS',
  '08 50 00': 'WINDOWS',
  '08 80 00': 'GLAZING',
  '09 05 16': 'SUBSURFACE PREPARATION FOR FLOOR FINISHES',
  '09 22 16': 'NON-STRUCTURAL METAL FRAMING',
  '09 29 00': 'GYPSUM BOARD',
  '09 30 13': 'CERAMIC/PORCELAIN TILING',
  '09 35 00': 'RESILIENT FLOORING',
  '09 40 00': 'CARPETING',
  '09 50 00': 'SPECIAL FLOORING',
  '09 91 00': 'PAINTING',
  '10 11 00': 'NOTIFICATION AND DEMOLITION',
  '10 13 00': 'FIRE PROTECTION SYSTEMS',
  '10 14 00': 'SIGNAGE',
  '10 21 00': 'FIRE PUMPING SYSTEMS',
  '10 22 00': 'FIRE SUPPRESSION PIPING',
  '10 23 00': 'FIRE SUPPRESSION SPECIAL PIPING',
  '10 24 00': 'FIRE SUPPRESSION SPECIAL SYSTEMS',
  '10 25 00': 'FIRE SUPPRESSION WATER STORAGE',
  '10 26 00': 'FIRE DETECTION AND ALARM',
  '10 27 00': 'FIRE SUPPRESSION CONTROLS',
  '10 28 00': 'FIRE EXTINCTION EQUIPMENT',
  '22 10 00': 'PLUMBING FIXTURES',
  '22 13 00': 'DOMESTIC WATER PUMPING',
  '22 20 00': 'PLUMBING SPECIALTIES',
  '22 30 00': 'LABORATORY PLUMBING',
  '22 40 00': 'PLUMBING SPECIAL SYSTEMS',
  '22 50 00': 'FIRE PROTECTION PIPING',
  '22 60 00': 'PLUMBING SYSTEMS COORDINATION',
  '23 10 00': 'FUEL-FIRING SYSTEMS',
  '23 20 00': 'HVAC INSTRUMENTATION AND CONTROLS',
  '23 30 00': 'HVAC AIR DISTRIBUTION',
  '23 40 00': 'HVAC AIR CLEANING',
  '23 50 00': 'HVAC COOLING',
  '23 60 00': 'HVAC HEATING',
  '23 70 00': 'HVAC STEAM AND CONDENSATE',
  '23 73 00': 'HVAC INSULATION',
  '23 74 00': 'HVAC VIBRATION AND NOISE CONTROL',
  '23 80 00': 'FUEL SYSTEMS',
  '23 90 00': 'HVAC INTEGRATION',
  '26 10 00': 'MEDIUM VOLTAGE DISTRIBUTION',
  '26 20 00': 'LOW VOLTAGE DISTRIBUTION',
  '26 24 00': 'BUS DUCT SYSTEMS',
  '26 25 00': 'FIBER OPTIC CABLING',
  '26 26 00': 'ELECTRICAL IDENTIFICATION',
  '26 28 00': 'ELECTRICAL TESTING AND COMMISSIONING',
  '26 30 00': 'PROTECTIVE DEVICES AND SWITCHGEAR',
  '26 40 00': 'WIRING DEVICES',
  '26 50 00': 'LIGHTING',
  '26 51 00': 'EMERGENCY AND STANDBY POWER',
  '26 52 00': 'ELECTRICAL GROUNDING',
  '26 53 00': 'CATV AND MATV SYSTEMS',
  '26 54 00': 'TELEPHONE COMMUNICATIONS',
  '26 55 00': 'ELECTRONIC SECURITY',
  '26 56 00': 'SOUND AND VIDEO',
  '27 10 00': 'INFORMATION TRANSPORT INFRASTRUCTURE',
  '27 20 00': 'WIRELESS COMMUNICATIONS',
  '27 30 00': 'DATA COMMUNICATIONS',
  '27 40 00': 'DISTRIBUTED ANTENNA SYSTEMS',
  '27 50 00': 'SPECIAL SYSTEMS',
  '27 51 00': 'ACCESS CONTROL',
  '27 52 00': 'CCTV SURVEILLANCE',
  '27 53 00': 'INTRUSION DETECTION',
  '27 54 00': 'BADGING SYSTEMS',
  '27 55 00': 'NURSE CALL SYSTEMS',
  '27 56 00': 'PA AND VA SYSTEMS'
};

// Load drawing catalog
function loadDrawingCatalog() {
  const catalogPath = join(process.cwd(), 'project-data/bedford/drawing-catalogs/building-61.json');
  return JSON.parse(readFileSync(catalogPath, 'utf-8'));
}

// Get spec sections for a sheet based on drawing type and discipline
function getSpecsForSheet(sheet) {
  const typeSpecs = drawingTypeSpecs[sheet.drawingType];
  
  if (!typeSpecs) {
    // Unknown drawing type - return empty
    return [];
  }
  
  if (Array.isArray(typeSpecs)) {
    // Drawing type has a flat list of specs (independent of discipline)
    return typeSpecs;
  }
  
  // Drawing type has discipline-specific specs
  const disciplineSpecs = typeSpecs[sheet.discipline];
  return disciplineSpecs || [];
}

// Main discovery function
async function discoverRelationships() {
  console.log('Starting automatic specification relationship discovery for Building 61...');
  console.log('Note: This uses drawing type and discipline as evidence.');
  console.log('      True per-page text extraction will be added when infrastructure is available.\n');
  
  // Load drawing catalog
  const catalog = loadDrawingCatalog();
  console.log(`Loaded ${catalog.sheets.length} sheets from catalog`);
  
  // Discover relationships
  const results = {};
  let totalLinks = 0;
  let sheetsWithSpecs = 0;
  let sheetsWithZeroSpecs = 0;
  
  for (const sheet of catalog.sheets) {
    const specNumbers = getSpecsForSheet(sheet);
    
    // Build links
    const links = specNumbers.map((sectionNumber, index) => {
      const sectionTitle = specTitles[sectionNumber] || sectionNumber;
      return {
        linkId: `link-${sheet.pdfPageNumber}-${index + 1}`,
        createdAt: new Date().toISOString(),
        projectId: 'bedford',
        drawingDocumentId: 'bedford-specification-manual',
        drawingPageId: sheet.pageId,
        specificationDocumentId: 'bedford-specification-manual',
        sectionNumber,
        sectionTitle,
        origin: 'drawing-type-inference',
        status: 'inferred',
        confidence: 0.6,
        evidenceSource: 'Drawing type and discipline analysis',
        evidenceText: `Sheet ${sheet.sheetNumber} is a ${sheet.drawingType} in ${sheet.discipline} discipline`,
        reason: `Specification section ${sectionNumber} is typically referenced by ${sheet.drawingType} sheets in ${sheet.discipline} discipline`
      };
    });
    
    results[sheet.sheetNumber] = {
      success: true,
      pageId: sheet.pageId,
      discipline: sheet.discipline,
      drawingType: sheet.drawingType,
      populated: links.length,
      source: 'drawing-type-inference',
      links
    };
    
    totalLinks += links.length;
    if (links.length > 0) sheetsWithSpecs++;
    else sheetsWithZeroSpecs++;
    
    console.log(`Sheet ${sheet.sheetNumber} (${sheet.drawingType}, ${sheet.discipline}): ${links.length} spec references`);
  }
  
  // Generate output
  const output = {
    generated: new Date().toISOString(),
    projectId: 'bedford',
    source: 'drawing-type-inference',
    note: 'This mapping uses drawing type and discipline as evidence. True per-page text extraction will be added when infrastructure is available.',
    stats: {
      totalLinks,
      uniquePages: catalog.sheets.length,
      sheetsWithSpecs,
      sheetsWithZeroSpecs
    },
    results
  };
  
  // Write output
  const outputPath = join(process.cwd(), 'project-data/bedford/relationships/building-61-spec-links.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log('\n=== Discovery Complete ===');
  console.log(`Total sheets: ${catalog.sheets.length}`);
  console.log(`Sheets with specs: ${sheetsWithSpecs}`);
  console.log(`Sheets with zero specs: ${sheetsWithZeroSpecs}`);
  console.log(`Total spec links: ${totalLinks}`);
  console.log(`Output: ${outputPath}`);
  
  // Analyze uniqueness
  const specSets = new Map();
  for (const [sheetNumber, data] of Object.entries(results)) {
    const key = `${data.drawingType}:${data.discipline}:${data.links.map(l => l.sectionNumber).sort().join(',')}`;
    specSets.set(key, (specSets.get(key) || 0) + 1);
  }
  console.log(`\nUnique drawing-type+discipline combinations: ${specSets.size}`);
  
  // Show samples
  console.log('\n=== Sample Sheets ===');
  const sampleSheets = ['61IN101', '61A-511', '61A-512', '61A-531', '61FX001', '61FX100', '61FX101', '61M-101', '61E-101', '61T-101'];
  for (const sheetNumber of sampleSheets) {
    const data = results[sheetNumber];
    if (data) {
      console.log(`\n${sheetNumber} (${data.drawingType}, ${data.discipline}): ${data.links.length} specs`);
      data.links.forEach(link => {
        console.log(`  - ${link.sectionNumber} ${link.sectionTitle}`);
      });
    }
  }
}

// Run
discoverRelationships().catch(error => {
  console.error('Discovery failed:', error);
  process.exit(1);
});
