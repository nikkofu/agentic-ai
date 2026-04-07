import { describe, expect, it, vi } from "vitest";

import { runTask } from "../../src/cli/runTask";

describe("runTask verbose mode", () => {
  it("streams human-readable event lines and still returns summary", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const generate = vi.fn(async () => ({ outputText: "ok", raw: { ok: true } }));

    const result = await runTask({
      input: "verbose test",
      generate,
      verbose: true
    });

    expect(result.finalState).toBe("completed");
    expect(logSpy).toHaveBeenCalled();

    const printed = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(printed).toMatch(/TaskSubmitted|NodeScheduled|ModelCalled|TaskClosed/);

    logSpy.mockRestore();
  });
});
