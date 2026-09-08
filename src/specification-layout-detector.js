import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SpecificationLayoutDetector {
  constructor() {
    this.pages = [];
    this.detectedSections = [];
  }

  async loadPdf(pdfPath) {
    console.log('Loading PDF for layout analysis...');
    
    const layoutOutput = pdfPath + '-layout.txt';
    
    try {
      // Use pdftotext with -layout to preserve some positional information
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
      
      console.log(`Loaded ${this.pages.length} pages with layout data`);
    } catch (error) {
      if (fs.existsSync(layoutOutput)) fs.unlinkSync(layoutOutput);
      throw error;
    }
  }

  detectSectionCovers() {
    console.log('Detecting section covers based on layout...');
    
    for (const page of this.pages) {
      const detection = this.analyzePageLayout(page);
      if (detection.confidence > 0.5) {
        this.detectedSections.push({
          ...detection,
          page: page.pageNumber
        });
      }
    }
    
    // Sort by page number
    this.detectedSections.sort((a, b) => a.page - b.page);
    
    console.log(`Detected ${this.detectedSections.length} potential section covers`);
    
    return this.detectedSections;
  }

  analyzePageLayout(page) {
    // Default: no section detected
    const result = {
      sectionNumber: null,
      title: null,
      confidence: 0,
      detectionReason: []
    };
    
    if (!page.lines || page.lines.length === 0) {
      return result;
    }
    
    // Analyze line positioning to identify structure
    const lines = page.lines;
    const firstSectionLineNumber = this.findFirstSectionLine(lines);
    
    if (firstSectionLineNumber === -1) {
      result.detectionReason.push('No section number found on page');
      return result;
    }
    
    result.detectionReason.push('Section number found');
    
    // Check if section is near top of page (within first 20% of lines)
    const linesInSection = lines.length;
    const sectionPositionRatio = firstSectionLineNumber / linesInSection;
    
    if (sectionPositionRatio < 0.2) {
      result.detectionReason.push('Section in top 20% of page');
    } else {
      result.detectionReason.push(`Section at ${(sectionPositionRatio * 100).toFixed(0)}% of page`);
    }
    
    // Check if SECTION text appears near the section number
    const hasSectionText = this.hasSectionTextNearby(lines, firstSectionLineNumber);
    if (hasSectionText) {
      result.detectionReason.push('SECTION text nearby');
    }
    
    // Extract section number
    const sectionLine = lines[firstSectionLineNumber];
    const sectionNumberMatch = sectionLine.match(/(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?/);
    
    if (sectionNumberMatch) {
      result.sectionNumber = sectionNumberMatch[0];
    }
    
    // Look for title on subsequent lines
    const titleInfo = this.extractTitleFromLayout(lines, firstSectionLineNumber);
    if (titleInfo.title) {
      result.title = titleInfo.title;
      result.detectionReason.push('Title found below section number');
    }
    
    // Check for TOC indicators
    const hasTocArtifacts = this.hasTocArtifacts(lines);
    if (hasTocArtifacts) {
      result.confidence = 0;
      result.detectionReason.push('TOC artifacts present');
      return result;
    }
    
    // Check for multiple section numbers (likely TOC)
    const sectionCount = this.countSectionNumbers(lines);
    if (sectionCount > 3) {
      result.confidence = 0;
      result.detectionReason.push(`Multiple section numbers (${sectionCount}) - likely TOC`);
      return result;
    }
    
    // Calculate confidence
    let confidence = 0.5; // Base confidence
    
    if (sectionPositionRatio < 0.2) confidence += 0.2;
    if (hasSectionText) confidence += 0.15;
    if (titleInfo.title && titleInfo.title.length > 10) confidence += 0.15;
    
    result.confidence = Math.min(confidence, 1.0);
    
    return result;
  }

  findFirstSectionLine(lines) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Look for CSI section number pattern
      const match = line.match(/^(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2))?$/);
      if (match) {
        return i;
      }
    }
    return -1;
  }

  hasSectionTextNearby(lines, sectionLineNumber) {
    // Check lines around the section number for SECTION text
    const context = 5;
    for (let i = Math.max(0, sectionLineNumber - context); i <= Math.min(lines.length - 1, sectionLineNumber + context); i++) {
      const line = lines[i].trim();
      if (line.toUpperCase() === 'SECTION') {
        return true;
      }
    }
    return false;
  }

  extractTitleFromLayout(lines, sectionLineNumber) {
    // Look at lines after the section number for title
    const maxLinesToCheck = 5;
    
    for (let i = sectionLineNumber + 1; i < Math.min(lines.length, sectionLineNumber + maxLinesToCheck + 1); i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Skip if it's another section number
      if (line.match(/^(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2))?$/)) {
        break;
      }
      
      // Skip if it's very short
      if (line.length < 5) continue;
      
      // Skip if it starts with a number (likely list item)
      if (/^\d/.test(line)) continue;
      
      // Skip if it starts with a dot (appendix)
      if (/^\./.test(line)) continue;
      
      // Skip if it's a date pattern
      if (line.match(/^\d{4}-\d{2}$/)) continue;
      
      // Skip if it contains TOC artifacts
      if (line.includes('$')) continue;
      
      // Skip if it's a division heading
      if (line.match(/^DIVISION\s+\d{2}/i)) continue;
      
      return { title: line, lineIndex: i };
    }
    
    return { title: null, lineIndex: -1 };
  }

  hasTocArtifacts(lines) {
    const text = lines.join('\n');
    return text.includes('$');
  }

  countSectionNumbers(lines) {
    let count = 0;
    for (const line of lines) {
      if (line.match(/^(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2))?$/)) {
        count++;
      }
    }
    return count;
  }

  getDetectedSections() {
    return this.detectedSections;
  }
}

// Test the detector
async function testDetector() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  
  const detector = new SpecificationLayoutDetector();
  await detector.loadPdf(pdfPath);
  
  const sections = detector.detectSectionCovers();
  
  console.log('\n=== DETECTED SECTIONS ===\n');
  
  for (const section of sections) {
    console.log(`Page ${section.page}: ${section.sectionNumber}`);
    console.log(`  Title: ${section.title}`);
    console.log(`  Confidence: ${(section.confidence * 100).toFixed(0)}%`);
    console.log(`  Reason: ${section.detectionReason.join(', ')}`);
    console.log();
  }
  
  const outputPath = path.join(__dirname, '../layout-detected-sections.json');
  fs.writeFileSync(outputPath, JSON.stringify(sections, null, 2));
  console.log(`Output written to: ${outputPath}`);
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDetector().catch(console.error);
}

export { SpecificationLayoutDetector };
