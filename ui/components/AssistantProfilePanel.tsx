"use client";

type AssistantProfilePanelProps = {
  assistants: Array<{
    assistantId: string;
    displayName: string;
    personaProfile?: string;
  }>;
  threadCount: number;
  activeThreadCount: number;
};

export function AssistantProfilePanel({ assistants, threadCount, activeThreadCount }: AssistantProfilePanelProps) {
  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Assistant</div>
      {assistants.length === 0 ? (
        <div className="text-xs text-neutral-500">No assistant profiles yet.</div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-neutral-400">threads={threadCount} active={activeThreadCount}</div>
          <div className="space-y-2">
            {assistants.map((assistant) => (
              <div key={assistant.assistantId} className="rounded border border-white/10 px-3 py-2">
                <div className="text-sm text-white">{assistant.displayName}</div>
                <div className="mt-1 font-mono text-[11px] text-neutral-400">{assistant.assistantId}</div>
                {assistant.personaProfile ? (
                  <div className="mt-1 text-[11px] text-neutral-300">{assistant.personaProfile}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
