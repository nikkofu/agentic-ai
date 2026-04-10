import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { ConversationPanel } from "../../ui/components/ConversationPanel";

describe("conversation panel", () => {
  it("renders conversation continuity details", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConversationPanel, {
        inspection: {
          assistantId: "assistant-main",
          threadId: "thread-123",
          threadStatus: "task_running",
          channelType: "whatsapp",
          externalUserId: "8613800138000@s.whatsapp.net"
        }
      })
    );

    expect(html).toContain("Conversation");
    expect(html).toContain("assistant-main");
    expect(html).toContain("thread-123");
    expect(html).toContain("task_running");
    expect(html).toContain("whatsapp");
  });

  it("renders an empty-state when no thread is linked", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConversationPanel, {
        inspection: null
      })
    );

    expect(html).toContain("No conversation thread linked yet.");
  });
});
