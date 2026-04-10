type ConversationPanelProps = {
  inspection: {
    assistantId: string;
    threadId: string;
    threadStatus: string;
    channelType: string;
    externalUserId: string;
  } | null;
};

export function ConversationPanel({ inspection }: ConversationPanelProps) {
  if (!inspection) {
    return (
      <div className="rounded border border-white/10 bg-black/30 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Conversation</div>
        <div className="text-xs text-neutral-500">No conversation thread linked yet.</div>
      </div>
    );
  }

  return (
    <div className="rounded border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Conversation</div>
      <div className="space-y-1">
        <ConversationLine label="assistant" value={inspection.assistantId} />
        <ConversationLine label="thread" value={inspection.threadId} />
        <ConversationLine label="thread status" value={inspection.threadStatus} />
        <ConversationLine label="channel" value={inspection.channelType} />
        <ConversationLine label="external user" value={inspection.externalUserId} />
      </div>
    </div>
  );
}

function ConversationLine(props: { label: string; value: string }) {
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
