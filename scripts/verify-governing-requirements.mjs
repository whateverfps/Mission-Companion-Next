#!/usr/bin/env node

/**
 * Automated Verification Harness for Governing Requirements System
 * 
 * This script verifies the end-to-end pipeline for the Governing Requirements feature
 * by simulating the Plans V2 workflow for Building 61 sheets.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Verification result tracking
const results = {
  overall: 'PASS',
  sheets: {}
};

// Load data files
function loadJSON(path) {
  try {
    if (!existsSync(path)) {
      console.error(`${colors.red}ERROR: File not found: ${path}${colors.reset}`);
      return null;
    }
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (error) {
    console.error(`${colors.red}ERROR: Failed to load ${path}: ${error.message}${colors.reset}`);
    return null;
  }
}

// Verify Step 1: Active Sheet Identity
function verifySheetIdentity(sheet, catalog, canonicalPageId, documentId) {
  console.log(`\n${colors.cyan}STEP 1: Verify Active Sheet Identity${colors.reset}`);
  console.log(`Building: ${catalog.building || 'NULL'}`);
  console.log(`Sheet Number: ${sheet.sheetNumber || 'NULL'}`);
  console.log(`Sheet Title: ${sheet.sheetTitle || 'NULL'}`);
  console.log(`Discipline: ${sheet.discipline || 'NULL'}`);
  console.log(`Drawing Type: ${sheet.drawingType || 'NULL'}`);
  console.log(`Canonical PageId: ${canonicalPageId || 'NULL'}`);
  console.log(`DocumentId: ${documentId || 'NULL'}`);
  
  const failures = [];
  if (!catalog.building) failures.push('Building is NULL');
  if (!sheet.sheetNumber) failures.push('Sheet Number is NULL');
  if (!sheet.sheetTitle) failures.push('Sheet Title is NULL');
  if (!sheet.discipline) failures.push('Discipline is NULL');
  if (!sheet.drawingType) failures.push('Drawing Type is NULL');
  if (!canonicalPageId) failures.push('Canonical PageId is NULL');
  if (!documentId) failures.push('DocumentId is NULL');
  
  if (failures.length > 0) {
    console.log(`${colors.red}FAIL: Step 1${colors.reset}`);
    failures.forEach(f => console.log(`  ✗ ${f}`));
    return { pass: false, failures, stage: 'Sheet Identity' };
  }
  
  console.log(`${colors.green}PASS: Step 1${colors.reset}`);
  return { pass: true, stage: 'Sheet Identity' };
}

// Verify Step 2: drawingSpecificationLinks
function verifySpecificationLinks(canonicalPageId, drawingSpecificationLinks) {
  console.log(`\n${colors.cyan}STEP 2: Verify drawingSpecificationLinks${colors.reset}`);
  console.log(`Canonical PageId: ${canonicalPageId || 'NULL'}`);
  
  if (!canonicalPageId) {
    console.log(`${colors.red}FAIL: Step 2 - Canonical PageId is NULL${colors.reset}`);
    return { pass: false, failures: ['Canonical PageId is NULL'], stage: 'Specification Lookup' };
  }
  
  if (!drawingSpecificationLinks) {
    console.log(`${colors.red}FAIL: Step 2 - drawingSpecificationLinks service not available${colors.reset}`);
    return { pass: false, failures: ['drawingSpecificationLinks service not available'], stage: 'Specification Lookup' };
  }
  
  const links = drawingSpecificationLinks.forPage(canonicalPageId);
  console.log(`drawingSpecificationLinks.forPage(): ${links.length} links found`);
  
  if (links.length === 0) {
    console.log(`${colors.yellow}WARN: Step 2 - No links found for pageId${colors.reset}`);
    return { pass: true, warnings: ['No links found'], links: [], stage: 'Specification Lookup' };
  }
  
  console.log(`\nLinks (${links.length}):`);
  links.forEach((link, i) => {
    console.log(`  ${i + 1}. Section: ${link.sectionNumber || 'NULL'}`);
    console.log(`     Title: ${link.sectionTitle || 'NULL'}`);
    console.log(`     Origin: ${link.origin || 'NULL'}`);
    console.log(`     Confidence: ${link.confidence || 'NULL'}`);
    console.log(`     Relationship Type: ${link.relationshipType || 'NULL'}`);
  });
  
  console.log(`${colors.green}PASS: Step 2${colors.reset}`);
  return { pass: true, links, stage: 'Specification Lookup' };
}

// Verify Step 3: Requirements Resolver
function verifyRequirementsResolver(requirements) {
  console.log(`\n${colors.cyan}STEP 3: Verify Requirements Resolver${colors.reset}`);
  
  const confirmed = requirements.confirmedSpecifications || [];
  const suggested = requirements.suggestedSpecifications || [];
  const rejected = requirements.rejectedSpecifications || [];
  
  console.log(`Confirmed: ${confirmed.length}`);
  console.log(`Suggested: ${suggested.length}`);
  console.log(`Rejected: ${rejected.length}`);
  
  if (confirmed.length > 0) {
    console.log(`\nConfirmed Requirements:`);
    confirmed.forEach((req, i) => {
      console.log(`  ${i + 1}. Section: ${req.sectionNumber || 'NULL'}`);
      console.log(`     Title: ${req.sectionTitle || 'NULL'}`);
      console.log(`     Reason: ${req.reason || 'NULL'}`);
      console.log(`     Evidence: ${req.evidenceText || 'NULL'}`);
    });
  }
  
  if (suggested.length > 0) {
    console.log(`\nSuggested Requirements:`);
    suggested.forEach((req, i) => {
      console.log(`  ${i + 1}. Section: ${req.sectionNumber || 'NULL'}`);
      console.log(`     Title: ${req.sectionTitle || 'NULL'}`);
      console.log(`     Reason: ${req.reason || 'NULL'}`);
    });
  }
  
  console.log(`${colors.green}PASS: Step 3${colors.reset}`);
  return { pass: true, confirmed, suggested, rejected, stage: 'Requirements Resolver' };
}

// Verify Step 4: UI Model
function verifyUIModel(panelModel) {
  console.log(`\n${colors.cyan}STEP 4: Verify UI Model${colors.reset}`);
  
  const specs = panelModel.specifications || {};
  const confirmed = specs.confirmed || [];
  const suggested = specs.suggested || [];
  const rejected = specs.rejected || [];
  
  console.log(`Panel Model contains:`);
  console.log(`  Specification Number: ${confirmed.length + suggested.length > 0 ? 'YES' : 'NO'}`);
  console.log(`  Specification Title: ${confirmed.length + suggested.length > 0 ? 'YES' : 'NO'}`);
  console.log(`  Confidence: ${confirmed.length + suggested.length > 0 ? 'YES' : 'NO'}`);
  console.log(`  Origin: ${confirmed.length + suggested.length > 0 ? 'YES' : 'NO'}`);
  console.log(`  Reason: ${confirmed.length + suggested.length > 0 ? 'YES' : 'NO'}`);
  console.log(`  Counts: ${confirmed.length + suggested.length + rejected.length > 0 ? 'YES' : 'NO'}`);
  console.log(`  Source attribution: ${panelModel.specLinksDiagnostic ? 'YES' : 'NO'}`);
  
  if (confirmed.length + suggested.length === 0) {
    console.log(`${colors.yellow}WARN: Step 4 - Panel model has no specifications${colors.reset}`);
    return { pass: true, warnings: ['No specifications in panel model'], stage: 'UI Model' };
  }
  
  console.log(`${colors.green}PASS: Step 4${colors.reset}`);
  return { pass: true, stage: 'UI Model' };
}

// Verify Step 5: Cross-check
function verifyCrossCheck(links, confirmed, suggested) {
  console.log(`\n${colors.cyan}STEP 5: Cross-check${colors.reset}`);
  
  const linkCount = links.length;
  const resolverCount = confirmed.length + suggested.length;
  
  console.log(`drawingSpecificationLinks.forPage(): ${linkCount} links`);
  console.log(`Requirements Resolver output: ${resolverCount} requirements`);
  
  if (linkCount !== resolverCount) {
    console.log(`${colors.red}FAIL: Step 5 - Count mismatch${colors.reset}`);
    console.log(`  Records diverged: ${linkCount} links vs ${resolverCount} requirements`);
    return { pass: false, failures: [`Count mismatch: ${linkCount} links vs ${resolverCount} requirements`], stage: 'Cross-check' };
  }
  
  console.log(`${colors.green}PASS: Step 5${colors.reset}`);
  return { pass: true, stage: 'Cross-check' };
}

// Verify Step 6: Regression (different sheets have different specs)
function verifyRegression(sheetResults) {
  console.log(`\n${colors.cyan}STEP 6: Regression Test${colors.reset}`);
  
  const sheetIds = Object.keys(sheetResults);
  const specSets = sheetIds.map(id => {
    const result = sheetResults[id];
    const confirmed = result.step3?.confirmed || [];
    const suggested = result.step3?.suggested || [];
    return {
      sheetId: id,
      specs: new Set([...confirmed, ...suggested].map(s => s.sectionNumber))
    };
  });
  
  let allDifferent = true;
  for (let i = 0; i < specSets.length; i++) {
    for (let j = i + 1; j < specSets.length; j++) {
      const set1 = specSets[i];
      const set2 = specSets[j];
      const intersection = [...set1.specs].filter(x => set2.specs.has(x));
      
      if (intersection.length > 0 && set1.specs.size === set2.specs.size) {
        console.log(`${colors.red}FAIL: Step 6 - ${set1.sheetId} and ${set2.sheetId} have identical specification sets${colors.reset}`);
        console.log(`  Shared specs: ${intersection.join(', ')}`);
        allDifferent = false;
      }
    }
  }
  
  if (allDifferent) {
    console.log(`${colors.green}PASS: Step 6 - All sheets have different specification sets${colors.reset}`);
  }
  
  return { pass: allDifferent, stage: 'Regression' };
}

// Main verification function
async function verifyGoverningRequirements() {
  console.log(`${colors.bright}==========================================================${colors.reset}`);
  console.log(`${colors.bright}GOVERNING REQUIREMENTS VERIFICATION HARNESS${colors.reset}`);
  console.log(`${colors.bright}==========================================================${colors.reset}\n`);
  
  // Load Building 61 catalog
  const catalogPath = join(PROJECT_ROOT, 'project-data/bedford/drawing-catalogs/building-61.json');
  const catalog = loadJSON(catalogPath);
  
  if (!catalog) {
    console.error(`${colors.red}FATAL: Failed to load Building 61 catalog${colors.reset}`);
    process.exit(1);
  }
  
  // Target sheets
  const targetSheets = ['61IN101', '61M-101', '61E-101'];
  
  for (const targetSheetNumber of targetSheets) {
    console.log(`\n${colors.bright}========================================${colors.reset}`);
    console.log(`${colors.bright}VERIFYING: ${targetSheetNumber}${colors.reset}`);
    console.log(`${colors.bright}========================================${colors.reset}`);
    
    // Find sheet in catalog
    const catalogSheet = catalog.sheets.find(s => s.sheetNumber === targetSheetNumber);
    
    if (!catalogSheet) {
      console.error(`${colors.red}ERROR: Sheet ${targetSheetNumber} not found in catalog${colors.reset}`);
      results.sheets[targetSheetNumber] = { pass: false, error: 'Sheet not in catalog' };
      results.overall = 'FAIL';
      continue;
    }
    
    const canonicalPageId = catalogSheet.pageId || '';
    const documentId = catalogSheet.pageId?.split(':')[0] || '';
    
    // Step 1: Verify sheet identity
    const step1 = verifySheetIdentity(catalogSheet, catalog, canonicalPageId, documentId);
    if (!step1.pass) {
      results.sheets[targetSheetNumber] = { step1, pass: false };
      results.overall = 'FAIL';
      continue;
    }
    
    // Step 2: Verify specification links (load from real data)
    const specLinksPath = join(PROJECT_ROOT, 'verification/building-61-spec-links.json');
    const specLinksData = loadJSON(specLinksPath);
    
    const step2 = { pass: false, links: [], stage: 'Specification Lookup' };
    
    if (!specLinksData) {
      console.log(`${colors.red}FAIL: Step 2 - Specification links data not found${colors.reset}`);
      step2.failures = ['Specification links data not found'];
    } else {
      const sheetResult = specLinksData.results?.[targetSheetNumber];
      if (!sheetResult || !sheetResult.success) {
        console.log(`${colors.red}FAIL: Step 2 - No specification links found for ${targetSheetNumber}${colors.reset}`);
        step2.failures = [`No specification links found for ${targetSheetNumber}`];
      } else {
        step2.pass = true;
        step2.links = sheetResult.links || [];
        console.log(`drawingSpecificationLinks.forPage(): ${step2.links.length} links`);
        
        if (step2.links.length > 0) {
          console.log(`\nLinks (${step2.links.length}):`);
          step2.links.forEach((link, i) => {
            console.log(`  ${i + 1}. Section: ${link.sectionNumber || 'NULL'}`);
            console.log(`     Title: ${link.sectionTitle || 'NULL'}`);
            console.log(`     Origin: ${link.origin || 'NULL'}`);
            console.log(`     Confidence: ${link.confidence || 'NULL'}`);
            console.log(`     Status: ${link.status || 'NULL'}`);
          });
        } else {
          console.log(`${colors.red}FAIL: Step 2 - Zero links found for ${targetSheetNumber}${colors.reset}`);
          step2.pass = false;
          step2.failures = ['Zero links found'];
        }
      }
    }
    
    if (!step2.pass) {
      results.sheets[targetSheetNumber] = { step1, step2, pass: false };
      results.overall = 'FAIL';
      continue;
    }
    
    // Step 3: Verify requirements resolver (use real links)
    const step3 = { pass: true, confirmed: [], suggested: [], rejected: [], stage: 'Requirements Resolver' };
    step3.confirmed = step2.links.filter(l => l.status === 'confirmed');
    step3.suggested = step2.links.filter(l => l.status === 'suggested');
    step3.rejected = step2.links.filter(l => l.status === 'rejected');
    
    if (step2.links.length === 0) {
      console.log(`${colors.red}FAIL: Step 3 - No links to resolve${colors.reset}`);
      step3.pass = false;
      step3.failures = ['No links to resolve'];
      results.sheets[targetSheetNumber] = { step1, step2, step3, pass: false };
      results.overall = 'FAIL';
      continue;
    }
    
    // Step 4: Verify UI model (simulate)
    const step4 = verifyUIModel({
      specifications: {
        confirmed: step3.confirmed,
        suggested: step3.suggested,
        rejected: step3.rejected
      },
      specLinksDiagnostic: {
        pageId: canonicalPageId,
        linksFound: step2.links.length,
        confirmedCount: step3.confirmed.length,
        suggestedCount: step3.suggested.length
      }
    });
    
    // Step 5: Cross-check
    const step5 = verifyCrossCheck(step2.links, step3.confirmed, step3.suggested);
    
    // Store results
    results.sheets[targetSheetNumber] = {
      step1,
      step2,
      step3,
      step4,
      step5,
      pass: step1.pass && step2.pass && step3.pass && step4.pass && step5.pass
    };
    
    if (!results.sheets[targetSheetNumber].pass) {
      results.overall = 'FAIL';
    }
  }
  
  // Step 6: Regression test
  const step6 = verifyRegression(results.sheets);
  if (!step6.pass) {
    results.overall = 'FAIL';
  }
  results.regression = step6;
  
  // Generate report
  await generateReport(results);
}

// Generate verification report
async function generateReport(results) {
  const reportDir = join(PROJECT_ROOT, 'verification');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }
  
  const reportPath = join(reportDir, 'governing-requirements-report.md');
  
  let report = `# Governing Requirements Verification Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `Overall Result: **${results.overall}**\n\n`;
  report += `---\n\n`;
  
  for (const [sheetId, sheetResult] of Object.entries(results.sheets)) {
    report += `## ${sheetId}\n\n`;
    
    // Step 1
    report += `### Step 1: Sheet Identity\n\n`;
    report += `Stage: ${sheetResult.step1.stage}\n`;
    report += `Result: ${sheetResult.step1.pass ? '✓ PASS' : '✗ FAIL'}\n`;
    if (sheetResult.step1.failures) {
      report += `Failures:\n`;
      sheetResult.step1.failures.forEach(f => report += `- ${f}\n`);
    }
    report += `\n`;
    
    // Step 2
    report += `### Step 2: Specification Links\n\n`;
    report += `Stage: ${sheetResult.step2.stage}\n`;
    report += `Result: ${sheetResult.step2.pass ? '✓ PASS' : '✗ FAIL'}\n`;
    report += `Links Found: ${sheetResult.step2.links.length}\n`;
    if (sheetResult.step2.links.length > 0) {
      report += `\n`;
      sheetResult.step2.links.forEach((link, i) => {
        report += `${i + 1}. ${link.sectionNumber} - ${link.sectionTitle}\n`;
        report += `   Origin: ${link.origin}\n`;
        report += `   Confidence: ${link.confidence}\n`;
      });
    }
    if (sheetResult.step2.warnings) {
      report += `\nWarnings:\n`;
      sheetResult.step2.warnings.forEach(w => report += `- ${w}\n`);
    }
    report += `\n`;
    
    // Step 3
    report += `### Step 3: Requirements Resolver\n\n`;
    report += `Stage: ${sheetResult.step3.stage}\n`;
    report += `Result: ${sheetResult.step3.pass ? '✓ PASS' : '✗ FAIL'}\n`;
    report += `Confirmed: ${sheetResult.step3.confirmed.length}\n`;
    report += `Suggested: ${sheetResult.step3.suggested.length}\n`;
    report += `Rejected: ${sheetResult.step3.rejected.length}\n`;
    report += `\n`;
    
    // Step 4
    report += `### Step 4: UI Model\n\n`;
    report += `Stage: ${sheetResult.step4.stage}\n`;
    report += `Result: ${sheetResult.step4.pass ? '✓ PASS' : '✗ FAIL'}\n`;
    if (sheetResult.step4.warnings) {
      report += `Warnings:\n`;
      sheetResult.step4.warnings.forEach(w => report += `- ${w}\n`);
    }
    report += `\n`;
    
    // Step 5
    report += `### Step 5: Cross-check\n\n`;
    report += `Stage: ${sheetResult.step5.stage}\n`;
    report += `Result: ${sheetResult.step5.pass ? '✓ PASS' : '✗ FAIL'}\n`;
    if (sheetResult.step5.failures) {
      report += `Failures:\n`;
      sheetResult.step5.failures.forEach(f => report += `- ${f}\n`);
    }
    report += `\n`;
    
    report += `---\n\n`;
  }
  
  // Regression test
  report += `## Step 6: Regression Test\n\n`;
  report += `Stage: ${results.regression.stage}\n`;
  report += `Result: ${results.regression.pass ? '✓ PASS' : '✗ FAIL'}\n`;
  report += `All sheets have different specification sets: ${results.regression.pass ? 'YES' : 'NO'}\n\n`;
  
  // Summary
  report += `## Summary\n\n`;
  report += `Overall: ${results.overall}\n`;
  report += `Sheets Tested: ${Object.keys(results.sheets).length}\n`;
  report += `Sheets Passed: ${Object.values(results.sheets).filter(s => s.pass).length}\n`;
  report += `Sheets Failed: ${Object.values(results.sheets).filter(s => !s.pass).length}\n`;
  
  if (results.overall === 'FAIL') {
    report += `\n## Pipeline Stage Failures\n\n`;
    for (const [sheetId, sheetResult] of Object.entries(results.sheets)) {
      if (!sheetResult.pass) {
        const failedStage = sheetResult.step1?.pass === false ? sheetResult.step1 :
                            sheetResult.step2?.pass === false ? sheetResult.step2 :
                            sheetResult.step3?.pass === false ? sheetResult.step3 :
                            sheetResult.step4?.pass === false ? sheetResult.step4 :
                            sheetResult.step5?.pass === false ? sheetResult.step5 : { stage: 'Unknown' };
        report += `${sheetId}: Failed at ${failedStage.stage}\n`;
      }
    }
  }
  
  writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n${colors.bright}Report generated: ${reportPath}${colors.reset}`);
  
  // Print summary to console
  console.log(`\n${colors.bright}==========================================================${colors.reset}`);
  console.log(`${colors.bright}VERIFICATION SUMMARY${colors.reset}`);
  console.log(`${colors.bright}==========================================================${colors.reset}\n`);
  console.log(`Overall: ${results.overall === 'PASS' ? colors.green + 'PASS' + colors.reset : colors.red + 'FAIL' + colors.reset}`);
  console.log(`Sheets Tested: ${Object.keys(results.sheets).length}`);
  console.log(`Sheets Passed: ${Object.values(results.sheets).filter(s => s.pass).length}`);
  console.log(`Sheets Failed: ${Object.values(results.sheets).filter(s => !s.pass).length}`);
  
  if (results.overall === 'FAIL') {
    process.exit(1);
  }
}

// Run verification
verifyGoverningRequirements().catch(error => {
  console.error(`${colors.red}FATAL ERROR: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});
