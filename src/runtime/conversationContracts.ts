export const CHANNEL_TYPES = ["whatsapp"] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const CONVERSATION_THREAD_STATES = [
  "idle",
  "awaiting_task_execution",
  "task_running",
  "awaiting_user_input",
  "task_blocked",
  "task_completed",
  "handoff_pending",
  "disconnected"
] as const;

export type ConversationThreadState = (typeof CONVERSATION_THREAD_STATES)[number];

export const CHANNEL_MESSAGE_KINDS = [
  "chat",
  "new_task",
  "task_follow_up",
  "status_query",
  "resume_request",
  "approval_response",
  "clarification_response"
] as const;

export type ConversationMessageKind = (typeof CHANNEL_MESSAGE_KINDS)[number];

export type AssistantIdentity = {
  assistantId: string;
  displayName: string;
  personaProfile: string;
  memoryPolicy: string;
  channelPolicies: Partial<Record<ChannelType, string>>;
};

export type ConversationThread = {
  threadId: string;
  assistantId: string;
  userIdentityKey: string;
  status: ConversationThreadState;
  activeTaskId?: string;
  lastInteractionAt: string;
  continuityState: string;
  memoryRefs: string[];
};

export type ChannelSessionLink = {
  linkId: string;
  threadId: string;
  assistantId: string;
  channelType: ChannelType;
  externalUserId: string;
  externalChatId: string;
  lastSeenAt: string;
  connectionState: string;
};

export type ConversationEvent = {
  eventId: string;
  threadId: string;
  channelType: ChannelType;
  direction: "incoming" | "outgoing" | "internal";
  kind: ConversationMessageKind;
  payload: Record<string, unknown>;
  createdAt: string;
};

export function isConversationThreadState(value: string): value is ConversationThreadState {
  return (CONVERSATION_THREAD_STATES as readonly string[]).includes(value);
}

export function isConversationMessageKind(value: string): value is ConversationMessageKind {
  return (CHANNEL_MESSAGE_KINDS as readonly string[]).includes(value);
}
