"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type TaskLifecyclePanelProps = {
  taskId: string | null;
};

type InspectionResult = {
  taskId: string;
  graph: {
    status: string;
    nodes: Record<string, { state: string; role: string }>;
  } | null;
  latestClose: {
    type: string;
    payload: Record<string, unknown>;
  } | null;
  latestAsync: {
    type: string;
    payload: Record<string, unknown>;
  } | null;
  eventCount: number;
};

export function TaskLifecyclePanel({ taskId }: TaskLifecyclePanelProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!taskId) {
      setInspection(null);
      return;
    }

    startTransition(() => {
      void inspectTask(taskId)
        .then((result) => {
          setInspection(result);
          setError("");
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : String(cause));
        });
    });
  }, [taskId]);

  return (
    <div className="border-b border-white/10 bg-neutral-950/80 px-4 py-3 text-sm text-white">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Start a new task from dashboard"
          className="min-w-[320px] flex-1 rounded border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
        />
        <button
          type="button"
          disabled={isPending || draft.trim().length === 0}
          onClick={() => {
            startTransition(() => {
              void startTask(draft)
                .then((result) => {
                  setDraft("");
                  router.push(`/dashboard?taskId=${result.taskId}&token=valid-session`);
                })
                .catch((cause) => {
                  setError(cause instanceof Error ? cause.message : String(cause));
                });
            });
          }}
          className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          Start Task
        </button>
        <button
          type="button"
          disabled={!taskId || isPending}
          onClick={() => {
            if (!taskId) return;
            startTransition(() => {
              void inspectTask(taskId)
                .then((result) => {
                  setInspection(result);
                  setError("");
                })
                .catch((cause) => {
                  setError(cause instanceof Error ? cause.message : String(cause));
                });
            });
          }}
          className="rounded border border-white/10 px-3 py-2 font-medium text-white transition hover:bg-white/5 disabled:opacity-50"
        >
          Refresh
        </button>
        <button
          type="button"
          disabled={!taskId || isPending}
          onClick={() => {
            if (!taskId) return;
            startTransition(() => {
              void resumeTask(taskId)
                .then((result) => {
                  router.push(`/dashboard?taskId=${result.taskId}&token=valid-session`);
                })
                .catch((cause) => {
                  setError(cause instanceof Error ? cause.message : String(cause));
                });
            });
          }}
          className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
        >
          Resume
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
        {inspection?.graph ? <span className="font-mono">graph_status={inspection.graph.status}</span> : null}
        {inspection ? <span className="font-mono">events={inspection.eventCount}</span> : null}
        {inspection?.graph ? (
          <span className="font-mono">nodes={Object.keys(inspection.graph.nodes).length}</span>
        ) : null}
        {inspection?.latestClose ? (
          <span className="font-mono">last_close={String(inspection.latestClose.payload.state ?? "unknown")}</span>
        ) : null}
        {inspection?.latestAsync ? (
          <span className="font-mono">
            last_async=
            {inspection.latestAsync.type === "AsyncTaskFailed"
              ? String(inspection.latestAsync.payload.error ?? "failed")
              : String(inspection.latestAsync.payload.final_state ?? "unknown")}
          </span>
        ) : null}
        {inspection?.latestAsync && inspection.latestAsync.type !== "AsyncTaskFailed" ? (
          <span className="font-mono">
            async_result=
            {String(
              (inspection.latestAsync.payload.final_result as string)
              ?? ((inspection.latestAsync.payload.delivery as Record<string, unknown> | undefined)?.final_result ?? "")
            ).slice(0, 80)}
          </span>
        ) : null}
        {error ? <span className="text-rose-300">error={error}</span> : null}
      </div>
    </div>
  );
}

async function startTask(input: string) {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ input })
  });

  if (!response.ok) {
    throw new Error(`start_task_failed:${response.status}`);
  }

  return response.json() as Promise<{ taskId: string }>;
}

async function inspectTask(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}`);
  if (!response.ok) {
    throw new Error(`inspect_task_failed:${response.status}`);
  }
  return response.json() as Promise<InspectionResult>;
}

async function resumeTask(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/resume`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`resume_task_failed:${response.status}`);
  }
  return response.json() as Promise<{ taskId: string }>;
}
