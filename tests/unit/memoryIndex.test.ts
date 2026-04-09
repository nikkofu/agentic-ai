import { describe, expect, it } from "vitest";

import { createMemoryIndex } from "../../src/runtime/memoryIndex";

describe("memory index", () => {
  it("stores and updates entries by id", () => {
    const index = createMemoryIndex();

    index.upsert({
      id: "proj-1",
      layer: "project",
      state: "curated",
      path: "memory/project/curated/proj-1.md"
    });

    expect(index.get("proj-1")?.path).toContain("proj-1.md");
    expect(index.list("project", "curated")).toHaveLength(1);
  });
});
