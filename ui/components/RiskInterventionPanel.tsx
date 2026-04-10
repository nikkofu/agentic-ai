"use client";

type RiskInterventionPanelProps = {
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
};

export function RiskInterventionPanel({ risk, humanLoad, queue }: RiskInterventionPanelProps) {
  return (
    <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">Blocked Risk</div>
      <div className="space-y-1 text-sm text-amber-50">
        <div>{`blocked ${Math.round(risk.blockedRate * 100)}%`}</div>
        <div>{`human intervention ${Math.round(humanLoad.interventionRate * 100)}%`}</div>
        <div>{`interventions ${humanLoad.totalInterventions}`}</div>
        <div>{`pending approvals ${queue.pendingApprovals}`}</div>
        <div>{`pending clarifications ${queue.pendingClarifications}`}</div>
      </div>
    </div>
  );
}
