import { createAgentRuntime } from "../agents/agentRuntime";
import { checkSpawnGuardrails } from "../guardrails/guardrails";
import type { AgentRole } from "../types/runtime";
import type { RuntimeEvent } from "./eventBus";

type EventBus = {
  publish: (event: RuntimeEvent) => void;
  subscribe: (fn: (event: RuntimeEvent) => void) => void;
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
  guardrails: GuardrailLimits;
  runtime?: ReturnType<typeof createAgentRuntime>;
};

type RunTaskInput = {
  taskId: string;
  nodeId: string;
  role: AgentRole;
  runtimeInput?: Record<string, unknown>;
};

type NodeState = "pending" | "running" | "waiting_tool" | "evaluating" | "completed" | "aborted";

type ParallelNodeInput = {
  nodeId: string;
  role: AgentRole;
};

type ParallelTaskInput = {
  taskId: string;
  nodes: ParallelNodeInput[];
  maxParallel: number;
};

export function createOrchestrator(deps: OrchestratorDeps) {
  deps.eventBus.subscribe((event) => deps.eventLogStore.append(event));

  const runtime = deps.runtime ?? createAgentRuntime();

  const runNode = async (input: RunTaskInput): Promise<{ finalState: NodeState; stateTrace: NodeState[] }> => {
    const stateTrace: NodeState[] = ["pending"];
    
    publish(deps.eventBus, "NodeScheduled", { task_id: input.taskId, node_id: input.nodeId });
    stateTrace.push("running");
    publish(deps.eventBus, "AgentStarted", { task_id: input.taskId, node_id: input.nodeId, role: input.role });
    publish(deps.eventBus, "PromptComposed", { task_id: input.taskId, node_id: input.nodeId });
    publish(deps.eventBus, "ModelCalled", { task_id: input.taskId, node_id: input.nodeId });

    stateTrace.push("waiting_tool");
    publish(deps.eventBus, "ToolInvoked", { task_id: input.taskId, node_id: input.nodeId, tool: "echo" });
    await runtime.run(input.runtimeInput);
    publish(deps.eventBus, "ToolReturned", { task_id: input.taskId, node_id: input.nodeId, ok: true });

    stateTrace.push("evaluating");
    publish(deps.eventBus, "Evaluated", { task_id: input.taskId, node_id: input.nodeId, decision: "stop" });

    stateTrace.push("completed");
    publish(deps.eventBus, "NodeCompleted", { task_id: input.taskId, node_id: input.nodeId });
    
    return {
      finalState: "completed",
      stateTrace
    };
  };

  return {
    runSingleNodeTask: async (input: RunTaskInput): Promise<{ finalState: NodeState; stateTrace: NodeState[] }> => {
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
        publish(deps.eventBus, "GuardrailTripped", { task_id: input.taskId, node_id: input.nodeId, reason: guardrail.reason });
        publish(deps.eventBus, "TaskClosed", { task_id: input.taskId, state: "aborted" });
        return { finalState: "aborted", stateTrace: ["pending", "aborted"] };
      }

      const result = await runNode(input);
      publish(deps.eventBus, "TaskClosed", { task_id: input.taskId, state: "completed" });
      
      return result;
    },

    runParallelTask: async (input: ParallelTaskInput) => {
      const results: { nodeId: string; state: NodeState }[] = [];
      const queue = [...input.nodes];
      const activePromises = new Set<Promise<void>>();

      const runNext = async () => {
        if (queue.length === 0) return;
        const node = queue.shift()!;
        const res = await runNode({
          taskId: input.taskId,
          nodeId: node.nodeId,
          role: node.role,
          runtimeInput: {}
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
    }
  };
}

function publish(eventBus: EventBus, type: string, payload: Record<string, unknown>) {
  eventBus.publish({ type, payload, ts: Date.now() });
}
