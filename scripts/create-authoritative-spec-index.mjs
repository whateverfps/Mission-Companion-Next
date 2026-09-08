#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the extracted specification index
const extractedIndex = JSON.parse(readFileSync(join(process.cwd(), 'bedford-specification-index.json'), 'utf-8'));

// Create normalized authoritative index
const authoritativeIndex = extractedIndex.map(section => ({
  sectionNumber: section.sectionNumber,
  normalizedSectionNumber: section.sectionNumber.replace(/\s/g, ''),
  sectionTitle: section.title,
  documentId: 'bedford-specification-manual', // Fixed document ID for the Bedford spec PDF
  startPdfPage: section.startPage,
  endPdfPage: section.endPage
}));

// Write authoritative index
const outputPath = join(process.cwd(), 'project-data/bedford/specifications/authoritative-spec-index.json');
writeFileSync(outputPath, JSON.stringify(authoritativeIndex, null, 2), 'utf-8');

console.log('=== AUTHORITATIVE SPECIFICATION INDEX CREATED ===');
console.log(`Total sections: ${authoritativeIndex.length}`);
console.log(`Output: ${outputPath}`);

// Validate key sections
const testSections = ['06 10 00', '06 20 00', '09 30 13', '09 91 00', '10 14 00', '23 10 00', '23 20 00'];
console.log('\n=== SECTION VALIDATION ===');
for (const testSection of testSections) {
  const found = authoritativeIndex.find(s => s.sectionNumber === testSection);
  if (found) {
    console.log(`✓ ${testSection} FOUND: ${found.sectionTitle} (pages ${found.startPdfPage}-${found.endPdfPage})`);
  } else {
    console.log(`✗ ${testSection} NOT FOUND in Bedford specification manual`);
  }
}

// Show 26-series and 27-series examples
console.log('\n=== 26-SERIES SECTIONS ===');
const series26 = authoritativeIndex.filter(s => s.sectionNumber.startsWith('26 ')).slice(0, 5);
series26.forEach(s => console.log(`  ${s.sectionNumber} - ${s.sectionTitle} (pages ${s.startPdfPage}-${s.endPdfPage})`));

console.log('\n=== 27-SERIES SECTIONS ===');
const series27 = authoritativeIndex.filter(s => s.sectionNumber.startsWith('27 ')).slice(0, 5);
series27.forEach(s => console.log(`  ${s.sectionNumber} - ${s.sectionTitle} (pages ${s.startPdfPage}-${s.endPdfPage})`));
