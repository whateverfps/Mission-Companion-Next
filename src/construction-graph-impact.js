export function createConstructionGraphImpactEngine() {
  return { evaluate(graph, nodeId, options = {}) { const result = graph?.getImpacts?.(nodeId, options) || { affects: [], affectedBy: [] }; const withPaths = items => items.map(item => ({ ...item, path: graph.getPath(nodeId, item.node.nodeId, { ...options, maxDepth: options.maxDepth || 4 }) })).filter(item => item.path); return { affects: withPaths(result.affects), affectedBy: withPaths(result.affectedBy) }; } };
}
