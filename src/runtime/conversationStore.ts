import fs from "node:fs/promises";
import path from "node:path";

import type {
  AssistantIdentity,
  AssistantChannelState,
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
  updateAssistantChannelState(input: AssistantChannelState): Promise<void>;
  getAssistantChannelState(assistantId: string, channelType: ChannelType): Promise<AssistantChannelState | null>;
}

type ConversationStoreState = {
  assistants: AssistantIdentity[];
  channelStates: AssistantChannelState[];
  threads: ConversationThread[];
  links: ChannelSessionLink[];
  events: Record<string, ConversationEvent[]>;
};

function toLinkKey(identity: ChannelIdentityLookup): string {
  return `${identity.channelType}:${identity.externalUserId}:${identity.externalChatId}`;
}

function cloneThread(thread: ConversationThread): ConversationThread {
  return {
    ...thread,
    memoryRefs: [...thread.memoryRefs]
  };
}

function cloneProfile(profile: AssistantIdentity): AssistantIdentity {
  return {
    ...profile,
    channelPolicies: { ...profile.channelPolicies }
  };
}

function cloneChannelState(state: AssistantChannelState): AssistantChannelState {
  return { ...state };
}

function cloneLink(link: ChannelSessionLink): ChannelSessionLink {
  return { ...link };
}

function cloneEvent(event: ConversationEvent): ConversationEvent {
  return {
    ...event,
    payload: { ...event.payload }
  };
}

function createEmptyConversationState(): ConversationStoreState {
  return {
    assistants: [],
    channelStates: [],
    threads: [],
    links: [],
    events: {}
  };
}

export function createInMemoryConversationStore(): ConversationStore {
  const assistants = new Map<string, AssistantIdentity>();
  const channelStates = new Map<string, AssistantChannelState>();
  const threads = new Map<string, ConversationThread>();
  const links = new Map<string, ChannelSessionLink>();
  const events = new Map<string, ConversationEvent[]>();

  return {
    async saveAssistantProfile(profile) {
      assistants.set(profile.assistantId, cloneProfile(profile));
    },

    async listAssistantProfiles() {
      return [...assistants.values()].map(cloneProfile);
    },

    async updateAssistantChannelState(input) {
      channelStates.set(`${input.assistantId}:${input.channelType}`, cloneChannelState(input));
    },

    async getAssistantChannelState(assistantId, channelType) {
      const state = channelStates.get(`${assistantId}:${channelType}`);
      return state ? cloneChannelState(state) : null;
    },

    async createThread(thread) {
      const created: ConversationThread = cloneThread({ ...thread, memoryRefs: [...thread.memoryRefs] });
      threads.set(created.threadId, created);
      events.set(created.threadId, events.get(created.threadId) ?? []);
      return cloneThread(created);
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
      return thread ? cloneThread(thread) : null;
    },

    async saveChannelSessionLink(link) {
      links.set(
        toLinkKey({
          channelType: link.channelType,
          externalUserId: link.externalUserId,
          externalChatId: link.externalChatId
        }),
        cloneLink(link)
      );
    },

    async findThreadByChannelIdentity(identity) {
      const link = links.get(toLinkKey(identity));
      if (!link) return null;
      const thread = threads.get(link.threadId);
      return thread ? cloneThread(thread) : null;
    },

    async listThreads() {
      return [...threads.values()]
        .map(cloneThread)
        .sort((a, b) => b.lastInteractionAt.localeCompare(a.lastInteractionAt));
    },

    async appendConversationEvent(event) {
      const list = events.get(event.threadId) ?? [];
      list.push(cloneEvent(event));
      events.set(event.threadId, list);
    },

    async getConversationEvents(threadId) {
      return (events.get(threadId) ?? []).map(cloneEvent);
    },

    async getLatestConversationEvent(threadId) {
      const list = events.get(threadId) ?? [];
      const latest = list.at(-1);
      return latest ? cloneEvent(latest) : null;
    }
  };
}

export function createFileConversationStore(args: {
  rootDir: string;
  fileName?: string;
}): ConversationStore {
  const rootDir = args.rootDir;
  const filePath = path.join(rootDir, args.fileName ?? "conversation-store.json");

  const readState = async (): Promise<ConversationStoreState> => {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as ConversationStoreState;
      return {
        assistants: (parsed.assistants ?? []).map(cloneProfile),
        channelStates: (parsed.channelStates ?? []).map(cloneChannelState),
        threads: (parsed.threads ?? []).map(cloneThread),
        links: (parsed.links ?? []).map(cloneLink),
        events: Object.fromEntries(
          Object.entries(parsed.events ?? {}).map(([threadId, eventList]) => [
            threadId,
            (eventList ?? []).map(cloneEvent)
          ])
        )
      };
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return createEmptyConversationState();
      }
      throw error;
    }
  };

  const writeState = async (state: ConversationStoreState) => {
    await fs.mkdir(rootDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
  };

  return {
    async saveAssistantProfile(profile) {
      const state = await readState();
      state.assistants = state.assistants.filter((item) => item.assistantId !== profile.assistantId);
      state.assistants.push(cloneProfile(profile));
      await writeState(state);
    },

    async listAssistantProfiles() {
      const state = await readState();
      return state.assistants.map(cloneProfile);
    },

    async updateAssistantChannelState(input) {
      const state = await readState();
      state.channelStates = state.channelStates.filter((item) =>
        !(item.assistantId === input.assistantId && item.channelType === input.channelType)
      );
      state.channelStates.push(cloneChannelState(input));
      await writeState(state);
    },

    async getAssistantChannelState(assistantId, channelType) {
      const state = await readState();
      const item = state.channelStates.find((entry) =>
        entry.assistantId === assistantId && entry.channelType === channelType
      );
      return item ? cloneChannelState(item) : null;
    },

    async createThread(thread) {
      const state = await readState();
      const created = cloneThread({ ...thread, memoryRefs: [...thread.memoryRefs] });
      state.threads = state.threads.filter((item) => item.threadId !== created.threadId);
      state.threads.push(created);
      state.events[created.threadId] = state.events[created.threadId] ?? [];
      await writeState(state);
      return cloneThread(created);
    },

    async updateThread(threadId, patch) {
      const state = await readState();
      const index = state.threads.findIndex((thread) => thread.threadId === threadId);
      if (index === -1) {
        throw new Error(`Conversation thread ${threadId} not found`);
      }
      state.threads[index] = {
        ...state.threads[index],
        ...patch
      };
      await writeState(state);
    },

    async getThread(threadId) {
      const state = await readState();
      const thread = state.threads.find((item) => item.threadId === threadId);
      return thread ? cloneThread(thread) : null;
    },

    async saveChannelSessionLink(link) {
      const state = await readState();
      const key = toLinkKey(link);
      state.links = state.links.filter((item) => toLinkKey(item) !== key);
      state.links.push(cloneLink(link));
      await writeState(state);
    },

    async findThreadByChannelIdentity(identity) {
      const state = await readState();
      const link = state.links.find((item) => toLinkKey(item) === toLinkKey(identity));
      if (!link) return null;
      const thread = state.threads.find((item) => item.threadId === link.threadId);
      return thread ? cloneThread(thread) : null;
    },

    async listThreads() {
      const state = await readState();
      return state.threads
        .map(cloneThread)
        .sort((a, b) => b.lastInteractionAt.localeCompare(a.lastInteractionAt));
    },

    async appendConversationEvent(event) {
      const state = await readState();
      state.events[event.threadId] = state.events[event.threadId] ?? [];
      state.events[event.threadId].push(cloneEvent(event));
      await writeState(state);
    },

    async getConversationEvents(threadId) {
      const state = await readState();
      return (state.events[threadId] ?? []).map(cloneEvent);
    },

    async getLatestConversationEvent(threadId) {
      const state = await readState();
      const latest = (state.events[threadId] ?? []).at(-1);
      return latest ? cloneEvent(latest) : null;
    }
  };
}

export function createConversationStoreForRuntime(args: {
  repoRoot: string;
  mode: "test" | "production";
}): ConversationStore {
  if (args.mode === "test") {
    return createInMemoryConversationStore();
  }

  return createFileConversationStore({
    rootDir: path.join(args.repoRoot, "logs", "conversations")
  });
}
