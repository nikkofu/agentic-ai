import type { EvalDecision } from "../types/runtime";

type EvaluatorInput = {
  quality: number;
  cost: number;
  latency: number;
  consecutiveRevises: number;
  qualityDelta: number;
  guardrailTripped: boolean;
  unrecoverableToolError: boolean;
};

type EvaluatorWeights = {
  quality: number;
  cost: number;
  latency: number;
};

export function evaluateDecision(input: EvaluatorInput, weights: EvaluatorWeights): EvalDecision {
  if (input.guardrailTripped) {
    return {
      decision: "block",
      reason: "guardrail_tripped",
      scores: computeScores(input, weights)
    };
  }

  if (input.unrecoverableToolError) {
    return {
      decision: "block",
      reason: "unrecoverable_tool_error",
      scores: computeScores(input, weights)
    };
  }

  if (input.consecutiveRevises >= 2 && input.qualityDelta < 0.05) {
    return {
      decision: "block",
      reason: "revise_without_improvement",
      scores: computeScores(input, weights)
    };
  }

  const scores = computeScores(input, weights);

  if (scores.total >= 0.75) {
    return { decision: "deliver", reason: "threshold_deliver", scores };
  }

  if (scores.total >= 0.55) {
    return { decision: "revise", reason: "threshold_revise", scores };
  }

  return { decision: "block", reason: "threshold_block", scores };
}

function computeScores(input: Pick<EvaluatorInput, "quality" | "cost" | "latency">, weights: EvaluatorWeights) {
  const total = input.quality * weights.quality + input.cost * weights.cost + input.latency * weights.latency;

  return {
    quality: input.quality,
    cost: input.cost,
    latency: input.latency,
    total
  };
}
