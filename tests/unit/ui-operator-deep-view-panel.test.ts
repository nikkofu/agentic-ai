import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { OperatorDeepViewPanel } from "../../ui/components/OperatorDeepViewPanel";

describe("operator deep view panel", () => {
  it("lets users drill from executive anomalies into node graph, tool calls, and event stream", () => {
    const html = renderToStaticMarkup(
      React.createElement(OperatorDeepViewPanel, {
        inspection: {
          finalDelivery: {
            verifierSummary: "accepted",
            verificationPreview: ["source-a"],
            findingsPreview: [],
            artifacts: [{ path: "artifacts/result.md", exists: true, nonEmpty: true }]
          },
          plan: {
            nodeCount: 3,
            latestJoinDecision: "deliver",
            activeNodePath: "node-root"
          }
        },
        initialTab: "runtime"
      })
    );

    expect(html).toContain("Operator Layer");
    expect(html).toContain("Node Graph");
    expect(html).toContain("Tool Calls");
    expect(html).toContain("Event Stream");
    expect(html).toContain("Verifier Findings");
  });
});
