import { create } from 'zustand';
import { Connection, Edge, Node, Position } from 'reactflow';
import dagre from '@dagrejs/dagre';
import { RuntimeEvent, TaskMetrics, NodeData } from '../types/events';

interface TaskState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  metrics: TaskMetrics;
  processEvent: (event: RuntimeEvent) => void;
  reset: () => void;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });
};

export const useTaskStore = create<TaskState>((set, get) => ({
  nodes: [],
  edges: [],
  metrics: {
    totalTokens: 0,
    totalCost: 0,
  },

  reset: () => set({ nodes: [], edges: [], metrics: { totalTokens: 0, totalCost: 0 } }),

  processEvent: (event: RuntimeEvent) => {
    const { type, payload } = event;
    const { nodes, edges, metrics } = get();

    let newNodes = [...nodes];
    let newEdges = [...edges];
    let newMetrics = { ...metrics };

    switch (type) {
      case 'NodeScheduled': {
        const nodeId = payload.node_id;
        const parentId = payload.parent_node_id;

        if (!newNodes.find((n) => n.id === nodeId)) {
          newNodes.push({
            id: nodeId,
            data: { label: nodeId, role: 'unknown', status: 'pending' },
            position: { x: 0, y: 0 },
            type: 'default',
          });

          if (parentId) {
            newEdges.push({
              id: `e-${parentId}-${nodeId}`,
              source: parentId,
              target: nodeId,
              animated: true,
            });
          }
        }
        break;
      }

      case 'AgentStarted': {
        const { node_id, role } = payload;
        newNodes = newNodes.map((node) =>
          node.id === node_id
            ? { ...node, data: { ...node.data, role, status: 'running' as const } }
            : node
        );
        break;
      }

      case 'ToolInvoked': {
        const { node_id } = payload;
        newNodes = newNodes.map((node) =>
          node.id === node_id
            ? { ...node, data: { ...node.data, status: 'waiting_tool' as const } }
            : node
        );
        break;
      }

      case 'ToolReturned': {
        const { node_id } = payload;
        newNodes = newNodes.map((node) =>
          node.id === node_id
            ? { ...node, data: { ...node.data, status: 'running' as const } }
            : node
        );
        break;
      }

      case 'Evaluated': {
        const { node_id, decision, metrics: evalMetrics } = payload;
        newNodes = newNodes.map((node) =>
          node.id === node_id
            ? { ...node, data: { ...node.data, decision, status: 'evaluating' as const } }
            : node
        );
        if (evalMetrics?.costUsd) {
          newMetrics.totalCost += evalMetrics.costUsd;
        }
        break;
      }

      case 'NodeCompleted': {
        const { node_id } = payload;
        newNodes = newNodes.map((node) =>
          node.id === node_id
            ? { ...node, data: { ...node.data, status: 'completed' as const } }
            : node
        );
        break;
      }

      case 'NodeFailed':
      case 'NodeAborted': {
        const { node_id } = payload;
        newNodes = newNodes.map((node) =>
          node.id === node_id
            ? { ...node, data: { ...node.data, status: type === 'NodeFailed' ? 'failed' : 'aborted' as const } }
            : node
        );
        break;
      }

      case 'ModelCalled': {
          // Tokens might be here in some implementations, but for now we update metrics in Evaluated or separate usage events
          if (payload.usage?.total_tokens) {
              newMetrics.totalTokens += payload.usage.total_tokens;
          }
          break;
      }
    }

    // Recalculate layout
    const layoutedNodes = getLayoutedElements(newNodes, newEdges);

    set({ nodes: layoutedNodes, edges: newEdges, metrics: newMetrics });
  },
}));
