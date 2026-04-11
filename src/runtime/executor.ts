import type { RuntimeConfig } from "../types/runtime";
import type { AgentRole } from "../types/runtime";
import type { DagWorkflow } from "../types/dag";
import type { DeliveryBundle } from "../types/runtime";
import type { RuntimeEvent } from "../core/eventBus";
import { buildWorkflowFromIntent, normalizeJoinDecision, planWorkflowFromPlanner } from "./plan";
import { classifyTaskIntent } from "./intent";
import { createExecutionContext } from "./context";
import { applyFamilyDeliveryPolicy, createFamilyDeliveryBundle, normalizeDeliveryProof } from "./deliveryHarness";
import { auditFamilyDelivery } from "./familyAudit";
import { finalizeContentPipelineDelivery } from "./contentPipeline";
import { buildTaskFamilyPolicy, inferTaskFamily, normalizeTaskFamily } from "./taskFamily";
import { finalizeCompetitiveResearchDelivery } from "./competitiveResearch";
import { finalizeResearchWritingDelivery } from "./researchWriting";
import type { ExecutionContext, FamilyDeliveryBundle, JoinDecision, PlannerPolicy, TaskFamily, TaskFamilyPolicy } from "./contracts";
import { evaluateAcceptanceProof } from "../eval/evaluator";
import { enrichExecutionContext, type MemoryStore, type RetrievalProvider } from "./memory";
import type { TaskStore } from "../core/taskStore";
import { promoteExecutionSummaryToProjectMemory } from "./memoryEvolution";
import type { CompletionHarnessStore, CompletionAcceptanceDecision } from "./completionHarness";

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

type ResolveHumanActionInput = {
  taskId: string;
  nodeId: string;
  action?: "approve" | "reject" | "clarify";
  feedback: string;
};

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
      joinDecision: JoinDecision;
      nodeResults?: Array<{
        nodeId: string;
        finalState: "completed" | "aborted";
        delivery: DeliveryBundle;
      }>;
    }>;
    resumeTask: (
      taskId: string,
      maxParallel?: number,
      resolveRuntimeInput?: (args: {
        role: AgentRole;
        context: ExecutionContext;
        runtimeInput: Record<string, unknown>;
      }) => Record<string, unknown>
    ) => Promise<{
      completedNodes: number;
      status: "completed" | "aborted";
      message?: string;
    }>;
    resumeHitl: (taskId: string, nodeId: string, feedback: string, action?: "approve" | "reject" | "clarify") => Promise<void>;
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
  completionHarness?: CompletionHarnessStore;
};

export function createTaskExecutor(deps: TaskExecutorDeps) {
  const env = deps.env ?? process.env;
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

  const persistProjectMemory = async (entry: {
    taskId: string;
    family: string;
    taskInput: string;
    finalResult: string;
  }) => {
    await promoteExecutionSummaryToProjectMemory({
      memoryStore: deps.memoryStore,
      taskId: entry.taskId,
      family: entry.family,
      taskInput: entry.taskInput,
      finalResult: entry.finalResult
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

      const family = inferTaskFamily({
        intent,
        task: input.input
      });
      const familyPolicy = family ? buildTaskFamilyPolicy(family) : undefined;

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
          verificationPolicy: plannerWorkflow.verificationPolicy,
          family,
          familyPolicy
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
                policy: buildFamilyAwarePolicy(plannerPolicy, family, familyPolicy),
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
          if (normalizeJoinDecision(tierResult.joinDecision) === "block") {
            finalState = "aborted";
            delivery = {
              status: "blocked",
              final_result: "",
              artifacts: [],
              verification: [],
              risks: [],
              blocking_reason: "join_blocked",
              next_actions: []
            };
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
              policy: buildFamilyAwarePolicy(plannerPolicy, family, familyPolicy),
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

      const finalizedDelivery = await deps.finalizeDelivery({
        taskId,
        taskInput: input.input,
        delivery
      });
      await persistProjectMemory({
        taskId,
        family: family ?? "general",
        taskInput: input.input,
        finalResult: finalizedDelivery.final_result
      });
      let familyDelivery = finalizeTaskFamilyDelivery({
        delivery: finalizedDelivery,
        family,
        familyPolicy
      });
      if ("family" in familyDelivery && familyDelivery.family === "research_writing") {
        familyDelivery = await finalizeResearchWritingDelivery({
          taskId,
          taskInput: input.input,
          delivery: familyDelivery
        });
      }
      if ("family" in familyDelivery && familyDelivery.family === "competitive_research") {
        familyDelivery = await finalizeCompetitiveResearchDelivery({
          taskId,
          taskInput: input.input,
          delivery: familyDelivery
        });
      }
      if ("family" in familyDelivery && familyDelivery.family === "content_pipeline") {
        familyDelivery = await finalizeContentPipelineDelivery({
          taskId,
          taskInput: input.input,
          delivery: familyDelivery
        });
      }
      if ("family" in familyDelivery) {
        familyDelivery = applyFamilyDeliveryPolicy({
          delivery: familyDelivery,
          familyPolicy
        });
      }
      if ("family" in familyDelivery) {
        familyDelivery = await auditFamilyDelivery({
          delivery: familyDelivery,
          familyPolicy
        });
      }
      const acceptanceDecision = "acceptance_proof" in familyDelivery
        ? evaluateAcceptanceProof(familyDelivery.acceptance_proof)
        : "deliver";
      finalState = familyDelivery.status === "completed" && acceptanceDecision === "deliver" ? "completed" : "aborted";
      outputText = familyDelivery.final_result;
      await deps.completionHarness?.appendRecord(buildCompletionRecord({
        taskId,
        family,
        taskInput: input.input,
        finalState,
        delivery: familyDelivery
      }));

      deps.eventBus.publish({
        type: "TaskClosed",
        payload: {
          task_id: taskId,
          state: finalState,
          delivery: familyDelivery,
          final_result: familyDelivery.final_result,
          artifacts: familyDelivery.artifacts,
          blocking_reason: familyDelivery.blocking_reason
        },
        ts: Date.now()
      });

      return {
        taskId,
        finalState,
        outputText,
        delivery: familyDelivery,
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
      const resumeResult = await deps.orchestrator.resumeTask(input.taskId, input.maxParallel ?? 2, resolveRuntimeInput);
      const afterEvents = await deps.taskStore.getEvents(input.taskId);
      const resumedEvents = afterEvents.slice(beforeEvents.length);
      const family = restoreTaskFamily(afterEvents) ?? restoreTaskFamily(beforeEvents);
      const familyPolicy = restoreTaskFamilyPolicy(afterEvents) ?? restoreTaskFamilyPolicy(beforeEvents) ?? (family ? buildTaskFamilyPolicy(family) : undefined);
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
      let familyDelivery = finalizeTaskFamilyDelivery({
        delivery,
        family,
        familyPolicy
      });
      if ("family" in familyDelivery && familyDelivery.family === "research_writing") {
        familyDelivery = await finalizeResearchWritingDelivery({
          taskId: input.taskId,
          taskInput,
          delivery: familyDelivery
        });
      }
      if ("family" in familyDelivery && familyDelivery.family === "competitive_research") {
        familyDelivery = await finalizeCompetitiveResearchDelivery({
          taskId: input.taskId,
          taskInput,
          delivery: familyDelivery
        });
      }
      if ("family" in familyDelivery && familyDelivery.family === "content_pipeline") {
        familyDelivery = await finalizeContentPipelineDelivery({
          taskId: input.taskId,
          taskInput,
          delivery: familyDelivery
        });
      }
      if ("family" in familyDelivery) {
        familyDelivery = applyFamilyDeliveryPolicy({
          delivery: familyDelivery,
          familyPolicy
        });
      }
      if ("family" in familyDelivery) {
        familyDelivery = await auditFamilyDelivery({
          delivery: familyDelivery,
          familyPolicy
        });
      }
      const acceptanceDecision = "acceptance_proof" in familyDelivery
        ? evaluateAcceptanceProof(familyDelivery.acceptance_proof)
        : "deliver";
      const finalState = familyDelivery.status === "completed" && acceptanceDecision === "deliver" ? "completed" : "aborted";
      await deps.completionHarness?.appendRecord(buildCompletionRecord({
        taskId: input.taskId,
        family,
        taskInput,
        finalState,
        delivery: familyDelivery
      }));

      deps.eventBus.publish({
        type: "TaskClosed",
        payload: {
          task_id: input.taskId,
          state: finalState,
          resumed: true,
          delivery: familyDelivery,
          final_result: familyDelivery.final_result,
          artifacts: familyDelivery.artifacts,
          blocking_reason: familyDelivery.blocking_reason
        },
        ts: Date.now()
      });

      return {
        taskId: input.taskId,
        finalState,
        outputText: familyDelivery.final_result,
        delivery: familyDelivery,
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
    },

    async resolveHumanAction(input: ResolveHumanActionInput) {
      await deps.orchestrator.resumeHitl(input.taskId, input.nodeId, input.feedback, input.action);
      return {
        taskId: input.taskId,
        nodeId: input.nodeId,
        action: input.action ?? "approve",
        resolved: true
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

function restoreTaskFamily(events: RuntimeEvent[]): TaskFamily | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "ExecutionContextPrepared") {
      const context = event.payload.context as { policy?: { family?: unknown } } | undefined;
      const family = normalizeTaskFamily(context?.policy?.family);
      if (family) {
        return family;
      }
    }

    if ((event.type === "TaskClosed" || event.type === "Evaluated") && event.payload.delivery && typeof event.payload.delivery === "object") {
      const family = normalizeTaskFamily((event.payload.delivery as { family?: unknown }).family);
      if (family) {
        return family;
      }
    }
  }

  return undefined;
}

function restoreTaskFamilyPolicy(events: RuntimeEvent[]): TaskFamilyPolicy | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== "ExecutionContextPrepared") {
      continue;
    }

    const context = event.payload.context as { policy?: { familyPolicy?: unknown } } | undefined;
    const familyPolicy = context?.policy?.familyPolicy;
    if (familyPolicy && typeof familyPolicy === "object") {
      return familyPolicy as TaskFamilyPolicy;
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

function buildFamilyAwarePolicy(
  policy: PlannerPolicy | undefined,
  family: TaskFamily | undefined,
  familyPolicy: TaskFamilyPolicy | undefined
): PlannerPolicy | undefined {
  if (!policy && !family) {
    return undefined;
  }

  return {
    recommendedTools: policy?.recommendedTools ?? [],
    requiredCapabilities: policy?.requiredCapabilities ?? [],
    verificationPolicy: policy?.verificationPolicy ?? "",
    maxRevisions: policy?.maxRevisions,
    requireArtifacts: policy?.requireArtifacts,
    family,
    familyPolicy
  };
}

function finalizeTaskFamilyDelivery(args: {
  delivery: DeliveryBundle;
  family?: TaskFamily;
  familyPolicy?: TaskFamilyPolicy;
}): DeliveryBundle | FamilyDeliveryBundle {
  if (!args.family) {
    return args.delivery;
  }

  const familyDelivery = createFamilyDeliveryBundle({
    family: args.family,
    delivery: args.delivery
  });

  return {
    ...familyDelivery,
    delivery_proof: normalizeDeliveryProof({
      family: args.family,
      proof: familyDelivery.delivery_proof,
      delivery: familyDelivery
    })
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

function buildCompletionRecord(args: {
  taskId: string;
  family?: TaskFamily;
  taskInput: string;
  finalState: "completed" | "aborted";
  delivery: DeliveryBundle | FamilyDeliveryBundle;
}) {
  return {
    taskId: args.taskId,
    family: args.family ?? "general",
    taskInput: args.taskInput,
    finalState: args.finalState,
    deliveryStatus: args.delivery.status,
    acceptanceDecision: inferCompletionAcceptance(args.delivery),
    verifierSummary: readVerifierSummary(args.delivery),
    artifactCount: args.delivery.artifacts.length,
    verificationCount: args.delivery.verification.length
  };
}

function inferCompletionAcceptance(delivery: DeliveryBundle | FamilyDeliveryBundle): CompletionAcceptanceDecision {
  if ("acceptance_proof" in delivery) {
    if (delivery.acceptance_proof?.decision === "accept" || delivery.acceptance_proof?.decision === "revise" || delivery.acceptance_proof?.decision === "reject") {
      return delivery.acceptance_proof.decision;
    }
  }
  return "unverified";
}

function readVerifierSummary(delivery: DeliveryBundle | FamilyDeliveryBundle) {
  if ("acceptance_proof" in delivery) {
    const summary = delivery.acceptance_proof?.verifierSummary;
    return typeof summary === "string" ? summary : "";
  }
  return "";
}
