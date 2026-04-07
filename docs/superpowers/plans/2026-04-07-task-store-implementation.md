# TaskStore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define `TaskStore` interface and in-memory implementation to manage task graphs and event logs.

**Architecture:** Define a generic `TaskStore` interface and a `createInMemoryTaskStore` factory function. The in-memory store will use local Maps to store task graphs and event lists.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Define TaskStore Interface and Types

**Files:**
- Create: `src/core/taskStore.ts`

- [ ] **Step 1: Write the TaskStore interface and RuntimeEvent type**

```typescript
import { TaskGraph, TaskNode } from "../types/runtime";
import { RuntimeEvent } from "./eventBus";

export interface TaskStore {
  createGraph(graph: TaskGraph): Promise<void>;
  upsertNode(taskId: string, node: TaskNode): Promise<void>;
  updateGraphStatus(taskId: string, status: TaskGraph["status"]): Promise<void>;
  appendEvent(taskId: string, event: RuntimeEvent): Promise<void>;
  getGraph(taskId: string): Promise<TaskGraph | null>;
  getEvents(taskId: string): Promise<RuntimeEvent[]>;
}
```

- [ ] **Step 2: Implement createInMemoryTaskStore**

```typescript
export function createInMemoryTaskStore(): TaskStore {
  const graphs = new Map<string, TaskGraph>();
  const events = new Map<string, RuntimeEvent[]>();

  return {
    async createGraph(graph: TaskGraph) {
      graphs.set(graph.taskId, { ...graph, nodes: { ...graph.nodes } });
      events.set(graph.taskId, []);
    },
    async upsertNode(taskId: string, node: TaskNode) {
      const graph = graphs.get(taskId);
      if (!graph) throw new Error(`Graph ${taskId} not found`);
      graph.nodes[node.nodeId] = { ...node };
    },
    async updateGraphStatus(taskId: string, status: TaskGraph["status"]) {
      const graph = graphs.get(taskId);
      if (!graph) throw new Error(`Graph ${taskId} not found`);
      graph.status = status;
    },
    async appendEvent(taskId: string, event: RuntimeEvent) {
      const log = events.get(taskId) || [];
      log.push({ ...event });
      events.set(taskId, log);
    },
    async getGraph(taskId: string) {
      return graphs.get(taskId) || null;
    },
    async getEvents(taskId: string) {
      return events.get(taskId) || [];
    }
  };
}
```

### Task 2: Unit Testing TaskStore

**Files:**
- Create: `tests/unit/taskStore-memory.test.ts`

- [ ] **Step 1: Write tests for TaskStore in-memory implementation**

```typescript
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
    await store.createGraph({ taskId: "task-1" } as any);

    const event = { type: "TaskSubmitted", payload: { task_id: "task-1" }, ts: Date.now() };
    await store.appendEvent("task-1", event);

    const events = await store.getEvents("task-1");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

Run: `npx vitest tests/unit/taskStore-memory.test.ts`
Expected: PASS

### Task 3: Commit Changes

- [ ] **Step 1: Commit the implementation and tests**

```bash
git add src/core/taskStore.ts tests/unit/taskStore-memory.test.ts
git commit -m "feat: implement TaskStore interface and in-memory store"
```
