import { RuntimeConfig } from "../types/runtime";

export interface PreflightResult {
  ok: boolean;
  errors?: string[];
}

export async function runPreflightChecks(config: RuntimeConfig): Promise<PreflightResult> {
  const errors: string[] = [];

  // Check API Key
  if (!process.env.OPENROUTER_API_KEY && process.env.NODE_ENV !== "test") {
    errors.push("OPENROUTER_API_KEY is missing from environment variables.");
  }

  // Check MCP Servers (Basic check)
  if (config.mcp_servers) {
    // Conceptually check if commands exist
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
