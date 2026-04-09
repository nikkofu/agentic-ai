import { describe, expect, it } from "vitest";

import {
  TASK_FAMILIES,
  buildTaskFamilyPolicy,
  inferTaskFamily,
  normalizeTaskFamily
} from "../../src/runtime/taskFamily";
import type { FamilyDeliveryBundle, VerificationRecord } from "../../src/runtime/contracts";

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
      sourceCoverageMinimum: 1
    });
  });

  it("uses structured verification records in the family-aware delivery bundle", () => {
    const verification: VerificationRecord[] = [
      {
        kind: "source",
        summary: "verified claim against source",
        sourceId: "source-a",
        passed: true
      }
    ];
    const familyBundle: FamilyDeliveryBundle = {
      status: "completed",
      final_result: "ok",
      artifacts: ["artifacts/final.md"],
      verification,
      risks: [],
      next_actions: [],
      family: "research_writing",
      delivery_proof: {
        family: "research_writing",
        steps: []
      }
    };

    expect(familyBundle.verification[0]).toMatchObject({
      kind: "source",
      sourceId: "source-a",
      passed: true
    });
    expect(familyBundle.family).toBe("research_writing");
    expect(familyBundle.delivery_proof.family).toBe("research_writing");
  });

  it("infers the family from task intent and research/browser cues", () => {
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

  it("does not classify generic review or scripting work as research writing", () => {
    expect(
      inferTaskFamily({
        task: "Review the pull request and leave comments"
      })
    ).toBeUndefined();

    expect(
      inferTaskFamily({
        task: "Write a migration script for the database"
      })
    ).toBeUndefined();
  });

  it("does not assign browser family just because a workflow is supplied", () => {
    expect(
      inferTaskFamily({
        task: "Revise this outline",
        workflow: {
          nodes: []
        }
      } as any)
    ).toBeUndefined();
  });
});
