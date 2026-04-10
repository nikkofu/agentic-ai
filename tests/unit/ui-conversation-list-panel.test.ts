import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { ConversationListPanel, getVisibleThreads } from "../../ui/components/ConversationListPanel";

describe("conversation list panel", () => {
  it("renders assistant and thread summaries", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConversationListPanel, {
        data: {
          assistants: [{ assistantId: "assistant-main", displayName: "Aether", personaProfile: "persistent assistant" }],
          threads: [{
            threadId: "thread-123",
            assistantId: "assistant-main",
            assistantDisplayName: "Aether",
            status: "task_running",
            activeTaskId: "task-1",
            lastInteractionAt: "2026-04-09T12:00:00.000Z",
            latestEventDirection: "outgoing",
            latestEventSummary: "任务已开始",
            latestEventAt: "2026-04-09T12:01:00.000Z"
          }]
        }
      })
    );

    expect(html).toContain("Control Center");
    expect(html).toContain("assistant-main");
    expect(html).toContain("Aether");
    expect(html).toContain("persistent assistant");
    expect(html).toContain("thread-123");
    expect(html).toContain("task-1");
    expect(html).toContain("任务已开始");
    expect(html).toContain("open task");
    expect(html).toContain("inspect");
    expect(html).toContain("2026-04-09T12:01:00.000Z");
  });

  it("renders empty-state when there are no threads", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConversationListPanel, {
        data: {
          assistants: [],
          threads: []
        }
      })
    );

    expect(html).toContain("No persistent threads yet.");
  });

  it("invokes selection callback for task-backed threads", () => {
    const onSelectTask = vi.fn();

    ConversationListPanel({
      data: {
        assistants: [{ assistantId: "assistant-main", displayName: "Aether", personaProfile: "persistent assistant" }],
        threads: [{
          threadId: "thread-123",
          assistantId: "assistant-main",
          assistantDisplayName: "Aether",
          status: "task_running",
          activeTaskId: "task-1",
          lastInteractionAt: "2026-04-09T12:00:00.000Z",
          latestEventDirection: "outgoing",
          latestEventSummary: "任务已开始",
          latestEventAt: "2026-04-09T12:01:00.000Z"
        }]
      },
      onSelectTask
    });

    expect(onSelectTask).not.toHaveBeenCalled();
  });

  it("filters only active threads when active-only mode is enabled", () => {
    const visible = getVisibleThreads([
      {
        threadId: "thread-running",
        assistantId: "assistant-main",
        assistantDisplayName: "Aether",
        status: "task_running",
        activeTaskId: "task-1",
        lastInteractionAt: "2026-04-09T12:00:00.000Z",
        latestEventDirection: "outgoing",
        latestEventSummary: "任务已开始",
        latestEventAt: "2026-04-09T12:01:00.000Z"
      },
      {
        threadId: "thread-done",
        assistantId: "assistant-main",
        assistantDisplayName: "Aether",
        status: "task_completed",
        lastInteractionAt: "2026-04-09T11:00:00.000Z",
        latestEventDirection: "outgoing",
        latestEventSummary: "任务已完成",
        latestEventAt: "2026-04-09T11:01:00.000Z"
      }
    ], "active");

    expect(visible.map((thread) => thread.threadId)).toEqual(["thread-running"]);
  });

  it("filters blocked threads independently", () => {
    const visible = getVisibleThreads([
      {
        threadId: "thread-running",
        assistantId: "assistant-main",
        assistantDisplayName: "Aether",
        status: "task_running",
        activeTaskId: "task-1",
        lastInteractionAt: "2026-04-09T12:00:00.000Z"
      },
      {
        threadId: "thread-blocked",
        assistantId: "assistant-main",
        assistantDisplayName: "Aether",
        status: "task_blocked",
        activeTaskId: "task-2",
        lastInteractionAt: "2026-04-09T11:00:00.000Z"
      }
    ] as any, "blocked");

    expect(visible.map((thread) => thread.threadId)).toEqual(["thread-blocked"]);
  });

  it("renders current filter label", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConversationListPanel, {
        data: {
          assistants: [{ assistantId: "assistant-main", displayName: "Aether", personaProfile: "persistent assistant" }],
          threads: [{
            threadId: "thread-awaiting",
            assistantId: "assistant-main",
            assistantDisplayName: "Aether",
            status: "awaiting_user_input",
            activeTaskId: "task-awaiting",
            lastInteractionAt: "2026-04-09T13:00:00.000Z"
          }]
        },
        filter: "awaiting_user_input"
      })
    );

    expect(html).toContain("filter=awaiting_user_input");
  });

  it("renders resume shortcut for blocked task threads", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConversationListPanel, {
        data: {
          assistants: [{ assistantId: "assistant-main", displayName: "Aether", personaProfile: "persistent assistant" }],
          threads: [{
            threadId: "thread-blocked",
            assistantId: "assistant-main",
            assistantDisplayName: "Aether",
            status: "task_blocked",
            activeTaskId: "task-blocked",
            lastInteractionAt: "2026-04-09T13:00:00.000Z",
            latestEventDirection: "outgoing",
            latestEventSummary: "需要补充信息",
            latestEventAt: "2026-04-09T13:01:00.000Z"
          }]
        }
      })
    );

    expect(html).toContain("resume");
  });
});
