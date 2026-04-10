"use client";

type FollowUpThread = {
  threadId: string;
  assistantDisplayName?: string;
  status: string;
  latestEventSummary?: string;
  activeTaskId?: string;
};

type ThreadFollowUpPanelProps = {
  threads: FollowUpThread[];
};

function getFollowUpThreads(threads: FollowUpThread[]) {
  return threads.filter((thread) =>
    thread.status === "task_completed" ||
    thread.status === "task_blocked" ||
    thread.status === "awaiting_user_input"
  );
}

export function ThreadFollowUpPanel({ threads }: ThreadFollowUpPanelProps) {
  const followUps = getFollowUpThreads(threads);

  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Follow Up</div>
      {followUps.length === 0 ? (
        <div className="text-xs text-neutral-500">No follow-up candidates right now.</div>
      ) : (
        <div className="space-y-2">
          {followUps.map((thread) => (
            <div key={thread.threadId} className="rounded border border-white/10 px-3 py-2">
              <div className="font-mono text-[11px] text-white break-all">{thread.threadId}</div>
              <div className="mt-1 text-[11px] text-neutral-400">
                assistant={thread.assistantDisplayName ?? "assistant"} status={thread.status}
              </div>
              {thread.latestEventSummary ? (
                <div className="mt-1 text-[11px] text-neutral-300">{thread.latestEventSummary}</div>
              ) : null}
              {thread.activeTaskId ? (
                <div className="mt-1 font-mono text-[11px] text-sky-200 break-all">task={thread.activeTaskId}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
