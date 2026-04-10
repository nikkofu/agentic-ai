import { EventBus, RuntimeEvent } from "./eventBus";
import { TaskStore } from "./taskStore";
import { TaskGraph } from "../types/runtime";
import { logAuditEvent } from "./auditTrail";

function summarizeAsyncDelivery(payload: Record<string, unknown>) {
  const delivery = payload.delivery as Record<string, unknown> | undefined;
  const finalResult =
    typeof payload.final_result === "string"
      ? payload.final_result
      : typeof delivery?.final_result === "string"
        ? delivery.final_result
        : "";
  const blockingReason =
    typeof payload.blocking_reason === "string"
      ? payload.blocking_reason
      : typeof delivery?.blocking_reason === "string"
        ? delivery.blocking_reason
        : "";

  if (finalResult.trim()) {
    return finalResult;
  }

  if (blockingReason.trim()) {
    return `blocked: ${blockingReason}`;
  }

  return "";
}

async function syncJoinPlaceholder(taskStore: TaskStore, taskId: string) {
  const graph = await taskStore.getGraph(taskId);
  if (!graph) {
    return;
  }

  const joinNodeId = `join-${taskId}`;
  const joinNode = graph.nodes[joinNodeId];
  if (!joinNode) {
    return;
  }

  const siblingNodes = Object.values(graph.nodes).filter((node) => node.nodeId !== joinNodeId);
  if (siblingNodes.length === 0) {
    return;
  }

  const unsettled = siblingNodes.some((node) =>
    node.state === "pending" || node.state === "running" || node.state === "waiting_tool" || node.state === "evaluating"
  );
  if (unsettled) {
    return;
  }

  const hasAbort = siblingNodes.some((node) => node.state === "aborted" || node.state === "failed");
  await taskStore.upsertNode(taskId, {
    nodeId: joinNodeId,
    parentNodeId: joinNode.parentNodeId,
    role: joinNode.role,
    state: hasAbort ? "aborted" : "completed",
    depth: joinNode.depth,
    attempt: joinNode.attempt,
    inputSummary: joinNode.inputSummary,
    outputSummary: hasAbort ? "distributed join blocked by child failure" : "distributed join ready"
  });
}

export function createPersistenceManager(eventBus: EventBus, taskStore: TaskStore) {
  // 1. 全量记录事件日志
  eventBus.subscribe("*", (event: RuntimeEvent) => {
    taskStore.appendEvent(event);
    logAuditEvent(event);
  });

  // 2. 根据关键事件同步任务状态
  eventBus.subscribe("TaskSubmitted", (event: RuntimeEvent) => {
    if (event.payload.resumed) {
      return;
    }
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
      state: event.payload.decision === "deliver" ? "completed" : "evaluating",
      depth: Number(event.payload.depth ?? 0),
      attempt: Number(event.payload.attempt ?? 1),
      inputSummary: String(event.payload.input_summary ?? ""),
      outputSummary: JSON.stringify(event.payload)
    });
  });

  eventBus.subscribe("NodeCompleted", (event: RuntimeEvent) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      parentNodeId: event.payload.parent_node_id as string | undefined,
      role: (event.payload.role as any) || "planner",
      state: "completed",
      depth: Number(event.payload.depth ?? 0),
      attempt: Number(event.payload.attempt ?? 1),
      inputSummary: String(event.payload.input_summary ?? ""),
      outputSummary: String(event.payload.output_summary ?? "")
    });
  });

  eventBus.subscribe("NodeAborted", (event: RuntimeEvent) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      parentNodeId: event.payload.parent_node_id as string | undefined,
      role: (event.payload.role as any) || "planner",
      state: "aborted",
      depth: Number(event.payload.depth ?? 0),
      attempt: Number(event.payload.attempt ?? 1),
      inputSummary: String(event.payload.input_summary ?? ""),
      outputSummary: String(event.payload.output_summary ?? "")
    });
  });

  eventBus.subscribe("AsyncNodeQueued", (event: RuntimeEvent) => {
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

  eventBus.subscribe("AsyncNodeSettled", (event: RuntimeEvent) => {
    const finalState = String(event.payload.final_state ?? "completed");
    const nodeState = finalState === "completed" ? "completed" : "aborted";
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      parentNodeId: event.payload.parent_node_id as string | undefined,
      role: (event.payload.role as any) || "planner",
      state: nodeState,
      depth: Number(event.payload.depth ?? 0),
      attempt: Number(event.payload.attempt ?? 1),
      inputSummary: String(event.payload.input_summary ?? ""),
      outputSummary: summarizeAsyncDelivery(event.payload)
    });
    void syncJoinPlaceholder(taskStore, event.payload.task_id as string);
  });

  eventBus.subscribe("AsyncNodeFailed", (event: RuntimeEvent) => {
    taskStore.upsertNode(event.payload.task_id as string, {
      nodeId: event.payload.node_id as string,
      parentNodeId: event.payload.parent_node_id as string | undefined,
      role: (event.payload.role as any) || "planner",
      state: "failed",
      depth: Number(event.payload.depth ?? 0),
      attempt: Number(event.payload.attempt ?? 1),
      inputSummary: String(event.payload.input_summary ?? ""),
      outputSummary: String(event.payload.error ?? "")
    });
    void syncJoinPlaceholder(taskStore, event.payload.task_id as string);
  });

  eventBus.subscribe("TaskClosed", (event: RuntimeEvent) => {
    const state = event.payload.state as string;
    const validStates: TaskGraph["status"][] = ["running", "completed", "failed", "aborted"];
    if (validStates.includes(state as any)) {
      taskStore.updateGraphStatus(event.payload.task_id as string, state as any);
    }
  });

  eventBus.subscribe("AsyncTaskSettled", (event: RuntimeEvent) => {
    const finalState = String(event.payload.final_state ?? "completed");
    const graphState: TaskGraph["status"] =
      finalState === "completed" ? "completed" : "aborted";
    taskStore.updateGraphStatus(event.payload.task_id as string, graphState);
  });

  eventBus.subscribe("AsyncTaskFailed", (event: RuntimeEvent) => {
    taskStore.updateGraphStatus(event.payload.task_id as string, "failed");
  });
}
