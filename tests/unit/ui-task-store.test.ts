import { beforeEach, describe, expect, it } from "vitest";

import { useTaskStore } from "../../ui/store/useTaskStore";

describe("useTaskStore async node events", () => {
  beforeEach(() => {
    useTaskStore.getState().reset();
  });

  it("tracks queued, settled, and failed async node events", () => {
    const store = useTaskStore.getState();

    store.processEvent({
      type: "TaskSubmitted",
      payload: { task_id: "task-ui-1" },
      timestamp: new Date().toISOString()
    });

    store.processEvent({
      type: "AsyncNodeQueued",
      payload: {
        task_id: "task-ui-1",
        node_id: "node-async",
        role: "researcher",
        owner_id: "worker-alpha",
        dedupe_key: "task-ui-1-node-async"
      },
      timestamp: new Date().toISOString()
    });

    let node = useTaskStore.getState().nodes.find((entry) => entry.id === "node-async");
    expect(node?.data.status).toBe("pending");
    expect(node?.data.ownerId).toBe("worker-alpha");
    expect(node?.data.dedupeKey).toBe("task-ui-1-node-async");

    store.processEvent({
      type: "AsyncNodeSettled",
      payload: {
        task_id: "task-ui-1",
        node_id: "node-async",
        final_state: "completed",
        final_result: "queued summary"
      },
      timestamp: new Date().toISOString()
    });

    node = useTaskStore.getState().nodes.find((entry) => entry.id === "node-async");
    expect(node?.data.status).toBe("completed");
    expect(node?.data.outputSummary).toContain("queued summary");

    store.processEvent({
      type: "AsyncNodeFailed",
      payload: {
        task_id: "task-ui-1",
        node_id: "node-async-2",
        error: "worker crashed"
      },
      timestamp: new Date().toISOString()
    });

    node = useTaskStore.getState().nodes.find((entry) => entry.id === "node-async-2");
    expect(node?.data.status).toBe("failed");
    expect(node?.data.outputSummary).toContain("worker crashed");
  });

  it("projects async task settled and failed events onto the root node", () => {
    const store = useTaskStore.getState();

    store.processEvent({
      type: "TaskSubmitted",
      payload: { task_id: "task-ui-2" },
      timestamp: new Date().toISOString()
    });

    store.processEvent({
      type: "NodeScheduled",
      payload: {
        task_id: "task-ui-2",
        node_id: "node-root",
        role: "planner"
      },
      timestamp: new Date().toISOString()
    });

    store.processEvent({
      type: "AsyncTaskSettled",
      payload: {
        task_id: "task-ui-2",
        job_kind: "resume",
        final_state: "completed",
        delivery: {
          status: "completed",
          final_result: "async final answer"
        }
      },
      timestamp: new Date().toISOString()
    });

    let root = useTaskStore.getState().nodes.find((entry) => entry.id === "node-root");
    expect(root?.data.status).toBe("completed");
    expect(root?.data.outputSummary).toContain("async final answer");

    store.processEvent({
      type: "AsyncTaskFailed",
      payload: {
        task_id: "task-ui-2",
        job_kind: "resume",
        error: "queue worker offline"
      },
      timestamp: new Date().toISOString()
    });

    root = useTaskStore.getState().nodes.find((entry) => entry.id === "node-root");
    expect(root?.data.status).toBe("failed");
    expect(root?.data.outputSummary).toContain("queue worker offline");
  });

  it("uses user-facing blocked explanations instead of raw blocking reason fragments", () => {
    const store = useTaskStore.getState();

    store.processEvent({
      type: "TaskSubmitted",
      payload: { task_id: "task-ui-3" },
      timestamp: new Date().toISOString()
    });

    store.processEvent({
      type: "NodeScheduled",
      payload: {
        task_id: "task-ui-3",
        node_id: "node-root",
        role: "planner"
      },
      timestamp: new Date().toISOString()
    });

    store.processEvent({
      type: "TaskClosed",
      payload: {
        task_id: "task-ui-3",
        state: "aborted",
        delivery: {
          status: "blocked",
          final_result: "",
          blocking_reason: "verification_missing"
        }
      },
      timestamp: new Date().toISOString()
    });

    const root = useTaskStore.getState().nodes.find((entry) => entry.id === "node-root");
    expect(root?.data.status).toBe("failed");
    expect(root?.data.outputSummary).toBe("Task blocked: verification_missing");
  });

  it("uses user-facing failed explanations for async task failures", () => {
    const store = useTaskStore.getState();

    store.processEvent({
      type: "TaskSubmitted",
      payload: { task_id: "task-ui-4" },
      timestamp: new Date().toISOString()
    });

    store.processEvent({
      type: "NodeScheduled",
      payload: {
        task_id: "task-ui-4",
        node_id: "node-root",
        role: "planner"
      },
      timestamp: new Date().toISOString()
    });

    store.processEvent({
      type: "AsyncTaskFailed",
      payload: {
        task_id: "task-ui-4",
        job_kind: "resume",
        error: "queue worker offline"
      },
      timestamp: new Date().toISOString()
    });

    const root = useTaskStore.getState().nodes.find((entry) => entry.id === "node-root");
    expect(root?.data.status).toBe("failed");
    expect(root?.data.outputSummary).toBe("Task failed: queue worker offline");
  });
});
