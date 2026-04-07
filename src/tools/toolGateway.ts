import type { LocalToolRegistry } from "./localToolRegistry";
import { McpError, type McpClient } from "./mcpClient";

type ToolCall = {
  transport: "local" | "mcp";
  tool: string;
  input: unknown;
};

type ToolResult = {
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  latencyMs: number;
  costMeta: {
    provider: "local" | "mcp";
    tokens: number;
    usd: number;
  };
};

export function createToolGateway(localRegistry: LocalToolRegistry, mcpClient: McpClient) {
  return {
    async invoke(call: ToolCall): Promise<ToolResult> {
      const startedAt = Date.now();

      if (call.transport === "local") {
        const tool = localRegistry.get(call.tool);

        if (!tool) {
          return {
            ok: false,
            error: {
              code: "LOCAL_TOOL_NOT_FOUND",
              message: `Local tool not found: ${call.tool}`,
              recoverable: false
            },
            latencyMs: Date.now() - startedAt,
            costMeta: { provider: "local", tokens: 0, usd: 0 }
          };
        }

        const data = await tool.run(call.input);

        return {
          ok: true,
          data,
          latencyMs: Date.now() - startedAt,
          costMeta: { provider: "local", tokens: 0, usd: 0 }
        };
      }

      try {
        const data = await mcpClient.invoke(call.tool, call.input);

        return {
          ok: true,
          data,
          latencyMs: Date.now() - startedAt,
          costMeta: { provider: "mcp", tokens: 0, usd: 0 }
        };
      } catch (error) {
        if (error instanceof McpError) {
          if (error.code === "timeout") {
            return {
              ok: false,
              error: {
                code: "MCP_TIMEOUT",
                message: error.message,
                recoverable: true
              },
              latencyMs: Date.now() - startedAt,
              costMeta: { provider: "mcp", tokens: 0, usd: 0 }
            };
          }

          if (error.code === "auth") {
            return {
              ok: false,
              error: {
                code: "MCP_AUTH",
                message: error.message,
                recoverable: false
              },
              latencyMs: Date.now() - startedAt,
              costMeta: { provider: "mcp", tokens: 0, usd: 0 }
            };
          }

          return {
            ok: false,
            error: {
              code: "MCP_PROTOCOL",
              message: error.message,
              recoverable: false
            },
            latencyMs: Date.now() - startedAt,
            costMeta: { provider: "mcp", tokens: 0, usd: 0 }
          };
        }

        return {
          ok: false,
          error: {
            code: "MCP_UNKNOWN",
            message: error instanceof Error ? error.message : "Unknown MCP error",
            recoverable: false
          },
          latencyMs: Date.now() - startedAt,
          costMeta: { provider: "mcp", tokens: 0, usd: 0 }
        };
      }
    }
  };
}
