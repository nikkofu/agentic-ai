import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

import { runTask } from "../../src/cli/runTask";

afterEach(() => {
  fs.rmSync("artifacts/build-a-plan.md", { force: true });
  fs.rmSync("logs/runs", { recursive: true, force: true });
});

describe("runtime e2e", () => {
  it("runs full loop and returns execution summary", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async () => ({
      outputText: JSON.stringify({
        status: "completed",
        output_text: "ok",
        final_result: "ok",
        verification: ["mocked generation"],
        risks: [],
        next_actions: []
      }),
      raw: { ok: true }
    }));
    const result = await runTask({ input: "build a plan", generate });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.taskId).toBeTruthy();
    expect(result.finalState).toBe("completed");
    expect(result.outputText).toBe("ok");
    expect(result.delivery.status).toBe("completed");
    expect(result.delivery.final_result).toBe("ok");
    expect(result.delivery.verification).toEqual(["mocked generation"]);
    expect(result.delivery.blocking_reason).toBeUndefined();
    expect(result.delivery.artifacts.length).toBeGreaterThan(0);
    const artifactPath = result.delivery.artifacts[0];
    expect(artifactPath).toBe("artifacts/build-a-plan.md");
    expect(fs.existsSync(artifactPath)).toBe(true);
    expect(fs.readFileSync(artifactPath, "utf8").trim()).toContain("ok");

    expect(result.summary.nodeCount).toBeGreaterThanOrEqual(1);
    expect(result.summary.childSpawns).toBeGreaterThanOrEqual(1);
    expect(result.summary.toolCalls.localSuccess).toBeGreaterThanOrEqual(1);
    expect(result.summary.toolCalls.mcpSuccess).toBeGreaterThanOrEqual(1);
    expect(result.summary.evaluatorDecisions.length).toBeGreaterThanOrEqual(1);
    expect(result.summary.path.length).toBeGreaterThanOrEqual(1);
  });

  it("treats empty delivery as incomplete instead of completed", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async () => ({
      outputText: JSON.stringify({
        status: "completed",
        output_text: "",
        final_result: "",
        verification: [],
        risks: [],
        next_actions: []
      }),
      raw: { ok: true }
    }));

    const result = await runTask({ input: "empty delivery test", generate });

    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("empty_delivery");
    expect(result.delivery.artifacts).toEqual([]);
  });

  it("blocks research delivery when verification evidence is missing", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async () => ({
      outputText: JSON.stringify({
        status: "completed",
        output_text: "OpenClaw article draft",
        final_result: "OpenClaw article draft",
        verification: [],
        risks: [],
        next_actions: []
      }),
      raw: { ok: true }
    }));

    const result = await runTask({
      input: "调研 openclaw 并写文章",
      generate
    });

    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("verification_missing");
    expect(result.delivery.artifacts).toEqual([]);
  });
});
