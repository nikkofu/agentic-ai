import { describe, expect, it, vi } from "vitest";

import { createTaskLifecycle } from "../../src/runtime/taskLifecycle";

describe("task lifecycle", () => {
  it("delegates start and resume to the shared executor", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn().mockResolvedValue({ taskId: "task-1", finalState: "completed" }),
        resume: vi.fn().mockResolvedValue({ taskId: "task-2", finalState: "completed" })
      } as any,
      taskStore: {
        getGraph: vi.fn(),
        getEvents: vi.fn()
      } as any
    });

    await lifecycle.startTask({ input: "do work" });
    await lifecycle.resumeTask({ taskId: "task-2" });

    expect(lifecycle).toBeDefined();
  });

  it("inspects a task from graph and events", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-1",
          status: "completed",
          nodes: {}
        }),
        getEvents: vi.fn().mockResolvedValue([
          { type: "TaskSubmitted", payload: { task_id: "task-1" } },
          { type: "TaskClosed", payload: { task_id: "task-1", state: "completed" } }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-1");

    expect(inspection.graph?.status).toBe("completed");
    expect(inspection.latestClose?.type).toBe("TaskClosed");
    expect(inspection.eventCount).toBe(2);
  });

  it("exposes the latest async task event alongside close events", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-async",
          status: "running",
          nodes: {}
        }),
        getEvents: vi.fn().mockResolvedValue([
          { type: "TaskSubmitted", payload: { task_id: "task-async" } },
          {
            type: "AsyncTaskSettled",
            payload: {
              task_id: "task-async",
              job_kind: "resume",
              final_state: "completed",
              delivery: {
                status: "completed",
                final_result: "async done"
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-async");

    expect(inspection.latestAsync?.type).toBe("AsyncTaskSettled");
    expect(inspection.latestAsync?.payload.final_state).toBe("completed");
  });

  it("exposes the latest async node event for distributed inspection", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-node-async",
          status: "running",
          nodes: {}
        }),
        getEvents: vi.fn().mockResolvedValue([
          { type: "TaskSubmitted", payload: { task_id: "task-node-async" } },
          {
            type: "AsyncNodeSettled",
            payload: {
              task_id: "task-node-async",
              node_id: "node-research",
              owner_id: "worker-alpha",
              dedupe_key: "task-node-async-node-research",
              final_state: "completed",
              final_result: "research complete"
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-node-async");

    expect(inspection.latestAsyncNode?.type).toBe("AsyncNodeSettled");
    expect(inspection.latestAsyncNode?.payload.owner_id).toBe("worker-alpha");
    expect(inspection.latestAsyncNode?.payload.dedupe_key).toBe("task-node-async-node-research");
  });

  it("summarizes distributed queue and join readiness from the task graph", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-distributed-summary",
          status: "running",
          nodes: {
            "node-root": { state: "completed", role: "planner" },
            "node-a": { state: "pending", role: "researcher" },
            "node-b": { state: "completed", role: "writer" },
            "join-task-distributed-summary": { state: "pending", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          { type: "TaskSubmitted", payload: { task_id: "task-distributed-summary" } }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-distributed-summary");

    expect(inspection.distributedSummary).toEqual({
      queuedNodes: 1,
      activeJoinState: "pending",
      settledWorkerNodes: 2
    });
  });
});
