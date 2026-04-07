import { describe, it, expect } from "vitest";
import { createInMemoryTaskStore } from "../../src/core/taskStore";
import { TaskGraph, TaskNode } from "../../src/types/runtime";

describe("InMemoryTaskStore", () => {
  it("should create and retrieve a task graph", async () => {
    const store = createInMemoryTaskStore();
    const graph: TaskGraph = {
      taskId: "task-1",
      rootNodeId: "node-1",
      frontier: ["node-1"],
      nodes: {
        "node-1": {
          nodeId: "node-1",
          role: "planner",
          state: "pending",
          depth: 0,
          attempt: 1,
          inputSummary: "test input",
          children: []
        }
      },
      status: "running",
      createdAt: new Date().toISOString()
    };

    await store.createGraph(graph);
    const retrieved = await store.getGraph("task-1");
    expect(retrieved).toEqual(graph);
  });

  it("should upsert a node in the graph", async () => {
    const store = createInMemoryTaskStore();
    const graph: TaskGraph = {
      taskId: "task-1",
      rootNodeId: "node-1",
      frontier: ["node-1"],
      nodes: {},
      status: "running",
      createdAt: new Date().toISOString()
    };
    await store.createGraph(graph);

    const node: TaskNode = {
      nodeId: "node-1",
      role: "planner",
      state: "running",
      depth: 0,
      attempt: 1,
      inputSummary: "updated input",
      children: []
    };

    await store.upsertNode("task-1", node);
    const retrieved = await store.getGraph("task-1");
    expect(retrieved?.nodes["node-1"]).toEqual(node);
  });

  it("should update graph status", async () => {
    const store = createInMemoryTaskStore();
    const graph: TaskGraph = {
      taskId: "task-1",
      rootNodeId: "node-1",
      frontier: ["node-1"],
      nodes: {},
      status: "running",
      createdAt: new Date().toISOString()
    };
    await store.createGraph(graph);

    await store.updateGraphStatus("task-1", "completed");
    const retrieved = await store.getGraph("task-1");
    expect(retrieved?.status).toBe("completed");
  });

  it("should append and retrieve events", async () => {
    const store = createInMemoryTaskStore();
    // Initialize graph to ensure events list is initialized
    await store.createGraph({ taskId: "task-1", nodes: {} } as any);

    const event = { type: "TaskSubmitted", payload: { task_id: "task-1" }, ts: Date.now() };
    await store.appendEvent("task-1", event);

    const events = await store.getEvents("task-1");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
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
