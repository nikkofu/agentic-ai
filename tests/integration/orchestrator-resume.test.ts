import { describe, it, expect, vi } from "vitest";
import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryTaskStore } from "../../src/core/taskStore";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";
import { createAgentRuntime } from "../../src/agents/agentRuntime";
import { createTaskMemoryStore } from "../../src/runtime/memory";

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

  it("restores execution context and replays task memory before rerunning pending nodes", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const taskStore = createInMemoryTaskStore();
    const memoryStore = createTaskMemoryStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          final_result: "resumed result",
          verification: ["source-a"],
          artifacts: [],
          risks: [],
          next_actions: []
        })
      })
    };

    const orchestrator = createOrchestrator({
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      taskStore,
      memoryStore,
      guardrails: { max_depth: 5, max_branch: 5, max_steps: 10, max_budget: 100 },
      runtime: runtime as any
    });

    const taskId = "task-resume-context";
    await taskStore.createGraph({ taskId, rootNodeId: "node-root" });
    await taskStore.upsertNode(taskId, {
      nodeId: "node-root",
      role: "planner",
      state: "completed",
      depth: 0,
      attempt: 1,
      inputSummary: "root"
    });
    await taskStore.upsertNode(taskId, {
      nodeId: "node-research",
      parentNodeId: "node-root",
      role: "researcher",
      state: "pending",
      depth: 1,
      attempt: 1,
      inputSummary: "Research OpenClaw"
    });

    await taskStore.appendEvent({
      type: "ExecutionContextPrepared",
      payload: {
        task_id: taskId,
        node_id: "node-research",
        context: {
          intent: {
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "resume test"
          },
          plan: {
            nodes: [
              { id: "node-root", role: "planner", input: "Plan task", depends_on: [] },
              { id: "node-research", role: "researcher", input: "Research OpenClaw", depends_on: ["node-root"] }
            ]
          },
          policy: {
            recommendedTools: ["web_search"],
            requiredCapabilities: ["research"],
            verificationPolicy: "cite sources"
          },
          node: {
            id: "node-research",
            role: "researcher",
            input: "Research OpenClaw",
            depends_on: ["node-root"]
          },
          task: "Research and write about OpenClaw",
          dependencyOutputs: ["planner summary"],
          memoryRefs: [],
          workingMemory: [],
          retrievalContext: []
        }
      },
      ts: Date.now()
    });

    await taskStore.appendEvent({
      type: "TaskMemoryStored",
      payload: {
        task_id: taskId,
        source_id: "mem://task-resume-context/node-root",
        content: "OpenClaw is a Go-based open-source runtime project",
        tags: ["node-output"]
      },
      ts: Date.now() + 1
    });

    const result = await orchestrator.resumeTask(taskId, 1);

    expect(result.completedNodes).toBe(1);
    expect(result.status).toBe("completed");
    expect(runtime.run).toHaveBeenCalledTimes(1);
    expect(runtime.run.mock.calls[0][0].__memory.workingMemory).toContain(
      "OpenClaw is a Go-based open-source runtime project"
    );
    expect(runtime.run.mock.calls[0][0].input[1].content).toContain("Research and write about OpenClaw");

    const graph = await taskStore.getGraph(taskId);
    expect(graph?.nodes["node-root"].state).toBe("completed");
    expect(graph?.nodes["node-research"].state).toBe("completed");
  });
});
