"use client";

type SkillCandidatePanelProps = {
  candidates: Array<{
    id: string;
    summary: string;
    confidence: string;
    status: string;
  }>;
};

export function SkillCandidatePanel({ candidates }: SkillCandidatePanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Skill Candidates</div>
      {candidates.length === 0 ? (
        <div className="text-xs text-neutral-500">No skill candidates yet.</div>
      ) : (
        <div className="space-y-2 text-xs text-neutral-200">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="rounded border border-white/10 px-2 py-2">
              <div>{candidate.summary}</div>
              <div className="mt-1 text-neutral-400">{`${candidate.confidence}/${candidate.status}`}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
