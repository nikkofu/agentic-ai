import { EventBus, RuntimeEvent } from "./eventBus";
import { TaskStore } from "./taskStore";
import { TaskGraph } from "../types/runtime";

function fireAndForget(promise: Promise<unknown>) {
  promise.catch(() => {
    // swallow async persistence errors to avoid unhandled rejections
  });
}

export function createPersistenceManager(eventBus: EventBus, taskStore: TaskStore) {
  // 1. 全量记录事件日志
  eventBus.subscribe("*", (event: RuntimeEvent) => {
    fireAndForget(taskStore.appendEvent(event));
  });

  // 2. 根据关键事件同步任务状态
  eventBus.subscribe("TaskSubmitted", (event: RuntimeEvent) => {
    fireAndForget(taskStore.createGraph({
      taskId: event.payload.task_id as string,
      rootNodeId: (event.payload.node_id as string) || "root"
    }));
  });

  eventBus.subscribe("NodeScheduled", (event: RuntimeEvent) => {
    fireAndForget(taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      role: "planner", // Default role
      state: "pending",
      depth: 0,
      attempt: 1,
      inputSummary: ""
    }));
  });

  eventBus.subscribe("AgentStarted", (event: RuntimeEvent) => {
    fireAndForget(taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      role: event.payload.role as any,
      state: "running",
      depth: 0,
      attempt: 1,
      inputSummary: ""
    }));
  });

  eventBus.subscribe("Evaluated", (event: RuntimeEvent) => {
    fireAndForget(taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      role: "planner",
      state: event.payload.decision === "stop" ? "completed" : "evaluating",
      depth: 0,
      attempt: 1,
      inputSummary: "",
      outputSummary: JSON.stringify(event.payload)
    }));
  });

  eventBus.subscribe("TaskClosed", (event: RuntimeEvent) => {
    const state = event.payload.state as string;
    const validStates: TaskGraph["status"][] = ["running", "completed", "failed", "aborted"];
    if (validStates.includes(state as any)) {
      fireAndForget(taskStore.updateGraphStatus(event.payload.task_id as string, state as any));
    }
  });
}
