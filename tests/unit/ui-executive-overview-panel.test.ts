import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { ExecutiveOverviewPanel } from "../../ui/components/ExecutiveOverviewPanel";

describe("executive overview panel", () => {
  it("renders business-facing cards before runtime details", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveOverviewPanel, {
        snapshot: {
          outcome: { completionRate: 0.92, acceptanceRate: 0.81 },
          economics: { totalCostUsd: 124.52, costPerAcceptedDelivery: 3.88 },
          risk: { blockedRate: 0.11 },
          humanLoad: { interventionRate: 0.27, totalInterventions: 4 },
          trust: { evidenceBackedCompletionRate: 0.76, releaseGateReadiness: true },
          objectives: [
            {
              id: "family:research_writing",
              label: "research_writing",
              family: "research_writing",
              completionRate: 0.92,
              acceptanceRate: 0.81,
              totalRuns: 12,
              blockedRuns: 1
            }
          ]
        }
      })
    );

    expect(html).toContain("Accepted Outcomes");
    expect(html).toContain("Cost per Accepted Delivery");
    expect(html).toContain("Blocked Risk");
    expect(html).toContain("release ready");
    expect(html).toContain("research_writing");
  });
});
