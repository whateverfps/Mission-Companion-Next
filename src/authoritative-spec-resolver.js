import { BEDFORD_PROJECT_ID, BEDFORD_SPEC_DOCUMENT_ID } from './bedford-project.js';

// Authoritative specification section resolver
// ONE INDEX. ONE VIEWER. ONE SOURCE-OPENING PATH.

// Load authoritative specification index
let authoritativeIndex = null;

async function loadAuthoritativeIndex() {
  if (!authoritativeIndex) {
    try {
      const response = await fetch(new URL('project-data/bedford/specifications/authoritative-spec-index.json', document.baseURI).toString());
      authoritativeIndex = await response.json();
    } catch (error) {
      console.error('Failed to load authoritative specification index:', error);
      authoritativeIndex = [];
    }
  }
  return authoritativeIndex;
}

// Normalize section number: "06 10 00" → "061000"
function normalizeSectionNumber(sectionNumber) {
  return String(sectionNumber || '').replace(/\s/g, '');
}

function normalizeSpecificationSection(section = null) {
  if (!section || typeof section !== 'object') return null;
  return {
    ...section,
    sectionNumber: String(section.sectionNumber || '').trim(),
    normalizedSectionNumber: String(section.normalizedSectionNumber || normalizeSectionNumber(section.sectionNumber)),
    sectionTitle: String(section.sectionTitle || '').trim(),
    documentId: String(section.documentId || '').trim(),
    startPdfPage: Number(section.startPdfPage) || 0,
    endPdfPage: Number(section.endPdfPage) || 0,
    sentence: '',
    sentences: [],
    text: '',
    content: '',
    metadata: section.metadata && typeof section.metadata === 'object' ? { ...section.metadata } : {}
  };
}

// Resolve section from authoritative index
async function resolveSection(sectionNumber) {
  const index = await loadAuthoritativeIndex();
  const normalized = normalizeSectionNumber(sectionNumber);
  
  // Try exact match first
  let section = index.find(s => s.sectionNumber === sectionNumber);
  
  // Try normalized match
  if (!section) {
    section = index.find(s => s.normalizedSectionNumber === normalized);
  }
  
  return section || null;
}

// THE SINGLE function to open a specification section
// Parameters: sectionNumber (e.g., "09 91 00")
// Returns: { ok: boolean, section: object|null, error: string }
export async function openSpecificationSection(sectionNumber) {
  if (!sectionNumber) {
    return { ok: false, section: null, error: 'Section number is required' };
  }
  
  const section = await resolveSection(sectionNumber);
  
  if (!section) {
    return { 
      ok: false, 
      section: null, 
      error: `Section ${sectionNumber} not found in authoritative specification index` 
    };
  }
  
  return {
    ok: true,
    section: normalizeSpecificationSection(section),
    error: null
  };
}

// Integration with existing PDF viewer
// This function should be called from the UI to open a specification section
export async function openSpecificationDocument(sectionNumber, engine) {
  const result = await openSpecificationSection(sectionNumber);
  
  if (!result.ok) {
    alert(result.error);
    return;
  }
  
  const { section } = result;
  
  // The authoritative index uses "bedford-specification-manual" as the documentId
  // But the actual Bedford project may use a different document ID
  // Try to find the Bedford specification document in the current project
  const documents = await engine.documents();
  const specDocument = documents.find(doc => doc.id === BEDFORD_SPEC_DOCUMENT_ID) ||
    documents.find(doc =>
      doc.projectId === BEDFORD_PROJECT_ID &&
      (doc.role === 'specification' || doc.name?.toLowerCase().includes('specification') || doc.title?.toLowerCase().includes('specification'))
    );
  
  if (!specDocument) {
    alert(`Bedford Specification Manual not found in current project. Please attach the Bedford Specification Manual PDF (518-22-700.Bedford.MA.EHRM.Specifications.IFC.20260413.pdf) to the Bedford project.`);
    return;
  }
  
  // Get the source file for the specification document
  const source = await engine.sourceFile(specDocument.id);
  
  if (!source) {
    alert(`Specification document ${specDocument.id} not found in project. Please reattach the Bedford Specification Manual PDF.`);
    return;
  }
  
  // Return the actual document ID and source, not the canonical one
  return { 
    source, 
    section: {
      ...section,
      documentId: specDocument.id // Use the actual document ID from the project
    }
  };
}

// For direct browser console testing
if (typeof globalThis !== 'undefined') {
  globalThis.openSpecificationSection = openSpecificationSection;
  globalThis.resolveSection = resolveSection;
  globalThis.openSpecificationDocument = openSpecificationDocument;
}
