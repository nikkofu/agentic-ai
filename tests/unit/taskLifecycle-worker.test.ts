import { describe, expect, it, vi } from "vitest";

import { createObservedNodeProcessor, createObservedTaskLifecycleProcessor, createTaskLifecycleProcessor } from "../../src/worker/agentWorker";

describe("task lifecycle worker", () => {
  it("routes resume jobs through lifecycle.resumeTask", async () => {
    const resumeTask = vi.fn().mockResolvedValue({ taskId: "task-1" });
    const startTask = vi.fn();
    const processor = createTaskLifecycleProcessor({
      startTask,
      resumeTask
    });

    await processor({
      name: "task-lifecycle",
      data: {
        kind: "resume",
        taskId: "task-1",
        maxParallel: 3
      }
    } as any);

    expect(resumeTask).toHaveBeenCalledWith({
      taskId: "task-1",
      maxParallel: 3
    });
  });

  it("publishes async settled events back into the shared event bus", async () => {
    const eventBus = {
      publish: vi.fn()
    };
    const processor = createObservedTaskLifecycleProcessor({
      lifecycle: {
        startTask: vi.fn().mockResolvedValue({
          taskId: "task-start-1",
          finalState: "completed",
          delivery: {
            status: "completed",
            final_result: "ok",
            artifacts: [],
            verification: [],
            risks: [],
            next_actions: []
          }
        }),
        resumeTask: vi.fn()
      },
      eventBus
    });

    await processor({
      name: "task-lifecycle",
      data: {
        kind: "start",
        taskId: "task-start-1",
        input: "do work"
      }
    } as any);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AsyncTaskSettled",
        payload: expect.objectContaining({
          task_id: "task-start-1",
          job_kind: "start",
          final_state: "completed"
        })
      })
    );
  });

  it("publishes async failure events when the lifecycle job throws", async () => {
    const eventBus = {
      publish: vi.fn()
    };
    const processor = createObservedTaskLifecycleProcessor({
      lifecycle: {
        startTask: vi.fn().mockRejectedValue(new Error("worker blew up")),
        resumeTask: vi.fn()
      },
      eventBus
    });

    await expect(
      processor({
        name: "task-lifecycle",
        data: {
          kind: "start",
          taskId: "task-start-2",
          input: "explode"
        }
      } as any)
    ).rejects.toThrow("worker blew up");

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AsyncTaskFailed",
        payload: expect.objectContaining({
          task_id: "task-start-2",
          job_kind: "start",
          error: "worker blew up"
        })
      })
    );
  });

  it("publishes async node settled events for queued execute-node jobs", async () => {
    const eventBus = {
      publish: vi.fn()
    };
    const processor = createObservedNodeProcessor({
      runtime: {
        run: vi.fn().mockResolvedValue({
          finalState: "completed",
          delivery: {
            status: "completed",
            final_result: "queued node output",
            artifacts: [],
            verification: ["https://example.com"],
            risks: [],
            next_actions: []
          }
        })
      },
      eventBus
    });

    await processor({
      name: "execute-node",
      data: {
        taskId: "task-node-1",
        nodeId: "node-a",
        runtimeInput: { input: "queued node" }
      }
    } as any);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AsyncNodeSettled",
        payload: expect.objectContaining({
          task_id: "task-node-1",
          node_id: "node-a",
          final_state: "completed",
          final_result: "queued node output",
          delivery: expect.objectContaining({
            status: "completed"
          })
        })
      })
    );
  });

  it("publishes async node failure state when queued node returns an aborted result", async () => {
    const eventBus = {
      publish: vi.fn()
    };
    const processor = createObservedNodeProcessor({
      runtime: {
        run: vi.fn().mockResolvedValue({
          finalState: "aborted",
          delivery: {
            status: "blocked",
            final_result: "",
            artifacts: [],
            verification: [],
            risks: ["no data"],
            blocking_reason: "empty_delivery",
            next_actions: []
          }
        })
      },
      eventBus
    });

    await processor({
      name: "execute-node",
      data: {
        taskId: "task-node-2",
        nodeId: "node-b",
        runtimeInput: { input: "queued node" }
      }
    } as any);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AsyncNodeSettled",
        payload: expect.objectContaining({
          task_id: "task-node-2",
          node_id: "node-b",
          final_state: "aborted",
          blocking_reason: "empty_delivery"
        })
      })
    );
  });
});
