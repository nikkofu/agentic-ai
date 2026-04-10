import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { AssistantProfilePanel } from "../../ui/components/AssistantProfilePanel";

describe("assistant profile panel", () => {
  it("renders assistant summary details", () => {
    const html = renderToStaticMarkup(
      React.createElement(AssistantProfilePanel, {
        assistants: [{
          assistantId: "assistant-main",
          displayName: "Aether",
          personaProfile: "persistent assistant"
        }],
        threadCount: 3,
        activeThreadCount: 2
      })
    );

    expect(html).toContain("Assistant");
    expect(html).toContain("Aether");
    expect(html).toContain("assistant-main");
    expect(html).toContain("persistent assistant");
    expect(html).toContain("threads=3");
    expect(html).toContain("active=2");
  });

  it("renders empty-state when no assistant profiles exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(AssistantProfilePanel, {
        assistants: [],
        threadCount: 0,
        activeThreadCount: 0
      })
    );

    expect(html).toContain("No assistant profiles yet.");
  });
});
