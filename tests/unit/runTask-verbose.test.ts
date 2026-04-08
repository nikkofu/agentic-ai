import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { runTask } from "../../src/cli/runTask";
import { WebHub } from "../../src/core/webHub";

afterEach(() => {
  fs.rmSync("artifacts/verbose-test.md", { force: true });
  fs.rmSync("artifacts/port-in-use-test.md", { force: true });
  fs.rmSync("logs/runs", { recursive: true, force: true });
});

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

  it("continues when websocket port is already in use", async () => {
    process.env.OPENROUTER_API_KEY = "k-test";

    const generate = vi.fn(async () => ({ outputText: "ok", raw: { ok: true } }));
    const err = Object.assign(new Error("listen EADDRINUSE: address already in use :::3001"), {
      code: "EADDRINUSE"
    });

    const startSpy = vi.spyOn(WebHub.prototype, "start").mockRejectedValue(err);

    await expect(
      runTask({
        input: "port in use test",
        generate
      })
    ).resolves.toMatchObject({ finalState: "completed" });

    startSpy.mockRestore();
  });
});
