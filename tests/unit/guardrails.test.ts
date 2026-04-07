import { describe, expect, it } from "vitest";

import { checkSpawnGuardrails } from "../../src/guardrails/guardrails";

describe("checkSpawnGuardrails", () => {
  const limits = {
    maxDepth: 4,
    maxBranch: 3,
    maxSteps: 60,
    maxBudget: 5
  };

  it("allows spawn when all limits are under threshold", () => {
    const result = checkSpawnGuardrails(
      {
        currentDepth: 2,
        childrenCount: 1,
        totalSteps: 20,
        spentBudget: 1.2
      },
      limits
    );

    expect(result).toEqual({ allowed: true });
  });

  it("blocks spawn when depth limit is reached", () => {
    const result = checkSpawnGuardrails(
      {
        currentDepth: 4,
        childrenCount: 1,
        totalSteps: 20,
        spentBudget: 1.2
      },
      limits
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("maxDepth");
  });

  it("blocks spawn when branch limit is reached", () => {
    const result = checkSpawnGuardrails(
      {
        currentDepth: 2,
        childrenCount: 3,
        totalSteps: 20,
        spentBudget: 1.2
      },
      limits
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("maxBranch");
  });

  it("blocks spawn when step limit is reached", () => {
    const result = checkSpawnGuardrails(
      {
        currentDepth: 2,
        childrenCount: 1,
        totalSteps: 60,
        spentBudget: 1.2
      },
      limits
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("maxSteps");
  });

  it("blocks spawn when budget limit is reached", () => {
    const result = checkSpawnGuardrails(
      {
        currentDepth: 2,
        childrenCount: 1,
        totalSteps: 20,
        spentBudget: 5
      },
      limits
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("maxBudget");
  });
});
