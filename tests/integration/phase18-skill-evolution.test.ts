import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDreamRuntime } from "../../src/runtime/dreamRuntime";
import { createDreamScheduler } from "../../src/runtime/dreamScheduler";
import { createSkillEvolution } from "../../src/runtime/skillEvolution";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("phase18 skill evolution", () => {
  it("writes skill candidates after idle dream evolution", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-skill-int-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-skill-int-user-"));
    tempRoots.push(repoRoot, userHome);

    const dreamRuntime = createDreamRuntime({ repoRoot, userHome });
    const skillEvolution = createSkillEvolution({ repoRoot });
    const scheduler = createDreamScheduler({
      dreamRuntime,
      thresholdMinutes: 20,
      skillEvolution
    });

    const result = await scheduler.maybeRunIdleCycle({
      idleMinutes: 25,
      taskFailures: ["browser_outcome_not_reached"],
      memoryEntries: [{ id: "task-1", body: "Validate outcome before retrying browser actions." }]
    });
    const candidates = await skillEvolution.listCandidates();

    expect(result?.skillCandidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.summary).toContain("Validate outcome");
  });
});
