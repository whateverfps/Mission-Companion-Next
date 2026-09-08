#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function extractPdfText(filePath) {
  const tempOutput = filePath + '.txt';
  
  try {
    // Get accurate page count from pdfinfo
    const { stdout: pdfInfo } = await execAsync(`pdfinfo "${filePath}"`);
    const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
    const actualPageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
    
    // pdftotext without -layout for cleaner text extraction
    await execAsync(`pdftotext "${filePath}" "${tempOutput}"`);
    
    const text = fs.readFileSync(tempOutput, 'utf-8');
    fs.unlinkSync(tempOutput);
    
    // Split by form feed (page separator)
    const pages = text.split(/\f/);
    const actualPages = pages.length === actualPageCount + 1 ? pages.slice(0, -1) : pages;
    
    return {
      pages: actualPages,
      pageCount: actualPageCount
    };
  } catch (error) {
    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    throw error;
  }
}

async function parseBedfordSpecs() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  
  console.log('Extracting PDF text...');
  const { pages, pageCount } = await extractPdfText(pdfPath);
  console.log(`Extracted ${pageCount} pages`);
  
  const sections = [];
  const seenSectionNumbers = new Set();
  let currentPage = 1;
  
  for (const pageText of pages) {
    const lines = pageText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if this line is a section number followed by title on same line
      const combinedPattern = /^(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?\s+(.+)$/;
      const combinedMatch = trimmed.match(combinedPattern);
      
      if (combinedMatch) {
        const sectionNumber = `${combinedMatch[1]} ${combinedMatch[2]} ${combinedMatch[3]}` + (combinedMatch[4] ? `.${combinedMatch[4]}` : '');
        const title = combinedMatch[5].trim();
        
        // Exclude if starts with 00 (TOC/procurement)
        if (combinedMatch[1] === '00') continue;
        
        // Exclude if contains table artifacts (TOC)
        if (title.includes('$')) continue;
        
        // Exclude if title is just numbers or very short
        if (/^\d+$/.test(title) || title.length < 5) continue;
        
        // Exclude if starts with . (appendix)
        if (/^\./.test(title)) continue;
        
        // Only take first occurrence of each section number
        if (seenSectionNumbers.has(sectionNumber)) continue;
        
        seenSectionNumbers.add(sectionNumber);
        sections.push({
          sectionNumber,
          title,
          startPage: currentPage,
          endPage: null,
          text: '',
          lines: []
        });
      } else {
        // Check if this line is just a section number
        const numberPattern = /^(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?$/;
        const numberMatch = trimmed.match(numberPattern);
        
        if (numberMatch) {
          const sectionNumber = `${numberMatch[1]} ${numberMatch[2]} ${numberMatch[3]}` + (numberMatch[4] ? `.${numberMatch[4]}` : '');
          
          // Exclude if starts with 00 (TOC/procurement)
          if (numberMatch[1] === '00') continue;
          
          // Only take first occurrence of each section number
          if (seenSectionNumbers.has(sectionNumber)) continue;
          
          // Look ahead for title on next line(s) - collect multi-line titles
          let titleLines = [];
          let j = i + 1;
          while (j < lines.length && j < i + 5) { // Look at most 4 lines ahead
            const nextLine = lines[j].trim();
            const isAnotherSectionNumber = nextLine.match(/^(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})/);
            if (nextLine.length > 5 && !nextLine.includes('$') && !/^\./.test(nextLine) && !/^\d+$/.test(nextLine) && !isAnotherSectionNumber) {
              titleLines.push(nextLine);
              j++;
            } else {
              break;
            }
          }
          
          if (titleLines.length > 0) {
            seenSectionNumbers.add(sectionNumber);
            sections.push({
              sectionNumber,
              title: titleLines.join(' '),
              startPage: currentPage,
              endPage: null,
              text: '',
              lines: []
            });
            i = j - 1; // Skip all title lines
          }
        } else if (sections.length > 0) {
          // Add line to current section
          sections[sections.length - 1].lines.push(line);
        }
      }
    }
    
    currentPage++;
  }
  
  // Calculate end pages and concatenate text
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    section.endPage = (i < sections.length - 1) ? sections[i + 1].startPage - 1 : pageCount;
    section.text = section.lines.join('\n').trim();
    delete section.lines;
  }
  
  // Filter out sections with very little text (likely false positives)
  const realSections = sections.filter(s => s.text.length > 500);
  
  console.log(`\nExtracted ${realSections.length} real CSI sections`);
  
  // Verify specific sections
  const verifySections = [
    '01 32 16.15',
    '01 33 23',
    '01 45 00',
    '01 45 35',
    '01 91 00',
    '07 84 00',
    '09 91 00'
  ];
  
  console.log('\n=== VERIFICATION ===');
  for (const target of verifySections) {
    const found = realSections.find(s => s.sectionNumber === target);
    if (found) {
      console.log(`\n${target}:`);
      console.log(`  Title: ${found.title}`);
      console.log(`  Start Page: ${found.startPage}`);
      console.log(`  End Page: ${found.endPage}`);
      console.log(`  Text Length: ${found.text.length} characters`);
    } else {
      console.log(`\n${target}: NOT FOUND`);
    }
  }
  
  // Write output
  const outputPath = path.join(__dirname, '../project-data/bedford/specifications/bedford-spec-index.json');
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(realSections, null, 2));
  console.log(`\nOutput written to: ${outputPath}`);
  
  return realSections;
}

parseBedfordSpecs().catch(console.error);
