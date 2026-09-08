import { SpecificationSearchEngine } from '../src/specification-search.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function compareCanonicalIndex() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  const canonicalIndexPath = path.join(__dirname, '../bedford-specification-index.json');
  const reportPath = path.join(__dirname, '../layout-validation.md');
  
  console.log('Loading canonical index...');
  const canonicalIndex = JSON.parse(fs.readFileSync(canonicalIndexPath, 'utf-8'));
  
  console.log('Loading SpecificationIndex...');
  const searchEngine = new SpecificationSearchEngine();
  await searchEngine.loadPdf(pdfPath);
  const specIndex = searchEngine.specIndex.getAllSections();
  
  console.log(`Canonical index sections: ${canonicalIndex.length}`);
  console.log(`SpecificationIndex sections: ${specIndex.length}`);
  
  // Build maps for comparison
  const canonicalMap = new Map();
  for (const section of canonicalIndex) {
    canonicalMap.set(section.sectionNumber, section);
  }
  
  const specIndexMap = new Map();
  for (const section of specIndex) {
    specIndexMap.set(section.sectionNumber, section);
  }
  
  // Find missing sections (in canonical but not in spec index)
  const missingSections = [];
  for (const section of canonicalIndex) {
    if (!specIndexMap.has(section.sectionNumber)) {
      missingSections.push(section);
    }
  }
  
  // Find extra sections (in spec index but not in canonical)
  const extraSections = [];
  for (const section of specIndex) {
    if (!canonicalMap.has(section.sectionNumber)) {
      extraSections.push(section);
    }
  }
  
  // Find sections with incorrect data
  const incorrectTitles = [];
  const incorrectStartPages = [];
  const incorrectEndPages = [];
  
  for (const section of specIndex) {
    const canonical = canonicalMap.get(section.sectionNumber);
    if (canonical) {
      // Compare titles (case-insensitive, normalize whitespace)
      const normalizeTitle = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase();
      if (normalizeTitle(section.title) !== normalizeTitle(canonical.title)) {
        incorrectTitles.push({
          sectionNumber: section.sectionNumber,
          specIndexTitle: section.title,
          canonicalTitle: canonical.title
        });
      }
      
      // Compare start pages
      if (section.startPage !== canonical.startPage) {
        incorrectStartPages.push({
          sectionNumber: section.sectionNumber,
          specIndexStart: section.startPage,
          canonicalStart: canonical.startPage
        });
      }
      
      // Compare end pages
      if (section.endPage !== canonical.endPage) {
        incorrectEndPages.push({
          sectionNumber: section.sectionNumber,
          specIndexEnd: section.endPage,
          canonicalEnd: canonical.endPage
        });
      }
    }
  }
  
  // Check ordering
  const incorrectOrdering = [];
  for (let i = 1; i < specIndex.length; i++) {
    const prev = specIndex[i - 1];
    const curr = specIndex[i];
    
    const canonicalPrev = canonicalMap.get(prev.sectionNumber);
    const canonicalCurr = canonicalMap.get(curr.sectionNumber);
    
    if (canonicalPrev && canonicalCurr) {
      const canonicalPrevIndex = canonicalIndex.findIndex(s => s.sectionNumber === prev.sectionNumber);
      const canonicalCurrIndex = canonicalIndex.findIndex(s => s.sectionNumber === curr.sectionNumber);
      
      if (canonicalPrevIndex > canonicalCurrIndex) {
        incorrectOrdering.push({
          sectionNumber: curr.sectionNumber,
          previousSection: prev.sectionNumber,
          issue: 'Appears before previous section in canonical index'
        });
      }
    }
  }
  
  // Calculate confidence for each mismatch
  const mismatchesWithConfidence = [];
  
  for (const section of specIndex) {
    const canonical = canonicalMap.get(section.sectionNumber);
    if (canonical) {
      let issues = [];
      let confidence = 1.0;
      
      if (section.startPage !== canonical.startPage) {
        issues.push('Start page mismatch');
        confidence -= 0.3;
      }
      
      if (section.endPage !== canonical.endPage) {
        issues.push('End page mismatch');
        confidence -= 0.3;
      }
      
      const normalizeTitle = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase();
      if (normalizeTitle(section.title) !== normalizeTitle(canonical.title)) {
        issues.push('Title mismatch');
        confidence -= 0.2;
      }
      
      if (issues.length > 0) {
        mismatchesWithConfidence.push({
          sectionNumber: section.sectionNumber,
          issues,
          confidence: Math.max(0, confidence),
          specIndex: section,
          canonical
        });
      }
    }
  }
  
  // Generate report
  let markdown = '# Layout Validation Report\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  
  markdown += '## Summary\n\n';
  markdown += `- **Canonical index sections:** ${canonicalIndex.length}\n`;
  markdown += `- **SpecificationIndex sections:** ${specIndex.length}\n`;
  markdown += `- **Missing sections (in Canonical, not in Index):** ${missingSections.length}\n`;
  markdown += `- **Extra sections (in Index, not in Canonical):** ${extraSections.length}\n`;
  markdown += `- **Incorrect titles:** ${incorrectTitles.length}\n`;
  markdown += `- **Incorrect start pages:** ${incorrectStartPages.length}\n`;
  markdown += `- **Incorrect end pages:** ${incorrectEndPages.length}\n`;
  markdown += `- **Incorrect ordering:** ${incorrectOrdering.length}\n\n`;
  
  // Overall confidence
  const matchedSections = canonicalIndex.length - missingSections.length;
  const accuracy = (matchedSections / canonicalIndex.length * 100).toFixed(1);
  markdown += `## Overall Accuracy\n\n**${accuracy}%** of canonical sections matched by SpecificationIndex\n\n`;
  
  // Missing sections
  if (missingSections.length > 0) {
    markdown += '## Missing Sections\n\n';
    markdown += 'These sections exist in the canonical index but are missing from the SpecificationIndex:\n\n';
    markdown += '| Section | Title | Start Page | End Page |\n';
    markdown += '|---------|-------|------------|----------|\n';
    for (const section of missingSections) {
      markdown += `| ${section.sectionNumber} | ${section.title.substring(0, 50)}${section.title.length > 50 ? '...' : ''} | ${section.startPage} | ${section.endPage} |\n`;
    }
    markdown += '\n';
  }
  
  // Extra sections
  if (extraSections.length > 0) {
    markdown += '## Extra Sections\n\n';
    markdown += 'These sections exist in the SpecificationIndex but are not in the canonical index:\n\n';
    markdown += '| Section | Title | Start Page | End Page |\n';
    markdown += '|---------|-------|------------|----------|\n';
    for (const section of extraSections) {
      markdown += `| ${section.sectionNumber} | ${section.title.substring(0, 50)}${section.title.length > 50 ? '...' : ''} | ${section.startPage} | ${section.endPage} |\n`;
    }
    markdown += '\n';
  }
  
  // Mismatches with confidence
  if (mismatchesWithConfidence.length > 0) {
    markdown += '## Mismatches with Confidence\n\n';
    markdown += '| Section | Issues | Confidence | SpecIndex | Canonical |\n';
    markdown += '|---------|--------|------------|-----------|----------|\n';
    for (const mismatch of mismatchesWithConfidence) {
      markdown += `| ${mismatch.sectionNumber} | ${mismatch.issues.join(', ')} | ${(mismatch.confidence * 100).toFixed(0)}% | Page ${mismatch.specIndex.startPage}-${mismatch.specIndex.endPage} | Page ${mismatch.canonical.startPage}-${mismatch.canonical.endPage} |\n`;
    }
    markdown += '\n';
  }
  
  // Target sections verification
  markdown += '## Target Sections Verification\n\n';
  const targetSections = ['01 32 16.15', '01 33 23', '01 45 00', '01 45 35', '01 91 00', '07 84 00', '09 91 00'];
  
  for (const target of targetSections) {
    const canonical = canonicalMap.get(target);
    const spec = specIndexMap.get(target);
    
    markdown += `### ${target}\n\n`;
    if (canonical) {
      markdown += `**Canonical:** Page ${canonical.startPage}-${canonical.endPage}, Title: "${canonical.title}"\n\n`;
    } else {
      markdown += `**Canonical:** NOT FOUND\n\n`;
    }
    
    if (spec) {
      markdown += `**SpecificationIndex:** Page ${spec.startPage}-${spec.endPage}, Title: "${spec.title}"\n\n`;
    } else {
      markdown += `**SpecificationIndex:** NOT FOUND\n\n`;
    }
    
    if (canonical && spec) {
      const titleMatch = canonical.title.trim().replace(/\s+/g, ' ').toLowerCase() === spec.title.trim().replace(/\s+/g, ' ').toLowerCase();
      const pageMatch = spec.startPage === canonical.startPage && spec.endPage === canonical.endPage;
      
      if (titleMatch && pageMatch) {
        markdown += `✅ **MATCH**\n\n`;
      } else {
        markdown += `❌ **MISMATCH**\n\n`;
      }
    }
  }
  
  fs.writeFileSync(reportPath, markdown);
  console.log(`\nValidation report written to: ${reportPath}`);
  
  // Print summary
  console.log('\n=== VALIDATION SUMMARY ===');
  console.log(`Canonical index sections: ${canonicalIndex.length}`);
  console.log(`SpecificationIndex sections: ${specIndex.length}`);
  console.log(`Accuracy: ${accuracy}%`);
  console.log(`Missing sections: ${missingSections.length}`);
  console.log(`Extra sections: ${extraSections.length}`);
  console.log(`Incorrect titles: ${incorrectTitles.length}`);
  console.log(`Incorrect start pages: ${incorrectStartPages.length}`);
  console.log(`Incorrect end pages: ${incorrectEndPages.length}`);
  console.log(`Incorrect ordering: ${incorrectOrdering.length}`);
}

compareCanonicalIndex().catch(console.error);
