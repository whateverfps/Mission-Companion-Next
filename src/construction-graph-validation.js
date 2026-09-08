import { CONSTRUCTION_EDGE_TYPES } from './construction-graph.js';
export function validateConstructionGraph(graph, projectId) {
  const findings = [...(graph?.validateProjectGraph?.(projectId) || [])]; const nodes=graph?.findNodes?.({projectId,verificationStates:['confirmed','suggested','rejected','historical'],limit:1000})||[]; const edges=graph?.findEdges?.({projectId,verificationStates:['confirmed','suggested','rejected','historical'],limit:1000})||[];
  for(const edge of edges){if(!CONSTRUCTION_EDGE_TYPES.includes(edge.edgeType))findings.push({code:'invalid-edge-type',edgeId:edge.edgeId});if(edge.verificationState==='rejected'&&edge.metadata?.active) findings.push({code:'rejected-edge-active',edgeId:edge.edgeId});if(edge.auditHistory?.length>20)findings.push({code:'unbounded-audit-payload',edgeId:edge.edgeId});}
  const keys=new Map();for(const node of nodes){if(node.auditHistory?.length>20)findings.push({code:'unbounded-audit-payload',nodeId:node.nodeId});if(node.normalizedKey){const key=`${node.nodeType}:${node.normalizedKey}`;if(keys.has(key)&&keys.get(key)!==node.nodeId)findings.push({code:'duplicate-permanent-identity',nodeIds:[keys.get(key),node.nodeId]});else keys.set(key,node.nodeId);}}
  return findings.sort((a,b)=>a.code.localeCompare(b.code)||String(a.edgeId||a.nodeId||'').localeCompare(String(b.edgeId||b.nodeId||'')));
}
