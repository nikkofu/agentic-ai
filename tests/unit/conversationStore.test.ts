import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  createConversationStoreForRuntime,
  createFileConversationStore,
  createInMemoryConversationStore
} from "../../src/runtime/conversationStore";

describe("conversationStore", () => {
  it("creates and resolves a thread by WhatsApp identity", async () => {
    const store = createInMemoryConversationStore();

    await store.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });

    const thread = await store.createThread({
      threadId: "thread-1",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:+8613800138000",
      status: "idle",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "new",
      memoryRefs: []
    });

    await store.saveChannelSessionLink({
      linkId: "link-1",
      threadId: thread.threadId,
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8613800138000@s.whatsapp.net",
      externalChatId: "8613800138000@s.whatsapp.net",
      lastSeenAt: "2026-04-09T00:00:00.000Z",
      connectionState: "connected"
    });

    const resolved = await store.findThreadByChannelIdentity({
      channelType: "whatsapp",
      externalUserId: "8613800138000@s.whatsapp.net",
      externalChatId: "8613800138000@s.whatsapp.net"
    });

    expect(resolved?.threadId).toBe("thread-1");
    expect(resolved?.assistantId).toBe("assistant-main");
  });

  it("updates active task linkage on a thread", async () => {
    const store = createInMemoryConversationStore();

    await store.createThread({
      threadId: "thread-2",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:+86x",
      status: "idle",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "new",
      memoryRefs: []
    });

    await store.updateThread("thread-2", {
      status: "task_running",
      activeTaskId: "task-123"
    });

    const thread = await store.getThread("thread-2");

    expect(thread?.status).toBe("task_running");
    expect(thread?.activeTaskId).toBe("task-123");
  });

  it("appends and reads structured conversation events", async () => {
    const store = createInMemoryConversationStore();

    await store.createThread({
      threadId: "thread-3",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:+86y",
      status: "idle",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "new",
      memoryRefs: []
    });

    await store.appendConversationEvent({
      eventId: "event-1",
      threadId: "thread-3",
      channelType: "whatsapp",
      direction: "incoming",
      kind: "new_task",
      payload: { text: "帮我继续这个任务" },
      createdAt: "2026-04-09T00:00:00.000Z"
    });

    const events = await store.getConversationEvents("thread-3");

    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("new_task");
    expect(events[0]?.direction).toBe("incoming");
  });

  it("reads the latest conversation event for thread previews", async () => {
    const store = createInMemoryConversationStore();

    await store.createThread({
      threadId: "thread-preview",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:+86z",
      status: "task_running",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "active",
      memoryRefs: []
    });

    await store.appendConversationEvent({
      eventId: "event-1",
      threadId: "thread-preview",
      channelType: "whatsapp",
      direction: "incoming",
      kind: "new_task",
      payload: { text: "先调研一下" },
      createdAt: "2026-04-09T00:00:00.000Z"
    });
    await store.appendConversationEvent({
      eventId: "event-2",
      threadId: "thread-preview",
      channelType: "whatsapp",
      direction: "outgoing",
      kind: "chat",
      payload: { summary: "任务已开始" },
      createdAt: "2026-04-09T00:01:00.000Z"
    });

    const latest = await store.getLatestConversationEvent("thread-preview");

    expect(latest?.eventId).toBe("event-2");
    expect(latest?.direction).toBe("outgoing");
  });

  it("lists assistant profiles and threads for control-center surfaces", async () => {
    const store = createInMemoryConversationStore();

    await store.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });

    await store.createThread({
      threadId: "thread-a",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:a",
      status: "task_completed",
      lastInteractionAt: "2026-04-09T10:00:00.000Z",
      continuityState: "complete",
      memoryRefs: []
    });

    await store.createThread({
      threadId: "thread-b",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:b",
      status: "task_running",
      lastInteractionAt: "2026-04-09T11:00:00.000Z",
      continuityState: "active",
      memoryRefs: []
    });

    const profiles = await store.listAssistantProfiles();
    const threads = await store.listThreads();

    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.assistantId).toBe("assistant-main");
    expect(threads.map((thread) => thread.threadId)).toEqual(["thread-b", "thread-a"]);
  });

  it("persists thread links and events across store recreation", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "conversation-store-"));
    const first = createFileConversationStore({ rootDir });

    await first.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });

    await first.createThread({
      threadId: "thread-persisted",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:persisted",
      status: "task_running",
      activeTaskId: "task-42",
      lastInteractionAt: "2026-04-10T00:00:00.000Z",
      continuityState: "active",
      memoryRefs: ["memory://task-42"]
    });

    await first.saveChannelSessionLink({
      linkId: "link-persisted",
      threadId: "thread-persisted",
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "persisted@s.whatsapp.net",
      externalChatId: "persisted@s.whatsapp.net",
      lastSeenAt: "2026-04-10T00:00:00.000Z",
      connectionState: "connected"
    });

    await first.appendConversationEvent({
      eventId: "event-persisted",
      threadId: "thread-persisted",
      channelType: "whatsapp",
      direction: "incoming",
      kind: "status_query",
      payload: { text: "还在吗" },
      createdAt: "2026-04-10T00:01:00.000Z"
    });

    const second = createFileConversationStore({ rootDir });

    const resolved = await second.findThreadByChannelIdentity({
      channelType: "whatsapp",
      externalUserId: "persisted@s.whatsapp.net",
      externalChatId: "persisted@s.whatsapp.net"
    });
    const events = await second.getConversationEvents("thread-persisted");
    const profiles = await second.listAssistantProfiles();

    expect(resolved?.threadId).toBe("thread-persisted");
    expect(resolved?.activeTaskId).toBe("task-42");
    expect(events).toHaveLength(1);
    expect(events[0]?.eventId).toBe("event-persisted");
    expect(profiles.map((profile) => profile.assistantId)).toEqual(["assistant-main"]);
  });

  it("uses durable conversation storage outside test mode", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "conversation-runtime-store-"));
    const store = createConversationStoreForRuntime({
      repoRoot: rootDir,
      mode: "production"
    });

    await store.createThread({
      threadId: "thread-runtime",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:runtime",
      status: "idle",
      lastInteractionAt: "2026-04-10T00:00:00.000Z",
      continuityState: "new",
      memoryRefs: []
    });

    const reloaded = createConversationStoreForRuntime({
      repoRoot: rootDir,
      mode: "production"
    });
    const thread = await reloaded.getThread("thread-runtime");

    expect(thread?.threadId).toBe("thread-runtime");
  });

  it("persists assistant channel state across store recreation", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "conversation-channel-state-"));
    const first = createFileConversationStore({ rootDir });

    await first.updateAssistantChannelState({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      connectionState: "connected",
      updatedAt: "2026-04-10T01:00:00.000Z"
    });

    const second = createFileConversationStore({ rootDir });
    const state = await second.getAssistantChannelState("assistant-main", "whatsapp");

    expect(state).toEqual({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      connectionState: "connected",
      updatedAt: "2026-04-10T01:00:00.000Z"
    });
  });
});
