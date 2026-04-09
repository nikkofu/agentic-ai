import type { DagWorkflow } from "../types/dag";
import type { DeliveryBundle } from "../types/runtime";

type ExecuteResult = {
  taskId: string;
  finalState: "completed" | "aborted";
  outputText?: string;
  delivery: DeliveryBundle;
  summary: {
    nodeCount: number;
    childSpawns: number;
    toolCalls: {
      localSuccess: number;
      mcpSuccess: number;
    };
    evaluatorDecisions: string[];
    path: string[];
  };
  telemetry: {
    total_tokens: number;
    total_cost_usd: number;
  };
};

type TaskStore = {
  getGraph: (taskId: string) => Promise<{
    taskId: string;
    status: string;
    nodes: Record<string, { state: string; role: string }>;
  } | null>;
  getEvents: (taskId: string) => Promise<Array<{
    type: string;
    payload: Record<string, unknown>;
    ts?: number;
  }>>;
};

type TaskLifecycleDeps = {
  executor: {
    execute: (input: { input: string; workflow?: DagWorkflow }) => Promise<ExecuteResult>;
    resume: (input: { taskId: string; maxParallel?: number }) => Promise<ExecuteResult>;
  };
  taskStore: TaskStore;
};

type TaskGraph = Awaited<ReturnType<TaskStore["getGraph"]>>;

type DistributedSummary = {
  queuedNodes: number;
  activeJoinState: string | null;
  settledWorkerNodes: number;
};

export function createTaskLifecycle(deps: TaskLifecycleDeps) {
  return {
    startTask(input: { input: string; workflow?: DagWorkflow }) {
      return deps.executor.execute(input);
    },

    resumeTask(input: { taskId: string; maxParallel?: number }) {
      return deps.executor.resume(input);
    },

    async inspectTask(taskId: string) {
      const [graph, events] = await Promise.all([
        deps.taskStore.getGraph(taskId),
        deps.taskStore.getEvents(taskId)
      ]);
      const latestClose = [...events].reverse().find((event) => event.type === "TaskClosed");
      const latestAsync = [...events].reverse().find((event) =>
        event.type === "AsyncTaskSettled" || event.type === "AsyncTaskFailed"
      );
      const latestAsyncNode = [...events].reverse().find((event) =>
        event.type === "AsyncNodeQueued" || event.type === "AsyncNodeSettled" || event.type === "AsyncNodeFailed"
      );

      return {
        taskId,
        graph,
        latestClose: latestClose ?? null,
        latestAsync: latestAsync ?? null,
        latestAsyncNode: latestAsyncNode ?? null,
        distributedSummary: summarizeDistributedGraph(graph),
        eventCount: events.length
      };
    },

    async closeTask(taskId: string) {
      const inspection = await this.inspectTask(taskId);
      return {
        taskId,
        status: inspection.graph?.status ?? "unknown",
        closed: inspection.latestClose !== null
      };
    }
  };
}

function summarizeDistributedGraph(graph: TaskGraph): DistributedSummary | null {
  if (!graph) {
    return null;
  }

  let queuedNodes = 0;
  let settledWorkerNodes = 0;
  let activeJoinState: string | null = null;

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (nodeId.startsWith("join-")) {
      activeJoinState = node.state;
      continue;
    }

    if (node.state === "pending" || node.state === "running" || node.state === "waiting_tool" || node.state === "evaluating") {
      queuedNodes += 1;
      continue;
    }

    if (node.state === "completed" || node.state === "aborted" || node.state === "failed") {
      settledWorkerNodes += 1;
    }
  }

  return {
    queuedNodes,
    activeJoinState,
    settledWorkerNodes
  };
}
