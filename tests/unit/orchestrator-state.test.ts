import { describe, expect, it } from "vitest";

import { getRuntimeConfig } from "../../src/config/loadRuntimeConfig";

describe("getRuntimeConfig", () => {
  it("loads and validates runtime config defaults", () => {
    const config = getRuntimeConfig();

    expect(config.scheduler.defaultPolicy).toBe("bfs");
    expect(config.guardrails.maxDepth).toBe(4);
    expect(config.guardrails.maxBranch).toBe(3);
    expect(config.guardrails.maxSteps).toBe(60);
    expect(config.guardrails.maxBudget).toBe(5);
    expect(config.evaluator.weights.quality).toBe(0.6);
    expect(config.evaluator.weights.cost).toBe(0.2);
    expect(config.evaluator.weights.latency).toBe(0.2);
  });
});
