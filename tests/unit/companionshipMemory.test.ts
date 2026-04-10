import { describe, expect, it } from "vitest";

import { buildCompanionshipSnapshot } from "../../src/runtime/companionshipMemory";

describe("companionship memory", () => {
  it("builds a continuity snapshot from thread status and recent events", () => {
    const snapshot = buildCompanionshipSnapshot({
      threadId: "thread-1",
      threadStatus: "task_blocked",
      activeTaskId: "task-1",
      recentEvents: [
        { direction: "incoming", summary: "帮我继续上次的研究。" },
        { direction: "outgoing", summary: "任务当前被阻断，等待你的进一步决定。" }
      ],
      memoryLatest: ["用户偏好先看结论，再看细节。"],
      lastMeaningfulInteractionAt: "2026-04-10T10:00:00.000Z"
    });

    expect(snapshot.threadId).toBe("thread-1");
    expect(snapshot.continuitySummary).toContain("task_blocked");
    expect(snapshot.unresolvedTopics.length).toBeGreaterThan(0);
    expect(snapshot.followUpSuggestion).toContain("继续");
    expect(snapshot.preferenceNotes[0]).toContain("先看结论");
  });
});
