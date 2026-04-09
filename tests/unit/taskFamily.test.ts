import { describe, expect, it } from "vitest";

import {
  TASK_FAMILIES,
  buildTaskFamilyPolicy,
  inferTaskFamily,
  normalizeTaskFamily
} from "../../src/runtime/taskFamily";

describe("taskFamily", () => {
  it("exposes the explicit phase 14 families", () => {
    expect(TASK_FAMILIES).toEqual(["research_writing", "browser_workflow"]);
    expect(normalizeTaskFamily("research_writing")).toBe("research_writing");
    expect(normalizeTaskFamily("browser_workflow")).toBe("browser_workflow");
    expect(normalizeTaskFamily("something-else")).toBeNull();
  });

  it("builds trust-first and automation-first defaults for the two families", () => {
    const researchPolicy = buildTaskFamilyPolicy("research_writing");
    const browserPolicy = buildTaskFamilyPolicy("browser_workflow");

    expect(researchPolicy).toMatchObject({
      family: "research_writing",
      automationPriority: "low",
      trustPriority: "high",
      requireVerification: true,
      requireArtifacts: true,
      sourceCoverageMinimum: 2
    });
    expect(browserPolicy).toMatchObject({
      family: "browser_workflow",
      automationPriority: "high",
      trustPriority: "medium",
      requireVerification: true,
      requireArtifacts: true,
      browserRecoveryBudget: 3
    });
  });

  it("infers the family from task intent and browser cues", () => {
    expect(
      inferTaskFamily({
        intent: {
          task_kind: "research_writing"
        } as any,
        task: "Research and write a summary"
      })
    ).toBe("research_writing");

    expect(
      inferTaskFamily({
        task: "Open a website, fill the form, and click submit"
      })
    ).toBe("browser_workflow");
  });
});
