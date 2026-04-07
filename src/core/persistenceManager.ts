import { RuntimeEvent } from "./eventBus";
import { TaskStore } from "./taskStore";
import { TaskGraph, TaskNode, AgentRole } from "../types/runtime";

type EventBus = {
  subscribe: (pattern: string, callback: (event: RuntimeEvent) => void) => void;
};

export function createPersistenceManager(eventBus: EventBus, taskStore: TaskStore) {
  eventBus.subscribe("*", async (event: RuntimeEvent) => {
    const { type, payload } = event;
    const taskId = payload.task_id as string;

    if (!taskId) return;

    // 所有的事件都应调用 appendEvent
    await taskStore.appendEvent(taskId, event);

    switch (type) {
      case "TaskSubmitted":
        // TaskSubmitted -> createGraph
        await taskStore.createGraph({
          taskId,
          rootNodeId: (payload.root_node_id as string) || "root",
          frontier: [],
          nodes: {},
          status: "running",
          createdAt: new Date(event.ts).toISOString()
        });
        break;

      case "NodeScheduled":
      case "AgentStarted":
      case "ToolInvoked":
      case "ToolReturned":
      case "Evaluated":
        // NodeScheduled, AgentStarted, ToolInvoked, ToolReturned, Evaluated -> upsertNode
        const nodeId = payload.node_id as string;
        if (!nodeId) break;

        const existingGraph = await taskStore.getGraph(taskId);
        const existingNode = existingGraph?.nodes[nodeId];

        const nodeState = mapEventToNodeState(type, payload);
        
        const node: TaskNode = {
          nodeId,
          role: (payload.role as AgentRole) || existingNode?.role || "planner",
          state: nodeState,
          depth: (payload.depth as number) || existingNode?.depth || 0,
          attempt: (payload.attempt as number) || existingNode?.attempt || 1,
          inputSummary: (payload.input_summary as string) || existingNode?.inputSummary || "",
          children: (payload.children as string[]) || existingNode?.children || [],
          parentNodeId: (payload.parent_node_id as string) || existingNode?.parentNodeId,
          outputSummary: (payload.output_summary as string) || existingNode?.outputSummary,
        };
        
        // If it's Evaluated, we might have metrics
        if (type === "Evaluated" && payload.decision) {
           // We could map decision to state here if needed, 
           // but the requirement says map to corresponding node state.
        }

        await taskStore.upsertNode(taskId, node);
        break;

      case "TaskClosed":
        // TaskClosed -> updateGraphStatus
        const state = payload.state as string;
        let status: TaskGraph["status"] = "completed";
        if (state === "aborted") status = "aborted";
        if (state === "failed") status = "failed";
        await taskStore.updateGraphStatus(taskId, status);
        break;
    }
  });
}

function mapEventToNodeState(eventType: string, payload: Record<string, unknown>): TaskNode["state"] {
  switch (eventType) {
    case "NodeScheduled": return "pending";
    case "AgentStarted": return "running";
    case "ToolInvoked": return "waiting_tool";
    case "ToolReturned": return "running";
    case "Evaluated": 
        if (payload.decision === "stop") return "completed";
        return "evaluating";
    default: return "pending";
  }
}
