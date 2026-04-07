export type SpawnGuardrailInput = {
  currentDepth: number;
  childrenCount: number;
  totalSteps: number;
  spentBudget: number;
};

export type SpawnGuardrailLimits = {
  maxDepth: number;
  maxBranch: number;
  maxSteps: number;
  maxBudget: number;
};

export type SpawnGuardrailResult =
  | { allowed: true }
  | { allowed: false; reason: "maxDepth" | "maxBranch" | "maxSteps" | "maxBudget" };

export function checkSpawnGuardrails(input: SpawnGuardrailInput, limits: SpawnGuardrailLimits): SpawnGuardrailResult {
  if (input.currentDepth >= limits.maxDepth) {
    return { allowed: false, reason: "maxDepth" };
  }

  if (input.childrenCount >= limits.maxBranch) {
    return { allowed: false, reason: "maxBranch" };
  }

  if (input.totalSteps >= limits.maxSteps) {
    return { allowed: false, reason: "maxSteps" };
  }

  if (input.spentBudget >= limits.maxBudget) {
    return { allowed: false, reason: "maxBudget" };
  }

  return { allowed: true };
}
