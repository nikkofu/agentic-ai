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

  it("renders empty-state and dream freshness truth", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryPanel, {
        inspection: {
          memory: {
            personal: { count: 0, latest: [] },
            project: { count: 0, latest: [] },
            task: { count: 0, latest: [] }
          },
          dream: {
            reflectionsCount: 2,
            latestReflections: ["Observed repeated failures."],
            recommendationsCount: 1,
            latestRecommendations: ["Add validation."]
          }
        }
      })
    );

    expect(html).toContain("No memory recorded yet.");
    expect(html).toContain("freshness=dream-active");
  });
});
