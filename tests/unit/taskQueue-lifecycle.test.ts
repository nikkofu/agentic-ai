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
      {
        kind: "resume",
        taskId: "task-1",
        maxParallel: 2
      },
      {
        jobId: "resume-task-1"
      }
    );
  });
});
