import type { CompletionObjectiveSummary } from "./completionHarness";

export type OperatorIntelligenceTaskInput = {
  family: string;
  finalState: "completed" | "aborted";
  deliveryStatus: string;
  acceptanceDecision: string;
  totalCostUsd: number;
  humanInterventions: number;
  blocked: boolean;
};

export type OperatorIntelligenceSnapshot = {
  outcome: {
    completionRate: number;
    acceptanceRate: number;
  };
  economics: {
    totalCostUsd: number;
    costPerAcceptedDelivery: number;
  };
  risk: {
    blockedRate: number;
  };
  humanLoad: {
    interventionRate: number;
    totalInterventions: number;
  };
  queue: {
    pendingApprovals: number;
    pendingClarifications: number;
  };
  trust: {
    evidenceBackedCompletionRate: number;
    releaseGateReadiness: boolean;
  };
  objectives: CompletionObjectiveSummary[];
};

export function buildOperatorIntelligenceSnapshot(input: {
  tasks: OperatorIntelligenceTaskInput[];
  releaseGateReady?: boolean;
  objectives?: CompletionObjectiveSummary[];
  pendingApprovals?: number;
  pendingClarifications?: number;
}): OperatorIntelligenceSnapshot {
  const totalRuns = input.tasks.length;
  const completedRuns = input.tasks.filter((task) => task.finalState === "completed").length;
  const acceptedRuns = input.tasks.filter((task) => task.acceptanceDecision === "accept").length;
  const blockedRuns = input.tasks.filter((task) => task.blocked).length;
  const totalCostUsd = input.tasks.reduce((sum, task) => sum + task.totalCostUsd, 0);
  const totalInterventions = input.tasks.reduce((sum, task) => sum + task.humanInterventions, 0);

  return {
    outcome: {
      completionRate: totalRuns === 0 ? 0 : completedRuns / totalRuns,
      acceptanceRate: totalRuns === 0 ? 0 : acceptedRuns / totalRuns
    },
    economics: {
      totalCostUsd,
      costPerAcceptedDelivery: acceptedRuns === 0 ? 0 : totalCostUsd / acceptedRuns
    },
    risk: {
      blockedRate: totalRuns === 0 ? 0 : blockedRuns / totalRuns
    },
    humanLoad: {
      interventionRate: totalRuns === 0 ? 0 : totalInterventions / totalRuns,
      totalInterventions
    },
    queue: {
      pendingApprovals: input.pendingApprovals ?? 0,
      pendingClarifications: input.pendingClarifications ?? 0
    },
    trust: {
      evidenceBackedCompletionRate: totalRuns === 0 ? 0 : acceptedRuns / totalRuns,
      releaseGateReadiness: input.releaseGateReady ?? false
    },
    objectives: input.objectives ?? []
  };
}
