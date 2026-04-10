"use client";

type ThreadDetailPanelProps = {
  detail: {
    taskId: string;
    graphStatus: string;
    channelConnectionState?: string;
    latestEventSummary?: string;
    latestEventAt?: string;
    verifierSummary?: string;
    recentEvents?: Array<{
      direction?: string;
      summary?: string;
      createdAt?: string;
    }>;
    conversation: {
      assistantId: string;
      threadId: string;
      threadStatus: string;
      channelType: string;
      externalUserId: string;
    } | null;
    latestHumanAction: {
      type: string;
      payload: Record<string, unknown>;
    } | null;
    latestAsyncNode: {
      type: string;
      payload: Record<string, unknown>;
    } | null;
  } | null;
};

export function ThreadDetailPanel({ detail }: ThreadDetailPanelProps) {
  if (!detail?.conversation) {
    return (
      <div className="rounded border border-white/10 bg-black/30 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Thread Detail</div>
        <div className="text-xs text-neutral-500">No thread selected yet.</div>
      </div>
    );
  }

  const humanReason = typeof detail.latestHumanAction?.payload.reason === "string"
    ? detail.latestHumanAction.payload.reason
    : "";
  const latestNodeId = typeof detail.latestAsyncNode?.payload.node_id === "string"
    ? detail.latestAsyncNode.payload.node_id
    : "";
  const latestOwnerId = typeof detail.latestAsyncNode?.payload.owner_id === "string"
    ? detail.latestAsyncNode.payload.owner_id
    : "";
  const recentEvents = detail.recentEvents?.filter((event) => event.summary) ?? [];

  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Thread Detail</div>
      <div className="space-y-1">
        <DetailLine label="thread" value={detail.conversation.threadId} />
        <DetailLine label="assistant" value={detail.conversation.assistantId} />
        <DetailLine label="task" value={detail.taskId} />
        <DetailLine label="graph" value={detail.graphStatus} />
        <DetailLine label="status" value={detail.conversation.threadStatus} />
        <DetailLine label="channel" value={detail.conversation.channelType} />
        <DetailLine label="connection" value={detail.channelConnectionState ?? ""} />
        <DetailLine label="external user" value={detail.conversation.externalUserId} />
        <DetailLine label="latest event" value={detail.latestEventSummary ?? ""} />
        <DetailLine label="event time" value={detail.latestEventAt ?? ""} />
        <DetailLine label="verifier" value={detail.verifierSummary ?? ""} />
        <DetailLine label="human action" value={humanReason} />
        <DetailLine label="latest node" value={latestNodeId} />
        <DetailLine label="latest owner" value={latestOwnerId} />
      </div>
      {recentEvents.length > 0 ? (
        <div className="mt-3 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">recent events</div>
          {recentEvents.map((event, index) => (
            <div key={`${event.createdAt ?? "event"}-${index}`} className="rounded border border-white/10 bg-black/30 px-2 py-1">
              <div className="text-[10px] text-neutral-500">
                {event.direction ? `${event.direction} · ` : ""}{event.createdAt ?? ""}
              </div>
              <div className="mt-1 text-[11px] text-neutral-200">{event.summary}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailLine(props: { label: string; value: string }) {
  if (!props.value) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">{props.label}</span>
      <span className="font-mono text-[11px] break-all text-neutral-200">{props.value}</span>
    </div>
  );
}
