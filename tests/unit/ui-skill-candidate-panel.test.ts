import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { SkillCandidatePanel } from "../../ui/components/SkillCandidatePanel";

describe("skill candidate panel", () => {
  it("renders candidate summaries and confidence", () => {
    const html = renderToStaticMarkup(
      React.createElement(SkillCandidatePanel, {
        candidates: [
          {
            id: "candidate-1",
            summary: "Validate outcome before retrying browser steps.",
            confidence: "high",
            status: "candidate"
          }
        ]
      })
    );

    expect(html).toContain("Skill Candidates");
    expect(html).toContain("Validate outcome before retrying browser steps.");
    expect(html).toContain("high/candidate");
  });
});
