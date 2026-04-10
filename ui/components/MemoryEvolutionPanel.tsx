"use client";

type MemoryEvolutionPanelProps = {
  evolution: {
    statusCounts: {
      active: number;
      stale: number;
      superseded: number;
      archived: number;
      forgotten: number;
    };
    timeline: string[];
  } | null;
};

export function MemoryEvolutionPanel({ evolution }: MemoryEvolutionPanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Memory Evolution</div>
      {!evolution ? (
        <div className="text-xs text-neutral-500">No evolution data yet.</div>
      ) : (
        <div className="space-y-2 text-xs text-neutral-200">
          <div className="text-neutral-300">
            {`active=${evolution.statusCounts.active} stale=${evolution.statusCounts.stale} superseded=${evolution.statusCounts.superseded} archived=${evolution.statusCounts.archived} forgotten=${evolution.statusCounts.forgotten}`}
          </div>
          {evolution.timeline.length > 0 ? (
            <div className="space-y-1">
              {evolution.timeline.map((entry, index) => (
                <div key={`${entry}-${index}`}>{entry}</div>
              ))}
            </div>
          ) : (
            <div className="text-neutral-500">No timeline entries yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
