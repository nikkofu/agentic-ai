import { describe, it, expect, vi } from "vitest";
import { createAgentRuntime } from "../../src/agents/agentRuntime";
import { RequestLimiter } from "../../src/core/limiter";

describe("AgentRuntime with Limiter", () => {
  it("should wait for limiter before calling generate", async () => {
    const limiter = new RequestLimiter({ capacity: 1, refillRatePerSecond: 10 });
    const generate = vi.fn().mockResolvedValue({ outputText: "ok", raw: {} });
    
    const runtime = createAgentRuntime({
      mode: "openrouter",
      generate,
      limiter
    });

    // Take the only token
    await limiter.acquire();

    const start = Date.now();
    // This call should be delayed by roughly 100ms (1/10s)
    const runPromise = runtime.run({
      apiKey: "test",
      model: "test",
      reasoner: "low",
      input: "test"
    });

    await runPromise;
    const duration = Date.now() - start;
    
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
