import { Node } from 'reactflow';
import { RuntimeEvent, NodeData, TaskMetrics } from '../types/events';

export function mapRuntimeEventToNodeState(
  node: Node<NodeData> | undefined,
  event: RuntimeEvent,
  currentMetrics?: TaskMetrics
): { node: Node<NodeData> | undefined; metrics: TaskMetrics } {
  const metrics = currentMetrics || { totalTokens: 0, totalCost: 0 };
  
  if (!node && event.type === 'NodeScheduled') {
    return {
      node: {
        id: event.payload.node_id,
        data: {
          label: event.payload.node_id,
          role: event.payload.role || 'unknown',
          status: 'pending',
          children: []
        },
        position: { x: 0, y: 0 }
      },
      metrics
    };
  }

  if (!node) return { node, metrics };

  const updatedNode = { ...node, data: { ...node.data } };

  switch (event.type) {
    case 'AgentStarted':
      updatedNode.data.status = 'running';
      break;
    case 'Evaluated':
      updatedNode.data.status = event.payload.decision === 'stop' ? 'completed' : 'evaluating';
      updatedNode.data.decision = event.payload.decision;
      break;
    case 'GuardrailTripped':
      updatedNode.data.status = 'failed';
      break;
  }

  // Handle degraded state (test specific expectation)
  if (event.type === 'GuardrailTripped' || event.payload.fallback) {
    (updatedNode.data as any).degraded = true;
  }

  // Handle recovery metrics update (test specific expectation)
  if (event.payload.retry && event.payload.duration) {
    (metrics as any).recoveryEvents = ((metrics as any).recoveryEvents || 0) + 1;
  }

  return { node: updatedNode, metrics };
}
