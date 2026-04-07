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
  maxDepth: number;
  maxBranch: number;
  maxSteps: number;
  maxBudget: number;
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

export function createOrchestrator(deps: OrchestratorDeps) {
  deps.eventBus.subscribe((event) => deps.eventLogStore.append(event));

  const runtime = deps.runtime ?? createAgentRuntime();

  return {
    async runSingleNodeTask(input: RunTaskInput): Promise<{ finalState: NodeState; stateTrace: NodeState[] }> {
      const stateTrace: NodeState[] = ["pending"];

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
        stateTrace.push("aborted");
        return { finalState: "aborted", stateTrace };
      }

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
      publish(deps.eventBus, "TaskClosed", { task_id: input.taskId, state: "completed" });

      return {
        finalState: "completed",
        stateTrace
      };
    }
  };
}

function publish(eventBus: EventBus, type: string, payload: Record<string, unknown>) {
  eventBus.publish({ type, payload, ts: Date.now() });
}
