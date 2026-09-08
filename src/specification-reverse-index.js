const text = value => value === null || value === undefined ? '' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const clone = value => structuredClone(value);

/**
 * Build reverse index from drawing-spec-links
 * Maps specifications → objects → pages → buildings → rooms
 */
export function createSpecificationReverseIndex({ drawingSpecificationLinks = null, projectObjectRegistry = null } = {}) {
  const reverseIndex = new Map(); // specKey → { objects: Set, pages: Set, buildings: Set, rooms: Set }
  
  if (!drawingSpecificationLinks) {
    return {
      getSpecificationUsage(specificationDocumentId, sectionNumber) {
        return { objects: [], pages: [], buildings: [], rooms: [] };
      },
      getAllSpecs() { return []; }
    };
  }
  
  const getSpecKey = (documentId, sectionNumber) => `${text(documentId)}:${text(sectionNumber)}`;
  
  /**
   * Build reverse index from all links
   */
  function buildIndex() {
    reverseIndex.clear();
    
    const allLinks = drawingSpecificationLinks.forProject();
    
    for (const link of allLinks) {
      if (link.status === 'rejected') continue;
      
      const specKey = getSpecKey(link.specificationDocumentId, link.sectionNumber);
      
      if (!reverseIndex.has(specKey)) {
        reverseIndex.set(specKey, {
          objects: new Set(),
          pages: new Set(),
          buildings: new Set(),
          rooms: new Set()
        });
      }
      
      const entry = reverseIndex.get(specKey);
      
      // Add object
      if (link.objectId) {
        entry.objects.add(link.objectId);
        
        // Try to get object details from registry
        if (projectObjectRegistry) {
          try {
            const objectData = projectObjectRegistry.getObject(link.objectId);
            if (objectData) {
              // Add page
              if (objectData.drawingPageId) {
                entry.pages.add(objectData.drawingPageId);
              }
              
              // Add building if available
              if (objectData.buildingId) {
                entry.buildings.add(objectData.buildingId);
              }
              
              // Add room if available
              if (objectData.roomId) {
                entry.rooms.add(objectData.roomId);
              }
            }
          } catch (error) {
            // If registry fails, continue with basic data
          }
        }
      }
      
      // Add page (page-level links)
      if (link.drawingPageId && !link.objectId) {
        entry.pages.add(link.drawingPageId);
      }
    }
  }
  
  /**
   * Get usage information for a specification
   */
  function getSpecificationUsage(specificationDocumentId, sectionNumber) {
    const specKey = getSpecKey(specificationDocumentId, sectionNumber);
    const entry = reverseIndex.get(specKey);
    
    if (!entry) {
      return { objects: [], pages: [], buildings: [], rooms: [] };
    }
    
    return {
      objects: [...entry.objects],
      pages: [...entry.pages],
      buildings: [...entry.buildings],
      rooms: [...entry.rooms]
    };
  }
  
  /**
   * Get all specifications with their usage
   */
  function getAllSpecs() {
    const allLinks = drawingSpecificationLinks.forProject();
    const specMap = new Map();
    
    for (const link of allLinks) {
      if (link.status === 'rejected') continue;
      
      const specKey = getSpecKey(link.specificationDocumentId, link.sectionNumber);
      
      if (!specMap.has(specKey)) {
        specMap.set(specKey, {
          specificationDocumentId: link.specificationDocumentId,
          sectionNumber: link.sectionNumber,
          sectionTitle: link.sectionTitle,
          usage: getSpecificationUsage(link.specificationDocumentId, link.sectionNumber)
        });
      }
    }
    
    return [...specMap.values()];
  }
  
  // Build initial index
  buildIndex();
  
  return {
    buildIndex,
    getSpecificationUsage,
    getAllSpecs
  };
}
