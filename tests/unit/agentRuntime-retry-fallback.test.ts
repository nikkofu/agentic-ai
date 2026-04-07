import { describe, expect, it, vi } from "vitest";

import { createAgentRuntime } from "../../src/agents/agentRuntime";

describe("agentRuntime retry and fallback", () => {
  it("retries on 429 and then succeeds", async () => {
    const sleep = vi.fn(async () => undefined);
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("openrouter_error:429:rate_limited"))
      .mockResolvedValueOnce({ outputText: "ok", raw: {} });

    const runtime = createAgentRuntime({ mode: "openrouter", generate, sleep });

    const result = await runtime.run({
      apiKey: "k",
      model: "primary/model",
      reasoner: "high",
      input: [{ role: "user", content: "hello" }],
      retry: { max_retries: 2, base_delay_ms: 1 }
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result.outputText).toBe("ok");
  });

  it("does not retry non-429 4xx errors", async () => {
    const sleep = vi.fn(async () => undefined);
    const generate = vi.fn().mockRejectedValue(new Error("openrouter_error:400:bad_request"));

    const runtime = createAgentRuntime({ mode: "openrouter", generate, sleep });

    await expect(
      runtime.run({
        apiKey: "k",
        model: "primary/model",
        reasoner: "high",
        input: [{ role: "user", content: "hello" }],
        retry: { max_retries: 2, base_delay_ms: 1 }
      })
    ).rejects.toThrow(/400/);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledTimes(0);
  });

  it("falls back to secondary model after retries exhausted", async () => {
    const sleep = vi.fn(async () => undefined);
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("openrouter_error:500:upstream"))
      .mockRejectedValueOnce(new Error("openrouter_error:500:upstream"))
      .mockResolvedValueOnce({ outputText: "from-fallback", raw: {} });

    const runtime = createAgentRuntime({ mode: "openrouter", generate, sleep });

    const result = await runtime.run({
      apiKey: "k",
      model: "primary/model",
      fallbackModels: ["secondary/model"],
      reasoner: "high",
      input: [{ role: "user", content: "hello" }],
      retry: { max_retries: 1, base_delay_ms: 1 }
    });

    expect(generate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "primary/model" })
    );
    expect(generate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "primary/model" })
    );
    expect(generate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ model: "secondary/model" })
    );
    expect(result.outputText).toBe("from-fallback");
  });
});
