import { ProjectStateService } from './project-state-service.js';
import { ConstructionReasoningEngine } from './construction-reasoning-engine.js';
import { ProjectFactEngine } from './project-fact-engine.js';
import { createProjectRelationshipEngine } from './project-relationship-engine.js';
import { createConstructionGraph } from './construction-graph.js';

class ChiefIntelligenceBridge {
  constructor() {
    this.projectStateService = null;
    this.reasoningEngine = null;
    this.factEngine = null;
    this.relationshipEngine = null;
    this.constructionGraph = null;
    this.specificationSME = null;
    this.pmisSME = null;
    this.readyPromise = Promise.resolve();
    this.initialized = false;
  }

  resolveQuestionSheet(question) {
    const text = String(question || '').trim();
    const match = text.match(/\b(\d{2}[A-Z]{0,3}-?\d{3})\b/i);
    return match ? match[1].toUpperCase() : '';
  }

  initialize({
    constructionGraph = null,
    factEngine = null,
    relationshipEngine = null,
    reasoningEngine = null,
    projectStateService = null,
    specificationSME = null,
    pmisSME = null,
    readyPromise = null
  } = {}) {
    this.constructionGraph = constructionGraph;
    this.factEngine = factEngine;
    this.relationshipEngine = relationshipEngine;
    this.reasoningEngine = reasoningEngine;
    this.projectStateService = projectStateService;
    this.specificationSME = specificationSME;
    this.pmisSME = pmisSME;
    this.readyPromise = readyPromise || Promise.resolve();
    this.initialized = true;
  }

  /**
   * Determine if a question should be answered by Mission Companion intelligence
   */
  shouldUseMissionCompanionIntelligence(question) {
    const lower = question.toLowerCase();
    
    // Questions about project state
    if (lower.includes('what governs') || lower.includes('governed by')) return true;
    if (lower.includes('what specs') || lower.includes('specifications')) return true;
    if (lower.includes('what inspections') || lower.includes('inspection')) return true;
    if (lower.includes('deficiencies') || lower.includes('deficiency')) return true;
    if (lower.includes('evidence') || lower.includes('support')) return true;
    if (lower.includes('what changed') || lower.includes('since')) return true;
    if (lower.includes('what prevents') || lower.includes('blocking') || lower.includes('blocks')) return true;
    if (lower.includes('activation') || lower.includes('turnover')) return true;
    if (lower.includes('what should i inspect') || lower.includes('inspect next')) return true;
    if (lower.includes('drawing details') || lower.includes('review')) return true;
    if (lower.includes('building') || lower.includes('room') || lower.includes('floor')) return true;
    
    // Questions about specification usage
    if (lower.includes('what objects') && lower.includes('specification')) return true;
    if (lower.includes('which drawings') && lower.includes('specification')) return true;
    if (lower.includes('which rooms') && lower.includes('specification')) return true;
    if (lower.includes('used by') && lower.includes('specification')) return true;
    if (lower.includes('governed by') && lower.includes('08') || lower.includes('07') || lower.includes('09')) return true;
    
    return false;
  }

  /**
   * Build project context for a question
   */
  buildProjectContext(question, drawingContext = null) {
    if (!this.initialized) {
      return {
        hasContext: false,
        reason: 'Mission Companion intelligence not initialized'
      };
    }

    const context = {
      hasContext: true,
      question,
      projectState: null,
      reasoningResult: null,
      specificationAnswer: null,
      pmisAnswer: null,
      facts: [],
      relationships: [],
      specifications: [],
      specificationUsage: null,
      drawingContext: drawingContext
    };
    const rawQuestion = String(question || '').trim();
    const sheetMatch = this.resolveQuestionSheet(rawQuestion);
    const normalizedSheetId = sheetMatch ? sheetMatch.replace(/\s+/g, '').toUpperCase() : '';
    const explicitBuildingIntent = rawQuestion.match(/\bbuilding\s*(\d{2})\b/i)?.[1] || '';
    const resolvedSheet = drawingContext?.identity?.sheetNumber
      ? { sheetNumber: drawingContext.identity.sheetNumber, pageId: drawingContext.identity.pageId, documentId: drawingContext.identity.documentId }
      : (this.specificationSME?.getSheetFromQuestion ? this.specificationSME.getSheetFromQuestion(rawQuestion) : null)
        || (this.specificationSME?.getSheetForSheetNumber ? this.specificationSME.getSheetForSheetNumber(normalizedSheetId) : null);
    console.log('SPEC_SME_ROUTE', {
      rawQuestion,
      specSmeIntentMatch: this.shouldUseMissionCompanionIntelligence(question),
      sheetRegexMatch: sheetMatch || '',
      normalizedSheetId,
      resolvedSheet: resolvedSheet ? { sheetNumber: resolvedSheet.sheetNumber, pageId: resolvedSheet.pageId, documentId: resolvedSheet.documentId } : null
    });

    // Get project state
    try {
      context.projectState = this.projectStateService.getProjectState();
    } catch (error) {
      context.projectState = null;
    }

    // Get reasoning result if question is about project
    if (this.shouldUseMissionCompanionIntelligence(question)) {
      try {
        context.reasoningResult = this.reasoningEngine.processQuestion(question);
      } catch (error) {
        context.reasoningResult = null;
      }
    }

    // Get facts related to drawing context
    if (drawingContext && drawingContext.objectId) {
      try {
        const objectFacts = this.factEngine.getFactsForSubject(drawingContext.objectId);
        context.facts = objectFacts;
      } catch (error) {
        context.facts = [];
      }
    }

    // Get relationships related to drawing context
    if (drawingContext && drawingContext.objectId) {
      try {
        const objectRelationships = this.relationshipEngine.getRelationshipsByType(
          drawingContext.objectId, null, 'outgoing'
        );
        context.relationships = objectRelationships;
      } catch (error) {
        context.relationships = [];
      }
    }

    // Get specification usage if question asks about specification usage
    if (this.isSpecificationUsageQuestion(question)) {
      try {
        const specReverseIndex = globalThis.__specificationReverseIndex;
        if (specReverseIndex) {
          // Try to extract specification number from question
          const specMatch = question.match(/\b(\d{2}\s?\d{2}\s?\d{2})\b/);
          if (specMatch) {
            const specNumber = specMatch[0].replace(/\s+/g, ' ');
            context.specificationUsage = specReverseIndex.getSpecificationUsage(null, specNumber);
          }
        }
      } catch (error) {
        context.specificationUsage = null;
      }
    }

    if (this.specificationSME) {
      try {
        const relationshipLookup = globalThis.__chiefRelationshipLookupForQuestion?.(rawQuestion, drawingContext) || [];
        const scopedRelationshipLookup = explicitBuildingIntent
          ? (globalThis.__mcBedfordRelationshipLinksForBuilding?.(explicitBuildingIntent) || relationshipLookup)
          : relationshipLookup;
        console.log('CHIEF_61FX100_RELATIONSHIP_LOOKUP', {
          lookupKey: {
            question: rawQuestion,
            sheetMatch,
            normalizedSheetId,
            drawingPageId: resolvedSheet?.pageId || drawingContext?.identity?.pageId || '',
            projectId: this.specificationSME?.projectId || ''
          },
          returnedRelationships: scopedRelationshipLookup.map(item => ({
            sheetNumber: item.sheetNumber,
            sectionNumber: item.sectionNumber,
            sectionTitle: item.sectionTitle,
            relationshipType: item.relationshipType,
            status: item.status,
            origin: item.origin,
            drawingPageId: item.drawingPageId
          }))
        });
        const specificationAnswer = this.specificationSME.answerQuestion(question, {
          activeSheet: resolvedSheet,
          drawingContext,
          drawingLinks: scopedRelationshipLookup,
          buildingId: explicitBuildingIntent || ''
        });
        console.log('SME_DRAWING_IDENTITY_LOOKUP', {
          inputSheetId: normalizedSheetId || '',
          resolvedCanonicalPageId: resolvedSheet?.pageId || '',
          relationshipCount: specificationAnswer?.specifications?.length || 0
        });
        context.specificationAnswer = specificationAnswer;
        console.log('SPEC_SME_RESULT', {
          question: rawQuestion,
          queryType: context.specificationAnswer?.queryType || '',
          sectionNumbers: context.specificationAnswer?.specifications?.map(item => item.sectionNumber) || [],
          drawingCount: context.specificationAnswer?.drawings?.length || 0
        });
      } catch (error) {
        context.specificationAnswer = null;
      }
    }

    if (this.pmisSME?.isPmisQuestion?.(rawQuestion)) {
      try {
        const pmisAnswer = this.pmisSME.answerQuestion(rawQuestion);
        context.pmisAnswer = pmisAnswer;
        console.log('PMIS_SME_RESULT', {
          question: rawQuestion,
          queryType: pmisAnswer?.queryType || '',
          scope: pmisAnswer?.scope || '',
          buildingKey: pmisAnswer?.building?.buildingKey || '',
          readinessPct: pmisAnswer?.building?.readinessPct ?? null,
          openRisks: pmisAnswer?.building?.openRisks ?? null,
          openQuestions: pmisAnswer?.building?.openQuestions ?? null,
          campusTotal: pmisAnswer?.campus?.total ?? null,
          available: Boolean(pmisAnswer?.available)
        });
      } catch (error) {
        context.pmisAnswer = null;
      }
    }

    return context;
  }

  /**
   * Check if question is about specification usage
   */
  isSpecificationUsageQuestion(question) {
    const lower = question.toLowerCase();
    return lower.includes('what objects') && lower.includes('specification') ||
           lower.includes('which drawings') && lower.includes('specification') ||
           lower.includes('which rooms') && lower.includes('specification') ||
           lower.includes('used by') && lower.includes('specification');
  }

  /**
   * Generate answer from Mission Companion intelligence
   */
  generateMissionCompanionAnswer(question, context, mode = 'source') {
    if (!context.hasContext || (!context.reasoningResult && !context.specificationAnswer && !context.pmisAnswer)) {
      return null;
    }

    const specificationAnswer = context.specificationAnswer || null;
    const pmisAnswer = context.pmisAnswer || null;
    let answerContent = '';
    if (pmisAnswer) {
      const lines = [];
      if (pmisAnswer.answer) lines.push(pmisAnswer.answer);
      if (pmisAnswer.summary) {
        lines.push('');
        lines.push(`Summary: ${pmisAnswer.summary}`);
      }
      if (pmisAnswer.building) {
        lines.push('');
        lines.push('Building Snapshot:');
        lines.push(`- ${pmisAnswer.building.label}`);
        lines.push(`- Readiness: ${pmisAnswer.building.readinessPct}%`);
        lines.push(`- Overall status: ${pmisAnswer.building.overallStatus}`);
        lines.push(`- Construction ready: ${pmisAnswer.building.constructionReady}`);
        lines.push(`- OIT readiness: ${pmisAnswer.building.oitReadiness}`);
        lines.push(`- Open risks: ${pmisAnswer.building.openRisks}`);
        lines.push(`- Open questions: ${pmisAnswer.building.openQuestions}`);
        lines.push(`- Shutdowns: ${pmisAnswer.building.shutdownCount}`);
        if (pmisAnswer.building.tradeHealth?.length) {
          lines.push('- Trade health:');
          for (const item of pmisAnswer.building.tradeHealth) {
            lines.push(`  · ${item.label}: ${item.value} (${item.percent}%)`);
          }
        }
        if (pmisAnswer.building.pilotCompletion?.gates?.length) {
          lines.push('- Pilot completion:');
          for (const gate of pmisAnswer.building.pilotCompletion.gates) {
            lines.push(`  · ${gate.label}: ${gate.value}`);
          }
          if (pmisAnswer.building.pilotCompletion.missing.length) {
            lines.push(`  · Missing: ${pmisAnswer.building.pilotCompletion.missing.join(', ')}`);
          }
        }
      }
      if (pmisAnswer.campus) {
        lines.push('');
        lines.push('Campus Snapshot:');
        lines.push(`- Buildings tracked: ${pmisAnswer.campus.total}`);
        lines.push(`- Ready: ${pmisAnswer.campus.ready}`);
        lines.push(`- Not ready: ${pmisAnswer.campus.notReady}`);
        lines.push(`- Open risks: ${Math.round(pmisAnswer.campus.risks)}`);
        lines.push(`- Open questions: ${Math.round(pmisAnswer.campus.questions)}`);
        lines.push(`- Active shutdowns: ${pmisAnswer.campus.activeShutdowns.length}`);
      }
      answerContent = lines.filter(Boolean).join('\n');
    } else {
      answerContent = context.reasoningResult?.answer || (() => {
      if (!specificationAnswer) return '';
      const sections = Array.isArray(specificationAnswer.specifications) ? specificationAnswer.specifications.slice(0, 6) : [];
      const drawings = Array.isArray(specificationAnswer.drawings) ? specificationAnswer.drawings.slice(0, 6) : [];
      if (mode === 'assisted') {
        const lines = [];
        lines.push('Specification requirement');
        if (specificationAnswer.answer) lines.push(specificationAnswer.answer);
        if (sections.length) {
          lines.push('');
          lines.push('What the Bedford source establishes');
          for (const item of sections) {
            lines.push(`- ${item.sectionNumber} — ${item.sectionTitle}${item.relationshipType ? ` (${item.relationshipType})` : ''}`);
            if (item.summary) lines.push(`  Evidence: ${item.summary}`);
          }
        }
        if (drawings.length) {
          lines.push('');
          lines.push('Field verification');
          for (const item of drawings) {
            lines.push(`- ${item.sheetNumber || item.pageId}${item.sheetTitle ? ` — ${item.sheetTitle}` : ''}${item.relationshipTypes?.length ? ` (${[...new Set(item.relationshipTypes)].join(', ')})` : ''}`);
          }
        }
        return lines.join('\n');
      }

      const lines = [];
      if (specificationAnswer.answer) lines.push(specificationAnswer.answer);
      if (sections.length) {
        lines.push('');
        lines.push('Related Specifications:');
        for (const item of sections) {
          lines.push(`- ${item.sectionNumber} — ${item.sectionTitle}${item.relationshipType ? ` (${item.relationshipType})` : ''}`);
          if (item.summary) lines.push(`  Evidence: ${item.summary}`);
        }
      }
      if (drawings.length) {
        lines.push('');
        lines.push('Related Drawings:');
        for (const item of drawings) {
          lines.push(`- ${item.sheetNumber || item.pageId}${item.sheetTitle ? ` — ${item.sheetTitle}` : ''}${item.relationshipTypes?.length ? ` (${[...new Set(item.relationshipTypes)].join(', ')})` : ''}`);
        }
      }
      return lines.join('\n');
    })();
    }

    if (!answerContent && pmisAnswer) {
      answerContent = pmisAnswer.answer || '';
    }

    const answer = {
      source: 'mission-companion',
      question,
      answer: answerContent,
      confidence: context.reasoningResult?.confidence || context.pmisAnswer?.confidence || (context.specificationAnswer?.specifications?.length ? 0.9 : 0),
      reasoningPath: context.reasoningResult?.reasoningPath || [],
      evidence: context.reasoningResult?.evidence || [],
      assumptions: context.reasoningResult?.assumptions || [],
      unresolvedQuestions: context.reasoningResult?.unresolvedQuestions || [],
      conflicts: context.reasoningResult?.conflicts || [],
      specificationAnswer: context.specificationAnswer,
      pmisAnswer: context.pmisAnswer,
      projectState: context.projectState,
      facts: context.facts,
      relationships: context.relationships,
      diagnostics: context.reasoningResult?.diagnostics || (context.pmisAnswer ? { source: 'pmis-sme' } : { source: 'specification-sme' })
    };

    return answer;
  }

  /**
   * Build context string for LLM
   */
  buildContextString(context) {
    if (!context.hasContext) {
      return '';
    }

    const parts = [];

    if (context.normalizedProjectRecordContext) {
      parts.push('CURRENT NORMALIZED PROJECT RECORD CONTEXT:');
      parts.push(context.normalizedProjectRecordContext);
      parts.push('Use CURRENT PROJECT VALUE for effective state. Treat SOURCE-REPORTED VALUE as provenance and do not attribute overrides to the source document.');
      parts.push('');
    }

    // Add project state
    if (context.projectState) {
      parts.push('PROJECT STATE:');
      parts.push(`Current Phase: ${context.projectState.project?.currentState || 'unknown'}`);
      parts.push(`Activation: ${context.projectState.activation?.currentState || 'unknown'}`);
      parts.push(`Turnover: ${context.projectState.turnover?.currentState || 'unknown'}`);
      parts.push(`Inspection: ${context.projectState.inspection?.currentState || 'unknown'}`);
      parts.push(`Deficiency: ${context.projectState.deficiency?.currentState || 'unknown'}`);
      parts.push('');
    }

    // Add reasoning result
    if (context.reasoningResult) {
      parts.push('REASONING RESULT:');
      parts.push(`Answer: ${context.reasoningResult.answer}`);
      parts.push(`Confidence: ${(context.reasoningResult.confidence * 100).toFixed(0)}%`);
      parts.push('');
      parts.push('Reasoning Path:');
      for (const step of context.reasoningResult.reasoningPath) {
        parts.push(`  - ${step}`);
      }
      parts.push('');
      
      if (context.reasoningResult.evidence.length > 0) {
        parts.push('Evidence:');
        for (const evidence of context.reasoningResult.evidence) {
          parts.push(`  - ${evidence.type}: ${evidence.title || evidence.id || evidence.statement}`);
        }
        parts.push('');
      }
    }

    // Add specification usage
    if (context.specificationUsage) {
      parts.push('SPECIFICATION USAGE:');
      if (context.specificationUsage.objects.length > 0) {
        parts.push(`Objects: ${context.specificationUsage.objects.join(', ')}`);
      }
      if (context.specificationUsage.pages.length > 0) {
        parts.push(`Drawing Pages: ${context.specificationUsage.pages.join(', ')}`);
      }
      if (context.specificationUsage.buildings.length > 0) {
        parts.push(`Buildings: ${context.specificationUsage.buildings.join(', ')}`);
      }
      if (context.specificationUsage.rooms.length > 0) {
        parts.push(`Rooms: ${context.specificationUsage.rooms.join(', ')}`);
      }
      parts.push('');
    }

    if (context.specificationAnswer) {
      parts.push('SPECIFICATION SME:');
      if (context.specificationAnswer.answer) {
        parts.push(context.specificationAnswer.answer);
      }
      if (context.specificationAnswer.specifications?.length > 0) {
        parts.push('Related Specifications:');
        for (const item of context.specificationAnswer.specifications.slice(0, 12)) {
          parts.push(`  - ${item.sectionNumber} — ${item.sectionTitle}${item.relationshipType ? ` (${item.relationshipType})` : ''}`);
          if (item.summary) {
            parts.push(`    Evidence: ${item.summary}`);
          }
        }
        parts.push('');
      }
      if (context.specificationAnswer.drawings?.length > 0) {
        parts.push('Related Drawings:');
        for (const item of context.specificationAnswer.drawings.slice(0, 12)) {
          parts.push(`  - ${item.sheetNumber || item.pageId}${item.sheetTitle ? ` — ${item.sheetTitle}` : ''}${item.relationshipTypes?.length ? ` (${[...new Set(item.relationshipTypes)].join(', ')})` : ''}`);
        }
        parts.push('');
      }
    }

    if (context.pmisAnswer) {
      parts.push('PMIS SME:');
      if (context.pmisAnswer.answer) {
        parts.push(context.pmisAnswer.answer);
      }
      if (context.pmisAnswer.summary) {
        parts.push(`Summary: ${context.pmisAnswer.summary}`);
      }
      if (context.pmisAnswer.building) {
        parts.push(`Building: ${context.pmisAnswer.building.label}`);
        parts.push(`Readiness: ${context.pmisAnswer.building.readinessPct}%`);
        parts.push(`Overall status: ${context.pmisAnswer.building.overallStatus}`);
        parts.push(`Construction ready: ${context.pmisAnswer.building.constructionReady}`);
        parts.push(`OIT readiness: ${context.pmisAnswer.building.oitReadiness}`);
        parts.push(`Open risks: ${context.pmisAnswer.building.openRisks}`);
        parts.push(`Open questions: ${context.pmisAnswer.building.openQuestions}`);
        parts.push(`Shutdowns: ${context.pmisAnswer.building.shutdownCount}`);
      }
      if (context.pmisAnswer.campus) {
        parts.push(`Buildings tracked: ${context.pmisAnswer.campus.total}`);
        parts.push(`Ready: ${context.pmisAnswer.campus.ready}`);
        parts.push(`Not ready: ${context.pmisAnswer.campus.notReady}`);
        parts.push(`Open risks: ${Math.round(context.pmisAnswer.campus.risks)}`);
        parts.push(`Open questions: ${Math.round(context.pmisAnswer.campus.questions)}`);
      }
      parts.push('');
    }

    // Add facts
    if (context.facts.length > 0) {
      parts.push('RELATED FACTS:');
      for (const fact of context.facts) {
        parts.push(`  - ${fact.subjectId} ${fact.predicate} ${fact.objectId} (${(fact.confidence * 100).toFixed(0)}% confidence)`);
      }
      parts.push('');
    }

    // Add relationships
    if (context.relationships.length > 0) {
      parts.push('RELATED RELATIONSHIPS:');
      for (const rel of context.relationships) {
        parts.push(`  - ${rel.sourceId} ${rel.type} ${rel.targetId} (${(rel.confidence * 100).toFixed(0)}% confidence)`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Check if there is sufficient project evidence
   */
  hasSufficientEvidence(context) {
    if (!context.hasContext) return false;
    
    const evidenceCount = 
      (context.reasoningResult?.evidence?.length || 0) +
      (context.facts?.length || 0) +
      (context.relationships?.length || 0) +
      (context.specificationAnswer?.specifications?.length || 0) +
      (context.specificationAnswer?.drawings?.length || 0) +
      (context.pmisAnswer ? 1 : 0);
    
    return evidenceCount > 0;
  }

  /**
   * Generate missing information notice
   */
  generateMissingInformationNotice(context) {
    const missing = [];
    
    if (!context.projectState) {
      missing.push('project state');
    }
    
    if (!context.reasoningResult) {
      missing.push('reasoning result');
    }
    
    if (context.facts.length === 0) {
      missing.push('related facts');
    }
    
    if (context.relationships.length === 0) {
      missing.push('related relationships');
    }
    
    if (missing.length === 0) {
      return null;
    }
    
    return `The project does not currently contain enough information to answer this question. Missing: ${missing.join(', ')}.`;
  }
}

let chiefIntelligenceBridgeInstance = null;

export function createChiefIntelligenceBridge() {
  if (!chiefIntelligenceBridgeInstance) {
    chiefIntelligenceBridgeInstance = new ChiefIntelligenceBridge();
  }
  return chiefIntelligenceBridgeInstance;
}

export function getChiefIntelligenceBridge() {
  return chiefIntelligenceBridgeInstance;
}
