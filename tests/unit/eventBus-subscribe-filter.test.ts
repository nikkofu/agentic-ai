import { describe, expect, it, vi } from "vitest";

import { createInMemoryEventBus } from "../../src/core/eventBus";

describe("eventBus filtered subscribe", () => {
  it("dispatches exact event subscriptions only for matching type", () => {
    const bus = createInMemoryEventBus();
    const onTaskSubmitted = vi.fn();
    const onToolInvoked = vi.fn();

    bus.subscribe("TaskSubmitted", onTaskSubmitted);
    bus.subscribe("ToolInvoked", onToolInvoked);

    bus.publish({ type: "TaskSubmitted", payload: { task_id: "t1" }, ts: Date.now() });

    expect(onTaskSubmitted).toHaveBeenCalledTimes(1);
    expect(onToolInvoked).toHaveBeenCalledTimes(0);
  });

  it("dispatches wildcard prefix subscriptions", () => {
    const bus = createInMemoryEventBus();
    const onTaskWildcard = vi.fn();

    bus.subscribe("Task.*", onTaskWildcard);

    bus.publish({ type: "Task.Submitted", payload: { task_id: "t1", node_id: "n1", tool: "echo" }, ts: Date.now() });
    bus.publish({ type: "Task.Closed", payload: { task_id: "t1", node_id: "n1", tool: "echo" }, ts: Date.now() });
    bus.publish({ type: "ToolInvoked", payload: { task_id: "t1", node_id: "n1", tool: "echo" }, ts: Date.now() });

    expect(onTaskWildcard).toHaveBeenCalledTimes(2);
  });

  it("supports unsubscribe", () => {
    const bus = createInMemoryEventBus();
    const onTaskSubmitted = vi.fn();

    const unsubscribe = bus.subscribe("TaskSubmitted", onTaskSubmitted);
    unsubscribe();

    bus.publish({ type: "TaskSubmitted", payload: { task_id: "t1" }, ts: Date.now() });

    expect(onTaskSubmitted).toHaveBeenCalledTimes(0);
  });
});
