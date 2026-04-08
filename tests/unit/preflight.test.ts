import { describe, expect, it } from "vitest";

import { runPreflightChecks } from "../../src/cli/preflight";

describe("runPreflightChecks", () => {
  it("fails with actionable guidance when OPENROUTER_API_KEY is missing", () => {
    const result = runPreflightChecks({ ...process.env, OPENROUTER_API_KEY: "" });

    expect(result.ok).toBe(false);
    expect(result.items.some((item) => item.key === "OPENROUTER_API_KEY" && item.status === "failed")).toBe(true);
    expect(result.fix).toContain("cp .env.example .env");
    expect(result.verify).toContain("npx tsx src/cli/runTask.ts --preflight");
  });

  it("passes when OPENROUTER_API_KEY exists", () => {
    const result = runPreflightChecks({ ...process.env, OPENROUTER_API_KEY: "k-test" });

    expect(result.ok).toBe(true);
    expect(result.items.every((item) => item.status === "ok")).toBe(true);
  });
});
