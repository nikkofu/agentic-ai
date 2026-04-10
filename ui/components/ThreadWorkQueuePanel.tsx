"use client";

type ThreadQueueItem = {
  threadId: string;
  assistantId: string;
  assistantDisplayName?: string;
  status: string;
  activeTaskId?: string;
  latestHumanActionNodeId?: string;
  lastInteractionAt: string;
  latestEventSummary?: string;
};

type ThreadWorkQueuePanelProps = {
  threads: ThreadQueueItem[];
  onInspectTask?: (taskId: string) => void;
  onResumeTask?: (taskId: string) => void;
  onResolveHumanAction?: (taskId: string, nodeId: string, action: "approve" | "reject" | "clarify") => void;
};

export function getQueuedThreads(threads: ThreadQueueItem[]): ThreadQueueItem[] {
  return threads.filter((thread) =>
    thread.status === "task_running" ||
    thread.status === "task_blocked" ||
    thread.status === "awaiting_user_input"
  );
}

export function ThreadWorkQueuePanel({ threads, onInspectTask, onResumeTask, onResolveHumanAction }: ThreadWorkQueuePanelProps) {
  const queuedThreads = getQueuedThreads(threads);

  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Work Queue</div>
      {queuedThreads.length === 0 ? (
        <div className="text-xs text-neutral-500">No queued threads right now.</div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-neutral-400">{queuedThreads.length} items</div>
          <div className="space-y-2">
            {queuedThreads.map((thread) => (
              <div key={thread.threadId} className="rounded border border-white/10 px-3 py-2">
                <div className="font-mono text-[11px] text-white break-all">{thread.threadId}</div>
                <div className="mt-1 text-[11px] text-neutral-400">
                  assistant={thread.assistantDisplayName ?? thread.assistantId} status={thread.status}
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  {describeQueueAction(thread.status)}
                </div>
                {thread.latestEventSummary ? (
                  <div className="mt-1 text-[11px] text-neutral-300">{thread.latestEventSummary}</div>
                ) : null}
                {thread.activeTaskId ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectTask?.(thread.activeTaskId!)}
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
                    {thread.status === "awaiting_user_input" && thread.latestHumanActionNodeId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onResolveHumanAction?.(thread.activeTaskId!, thread.latestHumanActionNodeId!, "approve")}
                          className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolveHumanAction?.(thread.activeTaskId!, thread.latestHumanActionNodeId!, "reject")}
                          className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-rose-200 transition hover:bg-rose-500/20"
                        >
                          reject
                        </button>
                        <button
                          type="button"
                          onClick={() => onResolveHumanAction?.(thread.activeTaskId!, thread.latestHumanActionNodeId!, "clarify")}
                          className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-violet-200 transition hover:bg-violet-500/20"
                        >
                          clarify
                        </button>
                      </>
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

function describeQueueAction(status: string) {
  if (status === "task_blocked") {
    return "can resume";
  }

  if (status === "awaiting_user_input") {
    return "needs intervention";
  }

  return "in progress";
}
