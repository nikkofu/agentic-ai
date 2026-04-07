import { describe, expect, it, vi } from "vitest";
import { createToolGateway } from "../../src/tools/toolGateway";
import { createLocalToolRegistry } from "../../src/tools/localToolRegistry";
import type { McpHub } from "../../src/tools/mcpHub";

describe("ToolGateway with McpHub", () => {
  it("routes MCP calls to McpHub.callTool", async () => {
    const localRegistry = createLocalToolRegistry([]);
    // 模拟 McpHub
    const mockMcpHub = {
      callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "result" }] }),
      initialize: vi.fn(),
      closeAll: vi.fn()
    } as unknown as any;

    const gateway = createToolGateway(localRegistry, mockMcpHub as any);

    const result = await gateway.invoke({
      transport: "mcp",
      tool: "server1/test_tool",
      input: { arg1: "val1" }
    });

    expect(mockMcpHub.callTool).toHaveBeenCalledWith("server1/test_tool", { arg1: "val1" });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ content: [{ type: "text", text: "result" }] });
  });

  it("handles McpHub errors and maps them to ToolResult", async () => {
    const localRegistry = createLocalToolRegistry([]);
    const mockMcpHub = {
      callTool: vi.fn().mockRejectedValue(new Error("Server not found")),
      initialize: vi.fn(),
      closeAll: vi.fn()
    } as unknown as any;

    const gateway = createToolGateway(localRegistry, mockMcpHub as any);

    const result = await gateway.invoke({
      transport: "mcp",
      tool: "unknown/tool",
      input: {}
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("MCP_UNKNOWN");
    expect(result.error?.message).toContain("Server not found");
  });
});
