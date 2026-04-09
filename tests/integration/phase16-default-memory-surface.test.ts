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

describe("phase16 default memory surface", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  });

  it("wires live memory and dream summaries into default task lifecycle inspection", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-surface-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-surface-user-"));
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
          reason: "research"
        })
      })
      .mockResolvedValueOnce({
        outputText: JSON.stringify({
          status: "completed",
          final_result: "researched result",
          verification: [{ kind: "source", summary: "src", sourceId: "src-1", passed: true }],
          artifacts: [],
          risks: [],
          next_actions: []
        }),
        usage: { total_tokens: 12 }
      });

    const services = await createRuntimeServices({ generate });

    const result = await services.executor.execute({ input: "research and write summary" });
    await services.dreamRuntime.runIdleCycle({
      idleMinutes: 25,
      taskFailures: ["browser_outcome_not_reached"],
      memoryEntries: [{ id: "task-1", body: "Recovered by validating earlier." }]
    });

    const inspection = await services.taskLifecycle.inspectTask(result.taskId);

    expect(inspection.runtimeInspector.memory.project.count).toBeGreaterThan(0);
    expect(inspection.runtimeInspector.memory.task.count).toBeGreaterThan(0);
    expect(inspection.runtimeInspector.dream.reflectionsCount).toBeGreaterThan(0);
    expect(inspection.runtimeInspector.dream.latestRecommendations.length).toBeGreaterThan(0);

    await services.close();
  });
});
