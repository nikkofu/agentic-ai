import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTaskLifecycle } from "../../src/runtime/taskLifecycle";

afterEach(() => {
  fs.rmSync(path.resolve("artifacts", "phase14-browser-run-summary.md"), { force: true });
  fs.rmSync(path.resolve("artifacts", "phase14-browser-steps.json"), { force: true });
});

describe("phase14 browser workflow gold path", () => {
  it("shows browser workflow execution truth for a completed run", async () => {
    fs.mkdirSync(path.resolve("artifacts"), { recursive: true });
    fs.writeFileSync(path.resolve("artifacts", "phase14-browser-run-summary.md"), "run summary", "utf8");
    fs.writeFileSync(path.resolve("artifacts", "phase14-browser-steps.json"), "[]", "utf8");

    const lifecycle = createTaskLifecycle({
      executor: {
        execute: vi.fn(),
        resume: vi.fn()
      } as any,
      taskStore: {
        getGraph: vi.fn().mockResolvedValue({
          taskId: "task-phase14-browser",
          status: "completed",
          nodes: {
            "node-root": { state: "completed", role: "planner" }
          }
        }),
        getEvents: vi.fn().mockResolvedValue([
          {
            type: "IntentClassified",
            payload: {
              task_id: "task-phase14-browser",
              task_kind: "browser_workflow",
              execution_mode: "single_node",
              needs_verification: true
            }
          },
          {
            type: "TaskClosed",
            payload: {
              task_id: "task-phase14-browser",
              state: "completed",
              delivery: {
                status: "completed",
                final_result: "form submitted",
                artifacts: [
                  "artifacts/phase14-browser-run-summary.md",
                  "artifacts/phase14-browser-steps.json"
                ],
                verification: [
                  {
                    kind: "page_state",
                    summary: "form page loaded",
                    locator: "#form",
                    passed: true
                  },
                  {
                    kind: "form_result",
                    summary: "confirmation banner visible",
                    locator: "#confirmation",
                    passed: true
                  }
                ],
                family: "browser_workflow",
                delivery_proof: {
                  family: "browser_workflow",
                  steps: [
                    { kind: "open_session", status: "completed", summary: "opened page" },
                    { kind: "execute_step", status: "completed", summary: "submitted form" },
                    { kind: "validate_outcome", status: "completed", summary: "confirmation banner visible" }
                  ],
                  replayHints: ["retry submit"]
                }
              }
            }
          }
        ])
      } as any
    });

    const inspection = await lifecycle.inspectTask("task-phase14-browser");

    expect(inspection.runtimeInspector?.finalDelivery?.stepCount).toBe(3);
    expect(inspection.runtimeInspector?.finalDelivery?.lastSuccessfulStep).toBe("validate_outcome");
    expect(inspection.runtimeInspector?.finalDelivery?.validationSummary).toBe("confirmation banner visible");
    expect(inspection.runtimeInspector?.finalDelivery?.recoveryAttempts).toBe(1);
  });
});
