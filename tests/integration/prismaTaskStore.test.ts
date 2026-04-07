import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createPrismaTaskStore } from "../../src/core/prismaTaskStore";
import { randomUUID } from "node:crypto";

describe("PrismaTaskStore Integration", () => {
  let prisma: PrismaClient;
  let store: any;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    store = createPrismaTaskStore(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("can round-trip a task graph and nodes", async () => {
    const taskId = "test-task-" + randomUUID();
    await store.createGraph({ taskId, rootNodeId: "root" });
    
    await store.upsertNode(taskId, {
      nodeId: "root",
      role: "planner",
      state: "running",
      depth: 0,
      attempt: 1,
      inputSummary: "test input"
    });

    const node = await store.getNode(taskId, "root");
    expect(node?.role).toBe("planner");
    expect(node?.state).toBe("running");

    await store.updateGraphStatus(taskId, "completed");
    const graph = await store.getGraph(taskId);
    expect(graph?.status).toBe("completed");
  });

  it("can store and retrieve events", async () => {
    const taskId = "test-task-events-" + randomUUID();
    await store.createGraph({ taskId, rootNodeId: "root" }); // Required by foreign key

    const event = {
      type: "TestEvent",
      payload: { task_id: taskId, data: "hello" },
      ts: Date.now()
    };

    await store.appendEvent(event);
    const events = await store.getEvents(taskId);
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("TestEvent");
    expect(events[0].payload.data).toBe("hello");
  });
});
