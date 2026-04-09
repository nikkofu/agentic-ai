import { describe, expect, it, vi } from "vitest";

import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";
import { createInMemoryTaskStore } from "../../src/core/taskStore";

describe("orchestrator bounded parallel", () => {
  it("respects max_parallel and records join evaluation", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();

    const orchestrator = createOrchestrator({
      eventBus,
      eventLogStore,
      guardrails: {
        max_depth: 4,
        max_branch: 3,
        max_steps: 60,
        max_budget: 5
      }
    });

    const result = await orchestrator.runParallelTask({
      taskId: "task-par-1",
      nodes: [
        { nodeId: "n1", role: "planner" },
        { nodeId: "n2", role: "researcher" },
        { nodeId: "n3", role: "coder" }
      ],
      maxParallel: 2
    });

    expect(result.completedNodes).toBe(3);
    expect(result.joinDecision).toBeDefined();

    const events = eventLogStore.getAll().map((e) => e.type);
    expect(events).toContain("JoinEvaluated");
  });

  it("can queue parallel execution contexts through the shared task queue", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const taskStore = createInMemoryTaskStore();
    const taskQueue = {
      addJob: vi.fn().mockResolvedValue(undefined)
    };

    await taskStore.createGraph({
      taskId: "task-par-queue",
      rootNodeId: "node-root"
    });

    const orchestrator = createOrchestrator({
      eventBus,
      eventLogStore,
      taskStore,
      taskQueue: taskQueue as any,
      guardrails: {
        max_depth: 4,
        max_branch: 3,
        max_steps: 60,
        max_budget: 5
      }
    });

    const result = await orchestrator.runParallelContexts({
      taskId: "task-par-queue",
      contexts: [
        {
          intent: null,
          plan: null,
          node: { id: "n1", role: "planner", input: "plan", depends_on: [] },
          task: "queued work",
          dependencyOutputs: [],
          memoryRefs: [],
          workingMemory: [],
          retrievalContext: []
        },
        {
          intent: null,
          plan: null,
          node: { id: "n2", role: "researcher", input: "research", depends_on: [] },
          task: "queued work",
          dependencyOutputs: [],
          memoryRefs: [],
          workingMemory: [],
          retrievalContext: []
        }
      ],
      maxParallel: 2,
      dispatchMode: "queue"
    });

    expect(result.completedNodes).toBe(0);
    expect(result.joinDecision).toBe("queued");
    expect(taskQueue.addJob).toHaveBeenCalledTimes(2);
    expect(eventLogStore.getAll().map((event) => event.type)).toContain("AsyncNodeQueued");

    const graph = await taskStore.getGraph("task-par-queue");
    expect(graph?.nodes["n1"]?.state).toBe("pending");
    expect(graph?.nodes["n2"]?.state).toBe("pending");
    expect(graph?.nodes["join-task-par-queue"]?.state).toBe("pending");
  });
});
