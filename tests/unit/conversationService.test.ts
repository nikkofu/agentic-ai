import { describe, expect, it, vi } from "vitest";

import { createConversationService } from "../../src/runtime/conversationService";
import { createInMemoryConversationStore } from "../../src/runtime/conversationStore";

describe("conversationService", () => {
  it("creates a new thread and starts a task for a new task message", async () => {
    const store = createInMemoryConversationStore();
    await store.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });

    const lifecycle = {
      startTask: vi.fn().mockResolvedValue({ taskId: "task-1" }),
      resumeTask: vi.fn(),
      inspectTask: vi.fn()
    };

    const publish = vi.fn();
    const service = createConversationService({
      conversationStore: store,
      taskLifecycle: lifecycle as any,
      eventBus: { publish } as any
    });

    const result = await service.handleIncomingMessage({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8613@s.whatsapp.net",
      externalChatId: "8613@s.whatsapp.net",
      messageId: "msg-1",
      text: "帮我调研这个项目并写一篇总结"
    });

    expect(result.thread.status).toBe("task_running");
    expect(result.action.kind).toBe("start_task");
    expect(lifecycle.startTask).toHaveBeenCalledWith({
      input: "帮我调研这个项目并写一篇总结"
    });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      type: "ConversationLinked",
      payload: expect.objectContaining({
        task_id: "task-1",
        assistant_id: "assistant-main",
        thread_status: "task_running"
      })
    }));
  });

  it("resolves an existing thread and inspects status queries", async () => {
    const store = createInMemoryConversationStore();
    await store.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });
    await store.createThread({
      threadId: "thread-status",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:8614@s.whatsapp.net",
      status: "task_running",
      activeTaskId: "task-2",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "active",
      memoryRefs: []
    });
    await store.saveChannelSessionLink({
      linkId: "link-status",
      threadId: "thread-status",
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8614@s.whatsapp.net",
      externalChatId: "8614@s.whatsapp.net",
      lastSeenAt: "2026-04-09T00:00:00.000Z",
      connectionState: "connected"
    });

    const lifecycle = {
      startTask: vi.fn(),
      resumeTask: vi.fn(),
      inspectTask: vi.fn().mockResolvedValue({ taskId: "task-2", graph: { status: "running" } })
    };

    const service = createConversationService({
      conversationStore: store,
      taskLifecycle: lifecycle as any
    });

    const result = await service.handleIncomingMessage({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8614@s.whatsapp.net",
      externalChatId: "8614@s.whatsapp.net",
      messageId: "msg-2",
      text: "现在状态怎么样？"
    });

    expect(result.thread.threadId).toBe("thread-status");
    expect(result.action.kind).toBe("inspect_task");
    expect(lifecycle.inspectTask).toHaveBeenCalledWith("task-2");
  });

  it("resumes a blocked task when the user asks to continue", async () => {
    const store = createInMemoryConversationStore();
    await store.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });
    await store.createThread({
      threadId: "thread-resume",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:8615@s.whatsapp.net",
      status: "task_blocked",
      activeTaskId: "task-3",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "blocked",
      memoryRefs: []
    });
    await store.saveChannelSessionLink({
      linkId: "link-resume",
      threadId: "thread-resume",
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8615@s.whatsapp.net",
      externalChatId: "8615@s.whatsapp.net",
      lastSeenAt: "2026-04-09T00:00:00.000Z",
      connectionState: "connected"
    });

    const lifecycle = {
      startTask: vi.fn(),
      resumeTask: vi.fn().mockResolvedValue({ taskId: "task-3" }),
      inspectTask: vi.fn()
    };

    const service = createConversationService({
      conversationStore: store,
      taskLifecycle: lifecycle as any
    });

    const result = await service.handleIncomingMessage({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8615@s.whatsapp.net",
      externalChatId: "8615@s.whatsapp.net",
      messageId: "msg-3",
      text: "继续刚才那个任务"
    });

    expect(result.action.kind).toBe("resume_task");
    expect(lifecycle.resumeTask).toHaveBeenCalledWith({ taskId: "task-3" });
    expect(result.thread.status).toBe("task_running");
  });
});
