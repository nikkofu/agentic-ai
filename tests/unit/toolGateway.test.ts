import { describe, expect, it } from "vitest";

import { createToolGateway } from "../../src/tools/toolGateway";
import { createLocalToolRegistry } from "../../src/tools/localToolRegistry";
import { createMockMcpHub } from "../fixtures/mcp/mockMcpServer";
import { echoTool } from "../fixtures/localTools/echoTool";

describe("toolGateway", () => {
  it("normalizes successful local tool results", async () => {
    const localRegistry = createLocalToolRegistry([echoTool]);
    const gateway = createToolGateway(localRegistry, createMockMcpHub());

    const result = await gateway.invoke({
      transport: "local",
      tool: "echo",
      input: { text: "hello" }
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ text: "hello" });
    expect(result.error).toBeUndefined();
    expect(typeof result.latencyMs).toBe("number");
    expect(result.costMeta).toEqual({ provider: "local", tokens: 0, usd: 0 });
  });

  it("maps local tool not found to error shape", async () => {
    const localRegistry = createLocalToolRegistry([]);
    const gateway = createToolGateway(localRegistry, createMockMcpHub());

    const result = await gateway.invoke({
      transport: "local",
      tool: "missing",
      input: {}
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("LOCAL_TOOL_NOT_FOUND");
    expect(result.error?.recoverable).toBe(false);
  });

  it("normalizes successful MCP results", async () => {
    const localRegistry = createLocalToolRegistry([]);
    const gateway = createToolGateway(localRegistry, createMockMcpHub());

    const result = await gateway.invoke({
      transport: "mcp",
      tool: "docs/search_docs",
      input: { q: "agent" }
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ items: ["doc-a", "doc-b"] });
    expect(result.costMeta?.provider).toBe("mcp");
  });

  it("maps MCP timeout to recoverable error", async () => {
    const localRegistry = createLocalToolRegistry([]);
    const gateway = createToolGateway(localRegistry, createMockMcpHub({ mode: "timeout" }));

    const result = await gateway.invoke({
      transport: "mcp",
      tool: "docs/search_docs",
      input: { q: "agent" }
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("MCP_TIMEOUT");
    expect(result.error?.recoverable).toBe(true);
  });

  it("maps MCP auth errors to non-recoverable", async () => {
    const localRegistry = createLocalToolRegistry([]);
    const gateway = createToolGateway(localRegistry, createMockMcpHub({ mode: "auth" }));

    const result = await gateway.invoke({
      transport: "mcp",
      tool: "docs/search_docs",
      input: { q: "agent" }
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("MCP_AUTH");
    expect(result.error?.recoverable).toBe(false);
  });

  it("maps MCP protocol errors to non-recoverable", async () => {
    const localRegistry = createLocalToolRegistry([]);
    const gateway = createToolGateway(localRegistry, createMockMcpHub({ mode: "protocol" }));

    const result = await gateway.invoke({
      transport: "mcp",
      tool: "docs/search_docs",
      input: { q: "agent" }
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("MCP_PROTOCOL");
    expect(result.error?.recoverable).toBe(false);
  });
});
