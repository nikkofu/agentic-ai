import { describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "../../src/runtime/executor";

describe("phase 12 join policy", () => {
  it("blocks tree execution when a typed join decision returns block", async () => {
    const eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn()
    };
    const eventLogStore = {
      append: vi.fn(),
      getAll: vi.fn().mockReturnValue([])
    };
    const runtime = {
      run: vi
        .fn()
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            task_kind: "research_writing",
            execution_mode: "tree",
            roles: ["planner", "researcher", "writer"],
            needs_verification: true,
            reason: "staged work"
          })
        })
        .mockResolvedValueOnce({
          outputText: JSON.stringify({
            summary: "planner summary",
            recommended_tools: ["web_search"],
            required_capabilities: ["research", "writing"],
            verification_policy: "cite urls",
            spawn_children: [
              {
                id: "node-research",
                role: "researcher",
                input: "Research OpenClaw",
                depends_on: ["node-root"]
              }
            ]
          })
        })
    };
    const orchestrator = {
      runParallelContexts: vi
        .fn()
        .mockResolvedValueOnce({
          completedNodes: 1,
          joinDecision: "deliver",
          nodeResults: [
            {
              nodeId: "node-root",
              finalState: "completed",
              delivery: {
                status: "completed",
                final_result: "planner summary",
                artifacts: [],
                verification: [],
                risks: [],
                next_actions: []
              }
            }
          ]
        })
        .mockResolvedValueOnce({
          completedNodes: 1,
          joinDecision: "block",
          nodeResults: [
            {
              nodeId: "node-research",
              finalState: "aborted",
              delivery: {
                status: "blocked",
                final_result: "",
                artifacts: [],
                verification: [],
                risks: [],
                blocking_reason: "policy_verification_required",
                next_actions: []
              }
            }
          ]
        })
    };

    const executor = createTaskExecutor({
      config: {
        models: {
          default: "test-model",
          fallback: [],
          by_agent_role: {
            planner: "test-model",
            researcher: "test-model",
            coder: "test-model",
            writer: "test-model"
          },
          embeddings: { default: "embed-model" }
        },
        reasoner: {
          default: "medium",
          by_agent_role: {
            planner: "medium",
            researcher: "medium",
            coder: "medium",
            writer: "medium"
          }
        },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      runtime: runtime as any,
      eventBus: eventBus as any,
      eventLogStore: eventLogStore as any,
      orchestrator: orchestrator as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      }),
      taskIdFactory: () => "task-phase12-join-1"
    });

    const result = await executor.execute({
      input: "research OpenClaw and write article"
    });

    expect(result.finalState).toBe("aborted");
    expect(result.delivery.status).toBe("blocked");
    expect(result.delivery.blocking_reason).toBe("join_blocked");
  });
});
