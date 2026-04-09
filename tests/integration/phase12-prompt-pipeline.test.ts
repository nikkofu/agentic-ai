import { describe, expect, it, vi } from "vitest";

import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";
import { createExecutionContext } from "../../src/runtime/context";

describe("phase 12 prompt pipeline", () => {
  it("passes a structured prompt payload derived from execution context into runtime calls", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          final_result: "article draft",
          verification: ["https://github.com/openclaw/openclaw"],
          artifacts: [],
          risks: [],
          next_actions: []
        })
      })
    };

    const orchestrator = createOrchestrator({
      eventBus,
      eventLogStore,
      guardrails: {
        max_depth: 4,
        max_branch: 3,
        max_steps: 60,
        max_budget: 5
      },
      runtime: runtime as any
    });

    const context = createExecutionContext({
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "needs grounded evidence"
      },
      plan: {
        nodes: [
          { id: "node-root", role: "planner", input: "plan", depends_on: [] },
          { id: "node-write", role: "writer", input: "write article", depends_on: ["node-root"] }
        ]
      },
      policy: {
        recommendedTools: ["web_search", "verify_sources"],
        requiredCapabilities: ["research", "verification", "writing"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-write",
        role: "writer",
        input: "write article",
        depends_on: ["node-root"]
      },
      task: "调研 openclaw 并写文章",
      dependencyOutputs: ["research notes"],
      memoryRefs: ["mem://task/openclaw/node-research"],
      workingMemory: ["avoid hype"],
      retrievalContext: [
        {
          sourceId: "rag://openclaw/readme",
          content: "OpenClaw is an open-source agent runtime project.",
          relevance: 0.91
        }
      ]
    });

    await orchestrator.runSingleNodeContext({
      taskId: "task-prompt-pipeline",
      context,
      resolveRuntimeInput: ({ runtimeInput }) => ({
        ...runtimeInput,
        model: "writer-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    expect(runtime.run).toHaveBeenCalledTimes(1);
    expect(runtime.run.mock.calls[0][0].__prompt).toEqual(expect.objectContaining({
      role: "writer",
      task: "调研 openclaw 并写文章",
      tools: ["web_search", "verify_sources"],
      context: expect.arrayContaining(["node:write article", "dependency:research notes"]),
      memory: expect.arrayContaining([
        "memref:mem://task/openclaw/node-research",
        "working:avoid hype",
        "retrieved:rag://openclaw/readme:OpenClaw is an open-source agent runtime project."
      ]),
      constraints: expect.arrayContaining(["verification:cite urls", "capability:verification"]),
      output_schema: {
        type: "json",
        shape: {
          final_result: "string",
          verification: "string[]",
          artifacts: "string[]",
          risks: "string[]",
          next_actions: "string[]"
        }
      }
    }));
    expect(runtime.run.mock.calls[0][0].input?.[0]?.content).toContain("cite urls");
  });
});
