import { describe, it, expect } from "vitest";
import { createPersistenceManager } from "../../src/core/persistenceManager";
import { createInMemoryTaskStore } from "../../src/core/taskStore";
import { createInMemoryEventBus } from "../../src/core/eventBus";

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
});
