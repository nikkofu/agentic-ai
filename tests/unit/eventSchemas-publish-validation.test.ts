import { describe, expect, it } from "vitest";

import { createInMemoryEventBus } from "../../src/core/eventBus";

describe("event publish validation", () => {
  it("publishes valid payload for known event", () => {
    const bus = createInMemoryEventBus();

    expect(() => {
      bus.publish({
        type: "TaskSubmitted",
        payload: { task_id: "task-1" },
        ts: Date.now()
      });
    }).not.toThrow();
  });

  it("throws when known event payload is invalid", () => {
    const bus = createInMemoryEventBus();

    expect(() => {
      bus.publish({
        type: "TaskSubmitted",
        payload: { missing: "task-1" },
        ts: Date.now()
      });
    }).toThrow(/task_id/i);
  });
});
