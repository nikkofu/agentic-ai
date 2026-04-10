import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createMemoryHistory } from "../../src/runtime/memoryHistory";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("memory history", () => {
  it("records evolution actions and can list them per entry", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-history-repo-"));
    tempRoots.push(repoRoot);

    const history = createMemoryHistory({ repoRoot });
    await history.append({
      kind: "promote",
      entryId: "entry-1",
      toLayer: "project",
      toState: "curated"
    });
    await history.append({
      kind: "mark_stale",
      entryId: "entry-1",
      reason: "old"
    });

    const events = await history.list({ entryId: "entry-1" });

    expect(events).toHaveLength(2);
    expect(events[0]?.kind).toBe("promote");
    expect(events[1]?.kind).toBe("mark_stale");
  });
});
