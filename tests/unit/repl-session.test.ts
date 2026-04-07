import { describe, expect, it } from "vitest";

import { parseRunTaskArgs, processReplCommand } from "../../src/cli/runTask";

describe("runTask repl args", () => {
  it("parses --repl flag", () => {
    const parsed = parseRunTaskArgs(["--repl"]);
    expect(parsed.repl).toBe(true);
  });

  it("still parses prompt with -p while --repl is present", () => {
    const parsed = parseRunTaskArgs(["--repl", "-p", "hello"]);
    expect(parsed.repl).toBe(true);
    expect(parsed.input).toBe("hello");
  });
});

describe("repl command processor", () => {
  it("handles /approve command", () => {
    const result = processReplCommand("/approve");
    expect(result.action).toBe("approve");
  });

  it("handles /reject command", () => {
    const result = processReplCommand("/reject");
    expect(result.action).toBe("reject");
  });

  it("handles /exit command", () => {
    const result = processReplCommand("/exit");
    expect(result.action).toBe("exit");
  });

  it("treats other input as prompt", () => {
    const result = processReplCommand("build a plan");
    expect(result.action).toBe("prompt");
    if (result.action === "prompt") {
      expect(result.prompt).toBe("build a plan");
    }
  });
});
