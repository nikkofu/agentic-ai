import { describe, expect, it } from "vitest";

import { buildOperatorIntelligenceSnapshot } from "../../src/runtime/operatorIntelligence";

describe("operatorIntelligence", () => {
  it("derives executive outcome, economics, risk, and trust metrics from task inputs", () => {
    const snapshot = buildOperatorIntelligenceSnapshot({
      tasks: [
        {
          family: "research_writing",
          finalState: "completed",
          deliveryStatus: "completed",
          acceptanceDecision: "accept",
          totalCostUsd: 1.25,
          humanInterventions: 0,
          blocked: false
        }
      ]
    });

    expect(snapshot.outcome.acceptanceRate).toBe(1);
    expect(snapshot.economics.costPerAcceptedDelivery).toBe(1.25);
    expect(snapshot.trust.evidenceBackedCompletionRate).toBe(1);
    expect(snapshot.humanLoad.totalInterventions).toBe(0);
    expect(snapshot.queue.pendingApprovals).toBe(0);
    expect(snapshot.queue.pendingClarifications).toBe(0);
    expect(snapshot.trust.releaseGateReadiness).toBe(false);
    expect(snapshot.objectives).toEqual([]);
  });
});
