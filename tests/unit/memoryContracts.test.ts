import { describe, expect, it } from "vitest";

import {
  defaultMemoryConfidence,
  defaultMemoryEntryStatus,
  defaultMemoryConfig,
  normalizeMemoryConfidence,
  normalizeMemoryEntryStatus,
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

  it("normalizes memory confidence and entry status", () => {
    expect(normalizeMemoryConfidence("high")).toBe("high");
    expect(normalizeMemoryConfidence("bad")).toBeNull();
    expect(normalizeMemoryEntryStatus("superseded")).toBe("superseded");
    expect(normalizeMemoryEntryStatus("bad")).toBeNull();
    expect(defaultMemoryConfidence()).toBe("medium");
    expect(defaultMemoryEntryStatus()).toBe("active");
  });

  it("provides evolution defaults", () => {
    const config = defaultMemoryConfig();

    expect(config.evolution.auto_promote_task_to_project).toBe(true);
    expect(config.evolution.auto_generate_skill_candidates).toBe(true);
    expect(config.evolution.min_reuse_count_for_project_promotion).toBe(1);
    expect(config.evolution.max_stale_days).toBe(30);
  });
});
