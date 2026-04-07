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
};

type RunTaskInput = {
  taskId: string;
  nodeId: string;
  role: AgentRole;
};

type NodeState = "pending" | "running" | "waiting_tool" | "evaluating" | "completed" | "aborted";

export function createOrchestrator(deps: OrchestratorDeps) {
  deps.eventBus.subscribe((event) => deps.eventLogStore.append(event));

  const runtime = createAgentRuntime();

  return {
    async runSingleNodeTask(input: RunTaskInput): Promise<{ finalState: NodeState; stateTrace: NodeState[] }> {
      const stateTrace: NodeState[] = ["pending"];

      publish(deps.eventBus, "TaskSubmitted", input);

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
        publish(deps.eventBus, "GuardrailTripped", { taskId: input.taskId, nodeId: input.nodeId, reason: guardrail.reason });
        publish(deps.eventBus, "TaskClosed", { taskId: input.taskId, state: "aborted" });
        stateTrace.push("aborted");
        return { finalState: "aborted", stateTrace };
      }

      publish(deps.eventBus, "NodeScheduled", { taskId: input.taskId, nodeId: input.nodeId });
      stateTrace.push("running");
      publish(deps.eventBus, "AgentStarted", { taskId: input.taskId, nodeId: input.nodeId, role: input.role });
      publish(deps.eventBus, "PromptComposed", { taskId: input.taskId, nodeId: input.nodeId });
      publish(deps.eventBus, "ModelCalled", { taskId: input.taskId, nodeId: input.nodeId });

      stateTrace.push("waiting_tool");
      publish(deps.eventBus, "ToolInvoked", { taskId: input.taskId, nodeId: input.nodeId, tool: "echo" });
      await runtime.run();
      publish(deps.eventBus, "ToolReturned", { taskId: input.taskId, nodeId: input.nodeId, ok: true });

      stateTrace.push("evaluating");
      publish(deps.eventBus, "Evaluated", { taskId: input.taskId, nodeId: input.nodeId, decision: "stop" });

      stateTrace.push("completed");
      publish(deps.eventBus, "NodeCompleted", { taskId: input.taskId, nodeId: input.nodeId });
      publish(deps.eventBus, "TaskClosed", { taskId: input.taskId, state: "completed" });

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
