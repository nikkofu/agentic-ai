# Orchestrator Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `resumeTask(taskId: string)` in `Orchestrator` to recover and complete interrupted tasks.

**Architecture:** 
1. `resumeTask` will fetch the `TaskGraph` from `TaskStore`.
2. It will identify nodes in `pending` or `running` state.
3. It will re-run these nodes using the same concurrency logic as `runParallelTask`.
4. It uses a queue to respect a `maxParallel` limit (which can be passed as an optional parameter or default to a safe value).

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Add `resumeTask` to `Orchestrator` Interface

**Files:**
- Modify: `src/core/orchestrator.ts`

- [ ] **Step 1: Update the return type of `createOrchestrator`**

```typescript
export function createOrchestrator(deps: OrchestratorDeps) {
  // ... existing code ...
  return {
    runSingleNodeTask: // ...
    runParallelTask: // ...
    resumeTask: async (taskId: string, maxParallel: number = 2) => {
      if (!deps.taskStore) throw new Error("TaskStore is required for resumeTask");
      
      const graph = await deps.taskStore.getGraph(taskId);
      if (!graph) throw new Error(`Task ${taskId} not found`);

      // Identify incomplete nodes
      const incompleteNodes = Object.values(graph.nodes).filter(
        node => node.state === "pending" || node.state === "running"
      );

      if (incompleteNodes.length === 0) {
        return { completedNodes: 0, message: "No nodes to resume" };
      }

      publish(deps.eventBus, "TaskSubmitted", { task_id: taskId, resumed: true });

      const results: { nodeId: string; state: NodeState }[] = [];
      const queue = [...incompleteNodes];

      const runNext = async () => {
        if (queue.length === 0) return;
        const node = queue.shift()!;
        const res = await runNode({
          taskId: taskId,
          nodeId: node.nodeId,
          role: node.role,
          runtimeInput: {} // TODO: recover input if needed, but for now empty is fine per simplified runNode
        });
        results.push({ nodeId: node.nodeId, state: res.finalState });
      };

      const workers = Array.from({ length: Math.min(maxParallel, incompleteNodes.length) }, async () => {
        while (queue.length > 0) {
          await runNext();
        }
      });

      await Promise.all(workers);

      publish(deps.eventBus, "TaskClosed", { task_id: taskId, state: "completed", resumed: true });

      return {
        completedNodes: results.length,
        status: "completed"
      };
    }
  };
}
```

### Task 2: Create Integration Test for `resumeTask`

**Files:**
- Create: `tests/integration/orchestrator-resume.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryTaskStore } from "../../src/core/taskStore";
import { createAgentRuntime } from "../../src/agents/agentRuntime";

describe("Orchestrator Resume Integration", () => {
  it("should resume a task with pending nodes", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const eventLogStore = {
      append: vi.fn(),
      getAll: () => []
    };
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
    await taskStore.createGraph({
      taskId,
      rootNodeId: "node-1",
      frontier: [],
      nodes: {
        "node-1": {
          nodeId: "node-1",
          role: "planner",
          state: "completed",
          depth: 0,
          attempt: 1,
          inputSummary: "root",
          children: ["node-2", "node-3"]
        },
        "node-2": {
          nodeId: "node-2",
          role: "coder",
          state: "pending",
          depth: 1,
          attempt: 1,
          inputSummary: "child 1",
          children: []
        },
        "node-3": {
          nodeId: "node-3",
          role: "researcher",
          state: "running", // Interrupted
          depth: 1,
          attempt: 1,
          inputSummary: "child 2",
          children: []
        }
      },
      status: "running",
      createdAt: new Date().toISOString()
    });

    const result = await orchestrator.resumeTask(taskId, 2);

    expect(result.completedNodes).toBe(2);
    expect(result.status).toBe("completed");

    const updatedGraph = await taskStore.getGraph(taskId);
    expect(updatedGraph?.nodes["node-2"].state).toBe("completed");
    expect(updatedGraph?.nodes["node-3"].state).toBe("completed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails (before implementation if we hadn't already added the method)**

- [ ] **Step 3: Implement the logic in `orchestrator.ts`**

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npx vitest tests/integration/orchestrator-resume.test.ts`
Expected: PASS

- [ ] **Step 5: Verify all existing tests still pass**

Run: `npx vitest`
Expected: PASS
