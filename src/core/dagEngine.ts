import { DagWorkflow, DagNode } from "../types/dag";

export function resolveExecutionTiers(workflow: DagWorkflow): DagNode[][] {
  const nodes = workflow.nodes;
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  const nodeMap = new Map<string, DagNode>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    graph.set(node.id, []);
  }

  for (const node of nodes) {
    for (const dep of node.depends_on) {
      if (!graph.has(dep)) {
        throw new Error(`Dependency ${dep} not found for node ${node.id}`);
      }
      graph.get(dep)!.push(node.id);
      inDegree.set(node.id, inDegree.get(node.id)! + 1);
    }
  }

  const tiers: DagNode[][] = [];
  let processedCount = 0;
  
  let currentTier = nodes.filter(n => inDegree.get(n.id) === 0);

  while (currentTier.length > 0) {
    tiers.push(currentTier);
    processedCount += currentTier.length;

    const nextTier: DagNode[] = [];
    for (const node of currentTier) {
      for (const neighbor of graph.get(node.id)!) {
        const newInDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newInDegree);
        if (newInDegree === 0) {
          nextTier.push(nodeMap.get(neighbor)!);
        }
      }
    }
    currentTier = nextTier;
  }

  if (processedCount < nodes.length) {
    throw new Error("Circular dependency detected in DAG");
  }

  return tiers;
}
