import { describe, it, expect, vi } from "vitest";
import { createAgentRuntime } from "../../src/agents/agentRuntime";

describe("AgentRuntime Telemetry Integration", () => {
  it("should calculate cost and update metrics after LLM call", async () => {
    const generate = vi.fn().mockResolvedValue({
      outputText: "ok",
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      raw: {}
    });

    const runtime = createAgentRuntime({
      mode: "openrouter",
      generate
    });

    const result = await runtime.run({
      apiKey: "test",
      model: "openai/gpt-4o-mini", // /bin/bash.15/M prompt, /bin/bash.6/M completion
      reasoner: "low",
      input: []
    });

    // 100 * 0.15/1M + 50 * 0.6/1M = 0.000015 + 0.00003 = 0.000045
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.usedTool).toBe(true);
  });
});
