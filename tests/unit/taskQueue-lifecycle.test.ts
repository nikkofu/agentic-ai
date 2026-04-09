import { describe, expect, it, vi } from "vitest";

import { TaskQueue } from "../../src/worker/queue";

describe("task queue lifecycle jobs", () => {
  it("enqueues lifecycle jobs with stable resume job ids", async () => {
    const add = vi.fn().mockResolvedValue({ id: "resume-task-1" });
    const queue = {
      add
    };

    await TaskQueue.prototype.addLifecycleJob.call(
      { queue } as any,
      {
        kind: "resume",
        taskId: "task-1",
        maxParallel: 2
      }
    );

    expect(add).toHaveBeenCalledWith(
      "task-lifecycle",
      expect.objectContaining({
        kind: "resume",
        taskId: "task-1",
        maxParallel: 2,
        ownerId: expect.any(String),
        dedupeKey: "resume-task-1"
      }),
      {
        jobId: "resume-task-1"
      }
    );
  });

  it("enqueues lifecycle start jobs with ownership and dedupe metadata", async () => {
    const add = vi.fn().mockResolvedValue({ id: "start-task-1" });
    const queue = {
      add
    };

    await TaskQueue.prototype.addLifecycleJob.call(
      { queue } as any,
      {
        kind: "start",
        taskId: "task-2",
        input: "do work"
      }
    );

    expect(add).toHaveBeenCalledWith(
      "task-lifecycle",
      expect.objectContaining({
        kind: "start",
        taskId: "task-2",
        input: "do work",
        ownerId: expect.any(String),
        dedupeKey: "start-task-2"
      }),
      expect.objectContaining({
        jobId: "start-task-2"
      })
    );
  });

  it("enqueues execute-node jobs with ownership and dedupe metadata", async () => {
    const add = vi.fn().mockResolvedValue({ id: "task-3-node-a" });
    const queue = {
      add
    };

    await TaskQueue.prototype.addJob.call(
      { queue } as any,
      "task-3",
      "node-a",
      {
        role: "researcher",
        runtimeInput: { input: "queued node" }
      }
    );

    expect(add).toHaveBeenCalledWith(
      "execute-node",
      expect.objectContaining({
        taskId: "task-3",
        nodeId: "node-a",
        role: "researcher",
        ownerId: expect.any(String),
        dedupeKey: "task-3-node-a",
        enqueuedAt: expect.any(String)
      }),
      expect.objectContaining({
        jobId: "task-3-node-a"
      })
    );
  });
});
