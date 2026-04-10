import { describe, expect, it, vi } from "vitest";

import { promoteExecutionSummaryToProjectMemory } from "../../src/runtime/memoryEvolution";

describe("memory evolution", () => {
  it("writes project raw memory and compresses after enough curated entries", async () => {
    const recordEntry = vi.fn().mockResolvedValue(undefined);
    const curate = vi.fn().mockResolvedValue([
      { id: "project-1", state: "curated", body: "existing" },
      { id: "project-2", state: "curated", body: "new summary" }
    ]);
    const compress = vi.fn().mockResolvedValue({
      id: "project-compressed-1",
      state: "compressed",
      body: "existing\n\nnew summary"
    });

    await promoteExecutionSummaryToProjectMemory({
      memoryStore: {
        recordEntry,
        curate,
        compress
      },
      taskId: "task-1",
      family: "research_writing",
      taskInput: "research topic",
      finalResult: "new summary"
    });

    expect(recordEntry).toHaveBeenCalledWith(expect.objectContaining({
      layer: "project",
      state: "raw",
      taskId: "task-1",
      tags: ["research_writing", "execution-summary"]
    }));
    expect(curate).toHaveBeenCalledWith({ layer: "project" });
    expect(compress).toHaveBeenCalledWith({ layer: "project" });
  });

  it("skips empty final results", async () => {
    const recordEntry = vi.fn().mockResolvedValue(undefined);

    await promoteExecutionSummaryToProjectMemory({
      memoryStore: {
        recordEntry,
        curate: vi.fn(),
        compress: vi.fn()
      },
      taskId: "task-1",
      family: "general",
      taskInput: "do something",
      finalResult: "   "
    });

    expect(recordEntry).not.toHaveBeenCalled();
  });
});
