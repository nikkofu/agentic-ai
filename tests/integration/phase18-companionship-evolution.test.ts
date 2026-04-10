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

describe("phase18 companionship evolution", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  it("produces companionship memory from a continued whatsapp thread", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-companion-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-companion-user-"));
    tempRoots.push(repoRoot, userHome);
    fs.mkdirSync(path.join(repoRoot, "config"), { recursive: true });
    fs.copyFileSync(path.resolve(originalCwd, "config/runtime.yaml"), path.join(repoRoot, "config/runtime.yaml"));
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
          reason: "companionship evolution"
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
        text: "继续上次关于 OpenClaw 的研究，并先给我结论。"
      });

      await services.conversationService.handleIncomingMessage({
        assistantId: "assistant-main",
        channelType: "whatsapp",
        externalUserId: "8613800138000@s.whatsapp.net",
        externalChatId: "8613800138000@s.whatsapp.net",
        messageId: "msg-followup",
        text: "现在状态怎么样？如果被卡住，就先告诉我哪里需要我确认，并先给我结论。"
      });

      const inspection = await services.taskLifecycle.inspectTask(first.action.taskId);

      expect(inspection.runtimeInspector?.companionship).not.toBeNull();
      expect(inspection.runtimeInspector?.companionship?.continuitySummary).toContain("thread");
      expect(inspection.runtimeInspector?.companionship?.preferenceNotes.join(" ")).toContain("先给我结论");
    } finally {
      await services.close();
    }
  });
});
