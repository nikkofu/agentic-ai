import { describe, expect, it } from "vitest";

import { createToolGateway } from "../../src/tools/toolGateway";
import { createLocalToolRegistry } from "../../src/tools/localToolRegistry";
import { createInMemoryAuditTrail } from "../../src/core/auditTrail";
import { createMockMcpHub } from "../fixtures/mcp/mockMcpServer";

describe("auditTrail", () => {
  it("writes audit records for high-risk MCP tool actions", async () => {
    const auditTrail = createInMemoryAuditTrail();
    const gateway = createToolGateway(createLocalToolRegistry([]), createMockMcpHub(), auditTrail);

    const result = await gateway.invoke({
      transport: "mcp",
      tool: "docs/search_docs",
      input: { q: "agent" }
    });

    expect(result.ok).toBe(true);
    const records = auditTrail.getAll();
    expect(records.length).toBe(2);
    expect(records[0].phase).toBe("before");
    expect(records[1].phase).toBe("after");
    expect(records[1].ok).toBe(true);
  });

  it("does not write records for low-risk local tools", async () => {
    const auditTrail = createInMemoryAuditTrail();
    const gateway = createToolGateway(createLocalToolRegistry([{ name: "echo", run: (input) => input }]), createMockMcpHub(), auditTrail);

    await gateway.invoke({
      transport: "local",
      tool: "echo",
      input: { text: "hello" }
    });

    expect(auditTrail.getAll()).toHaveLength(0);
  });
});
