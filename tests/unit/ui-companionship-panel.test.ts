import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { CompanionshipPanel } from "../../ui/components/CompanionshipPanel";

describe("companionship panel", () => {
  it("renders continuity and follow-up guidance", () => {
    const html = renderToStaticMarkup(
      React.createElement(CompanionshipPanel, {
        continuitySummary: "这条会话仍然保留着上一次任务的上下文。",
        followUpSuggestion: "适合在用户回到 WhatsApp 时主动继续这个 thread。",
        presenceNote: "我会记住这个 thread 的节奏和语境。"
      })
    );

    expect(html).toContain("Companionship");
    expect(html).toContain("这条会话仍然保留着上一次任务的上下文。");
    expect(html).toContain("适合在用户回到 WhatsApp 时主动继续这个 thread。");
    expect(html).toContain("我会记住这个 thread 的节奏和语境。");
  });
});
