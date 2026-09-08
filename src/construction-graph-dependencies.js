const TYPES = new Set(['finish-to-start','prerequisite','approval-required','material-required','inspection-required','testing-required','shutdown-required','access-required','predecessor-work','owner-decision-required']);
const EDGE_TYPES = { 'finish-to-start':'predecessor-of', prerequisite:'depends-on', 'approval-required':'requires', 'material-required':'requires', 'inspection-required':'inspected-by', 'testing-required':'tested-by', 'shutdown-required':'requires', 'access-required':'requires', 'predecessor-work':'depends-on', 'owner-decision-required':'requires' };
export function createConstructionGraphDependencyEngine() {
  return {
    register(graph, input = {}) { if (!graph || !TYPES.has(input.dependencyType)) return null; return graph.registerEdge({ ...input, sourceNodeId: input.predecessorNodeId, targetNodeId: input.successorNodeId, edgeType: EDGE_TYPES[input.dependencyType], metadata: { ...input.metadata, dependencyType: input.dependencyType, blockingState: input.blockingState || 'unknown', status: input.status || 'unknown', freshness: input.freshness || null } }); },
    forNode(graph, nodeId, options = {}) { return graph?.getDependencies?.(nodeId, options) || []; }
  };
}
export const CONSTRUCTION_DEPENDENCY_TYPES = Object.freeze([...TYPES]);
