export type CompanionshipSnapshot = {
  threadId: string;
  continuitySummary: string;
  unresolvedTopics: string[];
  followUpSuggestion: string;
  preferenceNotes: string[];
  lastMeaningfulInteractionAt?: string;
};

export function buildCompanionshipSnapshot(input: {
  threadId: string;
  threadStatus: string;
  activeTaskId?: string;
  recentEvents: Array<{
    direction?: string;
    summary?: string;
  }>;
  memoryLatest?: string[];
  lastMeaningfulInteractionAt?: string;
}): CompanionshipSnapshot {
  const joinedSummaries = input.recentEvents
    .map((event) => event.summary?.trim() ?? "")
    .filter((summary) => summary.length > 0);

  const preferenceNotes = [
    ...new Set([
      ...(input.memoryLatest ?? []),
      ...joinedSummaries.filter((summary) => /先给我结论|先看结论|先给结论/.test(summary))
    ])
  ];

  const unresolvedTopics = input.threadStatus === "task_blocked" || input.threadStatus === "awaiting_user_input"
    ? [`当前线程仍有待完成事项，状态为 ${input.threadStatus}。`]
    : [];

  const followUpSuggestion = input.threadStatus === "task_blocked" || input.threadStatus === "awaiting_user_input"
    ? "下一次继续时，优先确认是否要继续推进当前任务。"
    : "下一次继续时，可以从当前 thread 的上下文自然衔接。";

  return {
    threadId: input.threadId,
    continuitySummary: `这个 thread 仍然围绕当前任务连续存在，当前状态是 ${input.threadStatus}${input.activeTaskId ? `，active task=${input.activeTaskId}` : ""}。`,
    unresolvedTopics,
    followUpSuggestion,
    preferenceNotes,
    lastMeaningfulInteractionAt: input.lastMeaningfulInteractionAt
  };
}
