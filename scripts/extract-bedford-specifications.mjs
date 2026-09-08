#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reuse the same CSI heading rules from src/parsers.js
const clean = value => String(value ?? '')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{4,}/g, '\n\n\n')
  .trim();

const normalizeSectionNumber = value => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3');
};

const csiHeading = (raw) => {
  const text = clean(raw).replace(/^#{1,6}\s*/, '');
  
  // Exclude appendix markers from CSI heading detection
  if (/^\.[A-Z]\s/.test(text)) return null;
  
  const division = text.match(/^DIVISION\s+(\d{1,2})\s*(?:[-–—:]\s*)?(.*)$/i);

  if (division) {
    const number = division[1].padStart(2, '0');
    return {
      title: `Division ${number}${division[2] ? ` — ${division[2].trim()}` : ''}`,
      hierarchyType: 'division',
      hierarchyLevel: 1,
      division: number,
      sectionNumber: ''
    };
  }

  const section = text.match(/^(?:SECTION\s+)?(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})\b\s*(?:[-–—:]\s*)?(.*)$/i);

  if (section) {
    const sectionNumber = normalizeSectionNumber(section.slice(1, 4).join(''));
    return {
      title: `${sectionNumber}${section[4] ? ` ${section[4].trim()}` : ''}`,
      hierarchyType: 'spec-section',
      hierarchyLevel: 2,
      division: section[1],
      sectionNumber,
      sectionTitle: section[4]?.trim() || ''
    };
  }

  return null;
};

const isHeading = (line) => {
  const value = clean(line);
  if (!value || value.length > 180 || /^PAGE\s+\d+$/i.test(value)) return false;
  
  // Exclude appendix markers (.A, .B, .C, etc.) from being treated as section headings
  if (/^\.[A-Z]\s/.test(value)) return false;
  
  if (csiHeading(value)) return true;
  if (/^#{1,6}\s+/.test(value)) return true;
  if (/^(PART|ARTICLE|APPENDIX|CHAPTER)\s+[A-Z0-9]/i.test(value)) return true;
  if (/^\d+(?:\.\d+){1,5}[.)]?\s+[A-Z]/.test(value)) return true;
  if (value.length <= 80 && /^(?:[A-Z][A-Za-z0-9/&'\-]*)(?:\s+[A-Z][A-Za-z0-9/&'\-]*){1,7}$/.test(value)) return true;
  return value.length >= 5 && value.length <= 100 &&
    /^[A-Z][A-Z0-9 /&(),'.\-–—]+$/.test(value) &&
    /[A-Z]{3}/.test(value);
};

// Reuse the hierarchy building logic from src/parsers.js
const buildSpecificationHierarchy = (text, name = 'Unknown document') => {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  const nodes = [];
  const stack = [];
  let page = null;
  let lastContentPage = null;
  let current = null;

  const close = endLine => {
    if (!current) return;
    current.text = clean(current.buffer.join('\n'));
    current.endLine = Math.max(current.startLine, endLine);
    current.pageEnd = lastContentPage || current.pageStart;
    current.location = current.pageStart
      ? `Pages ${current.pageStart}-${current.pageEnd}`
      : `Lines ${current.startLine}-${current.endLine}`;
    delete current.buffer;
    nodes.push(current);
    current = null;
  };

  const begin = (heading, lineNumber) => {
    close(lineNumber - 1);
    lastContentPage = page;
    const info = csiHeading(heading);
    const level = info ? info.hierarchyLevel : 4;
    const parent = [...stack].reverse().find(item => item.level < level) || null;
    const inheritedDivision = [...stack].reverse().find(item => item.division)?.division || '';
    const inheritedSection = [...stack].reverse().find(item => item.sectionNumber) || null;
    const key = `node-${nodes.length}-${lineNumber}`;
    current = {
      ...info,
      division: info?.division || inheritedDivision,
      sectionNumber: info?.sectionNumber || inheritedSection?.sectionNumber || '',
      sectionTitle: info?.sectionTitle || inheritedSection?.sectionTitle || '',
      hierarchyType: info?.hierarchyType || 'heading',
      hierarchyLevel: level,
      key,
      parentKey: parent?.key || null,
      path: [...stack.filter(item => item.level < level).map(item => item.title), info?.title || heading],
      pageStart: page,
      startLine: lineNumber + 1,
      buffer: []
    };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({
      key,
      title: info?.title || heading,
      level,
      division: current.division,
      sectionNumber: current.sectionNumber,
      sectionTitle: current.sectionTitle
    });
  };

  lines.forEach((line, index) => {
    const pageMarker = line.trim().match(/^PAGE\s+(\d+)$/i);
    if (pageMarker) {
      page = Number(pageMarker[1]);
      return;
    }
    if (isHeading(line)) {
      begin(line, index + 1);
      return;
    }
    if (!current && clean(line)) begin('Document beginning', index + 1);
    if (current) {
      current.buffer.push(line);
      if (clean(line)) lastContentPage = page || lastContentPage;
    }
  });
  close(lines.length);

  return nodes;
};

async function parsePdfFile(filePath) {
  // Use pdftotext (Poppler) to extract text with layout
  const tempOutput = filePath + '.txt';
  
  try {
    // Get accurate page count from pdfinfo
    const { stdout: pdfInfo } = await execAsync(`pdfinfo "${filePath}"`);
    const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
    const actualPageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
    
    // pdftotext with -layout option preserves layout
    await execAsync(`pdftotext -layout "${filePath}" "${tempOutput}"`);
    
    const text = fs.readFileSync(tempOutput, 'utf-8');
    
    // Clean up temp file
    fs.unlinkSync(tempOutput);
    
    // pdftotext uses form feed (\f) as page separator
    const pages = text.split(/\f/);
    
    // pdftotext sometimes adds an extra empty page at the end
    const actualPages = pages.length === actualPageCount + 1 ? pages.slice(0, -1) : pages;
    
    const textWithMarkers = actualPages.map((page, i) => `PAGE ${i + 1}\n${page}`).join('\n');
    
    return {
      text: textWithMarkers,
      pages: actualPages.map((page, i) => ({ pageNumber: i + 1, sourceText: page })),
      pageCount: actualPageCount
    };
  } catch (error) {
    // Clean up temp file if it exists
    if (fs.existsSync(tempOutput)) {
      fs.unlinkSync(tempOutput);
    }
    throw error;
  }
}

async function main() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  const outputPath = path.join(__dirname, '../project-data/bedford/specifications/bedford-spec-index.json');

  console.log('Loading Bedford specification PDF...');
  const parsed = await parsePdfFile(pdfPath);

  console.log(`PDF loaded: ${parsed.pageCount} pages, ${parsed.text.length} characters`);

  console.log('Building specification hierarchy...');
  const nodes = buildSpecificationHierarchy(parsed.text, '518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');

  console.log(`Total nodes extracted: ${nodes.length}`);

  const specSections = nodes.filter(n => n.hierarchyType === 'spec-section');
  
  // Remove appendix entries (.A, .B, .C, etc.) and TOC entries - they are not true CSI sections
  const trueSpecSections = specSections.filter(n => {
    const title = n.title || '';
    const sectionNumber = n.sectionNumber || '';
    
    // Exclude if section number starts with 00 (TOC/procurement)
    if (sectionNumber.startsWith('00')) return false;
    // Exclude if title starts with a dot and letter (appendix marker)
    if (/^\.[A-Z]\s/.test(title)) return false;
    // Exclude if title contains "Appendix" followed by a letter
    if (/Appendix\s+[A-Z]\b/.test(title)) return false;
    // Exclude if title contains table formatting artifacts (TOC entries)
    if (/\$/.test(title)) return false;
    // Exclude if title is just a number or very short (not a real section title)
    if (/^\d+$/.test(title.trim())) return false;
    if (title.trim().length < 5) return false;
    
    return true;
  });
  
  console.log(`Total CSI specification sections: ${trueSpecSections.length}`);

  if (trueSpecSections.length === 0) {
    console.error('ERROR: No spec-section nodes found!');
    console.log('Sample lines from PDF (first 100):');
    console.log(parsed.text.split('\n').slice(0, 100).join('\n'));
    process.exit(1);
  }

  // Build output in the format expected by specificationIndex.index()
  const documentId = 'bedford-spec';
  const projectId = 'bedford';
  const normalized = trueSpecSections.map((row, index) => {
    const sectionNumber = row.sectionNumber;
    const pageStart = row.pageStart;
    const next = trueSpecSections[index + 1];
    // Use next section's page as end, or default to pageStart
    const pageEnd = next?.pageStart ? next.pageStart - 1 : pageStart;
    
    const sectionTitle = row.sectionTitle || row.title.replace(new RegExp(`^${sectionNumber.replace(/\s/g, '\\s*')}\\s*[-—:]?\\s*`, 'i'), '');

    return {
      specificationSectionId: `${documentId}:${sectionNumber.replace(/\s/g, '')}`,
      projectId,
      documentId,
      division: row.division || sectionNumber.slice(0, 2),
      sectionNumber,
      normalizedSectionNumber: sectionNumber.replace(/\s/g, ''),
      sectionTitle,
      startPdfPage: pageStart,
      endPdfPage: Math.max(pageStart || 0, pageEnd || 0) || null,
      internalPages: [],
      articles: [],
      references: [],
      revisionSource: null,
      supersessionStatus: 'current',
      verificationState: 'indexed'
    };
  }).filter(item => item.sectionNumber && item.startPdfPage);

  // Check for missing data
  const missingPageRanges = normalized.filter(s => !s.startPdfPage || !s.endPdfPage);

  console.log('\n=== EXTRACTION REPORT ===');
  console.log(`Actual PDF page count: ${parsed.pageCount}`);
  console.log(`Total CSI specification sections: ${normalized.length}`);
  console.log(`Sections with missing page ranges: ${missingPageRanges.length}`);

  console.log('\n=== FIRST 20 SECTIONS ===');
  normalized.slice(0, 20).forEach((s, i) => {
    console.log(`${i + 1}. ${s.sectionNumber} - ${s.sectionTitle} (Pages ${s.startPdfPage}-${s.endPdfPage})`);
  });

  console.log('\n=== TARGET SECTIONS CHECK ===');
  const targets = ['09 91 00', '10 44 13', '26 05 19'];
  targets.forEach(target => {
    const found = normalized.find(s => s.sectionNumber === target);
    console.log(`${target}: ${found ? 'FOUND' : 'NOT FOUND'}${found ? ` - ${found.sectionTitle} (Pages ${found.startPdfPage}-${found.endPdfPage})` : ''}`);
  });

  if (missingPageRanges.length > 0) {
    console.log('\n=== SECTIONS WITH MISSING PAGE RANGES ===');
    missingPageRanges.forEach(s => console.log(`${s.sectionNumber}`));
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  const output = {
    document: {
      documentId,
      projectId,
      title: '518-22-700 Bedford Specifications',
      documentType: 'specifications',
      revision: null,
      issueDate: null,
      sourceIdentity: '518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf',
      supersessionStatus: 'current',
      indexedAt: new Date().toISOString()
    },
    sections: normalized
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to: ${outputPath}`);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
