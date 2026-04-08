import { create } from 'zustand';
import { Edge, Node } from 'reactflow';
import dagre from '@dagrejs/dagre';
import { RuntimeEvent, TaskMetrics, NodeData } from '../types/events';

interface TaskState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  metrics: TaskMetrics;
  processEvent: (event: RuntimeEvent) => void;
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'TB' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 150, height: 50 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 75,
      y: nodeWithPosition.y - 25,
    };
  });

  return { nodes, edges };
};

export const useTaskStore = create<TaskState>((set, get) => ({
  nodes: [],
  edges: [],
  metrics: { totalTokens: 0, totalCost: 0 },

  processEvent: (event: RuntimeEvent) => {
    const { type, payload } = event;

    set((state) => {
      let newNodes = [...state.nodes];
      let newEdges = [...state.edges];
      let newMetrics = { ...state.metrics };

      switch (type) {
        case 'TaskSubmitted':
          // Reset or init for new task? For now let's assume one task per session
          break;

        case 'NodeScheduled':
          const nodeId = payload.node_id;
          if (!newNodes.find((n) => n.id === nodeId)) {
            newNodes.push({
              id: nodeId,
              data: { 
                label: nodeId, 
                role: payload.role || 'unknown', 
                status: 'pending',
                children: [] // 补全缺失字段
              },
              position: { x: 0, y: 0 },
            });
            if (payload.parent_node_id) {
              newEdges.push({
                id: `e-\${payload.parent_node_id}-\${nodeId}`,
                source: payload.parent_node_id,
                target: nodeId,
              });
            }
          }
          break;

        case 'AgentStarted':
          newNodes = newNodes.map((n) =>
            n.id === payload.node_id ? { ...n, data: { ...n.data, status: 'running' as const } } : n
          );
          break;

        case 'Evaluated':
          newNodes = newNodes.map((n) =>
            n.id === payload.node_id ? { 
              ...n, 
              data: { 
                ...n.data, 
                status: payload.decision === 'stop' ? 'completed' : 'evaluating' as any,
                decision: payload.decision,
                outputSummary: JSON.stringify(payload.scores)
              } 
            } : n
          );
          break;
      }

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
      return { nodes: layoutedNodes, edges: layoutedEdges, metrics: newMetrics };
    });
  },
}));
