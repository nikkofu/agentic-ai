import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRuntimeServices } from "../../src/runtime/runtimeServices";

afterEach(() => {
  fs.rmSync("artifacts/openclaw.md", { force: true });
});

describe("phase 13 async resume gold-path inspection", () => {
  it("surfaces resumed completion clearly after an interrupted task is resumed", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn().mockResolvedValue({
      outputText: JSON.stringify({
        final_result: "恢复后的 OpenClaw 终稿",
        verification: ["https://example.com/resume-proof"],
        artifacts: [],
        risks: [],
        next_actions: []
      }),
      raw: { ok: true }
    });

    const services = await createRuntimeServices({ generate });

    try {
      const taskId = "task-phase13-resume-proof";

      await services.taskStore.createGraph({
        taskId,
        rootNodeId: "node-root"
      });

      await services.taskStore.upsertNode(taskId, {
        nodeId: "node-root",
        role: "planner",
        state: "completed",
        depth: 0,
        attempt: 1,
        inputSummary: "root"
      });

      await services.taskStore.upsertNode(taskId, {
        nodeId: "node-write",
        parentNodeId: "node-root",
        role: "writer",
        state: "pending",
        depth: 1,
        attempt: 1,
        inputSummary: "resume writer"
      });

      await services.taskStore.appendEvent({
        type: "ExecutionContextPrepared",
        payload: {
          task_id: taskId,
          node_id: "node-write",
          context: {
            intent: {
              task_kind: "research_writing",
              execution_mode: "tree",
              roles: ["planner", "researcher", "writer"],
              needs_verification: true,
              reason: "resume proof"
            },
            plan: {
              nodes: [
                { id: "node-root", role: "planner", input: "Plan task", depends_on: [] },
                { id: "node-write", role: "writer", input: "Write the final article", depends_on: ["node-root"] }
              ]
            },
            policy: {
              recommendedTools: ["web_search", "verify_sources"],
              requiredCapabilities: ["research", "writing"],
              verificationPolicy: "cite urls"
            },
            node: {
              id: "node-write",
              role: "writer",
              input: "Write the final article",
              depends_on: ["node-root"]
            },
            task: "恢复中断的 openclaw 调研文章",
            dependencyOutputs: ["planner summary"],
            memoryRefs: [],
            workingMemory: [],
            retrievalContext: []
          }
        },
        ts: Date.now()
      });

      await services.taskStore.appendEvent({
        type: "TaskMemoryStored",
        payload: {
          task_id: taskId,
          source_id: "mem://task-phase13-resume-proof/node-root",
          content: "OpenClaw previous research summary",
          tags: ["node-output"]
        },
        ts: Date.now() + 1
      });

      const result = await services.taskLifecycle.resumeTask({ taskId });
      const inspection = await services.taskLifecycle.inspectTask(taskId);

      expect(result.finalState).toBe("completed");
      expect(inspection.latestClose?.payload.resumed).toBe(true);
      expect(inspection.runtimeInspector?.finalDelivery?.status).toBe("completed");
      expect(inspection.runtimeInspector?.finalDelivery?.artifacts).toEqual([
        {
          path: "artifacts/openclaw.md",
          exists: true,
          nonEmpty: true
        }
      ]);
      expect(inspection.runtimeInspector?.finalDelivery?.verificationPreview).toEqual([
        "https://example.com/resume-proof"
      ]);
      expect(inspection.runtimeInspector?.explanation).toBe(
        "Task completed with 1 artifacts and 1 verification items"
      );
      expect(inspection.runtimeInspector?.actionHint).toBe(
        "Review the final artifacts and verification evidence."
      );
    } finally {
      await services.close();
    }
  });
});
