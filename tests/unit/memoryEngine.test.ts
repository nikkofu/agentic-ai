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

  it("curates raw entries and compresses curated entries for a layer", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-user-"));
    tempRoots.push(repoRoot, userHome);

    const engine = createMemoryEngine({ repoRoot, userHome });
    await engine.record({
      layer: "project",
      state: "raw",
      kind: "decision",
      body: "Use verifier-enforced delivery."
    });
    await engine.record({
      layer: "project",
      state: "raw",
      kind: "decision",
      body: "Keep memory summaries visible."
    });

    const curated = await engine.curate({ layer: "project" });
    const compressed = await engine.compress({ layer: "project" });

    expect(curated.length).toBe(2);
    expect(curated.every((entry) => entry.state === "curated")).toBe(true);
    expect(compressed.state).toBe("compressed");
    expect(compressed.body).toContain("Use verifier-enforced delivery.");
    expect(compressed.body).toContain("Keep memory summaries visible.");
  });
});
