import { describe, expect, it } from "vitest";

import { createExecutionContext } from "../../src/runtime/context";

describe("execution context", () => {
  it("builds a stable execution context from intent, plan, policy, and node", () => {
    const context = createExecutionContext({
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "needs staged execution"
      },
      plan: {
        nodes: [
          { id: "node-root", role: "planner", input: "plan", depends_on: [] },
          { id: "node-write", role: "writer", input: "write", depends_on: ["node-root"] }
        ]
      },
      policy: {
        recommendedTools: ["web_search"],
        requiredCapabilities: ["research", "writing"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-write",
        role: "writer",
        input: "write",
        depends_on: ["node-root"]
      },
      task: "调研项目并写文章",
      dependencyOutputs: ["research notes"],
      memoryRefs: ["mem://task/123"],
      workingMemory: ["keep tone concise", "prefer cited facts"],
      retrievalContext: [
        {
          sourceId: "rag://openclaw/readme",
          content: "OpenClaw is an open-source project focused on agent runtime orchestration.",
          relevance: 0.92
        }
      ]
    });

    expect(context.node.id).toBe("node-write");
    expect(context.policy?.recommendedTools).toEqual(["web_search"]);
    expect(context.dependencyOutputs).toEqual(["research notes"]);
    expect(context.memoryRefs).toEqual(["mem://task/123"]);
    expect(context.workingMemory).toEqual(["keep tone concise", "prefer cited facts"]);
    expect(context.retrievalContext?.[0]?.sourceId).toBe("rag://openclaw/readme");
  });
});
