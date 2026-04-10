"use client";

type CompanionshipPanelProps = {
  continuitySummary: string;
  followUpSuggestion: string;
  presenceNote: string;
};

export function CompanionshipPanel({
  continuitySummary,
  followUpSuggestion,
  presenceNote,
}: CompanionshipPanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Companionship</div>
      <div className="space-y-2 text-xs text-neutral-200">
        {continuitySummary ? <div>{continuitySummary}</div> : null}
        {followUpSuggestion ? <div>{followUpSuggestion}</div> : null}
        {presenceNote ? <div className="text-neutral-300">{presenceNote}</div> : null}
      </div>
    </div>
  );
}
