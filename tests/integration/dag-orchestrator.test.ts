import { describe, it, expect, vi } from "vitest";
import { createOrchestrator } from "../../src/core/orchestrator";
import { resolveExecutionTiers } from "../../src/core/dagEngine";
import { DagWorkflow } from "../../src/types/dag";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";
import { createInMemoryTaskStore } from "../../src/core/taskStore";
import { createAgentRuntime } from "../../src/agents/agentRuntime";

describe("DAG Orchestrator Integration", () => {
  it("should execute a DAG workflow tier by tier using runParallelTask", async () => {
    const workflow: DagWorkflow = {
      nodes: [
        { id: "A", role: "planner", input: "Data gathering", depends_on: [] },
        { id: "B", role: "researcher", input: "Analyze A", depends_on: ["A"] },
        { id: "C", role: "coder", input: "Build C", depends_on: ["A"] },
        { id: "D", role: "writer", input: "Report", depends_on: ["B", "C"] }
      ]
    };

    const tiers = resolveExecutionTiers(workflow);
    expect(tiers.length).toBe(3);
    
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

    const runParallelTaskSpy = vi.spyOn(orchestrator, "runParallelTask");
    
    // Create graph to satisfy persistence manager
    await taskStore.createGraph({ taskId: "dag-task-1", rootNodeId: "root" });

    // Simulate the CLI loop
    let totalCompleted = 0;
    for (const tier of tiers) {
      const result = await orchestrator.runParallelTask({
        taskId: "dag-task-1",
        maxParallel: 5,
        nodes: tier.map(n => ({
          nodeId: n.id,
          role: n.role as any,
          priority: 0
        }))
      });
      totalCompleted += result.completedNodes;
    }

    expect(runParallelTaskSpy).toHaveBeenCalledTimes(3);
    expect(totalCompleted).toBe(4);
    
    const firstCallArgs = runParallelTaskSpy.mock.calls[0][0];
    expect(firstCallArgs.nodes.length).toBe(1);
    expect(firstCallArgs.nodes[0].nodeId).toBe("A");

    const secondCallArgs = runParallelTaskSpy.mock.calls[1][0];
    expect(secondCallArgs.nodes.length).toBe(2);
    expect(["B", "C"]).toContain(secondCallArgs.nodes[0].nodeId);
    expect(["B", "C"]).toContain(secondCallArgs.nodes[1].nodeId);

    const thirdCallArgs = runParallelTaskSpy.mock.calls[2][0];
    expect(thirdCallArgs.nodes.length).toBe(1);
    expect(thirdCallArgs.nodes[0].nodeId).toBe("D");
  });
});
