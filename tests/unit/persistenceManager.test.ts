import fs from "node:fs";
import { afterEach, describe, it, expect, vi } from "vitest";
import { createPersistenceManager } from "../../src/core/persistenceManager";
import { createInMemoryTaskStore } from "../../src/core/taskStore";
import { createInMemoryEventBus } from "../../src/core/eventBus";

afterEach(() => {
  fs.rmSync("audit_trail.jsonl", { force: true });
});

describe("PersistenceManager", () => {
  it("should sync TaskSubmitted to createGraph", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-1";
    eventBus.publish({
      type: "TaskSubmitted",
      payload: { task_id: taskId, node_id: "root" },
      ts: Date.now()
    });

    const graph = await taskStore.getGraph(taskId);
    expect(graph).toBeDefined();
    expect(graph?.taskId).toBe(taskId);
    expect(graph?.status).toBe("running");
  });

  it("should not recreate graph when TaskSubmitted is emitted for resume", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-resume";
    await taskStore.createGraph({ taskId, rootNodeId: "root" });
    await taskStore.upsertNode(taskId, {
      nodeId: "node-1",
      role: "planner",
      state: "completed",
      depth: 0,
      attempt: 1,
      inputSummary: "existing state"
    });

    eventBus.publish({
      type: "TaskSubmitted",
      payload: { task_id: taskId, resumed: true },
      ts: Date.now()
    });

    const graph = await taskStore.getGraph(taskId);
    expect(graph?.nodes["node-1"]).toBeDefined();
    expect(graph?.nodes["node-1"].state).toBe("completed");
  });

  it("should sync NodeScheduled to upsertNode", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-1";
    await taskStore.createGraph({ taskId, rootNodeId: "root" });

    eventBus.publish({
      type: "NodeScheduled",
      payload: { task_id: taskId, node_id: "node-1" },
      ts: Date.now()
    });

    const node = await taskStore.getNode(taskId, "node-1");
    expect(node).toBeDefined();
    expect(node?.state).toBe("pending");
  });

  it("should sync TaskClosed to updateGraphStatus", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-1";
    await taskStore.createGraph({ taskId, rootNodeId: "root" });

    eventBus.publish({
      type: "TaskClosed",
      payload: { task_id: taskId, state: "completed" },
      ts: Date.now()
    });

    const graph = await taskStore.getGraph(taskId);
    expect(graph?.status).toBe("completed");
  });

  it("should append all events to taskStore", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-events";
    // We don't strictly need createGraph now as we removed FK,
    // but persistenceManager still uses task_id from payload

    eventBus.publish({
      type: "SomeEvent",
      payload: { task_id: taskId, foo: "bar" },
      ts: Date.now()
    });

    const events = await taskStore.getEvents(taskId);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("SomeEvent");
  });

  it("should swallow async persistence rejections", async () => {
    const eventBus = createInMemoryEventBus();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };

    process.on("unhandledRejection", onUnhandled);

    const taskStore = {
      createGraph: vi.fn().mockRejectedValue(new Error("db down")),
      upsertNode: vi.fn().mockResolvedValue(undefined),
      updateGraphStatus: vi.fn().mockResolvedValue(undefined),
      appendEvent: vi.fn().mockRejectedValue(new Error("db down")),
      getGraph: vi.fn().mockResolvedValue(null),
      getNode: vi.fn().mockResolvedValue(null),
      getEvents: vi.fn().mockResolvedValue([])
    };

    createPersistenceManager(eventBus as any, taskStore as any);

    eventBus.publish({
      type: "TaskSubmitted",
      payload: { task_id: "task-err", node_id: "root" },
      ts: Date.now()
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off("unhandledRejection", onUnhandled);

    expect(unhandled).toHaveLength(0);
  });

  it("should write model, tool, evaluation, and final close events to audit trail", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-audit";
    eventBus.publish({ type: "TaskSubmitted", payload: { task_id: taskId, node_id: "root" }, ts: Date.now() });
    eventBus.publish({ type: "NodeScheduled", payload: { task_id: taskId, node_id: "node-1" }, ts: Date.now() });
    eventBus.publish({ type: "AgentStarted", payload: { task_id: taskId, node_id: "node-1", role: "planner" }, ts: Date.now() });
    eventBus.publish({ type: "PromptComposed", payload: { task_id: taskId, node_id: "node-1" }, ts: Date.now() });
    eventBus.publish({ type: "ModelCalled", payload: { task_id: taskId, node_id: "node-1" }, ts: Date.now() });
    eventBus.publish({ type: "ToolInvoked", payload: { task_id: taskId, node_id: "node-1", tool: "web_search" }, ts: Date.now() });
    eventBus.publish({ type: "ToolReturned", payload: { task_id: taskId, node_id: "node-1", ok: true }, ts: Date.now() });
    eventBus.publish({ type: "Evaluated", payload: { task_id: taskId, node_id: "node-1", decision: "stop" }, ts: Date.now() });
    eventBus.publish({ type: "TaskClosed", payload: { task_id: taskId, state: "completed" }, ts: Date.now() });

    const auditLines = fs
      .readFileSync("audit_trail.jsonl", "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const eventTypes = auditLines
      .filter((record) => record.taskId === taskId)
      .map((record) => record.type);

    expect(eventTypes).toEqual(
      expect.arrayContaining(["NodeScheduled", "AgentStarted", "PromptComposed", "ModelCalled", "ToolInvoked", "ToolReturned", "Evaluated", "TaskClosed"])
    );
  });

  it("should preserve role, depth, attempt, and parent metadata from events", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-node-meta";
    await taskStore.createGraph({ taskId, rootNodeId: "node-root" });

    eventBus.publish({
      type: "NodeScheduled",
      payload: {
        task_id: taskId,
        node_id: "node-child",
        role: "writer",
        parent_node_id: "node-root",
        depth: 2,
        attempt: 3,
        input_summary: "draft the final answer"
      },
      ts: Date.now()
    });

    const node = await taskStore.getNode(taskId, "node-child");
    expect(node?.role).toBe("writer");
    expect(node?.depth).toBe(2);
    expect(node?.attempt).toBe(3);
    expect(node?.parentNodeId).toBe("node-root");
    expect(node?.inputSummary).toBe("draft the final answer");
  });

  it("should persist queued async nodes and settle them with final output", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-async-node";
    await taskStore.createGraph({ taskId, rootNodeId: "node-root" });

    eventBus.publish({
      type: "AsyncNodeQueued",
      payload: {
        task_id: taskId,
        node_id: "node-worker",
        role: "researcher"
      },
      ts: Date.now()
    });

    let node = await taskStore.getNode(taskId, "node-worker");
    expect(node?.state).toBe("pending");
    expect(node?.role).toBe("researcher");

    eventBus.publish({
      type: "AsyncNodeSettled",
      payload: {
        task_id: taskId,
        node_id: "node-worker",
        final_state: "completed",
        final_result: "verified research summary"
      },
      ts: Date.now()
    });

    node = await taskStore.getNode(taskId, "node-worker");
    expect(node?.state).toBe("completed");
    expect(node?.outputSummary).toContain("verified research summary");
  });

  it("should mark failed async nodes with the failure reason", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-async-failed";
    await taskStore.createGraph({ taskId, rootNodeId: "node-root" });

    eventBus.publish({
      type: "AsyncNodeFailed",
      payload: {
        task_id: taskId,
        node_id: "node-worker",
        error: "redis timeout"
      },
      ts: Date.now()
    });

    const node = await taskStore.getNode(taskId, "node-worker");
    expect(node?.state).toBe("failed");
    expect(node?.outputSummary).toContain("redis timeout");
  });

  it("should persist blocked async node delivery summaries", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-async-blocked";
    await taskStore.createGraph({ taskId, rootNodeId: "node-root" });

    eventBus.publish({
      type: "AsyncNodeSettled",
      payload: {
        task_id: taskId,
        node_id: "node-worker",
        final_state: "aborted",
        owner_id: "worker-zeta",
        dedupe_key: "task-async-blocked-node-worker",
        delivery: {
          status: "blocked",
          final_result: "",
          artifacts: [],
          verification: [],
          risks: [],
          blocking_reason: "policy_verification_required",
          next_actions: []
        }
      },
      ts: Date.now()
    });

    const node = await taskStore.getNode(taskId, "node-worker");
    expect(node?.state).toBe("aborted");
    expect(node?.outputSummary).toContain("policy_verification_required");
  });

  it("should sync async task settled and failed events to graph status", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-async-graph";
    await taskStore.createGraph({ taskId, rootNodeId: "node-root" });

    eventBus.publish({
      type: "AsyncTaskSettled",
      payload: {
        task_id: taskId,
        job_kind: "resume",
        final_state: "completed"
      },
      ts: Date.now()
    });

    let graph = await taskStore.getGraph(taskId);
    expect(graph?.status).toBe("completed");

    eventBus.publish({
      type: "AsyncTaskFailed",
      payload: {
        task_id: taskId,
        job_kind: "resume",
        error: "worker crashed"
      },
      ts: Date.now()
    });

    graph = await taskStore.getGraph(taskId);
    expect(graph?.status).toBe("failed");
  });

  it("should complete the join placeholder once all queued child nodes settle", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-join-ready";
    await taskStore.createGraph({ taskId, rootNodeId: "node-root" });

    eventBus.publish({
      type: "NodeScheduled",
      payload: {
        task_id: taskId,
        node_id: "join-task-join-ready",
        role: "planner"
      },
      ts: Date.now()
    });

    eventBus.publish({
      type: "AsyncNodeQueued",
      payload: {
        task_id: taskId,
        node_id: "node-a",
        role: "researcher"
      },
      ts: Date.now()
    });

    eventBus.publish({
      type: "AsyncNodeQueued",
      payload: {
        task_id: taskId,
        node_id: "node-b",
        role: "writer"
      },
      ts: Date.now()
    });

    eventBus.publish({
      type: "AsyncNodeSettled",
      payload: {
        task_id: taskId,
        node_id: "node-a",
        final_state: "completed",
        final_result: "research complete"
      },
      ts: Date.now()
    });

    let joinNode = await taskStore.getNode(taskId, "join-task-join-ready");
    expect(joinNode?.state).toBe("pending");

    eventBus.publish({
      type: "AsyncNodeSettled",
      payload: {
        task_id: taskId,
        node_id: "node-b",
        final_state: "completed",
        final_result: "writing complete"
      },
      ts: Date.now()
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    joinNode = await taskStore.getNode(taskId, "join-task-join-ready");
    expect(joinNode?.state).toBe("completed");
  });
});
