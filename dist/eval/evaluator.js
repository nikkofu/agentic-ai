export function evaluateDecision(input, weights) {
    if (input.guardrailTripped) {
        return {
            decision: "escalate",
            reason: "guardrail_tripped",
            scores: computeScores(input, weights)
        };
    }
    if (input.unrecoverableToolError) {
        return {
            decision: "escalate",
            reason: "unrecoverable_tool_error",
            scores: computeScores(input, weights)
        };
    }
    if (input.consecutiveRevises >= 2 && input.qualityDelta < 0.05) {
        return {
            decision: "escalate",
            reason: "revise_without_improvement",
            scores: computeScores(input, weights)
        };
    }
    const scores = computeScores(input, weights);
    if (scores.total >= 0.75) {
        return { decision: "continue", reason: "threshold_continue", scores };
    }
    if (scores.total >= 0.55) {
        return { decision: "revise", reason: "threshold_revise", scores };
    }
    return { decision: "stop", reason: "threshold_stop", scores };
}
function computeScores(input, weights) {
    const total = input.quality * weights.quality + input.cost * weights.cost + input.latency * weights.latency;
    return {
        quality: input.quality,
        cost: input.cost,
        latency: input.latency,
        total
    };
}
