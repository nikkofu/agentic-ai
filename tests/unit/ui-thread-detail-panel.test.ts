import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { ThreadDetailPanel } from "../../ui/components/ThreadDetailPanel";

describe("thread detail panel", () => {
  it("renders selected thread detail with task and hitl facts", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThreadDetailPanel, {
        detail: {
          taskId: "task-1",
          graphStatus: "running",
          conversation: {
            assistantId: "assistant-main",
            threadId: "thread-123",
            threadStatus: "awaiting_user_input",
            channelType: "whatsapp",
            externalUserId: "8613800138000@s.whatsapp.net"
          },
          latestHumanAction: {
            type: "HumanActionRequired",
            payload: {
              node_id: "node-hitl",
              reason: "approval needed"
            }
          },
          latestAsyncNode: {
            type: "AsyncNodeSettled",
            payload: {
              node_id: "node-research",
              owner_id: "worker-a"
            }
          }
        }
      })
    );

    expect(html).toContain("Thread Detail");
    expect(html).toContain("thread-123");
    expect(html).toContain("task-1");
    expect(html).toContain("approval needed");
    expect(html).toContain("worker-a");
  });

  it("renders empty-state when no conversation is selected", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThreadDetailPanel, {
        detail: null
      })
    );

    expect(html).toContain("No thread selected yet.");
  });
});
