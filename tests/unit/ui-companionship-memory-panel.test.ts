import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { CompanionshipMemoryPanel } from "../../ui/components/CompanionshipMemoryPanel";

describe("companionship memory panel", () => {
  it("renders evolved continuity summary and unresolved topics", () => {
    const html = renderToStaticMarkup(
      React.createElement(CompanionshipMemoryPanel, {
        companionship: {
          continuitySummary: "这个 thread 仍然围绕上一次被阻断的研究任务延续。",
          unresolvedTopics: ["等待用户确认是否继续推进。"],
          followUpSuggestion: "下一次收到消息时，先确认是否恢复该任务。",
          preferenceNotes: ["用户偏好先给结论。"]
        }
      })
    );

    expect(html).toContain("Companionship Memory");
    expect(html).toContain("这个 thread 仍然围绕上一次被阻断的研究任务延续。");
    expect(html).toContain("等待用户确认是否继续推进。");
    expect(html).toContain("下一次收到消息时，先确认是否恢复该任务。");
  });
});
