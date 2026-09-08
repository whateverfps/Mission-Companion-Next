export function createConstructionGraphHistoryService({ persistence = null } = {}) {
  return { async get(nodeId, graph, options = {}) { const local=graph?.getHistory?.(nodeId,options)||[]; const stored=await persistence?.loadHistory?.(options.projectId,nodeId)||[]; return [...new Map([...stored,...local].map(item=>[item.historyId,item])).values()].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))); } };
}
