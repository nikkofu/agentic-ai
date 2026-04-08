import { describe, expect, it, vi } from "vitest";

import { createOrchestrator } from "../../src/core/orchestrator";
import { createInMemoryEventBus } from "../../src/core/eventBus";
import { createInMemoryEventLogStore } from "../../src/core/eventLogStore";
import { createExecutionContext } from "../../src/runtime/context";

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

  it("runs a node directly from execution context and assembles runtime input in core", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          final_result: "article draft",
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
          { id: "node-write", role: "writer", input: "write the article", depends_on: ["node-root"] }
        ]
      },
      policy: {
        recommendedTools: ["web_search", "verify_sources"],
        requiredCapabilities: ["research", "writing"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-write",
        role: "writer",
        input: "write the article",
        depends_on: ["node-root"]
      },
      task: "调研项目并写文章",
      dependencyOutputs: ["research summary"],
      memoryRefs: ["mem://task/1"]
    });

    const result = await orchestrator.runSingleNodeContext({
      taskId: "task-context-1",
      context,
      resolveRuntimeInput: ({ role, runtimeInput }) => ({
        ...runtimeInput,
        model: role === "writer" ? "writer-model" : "planner-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    expect(result.finalState).toBe("completed");
    expect(result.delivery.final_result).toBe("article draft");
    expect(runtime.run).toHaveBeenCalledTimes(1);
    expect(runtime.run.mock.calls[0][0]).toMatchObject({
      model: "writer-model",
      reasoner: "medium"
    });
    expect(runtime.run.mock.calls[0][0].input?.[0]?.content).toContain("autonomous writer agent");
    expect(runtime.run.mock.calls[0][0].input?.[0]?.content).toContain("Planner recommended tools: web_search, verify_sources.");
    expect(runtime.run.mock.calls[0][0].input?.[1]?.content).toContain("Current node objective: write the article");
  });

  it("blocks tool calls that violate planner policy instead of invoking the gateway", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          tool_calls: [
            {
              transport: "local",
              tool: "github_file",
              input: { owner: "x", repo: "y", path: "README.md" }
            }
          ]
        })
      })
    };
    const toolGateway = {
      invoke: vi.fn()
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
      toolGateway: toolGateway as any
    });

    const context = createExecutionContext({
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "needs staged execution"
      },
      plan: null,
      policy: {
        recommendedTools: ["web_search"],
        requiredCapabilities: ["research"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-research",
        role: "researcher",
        input: "research",
        depends_on: ["node-root"]
      },
      task: "调研项目",
      dependencyOutputs: [],
      memoryRefs: []
    });

    const result = await orchestrator.runSingleNodeContext({
      taskId: "task-policy-1",
      context,
      resolveRuntimeInput: ({ runtimeInput }) => ({
        ...runtimeInput,
        model: "research-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    expect(toolGateway.invoke).not.toHaveBeenCalled();
    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("policy_tool_not_allowed");
  });

  it("blocks research completion without verification when policy requires evidence", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          final_result: "draft article",
          verification: [],
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
        reason: "needs staged execution"
      },
      plan: null,
      policy: {
        recommendedTools: ["web_search"],
        requiredCapabilities: ["research", "writing"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-write",
        role: "writer",
        input: "write article",
        depends_on: ["node-root"]
      },
      task: "调研项目并写文章",
      dependencyOutputs: ["research summary"],
      memoryRefs: []
    });

    const result = await orchestrator.runSingleNodeContext({
      taskId: "task-policy-2",
      context,
      resolveRuntimeInput: ({ runtimeInput }) => ({
        ...runtimeInput,
        model: "writer-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("policy_verification_required");
  });

  it("revises once when evaluator marks the draft as insufficient but recoverable", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            final_result: "thin draft",
            verification: ["source-a"],
            artifacts: [],
            risks: [],
            next_actions: []
          })
        })
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            final_result: "improved draft",
            verification: ["source-a", "source-b"],
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
      runtime: runtime as any,
      evaluator: vi
        .fn()
        .mockReturnValueOnce({ decision: "revise", reason: "quality_below_threshold" })
        .mockReturnValueOnce({ decision: "stop", reason: "quality_sufficient" }) as any
    });

    const context = createExecutionContext({
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "needs staged execution"
      },
      plan: null,
      policy: {
        recommendedTools: ["web_search"],
        requiredCapabilities: ["research", "writing"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-write",
        role: "writer",
        input: "write article",
        depends_on: ["node-root"]
      },
      task: "调研项目并写文章",
      dependencyOutputs: ["research summary"],
      memoryRefs: []
    });

    const result = await orchestrator.runSingleNodeContext({
      taskId: "task-eval-1",
      context,
      resolveRuntimeInput: ({ runtimeInput }) => ({
        ...runtimeInput,
        model: "writer-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    expect(runtime.run).toHaveBeenCalledTimes(2);
    expect(result.finalState).toBe("completed");
    expect(result.delivery.final_result).toBe("improved draft");
    expect(eventLogStore.getAll().map((event) => event.type)).toContain("NodeRevised");
  });

  it("blocks immediately when evaluator returns block even if model emitted a result", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          final_result: "draft article",
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
      runtime: runtime as any,
      evaluator: vi.fn().mockReturnValue({
        decision: "block",
        reason: "unsafe_claims"
      }) as any
    });

    const result = await orchestrator.runSingleNodeTask({
      taskId: "task-eval-2",
      nodeId: "node-1",
      role: "writer",
      runtimeInput: {
        model: "writer-model",
        reasoner: "medium",
        input: [{ role: "user", content: "write article" }]
      }
    });

    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("unsafe_claims");
  });

  it("allows multiple concrete research tools when policy grants the research capability", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            tool_calls: [
              {
                transport: "local",
                tool: "web_search",
                input: { query: "openclaw github" }
              },
              {
                transport: "local",
                tool: "page_fetch",
                input: { url: "https://example.com" }
              }
            ]
          })
        })
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            final_result: "research complete",
            verification: ["source-a"],
            artifacts: [],
            risks: [],
            next_actions: []
          })
        })
    };
    const toolGateway = {
      invoke: vi.fn().mockResolvedValue({
        ok: true,
        output: { ok: true },
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
      toolGateway: toolGateway as any
    });

    const context = createExecutionContext({
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "needs staged execution"
      },
      plan: null,
      policy: {
        recommendedTools: [],
        requiredCapabilities: ["research"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-research",
        role: "researcher",
        input: "research",
        depends_on: ["node-root"]
      },
      task: "调研项目",
      dependencyOutputs: [],
      memoryRefs: []
    });

    const result = await orchestrator.runSingleNodeContext({
      taskId: "task-cap-1",
      context,
      resolveRuntimeInput: ({ runtimeInput }) => ({
        ...runtimeInput,
        model: "research-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    expect(toolGateway.invoke).toHaveBeenCalledTimes(2);
    expect(result.finalState).toBe("completed");
  });

  it("blocks a tool call when its capability is outside the planner policy", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          tool_calls: [
            {
              transport: "local",
              tool: "github_file",
              input: { owner: "x", repo: "y", file_path: "README.md" }
            }
          ]
        })
      })
    };
    const toolGateway = {
      invoke: vi.fn()
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
      toolGateway: toolGateway as any
    });

    const context = createExecutionContext({
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "needs staged execution"
      },
      plan: null,
      policy: {
        recommendedTools: [],
        requiredCapabilities: ["research"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-research",
        role: "researcher",
        input: "research",
        depends_on: ["node-root"]
      },
      task: "调研项目",
      dependencyOutputs: [],
      memoryRefs: []
    });

    const result = await orchestrator.runSingleNodeContext({
      taskId: "task-cap-2",
      context,
      resolveRuntimeInput: ({ runtimeInput }) => ({
        ...runtimeInput,
        model: "research-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    expect(toolGateway.invoke).not.toHaveBeenCalled();
    expect(result.finalState).toBe("aborted");
    expect(result.delivery.blocking_reason).toBe("policy_tool_not_allowed");
  });

  it("injects working memory and retrieval context into core-built runtime input", async () => {
    const eventBus = createInMemoryEventBus();
    const eventLogStore = createInMemoryEventLogStore();
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          final_result: "memory-aware draft",
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

    const context = createExecutionContext({
      intent: {
        task_kind: "research_writing",
        execution_mode: "tree",
        roles: ["planner", "researcher", "writer"],
        needs_verification: true,
        reason: "needs staged execution"
      },
      plan: null,
      policy: {
        recommendedTools: ["web_search"],
        requiredCapabilities: ["research", "writing"],
        verificationPolicy: "cite urls"
      },
      node: {
        id: "node-write",
        role: "writer",
        input: "write article",
        depends_on: ["node-root"]
      },
      task: "调研项目并写文章",
      dependencyOutputs: ["research summary"],
      memoryRefs: ["mem://task/1"],
      workingMemory: ["maintain zhihu tone", "avoid unsupported claims"],
      retrievalContext: [
        {
          sourceId: "rag://openclaw/readme",
          content: "OpenClaw provides an agent runtime with tool-use and loop execution.",
          relevance: 0.94
        }
      ]
    });

    const result = await orchestrator.runSingleNodeContext({
      taskId: "task-memory-1",
      context,
      resolveRuntimeInput: ({ runtimeInput }) => ({
        ...runtimeInput,
        model: "writer-model",
        reasoner: "medium",
        apiKey: "test-key"
      })
    });

    expect(result.finalState).toBe("completed");
    expect(runtime.run).toHaveBeenCalledTimes(1);
    expect(runtime.run.mock.calls[0][0].input?.[0]?.content).toContain("WorkingMemory[1]: maintain zhihu tone");
    expect(runtime.run.mock.calls[0][0].input?.[0]?.content).toContain("Retrieved[1] rag://openclaw/readme");
    expect(runtime.run.mock.calls[0][0].__memory?.workingMemory).toEqual([
      "maintain zhihu tone",
      "avoid unsupported claims"
    ]);
    expect(runtime.run.mock.calls[0][0].__memory?.retrievalContext?.[0]?.sourceId).toBe("rag://openclaw/readme");
  });
});
