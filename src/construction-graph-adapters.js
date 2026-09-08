const text = value => value === null || value === undefined ? '' : String(value).trim();
export function adaptDrawingPageToGraph(graph, { projectId, document, drawingSetId, page } = {}) {
  if (!graph || !text(projectId) || !page?.pageId) return [];
  const records = [
    { nodeId:`document:${document.id}`,projectId,nodeType:'document',title:document.title||document.name,sourceSystem:'drawing-catalog',sourceRecordId:document.id,sourceDocumentId:document.id,verificationState:'confirmed',origin:'imported',metadata:{documentType:document.documentType} },
    { nodeId:`drawing-set:${drawingSetId||document.id}`,projectId,nodeType:'drawing-set',title:document.title||document.name,sourceSystem:'drawing-catalog',sourceRecordId:drawingSetId||document.id,sourceDocumentId:document.id,verificationState:'confirmed',origin:'imported' },
    { nodeId:`drawing-page:${page.pageId}`,projectId,nodeType:'drawing-page',title:page.sheetTitle||`Page ${page.pdfPageNumber||page.pageNumber}`,label:page.sheetNumber||`Page ${page.pdfPageNumber||page.pageNumber}`,normalizedKey:page.normalizedSheetNumber,sourceSystem:'drawing-catalog',sourceRecordId:page.pageId,sourceDocumentId:document.id,sourcePageId:page.pageId,buildingId:page.building,trade:page.discipline,verificationState:page.identityStatus==='authoritative'?'confirmed':'suggested',origin:page.identityStatus==='manual'?'manual':'imported',metadata:{pdfPageNumber:page.pdfPageNumber||page.pageNumber,drawingType:page.drawingType} }
  ].map(graph.registerNode).filter(Boolean);
  graph.registerEdge({projectId,sourceNodeId:records[1]?.nodeId,targetNodeId:records[2]?.nodeId,edgeType:'contains',scope:'page',confidence:1,verificationState:'confirmed',origin:'imported'});
  return records;
}

export function adaptSpecificationSectionToGraph(graph, section = {}) {
  const sectionId=section.sectionId||`specification-section:${section.documentId}:${section.normalizedSectionNumber}`;
  return graph?.registerNode?.({nodeId:sectionId,projectId:section.projectId,nodeType:'specification-section',title:section.sectionTitle,label:`${section.sectionNumber} — ${section.sectionTitle}`,normalizedKey:section.normalizedSectionNumber,sourceSystem:'specification-index',sourceRecordId:sectionId,sourceDocumentId:section.documentId,verificationState:section.verificationState||'confirmed',origin:'imported',metadata:{sectionNumber:section.sectionNumber,startPdfPage:section.startPdfPage,endPdfPage:section.endPdfPage}})||null;
}

export function adaptPmisRecordToGraph(graph, record = {}) {
  const typeMap={risk:'risk','open-question':'question',shutdown:'shutdown',inspection:'inspection','schedule-activity':'schedule-activity','procurement-item':'procurement-item','commissioning-gate':'commissioning-item','progress-metric':'progress-record','readiness-gate':'readiness-record','work-package':'work-package'};
  const nodeType=typeMap[record.operationType||record.type]; if(!nodeType)return null;
  return graph.registerNode({nodeId:`pmis:${record.projectId}:${nodeType}:${record.recordId||record.id}`,projectId:record.projectId,nodeType,title:record.title||record.label,label:record.label||record.title,sourceSystem:'pmis',sourceRecordId:record.recordId||record.id,buildingId:record.buildingId,status:record.status,verificationState:'confirmed',origin:'imported',freshness:{sourceUpdatedAt:record.updatedAt,ingestedAt:record.ingestedAt,stale:Boolean(record.stale)},metadata:{responsibleParty:record.responsibleParty,evidence:record.evidence,dueDate:record.dueDate}});
}
