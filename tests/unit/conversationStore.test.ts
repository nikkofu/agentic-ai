import { describe, expect, it } from "vitest";

import { createInMemoryConversationStore } from "../../src/runtime/conversationStore";

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
});
