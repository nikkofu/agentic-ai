import fs from "node:fs/promises";
import path from "node:path";
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

type RuntimeInspector = {
  intent: {
    taskKind: string;
    executionMode: string;
    needsVerification: boolean;
  } | null;
  plannerPolicy: {
    recommendedTools: string[];
    requiredCapabilities: string[];
    verificationPolicy: string;
  } | null;
  finalDelivery: {
    status: string;
    finalResult: string;
    blockingReason: string;
    verificationCount: number;
    artifactCount: number;
    artifacts: Array<{
      path: string;
      exists: boolean;
      nonEmpty: boolean;
    }>;
    verificationPreview: string[];
  } | null;
  plan: {
    nodeCount: number;
    latestJoinDecision: string;
    activeNodePath: string;
  } | null;
  explanation: string;
  actionHint: string;
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
        runtimeInspector: await summarizeRuntimeInspector(events, graph),
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

async function summarizeRuntimeInspector(
  events: Array<{ type: string; payload: Record<string, unknown> }>,
  graph?: TaskGraph
): Promise<RuntimeInspector> {
  const latestIntent = [...events].reverse().find((event) => event.type === "IntentClassified");
  const latestPlanner = [...events].reverse().find((event) => event.type === "PlannerExpanded");
  const latestJoin = [...events].reverse().find((event) => event.type === "JoinEvaluated");
  const latestScheduled = [...events].reverse().find((event) => event.type === "NodeScheduled");
  const latestTerminal = [...events].reverse().find((event) =>
    event.type === "TaskClosed" || event.type === "AsyncTaskSettled" || event.type === "AsyncTaskFailed"
  );
  const deliveryPayload = (latestTerminal?.payload.delivery as Record<string, unknown> | undefined) ?? undefined;
  const deliveryArtifacts = normalizeStringArray(deliveryPayload?.artifacts);
  const verificationPreview = normalizeStringArray(deliveryPayload?.verification).slice(0, 3);
  const finalDelivery = latestTerminal
    ? {
        status: String(deliveryPayload?.status ?? latestTerminal.payload.state ?? latestTerminal.payload.final_state ?? ""),
        finalResult: String(deliveryPayload?.final_result ?? latestTerminal.payload.final_result ?? ""),
        blockingReason: String(deliveryPayload?.blocking_reason ?? latestTerminal.payload.blocking_reason ?? latestTerminal.payload.error ?? ""),
        verificationCount: normalizeStringArray(deliveryPayload?.verification).length,
        artifactCount: deliveryArtifacts.length,
        artifacts: await inspectArtifacts(deliveryArtifacts),
        verificationPreview
      }
    : null;

  return {
    intent: latestIntent
      ? {
          taskKind: String(latestIntent.payload.task_kind ?? ""),
          executionMode: String(latestIntent.payload.execution_mode ?? ""),
          needsVerification: Boolean(latestIntent.payload.needs_verification)
        }
      : null,
    plannerPolicy: latestPlanner
      ? {
          recommendedTools: normalizeStringArray(latestPlanner.payload.recommended_tools),
          requiredCapabilities: normalizeStringArray(latestPlanner.payload.required_capabilities),
          verificationPolicy: String(latestPlanner.payload.verification_policy ?? "")
        }
      : null,
    finalDelivery,
    plan: graph
      ? {
          nodeCount: Object.keys(graph.nodes).length,
          latestJoinDecision: String(latestJoin?.payload.decision ?? ""),
          activeNodePath: String(
            latestScheduled?.payload.node_id
            ?? Object.keys(graph.nodes)[0]
            ?? ""
          )
        }
      : null,
    explanation: buildRuntimeExplanation(finalDelivery),
    actionHint: buildActionHint(finalDelivery)
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function buildRuntimeExplanation(finalDelivery: RuntimeInspector["finalDelivery"]) {
  if (!finalDelivery) {
    return "";
  }

  if (finalDelivery.status === "blocked" || finalDelivery.blockingReason) {
    return `Task blocked: ${finalDelivery.blockingReason || "unknown_reason"}`;
  }

  if (finalDelivery.status === "completed") {
    return `Task completed with ${finalDelivery.artifactCount} artifacts and ${finalDelivery.verificationCount} verification items`;
  }

  return `Task finished with status: ${finalDelivery.status}`;
}

function buildActionHint(finalDelivery: RuntimeInspector["finalDelivery"]) {
  if (!finalDelivery) {
    return "";
  }

  if (finalDelivery.blockingReason === "policy_verification_required" || finalDelivery.blockingReason === "verification_missing") {
    return "Add verification evidence before attempting final delivery again.";
  }

  if (finalDelivery.status === "completed") {
    return "Review the final artifacts and verification evidence.";
  }

  if (finalDelivery.status === "blocked") {
    return "Inspect the blocking reason and revise the task inputs or evidence.";
  }

  return "";
}

async function inspectArtifacts(artifacts: string[]) {
  return await Promise.all(
    artifacts.map(async (artifactPath) => {
      try {
        const stats = await fs.stat(path.resolve(artifactPath));
        return {
          path: artifactPath,
          exists: stats.isFile(),
          nonEmpty: stats.isFile() && stats.size > 0
        };
      } catch {
        return {
          path: artifactPath,
          exists: false,
          nonEmpty: false
        };
      }
    })
  );
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
