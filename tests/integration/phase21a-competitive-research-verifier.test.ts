import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "../../src/runtime/executor";

const ACCEPT_REPORT = `# Competitive Research

## Subject
Agentic AI

## Comparison Targets
- OpenClaw
- Hermes Agent

## Comparison Dimensions
- positioning
- trust

## Executive Summary
Agentic AI is differentiated by trusted delivery.

## Key Findings
- Agentic AI is stronger on delivery trust.
- Hermes Agent is stronger on memory automation.

## Recommendations
- Keep pushing trusted delivery.
`;

const REVISE_REPORT = `# Competitive Research

## Subject
Agentic AI

## Comparison Targets
- OpenClaw
- Hermes Agent

## Comparison Dimensions
- positioning
- trust

## Executive Summary
Agentic AI is differentiated by trusted delivery.

## Key Findings
- Agentic AI is stronger on delivery trust.
`;

const REJECT_REPORT = `# Competitive Research

## Subject
Agentic AI

## Comparison Targets
- OpenClaw

## Comparison Dimensions
- positioning

## Executive Summary
This report is under-scoped.

## Key Findings
- OpenClaw has a broader assistant surface.

## Recommendations
- Re-scope the analysis.
`;

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "competitive-accept-report.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-accept-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-accept-comparison.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-accept-references.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-revise-report.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-revise-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-revise-comparison.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-revise-references.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-reject-report.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-reject-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-reject-comparison.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "competitive-reject-references.json"), { force: true });
});

function createCompetitiveExecutor(args: {
  taskId: string;
  report: string;
  verification: Array<Record<string, unknown>>;
}) {
  return createTaskExecutor({
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
    runtime: {
      run: vi.fn().mockResolvedValue({
        outputText: JSON.stringify({
          task_kind: "competitive_research",
          execution_mode: "single_node",
          roles: ["planner"],
          needs_verification: true,
          reason: "comparative package required"
        })
      })
    } as any,
    orchestrator: {
      runSingleNodeContext: vi.fn().mockResolvedValue({
        finalState: "completed",
        stateTrace: ["pending", "running", "evaluating", "completed"],
        delivery: {
          status: "completed",
          final_result: args.report,
          artifacts: [],
          verification: args.verification,
          risks: [],
          next_actions: []
        }
      }),
      runParallelContexts: vi.fn(),
      resumeTask: vi.fn()
    } as any,
    finalizeDelivery: vi.fn().mockImplementation(async ({ delivery }) => delivery),
    resolveModelRoute: vi.fn().mockReturnValue({ model: "m", reasoner: "medium", apiKey: "k" }),
    availableLocalTools: ["web_search", "verify_sources"],
    taskIdFactory: () => args.taskId
  });
}

describe("phase21a competitive research verifier", () => {
  it("accepts a complete competitive research bundle", async () => {
    const executor = createCompetitiveExecutor({
      taskId: "competitive-accept",
      report: ACCEPT_REPORT,
      verification: [
        { kind: "source", summary: "OpenClaw README", sourceId: "a", passed: true },
        { kind: "source", summary: "Hermes README", sourceId: "b", passed: true }
      ]
    });

    const result = await executor.execute({ input: "Compare agent platforms" });

    expect(result.finalState).toBe("completed");
    expect((result.delivery as any).acceptance_proof.decision).toBe("accept");
    expect((result.delivery as any).artifacts).toEqual([
      "artifacts/competitive-accept-report.md",
      "artifacts/competitive-accept-summary.md",
      "artifacts/competitive-accept-comparison.json",
      "artifacts/competitive-accept-references.json"
    ]);
  });

  it("revises a competitive research bundle when recommendations are missing", async () => {
    const executor = createCompetitiveExecutor({
      taskId: "competitive-revise",
      report: REVISE_REPORT,
      verification: [
        { kind: "source", summary: "OpenClaw README", sourceId: "a", passed: true },
        { kind: "source", summary: "Hermes README", sourceId: "b", passed: true }
      ]
    });

    const result = await executor.execute({ input: "Compare agent platforms" });

    expect(result.finalState).toBe("aborted");
    expect((result.delivery as any).status).toBe("blocked");
    expect((result.delivery as any).acceptance_proof.decision).toBe("revise");
    expect((result.delivery as any).acceptance_proof.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "non_actionable_recommendation" })
      ])
    );
  });

  it("rejects a competitive research bundle when comparison scope is incomplete", async () => {
    const executor = createCompetitiveExecutor({
      taskId: "competitive-reject",
      report: REJECT_REPORT,
      verification: [
        { kind: "source", summary: "OpenClaw README", sourceId: "a", passed: true }
      ]
    });

    const result = await executor.execute({ input: "Compare agent platforms" });

    expect(result.finalState).toBe("aborted");
    expect((result.delivery as any).status).toBe("blocked");
    expect((result.delivery as any).acceptance_proof.decision).toBe("reject");
    expect((result.delivery as any).acceptance_proof.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "missing_comparison_target" })
      ])
    );
  });
});
