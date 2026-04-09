import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskLifecycle } from "../../src/runtime/taskLifecycle";

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "phase14-research.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase14-research-references.json"), { force: true });
});

describe("phase14 research writing gold path", () => {
  it("shows source coverage and references preview for a verified research delivery", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase14-research.md"), "# Final article", "utf8");
    fs.writeFileSync(
      path.resolve("artifacts", "phase14-research-references.json"),
      JSON.stringify([{ sourceId: "source-a" }, { sourceId: "source-b" }], null, 2),
      "utf8"
    );

    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-phase14-research",
          status: "completed",
          nodes: {
            "node-root": { state: "completed", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "IntentClassified",
            payload: {
              task_id: "task-phase14-research",
              task_kind: "research_writing",
              execution_mode: "tree",
              needs_verification: true
            }
          },
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-phase14-research",
              state: "completed",
              delivery: {
                status: "completed",
                final_result: "# Final article",
                artifacts: [
                  "artifacts/phase14-research.md",
                  "artifacts/phase14-research-references.json"
                ],
                verification: [
                  {
                    kind: "source",
                    sourceId: "source-a",
                    summary: "README",
                    locator: "https://example.com/a",
                    passed: true
                  },
                  {
                    kind: "source",
                    sourceId: "source-b",
                    summary: "Docs",
                    locator: "https://example.com/b",
                    passed: true
                  }
                ],
                family: "research_writing",
                delivery_proof: {
                  family: "research_writing",
                  steps: []
                }
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-phase14-research");

    expect(inspection.runtimeInspector?.finalDelivery?.artifactCount).toBe(2);
    expect(inspection.runtimeInspector?.finalDelivery?.family).toBe("research_writing");
    expect(inspection.runtimeInspector?.finalDelivery?.sourceCoverage).toBe(2);
    expect(inspection.runtimeInspector?.finalDelivery?.verifiedClaimCount).toBe(2);
    expect(inspection.runtimeInspector?.finalDelivery?.referencesPreview).toEqual(["README", "Docs"]);
    expect(inspection.runtimeInspector?.finalDelivery?.runProofSummary).toBe("source_coverage=2; references=2");
    expect(inspection.runtimeInspector?.finalDelivery?.artifacts).toEqual([
      { path: "artifacts/phase14-research.md", exists: true, nonEmpty: true },
      { path: "artifacts/phase14-research-references.json", exists: true, nonEmpty: true }
    ]);
  });
});
