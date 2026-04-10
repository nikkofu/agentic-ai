"use client";

type ThreadDetailPanelProps = {
  detail: {
    taskId: string;
    graphStatus: string;
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
        <DetailLine label="external user" value={detail.conversation.externalUserId} />
        <DetailLine label="human action" value={humanReason} />
        <DetailLine label="latest node" value={latestNodeId} />
        <DetailLine label="latest owner" value={latestOwnerId} />
      </div>
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
