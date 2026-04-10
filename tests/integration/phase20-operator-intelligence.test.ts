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

describe("phase20 operator intelligence", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  it("returns operator-intelligence aggregates alongside runtime inspection", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase20-runtime-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase20-runtime-user-"));
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
          reason: "phase20 operator intelligence"
        })
      })
      .mockResolvedValueOnce({
        outputText: JSON.stringify({
          final_result: "可接受的研究结论",
          verification: [
            { kind: "source", summary: "src-a", sourceId: "src-a", passed: true },
            { kind: "source", summary: "src-b", sourceId: "src-b", passed: true }
          ],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        usage: { total_tokens: 12 }
      });

    const services = await createRuntimeServices({ generate });

    try {
      const run = await services.taskLifecycle.startTask({
        input: "请先研究一个主题并给出结论。"
      });

      const inspection = await services.taskLifecycle.inspectTask(run.taskId);

      expect(inspection.runtimeInspector?.operatorIntelligence.outcome.acceptanceRate).toBeTypeOf("number");
      expect(inspection.runtimeInspector?.operatorIntelligence.economics.totalCostUsd).toBeTypeOf("number");
      expect(inspection.runtimeInspector?.operatorIntelligence.risk.blockedRate).toBeTypeOf("number");
      expect(inspection.runtimeInspector?.operatorIntelligence.trust.releaseGateReadiness).toBe(true);
      expect(inspection.runtimeInspector?.operatorIntelligence.objectives[0]?.id).toBe("family:research_writing");
    } finally {
      await services.close();
    }
  });
});
