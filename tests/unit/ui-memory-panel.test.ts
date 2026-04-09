import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { MemoryPanel } from "../../ui/components/MemoryPanel";

describe("memory panel", () => {
  it("renders personal, project, task, and dream sections", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryPanel, {
        inspection: {
          memory: {
            personal: { count: 1, latest: ["Prefers concise responses."] },
            project: { count: 2, latest: ["Use acceptance proof."] },
            task: { count: 3, latest: ["Join summary"] }
          },
          dream: {
            reflectionsCount: 1,
            latestReflections: ["Observed repeated failures."],
            recommendationsCount: 1,
            latestRecommendations: ["Add validation."]
          }
        }
      })
    );

    expect(html).toContain("Personal Memory");
    expect(html).toContain("Project Memory");
    expect(html).toContain("Task Memory");
    expect(html).toContain("Dream");
  });
});
