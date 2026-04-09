import { describe, expect, it, vi } from "vitest";

import { buildWorkflowFromIntent, normalizeJoinDecision, planWorkflowFromPlanner } from "../../src/runtime/plan";
import type { TaskIntent } from "../../src/runtime/intent";
import { normalizePlannerPolicy } from "../../src/runtime/policy";

describe("runtime planning", () => {
  it("builds a fallback workflow from tree intent", () => {
    const intent: TaskIntent = {
      task_kind: "research_writing",
      execution_mode: "tree",
      roles: ["planner", "researcher", "writer"],
      needs_verification: true,
      reason: "needs staged execution"
    };

    const workflow = buildWorkflowFromIntent(intent, "调研项目并写文章");

    expect(workflow?.nodes.map((node) => node.id)).toEqual([
      "node-root",
      "node-research",
      "node-verify",
      "node-write"
    ]);
  });

  it("lets planner produce child nodes and policy", async () => {
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          summary: "planner summary",
          recommended_tools: ["web_search", "verify_sources"],
          required_capabilities: ["research", "verification"],
          verification_policy: "cite urls",
          spawn_children: [
            {
              id: "node-research",
              role: "researcher",
              input: "Research first",
              depends_on: ["node-root"]
            },
            {
              id: "node-write",
              role: "writer",
              input: "Write final output",
              depends_on: ["node-research"]
            }
          ]
        })
      })
    };

    const plan = await planWorkflowFromPlanner({
      task: "调研项目并写文章",
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "needs staged execution"
      },
      availableTools: ["web_search", "verify_sources", "page_fetch"],
      runtime: runtime as any,
      runtimeInput: { model: "mock-model" }
    });

    expect(plan?.recommendedTools).toEqual(["web_search", "verify_sources"]);
    expect(plan?.requiredCapabilities).toEqual(["research", "verification"]);
    expect(plan?.verificationPolicy).toBe("cite urls");
    expect(plan?.nodes.map((node) => node.id)).toEqual(["node-root", "node-research", "node-write"]);
  });

  it("normalizes deeper planner policy constraints for runtime enforcement", () => {
    const policy = normalizePlannerPolicy({
      recommended_tools: ["web_search"],
      required_capabilities: ["research", "writing"],
      verification_policy: "cite urls",
      max_revisions: 1,
      require_artifacts: true
    });

    expect(policy).toEqual({
      recommendedTools: ["web_search"],
      requiredCapabilities: ["research", "writing"],
      verificationPolicy: "cite urls",
      maxRevisions: 1,
      requireArtifacts: true
    });
  });

  it("normalizes planner join decisions into typed runtime actions", () => {
    expect(normalizeJoinDecision("deliver")).toBe("deliver");
    expect(normalizeJoinDecision("revise_child")).toBe("revise_child");
    expect(normalizeJoinDecision("spawn_more")).toBe("spawn_more");
    expect(normalizeJoinDecision("block")).toBe("block");
    expect(normalizeJoinDecision("whatever")).toBe("block");
  });
});
