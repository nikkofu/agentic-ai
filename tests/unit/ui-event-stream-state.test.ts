import { describe, expect, it } from "vitest";

import {
  applyRuntimeEventToStreamState,
  createInitialEventStreamDetails
} from "../../ui/hooks/eventStreamState";

describe("event stream state", () => {
  it("captures async task settled results for the banner", () => {
    const details = applyRuntimeEventToStreamState({
      taskId: "task-stream-1",
      current: createInitialEventStreamDetails(),
      event: {
        type: "AsyncTaskSettled",
        payload: {
          task_id: "task-stream-1",
          job_kind: "resume",
          final_state: "completed",
          delivery: {
            status: "completed",
            final_result: "async final answer"
          }
        }
      }
    });

    expect(details.lastEventType).toBe("AsyncTaskSettled");
    expect(details.finalResult).toBe("async final answer");
    expect(details.blockingReason).toBe("");
    expect(details.explanation).toBe("Task completed successfully");
  });

  it("captures async node ownership details for the banner", () => {
    const details = applyRuntimeEventToStreamState({
      taskId: "task-stream-owners",
      current: createInitialEventStreamDetails(),
      event: {
        type: "AsyncNodeQueued",
        payload: {
          task_id: "task-stream-owners",
          node_id: "node-research",
          owner_id: "worker-alpha",
          dedupe_key: "task-stream-owners-node-research"
        }
      }
    });

    expect(details.lastEventType).toBe("AsyncNodeQueued");
    expect(details.lastOwnerId).toBe("worker-alpha");
    expect(details.lastDedupeKey).toBe("task-stream-owners-node-research");
  });

  it("captures async task failures as banner errors", () => {
    const details = applyRuntimeEventToStreamState({
      taskId: "task-stream-2",
      current: createInitialEventStreamDetails(),
      event: {
        type: "AsyncTaskFailed",
        payload: {
          task_id: "task-stream-2",
          job_kind: "resume",
          error: "queue worker offline"
        }
      }
    });

    expect(details.lastEventType).toBe("AsyncTaskFailed");
    expect(details.lastError).toContain("queue worker offline");
    expect(details.currentPath).toBe("task-stream-2");
    expect(details.explanation).toBe("Task failed: queue worker offline");
  });

  it("renders a blocked explanation from delivery blocking reason", () => {
    const details = applyRuntimeEventToStreamState({
      taskId: "task-stream-3",
      current: createInitialEventStreamDetails(),
      event: {
        type: "TaskClosed",
        payload: {
          task_id: "task-stream-3",
          state: "aborted",
          delivery: {
            status: "blocked",
            final_result: "",
            blocking_reason: "verification_missing"
          }
        }
      }
    });

    expect(details.blockingReason).toBe("verification_missing");
    expect(details.explanation).toBe("Task blocked: verification_missing");
  });

  it("keeps task closed success text stable when acceptance proof is present", () => {
    const details = applyRuntimeEventToStreamState({
      taskId: "task-stream-4",
      current: createInitialEventStreamDetails(),
      event: {
        type: "TaskClosed",
        payload: {
          task_id: "task-stream-4",
          state: "completed",
          delivery: {
            status: "completed",
            final_result: "accepted output",
            acceptance_proof: {
              decision: "accept",
              verifierSummary: "accepted",
              findings: []
            }
          }
        }
      }
    });

    expect(details.explanation).toBe("Task completed successfully");
  });
});
