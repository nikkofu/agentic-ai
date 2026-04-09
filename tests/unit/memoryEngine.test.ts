import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { createMemoryEngine } from "../../src/runtime/memoryEngine";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("memory engine", () => {
  it("records task memory into raw state", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-user-"));
    tempRoots.push(repoRoot, userHome);

    const engine = createMemoryEngine({ repoRoot, userHome });
    const entry = await engine.record({
      layer: "task",
      state: "raw",
      taskId: "task-1",
      kind: "node_summary",
      body: "node output"
    });

    expect(entry.layer).toBe("task");
    expect(entry.state).toBe("raw");
    expect(fs.existsSync(path.resolve(entry.path))).toBe(true);
  });

  it("promotes raw memory to curated memory", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-user-"));
    tempRoots.push(repoRoot, userHome);

    const engine = createMemoryEngine({ repoRoot, userHome });
    const entry = await engine.record({
      layer: "project",
      state: "raw",
      kind: "known_issue",
      body: "retry with lower concurrency"
    });

    const promoted = await engine.promote({ id: entry.id, toState: "curated" });
    expect(promoted.state).toBe("curated");
    expect(promoted.path).toContain("/memory/project/curated/");
  });
});
