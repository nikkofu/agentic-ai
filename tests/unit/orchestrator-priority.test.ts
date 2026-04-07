import { describe, expect, it } from "vitest";
import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";

describe("orchestrator node priority", () => {
  it("processes nodes in order of priority when maxParallel is 1", async () => {
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

    await orchestrator.runParallelTask({
      taskId: "task-priority-1",
      nodes: [
        { nodeId: "low-prio", role: "researcher", priority: 1 },
        { nodeId: "high-prio", role: "planner", priority: 10 },
        { nodeId: "mid-prio", role: "coder", priority: 5 }
      ],
      maxParallel: 1
    });

    const startEvents = eventLogStore.getAll().filter(e => e.type === "AgentStarted");
    
    // 我们预期顺序为 high-prio, mid-prio, low-prio
    expect(startEvents[0].payload.node_id).toBe("high-prio");
    expect(startEvents[1].payload.node_id).toBe("mid-prio");
    expect(startEvents[2].payload.node_id).toBe("low-prio");
  });

  it("defaults priority to 0 for nodes without priority", async () => {
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

    await orchestrator.runParallelTask({
      taskId: "task-priority-2",
      nodes: [
        { nodeId: "prio-0", role: "researcher" },
        { nodeId: "prio-5", role: "planner", priority: 5 },
        { nodeId: "prio--1", role: "coder", priority: -1 }
      ],
      maxParallel: 1
    });

    const startEvents = eventLogStore.getAll().filter(e => e.type === "AgentStarted");
    
    // 我们预期顺序为 prio-5, prio-0, prio--1
    expect(startEvents[0].payload.node_id).toBe("prio-5");
    expect(startEvents[1].payload.node_id).toBe("prio-0");
    expect(startEvents[2].payload.node_id).toBe("prio--1");
  });
});
