import type { RuntimeConfig } from "../types/runtime";
import type { DagWorkflow } from "../types/dag";
import type { DeliveryBundle } from "../types/runtime";
import { buildWorkflowFromIntent, planWorkflowFromPlanner } from "./plan";
import { classifyTaskIntent } from "./intent";
import { createExecutionContext } from "./context";
import type { AgentRole, ExecutionContext, PlannerPolicy } from "./contracts";
import { enrichExecutionContext, type MemoryStore, type RetrievalProvider } from "./memory";

type RuntimeEvent = {
  type: string;
  payload: Record<string, unknown>;
  ts?: number;
};

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
};

export function createTaskExecutor(deps: TaskExecutorDeps) {
  const env = deps.env ?? process.env;

  return {
    async execute(input: ExecuteInput): Promise<ExecuteResult> {
      const taskId = deps.taskIdFactory?.() ?? crypto.randomUUID();
      const availableLocalTools = deps.availableLocalTools ?? [];

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
                node,
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
              await deps.memoryStore?.appendEntry?.({
                taskId,
                sourceId: `mem://${taskId}/${nodeResult.nodeId}`,
                content: nodeResult.delivery.final_result,
                tags: ["node-result", `node:${nodeResult.nodeId}`]
              });
            }
          }
          await deps.memoryStore?.appendEntry?.({
            taskId,
            sourceId: `mem://${taskId}/join/tier-${tierIndex}`,
            content: (tierResult.nodeResults ?? [])
              .map((result) => `${result.nodeId}: ${result.delivery.final_result}`.trim())
              .filter((line) => line.length > 0)
              .join("\n"),
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
        await deps.memoryStore?.appendEntry?.({
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
    }
  };
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
