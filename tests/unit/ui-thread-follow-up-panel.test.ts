import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { ThreadFollowUpPanel } from "../../ui/components/ThreadFollowUpPanel";

describe("thread follow up panel", () => {
  it("renders follow-up candidates from completed and blocked threads", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThreadFollowUpPanel, {
        threads: [
          {
            threadId: "thread-blocked",
            assistantDisplayName: "Aether",
            status: "task_blocked",
            latestEventSummary: "需要补充信息",
            activeTaskId: "task-blocked"
          },
          {
            threadId: "thread-done",
            assistantDisplayName: "Aether",
            status: "task_completed",
            latestEventSummary: "文章已经交付"
          }
        ]
      })
    );

    expect(html).toContain("Follow Up");
    expect(html).toContain("thread-blocked");
    expect(html).toContain("需要补充信息");
    expect(html).toContain("thread-done");
    expect(html).toContain("文章已经交付");
  });
});
