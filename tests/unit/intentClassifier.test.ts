import { describe, expect, it, vi } from "vitest";

import { classifyIntent } from "../../src/core/intentClassifier";

describe("intent classifier", () => {
  it("parses a structured tree intent from the model", async () => {
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          task_kind: "research_writing",
          execution_mode: "tree",
          roles: ["planner", "researcher", "writer"],
          needs_verification: true,
          reason: "staged research and delivery"
        })
      })
    };

    const result = await classifyIntent({
      task: "调研 openclaw 并写一篇知乎文章",
      runtime: runtime as any,
      runtimeInput: { model: "mock-model" }
    });

    expect(result.task_kind).toBe("research_writing");
    expect(result.execution_mode).toBe("tree");
    expect(result.roles).toEqual(["planner", "researcher", "writer"]);
    expect(result.needs_verification).toBe(true);
  });

  it("falls back to single-node general execution when parsing fails", async () => {
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: "not-json"
      })
    };

    const result = await classifyIntent({
      task: "do something",
      runtime: runtime as any,
      runtimeInput: { model: "mock-model" }
    });

    expect(result.execution_mode).toBe("single_node");
    expect(result.roles).toEqual(["planner"]);
    expect(result.reason).toBe("classifier_fallback");
  });

  it("accepts competitive research as a first-class family intent", async () => {
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          task_kind: "competitive_research",
          execution_mode: "tree",
          roles: ["planner", "researcher", "writer"],
          needs_verification: true,
          reason: "comparative package required"
        })
      })
    };

    const result = await classifyIntent({
      task: "对比 OpenClaw、Hermes Agent 和本项目的产品差异",
      runtime: runtime as any,
      runtimeInput: { model: "mock-model" }
    });

    expect(result.task_kind).toBe("competitive_research");
    expect(result.execution_mode).toBe("tree");
    expect(result.roles).toEqual(["planner", "researcher", "writer"]);
    expect(result.needs_verification).toBe(true);
  });
});
