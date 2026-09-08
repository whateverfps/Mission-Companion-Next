import { SpecificationSearchEngine, SpecificationIndex } from '../src/specification-search.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SpecificationIndexValidator {
  constructor() {
    this.issues = [];
    this.sections = [];
  }

  async validate(pdfPath) {
    console.log('Loading PDF and building index...');
    const searchEngine = new SpecificationSearchEngine();
    await searchEngine.loadPdf(pdfPath);
    
    this.sections = searchEngine.specIndex.getAllSections();
    this.pages = searchEngine.pages;
    
    console.log(`Validating ${this.sections.length} indexed sections...`);
    
    // Run all validations
    this.validateDuplicates();
    this.validateTitles();
    this.validatePageRanges();
    this.validatePageOrder();
    this.validateSourceLines();
    this.validateTitlePatterns();
    this.validateTOCEntries();
    this.validateAppendixEntries();
    this.validateDivisionHeadings();
    
    // Generate report
    this.generateReport();
  }

  validateDuplicates() {
    const seen = new Map();
    
    for (const section of this.sections) {
      if (seen.has(section.sectionNumber)) {
        this.issues.push({
          type: 'DUPLICATE_SECTION',
          section: section.sectionNumber,
          message: `Duplicate section number: ${section.sectionNumber}`,
          severity: 'HIGH'
        });
      }
      seen.set(section.sectionNumber, true);
    }
  }

  validateTitles() {
    for (const section of this.sections) {
      if (!section.title) {
        this.issues.push({
          type: 'MISSING_TITLE',
          section: section.sectionNumber,
          message: `Missing title for section ${section.sectionNumber}`,
          severity: 'HIGH'
        });
      } else if (section.title.trim().length === 0) {
        this.issues.push({
          type: 'EMPTY_TITLE',
          section: section.sectionNumber,
          message: `Empty title for section ${section.sectionNumber}`,
          severity: 'HIGH'
        });
      }
    }
  }

  validatePageRanges() {
    for (const section of this.sections) {
      if (section.startPage > section.endPage) {
        this.issues.push({
          type: 'INVALID_PAGE_RANGE',
          section: section.sectionNumber,
          message: `Start page (${section.startPage}) > end page (${section.endPage})`,
          severity: 'HIGH'
        });
      }
    }
  }

  validatePageOrder() {
    for (let i = 1; i < this.sections.length; i++) {
      const prev = this.sections[i - 1];
      const curr = this.sections[i];
      
      if (curr.startPage < prev.startPage) {
        this.issues.push({
          type: 'PAGE_ORDER_ERROR',
          section: curr.sectionNumber,
          message: `Section ${curr.sectionNumber} (page ${curr.startPage}) appears before ${prev.sectionNumber} (page ${prev.startPage})`,
          severity: 'HIGH'
        });
      }
    }
  }

  validateSourceLines() {
    for (const section of this.sections) {
      const page = this.pages[section.startPage - 1];
      if (!page) continue;
      
      const sectionNumber = section.sectionNumber.replace(/[\s.\-]/g, '');
      const found = page.lines.some(line => {
        const normalized = line.replace(/[\s.\-]/g, '');
        return normalized.includes(sectionNumber);
      });
      
      if (!found) {
        this.issues.push({
          type: 'SOURCE_LINE_MISMATCH',
          section: section.sectionNumber,
          message: `Section number ${section.sectionNumber} not found on page ${section.startPage}`,
          severity: 'MEDIUM'
        });
      }
    }
  }

  validateTitlePatterns() {
    const suspiciousPrefixes = ['-', '.', ',', '(', 'See', 'Per'];
    
    for (const section of this.sections) {
      if (!section.title) continue;
      
      const trimmed = section.title.trim();
      const firstChar = trimmed.charAt(0);
      
      if (suspiciousPrefixes.includes(firstChar)) {
        this.issues.push({
          type: 'SUSPICIOUS_TITLE_PREFIX',
          section: section.sectionNumber,
          message: `Title starts with suspicious character: "${firstChar}"`,
          severity: 'LOW'
        });
      }
      
      if (trimmed.toLowerCase().startsWith('see ')) {
        this.issues.push({
          type: 'REFERENCE_TITLE',
          section: section.sectionNumber,
          message: `Title appears to be a reference: "${trimmed}"`,
          severity: 'MEDIUM'
        });
      }
      
      if (trimmed.toLowerCase().startsWith('per ')) {
        this.issues.push({
          type: 'REFERENCE_TITLE',
          section: section.sectionNumber,
          message: `Title appears to be a reference: "${trimmed}"`,
          severity: 'MEDIUM'
        });
      }
    }
  }

  validateTOCEntries() {
    for (const section of this.sections) {
      if (!section.title) continue;
      
      if (section.title.includes('$')) {
        this.issues.push({
          type: 'TOC_ENTRY',
          section: section.sectionNumber,
          message: `Title contains TOC artifact ($): "${section.title}"`,
          severity: 'HIGH'
        });
      }
    }
  }

  validateAppendixEntries() {
    for (const section of this.sections) {
      if (!section.title) continue;
      
      if (section.title.match(/^\.+/)) {
        this.issues.push({
          type: 'APPENDIX_ENTRY',
          section: section.sectionNumber,
          message: `Title appears to be appendix entry: "${section.title}"`,
          severity: 'MEDIUM'
        });
      }
      
      if (section.title.toLowerCase().includes('appendix')) {
        this.issues.push({
          type: 'APPENDIX_ENTRY',
          section: section.sectionNumber,
          message: `Title contains "appendix": "${section.title}"`,
          severity: 'MEDIUM'
        });
      }
    }
  }

  validateDivisionHeadings() {
    for (const section of this.sections) {
      if (!section.title) continue;
      
      if (section.title.match(/^DIVISION\s+\d{2}/i)) {
        this.issues.push({
          type: 'DIVISION_HEADING',
          section: section.sectionNumber,
          message: `Title is a division heading: "${section.title}"`,
          severity: 'MEDIUM'
        });
      }
    }
  }

  getSourceLine(section) {
    const page = this.pages[section.startPage - 1];
    if (!page) return 'N/A';
    
    const sectionNumber = section.sectionNumber.replace(/[\s.\-]/g, '');
    
    for (const line of page.lines) {
      const normalized = line.replace(/[\s.\-]/g, '');
      if (normalized.includes(sectionNumber)) {
        return line.trim();
      }
    }
    
    return 'NOT FOUND';
  }

  generateReport() {
    const reportPath = path.join(__dirname, '../specification-index-validation.md');
    
    let markdown = '# Specification Index Validation Report\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Summary
    const duplicates = this.issues.filter(i => i.type === 'DUPLICATE_SECTION').length;
    const missingTitles = this.issues.filter(i => i.type === 'MISSING_TITLE' || i.type === 'EMPTY_TITLE').length;
    const invalidPageRanges = this.issues.filter(i => i.type === 'INVALID_PAGE_RANGE').length;
    const pageOrderErrors = this.issues.filter(i => i.type === 'PAGE_ORDER_ERROR').length;
    const sourceLineMismatches = this.issues.filter(i => i.type === 'SOURCE_LINE_MISMATCH').length;
    const suspiciousTitles = this.issues.filter(i => i.type === 'SUSPICIOUS_TITLE_PREFIX' || i.type === 'REFERENCE_TITLE').length;
    const tocEntries = this.issues.filter(i => i.type === 'TOC_ENTRY').length;
    const appendixEntries = this.issues.filter(i => i.type === 'APPENDIX_ENTRY').length;
    const divisionHeadings = this.issues.filter(i => i.type === 'DIVISION_HEADING').length;
    
    const highSeverity = this.issues.filter(i => i.severity === 'HIGH').length;
    const mediumSeverity = this.issues.filter(i => i.severity === 'MEDIUM').length;
    const lowSeverity = this.issues.filter(i => i.severity === 'LOW').length;
    
    const confidenceScore = Math.max(0, 100 - (highSeverity * 10) - (mediumSeverity * 5) - (lowSeverity * 2));
    
    markdown += '## Summary\n\n';
    markdown += `- **Total sections indexed:** ${this.sections.length}\n`;
    markdown += `- **Duplicate section numbers:** ${duplicates}\n`;
    markdown += `- **Invalid titles (missing/empty):** ${missingTitles}\n`;
    markdown += `- **Invalid page ranges:** ${invalidPageRanges}\n`;
    markdown += `- **Page order errors:** ${pageOrderErrors}\n`;
    markdown += `- **Source line mismatches:** ${sourceLineMismatches}\n`;
    markdown += `- **Suspicious titles:** ${suspiciousTitles}\n`;
    markdown += `- **TOC entries accidentally indexed:** ${tocEntries}\n`;
    markdown += `- **Appendix entries accidentally indexed:** ${appendixEntries}\n`;
    markdown += `- **Division headings accidentally indexed:** ${divisionHeadings}\n\n`;
    
    markdown += '## Severity Breakdown\n\n';
    markdown += `- **HIGH severity issues:** ${highSeverity}\n`;
    markdown += `- **MEDIUM severity issues:** ${mediumSeverity}\n`;
    markdown += `- **LOW severity issues:** ${lowSeverity}\n\n`;
    
    markdown += `## Confidence Score\n\n**${confidenceScore}/100**\n\n`;
    
    if (confidenceScore >= 90) {
      markdown += '✅ **HIGH CONFIDENCE** - The Specification Index is trustworthy.\n\n';
    } else if (confidenceScore >= 70) {
      markdown += '⚠️ **MEDIUM CONFIDENCE** - The Specification Index has some issues that should be reviewed.\n\n';
    } else {
      markdown += '❌ **LOW CONFIDENCE** - The Specification Index has significant issues.\n\n';
    }
    
    // Detailed section listing
    markdown += '## Detailed Section Listing\n\n';
    markdown += '| Section | Title | Start Page | End Page | Source Line | Previous | Next |\n';
    markdown += '|---------|-------|------------|----------|-------------|----------|------|\n';
    
    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      const prev = i > 0 ? this.sections[i - 1].sectionNumber : 'N/A';
      const next = i < this.sections.length - 1 ? this.sections[i + 1].sectionNumber : 'N/A';
      const sourceLine = this.getSourceLine(section);
      
      markdown += `| ${section.sectionNumber} | ${section.title.substring(0, 50)}${section.title.length > 50 ? '...' : ''} | ${section.startPage} | ${section.endPage} | ${sourceLine.substring(0, 50)}${sourceLine.length > 50 ? '...' : ''} | ${prev} | ${next} |\n`;
    }
    
    // Issues detail
    markdown += '\n## Issues Detail\n\n';
    
    if (this.issues.length === 0) {
      markdown += 'No issues found.\n\n';
    } else {
      const grouped = new Map();
      for (const issue of this.issues) {
        if (!grouped.has(issue.type)) {
          grouped.set(issue.type, []);
        }
        grouped.get(issue.type).push(issue);
      }
      
      for (const [type, issues] of grouped) {
        markdown += `### ${type} (${issues.length})\n\n`;
        for (const issue of issues) {
          markdown += `- **${issue.section}** [${issue.severity}]: ${issue.message}\n`;
        }
        markdown += '\n';
      }
    }
    
    fs.writeFileSync(reportPath, markdown);
    console.log(`\nValidation report written to: ${reportPath}`);
    
    // Print summary to console
    console.log('\n=== VALIDATION SUMMARY ===');
    console.log(`Total sections indexed: ${this.sections.length}`);
    console.log(`Duplicate section numbers: ${duplicates}`);
    console.log(`Invalid titles: ${missingTitles}`);
    console.log(`Invalid page ranges: ${invalidPageRanges}`);
    console.log(`Page order errors: ${pageOrderErrors}`);
    console.log(`Source line mismatches: ${sourceLineMismatches}`);
    console.log(`Suspicious titles: ${suspiciousTitles}`);
    console.log(`TOC entries: ${tocEntries}`);
    console.log(`Appendix entries: ${appendixEntries}`);
    console.log(`Division headings: ${divisionHeadings}`);
    console.log(`\nHIGH severity: ${highSeverity}`);
    console.log(`MEDIUM severity: ${mediumSeverity}`);
    console.log(`LOW severity: ${lowSeverity}`);
    console.log(`\nConfidence Score: ${confidenceScore}/100`);
  }
}

// Run validation
async function runValidation() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  
  const validator = new SpecificationIndexValidator();
  await validator.validate(pdfPath);
}

runValidation().catch(console.error);
