import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runPreflightChecks } from "../../src/cli/preflight";

describe("runPreflightChecks", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fails when OPENROUTER_API_KEY is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    // Force NODE_ENV to something other than test to trigger the check
    process.env.NODE_ENV = "development";
    
    const result = await runPreflightChecks({ mcp_servers: {} } as any);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("OPENROUTER_API_KEY is missing from environment variables.");
  });

  it("passes when OPENROUTER_API_KEY exists", async () => {
    process.env.OPENROUTER_API_KEY = "sk-test";
    process.env.NODE_ENV = "development";
    
    const result = await runPreflightChecks({ mcp_servers: {} } as any);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
