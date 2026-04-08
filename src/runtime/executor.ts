import type { RuntimeConfig } from "../types/runtime";
import type { AgentRole } from "../types/runtime";
import type { DagWorkflow } from "../types/dag";
import type { DeliveryBundle } from "../types/runtime";
import type { RuntimeEvent } from "../core/eventBus";
import { buildWorkflowFromIntent, planWorkflowFromPlanner } from "./plan";
import { classifyTaskIntent } from "./intent";
import { createExecutionContext } from "./context";
import type { ExecutionContext, PlannerPolicy } from "./contracts";
import { enrichExecutionContext, type MemoryStore, type RetrievalProvider } from "./memory";
import type { TaskStore } from "../core/taskStore";

type EventBus = {
  publish: (event: RuntimeEvent) => void;
};

type EventLogStore = {
  getAll: () => RuntimeEvent[];
};

type ResolveModelRoute = (
  config: RuntimeConfig,
  role: AgentRole,
  env?: Record<string, string | undefined>
) => {
  model: string;
  reasoner: string;
  baseUrl?: string;
  apiKey?: string;
};

type ExecuteInput = {
  input: string;
  workflow?: DagWorkflow;
};

type ResumeInput = {
  taskId: string;
  maxParallel?: number;
};

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

type TaskExecutorDeps = {
  config: RuntimeConfig;
  eventBus: EventBus;
  eventLogStore: EventLogStore;
  runtime?: {
    run: (input: any) => Promise<any>;
  };
  orchestrator: {
    runSingleNodeContext: (input: {
      taskId: string;
      context: ExecutionContext;
      resolveRuntimeInput?: (args: {
        role: AgentRole;
        context: ExecutionContext;
        runtimeInput: Record<string, unknown>;
      }) => Record<string, unknown>;
    }) => Promise<{
      finalState: "completed" | "aborted";
      stateTrace: string[];
      delivery: DeliveryBundle;
    }>;
    runParallelContexts: (input: {
      taskId: string;
      contexts: ExecutionContext[];
      maxParallel: number;
      dispatchMode?: "local" | "queue";
      resolveRuntimeInput?: (args: {
        role: AgentRole;
        context: ExecutionContext;
        runtimeInput: Record<string, unknown>;
      }) => Record<string, unknown>;
    }) => Promise<{
      completedNodes: number;
      joinDecision: string;
      nodeResults?: Array<{
        nodeId: string;
        finalState: "completed" | "aborted";
        delivery: DeliveryBundle;
      }>;
    }>;
    resumeTask: (taskId: string, maxParallel?: number) => Promise<{
      completedNodes: number;
      status: "completed" | "aborted";
      message?: string;
    }>;
  };
  finalizeDelivery: (args: {
    taskId: string;
    taskInput: string;
    delivery: DeliveryBundle;
  }) => Promise<DeliveryBundle>;
  resolveModelRoute: ResolveModelRoute;
  taskIdFactory?: () => string;
  availableLocalTools?: string[];
  env?: Record<string, string | undefined>;
  retrievalProvider?: RetrievalProvider;
  memoryStore?: MemoryStore;
  taskStore?: TaskStore;
};

export function createTaskExecutor(deps: TaskExecutorDeps) {
  const env = deps.env ?? process.env;

  const persistTaskMemory = async (entry: {
    taskId: string;
    sourceId: string;
    content: string;
    tags?: string[];
  }) => {
    if (!entry.content.trim()) {
      return;
    }

    await deps.memoryStore?.appendEntry?.(entry);
    deps.eventBus.publish({
      type: "TaskMemoryStored",
      payload: {
        task_id: entry.taskId,
        source_id: entry.sourceId,
        content: entry.content,
        tags: entry.tags ?? []
      },
      ts: Date.now()
    });
  };

  return {
    async execute(input: ExecuteInput): Promise<ExecuteResult> {
      const taskId = deps.taskIdFactory?.() ?? crypto.randomUUID();
      const availableLocalTools = deps.availableLocalTools ?? [];

      deps.eventBus.publish({
        type: "TaskSubmitted",
        payload: {
          task_id: taskId,
          node_id: "node-root"
        },
        ts: Date.now()
      });

      let totalNodes = 0;
      let finalState: "completed" | "aborted" = "completed";
      let stateTrace: string[] = [];
      let outputText = "";
      let delivery: DeliveryBundle = {
        status: "completed",
        final_result: "",
        artifacts: [],
        verification: [],
        risks: [],
        next_actions: []
      };
      let plannerPolicy: PlannerPolicy | undefined;
      const resolveRuntimeInput = ({ role, runtimeInput }: {
        role: AgentRole;
        context: ExecutionContext;
        runtimeInput: Record<string, unknown>;
      }) => {
        const nodeRoute = deps.resolveModelRoute(deps.config, role, env);
        return {
          ...runtimeInput,
          apiKey: nodeRoute.apiKey ?? env.OPENROUTER_API_KEY,
          model: nodeRoute.model,
          baseUrl: nodeRoute.baseUrl,
          fallbackModels: deps.config.models.fallback,
          reasoner: nodeRoute.reasoner,
          retry: deps.config.retry
        };
      };

      const plannerRoute = deps.resolveModelRoute(deps.config, "planner", env);
      const intent = input.workflow
        ? null
        : await classifyTaskIntent({
            task: input.input,
            runtime: deps.runtime as any,
            runtimeInput: {
              apiKey: plannerRoute.apiKey ?? env.OPENROUTER_API_KEY,
              model: plannerRoute.model,
              baseUrl: plannerRoute.baseUrl,
              fallbackModels: deps.config.models.fallback,
              reasoner: plannerRoute.reasoner,
              retry: deps.config.retry
            }
          });

      if (intent) {
        deps.eventBus.publish({
          type: "IntentClassified",
          payload: {
            task_id: taskId,
            task_kind: intent.task_kind,
            execution_mode: intent.execution_mode,
            roles: intent.roles,
            needs_verification: intent.needs_verification,
            reason: intent.reason
          },
          ts: Date.now()
        });
      }

      const plannerWorkflow = !input.workflow && intent?.execution_mode === "tree"
        ? await planWorkflowFromPlanner({
            task: input.input,
            intent,
            availableTools: availableLocalTools,
            runtime: deps.runtime as any,
            runtimeInput: {
              apiKey: plannerRoute.apiKey ?? env.OPENROUTER_API_KEY,
              model: plannerRoute.model,
              baseUrl: plannerRoute.baseUrl,
              fallbackModels: deps.config.models.fallback,
              reasoner: plannerRoute.reasoner,
              retry: deps.config.retry
            }
          })
        : null;

      if (plannerWorkflow) {
        plannerPolicy = {
          recommendedTools: plannerWorkflow.recommendedTools,
          requiredCapabilities: plannerWorkflow.requiredCapabilities,
          verificationPolicy: plannerWorkflow.verificationPolicy
        };
        deps.eventBus.publish({
          type: "PlannerExpanded",
          payload: {
            task_id: taskId,
            child_count: Math.max(plannerWorkflow.nodes.length - 1, 0),
            recommended_tools: plannerWorkflow.recommendedTools,
            required_capabilities: plannerWorkflow.requiredCapabilities,
            verification_policy: plannerWorkflow.verificationPolicy
          },
          ts: Date.now()
        });
      }

      const workflow = input.workflow ?? plannerWorkflow ?? buildWorkflowFromIntent(intent, input.input);

      if (workflow) {
        deps.eventBus.publish({
          type: "ChildrenSpawned",
          payload: {
            task_id: taskId,
            node_id: "node-root",
            child_count: Math.max(workflow.nodes.length - 1, 0)
          },
          ts: Date.now()
        });

        const tiers = resolveExecutionTiers(workflow);
        for (const [tierIndex, tier] of tiers.entries()) {
          const contexts = await Promise.all(tier.map((node) =>
            enrichExecutionContext({
              taskId,
              retrievalProvider: deps.retrievalProvider,
              memoryStore: deps.memoryStore,
              context: createExecutionContext({
                intent,
                plan: workflow,
                policy: plannerPolicy,
                node: normalizeExecutionNode(node),
                task: input.input,
                dependencyOutputs: []
              })
            })
          ));

          const tierResult = await deps.orchestrator.runParallelContexts({
            taskId,
            contexts,
            maxParallel: 5,
            resolveRuntimeInput
          });
          totalNodes += tierResult.completedNodes;
          for (const nodeResult of tierResult.nodeResults ?? []) {
            if (nodeResult.delivery.final_result.trim().length > 0) {
              await persistTaskMemory({
                taskId,
                sourceId: `mem://${taskId}/${nodeResult.nodeId}`,
                content: nodeResult.delivery.final_result,
                tags: ["node-result", `node:${nodeResult.nodeId}`]
              });
            }
          }
          await persistTaskMemory({
            taskId,
            sourceId: `mem://${taskId}/join/tier-${tierIndex}`,
            content: formatJoinSummary(tierIndex, tierResult.nodeResults ?? []),
            tags: ["join-summary", `tier:${tierIndex}`]
          });
          if (tierResult.joinDecision === "aborted") {
            finalState = "aborted";
            break;
          }
        }
      } else {
        const result = await deps.orchestrator.runSingleNodeContext({
          taskId,
          context: await enrichExecutionContext({
            taskId,
            retrievalProvider: deps.retrievalProvider,
            memoryStore: deps.memoryStore,
            context: createExecutionContext({
              intent,
              plan: null,
              policy: plannerPolicy,
              node: {
                id: "node-root",
                role: "planner",
                input: input.input,
                depends_on: []
              },
              task: input.input
            })
          }),
          resolveRuntimeInput
        });
        totalNodes = 1;
        stateTrace = result.stateTrace;
        delivery = result.delivery;
        outputText = result.delivery.final_result;
        await persistTaskMemory({
          taskId,
          sourceId: `mem://${taskId}/node-root`,
          content: result.delivery.final_result,
          tags: [intent?.task_kind ?? "general", "node:planner"]
        });
      }

      const events = deps.eventLogStore.getAll();
      let totalTokens = 0;
      let totalCost = 0;

      for (const event of events) {
        if (event.type === "Evaluated") {
          if (event.payload.usage) {
            const usage = event.payload.usage as any;
            totalTokens += usage.total_tokens || 0;
            totalCost += (event.payload.cost as number) || 0;
          }
          if (event.payload.output_text) {
            outputText = String(event.payload.output_text);
          }
          if (event.payload.delivery) {
            delivery = event.payload.delivery as DeliveryBundle;
          }
        }
      }

      delivery = await deps.finalizeDelivery({
        taskId,
        taskInput: input.input,
        delivery
      });
      finalState = delivery.status === "completed" ? "completed" : "aborted";
      outputText = delivery.final_result;

      deps.eventBus.publish({
        type: "TaskClosed",
        payload: {
          task_id: taskId,
          state: finalState,
          delivery,
          final_result: delivery.final_result,
          artifacts: delivery.artifacts,
          blocking_reason: delivery.blocking_reason
        },
        ts: Date.now()
      });

      return {
        taskId,
        finalState,
        outputText,
        delivery,
        summary: {
          nodeCount: totalNodes,
          childSpawns: events
            .filter((event) => event.type === "ChildrenSpawned")
            .reduce((sum, event) => sum + Number(event.payload.child_count ?? 0), 0),
          toolCalls: {
            localSuccess: events.filter(
              (event) => event.type === "ToolReturned" && String(event.payload.provider ?? "") === "local"
            ).length,
            mcpSuccess: events.filter(
              (event) => event.type === "ToolReturned" && String(event.payload.provider ?? "") === "mcp"
            ).length
          },
          evaluatorDecisions: events
            .filter((event) => event.type === "Evaluated")
            .map((event) => String(event.payload.decision ?? "unknown")),
          path: stateTrace
        },
        telemetry: {
          total_tokens: totalTokens,
          total_cost_usd: totalCost
        }
      };
    },

    async resume(input: ResumeInput): Promise<ExecuteResult> {
      if (!deps.taskStore) {
        throw new Error("TaskStore is required for executor.resume");
      }

      const beforeEvents = await deps.taskStore.getEvents(input.taskId);
      const taskInput = restoreTaskInput(beforeEvents) ?? `resumed task ${input.taskId}`;
      const resumeResult = await deps.orchestrator.resumeTask(input.taskId, input.maxParallel ?? 2);
      const afterEvents = await deps.taskStore.getEvents(input.taskId);
      const resumedEvents = afterEvents.slice(beforeEvents.length);
      const restoredDelivery = restoreLatestDelivery(afterEvents) ?? {
        status: resumeResult.status === "completed" ? "completed" : "blocked",
        final_result: "",
        artifacts: [],
        verification: [],
        risks: [],
        blocking_reason: resumeResult.status === "completed" ? undefined : "resume_incomplete",
        next_actions: []
      };

      const delivery = await deps.finalizeDelivery({
        taskId: input.taskId,
        taskInput,
        delivery: restoredDelivery
      });
      const finalState = delivery.status === "completed" ? "completed" : "aborted";

      deps.eventBus.publish({
        type: "TaskClosed",
        payload: {
          task_id: input.taskId,
          state: finalState,
          resumed: true,
          delivery,
          final_result: delivery.final_result,
          artifacts: delivery.artifacts,
          blocking_reason: delivery.blocking_reason
        },
        ts: Date.now()
      });

      return {
        taskId: input.taskId,
        finalState,
        outputText: delivery.final_result,
        delivery,
        summary: {
          nodeCount: resumedEvents.filter((event) => event.type === "NodeScheduled").length,
          childSpawns: resumedEvents
            .filter((event) => event.type === "ChildrenSpawned")
            .reduce((sum, event) => sum + Number(event.payload.child_count ?? 0), 0),
          toolCalls: {
            localSuccess: resumedEvents.filter(
              (event) => event.type === "ToolReturned" && String(event.payload.provider ?? "") === "local"
            ).length,
            mcpSuccess: resumedEvents.filter(
              (event) => event.type === "ToolReturned" && String(event.payload.provider ?? "") === "mcp"
            ).length
          },
          evaluatorDecisions: resumedEvents
            .filter((event) => event.type === "Evaluated")
            .map((event) => String(event.payload.decision ?? "unknown")),
          path: ["running", finalState]
        },
        telemetry: {
          total_tokens: resumedEvents
            .filter((event) => event.type === "Evaluated")
            .reduce((sum, event) => sum + Number((event.payload.usage as any)?.total_tokens ?? 0), 0),
          total_cost_usd: resumedEvents
            .filter((event) => event.type === "Evaluated")
            .reduce((sum, event) => sum + Number(event.payload.cost ?? 0), 0)
        }
      };
    }
  };
}

function normalizeExecutionNode(node: DagWorkflow["nodes"][number]) {
  return {
    ...node,
    role: node.role as AgentRole
  };
}

function restoreTaskInput(events: RuntimeEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "ExecutionContextPrepared") {
      continue;
    }
    const context = event.payload.context as { task?: unknown } | undefined;
    if (typeof context?.task === "string" && context.task.trim().length > 0) {
      return context.task;
    }
  }
  return undefined;
}

function restoreLatestDelivery(events: RuntimeEvent[]): DeliveryBundle | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "TaskClosed" && event.payload.delivery && typeof event.payload.delivery === "object") {
      return event.payload.delivery as DeliveryBundle;
    }
    if (event.type === "Evaluated" && event.payload.delivery && typeof event.payload.delivery === "object") {
      return event.payload.delivery as DeliveryBundle;
    }
  }
  return undefined;
}

function formatJoinSummary(
  tierIndex: number,
  nodeResults: Array<{
    nodeId: string;
    finalState: "completed" | "aborted";
    delivery: DeliveryBundle;
  }>
) {
  return JSON.stringify(
    {
      tier: tierIndex,
      node_count: nodeResults.length,
      nodes: nodeResults.map((result) => ({
        node_id: result.nodeId,
        state: result.finalState,
        verification_count: result.delivery.verification.length,
        artifact_count: result.delivery.artifacts.length,
        final_result_preview: result.delivery.final_result.slice(0, 240)
      }))
    },
    null,
    2
  );
}

function resolveExecutionTiers(workflow: DagWorkflow) {
  const nodes = workflow.nodes;
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  const nodeMap = new Map<string, (typeof nodes)[number]>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    graph.set(node.id, []);
  }

  for (const node of nodes) {
    for (const dep of node.depends_on) {
      graph.get(dep)?.push(node.id);
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
    }
  }

  const tiers: typeof nodes[] = [];
  let currentTier = nodes.filter((node) => inDegree.get(node.id) === 0);

  while (currentTier.length > 0) {
    tiers.push(currentTier);
    const nextTier: typeof nodes = [];
    for (const node of currentTier) {
      for (const neighbor of graph.get(node.id) ?? []) {
        const next = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, next);
        if (next === 0) {
          nextTier.push(nodeMap.get(neighbor)!);
        }
      }
    }
    currentTier = nextTier;
  }

  return tiers;
}
