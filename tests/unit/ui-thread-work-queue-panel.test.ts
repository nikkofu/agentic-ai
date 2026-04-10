import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { ThreadWorkQueuePanel, getQueuedThreads } from "../../ui/components/ThreadWorkQueuePanel";

describe("thread work queue panel", () => {
  it("filters queue-worthy threads from the control-center list", () => {
    const queued = getQueuedThreads([
      {
        threadId: "thread-running",
        assistantId: "assistant-main",
        status: "task_running",
        activeTaskId: "task-1",
        lastInteractionAt: "2026-04-09T12:00:00.000Z"
      },
      {
        threadId: "thread-blocked",
        assistantId: "assistant-main",
        status: "task_blocked",
        activeTaskId: "task-2",
        lastInteractionAt: "2026-04-09T12:10:00.000Z"
      },
      {
        threadId: "thread-done",
        assistantId: "assistant-main",
        status: "task_completed",
        lastInteractionAt: "2026-04-09T12:20:00.000Z"
      }
    ] as any);

    expect(queued.map((thread) => thread.threadId)).toEqual(["thread-running", "thread-blocked"]);
  });

  it("renders queue summary and priority actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThreadWorkQueuePanel, {
        threads: [{
          threadId: "thread-blocked",
          assistantId: "assistant-main",
          assistantDisplayName: "Aether",
          status: "task_blocked",
          activeTaskId: "task-2",
          lastInteractionAt: "2026-04-09T12:10:00.000Z",
          latestEventSummary: "需要补充信息"
        }]
      })
    );

    expect(html).toContain("Work Queue");
    expect(html).toContain("thread-blocked");
    expect(html).toContain("resume");
    expect(html).toContain("can resume");
    expect(html).toContain("1 items");
  });

  it("shows intervention guidance for threads waiting on user input", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThreadWorkQueuePanel, {
        threads: [{
          threadId: "thread-hitl",
          assistantId: "assistant-main",
          assistantDisplayName: "Aether",
          status: "awaiting_user_input",
          activeTaskId: "task-hitl",
          latestHumanActionNodeId: "node-hitl",
          lastInteractionAt: "2026-04-09T12:30:00.000Z",
          latestEventSummary: "等待人工确认"
        }]
      })
    );

    expect(html).toContain("needs intervention");
    expect(html).toContain("inspect");
    expect(html).toContain("approve");
    expect(html).not.toContain("resume");
  });

  it("renders empty-state when no threads need action", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThreadWorkQueuePanel, {
        threads: []
      })
    );

    expect(html).toContain("No queued threads right now.");
  });
});
