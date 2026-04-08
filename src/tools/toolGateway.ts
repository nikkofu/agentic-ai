import type { LocalToolRegistry } from "./localToolRegistry";
import { McpError, type McpHub } from "./mcpHub";
import { checkPermission, UserContext } from "../core/auth";

type ToolCall = {
  transport: "local" | "mcp";
  tool: string;
  input: unknown;
};

type ToolResult = {
  ok: boolean;
  output: unknown;
  error?: {
    message: string;
    recoverable: boolean;
  };
  latencyMs: number;
  costMeta: {
    provider: string;
    tokens: number;
    usd: number;
  };
};

const RESTRICTED_RESOURCES = ["local/shell", "mcp/filesystem/write_file"];

export function createToolGateway(localRegistry: LocalToolRegistry, mcpHub: McpHub) {
  return {
    async invoke(call: ToolCall, user?: UserContext): Promise<ToolResult> {
      const startedAt = Date.now();
      
      const resourcePath = `${call.transport}/${call.tool}`;
      if (RESTRICTED_RESOURCES.some(r => resourcePath.startsWith(r))) {
        if (!user || !checkPermission(user, `admin:${resourcePath}`)) {
          return {
            ok: false,
            output: null,
            error: {
              message: `Permission denied for restricted resource: ${resourcePath}`,
              recoverable: false
            },
            latencyMs: Date.now() - startedAt,
            costMeta: { provider: "system", tokens: 0, usd: 0 }
          };
        }
      }

      if (call.transport === "local") {
        try {
          const tool = localRegistry.get(call.tool);
          if (!tool) throw new Error(`Local tool not found: ${call.tool}`);
          
          const output = await tool.run(call.input);
          return {
            ok: true,
            output,
            latencyMs: Date.now() - startedAt,
            costMeta: { provider: "local", tokens: 0, usd: 0 }
          };
        } catch (error) {
          return {
            ok: false,
            output: null,
            error: {
              message: error instanceof Error ? error.message : "Unknown local tool error",
              recoverable: true
            },
            latencyMs: Date.now() - startedAt,
            costMeta: { provider: "local", tokens: 0, usd: 0 }
          };
        }
      } else {
        try {
          const output = await mcpHub.callTool(call.tool, call.input);
          return {
            ok: true,
            output,
            latencyMs: Date.now() - startedAt,
            costMeta: { provider: "mcp", tokens: 0, usd: 0 }
          };
        } catch (error) {
          const isMcpError = error instanceof McpError;
          return {
            ok: false,
            output: null,
            error: {
              message: error instanceof Error ? error.message : "Unknown MCP error",
              recoverable: isMcpError && error.code !== "protocol"
            },
            latencyMs: Date.now() - startedAt,
            costMeta: { provider: "mcp", tokens: 0, usd: 0 }
          };
        }
      }
    }
  };
}
