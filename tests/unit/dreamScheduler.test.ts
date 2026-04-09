import { describe, expect, it, vi } from "vitest";

import { createDreamScheduler } from "../../src/runtime/dreamScheduler";

describe("dream scheduler", () => {
  it("runs the dream runtime when idle time reaches the threshold", async () => {
    const runIdleCycle = vi.fn().mockResolvedValue({
      reflections: ["Idle reflection."],
      hypotheses: [],
      recommendations: ["Recommendation."],
      skillDrafts: ["Skill draft."],
      externalActionsAttempted: 0
    });

    const scheduler = createDreamScheduler({
      dreamRuntime: { runIdleCycle } as any,
      thresholdMinutes: 20
    });

    const result = await scheduler.maybeRunIdleCycle({
      idleMinutes: 25,
      taskFailures: ["browser_outcome_not_reached"],
      memoryEntries: [{ id: "task-1", body: "Recovered by validating earlier." }]
    });

    expect(runIdleCycle).toHaveBeenCalledTimes(1);
    expect(result?.recommendations.length).toBe(1);
  });

  it("skips Dream when idle time is below the threshold", async () => {
    const runIdleCycle = vi.fn();
    const scheduler = createDreamScheduler({
      dreamRuntime: { runIdleCycle } as any,
      thresholdMinutes: 20
    });

    const result = await scheduler.maybeRunIdleCycle({
      idleMinutes: 10,
      taskFailures: [],
      memoryEntries: []
    });

    expect(runIdleCycle).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
