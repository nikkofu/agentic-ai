import { describe, expect, it } from "vitest";

import {
  defaultMemoryConfig,
  normalizeMemoryLayer,
  normalizeMemoryState
} from "../../src/runtime/memoryContracts";
import { resolveMemoryRoot } from "../../src/runtime/memoryPaths";

describe("memory contracts", () => {
  it("normalizes memory layers and states", () => {
    expect(normalizeMemoryLayer("project")).toBe("project");
    expect(normalizeMemoryLayer("bad")).toBeNull();
    expect(normalizeMemoryState("compressed")).toBe("compressed");
    expect(normalizeMemoryState("bad")).toBeNull();
  });

  it("provides full-auto defaults", () => {
    const config = defaultMemoryConfig();

    expect(config.automation).toBe("full_auto");
    expect(config.dream.enabled).toBe(true);
    expect(config.personal.auto_record).toBe(true);
    expect(config.project.auto_curate).toBe(true);
    expect(config.task.auto_compress).toBe(true);
  });

  it("resolves project and personal roots", () => {
    const roots = resolveMemoryRoot("/repo", "/home/user");

    expect(roots.projectRoot).toContain("/repo/memory/project");
    expect(roots.personalRoot).toContain("/home/user/.agentic-ai/memory/personal");
    expect(roots.taskRoot).toContain("/repo/memory/task");
    expect(roots.dreamRoot).toContain("/repo/memory/dream");
  });
});
