import { describe, expect, it, vi } from "vitest";

import { createTaskLifecycle } from "../../src/runtime/taskLifecycle";

describe("phase14 research writing blocked", () => {
  it("explains insufficient source coverage in the inspector", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-phase14-research-blocked",
          status: "aborted",
          nodes: {
            "node-root": { state: "aborted", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "IntentClassified",
            payload: {
              task_id: "task-phase14-research-blocked",
              task_kind: "research_writing",
              execution_mode: "tree",
              needs_verification: true
            }
          },
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-phase14-research-blocked",
              state: "aborted",
              delivery: {
                status: "blocked",
                final_result: "",
                artifacts: [],
                verification: [
                  {
                    kind: "source",
                    sourceId: "source-a",
                    summary: "only one source",
                    locator: "https://example.com/a",
                    passed: true
                  }
                ],
                blocking_reason: "policy_source_coverage_required",
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

    const inspection = await lifecycle.inspectTask("task-phase14-research-blocked");

    expect(inspection.runtimeInspector?.finalDelivery?.status).toBe("blocked");
    expect(inspection.runtimeInspector?.finalDelivery?.blockingReason).toBe("policy_source_coverage_required");
    expect(inspection.runtimeInspector?.finalDelivery?.sourceCoverage).toBe(1);
    expect(inspection.runtimeInspector?.explanation).toBe("Task blocked: policy_source_coverage_required");
  });
});
