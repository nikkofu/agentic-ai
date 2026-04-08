import { EventBus, RuntimeEvent } from "./eventBus";
import { TaskStore } from "./taskStore";
import { TaskGraph } from "../types/runtime";
import { logAuditEvent } from "./auditTrail";

export function createPersistenceManager(eventBus: EventBus, taskStore: TaskStore) {
  // 1. 全量记录事件日志
  eventBus.subscribe("*", (event: RuntimeEvent) => {
    taskStore.appendEvent(event);
    logAuditEvent(event);
  });

  // 2. 根据关键事件同步任务状态
  eventBus.subscribe("TaskSubmitted", (event: RuntimeEvent) => {
    taskStore.createGraph({
      taskId: event.payload.task_id as string,
      rootNodeId: event.payload.node_id as string || "root"
    });
  });

  eventBus.subscribe("NodeScheduled", (event: RuntimeEvent) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      parentNodeId: event.payload.parent_node_id as string | undefined,
      role: (event.payload.role as any) || "planner",
      state: "pending",
      depth: Number(event.payload.depth ?? 0),
      attempt: Number(event.payload.attempt ?? 1),
      inputSummary: String(event.payload.input_summary ?? "")
    });
  });

  eventBus.subscribe("AgentStarted", (event: RuntimeEvent) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      parentNodeId: event.payload.parent_node_id as string | undefined,
      role: event.payload.role as any,
      state: "running",
      depth: Number(event.payload.depth ?? 0),
      attempt: Number(event.payload.attempt ?? 1),
      inputSummary: String(event.payload.input_summary ?? "")
    });
  });

  eventBus.subscribe("Evaluated", (event: RuntimeEvent) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      parentNodeId: event.payload.parent_node_id as string | undefined,
      role: (event.payload.role as any) || "planner",
      state: event.payload.decision === "stop" ? "completed" : "evaluating",
      depth: Number(event.payload.depth ?? 0),
      attempt: Number(event.payload.attempt ?? 1),
      inputSummary: String(event.payload.input_summary ?? ""),
      outputSummary: JSON.stringify(event.payload)
    });
  });

  eventBus.subscribe("TaskClosed", (event: RuntimeEvent) => {
    const state = event.payload.state as string;
    const validStates: TaskGraph["status"][] = ["running", "completed", "failed", "aborted"];
    if (validStates.includes(state as any)) {
      taskStore.updateGraphStatus(event.payload.task_id as string, state as any);
    }
  });
}
