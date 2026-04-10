"use client";

import { DeliveryEconomicsPanel } from "./DeliveryEconomicsPanel";
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
        <RiskInterventionPanel risk={snapshot.risk} humanLoad={snapshot.humanLoad} />
      </div>

      <div className="mt-3 rounded border border-white/10 bg-white/5 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Objective Signals</div>
        {snapshot.objectives.length === 0 ? (
          <div className="text-xs text-neutral-500">No objective summaries yet.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.objectives.map((objective) => (
              <div key={objective.id} className="rounded border border-white/10 px-2 py-2 text-xs text-neutral-200">
                <div className="font-medium text-white">{objective.label}</div>
                <div>{`acceptance ${Math.round(objective.acceptanceRate * 100)}%`}</div>
                <div>{`completion ${Math.round(objective.completionRate * 100)}%`}</div>
                <div>{`runs ${objective.totalRuns}`}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
