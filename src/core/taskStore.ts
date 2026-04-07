import { TaskGraph, TaskNode } from "../types/runtime";
import { RuntimeEvent } from "./eventBus";

export interface TaskStore {
  createGraph(graph: TaskGraph): Promise<void>;
  upsertNode(taskId: string, node: TaskNode): Promise<void>;
  updateGraphStatus(taskId: string, status: TaskGraph["status"]): Promise<void>;
  appendEvent(taskId: string, event: RuntimeEvent): Promise<void>;
  getGraph(taskId: string): Promise<TaskGraph | null>;
  getEvents(taskId: string): Promise<RuntimeEvent[]>;
}

export function createInMemoryTaskStore(): TaskStore {
  const graphs = new Map<string, TaskGraph>();
  const events = new Map<string, RuntimeEvent[]>();

  return {
    async createGraph(graph: TaskGraph) {
      // Deep copy to prevent external mutations affecting the store
      graphs.set(graph.taskId, { ...graph, nodes: { ...graph.nodes } });
      events.set(graph.taskId, []);
    },
    async upsertNode(taskId: string, node: TaskNode) {
      const graph = graphs.get(taskId);
      if (!graph) throw new Error(`Graph ${taskId} not found`);
      graph.nodes[node.nodeId] = { ...node };
    },
    async updateGraphStatus(taskId: string, status: TaskGraph["status"]) {
      const graph = graphs.get(taskId);
      if (!graph) throw new Error(`Graph ${taskId} not found`);
      graph.status = status;
    },
    async appendEvent(taskId: string, event: RuntimeEvent) {
      const log = events.get(taskId) || [];
      log.push({ ...event });
      events.set(taskId, log);
    },
    async getGraph(taskId: string) {
      const graph = graphs.get(taskId);
      if (!graph) return null;
      // Return a shallow copy of nodes to prevent some mutations, but deep copy would be safer
      return { ...graph, nodes: { ...graph.nodes } };
    },
    async getEvents(taskId: string) {
      return [...(events.get(taskId) || [])];
    }
  };
}
