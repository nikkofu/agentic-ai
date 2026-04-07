import { describe, it, expect, vi } from "vitest";
import { generateWithOpenRouter } from "../../src/model/openrouterClient";

describe("OpenRouter Usage Extraction", () => {
  it("should extract usage tokens correctly", async () => {
    const mockResponse = {
      output_text: "hello",
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await generateWithOpenRouter({
      apiKey: "test",
      model: "test",
      reasoner: "low",
      input: []
    });

    expect(result.usage.prompt_tokens).toBe(10);
    expect(result.usage.completion_tokens).toBe(5);
    expect(result.usage.total_tokens).toBe(15);
  });

  it("should default to 0 if usage is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ output_text: "hello" })
    });

    const result = await generateWithOpenRouter({
      apiKey: "test",
      model: "test",
      reasoner: "low",
      input: []
    });

    expect(result.usage.total_tokens).toBe(0);
  });
});
