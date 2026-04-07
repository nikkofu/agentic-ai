export function checkSpawnGuardrails(input, limits) {
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
