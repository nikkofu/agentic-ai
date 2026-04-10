import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { CompletionHarnessPanel } from "../../ui/components/CompletionHarnessPanel";

describe("completion harness panel", () => {
  it("renders release readiness and family scorecards", () => {
    const html = renderToStaticMarkup(
      React.createElement(CompletionHarnessPanel, {
        completion: {
          latestRecord: {
            taskId: "task-phase19",
            family: "research_writing",
            acceptanceDecision: "accept",
            successfulCompletion: true
          },
          families: [
            {
              family: "research_writing",
              totalRuns: 2,
              successfulRuns: 2,
              acceptedRuns: 2,
              blockedRuns: 0,
              completionRate: 1,
              acceptanceRate: 1
            },
            {
              family: "browser_workflow",
              totalRuns: 2,
              successfulRuns: 1,
              acceptedRuns: 1,
              blockedRuns: 1,
              completionRate: 0.5,
              acceptanceRate: 0.5
            }
          ],
          releaseGate: {
            ready: true,
            requiredFamilies: ["research_writing", "browser_workflow"],
            reasons: []
          }
        }
      })
    );

    expect(html).toContain("Completion Harness");
    expect(html).toContain("release ready");
    expect(html).toContain("research_writing");
    expect(html).toContain("completion=100%");
    expect(html).toContain("browser_workflow");
    expect(html).toContain("blocked=1");
  });
});
