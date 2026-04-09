import { describe, expect, it } from "vitest";

import { buildMemoryInjectionSet } from "../../src/runtime/memoryInjection";

describe("memory injection", () => {
  it("injects compressed personal and project memory before task raw memory", () => {
    const injected = buildMemoryInjectionSet({
      personalCompressed: [{ id: "p1", body: "Prefers concise responses." }],
      projectCompressed: [{ id: "proj1", body: "Use verifier acceptance proof." }],
      taskCurated: [{ id: "t1", body: "Latest join summary." }],
      taskRaw: [{ id: "traw", body: "verbose raw detail" }]
    });

    expect(injected.personal).toHaveLength(1);
    expect(injected.project).toHaveLength(1);
    expect(injected.task).toHaveLength(1);
    expect(injected.combined[0]).toContain("personal");
    expect(injected.combined[1]).toContain("project");
    expect(injected.combined[2]).toContain("task");
    expect(injected.combined.some((entry) => entry.includes("verbose raw detail"))).toBe(false);
  });
});
