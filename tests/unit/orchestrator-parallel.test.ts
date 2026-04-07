import { describe, expect, it } from "vitest";

import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";

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
});
