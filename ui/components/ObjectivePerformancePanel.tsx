"use client";

type ObjectivePerformancePanelProps = {
  objectives: Array<{
    id: string;
    label: string;
    family: string;
    completionRate: number;
    acceptanceRate: number;
    totalRuns: number;
    blockedRuns: number;
  }>;
};

export function ObjectivePerformancePanel({ objectives }: ObjectivePerformancePanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Objective Performance</div>
      {objectives.length === 0 ? (
        <div className="text-xs text-neutral-500">No objective summaries yet.</div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {objectives.map((objective) => (
            <div key={objective.id} className="rounded border border-white/10 px-2 py-2 text-xs text-neutral-200">
              <div className="font-medium text-white">{objective.label}</div>
              <div>{`completion ${Math.round(objective.completionRate * 100)}%`}</div>
              <div>{`acceptance ${Math.round(objective.acceptanceRate * 100)}%`}</div>
              <div>{`runs ${objective.totalRuns}`}</div>
              <div>{`blocked ${objective.blockedRuns}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
