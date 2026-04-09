import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "../../src/runtime/executor";

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "phase15-run-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase15-steps.json"), { force: true });
});

describe("phase15 browser verifier revise", () => {
  it("marks recoverable browser mismatch as revise", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase15-run-summary.md"), "ok", "utf8");
    fs.writeFileSync(path.resolve("artifacts", "phase15-steps.json"), "[]", "utf8");

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
      runtime: { run: vi.fn().mockResolvedValue({ outputText: JSON.stringify({ task_kind: "browser_workflow", execution_mode: "single_node", roles: ["planner"], needs_verification: true, reason: "browser" }) }) } as any,
      orchestrator: {
        runSingleNodeContext: vi.fn().mockResolvedValue({
          finalState: "completed",
          stateTrace: ["pending", "running", "evaluating", "completed"],
          delivery: {
            status: "completed",
            final_result: "",
            artifacts: ["artifacts/phase15-run-summary.md", "artifacts/phase15-steps.json"],
            verification: [],
            risks: [],
            next_actions: [],
            family: "browser_workflow",
            delivery_proof: {
              family: "browser_workflow",
              steps: [
                { kind: "open_session", status: "completed", summary: "opened" },
                { kind: "validate_outcome", status: "blocked", summary: "confirmation missing" }
              ],
              replayHints: ["retry submit"]
            }
          }
        }),
        runParallelContexts: vi.fn(),
        resumeTask: vi.fn()
      } as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({ model: "m", reasoner: "medium", apiKey: "k" }),
      availableLocalTools: ["understand_page", "validate_browser_outcome"]
    });

    const result = await executor.execute({ input: "fill browser form" });
    expect(result.finalState).toBe("aborted");
    expect((result.delivery as any).acceptance_proof.decision).toBe("revise");
  });
});
