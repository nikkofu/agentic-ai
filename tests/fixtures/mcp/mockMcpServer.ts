import { McpError, type McpClient, type McpErrorMode } from "../../../src/tools/mcpClient";
import type { McpHub } from "../../../src/tools/mcpHub";

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

export function createMockMcpHub(options?: { mode?: MockMode }): McpHub {
  const mode = options?.mode ?? "ok";

  return {
    async initialize() {
      return Promise.resolve();
    },
    async closeAll() {
      return Promise.resolve();
    },
    async callTool(fullName: string, _args: any) {
      if (mode === "timeout") {
        throw new McpError("timeout", "MCP timed out");
      }

      if (mode === "auth") {
        throw new McpError("auth", "MCP auth failed");
      }

      if (mode === "protocol") {
        throw new McpError("protocol", "MCP protocol mismatch");
      }

      // 简单支持 search_docs 的模拟，忽略 server 名称
      if (fullName.includes("search_docs")) {
        return { items: ["doc-a", "doc-b"] };
      }

      return { items: [] };
    }
  } as unknown as McpHub;
}
