"use client";

type ConnectionBannerProps = {
  taskId: string | null;
  status: "connecting" | "connected" | "disconnected" | "error";
  details: {
    url: string;
    readyState: string;
    lastError: string;
    lastCloseCode: number | null;
    lastCloseReason: string;
    lastEventAt: string | null;
    lastEventType: string;
    lastNodeId: string;
    lastOwnerId: string;
    lastDedupeKey: string;
    lastRole: string;
    lastModel: string;
    lastTool: string;
    lastDecision: string;
    lastLatencyMs: number | null;
    lastTotalTokens: number | null;
    currentPath: string;
    finalResult: string;
    blockingReason: string;
  };
  onReconnect: () => void;
};

export function ConnectionBanner({ taskId, status, details, onReconnect }: ConnectionBannerProps) {
  const tone = getTone(status);
  const statusLabel = getStatusLabel(status);

  return (
    <div className={`border-b px-4 py-3 text-sm ${tone.wrapper}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 font-semibold tracking-wide ${tone.badge}`}>{statusLabel}</span>
        <span className="font-mono text-xs text-neutral-300">task={taskId ?? "n/a"}</span>
        <span className="font-mono text-xs text-neutral-400">state={details.readyState}</span>
        {details.lastEventAt ? <span className="font-mono text-xs text-neutral-400">last_event={details.lastEventAt}</span> : null}
        <button
          type="button"
          onClick={onReconnect}
          disabled={!taskId || status === "connecting"}
          className="rounded border border-white/15 px-3 py-1 font-medium text-white transition hover:border-white/30 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reconnect
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs text-neutral-400">
        <span className="font-mono break-all">url={details.url || "n/a"}</span>
        {details.currentPath ? <span className="font-mono break-all">path={details.currentPath}</span> : null}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {details.lastEventType ? <span className="font-mono">event={details.lastEventType}</span> : null}
          {details.lastNodeId ? <span className="font-mono">node={details.lastNodeId}</span> : null}
          {details.lastOwnerId ? <span className="font-mono">owner={details.lastOwnerId}</span> : null}
          {details.lastDedupeKey ? <span className="font-mono break-all">dedupe={details.lastDedupeKey}</span> : null}
          {details.lastRole ? <span className="font-mono">role={details.lastRole}</span> : null}
          {details.lastModel ? <span className="font-mono break-all">model={details.lastModel}</span> : null}
          {details.lastTool ? <span className="font-mono">tool={details.lastTool}</span> : null}
          {details.lastDecision ? <span className="font-mono">decision={details.lastDecision}</span> : null}
          {details.lastLatencyMs !== null ? <span className="font-mono">latency={details.lastLatencyMs}ms</span> : null}
          {details.lastTotalTokens !== null ? <span className="font-mono">tokens={details.lastTotalTokens}</span> : null}
        </div>
        {details.lastError ? <span className="text-amber-300">error={details.lastError}</span> : null}
        {details.finalResult ? <span className="text-emerald-300 break-all">result={details.finalResult}</span> : null}
        {details.blockingReason ? <span className="text-rose-300">blocking_reason={details.blockingReason}</span> : null}
        {details.lastCloseCode !== null ? (
          <span>
            close={details.lastCloseCode} {details.lastCloseReason ? `reason=${details.lastCloseReason}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function getStatusLabel(status: ConnectionBannerProps["status"]) {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "error":
      return "Error";
    default:
      return "Disconnected";
  }
}

function getTone(status: ConnectionBannerProps["status"]) {
  switch (status) {
    case "connected":
      return {
        wrapper: "border-emerald-500/30 bg-emerald-950/40 text-white",
        badge: "bg-emerald-500/15 text-emerald-300"
      };
    case "connecting":
      return {
        wrapper: "border-amber-500/30 bg-amber-950/30 text-white",
        badge: "bg-amber-500/15 text-amber-300"
      };
    case "error":
      return {
        wrapper: "border-rose-500/30 bg-rose-950/35 text-white",
        badge: "bg-rose-500/15 text-rose-300"
      };
    default:
      return {
        wrapper: "border-neutral-700 bg-neutral-950 text-white",
        badge: "bg-neutral-800 text-neutral-300"
      };
  }
}
