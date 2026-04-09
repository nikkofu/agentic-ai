import { describe, expect, it } from "vitest";

import { evaluateAcceptanceProof, evaluateDecision } from "../../src/eval/evaluator";

describe("evaluateDecision", () => {
  const weights = { quality: 0.6, cost: 0.2, latency: 0.2 };

  it("returns deliver when total score is >= 0.75", () => {
    const result = evaluateDecision(
      {
        quality: 0.9,
        cost: 0.7,
        latency: 0.8,
        consecutiveRevises: 0,
        qualityDelta: 0.1,
        guardrailTripped: false,
        unrecoverableToolError: false
      },
      weights
    );

    expect(result.decision).toBe("deliver");
    expect(result.scores.total).toBeGreaterThanOrEqual(0.75);
  });

  it("returns revise when total score is between 0.55 and 0.75", () => {
    const result = evaluateDecision(
      {
        quality: 0.6,
        cost: 0.6,
        latency: 0.6,
        consecutiveRevises: 0,
        qualityDelta: 0.1,
        guardrailTripped: false,
        unrecoverableToolError: false
      },
      weights
    );

    expect(result.decision).toBe("revise");
  });

  it("returns block when total score is below 0.55", () => {
    const result = evaluateDecision(
      {
        quality: 0.3,
        cost: 0.3,
        latency: 0.3,
        consecutiveRevises: 0,
        qualityDelta: 0.1,
        guardrailTripped: false,
        unrecoverableToolError: false
      },
      weights
    );

    expect(result.decision).toBe("block");
  });

  it("returns block when revise loops without improvement", () => {
    const result = evaluateDecision(
      {
        quality: 0.6,
        cost: 0.6,
        latency: 0.6,
        consecutiveRevises: 2,
        qualityDelta: 0.04,
        guardrailTripped: false,
        unrecoverableToolError: false
      },
      weights
    );

    expect(result.decision).toBe("block");
    expect(result.reason).toBe("revise_without_improvement");
  });

  it("returns block when guardrail is tripped", () => {
    const result = evaluateDecision(
      {
        quality: 0.9,
        cost: 0.9,
        latency: 0.9,
        consecutiveRevises: 0,
        qualityDelta: 0.2,
        guardrailTripped: true,
        unrecoverableToolError: false
      },
      weights
    );

    expect(result.decision).toBe("block");
    expect(result.reason).toBe("guardrail_tripped");
  });

  it("returns block for unrecoverable tool error", () => {
    const result = evaluateDecision(
      {
        quality: 0.9,
        cost: 0.9,
        latency: 0.9,
        consecutiveRevises: 0,
        qualityDelta: 0.2,
        guardrailTripped: false,
        unrecoverableToolError: true
      },
      weights
    );

    expect(result.decision).toBe("block");
    expect(result.reason).toBe("unrecoverable_tool_error");
  });

  it("maps acceptance proof decisions into runtime convergence decisions", () => {
    expect(evaluateAcceptanceProof(undefined)).toBe("deliver");
    expect(evaluateAcceptanceProof({
      decision: "accept",
      verifierSummary: "ok",
      findings: []
    })).toBe("deliver");
    expect(evaluateAcceptanceProof({
      decision: "revise",
      verifierSummary: "fix",
      findings: []
    })).toBe("revise");
    expect(evaluateAcceptanceProof({
      decision: "reject",
      verifierSummary: "bad",
      findings: []
    })).toBe("block");
  });
});
