import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildGroundTruth() {
  const pdfPath = path.join(__dirname, '../project-documents/bedford/drawings/518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf');
  const tempOutput = pdfPath + '.txt';
  
  console.log('Extracting PDF text for ground truth...');
  
  // Get page count
  const { stdout: pdfInfo } = await execAsync(`pdfinfo "${pdfPath}"`);
  const pageMatch = pdfInfo.match(/Pages:\s+(\d+)/);
  const pageCount = pageMatch ? parseInt(pageMatch[1]) : 0;
  
  // Extract text
  await execAsync(`pdftotext "${pdfPath}" "${tempOutput}"`);
  const text = fs.readFileSync(tempOutput, 'utf-8');
  fs.unlinkSync(tempOutput);
  
  // Split by form feed
  const pages = text.split(/\f/);
  const actualPages = pages.length === pageCount + 1 ? pages.slice(0, -1) : pages;
  
  console.log(`Processing ${actualPages.length} pages...`);
  
  const groundTruth = [];
  
  // Very conservative section detection - only find SECTION-prefixed headers on pages > 10
  for (let i = 0; i < actualPages.length; i++) {
    const pageText = actualPages[i];
    const lines = pageText.split('\n');
    const pageNumber = i + 1;
    
    // Skip early pages (likely TOC)
    if (pageNumber <= 30) continue;
    
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j].trim();
      
      // Pattern 1: SECTION XX XX XX Title
      const sectionWithPrefix = line.match(/^SECTION\s+(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?\s+(.+)$/i);
      if (sectionWithPrefix) {
        const sectionNumber = `${sectionWithPrefix[1]} ${sectionWithPrefix[2]} ${sectionWithPrefix[3]}` + (sectionWithPrefix[4] ? `.${sectionWithPrefix[4]}` : '');
        const title = sectionWithPrefix[5].trim();
        
        // Exclude if title contains TOC artifacts
        if (title.includes('$')) continue;
        
        // Exclude if title is a division heading
        if (title.match(/^DIVISION\s+\d{2}/i)) continue;
        
        // Exclude if title is very short
        if (title.length < 5) continue;
        
        groundTruth.push({
          sectionNumber,
          title,
          pdfPage: pageNumber,
          sourceLine: line
        });
        continue;
      }
      
      // Pattern 2: SECTION XX XX XX (title on next line)
      const sectionPrefixOnly = line.match(/^SECTION\s+(\d{2})[\s.\-]*(\d{2})[\s.\-]*(\d{2})(?:[\s.\-]*(\d{2}))?$/i);
      if (sectionPrefixOnly) {
        const sectionNumber = `${sectionPrefixOnly[1]} ${sectionPrefixOnly[2]} ${sectionPrefixOnly[3]}` + (sectionPrefixOnly[4] ? `.${sectionPrefixOnly[4]}` : '');
        
        // Look ahead for title
        let title = '';
        for (let k = 1; k <= 3; k++) {
          if (j + k < lines.length) {
            const nextLine = lines[j + k].trim();
            if (nextLine.length > 5 && !nextLine.match(/^\d{2}[\s.\-]*\d{2}[\s.\-]*\d{2/) && !nextLine.includes('$') && !nextLine.match(/^DIVISION\s+\d{2}/i)) {
              title = nextLine;
              break;
            }
          }
        }
        
        if (title) {
          groundTruth.push({
            sectionNumber,
            title,
            pdfPage: pageNumber,
            sourceLine: line
          });
        }
        continue;
      }
      
      // Skip non-prefixed patterns - they're too ambiguous and pick up references
    }
  }
  
  // Remove duplicates (keep first occurrence)
  const seen = new Map();
  const uniqueGroundTruth = [];
  for (const section of groundTruth) {
    if (!seen.has(section.sectionNumber)) {
      seen.set(section.sectionNumber, true);
      uniqueGroundTruth.push(section);
    }
  }
  
  // Sort by page number
  uniqueGroundTruth.sort((a, b) => a.pdfPage - b.pdfPage);
  
  const outputPath = path.join(__dirname, '../ground-truth-sections.json');
  fs.writeFileSync(outputPath, JSON.stringify(uniqueGroundTruth, null, 2));
  
  console.log(`Ground truth written to: ${outputPath}`);
  console.log(`Total sections found: ${uniqueGroundTruth.length}`);
  
  return uniqueGroundTruth;
}

buildGroundTruth().catch(console.error);
