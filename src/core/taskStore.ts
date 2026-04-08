import { TaskGraph, TaskNode, AgentRole } from "../types/runtime";
import { RuntimeEvent } from "./eventBus";

export type TaskNodeInput = {
  nodeId: string;
  parentNodeId?: string;
  role: AgentRole;
  state: TaskNode["state"];
  depth: number;
  attempt: number;
  inputSummary: string;
  outputSummary?: string;
};

export type TaskGraphInput = {
  taskId: string;
  rootNodeId: string;
};

export interface TaskStore {
  createGraph(input: TaskGraphInput): Promise<void>;
  upsertNode(taskId: string, node: TaskNodeInput): Promise<void>;
  updateGraphStatus(taskId: string, status: TaskGraph["status"]): Promise<void>;
  appendEvent(event: RuntimeEvent): Promise<void>;
  getGraph(taskId: string): Promise<TaskGraph | null>;
  getNode(taskId: string, nodeId: string): Promise<TaskNode | null>;
  getEvents(taskId: string): Promise<RuntimeEvent[]>;
  cloneNode(taskId: string, sourceNodeId: string, newNodeId: string): Promise<void>;
}

export function createInMemoryTaskStore(): TaskStore {
  const graphs = new Map<string, TaskGraph>();
  const events = new Map<string, RuntimeEvent[]>();

  return {
    async createGraph(input: TaskGraphInput) {
      graphs.set(input.taskId, {
        taskId: input.taskId,
        rootNodeId: input.rootNodeId,
        frontier: [],
        nodes: {},
        status: "running",
        createdAt: new Date().toISOString()
      });
      events.set(input.taskId, []);
    },
    async upsertNode(taskId: string, node: TaskNodeInput) {
      const graph = graphs.get(taskId);
      if (!graph) throw new Error(`Graph ${taskId} not found`);
      graph.nodes[node.nodeId] = { 
        ...node,
        children: graph.nodes[node.nodeId]?.children ?? [] 
      };
    },
    async updateGraphStatus(taskId: string, status: TaskGraph["status"]) {
      const graph = graphs.get(taskId);
      if (!graph) throw new Error(`Graph ${taskId} not found`);
      graph.status = status;
    },
    async appendEvent(event: RuntimeEvent) {
      const taskId = (event.payload?.task_id as string) || "unknown";
      const log = events.get(taskId) || [];
      log.push({ ...event });
      events.set(taskId, log);
    },
    async getGraph(taskId: string) {
      const graph = graphs.get(taskId);
      if (!graph) return null;
      return { ...graph, nodes: { ...graph.nodes } };
    },
    async getNode(taskId: string, nodeId: string) {
      const graph = graphs.get(taskId);
      return graph?.nodes[nodeId] ?? null;
    },
    async getEvents(taskId: string) {
      return [...(events.get(taskId) || [])];
    },
    async cloneNode(taskId: string, sourceNodeId: string, newNodeId: string) {
      const graph = graphs.get(taskId);
      if (!graph) throw new Error(`Graph ${taskId} not found`);
      const sourceNode = graph.nodes[sourceNodeId];
      if (!sourceNode) throw new Error(`Node ${sourceNodeId} not found in graph ${taskId}`);
      
      graph.nodes[newNodeId] = {
        ...sourceNode,
        nodeId: newNodeId,
        state: "pending",
        children: [],
        metrics: undefined,
        outputSummary: undefined
      };
    }
  };
}
