import { describe, expect, it } from "vitest";

import { composePromptPayload } from "../../src/prompt/promptComposer";
import { createExecutionContext } from "../../src/runtime/context";

describe("composePromptPayload", () => {
  it("builds structured payload with required sections", () => {
    const payload = composePromptPayload({
      system: "system-rules",
      role: "planner",
      task: "plan a feature",
      context: ["ctx-a"],
      tools: ["tool-a"],
      memory: ["mem-a"],
      constraints: ["no-mock"],
      outputSchema: { type: "json", shape: { ok: "boolean" } }
    });

    expect(payload.system).toBe("system-rules");
    expect(payload.role).toBe("planner");
    expect(payload.task).toBe("plan a feature");
    expect(payload.context).toEqual(["ctx-a"]);
    expect(payload.tools).toEqual(["tool-a"]);
    expect(payload.memory).toEqual(["mem-a"]);
    expect(payload.constraints).toEqual(["no-mock"]);
    expect(payload.output_schema).toEqual({ type: "json", shape: { ok: "boolean" } });
  });

  it("renders a production prompt payload directly from execution context", () => {
    const context = createExecutionContext({
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "requires evidence-backed final article"
      },
      plan: {
        nodes: [
          { id: "node-root", role: "planner", input: "plan the work", depends_on: [] },
          { id: "node-write", role: "writer", input: "write the article", depends_on: ["node-root"] }
        ]
      },
      policy: {
        recommendedTools: ["web_search", "verify_sources"],
        requiredCapabilities: ["research", "verification", "writing"],
        verificationPolicy: "cite source urls in final draft"
      },
      node: {
        id: "node-write",
        role: "writer",
        input: "write the article",
        depends_on: ["node-root"]
      },
      task: "调研 openclaw 并写一篇适合知乎发布的文章",
      dependencyOutputs: ["research notes"],
      memoryRefs: ["mem://task/openclaw/node-research"],
      workingMemory: ["avoid hype", "prefer grounded comparisons"],
      retrievalContext: [
        {
          sourceId: "rag://openclaw/readme",
          content: "OpenClaw is an open-source agent runtime project.",
          relevance: 0.97
        }
      ]
    });

    const payload = composePromptPayload({ context });

    expect(payload.role).toBe("writer");
    expect(payload.task).toBe("调研 openclaw 并写一篇适合知乎发布的文章");
    expect(payload.context).toEqual(expect.arrayContaining([
      "node:write the article",
      "dependency:research notes"
    ]));
    expect(payload.tools).toEqual(["web_search", "verify_sources"]);
    expect(payload.memory).toEqual(expect.arrayContaining([
      "memref:mem://task/openclaw/node-research",
      "working:avoid hype",
      "retrieved:rag://openclaw/readme:OpenClaw is an open-source agent runtime project."
    ]));
    expect(payload.constraints).toEqual(expect.arrayContaining([
      "verification:cite source urls in final draft",
      "capability:research",
      "capability:writing"
    ]));
    expect(payload.output_schema).toEqual({
      type: "json",
      shape: {
        final_result: "string",
        verification: "string[]",
        artifacts: "string[]",
        risks: "string[]",
        next_actions: "string[]"
      }
    });
  });
});
