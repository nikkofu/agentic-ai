import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { MemoryEvolutionPanel } from "../../ui/components/MemoryEvolutionPanel";

describe("memory evolution panel", () => {
  it("renders status counts and timeline entries", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryEvolutionPanel, {
        evolution: {
          statusCounts: {
            active: 3,
            stale: 1,
            superseded: 2,
            archived: 0,
            forgotten: 0
          },
          timeline: ["promote: project-1 -> curated", "restore: project-1"]
        }
      })
    );

    expect(html).toContain("Memory Evolution");
    expect(html).toContain("active=3");
    expect(html).toContain("superseded=2");
    expect(html).toContain("promote: project-1 -&gt; curated");
  });
});
