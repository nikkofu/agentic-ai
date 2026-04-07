export type SpawnGuardrailInput = {
  currentDepth: number;
  childrenCount: number;
  totalSteps: number;
  spentBudget: number;
};

export type SpawnGuardrailLimits = {
  max_depth: number;
  max_branch: number;
  max_steps: number;
  max_budget: number;
};

export type SpawnGuardrailResult =
  | { allowed: true }
  | { allowed: false; reason: "max_depth" | "max_branch" | "max_steps" | "max_budget" };

export function checkSpawnGuardrails(input: SpawnGuardrailInput, limits: SpawnGuardrailLimits): SpawnGuardrailResult {
  if (input.currentDepth >= limits.max_depth) {
    return { allowed: false, reason: "max_depth" };
  }

  if (input.childrenCount >= limits.max_branch) {
    return { allowed: false, reason: "max_branch" };
  }

  if (input.totalSteps >= limits.max_steps) {
    return { allowed: false, reason: "max_steps" };
  }

  if (input.spentBudget >= limits.max_budget) {
    return { allowed: false, reason: "max_budget" };
  }

  return { allowed: true };
}
