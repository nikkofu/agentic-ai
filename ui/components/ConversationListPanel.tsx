"use client";

type ConversationThreadListItem = {
  threadId: string;
  assistantId: string;
  assistantDisplayName?: string;
  status: string;
  activeTaskId?: string;
  lastInteractionAt: string;
  latestEventDirection?: string;
  latestEventSummary?: string;
  latestEventAt?: string;
};

type ConversationListPanelProps = {
  data: {
    assistants: Array<{
      assistantId: string;
      displayName: string;
      personaProfile?: string;
      channelConnectionState?: string;
    }>;
    threads: ConversationThreadListItem[];
  } | null;
  onSelectTask?: (taskId: string) => void;
  onResumeTask?: (taskId: string) => void;
  filter?: "all" | "active" | "running" | "blocked" | "awaiting_user_input";
};

export function getVisibleThreads(
  threads: ConversationThreadListItem[],
  filter: "all" | "active" | "running" | "blocked" | "awaiting_user_input"
): ConversationThreadListItem[] {
  if (filter === "all") return threads;
  if (filter === "active") {
    return threads.filter((thread) =>
      Boolean(thread.activeTaskId) || thread.status === "task_running" || thread.status === "awaiting_user_input"
    );
  }
  if (filter === "running") {
    return threads.filter((thread) => thread.status === "task_running");
  }
  if (filter === "blocked") {
    return threads.filter((thread) => thread.status === "task_blocked");
  }
  return threads.filter((thread) => thread.status === "awaiting_user_input");
}

export function ConversationListPanel({ data, onSelectTask, onResumeTask, filter = "all" }: ConversationListPanelProps) {
  const visibleThreads = getVisibleThreads(data?.threads ?? [], filter);

  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Control Center</div>
      {!data || visibleThreads.length === 0 ? (
        <div className="text-xs text-neutral-500">No persistent threads yet.</div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-neutral-400">
            assistants={data.assistants.length} threads={visibleThreads.length}
          </div>
          {filter !== "all" ? (
            <div className="text-[11px] text-neutral-500">filter={filter}</div>
          ) : null}
          <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500">
            {data.assistants.map((assistant) => (
              <span key={assistant.assistantId} className="rounded border border-white/10 px-2 py-1">
                {assistant.displayName} ({assistant.assistantId})
                {assistant.personaProfile ? ` · ${assistant.personaProfile}` : ""}
                {assistant.channelConnectionState ? ` · whatsapp=${assistant.channelConnectionState}` : ""}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {visibleThreads.map((thread) => (
              <div
                key={thread.threadId}
                className="rounded border border-white/10 bg-black/40 px-3 py-2 text-left transition hover:border-white/20 hover:bg-black/60"
              >
                <div className="font-mono text-[11px] text-white break-all">{thread.threadId}</div>
                <div className="mt-1 text-[11px] text-neutral-400">
                  assistant={thread.assistantDisplayName ?? thread.assistantId} status={thread.status}
                </div>
                {thread.activeTaskId ? (
                  <div className="mt-1 font-mono text-[11px] text-sky-200 break-all">open task={thread.activeTaskId}</div>
                ) : null}
                {thread.latestEventSummary ? (
                  <div className="mt-1 text-[11px] text-neutral-300">
                    {thread.latestEventDirection ? `${thread.latestEventDirection}: ` : ""}
                    {thread.latestEventSummary}
                  </div>
                ) : null}
                {thread.latestEventAt ? (
                  <div className="mt-1 text-[11px] text-neutral-500">event={thread.latestEventAt}</div>
                ) : null}
                <div className="mt-1 text-[11px] text-neutral-500">last={thread.lastInteractionAt}</div>
                {thread.activeTaskId ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectTask?.(thread.activeTaskId!)}
                      className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-sky-200 transition hover:bg-sky-500/20"
                    >
                      inspect
                    </button>
                    {thread.status === "task_blocked" ? (
                      <button
                        type="button"
                        onClick={() => onResumeTask?.(thread.activeTaskId!)}
                        className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200 transition hover:bg-amber-500/20"
                      >
                        resume
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
