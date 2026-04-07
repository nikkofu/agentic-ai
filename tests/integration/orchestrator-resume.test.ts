import { describe, it, expect } from "vitest";
import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryTaskStore } from "../../src/core/taskStore";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";
import { createAgentRuntime } from "../../src/agents/agentRuntime";

describe("Orchestrator Resume Integration", () => {
  it("should resume a task with pending nodes", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const taskStore = createInMemoryTaskStore();
    const runtime = createAgentRuntime();

    const orchestrator = createOrchestrator({
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      taskStore,
      guardrails: { max_depth: 5, max_branch: 5, max_steps: 10, max_budget: 100 },
      runtime
    });

    const taskId = "task-resume-1";
    // Setup a graph with some completed and some pending nodes
    await taskStore.createGraph({ taskId, rootNodeId: "node-1" });
    
    await taskStore.upsertNode(taskId, {
      nodeId: "node-1",
      role: "planner",
      state: "completed",
      depth: 0,
      attempt: 1,
      inputSummary: "root"
    });
    
    await taskStore.upsertNode(taskId, {
      nodeId: "node-2",
      role: "coder",
      state: "pending",
      depth: 1,
      attempt: 1,
      inputSummary: "child 1"
    });
    
    await taskStore.upsertNode(taskId, {
      nodeId: "node-3",
      role: "researcher",
      state: "running", // Interrupted
      depth: 1,
      attempt: 1,
      inputSummary: "child 2"
    });

    const result = await orchestrator.resumeTask(taskId, 2);

    expect(result.completedNodes).toBe(2);
    expect(result.status).toBe("completed");

    const updatedGraph = await taskStore.getGraph(taskId);
    expect(updatedGraph?.nodes["node-2"].state).toBe("completed");
    expect(updatedGraph?.nodes["node-3"].state).toBe("completed");
  });

  it("should return completed if no nodes to resume", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const taskStore = createInMemoryTaskStore();
    
    const orchestrator = createOrchestrator({
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      taskStore,
      guardrails: { max_depth: 5, max_branch: 5, max_steps: 10, max_budget: 100 }
    });

    const taskId = "task-no-resume";
    await taskStore.createGraph({ taskId, rootNodeId: "node-1" });
    await taskStore.upsertNode(taskId, {
      nodeId: "node-1",
      role: "planner",
      state: "completed",
      depth: 0,
      attempt: 1,
      inputSummary: "root"
    });
    await taskStore.updateGraphStatus(taskId, "completed");

    const result = await orchestrator.resumeTask(taskId);
    expect(result.completedNodes).toBe(0);
    expect(result.status).toBe("completed");
  });
});
