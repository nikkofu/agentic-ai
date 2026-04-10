import { describe, expect, it } from "vitest";

import { buildMemoryInjectionSet } from "../../src/runtime/memoryInjection";

describe("memory injection", () => {
  it("injects compressed personal and project memory before task raw memory", () => {
    const injected = buildMemoryInjectionSet({
      personalCompressed: [{ id: "p1", body: "Prefers concise responses." }],
      projectCompressed: [{ id: "proj1", body: "Use verifier acceptance proof.", confidence: "high", status: "active" }],
      taskCurated: [{ id: "t1", body: "Latest join summary.", confidence: "medium", status: "active" }],
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

  it("deduplicates repeated bodies and keeps layer-priority ordering bounded", () => {
    const injected = buildMemoryInjectionSet({
      personalCompressed: [
        { id: "p1", body: "Shared summary." },
        { id: "p2", body: "Personal-only memory." }
      ],
      projectCompressed: [
        { id: "proj1", body: "Shared summary." },
        { id: "proj2", body: "Project-only memory.", confidence: "high", status: "active" }
      ],
      taskCurated: [
        { id: "t1", body: "Shared summary.", confidence: "medium", status: "active" },
        { id: "t2", body: "Task-only memory.", confidence: "medium", status: "active" }
      ]
    });

    expect(injected.combined.filter((entry) => entry.includes("Shared summary.")).length).toBe(1);
    expect(injected.combined[0]).toContain("personal");
    expect(injected.combined[1]).toContain("personal");
    expect(injected.combined[2]).toContain("project");
    expect(injected.combined[3]).toContain("task");
    expect(injected.combined).toHaveLength(4);
  });

  it("excludes stale, superseded, archived, and low-trust entries from active injection", () => {
    const injected = buildMemoryInjectionSet({
      projectCompressed: [
        { id: "proj1", body: "active summary", confidence: "high", status: "active" },
        { id: "proj2", body: "stale summary", confidence: "high", status: "stale" },
        { id: "proj3", body: "superseded summary", confidence: "high", status: "superseded" },
        { id: "proj4", body: "archived summary", confidence: "high", status: "archived" },
        { id: "proj5", body: "low trust summary", confidence: "low", status: "active" }
      ]
    });

    expect(injected.project).toHaveLength(1);
    expect(injected.project[0]).toContain("active summary");
  });
});
