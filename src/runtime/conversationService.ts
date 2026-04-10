import { randomUUID } from "node:crypto";

import type { EventBus } from "../core/eventBus";
import type {
  ChannelType,
  ConversationMessageKind,
  ConversationThread
} from "./conversationContracts";
import type { ConversationStore } from "./conversationStore";

type TaskLifecycle = {
  startTask(input: { input: string }): Promise<{ taskId: string }>;
  resumeTask(input: { taskId: string; maxParallel?: number }): Promise<{ taskId: string }>;
  inspectTask(taskId: string): Promise<{
    latestHumanAction?: {
      type: string;
      payload: Record<string, unknown>;
    } | null;
  }>;
  resolveHumanAction(input: {
    taskId: string;
    nodeId: string;
    action?: "approve" | "reject" | "clarify";
    feedback: string;
  }): Promise<{
    taskId: string;
    nodeId: string;
    action: "approve" | "reject" | "clarify";
    resolved: boolean;
  }>;
};

export type IncomingConversationMessage = {
  assistantId: string;
  channelType: ChannelType;
  externalUserId: string;
  externalChatId: string;
  messageId: string;
  text: string;
};

export type ConversationAction =
  | { kind: "start_task"; taskId: string }
  | { kind: "resume_task"; taskId: string }
  | { kind: "inspect_task"; taskId: string }
  | { kind: "resolve_human_action"; taskId: string; nodeId: string; action: "approve" | "reject" | "clarify" }
  | { kind: "chat_reply" };

export function createConversationService(deps: {
  conversationStore: ConversationStore;
  taskLifecycle: TaskLifecycle;
  eventBus?: EventBus;
}) {
  return {
    async handleIncomingMessage(input: IncomingConversationMessage): Promise<{
      thread: ConversationThread;
      messageKind: ConversationMessageKind;
      action: ConversationAction;
      reply: { summary: string };
    }> {
      const thread = (await deps.conversationStore.findThreadByChannelIdentity({
        channelType: input.channelType,
        externalUserId: input.externalUserId,
        externalChatId: input.externalChatId
      })) ?? await createThread(deps.conversationStore, input);

      const messageKind = classifyIncomingMessage(input.text, thread);

      await deps.conversationStore.appendConversationEvent({
        eventId: input.messageId,
        threadId: thread.threadId,
        channelType: input.channelType,
        direction: "incoming",
        kind: messageKind,
        payload: { text: input.text },
        createdAt: new Date().toISOString()
      });

      if (messageKind === "status_query" && thread.activeTaskId) {
        await deps.taskLifecycle.inspectTask(thread.activeTaskId);
        publishConversationLinked(deps.eventBus, {
          taskId: thread.activeTaskId,
          assistantId: input.assistantId,
          threadId: thread.threadId,
          threadStatus: thread.status,
          channelType: input.channelType,
          externalUserId: input.externalUserId
        });
        await deps.conversationStore.updateThread(thread.threadId, {
          lastInteractionAt: new Date().toISOString()
        });
        const updated = (await deps.conversationStore.getThread(thread.threadId))!;
        await appendOutgoingSummary(deps.conversationStore, updated.threadId, input.channelType, "已查询当前任务状态。");
        return {
          thread: updated,
          messageKind,
          action: { kind: "inspect_task", taskId: thread.activeTaskId },
          reply: { summary: "已查询当前任务状态。" }
        };
      }

      if (messageKind === "resume_request" && thread.activeTaskId) {
        const result = await deps.taskLifecycle.resumeTask({ taskId: thread.activeTaskId });
        await deps.conversationStore.updateThread(thread.threadId, {
          status: "task_running",
          activeTaskId: result.taskId,
          continuityState: "active",
          lastInteractionAt: new Date().toISOString()
        });
        const updated = (await deps.conversationStore.getThread(thread.threadId))!;
        publishConversationLinked(deps.eventBus, {
          taskId: result.taskId,
          assistantId: input.assistantId,
          threadId: updated.threadId,
          threadStatus: updated.status,
          channelType: input.channelType,
          externalUserId: input.externalUserId
        });
        await appendOutgoingSummary(deps.conversationStore, updated.threadId, input.channelType, "已继续刚才中断的任务。");
        return {
          thread: updated,
          messageKind,
          action: { kind: "resume_task", taskId: result.taskId },
          reply: { summary: "已继续刚才中断的任务。" }
        };
      }

      if (messageKind === "new_task" || messageKind === "task_follow_up") {
        const result = await deps.taskLifecycle.startTask({ input: input.text });
        await deps.conversationStore.updateThread(thread.threadId, {
          status: "task_running",
          activeTaskId: result.taskId,
          continuityState: "active",
          lastInteractionAt: new Date().toISOString()
        });
        const updated = (await deps.conversationStore.getThread(thread.threadId))!;
        publishConversationLinked(deps.eventBus, {
          taskId: result.taskId,
          assistantId: input.assistantId,
          threadId: updated.threadId,
          threadStatus: updated.status,
          channelType: input.channelType,
          externalUserId: input.externalUserId
        });
        await appendOutgoingSummary(deps.conversationStore, updated.threadId, input.channelType, "已开始处理这个任务。");
        return {
          thread: updated,
          messageKind,
          action: { kind: "start_task", taskId: result.taskId },
          reply: { summary: "已开始处理这个任务。" }
        };
      }

      if (
        (messageKind === "approval_response" || messageKind === "clarification_response" || messageKind === "rejection_response")
        && thread.activeTaskId
      ) {
        const inspection = await deps.taskLifecycle.inspectTask(thread.activeTaskId);
        const nodeId = typeof inspection.latestHumanAction?.payload?.node_id === "string"
          ? inspection.latestHumanAction.payload.node_id
          : "";

        if (nodeId) {
          const action = messageKind === "approval_response"
            ? "approve"
            : messageKind === "rejection_response"
              ? "reject"
              : "clarify";
          const resolved = await deps.taskLifecycle.resolveHumanAction({
            taskId: thread.activeTaskId,
            nodeId,
            action,
            feedback: input.text
          });
          const summary = action === "approve"
            ? "已收到你的批准，我会继续推进这条任务。"
            : action === "reject"
              ? "已收到你的拒绝意见，我会保持这条会话并等待下一步指示。"
              : "已收到你的补充说明，我会带着这些反馈继续处理。";
          await deps.conversationStore.updateThread(thread.threadId, {
            status: action === "approve" ? "task_running" : action === "reject" ? "task_blocked" : "awaiting_user_input",
            continuityState: action === "approve" ? "approved" : action === "reject" ? "rejected" : "clarified",
            lastInteractionAt: new Date().toISOString()
          });
          const updated = (await deps.conversationStore.getThread(thread.threadId))!;
          await appendOutgoingSummary(deps.conversationStore, updated.threadId, input.channelType, summary);
          return {
            thread: updated,
            messageKind,
            action: {
              kind: "resolve_human_action",
              taskId: resolved.taskId,
              nodeId: resolved.nodeId,
              action: resolved.action
            },
            reply: { summary }
          };
        }
      }

      if (messageKind === "approval_response" || messageKind === "clarification_response" || messageKind === "rejection_response") {
        await deps.conversationStore.updateThread(thread.threadId, {
          lastInteractionAt: new Date().toISOString()
        });
        const updated = (await deps.conversationStore.getThread(thread.threadId))!;
        const summary = messageKind === "approval_response"
          ? "已收到你的批准，我会保留这条会话的上下文并等待后续处理。"
          : messageKind === "rejection_response"
            ? "已收到你的拒绝意见，我会保留这条会话并等待后续处理。"
            : "已收到你的补充说明，我会保留这条会话的上下文并等待后续处理。";
        await appendOutgoingSummary(deps.conversationStore, updated.threadId, input.channelType, summary);
        return {
          thread: updated,
          messageKind,
          action: { kind: "chat_reply" },
          reply: { summary }
        };
      }

      await deps.conversationStore.updateThread(thread.threadId, {
        lastInteractionAt: new Date().toISOString()
      });
      const updated = (await deps.conversationStore.getThread(thread.threadId))!;
      await appendOutgoingSummary(deps.conversationStore, updated.threadId, input.channelType, "已收到，我会继续保持这条会话的上下文。");
      return {
        thread: updated,
        messageKind,
        action: { kind: "chat_reply" },
        reply: { summary: "已收到，我会继续保持这条会话的上下文。" }
      };
    }
  };
}

function publishConversationLinked(
  eventBus: EventBus | undefined,
  input: {
    taskId: string;
    assistantId: string;
    threadId: string;
    threadStatus: string;
    channelType: string;
    externalUserId: string;
  }
) {
  eventBus?.publish({
    type: "ConversationLinked",
    payload: {
      task_id: input.taskId,
      assistant_id: input.assistantId,
      thread_id: input.threadId,
      thread_status: input.threadStatus,
      channel_type: input.channelType,
      external_user_id: input.externalUserId
    },
    ts: Date.now()
  });
}

async function appendOutgoingSummary(
  store: ConversationStore,
  threadId: string,
  channelType: ChannelType,
  summary: string
) {
  await store.appendConversationEvent({
    eventId: `out-${randomUUID()}`,
    threadId,
    channelType,
    direction: "outgoing",
    kind: "chat",
    payload: { summary },
    createdAt: new Date().toISOString()
  });
}

function classifyIncomingMessage(text: string, thread: ConversationThread): ConversationMessageKind {
  const normalized = text.trim();

  if (thread.status === "awaiting_user_input") {
    if (/(拒绝|驳回|不通过|先别继续|reject|rejected)/i.test(normalized)) {
      return "rejection_response";
    }

    if (/(批准|同意|通过|可以继续|approve|approved)/i.test(normalized)) {
      return "approval_response";
    }

    if (/(补充|说明|澄清|clarify|clarification)/i.test(normalized)) {
      return "clarification_response";
    }
  }

  if (/[状進进]度|状态|怎么.?样|完成了吗|到哪了/.test(normalized) && thread.activeTaskId) {
    return "status_query";
  }

  if (/(继续|恢复|接着|resume)/i.test(normalized) && thread.activeTaskId) {
    return "resume_request";
  }

  if (thread.activeTaskId) {
    return "task_follow_up";
  }

  return "new_task";
}

async function createThread(store: ConversationStore, input: IncomingConversationMessage): Promise<ConversationThread> {
  const threadId = `thread-${randomUUID()}`;
  const linkId = `link-${randomUUID()}`;
  const now = new Date().toISOString();
  const thread = await store.createThread({
    threadId,
    assistantId: input.assistantId,
    userIdentityKey: `user:${input.channelType}:${input.externalUserId}`,
    status: "idle",
    lastInteractionAt: now,
    continuityState: "new",
    memoryRefs: []
  });

  await store.saveChannelSessionLink({
    linkId,
    threadId,
    assistantId: input.assistantId,
    channelType: input.channelType,
    externalUserId: input.externalUserId,
    externalChatId: input.externalChatId,
    lastSeenAt: now,
    connectionState: "connected"
  });

  return thread;
}
