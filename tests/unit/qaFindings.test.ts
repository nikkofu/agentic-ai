import { describe, expect, it } from "vitest";

import { buildAcceptanceProof, normalizeQaFindings } from "../../src/runtime/qaFindings";

describe("qa findings", () => {
  it("normalizes structured findings", () => {
    expect(normalizeQaFindings([
      {
        severity: "critical",
        kind: "artifact_invalid",
        summary: "artifact missing",
        evidenceRefs: ["artifacts/final.md"]
      },
      {
        severity: "weird",
        kind: "unknown",
        summary: "fallback me"
      }
    ])).toEqual([
      {
        severity: "critical",
        kind: "artifact_invalid",
        summary: "artifact missing",
        evidenceRefs: ["artifacts/final.md"],
        nodeId: undefined
      },
      {
        severity: "minor",
        kind: "policy_violation",
        summary: "fallback me",
        evidenceRefs: [],
        nodeId: undefined
      }
    ]);
  });

  it("builds acceptance proof with normalized findings", () => {
    const proof = buildAcceptanceProof({
      decision: "revise",
      verifierSummary: "needs fixes",
      findings: [{ severity: "major", kind: "verification_gap", summary: "missing sources" }]
    });

    expect(proof).toEqual({
      decision: "revise",
      acceptedAt: undefined,
      verifierSummary: "needs fixes",
      findings: [{
        severity: "major",
        kind: "verification_gap",
        summary: "missing sources",
        evidenceRefs: [],
        nodeId: undefined
      }]
    });
  });
});
