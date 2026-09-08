import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SpecificationExtractionTool {
  constructor() {
    this.pages = [];
    this.extractedSections = [];
    this.ambiguousSections = [];
    this.duplicatesRemoved = [];
    this.thumbnailDir = path.join(__dirname, '../specification-thumbnails');
  }

  async loadPdf(pdfPath) {
    console.log('Loading PDF for extraction...');
    
    const layoutOutput = pdfPath + '-layout.txt';
    
    try {
      // Use pdftotext with -layout to preserve positional information
      await execAsync(`pdftotext -layout "${pdfPath}" "${layoutOutput}"`);
      
      const text = fs.readFileSync(layoutOutput, 'utf-8');
      fs.unlinkSync(layoutOutput);
      
      // Get page count
      const { stdout: pdfInfo } = await execAsync(`pdfinfo "${pdfPath}"`);
      const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
      const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
      
      // Split by form feed (page separator)
      const rawPages = text.split(/\f/);
      const actualPages = rawPages.length === pageCount + 1 ? rawPages.slice(0, -1) : rawPages;
      
      this.pages = actualPages.map((pageText, index) => ({
        pageNumber: index + 1,
        text: pageText,
        lines: pageText.split('\n')
      }));
      
      console.log(`Loaded ${this.pages.length} pages`);
    } catch (error) {
      if (fs.existsSync(layoutOutput)) fs.unlinkSync(layoutOutput);
      throw error;
    }
  }

  async extractThumbnails(pdfPath) {
    console.log('Extracting thumbnails for visual verification...');
    
    // Create thumbnail directory
    if (!fs.existsSync(this.thumbnailDir)) {
      fs.mkdirSync(this.thumbnailDir, { recursive: true });
    }
    
    // Extract thumbnails for all pages (we'll filter later)
    const tempDir = path.join(__dirname, '../temp-thumbnails');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    try {
      // Use pdftoppm to extract pages as images
      await execAsync(`pdftoppm -png -f 1 -l ${this.pages.length} "${pdfPath}" "${tempDir}/page"`);
      
      // Move relevant thumbnails to our directory
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        if (file.endsWith('.png')) {
          const match = file.match(/page-(\d+)\.png/);
          if (match) {
            const pageNum = parseInt(match[1]);
            const targetPath = path.join(this.thumbnailDir, `page-${pageNum}.png`);
            fs.renameSync(path.join(tempDir, file), targetPath);
          }
        }
      }
      
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      console.log(`Extracted ${fs.readdirSync(this.thumbnailDir).length} thumbnails`);
    } catch (error) {
      console.warn('Thumbnail extraction failed:', error.message);
      // Continue without thumbnails
    }
  }

  extractSections() {
    console.log('Extracting specification sections...');
    
    for (const page of this.pages) {
      const extraction = this.extractFromPage(page);
      if (extraction) {
        this.extractedSections.push(extraction);
        
        // Track ambiguous sections
        if (extraction.ambiguous) {
          this.ambiguousSections.push(extraction);
        }
      }
    }
    
    // Sort by page number
    this.extractedSections.sort((a, b) => a.startPage - b.startPage);
    
    // Remove duplicates (keep first occurrence) and track removed duplicates
    const seen = new Map();
    const uniqueSections = [];
    for (const section of this.extractedSections) {
      if (!seen.has(section.sectionNumber)) {
        seen.set(section.sectionNumber, section);
        uniqueSections.push(section);
      } else {
        // Record duplicate removal with explanation
        const firstOccurrence = seen.get(section.sectionNumber);
        this.duplicatesRemoved.push({
          sectionNumber: section.sectionNumber,
          removedSection: section,
          keptSection: firstOccurrence,
          reason: `Duplicate section number. Keeping occurrence on page ${firstOccurrence.startPage}, removing occurrence on page ${section.startPage}`
        });
      }
    }
    this.extractedSections = uniqueSections;
    
    // Calculate end pages
    this.calculateEndPages();
    
    console.log(`Extracted ${this.extractedSections.length} sections`);
    console.log(`Found ${this.ambiguousSections.length} ambiguous sections requiring review`);
    console.log(`Removed ${this.duplicatesRemoved.length} duplicate sections`);
    
    return this.extractedSections;
  }

  extractFromPage(page) {
    const lines = page.lines;
    
    // Look for SECTION-prefixed headers only (most reliable)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Pattern: SECTION XX XX XX Title
      const sectionWithPrefix = line.match(/^SECTION\s+(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?\s+(.+)$/i);
      if (sectionWithPrefix) {
        const sectionNumber = `${sectionWithPrefix[1]} ${sectionWithPrefix[2]} ${sectionWithPrefix[3]}` + (sectionWithPrefix[4] ? `.${sectionWithPrefix[4]}` : '');
        const title = sectionWithPrefix[5].trim();
        
        // Check for TOC artifacts
        if (title.includes('$')) return null;
        
        // Check for division headings
        if (title.match(/^DIVISION\s+\d{2}/i)) return null;
        
        // Check if title is very short
        if (title.length < 5) return null;
        
        // Calculate confidence
        let confidence = 0.9; // High confidence for SECTION prefix + title on same line
        
        return {
          sectionNumber,
          title,
          startPage: page.pageNumber,
          endPage: page.pageNumber,
          sourceLine: line,
          ambiguous: false,
          extractionMethod: 'SECTION prefix with title',
          confidence: confidence,
          lineNumber: i
        };
      }
      
      // Pattern: SECTION XX XX XX (title on next line)
      const sectionPrefixOnly = line.match(/^SECTION\s+(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?$/i);
      if (sectionPrefixOnly) {
        const sectionNumber = `${sectionPrefixOnly[1]} ${sectionPrefixOnly[2]} ${sectionPrefixOnly[3]}` + (sectionPrefixOnly[4] ? `.${sectionPrefixOnly[4]}` : '');
        
        // Look ahead for title
        let title = '';
        let titleLineIndex = -1;
        for (let k = 1; k <= 3; k++) {
          if (i + k < lines.length) {
            const nextLine = lines[i + k].trim();
            if (nextLine.length > 5 && !nextLine.match(/^\d{2}[\s.\-]*\d{2}[\s.\-]*\d{2/) && !nextLine.includes('$') && !nextLine.match(/^DIVISION\s+\d{2}/i)) {
              title = nextLine;
              titleLineIndex = i + k;
              break;
            }
          }
        }
        
        if (title) {
          // Calculate confidence
          let confidence = 0.85; // Slightly lower for title on next line
          
          return {
            sectionNumber,
            title,
            startPage: page.pageNumber,
            endPage: page.pageNumber,
            sourceLine: line,
            ambiguous: false,
            extractionMethod: 'SECTION prefix with title on next line',
            confidence: confidence,
            lineNumber: i,
            titleLineNumber: titleLineIndex
          };
        }
      }
    }
    
    // Skip standalone section numbers - too many false positives in TOC
    return null;
  }

  calculateEndPages() {
    for (let i = 0; i < this.extractedSections.length; i++) {
      const current = this.extractedSections[i];
      const next = this.extractedSections[i + 1];
      
      if (next) {
        current.endPage = next.startPage - 1;
      } else {
        // Last section ends at last page
        current.endPage = this.pages.length;
      }
    }
  }

  generateCanonicalIndex() {
    const canonicalSections = this.extractedSections.map(section => ({
      sectionNumber: section.sectionNumber,
      title: section.title,
      startPage: section.startPage,
      endPage: section.endPage
    }));
    
    return canonicalSections;
  }

  generateExtractionReport() {
    const report = {
      summary: {
        totalPages: this.pages.length,
        totalSectionsExtracted: this.extractedSections.length,
        ambiguousSections: this.ambiguousSections.length,
        duplicatesRemoved: this.duplicatesRemoved.length,
        extractionDate: new Date().toISOString()
      },
      ambiguousSections: this.ambiguousSections.map(section => ({
        sectionNumber: section.sectionNumber,
        title: section.title,
        startPage: section.startPage,
        sourceLine: section.sourceLine,
        extractionMethod: section.extractionMethod,
        confidence: section.confidence,
        reason: 'Standalone section number without SECTION prefix - requires manual verification'
      })),
      duplicatesRemoved: this.duplicatesRemoved.map(dup => ({
        sectionNumber: dup.sectionNumber,
        removed: {
          page: dup.removedSection.startPage,
          title: dup.removedSection.title,
          extractionMethod: dup.removedSection.extractionMethod,
          confidence: dup.removedSection.confidence
        },
        kept: {
          page: dup.keptSection.startPage,
          title: dup.keptSection.title,
          extractionMethod: dup.keptSection.extractionMethod,
          confidence: dup.keptSection.confidence
        },
        reason: dup.reason
      })),
      extractionMethods: this.getMethodBreakdown(),
      pageCoverage: this.getPageCoverage(),
      confidenceBreakdown: this.getConfidenceBreakdown()
    };
    
    return report;
  }

  getConfidenceBreakdown() {
    const breakdown = { high: 0, medium: 0, low: 0 };
    for (const section of this.extractedSections) {
      if (section.confidence >= 0.8) breakdown.high++;
      else if (section.confidence >= 0.6) breakdown.medium++;
      else breakdown.low++;
    }
    return breakdown;
  }

  generateVisualVerificationReport() {
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Specification Extraction - Visual Verification Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f0f0f0; padding: 20px; margin-bottom: 20px; }
    .section { border: 1px solid #ddd; margin: 20px 0; padding: 15px; }
    .section-number { font-size: 18px; font-weight: bold; color: #333; }
    .section-title { font-size: 16px; color: #666; margin: 5px 0; }
    .section-meta { font-size: 14px; color: #888; margin: 5px 0; }
    .thumbnail { max-width: 400px; margin: 10px 0; border: 1px solid #ccc; }
    .confidence-high { color: green; }
    .confidence-medium { color: orange; }
    .confidence-low { color: red; }
    .duplicate-warning { background: #fff3cd; padding: 10px; margin: 10px 0; border-left: 4px solid #ffc107; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Specification Extraction - Visual Verification Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Total Sections: ${this.extractedSections.length}</p>
    <p>Ambiguous Sections: ${this.ambiguousSections.length}</p>
    <p>Duplicates Removed: ${this.duplicatesRemoved.length}</p>
  </div>
`;

    // Add each section with thumbnail
    for (const section of this.extractedSections) {
      const thumbnailPath = `specification-thumbnails/page-${section.startPage}.png`;
      const confidenceClass = section.confidence >= 0.8 ? 'confidence-high' : section.confidence >= 0.6 ? 'confidence-medium' : 'confidence-low';
      
      html += `
  <div class="section">
    <div class="section-number">${section.sectionNumber}</div>
    <div class="section-title">${section.title}</div>
    <div class="section-meta">
      Page: ${section.startPage}-${section.endPage} | 
      Method: ${section.extractionMethod} | 
      Confidence: <span class="${confidenceClass}">${(section.confidence * 100).toFixed(0)}%</span>
    </div>
    <div class="section-meta">Source: ${section.sourceLine}</div>
    ${fs.existsSync(thumbnailPath) ? `<img src="${thumbnailPath}" class="thumbnail" alt="Page ${section.startPage}">` : '<p>Thumbnail not available</p>'}
  </div>
`;
    }

    // Add duplicates removed section
    if (this.duplicatesRemoved.length > 0) {
      html += `
  <div class="header" style="background: #fff3cd;">
    <h2>Duplicates Removed (${this.duplicatesRemoved.length})</h2>
  </div>
`;
      for (const dup of this.duplicatesRemoved) {
        html += `
  <div class="duplicate-warning">
    <strong>${dup.sectionNumber}</strong><br>
    Removed: Page ${dup.removedSection.startPage} - "${dup.removedSection.title}" (${(dup.removedSection.confidence * 100).toFixed(0)}% confidence)<br>
    Kept: Page ${dup.keptSection.startPage} - "${dup.keptSection.title}" (${(dup.keptSection.confidence * 100).toFixed(0)}% confidence)<br>
    Reason: ${dup.reason}
  </div>
`;
      }
    }

    html += `
</body>
</html>
`;

    return html;
  }

  getMethodBreakdown() {
    const methods = {};
    for (const section of this.extractedSections) {
      const method = section.extractionMethod || 'Unknown';
      methods[method] = (methods[method] || 0) + 1;
    }
    return methods;
  }

  getPageCoverage() {
    const pagesWithSections = new Set();
    for (const section of this.extractedSections) {
      for (let p = section.startPage; p <= section.endPage; p++) {
        pagesWithSections.add(p);
      }
    }
    return {
      totalPages: this.pages.length,
      pagesCovered: pagesWithSections.size,
      coveragePercent: ((pagesWithSections.size / this.pages.length) * 100).toFixed(1)
    };
  }
}

async function runExtraction() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  const indexOutputPath = path.join(__dirname, '../bedford-specification-index.json');
  const reportOutputPath = path.join(__dirname, '../specification-extraction-report.json');
  const visualReportPath = path.join(__dirname, '../specification-visual-verification.html');
  
  console.log('=== BEDFORD SPECIFICATION EXTRACTION TOOL ===\n');
  
  const tool = new SpecificationExtractionTool();
  await tool.loadPdf(pdfPath);
  
  const sections = tool.extractSections();
  
  // Skip thumbnail extraction for now (too slow for 2363 pages)
  // await tool.extractThumbnails(pdfPath);
  console.log('Skipping thumbnail extraction (too large for quick processing)');
  
  // Generate canonical index
  const canonicalIndex = tool.generateCanonicalIndex();
  fs.writeFileSync(indexOutputPath, JSON.stringify(canonicalIndex, null, 2));
  console.log(`\nCanonical index written to: ${indexOutputPath}`);
  
  // Generate extraction report
  const report = tool.generateExtractionReport();
  fs.writeFileSync(reportOutputPath, JSON.stringify(report, null, 2));
  console.log(`Extraction report written to: ${reportOutputPath}`);
  
  // Generate visual verification report (without thumbnails)
  const visualReport = tool.generateVisualVerificationReport();
  fs.writeFileSync(visualReportPath, visualReport);
  console.log(`Visual verification report written to: ${visualReportPath}`);
  
  // Print summary
  console.log('\n=== EXTRACTION SUMMARY ===');
  console.log(`Total pages: ${report.summary.totalPages}`);
  console.log(`Total sections extracted: ${report.summary.totalSectionsExtracted}`);
  console.log(`Ambiguous sections: ${report.summary.ambiguousSections}`);
  console.log(`Duplicates removed: ${report.summary.duplicatesRemoved}`);
  console.log(`Page coverage: ${report.pageCoverage.coveragePercent}%`);
  
  console.log('\n=== CONFIDENCE BREAKDOWN ===');
  console.log(`High confidence (≥80%): ${report.confidenceBreakdown.high}`);
  console.log(`Medium confidence (60-79%): ${report.confidenceBreakdown.medium}`);
  console.log(`Low confidence (<60%): ${report.confidenceBreakdown.low}`);
  
  console.log('\n=== EXTRACTION METHODS ===');
  for (const [method, count] of Object.entries(report.extractionMethods)) {
    console.log(`  ${method}: ${count}`);
  }
  
  if (report.ambiguousSections.length > 0) {
    console.log('\n=== AMBIGUOUS SECTIONS (REQUIRE MANUAL REVIEW) ===');
    for (const section of report.ambiguousSections) {
      console.log(`\nSection: ${section.sectionNumber}`);
      console.log(`  Title: ${section.title}`);
      console.log(`  Page: ${section.startPage}`);
      console.log(`  Method: ${section.extractionMethod}`);
      console.log(`  Confidence: ${(section.confidence * 100).toFixed(0)}%`);
      console.log(`  Reason: ${section.reason}`);
    }
  }
  
  if (report.duplicatesRemoved.length > 0) {
    console.log('\n=== DUPLICATES REMOVED ===');
    for (const dup of report.duplicatesRemoved) {
      console.log(`\nSection: ${dup.sectionNumber}`);
      console.log(`  Removed: Page ${dup.removed.page} - "${dup.removed.title}" (${(dup.removed.confidence * 100).toFixed(0)}%)`);
      console.log(`  Kept: Page ${dup.kept.page} - "${dup.kept.title}" (${(dup.kept.confidence * 100).toFixed(0)}%)`);
      console.log(`  Reason: ${dup.reason}`);
    }
  }
  
  console.log('\n=== NEXT STEPS ===');
  console.log('1. Open specification-visual-verification.html to review each section');
  console.log('2. Review ambiguous sections in the extraction report');
  console.log('3. Review duplicate removals to ensure correct choice was made');
  console.log('4. Manually verify section numbers and titles against the PDF');
  console.log('5. Update bedford-specification-index.json if needed');
  console.log('6. Once verified, the index is frozen and will not be regenerated');
  
  if (report.ambiguousSections.length === 0 && report.duplicatesRemoved.length === 0 && report.confidenceBreakdown.low === 0) {
    console.log('\n✅ NO ISSUES FOUND - Index ready for manual verification');
  } else {
    console.log('\n⚠️ ISSUES FOUND - Manual verification required before freezing index');
  }
}

runExtraction().catch(console.error);
