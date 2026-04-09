import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "../../src/runtime/executor";
import { createMemoryEngine } from "../../src/runtime/memoryEngine";
import { composePromptPayload } from "../../src/prompt/promptComposer";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("phase16 memory productization", () => {
  it("writes task memory and project memory summaries during execution", async () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-exec-repo-"));
    const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "phase16-exec-user-"));
    tempRoots.push(repoRoot, userHome);

    const memoryEngine = createMemoryEngine({ repoRoot, userHome });
    await memoryEngine.record({
      layer: "project",
      state: "curated",
      kind: "architecture_decision",
      body: "Existing curated memory."
    });
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
            final_result: "researched result",
            artifacts: [],
            verification: [{ kind: "source", summary: "src", sourceId: "src-1", passed: true }],
            risks: [],
            next_actions: []
          }
        }),
        runParallelContexts: vi.fn(),
        resumeTask: vi.fn()
      } as any,
      finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
      resolveModelRoute: vi.fn().mockReturnValue({ model: "m", reasoner: "medium", apiKey: "k" }),
      memoryStore: memoryEngine,
      taskIdFactory: () => "task-phase16-1"
    });

    await executor.execute({ input: "research and write summary" });

    const taskEntries = await memoryEngine.retrieve({ layer: "task", state: "raw", taskId: "task-phase16-1" });
    const curatedProjectEntries = await memoryEngine.retrieve({ layer: "project", state: "curated" });
    const compressedProjectEntries = await memoryEngine.retrieve({ layer: "project", state: "compressed" });

    expect(taskEntries.some((entry) => entry.body.includes("researched result"))).toBe(true);
    expect(curatedProjectEntries.some((entry) => entry.body.includes("research and write summary"))).toBe(true);
    expect(compressedProjectEntries.some((entry) => entry.body.includes("Existing curated memory."))).toBe(true);
  });

  it("keeps prompt memory bounded to curated and compressed layers", () => {
    const payload = composePromptPayload({
      context: {
        intent: null,
        plan: null,
        policy: undefined,
        node: {
          id: "node-root",
          role: "planner",
          input: "plan next steps",
          depends_on: []
        },
        task: "plan next steps",
        dependencyOutputs: [],
        memoryRefs: ["personal:compressed:p1", "project:compressed:proj1"],
        workingMemory: ["project summary"],
        retrievalContext: []
      }
    });

    expect(payload.memory.some((entry) => entry.includes("personal"))).toBe(true);
    expect(payload.memory.some((entry) => entry.includes("project"))).toBe(true);
  });
});
