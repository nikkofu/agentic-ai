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
  trust: {
    evidenceBackedCompletionRate: number;
  };
};

export function buildOperatorIntelligenceSnapshot(input: {
  tasks: OperatorIntelligenceTaskInput[];
}): OperatorIntelligenceSnapshot {
  const totalRuns = input.tasks.length;
  const completedRuns = input.tasks.filter((task) => task.finalState === "completed").length;
  const acceptedRuns = input.tasks.filter((task) => task.acceptanceDecision === "accept").length;
  const blockedRuns = input.tasks.filter((task) => task.blocked).length;
  const totalCostUsd = input.tasks.reduce((sum, task) => sum + task.totalCostUsd, 0);

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
    trust: {
      evidenceBackedCompletionRate: totalRuns === 0 ? 0 : acceptedRuns / totalRuns
    }
  };
}
