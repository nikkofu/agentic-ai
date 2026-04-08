import { createAgentRuntime } from "../agents/agentRuntime";
import { checkSpawnGuardrails } from "../guardrails/guardrails";
import type { AgentRole, DeliveryBundle, ToolIntent } from "../types/runtime";
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
};

type RunTaskInput = {
  taskId: string;
  nodeId: string;
  role: AgentRole;
  runtimeInput?: Record<string, unknown>;
};

type NodeState = "pending" | "running" | "waiting_tool" | "evaluating" | "completed" | "aborted";
type NodeResult = { finalState: NodeState; stateTrace: NodeState[]; delivery: DeliveryBundle };

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
      const toolCalls = envelope.tool_calls ?? [];

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

      publish(deps.eventBus, "Evaluated", {
        task_id: input.taskId,
        node_id: input.nodeId,
        role: input.role,
        decision: delivery.status === "completed" ? "stop" : "continue",
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
        joinDecision: "stop"
      };
    },

    resumeTask: async (taskId: string, maxParallel: number = 2) => {
      if (!deps.taskStore) throw new Error("TaskStore is required for resumeTask");

      const graph = await deps.taskStore.getGraph(taskId);
      if (!graph) throw new Error(`Task ${taskId} not found`);

      const incompleteNodes = Object.values(graph.nodes).filter(
        (node) => node.state === "pending" || node.state === "running"
      );

      if (incompleteNodes.length === 0) {
        return { completedNodes: 0, status: "completed", message: "No nodes to resume" };
      }

      publish(deps.eventBus, "TaskSubmitted", { task_id: taskId, resumed: true });

      const queue = [...incompleteNodes];
      const runNext = async () => {
        if (queue.length === 0) return;
        const node = queue.shift()!;
        await runNode({
          taskId,
          nodeId: node.nodeId,
          role: node.role,
          runtimeInput: {}
        });
      };

      const workers = Array.from({ length: Math.min(maxParallel, incompleteNodes.length) }, async () => {
        while (queue.length > 0) {
          await runNext();
        }
      });

      await Promise.all(workers);

      publish(deps.eventBus, "TaskClosed", { task_id: taskId, state: "completed", resumed: true });
      return {
        completedNodes: incompleteNodes.length,
        status: "completed"
      };
    },

    resumeHitl: async (taskId: string, nodeId: string, feedback: string) => {
      publish(deps.eventBus, "HumanActionResolved", { task_id: taskId, node_id: nodeId, feedback });
    }
  };
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
