import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "../../src/runtime/executor";
import { createMemoryEngine } from "../../src/runtime/memoryEngine";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("phase18 memory promotion", () => {
  it("promotes accepted execution summaries into project memory", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-promo-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase18-promo-user-"));
    tempRoots.push(repoRoot, userHome);

    const memoryStore = createMemoryEngine({ repoRoot, userHome });
    const eventBus = { publish: vi.fn(), subscribe: vi.fn() };
    const runtime = {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          task_kind: "research_writing",
          execution_mode: "single_node",
          roles: ["planner"],
          needs_verification: true,
          reason: "research delivery"
        })
      })
    };
    const orchestrator = {
      runSingleNodeContext: vi.fn().mockResolvedValue({
        finalState: "completed",
        stateTrace: ["pending", "completed"],
        delivery: {
          status: "completed",
          final_result: "stable accepted summary",
          artifacts: ["artifacts/final.md"],
          verification: [{ kind: "source", summary: "source-a", sourceId: "source-a", passed: true }],
          risks: [],
          next_actions: [],
          acceptance_proof: {
            decision: "accept",
            verifier_summary: "accepted",
            findings: []
          }
        }
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
      eventLogStore: { append: vi.fn(), getAll: vi.fn().mockReturnValue([]) } as any,
      orchestrator: orchestrator as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({
        model: "test-model",
        reasoner: "medium",
        apiKey: "test-key"
      }),
      taskIdFactory: () => "task-phase18-1",
      memoryStore
    });

    await executor.execute({
      input: "research a topic and summarize it"
    });

    const projectCurated = await memoryStore.retrieve({ layer: "project", state: "curated" });

    expect(projectCurated.length).toBeGreaterThan(0);
    expect(projectCurated.some((entry) => entry.body.includes("stable accepted summary"))).toBe(true);
  });
});
