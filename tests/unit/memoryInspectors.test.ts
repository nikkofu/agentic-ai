import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createMemoryEngine } from "../../src/runtime/memoryEngine";
import { createDreamRuntime } from "../../src/runtime/dreamRuntime";
import { createDreamInspector, createMemoryInspector } from "../../src/runtime/memoryInspectors";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("memory inspectors", () => {
  it("summarizes personal, project, and task memory counts and latest entries", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-inspector-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-inspector-user-"));
    tempRoots.push(repoRoot, userHome);

    const engine = createMemoryEngine({ repoRoot, userHome });
    await engine.record({
      layer: "personal",
      state: "compressed",
      kind: "preference",
      body: "Prefer concise responses."
    });
    await engine.record({
      layer: "project",
      state: "curated",
      kind: "architecture_decision",
      body: "Use verifier-enforced delivery."
    });
    await engine.record({
      layer: "task",
      state: "raw",
      taskId: "task-inspect-1",
      kind: "task_summary",
      body: "Task summary body."
    });

    const inspector = createMemoryInspector({ memoryStore: engine });
    const summary = await inspector.inspect("task-inspect-1");

    expect(summary.personal.count).toBe(1);
    expect(summary.personal.latest[0]).toContain("Prefer concise responses.");
    expect(summary.project.count).toBe(1);
    expect(summary.project.latest[0]).toContain("Use verifier-enforced delivery.");
    expect(summary.task.count).toBe(1);
    expect(summary.task.latest[0]).toContain("Task summary body.");
  });

  it("summarizes latest dream reflections and recommendations", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-dream-inspector-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-dream-inspector-user-"));
    tempRoots.push(repoRoot, userHome);

    const dream = createDreamRuntime({ repoRoot, userHome });
    await dream.runIdleCycle({
      idleMinutes: 30,
      taskFailures: ["browser_outcome_not_reached"],
      memoryEntries: [{ id: "task-1", body: "Recovered by validating earlier." }]
    });

    const inspector = createDreamInspector({ repoRoot, userHome });
    const summary = await inspector.inspect("task-1");

    expect(summary.reflectionsCount).toBeGreaterThan(0);
    expect(summary.latestReflections.some((entry) => entry.includes("Idle reflection") || entry.includes("Observed repeated failure"))).toBe(true);
    expect(summary.recommendationsCount).toBeGreaterThan(0);
    expect(summary.latestRecommendations.some((entry) => entry.includes("Recommendation"))).toBe(true);
  });
});
