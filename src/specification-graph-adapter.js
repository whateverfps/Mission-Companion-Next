import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class SpecificationGraphAdapter {
  constructor() {
    this.canonicalIndexPath = path.join(__dirname, '../bedford-specification-index.json');
    this.canonicalIndex = null;
  }

  loadCanonicalIndex() {
    if (this.canonicalIndex) return this.canonicalIndex;
    
    try {
      const data = fs.readFileSync(this.canonicalIndexPath, 'utf-8');
      this.canonicalIndex = JSON.parse(data);
      console.log(`Loaded ${this.canonicalIndex.length} sections from canonical index`);
      return this.canonicalIndex;
    } catch (error) {
      console.error('Failed to load canonical specification index:', error.message);
      return null;
    }
  }

  /**
   * Convert canonical index sections to Construction Graph nodes
   */
  indexSectionsInGraph(constructionGraph, projectId = 'bedford') {
    const index = this.loadCanonicalIndex();
    if (!index) return { success: false, reason: 'Canonical index not available' };

    let registeredCount = 0;
    let failedCount = 0;

    for (const section of index) {
      try {
        const nodeId = `specification-section:${section.sectionNumber.replace(/\s/g, '')}`;
        
        const node = constructionGraph.registerNode({
          nodeId,
          projectId,
          nodeType: 'specification-section',
          title: section.sectionNumber,
          label: section.title,
          normalizedKey: section.sectionNumber.replace(/\s/g, ''),
          sourceSystem: 'canonical-specification-index',
          sourceRecordId: section.sectionNumber,
          metadata: {
            startPage: section.startPage,
            endPage: section.endPage,
            canonical: true
          },
          verificationState: 'confirmed',
          origin: 'imported'
        });

        if (node) {
          registeredCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to register section ${section.sectionNumber}:`, error.message);
        failedCount++;
      }
    }

    console.log(`Registered ${registeredCount} specification sections in construction graph`);
    if (failedCount > 0) {
      console.warn(`Failed to register ${failedCount} specification sections`);
    }

    return { success: true, registeredCount, failedCount };
  }

  /**
   * Find governing specifications for a construction object
   */
  findGoverningSpecifications(constructionGraph, objectNodeId) {
    const objectNode = constructionGraph.getNode(objectNodeId);
    if (!objectNode) return [];

    // Get the object's trade and system
    const trade = objectNode.trade;
    const system = objectNode.system;

    // Find all specification sections
    const allSpecs = constructionGraph.findNodes({
      projectId: objectNode.projectId,
      nodeTypes: ['specification-section']
    });

    // Match specifications based on trade/system keywords in titles
    const governingSpecs = allSpecs.filter(spec => {
      const title = spec.label.toLowerCase();
      
      // Direct trade match
      if (trade && title.includes(trade.toLowerCase())) return true;
      
      // Direct system match
      if (system && title.includes(system.toLowerCase())) return true;
      
      return false;
    });

    return governingSpecs;
  }

  /**
   * Link construction objects to their governing specifications
   */
  linkObjectsToSpecifications(constructionGraph, projectId = 'bedford') {
    const objects = constructionGraph.findNodes({
      projectId,
      nodeTypes: ['construction-object']
    });

    let linkedCount = 0;
    let failedCount = 0;

    for (const object of objects) {
      const governingSpecs = this.findGoverningSpecifications(constructionGraph, object.nodeId);

      for (const spec of governingSpecs) {
        try {
          const edge = constructionGraph.registerEdge({
            projectId,
            sourceNodeId: object.nodeId,
            targetNodeId: spec.nodeId,
            edgeType: 'governed-by',
            confidence: 0.8,
            verificationState: 'suggested',
            origin: 'rule',
            evidence: [{
              type: 'trade-system-match',
              trade: object.trade,
              system: object.system,
              specificationTitle: spec.label
            }]
          });

          if (edge) {
            linkedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Failed to link object ${object.nodeId} to spec ${spec.nodeId}:`, error.message);
          failedCount++;
        }
      }
    }

    console.log(`Linked ${linkedCount} object-specification relationships`);
    if (failedCount > 0) {
      console.warn(`Failed to link ${failedCount} object-specification relationships`);
    }

    return { success: true, linkedCount, failedCount };
  }

  /**
   * Get complete evidence for a construction object
   */
  getObjectEvidence(constructionGraph, objectNodeId) {
    const objectNode = constructionGraph.getNode(objectNodeId);
    if (!objectNode) return null;

    const evidence = {
      object: objectNode,
      specifications: [],
      drawings: [],
      inspections: [],
      rfis: [],
      submittals: [],
      deficiencies: []
    };

    // Get governing specifications
    const specEdges = constructionGraph.findEdges({
      projectId: objectNode.projectId,
      nodeId: objectNodeId,
      edgeTypes: ['governed-by'],
      direction: 'outgoing'
    });

    for (const edge of specEdges) {
      const specNode = constructionGraph.getNode(edge.targetNodeId);
      if (specNode) {
        evidence.specifications.push({
          node: specNode,
          edge: edge,
          confidence: edge.confidence
        });
      }
    }

    // Get governing drawings
    const drawingEdges = constructionGraph.findEdges({
      projectId: objectNode.projectId,
      nodeId: objectNodeId,
      edgeTypes: ['appears-on', 'detailed-by'],
      direction: 'outgoing'
    });

    for (const edge of drawingEdges) {
      const drawingNode = constructionGraph.getNode(edge.targetNodeId);
      if (drawingNode) {
        evidence.drawings.push({
          node: drawingNode,
          edge: edge
        });
      }
    }

    // Get inspections
    const inspectionEdges = constructionGraph.findEdges({
      projectId: objectNode.projectId,
      nodeId: objectNodeId,
      edgeTypes: ['inspected-by', 'tested-by'],
      direction: 'outgoing'
    });

    for (const edge of inspectionEdges) {
      const inspectionNode = constructionGraph.getNode(edge.targetNodeId);
      if (inspectionNode) {
        evidence.inspections.push({
          node: inspectionNode,
          edge: edge
        });
      }
    }

    return evidence;
  }

  /**
   * Initialize the specification integration with the construction graph
   */
  async initialize(constructionGraph, projectId = 'bedford') {
    this.constructionGraph = constructionGraph;
    console.log('Initializing specification integration with construction graph...');

    // Step 1: Index canonical specification sections as graph nodes
    const indexResult = this.indexSectionsInGraph(constructionGraph, projectId);
    if (!indexResult.success) {
      return indexResult;
    }

    // Step 2: Link construction objects to their governing specifications
    const linkResult = this.linkObjectsToSpecifications(constructionGraph, projectId);

    return {
      success: true,
      indexedSections: indexResult.registeredCount,
      linkedRelationships: linkResult.linkedCount
    };
  }
}

export { SpecificationGraphAdapter };
