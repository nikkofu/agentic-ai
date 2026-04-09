import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "../../src/runtime/executor";

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "phase15-research-final.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase15-research-references.json"), { force: true });
});

describe("phase15 research verifier accept", () => {
  it("marks a verified research delivery as accepted", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase15-research-final.md"), "# Final article", "utf8");
    fs.writeFileSync(path.resolve("artifacts", "phase15-research-references.json"), "[]", "utf8");

    const executor = createTaskExecutor({
      config: {
        models: { default: "m", fallback: [], by_agent_role: { planner: "m", researcher: "m", coder: "m", writer: "m" }, embeddings: { default: "e" } },
        reasoner: { default: "medium", by_agent_role: { planner: "medium", researcher: "medium", coder: "medium", writer: "medium" } },
        scheduler: { default_policy: "bfs", policy_overrides: {} },
        guardrails: { max_depth: 4, max_branch: 3, max_steps: 60, max_budget: 5 },
        evaluator: { weights: { quality: 0.6, cost: 0.2, latency: 0.2 } },
        retry: { max_retries: 3, base_delay_ms: 1000 },
        mcp_servers: {}
      } as any,
      eventBus: { publish: vi.fn() } as any,
      eventLogStore: { getAll: vi.fn().mockReturnValue([]) } as any,
      runtime: { run: vi.fn().mockResolvedValue({ outputText: JSON.stringify({ task_kind: "research_writing", execution_mode: "single_node", roles: ["planner"], needs_verification: true, reason: "research" }) }) } as any,
      orchestrator: {
        runSingleNodeContext: vi.fn().mockResolvedValue({
          finalState: "completed",
          stateTrace: ["pending", "running", "evaluating", "completed"],
          delivery: {
            status: "completed",
            final_result: "# Final article",
            artifacts: ["artifacts/phase15-research-final.md", "artifacts/phase15-research-references.json"],
            verification: [
              { kind: "source", summary: "README", sourceId: "a", passed: true },
              { kind: "source", summary: "Docs", sourceId: "b", passed: true }
            ],
            risks: [],
            next_actions: []
          }
        }),
        runParallelContexts: vi.fn(),
        resumeTask: vi.fn()
      } as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({ model: "m", reasoner: "medium", apiKey: "k" }),
      availableLocalTools: ["web_search", "verify_sources"]
    });

    const result = await executor.execute({ input: "research and write an article" });

    expect(result.finalState).toBe("completed");
    expect((result.delivery as any).acceptance_proof.decision).toBe("accept");
  });
});
