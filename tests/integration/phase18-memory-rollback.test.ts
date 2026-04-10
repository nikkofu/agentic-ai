import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createMemoryEngine } from "../../src/runtime/memoryEngine";
import { createMemoryHistory } from "../../src/runtime/memoryHistory";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("phase18 memory rollback", () => {
  it("marks entries superseded and restores them through rollback", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-rollback-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-rollback-user-"));
    tempRoots.push(repoRoot, userHome);

    const engine = createMemoryEngine({ repoRoot, userHome });
    const history = createMemoryHistory({ repoRoot });
    const oldEntry = await engine.record({
      layer: "project",
      state: "curated",
      kind: "decision",
      body: "Old stable summary."
    });
    const newEntry = await engine.record({
      layer: "project",
      state: "curated",
      kind: "decision",
      body: "New stable summary."
    });

    await engine.markSuperseded({
      id: oldEntry.id,
      supersededBy: newEntry.id
    });
    await engine.restore({
      id: oldEntry.id
    });

    const restored = (await engine.retrieve({ layer: "project", state: "curated" }))
      .find((entry) => entry.id === oldEntry.id);
    const historyEvents = await history.list({ entryId: oldEntry.id });

    expect(restored?.status).toBe("active");
    expect(historyEvents.some((event) => event.kind === "mark_superseded")).toBe(true);
    expect(historyEvents.some((event) => event.kind === "restore")).toBe(true);
  });
});
