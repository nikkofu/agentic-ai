import { describe, expect, it, vi } from "vitest";

import { createAgentRuntime } from "../../src/agents/agentRuntime";

describe("agentRuntime openrouter mode", () => {
  it("calls generator with apiKey/model/reasoner/input", async () => {
    const generate = vi.fn(async () => ({ outputText: "ok", raw: { ok: true } }));
    const runtime = createAgentRuntime({ mode: "openrouter", generate });

    const result = await runtime.run({
      apiKey: "k-test",
      model: "qwen/qwen3.6-plus:free",
      reasoner: "high",
      input: [{ role: "user", content: "hello" }]
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith({
      apiKey: "k-test",
      model: "qwen/qwen3.6-plus:free",
      reasoner: "high",
      input: [{ role: "user", content: "hello" }]
    });
    expect(result.evaluation).toBe("pass");
    expect(result.outputText).toBe("ok");
  });

  it("throws when api key missing in openrouter mode", async () => {
    const runtime = createAgentRuntime({ mode: "openrouter", generate: async () => ({ outputText: "x", raw: {} }) });

    await expect(
      runtime.run({ model: "qwen/qwen3.6-plus:free", reasoner: "high", input: [] })
    ).rejects.toThrow("OPENROUTER_API_KEY is required");
  });
});
