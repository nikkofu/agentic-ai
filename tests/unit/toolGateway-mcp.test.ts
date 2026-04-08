import { describe, it, expect, vi } from "vitest";
import { createToolGateway } from "../../src/tools/toolGateway";

describe("ToolGateway with McpHub", () => {
  it("routes MCP calls to McpHub.callTool", async () => {
    const mockMcpHub: any = {
      callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "result" }] })
    };
    const mockLocalRegistry: any = {};
    const gateway = createToolGateway(mockLocalRegistry, mockMcpHub);

    const result = await gateway.invoke({
      transport: "mcp",
      tool: "server1/test_tool",
      input: { arg1: "val1" }
    });

    expect(mockMcpHub.callTool).toHaveBeenCalledWith("server1/test_tool", { arg1: "val1" });
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ content: [{ type: "text", text: "result" }] });
  });
});
