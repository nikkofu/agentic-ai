import fs from "node:fs/promises";
import path from "node:path";
import type { DagWorkflow } from "../types/dag";
import type { DeliveryBundle } from "../types/runtime";
import { computeResearchSourceCoverage } from "./researchWriting";
import { summarizeBrowserWorkflow } from "./browserWorkflow";
import type { AcceptanceProof, DeliveryProofStep, FamilyDeliveryBundle, VerificationRecord } from "./contracts";
import { buildCompanionshipSnapshot, type CompanionshipSnapshot } from "./companionshipMemory";

type ExecuteResult = {
  taskId: string;
  finalState: "completed" | "aborted";
  outputText?: string;
  delivery: DeliveryBundle | FamilyDeliveryBundle;
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
    resolveHumanAction: (input: { taskId: string; nodeId: string; action?: "approve" | "reject" | "clarify"; feedback: string }) => Promise<{
      taskId: string;
      nodeId: string;
      action: "approve" | "reject" | "clarify";
      resolved: boolean;
    }>;
  };
  taskStore: TaskStore;
  memoryInspector?: {
    inspect: (taskId: string) => Promise<{
      personal: { count: number; latest: string[] };
      project: { count: number; latest: string[] };
      task: { count: number; latest: string[] };
      evolution?: {
        statusCounts: {
          active: number;
          stale: number;
          superseded: number;
          archived: number;
          forgotten: number;
        };
        timeline: string[];
      };
      skillCandidates?: Array<{
        id: string;
        summary: string;
        confidence: string;
        status: string;
      }>;
    }>;
  };
  dreamInspector?: {
    inspect: (taskId: string) => Promise<{
      reflectionsCount: number;
      latestReflections: string[];
      recommendationsCount: number;
      latestRecommendations: string[];
    }>;
  };
  conversationStore?: {
    getConversationEvents: (threadId: string) => Promise<Array<{
      direction: "incoming" | "outgoing" | "internal";
      kind: string;
      payload: Record<string, unknown>;
      createdAt: string;
    }>>;
  };
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
    family: string;
    status: string;
    finalResult: string;
    blockingReason: string;
    verificationCount: number;
    artifactCount: number;
    sourceCoverage: number;
    verifiedClaimCount: number;
    stepCount: number;
    lastSuccessfulStep: string;
    validationSummary: string;
    recoveryAttempts: number;
    runProofSummary: string;
    acceptanceDecision: string;
    verifierSummary: string;
    findingsCount: number;
    findingsPreview: string[];
    artifacts: Array<{
      path: string;
      exists: boolean;
      nonEmpty: boolean;
    }>;
    verificationPreview: string[];
    referencesPreview: string[];
  } | null;
  memory: {
    personal: { count: number; latest: string[] };
    project: { count: number; latest: string[] };
    task: { count: number; latest: string[] };
    evolution?: {
      statusCounts: {
        active: number;
        stale: number;
        superseded: number;
        archived: number;
        forgotten: number;
      };
      timeline: string[];
    };
  };
  dream: {
    reflectionsCount: number;
    latestReflections: string[];
    recommendationsCount: number;
    latestRecommendations: string[];
  };
  plan: {
    nodeCount: number;
    latestJoinDecision: string;
    activeNodePath: string;
  } | null;
  conversation: {
    assistantId: string;
    threadId: string;
    threadStatus: string;
    channelType: string;
    externalUserId: string;
  } | null;
  skillCandidates: Array<{
    id: string;
    summary: string;
    confidence: string;
    status: string;
  }>;
  companionship: CompanionshipSnapshot | null;
  explanation: string;
  actionHint: string;
};

type MemoryInspectionSummary = {
  personal: { count: number; latest: string[] };
  project: { count: number; latest: string[] };
  task: { count: number; latest: string[] };
  evolution?: {
    statusCounts: {
      active: number;
      stale: number;
      superseded: number;
      archived: number;
      forgotten: number;
    };
    timeline: string[];
  };
  skillCandidates?: Array<{
    id: string;
    summary: string;
    confidence: string;
    status: string;
  }>;
};

export function createTaskLifecycle(deps: TaskLifecycleDeps) {
  return {
    startTask(input: { input: string; workflow?: DagWorkflow }) {
      return deps.executor.execute(input);
    },

    resumeTask(input: { taskId: string; maxParallel?: number }) {
      return deps.executor.resume(input);
    },

    resolveHumanAction(input: { taskId: string; nodeId: string; action?: "approve" | "reject" | "clarify"; feedback: string }) {
      return deps.executor.resolveHumanAction(input);
    },

    async inspectTask(taskId: string) {
      const [graph, events, memorySummary, dreamSummary] = await Promise.all([
        deps.taskStore.getGraph(taskId),
        deps.taskStore.getEvents(taskId),
        deps.memoryInspector?.inspect(taskId) ?? Promise.resolve({
          personal: { count: 0, latest: [] },
          project: { count: 0, latest: [] },
          task: { count: 0, latest: [] },
          evolution: {
            statusCounts: {
              active: 0,
              stale: 0,
              superseded: 0,
              archived: 0,
              forgotten: 0
            },
            timeline: []
          },
          skillCandidates: []
        }),
        deps.dreamInspector?.inspect(taskId) ?? Promise.resolve({
          reflectionsCount: 0,
          latestReflections: [],
          recommendationsCount: 0,
          latestRecommendations: []
        })
      ]);
      const latestClose = [...events].reverse().find((event) => event.type === "TaskClosed");
      const latestAsync = [...events].reverse().find((event) =>
        event.type === "AsyncTaskSettled" || event.type === "AsyncTaskFailed"
      );
      const latestAsyncNode = [...events].reverse().find((event) =>
        event.type === "AsyncNodeQueued" || event.type === "AsyncNodeSettled" || event.type === "AsyncNodeFailed"
      );
      const latestHumanAction = [...events].reverse().find((event) =>
        event.type === "HumanActionRequired" || event.type === "HumanActionResolved"
      );

      const companionship = await buildCompanionshipFromEvents({
        latestConversationLink: [...events].reverse().find((event) => event.type === "ConversationLinked") ?? null,
        conversationStore: deps.conversationStore,
        memorySummary
      });

      return {
        taskId,
        graph,
        latestClose: latestClose ?? null,
        latestAsync: latestAsync ?? null,
        latestAsyncNode: latestAsyncNode ?? null,
        latestHumanAction: latestHumanAction ?? null,
        runtimeInspector: await summarizeRuntimeInspector(events, graph, memorySummary, dreamSummary, companionship),
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
  graph?: TaskGraph,
  memorySummary: MemoryInspectionSummary = {
    personal: { count: 0, latest: [] },
    project: { count: 0, latest: [] },
    task: { count: 0, latest: [] },
    evolution: {
      statusCounts: {
        active: 0,
        stale: 0,
        superseded: 0,
        archived: 0,
        forgotten: 0
      },
      timeline: []
    }
  },
  dreamSummary: RuntimeInspector["dream"] = {
    reflectionsCount: 0,
    latestReflections: [],
    recommendationsCount: 0,
    latestRecommendations: []
  },
  companionship: CompanionshipSnapshot | null = null
): Promise<RuntimeInspector> {
  const latestIntent = [...events].reverse().find((event) => event.type === "IntentClassified");
  const latestPlanner = [...events].reverse().find((event) => event.type === "PlannerExpanded");
  const latestJoin = [...events].reverse().find((event) => event.type === "JoinEvaluated");
  const latestScheduled = [...events].reverse().find((event) => event.type === "NodeScheduled");
  const latestTerminal = [...events].reverse().find((event) =>
    event.type === "TaskClosed" || event.type === "AsyncTaskSettled" || event.type === "AsyncTaskFailed"
  );
  const latestConversationLink = [...events].reverse().find((event) => event.type === "ConversationLinked");
  const deliveryPayload = (latestTerminal?.payload.delivery as Record<string, unknown> | undefined) ?? undefined;
  const deliveryArtifacts = normalizeStringArray(deliveryPayload?.artifacts);
  const normalizedVerification = normalizeVerificationRecords(deliveryPayload?.verification);
  const browserSummary = summarizeBrowserDeliveryProof(deliveryPayload);
  const family = typeof deliveryPayload?.family === "string" ? deliveryPayload.family : "";
  const acceptanceProof = normalizeAcceptanceProof(deliveryPayload?.acceptance_proof);
  const sourceCoverage = computeResearchSourceCoverage(normalizedVerification);
  const verificationPreview = normalizedVerification.map((record) => record.summary).slice(0, 3);
  const referencesPreview = normalizedVerification
    .filter((record) => record.kind === "source")
    .map((record) => record.summary)
    .slice(0, 3);
  const finalDelivery = latestTerminal
      ? {
        family,
        status: String(deliveryPayload?.status ?? latestTerminal.payload.state ?? latestTerminal.payload.final_state ?? ""),
        finalResult: String(deliveryPayload?.final_result ?? latestTerminal.payload.final_result ?? ""),
        blockingReason: String(deliveryPayload?.blocking_reason ?? latestTerminal.payload.blocking_reason ?? latestTerminal.payload.error ?? ""),
        verificationCount: normalizedVerification.length,
        artifactCount: deliveryArtifacts.length,
        sourceCoverage,
        verifiedClaimCount: family === "research_writing" ? normalizedVerification.filter((record) => record.kind === "source" && record.passed).length : 0,
        stepCount: browserSummary.stepCount,
        lastSuccessfulStep: browserSummary.lastSuccessfulStep,
        validationSummary: browserSummary.validationSummary,
        recoveryAttempts: browserSummary.recoveryAttempts,
        runProofSummary: buildRunProofSummary({
          family,
          sourceCoverage,
          referencesPreview,
          browserSummary
        }),
        acceptanceDecision: acceptanceProof?.decision ?? "",
        verifierSummary: acceptanceProof?.verifierSummary ?? "",
        findingsCount: acceptanceProof?.findings.length ?? 0,
        findingsPreview: acceptanceProof?.findings.map((finding) => finding.summary).slice(0, 3) ?? [],
        artifacts: await inspectArtifacts(deliveryArtifacts),
        verificationPreview,
        referencesPreview
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
    memory: memorySummary,
    dream: dreamSummary,
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
    conversation: latestConversationLink
      ? {
          assistantId: String(latestConversationLink.payload.assistant_id ?? ""),
          threadId: String(latestConversationLink.payload.thread_id ?? ""),
          threadStatus: String(latestConversationLink.payload.thread_status ?? ""),
          channelType: String(latestConversationLink.payload.channel_type ?? ""),
        externalUserId: String(latestConversationLink.payload.external_user_id ?? "")
      }
      : null,
    skillCandidates: memorySummary.skillCandidates ?? [],
    companionship,
    explanation: buildRuntimeExplanation(finalDelivery),
    actionHint: buildActionHint(finalDelivery)
  };
}

async function buildCompanionshipFromEvents(args: {
  latestConversationLink: { payload: Record<string, unknown> } | null;
  conversationStore?: TaskLifecycleDeps["conversationStore"];
  memorySummary: RuntimeInspector["memory"];
}): Promise<CompanionshipSnapshot | null> {
  const threadId = typeof args.latestConversationLink?.payload.thread_id === "string"
    ? args.latestConversationLink.payload.thread_id
    : "";
  if (!threadId || !args.conversationStore) {
    return null;
  }

  const latestConversationLink = args.latestConversationLink;
  if (!latestConversationLink) {
    return null;
  }

  const threadStatus = typeof latestConversationLink.payload.thread_status === "string"
    ? latestConversationLink.payload.thread_status
    : "idle";
  const activeTaskId = typeof latestConversationLink.payload.task_id === "string"
    ? latestConversationLink.payload.task_id
    : undefined;
  const recentEvents = (await args.conversationStore.getConversationEvents(threadId))
    .slice(-3)
    .map((event) => ({
      direction: event.direction,
      summary: typeof event.payload.summary === "string"
        ? event.payload.summary
        : typeof event.payload.text === "string"
          ? event.payload.text
          : ""
    }));
  const lastMeaningfulInteractionAt = (await args.conversationStore.getConversationEvents(threadId)).slice(-1)[0]?.createdAt;

  return buildCompanionshipSnapshot({
    threadId,
    threadStatus,
    activeTaskId,
    recentEvents,
    memoryLatest: [
      ...args.memorySummary.personal.latest,
      ...args.memorySummary.project.latest
    ],
    lastMeaningfulInteractionAt
  });
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function normalizeVerificationRecords(value: unknown): VerificationRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): VerificationRecord[] => {
    if (typeof entry === "string" && entry.trim().length > 0) {
      return [{
        kind: "artifact_check",
        summary: entry,
        passed: true
      }];
    }

    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Partial<VerificationRecord>;
    if (typeof record.summary !== "string" || record.summary.trim().length === 0) {
      return [];
    }

    return [{
      kind: record.kind === "page_state" || record.kind === "form_result" || record.kind === "artifact_check" ? record.kind : "source",
      summary: record.summary,
      passed: record.passed === true,
      sourceId: typeof record.sourceId === "string" ? record.sourceId : undefined,
      locator: typeof record.locator === "string" ? record.locator : undefined
    }];
  });
}

function normalizeAcceptanceProof(value: unknown): AcceptanceProof | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<AcceptanceProof>;
  if (record.decision !== "accept" && record.decision !== "revise" && record.decision !== "reject") {
    return null;
  }

  return {
    decision: record.decision,
    acceptedAt: typeof record.acceptedAt === "number" ? record.acceptedAt : undefined,
    verifierSummary: typeof record.verifierSummary === "string" ? record.verifierSummary : "",
    findings: Array.isArray(record.findings)
      ? record.findings.flatMap((finding) => {
          if (!finding || typeof finding !== "object") {
            return [];
          }
          const summary = typeof (finding as { summary?: unknown }).summary === "string"
            ? (finding as { summary: string }).summary
            : "";
          if (!summary.trim()) {
            return [];
          }
          return [{
            severity: (finding as { severity?: "critical" | "major" | "minor" }).severity ?? "minor",
            kind: (finding as { kind?: AcceptanceProof["findings"][number]["kind"] }).kind ?? "policy_violation",
            summary,
            evidenceRefs: [],
            nodeId: undefined
          }];
        })
      : []
  };
}

function summarizeBrowserDeliveryProof(value: unknown) {
  if (!value || typeof value !== "object") {
    return {
      stepCount: 0,
      lastSuccessfulStep: "",
      validationSummary: "",
      recoveryAttempts: 0
    };
  }

  const payload = value as {
    blocking_reason?: unknown;
    delivery_proof?: {
      replayHints?: unknown;
      steps?: Array<{
        kind?: string;
        status?: "completed" | "failed" | "blocked";
        summary?: string;
      }>;
    };
  };
  const proof = payload.delivery_proof;
  const steps: DeliveryProofStep[] = Array.isArray(proof?.steps)
    ? proof.steps
        .filter((step): step is { kind: string; status: "completed" | "failed" | "blocked"; summary: string } =>
          Boolean(step && typeof step.kind === "string" && typeof step.summary === "string")
        )
        .map((step) => ({
          kind: step.kind,
          status: step.status === "failed" || step.status === "blocked" ? step.status : "completed",
          summary: step.summary
        }))
    : [];
  const validationStep = [...steps].reverse().find((step) => step.kind === "validate_outcome");
  const replayHints = Array.isArray(proof?.replayHints)
    ? proof.replayHints.filter((hint): hint is string => typeof hint === "string" && hint.trim().length > 0)
    : [];

  return summarizeBrowserWorkflow({
    steps,
    validation: {
      summary: validationStep?.summary ?? String(payload.blocking_reason ?? ""),
      passed: validationStep?.status === "completed"
    },
    recoveryAttempts: replayHints.length
  });
}

function buildRuntimeExplanation(finalDelivery: RuntimeInspector["finalDelivery"]) {
  if (!finalDelivery) {
    return "";
  }

  if (finalDelivery.family === "research_writing" && (finalDelivery.status === "blocked" || finalDelivery.blockingReason)) {
    return finalDelivery.acceptanceDecision === "reject" || finalDelivery.acceptanceDecision === "revise"
      ? `Research delivery ${finalDelivery.acceptanceDecision}: ${finalDelivery.verifierSummary || finalDelivery.blockingReason || "unknown_reason"}`
      : `Research delivery blocked: ${finalDelivery.blockingReason || "unknown_reason"}`;
  }

  if (finalDelivery.family === "browser_workflow" && (finalDelivery.status === "blocked" || finalDelivery.blockingReason)) {
    return finalDelivery.acceptanceDecision === "reject" || finalDelivery.acceptanceDecision === "revise"
      ? `Browser workflow ${finalDelivery.acceptanceDecision}: ${finalDelivery.verifierSummary || finalDelivery.blockingReason || "unknown_reason"}`
      : `Browser workflow blocked: ${finalDelivery.blockingReason || "unknown_reason"}`;
  }

  if (finalDelivery.status === "blocked" || finalDelivery.blockingReason) {
    return `Task blocked: ${finalDelivery.blockingReason || "unknown_reason"}`;
  }

  if (finalDelivery.family === "research_writing" && finalDelivery.status === "completed") {
    return finalDelivery.acceptanceDecision === "accept"
      ? `Research delivery accepted with ${finalDelivery.sourceCoverage} verified sources and ${finalDelivery.artifactCount} artifacts`
      : `Research delivery completed with ${finalDelivery.sourceCoverage} verified sources and ${finalDelivery.artifactCount} artifacts`;
  }

  if (finalDelivery.family === "browser_workflow" && finalDelivery.status === "completed") {
    return finalDelivery.acceptanceDecision === "accept"
      ? `Browser workflow accepted in ${finalDelivery.stepCount} steps with validation: ${finalDelivery.validationSummary || "passed"}`
      : `Browser workflow completed in ${finalDelivery.stepCount} steps with validation: ${finalDelivery.validationSummary || "passed"}`;
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

  if (finalDelivery.family === "research_writing" && (finalDelivery.blockingReason === "policy_verification_required" || finalDelivery.blockingReason === "verification_missing" || finalDelivery.blockingReason === "policy_source_coverage_required")) {
    return "Add better sources and verification evidence before attempting final article delivery again.";
  }

  if (finalDelivery.family === "research_writing" && finalDelivery.acceptanceDecision === "revise") {
    return "Address verifier findings and rebuild the article package before re-submitting.";
  }

  if (finalDelivery.family === "research_writing" && finalDelivery.acceptanceDecision === "reject") {
    return "Do not hand off this article until the verifier findings are resolved.";
  }

  if (finalDelivery.family === "browser_workflow" && finalDelivery.status === "blocked") {
    return "Retry the workflow, re-locate the target, or reload the page before resuming.";
  }

  if (finalDelivery.family === "browser_workflow" && finalDelivery.acceptanceDecision === "revise") {
    return "Retry the workflow with verifier findings applied before final handoff.";
  }

  if (finalDelivery.family === "browser_workflow" && finalDelivery.acceptanceDecision === "reject") {
    return "Do not hand off this workflow run until the verifier findings are resolved.";
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

function buildRunProofSummary(args: {
  family: string;
  sourceCoverage: number;
  referencesPreview: string[];
  browserSummary: ReturnType<typeof summarizeBrowserWorkflow>;
}) {
  if (args.family === "research_writing") {
    return `source_coverage=${args.sourceCoverage}; references=${args.referencesPreview.length}`;
  }

  if (args.family === "browser_workflow") {
    return `steps=${args.browserSummary.stepCount}; last_successful=${args.browserSummary.lastSuccessfulStep || "none"}; validation=${args.browserSummary.validationSummary || "none"}`;
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
