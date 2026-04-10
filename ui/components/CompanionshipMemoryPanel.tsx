"use client";

type CompanionshipMemoryPanelProps = {
  companionship: {
    continuitySummary: string;
    unresolvedTopics: string[];
    followUpSuggestion: string;
    preferenceNotes: string[];
  } | null;
};

export function CompanionshipMemoryPanel({ companionship }: CompanionshipMemoryPanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Companionship Memory</div>
      {!companionship ? (
        <div className="text-xs text-neutral-500">No companionship memory yet.</div>
      ) : (
        <div className="space-y-2 text-xs text-neutral-200">
          <div>{companionship.continuitySummary}</div>
          {companionship.unresolvedTopics.length > 0 ? (
            <div>{companionship.unresolvedTopics.join(" ")}</div>
          ) : null}
          {companionship.followUpSuggestion ? <div>{companionship.followUpSuggestion}</div> : null}
          {companionship.preferenceNotes.length > 0 ? (
            <div className="text-neutral-300">{companionship.preferenceNotes.join(" ")}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
