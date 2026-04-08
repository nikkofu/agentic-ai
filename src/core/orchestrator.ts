import { createAgentRuntime } from "../agents/agentRuntime";
import { checkSpawnGuardrails } from "../guardrails/guardrails";
import type { AgentRole } from "../types/runtime";
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
  guardrails: GuardrailLimits;
  runtime?: ReturnType<typeof createAgentRuntime>;
  toolGateway?: any; 
  taskQueue?: TaskQueue;
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
  priority?: number;
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

  const runNodeCore = async (input: RunTaskInput): Promise<{ finalState: NodeState; stateTrace: NodeState[] }> => {
    const stateTrace: NodeState[] = ["pending"];
    
    publish(deps.eventBus, "NodeScheduled", { task_id: input.taskId, node_id: input.nodeId });
    stateTrace.push("running");
    publish(deps.eventBus, "AgentStarted", { task_id: input.taskId, node_id: input.nodeId, role: input.role });
    publish(deps.eventBus, "PromptComposed", { task_id: input.taskId, node_id: input.nodeId });
    publish(deps.eventBus, "ModelCalled", { task_id: input.taskId, node_id: input.nodeId });

    stateTrace.push("waiting_tool");
    
    if (deps.toolGateway) {
      publish(deps.eventBus, "ToolInvoked", { task_id: input.taskId, node_id: input.nodeId, tool: "local/echo" });
      const localResult = await deps.toolGateway.invoke({ transport: "local", tool: "echo", input: { message: "hello" } });
      publish(deps.eventBus, "ToolReturned", { 
        task_id: input.taskId, 
        node_id: input.nodeId, 
        ok: localResult.ok, 
        provider: "local" 
      });

      publish(deps.eventBus, "ToolInvoked", { task_id: input.taskId, node_id: input.nodeId, tool: "mcp-server/test-tool" });
      publish(deps.eventBus, "ToolReturned", { 
        task_id: input.taskId, 
        node_id: input.nodeId, 
        ok: true, 
        provider: "mcp" 
      });
    } else {
      publish(deps.eventBus, "ToolInvoked", { task_id: input.taskId, node_id: input.nodeId, tool: "echo" });
      publish(deps.eventBus, "ToolReturned", { task_id: input.taskId, node_id: input.nodeId, ok: true, provider: "local" });
    }

    if (deps.taskQueue) {
      await deps.taskQueue.addJob(input.taskId, input.nodeId, input);
    }

    const runtimeResult = await runtime.run(input.runtimeInput);

    stateTrace.push("evaluating");
    publish(deps.eventBus, "Evaluated", { 
      task_id: input.taskId, 
      node_id: input.nodeId, 
      decision: "stop",
      output_text: (runtimeResult as any).outputText, // 包含输出文本
      usage: (runtimeResult as any).usage,
      cost: (runtimeResult as any).cost
    });

    stateTrace.push("completed");
    publish(deps.eventBus, "NodeCompleted", { task_id: input.taskId, node_id: input.nodeId });
    
    return {
      finalState: "completed",
      stateTrace
    };
  };

  const runNode = async (input: RunTaskInput): Promise<{ finalState: NodeState; stateTrace: NodeState[] }> => {
    let result: { finalState: NodeState; stateTrace: NodeState[] } | undefined;
    await nodeMiddleware.execute(input, async () => {
      result = await runNodeCore(input);
    });
    return result ?? { finalState: "aborted", stateTrace: ["pending", "aborted"] };
  };

  return {
    use: (middleware: Middleware<RunTaskInput>) => {
      nodeMiddleware.use(middleware);
    },
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
      const queue = [...input.nodes].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      const runNext = async () => {
        if (queue.length === 0) return;
        const node = queue.shift()!;
        const res = await runNode({
          taskId: input.taskId,
          nodeId: node.nodeId,
          role: node.role,
          runtimeInput: input.runtimeInput
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
        node => node.state === "pending" || node.state === "running"
      );

      if (incompleteNodes.length === 0) {
        return { completedNodes: 0, status: "completed", message: "No nodes to resume" };
      }

      publish(deps.eventBus, "TaskSubmitted", { task_id: taskId, resumed: true });

      const queue = [...incompleteNodes];

      const runNext = async () => {
        if (queue.length === 0) return;
        const node = queue.shift()!;
        const res = await runNode({
          taskId: taskId,
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

    replayNode: async (taskId: string, nodeId: string, runtimeInput?: Record<string, unknown>) => {
      if (!deps.taskStore) throw new Error("TaskStore is required for replayNode");
      
      const node = await deps.taskStore.getNode(taskId, nodeId);
      if (!node) throw new Error(`Node ${nodeId} not found in task ${taskId}`);

      publish(deps.eventBus, "TaskSubmitted", { task_id: taskId, replayed: true, node_id: nodeId });

      await deps.taskStore.upsertNode(taskId, {
        nodeId: node.nodeId,
        parentNodeId: node.parentNodeId,
        role: node.role,
        state: "pending",
        depth: node.depth,
        attempt: node.attempt,
        inputSummary: node.inputSummary,
        outputSummary: undefined
      });

      const result = await runNode({
        taskId,
        nodeId,
        role: node.role,
        runtimeInput: runtimeInput ?? {}
      });

      publish(deps.eventBus, "TaskClosed", { task_id: taskId, state: "completed", replayed: true });

      return result;
    }
  };
}

function publish(eventBus: EventBus, type: string, payload: Record<string, unknown>) {
  eventBus.publish({ type, payload, ts: Date.now() });
}
