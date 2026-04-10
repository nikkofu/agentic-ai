import { describe, expect, it } from "vitest";

import { applyFamilyDeliveryPolicy, createFamilyDeliveryBundle, normalizeDeliveryProof } from "../../src/runtime/deliveryHarness";

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

  it("blocks research families that do not meet the source coverage minimum", () => {
    const delivery = applyFamilyDeliveryPolicy({
      delivery: {
        status: "completed",
        final_result: "ok",
        artifacts: ["artifacts/final.md"],
        verification: [
          {
            kind: "source",
            summary: "source-a",
            sourceId: "source-a",
            passed: true
          },
          {
            kind: "artifact_check",
            summary: "artifact check",
            passed: true
          }
        ],
        risks: [],
        next_actions: [],
        family: "research_writing",
        delivery_proof: {
          family: "research_writing",
          steps: []
        }
      },
      familyPolicy: {
        family: "research_writing",
        automationPriority: "low",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 2
      }
    });

    expect(delivery.status).toBe("blocked");
    expect(delivery.blocking_reason).toBe("policy_source_coverage_required");
  });

  it("does not count legacy string verification entries as source coverage", () => {
    const familyBundle = createFamilyDeliveryBundle({
      family: "research_writing",
      delivery: {
        status: "completed",
        final_result: "ok",
        artifacts: ["artifacts/final.md"],
        verification: ["manual verification complete"],
        risks: [],
        next_actions: []
      }
    });

    const delivery = applyFamilyDeliveryPolicy({
      delivery: familyBundle,
      familyPolicy: {
        family: "research_writing",
        automationPriority: "low",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 1
      }
    });

    expect(delivery.status).toBe("blocked");
    expect(delivery.blocking_reason).toBe("policy_source_coverage_required");
  });

  it("allows browser families to pass with browser-native verification records", () => {
    const delivery = applyFamilyDeliveryPolicy({
      delivery: {
        status: "completed",
        final_result: "ok",
        artifacts: ["artifacts/browser-run.png"],
        verification: [
          {
            kind: "page_state",
            summary: "form submitted",
            locator: "#confirmation",
            passed: true
          }
        ],
        risks: [],
        next_actions: [],
        family: "browser_workflow",
        delivery_proof: {
          family: "browser_workflow",
          steps: []
        }
      },
      familyPolicy: {
        family: "browser_workflow",
        automationPriority: "high",
        trustPriority: "medium",
        requireVerification: true,
        requireArtifacts: true
      }
    });

    expect(delivery.status).toBe("completed");
    expect(delivery.blocking_reason).toBeUndefined();
  });

  it("preserves an existing blocking reason instead of overwriting it with policy gates", () => {
    const delivery = applyFamilyDeliveryPolicy({
      delivery: {
        status: "blocked",
        final_result: "",
        artifacts: [],
        verification: [],
        risks: [],
        blocking_reason: "join_blocked",
        next_actions: [],
        family: "research_writing",
        delivery_proof: {
          family: "research_writing",
          steps: []
        }
      },
      familyPolicy: {
        family: "research_writing",
        automationPriority: "low",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 2
      }
    });

    expect(delivery.status).toBe("blocked");
    expect(delivery.blocking_reason).toBe("join_blocked");
  });

  it("counts distinct source ids toward research source coverage", () => {
    const delivery = applyFamilyDeliveryPolicy({
      delivery: {
        status: "completed",
        final_result: "ok",
        artifacts: ["artifacts/final.md"],
        verification: [
          {
            kind: "source",
            summary: "source-a primary claim",
            sourceId: "source-a",
            passed: true
          },
          {
            kind: "source",
            summary: "source-a secondary claim",
            sourceId: "source-a",
            passed: true
          }
        ],
        risks: [],
        next_actions: [],
        family: "research_writing",
        delivery_proof: {
          family: "research_writing",
          steps: []
        }
      },
      familyPolicy: {
        family: "research_writing",
        automationPriority: "low",
        trustPriority: "high",
        requireVerification: true,
        requireArtifacts: true,
        sourceCoverageMinimum: 2
      }
    });

    expect(delivery.status).toBe("blocked");
    expect(delivery.blocking_reason).toBe("policy_source_coverage_required");
  });
});
