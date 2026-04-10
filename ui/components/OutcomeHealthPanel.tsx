"use client";

type OutcomeHealthPanelProps = {
  outcome: {
    completionRate: number;
    acceptanceRate: number;
  };
  trust: {
    evidenceBackedCompletionRate: number;
    releaseGateReadiness: boolean;
  };
};

export function OutcomeHealthPanel({ outcome, trust }: OutcomeHealthPanelProps) {
  return (
    <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Accepted Outcomes</div>
      <div className="space-y-1 text-sm text-emerald-50">
        <div>{`completion ${Math.round(outcome.completionRate * 100)}%`}</div>
        <div>{`acceptance ${Math.round(outcome.acceptanceRate * 100)}%`}</div>
        <div>{`evidence-backed ${Math.round(trust.evidenceBackedCompletionRate * 100)}%`}</div>
        <div>{trust.releaseGateReadiness ? "release ready" : "release blocked"}</div>
      </div>
    </div>
  );
}
