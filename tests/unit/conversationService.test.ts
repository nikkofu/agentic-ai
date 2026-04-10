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
      inspectTask: vi.fn(),
      resolveHumanAction: vi.fn()
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
      inspectTask: vi.fn().mockResolvedValue({ taskId: "task-2", graph: { status: "running" } }),
      resolveHumanAction: vi.fn()
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
      inspectTask: vi.fn(),
      resolveHumanAction: vi.fn()
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

  it("resolves approval responses for threads awaiting user input", async () => {
    const store = createInMemoryConversationStore();
    await store.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });
    await store.createThread({
      threadId: "thread-approval",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:8616@s.whatsapp.net",
      status: "awaiting_user_input",
      activeTaskId: "task-4",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "awaiting-approval",
      memoryRefs: []
    });
    await store.saveChannelSessionLink({
      linkId: "link-approval",
      threadId: "thread-approval",
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8616@s.whatsapp.net",
      externalChatId: "8616@s.whatsapp.net",
      lastSeenAt: "2026-04-09T00:00:00.000Z",
      connectionState: "connected"
    });

    const lifecycle = {
      startTask: vi.fn(),
      resumeTask: vi.fn(),
      inspectTask: vi.fn().mockResolvedValue({
        latestHumanAction: {
          type: "HumanActionRequired",
          payload: {
            node_id: "node-hitl-1"
          }
        }
      }),
      resolveHumanAction: vi.fn().mockResolvedValue({
        taskId: "task-4",
        nodeId: "node-hitl-1",
        action: "approve",
        resolved: true
      })
    };

    const service = createConversationService({
      conversationStore: store,
      taskLifecycle: lifecycle as any
    });

    const result = await service.handleIncomingMessage({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8616@s.whatsapp.net",
      externalChatId: "8616@s.whatsapp.net",
      messageId: "msg-approval",
      text: "可以，批准继续"
    });

    expect(result.messageKind).toBe("approval_response");
    expect(result.action.kind).toBe("resolve_human_action");
    expect(lifecycle.resolveHumanAction).toHaveBeenCalledWith({
      taskId: "task-4",
      nodeId: "node-hitl-1",
      action: "approve",
      feedback: "可以，批准继续"
    });
    expect(lifecycle.startTask).not.toHaveBeenCalled();
    expect(lifecycle.resumeTask).not.toHaveBeenCalled();
  });

  it("resolves clarification responses for threads awaiting user input", async () => {
    const store = createInMemoryConversationStore();
    await store.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });
    await store.createThread({
      threadId: "thread-clarify",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:8617@s.whatsapp.net",
      status: "awaiting_user_input",
      activeTaskId: "task-5",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "awaiting-clarification",
      memoryRefs: []
    });
    await store.saveChannelSessionLink({
      linkId: "link-clarify",
      threadId: "thread-clarify",
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8617@s.whatsapp.net",
      externalChatId: "8617@s.whatsapp.net",
      lastSeenAt: "2026-04-09T00:00:00.000Z",
      connectionState: "connected"
    });

    const lifecycle = {
      startTask: vi.fn(),
      resumeTask: vi.fn(),
      inspectTask: vi.fn().mockResolvedValue({
        latestHumanAction: {
          type: "HumanActionRequired",
          payload: {
            node_id: "node-hitl-2"
          }
        }
      }),
      resolveHumanAction: vi.fn().mockResolvedValue({
        taskId: "task-5",
        nodeId: "node-hitl-2",
        action: "clarify",
        resolved: true
      })
    };

    const service = createConversationService({
      conversationStore: store,
      taskLifecycle: lifecycle as any
    });

    const result = await service.handleIncomingMessage({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8617@s.whatsapp.net",
      externalChatId: "8617@s.whatsapp.net",
      messageId: "msg-clarify",
      text: "我补充一下背景：目标是内部使用，不对外发布"
    });

    expect(result.messageKind).toBe("clarification_response");
    expect(result.action.kind).toBe("resolve_human_action");
    expect(lifecycle.resolveHumanAction).toHaveBeenCalledWith({
      taskId: "task-5",
      nodeId: "node-hitl-2",
      action: "clarify",
      feedback: "我补充一下背景：目标是内部使用，不对外发布"
    });
    expect(lifecycle.startTask).not.toHaveBeenCalled();
    expect(lifecycle.resumeTask).not.toHaveBeenCalled();
  });

  it("resolves rejection responses for threads awaiting user input", async () => {
    const store = createInMemoryConversationStore();
    await store.saveAssistantProfile({
      assistantId: "assistant-main",
      displayName: "Aether",
      personaProfile: "helpful",
      memoryPolicy: "default",
      channelPolicies: { whatsapp: "default" }
    });
    await store.createThread({
      threadId: "thread-reject",
      assistantId: "assistant-main",
      userIdentityKey: "user:whatsapp:8618@s.whatsapp.net",
      status: "awaiting_user_input",
      activeTaskId: "task-6",
      lastInteractionAt: "2026-04-09T00:00:00.000Z",
      continuityState: "awaiting-approval",
      memoryRefs: []
    });
    await store.saveChannelSessionLink({
      linkId: "link-reject",
      threadId: "thread-reject",
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8618@s.whatsapp.net",
      externalChatId: "8618@s.whatsapp.net",
      lastSeenAt: "2026-04-09T00:00:00.000Z",
      connectionState: "connected"
    });

    const lifecycle = {
      startTask: vi.fn(),
      resumeTask: vi.fn(),
      inspectTask: vi.fn().mockResolvedValue({
        latestHumanAction: {
          type: "HumanActionRequired",
          payload: {
            node_id: "node-hitl-3"
          }
        }
      }),
      resolveHumanAction: vi.fn().mockResolvedValue({
        taskId: "task-6",
        nodeId: "node-hitl-3",
        action: "reject",
        resolved: true
      })
    };

    const service = createConversationService({
      conversationStore: store,
      taskLifecycle: lifecycle as any
    });

    const result = await service.handleIncomingMessage({
      assistantId: "assistant-main",
      channelType: "whatsapp",
      externalUserId: "8618@s.whatsapp.net",
      externalChatId: "8618@s.whatsapp.net",
      messageId: "msg-reject",
      text: "不通过，先别继续"
    });

    expect(result.messageKind).toBe("rejection_response");
    expect(result.action.kind).toBe("resolve_human_action");
    expect(lifecycle.resolveHumanAction).toHaveBeenCalledWith({
      taskId: "task-6",
      nodeId: "node-hitl-3",
      action: "reject",
      feedback: "不通过，先别继续"
    });
    expect(lifecycle.startTask).not.toHaveBeenCalled();
    expect(lifecycle.resumeTask).not.toHaveBeenCalled();
  });
});
