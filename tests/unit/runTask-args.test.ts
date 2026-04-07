import { describe, expect, it } from "vitest";

import { parseRunTaskArgs } from "../../src/cli/runTask";

describe("parseRunTaskArgs", () => {
  it("reads --input long flag", () => {
    const parsed = parseRunTaskArgs(["--input", "hello world"]);
    expect(parsed.input).toBe("hello world");
  });

  it("reads -p short flag", () => {
    const parsed = parseRunTaskArgs(["-p", "hello short"]);
    expect(parsed.input).toBe("hello short");
  });
});
