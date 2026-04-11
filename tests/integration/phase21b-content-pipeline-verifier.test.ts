import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskExecutor } from "../../src/runtime/executor";

const ACCEPT_REPORT = `# Content Package

## Objective
Explain why task families matter.

## Audience
Operator teams.

## Key Message
Family-native runtimes improve trusted delivery.

## Outline
- Intro
- Why families matter

## Primary Draft
# Why Task Families Matter

Family-native runtimes improve trusted delivery.

## Channel Variants
- channel: linkedin
  format: short_post
  summary: summary
  content: content
  source_anchor: primary-draft

## Production Plan
- next_step: review draft
- distribution_target: linkedin
- handoff_check: verify bundle completeness
`;

const REVISE_REPORT = `# Content Package

## Objective
Explain why task families matter.

## Audience
Operator teams.

## Key Message
Family-native runtimes improve trusted delivery.

## Outline
- Intro
- Why families matter

## Primary Draft
# Why Task Families Matter

Family-native runtimes improve trusted delivery.

## Channel Variants
- channel: linkedin
  format: short_post
  summary: summary
  content: content
  source_anchor: wrong-anchor

## Production Plan
- handoff_check: verify bundle completeness
`;

const REJECT_REPORT = `# Content Package

## Objective
Explain why task families matter.

## Audience
Operator teams.

## Key Message
Family-native runtimes improve trusted delivery.

## Outline
- Intro

## Primary Draft

## Channel Variants

## Production Plan
- handoff_check: verify bundle completeness
`;

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "content-accept-outline.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-accept-primary-draft.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-accept-channel-variants.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-accept-production-plan.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-revise-outline.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-revise-primary-draft.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-revise-channel-variants.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-revise-production-plan.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-reject-outline.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-reject-primary-draft.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-reject-channel-variants.json"), { force: true });
  fs.rmSync(path.resolve("artifacts", "content-reject-production-plan.json"), { force: true });
});

function createContentExecutor(args: {
  taskId: string;
  report: string;
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
          task_kind: "content_pipeline",
          execution_mode: "single_node",
          roles: ["planner", "writer"],
          needs_verification: true,
          reason: "content package required"
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
          verification: [
            { kind: "artifact_check", summary: "content package generated", passed: true }
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
    availableLocalTools: ["write_artifact", "verify_content_bundle"],
    taskIdFactory: () => args.taskId
  });
}

describe("phase21b content pipeline verifier", () => {
  it("accepts a complete content package", async () => {
    const executor = createContentExecutor({
      taskId: "content-accept",
      report: ACCEPT_REPORT
    });

    const result = await executor.execute({ input: "Create a content package" });

    expect(result.finalState).toBe("completed");
    expect((result.delivery as any).acceptance_proof.decision).toBe("accept");
    expect((result.delivery as any).artifacts).toEqual([
      "artifacts/content-accept-outline.md",
      "artifacts/content-accept-primary-draft.md",
      "artifacts/content-accept-channel-variants.json",
      "artifacts/content-accept-production-plan.json"
    ]);
  });

  it("revises a content package when variants or production plan are weak", async () => {
    const executor = createContentExecutor({
      taskId: "content-revise",
      report: REVISE_REPORT
    });

    const result = await executor.execute({ input: "Create a content package" });

    expect(result.finalState).toBe("aborted");
    expect((result.delivery as any).status).toBe("blocked");
    expect((result.delivery as any).acceptance_proof.decision).toBe("revise");
    expect((result.delivery as any).acceptance_proof.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "variant_message_mismatch" }),
        expect.objectContaining({ kind: "production_plan_invalid" })
      ])
    );
  });

  it("rejects a content package when the bundle is structurally invalid", async () => {
    const executor = createContentExecutor({
      taskId: "content-reject",
      report: REJECT_REPORT
    });

    const result = await executor.execute({ input: "Create a content package" });

    expect(result.finalState).toBe("aborted");
    expect((result.delivery as any).status).toBe("blocked");
    expect((result.delivery as any).acceptance_proof.decision).toBe("reject");
    expect((result.delivery as any).acceptance_proof.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "draft_structure_invalid" }),
        expect.objectContaining({ kind: "missing_channel_variant" })
      ])
    );
  });
});
