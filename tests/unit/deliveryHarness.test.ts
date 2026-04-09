import { describe, expect, it } from "vitest";

import { normalizeDeliveryProof } from "../../src/runtime/deliveryHarness";

describe("deliveryHarness", () => {
  it("derives a normalized proof from a blocked delivery bundle", () => {
    const proof = normalizeDeliveryProof({
      family: "research_writing",
      delivery: {
        status: "blocked",
        final_result: "",
        artifacts: ["artifacts/draft.md"],
        verification: [
          {
            kind: "source",
            summary: "source-a",
            sourceId: "source-a",
            passed: true
          }
        ],
        risks: ["missing evidence"],
        blocking_reason: "verification_missing",
        next_actions: ["add citations"]
      }
    });

    expect(proof.family).toBe("research_writing");
    expect(proof.steps).toEqual([
      {
        kind: "delivery",
        status: "blocked",
        summary: "verification_missing",
        evidenceRefs: ["source-a", "artifacts/draft.md"]
      }
    ]);
  });

  it("normalizes explicit proof steps and preserves replay hints", () => {
    const proof = normalizeDeliveryProof({
      family: "browser_workflow",
      proof: {
        family: "research_writing" as any,
        replayHints: ["retry after locating the target"],
        steps: [
          {
            kind: "plan",
            status: "completed",
            summary: "found target",
            evidenceRefs: ["step-1"]
          },
          {
            kind: "execute",
            summary: "clicked submit"
          } as any
        ]
      }
    });

    expect(proof.family).toBe("browser_workflow");
    expect(proof.replayHints).toEqual(["retry after locating the target"]);
    expect(proof.steps).toEqual([
      {
        kind: "plan",
        status: "completed",
        summary: "found target",
        evidenceRefs: ["step-1"]
      },
      {
        kind: "execute",
        status: "completed",
        summary: "clicked submit",
        evidenceRefs: []
      }
    ]);
  });
});
