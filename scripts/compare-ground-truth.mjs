import { SpecificationSearchEngine } from '../src/specification-search.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function compareGroundTruth() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  const groundTruthPath = path.join(__dirname, '../ground-truth-sections.json');
  
  console.log('Loading ground truth...');
  const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));
  
  console.log('Loading SpecificationIndex...');
  const searchEngine = new SpecificationSearchEngine();
  await searchEngine.loadPdf(pdfPath);
  const specIndex = searchEngine.specIndex.getAllSections();
  
  console.log(`Ground truth sections: ${groundTruth.length}`);
  console.log(`SpecificationIndex sections: ${specIndex.length}`);
  
  // Build maps for comparison
  const groundTruthMap = new Map();
  for (const section of groundTruth) {
    groundTruthMap.set(section.sectionNumber, section);
  }
  
  const specIndexMap = new Map();
  for (const section of specIndex) {
    specIndexMap.set(section.sectionNumber, section);
  }
  
  // Find missing sections (in ground truth but not in spec index)
  const missingSections = [];
  for (const section of groundTruth) {
    if (!specIndexMap.has(section.sectionNumber)) {
      missingSections.push(section);
    }
  }
  
  // Find extra sections (in spec index but not in ground truth)
  const extraSections = [];
  for (const section of specIndex) {
    if (!groundTruthMap.has(section.sectionNumber)) {
      extraSections.push(section);
    }
  }
  
  // Find sections with incorrect data
  const incorrectTitles = [];
  const incorrectStartPages = [];
  const incorrectEndPages = [];
  
  for (const section of specIndex) {
    const gt = groundTruthMap.get(section.sectionNumber);
    if (gt) {
      // Compare titles (case-insensitive, normalize whitespace)
      const normalizeTitle = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase();
      if (normalizeTitle(section.title) !== normalizeTitle(gt.title)) {
        incorrectTitles.push({
          sectionNumber: section.sectionNumber,
          specIndexTitle: section.title,
          groundTruthTitle: gt.title
        });
      }
      
      // Compare start pages
      if (section.startPage !== gt.pdfPage) {
        incorrectStartPages.push({
          sectionNumber: section.sectionNumber,
          specIndexStart: section.startPage,
          groundTruthStart: gt.pdfPage
        });
      }
      
      // Compare end pages (calculate from ground truth)
      const gtIndex = groundTruth.findIndex(s => s.sectionNumber === section.sectionNumber);
      const gtNext = gtIndex < groundTruth.length - 1 ? groundTruth[gtIndex + 1] : null;
      const gtEndPage = gtNext ? gtNext.pdfPage - 1 : 2363; // Total pages from PDF
      
      if (section.endPage !== gtEndPage) {
        incorrectEndPages.push({
          sectionNumber: section.sectionNumber,
          specIndexEnd: section.endPage,
          groundTruthEnd: gtEndPage
        });
      }
    }
  }
  
  // Check ordering
  const incorrectOrdering = [];
  for (let i = 1; i < specIndex.length; i++) {
    const prev = specIndex[i - 1];
    const curr = specIndex[i];
    
    const gtPrev = groundTruthMap.get(prev.sectionNumber);
    const gtCurr = groundTruthMap.get(curr.sectionNumber);
    
    if (gtPrev && gtCurr) {
      const gtPrevIndex = groundTruth.findIndex(s => s.sectionNumber === prev.sectionNumber);
      const gtCurrIndex = groundTruth.findIndex(s => s.sectionNumber === curr.sectionNumber);
      
      if (gtPrevIndex > gtCurrIndex) {
        incorrectOrdering.push({
          sectionNumber: curr.sectionNumber,
          previousSection: prev.sectionNumber,
          issue: 'Appears before previous section in ground truth'
        });
      }
    }
  }
  
  // Generate report
  const reportPath = path.join(__dirname, '../ground-truth-comparison.md');
  
  let markdown = '# Ground Truth Comparison Report\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  
  markdown += '## Summary\n\n';
  markdown += `- **Ground truth sections:** ${groundTruth.length}\n`;
  markdown += `- **SpecificationIndex sections:** ${specIndex.length}\n`;
  markdown += `- **Missing sections (in GT, not in Index):** ${missingSections.length}\n`;
  markdown += `- **Extra sections (in Index, not in GT):** ${extraSections.length}\n`;
  markdown += `- **Incorrect titles:** ${incorrectTitles.length}\n`;
  markdown += `- **Incorrect start pages:** ${incorrectStartPages.length}\n`;
  markdown += `- **Incorrect end pages:** ${incorrectEndPages.length}\n`;
  markdown += `- **Incorrect ordering:** ${incorrectOrdering.length}\n\n`;
  
  // Coverage
  const coverage = (specIndex.length / groundTruth.length * 100).toFixed(1);
  markdown += `## Coverage\n\n**${coverage}%** of ground truth sections indexed\n\n`;
  
  // Missing sections
  if (missingSections.length > 0) {
    markdown += '## Missing Sections\n\n';
    markdown += 'These sections exist in the ground truth but are missing from the SpecificationIndex:\n\n';
    markdown += '| Section | Title | Page |\n';
    markdown += '|---------|-------|------|\n';
    for (const section of missingSections.slice(0, 50)) {
      markdown += `| ${section.sectionNumber} | ${section.title.substring(0, 50)}${section.title.length > 50 ? '...' : ''} | ${section.pdfPage} |\n`;
    }
    if (missingSections.length > 50) {
      markdown += `| ... | (${missingSections.length - 50} more) | ... |\n`;
    }
    markdown += '\n';
  }
  
  // Extra sections
  if (extraSections.length > 0) {
    markdown += '## Extra Sections\n\n';
    markdown += 'These sections exist in the SpecificationIndex but are not in the ground truth:\n\n';
    markdown += '| Section | Title | Start Page |\n';
    markdown += '|---------|-------|------------|\n';
    for (const section of extraSections.slice(0, 50)) {
      markdown += `| ${section.sectionNumber} | ${section.title.substring(0, 50)}${section.title.length > 50 ? '...' : ''} | ${section.startPage} |\n`;
    }
    if (extraSections.length > 50) {
      markdown += `| ... | (${extraSections.length - 50} more) | ... |\n`;
    }
    markdown += '\n';
  }
  
  // Incorrect titles
  if (incorrectTitles.length > 0) {
    markdown += '## Incorrect Titles\n\n';
    markdown += '| Section | SpecificationIndex Title | Ground Truth Title |\n';
    markdown += '|---------|----------------------|-------------------|\n';
    for (const item of incorrectTitles.slice(0, 50)) {
      markdown += `| ${item.sectionNumber} | ${item.specIndexTitle.substring(0, 40)}... | ${item.groundTruthTitle.substring(0, 40)}... |\n`;
    }
    if (incorrectTitles.length > 50) {
      markdown += `| ... | (${incorrectTitles.length - 50} more) | ... |\n`;
    }
    markdown += '\n';
  }
  
  // Incorrect start pages
  if (incorrectStartPages.length > 0) {
    markdown += '## Incorrect Start Pages\n\n';
    markdown += '| Section | SpecificationIndex Start | Ground Truth Start |\n';
    markdown += '|---------|---------------------|------------------|\n';
    for (const item of incorrectStartPages.slice(0, 50)) {
      markdown += `| ${item.sectionNumber} | ${item.specIndexStart} | ${item.groundTruthStart} |\n`;
    }
    if (incorrectStartPages.length > 50) {
      markdown += `| ... | (${incorrectStartPages.length - 50} more) | ... |\n`;
    }
    markdown += '\n';
  }
  
  // Incorrect end pages
  if (incorrectEndPages.length > 0) {
    markdown += '## Incorrect End Pages\n\n';
    markdown += '| Section | SpecificationIndex End | Ground Truth End |\n';
    markdown += '|---------|-------------------|------------------|\n';
    for (const item of incorrectEndPages.slice(0, 50)) {
      markdown += `| ${item.sectionNumber} | ${item.specIndexEnd} | ${item.groundTruthEnd} |\n`;
    }
    if (incorrectEndPages.length > 50) {
      markdown += `| ... | (${incorrectEndPages.length - 50} more) | ... |\n`;
    }
    markdown += '\n';
  }
  
  // Incorrect ordering
  if (incorrectOrdering.length > 0) {
    markdown += '## Incorrect Ordering\n\n';
    markdown += '| Section | Issue |\n';
    markdown += '|---------|-------|\n';
    for (const item of incorrectOrdering.slice(0, 50)) {
      markdown += `| ${item.sectionNumber} | ${item.issue} |\n`;
    }
    if (incorrectOrdering.length > 50) {
      markdown += `| ... | (${incorrectOrdering.length - 50} more) |\n`;
    }
    markdown += '\n';
  }
  
  // Target sections verification
  markdown += '## Target Sections Verification\n\n';
  const targetSections = ['01 32 16.15', '01 33 23', '01 45 00', '01 45 35', '01 91 00', '07 84 00', '09 91 00'];
  
  for (const target of targetSections) {
    const gt = groundTruthMap.get(target);
    const spec = specIndexMap.get(target);
    
    markdown += `### ${target}\n\n`;
    if (gt) {
      markdown += `**Ground Truth:** Page ${gt.pdfPage}, Title: "${gt.title}"\n\n`;
    } else {
      markdown += `**Ground Truth:** NOT FOUND\n\n`;
    }
    
    if (spec) {
      markdown += `**SpecificationIndex:** Page ${spec.startPage}-${spec.endPage}, Title: "${spec.title}"\n\n`;
    } else {
      markdown += `**SpecificationIndex:** NOT FOUND\n\n`;
    }
    
    if (gt && spec) {
      const titleMatch = gt.title.trim().replace(/\s+/g, ' ').toLowerCase() === spec.title.trim().replace(/\s+/g, ' ').toLowerCase();
      const pageMatch = spec.startPage === gt.pdfPage;
      
      if (titleMatch && pageMatch) {
        markdown += `✅ **MATCH**\n\n`;
      } else {
        markdown += `❌ **MISMATCH**\n\n`;
      }
    }
  }
  
  fs.writeFileSync(reportPath, markdown);
  console.log(`\nComparison report written to: ${reportPath}`);
  
  // Print summary
  console.log('\n=== COMPARISON SUMMARY ===');
  console.log(`Ground truth sections: ${groundTruth.length}`);
  console.log(`SpecificationIndex sections: ${specIndex.length}`);
  console.log(`Coverage: ${coverage}%`);
  console.log(`Missing sections: ${missingSections.length}`);
  console.log(`Extra sections: ${extraSections.length}`);
  console.log(`Incorrect titles: ${incorrectTitles.length}`);
  console.log(`Incorrect start pages: ${incorrectStartPages.length}`);
  console.log(`Incorrect end pages: ${incorrectEndPages.length}`);
  console.log(`Incorrect ordering: ${incorrectOrdering.length}`);
}

compareGroundTruth().catch(console.error);
