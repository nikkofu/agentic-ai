import { describe, expect, it, vi } from "vitest";

import { createTaskLifecycle } from "../../src/runtime/taskLifecycle";

describe("phase14 browser workflow blocked", () => {
  it("explains browser target/outcome failure in the inspector", async () => {
    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-phase14-browser-blocked",
          status: "aborted",
          nodes: {
            "node-root": { state: "aborted", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "IntentClassified",
            payload: {
              task_id: "task-phase14-browser-blocked",
              task_kind: "browser_workflow",
              execution_mode: "single_node",
              needs_verification: true
            }
          },
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-phase14-browser-blocked",
              state: "aborted",
              delivery: {
                status: "blocked",
                final_result: "",
                artifacts: [],
                verification: [
                  {
                    kind: "page_state",
                    summary: "page loaded",
                    locator: "#form",
                    passed: true
                  }
                ],
                blocking_reason: "browser_outcome_not_reached",
                family: "browser_workflow",
                delivery_proof: {
                  family: "browser_workflow",
                  steps: [
                    { kind: "open_session", status: "completed", summary: "opened page" },
                    { kind: "execute_step", status: "blocked", summary: "submit button missing" }
                  ],
                  replayHints: ["reload page and retry"]
                }
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-phase14-browser-blocked");

    expect(inspection.runtimeInspector?.finalDelivery?.status).toBe("blocked");
    expect(inspection.runtimeInspector?.finalDelivery?.blockingReason).toBe("browser_outcome_not_reached");
    expect(inspection.runtimeInspector?.finalDelivery?.stepCount).toBe(2);
    expect(inspection.runtimeInspector?.finalDelivery?.lastSuccessfulStep).toBe("open_session");
    expect(inspection.runtimeInspector?.finalDelivery?.validationSummary).toBe("browser_outcome_not_reached");
  });
});
