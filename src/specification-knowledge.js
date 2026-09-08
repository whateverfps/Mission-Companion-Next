import { collectPageSpecificationEvidence } from './drawing-specification-evidence.js';

const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];

const BEDFORD_SPECIFICATION_MANUAL_FILE_NAME = 'bedford-specification-index.json';
const BEDFORD_SPECIFICATION_MANUAL_PATH = './project-data/bedford/bedford-specification-index.json';

// Small fallback object-to-specification map for common objects not in vocabulary
const FALLBACK_OBJECT_SPECIFICATIONS = Object.freeze({
  'fire damper': '23 33 00',
  'firestopping': '07 84 13',
  'hollow metal door': '08 11 13',
  'hollow metal frame': '08 11 13',
  'gypsum board': '09 29 00',
  'drywall': '09 29 00',
  'acoustical ceiling': '09 51 00',
  'acoustic ceiling': '09 51 00',
  'suspended ceiling': '09 51 00',
  'lighting fixture': '26 51 00',
  'light fixture': '26 51 00',
  'luminaire': '26 51 00',
  'panelboard': '26 24 16',
  'panel board': '26 24 16',
  'cable tray': '26 05 36',
  'medical gas outlet': '22 63 00',
  'diffuser': '23 37 13',
  'ductwork': '23 31 00',
  'air duct': '23 31 00',
  'valve': '22 05 23',
  'pipe insulation': '22 07 19',
  'insulation': '22 07 19'
});

let bedfordSpecificationIndex = null;
let bedfordSpecificationLoadPromise = null;

/**
 * Ensure Bedford specification knowledge is loaded
 */
export async function ensureSpecificationKnowledge({ engine, projectId, libraryId, manualFileName, manualPath, fetcher, onDiagnostic = () => {} } = {}) {
  if (bedfordSpecificationLoadPromise) {
    return bedfordSpecificationLoadPromise;
  }

  bedfordSpecificationLoadPromise = (async () => {
    const started = performance.now();
    
    try {
      // Try to load from project data
      let specificationData = null;
      
      try {
        const response = await fetcher?.(manualPath);
        if (response && response.ok) {
          specificationData = await response.json();
          onDiagnostic({ operation: 'bedford-specification-load', durationMs: performance.now() - started, source: 'project-data', sectionsLoaded: specificationData?.sections?.length || 0 });
        }
      } catch (error) {
        onDiagnostic({ operation: 'bedford-specification-load', durationMs: performance.now() - started, source: 'project-data', error: error?.message || String(error) });
      }
      
      if (specificationData && specificationData.sections) {
        bedfordSpecificationIndex = specificationData;
        return { ok: true, sections: specificationData.sections.length };
      }
      
      // Fallback: try to load from specification index
      const allDocuments = await engine.documents();
      const specDocuments = allDocuments.filter(doc => 
        doc.title?.toLowerCase().includes('specification') || 
        doc.name?.toLowerCase().includes('specification') ||
        doc.id?.toLowerCase().includes('spec')
      );
      
      onDiagnostic({ operation: 'bedford-specification-load', durationMs: performance.now() - started, source: 'document-library', specDocumentsFound: specDocuments.length });
      
      return { ok: false, reason: 'Bedford specification index not found in project data or document library' };
      
    } catch (error) {
      onDiagnostic({ operation: 'bedford-specification-load', durationMs: performance.now() - started, error: error?.message || String(error) });
      return { ok: false, reason: error?.message || 'Failed to load Bedford specification index' };
    }
  })();
  
  return bedfordSpecificationLoadPromise;
}

/**
 * Index specification documents into the specification index
 */
export function indexSpecificationDocuments({ specificationIndex, documents, sections, projectId } = {}) {
  const specificationDocuments = documents.filter(doc => 
    doc.title?.toLowerCase().includes('specification') || 
    doc.name?.toLowerCase().includes('specification') ||
    doc.id?.toLowerCase().includes('spec')
  );
  
  for (const document of specificationDocuments) {
    const sourceSections = sections.filter(item => item.documentId === document.id);
    if (sourceSections.length) {
      specificationIndex.index({ document, sourceSections });
    }
  }
  
  return { indexed: specificationDocuments.length, totalSections: sourceSections.length };
}

/**
 * Get Bedford specification index
 */
export function getBedfordSpecificationIndex() {
  return bedfordSpecificationIndex;
}

/**
 * Extract explicit specification references from drawing evidence
 */
export function extractExplicitSpecificationReferences(evidence = []) {
  const explicitReferences = new Set();
  
  // CSI section number pattern: DD DD DD (e.g., 07 84 13)
  const csiPattern = /\b(\d{2})\s?(\d{2})\s?(\d{2})\b/g;
  
  for (const item of list(evidence)) {
    const value = text(item.text);
    let match;
    
    while ((match = csiPattern.exec(value)) !== null) {
      const sectionNumber = `${match[1]} ${match[2]} ${match[3]}`;
      explicitReferences.add(sectionNumber);
    }
  }
  
  return [...explicitReferences];
}

/**
 * Extract specifications from recognized construction objects
 */
export function extractObjectBasedSpecifications({ 
  activeDrawingObjects = [], 
  projectSpecificationVocabulary = null,
  specificationIndex = null,
  projectId = ''
} = {}) {
  const objectSpecs = new Map(); // sectionNumber -> { objects: [], evidence: [] }
  
  for (const object of list(activeDrawingObjects)) {
    const objectText = text(object.label || object.type || object.subtype || object.evidenceText);
    if (!objectText) continue;
    
    let sectionNumber = null;
    let source = '';
    
    // Try project specification vocabulary first
    if (projectSpecificationVocabulary && typeof projectSpecificationVocabulary.matchObject === 'function') {
      const matches = projectSpecificationVocabulary.matchObject({
        projectId,
        objectId: object.objectId,
        evidence: [{ text: objectText, source: 'drawing-object', region: object.region, observationId: object.sourceObservationIds?.[0] }]
      });
      
      if (matches.length > 0) {
        sectionNumber = matches[0].sectionNumber;
        source = 'vocabulary-match';
      }
    }
    
    // Fallback to object map
    if (!sectionNumber) {
      const normalized = objectText.toLowerCase();
      for (const [objectName, specNumber] of Object.entries(FALLBACK_OBJECT_SPECIFICATIONS)) {
        if (normalized.includes(objectName)) {
          sectionNumber = specNumber;
          source = 'fallback-map';
          break;
        }
      }
    }
    
    if (sectionNumber) {
      if (!objectSpecs.has(sectionNumber)) {
        objectSpecs.set(sectionNumber, { objects: [], evidence: [] });
      }
      const entry = objectSpecs.get(sectionNumber);
      entry.objects.push(objectText);
      entry.evidence.push({
        text: objectText,
        source: 'drawing-object',
        region: object.region,
        observationId: object.sourceObservationIds?.[0]
      });
    }
  }
  
  // Convert to array with metadata
  return [...objectSpecs.entries()].map(([sectionNumber, data]) => ({
    sectionNumber,
    objects: data.objects,
    evidence: data.evidence,
    source: 'object-recognition'
  }));
}

/**
 * Standalone specification search for Specification Explorer
 * Searches the specification index directly using sheet metadata
 * Does NOT use drawingSpecificationLinks, drawingRequirementsResolver, or relationship stores
 */
export function searchSpecificationsForSheet({ specificationIndex, sheet = {}, projectId = '' } = {}) {
  if (!specificationIndex) {
    return { ok: false, sections: [], reason: 'Specification index not available' };
  }

  const sheetNumber = text(sheet.sheetNumber);
  const sheetTitle = text(sheet.sheetTitle);
  const discipline = text(sheet.discipline);
  const sheetType = text(sheet.primarySheetType || sheet.drawingType);
  
  // Build search query from sheet metadata
  const searchTerms = [
    sheetNumber,
    sheetTitle,
    discipline,
    sheetType
  ].filter(Boolean).join(' ');
  
  if (!searchTerms) {
    return { ok: false, sections: [], reason: 'No sheet metadata available for search' };
  }
  
  // Search specification index
  const results = specificationIndex.find(searchTerms, { projectId });
  
  // Add confidence scores based on match quality
  const scoredResults = results.map(section => {
    let confidence = 0.5; // base confidence
    const sectionText = `${section.sectionNumber} ${section.sectionTitle}`.toLowerCase();
    const searchLower = searchTerms.toLowerCase();
    
    // Higher confidence for discipline matches
    if (discipline && sectionText.includes(discipline.toLowerCase())) {
      confidence += 0.2;
    }
    
    // Higher confidence for sheet type matches
    if (sheetType && sectionText.includes(sheetType.toLowerCase())) {
      confidence += 0.15;
    }
    
    // Higher confidence for section number matches
    if (sheetNumber && sectionText.includes(sheetNumber.toLowerCase())) {
      confidence += 0.1;
    }
    
    return {
      ...section,
      confidence: Math.min(confidence, 1.0),
      matchReason: discipline && sectionText.includes(discipline.toLowerCase()) 
        ? 'Discipline match' 
        : sheetType && sectionText.includes(sheetType.toLowerCase())
        ? 'Sheet type match'
        : 'General specification'
    };
  });
  
  // Sort by confidence descending
  scoredResults.sort((a, b) => b.confidence - a.confidence);
  
  return {
    ok: true,
    sections: scoredResults,
    query: searchTerms,
    totalSections: scoredResults.length
  };
}

/**
 * Create specification explorer
 */
export function createSpecificationExplorer({ specificationIndex, relationshipGraph } = {}) {
  return {
    getSpecificationForDrawing(drawingPageId) {
      if (!bedfordSpecificationIndex || !bedfordSpecificationIndex.sections) {
        return [];
      }
      
      // Find specifications related to this drawing
      // This would be enhanced with actual drawing-to-spec mapping
      return bedfordSpecificationIndex.sections.filter(section => 
        section.projectId === specificationIndex.get(section.documentId, section.sectionNumber)?.projectId
      );
    },
    
    getSpecificationSection(documentId, sectionNumber) {
      return specificationIndex?.get?.(documentId, sectionNumber);
    }
  };
}

/**
 * Load pre-built drawing-spec mappings from project data
 */
export async function loadBedfordDrawingSpecMappings({ 
  drawingSpecificationLinks, 
  specificationIndex, 
  projectId, 
  drawingDocumentId,
  relationshipsPath = 'project-data/bedford/relationships/building-61-spec-links.json',
  fetcher = globalThis.fetch,
  baseUri = globalThis.document?.baseURI || globalThis.location?.href || import.meta.url
} = {}) {
  try {
    const response = await fetcher(new URL(relationshipsPath, baseUri).toString());
    if (!response.ok) {
      return { loaded: 0, reason: 'Mapping file not found' };
    }
    
    const data = await response.json();
    if (!data?.results) {
      return { loaded: 0, reason: 'Invalid mapping data format' };
    }
    
    let loaded = 0;
    
    for (const [sheetNumber, sheetData] of Object.entries(data.results)) {
      if (sheetData?.links) {
        for (const link of sheetData.links) {
          const section = specificationIndex.get(drawingDocumentId, link.sectionNumber);
          if (!section) continue;
          
          const result = drawingSpecificationLinks.link({
            projectId,
            drawingDocumentId,
            drawingPageId: link.drawingPageId,
            objectId: link.objectId || null,
            specificationDocumentId: section.documentId,
            sectionNumber: link.sectionNumber,
            status: link.status,
            origin: link.origin,
            confidence: link.confidence,
            evidenceSource: link.evidenceSource,
            evidenceText: link.evidenceText,
            reason: link.reason,
            applicabilityScope: link.objectId ? 'object-specific' : 'page-wide'
          });
          
          if (result) {
            loaded++;
          }
        }
      }
    }
    
    return { 
      loaded, 
      reason: `Loaded ${loaded} pre-built specification mappings from project data`,
      source: 'project-mappings'
    };
  } catch (error) {
    return { loaded: 0, reason: `Failed to load mappings: ${error?.message || String(error)}` };
  }
}

/**
 * Populate drawing-spec-links from Bedford specification index
 * Priority: Explicit references > Object recognition > Drawing metadata > Discipline suggestions
 */
export function populateBedfordDrawingSpecLinks({ 
  drawingSpecificationLinks, 
  specificationIndex, 
  projectId, 
  drawingPageId, 
  sheetDiscipline = '',
  sheet = {},
  observations = [],
  schedules = [],
  legends = [],
  occurrences = [],
  keyedNotes = [],
  activeDrawingObjects = [],
  references = [],
  projectSpecificationVocabulary = null
} = {}) {
  if (!bedfordSpecificationIndex || !bedfordSpecificationIndex.sections) {
    return { populated: 0, reason: 'Bedford specification index not loaded' };
  }
  
  let populated = 0;
  let source = '';
  
  // Step 1: Collect drawing evidence
  const evidence = collectPageSpecificationEvidence({
    sheet,
    observations,
    schedules,
    legends,
    occurrences,
    keyedNotes,
    activeDrawingObjects,
    references
  });
  
  // Step 2: Extract explicit specification references (Priority 1: 95% confidence)
  const explicitReferences = extractExplicitSpecificationReferences(evidence);
  
  if (explicitReferences.length > 0) {
    source = 'explicit-references';
    for (const sectionNumber of explicitReferences) {
      const section = bedfordSpecificationIndex.sections.find(s => 
        s.projectId === projectId && 
        s.sectionNumber === sectionNumber
      );
      
      if (section) {
        const link = drawingSpecificationLinks.link({
          projectId,
          drawingDocumentId: section.documentId,
          drawingPageId,
          specificationDocumentId: section.documentId,
          sectionNumber: section.sectionNumber,
          sectionTitle: section.sectionTitle,
          origin: 'explicit-reference',
          status: 'confirmed',
          confidence: 0.95,
          evidenceSource: 'drawing-explicit-reference',
          evidenceText: `Explicit reference on drawing: ${sectionNumber}`,
          reason: 'Explicitly referenced on the drawing sheet'
        });
        
        if (link) {
          populated++;
        }
      }
    }
    
    return { 
      populated, 
      reason: `Populated ${populated} explicit specification references from drawing evidence`,
      source: 'explicit'
    };
  }
  
  // Step 3: Extract object-based specifications (Priority 2: 85% confidence)
  const objectSpecs = extractObjectBasedSpecifications({
    activeDrawingObjects,
    projectSpecificationVocabulary,
    specificationIndex,
    projectId
  });
  
  if (objectSpecs.length > 0) {
    source = 'object-recognition';
    for (const { sectionNumber, objects, evidence } of objectSpecs) {
      const section = bedfordSpecificationIndex.sections.find(s => 
        s.projectId === projectId && 
        s.sectionNumber === sectionNumber
      );
      
      if (section) {
        const link = drawingSpecificationLinks.link({
          projectId,
          drawingDocumentId: section.documentId,
          drawingPageId,
          specificationDocumentId: section.documentId,
          sectionNumber: section.sectionNumber,
          sectionTitle: section.sectionTitle,
          origin: 'object-recognition',
          status: 'suggested',
          confidence: 0.85,
          evidenceSource: 'drawing-object-recognition',
          evidenceText: `Detected object: ${objects[0]}${objects.length > 1 ? ` (+${objects.length - 1} more)` : ''}`,
          reason: `Detected object implies governing specification`
        });
        
        if (link) {
          populated++;
        }
      }
    }
    
    return { 
      populated, 
      reason: `Populated ${populated} specifications from recognized construction objects`,
      source: 'object'
    };
  }
  
  // Step 4: Drawing metadata (Priority 3: 70% confidence)
  // Use sheet title, discipline, and type to suggest specifications
  if (sheet.sheetTitle || sheet.discipline) {
    source = 'drawing-metadata';
    const metadataEvidence = [
      { text: sheet.sheetTitle, source: 'sheet-title' },
      { text: sheet.discipline, source: 'sheet-discipline' },
      { text: sheet.primarySheetType || sheet.drawingType, source: 'sheet-type' }
    ].filter(item => item.text);
    
    // Use project specification vocabulary for page-level matching
    if (projectSpecificationVocabulary && typeof projectSpecificationVocabulary.matchPage === 'function') {
      const pageMatches = projectSpecificationVocabulary.matchPage({
        projectId,
        pageId: drawingPageId,
        evidence: metadataEvidence
      });
      
      if (pageMatches.length > 0) {
        for (const match of pageMatches) {
          const section = bedfordSpecificationIndex.sections.find(s => 
            s.projectId === projectId && 
            s.sectionNumber === match.sectionNumber
          );
          
          if (section) {
            const link = drawingSpecificationLinks.link({
              projectId,
              drawingDocumentId: section.documentId,
              drawingPageId,
              specificationDocumentId: section.documentId,
              sectionNumber: section.sectionNumber,
              sectionTitle: section.sectionTitle,
              origin: 'drawing-metadata',
              status: 'suggested',
              confidence: 0.70,
              evidenceSource: 'drawing-metadata-vocabulary',
              evidenceText: match.evidenceText || `Drawing metadata: ${sheet.sheetTitle}`,
              reason: 'Drawing metadata suggests governing specification'
            });
            
            if (link) {
              populated++;
            }
          }
        }
        
        return { 
          populated, 
          reason: `Populated ${populated} specifications from drawing metadata`,
          source: 'metadata'
        };
      }
    }
  }
  
  // Step 5: Discipline suggestions as fallback (Priority 4: 50% confidence)
  source = 'discipline-suggestions';
  
  // Filter specifications by discipline to reduce noise
  // Map disciplines to CSI divisions
  const disciplineToDivision = {
    'Architectural': ['01', '03', '04', '05', '06', '07', '08', '09', '10'],
    'Structural': ['03', '05', '13', '14'],
    'Mechanical': ['23', '25'],
    'Electrical': ['26', '27'],
    'Plumbing': ['22', '23'],
    'Fire Protection': ['21', '13'],
    'Civil': ['02', '31', '32', '33']
  };
  
  const relevantDivisions = disciplineToDivision[sheetDiscipline] || [];
  
  for (const section of bedfordSpecificationIndex.sections) {
    if (section.projectId !== projectId) continue;
    
    // If we have a discipline, filter by CSI division
    if (relevantDivisions.length > 0) {
      const sectionDivision = section.sectionNumber.slice(0, 2);
      if (!relevantDivisions.includes(sectionDivision)) continue;
    }
    
    const link = drawingSpecificationLinks.link({
      projectId,
      drawingDocumentId: section.documentId,
      drawingPageId,
      specificationDocumentId: section.documentId,
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      origin: 'bedford-import',
      status: 'suggested',
      confidence: 0.5, // Lower confidence for discipline suggestions
      evidenceSource: 'Bedford specification index',
      evidenceText: `Bedford specification ${section.sectionNumber} — ${section.sectionTitle}`,
      reason: sheetDiscipline ? `Discipline-based suggestion (${sheetDiscipline}) - no explicit references or objects found on drawing` : 'Bedford specification suggestion - no explicit references or objects found on drawing'
    });
    
    if (link) {
      populated++;
    }
  }
  
  return { 
    populated, 
    reason: sheetDiscipline ? `Populated ${populated} discipline-based suggestions (no explicit references or objects found)` : `Populated ${populated} Bedford suggestions (no explicit references or objects found)`,
    source: 'discipline'
  };
}
