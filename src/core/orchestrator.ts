import { createAgentRuntime } from "../agents/agentRuntime";
import { evaluateDecision } from "../eval/evaluator";
import { checkSpawnGuardrails } from "../guardrails/guardrails";
import { allowsToolByCapabilities } from "../runtime/capabilities";
import { enrichExecutionContext, replayTaskMemoryFromEvents, type MemoryStore, type RetrievalProvider } from "../runtime/memory";
import type { AgentRole, DeliveryBundle, ToolIntent } from "../types/runtime";
import type { ExecutionContext, PlannerPolicy } from "../runtime/contracts";
import type { RuntimeEvent } from "./eventBus";
import { TaskStore } from "./taskStore";
import { createPersistenceManager } from "./persistenceManager";
import { MiddlewareManager, Middleware } from "./middleware";
import { TaskQueue } from "../worker/queue";

type EventBus = {
  publish: (event: RuntimeEvent) => void;
  subscribe: (pattern: string | ((event: RuntimeEvent) => void), callback?: (event: RuntimeEvent) => void) => void;
};

type EventLogStore = {
  append: (event: RuntimeEvent) => void;
  getAll: () => RuntimeEvent[];
};

type GuardrailLimits = {
  max_depth: number;
  max_branch: number;
  max_steps: number;
  max_budget: number;
};

type OrchestratorDeps = {
  eventBus: EventBus;
  eventLogStore: EventLogStore;
  taskStore?: TaskStore;
  runtime?: ReturnType<typeof createAgentRuntime>;
  guardrails: GuardrailLimits;
  toolGateway?: {
    invoke: (call: { transport: "local" | "mcp"; tool: string; input: unknown }) => Promise<{
      ok: boolean;
      output: unknown;
      latencyMs: number;
      costMeta: { provider: string; tokens: number; usd: number };
    }>;
  };
  taskQueue?: TaskQueue;
  evaluator?: (input: {
    delivery: DeliveryBundle;
    role: AgentRole;
    policy: RuntimePolicyMetadata;
    iteration: number;
    sawToolStage: boolean;
  }) => { decision: "stop" | "revise" | "block"; reason: string };
  memoryStore?: MemoryStore;
  retrievalProvider?: RetrievalProvider;
};

type RunTaskInput = {
  taskId: string;
  nodeId: string;
  role: AgentRole;
  runtimeInput?: Record<string, unknown>;
};

type RunContextInput = {
  taskId: string;
  context: ExecutionContext;
  resolveRuntimeInput?: (args: {
    role: AgentRole;
    context: ExecutionContext;
    runtimeInput: Record<string, unknown>;
  }) => Record<string, unknown>;
};

type RuntimePolicyMetadata = {
  recommendedTools?: string[];
  requiredCapabilities?: string[];
  verificationPolicy?: string;
  needsVerification?: boolean;
  taskKind?: string;
};

type NodeState = "pending" | "running" | "waiting_tool" | "evaluating" | "completed" | "aborted";
type NodeResult = { finalState: "completed" | "aborted"; stateTrace: NodeState[]; delivery: DeliveryBundle };

type ParallelNodeInput = {
  nodeId: string;
  role: AgentRole;
  priority?: number;
  parentNodeId?: string;
  runtimeInput?: Record<string, unknown>;
  depth?: number;
};

type ParallelTaskInput = {
  taskId: string;
  nodes: ParallelNodeInput[];
  maxParallel: number;
  runtimeInput?: Record<string, unknown>;
};

type ParallelContextInput = {
  taskId: string;
  contexts: ExecutionContext[];
  maxParallel: number;
  dispatchMode?: "local" | "queue";
  resolveRuntimeInput?: (args: {
    role: AgentRole;
    context: ExecutionContext;
    runtimeInput: Record<string, unknown>;
  }) => Record<string, unknown>;
};

type ParallelNodeResult = {
  nodeId: string;
  finalState: "completed" | "aborted";
  delivery: DeliveryBundle;
};

export function createOrchestrator(deps: OrchestratorDeps) {
  deps.eventBus.subscribe((event) => deps.eventLogStore.append(event));

  if (deps.taskStore) {
    createPersistenceManager(deps.eventBus as any, deps.taskStore);
  }

  const runtime = deps.runtime ?? createAgentRuntime();
  const nodeMiddleware = new MiddlewareManager<RunTaskInput>();

  const runNodeCore = async (input: RunTaskInput): Promise<NodeResult> => {
    const stateTrace: NodeState[] = ["pending"];
    const baseRuntimeInput = { ...(input.runtimeInput ?? {}) };
    const delivery: DeliveryBundle = {
      status: "completed",
      final_result: "",
      artifacts: [],
      verification: [],
      risks: [],
      next_actions: []
    };

    publish(deps.eventBus, "NodeScheduled", {
      task_id: input.taskId,
      node_id: input.nodeId,
      role: input.role,
      parent_node_id: typeof input.runtimeInput?.parent_node_id === "string" ? input.runtimeInput.parent_node_id : undefined,
      depth: typeof input.runtimeInput?.depth === "number" ? input.runtimeInput.depth : undefined,
      input_summary: summarizeInput(input.runtimeInput)
    });
    stateTrace.push("running");
    publish(deps.eventBus, "AgentStarted", {
      task_id: input.taskId,
      node_id: input.nodeId,
      role: input.role,
      parent_node_id: typeof input.runtimeInput?.parent_node_id === "string" ? input.runtimeInput.parent_node_id : undefined,
      depth: typeof input.runtimeInput?.depth === "number" ? input.runtimeInput.depth : undefined,
      input_summary: summarizeInput(input.runtimeInput)
    });
    publish(deps.eventBus, "PromptComposed", { task_id: input.taskId, node_id: input.nodeId });

    let finalState: NodeState = "completed";
    let loopInput = baseRuntimeInput;
    let sawToolStage = false;
    let evaluated = false;

    for (let iteration = 0; iteration < 5; iteration += 1) {
      publish(deps.eventBus, "ModelCalled", {
        task_id: input.taskId,
        node_id: input.nodeId,
        role: input.role,
        iteration,
        model: typeof loopInput.model === "string" ? loopInput.model : undefined
      });

      if (deps.taskQueue) {
        await deps.taskQueue.addJob(input.taskId, input.nodeId, input);
      }

      const runtimeResult = await runtime.run(loopInput);
      const envelope = parseRuntimeEnvelope((runtimeResult as any).outputText);
      const policy = extractRuntimePolicy(loopInput);
      const toolCalls = (envelope.tool_calls ?? []).filter((toolCall) => isAllowedToolCall(toolCall, policy));

      if ((envelope.tool_calls?.length ?? 0) > 0 && toolCalls.length === 0) {
        if (!stateTrace.includes("evaluating")) {
          stateTrace.push("evaluating");
        }
        delivery.status = "blocked";
        delivery.final_result = "";
        delivery.artifacts = [];
        delivery.verification = [];
        delivery.risks = ["planner policy blocked the requested tool call"];
        delivery.next_actions = [];
        delivery.blocking_reason = "policy_tool_not_allowed";
        publish(deps.eventBus, "Evaluated", {
          task_id: input.taskId,
          node_id: input.nodeId,
          role: input.role,
          decision: "block",
          output_text: "",
          model: typeof loopInput.model === "string" ? loopInput.model : undefined,
          delivery
        });
        evaluated = true;
        finalState = "aborted";
        break;
      }

      if (toolCalls.length > 0) {
        if (!sawToolStage) {
          stateTrace.push("waiting_tool");
          sawToolStage = true;
        }

        const toolResults = [];
        for (const toolCall of toolCalls) {
          publish(deps.eventBus, "ToolInvoked", {
            task_id: input.taskId,
            node_id: input.nodeId,
            tool: toolCall.tool,
            transport: toolCall.transport
          });
          const result = deps.toolGateway
            ? await deps.toolGateway.invoke(toolCall)
            : { ok: true, output: null, latencyMs: 0, costMeta: { provider: toolCall.transport, tokens: 0, usd: 0 } };
          toolResults.push({ tool: toolCall.tool, transport: toolCall.transport, result });
          publish(deps.eventBus, "ToolReturned", {
            task_id: input.taskId,
            node_id: input.nodeId,
            tool: toolCall.tool,
            ok: result.ok,
            provider: result.costMeta.provider,
            latency_ms: result.latencyMs,
            tokens: result.costMeta.tokens
          });
        }

        loopInput = attachToolResults(loopInput, toolResults);
        continue;
      }

      if (envelope.invalid_tool_call_text) {
        loopInput = attachRepairInstruction(loopInput);
        continue;
      }

      if (isEmptyEnvelope(envelope, runtimeResult)) {
        loopInput = attachRepairInstruction(loopInput);
        continue;
      }

      stateTrace.push("evaluating");
      const outputText = envelope.output_text ?? (runtimeResult as any).outputText ?? "";
      delivery.final_result = envelope.final_result ?? outputText;
      delivery.artifacts = envelope.artifacts ?? [];
      delivery.verification = envelope.verification ?? [];
      delivery.risks = envelope.risks ?? [];
      delivery.next_actions = envelope.next_actions ?? [];
      delivery.status = envelope.blocking_reason ? "blocked" : "completed";
      delivery.blocking_reason = envelope.blocking_reason;

      if (requiresVerification(policy) && delivery.verification.length === 0) {
        delivery.status = "blocked";
        delivery.blocking_reason = "policy_verification_required";
      }

      const evaluatorDecision = deps.evaluator
        ? deps.evaluator({
            delivery,
            role: input.role,
            policy,
            iteration,
            sawToolStage
          })
        : defaultEvaluateNode({
            delivery,
            policy,
            iteration,
            sawToolStage
          });

      if (evaluatorDecision.decision === "revise") {
        publish(deps.eventBus, "Evaluated", {
          task_id: input.taskId,
          node_id: input.nodeId,
          role: input.role,
          decision: "revise",
          output_text: outputText,
          usage: (runtimeResult as any).usage,
          cost: (runtimeResult as any).cost,
          model: typeof loopInput.model === "string" ? loopInput.model : undefined,
          latency_ms: typeof (runtimeResult as any).latencyMs === "number" ? (runtimeResult as any).latencyMs : undefined,
          delivery
        });
        publish(deps.eventBus, "NodeRevised", {
          task_id: input.taskId,
          node_id: input.nodeId,
          reason: evaluatorDecision.reason
        });
        loopInput = attachRevisionInstruction(loopInput, evaluatorDecision.reason);
        continue;
      }

      if (evaluatorDecision.decision === "block") {
        delivery.status = "blocked";
        delivery.blocking_reason = delivery.blocking_reason ?? evaluatorDecision.reason;
      }

      publish(deps.eventBus, "Evaluated", {
        task_id: input.taskId,
        node_id: input.nodeId,
        role: input.role,
        decision: delivery.status === "completed" ? "stop" : "block",
        output_text: outputText,
        usage: (runtimeResult as any).usage,
        cost: (runtimeResult as any).cost,
        model: typeof loopInput.model === "string" ? loopInput.model : undefined,
        latency_ms: typeof (runtimeResult as any).latencyMs === "number" ? (runtimeResult as any).latencyMs : undefined,
        delivery
      });

      evaluated = true;
      finalState = delivery.status === "blocked" ? "aborted" : "completed";
      break;
    }

    if (!evaluated) {
      if (!stateTrace.includes("evaluating")) {
        stateTrace.push("evaluating");
      }
      delivery.status = "blocked";
      delivery.final_result = "";
      delivery.artifacts = [];
      delivery.verification = [];
      delivery.risks = [];
      delivery.next_actions = [];
      delivery.blocking_reason = sawToolStage ? "tool_loop_exhausted" : "empty_delivery";
      finalState = "aborted";
      publish(deps.eventBus, "Evaluated", {
        task_id: input.taskId,
        node_id: input.nodeId,
        role: input.role,
        decision: "continue",
        output_text: "",
        model: typeof loopInput.model === "string" ? loopInput.model : undefined,
        delivery
      });
    }

    stateTrace.push(finalState === "completed" ? "completed" : "aborted");
    publish(deps.eventBus, finalState === "completed" ? "NodeCompleted" : "NodeAborted", {
      task_id: input.taskId,
      node_id: input.nodeId
    });

    return { finalState, stateTrace, delivery };
  };

  const runNode = async (input: RunTaskInput): Promise<NodeResult> => {
    let result: NodeResult | undefined;
    await nodeMiddleware.execute(input, async () => {
      result = await runNodeCore(input);
    });
    return result ?? {
      finalState: "aborted",
      stateTrace: ["pending", "aborted"],
      delivery: {
        status: "failed",
        final_result: "",
        artifacts: [],
        verification: [],
        risks: [],
        blocking_reason: "middleware_aborted",
        next_actions: []
      }
    };
  };

  return {
    use: (middleware: Middleware<RunTaskInput>) => {
      nodeMiddleware.use(middleware);
    },
    runSingleNodeTask: async (input: RunTaskInput): Promise<NodeResult> => {
      publish(deps.eventBus, "TaskSubmitted", { task_id: input.taskId });

      const guardrail = checkSpawnGuardrails(
        {
          currentDepth: 0,
          childrenCount: 0,
          totalSteps: 0,
          spentBudget: 0
        },
        deps.guardrails
      );

      if (!guardrail.allowed) {
        publish(deps.eventBus, "GuardrailTripped", {
          task_id: input.taskId,
          node_id: input.nodeId,
          reason: guardrail.reason
        });
        return {
          finalState: "aborted",
          stateTrace: ["pending", "aborted"],
          delivery: {
            status: "blocked",
            final_result: "",
            artifacts: [],
            verification: [],
            risks: [guardrail.reason],
            blocking_reason: guardrail.reason,
            next_actions: []
          }
        };
      }

      return await runNode(input);
    },

    runSingleNodeContext: async (input: RunContextInput): Promise<NodeResult> => {
      publish(deps.eventBus, "ExecutionContextPrepared", {
        task_id: input.taskId,
        node_id: input.context.node.id,
        context: input.context
      });
      const baseRuntimeInput = buildRuntimeInputFromContext(input.context);
      const runtimeInput = input.resolveRuntimeInput
        ? input.resolveRuntimeInput({
            role: input.context.node.role,
            context: input.context,
            runtimeInput: baseRuntimeInput
          })
        : baseRuntimeInput;

      return await runNode({
        taskId: input.taskId,
        nodeId: input.context.node.id,
        role: input.context.node.role,
        runtimeInput: withNodeMetadata(runtimeInput, input.context)
      });
    },

    runParallelTask: async (input: ParallelTaskInput) => {
      const results: { nodeId: string; state: NodeState }[] = [];
      const queue = [...input.nodes].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      const runNext = async () => {
        if (queue.length === 0) return;
        const node = queue.shift()!;
        const res = await runNode({
          taskId: input.taskId,
          nodeId: node.nodeId,
          role: node.role,
          runtimeInput: {
            ...(input.runtimeInput ?? {}),
            ...(node.runtimeInput ?? {}),
            parent_node_id: node.parentNodeId,
            depth: node.depth
          }
        });
        results.push({ nodeId: node.nodeId, state: res.finalState });
      };

      const workers = Array.from({ length: Math.min(input.maxParallel, input.nodes.length) }, async () => {
        while (queue.length > 0) {
          await runNext();
        }
      });

      await Promise.all(workers);

      publish(deps.eventBus, "JoinEvaluated", {
        task_id: input.taskId,
        node_count: results.length,
        decision: "stop"
      });

      return {
        completedNodes: results.length,
        joinDecision: "stop",
        nodeResults: results.map((result) => ({
          nodeId: result.nodeId,
          finalState: result.state,
          delivery: {
            status: result.state === "completed" ? "completed" : "blocked",
            final_result: "",
            artifacts: [],
            verification: [],
            risks: [],
            next_actions: []
          }
        }))
      };
    },

    runParallelContexts: async (input: ParallelContextInput) => {
      if (input.dispatchMode === "queue" && deps.taskQueue) {
        const joinNodeId = `join-${input.taskId}`;
        publish(deps.eventBus, "NodeScheduled", {
          task_id: input.taskId,
          node_id: joinNodeId,
          role: "planner",
          input_summary: `Await queued join for ${input.contexts.length} nodes`
        });

        for (const context of input.contexts) {
          publish(deps.eventBus, "ExecutionContextPrepared", {
            task_id: input.taskId,
            node_id: context.node.id,
            context
          });
          const baseRuntimeInput = buildRuntimeInputFromContext(context);
          const runtimeInput = input.resolveRuntimeInput
            ? input.resolveRuntimeInput({
                role: context.node.role,
                context,
                runtimeInput: baseRuntimeInput
              })
            : baseRuntimeInput;
          await deps.taskQueue.addJob(input.taskId, context.node.id, {
            role: context.node.role,
            runtimeInput: withNodeMetadata(runtimeInput, context)
          });
          publish(deps.eventBus, "AsyncNodeQueued", {
            task_id: input.taskId,
            node_id: context.node.id,
            role: context.node.role
          });
        }

        publish(deps.eventBus, "JoinEvaluated", {
          task_id: input.taskId,
          node_count: input.contexts.length,
          decision: "queued"
        });

        return {
          completedNodes: 0,
          joinDecision: "queued",
          nodeResults: []
        };
      }

      const results: ParallelNodeResult[] = [];
      const queue = [...input.contexts];

      const runNext = async () => {
        if (queue.length === 0) return;
        const context = queue.shift()!;
        publish(deps.eventBus, "ExecutionContextPrepared", {
          task_id: input.taskId,
          node_id: context.node.id,
          context
        });
        const baseRuntimeInput = buildRuntimeInputFromContext(context);
        const runtimeInput = input.resolveRuntimeInput
          ? input.resolveRuntimeInput({
              role: context.node.role,
              context,
              runtimeInput: baseRuntimeInput
            })
          : baseRuntimeInput;
        const res = await runNode({
          taskId: input.taskId,
          nodeId: context.node.id,
          role: context.node.role,
          runtimeInput: withNodeMetadata(runtimeInput, context)
        });
        results.push({ nodeId: context.node.id, finalState: res.finalState, delivery: res.delivery });
      };

      const workers = Array.from({ length: Math.min(input.maxParallel, input.contexts.length) }, async () => {
        while (queue.length > 0) {
          await runNext();
        }
      });

      await Promise.all(workers);

      publish(deps.eventBus, "JoinEvaluated", {
        task_id: input.taskId,
        node_count: results.length,
        decision: "stop"
      });

      return {
        completedNodes: results.length,
        joinDecision: "stop",
        nodeResults: results
      };
    },

    resumeTask: async (taskId: string, maxParallel: number = 2): Promise<{
      completedNodes: number;
      status: "completed" | "aborted";
      message?: string;
    }> => {
      if (!deps.taskStore) throw new Error("TaskStore is required for resumeTask");

      const graph = await deps.taskStore.getGraph(taskId);
      if (!graph) throw new Error(`Task ${taskId} not found`);
      const events = await deps.taskStore.getEvents(taskId);

      const incompleteNodes = Object.values(graph.nodes).filter((node) => {
        if (node.nodeId.startsWith("join-")) {
          return false;
        }
        return node.state === "pending" || node.state === "running";
      });

      if (incompleteNodes.length === 0) {
        return { completedNodes: 0, status: "completed", message: "No nodes to resume" };
      }

      publish(deps.eventBus, "TaskSubmitted", { task_id: taskId, resumed: true });
      await replayTaskMemoryFromEvents({
        taskId,
        events,
        memoryStore: deps.memoryStore
      });
      const restoredContexts = restoreExecutionContexts(events);

      const queue = [...incompleteNodes];
      const results: NodeResult[] = [];
      const runNext = async () => {
        if (queue.length === 0) return;
        const node = queue.shift()!;
        const restoredContext = restoredContexts.get(node.nodeId);
        if (restoredContext) {
          const enrichedContext = await enrichExecutionContext({
            taskId,
            context: restoredContext,
            memoryStore: deps.memoryStore,
            retrievalProvider: deps.retrievalProvider
          });
          results.push(await runNode({
            taskId,
            nodeId: enrichedContext.node.id,
            role: enrichedContext.node.role,
            runtimeInput: withNodeMetadata(buildRuntimeInputFromContext(enrichedContext), enrichedContext)
          }));
          return;
        }
        results.push(await runNode({
          taskId,
          nodeId: node.nodeId,
          role: node.role,
          runtimeInput: {}
        }));
      };

      const workers = Array.from({ length: Math.min(maxParallel, incompleteNodes.length) }, async () => {
        while (queue.length > 0) {
          await runNext();
        }
      });

      await Promise.all(workers);

      await finalizeDistributedJoinState(deps.taskStore, taskId);

      const status = results.some((result) => result.finalState === "aborted") ? "aborted" : "completed";
      publish(deps.eventBus, "TaskClosed", { task_id: taskId, state: status, resumed: true });
      return {
        completedNodes: incompleteNodes.length,
        status
      };
    },

    resumeHitl: async (taskId: string, nodeId: string, feedback: string) => {
      publish(deps.eventBus, "HumanActionResolved", { task_id: taskId, node_id: nodeId, feedback });
    }
  };
}

async function finalizeDistributedJoinState(taskStore: TaskStore | undefined, taskId: string) {
  if (!taskStore) {
    return;
  }

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

function restoreExecutionContexts(events: RuntimeEvent[]): Map<string, ExecutionContext> {
  const contexts = new Map<string, ExecutionContext>();
  for (const event of events) {
    if (event.type !== "ExecutionContextPrepared") {
      continue;
    }
    const nodeId = typeof event.payload.node_id === "string" ? event.payload.node_id : "";
    const rawContext = event.payload.context;
    if (!nodeId || !rawContext || typeof rawContext !== "object") {
      continue;
    }
    contexts.set(nodeId, rawContext as ExecutionContext);
  }
  return contexts;
}

function buildRuntimeInputFromContext(context: ExecutionContext): Record<string, unknown> {
  const prompt = buildAutonomousPrompt(context.node.role, context.node.input, {
    task: context.task,
    dependsOn: context.node.depends_on,
    plannerPolicy: context.policy,
    promptContext: context.dependencyOutputs,
    workingMemory: context.workingMemory,
    retrievalContext: context.retrievalContext
  });

  return {
    __policy: {
      recommendedTools: context.policy?.recommendedTools ?? [],
      requiredCapabilities: context.policy?.requiredCapabilities ?? [],
      verificationPolicy: context.policy?.verificationPolicy ?? "",
      needsVerification: context.intent?.needs_verification ?? false,
      taskKind: context.intent?.task_kind ?? ""
    },
    __memory: {
      memoryRefs: context.memoryRefs,
      workingMemory: context.workingMemory,
      retrievalContext: context.retrievalContext
    },
    input: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ]
  };
}

function withNodeMetadata(runtimeInput: Record<string, unknown>, context: ExecutionContext) {
  return {
    ...runtimeInput,
    parent_node_id: context.node.depends_on[0],
    depth: context.node.depends_on.length
  };
}

function extractRuntimePolicy(runtimeInput: Record<string, unknown>): RuntimePolicyMetadata {
  const raw = runtimeInput.__policy;
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return raw as RuntimePolicyMetadata;
}

function isAllowedToolCall(toolCall: ToolIntent, policy: RuntimePolicyMetadata): boolean {
  return allowsToolByCapabilities({
    tool: toolCall.tool,
    recommendedTools: policy.recommendedTools,
    requiredCapabilities: policy.requiredCapabilities
  });
}

function requiresVerification(policy: RuntimePolicyMetadata): boolean {
  if (policy.needsVerification) {
    return true;
  }
  return typeof policy.verificationPolicy === "string" && policy.verificationPolicy.trim().length > 0;
}

function defaultEvaluateNode(args: {
  delivery: DeliveryBundle;
  policy: RuntimePolicyMetadata;
  iteration: number;
  sawToolStage: boolean;
}): { decision: "stop" | "revise" | "block"; reason: string } {
  if (args.delivery.status === "blocked") {
    return {
      decision: "block",
      reason: args.delivery.blocking_reason ?? "delivery_blocked"
    };
  }

  const evalDecision = evaluateDecision(
    {
      quality: args.delivery.final_result.trim().length > 0 ? 0.9 : 0.2,
      cost: 0.8,
      latency: 0.8,
      consecutiveRevises: args.iteration,
      qualityDelta: args.iteration === 0 ? 0.1 : 0.01,
      guardrailTripped: false,
      unrecoverableToolError: false
    },
    {
      quality: 0.6,
      cost: 0.2,
      latency: 0.2
    }
  );

  if (evalDecision.decision === "revise") {
    return {
      decision: "revise",
      reason: evalDecision.reason
    };
  }

  if (evalDecision.decision === "escalate") {
    return {
      decision: "block",
      reason: evalDecision.reason
    };
  }

  return {
    decision: "stop",
    reason: "quality_sufficient"
  };
}

function buildAutonomousPrompt(
  role: AgentRole,
  task: string,
  context?: {
    task: string;
    dependsOn?: string[];
    plannerPolicy?: PlannerPolicy;
    promptContext?: string[];
    workingMemory?: string[];
    retrievalContext?: Array<{ sourceId: string; content: string; relevance?: number }>;
  }
): { system: string; user: string } {
  const dependencyLine =
    context?.dependsOn && context.dependsOn.length > 0
      ? `Completed dependency nodes: ${context.dependsOn.join(", ")}. Use their outputs as prior context when available.`
      : "No dependency nodes are available for this step.";
  const plannerPolicyLines = context?.plannerPolicy
    ? [
        `Planner recommended tools: ${context.plannerPolicy.recommendedTools.join(", ") || "none"}.`,
        `Planner required capabilities: ${context.plannerPolicy.requiredCapabilities.join(", ") || "none"}.`,
        `Planner verification policy: ${context.plannerPolicy.verificationPolicy || "default"}`
      ]
    : [];
  const contextLines = context?.promptContext?.length
    ? context.promptContext.map((entry, index) => `Context[${index + 1}]: ${entry}`)
    : [];
  const memoryLines = context?.workingMemory?.length
    ? context.workingMemory.map((entry, index) => `WorkingMemory[${index + 1}]: ${entry}`)
    : [];
  const retrievalLines = context?.retrievalContext?.length
    ? context.retrievalContext.map((entry, index) =>
        `Retrieved[${index + 1}] ${entry.sourceId} (relevance=${String(entry.relevance ?? "")}): ${entry.content}`
      )
    : [];

  return {
    system: [
      `You are an autonomous ${role} agent.`,
      "Use tools when claims require external evidence.",
      "Available local tools: web_search, page_fetch, github_readme, github_file, verify_sources, echo.",
      "Research or factual tasks must include verification URLs or evidence strings.",
      "If you use a tool, respond with JSON only in one of two forms.",
      "Tool request schema:",
      '{"tool_calls":[{"transport":"local","tool":"web_search","input":{"query":"..."}}]}',
      "Final delivery schema:",
      '{"final_result":"markdown text","verification":["source or evidence"],"artifacts":[],"risks":[],"next_actions":[]}',
      "Do not claim completion with an empty final_result.",
      "Do not claim completion for research work without verification.",
      dependencyLine,
      ...plannerPolicyLines,
      ...contextLines,
      ...memoryLines,
      ...retrievalLines,
      getRoleInstructions(role)
    ].join("\n"),
    user: `User task: ${context?.task ?? task}\n\nCurrent node objective: ${task}`
  };
}

function getRoleInstructions(role: AgentRole) {
  switch (role) {
    case "planner":
      return "Focus on planning and scoping. Avoid spending multiple turns on the same research tool.";
    case "researcher":
      return "Prefer tool-driven evidence collection. Return notes only when they are grounded in tool results.";
    case "writer":
      return "Produce polished final prose. Do not invent unsupported facts. If evidence is insufficient, say so.";
    default:
      return "Complete the assigned objective conservatively and precisely.";
  }
}

function publish(eventBus: EventBus, type: string, payload: Record<string, unknown>) {
  eventBus.publish({ type, payload, ts: Date.now() });
}

function parseRuntimeEnvelope(outputText: string | undefined): {
  status?: string;
  output_text?: string;
  final_result?: string;
  invalid_tool_call_text?: boolean;
  verification?: string[];
  risks?: string[];
  artifacts?: string[];
  next_actions?: string[];
  blocking_reason?: string;
  tool_calls?: ToolIntent[];
} {
  if (!outputText) {
    return {};
  }

  try {
    return normalizeParsedEnvelope(JSON.parse(stripCodeFence(outputText)));
  } catch {
    if (looksLikePseudoToolCallText(outputText)) {
      return {
        output_text: outputText,
        invalid_tool_call_text: true
      };
    }
    return { output_text: outputText, final_result: outputText };
  }
}

function attachToolResults(runtimeInput: Record<string, unknown>, toolResults: unknown[]) {
  const existingInput = Array.isArray(runtimeInput.input) ? [...(runtimeInput.input as unknown[])] : [];
  existingInput.push({
    role: "tool",
    content: JSON.stringify(toolResults)
  });

  return {
    ...runtimeInput,
    input: existingInput
  };
}

function attachRepairInstruction(runtimeInput: Record<string, unknown>) {
  const existingInput = Array.isArray(runtimeInput.input) ? [...(runtimeInput.input as unknown[])] : [];
  existingInput.push({
    role: "user",
    content:
      "Your previous response was empty or invalid. Reply with JSON only. Either return tool_calls or a final_result with verification."
  });

  return {
    ...runtimeInput,
    input: existingInput
  };
}

function attachRevisionInstruction(runtimeInput: Record<string, unknown>, reason: string) {
  const existingInput = Array.isArray(runtimeInput.input) ? [...(runtimeInput.input as unknown[])] : [];
  existingInput.push({
    role: "user",
    content: `Revise your previous response and improve it. Reason: ${reason}. Reply with JSON only.`
  });

  return {
    ...runtimeInput,
    input: existingInput
  };
}

function normalizeParsedEnvelope(parsed: unknown) {
  if (Array.isArray(parsed) && parsed.length === 1 && parsed[0] && typeof parsed[0] === "object") {
    return parsed[0] as {
      status?: string;
      output_text?: string;
      final_result?: string;
      invalid_tool_call_text?: boolean;
      verification?: string[];
      risks?: string[];
      artifacts?: string[];
      next_actions?: string[];
      blocking_reason?: string;
      tool_calls?: ToolIntent[];
    };
  }

  return parsed as {
    status?: string;
    output_text?: string;
    final_result?: string;
    invalid_tool_call_text?: boolean;
    verification?: string[];
    risks?: string[];
    artifacts?: string[];
    next_actions?: string[];
    blocking_reason?: string;
    tool_calls?: ToolIntent[];
  };
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : value;
}

function isEmptyEnvelope(
  envelope: {
    output_text?: string;
    final_result?: string;
    invalid_tool_call_text?: boolean;
    artifacts?: string[];
    tool_calls?: ToolIntent[];
    blocking_reason?: string;
  },
  runtimeResult: unknown
) {
  const hasExplicitOutputText =
    runtimeResult && typeof runtimeResult === "object" && "outputText" in runtimeResult;
  const rawOutput = hasExplicitOutputText
    ? String((runtimeResult as { outputText?: string }).outputText ?? "")
    : "";

  return (
    hasExplicitOutputText &&
    !envelope.blocking_reason &&
    envelope.invalid_tool_call_text !== true &&
    (envelope.tool_calls?.length ?? 0) === 0 &&
    (envelope.artifacts?.length ?? 0) === 0 &&
    (envelope.final_result ?? "").trim().length === 0 &&
    (envelope.output_text ?? "").trim().length === 0 &&
    rawOutput.trim().length === 0
  );
}

function looksLikePseudoToolCallText(outputText: string): boolean {
  return /<tool_call>|<function=|<parameter=|<\/tool_call>|<\/function>|<\/parameter>/i.test(outputText);
}

function summarizeInput(runtimeInput?: Record<string, unknown>) {
  const input = runtimeInput?.input;
  if (!Array.isArray(input)) {
    return "";
  }

  const lastUserMessage = [...input]
    .reverse()
    .find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        "role" in entry &&
        (entry as { role?: unknown }).role === "user" &&
        typeof (entry as { content?: unknown }).content === "string"
    ) as { content?: string } | undefined;

  return typeof lastUserMessage?.content === "string" ? lastUserMessage.content.slice(0, 280) : "";
}
