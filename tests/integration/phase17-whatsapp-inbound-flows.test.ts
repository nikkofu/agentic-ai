import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRuntimeServices } from "../../src/runtime/runtimeServices";

const tempRoots: string[] = [];
const originalCwd = process.cwd();
const originalHome = process.env.HOME;

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("phase17 whatsapp inbound flows", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  it("supports richer inbound continuity flows on the same thread", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase17-whatsapp-flows-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase17-whatsapp-flows-user-"));
    tempRoots.push(repoRoot, userHome);
    fs.mkdirSync(path.join(repoRoot, "config"), { recursive: true });
    fs.copyFileSync(
      path.resolve(originalCwd, "config/runtime.yaml"),
      path.join(repoRoot, "config/runtime.yaml")
    );
    process.chdir(repoRoot);
    process.env.HOME = userHome;

    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        outputText: JSON.stringify({
          task_kind: "research_writing",
          execution_mode: "single_node",
          roles: ["planner"],
          needs_verification: true,
          reason: "phase17 inbound flows"
        })
      })
      .mockResolvedValueOnce({
        outputText: JSON.stringify({
          final_result: "第一次结果",
          verification: [{ kind: "source", summary: "src", sourceId: "src-1", passed: true }],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        usage: { total_tokens: 11 }
      })
      .mockResolvedValueOnce({
        outputText: JSON.stringify({
          task_kind: "research_writing",
          execution_mode: "single_node",
          roles: ["planner"],
          needs_verification: true,
          reason: "phase17 task follow up"
        })
      })
      .mockResolvedValueOnce({
        outputText: JSON.stringify({
          final_result: "第二次结果",
          verification: [{ kind: "source", summary: "src2", sourceId: "src-2", passed: true }],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        usage: { total_tokens: 13 }
      });

    const services = await createRuntimeServices({ generate });

    try {
      const first = await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "phase17-flow@s.whatsapp.net",
        externalChatId: "phase17-flow@s.whatsapp.net",
        messageId: "msg-flow-start",
        text: "帮我调研这个仓库最近的进展"
      });

      await services.conversationStore.updateThread(first.thread.threadId, {
        status: "task_blocked",
        continuityState: "blocked"
      });

      const resumed = await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "phase17-flow@s.whatsapp.net",
        externalChatId: "phase17-flow@s.whatsapp.net",
        messageId: "msg-flow-resume",
        text: "继续刚才那个任务"
      });

      expect(resumed.messageKind).toBe("resume_request");
      expect(resumed.thread.threadId).toBe(first.thread.threadId);
      expect(resumed.action.kind).toBe("resume_task");

      await services.conversationStore.updateThread(first.thread.threadId, {
        status: "awaiting_user_input",
        continuityState: "awaiting-approval"
      });
      services.eventBus.publish({
        type: "HumanActionRequired",
        payload: {
          task_id: resumed.action.taskId,
          node_id: "node-hitl-approve",
          reason: "approval needed"
        },
        ts: Date.now()
      });

      const approved = await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "phase17-flow@s.whatsapp.net",
        externalChatId: "phase17-flow@s.whatsapp.net",
        messageId: "msg-flow-approve",
        text: "可以，批准继续"
      });

      expect(approved.messageKind).toBe("approval_response");
      expect(approved.action.kind).toBe("resolve_human_action");
      expect(approved.thread.threadId).toBe(first.thread.threadId);

      await services.conversationStore.updateThread(first.thread.threadId, {
        status: "awaiting_user_input",
        continuityState: "awaiting-clarification"
      });
      services.eventBus.publish({
        type: "HumanActionRequired",
        payload: {
          task_id: resumed.action.taskId,
          node_id: "node-hitl-clarify",
          reason: "clarification needed"
        },
        ts: Date.now()
      });

      const clarified = await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "phase17-flow@s.whatsapp.net",
        externalChatId: "phase17-flow@s.whatsapp.net",
        messageId: "msg-flow-clarify",
        text: "我补充一下背景：输出只给内部团队看"
      });

      expect(clarified.messageKind).toBe("clarification_response");
      expect(clarified.action.kind).toBe("resolve_human_action");

      await services.conversationStore.updateThread(first.thread.threadId, {
        status: "awaiting_user_input",
        continuityState: "awaiting-rejection"
      });
      services.eventBus.publish({
        type: "HumanActionRequired",
        payload: {
          task_id: resumed.action.taskId,
          node_id: "node-hitl-reject",
          reason: "rejection needed"
        },
        ts: Date.now()
      });

      const rejected = await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "phase17-flow@s.whatsapp.net",
        externalChatId: "phase17-flow@s.whatsapp.net",
        messageId: "msg-flow-reject",
        text: "不通过，先停一下"
      });

      expect(rejected.messageKind).toBe("rejection_response");
      expect(rejected.action.kind).toBe("resolve_human_action");

      await services.conversationStore.updateThread(first.thread.threadId, {
        status: "task_running",
        activeTaskId: resumed.action.taskId,
        continuityState: "active"
      });

      const followUp = await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "phase17-flow@s.whatsapp.net",
        externalChatId: "phase17-flow@s.whatsapp.net",
        messageId: "msg-flow-followup",
        text: "再补一段关于记忆系统的总结"
      });

      expect(followUp.messageKind).toBe("task_follow_up");
      expect(followUp.action.kind).toBe("start_task");
      expect(followUp.thread.threadId).toBe(first.thread.threadId);

      const events = await services.conversationStore.getConversationEvents(first.thread.threadId);
      expect(events.map((event) => event.kind)).toEqual(expect.arrayContaining([
        "new_task",
        "resume_request",
        "approval_response",
        "rejection_response",
        "clarification_response",
        "task_follow_up"
      ]));
      expect(events.filter((event) => event.direction === "outgoing").length).toBeGreaterThanOrEqual(4);
    } finally {
      await services.close();
    }
  });
});
