import { describe, expect, it, vi } from "vitest";

import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";

describe("orchestrator autonomous loop", () => {
  it("re-enters the model after a structured tool call and exits with delivered output", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            status: "thinking",
            thought: "Need repository context",
            tool_calls: [
              {
                transport: "local",
                tool: "echo",
                input: { text: "repo summary" }
              }
            ]
          })
        })
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            status: "completed",
            output_text: "final answer",
            final_result: "final answer",
            verification: ["echo tool returned repo summary"],
            risks: [],
            next_actions: []
          })
        })
    };
    const toolGateway = {
      invoke: vi.fn().mockResolvedValue({
        ok: true,
        output: { text: "repo summary" },
        latencyMs: 1,
        costMeta: { provider: "local", tokens: 0, usd: 0 }
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
      runtime: runtime as any,
      toolGateway
    });

    const result = await orchestrator.runSingleNodeTask({
      taskId: "task-loop-1",
      nodeId: "node-1",
      role: "planner",
      runtimeInput: {
        model: "mock-model",
        reasoner: "medium",
        input: [{ role: "user", content: "solve task" }]
      }
    });

    expect(runtime.run).toHaveBeenCalledTimes(2);
    expect(toolGateway.invoke).toHaveBeenCalledWith({
      transport: "local",
      tool: "echo",
      input: { text: "repo summary" }
    });
    expect(result.finalState).toBe("completed");
    expect(result.delivery.status).toBe("completed");
    expect(result.delivery.final_result).toBe("final answer");

    const eventNames = eventLogStore.getAll().map((event) => event.type);
    expect(eventNames.filter((event) => event === "ModelCalled")).toHaveLength(2);
    expect(eventNames).toContain("ToolInvoked");
    expect(eventNames).toContain("ToolReturned");
  });

  it("accepts tool call envelopes wrapped in a single-item array", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: JSON.stringify([
            {
              tool_calls: [
                {
                  transport: "local",
                  tool: "echo",
                  input: { text: "repo summary" }
                }
              ]
            }
          ])
        })
        .mockResolvedValueOnce({
          outputText: "```json\n{\"final_result\":\"article\",\"verification\":[\"source-a\"],\"artifacts\":[],\"risks\":[],\"next_actions\":[]}\n```"
        })
    };
    const toolGateway = {
      invoke: vi.fn().mockResolvedValue({
        ok: true,
        output: { text: "repo summary" },
        latencyMs: 1,
        costMeta: { provider: "local", tokens: 0, usd: 0 }
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
      runtime: runtime as any,
      toolGateway
    });

    const result = await orchestrator.runSingleNodeTask({
      taskId: "task-loop-2",
      nodeId: "node-1",
      role: "planner",
      runtimeInput: {
        model: "mock-model",
        reasoner: "medium",
        input: [{ role: "user", content: "solve task" }]
      }
    });

    expect(runtime.run).toHaveBeenCalledTimes(2);
    expect(toolGateway.invoke).toHaveBeenCalledTimes(1);
    expect(result.delivery.final_result).toBe("article");
    expect(result.delivery.verification).toEqual(["source-a"]);
  });

  it("re-prompts after an empty model response instead of treating it as completion", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: ""
        })
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            final_result: "recovered answer",
            verification: ["source-a"],
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

    const result = await orchestrator.runSingleNodeTask({
      taskId: "task-loop-3",
      nodeId: "node-1",
      role: "planner",
      runtimeInput: {
        model: "mock-model",
        reasoner: "medium",
        input: [{ role: "user", content: "solve task" }]
      }
    });

    expect(runtime.run).toHaveBeenCalledTimes(2);
    expect(result.delivery.final_result).toBe("recovered answer");
    expect(result.finalState).toBe("completed");
  });

  it("re-prompts when the model emits xml-like pseudo tool call text instead of treating it as final output", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: [
            "我来帮你调研。首先让我收集项目信息。",
            "<tool_call>",
            "<function=web_search>",
            "<parameter=query>",
            "OpenClaw github 开源项目",
            "</parameter>",
            "</function>",
            "</tool_call>"
          ].join("\n")
        })
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            final_result: "verified article",
            verification: ["source-a"],
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

    const result = await orchestrator.runSingleNodeTask({
      taskId: "task-loop-xml-1",
      nodeId: "node-1",
      role: "planner",
      runtimeInput: {
        model: "mock-model",
        reasoner: "medium",
        input: [{ role: "user", content: "solve task" }]
      }
    });

    expect(runtime.run).toHaveBeenCalledTimes(2);
    expect(result.finalState).toBe("completed");
    expect(result.delivery.final_result).toBe("verified article");
  });

  it("aborts instead of completing when tool loops exhaust without a final delivery", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          tool_calls: [
            {
              transport: "local",
              tool: "web_search",
              input: { query: "openclaw github" }
            }
          ]
        })
      })
    };
    const toolGateway = {
      invoke: vi.fn().mockResolvedValue({
        ok: true,
        output: { results: [] },
        latencyMs: 1,
        costMeta: { provider: "local", tokens: 0, usd: 0 }
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
      runtime: runtime as any,
      toolGateway
    });

    const result = await orchestrator.runSingleNodeTask({
      taskId: "task-loop-exhausted-1",
      nodeId: "node-1",
      role: "planner",
      runtimeInput: {
        model: "mock-model",
        reasoner: "medium",
        input: [{ role: "user", content: "research project" }]
      }
    });

    expect(runtime.run).toHaveBeenCalledTimes(5);
    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("tool_loop_exhausted");
    expect(eventLogStore.getAll().map((event) => event.type)).toContain("NodeAborted");
    expect(eventLogStore.getAll().map((event) => event.type)).not.toContain("NodeCompleted");
  });
});
