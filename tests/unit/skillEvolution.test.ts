import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createSkillEvolution } from "../../src/runtime/skillEvolution";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("skill evolution", () => {
  it("persists structured skill candidates with confidence", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-skill-repo-"));
    tempRoots.push(repoRoot);

    const evolution = createSkillEvolution({ repoRoot });
    const candidates = await evolution.recordCandidates([
      {
        id: "candidate-1",
        sourceEntryIds: ["task-1", "task-2"],
        summary: "Validate browser outcome earlier.",
        procedure: ["Inspect page state", "Validate target outcome", "Retry only if outcome missing"],
        confidence: "high",
        status: "candidate"
      }
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.confidence).toBe("high");
    expect(fs.existsSync(path.join(repoRoot, "memory", "index", "skill-candidates.json"))).toBe(true);
  });
});
