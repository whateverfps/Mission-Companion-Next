import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SpecificationIndex {
  constructor() {
    this.index = new Map(); // sectionNumber -> {title, startPage, endPage}
    this.sortedSections = []; // array of {sectionNumber, title, startPage, endPage} for endPage calculation
    this.pageCount = 0;
  }

  // Scan pages and build index during PDF load
  buildFromPages(pages, pageCount) {
    this.pageCount = pageCount;
    
    for (const page of pages) {
      this.scanPage(page);
    }
    
    this.calculateEndPages();
  }

  // Scan a single page for section headers
  scanPage(page) {
    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Check for SECTION prefix with title on same line: "SECTION 01 45 00 TITLE"
      const sectionWithPrefixAndTitle = line.match(/^SECTION\s+(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?\s+(.+)$/i);
      if (sectionWithPrefixAndTitle) {
        const sectionNumber = `${sectionWithPrefixAndTitle[1]} ${sectionWithPrefixAndTitle[2]} ${sectionWithPrefixAndTitle[3]}` + (sectionWithPrefixAndTitle[4] ? `.${sectionWithPrefixAndTitle[4]}` : '');
        const title = sectionWithPrefixAndTitle[5].trim();
        
        if (this.isValidSection(line, title, page.pageNumber)) {
          this.addSection(sectionNumber, title, page.pageNumber);
        }
        continue;
      }
      
      // Check for SECTION prefix pattern: "SECTION 01 45 00" (title on next line)
      const sectionWithPrefix = line.match(/^SECTION\s+(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?$/i);
      if (sectionWithPrefix) {
        const sectionNumber = `${sectionWithPrefix[1]} ${sectionWithPrefix[2]} ${sectionWithPrefix[3]}` + (sectionWithPrefix[4] ? `.${sectionWithPrefix[4]}` : '');
        
        // Look ahead for title on next line(s)
        const title = this.extractTitleFromNextLines(page.lines, i);
        if (title && this.isValidSection(line, title, page.pageNumber)) {
          this.addSection(sectionNumber, title, page.pageNumber);
        }
        continue;
      }
      
      // Check for section number at start of line with title on same line: "01 45 00 QUALITY CONTROL"
      const sectionWithSameLineTitle = line.match(/^(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?\s+(.+)$/);
      if (sectionWithSameLineTitle) {
        const sectionNumber = `${sectionWithSameLineTitle[1]} ${sectionWithSameLineTitle[2]} ${sectionWithSameLineTitle[3]}` + (sectionWithSameLineTitle[4] ? `.${sectionWithSameLineTitle[4]}` : '');
        const title = sectionWithSameLineTitle[5].trim();
        
        if (this.isValidSection(line, title, page.pageNumber)) {
          this.addSection(sectionNumber, title, page.pageNumber);
        }
        continue;
      }
      
      // Check for section number on its own line: "01 45 00"
      const sectionNumber = line.match(/^(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?$/);
      if (sectionNumber) {
        const normalizedSection = `${sectionNumber[1]} ${sectionNumber[2]} ${sectionNumber[3]}` + (sectionNumber[4] ? `.${sectionNumber[4]}` : '');
        
        // Look ahead for title on next line(s)
        const title = this.extractTitleFromNextLines(page.lines, i);
        if (title && this.isValidSection(line, title, page.pageNumber)) {
          this.addSection(normalizedSection, title, page.pageNumber);
        }
      }
    }
  }

  // Extract title from next lines after section number
  extractTitleFromNextLines(lines, startIndex) {
    for (let j = 1; j <= 3; j++) {
      if (startIndex + j < lines.length) {
        const nextLine = lines[startIndex + j].trim();
        
        // Skip if it's another section number
        if (nextLine.match(/^\d{2}[\s.\-]*\d{2}[\s.\-]*\d{2}/)) return null;
        
        // Skip if it's too short
        if (nextLine.length < 5) continue;
        
        // Skip if it starts with a dot (appendix)
        if (/^\./.test(nextLine)) continue;
        
        // Skip if it contains TOC artifacts
        if (nextLine.includes('$')) continue;
        
        // Skip if it's a page number
        if (nextLine.match(/^PAGE\s+\d+/i)) continue;
        
        // Prefer uppercase titles (likely headings)
        const isUppercase = nextLine === nextLine.toUpperCase() && /[A-Z]/.test(nextLine);
        if (isUppercase) {
          return nextLine;
        }
        
        // Accept first substantial line if no uppercase found
        if (j === 1) {
          return nextLine;
        }
      }
    }
    return null;
  }

  isValidSection(line, title, pageNumber) {
    // Ignore division 00 (TOC/procurement)
    if (line.match(/^00[\s.\-]/)) return false;
    
    // Ignore TOC indicators
    if (line.includes('$')) return false;
    
    // Ignore early pages that are likely TOC/summary (pages 1-45)
    if (pageNumber <= 45) return false;
    
    // Validate title format
    if (title.length < 5) return false;
    if (/^\d+$/.test(title)) return false;
    if (/^\./.test(title)) return false;
    
    // Ignore division headings (e.g., "DIVISION 02 — EXISTING CONDITIONS")
    if (title.match(/^DIVISION\s+\d{2}/i)) return false;
    
    // Ignore template or schedule references
    if (title.match(/Template/i)) return false;
    if (title.match(/Schedule/i)) return false;
    
    // Ignore titles that look like TOC entries (very short, just text fragments)
    if (title.length < 10 && !title.includes(' ')) return false;
    
    return true;
  }

  addSection(sectionNumber, title, startPage) {
    // Only add if not already indexed (take first occurrence)
    if (!this.index.has(sectionNumber)) {
      this.index.set(sectionNumber, { title, startPage, endPage: null });
      this.sortedSections.push({ sectionNumber, title, startPage, endPage: null });
    }
  }

  calculateEndPages() {
    // Sort by startPage
    this.sortedSections.sort((a, b) => a.startPage - b.startPage);
    
    // Calculate endPage for each section using next section's startPage - 1
    for (let i = 0; i < this.sortedSections.length; i++) {
      const section = this.sortedSections[i];
      if (i < this.sortedSections.length - 1) {
        const nextSection = this.sortedSections[i + 1];
        // If next section is on same page, current section ends on that page
        if (nextSection.startPage === section.startPage) {
          section.endPage = section.startPage;
        } else {
          section.endPage = nextSection.startPage - 1;
        }
      } else {
        section.endPage = this.pageCount;
      }
      
      // Update index with calculated endPage
      this.index.set(section.sectionNumber, {
        title: section.title,
        startPage: section.startPage,
        endPage: section.endPage
      });
    }
  }

  getSection(sectionNumber) {
    return this.index.get(sectionNumber);
  }

  getAllSections() {
    return Array.from(this.index.entries()).map(([sectionNumber, data]) => ({
      sectionNumber,
      ...data
    }));
  }
}

class SpecificationSearchEngine {
  constructor() {
    this.pages = [];
    this.pageCount = 0;
    this.loaded = false;
    this.specIndex = new SpecificationIndex();
  }

  async loadPdf(pdfPath) {
    const tempOutput = pdfPath + '.txt';
    
    try {
      console.log('Loading PDF...');
      
      // Get accurate page count from pdfinfo
      const { stdout: pdfInfo } = await execAsync(`pdfinfo "${pdfPath}"`);
      const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
      this.pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
      
      // pdftotext without -layout for cleaner text
      await execAsync(`pdftotext "${pdfPath}" "${tempOutput}"`);
      
      const text = fs.readFileSync(tempOutput, 'utf-8');
      fs.unlinkSync(tempOutput);
      
      // Split by form feed (page separator)
      const pages = text.split(/\f/);
      const actualPages = pages.length === this.pageCount + 1 ? pages.slice(0, -1) : pages;
      
      this.pages = actualPages.map((pageText, index) => ({
        pageNumber: index + 1,
        text: pageText,
        lines: pageText.split('\n')
      }));
      
      // Build specification index during load
      this.specIndex.buildFromPages(this.pages, this.pageCount);
      
      this.loaded = true;
      console.log(`Loaded ${this.pageCount} pages`);
      console.log(`Indexed ${this.specIndex.index.size} specification sections`);
    } catch (error) {
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
      throw error;
    }
  }

  // Search for CSI section number using the pre-built index
  searchBySection(sectionNumber) {
    if (!this.loaded) throw new Error('PDF not loaded');
    
    const section = this.specIndex.getSection(sectionNumber);
    
    if (!section) {
      return [];
    }
    
    // Get context from the actual page
    const page = this.pages[section.startPage - 1];
    const context = this.getContext(page.text, 0, 200);
    
    return [{
      sectionNumber: sectionNumber,
      title: section.title,
      startPage: section.startPage,
      endPage: section.endPage,
      context: context
    }];
  }

  // Search for drawing/sheet number
  searchByDrawing(sheetNumber) {
    if (!this.loaded) throw new Error('PDF not loaded');
    
    const regex = new RegExp(sheetNumber.replace(/[\s.\-]/g, '[\\s.\\-]'), 'gi');
    
    const results = [];
    
    for (const page of this.pages) {
      const matches = page.text.match(regex);
      if (matches) {
        for (const match of matches) {
          const index = page.text.toLowerCase().indexOf(match.toLowerCase());
          const context = this.getContext(page.text, index, 200);
          results.push({
            page: page.pageNumber,
            match: match,
            context: context
          });
        }
      }
    }
    
    return results;
  }

  // Search for room number
  searchByRoom(roomNumber) {
    if (!this.loaded) throw new Error('PDF not loaded');
    
    const regex = new RegExp(`(?:room|rm)[\\s.:]*${roomNumber.replace(/[\s.\-]/g, '[\\s.\\-]')}`, 'gi');
    
    const results = [];
    
    for (const page of this.pages) {
      const matches = page.text.match(regex);
      if (matches) {
        for (const match of matches) {
          const index = page.text.toLowerCase().indexOf(match.toLowerCase());
          const context = this.getContext(page.text, index, 200);
          results.push({
            page: page.pageNumber,
            match: match,
            context: context
          });
        }
      }
    }
    
    return results;
  }

  // General text search
  searchByText(query) {
    if (!this.loaded) throw new Error('PDF not loaded');
    
    const regex = new RegExp(query, 'gi');
    
    const results = [];
    
    for (const page of this.pages) {
      const matches = page.text.match(regex);
      if (matches) {
        for (const match of matches) {
          const index = page.text.toLowerCase().indexOf(match.toLowerCase());
          const context = this.getContext(page.text, index, 200);
          results.push({
            page: page.pageNumber,
            match: match,
            context: context
          });
        }
      }
    }
    
    return results;
  }

  // Get surrounding context around a match
  getContext(text, index, contextLength) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + contextLength);
    return text.substring(start, end).replace(/\s+/g, ' ').trim();
  }
}

// Test the search engine
async function testSearchEngine() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  
  const searchEngine = new SpecificationSearchEngine();
  await searchEngine.loadPdf(pdfPath);
  
  const allSections = searchEngine.specIndex.getAllSections();
  
  console.log(`\nTotal indexed sections: ${allSections.length}`);
  
  console.log('\n=== FIRST 20 INDEXED SECTIONS ===');
  allSections.slice(0, 20).forEach((section, i) => {
    console.log(`${i + 1}. ${section.sectionNumber} - ${section.title} (Pages ${section.startPage}-${section.endPage})`);
  });
  
  const testSections = [
    '01 32 16.15',
    '01 33 23',
    '01 45 00',
    '01 45 35',
    '01 91 00',
    '07 84 00',
    '09 91 00'
  ];
  
  console.log('\n=== VERIFICATION ===');
  for (const section of testSections) {
    const result = searchEngine.searchBySection(section);
    
    if (result.length > 0) {
      console.log(`\n${section}:`);
      console.log(`  Title: ${result[0].title}`);
      console.log(`  Start Page: ${result[0].startPage}`);
      console.log(`  End Page: ${result[0].endPage}`);
    } else {
      console.log(`\n${section}: NOT FOUND`);
    }
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSearchEngine().catch(console.error);
}

export { SpecificationSearchEngine, SpecificationIndex };
