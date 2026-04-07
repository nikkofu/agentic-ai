import { describe, expect, it, vi } from "vitest";
import { createPersistenceManager } from "../../src/core/persistenceManager";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryTaskStore } from "../../src/core/taskStore";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("PersistenceManager", () => {
  it("should sync TaskSubmitted to createGraph", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-123";
    eventBus.publish({
      type: "TaskSubmitted",
      payload: { task_id: taskId },
      ts: Date.now()
    });

    await sleep(10);

    const graph = await taskStore.getGraph(taskId);
    expect(graph).toBeDefined();
    expect(graph?.taskId).toBe(taskId);
    expect(graph?.status).toBe("running");
  });

  it("should sync NodeScheduled to upsertNode", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-123";
    const nodeId = "node-456";

    // First create graph
    eventBus.publish({
      type: "TaskSubmitted",
      payload: { task_id: taskId },
      ts: Date.now()
    });
    await sleep(10);

    eventBus.publish({
      type: "NodeScheduled",
      payload: { task_id: taskId, node_id: nodeId },
      ts: Date.now()
    });
    await sleep(10);

    const graph = await taskStore.getGraph(taskId);
    expect(graph?.nodes[nodeId]).toBeDefined();
    expect(graph?.nodes[nodeId].state).toBe("pending");
  });

  it("should sync TaskClosed to updateGraphStatus", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-123";

    eventBus.publish({
      type: "TaskSubmitted",
      payload: { task_id: taskId },
      ts: Date.now()
    });
    await sleep(10);

    eventBus.publish({
      type: "TaskClosed",
      payload: { task_id: taskId, state: "completed" },
      ts: Date.now()
    });
    await sleep(10);

    const graph = await taskStore.getGraph(taskId);
    expect(graph?.status).toBe("completed");
  });

  it("should append all events to taskStore", async () => {
    const eventBus = createInMemoryEventBus();
    const taskStore = createInMemoryTaskStore();
    createPersistenceManager(eventBus as any, taskStore);

    const taskId = "task-123";
    const event = {
      type: "SomeEvent",
      payload: { task_id: taskId },
      ts: Date.now()
    };

    eventBus.publish(event);
    await sleep(10);

    const events = await taskStore.getEvents(taskId);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("SomeEvent");
  });
});
