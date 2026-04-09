import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDreamRuntime } from "../../src/runtime/dreamRuntime";
import { createDreamScheduler } from "../../src/runtime/dreamScheduler";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("phase16 dream runtime", () => {
  it("writes dream recommendations and skill drafts during idle reflection", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-dream-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-dream-user-"));
    tempRoots.push(repoRoot, userHome);

    const dream = createDreamRuntime({ repoRoot, userHome });
    const result = await dream.runIdleCycle({
      idleMinutes: 45,
      taskFailures: ["browser_outcome_not_reached", "browser_outcome_not_reached"],
      memoryEntries: [
        { id: "task-1", body: "Recovered by validating outcome earlier." }
      ]
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.skillDrafts.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(repoRoot, "memory", "dream", "recommendations"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "memory", "dream", "skills"))).toBe(true);
  });

  it("triggers Dream through the scheduler when the idle threshold is met", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-dream-scheduler-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-dream-scheduler-user-"));
    tempRoots.push(repoRoot, userHome);

    const dream = createDreamRuntime({ repoRoot, userHome });
    const scheduler = createDreamScheduler({
      dreamRuntime: dream,
      thresholdMinutes: 20
    });

    const result = await scheduler.maybeRunIdleCycle({
      idleMinutes: 25,
      taskFailures: ["browser_outcome_not_reached"],
      memoryEntries: [{ id: "task-1", body: "Recovered by validating earlier." }]
    });

    expect(result?.reflections.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(repoRoot, "memory", "dream", "reflections"))).toBe(true);
  });
});
