import type {
  AssistantIdentity,
  ChannelSessionLink,
  ChannelType,
  ConversationEvent,
  ConversationThread,
  ConversationThreadState
} from "./conversationContracts";

export type ConversationThreadInput = Omit<ConversationThread, "activeTaskId"> & {
  activeTaskId?: string;
};

export type ChannelIdentityLookup = {
  channelType: ChannelType;
  externalUserId: string;
  externalChatId: string;
};

export interface ConversationStore {
  saveAssistantProfile(profile: AssistantIdentity): Promise<void>;
  listAssistantProfiles(): Promise<AssistantIdentity[]>;
  createThread(thread: ConversationThreadInput): Promise<ConversationThread>;
  updateThread(threadId: string, patch: Partial<{
    status: ConversationThreadState;
    activeTaskId?: string;
    lastInteractionAt: string;
    continuityState: string;
    memoryRefs: string[];
  }>): Promise<void>;
  getThread(threadId: string): Promise<ConversationThread | null>;
  saveChannelSessionLink(link: ChannelSessionLink): Promise<void>;
  findThreadByChannelIdentity(identity: ChannelIdentityLookup): Promise<ConversationThread | null>;
  listThreads(): Promise<ConversationThread[]>;
  appendConversationEvent(event: ConversationEvent): Promise<void>;
  getConversationEvents(threadId: string): Promise<ConversationEvent[]>;
  getLatestConversationEvent(threadId: string): Promise<ConversationEvent | null>;
}

export function createInMemoryConversationStore(): ConversationStore {
  const assistants = new Map<string, AssistantIdentity>();
  const threads = new Map<string, ConversationThread>();
  const links = new Map<string, ChannelSessionLink>();
  const events = new Map<string, ConversationEvent[]>();

  function toLinkKey(identity: ChannelIdentityLookup): string {
    return `${identity.channelType}:${identity.externalUserId}:${identity.externalChatId}`;
  }

  return {
    async saveAssistantProfile(profile) {
      assistants.set(profile.assistantId, { ...profile });
    },

    async listAssistantProfiles() {
      return [...assistants.values()].map((profile) => ({ ...profile }));
    },

    async createThread(thread) {
      const created: ConversationThread = { ...thread };
      threads.set(created.threadId, created);
      events.set(created.threadId, events.get(created.threadId) ?? []);
      return { ...created };
    },

    async updateThread(threadId, patch) {
      const existing = threads.get(threadId);
      if (!existing) {
        throw new Error(`Conversation thread ${threadId} not found`);
      }

      threads.set(threadId, {
        ...existing,
        ...patch
      });
    },

    async getThread(threadId) {
      const thread = threads.get(threadId);
      return thread ? { ...thread } : null;
    },

    async saveChannelSessionLink(link) {
      links.set(
        toLinkKey({
          channelType: link.channelType,
          externalUserId: link.externalUserId,
          externalChatId: link.externalChatId
        }),
        { ...link }
      );
    },

    async findThreadByChannelIdentity(identity) {
      const link = links.get(toLinkKey(identity));
      if (!link) return null;
      const thread = threads.get(link.threadId);
      return thread ? { ...thread } : null;
    },

    async listThreads() {
      return [...threads.values()]
        .map((thread) => ({ ...thread }))
        .sort((a, b) => b.lastInteractionAt.localeCompare(a.lastInteractionAt));
    },

    async appendConversationEvent(event) {
      const list = events.get(event.threadId) ?? [];
      list.push({ ...event });
      events.set(event.threadId, list);
    },

    async getConversationEvents(threadId) {
      return [...(events.get(threadId) ?? [])];
    },

    async getLatestConversationEvent(threadId) {
      const list = events.get(threadId) ?? [];
      const latest = list.at(-1);
      return latest ? { ...latest } : null;
    }
  };
}
