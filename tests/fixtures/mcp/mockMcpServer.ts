import { McpError, type McpClient, type McpErrorMode } from "../../../src/tools/mcpClient";

type MockMode = McpErrorMode | "ok";

export function createMockMcpClient(options?: { mode?: MockMode }): McpClient {
  const mode = options?.mode ?? "ok";

  return {
    async invoke(tool: string, _input: unknown) {
      if (mode === "timeout") {
        throw new McpError("timeout", "MCP timed out");
      }

      if (mode === "auth") {
        throw new McpError("auth", "MCP auth failed");
      }

      if (mode === "protocol") {
        throw new McpError("protocol", "MCP protocol mismatch");
      }

      if (tool === "search_docs") {
        return { items: ["doc-a", "doc-b"] };
      }

      return { items: [] };
    }
  };
}
