import { createConstructionGraph } from './construction-graph.js';
import { SpecificationGraphAdapter } from './specification-graph-adapter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ProjectEntityEngine {
  constructor() {
    this.constructionGraph = null;
    this.specificationAdapter = null;
    this.entities = new Map();
    this.entityRelationships = new Map();
    this.duplicateResolutions = [];
    this.unresolvedReferences = [];
    this.missingEvidence = [];
  }

  initialize(constructionGraph, specificationAdapter) {
    this.constructionGraph = constructionGraph;
    this.specificationAdapter = specificationAdapter;
  }

  /**
   * Create or merge an entity
   */
  upsertEntity(entity) {
    const entityKey = this.generateEntityKey(entity);
    
    const existing = this.entities.get(entityKey);
    
    if (existing) {
      // Merge entities
      const merged = this.mergeEntities(existing, entity);
      this.entities.set(entityKey, merged);
      
      this.duplicateResolutions.push({
        originalId: existing.id,
        mergedId: merged.id,
        reason: 'Duplicate entity detected and merged'
      });
      
      return merged;
    } else {
      // New entity
      this.entities.set(entityKey, entity);
      return entity;
    }
  }

  generateEntityKey(entity) {
    // Generate a deterministic key based on identity attributes
    const parts = [
      entity.type,
      entity.building,
      entity.floor,
      entity.room,
      entity.attributes?.tag,
      entity.attributes?.number,
      entity.attributes?.identifier
    ].filter(Boolean);
    
    return parts.join(':').toLowerCase();
  }

  mergeEntities(existing, incoming) {
    // Merge entity data, preferring more specific/more recent information
    const merged = { ...existing };
    
    // Merge arrays (de-duplicate)
    for (const key of ['drawingReferences', 'specificationReferences', 'scheduleReferences', 'detailReferences', 'noteReferences', 'photoReferences', 'inspectionReferences', 'submittalReferences', 'deficiencyReferences']) {
      const existingSet = new Set(existing[key] || []);
      const incomingSet = new Set(incoming[key] || []);
      merged[key] = [...new Set([...existingSet, ...incomingSet])];
    }
    
    // Merge attributes
    merged.attributes = { ...existing.attributes, ...incoming.attributes };
    
    // Merge relationships
    const existingRelSet = new Set((existing.relationships || []).map(r => JSON.stringify(r)));
    const incomingRelSet = new Set((incoming.relationships || []).map(r => JSON.stringify(r)));
    merged.relationships = [...new Set([...existingRelSet, ...incomingRelSet])].map(r => JSON.parse(r));
    
    // Update timestamps
    if (incoming.attributes?.updatedAt && (!existing.attributes?.updatedAt || incoming.attributes.updatedAt > existing.attributes.updatedAt)) {
      merged.attributes.updatedAt = incoming.attributes.updatedAt;
    }
    
    return merged;
  }

  /**
   * Read drawing data and create entities
   */
  processDrawingData(projectId) {
    console.log('Processing drawing data...');
    
    // Get drawing objects from the graph
    const drawingObjects = this.constructionGraph.findNodes({
      projectId,
      nodeTypes: ['construction-object']
    });
    
    let createdCount = 0;
    let mergedCount = 0;
    
    for (const drawingObject of drawingObjects) {
      const entity = this.convertDrawingObjectToEntity(drawingObject);
      const result = this.upsertEntity(entity);
      
      if (result.id === entity.id) {
        createdCount++;
      } else {
        mergedCount++;
      }
    }
    
    console.log(`Created ${createdCount} entities from drawings, merged ${mergedCount} duplicates`);
    
    return { createdCount, mergedCount };
  }

  convertDrawingObjectToEntity(drawingObject) {
    const metadata = drawingObject.metadata || {};
    
    // Determine entity type based on object type/tag
    const entityType = this.determineEntityType(metadata.objectType, metadata.tag, drawingObject.label);
    
    return {
      id: drawingObject.nodeId,
      type: entityType,
      building: drawingObject.buildingId,
      floor: drawingObject.floorId,
      room: drawingObject.roomId,
      drawingReferences: [drawingObject.sourceDocumentId].filter(Boolean),
      specificationReferences: [],
      scheduleReferences: [],
      detailReferences: [],
      noteReferences: [],
      photoReferences: [],
      inspectionReferences: [],
      submittalReferences: [],
      deficiencyReferences: [],
      attributes: {
        objectType: metadata.objectType,
        tag: metadata.tag,
        number: drawingObject.normalizedKey,
        label: drawingObject.label,
        trade: drawingObject.trade,
        system: drawingObject.system,
        sourcePage: drawingObject.sourcePageId,
        createdAt: drawingObject.createdAt,
        updatedAt: drawingObject.updatedAt
      },
      relationships: []
    };
  }

  determineEntityType(objectType, tag, label) {
    // Map object types/tags to entity types
    const typeMap = {
      'door': 'Door',
      'frame': 'Frame',
      'window': 'Window',
      'wall': 'Wall',
      'ceiling': 'Ceiling',
      'floor': 'Floor Finish',
      'equipment': 'Equipment',
      'device': 'Device',
      'panel': 'Panel',
      'conduit': 'Conduit',
      'duct': 'Duct',
      'pipe': 'Pipe',
      'firestopping': 'Firestopping',
      'penetration': 'Penetration',
      'cable': 'Cable',
      'furniture': 'Furniture',
      'fixture': 'Fixture'
    };
    
    // Check object type
    if (objectType && typeMap[objectType.toLowerCase()]) {
      return typeMap[objectType.toLowerCase()];
    }
    
    // Check tag
    if (tag && typeMap[tag.toLowerCase()]) {
      return typeMap[tag.toLowerCase()];
    }
    
    // Check label keywords
    const labelLower = label?.toLowerCase() || '';
    for (const [keyword, type] of Object.entries(typeMap)) {
      if (labelLower.includes(keyword)) {
        return type;
      }
    }
    
    // Default to Equipment for unknown types
    return 'Equipment';
  }

  /**
   * Link entities to specifications from evidence
   */
  linkEntitiesToSpecifications(projectId) {
    console.log('Linking entities to specifications...');
    
    let linkedCount = 0;
    let failedCount = 0;
    
    for (const entity of this.entities.values()) {
      // Register entity in construction graph
      const node = this.constructionGraph.registerNode({
        nodeId: entity.id,
        projectId,
        nodeType: this.mapEntityTypeToGraphType(entity.type),
        title: entity.id,
        label: entity.attributes?.label || entity.type,
        normalizedKey: entity.id,
        buildingId: entity.building,
        floorId: entity.floor,
        roomId: entity.room,
        trade: entity.attributes?.trade,
        system: entity.attributes?.system,
        sourceSystem: 'project-entity-engine',
        verificationState: 'confirmed',
        origin: 'manual',
        metadata: entity.attributes
      });

      if (!node) {
        failedCount++;
        continue;
      }

      // Link to governing specifications using the specification adapter
      const governingSpecs = this.specificationAdapter.findGoverningSpecifications(this.constructionGraph, entity.id);

      for (const spec of governingSpecs) {
        const edge = this.constructionGraph.registerEdge({
          projectId,
          sourceNodeId: entity.id,
          targetNodeId: spec.nodeId,
          edgeType: 'governed-by',
          confidence: 0.8,
          verificationState: 'suggested',
          origin: 'rule',
          evidence: [{
            type: 'specification-match',
            specificationTitle: spec.label
          }]
        });

        if (edge) {
          linkedCount++;
          entity.specificationReferences.push(spec.nodeId);
        }
      }
    }

    console.log(`Linked ${linkedCount} entity-specification relationships`);
    console.log(`Failed to link ${failedCount} entities`);
    
    return { linkedCount, failedCount };
  }

  mapEntityTypeToGraphType(entityType) {
    const typeMap = {
      'Building': 'building',
      'Floor': 'floor',
      'Room': 'room',
      'Wall': 'construction-object',
      'Ceiling': 'construction-object',
      'Floor Finish': 'construction-object',
      'Door': 'construction-object',
      'Frame': 'construction-object',
      'Window': 'construction-object',
      'Equipment': 'construction-object',
      'Device': 'construction-object',
      'Panel': 'construction-object',
      'Telecom Room': 'room',
      'Conduit': 'construction-object',
      'Duct': 'construction-object',
      'Pipe': 'construction-object',
      'Firestopping': 'construction-object',
      'Penetration': 'construction-object',
      'Cable': 'construction-object',
      'Furniture': 'construction-object',
      'Fixture': 'construction-object',
      'Medical Equipment': 'construction-object'
    };
    
    return typeMap[entityType] || 'construction-object';
  }

  /**
   * Build deterministic relationships from evidence
   */
  buildRelationships(projectId) {
    console.log('Building relationships from evidence...');
    
    let createdCount = 0;
    
    for (const entity of this.entities.values()) {
      // Build hierarchical relationships (contains/belongs-to)
      if (entity.room && entity.room !== entity.id) {
        const edge = this.constructionGraph.registerEdge({
          projectId,
          sourceNodeId: entity.id,
          targetNodeId: entity.room,
          edgeType: 'located-in',
          confidence: 1.0,
          verificationState: 'confirmed',
          origin: 'rule',
          evidence: [{
            type: 'hierarchical-containment',
            room: entity.room
          }]
        });
        
        if (edge) createdCount++;
      }

      if (entity.floor && entity.floor !== entity.id) {
        const edge = this.constructionGraph.registerEdge({
          projectId,
          sourceNodeId: entity.id,
          targetNodeId: entity.floor,
          edgeType: 'belongs-to',
          confidence: 1.0,
          verificationState: 'confirmed',
          origin: 'rule',
          evidence: [{
            type: 'hierarchical-containment',
            floor: entity.floor
          }]
        });
        
        if (edge) createdCount++;
      }

      // Build evidence-based relationships
      for (const drawingRef of entity.drawingReferences) {
        // Link to drawing pages
        const drawingEdges = this.constructionGraph.findEdges({
          projectId,
          nodeId: entity.id,
          edgeTypes: ['appears-on'],
          direction: 'outgoing'
        });

        if (!drawingEdges.some(e => e.targetNodeId === drawingRef)) {
          const edge = this.constructionGraph.registerEdge({
            projectId,
            sourceNodeId: entity.id,
            targetNodeId: drawingRef,
            edgeType: 'appears-on',
            confidence: 1.0,
            verificationState: 'confirmed',
            origin: 'rule',
            evidence: [{
              type: 'drawing-reference',
              drawingId: drawingRef
            }]
          });
          
          if (edge) createdCount++;
        }
      }
    }

    console.log(`Created ${createdCount} relationships`);
    
    return { createdCount };
  }

  /**
   * Run the complete entity engine process
   */
  async run(projectId = 'bedford') {
    console.log('=== Project Entity Engine ===\n');
    
    // Step 1: Process drawing data
    const drawingResult = this.processDrawingData(projectId);
    
    // Step 2: Link entities to specifications
    const specResult = this.linkEntitiesToSpecifications(projectId);
    
    // Step 3: Build relationships
    const relationshipResult = this.buildRelationships(projectId);
    
    // Step 4: Identify unresolved references
    this.identifyUnresolvedReferences(projectId);
    
    // Step 5: Identify missing evidence
    this.identifyMissingEvidence(projectId);
    
    // Generate diagnostics
    const diagnostics = this.generateDiagnostics();
    
    console.log('\n=== Entity Engine Diagnostics ===');
    console.log(`Entities Created: ${diagnostics.entitiesCreated}`);
    console.log(`Duplicate Entities Merged: ${diagnostics.duplicateEntitiesMerged}`);
    console.log(`Relationships Created: ${diagnostics.relationshipsCreated}`);
    console.log(`Unresolved References: ${diagnostics.unresolvedReferences}`);
    console.log(`Missing Evidence: ${diagnostics.missingEvidence}`);
    console.log(`Orphan Objects: ${diagnostics.orphanObjects}`);
    
    return diagnostics;
  }

  identifyUnresolvedReferences(projectId) {
    console.log('Identifying unresolved references...');
    
    // Check for references that don't have corresponding nodes
    for (const entity of this.entities.values()) {
      for (const ref of entity.drawingReferences) {
        const node = this.constructionGraph.getNode(ref);
        if (!node) {
          this.unresolvedReferences.push({
            entityId: entity.id,
            referenceType: 'drawing',
            referenceId: ref
          });
        }
      }
      
      for (const ref of entity.specificationReferences) {
        const node = this.constructionGraph.getNode(ref);
        if (!node) {
          this.unresolvedReferences.push({
            entityId: entity.id,
            referenceType: 'specification',
            referenceId: ref
          });
        }
      }
    }
    
    console.log(`Found ${this.unresolvedReferences.length} unresolved references`);
  }

  identifyMissingEvidence(projectId) {
    console.log('Identifying missing evidence...');
    
    for (const entity of this.entities.values()) {
      // Entities should have at least some evidence
      if (entity.drawingReferences.length === 0 && 
          entity.specificationReferences.length === 0 &&
          entity.scheduleReferences.length === 0) {
        this.missingEvidence.push({
          entityId: entity.id,
          type: entity.type,
          reason: 'No drawing, specification, or schedule references'
        });
      }
    }
    
    console.log(`Found ${this.missingEvidence.length} entities with missing evidence`);
  }

  generateDiagnostics() {
    const graphDiagnostics = this.constructionGraph.getDiagnostics();
    
    return {
      entitiesCreated: this.entities.size,
      duplicateEntitiesMerged: this.duplicateResolutions.length,
      relationshipsCreated: graphDiagnostics.edgeCount,
      unresolvedReferences: this.unresolvedReferences.length,
      missingEvidence: this.missingEvidence.length,
      orphanObjects: graphDiagnostics.orphanNodeCount,
      details: {
        duplicateResolutions: this.duplicateResolutions,
        unresolvedReferences: this.unresolvedReferences,
        missingEvidence: this.missingEvidence
      }
    };
  }
}

export { ProjectEntityEngine };
