import { describe, expect, it, vi } from "vitest";

import { runTask } from "../../src/cli/runTask";

describe("runtime e2e", () => {
  it("runs full loop and returns execution summary", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async () => ({ outputText: "ok", raw: { ok: true } }));
    const result = await runTask({ input: "build a plan", generate });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.taskId).toBeTruthy();
    expect(result.finalState).toBe("completed");

    expect(result.summary.nodeCount).toBeGreaterThanOrEqual(1);
    expect(result.summary.childSpawns).toBeGreaterThanOrEqual(1);
    expect(result.summary.toolCalls.localSuccess).toBeGreaterThanOrEqual(1);
    expect(result.summary.toolCalls.mcpSuccess).toBeGreaterThanOrEqual(1);
    expect(result.summary.evaluatorDecisions.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.path.length).toBeGreaterThanOrEqual(1);
  });
});
