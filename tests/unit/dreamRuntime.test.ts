import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDreamRuntime } from "../../src/runtime/dreamRuntime";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("dream runtime", () => {
  it("creates reflection artifacts without external actions", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-dream-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-dream-user-"));
    tempRoots.push(repoRoot, userHome);

    const dream = createDreamRuntime({ repoRoot, userHome });
    const result = await dream.runIdleCycle({
      idleMinutes: 30,
      taskFailures: ["browser_outcome_not_reached"],
      memoryEntries: []
    });

    expect(result.reflections.length).toBeGreaterThan(0);
    expect(result.externalActionsAttempted).toBe(0);
  });

  it("produces structured skill candidates from memory entries", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-dream-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-dream-user-"));
    tempRoots.push(repoRoot, userHome);

    const dream = createDreamRuntime({ repoRoot, userHome });
    const result = await dream.runIdleCycle({
      idleMinutes: 30,
      taskFailures: [],
      memoryEntries: [
        { id: "task-1", body: "Validate outcome before retrying browser actions." },
        { id: "task-2", body: "Validate outcome before retrying browser actions." }
      ]
    });

    expect(result.skillCandidates.length).toBeGreaterThan(0);
    expect(result.skillCandidates[0]?.sourceEntryIds).toContain("task-1");
  });
});
