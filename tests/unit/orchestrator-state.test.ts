import { describe, expect, it } from "vitest";

import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";

describe("orchestrator state machine", () => {
  it("transitions node through running -> waiting_tool -> evaluating -> completed", async () => {
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

    const result = await orchestrator.runSingleNodeTask({
      taskId: "task-1",
      nodeId: "node-1",
      role: "planner"
    });

    expect(result.finalState).toBe("completed");
    expect(result.stateTrace).toEqual(["pending", "running", "waiting_tool", "evaluating", "completed"]);
  });

  it("emits required minimal events", async () => {
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

    await orchestrator.runSingleNodeTask({
      taskId: "task-2",
      nodeId: "node-1",
      role: "planner"
    });

    const eventNames = eventLogStore.getAll().map((e) => e.type);

    expect(eventNames).toContain("TaskSubmitted");
    expect(eventNames).toContain("NodeScheduled");
    expect(eventNames).toContain("AgentStarted");
    expect(eventNames).toContain("PromptComposed");
    expect(eventNames).toContain("ModelCalled");
    expect(eventNames).toContain("ToolInvoked");
    expect(eventNames).toContain("ToolReturned");
    expect(eventNames).toContain("Evaluated");
    expect(eventNames).toContain("NodeCompleted");
    expect(eventNames).toContain("TaskClosed");
  });

  it("checks guardrails before child spawn", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();

    const orchestrator = createOrchestrator({
      eventBus,
      eventLogStore,
      guardrails: {
        max_depth: 0,
        max_branch: 0,
        max_steps: 0,
        max_budget: 0
      }
    });

    const result = await orchestrator.runSingleNodeTask({
      taskId: "task-3",
      nodeId: "node-1",
      role: "planner"
    });

    expect(result.finalState).toBe("aborted");
    expect(eventLogStore.getAll().some((e) => e.type === "GuardrailTripped")).toBe(true);
  });
});
