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

describe("phase17 whatsapp thread continuity", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  it("keeps the same thread across inbound task start and status follow-up", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase17-whatsapp-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase17-whatsapp-user-"));
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
          reason: "phase17 continuity"
        })
      })
      .mockResolvedValueOnce({
        outputText: JSON.stringify({
          final_result: "阶段性研究结果",
          verification: [{ kind: "source", summary: "src", sourceId: "src-1", passed: true }],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        usage: { total_tokens: 11 }
      });

    const services = await createRuntimeServices({ generate });

    try {
      const first = await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "8613800138000@s.whatsapp.net",
        externalChatId: "8613800138000@s.whatsapp.net",
        messageId: "msg-start",
        text: "帮我调研 OpenClaw 并给我一个阶段总结"
      });

      expect(first.action.kind).toBe("start_task");
      expect(first.thread.threadId).toMatch(/^thread-/);
      expect(first.thread.activeTaskId).toBe(first.action.taskId);

      const second = await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "8613800138000@s.whatsapp.net",
        externalChatId: "8613800138000@s.whatsapp.net",
        messageId: "msg-status",
        text: "现在状态怎么样？"
      });

      expect(second.action.kind).toBe("inspect_task");
      expect(second.thread.threadId).toBe(first.thread.threadId);
      expect(second.action.taskId).toBe(first.action.taskId);

      const events = await services.taskStore.getEvents(first.action.taskId);
      const linked = events.filter((event) => event.type === "ConversationLinked");
      expect(linked).toHaveLength(2);

      const inspection = await services.taskLifecycle.inspectTask(first.action.taskId);
      expect(inspection.runtimeInspector?.conversation).toEqual({
        assistantId: "assistant-main",
        threadId: first.thread.threadId,
        threadStatus: "task_running",
        channelType: "whatsapp",
        externalUserId: "8613800138000@s.whatsapp.net"
      });

      const conversationEvents = await services.conversationStore.getConversationEvents(first.thread.threadId);
      expect(conversationEvents.map((event) => event.direction)).toContain("incoming");
      expect(conversationEvents.map((event) => event.direction)).toContain("outgoing");
    } finally {
      await services.close();
    }
  });
});
