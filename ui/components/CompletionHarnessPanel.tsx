"use client";

type CompletionHarnessPanelProps = {
  completion: {
    latestRecord: {
      taskId: string;
      family: string;
      acceptanceDecision: string;
      successfulCompletion: boolean;
    } | null;
    families: Array<{
      family: string;
      totalRuns: number;
      successfulRuns: number;
      acceptedRuns: number;
      blockedRuns: number;
      completionRate: number;
      acceptanceRate: number;
    }>;
    releaseGate: {
      ready: boolean;
      requiredFamilies: string[];
      reasons: string[];
    };
  } | null;
};

export function CompletionHarnessPanel({ completion }: CompletionHarnessPanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Completion Harness</div>
      {!completion ? (
        <div className="text-xs text-neutral-500">No completion evidence yet.</div>
      ) : (
        <div className="space-y-2 text-xs text-neutral-200">
          <div>{completion.releaseGate.ready ? "release ready" : "release blocked"}</div>
          {completion.latestRecord ? (
            <div className="text-neutral-300">
              {`${completion.latestRecord.family} / ${completion.latestRecord.acceptanceDecision} / ${completion.latestRecord.successfulCompletion ? "counted" : "not_counted"}`}
            </div>
          ) : null}
          {completion.families.map((family) => (
            <div key={family.family} className="rounded border border-white/10 px-2 py-2">
              <div>{family.family}</div>
              <div className="mt-1 text-neutral-400">
                {`completion=${Math.round(family.completionRate * 100)}% acceptance=${Math.round(family.acceptanceRate * 100)}% blocked=${family.blockedRuns}`}
              </div>
            </div>
          ))}
          {completion.releaseGate.reasons.length > 0 ? (
            <div className="text-neutral-400">{completion.releaseGate.reasons.join(" | ")}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
