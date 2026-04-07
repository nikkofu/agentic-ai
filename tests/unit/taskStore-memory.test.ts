import { describe, it, expect } from "vitest";
import { createInMemoryTaskStore } from "../../src/core/taskStore";

describe("InMemoryTaskStore", () => {
  it("should create and retrieve a task graph", async () => {
    const store = createInMemoryTaskStore();
    const taskId = "task-1";
    await store.createGraph({ taskId, rootNodeId: "node-1" });
    
    const retrieved = await store.getGraph(taskId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.taskId).toBe(taskId);
    expect(retrieved?.status).toBe("running");
  });

  it("should upsert a node in the graph", async () => {
    const store = createInMemoryTaskStore();
    const taskId = "task-1";
    await store.createGraph({ taskId, rootNodeId: "node-1" });

    const node = {
      nodeId: "node-1",
      role: "planner" as const,
      state: "running" as const,
      depth: 0,
      attempt: 1,
      inputSummary: "test input"
    };

    await store.upsertNode(taskId, node);
    const retrievedNode = await store.getNode(taskId, "node-1");
    expect(retrievedNode).toMatchObject(node);
  });

  it("should update graph status", async () => {
    const store = createInMemoryTaskStore();
    const taskId = "task-1";
    await store.createGraph({ taskId, rootNodeId: "node-1" });
    await store.updateGraphStatus(taskId, "completed");
    
    const retrieved = await store.getGraph(taskId);
    expect(retrieved?.status).toBe("completed");
  });

  it("should append and retrieve events", async () => {
    const store = createInMemoryTaskStore();
    const taskId = "task-1";
    await store.createGraph({ taskId, rootNodeId: "node-1" });

    const event = {
      type: "TestEvent",
      payload: { task_id: taskId, data: "hello" },
      ts: Date.now()
    };

    await store.appendEvent(event);
    const events = await store.getEvents(taskId);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("TestEvent");
  });

  it("should return null for non-existent graph", async () => {
    const store = createInMemoryTaskStore();
    const retrieved = await store.getGraph("non-existent");
    expect(retrieved).toBeNull();
  });

  it("should throw error when upserting node to non-existent graph", async () => {
    const store = createInMemoryTaskStore();
    await expect(store.upsertNode("non-existent", {} as any)).rejects.toThrow("Graph non-existent not found");
  });
});
