import { describe, expect, it } from "vitest";

import { parseMemoryMarkdown, serializeMemoryMarkdown } from "../../src/runtime/memoryMarkdown";

describe("memory markdown", () => {
  it("round-trips frontmatter and body", () => {
    const text = serializeMemoryMarkdown({
      frontmatter: {
        id: "proj-1",
        layer: "project",
        state: "curated",
        kind: "architecture_decision",
        confidence: "high",
        tags: ["runtime"]
      },
      body: "# Title\n\nContent"
    });

    const parsed = parseMemoryMarkdown(text);
    expect(parsed.frontmatter.id).toBe("proj-1");
    expect(parsed.frontmatter.layer).toBe("project");
    expect(parsed.frontmatter.tags).toEqual(["runtime"]);
    expect(parsed.body).toContain("Content");
  });
});
