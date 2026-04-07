import { EventBus, RuntimeEvent } from "./eventBus";
import { TaskStore } from "./taskStore";

export function createPersistenceManager(eventBus: EventBus, taskStore: TaskStore) {
  // 1. 全量记录事件日志
  eventBus.subscribe("*", (event) => {
    taskStore.appendEvent(event);
  });

  // 2. 根据关键事件同步任务状态
  eventBus.subscribe("TaskSubmitted", (event) => {
    taskStore.createGraph({
      taskId: event.payload.task_id as string,
      rootNodeId: event.payload.node_id as string || "root"
    });
  });

  eventBus.subscribe("NodeScheduled", (event) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      role: "planner", // Default role
      state: "pending",
      depth: 0,
      attempt: 1,
      inputSummary: ""
    });
  });

  eventBus.subscribe("AgentStarted", (event) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      role: event.payload.role as any,
      state: "running",
      depth: 0,
      attempt: 1,
      inputSummary: ""
    });
  });

  eventBus.subscribe("Evaluated", (event) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      role: "planner", 
      state: event.payload.decision === "stop" ? "completed" : "evaluating",
      depth: 0,
      attempt: 1,
      inputSummary: "",
      outputSummary: JSON.stringify(event.payload)
    });
  });

  eventBus.subscribe("TaskClosed", (event) => {
    taskStore.updateGraphStatus(event.payload.task_id as string, event.payload.state as string);
  });
}
