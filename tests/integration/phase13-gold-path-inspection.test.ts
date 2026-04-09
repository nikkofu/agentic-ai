import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRuntimeServices } from "../../src/runtime/runtimeServices";

afterEach(() => {
  fs.rmSync("artifacts/openclaw.md", { force: true });
  fs.rmSync("logs/runs", { recursive: true, force: true });
  fs.rmSync("audit_trail.jsonl", { force: true });
});

describe("phase 13 gold-path inspection", () => {
  it("surfaces artifact truth, verification preview, and explanation for a completed research-writing task", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      const currentObjective = request.input.at(-1)?.content ?? "";

      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "needs staged research and writing"
          }),
          raw: { ok: true }
        };
      }

      if (String(system).includes("planning agent for an autonomous runtime")) {
        return {
          outputText: JSON.stringify({
            summary: "planner summary",
            recommended_tools: ["web_search", "verify_sources"],
            required_capabilities: ["research", "verification", "writing"],
            verification_policy: "cite source urls in final delivery",
            spawn_children: [
              {
                id: "node-research",
                role: "researcher",
                input: "Research the topic with tools first.",
                depends_on: ["node-root"]
              },
              {
                id: "node-verify",
                role: "researcher",
                input: "Verify the key claims from the research step.",
                depends_on: ["node-research"]
              },
              {
                id: "node-write",
                role: "writer",
                input: "Write the final article using verified material.",
                depends_on: ["node-research", "node-verify"]
              }
            ]
          }),
          raw: { ok: true }
        };
      }

      if (String(currentObjective).includes("planner summary")) {
        return {
          outputText: JSON.stringify({
            final_result: "plan ready",
            verification: ["planning complete"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      if (String(currentObjective).includes("Research the topic")) {
        return {
          outputText: JSON.stringify({
            final_result: "research notes",
            verification: ["https://example.com/research"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      if (String(currentObjective).includes("Verify the key claims")) {
        return {
          outputText: JSON.stringify({
            final_result: "verified claims",
            verification: ["https://example.com/verify"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          final_result: "知乎文章终稿",
          verification: ["https://example.com/research", "https://example.com/verify"],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });

    const services = await createRuntimeServices({ generate });

    try {
      const result = await services.taskLifecycle.startTask({
        input: "调研 openclaw 开源项目并写一篇适合知乎发布的文章"
      });
      const inspection = await services.taskLifecycle.inspectTask(result.taskId);

      expect(result.finalState).toBe("completed");
      expect(inspection.runtimeInspector?.finalDelivery?.artifacts).toEqual([
        {
          path: "artifacts/openclaw.md",
          exists: true,
          nonEmpty: true
        }
      ]);
      expect(inspection.runtimeInspector?.finalDelivery?.verificationPreview).toEqual([
        "https://example.com/research",
        "https://example.com/verify"
      ]);
      expect(inspection.runtimeInspector?.explanation).toBe(
        "Task completed with 1 artifacts and 2 verification items"
      );
    } finally {
      await services.close();
    }
  });

  it("surfaces blocked explanation and action hint for a research-writing task missing verification", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async (request: any) => {
      const system = request.input?.[0]?.content ?? "";
      const currentObjective = request.input.at(-1)?.content ?? "";

      if (String(system).includes("intent classifier")) {
        return {
          outputText: JSON.stringify({
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "needs staged research and writing"
          }),
          raw: { ok: true }
        };
      }

      if (String(system).includes("planning agent for an autonomous runtime")) {
        return {
          outputText: JSON.stringify({
            summary: "planner summary",
            recommended_tools: ["web_search", "verify_sources"],
            required_capabilities: ["research", "verification", "writing"],
            verification_policy: "cite source urls in final delivery",
            spawn_children: [
              {
                id: "node-research",
                role: "researcher",
                input: "Research the topic with tools first.",
                depends_on: ["node-root"]
              },
              {
                id: "node-write",
                role: "writer",
                input: "Write the final article using verified material.",
                depends_on: ["node-research"]
              }
            ]
          }),
          raw: { ok: true }
        };
      }

      if (String(currentObjective).includes("planner summary")) {
        return {
          outputText: JSON.stringify({
            final_result: "plan ready",
            verification: ["planning complete"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      if (String(currentObjective).includes("Research the topic")) {
        return {
          outputText: JSON.stringify({
            final_result: "research notes",
            verification: ["https://example.com/research"],
            artifacts: [],
            risks: [],
            next_actions: []
          }),
          raw: { ok: true }
        };
      }

      return {
        outputText: JSON.stringify({
          final_result: "缺少引用的文章草稿",
          verification: [],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        raw: { ok: true }
      };
    });

    const services = await createRuntimeServices({ generate });

    try {
      const result = await services.taskLifecycle.startTask({
        input: "调研 openclaw 开源项目并写一篇适合知乎发布的文章"
      });
      const inspection = await services.taskLifecycle.inspectTask(result.taskId);

      expect(result.finalState).toBe("aborted");
      expect(inspection.runtimeInspector?.finalDelivery?.status).toBe("blocked");
      expect(inspection.runtimeInspector?.finalDelivery?.blockingReason).toBe("verification_missing");
      expect(inspection.runtimeInspector?.finalDelivery?.artifacts).toEqual([]);
      expect(inspection.runtimeInspector?.explanation).toBe("Task blocked: verification_missing");
      expect(inspection.runtimeInspector?.actionHint).toBe(
        "Add verification evidence before attempting final delivery again."
      );
    } finally {
      await services.close();
    }
  });
});
