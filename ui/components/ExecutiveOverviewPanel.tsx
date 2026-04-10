"use client";

import { DeliveryEconomicsPanel } from "./DeliveryEconomicsPanel";
import { ObjectivePerformancePanel } from "./ObjectivePerformancePanel";
import { OutcomeHealthPanel } from "./OutcomeHealthPanel";
import { RiskInterventionPanel } from "./RiskInterventionPanel";

type ExecutiveOverviewPanelProps = {
  snapshot: {
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
    objectives: Array<{
      id: string;
      label: string;
      family: string;
      completionRate: number;
      acceptanceRate: number;
      totalRuns: number;
      blockedRuns: number;
    }>;
  } | null;
};

export function ExecutiveOverviewPanel({ snapshot }: ExecutiveOverviewPanelProps) {
  if (!snapshot) {
    return (
      <div className="rounded border border-white/10 bg-black/30 p-3 text-xs text-neutral-500">
        No executive metrics yet.
      </div>
    );
  }

  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Executive Layer</div>
          <div className="text-sm text-neutral-200">Business-facing outcome, economics, and risk overview.</div>
        </div>
        <div className={`text-xs ${snapshot.trust.releaseGateReadiness ? "text-emerald-300" : "text-amber-300"}`}>
          {snapshot.trust.releaseGateReadiness ? "release ready" : "release blocked"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <OutcomeHealthPanel outcome={snapshot.outcome} trust={snapshot.trust} />
        <DeliveryEconomicsPanel economics={snapshot.economics} />
        <RiskInterventionPanel risk={snapshot.risk} humanLoad={snapshot.humanLoad} queue={snapshot.queue} />
      </div>

      <div className="mt-3">
        <ObjectivePerformancePanel objectives={snapshot.objectives} />
      </div>
    </div>
  );
}
