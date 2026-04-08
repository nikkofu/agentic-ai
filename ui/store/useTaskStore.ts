import { create } from 'zustand';
import { Edge, Node } from 'reactflow';
import dagre from '@dagrejs/dagre';
import { RuntimeEvent, TaskMetrics, NodeData } from '../types/events';

interface TaskState {
  nodes: Node<NodeData>[];
  edges: Edge[];
  metrics: TaskMetrics;
  processEvent: (event: RuntimeEvent) => void;
  reset: () => void;
}

function summarizeDelivery(payload: Record<string, unknown>) {
  const delivery = payload.delivery as Record<string, unknown> | undefined;
  const finalResult =
    typeof payload.final_result === 'string'
      ? payload.final_result
      : typeof delivery?.final_result === 'string'
        ? delivery.final_result
        : '';
  const blockingReason =
    typeof payload.blocking_reason === 'string'
      ? payload.blocking_reason
      : typeof delivery?.blocking_reason === 'string'
        ? delivery.blocking_reason
        : '';

  if (finalResult.trim()) {
    return finalResult;
  }

  if (blockingReason.trim()) {
    return `blocked: ${blockingReason}`;
  }

  return '';
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  if (nodes.length === 0) return { nodes, edges };
  
  try {
    dagreGraph.setGraph({ rankdir: 'LR', align: 'UL', nodesep: 80, ranksep: 150 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 220, height: 100 });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    return {
      nodes: nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        return {
          ...node,
          position: {
            x: nodeWithPosition.x - 110,
            y: nodeWithPosition.y - 50,
          },
        };
      }),
      edges,
    };
  } catch (e) {
    return { nodes, edges };
  }
};

export const useTaskStore = create<TaskState>((set) => ({
  nodes: [],
  edges: [],
  metrics: { totalTokens: 0, totalCost: 0 },

  reset: () => set({
    nodes: [],
    edges: [],
    metrics: { totalTokens: 0, totalCost: 0 }
  }),

  processEvent: (event: RuntimeEvent) => {
    const { type, payload } = event;

    set((state) => {
      let newNodes = [...state.nodes];
      let newEdges = [...state.edges];
      let newMetrics = { ...state.metrics };

      const nodeId = (payload.node_id as string);
      if (!nodeId && type !== 'TaskSubmitted') return state;

      switch (type) {
        case 'TaskSubmitted':
          return { nodes: [], edges: [], metrics: { totalTokens: 0, totalCost: 0 } };

        case 'NodeScheduled':
          if (!newNodes.find((n) => n.id === nodeId)) {
            const parentId = payload.parent_node_id as string;
            const nodeType = payload.type as string;

            newNodes.push({
              id: nodeId,
              data: { 
                label: nodeId, 
                role: (payload.role as string) || 'planner', 
                status: nodeType === 'hitl' ? 'waiting_hitl' : 'pending',
                children: []
              },
              // 针对不同类型应用特殊样式
              className: nodeType === 'hitl' ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : '',
              position: { x: 0, y: 0 },
            });
            
            if (parentId && newNodes.find(n => n.id === parentId)) {
              newEdges.push({
                id: `e-${parentId}-${nodeId}`,
                source: parentId,
                target: nodeId,
                animated: true,
                label: nodeType,
                style: { stroke: nodeType === 'hitl' ? '#f97316' : '#3b82f6' }
              });
            }
          }
          break;

        case 'AgentStarted':
          newNodes = newNodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n
          );
          break;

        case 'ToolInvoked':
          newNodes = newNodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, status: 'waiting_tool' } } : n
          );
          break;

        case 'ToolReturned':
          newNodes = newNodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n
          );
          break;

        case 'Evaluated':
          if (payload.usage) {
            newMetrics.totalTokens += (payload.usage as any).total_tokens || 0;
            newMetrics.totalCost += (payload.cost as number) || 0;
          }
          newNodes = newNodes.map((n) =>
            n.id === nodeId ? { 
              ...n, 
              data: { 
                ...n.data, 
                status: payload.decision === 'stop' ? 'completed' : 'evaluating',
                thought: payload.thought as string,
                outputSummary: (payload.output_text as string)
              } 
            } : n
          );
          break;

        case 'NodeCompleted':
          newNodes = newNodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, status: 'completed' } } : n
          );
          break;

        case 'NodeAborted':
          newNodes = newNodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, status: 'failed' } } : n
          );
          break;
          
        case 'HumanActionRequired':
          newNodes = newNodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, status: 'waiting_hitl' } } : n
          );
          break;

        case 'TaskClosed':
          if (newNodes.length > 0) {
            const targetId = newNodes.find((n) => n.id === 'node-root')?.id ?? newNodes[0].id;
            const outputSummary = summarizeDelivery(payload);
            newNodes = newNodes.map((n) =>
              n.id === targetId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status: payload.state === 'completed' ? 'completed' : 'failed',
                      outputSummary: outputSummary || n.data.outputSummary
                    }
                  }
                : n
            );
          }
          break;
      }

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
      return { nodes: layoutedNodes, edges: layoutedEdges, metrics: newMetrics };
    });
  },
}));
