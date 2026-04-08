import { describe, it, expect, vi, beforeEach } from "vitest";
import { createToolGateway } from "../../src/tools/toolGateway";
import { McpError } from "../../src/tools/mcpHub";

describe("toolGateway", () => {
  let mockLocalRegistry: any;
  let mockMcpHub: any;
  let gateway: any;

  beforeEach(() => {
    mockLocalRegistry = {
      get: vi.fn()
    };
    mockMcpHub = {
      callTool: vi.fn()
    };
    gateway = createToolGateway(mockLocalRegistry, mockMcpHub);
  });

  it("normalizes successful local tool results", async () => {
    mockLocalRegistry.get.mockReturnValue({
      run: vi.fn().mockResolvedValue({ text: "hello" })
    });

    const result = await gateway.invoke({ transport: "local", tool: "echo", input: {} });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ text: "hello" });
    expect(result.error).toBeUndefined();
  });

  it("maps local tool not found to error shape", async () => {
    mockLocalRegistry.get.mockReturnValue(null);

    const result = await gateway.invoke({ transport: "local", tool: "unknown", input: {} });

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain("Local tool not found");
  });

  it("normalizes successful MCP results", async () => {
    mockMcpHub.callTool.mockResolvedValue({ items: ["doc-a", "doc-b"] });

    const result = await gateway.invoke({ transport: "mcp", tool: "search", input: {} });

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ items: ["doc-a", "doc-b"] });
  });

  it("maps MCP timeout to recoverable error", async () => {
    mockMcpHub.callTool.mockRejectedValue(new McpError("timeout", "timeout"));

    const result = await gateway.invoke({ transport: "mcp", tool: "slow", input: {} });

    expect(result.ok).toBe(false);
    expect(result.error?.recoverable).toBe(true);
  });

  it("maps MCP protocol errors to non-recoverable", async () => {
    mockMcpHub.callTool.mockRejectedValue(new McpError("protocol", "protocol error"));

    const result = await gateway.invoke({ transport: "mcp", tool: "broken", input: {} });

    expect(result.ok).toBe(false);
    expect(result.error?.recoverable).toBe(false);
  });
});
